/* Лаборатория стратегий: играет настоящий движок «людьми» с разным поведением и считает, что работает.
   Не боты из bots.js: здесь у каждого игрока своя модель (рассуждает по уликам, прячет совпадения, слушается
   большинства, гонится за личной целью, делится знанием голосом). Убийца выбирает стратегию из набора.
   Запуск: node scripts/strategy-lab.js [games=600] [n=6,8,10]
   Из модуля: require('./strategy-lab').run({...}). */
const E = require('../public/shared/engine.js');
const Content = require('../public/shared/content.js');
const Cases = require('../public/shared/cases.js');

const { PH } = E;
const TAGS = Content.TAGS;

/* ---------- Случайность лаборатории (отдельная от случайности партии) ---------- */
function makeRand(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, chance: (p) => next() < p, pick: (a) => a[Math.floor(next() * a.length)], gumbel: () => -Math.log(-Math.log(Math.max(1e-12, next()))) };
}

/* ---------- Типы игроков ---------- */
const PERSONAS = {
  sharp:    { tau: 0.30, herd: 0.15, coop: 1.0, h: 0.30, reveal: 'tagfirst',    cardUse: 0.85, dp: 0.95, goal: 0 },
  casual:   { tau: 1.20, herd: 0.45, coop: 0.30, h: 0.80, reveal: 'random',     cardUse: 0.40, dp: 0.55, goal: 0 },
  cautious: { tau: 0.60, herd: 0.30, coop: 0.70, h: 0.40, reveal: 'selfprotect', cardUse: 0.60, dp: 0.85, goal: 0 },
  goalie:   { tau: 0.80, herd: 0.20, coop: 0.30, h: 0.40, reveal: 'random',     cardUse: 0.50, dp: 0.70, goal: 1.6 },
  follower: { tau: 0.90, herd: 0.85, coop: 0.50, h: 0.50, reveal: 'random',     cardUse: 0.30, dp: 0.70, goal: 0 },
  // Один и тот же «острый» разум, но разные нормы раскрытия: так видно, как группа сама ломает или сохраняет игру
  normTagFirst: { tau: 0.30, herd: 0.15, coop: 1.0, h: 0.30, reveal: 'tagfirst',    cardUse: 0.85, dp: 0.95, goal: 0 },
  normRandom:   { tau: 0.30, herd: 0.15, coop: 1.0, h: 0.30, reveal: 'random',      cardUse: 0.85, dp: 0.95, goal: 0 },
  normSelf:     { tau: 0.30, herd: 0.15, coop: 1.0, h: 0.30, reveal: 'selfprotect', cardUse: 0.85, dp: 0.95, goal: 0 },
  normTagLast:  { tau: 0.30, herd: 0.15, coop: 1.0, h: 0.30, reveal: 'taglast',     cardUse: 0.85, dp: 0.95, goal: 0 },
  noise:    { tau: 1e6, herd: 0, coop: 0, h: 0, reveal: 'random', cardUse: 0, dp: 1, goal: 0 },
  // Простые правила, которые люди любят повторять: проверяем, не ломают ли они игру
  ruleHide:  { tau: 0.30, herd: 0, coop: 0, h: 0, reveal: 'tagfirst', cardUse: 0, dp: 1, goal: 0, rule: 'hide' },
  ruleMatch: { tau: 0.30, herd: 0, coop: 0, h: 0, reveal: 'tagfirst', cardUse: 0, dp: 1, goal: 0, rule: 'match' },
  ruleNoise: { tau: 0.30, herd: 0, coop: 0, h: 0, reveal: 'random', cardUse: 0, dp: 1, goal: 0, rule: 'match' },
};
const MIXES = {
  human:      { sharp: 0.20, casual: 0.30, cautious: 0.25, goalie: 0.10, follower: 0.15 },
  allSharp:   { sharp: 1 },
  allCasual:  { casual: 1 },
  allCautious: { cautious: 1 },
  allFollow:  { follower: 1 },
  normTagFirst: { normTagFirst: 1 }, normRandom: { normRandom: 1 }, normSelf: { normSelf: 1 }, normTagLast: { normTagLast: 1 },
  noise: { noise: 1 },
  ruleHide:   { ruleHide: 1 },
  ruleMatch:  { ruleMatch: 1 },
  ruleMatchRandomReveal: { ruleNoise: 1 },
};
const pickPersona = (rand, mix) => { let r = rand.next() * Object.values(mix).reduce((a, b) => a + b, 0); for (const [k, w] of Object.entries(mix)) { r -= w; if (r <= 0) return k; } return Object.keys(mix)[0]; };

