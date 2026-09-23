// theaotp.com email gate + funnel tracking — Cloudflare Worker
// Endpoints:
//   POST /subscribe  {email, ctx?}  -> adds to Buttondown as an ACTIVE subscriber (typing the
//                                      email into a kit form is the opt-in). Already-subscribed
//                                      counts as success and activates an old unconfirmed
//                                      record. Links the email to the visitor's funnel history
//                                      and answers {ok, new, member}.
//   POST /e          {vid, type, page, src?, t?, label?, meta?}  -> records one page event
// Secret required: BUTTONDOWN_API_KEY  (wrangler secret put BUTTONDOWN_API_KEY)
// Binding (optional): DB -> D1 database `aotp-funnel` (schema.sql). Tracking is best-effort:
// a missing binding or a failed write NEVER changes the /subscribe response.
// Rate limit bindings (optional, wrangler.toml [[ratelimits]]): BEACON_PER_IP and SUBSCRIBE_PER_IP
// count per visitor IP; D1_WRITE_BUDGET is one global key that caps tracking writes, so a flood
// can't fill the database or run up the bill. Bodies over MAX_BODY are refused before parsing.

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
// Real bodies are well under 1 KB (an event with a full label and meta is about 1.5 KB).
const MAX_BODY = 2048;

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

async function recordEmail(env, ctx, email, isNew, activated) {
  if (!env.DB || !ctx.vid) return;
  await record(env, ctx, 'email', isNew ? 'new' : activated ? 'reactivated' : 'returning');
  await env.DB.prepare('UPDATE visitors SET email = ?1, email_ts = COALESCE(email_ts, ?2) WHERE vid = ?3')
    .bind(email, new Date().toISOString(), ctx.vid).run();
}

// Opt-in policy (Rich, 2026-09-22): typing your email into a kit form IS the opt-in. Nobody on
// this list ever clicked Buttondown's double opt-in email (0 of 171), so new signups are created
// `regular`, and an old `unactivated` record is switched to `regular` when its owner re-enters.
// People who unsubscribed, were blocked, complained or bounced are never switched back on.
//
// Returns { activated, settled }. `settled` means there is nothing left to gain by asking this
// person for their email again, so the page may remember them as a member. It stays false when
// the lookup or the activation failed, which makes the next visit ask once more and retry.
async function activateOnReentry(bd, email) {
  const path = `/subscribers/${encodeURIComponent(email)}`;
  const found = await bd(path);
  if (!found.ok) return { activated: false, settled: false };
  if ((await found.json()).type !== 'unactivated') return { activated: false, settled: true };
  const changed = (await bd(path, { method: 'PATCH', body: JSON.stringify({ type: 'regular' }) })).ok;
  return { activated: changed, settled: changed };
}

// Tracking must never break the gate: swallow and log every failure.
const safely = (promise) => promise.catch((err) => console.log('funnel write failed', String(err)));

// A missing or failing limiter lets the request through: the limits protect the bill, and must
// never be the reason a real signup or visit is lost.
async function allowed(limiter, key) {
  if (!limiter || !key) return true;
  try {
    return (await limiter.limit({ key })).success;
  } catch {
    return true;
  }
}

