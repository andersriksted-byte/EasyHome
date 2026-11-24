// easyHome – Cloudflare Worker
// 1) /proxy?url=…  henter RSS-feeds og iCal-kalendere for dashboardet (kun fra godkendte domæner)
// 2) /sonos/…      logger ind hos Sonos og videresender styring til Sonos Control API
//
// Variabler (Settings → Variables and Secrets):
//   DASH_KEY             (secret) – lang tilfældig tekst; bruges til at underskrive familie-login (og som reservenøgle)
//   APP_ORIGIN           – fx https://andersriksted-byte.github.io  (hvor dashboardet ligger)
//   SONOS_CLIENT_ID      – "Key" fra Sonos developer-portalen
//   SONOS_CLIENT_SECRET  (secret) – "Secret" fra Sonos developer-portalen
//   EXTRA_HOSTS          – valgfrit: ekstra domæner til egne RSS-feeds, adskilt af komma
// KV-binding: DASH_KV (Storage & Databases → KV → opret "easyhome" → bind som DASH_KV)

const ALLOWED_HOSTS = [
  'www.dr.dk', 'dr.dk', 'feeds.services.tv2.dk', 'nyheder.tv2.dk',
  'newsletter-proxy.aws.jyllands-posten.dk', 'rss-feed-api.aws.jyllands-posten.dk',
  'politiken.dk', 'www.berlingske.dk', 'berlingske.dk',
  'calendar.google.com', 'icloud.com', 'outlook.office365.com', 'outlook.live.com', 'outlook.office.com'
];
const SONOS_AUTH = 'https://api.sonos.com/login/v3/oauth';
const SONOS_API = 'https://api.ws.sonos.com/control/api/v1';

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.APP_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Dash-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}
const json = (env, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(env) } });

function hostAllowed(host, env) {
  const extra = (env.EXTRA_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ALLOWED_HOSTS.concat(extra).some((h) => host === h || host.endsWith('.' + h));
}

function keyOk(req, env) {
  const k = req.headers.get('X-Dash-Key') || '';
  if (!env.DASH_KEY || k.length !== env.DASH_KEY.length) return false;
  let diff = 0;
  for (let i = 0; i < k.length; i++) diff |= k.charCodeAt(i) ^ env.DASH_KEY.charCodeAt(i);
  return diff === 0;
}

/* ---------- Familie-login ----------
   Familien logger ind med familienavn + fælles kode. Skærmen får et underskrevet adgangsbevis (token),
   som bruges i stedet for DASH_KEY. "Log alle skærme ud" gør alle udstedte beviser ugyldige. */
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(env, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode(env.DASH_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
}
async function hashCode(code, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const k = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, k, 256));
}
const norm = (t) => String(t || '').trim().toLowerCase().replace(/^familien\s+/, '');
let epochCache = { v: null, at: 0 };
async function authEpoch(env) {
  if (epochCache.v !== null && Date.now() - epochCache.at < 60000) return epochCache.v;
  const v = env.DASH_KV ? (await env.DASH_KV.get('auth_epoch')) || '1' : '1';
  epochCache = { v, at: Date.now() };
  return v;
}
async function makeToken(env, device) {
  const payload = b64u(enc.encode(JSON.stringify({ e: await authEpoch(env), t: Date.now(), d: String(device || '').slice(0, 40) })));
  return 't1.' + payload + '.' + (await hmac(env, payload));
}
async function authOk(req, env) {
  if (keyOk(req, env)) return true;
  const k = req.headers.get('X-Dash-Key') || '';
  const m = /^t1\.([A-Za-z0-9_-]+)\.([0-9a-f]{64})$/.exec(k);
  if (!m || !env.DASH_KEY) return false;
  if ((await hmac(env, m[1])) !== m[2]) return false;
  try {
    const p = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(p.e) === String(await authEpoch(env));
  } catch (e) { return false; }
}
async function auth(req, env, path) {
  if (!env.DASH_KV) return json(env, { error: 'DASH_KV mangler' }, 501);
  if (path === '/auth/info') return json(env, { configured: !!(await env.DASH_KV.get('auth_family')) });
  if (path === '/auth/login' && req.method === 'POST') {
    const ip = req.headers.get('CF-Connecting-IP') || 'x';
    const fails = +(await env.DASH_KV.get('auth_fail_' + ip)) || 0;
    if (fails >= 8) return json(env, { error: 'For mange forsøg. Vent 15 minutter, og prøv igen.' }, 429);
    const body = await req.json().catch(() => ({}));
    const saved = JSON.parse((await env.DASH_KV.get('auth_family')) || 'null');
    if (!saved) return json(env, { error: 'Familiekoden er ikke oprettet endnu.' }, 409);
    const ok = norm(body.family) === norm(saved.family) && (await hashCode(String(body.code || ''), saved.salt)) === saved.hash;
    if (!ok) {
      await env.DASH_KV.put('auth_fail_' + ip, String(fails + 1), { expirationTtl: 900 });
      return json(env, { error: 'Forkert familienavn eller kode.' }, 401);
    }
    return json(env, { token: await makeToken(env, body.device), family: saved.family });
  }
  if (!(await authOk(req, env))) return json(env, { error: 'Forkert nøgle' }, 401);
  if (path === '/auth/setup' && req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const family = String(body.family || '').trim().slice(0, 60);
    const code = String(body.code || '');
    if (!family) return json(env, { error: 'Skriv familiens navn.' }, 400);
    if (code.length < 6) return json(env, { error: 'Koden skal være mindst 6 tegn.' }, 400);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    await env.DASH_KV.put('auth_family', JSON.stringify({ family, salt, hash: await hashCode(code, salt), at: Date.now() }));
    return json(env, { ok: true });
  }
  if (path === '/auth/logout-all' && req.method === 'POST') {
    const next = String((+(await authEpoch(env)) || 1) + 1);
    await env.DASH_KV.put('auth_epoch', next);
    epochCache = { v: next, at: Date.now() };
    return json(env, { ok: true, token: await makeToken(env, 'denne skærm') });
  }
  return json(env, { error: 'Ukendt' }, 404);
}

