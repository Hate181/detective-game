/* Защита сервера: заголовки браузеру, лимиты на подключения и действия, перебор пароля админки.
   Всё живёт в памяти процесса: сервер у игры один. */

// Сколько прокси стоит перед сервером (у Render, Railway и Fly один). Нужно, чтобы видеть настоящий IP игрока.
const PROXY_HOPS = Number.isFinite(Number(process.env.TRUST_PROXY_HOPS)) && process.env.TRUST_PROXY_HOPS !== '' ? Number(process.env.TRUST_PROXY_HOPS) : 1;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const HTTPS = PUBLIC_URL.startsWith('https://');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://cdn.discordapp.com https://*.googleusercontent.com",
  `connect-src 'self'${PUBLIC_URL ? ' ' + PUBLIC_URL.replace(/^http/, 'ws') : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function headers(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  if (HTTPS) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

/** IP игрока: с учётом прокси хостинга, без доверия к тому, что клиент сам дописал в X-Forwarded-For. */
function ipOf(socket) {
  const hs = socket.handshake;
  const list = String(hs.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (PROXY_HOPS > 0 && list.length >= PROXY_HOPS) return list[list.length - PROXY_HOPS];
  return hs.address || 'unknown';
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const validGuestToken = (t) => typeof t === 'string' && TOKEN_RE.test(t) && !t.startsWith('acc-');

// Подключения с одного IP: компания за одним роутером это до 10 человек с парой вкладок.
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP) || 30;
const conns = new Map();
function connectionGuard(socket, next) {
  const ip = ipOf(socket);
  const n = conns.get(ip) || 0;
  if (n >= MAX_CONN_PER_IP) return next(new Error('too_many_connections'));
  conns.set(ip, n + 1);
  socket.once('disconnect', () => { const m = (conns.get(ip) || 1) - 1; if (m > 0) conns.set(ip, m); else conns.delete(ip); });
  next();
}

/** Ведро токенов на сокет: 10 действий в секунду, всплеск до 30. */
function eventLimiter(rate = 10, burst = 30) {
  let tokens = burst, last = Date.now(), strikes = 0;
  const take = () => {
    const now = Date.now();
    tokens = Math.min(burst, tokens + ((now - last) / 1000) * rate);
    last = now;
    if (tokens < 1) { strikes++; return false; }
    tokens -= 1;
    strikes = Math.max(0, strikes - 1);
    return true;
  };
  take.strikes = () => strikes;
  return take;
}

/** Запрос пришёл со страницы самой игры. Без Origin это не браузер, и чужих кук у него нет. */
function sameOrigin(origin, host) {
  if (!origin) return true;
  let o;
  try { o = new URL(origin); } catch (e) { return false; }
  if (PUBLIC_URL && o.origin === new URL(PUBLIC_URL).origin) return true;
  return !!host && o.host === host;
}
// Сокет открывается с куками входа, поэтому чужой сайт не должен его открыть от имени игрока.
const allowSocket = (req, cb) => cb(null, sameOrigin(req.headers.origin, req.headers.host));

/** Все запросы к сайту с одного IP: 600 за 10 минут. Страница игры это около 20 файлов,
    так что компании за одним роутером хватает с запасом, а выкачать гигабайты трафика (за него платим) не выйдет. */
const HTTP_WINDOW = 10 * 60e3, HTTP_MAX = Number(process.env.HTTP_PER_IP) || 600;
const hits = new Map();
function httpLimit(req, res, next) {
  if (req.path === '/healthz') return next();
  const now = Date.now(), ip = req.ip || 'unknown';
  const r = hits.get(ip);
  if (!r || now - r.first > HTTP_WINDOW) hits.set(ip, { n: 1, first: now });
  else if (++r.n > HTTP_MAX) { res.set('Retry-After', '600'); return res.status(429).type('text/plain; charset=utf-8').send('Слишком много запросов. Попробуйте через 10 минут.'); }
  next();
}

/** Лимит на запросы входа, регистрации и профиля: 30 в минуту с одного IP. */
const posts = new Map();
function postLimit(req, res, next) {
  if (req.method !== 'POST') return next();
  const now = Date.now(), ip = req.ip || 'unknown';
  const r = posts.get(ip);
  if (!r || now - r.first > 60e3) posts.set(ip, { n: 1, first: now });
  else if (++r.n > 30) return res.status(429).json({ ok: false, error: 'Слишком много запросов. Подождите минуту.' });
  next();
}

// Комнаты с одного IP: не больше 3 открытых сразу и 10 новых за 10 минут.
// Иначе скрипт за секунды займёт все комнаты сервера, и никто не сможет создать свою.
// Код комнаты угадывать тоже не дадим: 30 промахов за 10 минут, и вход по коду закрыт.
const ROOM_WINDOW = 10 * 60e3, ROOMS_LIVE = Number(process.env.ROOMS_PER_IP) || 3, ROOMS_NEW = Number(process.env.ROOMS_NEW_PER_IP) || 10, JOIN_MISSES = 30;
const roomsByIp = new Map(); // ip → { codes: [{code, t}] }
const joinMiss = new Map();  // ip → { n, first }
function roomGuard(ip, event, hub) {
  const now = Date.now();
  if (event === 'room:join') {
    const m = joinMiss.get(ip);
    if (m && now - m.first < ROOM_WINDOW && m.n >= JOIN_MISSES) return 'Слишком много неверных кодов. Попробуйте через 10 минут.';
    return null;
  }
  const r = roomsByIp.get(ip);
  if (!r) return null;
  r.codes = r.codes.filter((c) => hub.rooms.has(c.code) || now - c.t < ROOM_WINDOW);
  const live = r.codes.filter((c) => hub.rooms.has(c.code)).length;
  if (live >= ROOMS_LIVE) return 'С вашего адреса уже открыто несколько комнат. Закройте одну из них.';
  if (r.codes.filter((c) => now - c.t < ROOM_WINDOW).length >= ROOMS_NEW) return 'Слишком много новых комнат подряд. Попробуйте через 10 минут.';
  return null;
}
function roomCreated(ip, code) {
  const r = roomsByIp.get(ip) || { codes: [] };
  r.codes.push({ code, t: Date.now() });
  roomsByIp.set(ip, r);
}
function joinMissed(ip) {
  const now = Date.now(), m = joinMiss.get(ip);
  if (!m || now - m.first > ROOM_WINDOW) joinMiss.set(ip, { n: 1, first: now }); else m.n++;
}

// Действия со всех сокетов одного IP вместе: 30 в секунду, всплеск до 90. Компании из 10 человек хватает,
// а 30 вкладок одного человека не умножат лимит в 30 раз.
const ipBuckets = new Map();
function ipEventOk(ip) {
  let b = ipBuckets.get(ip);
  if (!b) { b = eventLimiter(30, 90); ipBuckets.set(ip, b); }
  b.seen = Date.now();
  return b();
}

// Пароль админки: 5 неверных попыток с одного IP, и вход закрыт на 15 минут.
const adminFails = new Map();
const ADMIN_WINDOW = 15 * 60 * 1000, ADMIN_MAX = 5;
function adminLocked(ip) {
  const r = adminFails.get(ip);
  if (!r) return false;
  if (Date.now() - r.first > ADMIN_WINDOW) { adminFails.delete(ip); return false; }
  return r.n >= ADMIN_MAX;
}
function adminFailed(ip) {
  const r = adminFails.get(ip);
  if (!r || Date.now() - r.first > ADMIN_WINDOW) adminFails.set(ip, { n: 1, first: Date.now() });
  else r.n++;
}

// Старые записи счётчиков чистим, чтобы память не росла от множества адресов.
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of posts) if (now - r.first > 60e3) posts.delete(k);
  for (const [k, r] of hits) if (now - r.first > HTTP_WINDOW) hits.delete(k);
  for (const [k, b] of ipBuckets) if (now - b.seen > 60e3) ipBuckets.delete(k);
  for (const [k, r] of adminFails) if (now - r.first > ADMIN_WINDOW) adminFails.delete(k);
  for (const [k, r] of joinMiss) if (now - r.first > ROOM_WINDOW) joinMiss.delete(k);
  for (const [k, r] of roomsByIp) if (r.codes.every((c) => now - c.t > 6 * 3600e3)) roomsByIp.delete(k);
}, 5 * 60e3).unref();

module.exports = { ipEventOk, httpLimit, roomGuard, roomCreated, joinMissed, sameOrigin, allowSocket, postLimit, PROXY_HOPS, headers, ipOf, validGuestToken, connectionGuard, eventLimiter, adminLocked, adminFailed, CSP };
