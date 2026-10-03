import crypto from 'crypto';
import { db } from '../db';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const CURRENT_KEY_VERSION = 1;

/**
 * Derives a consistent 32-byte key from the master secret.
 */
function getDerivedKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export interface EncryptedPayload {
  v: number;
  iv: string; // hex
  tag: string; // hex
  ciphertext: string; // hex
}

export class CredentialService {
  /**
   * Encrypts a raw API key using AES-256-GCM.
   * Returns a compact serialized string: v{version}:{iv}:{tag}:{ciphertext}
   */
  static encryptApiKey(rawApiKey: string, secret = config.credentialEncryptionKey): string {
    if (!rawApiKey || typeof rawApiKey !== 'string') {
      throw new Error('Invalid API key provided for encryption');
    }

    const key = getDerivedKey(secret);
    const iv = crypto.randomBytes(12); // standard 96-bit IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let ciphertext = cipher.update(rawApiKey, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    // Serialization format: v1:iv:tag:ciphertext
    return `v${CURRENT_KEY_VERSION}:${iv.toString('hex')}:${tag}:${ciphertext}`;
  }

  /**
   * Decrypts an encrypted payload string in backend memory.
   * Throws if tampered with, corrupted, or key is wrong.
   */
  static decryptApiKey(serialized: string, secret = config.credentialEncryptionKey): string {
    if (!serialized || typeof serialized !== 'string') {
      throw new Error('Encrypted payload missing or invalid');
    }

    const parts = serialized.split(':');
    if (parts.length !== 4) {
      throw new Error('Malformed encrypted credential format');
    }

    const [versionTag, ivHex, tagHex, ciphertextHex] = parts;
    if (versionTag !== `v${CURRENT_KEY_VERSION}`) {
      throw new Error(`Unsupported encryption version: ${versionTag}`);
    }

    const key = getDerivedKey(secret);
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Masks the API key: shows only the last 4 characters preceded by asterisks.
   * Example: "kie_123456789ABCDEFG" -> "****************DEFG"
   */
  static maskApiKey(rawOrLastFour: string): string {
    const clean = rawOrLastFour.trim();
    const lastFour = clean.length > 4 ? clean.slice(-4) : clean;
    return `****************${lastFour}`;
  }

  /**
   * Saves or updates a user's encrypted Kie.ai credential.
   */
  static async saveCredential(userId: string, rawApiKey: string): Promise<{ id: string; maskedKey: string; keyLastFour: string }> {
    const trimmed = rawApiKey.trim();
    if (trimmed.length < 8) {
      throw new Error('API key appears too short or invalid.');
    }

    const keyLastFour = trimmed.slice(-4);
    const encryptedApiKey = this.encryptApiKey(trimmed);
    const maskedKey = this.maskApiKey(keyLastFour);
    const now = new Date().toISOString();

    // Check if user already has credentials
    const existing = await db.execute({
      sql: 'SELECT id FROM user_kie_credentials WHERE userId = ?',
      args: [userId],
    });

    let credentialId: string;
    if (existing.rows.length > 0) {
      credentialId = String(existing.rows[0].id);
      await db.execute({
        sql: `UPDATE user_kie_credentials
              SET encryptedApiKey = ?, keyLastFour = ?, status = 'CONNECTED', lastTestedAt = ?, updatedAt = ?
              WHERE userId = ?`,
        args: [encryptedApiKey, keyLastFour, now, now, userId],
      });
    } else {
      credentialId = 'cred_' + crypto.randomUUID().substring(0, 12);
      await db.execute({
        sql: `INSERT INTO user_kie_credentials (id, userId, provider, encryptedApiKey, keyLastFour, status, lastTestedAt, createdAt, updatedAt)
              VALUES (?, ?, 'kie_ai', ?, ?, 'CONNECTED', ?, ?, ?)`,
        args: [credentialId, userId, encryptedApiKey, keyLastFour, now, now, now],
      });
    }

    return {
      id: credentialId,
      maskedKey,
      keyLastFour,
    };
  }

  /**
   * Retrieves safe metadata about the user's credential.
   * NEVER returns the raw or decrypted API key.
   */
  static async getCredential(userId: string) {
    const res = await db.execute({
      sql: 'SELECT id, userId, provider, encryptedApiKey, keyLastFour, status, lastTestedAt, createdAt, updatedAt FROM user_kie_credentials WHERE userId = ?',
      args: [userId],
    });

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    let isMock = false;
    try {
      if (row.encryptedApiKey) {
        const decrypted = this.decryptApiKey(String(row.encryptedApiKey));
        const lower = decrypted.toLowerCase().trim();
        isMock = lower.startsWith('mock_') || lower.startsWith('kie_mock_') || lower.startsWith('demo_');
      }
    } catch {
      // ignore
    }

    return {
      id: String(row.id),
      userId: String(row.userId),
      provider: String(row.provider),
      keyLastFour: String(row.keyLastFour),
      maskedKey: this.maskApiKey(String(row.keyLastFour)),
      status: String(row.status),
      lastTestedAt: String(row.lastTestedAt),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      isMock,
    };
  }

  /**
   * Internal backend only: Decrypts user's API key in backend memory for outgoing API requests.
   * MUST NEVER be sent in HTTP responses or logged.
   */
  static async getDecryptedKey(userId: string): Promise<string | null> {
    const res = await db.execute({
      sql: 'SELECT encryptedApiKey FROM user_kie_credentials WHERE userId = ?',
      args: [userId],
    });

    if (res.rows.length === 0 || !res.rows[0].encryptedApiKey) {
      return null;
    }

    const encrypted = String(res.rows[0].encryptedApiKey);
    return this.decryptApiKey(encrypted);
  }

  /**
   * Deletes a user's stored credential (disconnect).
   */
  static async deleteCredential(userId: string): Promise<boolean> {
    const res = await db.execute({
      sql: 'DELETE FROM user_kie_credentials WHERE userId = ?',
      args: [userId],
    });
    return res.rowsAffected > 0;
  }

  /**
   * Updates the lastTestedAt timestamp and status.
   */
  static async updateStatus(userId: string, status: 'CONNECTED' | 'ERROR' | 'DISCONNECTED') {
    const now = new Date().toISOString();
    await db.execute({
      sql: 'UPDATE user_kie_credentials SET status = ?, lastTestedAt = ?, updatedAt = ? WHERE userId = ?',
      args: [status, now, now, userId],
    });
  }
}
