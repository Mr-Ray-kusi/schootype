import app, { ready } from '../backend/server.js';

export default async function handler(req, res) {
  const ok = await ready;
  if (!ok) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'API failed to initialize. Check Vercel env vars and Supabase.' }));
    return;
  }
  return app(req, res);
}
