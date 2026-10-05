/* Вход через Discord и Google. Без внешних пакетов: OAuth 2.0 (код авторизации) и подписанная кука сессии.
   Провайдер включается, когда заданы его CLIENT_ID и CLIENT_SECRET. Адреса провайдеров можно переопределить
   переменными окружения, на этом держатся автотесты (поддельный провайдер на localhost). */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSION_COOKIE = 'd_sess';
const STATE_COOKIE = 'd_oauth';
const SESSION_DAYS = 30;

const env = (k, d) => (process.env[k] != null && process.env[k] !== '' ? process.env[k] : d);

function providers() {
  return {
    discord: {
      label: 'Discord',
      id: env('DISCORD_CLIENT_ID'), secret: env('DISCORD_CLIENT_SECRET'),
      authUrl: env('DISCORD_AUTH_URL', 'https://discord.com/oauth2/authorize'),
      tokenUrl: env('DISCORD_TOKEN_URL', 'https://discord.com/api/oauth2/token'),
      userUrl: env('DISCORD_USER_URL', 'https://discord.com/api/users/@me'),
      scope: 'identify',
      profile: (u) => ({
        id: String(u.id), name: u.global_name || u.username || 'Игрок Discord',
        avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : '',
      }),
    },
    google: {
      label: 'Google',
      id: env('GOOGLE_CLIENT_ID'), secret: env('GOOGLE_CLIENT_SECRET'),
      authUrl: env('GOOGLE_AUTH_URL', 'https://accounts.google.com/o/oauth2/v2/auth'),
      tokenUrl: env('GOOGLE_TOKEN_URL', 'https://oauth2.googleapis.com/token'),
      userUrl: env('GOOGLE_USER_URL', 'https://openidconnect.googleapis.com/v1/userinfo'),
      scope: 'openid profile',
      profile: (u) => ({ id: String(u.sub), name: u.name || u.given_name || 'Игрок Google', avatar: u.picture || '' }),
    },
  };
}

