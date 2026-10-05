/* Несколько преступников: группа обязана исключить всех. Отдельная упрощённая модель (без карт действий),
   в которой игроки и стратегии убийцы те же, что в strategy-lab.js. Улики строятся генератором дела,
   остальные преступники получают метки поверх.
   Запуск: node scripts/crime-lab.js [games=600]
   Режимы улик: shared (каждому преступнику подходят все улики) и half (каждая улика подходит одному преступнику). */
const L = require('./strategy-lab');
const Gen = require('../public/shared/generator.js');
const Content = require('../public/shared/content.js');
const Cases = require('../public/shared/cases.js');
const { Rng } = require('../public/shared/rng.js');

const { logPost, privateFacts, pooled, chooseReveal, argmax, softPick, makeRand, pickPersona, PERSONAS, MIXES, KILLERS, ABL } = L;
const SAFE = Content.SAFE_TRAITS;

function build({ n, k, mode, seed, caseData, oneOfTwo }) {
  const rng = new Rng(seed);
  const ids = Array.from({ length: n }, (_, i) => 'p' + i);
  const killerId = ids[rng.int(n)];
  const gen = Gen.generate({ caseData, ids, killerId, accompliceId: null, rng });
  const others = rng.shuffle(ids.filter((id) => id !== killerId));
  const accs = new Set(others.slice(0, k - 1));
  const crim = [killerId].concat(Array.from(accs));
  const addTag = (id, t) => { const c = gen.cards[id]; if (!c.tags.includes(t)) { c.habitTags.push(t); c.tags.push(t); } };
  const dropHabit = (id, t) => { const c = gen.cards[id]; if (c.habitTags.includes(t) && !c.proTags.includes(t)) { c.habitTags = c.habitTags.filter((x) => x !== t); c.tags = c.tags.filter((x) => x !== t); return true; } return !c.tags.includes(t); };
  const clueTags = gen.clues.map((c) => c.tag);
  if (mode === 'shared') {
    accs.forEach((a) => clueTags.forEach((t) => addTag(a, t)));
  } else {
    // каждая улика подходит одному преступнику: профессионные метки убийцы остаются за ним
    const owner = {};
    clueTags.forEach((t) => { if (gen.cards[killerId].proTags.includes(t)) owner[t] = killerId; });
    let i = 0;
    clueTags.filter((t) => !owner[t]).forEach((t) => { owner[t] = crim[(i++) % crim.length]; });
    clueTags.forEach((t) => {
      crim.forEach((cid) => { if (cid !== owner[t]) dropHabit(cid, t); });
      addTag(owner[t], t);
    });
  }
  // алиби убийцы: свободное место, если есть
  const kc = gen.cards[killerId].alibi;
  const nonScene = caseData.locations.filter((l) => l !== gen.scene);
  const free = nonScene.filter((l) => !ids.some((id) => id !== killerId && gen.cards[id].alibi.real.loc === l));
  kc.claim = { loc: rng.pick(free.length ? free : nonScene), from: kc.window.from, to: kc.window.to };
  const game = {
    order: ids, players: {}, round: 0, phase: 'talk', scene: gen.scene,
    clues: gen.clues.map((c) => ({ tag: c.tag, revealedRound: null, planted: false })),
    lab: { priv: {}, quiet: {}, noPenalty: mode === 'half' ? 0.8 : 0.08 },
  };
  ids.forEach((id) => { game.players[id] = { id, role: id === killerId ? 'killer' : accs.has(id) ? 'accomplice' : 'innocent', card: gen.cards[id], revealed: {}, status: 'active' }; });
  game.availFn = (p) => [...SAFE, 'secret'].filter((t) => !p.revealed[t] && !(oneOfTwo && ((t === 'habit' && p.revealed.profession) || (t === 'profession' && p.revealed.habit))));
  return { game, crim: new Set(crim) };
}

const alive = (g) => g.order.filter((id) => g.players[id].status === 'active');

