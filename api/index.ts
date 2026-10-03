import type { IncomingMessage, ServerResponse } from 'http';
import { createExpressApp } from '../src/server/app';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await createExpressApp();
  return (app as any)(req, res);
}