/* ---------- Знания игроков ---------- */
const pl = (game, id) => game.players[id];
const alive = (game) => game.order.filter((id) => game.players[id].status === 'active');
/* Подменённую улику по виду не отличить: замечают её только по нестыковке с остальными (ABL.swapDetect), а тот, кто подменил, знает точно.
   «Экспертиза» даёт точный ответ по улике (priv.__clue), им делятся голосом, как и «Обыском». */
const realClues = (game, detect, rand, viewerId, priv) => game.clues.filter((c) => {
  if (c.revealedRound === null) return false;
  const known = priv && priv.__clue && priv.__clue[c.id];
  if (known) return known === 'real';
  return !(c.planted && ((viewerId && game.plants.some((x) => x.clueId === c.id && x.by === viewerId)) || rand.chance(detect * ABL.swapDetect)));
});

/** Что известно о теге t у игрока j: 'yes' | 'no' | '?'. priv: личные открытия (карта «Обыск»). */
function tagStatus(game, j, t, priv) {
  const p = pl(game, j);
  const lab = priv && priv.__lab && priv.__lab[j + '|' + t];
  if (lab) return lab;
  // priv[j][trait] === 'fake': «Обыск» наткнулся на «Ложный след» и показал безобидное значение
  const pp = priv && priv[j] && priv[j].profession, ph = priv && priv[j] && priv[j].habit;
  const revP = p.revealed.profession || pp;
  const revH = p.revealed.habit || ph;
  if ((p.revealed.profession || pp === true) && p.card.proTags.includes(t)) return 'yes';
  if ((p.revealed.habit || ph === true) && p.card.habitTags.includes(t)) return 'yes';
  const couldPro = !revP, couldHab = !revH && !!TAGS[t].habit;
  return couldPro || couldHab ? '?' : 'no';
}
const hiddenTagTraits = (game, j, priv) => {
  const p = pl(game, j);
  return (p.revealed.profession || (priv && priv[j] && priv[j].profession) ? 0 : 1) + (p.revealed.habit || (priv && priv[j] && priv[j].habit) ? 0 : 1);
};

/** Веса «убийца — он» (в логарифмах) с точки зрения viewerId. opts: h, detect, clear (набор оправданных), lie (набор уличённых), priv, noTruth. */
function logPost(game, viewerId, opts, rand) {
  const n = game.order.length;
  const q = Math.min(0.8, 1.6 / (n - 1));
  const clues = realClues(game, opts.detect == null ? 1 : opts.detect, rand, viewerId, opts.priv);
  const out = {};
  for (const j of alive(game)) {
    if (j === viewerId) continue;
    let w = 0;
    if (opts.clear && opts.clear.has(j)) { out[j] = -50; continue; }
    // В банде улики делятся между двумя преступниками: совпадение слабее, несовпадение почти ничего не снимает.
    // Частоты из генератора: преступнику подходит улика в 75% случаев (три из четырёх), невиновному около 20%.
    const yes = game.gang ? Math.log(0.75 / 0.2) : Math.log(1 / q);
    const no = game.gang ? Math.log(0.25 / 0.8) : Math.log(game.lab && game.lab.noPenalty != null ? game.lab.noPenalty : 0.08);
    for (const c of clues) {
      const st = ABL.noTags ? '?' : tagStatus(game, j, c.tag, opts.priv);
      if (st === 'yes') w += yes;
      else if (st === 'no') w += no;
    }
    const turnsHad = game.round - (game.phase === PH.TURNS || game.phase === PH.CLUE ? 1 : 0);
    if (turnsHad >= 2) w += hiddenTagTraits(game, j, opts.priv) * Math.log(1 + (opts.h || 0));
    if (opts.lie && opts.lie.has(j)) w += Math.log(1.6);
    out[j] = w;
  }
  return out;
}

