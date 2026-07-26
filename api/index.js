/**
 * Single Vercel function entry for all /api/* traffic (via vercel.json rewrite).
 * Incoming paths are passed as ?__p=auth/login so Express /api/* routes still match.
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

    const rawUrl = String(req.url || '/');
    const qIndex = rawUrl.indexOf('?');
    const search = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : '';
    const params = new URLSearchParams(search);
    const forwardedPath = params.get('__p');
    params.delete('__p');
    const remaining = params.toString();

    if (forwardedPath != null && forwardedPath !== '') {
      req.url = `/api/${forwardedPath.replace(/^\/+/, '')}${remaining ? `?${remaining}` : ''}`;
    } else if (!rawUrl.startsWith('/api')) {
      req.url = `/api${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
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
