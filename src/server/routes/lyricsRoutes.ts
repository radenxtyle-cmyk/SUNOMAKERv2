import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { requireAuth } from '../middleware/authMiddleware';
import { CredentialService } from '../security/credentialService';
import { kieAiProvider } from '../providers/kieAiProvider';

export const lyricsRouter = Router();

/**
 * POST /api/lyrics/generate
 * Generates lyrics according to theme, genre, mood, and language
 */
lyricsRouter.post('/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { theme, prompt, genre, mood, language, structure } = req.body;

    const inputPrompt = prompt || theme || 'Night City Lights';
    const decryptedKey = (await CredentialService.getDecryptedKey(userId)) || 'mock_key_for_lyrics';

    const result = await kieAiProvider.generateLyrics(decryptedKey, {
      prompt: inputPrompt,
      genre,
      mood,
      language,
    });

    const lyricsId = 'lyr_' + crypto.randomUUID().substring(0, 12);
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO lyrics (id, userId, title, prompt, lyrics, genre, mood, language, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [lyricsId, userId, result.title, inputPrompt, result.lyrics, genre || 'Pop', mood || 'Uplifting', language || 'English', now],
    });

    return res.json({
      id: lyricsId,
      title: result.title,
      lyrics: result.lyrics,
      genre,
      mood,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate lyrics' });
  }
});

/**
 * GET /api/lyrics
 */
lyricsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const resLyrics = await db.execute({
      sql: 'SELECT * FROM lyrics WHERE userId = ? ORDER BY createdAt DESC',
      args: [userId],
    });
    return res.json(resLyrics.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load lyrics' });
  }
});

/**
 * DELETE /api/lyrics/:id
 */
lyricsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    await db.execute({
      sql: 'DELETE FROM lyrics WHERE id = ? AND userId = ?',
      args: [id, userId],
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete lyrics' });
  }
});
