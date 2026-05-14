const { createClient } = require('@supabase/supabase-js');

const buckets = new Map();

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return { url, key };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header !== 'string') return '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

async function requireAuthenticatedUser(req) {
  const token = getBearerToken(req);
  const { url, key } = getSupabaseConfig();

  if (!url || !key) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      return { ok: false, status: 500, error: 'API authentication is not configured' };
    }
    return { ok: true, userId: `dev:${getClientIp(req)}` };
  }

  if (!token) return { ok: false, status: 401, error: 'Sign in before using voice features' };

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: 'Your session expired. Please sign in again.' };
  return { ok: true, userId: data.user.id };
}

function rateLimit(key, options) {
  const now = Date.now();
  const windowMs = options.windowMs;
  const max = options.max;
  const bucketKey = `${options.name}:${key}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count <= max) return { ok: true };

  return {
    ok: false,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

function sendJson(res, status, payload, headers = {}) {
  Object.entries({
    'Cache-Control': 'no-store',
    ...headers,
  }).forEach(([key, value]) => res.setHeader(key, value));
  return res.status(status).json(payload);
}

module.exports = {
  getClientIp,
  rateLimit,
  requireAuthenticatedUser,
  sendJson,
};