/** Круг оправданных и уличённых по личным знаниям игрока. */
function privateFacts(game, id) {
  const me = pl(game, id);
  if (ABL.noPrivate) return { clear: new Set(), lie: new Set() };
  const clear = new Set(me.card.witnesses.filter((w) => pl(game, w).status === 'active'));
  const lie = new Set();
  for (const j of alive(game)) {
    if (j === id) continue;
    const c = pl(game, j).card.alibi.claim;
    if (pl(game, j).revealed.alibi && c && c.loc === me.card.alibi.real.loc && !me.card.witnesses.includes(j)) lie.add(j);
  }
  return { clear, lie };
}

/** То, чем делятся честные игроки голосом: объединение знаний тех, кто открыт. */
function pooled(game, coopOf, inns, rand) {
  const clear = new Set(), lie = new Set(), priv = {};
  for (const id of inns) {
    if (pl(game, id).status !== 'active' || pl(game, id).role !== 'innocent' || !rand.chance(coopOf[id])) continue;
    // Тот, чья тайна связана с местом, не расскажет, где был и кто его видел: это раскрыло бы тайну.
    if (pl(game, id).card.secret.kind !== 'plain' && !rand.chance(ABL.secretShare)) continue;
    const f = privateFacts(game, id);
    f.clear.forEach((x) => clear.add(x)); f.lie.forEach((x) => lie.add(x));
    (game.lab.priv[id] ? Object.entries(game.lab.priv[id]) : []).forEach(([t, tr]) => { priv[t] = Object.assign(priv[t] || {}, tr); });
  }
  return { clear, lie, priv };
}

const ABL = { swapDetect: 0.3, crimSwap: true,  rules: {}, capTags: false, doubles: 0, doublesPlain: false, noPrivate: false, noTags: false, secretShare: 0.15, quietShare: 0, quietObey: 0.85 };
const argmax = (m, filter) => { let b = null; for (const [k, v] of Object.entries(m)) if ((!filter || filter(k)) && (b === null || v > m[b])) b = k; return b; };
const softPick = (m, tau, rand, filter) => { let b = null, bv = -Infinity; for (const [k, v] of Object.entries(m)) { if (filter && !filter(k)) continue; const s = v + tau * rand.gumbel(); if (s > bv) { bv = s; b = k; } } return b; };

/* ---------- Раскрытие карточки ---------- */
const SAFE = Content.SAFE_TRAITS;
const available = (game, p) => (game.availFn ? game.availFn(p) : E.view(game, p.id).me.can.reveal); // что разрешает сам движок (или модель с несколькими преступниками)

function matchCount(game, p, trait) {
  const tags = trait === 'profession' ? p.card.proTags : trait === 'habit' ? p.card.habitTags : [];
  const real = game.clues.filter((c) => c.revealedRound !== null && !c.planted).map((c) => c.tag);
  return tags.filter((t) => real.includes(t)).length;
}

