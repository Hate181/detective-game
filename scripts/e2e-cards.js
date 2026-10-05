// Карты действий через интерфейс: тестовая комната, обсуждение, розыгрыш карты каждого типа.
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.URL || 'http://localhost:3000';
const ROLES = (process.env.ROLES || 'innocent,killer,innocent,killer').split(',');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const seen = new Set();
  for (const role of ROLES) {
    const p = await (await b.newContext({ viewport: { width: 1360, height: 860 } })).newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_/.test(m.text())) errs.push(m.text()); });
    await p.goto(URL);
    await p.evaluate(async () => { await Net.call('admin:auth', { key: 'noir-test' }); });
    const c = await p.evaluate(async (r) => (await Net.call('admin:test', { name: 'Игрок', bots: 6, speed: 1, role: r, mode: 'host', autostart: true })), role);
    await p.evaluate((code) => { location.hash = `#/room/${code}`; }, c.code);
    await p.waitForSelector('#game');
    // Листаем фазы до обсуждения первого раунда
    for (let i = 0; i < 12; i++) {
      const ph = await p.evaluate(() => App.state.game.phase);
      if (ph === 'talk') break;
      await p.evaluate(async (code) => { await Net.call('admin:room', { code, action: 'skip' }); }, c.code);
      await p.waitForTimeout(300);
    }
    await p.waitForSelector('[data-a="card"], .card-note', { timeout: 8000 });
    const info = await p.evaluate(() => ({ cards: App.state.game.me.cards, can: App.state.game.me.can.card, role: App.state.game.me.role, dis: (document.querySelector('[data-a="card"]') || {}).disabled }));
    console.log('роль', info.role, 'карты', JSON.stringify(info.cards.map((x) => x.type)), 'can.card', info.can, 'кнопка отключена', info.dis);
    const onlyAdv = info.cards.length && info.cards.every((x) => x.type === 'advocate');
    if (onlyAdv) {
      const note = await p.evaluate(() => { const n = document.querySelector('.card-note'); return n ? n.innerText : ''; });
      check(/Адвокат/.test(note), `у владельца «Адвоката» вместо мёртвой кнопки пояснение: «${note}»`);
      const side = await p.evaluate(() => (document.querySelector('#pCard .cstate') || {}).innerText || '');
      check(/Сработает сама/.test(side), 'в «Моей карточке» подписано, как работает «Адвокат»');
      await p.context().close(); continue;
    }
    check(!info.dis, `кнопка «Карта действия» активна (${role})`);
    // Играем каждую карту подряд
    for (let n = 0; n < 4; n++) {
      const st = await p.evaluate(() => ({ phase: App.state.game.phase, left: App.state.game.me.cards.filter((x) => !x.used && x.type !== 'advocate').map((x) => x.type), overlay: !!App.state.game.overlay }));
      if (st.phase !== 'talk' || !st.left.length) break;
      if (st.overlay) { await p.waitForTimeout(1500); continue; }
      const type = st.left[0];
      if (process.env.SIDE) await p.click(`#pCard [data-a="card"][data-type="${type}"]`, { timeout: 3000 }).catch(() => {});
      else await p.click('[data-a="card"]:not([disabled])', { timeout: 3000 }).catch(() => {});
      let modal = await p.waitForSelector('.modal', { timeout: 3000 }).catch(() => null);
      check(!!modal, `карта ${type}: окно выбора открылось`);
      if (!modal) break;
      // выбираем нужный тип (если окно выбора карты)
      const title = await p.textContent('.modal h3');
      if (/Карта действия/.test(title)) {
        const labels = await p.$$eval('.modal .opt', (els) => els.map((e) => e.innerText.split('\n')[0]));
        console.log('  в окне:', labels.join(' | '));
        await p.click('.modal .opt:not([disabled])');
        await p.waitForTimeout(400);
      }
      const before = await p.evaluate(() => App.state.game.me.cards.filter((x) => x.used).length);
      for (let step = 0; step < 4; step++) {
        const m = await p.$('.modal');
        if (!m) break;
        const t = (await p.textContent('.modal h3')) || '';
        if (/Сплетня/.test(t)) { await p.fill('.modal textarea', 'Кто-то выходил через кухню'); await p.click('.modal [data-ok]'); }
        else if (await p.$('.modal .opt:not([disabled])')) await p.click('.modal .opt:not([disabled])');
        else break;
        await p.waitForTimeout(500);
      }
      await p.waitForTimeout(700);
      const after = await p.evaluate(() => App.state.game.me.cards.filter((x) => x.used).length);
      const toast = await p.evaluate(() => document.getElementById('toasts').innerText);
      check(after === before + 1, `карта ${type} сыграна (использовано ${before} → ${after})${toast ? ', сообщение: ' + toast.replace(/\n/g, ' ') : ''}`);
      seen.add(type);
      await p.screenshot({ path: `shots/cards-${type}.png` });
    }
    check(errs.length === 0, 'ошибок в консоли нет' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
    await p.context().close();
  }
  console.log('сыграны типы:', Array.from(seen).join(', '));
  await b.close();
  console.log(fails ? `ПРОВАЛОВ: ${fails}` : 'карты в порядке');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
