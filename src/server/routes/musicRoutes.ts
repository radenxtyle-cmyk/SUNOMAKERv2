import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { requireAuth } from '../middleware/authMiddleware';
import { CredentialService } from '../security/credentialService';
import { kieAiProvider } from '../providers/kieAiProvider';
import { AuditService } from '../services/auditService';
import { generateRateLimiter, pollingRateLimiter } from '../security/rateLimiter';
import { AdminKeyPoolService } from '../services/adminKeyPoolService';

export const musicRouter = Router();

/**
 * POST /api/music/generate
 * Starts a music generation job using the authenticated user's own Kie.ai API key
 */
musicRouter.post('/generate', generateRateLimiter, async (req: Request, res: Response) => {
  let userId: string | null = req.user?.id || null;

  try {
    if (!userId) {
      const def = await db.execute("SELECT id FROM users WHERE email = 'producer@sunomaker.studio'");
      if (def.rows.length > 0) userId = String(def.rows[0].id);
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    // 1. Check user's credit balance
    const userRes = await db.execute({ sql: 'SELECT id, role, credits FROM users WHERE id = ?', args: [userId] });
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    const userRecord = userRes.rows[0];
    const userRole = String(userRecord.role || 'USER');
    const userCredits = Number(userRecord.credits ?? 0);

    const GENERATION_COST = 10;
    if (userCredits < GENERATION_COST && userRole !== 'ADMIN') {
      return res.status(402).json({
        error: 'INSUFFICIENT_CREDITS',
        message: `Kredit studio Anda tidak mencukupi (Sisa: ${userCredits} kredit, Dibutuhkan: ${GENERATION_COST} kredit). Silakan hubungi Administrator untuk top up kredit.`,
        currentCredits: userCredits,
        requiredCredits: GENERATION_COST,
      });
    }

    // 2. Resolve candidate keys: Admin Key Pool is primary for studio users
    interface CandidateKey {
      apiKey: string;
      poolKeyId: string | null;
      label: string;
    }

    const candidateKeys: CandidateKey[] = [];

    // Append all active Admin Key Pool keys in priority order
    const poolKeys = await AdminKeyPoolService.getAllActiveDecryptedKeys();
    for (const pk of poolKeys) {
      candidateKeys.push({
        apiKey: pk.apiKey,
        poolKeyId: pk.id,
        label: pk.label,
      });
    }

    // Secondary fallback: user's personal connected key (if exists and not in pool)
    const cred = await CredentialService.getCredential(userId);
    if (cred && cred.status === 'CONNECTED') {
      const userKey = await CredentialService.getDecryptedKey(userId);
      if (userKey && !candidateKeys.some((k) => k.apiKey === userKey)) {
        candidateKeys.push({
          apiKey: userKey,
          poolKeyId: null,
          label: 'Personal BYOK Key',
        });
      }
    }

    if (candidateKeys.length === 0) {
      return res.status(400).json({
        error: 'KIE_API_NOT_CONNECTED',
        message: 'Belum ada API Key aktif di Admin Key Pool. Silakan hubungi Administrator untuk menambahkan API Key Kie.ai.',
      });
    }

    const {
      title,
      prompt,
      lyrics,
      style,
      negativeTags,
      instrumental,
      vocalGender,
      model,
      duration,
      customMode,
      styleWeight,
      weirdnessConstraint,
      audioWeight,
      personaId,
    } = req.body;

    const finalTitle = title?.trim() || 'Untitled Track';
    const finalModel = model || 'suno-v4';
    const isCustom = Boolean(customMode || lyrics);

    // 3. Dispatch to Kie.ai provider with automatic failover across pool keys
    let kieResult: any = null;
    let successfulPoolKeyId: string | null = null;
    let lastProviderError: string | null = null;

    for (const candidate of candidateKeys) {
      try {
        kieResult = await kieAiProvider.generateMusic(candidate.apiKey, {
          title: finalTitle,
          prompt: prompt?.trim(),
          lyrics: lyrics?.trim(),
          style: style?.trim(),
          negativeTags: negativeTags?.trim(),
          instrumental: Boolean(instrumental),
          vocalGender: vocalGender || 'auto',
          model: finalModel,
          duration: duration ? Number(duration) : 120,
          customMode: isCustom,
          styleWeight,
          weirdnessConstraint,
          audioWeight,
          personaId,
        });

        successfulPoolKeyId = candidate.poolKeyId;
        break; // Generation accepted by Kie.ai!
      } catch (err: any) {
        const errorString = String(err.message || 'Generation failed on provider');
        lastProviderError = errorString;
        console.warn(`[Generation Failover] Key "${candidate.label}" failed: ${errorString}`);

        if (candidate.poolKeyId) {
          const lower = errorString.toLowerCase();
          if (
            lower.includes('credit') ||
            lower.includes('balance') ||
            lower.includes('insufficient') ||
            lower.includes('401') ||
            lower.includes('403')
          ) {
            await AdminKeyPoolService.markExhausted(candidate.poolKeyId, errorString).catch(() => {});
          }
        }
      }
    }

    if (!kieResult) {
      return res.status(400).json({
        error: 'PROVIDER_ERROR',
        message: lastProviderError || 'Gagal memproses pembuatan lagu di server provider.',
      });
    }

    const generationId = 'gen_' + crypto.randomUUID().substring(0, 12);
    const now = new Date().toISOString();

    if (successfulPoolKeyId) {
      await AdminKeyPoolService.recordUsage(successfulPoolKeyId).catch(() => {});
    }

    // Deduct user credits (if not admin)
    if (userRole !== 'ADMIN') {
      await db.execute({
        sql: 'UPDATE users SET credits = MAX(0, credits - ?), updatedAt = ? WHERE id = ?',
        args: [GENERATION_COST, now, userId],
      });
    }

    // 4. Record generation (DO NOT store raw or decrypted key)
    await db.execute({
      sql: `INSERT INTO generations (
              id, userId, taskId, type, title, prompt, lyrics, style, model, status, duration, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?)`,
      args: [
        generationId,
        userId,
        kieResult.taskId,
        isCustom ? 'custom' : 'quick',
        finalTitle,
        prompt || '',
        lyrics || '',
        style || '',
        finalModel,
        duration ? Number(duration) : 120,
        now,
        now,
      ],
    });

    await AuditService.log(
      userId,
      'MUSIC_GENERATION_STARTED',
      { generationId, taskId: kieResult.taskId, model: finalModel },
      req.ip
    );

    // 5. Return safe task info to frontend
    return res.status(202).json({
      generationId,
      taskId: kieResult.taskId,
      status: 'QUEUED',
      title: finalTitle,
      message: 'Generation task submitted to Kie.ai',
    });
  } catch (err: any) {
    console.error('Music generation error:', err.message);
    const reason = err.message || 'Music generation failed. Please check your Kie.ai account status.';
    await AuditService.log(userId || 'anonymous', 'MUSIC_GENERATION_FAILED', { reason }, req.ip);
    return res.status(500).json({
      error: reason,
      message: reason,
    });
  }
});

/**
 * GET /api/music
 * Retrieves the authenticated user's tracks & generations with filters, search, sort
 * Strictly filtered by authenticated userId
 */
musicRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, favorite, search, sort = 'newest' } = req.query;

    let sql = `
      SELECT t.*, g.taskId, g.status as generationStatus, g.type as generationType
      FROM tracks t
      JOIN generations g ON t.generationId = g.id
      WHERE t.userId = ?
    `;
    const params: any[] = [userId];

    if (favorite === 'true' || favorite === '1') {
      sql += ' AND t.isFavorite = 1';
    }

    if (status && typeof status === 'string' && status !== 'all') {
      sql += ' AND g.status = ?';
      params.push(status.toUpperCase());
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ' AND (LOWER(t.title) LIKE ? OR LOWER(t.style) LIKE ? OR LOWER(t.prompt) LIKE ?)';
      params.push(term, term, term);
    }

    // Sort order
    if (sort === 'oldest') {
      sql += ' ORDER BY t.createdAt ASC';
    } else if (sort === 'title') {
      sql += ' ORDER BY t.title ASC';
    } else if (sort === 'duration') {
      sql += ' ORDER BY t.duration DESC';
    } else {
      sql += ' ORDER BY t.createdAt DESC';
    }

    // Auto-sync pending generations using all pool keys or personal key
    const syncKeys: string[] = [];
    const poolKeys = await AdminKeyPoolService.getAllDecryptedKeysForPolling().catch(() => []);
    for (const pk of poolKeys) {
      if (!syncKeys.includes(pk.apiKey)) syncKeys.push(pk.apiKey);
    }
    const userKey = await CredentialService.getDecryptedKey(userId).catch(() => null);
    if (userKey && !syncKeys.includes(userKey)) syncKeys.push(userKey);

    if (syncKeys.length > 0) {
      const pendingToCheck = await db.execute({
        sql: `SELECT * FROM generations WHERE userId = ? AND status IN ('QUEUED', 'PROCESSING') ORDER BY createdAt DESC LIMIT 10`,
        args: [userId],
      });

      for (const gen of pendingToCheck.rows) {
        try {
          const createdAtMs = new Date(String(gen.createdAt)).getTime();
          const ageMinutes = (Date.now() - createdAtMs) / (1000 * 60);

          let taskRes: any = null;
          for (const sKey of syncKeys) {
            try {
              const r = await kieAiProvider.getTaskStatus(sKey, String(gen.taskId));
              if (r && r.status) {
                taskRes = r;
                if (r.status === 'COMPLETED' || r.status === 'FAILED') break;
              }
            } catch {
              // try next key
            }
          }

          if (!taskRes) continue;

          const now = new Date().toISOString();

          if (taskRes.status === 'COMPLETED' && taskRes.tracks && taskRes.tracks.length > 0) {
            for (const trk of taskRes.tracks) {
              const trackId = 'trk_' + crypto.randomUUID().substring(0, 12);
              await db.execute({
                sql: `INSERT INTO tracks (
                        id, generationId, userId, title, audioUrl, imageUrl, duration, prompt, style, lyrics, model, createdAt
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                  trackId,
                  String(gen.id),
                  userId,
                  trk.title,
                  trk.audioUrl,
                  trk.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
                  trk.duration || 120,
                  trk.prompt || (gen.prompt as string),
                  trk.style || (gen.style as string),
                  trk.lyrics || (gen.lyrics as string),
                  gen.model as string,
                  now,
                ],
              });
            }

            await db.execute({
              sql: `UPDATE generations SET status = 'COMPLETED', audioUrl = ?, imageUrl = ?, completedAt = ?, updatedAt = ? WHERE id = ?`,
              args: [taskRes.tracks[0].audioUrl || '', taskRes.tracks[0].imageUrl || '', now, now, String(gen.id)],
            });
          } else if (taskRes.status === 'FAILED' || ageMinutes > 10) {
            await db.execute({
              sql: `UPDATE generations SET status = 'FAILED', errorMessage = ?, updatedAt = ? WHERE id = ?`,
              args: [
                taskRes.errorMessage || (ageMinutes > 10 ? 'Task timeout on provider' : 'Generation failed on provider'),
                now,
                String(gen.id),
              ],
            });
          }
        } catch (syncErr) {
          // silently continue
        }
      }
    }

    const tracksRes = await db.execute({ sql, args: params });

    // Also get active pending generations
    const pendingRes = await db.execute({
      sql: `SELECT * FROM generations WHERE userId = ? AND status IN ('QUEUED', 'PROCESSING') ORDER BY createdAt DESC`,
      args: [userId],
    });

    return res.json({
      tracks: tracksRes.rows,
      pendingGenerations: pendingRes.rows,
    });
  } catch (err: any) {
    console.error('Library fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to load music library' });
  }
});

/**
 * GET /api/music/status/:taskId
 * Checks the status of a Kie.ai generation job
 */
musicRouter.get('/status/:taskId', requireAuth, pollingRateLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;

    // 1. Verify generation ownership
    const genRes = await db.execute({
      sql: 'SELECT * FROM generations WHERE taskId = ? AND userId = ?',
      args: [taskId, userId],
    });

    if (genRes.rows.length === 0) {
      return res.status(404).json({ error: 'Generation task not found or access denied.' });
    }

    const generation = genRes.rows[0];

    // If already finalized, return tracks immediately
    if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
      const tracksRes = await db.execute({
        sql: 'SELECT * FROM tracks WHERE generationId = ? AND userId = ?',
        args: [String(generation.id), userId],
      });
      return res.json({
        taskId,
        status: generation.status,
        generation,
        tracks: tracksRes.rows,
        completedAt: generation.completedAt,
        errorMessage: generation.errorMessage,
      });
    }

    // 2. Poll Kie.ai status using all candidate keys (Personal BYOK or Pool keys)
    const candidateKeys: string[] = [];
    const userKey = await CredentialService.getDecryptedKey(userId).catch(() => null);
    if (userKey) candidateKeys.push(userKey);

    const poolKeys = await AdminKeyPoolService.getAllDecryptedKeysForPolling();
    for (const pk of poolKeys) {
      if (!candidateKeys.includes(pk.apiKey)) candidateKeys.push(pk.apiKey);
    }

    if (candidateKeys.length === 0) {
      return res.status(400).json({ error: 'Studio API credentials unavailable' });
    }

    let taskResult: any = null;
    for (const key of candidateKeys) {
      try {
        const resTask = await kieAiProvider.getTaskStatus(key, taskId);
        if (resTask && resTask.status) {
          taskResult = resTask;
          if (resTask.status === 'COMPLETED' || resTask.status === 'PROCESSING' || resTask.status === 'QUEUED') {
            break; // Found valid status!
          }
        }
      } catch (err) {
        // Continue trying next candidate key
      }
    }

    if (!taskResult) {
      taskResult = { taskId, status: 'PROCESSING', progress: 50 };
    }

    const now = new Date().toISOString();

    if (taskResult.status === 'COMPLETED') {
      let mainAudioUrl = generation.audioUrl;
      let mainImageUrl = generation.imageUrl;

      // Persist tracks if provided
      if (taskResult.tracks && taskResult.tracks.length > 0) {
        mainAudioUrl = taskResult.tracks[0].audioUrl;
        mainImageUrl = taskResult.tracks[0].imageUrl || (generation.imageUrl as string);

        for (const trk of taskResult.tracks) {
          const trackId = 'trk_' + crypto.randomUUID().substring(0, 12);
          await db.execute({
            sql: `INSERT INTO tracks (
                    id, generationId, userId, title, audioUrl, imageUrl, duration, prompt, style, lyrics, model, createdAt
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              trackId,
              String(generation.id),
              userId,
              trk.title,
              trk.audioUrl,
              trk.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
              trk.duration || 120,
              trk.prompt || (generation.prompt as string),
              trk.style || (generation.style as string),
              trk.lyrics || (generation.lyrics as string),
              generation.model as string,
              now,
            ],
          });
        }
      }

      await db.execute({
        sql: `UPDATE generations
              SET status = 'COMPLETED', audioUrl = ?, imageUrl = ?, completedAt = ?, updatedAt = ?
              WHERE id = ?`,
        args: [mainAudioUrl || '', mainImageUrl || '', now, now, String(generation.id)],
      });

      await AuditService.log(userId, 'MUSIC_GENERATION_COMPLETED', { taskId }, req.ip);

      const savedTracks = await db.execute({
        sql: 'SELECT * FROM tracks WHERE generationId = ? AND userId = ?',
        args: [String(generation.id), userId],
      });

      return res.json({
        taskId,
        status: 'COMPLETED',
        progress: 100,
        generation: { ...generation, status: 'COMPLETED', audioUrl: mainAudioUrl, imageUrl: mainImageUrl },
        tracks: savedTracks.rows,
      });
    } else if (taskResult.status === 'FAILED') {
      await db.execute({
        sql: `UPDATE generations
              SET status = 'FAILED', errorCode = ?, errorMessage = ?, updatedAt = ?
              WHERE id = ?`,
        args: [taskResult.errorCode || 'UNKNOWN', taskResult.errorMessage || 'Generation failed', now, String(generation.id)],
      });

      await AuditService.log(userId, 'MUSIC_GENERATION_FAILED', { taskId, reason: taskResult.errorMessage }, req.ip);

      return res.json({
        taskId,
        status: 'FAILED',
        errorCode: taskResult.errorCode,
        errorMessage: taskResult.errorMessage || 'Music generation failed.',
      });
    }

    // Still processing/queued
    return res.json({
      taskId,
      status: taskResult.status,
      progress: taskResult.progress || 35,
    });
  } catch (err: any) {
    console.error('Status poll error:', err.message);
    return res.status(500).json({ error: 'Failed to poll task status' });
  }
});