function chooseReveal(game, id, strat, rand) {
  const p = pl(game, id);
  const left = available(game, p);
  const safeLeft = left.filter((t) => t !== 'secret');
  const nonTag = safeLeft.filter((t) => t !== 'profession' && t !== 'habit');
  const tagLeft = safeLeft.filter((t) => t === 'profession' || t === 'habit');
  const shuffled = (a) => a.slice().sort(() => rand.next() - 0.5);
  const killerLike = p.role !== 'innocent';
  if (killerLike) {
    const k = strat.reveal;
    if (k === 'random') return rand.pick(safeLeft);
    if (k === 'stall' || k === 'stallNoSecret') {
      const stall = nonTag.concat(k === 'stall' && left.includes('secret') ? ['secret'] : []);
      if (stall.length) return stall[0];
      return tagLeft.sort((a, b) => matchCount(game, p, a) - matchCount(game, p, b))[0] || left[0];
    }
    if (k === 'mimic') {
      const cheap = tagLeft.filter((t) => matchCount(game, p, t) <= 1).sort((a, b) => matchCount(game, p, a) - matchCount(game, p, b));
      if (cheap.length) return cheap[0];
      if (nonTag.length) return nonTag[0];
      return tagLeft[0] || left[0];
    }
    if (k === 'smart') {
      // Один шаг вперёд: что из доступного оставляет убийцу наименее заметным для «острого» игрока.
      let best = null, bs = Infinity;
      for (const t of left) {
        const saved = p.revealed[t];
        p.revealed[t] = true;
        const sim = logPost(game, '__none__', { h: 0.3, detect: 1 }, rand);
        const others = Object.keys(sim).filter((x) => x !== id);
        const me = sim[id];
        const best1 = Math.max(...others.map((x) => sim[x]));
        const score = me - best1 + (t === 'secret' ? 0.6 : 0) + rand.next() * 0.05;
        p.revealed[t] = saved;
        if (score < bs) { bs = score; best = t; }
      }
      return best;
    }
  }
  const quiet = game.lab && game.lab.quiet && game.lab.quiet[id];
  if (quiet && left.length > 1 && strat.obey) {
    const i = safeLeft.indexOf(quiet);
    if (i >= 0 && safeLeft.length > 1) { safeLeft.splice(i, 1); const j = tagLeft.indexOf(quiet); if (j >= 0) tagLeft.splice(j, 1); }
  }
  const r = strat.persona.reveal;
  if (r === 'random') return rand.pick(safeLeft);
  if (r === 'tagfirst') return (tagLeft.length ? tagLeft : nonTag)[0] || left[0];
  if (r === 'taglast') return (nonTag.length ? nonTag : tagLeft)[0] || left[0];
  if (r === 'selfprotect') {
    const ok = tagLeft.filter((t) => matchCount(game, p, t) < 2);
    if (ok.length && rand.chance(0.7)) return ok[0];
    if (nonTag.length) return shuffled(nonTag)[0];
    return tagLeft[0] || left[0];
  }
  return rand.pick(safeLeft);
}

/* ---------- Игра ---------- */
function setupPlayers(n, rand, mix, killerStrat, accStrat) {
  const strat = {};
  return { strat };
}

