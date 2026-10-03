import crypto from 'crypto';
import { db } from '../db';
import { CredentialService } from '../security/credentialService';
import { kieAiProvider } from '../providers/kieAiProvider';

export interface AdminPoolKeyItem {
  id: string;
  label: string;
  keyLastFour: string;
  maskedKey: string;
  status: 'ACTIVE' | 'EXHAUSTED' | 'INVALID' | 'DISABLED';
  balance: number;
  totalGenerations: number;
  priority: number;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPoolSummary {
  keys: AdminPoolKeyItem[];
  totalKeys: number;
  activeKeys: number;
  totalCreditsAccumulated: number;
  totalGenerations: number;
}

export class AdminKeyPoolService {
  /**
   * List all keys in the Admin Pool with masked secrets and aggregated metrics.
   */
  static async getPoolSummary(): Promise<AdminPoolSummary> {
    const res = await db.execute(`
      SELECT id, label, keyLastFour, status, balance, totalGenerations, priority, lastTestedAt, lastError, createdAt, updatedAt
      FROM admin_key_pool
      ORDER BY priority DESC, createdAt ASC
    `);

    const keys: AdminPoolKeyItem[] = res.rows.map((row: any) => ({
      id: String(row.id),
      label: String(row.label),
      keyLastFour: String(row.keyLastFour),
      maskedKey: `****************${row.keyLastFour}`,
      status: row.status as any,
      balance: Number(row.balance || 0),
      totalGenerations: Number(row.totalGenerations || 0),
      priority: Number(row.priority || 1),
      lastTestedAt: row.lastTestedAt ? String(row.lastTestedAt) : null,
      lastError: row.lastError ? String(row.lastError) : null,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    }));

    const totalKeys = keys.length;
    const activeKeys = keys.filter((k) => k.status === 'ACTIVE').length;
    const totalCreditsAccumulated = keys
      .filter((k) => k.status === 'ACTIVE')
      .reduce((sum, k) => sum + (k.balance > 0 ? k.balance : 0), 0);
    const totalGenerations = keys.reduce((sum, k) => sum + k.totalGenerations, 0);

    return {
      keys,
      totalKeys,
      activeKeys,
      totalCreditsAccumulated: Math.round(totalCreditsAccumulated * 100) / 100,
      totalGenerations,
    };
  }

  /**
   * Adds a single API key to the Admin Pool.
   */
  static async addKey(label: string, rawApiKey: string, priority = 1): Promise<AdminPoolKeyItem> {
    const cleanKey = rawApiKey.trim();
    if (cleanKey.length < 8) {
      throw new Error('API key appears too short or invalid');
    }

    const keyLastFour = cleanKey.slice(-4);
    const encryptedApiKey = CredentialService.encryptApiKey(cleanKey);
    const now = new Date().toISOString();
    const id = 'pool_key_' + crypto.randomUUID().substring(0, 12);
    const cleanLabel = label.trim() || `Kie Account ${keyLastFour}`;

    // Test connection & check initial balance
    const checkRes = await kieAiProvider.checkCreditBalance(cleanKey);
    const initialStatus = checkRes.success ? 'ACTIVE' : 'INVALID';
    const initialBalance = checkRes.success ? checkRes.balance : 0;
    const lastError = checkRes.success ? null : checkRes.message || 'Validation failed';

    await db.execute({
      sql: `INSERT INTO admin_key_pool (
              id, label, encryptedApiKey, keyLastFour, status, balance, totalGenerations, priority, lastTestedAt, lastError, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      args: [id, cleanLabel, encryptedApiKey, keyLastFour, initialStatus, initialBalance, priority, now, lastError, now, now],
    });

    return {
      id,
      label: cleanLabel,
      keyLastFour,
      maskedKey: `****************${keyLastFour}`,
      status: initialStatus,
      balance: initialBalance,
      totalGenerations: 0,
      priority,
      lastTestedAt: now,
      lastError,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Adds multiple API keys from bulk text (one key per line, or "Label: Key" format).
   */
  static async addBulkKeys(bulkText: string): Promise<{ added: number; errors: string[] }> {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    let added = 0;
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let label = '';
      let rawKey = line;

      if (line.includes(':')) {
        const parts = line.split(':');
        label = parts[0].trim();
        rawKey = parts.slice(1).join(':').trim();
      } else if (line.includes(',')) {
        const parts = line.split(',');
        label = parts[0].trim();
        rawKey = parts.slice(1).join(',').trim();
      }

      if (!rawKey || rawKey.length < 8) {
        errors.push(`Line ${i + 1}: Skipped (Invalid key format)`);
        continue;
      }

      try {
        await this.addKey(label || `Pool Key #${i + 1}`, rawKey);
        added++;
      } catch (err: any) {
        errors.push(`Line ${i + 1}: ${err.message}`);
      }
    }

    return { added, errors };
  }

