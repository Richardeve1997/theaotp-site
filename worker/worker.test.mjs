// node --test worker.test.mjs
// The gate is production: every kit page's email form depends on /subscribe. These tests pin
// its behaviour and prove that funnel tracking can never change or break a signup response.
// The list tests run on a real SQLite database with schema.sql applied, so the list's SQL is
// exercised exactly as D1 (SQLite) will run it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.js';

const ORIGIN = 'https://theaotp.com';

// Since 2026-10-10 the gate keeps its own list and calls no email service on a signup.
const outside = [];
globalThis.fetch = async (url) => {
  outside.push(String(url));
  throw new Error(`the gate called out to ${url}`);
};

// Captures writes without running them: for the page-event tests, which check what was bound.
function fakeDb({ fail = false } = {}) {
  const writes = [];
  const statement = (sql) => ({
    bind: (...args) => ({
      sql, args,
      run: async () => { if (fail) throw new Error('d1 down'); writes.push({ sql, args }); },
    }),
  });
  return {
    writes,
    prepare: statement,
    batch: async (statements) => {
      if (fail) throw new Error('d1 down');
      statements.forEach((s) => writes.push({ sql: s.sql, args: s.args }));
    },
  };
}

// D1's API over a real in-memory SQLite database with schema.sql applied. A batch is one
// transaction, as on D1.
function sqliteDb({ fail = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const check = () => { if (fail) throw new Error('d1 down'); };
  const prepare = (sql) => ({
    bind: (...args) => ({
      exec: () => db.prepare(sql).run(...args),
      run: async () => { check(); db.prepare(sql).run(...args); },
      first: async () => { check(); return db.prepare(sql).get(...args) ?? null; },
      all: async () => { check(); return { results: db.prepare(sql).all(...args) }; },
    }),
  });
  return {
    prepare,
    batch: async (statements) => {
      check();
      db.exec('BEGIN');
      try {
        statements.forEach((s) => s.exec());
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    raw: db,
    rows: (sql, ...args) => db.prepare(sql).all(...args).map((row) => ({ ...row })),
  };
}

async function post(path, body, { env = {}, origin = ORIGIN, agent = 'Mozilla/5.0 Instagram' } = {}) {
  const pending = [];
  const request = new Request('https://gate.test' + path, {
    method: 'POST',
    headers: { Origin: origin, 'User-Agent': agent, 'CF-Connecting-IP': '203.0.113.9' },
    body: JSON.stringify(body),
  });
  const response = await worker.fetch(request, env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return response;
}

const CTX = { vid: 'vabc123', src: 'fx9k2a', t: '', page: '/fix/' };
const KIT = 'Unlock the guide and subscribe to AOTP';
const subscriber = (DB, email) => DB.rows('SELECT email, status, source FROM subscribers WHERE email = ?1', email)[0];
const consents = (DB, email) =>
  DB.rows('SELECT method, wording, page, campaign_code, link_token, visitor_id FROM consent_records WHERE email = ?1 ORDER BY id', email);
const emailLabels = (DB) => DB.rows("SELECT label FROM events WHERE type = 'email' ORDER BY id").map((r) => r.label);
const seed = (DB, email, status) =>
  DB.raw.prepare(`INSERT INTO subscribers (email, status, subscribed_at, last_signup_at, source, buttondown_type)
                  VALUES (?1, ?2, '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z', 'buttondown', ?3)`)
    .run(email, status, status === 'pending' ? 'unactivated' : status);

test('a new signup goes on our own list with its consent record, is tracked, and is remembered', async () => {
  const DB = sqliteDb();
  const res = await post('/subscribe', { email: ' Person@Example.com ', ctx: CTX }, { env: { DB } });
  assert.deepEqual(await res.json(), { ok: true, new: true, member: true });
  assert.deepEqual(subscriber(DB, 'person@example.com'), { email: 'person@example.com', status: 'subscribed', source: 'gate' });
  assert.deepEqual(consents(DB, 'person@example.com'), [
    { method: 'guide_gate', wording: KIT, page: '/fix/', campaign_code: 'fx9k2a', link_token: null, visitor_id: 'vabc123' },
  ]);
  assert.deepEqual(DB.rows("SELECT vid, page, src, label FROM events WHERE type = 'email'"),
    [{ vid: 'vabc123', page: '/fix/', src: 'fx9k2a', label: 'new' }]);
  assert.equal(DB.rows('SELECT email FROM visitors WHERE vid = ?1', 'vabc123')[0].email, 'person@example.com');
  assert.deepEqual(outside, []);
});

test('the homepage form (no ctx) signs up with its own wording and no funnel event', async () => {
  const DB = sqliteDb();
  const res = await post('/subscribe', { email: 'home@example.com' }, { env: { DB } });
  assert.deepEqual(await res.json(), { ok: true, new: true, member: true });
  assert.deepEqual(consents(DB, 'home@example.com'), [
    { method: 'homepage_form', wording: 'Subscribe', page: null, campaign_code: null, link_token: null, visitor_id: null },
  ]);
  assert.deepEqual(emailLabels(DB), []);
});

test('a subscriber who signs up again is welcomed back, with a second consent record', async () => {
  const DB = sqliteDb();
  await post('/subscribe', { email: 'back@example.com', ctx: CTX }, { env: { DB } });
  const res = await post('/subscribe', { email: 'back@example.com', ctx: { ...CTX, page: '/ai-pm/' } }, { env: { DB } });
  assert.deepEqual(await res.json(), { ok: true, new: false, member: true });
  assert.equal(subscriber(DB, 'back@example.com').status, 'subscribed');
  assert.deepEqual(consents(DB, 'back@example.com').map((c) => c.page), ['/fix/', '/ai-pm/']);
  assert.deepEqual(emailLabels(DB), ['new', 'returning']);
  assert.equal(DB.rows('SELECT COUNT(*) AS n FROM subscribers')[0].n, 1);
});

test('an old unconfirmed Buttondown signup becomes subscribed when they sign up again', async () => {
  const DB = sqliteDb();
  seed(DB, 'old@example.com', 'pending');
  const res = await post('/subscribe', { email: 'old@example.com', ctx: CTX }, { env: { DB } });
  assert.deepEqual(await res.json(), { ok: true, new: false, member: true });
  assert.deepEqual(subscriber(DB, 'old@example.com'), { email: 'old@example.com', status: 'subscribed', source: 'buttondown' });
  assert.equal(consents(DB, 'old@example.com').length, 1);
  assert.deepEqual(emailLabels(DB), ['reactivated']);
});

test('unsubscribed or suppressed people are never switched back on, and the guide still opens', async () => {
  for (const status of ['unsubscribed', 'suppressed']) {
    const DB = sqliteDb();
    seed(DB, 'gone@example.com', status);
    const res = await post('/subscribe', { email: 'gone@example.com', ctx: CTX }, { env: { DB } });
    assert.deepEqual(await res.json(), { ok: true, new: false, member: true }, status);
    assert.equal(subscriber(DB, 'gone@example.com').status, status);
    assert.deepEqual(consents(DB, 'gone@example.com'), [], status);
  }
});

test('if the list cannot be written, the guide still opens and the next visit asks again', async () => {
  for (const env of [{}, { DB: sqliteDb({ fail: true }) }]) {
    const res = await post('/subscribe', { email: 'a@example.com', ctx: CTX }, { env });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, new: true, member: false });
  }
});

test('a broken funnel write never changes the signup answer or loses the email', async () => {
  const DB = sqliteDb();
  DB.raw.exec('DROP TABLE events');
  const res = await post('/subscribe', { email: 'a@example.com', ctx: CTX }, { env: { DB } });
  assert.deepEqual(await res.json(), { ok: true, new: true, member: true });
  assert.equal(subscriber(DB, 'a@example.com').status, 'subscribed');
});

test('only our own pages can add to the list', async () => {
  const DB = sqliteDb();
  for (const origin of ['https://evil.test', '']) {
    const res = await post('/subscribe', { email: 'bot@example.com', ctx: CTX }, { env: { DB }, origin });
    assert.equal(res.status, 403, origin || 'no origin');
  }
  assert.equal(subscriber(DB, 'bot@example.com'), undefined);
});

test('an invalid email is refused and nothing is saved', async () => {
  const DB = sqliteDb();
  const res = await post('/subscribe', { email: 'nope', ctx: CTX }, { env: { DB } });
  assert.equal(res.status, 400);
  assert.equal(DB.rows('SELECT COUNT(*) AS n FROM subscribers')[0].n, 0);
});

test('a hostile ctx is dropped field by field, not stored', async () => {
  const DB = sqliteDb();
  const ctx = { vid: 'v1', src: 'x"; DROP TABLE events;--', t: '<script>', page: 'https://evil.test/' };
  await post('/subscribe', { email: 'c@example.com', ctx }, { env: { DB } });
  assert.deepEqual(consents(DB, 'c@example.com'), [
    { method: 'homepage_form', wording: 'Subscribe', page: null, campaign_code: null, link_token: null, visitor_id: 'v1' },
  ]);
  assert.deepEqual(DB.rows("SELECT page, src, token FROM events WHERE type = 'email'"), [{ page: null, src: null, token: null }]);
});

test('page events are stored for real visitors on our own origin only', async () => {
  const event = { vid: 'vabc123', type: 'click', page: '/fix/', src: 'fx9k2a', t: '', label: '#first copy', meta: { ref: '' } };
  const DB = fakeDb();
  const ok = await post('/e', event, { env: { DB } });
  assert.equal(ok.status, 204);
  assert.deepEqual(DB.writes[0].args.slice(1, 7), ['vabc123', 'click', '/fix/', 'fx9k2a', null, '#first copy']);

  for (const [name, change] of [
    ['unknown event type', { body: { ...event, type: 'purchase' } }],
    ['foreign origin', { origin: 'https://evil.test' }],
    ['link preview bot', { agent: 'facebookexternalhit/1.1' }],
    ['no visitor id', { body: { ...event, vid: '' } }],
  ]) {
    const quiet = fakeDb();
    const res = await post('/e', change.body || event, { env: { DB: quiet }, origin: change.origin, agent: change.agent });
    assert.equal(res.status, 204, name);
    assert.equal(quiet.writes.length, 0, name);
  }
});

// Stub Workers Rate Limiting binding: `allow` decides each answer, `keys` records what was counted.
function fakeLimiter(allow = true) {
  const keys = [];
  return {
    keys,
    limit: async ({ key }) => {
      keys.push(key);
      if (allow === 'throw') throw new Error('limiter down');
      return { success: typeof allow === 'function' ? allow(keys.length) : allow };
    },
  };
}

const BEACON = { vid: 'vabc123', type: 'visit', page: '/fix/', src: 'fx9k2a', t: '' };

test('page events over the per-IP limit are dropped quietly, counted by visitor IP', async () => {
  const DB = fakeDb();
  const BEACON_PER_IP = fakeLimiter(false);
  const res = await post('/e', BEACON, { env: { DB, BEACON_PER_IP } });
  assert.equal(res.status, 204);
  assert.equal(DB.writes.length, 0);
  assert.deepEqual(BEACON_PER_IP.keys, ['203.0.113.9']);
});

test('page events stop when the global database write budget is spent', async () => {
  const DB = fakeDb();
  const D1_WRITE_BUDGET = fakeLimiter((n) => n <= 1);
  await post('/e', BEACON, { env: { DB, BEACON_PER_IP: fakeLimiter(), D1_WRITE_BUDGET } });
  await post('/e', BEACON, { env: { DB, BEACON_PER_IP: fakeLimiter(), D1_WRITE_BUDGET } });
  assert.equal(DB.writes.filter((w) => w.sql.startsWith('INSERT INTO events')).length, 1);
  assert.deepEqual(D1_WRITE_BUDGET.keys, ['all', 'all']);
});

test('a signup over the per-IP limit is refused before anything is saved', async () => {
  const DB = sqliteDb();
  const SUBSCRIBE_PER_IP = fakeLimiter(false);
  const res = await post('/subscribe', { email: 'a@example.com', ctx: CTX }, { env: { DB, SUBSCRIBE_PER_IP } });
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: 'too many requests' });
  assert.equal(subscriber(DB, 'a@example.com'), undefined);
  assert.deepEqual(SUBSCRIBE_PER_IP.keys, ['203.0.113.9']);
});

