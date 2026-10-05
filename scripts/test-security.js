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
    check(result.rate > 0, `лимит действий срабатывает (${result.rate} из 60 отклонено)`);
    await browser.close();
    check(!/uncaught|TypeError/i.test(log), 'в логе сервера нет падений');
  } catch (e) {
    fails++; console.log('ПРОВАЛ:', e.message);
  } finally {
    srv.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(fails ? `\nПровалов: ${fails}` : '\nЗащита в порядке.');
  process.exit(fails ? 1 : 0);
})();
