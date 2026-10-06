const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const { Hub, normalizeCode } = require('../public/shared/hub.js');
const Cases = require('../public/shared/cases.js');
const { createAuth } = require('./auth.js');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const PROD = process.env.NODE_ENV === 'production';
const security = require('./security.js');

// В боевом режиме не стартуем с небезопасными настройками.
if (PROD) {
  const problems = [];
  if (!process.env.ADMIN_KEY || process.env.ADMIN_KEY.length < 16) problems.push('ADMIN_KEY должен быть задан и не короче 16 символов');
  if (process.env.AUTH_DEV === '1') problems.push('AUTH_DEV=1 открывает вход под любым именем, в боевом режиме его включать нельзя');
  if (!/^https:\/\//.test(process.env.PUBLIC_URL || '')) problems.push('PUBLIC_URL должен начинаться с https://');
  if (problems.length) { console.error('Сервер не запущен:\n  ' + problems.join('\n  ')); process.exit(1); }
}

// Данные: дела и статистика лежат в JSON-файлах. При первом запуске дела берутся из встроенного архива.
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); } catch (e) { return fallback; } };
const writeJson = (file, data) => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const target = path.join(DATA_DIR, file);
  fs.writeFileSync(target + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(target + '.tmp', target);
};
const cases = readJson('cases.json', null) || JSON.parse(JSON.stringify(Cases.CASES));
{
  // В сохранённый архив добавляются новые встроенные дела; то, что админ удалил, остаётся удалённым.
  const seen = readJson('cases-seen.json', null);
  const rev = readJson('cases-rev.json', null);
  const m = Cases.mergeBuiltins(cases, seen || (fs.existsSync(path.join(DATA_DIR, 'cases.json')) ? Cases.LEGACY_IDS : Cases.CASES.map((c) => c.id)), rev && rev.textRev, rev && rev.packRev);
  if (m.added || !seen) writeJson('cases-seen.json', m.seen);
  if (m.added || m.refreshed || m.retired) writeJson('cases.json', cases);
  if (!rev || rev.textRev !== m.textRev || rev.packRev !== m.packRev) writeJson('cases-rev.json', { textRev: m.textRev, packRev: m.packRev });
}
let stats = readJson('stats.json', null);
const store = {
  getCases: () => cases,
  saveCases: () => writeJson('cases.json', cases),
  getStats: () => stats,
  saveStats: (s) => { stats = s; writeJson('stats.json', s); },
};

// Пароль админки. Если не задан, при старте генерируется и печатается в консоль.
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(6).toString('hex');
const keyOk = (k) => {
  const a = Buffer.from(String(k || '')), b = Buffer.from(ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', security.PROXY_HOPS);
app.use(security.headers);
app.use(['/auth', '/api'], security.postLimit);
const auth = createAuth({ dataDir: DATA_DIR, port: PORT });
auth.mount(app);
const server = http.createServer(app);
// Сообщения игры маленькие: 32 КБ с запасом хватает и редактору дел в админке.
const io = new Server(server, { cors: { origin: false }, allowRequest: security.allowSocket, maxHttpBufferSize: 64 * 1024, pingTimeout: 20000 });

app.get('/healthz', (req, res) => res.json({ ok: true, rooms: hub.rooms.size, sockets: io.engine.clientsCount, uptime: Math.round(process.uptime()) }));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  extensions: ['html'],
  setHeaders: (res, file) => { if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache'); },
}));
app.get('/api/cases', (req, res) => res.json(cases.filter((c) => c.enabled !== false)));
app.get('/r/:code', (req, res) => res.redirect(`/#/room/${normalizeCode(req.params.code)}`));
// Короткие адреса для правил и документов: открываются внутри приложения.
for (const page of ['rules', 'contacts', 'privacy', 'cookies']) app.get('/' + page, (req, res) => res.redirect(`/#/${page}`));

const hub = new Hub({
  store,
  maxRooms: Number(process.env.MAX_ROOMS) || 500,
  guestNames: true,
  onChange: (code, extra) => pushRoom(code, extra),
});

// Сокеты по токену игрока: рассылка затрагивает только тех, кто в комнате, а не всех подключённых.
const socketsOf = new Map();
const emitTo = (token, ev, data) => { const set = socketsOf.get(token); if (set) set.forEach((s) => s.emit(ev, data)); };

function pushRoom(code, extra = {}) {
  if (extra.kicked) emitTo(extra.kicked, 'room:kicked', {});
  if (extra.closed && extra.tokens) extra.tokens.forEach((t) => emitTo(t, extra.by && extra.by === t ? 'room:left' : 'room:kicked', extra.by && extra.by === t ? {} : { closed: true }));
  const room = hub.rooms.get(code);
  if (!room) return;
  const tokens = new Set(room.players.map((p) => p.token));
  for (const t of tokens) {
    if (!socketsOf.has(t) || t === extra.kicked) continue;
    const r = hub.roomOf(t);
    if (!r || r.code !== code) continue;
    const v = hub.view(t);
    if (v) emitTo(t, 'room:state', v);
  }
}

const OFFLINE_GRACE_MS = Number(process.env.OFFLINE_GRACE_MS || 8000);

io.use(security.connectionGuard);