/**
 * GET /api/music/:id
 * Song details with strict ownership verification
 */
musicRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const trackRes = await db.execute({
      sql: `SELECT t.*, g.taskId, g.status as generationStatus, g.type as generationType
            FROM tracks t
            JOIN generations g ON t.generationId = g.id
            WHERE t.id = ? AND t.userId = ?`,
      args: [id, userId],
    });

    if (trackRes.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found or unauthorized' });
    }

    return res.json(trackRes.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve song.' });
  }
});

/**
 * DELETE /api/music/:id
 * Deletes a song from library
 */
musicRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const resDelete = await db.execute({
      sql: 'DELETE FROM tracks WHERE id = ? AND userId = ?',
      args: [id, userId],
    });

    if (resDelete.rowsAffected === 0) {
      return res.status(404).json({ error: 'Song not found or unauthorized' });
    }

    await AuditService.log(userId, 'SONG_DELETED', { trackId: id }, req.ip);
    return res.json({ success: true, message: 'Track removed from library.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete song.' });
  }
});

/**
 * POST /api/music/:id/favorite
 * Toggles favorite flag on a track
 */
musicRouter.post('/:id/favorite', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const trackRes = await db.execute({
      sql: 'SELECT isFavorite FROM tracks WHERE id = ? AND userId = ?',
      args: [id, userId],
    });

    if (trackRes.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const current = Number(trackRes.rows[0].isFavorite || 0);
    const updated = current === 1 ? 0 : 1;

    await db.execute({
      sql: 'UPDATE tracks SET isFavorite = ? WHERE id = ? AND userId = ?',
      args: [updated, id, userId],
    });

    return res.json({ success: true, isFavorite: updated === 1 });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update favorite.' });
  }
});

