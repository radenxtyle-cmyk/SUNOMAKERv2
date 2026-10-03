import path from 'path';
import fs from 'fs';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { config } from './src/server/config';
import { createExpressApp } from './src/server/app';

async function startServer() {
  const app = await createExpressApp();

  // Vite middleware in dev or static serving in production
  if (config.isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[SUNOMAKER] Vite middleware mounted in development mode.');
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.warn('[SUNOMAKER] dist folder not found. Ensure "npm run build" has run for production.');
    }
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[SUNOMAKER] Music Studio server running at http://0.0.0.0:${config.port}`);
    console.log(`[SUNOMAKER] BYOK Model Active. No global Kie.ai API key is configured.`);
  });
}

startServer().catch((err) => {
  console.error('[SUNOMAKER] Fatal server startup error:', err);
  process.exit(1);
});
