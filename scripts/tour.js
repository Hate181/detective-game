// Экскурсия по всем экранам для скриншотов: тест-комната, фазы листаются кнопкой ведущего или админским «skip».
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.URL || 'http://localhost:3000';
const KEY = process.env.ADMIN_KEY || 'noir-test';
const ROLE = process.env.ROLE || 'accomplice';
const BOTS = Number(process.env.BOTS || 8);
const CASE = process.env.CASE || 'random';
const MOBILE = !!process.env.MOBILE;
const TAG = process.env.TAG || (MOBILE ? 'tm' : 'td');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: MOBILE ? { width: 390, height: 800 } : { width: 1360, height: 860 }, ignoreHTTPSErrors: true, isMobile: MOBILE, hasTouch: MOBILE });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TOO_MANY_RETRIES|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const shot = async (name, full) => { await page.waitForTimeout(900); const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (ov > 0) { console.log('OVERFLOW', name, ov); errors.push('overflow ' + name + ' ' + ov); } await page.screenshot({ path: `shots/${TAG}-${name}.png`, fullPage: !!full }); console.log('shot', name); };
  const call = (ev, p) => page.evaluate(([e, q]) => Net.call(e, q), [ev, p || {}]);
  const S = () => page.evaluate(() => { const s = window.App.state; return s && { code: s.code, g: s.game && { phase: s.game.phase, round: s.game.round, me: s.game.me.id, role: s.game.me.role, speaker: s.game.turn && s.game.turn.speakerId, dsp: s.game.defense && s.game.defense.speaker, voted: s.game.vote && s.game.vote.my, can: s.game.me.can, status: s.game.me.status, ov: s.game.overlay && s.game.overlay.type } }; });
  const tab = async (t) => { if (MOBILE) { await page.click(`#gNav [data-tab="${t}"]`); await page.waitForTimeout(250); } };
  const pickInnocent = async () => { const id = await page.evaluate(() => { const g = window.App.state.game; const b = Array.from(document.querySelectorAll('.vote-btn')).map((x) => x.dataset.id).filter((x) => x && x !== g.god.killerId); return b[0]; }); if (id) await page.click(`.vote-btn[data-id="${id}"]`).catch(() => {}); };
  const skipTo = async (phase, round, cond) => {
    for (let i = 0; i < 60; i++) {
      const s = await S();
      if (s.g.ov === 'save') await page.click('[data-a="advocate"][data-play="1"]').catch(() => {});
      if (s.g.phase === phase && (round == null || s.g.round === round) && (!cond || cond(s))) return s;
      if (s.g.phase === 'ended') throw new Error('партия закончилась до ' + phase);
      // голосуем сами, чтобы не ждать
      if (['vote', 'poll', 'final'].includes(s.g.phase) && !s.g.voted && s.g.status === 'active') await pickInnocent();
      await call('admin:room', { code: s.code, action: 'skip' });
      await page.waitForTimeout(260);
    }
    throw new Error('не дошли до ' + phase);
  };

  // Главная
  await page.goto(URL);
  await page.waitForSelector('#nameIn');
  await page.waitForTimeout(1500);
  await shot('0-home');
  await shot('0-home-full', true);

  await page.goto(URL + '/#/admin');
  await page.waitForSelector('#keyIn');
  await call('admin:auth', { key: KEY });
  const t = await call('admin:test', { name: 'Админ', bots: BOTS, caseId: CASE, speed: 1, role: ROLE, autostart: false, mode: 'host' });
  await page.evaluate((c) => { location.hash = '#/room/' + c; }, t.code);
  await page.waitForSelector('.lobby');
  await call('room:setting', { key: 'discord', value: 'discord.gg/noirclub' });
  await shot('1-lobby', true);
  await call('admin:room', { code: t.code, action: 'start' });
  await page.waitForSelector('#game');
  await page.waitForTimeout(800);

  await shot('2-brief');
  if (MOBILE) { await tab('card'); await shot('2-brief-card'); await tab('stage'); }
  if ((await S()).g.role === 'killer') { await shot('2-brief-picker'); await page.click('.loc-btn'); await shot('2-brief-alibi'); }
  await page.click('[data-a="ready"]:not([disabled])').catch(() => {});

  await skipTo('clue', 1);
  await shot('3-clue');
  await skipTo('turns', 1, (s) => s.g.speaker === s.g.me);
  await shot('4-turn-mine');
  await page.click('.trait-btn:not(.risky) >> nth=1');
  await page.waitForTimeout(700);
  await shot('4-turn-said');
  await skipTo('turns', 1, (s) => s.g.speaker && s.g.speaker !== s.g.me);
  await shot('4-turn-other');
  await skipTo('talk', 1);
  await page.waitForTimeout(500);
  await shot('5-talk', true);
  await page.click('.q-chip >> nth=2');
  await shot('5-popover');
  await page.keyboard.press('Escape');
  await page.click('[data-a="card"]:not([disabled])').catch(() => {});
  await shot('5-card-modal');
  await page.keyboard.press('Escape');
  if (MOBILE) { await tab('journal'); await shot('5-journal'); await tab('stage'); }
  await skipTo('vote', 1);
  await shot('6-vote');
  await pickInnocent();
  await shot('6-vote-picked');
  await skipTo('result', 1);
  await shot('7-result');
  await skipTo('clue', 4);
  await shot('8-clue-final');
  await skipTo('poll');
  await shot('9-poll');
  await skipTo('defense');
  await shot('9-defense');
  await skipTo('final');
  await shot('9-final');
  await skipTo('verdict');
  await shot('10-verdict');
  const s = await skipTo('ended').catch(async () => S());
  await page.waitForSelector('.end', { timeout: 15000 });
  await shot('11-end');
  await page.click('[data-a="tab"][data-tab="votes"]'); await shot('11-end-votes');
  await page.click('[data-a="tab"][data-tab="score"]'); await shot('11-end-score');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors', s && s.g && s.g.phase);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