function playOne(cfg) {
  const { n, k, mode, seed, mix, kStrat, B = 4, oneOfTwo = true } = cfg;
  const rand = makeRand(seed * 7919 + 17);
  const caseData = Cases.CASES[seed % Cases.CASES.length];
  const { game, crim } = build({ n, k, mode, seed, caseData, oneOfTwo });
  const ids = game.order;
  const S = {}, coopOf = {};
  ids.forEach((id) => {
    const per = PERSONAS[pickPersona(rand, mix)];
    coopOf[id] = per.coop;
    S[id] = crim.has(id) ? Object.assign({ persona: PERSONAS.sharp }, kStrat) : { persona: per };
  });
  const inns = ids.filter((id) => !crim.has(id));
  let crimLeft = crim.size, innocentKicks = 0;
  const cardsLeft = {}; ids.forEach((id) => { cardsLeft[id] = 2; });

  const kick = (id) => {
    const p = game.players[id];
    p.status = 'out';
    ['profession', 'habit', 'relation', 'motive', 'alibi'].forEach((t) => { p.revealed[t] = true; });
    if (crim.has(id)) crimLeft--; else innocentKicks++;
  };
  const tally = (votes, cands, take) => {
    const count = {};
    cands.forEach((c) => { count[c] = 0; });
    Object.values(votes).forEach((t) => { if (count[t] !== undefined) count[t]++; });
    const order = cands.slice().sort((a, b) => count[b] - count[a] || (rand.next() - 0.5));
    return order.slice(0, take);
  };
  const ballots = (cands, finalPhase) => {
    const act = alive(game);
    const innsAlive = act.filter((id) => !crim.has(id));
    const common = pooled(game, coopOf, innsAlive, rand);
    const pubLP = logPost(game, '__none__', { h: 0.3, detect: 0.9, clear: common.clear, lie: common.lie, priv: common.priv }, rand);
    const consensus = argmax(pubLP, (x) => cands.includes(x) && !crim.has(x)) || argmax(pubLP, (x) => cands.includes(x));
    const sim = logPost(game, '__none__', { h: 0.3, detect: 1 }, rand);
    const scapegoat = argmax(sim, (x) => cands.includes(x) && !crim.has(x) && game.players[x].status === 'active');
    const votes = {};
    act.forEach((id) => {
      const mine = cands.filter((c) => c !== id);
      if (!mine.length) return;
      if (crim.has(id)) { votes[id] = scapegoat && mine.includes(scapegoat) ? scapegoat : (mine.find((c) => !crim.has(c)) || mine[0]); return; }
      const per = S[id].persona;
      const pf = privateFacts(game, id);
      const clear = new Set(pf.clear); common.clear.forEach((x) => clear.add(x));
      const lie = new Set(pf.lie); common.lie.forEach((x) => lie.add(x));
      const privMine = Object.assign({}, common.priv);
      if (game.lab.priv[id]) Object.entries(game.lab.priv[id]).forEach(([t, tr]) => { privMine[t] = Object.assign(privMine[t] || {}, tr); });
      const lp = logPost(game, id, { h: per.h, detect: per.dp, clear, lie, priv: privMine }, rand);
      const g = game.players[id].card.goal;
      if (per.goal && g && lp[g.target] !== undefined) lp[g.target] += g.type === 'arrest' ? per.goal : g.type === 'protect' ? -per.goal : 0;
      if (rand.chance(per.herd) && consensus && mine.includes(consensus)) { votes[id] = consensus; return; }
      votes[id] = softPick(lp, per.tau, rand, (x) => mine.includes(x)) || mine[0];
    });
    return votes;
  };

  for (let round = 1; round <= 4 && crimLeft > 0; round++) {
    game.round = round;
    if (round < 4) { const c = game.clues[round - 1]; if (c) c.revealedRound = round; }
    else game.clues.forEach((c) => { if (c.revealedRound === null) c.revealedRound = 4; });
    // круг рассказов
    const act = alive(game);
    const start = (round - 1) % act.length;
    act.slice(start).concat(act.slice(0, start)).forEach((sp) => {
      const t = chooseReveal(game, sp, S[sp], rand);
      if (t) game.players[sp].revealed[t] = true;
    });
    // карты: обвинитель (по подсказкам) раскрывает или проверяет чужую карточку
    alive(game).forEach((id) => {
      if (crim.has(id)) return;
      const per = S[id].persona;
      if (cardsLeft[id] <= 0 || !rand.chance(per.cardUse)) return;
      const pf = privateFacts(game, id);
      const lp = logPost(game, id, { h: per.h, detect: per.dp, clear: pf.clear, lie: pf.lie, priv: game.lab.priv[id] || {} }, rand);
      const target = argmax(lp, (x) => game.players[x].status === 'active' && (!game.players[x].revealed.profession || !game.players[x].revealed.habit));
      if (!target) return;
      const tp = game.players[target];
      const trait = !tp.revealed.profession ? 'profession' : 'habit';
      cardsLeft[id]--;
      if (rand.chance(0.5)) tp.revealed[trait] = true; // показание: открыто всем
      else { game.lab.priv[id] = game.lab.priv[id] || {}; game.lab.priv[id][target] = Object.assign(game.lab.priv[id][target] || {}, { [trait]: true }); } // ордер: только себе
    });
    if (round < 4) {
      const cands = alive(game);
      const votes = ballots(cands, false);
      const [leader] = tally(votes, cands, 1);
      kick(leader);
      if (crimLeft === 0) break;
      if (alive(game).length <= 3) round = 3; // как в движке: когда людей мало, сразу финал
    } else {
      const b = Math.max(1, B - 3);
      let cands = alive(game);
      const poll = ballots(cands, true);
      cands = tally(poll, cands, Math.min(cands.length, b + 1));
      const fin = ballots(cands, true);
      tally(fin, cands, b).forEach((id) => kick(id));
    }
  }
  return { win: crimLeft === 0, innocentKicks, aliveCrim: crimLeft };
}