test('a broken limiter never closes the gate or stops tracking', async () => {
  const DB = sqliteDb();
  const env = { DB, BEACON_PER_IP: fakeLimiter('throw'), D1_WRITE_BUDGET: fakeLimiter('throw'), SUBSCRIBE_PER_IP: fakeLimiter('throw') };
  const signup = await post('/subscribe', { email: 'a@example.com', ctx: CTX }, { env });
  assert.deepEqual(await signup.json(), { ok: true, new: true, member: true });
  assert.equal(subscriber(DB, 'a@example.com').status, 'subscribed');
  await post('/e', BEACON, { env });
  assert.equal(DB.rows("SELECT COUNT(*) AS n FROM events WHERE type = 'visit'")[0].n, 1);
});

test('bodies over 2 KB are refused before parsing: quiet for events, 413 for signups', async () => {
  const DB = fakeDb();
  const padded = 'x'.repeat(2100);
  const beacon = await post('/e', { ...BEACON, label: padded }, { env: { DB } });
  assert.equal(beacon.status, 204);
  assert.equal(DB.writes.length, 0);
  const signup = await post('/subscribe', { email: 'a@example.com', ctx: { ...CTX, page: padded } });
  assert.equal(signup.status, 413);
  assert.deepEqual(await signup.json(), { error: 'too large' });
});

test('a declared Content-Length over 2 KB is refused without reading the body', async () => {
  const request = new Request('https://gate.test/subscribe', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Length': '999999' },
    body: JSON.stringify({ email: 'a@example.com' }),
  });
  const res = await worker.fetch(request, {}, {});
  assert.equal(res.status, 413);
  assert.equal(request.bodyUsed, false);
});

test('routing: GET is refused, unknown paths 404, preflight answers', async () => {
  const get = await worker.fetch(new Request('https://gate.test/subscribe'), {}, {});
  assert.equal(get.status, 405);
  assert.equal((await post('/nope', { email: 'a@example.com' })).status, 404);
  const preflight = await worker.fetch(new Request('https://gate.test/e', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), {}, {});
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), ORIGIN);
});