async function proxy(req, env, ctx) {
  const target = new URL(req.url).searchParams.get('url');
  let u;
  try { u = new URL(target); } catch (e) { return json(env, { error: 'Ugyldig adresse' }, 400); }
  if (!/^https?:$/.test(u.protocol)) return json(env, { error: 'Kun http og https' }, 400);
  // Kendte kilder hentes altid. Andre adresser (egne feeds) hentes også, men kun feeds, kalendere og
  // almindelige websider (så easyHome kan finde sidens RSS-link) – og kun for den, der har nøglen.
  const known = hostAllowed(u.hostname, env);
  const cache = caches.default;
  const cacheKey = new Request('https://cache.easyhome/' + encodeURIComponent(u.toString()));
  let res = await cache.match(cacheKey);
  if (!res) {
    const up = await fetch(u.toString(), { headers: { 'User-Agent': 'easyHome/1.0 (privat familie-dashboard)', Accept: 'application/rss+xml, application/xml, text/calendar, text/xml, */*' }, redirect: 'follow' });
    if (!up.ok) return json(env, { error: 'Kilden svarede ' + up.status }, 502);
    const body = await up.text();
    if (body.length > 3000000) return json(env, { error: 'Kilden er for stor' }, 413);
    // Ukendte adresser: kig på indholdet i stedet for filtypen – kalender, feed eller webside (til RSS-søgning)
    const head = body.slice(0, 2000).trimStart().replace(/^\uFEFF/, '');
    if (!known && !(/^BEGIN:VCALENDAR/i.test(head) || head.startsWith('<'))) return json(env, { error: 'Adressen er ikke et nyhedsfeed eller en kalender' }, 415);
    res = new Response(body, { headers: { 'Content-Type': up.headers.get('Content-Type') || 'text/plain; charset=utf-8', 'Cache-Control': 'max-age=300' } });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors(env))) out.headers.set(k, v);
  return out;
}

