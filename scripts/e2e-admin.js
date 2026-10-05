// Сквозной прогон: админка → тестовая комната с ботами → вся партия через интерфейс → «Дело закрыто».
// MODE=timers: партия идёт по таймерам, админ только играет. MODE=host: админ листает фазы сам.
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.URL || 'http://localhost:3000';
const KEY = process.env.ADMIN_KEY || 'noir-test';
const ROLE = process.env.ROLE || 'random';
const BOTS = Number(process.env.BOTS || 6);
const MODE = process.env.MODE || 'timers';
const MOBILE = !!process.env.MOBILE;
const TAG = process.env.TAG || (MOBILE ? 'am' : 'ad');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: MOBILE ? { width: 390, height: 800 } : { width: 1360, height: 860 }, ignoreHTTPSErrors: true, isMobile: MOBILE, hasTouch: MOBILE });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `shots/${TAG}-${name}.png` }); console.log('shot', name); };

  await page.goto(URL + '/#/admin');
  await page.waitForSelector('#keyIn');
  await shot('admin-login');
  await page.fill('#keyIn', KEY);
  await page.click('#loginForm button');
  await page.waitForSelector('[data-a="create-test"]');
  await shot('admin-test');
  await page.click(`[data-a="set"][data-k="role"][data-v="${ROLE}"]`);
  await page.click(`[data-a="set"][data-k="mode"][data-v="${MODE}"]`);
  await page.evaluate((n) => { const r = document.querySelector('#tBots'); r.value = n; r.dispatchEvent(new Event('change', { bubbles: true })); }, BOTS);
  await page.selectOption('#tSpeed', '0.05');
  await page.click('[data-a="create-test"]');
  await page.waitForSelector('#game', { timeout: 8000 });
  console.log('game started, mode', MODE);

  const st = () => page.evaluate(() => { const s = window.App.state; const g = s && s.game; return g ? { phase: g.phase, round: g.round, role: g.me.role, ov: g.overlay && g.overlay.type, can: g.me.can, alibiChosen: g.me.alibiChosen, status: g.me.status, dsp: g.defense && g.defense.speaker, speaker: g.turn && g.turn.speakerId, me: g.me.id, ready: g.me.ready, voted: g.vote && g.vote.my, manual: g.manual } : null; });
  const done = new Set();
  const once = async (k, fn) => { if (done.has(k)) return; done.add(k); await fn(); };
  const t0 = Date.now(); let last = '', lastNext = 0;
  while (Date.now() - t0 < 200000) {
    const s = await st();
    if (!s) { await page.waitForTimeout(300); continue; }
    const key = `${s.phase}:${s.round}`;
    if (key !== last) { last = key; console.log('phase', key, s.role, s.manual ? 'manual' : 'timers'); }
    if (s.phase === 'ended') break;
    try {
      if (s.ov === 'save') await page.click('.ov [data-a="advocate"][data-play="0"]').catch(() => {});
      if (s.phase === 'brief') {
        await once('brief', () => shot('brief'));
        if (s.role === 'killer' && !s.alibiChosen) { await page.click('.loc-btn', { timeout: 2000 }); await once('alibi', () => shot('brief-alibi')); }
        if (!s.ready) await page.click('[data-a="ready"]:not([disabled])').catch(() => {});
      } else if (s.phase === 'turns') {
        if (s.speaker === s.me) { if (s.can.reveal.length) { await once('turn', () => shot('turn')); await page.click('.trait-btn:not(.risky)', { timeout: 2000 }); } else await page.click('[data-a="endturn"]').catch(() => {}); }
      } else if (s.phase === 'talk') {
        await once('talk' + s.round, () => shot('talk' + s.round));
        if (s.round === 2 && s.can.card) await once('card', async () => {
          const dis = await page.getAttribute('[data-a="card"]', 'disabled'); if (dis !== null) return;
          await page.click('[data-a="card"]'); await page.waitForSelector('.modal .opt'); await shot('card-pick');
          await page.click('.modal .opt:not([disabled])'); await page.waitForTimeout(400);
          for (let i = 0; i < 3; i++) {
            if (await page.$('.modal textarea')) { await page.fill('.modal textarea', 'Кто-то выходил через кухню'); await page.click('.modal [data-ok]'); break; }
            const o = await page.$('.modal .opt:not([disabled])'); if (!o) break; await o.click(); await page.waitForTimeout(300);
          }
        });
        if (s.status === 'active' && !s.ready) await page.click('[data-a="ready"]').catch(() => {});
      } else if (['vote', 'poll', 'final'].includes(s.phase)) {
        await once('v' + s.phase + s.round, () => shot('vote-' + s.phase));
        if (!s.voted && s.status === 'active') await page.click('.vote-btn').catch(() => {});
      } else if (s.phase === 'defense') {
        if (s.dsp === s.me) await page.click('[data-a="endspeech"]').catch(() => {});
      } else if (s.phase === 'verdict') {
        await once('verdict', async () => { await page.waitForTimeout(1600); await shot('verdict'); });
      } else if (s.phase === 'accomplice') {
        await page.click('[data-a="accomplice"][data-mode="stealth"]').catch(() => {});
      }
      if (s.manual && Date.now() - lastNext > 1500 && ['clue', 'talk', 'result', 'brief'].includes(s.phase)) { if (await page.click('[data-a="hnext"]').then(() => true).catch(() => false)) lastNext = Date.now(); }
    } catch (e) { errors.push(`step ${key}: ${e.message.split('\n')[0]}`); }
    await page.waitForTimeout(400);
  }
  const fin = await st();
  console.log('final phase', fin && fin.phase);
  if (fin && fin.phase === 'ended') {
    await page.waitForSelector('#end');
    await page.waitForTimeout(1200);
    await shot('end-chrono');
    for (const tab of ['score', 'awards', 'votes', 'clues', 'season', 'log']) { await page.click(`[data-tab="${tab}"]`); await shot('end-' + tab); }
  } else errors.push('партия не закончилась');
  console.log('errors', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