function createAuth({ dataDir, port }) {
  const cfg = providers();
  const dev = env('AUTH_DEV') === '1' && env('NODE_ENV') !== 'production';

  // Ключ подписи сессий живёт в DATA_DIR, чтобы входы переживали перезапуск сервера.
  let secret = env('SESSION_SECRET');
  if (!secret) {
    const file = path.join(dataDir, 'session.key');
    try { secret = fs.readFileSync(file, 'utf8').trim(); } catch (e) { /* ещё нет */ }
    if (!secret) {
      secret = crypto.randomBytes(32).toString('hex');
      try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file, secret, { mode: 0o600 }); } catch (e) { /* только в памяти */ }
    }
  }

  // Имена, которые игроки сами задали в профиле: по аккаунту, одинаковые на всех устройствах.
  const PROFILES = path.join(dataDir, 'profiles.json');
  let profiles = Object.create(null);
  try { Object.assign(profiles, JSON.parse(fs.readFileSync(PROFILES, 'utf8'))); } catch (e) { /* ещё нет */ }
  const saveProfiles = () => {
    try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(PROFILES + '.tmp', JSON.stringify(profiles)); fs.renameSync(PROFILES + '.tmp', PROFILES); } catch (e) { console.error('profiles', e.message); }
  };
  /** Имя для игры: без невидимых символов, 2–18 знаков, без служебных слов. */
  const cleanName = (v) => {
    const n = String(typeof v === 'string' ? v : '').replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 18);
    if (n.length < 2 || /^(__proto__|constructor|prototype)$/i.test(n)) return null;
    return n;
  };

  const b64 = (s) => Buffer.from(s).toString('base64url');
  const sign = (s) => crypto.createHmac('sha256', secret).update(s).digest('base64url');
  const pack = (obj) => { const body = b64(JSON.stringify(obj)); return `${body}.${sign(body)}`; };
  const unpack = (str) => {
    const [body, sig] = String(str || '').split('.');
    if (!body || !sig) return null;
    const a = Buffer.from(sig), b = Buffer.from(sign(body));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
  };
  const parseCookies = (header) => {
    const out = {};
    String(header || '').split(';').forEach((part) => {
      const i = part.indexOf('=');
      if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { /* битая кука */ } }
    });
    return out;
  };
  const cookie = (name, value, { maxAge, secure }) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}${maxAge != null ? `; Max-Age=${maxAge}` : ''}`;

  /** Аккаунт из заголовка Cookie (запрос или рукопожатие сокета). */
  function accountFrom(cookieHeader) {
    const s = unpack(parseCookies(cookieHeader)[SESSION_COOKIE]);
    if (!s || !s.p || !s.id || !s.exp || s.exp < Date.now()) return null;
    const id = `${s.p}:${s.id}`;
    const own = profiles[id];
    return { provider: s.p, id, name: own || String(s.n || '').slice(0, 40), providerName: String(s.n || '').slice(0, 40), custom: !!own, avatar: String(s.a || '') };
  }
  /** Постоянный токен в хабе для аккаунта: один и тот же на любом устройстве. */
  // Подписан секретом сервера: по публичному ID в Discord или Google токен не вычислить.
  const tokenFor = (account) => 'acc-' + crypto.createHmac('sha256', secret).update('hub:' + account.id).digest('hex').slice(0, 32);

  const baseUrl = (req) => (env('PUBLIC_URL') ? env('PUBLIC_URL').replace(/\/+$/, '') : `${req.protocol}://${req.get('host')}`);
  const isHttps = (req) => baseUrl(req).startsWith('https://');
  const redirectUri = (req, p) => `${baseUrl(req)}/auth/${p}/callback`;
  const enabled = () => Object.keys(cfg).filter((k) => cfg[k].id && cfg[k].secret);

  async function postForm(url, params) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams(params), signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`token ${r.status}`);
    return r.json();
  }

  function mount(app) {
    app.get('/api/me', (req, res) => {
      res.set('Cache-Control', 'no-store');
      const acc = accountFrom(req.headers.cookie);
      res.json({
        account: acc ? { provider: acc.provider, name: acc.name, providerName: acc.providerName, custom: acc.custom, avatar: acc.avatar } : null,
        community: env('DISCORD_SERVER_URL', 'https://discord.gg/hfWsKkGVH'),
        contact: env('CONTACT_EMAIL', 'detective-platform-ops@proton.me'),
        providers: { discord: !!(cfg.discord.id && cfg.discord.secret), google: !!(cfg.google.id && cfg.google.secret), dev },
      });
    });

    // Профиль: игрок сам задаёт имя для игры, даже если вошёл через Discord или Google.
    app.post('/api/profile', require('express').json({ limit: '2kb' }), (req, res) => {
      res.set('Cache-Control', 'no-store');
      const origin = req.get('origin');
      if (origin && origin !== baseUrl(req)) return res.status(403).json({ ok: false });
      const acc = accountFrom(req.headers.cookie);
      if (!acc) return res.status(401).json({ ok: false, error: 'Войдите через Discord или Google.' });
      const body = req.body || {};
      if (body.reset === true) { delete profiles[acc.id]; saveProfiles(); return res.json({ ok: true, name: acc.providerName }); }
      const name = cleanName(body.name);
      if (!name) return res.status(400).json({ ok: false, error: 'Имя от 2 до 18 знаков.' });
      profiles[acc.id] = name;
      saveProfiles();
      res.json({ ok: true, name });
    });

    app.post('/auth/logout', (req, res) => {
      // Выйти можно только со своего сайта: чужая страница не разлогинит игрока.
      const origin = req.get('origin');
      if (origin && origin !== baseUrl(req)) return res.status(403).json({ ok: false });
      res.set('Set-Cookie', cookie(SESSION_COOKIE, '', { maxAge: 0, secure: isHttps(req) }));
      res.json({ ok: true });
    });

    if (dev) {
      // Только для проверок: вход под любым именем без внешнего провайдера.
      app.get('/auth/dev', (req, res) => {
        const name = String(req.query.name || 'Тест').slice(0, 24);
        const id = String(req.query.id || name).replace(/[^\w.\-]/g, '').slice(0, 40) || 'test';
        res.set('Set-Cookie', cookie(SESSION_COOKIE, pack({ p: 'dev', id, n: name, a: '', exp: Date.now() + SESSION_DAYS * 864e5 }), { maxAge: SESSION_DAYS * 86400, secure: false }));
        res.redirect('/');
      });
    }

    app.get('/auth/:provider', (req, res) => {
      const p = cfg[req.params.provider];
      if (!p || !p.id || !p.secret) return res.redirect('/?auth=off');
      const state = crypto.randomBytes(16).toString('hex');
      res.set('Set-Cookie', cookie(STATE_COOKIE, pack({ p: req.params.provider, s: state, exp: Date.now() + 10 * 60e3 }), { maxAge: 600, secure: isHttps(req) }));
      const q = new URLSearchParams({ client_id: p.id, redirect_uri: redirectUri(req, req.params.provider), response_type: 'code', scope: p.scope, state });
      if (req.params.provider === 'google') q.set('prompt', 'select_account');
      res.redirect(`${p.authUrl}?${q}`);
    });

    app.get('/auth/:provider/callback', async (req, res) => {
      const name = req.params.provider, p = cfg[name];
      const back = (flag) => res.redirect(`/?auth=${flag}`);
      res.append('Set-Cookie', cookie(STATE_COOKIE, '', { maxAge: 0, secure: isHttps(req) }));
      if (!p || !p.id || !p.secret) return back('off');
      const st = unpack(parseCookies(req.headers.cookie)[STATE_COOKIE]);
      if (req.query.error) return back('cancel');
      if (!st || st.p !== name || st.exp < Date.now() || !req.query.state || st.s !== String(req.query.state) || !req.query.code) return back('fail');
      try {
        const tok = await postForm(p.tokenUrl, { client_id: p.id, client_secret: p.secret, grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: redirectUri(req, name) });
        if (!tok || typeof tok.access_token !== 'string') throw new Error('no token');
        const ur = await fetch(p.userUrl, { headers: { authorization: `Bearer ${tok.access_token}`, accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
        if (!ur.ok) throw new Error(`user ${ur.status}`);
        const prof = p.profile(await ur.json());
        if (!prof.id || prof.id === 'undefined') throw new Error('no id');
        res.append('Set-Cookie', cookie(SESSION_COOKIE, pack({ p: name, id: prof.id.slice(0, 64), n: String(prof.name).slice(0, 40), a: /^https:\/\//.test(prof.avatar) ? prof.avatar.slice(0, 300) : '', exp: Date.now() + SESSION_DAYS * 864e5 }), { maxAge: SESSION_DAYS * 86400, secure: isHttps(req) }));
        back('ok');
      } catch (e) {
        console.error('auth', name, e.message);
        back('fail');
      }
    });
  }

  function describe(req) {
    const list = enabled().map((k) => `${cfg[k].label}: ${redirectUri(req || { protocol: 'http', get: () => `localhost:${port}` }, k)}`);
    return { enabled: enabled(), redirects: list, dev };
  }

  return { mount, accountFrom, tokenFor, describe, enabled, parseCookies };
}

module.exports = { createAuth };