function playGame(cfg) {
  const { n, caseData, seed, mix, kStrat } = cfg;
  const rand = makeRand(seed * 7919 + 13);
  const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
  let now = 1000;
  const game = E.createGame({ caseData, players, seed, now, settings: { mode: 'timers', rules: Object.assign({ finaleAt: ABL.finaleAt || 3, oneOfTwo: !!ABL.capTags }, ABL.rules) } });
  game.lab = { priv: {}, quiet: {}, doubles: [] };
  if (ABL.doubles) {
    // Двойники: невиновные, у которых совпадают все четыре улики; отличает их от убийцы только то, что их можно подтвердить.
    const real = game.clues.filter((c) => !c.planted).map((c) => c.tag);
    const pool = game.order.filter((id) => id !== game.killerId && id !== game.accompliceId && game.players[id].card.witnesses.length > 0)
      .sort(() => rand.next() - 0.5);
    for (const id of pool.slice(0, ABL.doubles)) {
      const c = game.players[id].card;
      real.forEach((t) => { if (!c.tags.includes(t)) { c.habitTags.push(t); c.tags.push(t); } });
      game.lab.doubles.push(id);
    }
  }
  const ids = game.order;
  const coopOf = {}, S = {};
  ids.forEach((id) => {
    const role = pl(game, id).role;
    const persona = PERSONAS[pickPersona(rand, mix)];
    coopOf[id] = persona.coop;
    S[id] = role === 'innocent' ? { persona } : Object.assign({ persona }, kStrat);
  });
  const inns = ids.filter((id) => pl(game, id).role === 'innocent');
  const killerId = game.killerId;
  inns.forEach((id) => { if (rand.chance(ABL.quietShare)) { game.lab.quiet[id] = rand.pick(['habit', 'profession']); S[id].obey = rand.chance(ABL.quietObey); } });
  const trace = { rounds: [] };

  // Публичная «прозрачность дела»: насколько убийца заметен тем, кто знает только общее.
  const snapshot = () => {
    const pub = logPost(game, '__none__', { h: 0, detect: 1 }, rand);
    const a = alive(game);
    const arr = a.map((id) => pub[id]).sort((x, y) => y - x);
    const top = argmax(pub);
    const z = a.reduce((s, id) => s + Math.exp(pub[id]), 0);
    return { top: top === killerId, pk: Math.exp(pub[killerId]) / z, unique: arr.length > 1 && arr[0] - arr[1] > 0.5 };
  };

  const doKillerReveal = (id) => { const t = chooseReveal(game, id, S[id], rand); return t; };

  let steps = 0;
  while (game.phase !== PH.ENDED && steps++ < 4000) {
    now += 1000;
    if (game.overlay && game.overlay.type === 'lottery') { E.skip(game, now); continue; }
    if (game.overlay) {
      const nid = game.overlay.nomineeId;
      E.act(game, nid, 'save', saveChoice(game, nid, S[nid], rand), now);
      continue;
    }
    switch (game.phase) {
      case PH.BRIEF: {
        const k = pl(game, killerId);
        const info = E.view(game, killerId).me.killerInfo;
        const free = info.locations.filter((l) => !l.crowded).map((l) => l.loc);
        const all = info.locations.map((l) => l.loc);
        const loc = (S[killerId].alibi === 'random' || !free.length) ? rand.pick(all) : rand.pick(free);
        E.act(game, killerId, 'alibi', { loc }, now);
        E.skip(game, now);
        break;
      }
      case PH.TURNS: {
        const sp = game.turn.speakerId;
        const t = chooseReveal(game, sp, S[sp], rand);
        if (t) { E.act(game, sp, 'reveal', { trait: t }, now); }
        E.act(game, sp, 'endturn', {}, now);
        break;
      }
      case PH.TALK: {
        trace.rounds.push(Object.assign({ round: game.round, kind: 'beforeTalk', n: alive(game).length }, snapshot()));
        const order = alive(game).sort(() => rand.next() - 0.5);
        for (const id of order) useCard(game, id, S[id], rand, coopOf, inns, now, S);
        E.skip(game, now);
        break;
      }
      case PH.VOTE: case PH.POLL: case PH.FINAL: {
        const v = game.vote;
        const act = alive(game);
        if (act.every((id) => v.votes[id])) { E.skip(game, now); break; }
        const ballots = {};
        const common = pooled(game, coopOf, inns, rand);
        const consensus = argmax(logPost(game, '__none__', { h: 0.3, detect: 0.9, clear: common.clear, lie: common.lie, priv: common.priv }, rand), (k) => v.candidates.includes(k));
        const scapegoat = pickScapegoat(game, killerId, v.candidates, rand);
        for (const id of act) ballots[id] = ballot(game, id, S[id], v, consensus, scapegoat, common, coopOf, rand);
        for (const id of act) { const r = E.act(game, id, 'vote', { target: ballots[id] }, now); if (!r.ok) E.act(game, id, 'vote', { target: v.candidates.find((c) => c !== id) }, now); }
        E.skip(game, now);
        break;
      }
      case PH.ACCOMPLICE: E.act(game, game.accompliceId, 'accomplice', { mode: 'stealth' }, now); break;
      default: E.skip(game, now);
    }
  }
  if (game.phase !== PH.ENDED) throw new Error('партия не закончилась: ' + game.phase);
  const r = game.results;
  return { win: r.winner === 'innocent', reason: r.reason, kickRound: game.verdict.round, kicks: game.kicks.map((k) => k.role), trace, nPlayers: n, game };
}

