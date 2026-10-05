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

module.exports = { PROXY_HOPS, headers, ipOf, validGuestToken, connectionGuard, eventLimiter, adminLocked, adminFailed, CSP };