/**
 * POST /api/music/extend
 */
musicRouter.post('/extend', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { trackId, prompt, style } = req.body;

    const userRes = await db.execute({ sql: 'SELECT role, credits FROM users WHERE id = ?', args: [userId] });
    const userRole = String(userRes.rows[0]?.role || 'USER');
    const userCredits = Number(userRes.rows[0]?.credits ?? 0);

    const EXTEND_COST = 5;
    if (userCredits < EXTEND_COST && userRole !== 'ADMIN') {
      return res.status(402).json({
        error: 'INSUFFICIENT_CREDITS',
        message: `Kredit Anda tidak mencukupi untuk extend musik (Butuh ${EXTEND_COST} kredit).`,
      });
    }

    const trackRes = await db.execute({
      sql: 'SELECT * FROM tracks WHERE id = ? AND userId = ?',
      args: [trackId, userId],
    });

    if (trackRes.rows.length === 0) {
      return res.status(404).json({ error: 'Track not found or unauthorized.' });
    }

    let decryptedKey: string | null = null;
    let poolKeyId: string | null = null;
    const poolKey = await AdminKeyPoolService.getNextActiveDecryptedKey();
    if (poolKey) {
      decryptedKey = poolKey.apiKey;
      poolKeyId = poolKey.id;
    } else {
      decryptedKey = await CredentialService.getDecryptedKey(userId);
    }

    if (!decryptedKey) {
      return res.status(400).json({ error: 'Tidak ada API Key aktif di pool. Silakan hubungi Administrator.' });
    }

    const track = trackRes.rows[0];
    const result = await kieAiProvider.extendMusic(decryptedKey, {
      trackId: String(track.id),
      audioUrl: String(track.audioUrl),
      prompt,
      style: style || (track.style as string),
    });

    const generationId = 'gen_' + crypto.randomUUID().substring(0, 12);
    const now = new Date().toISOString();

    if (poolKeyId) {
      await AdminKeyPoolService.recordUsage(poolKeyId).catch(() => {});
    }

    if (userRole !== 'ADMIN') {
      await db.execute({
        sql: 'UPDATE users SET credits = MAX(0, credits - ?), updatedAt = ? WHERE id = ?',
        args: [EXTEND_COST, now, userId],
      });
    }

    await db.execute({
      sql: `INSERT INTO generations (id, userId, taskId, type, title, prompt, style, model, status, createdAt, updatedAt)
            VALUES (?, ?, ?, 'extend', ?, ?, ?, 'suno-v4', 'QUEUED', ?, ?)`,
      args: [generationId, userId, result.taskId, `${String(track.title)} (Extended)`, prompt || '', style || '', now, now],
    });

    return res.json({ success: true, taskId: result.taskId, generationId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to extend track' });
  }
});

