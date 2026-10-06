/* Вход через Discord, по почте с паролем и (если заданы ключи) через Google. Без внешних пакетов: OAuth 2.0 (код авторизации) и подписанная кука сессии.
   Провайдер включается, когда заданы его CLIENT_ID и CLIENT_SECRET. Адреса провайдеров можно переопределить
   переменными окружения, на этом держатся автотесты (поддельный провайдер на localhost). */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { looksGuest } = require('../public/shared/hub.js');

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
  // Аккаунты по почте: почта, соль и хэш пароля (scrypt). Писем сайт не отправляет, сброс пароля делает админ.
  const ACCOUNTS = path.join(dataDir, 'accounts.json');
  let accounts = Object.create(null);
  try { Object.assign(accounts, JSON.parse(fs.readFileSync(ACCOUNTS, 'utf8'))); } catch (e) { /* ещё нет */ }
  const byId = new Map(Object.entries(accounts).map(([mail, a]) => [a.id, mail]));
  const saveAccounts = () => {
    try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(ACCOUNTS + '.tmp', JSON.stringify(accounts), { mode: 0o600 }); fs.renameSync(ACCOUNTS + '.tmp', ACCOUNTS); } catch (e) { console.error('accounts', e.message); }
  };
  const cleanMail = (v) => { const m = String(typeof v === 'string' ? v : '').trim().toLowerCase(); return m.length <= 200 && /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(m) ? m : null; };
  const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const hashPass = (pass, salt) => new Promise((ok, no) => crypto.scrypt(String(pass), Buffer.from(salt, 'hex'), 64, SCRYPT, (e, k) => (e ? no(e) : ok(k.toString('hex')))));
  // Хэш пароля дорогой (16 МБ памяти и заметное время), поэтому одновременно считаем немного,
  // а с одного адреса не больше двух сразу: иначе волна запросов на вход положит сервер.
  const HASH_MAX = 6, busy = new Map();
  let hashing = 0;
  async function gated(ip, fn) {
    const mine = busy.get(ip) || 0;
    if (hashing >= HASH_MAX || mine >= 2) return null;
    hashing++; busy.set(ip, mine + 1);
    try { return await fn(); } finally {
      hashing--; const m = (busy.get(ip) || 1) - 1; if (m > 0) busy.set(ip, m); else busy.delete(ip);
    }
  }
  const BUSY = { ok: false, error: 'Сервер занят, попробуйте ещё раз через пару секунд.' };
  const passOk = (v) => typeof v === 'string' && v.length >= 8 && v.length <= 128;
  // Подбор пароля: не больше 10 ошибок за 15 минут с одного адреса и на одну почту.
  const fails = new Map();
  const FAIL_WINDOW = 15 * 60e3, FAIL_MAX = 10;
  const locked = (k) => { const r = fails.get(k); if (!r) return false; if (Date.now() - r.first > FAIL_WINDOW) { fails.delete(k); return false; } return r.n >= FAIL_MAX; };
  const failed = (k) => { const r = fails.get(k); if (!r || Date.now() - r.first > FAIL_WINDOW) fails.set(k, { n: 1, first: Date.now() }); else r.n++; };
  // Регистрации: не больше 5 в час с одного адреса.
  const regs = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, r] of fails) if (now - r.first > FAIL_WINDOW) fails.delete(k);
    for (const [k, r] of regs) if (now - r.first > 3600e3) regs.delete(k);
  }, 10 * 60e3).unref();
  const regLimited = (ip) => { const r = regs.get(ip); if (!r || Date.now() - r.first > 3600e3) { regs.set(ip, { n: 1, first: Date.now() }); return false; } r.n++; return r.n > 5; };

  // Учёт аккаунтов для админки: кто и когда впервые вошёл, когда заходил последний раз.
  const USERS = path.join(dataDir, 'users.json');
  let users = Object.create(null);
  try { Object.assign(users, JSON.parse(fs.readFileSync(USERS, 'utf8'))); } catch (e) { /* ещё нет */ }
  let usersDirty = false;
  const saveUsers = () => {
    if (!usersDirty) return; usersDirty = false;
    try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(USERS + '.tmp', JSON.stringify(users)); fs.renameSync(USERS + '.tmp', USERS); } catch (e) { console.error('users', e.message); }
  };
  setInterval(saveUsers, 10e3).unref();
  /** Отметить аккаунт: первый вход создаёт запись, следующие обновляют время и имя. */
  function touchUser(id, provider, name, at = Date.now()) {
    const u = users[id];
    if (!u) users[id] = { p: provider, n: String(name || '').slice(0, 40), first: at, last: at };
    else { if (at - u.last < 60e3 && u.n === name) return; u.last = Math.max(u.last, at); if (name) u.n = String(name).slice(0, 40); }
    usersDirty = true;
  }
  // Аккаунты по почте, заведённые до появления учёта.
  Object.entries(accounts).forEach(([, a]) => { if (!users['email:' + a.id]) touchUser('email:' + a.id, 'email', a.name, a.at || Date.now()); });

  /** Имя для игры: без невидимых символов, 2–18 знаков, без служебных слов. */
  const cleanName = (v) => {
    const n = String(typeof v === 'string' ? v : '').replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 18);
    if (n.length < 2 || /^(__proto__|constructor|prototype)$/i.test(n) || looksGuest(n)) return null;
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
    if (s.p === 'email') {
      // Пароль сменили или сбросили: старые входы больше не действуют.
      const mail = byId.get(s.id), a = mail && accounts[mail];
      if (!a || a.v !== s.v) return null;
    }
    const id = `${s.p}:${s.id}`;
    const own = profiles[id];
    // Имя из Discord чистим так же, как заданное вручную: без невидимых символов и не под гостя.
    return { provider: s.p, id, name: own || cleanName(s.n) || 'Игрок', providerName: String(s.n || '').replace(/[\p{C}]/gu, '').slice(0, 40), custom: !!own, avatar: String(s.a || '') };
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
        contact: env('CONTACT_EMAIL', 'support@detective-game.org'),
        providers: { discord: !!(cfg.discord.id && cfg.discord.secret), google: !!(cfg.google.id && cfg.google.secret), email: true, dev },
      });
    });

    // Профиль: игрок сам задаёт имя для игры, даже если вошёл через Discord или Google.
    app.post('/api/profile', require('express').json({ limit: '2kb' }), (req, res) => {
      res.set('Cache-Control', 'no-store');
      const origin = req.get('origin');
      if (origin && origin !== baseUrl(req)) return res.status(403).json({ ok: false });
      const acc = accountFrom(req.headers.cookie);
      if (!acc) return res.status(401).json({ ok: false, error: 'Сначала войдите.' });
      const body = req.body || {};
      if (body.reset === true) { delete profiles[acc.id]; saveProfiles(); return res.json({ ok: true, name: acc.providerName }); }
      const name = cleanName(body.name);
      if (!name) return res.status(400).json({ ok: false, error: 'Имя от 2 до 18 знаков.' });
      profiles[acc.id] = name;
      saveProfiles();
      res.json({ ok: true, name });
    });

    /* ---------- Вход по почте ---------- */
    const json = require('express').json({ limit: '2kb' });
    const sameSite = (req, res) => { const o = req.get('origin'); if (o && o !== baseUrl(req)) { res.status(403).json({ ok: false, error: 'Запрос не с сайта игры.' }); return false; } res.set('Cache-Control', 'no-store'); return true; };
    const startSession = (req, res, a) => {
      touchUser('email:' + a.id, 'email', profiles['email:' + a.id] || a.name);
      res.set('Set-Cookie', cookie(SESSION_COOKIE, pack({ p: 'email', id: a.id, n: a.name, a: '', v: a.v, exp: Date.now() + SESSION_DAYS * 864e5 }), { maxAge: SESSION_DAYS * 86400, secure: isHttps(req) }));
    };

    app.post('/auth/email/register', json, async (req, res) => {
      if (!sameSite(req, res)) return;
      const b = req.body || {};
      const mail = cleanMail(b.email), name = cleanName(b.name);
      if (!mail) return res.status(400).json({ ok: false, field: 'email', error: 'Проверьте почту.' });
      if (!passOk(b.password)) return res.status(400).json({ ok: false, field: 'password', error: 'Пароль от 8 до 128 знаков.' });
      if (!name) return res.status(400).json({ ok: false, field: 'name', error: 'Имя в игре от 2 до 18 знаков.' });
      if (accounts[mail]) return res.status(409).json({ ok: false, field: 'email', error: 'Эта почта уже зарегистрирована. Войдите.' });
      if (regLimited(req.ip)) return res.status(429).json({ ok: false, error: 'Слишком много регистраций. Попробуйте через час.' });
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await gated(req.ip, () => hashPass(b.password, salt));
      if (!hash) return res.status(503).json(BUSY);
      const a = { id: crypto.randomBytes(12).toString('hex'), name, salt, hash, v: 1, at: Date.now() };
      if (accounts[mail]) return res.status(409).json({ ok: false, field: 'email', error: 'Эта почта уже зарегистрирована. Войдите.' });
      accounts[mail] = a; byId.set(a.id, mail); saveAccounts();
      startSession(req, res, a);
      res.json({ ok: true });
    });

    app.post('/auth/email/login', json, async (req, res) => {
      if (!sameSite(req, res)) return;
      const b = req.body || {};
      const mail = cleanMail(b.email);
      if (locked('ip:' + req.ip) || (mail && locked('mail:' + mail))) return res.status(429).json({ ok: false, error: 'Слишком много попыток. Попробуйте через 15 минут.' });
      const a = mail && accounts[mail];
      // Без аккаунта считаем хэш впустую, чтобы по времени ответа нельзя было узнать, есть ли такая почта.
      const got = await gated(req.ip, () => hashPass(typeof b.password === 'string' ? b.password.slice(0, 128) : '', a ? a.salt : '00'.repeat(16)));
      if (!got) return res.status(503).json(BUSY);
      const good = !!a && crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(a.hash, 'hex'));
      if (!good) { failed('ip:' + req.ip); if (mail) failed('mail:' + mail); return res.status(401).json({ ok: false, error: 'Неверная почта или пароль.' }); }
      startSession(req, res, a);
      res.json({ ok: true });
    });

    // Смена пароля из личного кабинета: нужен старый пароль, остальные входы сбрасываются.
    app.post('/auth/email/password', json, async (req, res) => {
      if (!sameSite(req, res)) return;
      const acc = accountFrom(req.headers.cookie);
      if (!acc || acc.provider !== 'email') return res.status(401).json({ ok: false, error: 'Сначала войдите по почте.' });
      const mail = byId.get(acc.id.slice(6)), a = accounts[mail];
      const b = req.body || {};
      if (locked('mail:' + mail)) return res.status(429).json({ ok: false, error: 'Слишком много попыток. Попробуйте через 15 минут.' });
      const got = await gated(req.ip, () => hashPass(typeof b.old === 'string' ? b.old.slice(0, 128) : '', a.salt));
      if (!got) return res.status(503).json(BUSY);
      if (!crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(a.hash, 'hex'))) { failed('mail:' + mail); return res.status(401).json({ ok: false, field: 'old', error: 'Старый пароль не подошёл.' }); }
      if (!passOk(b.password)) return res.status(400).json({ ok: false, field: 'password', error: 'Новый пароль от 8 до 128 знаков.' });
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await gated(req.ip, () => hashPass(b.password, salt));
      if (!hash) return res.status(503).json(BUSY);
      a.salt = salt; a.hash = hash; a.v += 1; saveAccounts();
      startSession(req, res, a);
      res.json({ ok: true });
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
        touchUser(`${name}:${prof.id.slice(0, 64)}`, name, profiles[`${name}:${prof.id.slice(0, 64)}`] || prof.name);
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

  /** Для админки: новый временный пароль игроку, который забыл свой. Все его входы сбрасываются. */
  async function resetPassword(email) {
    const mail = cleanMail(email), a = mail && accounts[mail];
    if (!a) return null;
    const temp = crypto.randomBytes(9).toString('base64url');
    a.salt = crypto.randomBytes(16).toString('hex'); a.hash = await hashPass(temp, a.salt); a.v += 1; saveAccounts();
    return { email: mail, name: a.name, password: temp };
  }

  /** Для админки: сколько аккаунтов и последние регистрации. Почта видна только у входа по почте. */
  function usersSummary(online = new Set()) {
    const now = Date.now(), week = 7 * 864e5;
    const mailOf = new Map(Object.entries(accounts).map(([m, a]) => ['email:' + a.id, m]));
    const list = Object.entries(users).filter(([id]) => !id.startsWith('dev:'));
    const by = {};
    list.forEach(([, u]) => { by[u.p] = (by[u.p] || 0) + 1; });
    const rows = list.sort((a, b) => b[1].first - a[1].first).slice(0, 50).map(([id, u]) => ({
      name: profiles[id] || u.n, provider: u.p, email: mailOf.get(id) || '', first: u.first, last: u.last, online: online.has(id),
    }));
    return {
      total: list.length, byProvider: by,
      new7: list.filter(([, u]) => now - u.first < week).length,
      active7: list.filter(([, u]) => now - u.last < week).length,
      online: list.filter(([id]) => online.has(id)).length,
      rows,
    };
  }

  return { mount, accountFrom, tokenFor, describe, enabled, parseCookies, resetPassword, touchUser, usersSummary, flushUsers: () => { usersDirty = true; saveUsers(); } };
}

module.exports = { createAuth };
