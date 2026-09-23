// node --test worker.test.mjs
// The gate is production: every kit page's email form depends on /subscribe. These tests pin
// its behaviour and prove that funnel tracking can never change or break a signup response.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

const ORIGIN = 'https://theaotp.com';

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

// Stub Buttondown: `replies` is a queue of [status, body] answers, one per API call.
function stubButtondown(replies) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: init.method || 'GET', headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
    const [status, body] = replies.shift();
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
  return calls;
}

async function post(path, body, { env = {}, origin = ORIGIN, agent = 'Mozilla/5.0 Instagram' } = {}) {
  const pending = [];
  const request = new Request('https://gate.test' + path, {
    method: 'POST',
    headers: { Origin: origin, 'User-Agent': agent, 'CF-Connecting-IP': '203.0.113.9' },
    body: JSON.stringify(body),
  });
  const response = await worker.fetch(request, { BUTTONDOWN_API_KEY: 'k', ...env }, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return response;
}

const CTX = { vid: 'vabc123', src: 'fx9k2a', t: '', page: '/fix/' };
const ALREADY = [400, { detail: 'That email address is already subscribed.' }];
const emailLabel = (DB) => DB.writes.find((w) => w.sql.startsWith('INSERT INTO events')).args[6];

test('a new signup is created as an active subscriber, attributed, recorded, and remembered', async () => {
  const calls = stubButtondown([[201, {}]]);
  const DB = fakeDb();
  const res = await post('/subscribe', { email: ' Person@Example.com ', ctx: CTX }, { env: { DB } });
  assert.deepEqual(await res.json(), { ok: true, new: true, member: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, {
    email_address: 'person@example.com', ip_address: '203.0.113.9', type: 'regular',
    referrer_url: 'https://theaotp.com/fix/', utm_source: 'instagram', utm_medium: 'dm', utm_campaign: 'fx9k2a',
  });
  const event = DB.writes.find((w) => w.sql.startsWith('INSERT INTO events'));
  assert.deepEqual(event.args.slice(1), ['vabc123', 'email', '/fix/', 'fx9k2a', null, 'new', null]);
  const link = DB.writes.find((w) => w.sql.startsWith('UPDATE visitors SET email'));
  assert.equal(link.args[0], 'person@example.com');
  assert.equal(link.args[2], 'vabc123');
});

test('a page cached before tracking shipped (no ctx) still subscribes', async () => {
  const calls = stubButtondown([[201, {}]]);
  const DB = fakeDb();
  const res = await post('/subscribe', { email: 'old@example.com' }, { env: { DB } });
  assert.deepEqual(await res.json(), { ok: true, new: true, member: true });
  assert.deepEqual(calls[0].body, { email_address: 'old@example.com', ip_address: '203.0.113.9', referrer_url: 'https://theaotp.com', type: 'regular' });
  assert.equal(DB.writes.length, 0);
});

test('if Buttondown refuses an active signup, fall back to its double opt-in and say so', async () => {
  const calls = stubButtondown([[400, { detail: 'type may not be set' }], [201, {}]]);
  const res = await post('/subscribe', { email: 'new@example.com', ctx: CTX });
  assert.deepEqual(await res.json(), { ok: true, new: true, member: false });
  assert.equal(calls[0].body.type, 'regular');
  assert.equal(calls[1].body.type, undefined);
});

test('a confirmed subscriber who re-enters is left alone, recorded as returning, remembered', async () => {
  const calls = stubButtondown([ALREADY, [200, { type: 'regular' }]]);
  const DB = fakeDb();
  const res = await post('/subscribe', { email: 'back@example.com', ctx: CTX }, { env: { DB } });
  assert.deepEqual(await res.json(), { ok: true, new: false, member: true });
  assert.deepEqual(calls.map((c) => c.method), ['POST', 'GET']);
  assert.equal(emailLabel(DB), 'returning');
});

test('an unconfirmed subscriber who re-enters is activated on the spot', async () => {
  const calls = stubButtondown([ALREADY, [200, { type: 'unactivated' }], [200, { type: 'regular' }]]);
  const DB = fakeDb();
  const res = await post('/subscribe', { email: 'old+kit@example.com', ctx: CTX }, { env: { DB } });
  assert.deepEqual(await res.json(), { ok: true, new: false, member: true });
  assert.deepEqual(calls.map((c) => c.method), ['POST', 'GET', 'PATCH']);
  assert.equal(calls[2].url, 'https://api.buttondown.com/v1/subscribers/old%2Bkit%40example.com');
  assert.deepEqual(calls[2].body, { type: 'regular' });
  assert.equal(emailLabel(DB), 'reactivated');
});

test('unsubscribed or blocked people are never switched back on, and are not asked again', async () => {
  for (const type of ['unsubscribed', 'blocked', 'complained', 'undeliverable']) {
    const calls = stubButtondown([ALREADY, [200, { type }]]);
    const res = await post('/subscribe', { email: 'gone@example.com', ctx: CTX }, { env: { DB: fakeDb() } });
    assert.deepEqual(calls.map((c) => c.method), ['POST', 'GET'], type);
    assert.deepEqual(await res.json(), { ok: true, new: false, member: true }, type);
  }
});

test('a failed activation still unlocks the page, records the re-entry, and asks again next time', async () => {
  for (const replies of [[ALREADY, [500, 'upstream error']], [ALREADY, [200, { type: 'unactivated' }], [500, 'upstream error']]]) {
    stubButtondown(replies);
    const DB = fakeDb();
    const res = await post('/subscribe', { email: 'back@example.com', ctx: CTX }, { env: { DB } });
    assert.deepEqual(await res.json(), { ok: true, new: false, member: false });
    assert.equal(emailLabel(DB), 'returning');
  }
});

test('firewall false positive retries once with the bypass header, still as an active signup', async () => {
  const calls = stubButtondown([[400, { detail: 'This subscriber was blocked by your firewall' }], [201, {}]]);
  const res = await post('/subscribe', { email: 'fw@example.com', ctx: CTX });
  assert.deepEqual(await res.json(), { ok: true, new: true, member: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers['X-Buttondown-Bypass-Firewall'], 'true');
  assert.equal(calls[1].body.type, 'regular');
});

test('a rejected address surfaces the reason and records nothing', async () => {
  const calls = stubButtondown([[400, { detail: 'undeliverable' }], [400, { detail: 'undeliverable' }]]);
  const DB = fakeDb();
  const res = await post('/subscribe', { email: 'bad@example.com', ctx: CTX }, { env: { DB } });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'rejected', detail: 'undeliverable' });
  assert.equal(calls.length, 2);
  assert.equal(DB.writes.length, 0);
});

test("an address Buttondown's stricter validator refuses (422) reads as rejected, not as an outage", async () => {
  const bad = [422, { detail: [{ type: 'string_pattern_mismatch', loc: ['body', 'payload', 'email_address'] }] }];
  stubButtondown([bad, bad]);
  const res = await post('/subscribe', { email: 'a@b.c', ctx: CTX });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'rejected', detail: '' });
});