export default {
  async fetch(request, env, execution) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);
    const later = (promise) => (execution && execution.waitUntil ? execution.waitUntil(safely(promise)) : safely(promise));

    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'POST')
      return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers });

    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || '';
    // Beacons can't show an error, so an oversized one is dropped quietly like any other junk.
    const tooLarge = () =>
      url.pathname === '/e'
        ? new Response(null, { status: 204, headers })
        : new Response(JSON.stringify({ error: 'too large' }), { status: 413, headers });
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return tooLarge();
    const text = await request.text();
    if (text.length > MAX_BODY) return tooLarge();

    let body = {};
    try {
      // /e arrives via sendBeacon as text/plain, so parse the text ourselves.
      body = JSON.parse(text) || {};
    } catch {}

    if (url.pathname === '/e') {
      const ctx = context(body);
      const known = ALLOWED_ORIGINS.includes(origin);
      const bot = BOT_RE.test(request.headers.get('User-Agent') || '');
      if (known && !bot && ctx.vid && EVENT_TYPES.includes(body.type))
        // Limits are checked after the 204 goes back, so a visitor never waits on them.
        later((async () => {
          if (!(await allowed(env.BEACON_PER_IP, ip)) || !(await allowed(env.D1_WRITE_BUDGET, 'all'))) return;
          await record(env, ctx, body.type, clip(body.label, 200), body.meta);
        })());
      return new Response(null, { status: 204, headers });
    }

    const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
    if (!EMAIL_RE.test(email))
      return new Response(JSON.stringify({ error: 'invalid email' }), { status: 400, headers });

    const bd = (path, { bypass, ...init } = {}) =>
      fetch(`https://api.buttondown.com/v1${path}`, {
        ...init,
        headers: {
          Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
          'Content-Type': 'application/json',
          ...(bypass ? { 'X-Buttondown-Bypass-Firewall': 'true' } : {}),
        },
      });

    if (url.pathname === '/subscribe') {
      if (!(await allowed(env.SUBSCRIBE_PER_IP, ip)))
        return new Response(JSON.stringify({ error: 'too many requests' }), { status: 429, headers });
      const ctx = context(body.ctx);
      // Forward the real visitor IP + referrer so Buttondown's firewall doesn't
      // see every signup as coming from one Cloudflare datacenter IP. The referrer
      // carries the kit page path, and the campaign rides in utm_campaign, so
      // the source of every subscriber is visible inside Buttondown too.
      const fields = {
        email_address: email,
        ip_address: ip || undefined,
        referrer_url: (ALLOWED_ORIGINS.includes(origin) ? origin : 'https://theaotp.com') + (ctx.page || ''),
        utm_source: ctx.src ? 'instagram' : undefined,
        utm_medium: ctx.src ? 'dm' : undefined,
        utm_campaign: ctx.src || undefined,
      };
      const create = async (subscriber) => {
        const payload = JSON.stringify(subscriber);
        const first = await bd('/subscribers', { method: 'POST', body: payload });
        if (first.status !== 400 || !/firewall/i.test(await first.clone().text())) return first;
        // False positive from Buttondown's rate-heuristic firewall (all our
        // signups share one worker egress IP). Retry via the documented
        // trusted-source bypass; Buttondown caps it at 5/hour per newsletter.
        return bd('/subscribers', { method: 'POST', body: payload, bypass: true });
      };

      // The record is created active (see activateOnReentry for the policy). Should Buttondown
      // ever refuse that shape, fall back to its double opt-in signup rather than close the
      // gate; `member: false` then makes the page say "check your inbox" and ask again later.
      let active = true;
      let res = await create({ ...fields, type: 'regular' });
      if ((res.status === 400 || res.status === 422) && !/already|firewall/i.test(await res.clone().text())) {
        active = false;
        res = await create(fields);
      }
      // `member` tells the page whether this person is now on the list for good and may be
      // remembered, so no kit page asks them for an email again (see /f.js).
      // 201 = new subscriber; 400 with "already subscribed" also counts as success
      if (res.status === 201) {
        later(recordEmail(env, ctx, email, true));
        return new Response(JSON.stringify({ ok: true, new: true, member: active }), { headers });
      }
      const text = await res.text();
      if (res.status === 400 && /already/i.test(text)) {
        // Awaited, not deferred: the page needs `member` in this response. A failed
        // activation still unlocks the page and still records the re-entry.
        const reentry = await activateOnReentry(bd, email).catch(() => ({ activated: false, settled: false }));
        later(recordEmail(env, ctx, email, false, reentry.activated));
        return new Response(JSON.stringify({ ok: true, new: false, member: reentry.settled }), { headers });
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