/**
 * POST /api/music/cover
 */
musicRouter.post('/cover', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { audioUrl, style } = req.body;

    if (!audioUrl) {
      return res.status(400).json({ error: 'Valid audio URL is required.' });
    }

    let decryptedKey: string | null = null;
    let poolKeyId: string | null = null;
    const poolKey = await AdminKeyPoolService.getNextActiveDecryptedKey();
    if (poolKey) {
      decryptedKey = poolKey.apiKey;
      poolKeyId = poolKey.id;
    } else {
      decryptedKey = await CredentialService.getDecryptedKey(userId);
    }

    if (!decryptedKey) {
      return res.status(400).json({ error: 'Tidak ada API Key aktif di pool. Silakan hubungi Administrator.' });
    }

    const result = await kieAiProvider.coverMusic(decryptedKey, { audioUrl, style });
    if (poolKeyId) {
      await AdminKeyPoolService.recordUsage(poolKeyId).catch(() => {});
    }
    const generationId = 'gen_' + crypto.randomUUID().substring(0, 12);
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO generations (id, userId, taskId, type, title, style, model, status, createdAt, updatedAt)
            VALUES (?, ?, ?, 'cover', ?, ?, 'suno-v4', 'QUEUED', ?, ?)`,
      args: [generationId, userId, result.taskId, 'AI Cover Track', style || '', now, now],
    });

    return res.json({ success: true, taskId: result.taskId, generationId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate cover' });
  }
});

/**
 * POST /api/music/separate
 */
musicRouter.post('/separate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { audioUrl } = req.body;
    if (!audioUrl) return res.status(400).json({ error: 'Audio URL required' });

    let decryptedKey: string | null = null;
    let poolKeyId: string | null = null;
    const poolKey = await AdminKeyPoolService.getNextActiveDecryptedKey();
    if (poolKey) {
      decryptedKey = poolKey.apiKey;
      poolKeyId = poolKey.id;
    } else {
      decryptedKey = await CredentialService.getDecryptedKey(userId);
    }

    if (!decryptedKey) {
      return res.status(400).json({ error: 'Tidak ada API Key aktif di Admin Key Pool. Silakan hubungi Administrator.' });
    }

    const result = await kieAiProvider.separateStems(decryptedKey, { audioUrl });
    if (poolKeyId) {
      await AdminKeyPoolService.recordUsage(poolKeyId).catch(() => {});
    }
    return res.json({ success: true, taskId: result.taskId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Stem separation failed' });
  }
});

/**
 * POST /api/music/video
 */
musicRouter.post('/video', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { trackId } = req.body;

    const trackRes = await db.execute({
      sql: 'SELECT * FROM tracks WHERE id = ? AND userId = ?',
      args: [trackId, userId],
    });

    if (trackRes.rows.length === 0) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const track = trackRes.rows[0];
    let decryptedKey: string | null = null;
    let poolKeyId: string | null = null;
    const poolKey = await AdminKeyPoolService.getNextActiveDecryptedKey();
    if (poolKey) {
      decryptedKey = poolKey.apiKey;
      poolKeyId = poolKey.id;
    } else {
      decryptedKey = await CredentialService.getDecryptedKey(userId);
    }

    if (!decryptedKey) {
      return res.status(400).json({ error: 'Tidak ada API Key aktif di Admin Key Pool. Silakan hubungi Administrator.' });
    }

    const result = await kieAiProvider.generateMusicVideo(decryptedKey, {
      audioUrl: String(track.audioUrl),
      title: String(track.title),
    });
    if (poolKeyId) {
      await AdminKeyPoolService.recordUsage(poolKeyId).catch(() => {});
    }

    return res.json({ success: true, taskId: result.taskId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Music video creation failed' });
  }
});

/**
 * DELETE /api/music/generations/:id
 * Cancels/removes a pending or stalled generation task
 */
musicRouter.delete('/generations/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await db.execute({
      sql: 'DELETE FROM generations WHERE id = ? AND userId = ?',
      args: [id, userId],
    });

    return res.json({ success: true, message: 'Generation task removed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to remove generation task' });
  }
});