function pickScapegoat(game, killerId, candidates, rand) {
  const acc = game.accompliceId;
  const sim = logPost(game, killerId, { h: 0.3, detect: 1 }, rand);
  const pool = candidates.filter((c) => pl(game, c).role === 'innocent' && pl(game, c).status === 'active');
  return pool.length ? argmax(sim, (k) => pool.includes(k)) : candidates.find((c) => c !== killerId);
}

function ballot(game, id, strat, v, consensus, scapegoat, common, coopOf, rand) {
  const p = pl(game, id);
  const cands = v.candidates.filter((c) => c !== id);
  if (p.role !== 'innocent') {
    // Преступники (и перебежчик) поддерживают самого «подходящего» для обвинения невиновного
    const others = cands.filter((c) => pl(game, c).role === 'innocent');
    return scapegoat && cands.includes(scapegoat) && scapegoat !== id ? scapegoat : (others[0] || cands[0]);
  }
  const per = strat.persona;
  if (per.rule === 'hide') return ruleHide(game, cands, rand);
  if (per.rule === 'match') return ruleMatch(game, cands, rand);
  const priv = privateFacts(game, id);
  const clear = new Set(priv.clear);
  common.clear.forEach((x) => clear.add(x));
  const lie = new Set(priv.lie);
  common.lie.forEach((x) => lie.add(x));
  const privMine = Object.assign({}, common.priv);
  if (game.lab.priv[id]) Object.entries(game.lab.priv[id]).forEach(([t, tr]) => { privMine[t] = Object.assign(privMine[t] || {}, tr); });
  const lp = logPost(game, id, { h: per.h, detect: per.dp, clear, lie, priv: privMine }, rand);
  const g = p.card.goal;
  if (per.goal && g && lp[g.target] !== undefined) lp[g.target] += g.type === 'arrest' ? per.goal : g.type === 'protect' ? -per.goal : 0;
  // голос большинства: слушают общее мнение, в котором убийца подталкивает «своего» подозреваемого
  if (rand.chance(per.herd)) {
    const target = strat.killerPush && rand.chance(strat.killerPush) && scapegoat ? scapegoat : consensus;
    if (target && cands.includes(target)) return target;
  }
  return softPick(lp, per.tau, rand, (k) => cands.includes(k)) || cands[0];
}

/** Правило «голосуй против того, у кого больше совпадений с уликами». */
function ruleMatch(game, cands, rand) {
  const real = game.clues.filter((c) => c.revealedRound !== null).map((c) => c.tag);
  const sc = {};
  cands.forEach((c) => { sc[c] = E.shownTags(pl(game, c)).filter((t) => real.includes(t)).length + rand.next() * 0.3; });
  return argmax(sc);
}

/** Правило «голосуй против того, кто прячет профессию и особенность». */
function ruleHide(game, cands, rand) {
  const sc = {};
  cands.forEach((c) => { sc[c] = hiddenTagTraits(game, c) + rand.next() * 0.3; });
  return argmax(sc);
}

/** Карта защиты: преступник рикошетит в самого подходящего невиновного, невиновный в самого подозрительного из голосовавших. */
function saveChoice(game, id, strat, rand) {
  const ov = game.overlay, p = pl(game, id);
  return { card: ov.options.includes('advocate') ? 'advocate' : 'none' };
}

