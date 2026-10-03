import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { requireAuth } from '../middleware/authMiddleware';
import { CredentialService } from '../security/credentialService';
import { AuditService } from '../services/auditService';
import { AdminKeyPoolService } from '../services/adminKeyPoolService';

export const authRouter = Router();

const COOKIE_NAME = 'sunomaker_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function resolveKieConnectionState(userId: string) {
  const cred = await CredentialService.getCredential(userId).catch(() => null);
  if (cred && cred.status === 'CONNECTED') {
    return {
      connected: true,
      maskedKey: cred.maskedKey,
      lastTestedAt: cred.lastTestedAt,
      isPool: false,
    };
  }

  const poolSummary = await AdminKeyPoolService.getPoolSummary().catch(() => null);
  if (poolSummary && poolSummary.activeKeys > 0) {
    return {
      connected: true,
      maskedKey: `Studio Pool (${poolSummary.activeKeys} Active Keys)`,
      lastTestedAt: new Date().toISOString(),
      isPool: true,
      activeKeys: poolSummary.activeKeys,
    };
  }

  return {
    connected: false,
    maskedKey: null,
    lastTestedAt: null,
    isPool: false,
  };
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: SESSION_DURATION_MS,
    path: '/',
  });
}

/**
 * Register a new SUNOMAKER account
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Valid email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [cleanEmail],
    });

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const userId = 'usr_' + crypto.randomUUID().substring(0, 12);
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO users (id, name, email, passwordHash, role, status, credits, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 'USER', 'ACTIVE', 0, ?, ?)`,
      args: [userId, name?.trim() || 'Music Producer', cleanEmail, passwordHash, now, now],
    });

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = 'ses_' + crypto.randomUUID().substring(0, 12);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    await db.execute({
      sql: 'INSERT INTO sessions (id, token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [sessionId, token, userId, expiresAt, now],
    });

    setSessionCookie(res, token);
    await AuditService.log(userId, 'USER_REGISTERED', { email: cleanEmail }, req.ip);

    const kieConn = await resolveKieConnectionState(userId);

    return res.status(201).json({
      token,
      user: {
        id: userId,
        name: name?.trim() || 'Music Producer',
        email: cleanEmail,
        role: 'USER',
        status: 'ACTIVE',
        credits: 0,
      },
      kieConnection: kieConn,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

/**
 * Login
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userRes = await db.execute({
      sql: 'SELECT id, name, email, passwordHash, role, status, credits FROM users WHERE email = ?',
      args: [cleanEmail],
    });

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, String(user.passwordHash));

    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (String(user.status) === 'SUSPENDED') {
      return res.status(403).json({ error: 'Your SUNOMAKER account is suspended.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = 'ses_' + crypto.randomUUID().substring(0, 12);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    await db.execute({
      sql: 'INSERT INTO sessions (id, token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [sessionId, token, String(user.id), expiresAt, now],
    });

    setSessionCookie(res, token);
    await AuditService.log(String(user.id), 'USER_LOGGED_IN', {}, req.ip);

    // Get connection status (BYOK or Studio Pool)
    const kieConnection = await resolveKieConnectionState(String(user.id));

    return res.json({
      token,
      user: {
        id: String(user.id),
        name: String(user.name),
        email: String(user.email),
        role: String(user.role),
        status: String(user.status),
        credits: Number(user.credits ?? 0),
      },
      kieConnection,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to log in.' });
  }
});

/**
 * Logout
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    if (req.sessionToken) {
      await db.execute({
        sql: 'DELETE FROM sessions WHERE token = ?',
        args: [req.sessionToken],
      });
    }
    res.clearCookie(COOKIE_NAME);
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.clearCookie(COOKIE_NAME);
    return res.json({ success: true });
  }
});

/**
 * Get current authenticated user (auto-initializes session if none exists)
 */
