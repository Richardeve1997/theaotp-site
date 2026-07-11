// theaotp.com email gate — Cloudflare Worker
// Endpoints:
//   POST /subscribe  {email}  -> adds to Buttondown (already-subscribed counts as success)
// Secret required: BUTTONDOWN_API_KEY  (wrangler secret put BUTTONDOWN_API_KEY)

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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'POST')
      return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers });

    let email = '';
    try {
      email = ((await request.json()).email || '').trim().toLowerCase();
    } catch {}
    if (!EMAIL_RE.test(email))
      return new Response(JSON.stringify({ error: 'invalid email' }), { status: 400, headers });

    const url = new URL(request.url);
    const bd = (path, init = {}) =>
      fetch(`https://api.buttondown.com/v1${path}`, {
        ...init,
        headers: {
          Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

    if (url.pathname === '/subscribe') {
      const res = await bd('/subscribers', {
        method: 'POST',
        body: JSON.stringify({ email_address: email }),
      });
      // 201 = new subscriber; 400 with "already subscribed" also counts as success
      if (res.status === 201)
        return new Response(JSON.stringify({ ok: true, new: true }), { headers });
      const body = await res.text();
      if (res.status === 400 && /already/i.test(body))
        return new Response(JSON.stringify({ ok: true, new: false }), { headers });
      return new Response(JSON.stringify({ error: 'subscribe failed' }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers });
  },
};
