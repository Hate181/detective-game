// Считает, сколько раз перезапускаются CSS-анимации во время партии. В стабильной фазе перезапусков быть не должно.
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.URL || 'http://localhost:3000';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await (await b.newContext({ viewport: { width: 1360, height: 860 } })).newPage();
  await p.goto(URL);
  await p.evaluate(async () => { await Net.call('admin:auth', { key: 'noir-test' }); });
  await p.addInitScript(() => {});
  const created = await p.evaluate(async () => (await Net.call('admin:test', { name: 'Админ', bots: 6, speed: 0.12, role: 'innocent', mode: 'timers', autostart: true })));
  await p.evaluate((c) => { location.hash = `#/room/${c}`; }, created.code);
  await p.waitForSelector('#game');
  await p.evaluate(async (c) => { await Net.call('admin:room', { code: c, action: 'auto', playerId: App.state.realMeId }); }, created.code);
  await p.evaluate(() => {
    window.__ls = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__ls.push({ v: e.value, t: Math.round(e.startTime), s: (e.sources || []).map((x) => (x.node && (x.node.className || x.node.nodeName)) + '').join(' | ').slice(0, 90), ph: App.state && App.state.game && App.state.game.phase }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
    window.__anim = []; window.__ids = new WeakMap(); window.__n = 0;
    const infinite = new Set(['smoke', 'grain', 'lamp', 'tape-slide', 'blinds', 'lit', 'spin', 'dots', 'over', 'rcPulse']);
    document.addEventListener('animationstart', (e) => {
      if (infinite.has(e.animationName)) { const id = window.__ids.get(e.target) || (window.__ids.set(e.target, ++window.__n), window.__n);
      window.__anim.push({ id, n: e.animationName, inf: true, t: Date.now(), ph: App.state && App.state.game && App.state.game.phase, el: (e.target.className && e.target.className.baseVal !== undefined ? e.target.className.baseVal : e.target.className) || e.target.tagName }); return; }
      const g = App.state && App.state.game;
      const id2 = window.__ids.get(e.target) || (window.__ids.set(e.target, ++window.__n), window.__n);
      window.__anim.push({ id: id2, n: e.animationName, t: Date.now(), ph: g && g.phase, r: g && g.round, el: (e.target.className && e.target.className.baseVal !== undefined ? e.target.className.baseVal : e.target.className) || e.target.tagName });
    }, true);
  });
  await p.waitForFunction(() => App.state.game.phase === 'ended', null, { timeout: 150000 });
  const res = await p.evaluate(() => window.__anim);
  // Группируем по фазе и раунду: сколько раз стартовала каждая пара «анимация + элемент»
  const byPhase = {};
  for (const a of res) {
    const k = `${a.ph}:${a.r}`;
    const kk = `${a.n} <${String(a.el).split(' ').slice(0, 2).join('.')}>`;
    byPhase[k] = byPhase[k] || {};
    byPhase[k][kk] = (byPhase[k][kk] || 0) + 1;
  }
  let repeats = 0;
  const lines = [];
  for (const [k, m] of Object.entries(byPhase)) for (const [kk, n] of Object.entries(m)) { lines.push(`${k}  ${kk}  x${n}`); }
  const total = res.length;
  const inf = res.filter((a) => a.inf).length;
  console.log('всего стартов', total, 'из них бесконечных', inf);
  const finite = {};
  for (const a of res.filter((x) => !x.inf)) { const k = `${a.n}`; finite[k] = (finite[k] || 0) + 1; }
  console.log('конечные анимации по названию', JSON.stringify(finite));
  const infin = {};
  for (const a of res.filter((x) => x.inf)) { const k = `${a.n}`; infin[k] = (infin[k] || 0) + 1; }
  console.log('бесконечные (перезапуск ломает плавность)', JSON.stringify(infin));
  // Один и тот же элемент не должен стартовать одну и ту же анимацию дважды
  const per = {};
  for (const a of res) { const k = `${a.id}:${a.n}`; per[k] = per[k] || { n: a.n, el: a.el, c: 0 }; per[k].c++; }
  const rep = Object.values(per).filter((x) => x.c > 1);
  const sum = {};
  rep.forEach((x) => { const k = `${x.n} <${String(x.el).split(' ').slice(0, 2).join('.')}>`; sum[k] = (sum[k] || 0) + x.c - 1; });
  console.log('повторные старты на том же элементе', JSON.stringify(sum));
  const ls = await p.evaluate(() => window.__ls);
  const top = ls.sort((a, b) => b.v - a.v).slice(0, 6);
  console.log('сдвигов раскладки', ls.length, 'сумма', ls.reduce((a, x) => a + x.v, 0).toFixed(3), JSON.stringify(top));
  await b.close();
})();
