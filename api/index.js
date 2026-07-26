import app, { ready } from '../backend/server.js';

export default async function handler(req, res) {
  try {
    const ok = await ready;
    if (!ok) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error:
            'API failed to initialize. Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY), and JWT_SECRET in Vercel Environment Variables, then redeploy.',
        })
      );
      return;
    }
    return app(req, res);
  } catch (err) {
    console.error('API handler error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
