// Защита сервера: заголовки, токены, имена, перебор пароля админки, лимит действий. Поднимает свой сервер.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const { Hub } = require('../public/shared/hub.js');
const Engine = require('../public/shared/engine.js');
const Cases = require('../public/shared/cases.js');

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };
const PORT = 3109, URL = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Без сервера: хаб и движок не ломаются от «особых» имён и действий.
{
  const stats = { season: null, players: {} };
  const hub = new Hub({ store: { getCases: () => Cases.CASES, saveCases() {}, getStats: () => stats, saveStats() {} } });
  for (const bad of ['__proto__', 'constructor', 'Prototype']) {
    const r = hub.handle('t-' + bad + '-xxxxxxxxxxxx', 'room:create', { name: bad });
    check(!r.ok, `имя «${bad}» не принимается`);
  }
  const r = hub.handle('tok-aaaaaaaaaaaaaaaa', 'room:create', { name: 'Ми​ра‮' });
  check(r.ok && hub.roomOf('tok-aaaaaaaaaaaaaaaa').players[0].name === 'Мира', 'невидимые символы из имени вырезаются');
  const j = hub.handle('tok-bbbbbbbbbbbbbbbb', 'room:join', { code: r.code, name: 'мира' });
  check(!j.ok && j.code === 'name_taken', 'второе такое же имя в комнате не пускают');
  check(Object.getPrototypeOf(hub._stats().players) === null, 'таблица сезона без прототипа');
  check(({}).name === undefined && ({}).games === undefined, 'прототип объектов не испорчен');
  const players = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
  const game = Engine.createGame({ caseData: Cases.CASES[0], players, seed: 3, now: 1000 });
  for (const a of ['__proto__', 'constructor', 'hasOwnProperty']) {
    let r = null;
    try { r = Engine.act(game, 'p0', a, {}, 2000); } catch (e) { r = { threw: e.message }; }
    check(r && r.ok === false && !r.threw, `действие «${a}» отклоняется без исключения`);
  }
  // В обычном режиме ключи совпадений с уликами не уходят в сеть
  for (const hints of ['normal', 'light']) {
    const g = Engine.createGame({ caseData: Cases.CASES[0], players, settings: { hints }, seed: 5, now: 1000 });
    g.players.p1.revealed.profession = true; g.players.p1.revealed.habit = true;
    const v = Engine.view(g, 'p0');
    const rev = v.players.find((x) => x.id === 'p1').revealed;
    const has = !!(rev.profession && rev.profession.tags) || !!(rev.habit && rev.habit.tags);
    check(hints === 'light' ? has : !has && rev.profession && rev.profession.text, `режим «${hints}»: ключи совпадений ${hints === 'light' ? 'видны' : 'скрыты'}`);
  }
  const hub2 = new Hub({ store: { getCases: () => Cases.CASES, saveCases() {}, getStats: () => null, saveStats() {} }, maxRooms: 2 });
  hub2.handle('tok-1111111111111111', 'room:create', { name: 'А' });
  hub2.handle('tok-2222222222222222', 'room:create', { name: 'Б' });
  const third = hub2.handle('tok-3333333333333333', 'room:create', { name: 'В' });
  check(!third.ok && third.code === 'busy', 'больше MAX_ROOMS комнат не открыть');
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'det-sec-'));
  const srv = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: dir, ADMIN_KEY: 'correct-horse-battery', NODE_ENV: '', AUTH_DEV: '' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50 && !log.includes('Detective:'); i++) await new Promise((r) => setTimeout(r, 100));

  try {
    const res = await fetch(URL + '/');
    const h = (k) => res.headers.get(k) || '';
    check(/script-src 'self'/.test(h('content-security-policy')) && /frame-ancestors 'none'/.test(h('content-security-policy')), 'CSP запрещает чужие скрипты и встраивание в рамку');
    check(h('x-content-type-options') === 'nosniff' && h('x-frame-options') === 'DENY' && !h('x-powered-by'), 'защитные заголовки на месте, Express не представляется');
    const hz = await (await fetch(URL + '/healthz')).json();
    check(hz.ok === true, '/healthz отвечает');
    const lo = await fetch(URL + '/auth/logout', { method: 'POST', headers: { origin: 'https://evil.example' } });
    check(lo.status === 403, 'чужой сайт не может разлогинить игрока');

    // Чужой сайт не может открыть сокет с куками игрока.
    const poll = (origin) => fetch(URL + '/socket.io/?EIO=4&transport=polling', { headers: origin ? { origin } : {} }).then((r) => r.status);
    check(await poll('https://evil.example') !== 200, 'сокет с чужого сайта не открывается');
    check(await poll(URL) === 200 && await poll(null) === 200, 'сокет со своего сайта открывается');
    const upgrade = (origin) => new Promise((resolve) => {
      const req = require('http').request({ host: 'localhost', port: PORT, path: '/socket.io/?EIO=4&transport=websocket', headers: { connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-version': '13', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', origin } });
      req.on('upgrade', (res, sock) => { sock.destroy(); resolve(101); });
      req.on('response', (res) => resolve(res.statusCode));
      req.on('error', () => resolve(0));
      req.end();
    });
    check(await upgrade('https://evil.example') !== 101, 'websocket с чужого сайта не открывается');
    check(await upgrade(URL) === 101, 'websocket со своего сайта открывается');
    // Волна запросов на вход: лимит по адресу, сервер не тратит память на сотни хэшей сразу.
    const wave = await Promise.all(Array.from({ length: 40 }, (_, i) => fetch(URL + '/auth/email/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `x${i}@example.com`, password: 'password' + i }) }).then((r) => r.status)));
    check(wave.filter((st) => st === 503 || st === 429).length >= 30, `волна входов гасится (${wave.filter((st) => st === 401).length} проверено из 40)`);

    const browser = await chromium.launch({ executablePath: CHROME });
    const page = await browser.newPage();
    await page.goto(URL + '/healthz');
    await page.addScriptTag({ url: URL + '/socket.io/socket.io.js' });
    const result = await page.evaluate(async () => {
      const connect = (token) => new Promise((resolve) => {
        const s = window.io({ auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
        const t = setTimeout(() => resolve({ s, ok: s.connected }), 1500);
        s.on('hello', () => { clearTimeout(t); resolve({ s, ok: true }); });
        s.on('disconnect', () => { clearTimeout(t); resolve({ s, ok: false }); });
      });
      const call = (s, ev, p) => new Promise((r) => s.timeout(3000).emit(ev, p, (err, res) => r(err ? { ok: false, timeout: true } : res)));
      const out = {};
      out.short = (await connect('abc')).ok;
      out.acc = (await connect('acc-' + 'a'.repeat(32))).ok;
      const good = await connect('a'.repeat(32));
      out.good = good.ok;
      out.badPayload = await call(good.s, 'room:create', 'строка');
      out.badEvent = await call(good.s, 'room:__proto__', {});
      const tries = [];
      for (let i = 0; i < 7; i++) tries.push((await call(good.s, 'admin:auth', { key: 'guess' + i })).error);
      out.lockedRight = await call(good.s, 'admin:auth', { key: 'correct-horse-battery' });
      out.tries = tries;
      out.weirdKey = await call(good.s, 'admin:auth', { key: { toString: 1 } });
      // Флуд комнатами с одного адреса
      out.rooms = [];
      for (let i = 0; i < 5; i++) { const c = await connect('room' + i + 'x'.repeat(20)); out.rooms.push(await call(c.s, 'room:create', {})); c.s.disconnect(); }
      // Перебор кодов комнат
      const guess = await connect('g'.repeat(32));
      out.joins = [];
      for (let i = 0; i < 32; i++) out.joins.push(await call(guess.s, 'room:join', { code: 'ZZZ' + String(i).padStart(2, '0') }));
      const spam = await connect('b'.repeat(32));
      const res = await Promise.all(Array.from({ length: 60 }, () => call(spam.s, 'stats:get', {})));
      out.rate = res.filter((r) => r && r.code === 'rate').length;
      return out;
    });
    check(result.short === false, 'короткий токен гостя отклоняется');
    check(result.acc === false, 'гость не может прикинуться аккаунтом (токен acc-…)');
    check(result.good === true, 'обычный гость подключается');
    check(result.badPayload && result.badPayload.ok === false, 'данные не того типа отклоняются');
    check(result.badEvent && result.badEvent.ok === false, 'служебные имена команд отклоняются');
    check(/Слишком много попыток/.test(result.tries[6] || '') && result.lockedRight.ok === false, 'после 5 неверных паролей вход в админку закрыт даже с верным');
    check(result.weirdKey && result.weirdKey.ok === false && !result.weirdKey.timeout, 'кривой пароль админки не роняет обработчик');
    check(result.rooms.slice(0, 3).every((r) => r.ok) && result.rooms.slice(3).every((r) => !r.ok && r.code === 'rate'), `с одного адреса не больше 3 комнат (${result.rooms.map((r) => r.ok ? 'ок' : r.code).join(', ')})`);
    check(result.joins[29].code !== 'rate' && result.joins[31].code === 'rate', 'перебор кодов комнат закрывается после 30 промахов');
    check(result.rate > 0, `лимит действий срабатывает (${result.rate} из 60 отклонено)`);
    await browser.close();
    check(!/uncaught|TypeError/i.test(log), 'в логе сервера нет падений');
  } catch (e) {
    fails++; console.log('ПРОВАЛ:', e.message);
  } finally {
    await new Promise((r) => { srv.once('exit', r); srv.kill(); });
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(fails ? `\nПровалов: ${fails}` : '\nЗащита в порядке.');
  process.exit(fails ? 1 : 0);
})();