function run({ n, k, mode, mix, killer = 'smart', games = 600, B = 4, oneOfTwo = true, seed = 1 }) {
  let wins = 0, ik = 0;
  for (let g = 0; g < games; g++) {
    const r = playOne({ n, k, mode, seed: seed * 100003 + g * 13 + n, mix: MIXES[mix], kStrat: KILLERS[killer], B, oneOfTwo });
    if (r.win) wins++;
    ik += r.innocentKicks;
  }
  return { win: wins / games, innocentKicks: ik / games };
}

module.exports = { run, playOne };

if (require.main === module) {
  const games = Number(process.argv[2] || 600);
  const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
  const mixes = ['noise', 'allCasual', 'human', 'normRandom', 'normTagFirst'];
  const plan = [[6, 2], [7, 2], [8, 3], [9, 3], [10, 3]];
  const out = {};
  console.log('Калибровка, один убийца (k=1), 4 исключения:');
  [6, 8].forEach((n) => console.log(' n=' + n, mixes.map((m) => m + ' ' + pct(run({ n, k: 1, mode: 'shared', mix: m, games }).win).trim()).join('  ')));
  for (const mode of ['shared', 'half']) {
    for (const killer of ['smart', 'stall']) {
      for (const B of [4, 5, 6]) {
        console.log(`\n=== улики: ${mode}; убийца: ${killer}; исключений: ${B} ===`);
        console.log('игроков/преступников'.padEnd(22) + mixes.map((m) => m.padStart(14)).join(''));
        plan.forEach(([n, k]) => {
          const row = mixes.map((m) => { const r = run({ n, k, mode, mix: m, killer, B, games }); out[[mode, killer, B, n, k, m].join('|')] = r; return r.win; });
          console.log((n + ' / ' + k).padEnd(22) + row.map((x) => pct(x).padStart(14)).join(''));
        });
      }
    }
  }
  require('fs').writeFileSync('/tmp/crime-results.json', JSON.stringify(out));
}
