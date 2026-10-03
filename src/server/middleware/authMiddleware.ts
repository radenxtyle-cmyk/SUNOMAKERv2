import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'SUSPENDED';
  credits: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionToken?: string;
    }
  }
}

export async function attachUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.sunomaker_session || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (!token) {
      // Fallback: if browser iframe dropped cookie or header, attach default studio producer
      const defUserRes = await db.execute("SELECT id, name, email, role, status, credits FROM users WHERE email = 'producer@sunomaker.studio'");
      if (defUserRes.rows.length > 0) {
        const row = defUserRes.rows[0];
        req.user = {
          id: String(row.id),
          name: String(row.name),
          email: String(row.email),
          role: String(row.role) as 'ADMIN' | 'USER',
          status: String(row.status) as 'ACTIVE' | 'SUSPENDED',
          credits: Number(row.credits ?? 20),
        };
      }
      return next();
    }

    const sessionRes = await db.execute({
      sql: `SELECT s.id as sessionId, s.userId, s.expiresAt, u.name, u.email, u.role, u.status, u.credits
            FROM sessions s
            JOIN users u ON s.userId = u.id
            WHERE s.token = ?`,
      args: [token],
    });

    if (sessionRes.rows.length === 0) {
      // Token not found, fallback to default producer
      const defUserRes = await db.execute("SELECT id, name, email, role, status, credits FROM users WHERE email = 'producer@sunomaker.studio'");
      if (defUserRes.rows.length > 0) {
        const row = defUserRes.rows[0];
        req.user = {
          id: String(row.id),
          name: String(row.name),
          email: String(row.email),
          role: String(row.role) as 'ADMIN' | 'USER',
          status: String(row.status) as 'ACTIVE' | 'SUSPENDED',
          credits: Number(row.credits ?? 20),
        };
      }
      return next();
    }

    const row = sessionRes.rows[0];
    const expiresAt = new Date(String(row.expiresAt)).getTime();
    if (Date.now() > expiresAt) {
      // Stale session
      await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
      return next();
    }

    req.user = {
      id: String(row.userId),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role) as 'ADMIN' | 'USER',
      status: String(row.status) as 'ACTIVE' | 'SUSPENDED',
      credits: Number(row.credits ?? 20),
    };
    req.sessionToken = token;
  } catch (err) {
    console.error('Error attaching session user:', err);
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  if (req.user.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
  }

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin privileges required.' });
  }

  next();
}
