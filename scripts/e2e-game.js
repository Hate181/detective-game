// Шесть «людей» в разных вкладках играют партию через настоящие кнопки интерфейса.
// Ведущий (первая вкладка) листает фазы своей кнопкой. Последняя вкладка открыта с размером телефона.
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.URL || 'http://localhost:3000';
const N = Number(process.env.N || 6);
const NAMES = ['Анна', 'Борис', 'Вера', 'Глеб', 'Дина', 'Егор', 'Жанна', 'Захар', 'Инга', 'Кирилл'];
const TAG = process.env.TAG || 'g';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const pages = []; const errors = [];
  for (let i = 0; i < N; i++) {
    const mobile = i === N - 1;
    const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1360, height: 860 }, ignoreHTTPSErrors: true, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TOO_MANY_RETRIES|Failed to load resource/.test(m.text())) errors.push(`${NAMES[i]} console: ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`${NAMES[i]} pageerror: ${e.message}`));
    pages.push(p);
  }
  const shot = async (p, name) => { await p.waitForTimeout(500); await p.screenshot({ path: `shots/${TAG}-${name}.png` }); console.log('shot', name); };
  const host = pages[0];
  await host.goto(URL);
  await host.click('[data-act="create"]');
  await host.waitForSelector('.lobby');
  const code = await host.evaluate(() => window.App.state.code);
  console.log('code', code);
  // Настройки: блока Discord в лобби нет
  if (await host.locator('#dcIn, #lVoice').count()) throw new Error('в лобби остался блок Discord');
  await host.click('[data-a="turn"][data-v="30"]');
  await shot(host, 'lobby-host');
  for (let i = 1; i < N; i++) {
    const p = pages[i];
    await p.goto(`${URL}/r/${code}`);
    await p.waitForSelector('#authRow .as-who');
    await p.click('[data-act="join"]');
    await p.waitForSelector('.lobby');
    await p.click('[data-a="ready"]');
  }
  await host.waitForTimeout(600);
  await shot(host, 'lobby-full');
  await shot(pages[N - 1], 'lobby-mobile');
  await host.click('[data-a="start"]');
  for (const p of pages) await p.waitForSelector('#game', { timeout: 8000 });
  console.log('all in game');

  const seen = {};
  const driver = async (p, idx) => {
    const t0 = Date.now(); let carded = false; let lastHostPress = 0; let lastS = null;
    for (;;) {
      if (Date.now() - t0 > 250000) return 'timeout ' + JSON.stringify(lastS);
      const s = await p.evaluate(() => { const g = window.App.state.game; if (!g) return null; return { phase: g.phase, round: g.round, me: g.me.id, ready: g.me.ready, status: g.me.status, speaker: g.turn && g.turn.speakerId, dsp: g.defense && g.defense.speaker, isHost: g.me.isHost, voted: g.vote && g.vote.my, ov: g.overlay && g.overlay.type, nomineeId: g.overlay && g.overlay.nomineeId, kicks: g.kicks.length, readyN: g.players.filter((x) => x.ready).length, n: g.players.length, canCard: g.me.can.card }; }).catch(() => null);
      if (!s) { await p.waitForTimeout(300); continue; }
      lastS = s;
      const q = async (sel) => { const el = await p.$(sel); if (el && await el.isEnabled().catch(() => false) && await el.isVisible().catch(() => false)) { await el.click({ timeout: 2000 }).catch(() => {}); return true; } return false; };
      if (s.phase === 'ended') return 'ended';
      const key = `${s.phase}:${s.round}:${s.speaker || ''}`;
      if (idx === 0 && !seen[key] && ['brief', 'clue', 'turns', 'talk', 'vote', 'result', 'defense', 'final', 'poll', 'verdict'].includes(s.phase)) { seen[key] = 1; if (!seen[s.phase]) { seen[s.phase] = 1; await shot(p, `host-${s.phase}`); } }
      if (idx === N - 1 && !seen['m' + s.phase] && ['brief', 'turns', 'talk', 'vote', 'result', 'final'].includes(s.phase)) { seen['m' + s.phase] = 1; await shot(p, `mobile-${s.phase}`); }
      if (idx === 1 && !seen['g' + s.phase] && ['turns', 'vote'].includes(s.phase) && s.speaker === s.me) { seen['g' + s.phase] = 1; await shot(p, `guest-${s.phase}`); }
      if (s.ov === 'save' && s.nomineeId === s.me) await q('[data-a="advocate"][data-play="0"]');
      if (s.phase === 'brief') { await q('.loc-btn'); await q('[data-a="ready"]:not([disabled])'); }
      else if (s.phase === 'turns') { if (s.speaker === s.me) { if (!(await q('.trait-btn:not(.risky)'))) await q('[data-a="endturn"]'); } }
      else if (s.phase === 'talk') {
        if (idx === 2 && !carded && s.canCard) { carded = true; await q('[data-a="card"]'); for (let k = 0; k < 4; k++) { await p.waitForTimeout(250); if (!(await q('.modal .opt:not([disabled])'))) break; } }
        if (!s.ready && s.status === 'active') await q('[data-a="ready"]');
      } else if (['vote', 'poll', 'final'].includes(s.phase)) {
        if (!s.voted && s.status === 'active') { const btns = await p.$$('.vote-btn'); if (btns.length) await btns[(idx + s.round) % btns.length].click({ timeout: 2000 }).catch(() => {}); }
      } else if (s.phase === 'defense') { if (s.dsp === s.me) await q('[data-a="endspeech"]'); }
      else if (s.phase === 'accomplice') await q('[data-mode="stealth"]');
      // ведущий листает
      if (s.isHost && Date.now() - lastHostPress > 1800) {
        const press = (['clue', 'result'].includes(s.phase)) || (s.phase === 'brief' && s.readyN >= s.n - 0) || (s.phase === 'talk' && s.readyN >= 3) || (s.phase === 'turns' && false);
        if (press && await q('[data-a="hnext"]')) lastHostPress = Date.now();
      }
      await p.waitForTimeout(220);
    }
  };
  const t0 = Date.now();
  const res = await Promise.all(pages.map((p, i) => driver(p, i)));
  console.log('drivers:', res.join(','), Math.round((Date.now() - t0) / 1000) + 's');
  await shot(host, 'end-hero');
  await host.click('[data-a="tab"][data-tab="votes"]'); await shot(host, 'end-votes');
  await host.click('[data-a="tab"][data-tab="score"]'); await shot(host, 'end-score');
  await shot(pages[N - 1], 'mobile-end');
  const R = await host.evaluate(() => { const r = window.App.state.game.results; return { winner: r.winner, reason: r.reason, rounds: r.rounds, kicks: r.kicks.length }; });
  console.log('result', JSON.stringify(R));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
  process.exit(errors.length || res.some((x) => x !== 'ended') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