authRouter.get('/me', async (req: Request, res: Response) => {
  let user = req.user;
  let token = req.sessionToken;

  if (!user) {
    const defUserRes = await db.execute("SELECT id, name, email, role, status, credits FROM users WHERE email = 'producer@sunomaker.studio'");
    if (defUserRes.rows.length > 0) {
      const u = defUserRes.rows[0];
      user = {
        id: String(u.id),
        name: String(u.name),
        email: String(u.email),
        role: String(u.role) as 'ADMIN' | 'USER',
        status: String(u.status) as 'ACTIVE' | 'SUSPENDED',
        credits: Number(u.credits ?? 0),
      };

      token = crypto.randomBytes(32).toString('hex');
      const sessionId = 'ses_' + crypto.randomUUID().substring(0, 12);
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

      await db.execute({
        sql: 'INSERT INTO sessions (id, token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)',
        args: [sessionId, token, String(u.id), expiresAt, now],
      });

      setSessionCookie(res, token);
      req.user = user;
      req.sessionToken = token;
    }
  }

  if (!user) {
    return res.json({ user: null });
  }

  const kieConnection = await resolveKieConnectionState(user.id);

  return res.json({
    user,
    token,
    kieConnection,
  });
});

/**
 * Update Profile
 */
authRouter.patch('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, newPassword } = req.body;
    const now = new Date().toISOString();

    if (newPassword && typeof newPassword === 'string' && newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'Password baru minimal harus terdiri dari 6 karakter.' });
    }

    const targetId = req.user!.id;
    let effectiveId = targetId;

    const userCheck = await db.execute({
      sql: 'SELECT id FROM users WHERE id = ?',
      args: [targetId],
    });

    if (userCheck.rows.length === 0 && req.user?.email) {
      const emailCheck = await db.execute({
        sql: 'SELECT id FROM users WHERE email = ?',
        args: [req.user.email],
      });
      if (emailCheck.rows.length > 0) {
        effectiveId = String(emailCheck.rows[0].id);
      }
    }

    if (name && typeof name === 'string' && name.trim()) {
      await db.execute({
        sql: 'UPDATE users SET name = ?, updatedAt = ? WHERE id = ?',
        args: [name.trim(), now, effectiveId],
      });
      req.user!.name = name.trim();
    }

    if (newPassword && typeof newPassword === 'string' && newPassword.trim().length >= 6) {
      const hash = await bcrypt.hash(newPassword.trim(), 10);
      await db.execute({
        sql: 'UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?',
        args: [hash, now, effectiveId],
      });
    }

    return res.json({
      success: true,
      message: 'Profil dan kata sandi berhasil diperbarui.',
      user: req.user,
    });
  } catch (err: any) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: err.message || 'Gagal memperbarui profil.' });
  }
});

/**
 * Account Deletion (Section 57)
 */
authRouter.delete('/account', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    // Delete user (cascades to sessions, credentials, generations, tracks)
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM user_kie_credentials WHERE userId = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM sessions WHERE userId = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM generations WHERE userId = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM tracks WHERE userId = ?', args: [userId] });

    res.clearCookie(COOKIE_NAME);
    await AuditService.log(null, 'USER_ACCOUNT_DELETED', { userId }, req.ip);

    return res.json({
      success: true,
      message: 'Account and associated SUNOMAKER metadata deleted. Note: This does not affect your Kie.ai account.',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete account.' });
  }
});

/**
 * Demo switch helper for quick review (Studio Administrator or Alex Producer)
 */
authRouter.post('/demo-switch', async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    const targetEmail = role === 'ADMIN' ? 'admin@sunomaker.studio' : 'producer@sunomaker.studio';

    const userRes = await db.execute({
      sql: 'SELECT id, name, email, role, status FROM users WHERE email = ?',
      args: [targetEmail],
    });

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const user = userRes.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = 'ses_' + crypto.randomUUID().substring(0, 12);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    await db.execute({
      sql: 'INSERT INTO sessions (id, token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [sessionId, token, String(user.id), expiresAt, now],
    });

    setSessionCookie(res, token);
    const kieConnection = await resolveKieConnectionState(String(user.id));

    return res.json({
      token,
      user: {
        id: String(user.id),
        name: String(user.name),
        email: String(user.email),
        role: String(user.role),
        status: String(user.status),
      },
      kieConnection,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to switch demo user.' });
  }
});
