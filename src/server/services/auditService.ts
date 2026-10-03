import crypto from 'crypto';
import { db } from '../db';

export class AuditService {
  /**
   * Logs a security or operational event without sensitive tokens/keys.
   */
  static async log(userId: string | null, action: string, details?: Record<string, any> | string, ipAddress?: string) {
    try {
      const id = 'log_' + crypto.randomUUID().substring(0, 12);
      const now = new Date().toISOString();
      let detailsStr = '';

      if (details) {
        if (typeof details === 'string') {
          detailsStr = details;
        } else {
          // Clone and ensure no sensitive fields exist
          const safeDetails = { ...details };
          delete safeDetails.apiKey;
          delete safeDetails.key;
          delete safeDetails.token;
          delete safeDetails.authorization;
          delete safeDetails.password;
          delete safeDetails.passwordHash;
          delete safeDetails.encryptedApiKey;
          detailsStr = JSON.stringify(safeDetails);
        }
      }

      await db.execute({
        sql: `INSERT INTO audit_logs (id, userId, action, details, ipAddress, createdAt)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, userId, action, detailsStr, ipAddress || '127.0.0.1', now],
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  static async getRecentLogs(limit = 100) {
    const res = await db.execute({
      sql: `SELECT a.*, u.name as userName, u.email as userEmail
            FROM audit_logs a
            LEFT JOIN users u ON a.userId = u.id
            ORDER BY a.createdAt DESC
            LIMIT ?`,
      args: [limit],
    });
    return res.rows;
  }
}
