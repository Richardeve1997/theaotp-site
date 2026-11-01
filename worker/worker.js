// theaotp.com email gate + funnel tracking — Cloudflare Worker
// Endpoints:
//   POST /subscribe  {email, ctx?}  -> saves the email to OUR OWN list (D1 `subscribers`, plus a
//                                      consent record per signup) and answers {ok, new, member}.
//                                      Typing the email into a kit form is the opt-in. Nothing is
//                                      emailed from here: sending will go through Resend, reading
//                                      this list (Flywheel ADR 0008).
//   POST /e          {vid, type, page, src?, t?, label?, meta?}  -> records one page event
//   POST /known      {t}            -> {member}: true when a subscribed person once signed up through a
//                                      DM link carrying this token, so a kit opens for them in a fresh
//                                      in-app browser without the email again. Never answers the email.
// Until 2026-10-10 signups went to Buttondown, whose API takes at most 100 new subscribers a day;
// past that every reader was refused and the guide stayed locked. Rich, that day: "switch to
// collecting the emails ourselves and using resend to eventually send emails".
// Binding: DB -> D1 database `aotp-funnel` (schema.sql) holds the list and the funnel events.
// Funnel tracking is best-effort: a failed event write NEVER changes the /subscribe response.
// A failed list write still opens the guide, and answers member:false so the next visit asks again.
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

// The words the visitor pressed, kept as the consent record. Taken from the live pages, never from
// the request: every kit gate's button (all 40 pages, 2026-10-10) and the homepage form's.
const KIT_WORDING = 'Unlock the guide and subscribe to AOTP';
const HOME_WORDING = 'Subscribe';

const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
// vid / src / token are opaque ids minted by f.js or by our own link builder.
const ident = (value, max) => (typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) ? value.slice(0, max) : '');
// The per-person ?t= token is the commenter's Instagram username (Zernio fills {{username}} into the
// DM link), so it may carry dots. Lower case, so one person is one token however it was typed.
const linkToken = (value) => (typeof value === 'string' && /^[A-Za-z0-9._-]+$/.test(value) ? value.slice(0, 64).toLowerCase() : '');
const pagePath = (value) => (typeof value === 'string' && /^\/[A-Za-z0-9/_-]*$/.test(value) ? value.slice(0, 80) : '');

function context(raw) {
  const ctx = raw && typeof raw === 'object' ? raw : {};
  return { vid: ident(ctx.vid, 40), src: ident(ctx.src, 40), token: linkToken(ctx.t), page: pagePath(ctx.page) };
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

// label: new | returning | reactivated
async function recordEmail(env, ctx, email, label) {
  if (!env.DB || !ctx.vid) return;
  await record(env, ctx, 'email', label);
  await env.DB.prepare('UPDATE visitors SET email = ?1, email_ts = COALESCE(email_ts, ?2) WHERE vid = ?3')
    .bind(email, new Date().toISOString(), ctx.vid).run();
}

// One subscriber row per email, and one consent record per signup. Statuses:
//   subscribed    may be emailed
//   pending       an old Buttondown signup that never confirmed its double opt-in (imported);
//                 signing up again through a gate makes it subscribed (Flywheel ADR 0008)
//   unsubscribed, suppressed (bounced, complained, blocked): never undone by signing up again,
//                 and no new consent is recorded for them
// Answers the funnel label, or null when the address is unsubscribed or suppressed.
async function saveSignup(env, email, ctx) {
  const now = new Date().toISOString();
  const found = await env.DB.prepare('SELECT status FROM subscribers WHERE email = ?1').bind(email).first();
  const status = found ? found.status : null;
  if (status === 'unsubscribed' || status === 'suppressed') return null;
  const save = found
    ? env.DB.prepare(`UPDATE subscribers SET last_signup_at = ?2,
                        status = CASE WHEN status = 'pending' THEN 'subscribed' ELSE status END
                      WHERE email = ?1`).bind(email, now)
    : env.DB.prepare(`INSERT INTO subscribers (email, status, subscribed_at, last_signup_at, source)
                      VALUES (?1, 'subscribed', ?2, ?2, 'gate')`).bind(email, now);
  const kit = Boolean(ctx.page && ctx.page !== '/');
  const consent = env.DB.prepare(`INSERT INTO consent_records
                                    (email, method, wording, page, campaign_code, link_token, visitor_id, given_at)
                                  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
    .bind(email, kit ? 'guide_gate' : 'homepage_form', kit ? KIT_WORDING : HOME_WORDING,
      ctx.page || null, ctx.src || null, ctx.token || null, ctx.vid || null, now);
  await env.DB.batch([save, consent]);
  return !found ? 'new' : status === 'pending' ? 'reactivated' : 'returning';
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

    if (url.pathname === '/known') {
      // Worst case someone guesses a username and opens a free guide; no address ever leaves here.
      const token = linkToken(body.t);
      if (!token || !ALLOWED_ORIGINS.includes(origin) || !env.DB || !(await allowed(env.BEACON_PER_IP, ip)))
        return new Response(JSON.stringify({ member: false }), { headers });
      try {
        const row = await env.DB.prepare(`SELECT 1 FROM consent_records c JOIN subscribers s ON s.email = c.email
                                          WHERE c.link_token = ?1 AND s.status = 'subscribed' LIMIT 1`).bind(token).first();
        return new Response(JSON.stringify({ member: Boolean(row) }), { headers });
      } catch (err) {
        console.log('known lookup failed', String(err));
        return new Response(JSON.stringify({ member: false }), { headers });
      }
    }

    const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
    if (!EMAIL_RE.test(email))
      return new Response(JSON.stringify({ error: 'invalid email' }), { status: 400, headers });

    if (url.pathname === '/subscribe') {
      // Only our own pages may add to the list. Buttondown's firewall used to keep scripted junk
      // out; this, with the per-IP limit below, keeps the list to people who used a real form.
      if (!ALLOWED_ORIGINS.includes(origin))
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers });
      if (!(await allowed(env.SUBSCRIBE_PER_IP, ip)))
        return new Response(JSON.stringify({ error: 'too many requests' }), { status: 429, headers });
      const ctx = context(body.ctx);

      // The visitor did nothing wrong if the list can't be written, so the guide opens either
      // way. `member` tells the page whether this person is now on the list for good and may be
      // remembered, so no kit page asks them for an email again (see /f.js); false makes the
      // next visit ask once more.
      let label;
      try {
        if (!env.DB) throw new Error('no DB binding');
        label = await saveSignup(env, email, ctx);
      } catch (err) {
        console.log('list write failed', String(err));
        return new Response(JSON.stringify({ ok: true, new: true, member: false }), { headers });
      }
      later(recordEmail(env, ctx, email, label || 'returning'));
      return new Response(JSON.stringify({ ok: true, new: label === 'new', member: true }), { headers });
    }

    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers });
  },
};