io.on('connection', (socket) => {
  const guest = String((socket.handshake.auth && socket.handshake.auth.token) || '');
  // Токен гостя: случайная строка из браузера. Префикс acc- зарезервирован за аккаунтами.
  if (!security.validGuestToken(guest)) return socket.disconnect(true);
  // Вошедший игрок живёт под токеном аккаунта (одинаковым на всех устройствах), гость под токеном браузера.
  const account = auth.accountFrom(socket.handshake.headers.cookie);
  let token = guest;
  if (account) {
    token = auth.tokenFor(account);
    hub.setIdentity(token, account);
    auth.touchUser(account.id, account.provider, account.name);
    hub.migrate(guest, token);
  }
  socket.data.token = token;
  if (!socketsOf.has(token)) socketsOf.set(token, new Set());
  socketsOf.get(token).add(socket);
  hub.setConnected(token, true);
  const limit = security.eventLimiter();
  socket.emit('hello', { account: account ? { provider: account.provider, name: account.name } : null });
  const current = hub.view(token);
  if (current) socket.emit('room:state', current);

  socket.onAny((event, payload, ack) => {
    if (typeof ack !== 'function') return;
    try { onEvent(event, payload, ack); } catch (e) { console.error('event', event, e.message); ack({ ok: false, error: 'Что-то пошло не так.' }); }
  });

  function onEvent(event, payload, ack) {
    if (!limit()) {
      if (limit.strikes() > 50) socket.disconnect(true);
      return ack({ ok: false, code: 'rate', error: 'Слишком много действий подряд. Подождите секунду.' });
    }
    if (typeof event !== 'string' || !/^(room|game|stats|admin):[a-z_]{1,24}$/.test(event)) return ack({ ok: false, error: 'Неизвестная команда.' });
    if (payload != null && (typeof payload !== 'object' || Array.isArray(payload))) return ack({ ok: false, error: 'Неверные данные.' });
    if (event === 'admin:auth') {
      const ip = security.ipOf(socket);
      if (security.adminLocked(ip)) return ack({ ok: false, code: 'bad_key', error: 'Слишком много попыток. Попробуйте через 15 минут.' });
      const ok = !!payload && typeof payload.key === 'string' && keyOk(payload.key);
      if (ok) hub.setAdmin(token, true); else security.adminFailed(ip);
      return ack(ok ? { ok: true } : { ok: false, code: 'bad_key', error: 'Пароль не подошёл.' });
    }
    if (event === 'admin:users') {
      if (!hub.isAdmin(token)) return ack({ ok: false, error: 'Нужно войти в админку.' });
      const online = new Set([...socketsOf.keys()].map((t) => hub.identityOf(t)).filter(Boolean).map((a) => a.id));
      return ack(Object.assign({ ok: true }, auth.usersSummary(online)));
    }
    if (event === 'admin:reset_password') {
      // Писем сайт не шлёт: забывшему пароль админ выдаёт временный, игрок меняет его в кабинете.
      if (!hub.isAdmin(token)) return ack({ ok: false, error: 'Нужно войти в админку.' });
      return auth.resetPassword(payload && payload.email).then((r) => ack(r ? Object.assign({ ok: true }, r) : { ok: false, error: 'Такой почты среди аккаунтов нет.' }), () => ack({ ok: false, error: 'Не получилось.' }));
    }
    // Комнаты и вход по коду: лимиты по IP, а не по сокету, иначе переподключение их обнуляет.
    if (event === 'room:create' || event === 'room:join') {
      const blocked = security.roomGuard(security.ipOf(socket), event, hub);
      if (blocked) return ack({ ok: false, code: 'rate', error: blocked });
    }
    const res = hub.handle(token, event, payload || {});
    if (event === 'room:create' && res.ok) security.roomCreated(security.ipOf(socket), res.code);
    if (event === 'room:join' && !res.ok && (res.code === 'not_found' || res.code === 'in_progress')) security.joinMissed(security.ipOf(socket));
    if (res.ok && event === 'room:leave') socket.emit('room:left');
    ack(res);
  }

  socket.on('disconnect', () => {
    const set = socketsOf.get(token);
    if (set) { set.delete(socket); if (!set.size) socketsOf.delete(token); }
    // Короткий обрыв (телефон свернули, сеть мигнула) не показываем: «нет связи» только если игрок не вернулся за несколько секунд.
    if (!socketsOf.has(token)) setTimeout(() => { if (!socketsOf.has(token)) hub.setConnected(token, false); }, OFFLINE_GRACE_MS);
  });
});

setInterval(() => { try { hub.tick(); } catch (e) { console.error('tick', e); } }, 400);
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));
// Перезапуск на хостинге: перестаём принимать новых и закрываемся аккуратно.
process.on('SIGTERM', () => { console.log('SIGTERM: завершаю работу'); auth.flushUsers(); io.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); });

server.listen(PORT, () => {
  console.log(`Detective: http://localhost:${PORT}`);
  const a = auth.describe();
  console.log(`Вход: по почте${a.enabled.length ? ', ' + a.enabled.join(', ') + '. Адреса возврата, которые нужно внести у провайдера:\n  ' + a.redirects.join('\n  ') : '. Discord выключен: не заданы DISCORD_CLIENT_ID/SECRET.'}`);
  if (a.dev) console.log('ВНИМАНИЕ: AUTH_DEV=1, вход под любым именем открыт. Только для проверок.');
  console.log(`Админка: http://localhost:${PORT}/#/admin  пароль: ${process.env.ADMIN_KEY ? '(из ADMIN_KEY)' : ADMIN_KEY}`);
});
