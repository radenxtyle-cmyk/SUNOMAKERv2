import express from 'express';
import cookieParser from 'cookie-parser';
import { initDb } from './db';
import { attachUser } from './middleware/authMiddleware';
import { authRouter } from './routes/authRoutes';
import { kieRouter } from './routes/kieRoutes';
import { musicRouter } from './routes/musicRoutes';
import { lyricsRouter } from './routes/lyricsRoutes';
import { adminRouter } from './routes/adminRoutes';

let appInstance: express.Express | null = null;
let isDbInitialized = false;

export async function createExpressApp(): Promise<express.Express> {
  if (appInstance) {
    return appInstance;
  }

  if (!isDbInitialized) {
    try {
      await initDb();
      isDbInitialized = true;
      console.log('[SUNOMAKER] Database initialized successfully.');
    } catch (err) {
      console.error('[SUNOMAKER] Database initialization warning:', err);
    }
  }

  const app = express();

  // Basic Express middlewares
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Attach session user to all requests
  app.use(attachUser);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      app: 'SUNOMAKER',
      version: '2.0.0',
      model: 'BYOK (Bring Your Own Kie.ai API Key)',
      timestamp: new Date().toISOString(),
    });
  });

  // API Route Mounts
  app.use('/api/auth', authRouter);
  app.use('/api/kie', kieRouter);
  app.use('/api/music', musicRouter);
  app.use('/api/lyrics', lyricsRouter);
  app.use('/api/admin', adminRouter);

  // Global API 404 handler
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[SUNOMAKER Server Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  appInstance = app;
  return app;
}
