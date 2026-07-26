/**
 * Vercel catch-all for /api and /api/*.
 * Dynamic import so load failures return JSON instead of a blank FUNCTION_INVOCATION_FAILED.
 */
export default async function handler(req, res) {
  try {
    const mod = await import('../backend/server.js');
    const ok = await mod.ready;
    if (!ok) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error:
            'API failed to initialize. Check Vercel env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY), JWT_SECRET (32+ chars), SUPER_ADMIN_EMAIL / DEV_SUPER_ADMIN_EMAIL.',
        })
      );
      return;
    }
    return mod.default(req, res);
  } catch (err) {
    console.error('API boot error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: err?.message || 'API failed to start',
        code: err?.code || null,
      })
    );
  }
}
