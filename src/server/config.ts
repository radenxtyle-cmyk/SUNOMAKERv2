import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Ensure an encryption key exists
let encryptionKey = process.env.KIE_CREDENTIAL_ENCRYPTION_KEY;
if (!encryptionKey || encryptionKey.length < 32) {
  // Generate a deterministic or fallback key for development if not provided
  encryptionKey = 'sunomaker-default-secure-encryption-key-32-bytes-long!';
}

const isVercel = Boolean(process.env.VERCEL);
const defaultDataDir = isVercel ? '/tmp/sunomaker-data' : path.resolve(process.cwd(), 'data');
const defaultDbUrl = isVercel ? 'file:/tmp/sunomaker-data/sunomaker.db' : 'file:./data/sunomaker.db';

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  dbUrl:
    process.env.TURSO_DATABASE_URL ||
    process.env.TURSO_URL ||
    process.env.DATABASE_URL ||
    process.env.STORAGE_URL ||
    process.env.STORAGE_DATABASE_URL ||
    defaultDbUrl,
  dbAuthToken:
    process.env.TURSO_AUTH_TOKEN ||
    process.env.DATABASE_AUTH_TOKEN ||
    process.env.STORAGE_AUTH_TOKEN ||
    process.env.TURSO_TOKEN ||
    process.env.DATABASE_TOKEN,
  sessionSecret: process.env.SESSION_SECRET || 'sunomaker-secure-session-secret-key-32chars',
  credentialEncryptionKey: encryptionKey,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  callbackUrl: process.env.CALLBACK_URL || 'http://localhost:3000/api/kie/callback',
  mockKieApi: process.env.MOCK_KIE_API === 'true',
  dataDir: defaultDataDir,
  isVercel,
};
