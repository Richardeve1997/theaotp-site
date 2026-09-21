// theaotp.com email gate + funnel tracking — Cloudflare Worker
// Endpoints:
//   POST /subscribe  {email, ctx?}  -> adds to Buttondown (already-subscribed counts as success)
//                                      and links the email to the visitor's funnel history
//   POST /e          {vid, type, page, src?, t?, label?, meta?}  -> records one page event
// Secret required: BUTTONDOWN_API_KEY  (wrangler secret put BUTTONDOWN_API_KEY)
// Binding (optional): DB -> D1 database `aotp-funnel` (schema.sql). Tracking is best-effort:
// a missing binding or a failed write NEVER changes the /subscribe response.

const ALLOWED_ORIGINS = [
  'https://theaotp.com',
  'https://www.theaotp.com',
  'https://richardeve1997.github.io',
  'http://localhost:8000',
  'http://localhost:5173',
  'http://localhost:5200',
];

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVENT_TYPES = ['visit', 'unlock', 'click', 'scroll', 'time'];
const BOT_RE = /bot|crawl|spider|preview|facebookexternalhit|slurp|whatsapp|headless|lighthouse/i;

const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
// vid / src / token are opaque ids minted by f.js or by our own link builder.
const ident = (value, max) => (typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) ? value.slice(0, max) : '');
const pagePath = (value) => (typeof value === 'string' && /^\/[A-Za-z0-9/_-]*$/.test(value) ? value.slice(0, 80) : '');

function context(raw) {
  const ctx = raw && typeof raw === 'object' ? raw : {};
  return { vid: ident(ctx.vid, 40), src: ident(ctx.src, 40), token: ident(ctx.t, 64), page: pagePath(ctx.page) };
}

async function record(env, ctx, type, label, meta) {
  if (!env.DB || !ctx.vid) return;
  const now = new Date().toISOString();
  const metaText = meta ? JSON.stringify(meta).slice(0, 1000) : null;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO events (ts, vid, type, page, src, token, label, meta) VALUES (?,?,?,?,?,?,?,?)')
      .bind(now, ctx.vid, type, ctx.page || null, ctx.src || null, ctx.token || null, label || null, metaText),
    env.DB.prepare(`INSERT INTO visitors (vid, first_seen, last_seen, first_src, first_page, last_src)
                    VALUES (?1, ?2, ?2, ?3, ?4, ?3)
                    ON CONFLICT(vid) DO UPDATE SET last_seen = ?2,
                      first_src = COALESCE(visitors.first_src, ?3), last_src = COALESCE(?3, visitors.last_src)`)
      .bind(ctx.vid, now, ctx.src || null, ctx.page || null),
  ]);
}

async function recordEmail(env, ctx, email, isNew) {
  if (!env.DB || !ctx.vid) return;
  await record(env, ctx, 'email', isNew ? 'new' : 'returning');
  await env.DB.prepare('UPDATE visitors SET email = ?1, email_ts = COALESCE(email_ts, ?2) WHERE vid = ?3')
    .bind(email, new Date().toISOString(), ctx.vid).run();
}

// Tracking must never break the gate: swallow and log every failure.
const safely = (promise) => promise.catch((err) => console.log('funnel write failed', String(err)));

export default {
  async fetch(request, env, execution) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);
    const later = (promise) => (execution && execution.waitUntil ? execution.waitUntil(safely(promise)) : safely(promise));

    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'POST')
      return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers });

    const url = new URL(request.url);
    let body = {};
    try {
      // /e arrives via sendBeacon as text/plain, so parse the text ourselves.
      body = JSON.parse(await request.text()) || {};
    } catch {}

    if (url.pathname === '/e') {
      const ctx = context(body);
      const known = ALLOWED_ORIGINS.includes(origin);
      const bot = BOT_RE.test(request.headers.get('User-Agent') || '');
      if (known && !bot && ctx.vid && EVENT_TYPES.includes(body.type))
        later(record(env, ctx, body.type, clip(body.label, 200), body.meta));
      return new Response(null, { status: 204, headers });
    }

    const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
    if (!EMAIL_RE.test(email))
      return new Response(JSON.stringify({ error: 'invalid email' }), { status: 400, headers });

    const bd = (path, init = {}) =>
      fetch(`https://api.buttondown.com/v1${path}`, {
        ...init,
        headers: {
          Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

    if (url.pathname === '/subscribe') {
      const ctx = context(body.ctx);
      // Forward the real visitor IP + referrer so Buttondown's firewall doesn't
      // see every signup as coming from one Cloudflare datacenter IP. The referrer
      // now carries the kit page path, and the campaign rides in utm_campaign, so
      // the source of every subscriber is visible inside Buttondown too.
      const payload = JSON.stringify({
        email_address: email,
        ip_address: request.headers.get('CF-Connecting-IP') || undefined,
        referrer_url: (ALLOWED_ORIGINS.includes(origin) ? origin : 'https://theaotp.com') + (ctx.page || ''),
        utm_source: ctx.src ? 'instagram' : undefined,
        utm_medium: ctx.src ? 'dm' : undefined,
        utm_campaign: ctx.src || undefined,
      });
      let res = await bd('/subscribers', { method: 'POST', body: payload });
      if (res.status === 400 && /firewall/i.test(await res.clone().text())) {
        // False positive from Buttondown's rate-heuristic firewall (all our
        // signups share one worker egress IP). Retry via the documented
        // trusted-source bypass; Buttondown caps it at 5/hour per newsletter.
        res = await fetch('https://api.buttondown.com/v1/subscribers', {
          method: 'POST',
          headers: {
            Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Buttondown-Bypass-Firewall': 'true',
          },
          body: payload,
        });
      }
      // 201 = new subscriber; 400 with "already subscribed" also counts as success
      if (res.status === 201) {
        later(recordEmail(env, ctx, email, true));
        return new Response(JSON.stringify({ ok: true, new: true }), { headers });
      }
      const text = await res.text();
      if (res.status === 400 && /already/i.test(text)) {
        later(recordEmail(env, ctx, email, false));
        return new Response(JSON.stringify({ ok: true, new: false }), { headers });
      }
      if (res.status === 400 || res.status === 422) {
        // Surface Buttondown's reason (e.g. blocked/undeliverable address) instead of a generic 502.
        // 422 is its schema validator (stricter email pattern than ours); its detail is a list
        // of field errors, not a sentence, so the page falls back to its plain "rejected" line.
        let detail = '';
        try {
          const parsed = JSON.parse(text);
          detail = (typeof parsed.detail === 'string' && parsed.detail) || parsed.error || (Array.isArray(parsed) ? parsed.join(' ') : '');
        } catch {
          detail = text.slice(0, 200);
        }
        return new Response(JSON.stringify({ error: 'rejected', detail }), { status: 400, headers });
      }
      return new Response(JSON.stringify({ error: 'subscribe failed', status: res.status }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers });
  },
};