test('an invalid email never reaches Buttondown', async () => {
  const calls = stubButtondown([]);
  const res = await post('/subscribe', { email: 'nope', ctx: CTX });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('a broken or missing database never changes the signup response', async () => {
  stubButtondown([[201, {}]]);
  const down = await post('/subscribe', { email: 'a@example.com', ctx: CTX }, { env: { DB: fakeDb({ fail: true }) } });
  assert.deepEqual(await down.json(), { ok: true, new: true, member: true });
  stubButtondown([[201, {}]]);
  const none = await post('/subscribe', { email: 'b@example.com', ctx: CTX });
  assert.deepEqual(await none.json(), { ok: true, new: true, member: true });
});

test('a hostile ctx is dropped field by field, not stored', async () => {
  const calls = stubButtondown([[201, {}]]);
  const DB = fakeDb();
  const ctx = { vid: 'v1', src: 'x"; DROP TABLE events;--', t: '<script>', page: 'https://evil.test/' };
  await post('/subscribe', { email: 'c@example.com', ctx }, { env: { DB } });
  assert.equal(calls[0].body.referrer_url, 'https://theaotp.com');
  assert.equal(calls[0].body.utm_campaign, undefined);
  assert.deepEqual(DB.writes.find((w) => w.sql.startsWith('INSERT INTO events')).args.slice(3, 6), [null, null, null]);
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

test('a signup over the per-IP limit is refused before Buttondown is called', async () => {
  const calls = stubButtondown([]);
  const SUBSCRIBE_PER_IP = fakeLimiter(false);
  const res = await post('/subscribe', { email: 'a@example.com', ctx: CTX }, { env: { SUBSCRIBE_PER_IP } });
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: 'too many requests' });
  assert.equal(calls.length, 0);
  assert.deepEqual(SUBSCRIBE_PER_IP.keys, ['203.0.113.9']);
});

test('a broken limiter never closes the gate or stops tracking', async () => {
  stubButtondown([[201, {}]]);
  const DB = fakeDb();
  const env = { DB, BEACON_PER_IP: fakeLimiter('throw'), D1_WRITE_BUDGET: fakeLimiter('throw'), SUBSCRIBE_PER_IP: fakeLimiter('throw') };
  const signup = await post('/subscribe', { email: 'a@example.com', ctx: CTX }, { env });
  assert.deepEqual(await signup.json(), { ok: true, new: true, member: true });
  await post('/e', BEACON, { env });
  assert.ok(DB.writes.some((w) => w.args[2] === 'visit'));
});

test('bodies over 2 KB are refused before parsing: quiet for events, 413 for signups', async () => {
  const calls = stubButtondown([]);
  const DB = fakeDb();
  const padded = 'x'.repeat(2100);
  const beacon = await post('/e', { ...BEACON, label: padded }, { env: { DB } });
  assert.equal(beacon.status, 204);
  assert.equal(DB.writes.length, 0);
  const signup = await post('/subscribe', { email: 'a@example.com', ctx: { ...CTX, page: padded } });
  assert.equal(signup.status, 413);
  assert.deepEqual(await signup.json(), { error: 'too large' });
  assert.equal(calls.length, 0);
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
  stubButtondown([]);
  assert.equal((await post('/nope', { email: 'a@example.com' })).status, 404);
  const preflight = await worker.fetch(new Request('https://gate.test/e', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), {}, {});
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), ORIGIN);
});