/* ---------- Sonos ---------- */
const sonosReady = (env) => !!(env.SONOS_CLIENT_ID && env.SONOS_CLIENT_SECRET && env.DASH_KV);
const basic = (env) => 'Basic ' + btoa(env.SONOS_CLIENT_ID + ':' + env.SONOS_CLIENT_SECRET);
const callbackUrl = (req) => new URL(req.url).origin + '/sonos/callback';

async function tokenRequest(env, params) {
  const r = await fetch(SONOS_AUTH + '/access', {
    method: 'POST',
    headers: { Authorization: basic(env), 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams(params).toString()
  });
  if (!r.ok) throw new Error('Sonos token-fejl ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const t = await r.json();
  return { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in || 86400) * 1000 };
}

async function getToken(env) {
  const raw = await env.DASH_KV.get('sonos_tokens');
  if (!raw) return null;
  let t = JSON.parse(raw);
  if (Date.now() > t.expires_at - 120000) {
    const n = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
    t = { ...n, refresh_token: n.refresh_token || t.refresh_token };
    await env.DASH_KV.put('sonos_tokens', JSON.stringify(t));
  }
  return t.access_token;
}

async function sonos(req, env, path) {
  if (!sonosReady(env)) return json(env, { error: 'Sonos er ikke sat op i workeren (SONOS_CLIENT_ID, SONOS_CLIENT_SECRET, DASH_KV)' }, 501);

  if (path === '/sonos/callback') {
    const p = new URL(req.url).searchParams;
    const state = p.get('state') || '';
    const saved = await env.DASH_KV.get('sonos_state_' + state);
    if (!saved) return new Response('Login udløbet – start forfra fra dashboardet.', { status: 400 });
    await env.DASH_KV.delete('sonos_state_' + state);
    const back = JSON.parse(saved).returnTo;
    try {
      const t = await tokenRequest(env, { grant_type: 'authorization_code', code: p.get('code') || '', redirect_uri: callbackUrl(req) });
      await env.DASH_KV.put('sonos_tokens', JSON.stringify(t));
      return Response.redirect(back + '?sonos=ok', 302);
    } catch (e) {
      return Response.redirect(back + '?sonos=fejl', 302);
    }
  }

  if (!(await authOk(req, env))) return json(env, { error: 'Forkert nøgle' }, 401);

  if (path === '/sonos/status') return json(env, { connected: !!(await env.DASH_KV.get('sonos_tokens')) });
  if (path === '/sonos/logout' && req.method === 'POST') { await env.DASH_KV.delete('sonos_tokens'); return json(env, { ok: true }); }
  if (path === '/sonos/login-url' && req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    let returnTo = String(body.returnTo || env.APP_ORIGIN || '');
    if (env.APP_ORIGIN && !returnTo.startsWith(env.APP_ORIGIN)) returnTo = env.APP_ORIGIN;
    returnTo = returnTo.split('?')[0];
    const state = crypto.randomUUID();
    await env.DASH_KV.put('sonos_state_' + state, JSON.stringify({ returnTo }), { expirationTtl: 600 });
    const q = new URLSearchParams({ client_id: env.SONOS_CLIENT_ID, response_type: 'code', state, scope: 'playback-control-all', redirect_uri: callbackUrl(req) });
    return json(env, { url: SONOS_AUTH + '?' + q.toString() });
  }
  if (path.startsWith('/sonos/api/')) {
    const token = await getToken(env).catch(() => null);
    if (!token) return json(env, { error: 'Sonos er ikke forbundet' }, 401);
    const sub = path.slice('/sonos/api'.length);
    if (!/^\/(households|groups|players|favorites|playlists)[A-Za-z0-9_:./-]*$/.test(sub)) return json(env, { error: 'Ugyldig Sonos-sti' }, 400);
    const up = await fetch(SONOS_API + sub, {
      method: req.method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? await req.text() : undefined
    });
    const text = await up.text();
    return new Response(text || '{}', { status: up.status, headers: { 'Content-Type': 'application/json', ...cors(env) } });
  }
  return json(env, { error: 'Ukendt' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    const path = new URL(req.url).pathname;
    try {
      if (path.startsWith('/sonos/')) return await sonos(req, env, path);
      if (path.startsWith('/auth/')) return await auth(req, env, path);
      if (!(await authOk(req, env))) return json(env, { error: 'Forkert nøgle' }, 401);
      if (path === '/health') return json(env, { ok: true, sonosConfigured: sonosReady(env), version: 3 });
      if (path === '/proxy') return await proxy(req, env, ctx);
      if (path === '/img') {
        // Coverbilleder fra Sonos, der kun findes på http (browseren blokerer dem på en https-side)
        let u; try { u = new URL(new URL(req.url).searchParams.get('url')); } catch (e) { return json(env, { error: 'Ugyldig adresse' }, 400); }
        if (!/^https?:$/.test(u.protocol)) return json(env, { error: 'Kun http og https' }, 400);
        const up = await fetch(u.toString(), { cf: { cacheTtl: 86400, cacheEverything: true } });
        const ct = up.headers.get('Content-Type') || '';
        if (!up.ok || !ct.startsWith('image/')) return json(env, { error: 'Ikke et billede' }, 415);
        return new Response(up.body, { headers: { 'Content-Type': ct, 'Cache-Control': 'max-age=86400', ...cors(env) } });
      }
      if (path.startsWith('/media/')) {
        if (!env.DASH_KV) return json(env, { error: 'DASH_KV mangler' }, 501);
        const id = decodeURIComponent(path.slice(7));
        if (!/^[a-z0-9-]{1,40}$/i.test(id)) return json(env, { error: 'Ugyldigt id' }, 400);
        if (req.method === 'POST') {
          const body = await req.text();
          if (body.length > 3000000) return json(env, { error: 'Billedet er for stort' }, 413);
          const parsed = JSON.parse(body);
          if (parsed.delete) { await env.DASH_KV.delete('media_' + id); return json(env, { ok: true }); }
          if (!/^data:image\/(jpeg|png|webp);base64,/.test(parsed.data || '')) return json(env, { error: 'Ugyldigt billede' }, 400);
          await env.DASH_KV.put('media_' + id, parsed.data);
          return json(env, { ok: true });
        }
        const data = await env.DASH_KV.get('media_' + id);
        return json(env, { id, data: data || '' });
      }
      if (path === '/bg') {
        if (!env.DASH_KV) return json(env, { error: 'DASH_KV mangler' }, 501);
        if (req.method === 'POST') {
          const body = await req.text();
          if (body.length > 4000000) return json(env, { error: 'Billedet er for stort' }, 413);
          const parsed = JSON.parse(body);
          if (!/^data:image\/(jpeg|png|webp);base64,/.test(parsed.data || '')) return json(env, { error: 'Ugyldigt billede' }, 400);
          await env.DASH_KV.put('bg_image', JSON.stringify({ id: String(parsed.id || ''), data: parsed.data }));
          return json(env, { ok: true });
        }
        const raw = await env.DASH_KV.get('bg_image');
        return json(env, raw ? JSON.parse(raw) : { id: '', data: '' });
      }
      if (path === '/settings') {
        if (!env.DASH_KV) return json(env, { error: 'DASH_KV mangler' }, 501);
        if (req.method === 'POST') {
          const body = await req.text();
          if (body.length > 200000) return json(env, { error: 'For stor' }, 413);
          const parsed = JSON.parse(body);
          await env.DASH_KV.put('shared_settings', JSON.stringify({ updatedAt: parsed.updatedAt || Date.now(), data: parsed.data || {} }));
          return json(env, { ok: true });
        }
        const raw = await env.DASH_KV.get('shared_settings');
        return json(env, raw ? JSON.parse(raw) : { updatedAt: 0, data: null });
      }
      return json(env, { error: 'Ukendt' }, 404);
    } catch (e) {
      return json(env, { error: e.message }, 500);
    }
  }
};
