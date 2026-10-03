import fs from 'fs';
import path from 'path';
import { createClient, Client } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { config } from '../config';

// Ensure data directory exists
try {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
} catch (err) {
  console.warn('[SUNOMAKER DB] Could not create dataDir (expected in serverless/read-only):', err);
}

export const db: Client = createClient({
  url: config.dbUrl,
  authToken: config.dbAuthToken,
});

export async function initDb() {
  // Create tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      credits REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // Migration helper for existing databases
  try {
    await db.execute('ALTER TABLE users ADD COLUMN credits REAL NOT NULL DEFAULT 0');
  } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      userId TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_kie_credentials (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      provider TEXT NOT NULL DEFAULT 'kie_ai',
      encryptedApiKey TEXT NOT NULL,
      keyLastFour TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONNECTED',
      lastTestedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      taskId TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'quick',
      title TEXT NOT NULL,
      prompt TEXT,
      lyrics TEXT,
      style TEXT,
      model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      audioUrl TEXT,
      imageUrl TEXT,
      duration INTEGER DEFAULT 120,
      errorCode TEXT,
      errorMessage TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      completedAt TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      generationId TEXT NOT NULL,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      audioUrl TEXT NOT NULL,
      imageUrl TEXT,
      duration INTEGER DEFAULT 120,
      prompt TEXT,
      style TEXT,
      lyrics TEXT,
      model TEXT,
      isFavorite INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS lyrics (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      prompt TEXT,
      lyrics TEXT NOT NULL,
      genre TEXT,
      mood TEXT,
      language TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ipAddress TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS admin_key_pool (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      encryptedApiKey TEXT NOT NULL,
      keyLastFour TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      balance REAL DEFAULT 0,
      totalGenerations INTEGER DEFAULT 0,
      lastTestedAt TEXT,
      lastError TEXT,
      priority INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // Seed default Admin & Demo accounts if database is fresh
  const existingUsers = await db.execute('SELECT COUNT(*) as count FROM users');
  const userCount = Number(existingUsers.rows[0]?.count || 0);

  if (userCount === 0) {
    const now = new Date().toISOString();
    const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);
    const demoPasswordHash = await bcrypt.hash('DemoPass123!', 10);

    const adminId = 'usr_admin_' + Math.random().toString(36).substring(2, 9);
    const demoUserId = 'usr_demo_' + Math.random().toString(36).substring(2, 9);

    await db.execute({
      sql: `INSERT INTO users (id, name, email, passwordHash, role, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [adminId, 'Studio Administrator', 'admin@sunomaker.studio', adminPasswordHash, 'ADMIN', 'ACTIVE', now, now],
    });

    await db.execute({
      sql: `INSERT INTO users (id, name, email, passwordHash, role, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [demoUserId, 'Alex Producer', 'producer@sunomaker.studio', demoPasswordHash, 'USER', 'ACTIVE', now, now],
    });

    // Seed sample showcase track for demo user so they can immediately enjoy audio & UI
    const genId = 'gen_showcase_01';
    await db.execute({
      sql: `INSERT INTO generations (id, userId, taskId, type, title, prompt, lyrics, style, model, status, audioUrl, imageUrl, duration, createdAt, updatedAt, completedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        genId,
        demoUserId,
        'task_showcase_01',
        'quick',
        'Neon Horizon Echoes',
        'Melodic synthwave track with emotive piano leads and driving analog bassline',
        '[Verse 1]\nCity lights in indigo\nWatching midnight shadows glow\nAccelerating down the line\nFrozen in a beat of time\n\n[Chorus]\nNeon horizon, carry my soul\nInto the frequencies out of control\nWe are the rhythm, we are the sound\nAbove the quiet sleeping town',
        'Synthwave, Piano Lead, Emotive 80s Retrowave, 124 BPM',
        'suno-v4',
        'COMPLETED',
        'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=synthwave-80s-110045.mp3',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
        186,
        now,
        now,
        now,
      ],
    });

    await db.execute({
      sql: `INSERT INTO tracks (id, generationId, userId, title, audioUrl, imageUrl, duration, prompt, style, lyrics, model, isFavorite, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'trk_showcase_01',
        genId,
        demoUserId,
        'Neon Horizon Echoes',
        'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=synthwave-80s-110045.mp3',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
        186,
        'Melodic synthwave track with emotive piano leads and driving analog bassline',
        'Synthwave, Piano Lead, Emotive 80s Retrowave, 124 BPM',
        '[Verse 1]\nCity lights in indigo\nWatching midnight shadows glow\n\n[Chorus]\nNeon horizon, carry my soul',
        'suno-v4',
        1,
        now,
      ],
    });
  }
}
