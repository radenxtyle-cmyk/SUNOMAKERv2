import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/authMiddleware';
import { db } from '../db';
import { AuditService } from '../services/auditService';
import { AdminKeyPoolService } from '../services/adminKeyPoolService';

export const adminRouter = Router();

// Protect all admin endpoints
adminRouter.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Overview dashboard stats
 */
adminRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const totalUsersRes = await db.execute('SELECT COUNT(*) as count FROM users');
    const totalGenerationsRes = await db.execute('SELECT COUNT(*) as count FROM generations');
    const completedGenRes = await db.execute("SELECT COUNT(*) as count FROM generations WHERE status = 'COMPLETED'");
    const failedGenRes = await db.execute("SELECT COUNT(*) as count FROM generations WHERE status = 'FAILED'");
    const connectedUsersRes = await db.execute("SELECT COUNT(*) as count FROM user_kie_credentials WHERE status = 'CONNECTED'");

    const totalUsers = Number(totalUsersRes.rows[0]?.count || 0);
    const connectedUsers = Number(connectedUsersRes.rows[0]?.count || 0);
    const disconnectedUsers = Math.max(0, totalUsers - connectedUsers);
    const totalGenerations = Number(totalGenerationsRes.rows[0]?.count || 0);
    const successfulGenerations = Number(completedGenRes.rows[0]?.count || 0);
    const failedGenerations = Number(failedGenRes.rows[0]?.count || 0);

    return res.json({
      totalUsers,
      connectedKieUsers: connectedUsers,
      disconnectedUsers,
      totalGenerations,
      successfulGenerations,
      failedGenerations,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to compute admin statistics.' });
  }
});

/**
 * GET /api/admin/users
 * Lists users and their BYOK connection status.
 * STRICT SECURITY: NEVER SELECT OR RETURN encryptedApiKey!
 */
adminRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const resUsers = await db.execute(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.credits,
        u.createdAt,
        u.updatedAt,
        k.status as kieStatus,
        k.keyLastFour as kieKeySuffix,
        k.lastTestedAt as kieLastTestedAt,
        COUNT(g.id) as generationCount
      FROM users u
      LEFT JOIN user_kie_credentials k ON u.id = k.userId
      LEFT JOIN generations g ON u.id = g.userId
      GROUP BY u.id
      ORDER BY u.createdAt DESC
    `);

    // Masked suffix only, no encryption material
    const formatted = resUsers.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role),
      status: String(row.status),
      credits: Number(row.credits ?? 20),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      kieConnection: {
        connected: row.kieStatus === 'CONNECTED',
        status: row.kieStatus || 'NOT_CONNECTED',
        maskedKey: row.kieKeySuffix ? `****************${row.kieKeySuffix}` : null,
        lastTestedAt: row.kieLastTestedAt ? String(row.kieLastTestedAt) : null,
      },
      generationCount: Number(row.generationCount || 0),
    }));

    return res.json(formatted);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/admin/users/:id/credits
 * Grant, set, or deduct user credits
 */
adminRouter.post('/users/:id/credits', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, action = 'add', reason } = req.body;

    const numAmount = Number(amount);
    if (isNaN(numAmount)) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const userRes = await db.execute({
      sql: 'SELECT id, name, email, credits FROM users WHERE id = ?',
      args: [id],
    });

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentCredits = Number(userRes.rows[0]?.credits ?? 20);
    let newCredits = currentCredits;

    if (action === 'set') {
      newCredits = Math.max(0, numAmount);
    } else if (action === 'deduct') {
      newCredits = Math.max(0, currentCredits - numAmount);
    } else {
      // Default: 'add'
      newCredits = currentCredits + numAmount;
    }

    const now = new Date().toISOString();
    await db.execute({
      sql: 'UPDATE users SET credits = ?, updatedAt = ? WHERE id = ?',
      args: [newCredits, now, id],
    });

    await AuditService.log(
      req.user!.id,
      'ADMIN_CREDITS_MODIFIED',
      { targetUserId: id, action, amount: numAmount, previousCredits: currentCredits, newCredits, reason },
      req.ip
    );

    return res.json({
      success: true,
      userId: id,
      credits: newCredits,
      message: `Credits updated to ${newCredits}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update user credits' });
  }
});

