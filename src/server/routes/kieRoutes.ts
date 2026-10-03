import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { CredentialService } from '../security/credentialService';
import { kieAiProvider } from '../providers/kieAiProvider';
import { AuditService } from '../services/auditService';
import { connectRateLimiter } from '../security/rateLimiter';
import { db } from '../db';
import { AdminKeyPoolService } from '../services/adminKeyPoolService';

export const kieRouter = Router();

/**
 * GET /api/kie/status
 * Returns connection status and masked key, supporting both Personal BYOK and Admin Key Pool
 */
kieRouter.get('/status', async (req: Request, res: Response) => {
  try {
    let userId = req.user?.id;
    if (!userId) {
      const def = await db.execute("SELECT id FROM users WHERE email = 'producer@sunomaker.studio'");
      if (def.rows.length > 0) userId = String(def.rows[0].id);
    }

    if (userId) {
      const cred = await CredentialService.getCredential(userId);
      if (cred && cred.status === 'CONNECTED') {
        return res.json({
          connected: true,
          maskedKey: cred.maskedKey,
          status: cred.status,
          lastTestedAt: cred.lastTestedAt,
          provider: cred.provider,
          isMock: Boolean(cred.isMock),
          isPool: false,
        });
      }
    }

    // Check if Admin Key Pool has active keys available for studio users
    const poolSummary = await AdminKeyPoolService.getPoolSummary().catch(() => null);
    if (poolSummary && poolSummary.activeKeys > 0) {
      return res.json({
        connected: true,
        maskedKey: `Studio Pool (${poolSummary.activeKeys} Active Keys)`,
        status: 'CONNECTED',
        lastTestedAt: new Date().toISOString(),
        provider: 'kie_ai_pool',
        isMock: false,
        isPool: true,
        activeKeys: poolSummary.activeKeys,
        totalPoolCredits: poolSummary.totalCreditsAccumulated,
      });
    }

    return res.json({
      connected: false,
      maskedKey: null,
      status: 'DISCONNECTED',
      lastTestedAt: null,
      isMock: false,
      isPool: false,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve connection status.' });
  }
});

/**
 * POST /api/kie/connect
 * Validates, encrypts, and stores user's personal Kie.ai API key
 */
kieRouter.post('/connect', connectRateLimiter, async (req: Request, res: Response) => {
  try {
    let user = req.user;
    if (!user) {
      const defUserRes = await db.execute("SELECT id, name, email, role, status, credits FROM users WHERE email = 'producer@sunomaker.studio'");
      if (defUserRes.rows.length > 0) {
        const row = defUserRes.rows[0];
        user = {
          id: String(row.id),
          name: String(row.name),
          email: String(row.email),
          role: String(row.role) as any,
          status: String(row.status) as any,
          credits: Number(row.credits ?? 20),
        };
        req.user = user;
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
      return res.status(400).json({
        error: 'Please enter a valid Kie.ai API key (typically starts with "kie_" or similar).',
      });
    }

    const trimmedKey = apiKey.trim();

    // 1. Test key validity against Kie.ai
    const testResult = await kieAiProvider.testConnection(trimmedKey);
    if (!testResult.success) {
      await AuditService.log(user.id, 'KIE_CONNECTION_FAILED', { reason: testResult.message }, req.ip);
      return res.status(400).json({
        error: testResult.message || 'Kie.ai rejected the API key. Please verify your credentials.',
      });
    }

    // 2. Encrypt and save securely
    const saved = await CredentialService.saveCredential(user.id, trimmedKey);
    await AuditService.log(user.id, 'KIE_KEY_CONNECTED', { keyLastFour: saved.keyLastFour }, req.ip);

    // 3. Return only masked key and status - NEVER RAW KEY
    return res.json({
      connected: true,
      status: 'CONNECTED',
      maskedKey: saved.maskedKey,
      message: 'Kie.ai API key successfully connected and encrypted.',
    });
  } catch (err: any) {
    console.error('Error connecting Kie.ai key:', err.message);
    return res.status(500).json({
      error: 'An internal error occurred while securing your API key. Please try again.',
    });
  }
});

/**
 * POST /api/kie/test
 * Tests the user's stored encrypted Kie.ai key
 */
kieRouter.post('/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const cred = await CredentialService.getCredential(req.user!.id);
    if (!cred) {
      return res.status(400).json({
        connected: false,
        error: 'No Kie.ai API key is currently connected.',
      });
    }

    // Decrypt key only in backend memory
    const decryptedKey = await CredentialService.getDecryptedKey(req.user!.id);
    if (!decryptedKey) {
      return res.status(400).json({
        connected: false,
        error: 'Could not decrypt stored credential. Please reconnect your API key.',
      });
    }

    const result = await kieAiProvider.testConnection(decryptedKey);

    if (result.success) {
      await CredentialService.updateStatus(req.user!.id, 'CONNECTED');
      await AuditService.log(req.user!.id, 'KIE_CONNECTION_TEST_SUCCESS', {}, req.ip);
      return res.json({
        connected: true,
        status: 'CONNECTED',
        message: result.message || 'Kie.ai connection successful.',
      });
    } else {
      await CredentialService.updateStatus(req.user!.id, 'ERROR');
      await AuditService.log(req.user!.id, 'KIE_CONNECTION_TEST_FAILED', { reason: result.message }, req.ip);
      return res.status(400).json({
        connected: false,
        status: 'ERROR',
        error: result.message || 'Unable to connect to Kie.ai.',
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      connected: false,
      error: 'Failed to test Kie.ai connection.',
    });
  }
});

/**
 * DELETE /api/kie/disconnect
 * Disconnects and destroys stored encryption material without affecting music library
 */
kieRouter.delete('/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    await CredentialService.deleteCredential(req.user!.id);
    await AuditService.log(req.user!.id, 'KIE_KEY_DISCONNECTED', {}, req.ip);

    return res.json({
      connected: false,
      message: 'Kie.ai disconnected. Your generated songs remain preserved in your library.',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to disconnect Kie.ai.' });
  }
});

/**
 * GET /api/kie/usage
 * Usage / Balance disclosure
 */
kieRouter.get('/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const cred = await CredentialService.getCredential(req.user!.id);
    if (cred && cred.status === 'CONNECTED') {
      const decryptedKey = await CredentialService.getDecryptedKey(req.user!.id);
      if (decryptedKey) {
        const usage = await kieAiProvider.getUsage(decryptedKey);
        return res.json({
          connected: true,
          usageInfo: usage.usageInfo,
          balance: usage.balance,
          currency: usage.currency,
        });
      }
    }

    const poolSummary = await AdminKeyPoolService.getPoolSummary().catch(() => null);
    if (poolSummary && poolSummary.activeKeys > 0) {
      return res.json({
        connected: true,
        isPool: true,
        usageInfo: `Studio Key Pool Active (${poolSummary.activeKeys} keys, ~${poolSummary.totalCreditsAccumulated} total provider credits available).`,
        balance: poolSummary.totalCreditsAccumulated,
        currency: 'Credits',
      });
    }

    return res.json({
      connected: false,
      usageInfo: 'Studio Key Pool is currently inactive. Contact administrator.',
    });
  } catch (err) {
    return res.json({
      connected: true,
      usageInfo: 'Usage information is managed by Kie.ai.',
    });
  }
});