  /**
   * Tests and updates balance for a specific key.
   */
  static async testKey(id: string): Promise<AdminPoolKeyItem> {
    const res = await db.execute({
      sql: `SELECT * FROM admin_key_pool WHERE id = ?`,
      args: [id],
    });

    if (res.rows.length === 0) {
      throw new Error('Key not found in pool');
    }

    const row = res.rows[0];
    const decryptedKey = CredentialService.decryptApiKey(String(row.encryptedApiKey));
    const checkRes = await kieAiProvider.checkCreditBalance(decryptedKey);
    const now = new Date().toISOString();

    let newStatus: 'ACTIVE' | 'EXHAUSTED' | 'INVALID' = 'ACTIVE';
    let lastError: string | null = null;

    if (!checkRes.success) {
      newStatus = 'INVALID';
      lastError = checkRes.message || 'Koneksi ke Kie.ai gagal atau API Key ditolak.';
    } else if (checkRes.balance <= 0) {
      newStatus = 'EXHAUSTED';
      lastError = `Saldo di akun Kie.ai telah habis (0 kredit).`;
    } else if (checkRes.balance < 10) {
      newStatus = 'ACTIVE';
      lastError = `Peringatan: Sisa saldo ${checkRes.balance} kredit (kritis, segera top-up).`;
    } else {
      newStatus = 'ACTIVE';
      lastError = null;
    }

    await db.execute({
      sql: `UPDATE admin_key_pool
            SET status = ?, balance = ?, lastTestedAt = ?, lastError = ?, updatedAt = ?
            WHERE id = ?`,
      args: [newStatus, checkRes.balance, now, lastError, now, id],
    });

    return {
      id: String(row.id),
      label: String(row.label),
      keyLastFour: String(row.keyLastFour),
      maskedKey: `****************${row.keyLastFour}`,
      status: newStatus,
      balance: checkRes.balance,
      totalGenerations: Number(row.totalGenerations || 0),
      priority: Number(row.priority || 1),
      lastTestedAt: now,
      lastError,
      createdAt: String(row.createdAt),
      updatedAt: now,
    };
  }

  /**
   * Tests and syncs balances for all keys in the pool in parallel.
   */
  static async syncAllBalances(): Promise<AdminPoolSummary> {
    const res = await db.execute(`SELECT id FROM admin_key_pool`);
    await Promise.all(
      res.rows.map((row: any) =>
        this.testKey(String(row.id)).catch((err) => {
          console.warn(`[Pool Sync] Key ${row.id} sync failed:`, err.message);
        })
      )
    );
    return this.getPoolSummary();
  }

  /**
   * Updates key attributes (label, status, priority).
   */
  static async updateKey(id: string, updates: { label?: string; status?: string; priority?: number }): Promise<void> {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const args: any[] = [];

    if (updates.label !== undefined) {
      fields.push('label = ?');
      args.push(updates.label);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      args.push(updates.status);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      args.push(updates.priority);
    }

    if (fields.length === 0) return;

    fields.push('updatedAt = ?');
    args.push(now);
    args.push(id);

    await db.execute({
      sql: `UPDATE admin_key_pool SET ${fields.join(', ')} WHERE id = ?`,
      args,
    });
  }

