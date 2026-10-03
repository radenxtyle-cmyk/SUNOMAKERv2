import type { IncomingMessage, ServerResponse } from 'http';
import { createExpressApp } from '../src/server/app';

let cachedApp: any = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!cachedApp) {
      cachedApp = await createExpressApp();
    }
    return (cachedApp as any)(req, res);
  } catch (err: any) {
    console.error('[SUNOMAKER VERCEL] Serverless execution error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal Serverless Handler Error',
      message: err?.message || 'Server error',
    }));
  }
}