/**
 * POST /api/kie/callback
 * Webhook callback from Kie.ai with strict taskId validation and ownership mapping
 */
kieRouter.post('/callback', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const taskId = payload?.data?.taskId || payload?.taskId || payload?.id;

    if (!taskId) {
      return res.status(400).json({ error: 'Missing taskId in callback payload' });
    }

    // Find generation record
    const genRes = await db.execute({
      sql: 'SELECT id, userId, title, status FROM generations WHERE taskId = ?',
      args: [String(taskId)],
    });

    if (genRes.rows.length === 0) {
      // Unknown task or already purged
      return res.status(200).json({ received: true, note: 'Task not tracked' });
    }

    const gen = genRes.rows[0];
    const now = new Date().toISOString();

    const output = payload?.data?.response?.data || payload?.data?.output || payload?.response?.data || [];
    let audioUrl = '';
    let imageUrl = '';

    if (Array.isArray(output) && output.length > 0) {
      audioUrl = output[0]?.audio_url || output[0]?.audioUrl || output[0]?.stream_audio_url || '';
      imageUrl = output[0]?.image_url || output[0]?.imageUrl || '';

      // Save each track
      for (let i = 0; i < output.length; i++) {
        const item = output[i];
        const trackAudio = item.audio_url || item.audioUrl || item.stream_audio_url;
        if (trackAudio) {
          const trackId = 'trk_' + Math.random().toString(36).substring(2, 10);
          await db.execute({
            sql: `INSERT INTO tracks (id, generationId, userId, title, audioUrl, imageUrl, duration, style, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              trackId,
              String(gen.id),
              String(gen.userId),
              item.title || `${String(gen.title)} (Part ${i + 1})`,
              trackAudio,
              item.image_url || item.imageUrl || '',
              item.duration ? Math.round(Number(item.duration)) : 120,
              item.tags || '',
              now,
            ],
          });
        }
      }
    }

    await db.execute({
      sql: `UPDATE generations
            SET status = 'COMPLETED', audioUrl = ?, imageUrl = ?, completedAt = ?, updatedAt = ?
            WHERE id = ?`,
      args: [audioUrl, imageUrl, now, now, String(gen.id)],
    });

    await AuditService.log(String(gen.userId), 'GENERATION_COMPLETED_VIA_CALLBACK', { taskId }, req.ip);

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Callback error:', err.message);
    return res.status(500).json({ error: 'Callback handling failure' });
  }
});