function useCard(game, id, strat, rand, coopOf, inns, now, S) {
  const p = pl(game, id);
  const cards = p.cards.filter((c) => !c.used);
  if (!cards.length) return;
  const has = (t) => cards.some((c) => c.type === t);
  if (p.role !== 'innocent') {
    if (!strat.plant) return;
    // Подмена: навести улику на невиновного, который и так выглядит подозрительно
    if (has('swap') && ABL.crimSwap) {
      const targets = E.swapTargets(game, p).filter((k) => pl(game, k).role === 'innocent');
      if (targets.length) {
        const sim = logPost(game, id, { h: 0.3, detect: 1 }, rand);
        E.act(game, id, 'card', { type: 'swap', target: argmax(sim, (k) => targets.includes(k)) || targets[0] }, now);
      }
    }
    // Очная ставка: свести двух невиновных, на которых и так думают
    if (has('confront')) {
      const sim = logPost(game, id, { h: 0.3, detect: 1 }, rand);
      const ok = (k) => pl(game, k).status === 'active' && pl(game, k).role === 'innocent';
      const a = argmax(sim, ok), b = a && argmax(sim, (k) => k !== a && ok(k));
      const trait = b && Content.CONFRONT_TRAITS.find((t) => !pl(game, a).revealed[t] || !pl(game, b).revealed[t]);
      if (trait) E.act(game, id, 'card', { type: 'confront', target: a, target2: b, trait }, now);
    }
    return;
  }
  // Невиновный подменяет улику только ради личной цели «посадить»
  if (has('swap') && strat.persona.goal && p.card.goal.type === 'arrest' && rand.chance(0.5) && E.swapTargets(game, p).includes(p.card.goal.target)) {
    E.act(game, id, 'card', { type: 'swap', target: p.card.goal.target }, now);
  }
  if (has('lab') && rand.chance(Math.max(0.5, strat.persona.cardUse))) {
    // Проверить самую свежую найденную улику, о которой ещё ничего не известно
    game.lab.priv[id] = game.lab.priv[id] || {};
    const known = game.lab.priv[id].__clue = game.lab.priv[id].__clue || {};
    const clue = game.clues.filter((c) => c.revealedRound !== null && !known[c.id]).pop();
    if (clue && E.act(game, id, 'card', { type: 'lab', clueId: clue.id }, now).ok) known[clue.id] = clue.planted ? 'fake' : 'real';
  }
  if (!rand.chance(strat.persona.cardUse)) return;
  if (has('confront')) {
    // Очная ставка: два главных подозреваемых раскрывают алиби (или связь с жертвой, мотив)
    const priv = privateFacts(game, id);
    const lp = logPost(game, id, { h: strat.persona.h, detect: strat.persona.dp, clear: priv.clear, lie: priv.lie, priv: game.lab.priv[id] ? Object.assign({}, game.lab.priv[id]) : {} }, rand);
    const ok = (k) => pl(game, k).status === 'active';
    const a = argmax(lp, ok), b = a && argmax(lp, (k) => k !== a && pl(game, k).status === 'active');
    const trait = b && Content.CONFRONT_TRAITS.find((t) => !pl(game, a).revealed[t] || !pl(game, b).revealed[t]);
    if (trait) E.act(game, id, 'card', { type: 'confront', target: a, target2: b, trait }, now);
    return;
  }
  const type = (cards.find((c) => c.type === 'testimony') || cards.find((c) => c.type === 'warrant') || {}).type;
  if (!type) return;
  const priv = privateFacts(game, id);
  const lp = logPost(game, id, { h: strat.persona.h, detect: strat.persona.dp, clear: priv.clear, lie: priv.lie, priv: game.lab.priv[id] ? Object.assign({}, game.lab.priv[id]) : {} }, rand);
  const target = argmax(lp, (k) => pl(game, k).status === 'active' && (!pl(game, k).revealed.profession || !pl(game, k).revealed.habit));
  if (!target) return;
  const tp = pl(game, target);
  const trait = !tp.revealed.profession ? 'profession' : 'habit';
  const r = E.act(game, id, 'card', { type, target, trait }, now);
  if (r.ok && type === 'warrant') {
    const fooled = tp.notes.some((x) => x.kind === 'trail' && x.targetId === id && x.round === game.round);
    game.lab.priv[id] = game.lab.priv[id] || {};
    game.lab.priv[id][target] = Object.assign(game.lab.priv[id][target] || {}, { [trait]: fooled ? 'fake' : true });
  }
}