/**
 * POST /api/admin/distribute-credits
 * Distribute credits to all active users
 */
adminRouter.post('/distribute-credits', async (req: Request, res: Response) => {
  try {
    const { amount, reason } = req.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please specify a positive credit amount' });
    }

    const now = new Date().toISOString();
    await db.execute({
      sql: "UPDATE users SET credits = credits + ?, updatedAt = ? WHERE status = 'ACTIVE'",
      args: [numAmount, now],
    });

    await AuditService.log(
      req.user!.id,
      'ADMIN_CREDITS_BULK_DISTRIBUTED',
      { amount: numAmount, reason },
      req.ip
    );

    return res.json({
      success: true,
      amount: numAmount,
      message: `Successfully distributed +${numAmount} credits to all active users!`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Bulk distribution failed' });
  }
});

/**
 * GET /api/admin/users/:id
 * Detailed user profile (no secrets)
 */
adminRouter.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRes = await db.execute({
      sql: `SELECT u.id, u.name, u.email, u.role, u.status, u.createdAt, u.updatedAt,
                   k.status as kieStatus, k.keyLastFour as kieKeySuffix, k.lastTestedAt as kieLastTestedAt
            FROM users u
            LEFT JOIN user_kie_credentials k ON u.id = k.userId
            WHERE u.id = ?`,
      args: [id],
    });

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = userRes.rows[0];
    const genCountRes = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM generations WHERE userId = ?',
      args: [id],
    });

    return res.json({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role),
      status: String(row.status),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      generationCount: Number(genCountRes.rows[0]?.count || 0),
      kieConnection: {
        connected: row.kieStatus === 'CONNECTED',
        status: row.kieStatus || 'NOT_CONNECTED',
        maskedKey: row.kieKeySuffix ? `****************${row.kieKeySuffix}` : null,
        lastTestedAt: row.kieLastTestedAt ? String(row.kieLastTestedAt) : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get user details' });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Suspend, activate, or update role
 */
adminRouter.patch('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, role } = req.body;
    const now = new Date().toISOString();

    if (status && (status === 'ACTIVE' || status === 'SUSPENDED')) {
      await db.execute({
        sql: 'UPDATE users SET status = ?, updatedAt = ? WHERE id = ?',
        args: [status, now, id],
      });
      await AuditService.log(req.user!.id, 'ADMIN_USER_STATUS_CHANGE', { targetUserId: id, newStatus: status }, req.ip);
    }

    if (role && (role === 'ADMIN' || role === 'USER')) {
      await db.execute({
        sql: 'UPDATE users SET role = ?, updatedAt = ? WHERE id = ?',
        args: [role, now, id],
      });
    }

    return res.json({ success: true, message: 'User updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Permanently delete a user account and associated records
 */
adminRouter.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Anda tidak dapat menghapus akun admin yang sedang login.' });
    }

    const userRes = await db.execute({ sql: 'SELECT id, email, name FROM users WHERE id = ?', args: [id] });
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    const targetUser = userRes.rows[0];

    // Cascade delete user-related rows
    await db.execute({ sql: 'DELETE FROM sessions WHERE userId = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM user_kie_credentials WHERE userId = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM tracks WHERE userId = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM generations WHERE userId = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM lyrics WHERE userId = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });

    await AuditService.log(
      req.user!.id,
      'ADMIN_USER_DELETED',
      { targetUserId: id, email: targetUser.email, name: targetUser.name },
      req.ip
    );

    return res.json({ success: true, message: `User ${targetUser.name} berhasil dihapus permanen.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Gagal menghapus user' });
  }
});

/**
 * GET /api/admin/generations
 * Lists system generations.
 * STRICT SECURITY: NEVER INCLUDE CREDENTIALS OR HEADERS!
 */
adminRouter.get('/generations', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit || 50);
    const genRes = await db.execute({
      sql: `SELECT g.id, g.userId, g.taskId, g.type, g.title, g.style, g.model, g.status,
                   g.duration, g.errorCode, g.errorMessage, g.createdAt, g.completedAt,
                   u.name as userName, u.email as userEmail
            FROM generations g
            JOIN users u ON g.userId = u.id
            ORDER BY g.createdAt DESC
            LIMIT ?`,
      args: [limit],
    });

    return res.json(genRes.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch generations' });
  }
});

/**
 * GET /api/admin/audit-logs
 */
adminRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const logs = await AuditService.getRecentLogs(100);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ==========================================
// ADMIN MULTI-KEY POOL & CREDIT AGGREGATOR
// ==========================================

/**
 * GET /api/admin/key-pool
 * Returns all keys in the Admin Pool with aggregated credits and statistics
 */
adminRouter.get('/key-pool', async (req: Request, res: Response) => {
  try {
    if (req.query.sync === 'true') {
      const liveSummary = await AdminKeyPoolService.syncAllBalances();
      return res.json(liveSummary);
    }
    const summary = await AdminKeyPoolService.getPoolSummary();
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch key pool' });
  }
});

/**
 * POST /api/admin/key-pool
 * Adds a single API key to the pool
 */
adminRouter.post('/key-pool', async (req: Request, res: Response) => {
  try {
    const { label, apiKey, priority } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const item = await AdminKeyPoolService.addKey(label || '', apiKey, priority ? Number(priority) : 1);
    await AuditService.log(req.user!.id, 'ADMIN_KEY_POOL_ADDED', { label: item.label, keySuffix: item.keyLastFour }, req.ip);

    return res.status(201).json(item);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to add key to pool' });
  }
});

/**
 * POST /api/admin/key-pool/bulk
 * Bulk imports multiple API keys (one per line or Label: Key format)
 */
adminRouter.post('/key-pool/bulk', async (req: Request, res: Response) => {
  try {
    const { bulkText } = req.body;
    if (!bulkText || typeof bulkText !== 'string') {
      return res.status(400).json({ error: 'Bulk text content required' });
    }

    const result = await AdminKeyPoolService.addBulkKeys(bulkText);
    await AuditService.log(req.user!.id, 'ADMIN_KEY_POOL_BULK_IMPORT', { count: result.added }, req.ip);

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Bulk import failed' });
  }
});

/**
 * POST /api/admin/key-pool/:id/test
 * Tests connection & refreshes balance for a specific key
 */
adminRouter.post('/key-pool/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await AdminKeyPoolService.testKey(id);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Test failed' });
  }
});

/**
 * POST /api/admin/key-pool/sync-all
 * Tests all keys and recomputes total credit pool
 */
adminRouter.post('/key-pool/sync-all', async (req: Request, res: Response) => {
  try {
    const summary = await AdminKeyPoolService.syncAllBalances();
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Sync all failed' });
  }
});

/**
 * PATCH /api/admin/key-pool/:id
 * Updates key status (ACTIVE/DISABLED), label, or priority
 */
adminRouter.patch('/key-pool/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { label, status, priority } = req.body;

    await AdminKeyPoolService.updateKey(id, { label, status, priority });
    return res.json({ success: true, message: 'Key updated' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update key' });
  }
});

/**
 * DELETE /api/admin/key-pool/:id
 * Removes a key from the pool
 */
adminRouter.delete('/key-pool/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await AdminKeyPoolService.deleteKey(id);
    await AuditService.log(req.user!.id, 'ADMIN_KEY_POOL_DELETED', { keyId: id }, req.ip);

    return res.json({ success: true, message: 'Key removed from pool' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to delete key' });
  }
});

