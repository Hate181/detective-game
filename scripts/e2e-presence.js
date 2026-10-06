// Возврат в игру в браузере: гость и аккаунт, «Вы в игре», выход, закрытие комнаты ведущим.
// Нужен сервер с AUTH_DEV=1:  AUTH_DEV=1 ./scripts/dev.sh
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.URL || 'http://localhost:3000';
const TAG = process.env.TAG || 'pr';
const NAMES = ['Анна', 'Борис', 'Вера', 'Глеб', 'Мира', 'Егор'];
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const open = async (viewport = { width: 1280, height: 860 }) => {
    const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TOO_MANY_RETRIES|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push(e.message));
    return { ctx, p };
  };
  const ctxs = [];
  for (let i = 0; i < 6; i++) ctxs.push(await open(i === 3 ? { width: 390, height: 844 } : undefined));
  const pages = ctxs.map((c) => c.p);
  const me = (p) => p.evaluate(() => (window.App.state && window.App.state.game ? window.App.state.game.me.id : null));

  // Игрок Мира (индекс 4) заходит через аккаунт
  await pages[4].goto(`${URL}/auth/dev?name=Мира&id=mira`);
  await pages[4].waitForSelector('#acct:not([hidden])');
  check((await pages[4].textContent('#acct')).includes('Мира'), 'после входа в шапке видно имя аккаунта');

  const host = pages[0];
  await host.goto(URL); await host.click('[data-act="create"]');
  await host.waitForSelector('.lobby');
  const code = await host.evaluate(() => window.App.state.code);
  for (let i = 1; i < 6; i++) {
    const p = pages[i];
    await p.goto(`${URL}/r/${code}`); await p.waitForSelector('#authRow .as-who');
    await p.click('[data-act="join"]');
    try { await p.waitForSelector('.lobby', { timeout: 8000 }); } catch (e) { console.log('нет лобби у', i, await p.evaluate(() => ({ h: location.hash, k: window.App && App.key, t: document.getElementById('toasts').innerText, m: document.querySelector('.modal') ? document.querySelector('.modal').innerText : '' }))); await p.screenshot({ path: `shots/${TAG}-fail-${i}.png` }); throw e; }
    await p.click('[data-a="ready"]');
  }
  await host.waitForTimeout(500);
  await host.click('[data-a="start"]');
  for (const p of pages) await p.waitForSelector('#game', { timeout: 8000 });
  console.log('партия идёт, код', code);

  // 1. Гость обновил страницу на главной: «Вы в игре» → «Переподключиться»
  const p1 = pages[1];
  const id1 = await me(p1);
  await p1.goto(URL + '/#/');
  await p1.waitForSelector('.resume-card');
  check((await p1.textContent('.resume-card h3')).includes('Вы в игре'), 'на главной виден блок «Вы в игре»');
  check((await p1.textContent('.resume-card')).includes(code), 'в блоке указана комната');
  await p1.waitForTimeout(600);
  const p1name = await p1.evaluate(() => App.guestName());
  check(await host.evaluate((n) => window.App.state.players.find((x) => x.name === n).away, p1name), 'для остальных игрок «отошёл»');
  await p1.screenshot({ path: `shots/${TAG}-resume.png` });
  await p1.click('[data-resume="back"]');
  await p1.waitForSelector('#game');
  check((await me(p1)) === id1, 'после «Переподключиться» тот же игрок');
  await p1.waitForTimeout(600);
  check(!(await host.evaluate((n) => window.App.state.players.find((x) => x.name === n).away, p1name)), 'отметка «отошёл» снялась');

  // 2. Вышел на главную через ×, при попытке открыть новую комнату игру не бросают
  const p2 = pages[2];
  const id2 = await me(p2);
  await p2.click('[data-a="quit"]');
  await p2.waitForSelector('.modal .opt');
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: `shots/${TAG}-quit-menu.png` });
  await p2.click('.modal .opt[data-i="0"]');
  await p2.waitForSelector('.resume-card');
  await p2.click('[data-act="create"]');
  await p2.waitForSelector('.modal .opt');
  check((await p2.textContent('.modal h3')).includes(code), 'при попытке открыть вторую комнату предложено вернуться');
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: `shots/${TAG}-in-room.png` });
  await p2.click('.modal .opt[data-i="0"]');
  await p2.waitForSelector('#game');
  check((await me(p2)) === id2, 'выбрали «Вернуться», вернулись на то же место');

  // 3. Случайно закрыл вкладку, открыл заново в том же браузере
  const p3ctx = ctxs[3].ctx; const id3 = await me(pages[3]);
  await pages[3].close();
  const p3 = await p3ctx.newPage();
  await p3.goto(URL);
  await p3.waitForSelector('.resume-card');
  await p3.click('[data-resume="back"]');
  await p3.waitForSelector('#game');
  check((await me(p3)) === id3, 'гость вернулся после закрытия вкладки');
  await p3.screenshot({ path: `shots/${TAG}-resume-mobile.png` });

  // 4. Аккаунт на втором устройстве
  const id4 = await me(pages[4]);
  const dev = await open();
  await dev.p.goto(`${URL}/auth/dev?name=Мира&id=mira`);
  await dev.p.waitForSelector('.resume-card');
  await dev.p.click('[data-resume="back"]');
  await dev.p.waitForSelector('#game');
  check((await me(dev.p)) === id4, 'аккаунт вернулся на то же место с другого устройства');
  const nameOnCard = await dev.p.evaluate(() => window.App.state.players.find((x) => x.id === window.App.state.realMeId).name);
  check(nameOnCard === 'Мира', 'имя на месте то же');
  check((await host.evaluate(() => window.App.state.players.filter((x) => x.provider === 'dev').length)) === 1, 'у игрока в списке отмечен вход через аккаунт');

  // 5. Покинуть насовсем и сыграть в другой комнате
  const p5 = pages[5];
  await p5.click('[data-a="quit"]');
  await p5.waitForSelector('.modal .opt');
  await p5.click('.modal .opt[data-i="1"]');
  await p5.waitForSelector('.modal [data-ok]');
  await p5.click('.modal [data-ok]');
  await p5.waitForSelector('#startForm');
  check((await p5.$('.resume-card')) === null, 'после выхода блока «Вы в игре» нет');
  await p5.click('[data-act="create"]');
  await p5.waitForSelector('.lobby');
  const code2 = await p5.evaluate(() => window.App.state.code);
  check(code2 && code2 !== code, 'после выхода можно открыть новую комнату');

  // 6. Конец партии и закрытие комнаты ведущим (тестовая комната админки на быстром времени)
  const adm = await open();
  await adm.p.goto(URL);
  await adm.p.evaluate(async () => { await Net.call('admin:auth', { key: 'noir-test' }); });
  const created = await adm.p.evaluate(async () => { const r = await Net.call('admin:test', { name: 'Админ', bots: 5, speed: 0.03, role: 'innocent', mode: 'timers', autostart: true }); return r; });
  check(created.ok, 'тестовая комната создана');
  await adm.p.evaluate((c) => { location.hash = `#/room/${c}`; }, created.code);
  await adm.p.evaluate(async (c) => { const s = window.App.state; await Net.call('admin:room', { code: c, action: 'auto', playerId: s.realMeId }); }, created.code);
  await adm.p.waitForFunction(() => window.App.state && window.App.state.game && window.App.state.game.phase === 'ended', null, { timeout: 100000 });
  await adm.p.waitForSelector('.end-actions [data-a="close"]');
  check((await adm.p.textContent('.end-close')).includes('закройте комнату'), 'у ведущего на итогах есть «Закрыть комнату» и пояснение');
  await adm.p.screenshot({ path: `shots/${TAG}-end-host.png` });
  await adm.p.click('[data-a="close"]');
  await adm.p.click('.modal [data-ok]');
  await adm.p.waitForSelector('#startForm');
  check((await adm.p.$('.resume-card')) === null, 'комната закрыта, ведущий на главной без блока «Вы в игре»');
  const again = await adm.p.evaluate(async () => (await Net.call('room:create', { name: 'Админ' })).ok);
  check(again, 'после закрытия можно открыть новую игру');

  check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  console.log(fails ? `ПРОВАЛОВ: ${fails}` : 'возврат в игру в порядке');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