  /**
   * Deletes a key from the pool.
   */
  static async deleteKey(id: string): Promise<void> {
    await db.execute({
      sql: `DELETE FROM admin_key_pool WHERE id = ?`,
      args: [id],
    });
  }

  /**
   * Selects the next best ACTIVE key for generation (Highest priority, positive balance).
   */
  static async getNextActiveDecryptedKey(): Promise<{ id: string; apiKey: string; label: string } | null> {
    const list = await this.getAllActiveDecryptedKeys();
    return list.length > 0 ? list[0] : null;
  }

  /**
   * Returns all ACTIVE decrypted keys ordered by priority, load, and balance.
   * Filters out keys with balance < 10 (insufficient for Suno generation).
   */
  static async getAllActiveDecryptedKeys(): Promise<Array<{ id: string; apiKey: string; label: string }>> {
    let res = await db.execute(`
      SELECT id, label, encryptedApiKey, balance, totalGenerations
      FROM admin_key_pool
      WHERE status = 'ACTIVE' AND balance >= 10
      ORDER BY priority DESC, totalGenerations ASC, balance DESC
    `);

    // Fallback: If no key has balance >= 10, try any ACTIVE key
    if (res.rows.length === 0) {
      res = await db.execute(`
        SELECT id, label, encryptedApiKey, balance, totalGenerations
        FROM admin_key_pool
        WHERE status = 'ACTIVE' AND balance > 0
        ORDER BY priority DESC, totalGenerations ASC, balance DESC
      `);
    }

    const result: Array<{ id: string; apiKey: string; label: string }> = [];
    for (const row of res.rows) {
      try {
        const apiKey = CredentialService.decryptApiKey(String(row.encryptedApiKey));
        result.push({
          id: String(row.id),
          apiKey,
          label: String(row.label),
        });
      } catch {
        // Skip invalid encrypted keys
      }
    }
    return result;
  }

  /**
   * Returns ALL decrypted keys from the pool regardless of status or balance,
   * specifically for checking task statuses (since querying task recordInfo costs 0 credits).
   */
  static async getAllDecryptedKeysForPolling(): Promise<Array<{ id: string; apiKey: string; label: string }>> {
    const res = await db.execute(`
      SELECT id, label, encryptedApiKey, balance, totalGenerations, status
      FROM admin_key_pool
      ORDER BY priority DESC, balance DESC
    `);

    const result: Array<{ id: string; apiKey: string; label: string }> = [];
    for (const row of res.rows) {
      try {
        const apiKey = CredentialService.decryptApiKey(String(row.encryptedApiKey));
        result.push({
          id: String(row.id),
          apiKey,
          label: String(row.label),
        });
      } catch {
        // Skip invalid encrypted keys
      }
    }
    return result;
  }

  /**
   * Records a successful generation on the pool key, decrements balance estimate,
   * and immediately triggers a background live balance check from Kie.ai.
   */
  static async recordUsage(keyId: string): Promise<void> {
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE admin_key_pool
            SET totalGenerations = totalGenerations + 1,
                balance = MAX(0, balance - 10),
                updatedAt = ?
            WHERE id = ?`,
      args: [now, keyId],
    });

    // Asynchronously refresh real live balance from Kie.ai in the background
    this.testKey(keyId).catch((err) => {
      console.warn(`[Auto Live-Sync] Key ${keyId} balance sync failed:`, err.message);
    });
  }

  /**
   * Marks a pool key as EXHAUSTED when Kie.ai reports insufficient credits.
   */
  static async markExhausted(keyId: string, error = 'Credit limit reached on provider'): Promise<void> {
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE admin_key_pool
            SET status = 'EXHAUSTED', balance = 0, lastError = ?, updatedAt = ?
            WHERE id = ?`,
      args: [error, now, keyId],
    });
  }
}