/* ---------- Серии ---------- */
const KILLERS = {
  random:        { reveal: 'random', alibi: 'free', plant: false, killerPush: 0.0 },
  stall:         { reveal: 'stall', alibi: 'free', plant: false, killerPush: 0.0 },
  stallNoSecret: { reveal: 'stallNoSecret', alibi: 'free', plant: false, killerPush: 0.0 },
  mimic:         { reveal: 'mimic', alibi: 'free', plant: false, killerPush: 0.0 },
  smart:         { reveal: 'smart', alibi: 'free', plant: false, killerPush: 0.0 },
  smartPlant:    { reveal: 'smart', alibi: 'free', plant: true, killerPush: 0.0 },
  smartPush:     { reveal: 'smart', alibi: 'free', plant: true, killerPush: 0.35 },
  naiveAlibi:    { reveal: 'smart', alibi: 'random', plant: true, killerPush: 0.35 },
};

function run({ games = 600, n = 8, mix = 'human', killer = 'smart', extraPersona = null, seed = 1 }) {
  const mixObj = typeof mix === 'string' ? MIXES[mix] : mix;
  const kStrat = KILLERS[killer];
  const out = { n, mix: typeof mix === 'string' ? mix : 'custom', killer, games, wins: 0, byKick: { r1: 0, r2: 0, r3: 0, final: 0, escaped: 0 }, innocentKicks: 0, top: [0, 0, 0, 0], uniq: [0, 0, 0, 0], cnt: [0, 0, 0, 0], pk: [0, 0, 0, 0], errors: [] };
  for (let g = 0; g < games; g++) {
    try {
      const r = playGame({ n, caseData: Cases.CASES[(g + seed) % Cases.CASES.length], seed: seed * 100003 + g * 7 + n, mix: mixObj, kStrat });
      if (r.win) out.wins++;
      const key = r.win ? (r.kickRound >= 4 ? 'final' : 'r' + r.kickRound) : 'escaped';
      out.byKick[key]++;
      out.innocentKicks += r.kicks.filter((k) => k !== 'killer').length;
      r.trace.rounds.forEach((t) => { const i = Math.min(3, t.round - 1); out.cnt[i]++; out.top[i] += t.top ? 1 : 0; out.uniq[i] += t.unique && t.top ? 1 : 0; out.pk[i] += t.pk; });
    } catch (e) { out.errors.push(String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); if (out.errors.length > 3) break; }
  }
  out.win = out.wins / games;
  return out;
}

module.exports = { logPost, privateFacts, pooled, chooseReveal, argmax, softPick, makeRand, pickPersona, hiddenTagTraits, ABL, run, playGame, PERSONAS, MIXES, KILLERS };

if (require.main === module) {
  const games = Number(process.argv[2] || 600);
  const ns = (process.argv[3] || '6,8,10').split(',').map(Number);
  const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
  for (const n of ns) {
    console.log(`\n=== ${n} игроков, ${games} партий на клетку: доля побед невиновных ===`);
    const head = Object.keys(KILLERS);
    console.log('состав игроков'.padEnd(14) + head.map((h) => h.padStart(14)).join(''));
    for (const mix of Object.keys(MIXES)) {
      const row = head.map((k) => { const r = run({ games, n, mix, killer: k }); if (r.errors.length) console.log('ОШИБКА', r.errors[0]); return pct(r.win).padStart(14); });
      console.log(mix.padEnd(14) + row.join(''));
    }
  }
}
