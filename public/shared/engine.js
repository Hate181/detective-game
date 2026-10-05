/* Движок партии, версия 2. Работает и на сервере, и в браузере (демо-режим).
   Ход партии: раунд = улика, круг рассказов (каждый по очереди), общее обсуждение, голосование и обязательное исключение.
   Четвёртый раунд: рассказы, обсуждение, опрос, слово защиты двоих, финальное голосование.
   Всегда есть один ведущий: он листает фазы кнопкой «Дальше» и при этом сам играет.
   Все тексты событий без рода: «Исключён: Имя», «получает слово». */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const E = factory(require('./content.js'), require('./generator.js'), require('./rng.js'));
    require('./bots.js')(E);
    module.exports = E;
  } else {
    root.DetectiveEngine = factory(root.DetectiveContent, root.DetectiveGenerator, root.DetectiveRng);
  }
})(typeof self !== 'undefined' ? self : this, function (Content, Generator, RngMod) {
  const { Rng } = RngMod;
  const { TRAITS, TRAIT_KEYS, SAFE_TRAITS, ASKABLE_TRAITS, SEARCHABLE_TRAITS, CARDS, DURATIONS } = Content;

  const ROUNDS = 4;
  const PH = {
    BRIEF: 'brief', CLUE: 'clue', TURNS: 'turns', TALK: 'talk', VOTE: 'vote', RESULT: 'result',
    POLL: 'poll', DEFENSE: 'defense', FINAL: 'final', VERDICT: 'verdict', ACCOMPLICE: 'accomplice', ENDED: 'ended',
  };
  const VOTE_PHASES = [PH.VOTE, PH.POLL, PH.FINAL];

  class GameError extends Error {}
  const bad = (m) => { throw new GameError(m); };

  const dur = (game, key) => Math.max(1200, Math.round((game.settings.durations[key] || DURATIONS[key]) * (game.settings.speed || 1) * 1000));

  /* ---------- Создание партии ---------- */

  function createGame(opts) {
    const { caseData, players, settings = {}, seed = (Date.now() & 0x7fffffff), now = Date.now(), history = {}, forceKiller = null, forceAccomplice = null, hostId = null } = opts;
    const rng = new Rng(seed);
    const ids = players.map((p) => p.id);
    const n = ids.length;
    if (n < 4) bad('Для партии нужно минимум 4 человека.');

    let killerId = forceKiller && ids.includes(forceKiller) ? forceKiller : null;
    if (!killerId) {
      // Реже выпадает тем, кто уже был убийцей в этой компании.
      const w = ids.map((id) => 1 / Math.pow(1 + ((history.killerCounts || {})[id] || 0), 2));
      let r = rng.next() * w.reduce((a, b) => a + b, 0);
      killerId = ids[ids.length - 1];
      for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r <= 0) { killerId = ids[i]; break; } }
    }
    const rules = Object.assign({ oneOfTwo: true, finaleAt: 3, gang: true, labTo: 'innocent', labCount: n <= 6 ? 2 : 1 }, settings.rules);
    const accompliceId = (rules.gang ? n >= 6 : n >= 8) ? (forceAccomplice && forceAccomplice !== killerId && ids.includes(forceAccomplice) ? forceAccomplice : rng.pick(ids.filter((id) => id !== killerId))) : null;
    const gang = !!(rules.gang && accompliceId);
    const gen = Generator.generate({ caseData, ids, killerId, accompliceId, gang, rng });

    const game = {
      seed, caseData: JSON.parse(JSON.stringify(Object.assign({}, caseData, { professions: undefined }))),
      settings: { mode: 'host', discuss: 90, speed: 1, durations: {}, ...settings, rules },
      hostId: hostId && ids.includes(hostId) ? hostId : ids[0],
      createdAt: now, startedAt: now, endedAt: null,
      rng, killerId, accompliceId, gang, finalLeft: 0, scene: gen.scene,
      phase: PH.BRIEF, phaseStartedAt: now, phaseEndsAt: 0, autoAt: null, paused: false, pausedAt: 0, wasManual: null,
      round: 0, order: ids.slice(), players: {},
      clues: gen.clues.map((c) => Object.assign({ revealedRound: null }, c)),
      overlay: null, feed: [], feedSeq: 0, kicks: [], suspicions: [], plants: [], votesLog: [],
      turn: null, vote: null, poll: null, defense: null, verdict: null, results: null, decisive: null,
      botDue: {}, botMem: {},
    };
    game.settings.durations = Object.assign({}, game.settings.durations);
    game.settings.durations.talk = game.settings.discuss;

    players.forEach((p) => {
      const c = gen.cards[p.id];
      const role = p.id === killerId ? 'killer' : p.id === accompliceId ? 'accomplice' : 'innocent';
      game.players[p.id] = {
        id: p.id, name: p.name, bot: !!p.bot, auto: !!p.bot, role, card: c,
        cards: [{ type: c.cardType, used: false }],
        revealed: {}, secretRevealed: false, status: 'active', notes: [],
        ready: false, alibiChosen: role !== 'killer', left: false,
      };
    });
    game.phaseEndsAt = now + dur(game, 'brief');
    pushFeed(game, now, { kind: 'system', text: `Дело открыто: ${game.caseData.title}. Жертва: ${game.caseData.victim}. Время смерти ${game.caseData.time}.` });
    return game;
  }

  /* ---------- Утилиты ---------- */

  const P = (game, id) => game.players[id];
  const nm = (game, id) => (game.players[id] ? game.players[id].name : '?');
  const active = (game) => game.order.map((id) => game.players[id]).filter((p) => p.status === 'active');
  const unusedCard = (p, type) => p.cards.findIndex((c) => !c.used && (!type || c.type === type));
  const isFinale = (game) => game.round >= ROUNDS;

  /** Ведущий листает фазы сам, пока он на связи. Если пропал, партия идёт по таймерам. */
  function isManual(game) {
    if (game.settings.mode !== 'host') return false;
    const h = game.players[game.hostId];
    return !!h && !h.auto;
  }

  function pushFeed(game, now, ev) {
    game.feed.push(Object.assign({ id: ++game.feedSeq, t: now }, ev));
    if (game.feed.length > 400) game.feed.shift();
  }

  function alibiText(claim) {
    return claim ? `«${claim.loc}», с ${claim.from} до ${claim.to}` : 'Алиби ещё не выбрано';
  }

  function secretText(game, p) {
    const s = p.card.secret;
    if (s.kind === 'meet') return `«${s.loc}»: тайная встреча с игроком ${nm(game, s.partnerId)}`;
    if (s.kind === 'loc') return `«${s.loc}»: ${s.text}`;
    return s.text;
  }
  function goalText(game, p) {
    const g = p.card.goal;
    const who = nm(game, g.target);
    return { arrest: `Добиться исключения игрока ${who}`, protect: `Не допустить исключения игрока ${who}`, expose: `Раскрыть секрет игрока ${who}`, hide: `Скрыть связь с игроком ${who}` }[g.type];
  }

  function traitValue(game, p, trait) {
    const c = p.card;
    switch (trait) {
      case 'profession': return { text: c.profession, tags: c.proTags };
      case 'habit': return { text: c.habitText, tags: c.habitTags };
      case 'relation': return { text: c.relation };
      case 'motive': return { text: c.motive };
      case 'alibi': return { text: alibiText(c.alibi.claim), loc: c.alibi.claim && c.alibi.claim.loc, from: c.alibi.claim && c.alibi.claim.from, to: c.alibi.claim && c.alibi.claim.to };
      case 'secret': return { text: secretText(game, p) };
      case 'goal': return { text: goalText(game, p) };
      default: return { text: '' };
    }
  }

  const lies = (p) => !!(p.card.alibi.claim && p.card.alibi.claim.loc !== p.card.alibi.real.loc);

  function shownTags(p) {
    const out = [];
    if (p.revealed.profession) out.push(...p.card.proTags);
    if (p.revealed.habit) out.push(...p.card.habitTags);
    return Array.from(new Set(out));
  }

  function publicReveal(game, now, p, trait, how) {
    p.revealed[trait] = true;
    if (trait === 'secret') p.secretRevealed = true;
    const v = traitValue(game, p, trait);
    pushFeed(game, now, { kind: 'reveal', who: p.id, trait, text: `${p.name} раскрывает: ${TRAITS[trait]}. ${v.text}`, how });
    return v;
  }

  /* ---------- Переходы между фазами ---------- */

  function setPhase(game, now, phase, durKey) {
    game.phase = phase;
    game.phaseStartedAt = now;
    game.phaseEndsAt = now + dur(game, durKey);
    // Эффектные паузы идут сами, даже когда ведущий листает вручную.
    game.autoAt = phase === PH.VERDICT ? game.phaseEndsAt : null;
    game.overlay = null;
    game.order.forEach((id) => { game.players[id].ready = false; });
  }

  function startRound(game, now) {
    game.round += 1;
    // Подменённая улика приходит по расписанию, как настоящая: по номеру и раунду её не отличить.
    const fresh = game.clues.filter((c) => c.revealedRound === null);
    const take = isFinale(game) ? fresh : fresh.slice(0, 1);
    take.forEach((c) => {
      c.revealedRound = game.round;
      pushFeed(game, now, { kind: 'clue', clueId: c.id, text: `Раунд ${game.round}. Найдена улика: ${c.text}` });
    });
    setPhase(game, now, PH.CLUE, 'clue');
    if (isFinale(game)) pushFeed(game, now, { kind: 'system', text: 'Последний раунд. После него останется один выбор: кого исключить окончательно.' });
  }

  function startTurns(game, now) {
    const act = active(game).map((p) => p.id);
    const start = (game.round - 1) % act.length;
    const queue = act.slice(start).concat(act.slice(0, start));
    game.turn = { queue, idx: -1, speakerId: null, revealed: false, round: game.round };
    nextTurn(game, now);
  }

  function nextTurn(game, now) {
    const t = game.turn;
    t.idx += 1;
    while (t.idx < t.queue.length && P(game, t.queue[t.idx]).status !== 'active') t.idx += 1;
    if (t.idx >= t.queue.length) { t.speakerId = null; return startTalk(game, now); }
    game.phase = PH.TURNS;
    game.phaseStartedAt = now;
    game.phaseEndsAt = now + dur(game, 'turn');
    game.autoAt = null;
    game.overlay = null;
    t.speakerId = t.queue[t.idx];
    t.revealed = false;
    pushFeed(game, now, { kind: 'turn', who: t.speakerId, text: `Слово: ${nm(game, t.speakerId)}.` });
  }

  /** Профессию и особенность сами открывают только одну из двух: вторая всплывёт от «Обыска», «Показаний» или исключения.
      Тогда «открыли обе и вычеркнули всех, кто не подходит» перестаёт решать дело за пару раундов. */
  function lockedTrait(game, p, trait) {
    if (!game.settings.rules.oneOfTwo) return false;
    return (trait === 'habit' && !!p.revealed.profession) || (trait === 'profession' && !!p.revealed.habit);
  }
  const volunteerable = (game, p) => [...SAFE_TRAITS, 'secret'].filter((t) => !p.revealed[t] && !lockedTrait(game, p, t));

  function randomSafeTrait(game, p) {
    const left = SAFE_TRAITS.filter((t) => !p.revealed[t] && !lockedTrait(game, p, t));
    return left.length ? game.rng.pick(left) : null;
  }

  function endTurn(game, now) {
    const t = game.turn;
    const p = P(game, t.speakerId);
    if (p && !t.revealed) {
      const tr = randomSafeTrait(game, p);
      if (tr) publicReveal(game, now, p, tr, 'auto');
    }
    nextTurn(game, now);
  }

  function startTalk(game, now) {
    setPhase(game, now, PH.TALK, 'talk');
    pushFeed(game, now, { kind: 'system', text: 'Все высказались. Теперь свободное обсуждение: спрашивайте, сверяйте алиби, спорьте.' });
  }

  function endPhase(game, now) {
    switch (game.phase) {
      case PH.BRIEF:
        game.order.forEach((id) => {
          const p = game.players[id];
          if (p.role === 'killer' && !p.alibiChosen) chooseAlibi(game, p, game.rng.pick(game.caseData.locations.filter((l) => l !== game.scene)));
        });
        startRound(game, now);
        break;
      case PH.CLUE: startTurns(game, now); break;
      case PH.TURNS: endTurn(game, now); break;
      case PH.TALK: if (isFinale(game)) startVote(game, now, 'poll'); else startVote(game, now, 'kick'); break;
      case PH.VOTE: tallyVote(game, now); break;
      case PH.RESULT: afterResult(game, now); break;
      case PH.POLL: tallyPoll(game, now); break;
      case PH.DEFENSE: nextDefender(game, now); break;
      case PH.FINAL: resolveFinal(game, now); break;
      case PH.VERDICT: afterVerdict(game, now); break;
      case PH.ACCOMPLICE: finishAccomplice(game, now, { mode: 'stealth' }); break;
      default: break;
    }
  }

  function chooseAlibi(game, p, loc) {
    const c = p.card.alibi;
    c.claim = { loc, from: c.window.from, to: c.window.to };
    p.alibiChosen = true;
  }

  /* ---------- Голосования ---------- */

  const VOTE_KEY = { kick: 'vote', poll: 'poll', final: 'final' };
  const VOTE_PH = { kick: PH.VOTE, poll: PH.POLL, final: PH.FINAL };

  function startVote(game, now, kind, extra = {}) {
    const candidates = extra.candidates || active(game).map((p) => p.id);
    setPhase(game, now, VOTE_PH[kind], extra.runoff ? 'poll' : VOTE_KEY[kind]);
    game.vote = { kind, candidates, votes: {}, runoff: !!extra.runoff, count: null };
    const text = kind === 'kick'
      ? (extra.runoff ? `Ничья. Переголосование между: ${candidates.map((id) => nm(game, id)).join(', ')}.` : `Голосование. Каждый указывает, кого исключить. Исключить придётся одного.`)
      : kind === 'poll' ? (game.gang ? 'Четыре раунда позади. Каждый тайно указывает на самого подозрительного. Трое с наибольшим числом голосов получат слово защиты.' : 'Четыре раунда позади. Каждый тайно указывает на самого подозрительного. Двое с наибольшим числом голосов получат слово защиты.')
        : extra.more ? 'Ещё одно исключение. Голосуют все, кто ещё в игре, выбор между оставшимися.'
          : 'Финал. Голосуют все, кто ещё в игре. Исключённый больше не вернётся.';
    pushFeed(game, now, { kind: 'system', text });
  }

  function voteCounts(game, votes, candidates) {
    const count = {};
    candidates.forEach((id) => { count[id] = 0; });
    Object.entries(votes).forEach(([by, t]) => { if (count[t] !== undefined && P(game, by) && P(game, by).status === 'active') count[t] += 1; });
    return count;
  }

  // Кто не проголосовал, голосует против себя. Если его нет среди кандидатов (переголосование, финал), голос пропадает.
  function fillMissingVotes(game, v) {
    v.auto = [];
    active(game).forEach((p) => {
      if (v.votes[p.id]) return;
      v.auto.push(p.id);
      if (v.candidates.includes(p.id)) v.votes[p.id] = p.id;
    });
  }

  function logVotes(game, now, v) {
    const auto = v.auto || [];
    const votes = Object.entries(v.votes).filter(([by]) => P(game, by).status === 'active');
    votes.filter(([by]) => !auto.includes(by)).forEach(([by, target]) => game.suspicions.push({ t: now, by, target, kind: v.kind }));
    game.votesLog.push({ t: now, round: game.round, kind: v.kind, runoff: v.runoff, votes: Object.fromEntries(votes), auto: auto.slice(), count: Object.assign({}, v.count) });
    const lines = votes.filter(([by]) => !auto.includes(by)).map(([by, t]) => `${nm(game, by)} → ${nm(game, t)}`);
    const self = auto.filter((id) => v.candidates.includes(id)), lost = auto.filter((id) => !v.candidates.includes(id));
    if (self.length) lines.push(`без выбора, голос против себя: ${self.map((id) => nm(game, id)).join(', ')}`);
    if (lost.length) lines.push(`без выбора, голос пропал: ${lost.map((id) => nm(game, id)).join(', ')}`);
    pushFeed(game, now, { kind: 'vote', text: `Голоса: ${lines.join('; ') || 'никто не проголосовал'}.` });
  }

  function tallyVote(game, now) {
    const v = game.vote;
    fillMissingVotes(game, v);
    v.count = voteCounts(game, v.votes, v.candidates);
    logVotes(game, now, v);
    const max = Math.max(...v.candidates.map((id) => v.count[id]));
    const leaders = v.candidates.filter((id) => v.count[id] === max);
    if (leaders.length > 1 && max > 0 && !v.runoff) return startVote(game, now, 'kick', { candidates: leaders, runoff: true });
    let via = v.runoff ? 'runoff' : 'vote';
    let leader = leaders[0];
    if (leaders.length > 1) { leader = game.rng.pick(leaders); via = 'random'; pushFeed(game, now, { kind: 'vote', text: 'Голоса снова поровну. Решает жребий.' }); }
    resolveKick(game, now, leader, via);
  }

  function tallyPoll(game, now) {
    const v = game.vote;
    fillMissingVotes(game, v);
    v.count = voteCounts(game, v.votes, v.candidates);
    logVotes(game, now, v);
    const ranked = v.candidates.slice().sort((a, b) => v.count[b] - v.count[a] || (game.rng.next() - 0.5));
    game.finalLeft = game.gang ? Math.min(2, active(game).length - 1) : 1;
    const finalists = ranked.slice(0, game.finalLeft + 1);
    game.poll = { count: Object.assign({}, v.count), finalists: finalists.slice() };
    game.defense = { order: game.rng.shuffle(finalists), idx: -1 };
    pushFeed(game, now, { kind: 'system', text: `Больше всего подозрений: ${finalists.map((id) => `${nm(game, id)} (${v.count[id]})`).join(', ')}. Слово защиты.` });
    nextDefender(game, now);
  }

  function nextDefender(game, now) {
    game.defense.idx += 1;
    if (game.defense.idx >= game.defense.order.length) return startVote(game, now, 'final', { candidates: game.poll.finalists.slice() });
    setPhase(game, now, PH.DEFENSE, 'defense');
    pushFeed(game, now, { kind: 'turn', who: game.defense.order[game.defense.idx], text: `Слово защиты: ${nm(game, game.defense.order[game.defense.idx])}.` });
  }

  function resolveFinal(game, now) {
    const v = game.vote;
    fillMissingVotes(game, v);
    v.count = voteCounts(game, v.votes, v.candidates);
    logVotes(game, now, v);
    const max = Math.max(...v.candidates.map((id) => v.count[id]));
    let leaders = v.candidates.filter((id) => v.count[id] === max);
    if (leaders.length > 1) {
      const pmax = Math.max(...leaders.map((id) => game.poll.count[id] || 0));
      leaders = leaders.filter((id) => (game.poll.count[id] || 0) === pmax);
    }
    const leader = leaders.length > 1 ? game.rng.pick(leaders) : leaders[0];
    resolveKick(game, now, leader, 'final');
  }

  function resolveKick(game, now, leaderId, via) {
    const lp = P(game, leaderId);
    const v = game.vote;
    const voters = Object.keys(v.votes).filter((by) => v.votes[by] === leaderId && by !== leaderId && P(game, by).status === 'active');
    const options = [];
    if (unusedCard(lp, 'advocate') >= 0 && voters.length > 0) options.push('advocate');
    if (options.length) {
      game.overlay = { type: 'save', nomineeId: leaderId, via, options, voters, endsAt: now + dur(game, 'advocate') };
      game.autoAt = null;
      pushFeed(game, now, { kind: 'system', text: `${lp.name} может сыграть карту защиты.` });
      return;
    }
    doKick(game, now, leaderId, via);
  }

  function doKick(game, now, id, via) {
    const v = game.vote;
    game.overlay = null;
    const p = P(game, id);
    p.status = 'out';
    TRAIT_KEYS.filter((t) => t !== 'secret').forEach((t) => { p.revealed[t] = true; });
    const entry = { id, kind: v.kind, via, round: game.round, t: now, role: p.role, count: Object.assign({}, v.count), votes: Object.assign({}, v.votes) };
    game.kicks.push(entry);
    game.decisive = { kind: v.kind, votes: Object.assign({}, v.votes) };
    const roleText = p.role === 'killer' ? 'убийца' : p.role === 'accomplice' ? 'сообщник убийцы' : 'невиновный';
    pushFeed(game, now, { kind: 'kick', who: id, text: `Исключён: ${p.name}. Карточка вскрыта: ${roleText}.` });
    const criminalsLeft = active(game).filter((a) => a.role !== 'innocent').length;
    if (game.gang) {
      if (p.role !== 'innocent' && criminalsLeft === 0) return startVerdict(game, now, 'innocent', 'caught', id);
      // Преступников стало столько же, сколько невиновных (2 на 2, 1 на 1): исключать больше некого, они побеждают.
      if (criminalsLeft > 0 && criminalsLeft >= active(game).length - criminalsLeft) return startVerdict(game, now, 'killer', 'outnumbered', id);
      if (p.role !== 'innocent') pushFeed(game, now, { kind: 'system', text: p.role === 'killer' ? 'Убийцы больше нет среди вас, но сообщник ещё в игре. Дело не закрыто.' : 'Сообщник исключён, но убийца ещё среди вас. Дело не закрыто.' });
    } else if (p.role === 'killer') return startVerdict(game, now, 'innocent', 'caught', id);
    rubberBand(game, now, p, v.kind);
    if (v.kind === 'final') {
      game.finalLeft = Math.max(0, game.finalLeft - 1);
      const rest = v.candidates.filter((c) => c !== id && P(game, c).status === 'active');
      if (game.gang && game.finalLeft > 0 && rest.length > 1) return startVote(game, now, 'final', { candidates: rest, more: true });
      return startVerdict(game, now, 'killer', 'escaped', id);
    }
    setPhase(game, now, PH.RESULT, 'result');
  }

  /** Резинка баланса: отстающая сторона получает карту, лидер ничего.
      Исключили невиновного в раундах 1–3: «Экспертизу» получает случайный невиновный (за столом на шестерых двое).
      Исключили преступника в раундах 1–3, а второй ещё в игре: он получает «Ложный след». Карта пассивная и тайная:
      первый «Обыск» опасного пункта или «Экспертиза» против него покажут чистый результат. */
  function rubberBand(game, now, kicked, kind) {
    const act = active(game);
    const rules = game.settings.rules;
    if (kind !== 'kick') return;
    if (kicked.role === 'innocent') {
      const pool = rules.labTo === 'innocent' ? act.filter((a) => a.role === 'innocent') : act;
      if (!pool.length) return;
      game.rng.shuffle(pool).slice(0, rules.labCount || 1).forEach((a) => a.cards.push({ type: 'lab', used: false, got: game.round }));
      pushFeed(game, now, { kind: 'card', text: 'Улики ушли на экспертизу: один из оставшихся получил карту «Экспертиза».' });
      return;
    }
    if (!game.gang || rules.trail === false) return;
    act.filter((a) => a.role !== 'innocent').forEach((c) => c.cards.push({ type: 'trail', used: false, got: game.round }));
  }

  /** «Ложный след»: если у цели есть несработавшая карта, она срабатывает и возвращает true. */
  function useTrail(game, now, t, by, what) {
    const i = unusedCard(t, 'trail');
    if (i < 0) return false;
    t.cards[i].used = true;
    t.notes.push({ t: now, round: game.round, kind: 'trail', targetId: by.id, trait: null, text: `Сработал «Ложный след»: игрок ${by.name} проверил ${what} и увидел чистый результат.` });
    return true;
  }

  /** Безобидная подмена профессии или особенности: без меток, которые есть в уликах. */
  function cleanValue(game, t, trait) {
    const clueTags = new Set(game.clues.map((c) => c.tag));
    if (trait === 'profession') {
      const own = (game.caseData.professions || []).concat(Content.GENERIC_PROFESSIONS);
      const ok = own.filter((x) => x.name !== t.card.profession && !(x.tags || []).some((g) => clueTags.has(g)));
      return ok.length ? game.rng.pick(ok).name : t.card.profession;
    }
    const pool = Content.HABIT_TAGS.filter((g) => !clueTags.has(g));
    return game.rng.sample(pool, Math.max(2, t.card.habitTags.length)).map((g) => Content.TAGS[g].habit).join(', ');
  }

  function afterResult(game, now) {
    // Дальше всегда идёт следующий раунд; когда людей мало, сразу финал.
    if (active(game).length <= ((game.settings.rules && game.settings.rules.finaleAt) || 3) && game.round < ROUNDS) game.round = ROUNDS - 1;
    startRound(game, now);
  }

  function startVerdict(game, now, winner, reason, kickedId) {
    setPhase(game, now, PH.VERDICT, 'verdict');
    game.verdict = { winner, reason, kickedId, round: game.round };
    const text = reason === 'caught' ? (game.gang ? 'Убийца и сообщник исключены. Невиновные победили.' : 'Убийца исключён. Невиновные победили.')
      : reason === 'outnumbered' ? 'Преступников осталось столько же, сколько невиновных. Они победили.'
      : game.gang ? 'Исключения закончились, а кто-то из преступников остался на свободе.' : 'Исключили невиновного. Убийца остаётся на свободе.';
    pushFeed(game, now, { kind: 'verdict', text });
  }

  function afterVerdict(game, now) {
    const acc = game.accompliceId && P(game, game.accompliceId);
    if (!game.gang && game.verdict.winner === 'innocent' && acc && acc.status === 'active') {
      setPhase(game, now, PH.ACCOMPLICE, 'accomplice');
      pushFeed(game, now, { kind: 'system', text: 'У сообщника последний шанс: назвать самого опасного невиновного или уйти незамеченным.' });
    } else finish(game, now);
  }

  function finishAccomplice(game, now, choice) {
    game.accompliceChoice = choice;
    finish(game, now);
  }

  function finish(game, now) {
    game.phase = PH.ENDED;
    game.phaseEndsAt = null;
    game.autoAt = null;
    game.overlay = null;
    game.endedAt = now;
    game.results = computeResults(game);
    pushFeed(game, now, { kind: 'system', text: 'Дело закрыто.' });
  }

  /* ---------- Подсчёт очков, награды, хронология ---------- */

  function computeResults(game) {
    const winner = game.verdict.winner;
    const ids = game.order;
    const items = {}, total = {};
    ids.forEach((id) => { items[id] = []; total[id] = 0; });
    const add = (id, label, val) => { items[id].push({ label, val }); total[id] += val; };

    const kickedIds = game.kicks.map((a) => a.id);
    ids.forEach((id) => {
      const p = P(game, id);
      const team = p.role === 'innocent' ? 'innocent' : 'killer';
      if (team === winner) add(id, 'Команда победила', 4);
      if (!p.secretRevealed) add(id, 'Секрет не всплыл', 2);
      const g = p.card.goal, tp = P(game, g.target);
      const done = g.type === 'arrest' ? kickedIds.includes(g.target)
        : g.type === 'protect' ? !kickedIds.includes(g.target)
          : g.type === 'expose' ? tp.secretRevealed
            : !p.secretRevealed && !tp.secretRevealed;
      p.goalDone = done;
      if (done) add(id, 'Личная цель выполнена', 3);
    });
    // Голосовавшие против убийцы (один раз на человека)
    const guessed = new Set();
    game.suspicions.forEach((s) => { if ((s.target === game.killerId || (game.gang && s.target === game.accompliceId)) && P(game, s.by).role === 'innocent') guessed.add(s.by); });
    guessed.forEach((id) => add(id, game.gang ? 'Голосовал против преступников' : 'Голосовал против убийцы', 2));
    // Сообщник
    const accChoice = game.accompliceChoice;
    if (game.accompliceId && accChoice) {
      const sus = game.suspicions.filter((s) => s.target === game.accompliceId).length;
      if (accChoice.mode === 'stealth' && sus === 0) add(game.accompliceId, 'Ушёл незамеченным', 3);
      if (accChoice.mode === 'target') {
        const sherlock = findSherlock(game);
        if (sherlock && sherlock === accChoice.target) add(game.accompliceId, 'Назвал самого опасного', 4);
      }
    }
    ids.forEach((id) => { total[id] = Math.max(0, total[id]); });

    const awards = computeAwards(game);
    const rank = ids.slice().sort((a, b) => total[b] - total[a]);
    const chronology = ids.map((id) => {
      const p = P(game, id);
      return {
        id, name: p.name, role: p.role, claim: p.card.alibi.claim, real: p.card.alibi.real, lied: lies(p),
        secret: secretText(game, p), goal: goalText(game, p), goalDone: !!p.goalDone, profession: p.card.profession,
        habit: p.card.habitText, relation: p.card.relation, motive: p.card.motive, witnesses: p.card.witnesses.map((w) => nm(game, w)),
        out: p.status === 'out', tags: p.card.tags,
      };
    });
    return {
      gang: !!game.gang, winner, reason: game.verdict.reason, kickedId: game.verdict.kickedId, killerId: game.killerId, accompliceId: game.accompliceId,
      scene: game.scene, murderTime: game.caseData.time, window: P(game, game.killerId).card.alibi.window,
      score: total, items, rank, awards, chronology, minutes: Math.max(1, Math.round((game.endedAt - game.startedAt) / 60000)),
      plants: game.plants, accompliceChoice: accChoice || null, sherlockId: findSherlock(game),
      clues: game.clues.map((c) => ({ id: c.id, text: c.text, tag: c.tag, planted: c.planted, round: c.revealedRound, fits: c.fits, orig: c.orig ? { text: c.orig.text, tag: c.orig.tag } : null })),
      kicks: game.kicks.map((k) => ({ id: k.id, kind: k.kind, via: k.via, round: k.round, role: k.role })),
      votes: game.votesLog, rounds: game.round,
    };
  }

  function findSherlock(game) {
    const list = game.suspicions.filter((s) => s.target === game.killerId && P(game, s.by) && P(game, s.by).role === 'innocent').sort((a, b) => a.t - b.t);
    return list.length ? list[0].by : null;
  }

  function computeAwards(game) {
    const out = [];
    const votesAgainst = {};
    game.suspicions.forEach((s) => { votesAgainst[s.target] = (votesAgainst[s.target] || 0) + 1; });
    // Лучший лжец
    const liars = game.order.map((id) => P(game, id)).filter((p) => lies(p) && p.revealed.alibi && p.status !== 'out');
    if (liars.length) {
      liars.sort((a, b) => (votesAgainst[a.id] || 0) - (votesAgainst[b.id] || 0) || (b.role === 'killer') - (a.role === 'killer'));
      const l = liars[0];
      out.push({ id: 'liar', title: Content.AWARDS.liar.title, playerId: l.id, text: `Алиби «${l.card.alibi.claim.loc}» никто не опроверг` });
    }
    const sh = findSherlock(game);
    if (sh) out.push({ id: 'sherlock', title: Content.AWARDS.sherlock.title, playerId: sh, text: 'Первым указал на убийцу' });
    const k = P(game, game.killerId);
    const matches = game.clues.filter((c) => !c.planted && shownTags(k).includes(c.tag)).length;
    if (matches >= 3) out.push({ id: 'self', title: Content.AWARDS.self.title, playerId: k.id, text: `Открытых совпадений с уликами: ${matches} из 4` });
    const pl = game.plants.find((x) => P(game, x.targetId).role === 'innocent' && game.kicks.some((a) => a.id === x.targetId && a.round >= x.round));
    if (pl) out.push({ id: 'framer', title: Content.AWARDS.framer.title, playerId: pl.by, text: `Подменённая улика привела к исключению игрока ${nm(game, pl.targetId)}` });
    return out;
  }

  /* ---------- Действия игроков ---------- */

  const HANDLERS = {};

  function needPhase(game, ...phases) { if (!phases.includes(game.phase)) bad('Сейчас это недоступно.'); }
  function needActive(p) { if (p.status !== 'active') bad('Вы исключены и наблюдаете за игрой.'); }
  function noOverlay(game) { if (game.overlay) bad('Подождите, идёт другое действие.'); }

  HANDLERS.ready = (game, p) => {
    if (game.phase === PH.BRIEF) { p.ready = true; return; }
    if (game.phase === PH.TALK) { needActive(p); p.ready = !p.ready; return; }
    bad('Сейчас это недоступно.');
  };

  HANDLERS.alibi = (game, p, pl) => {
    needPhase(game, PH.BRIEF);
    if (p.role !== 'killer') bad('Алиби выбирает только убийца.');
    if (!game.caseData.locations.includes(pl.loc) || pl.loc === game.scene) bad('Выберите другое место.');
    chooseAlibi(game, p, pl.loc);
  };

  HANDLERS.host = (game, p, pl, now) => {
    if (p.id !== game.hostId) bad('Это кнопки ведущего.');
    if (game.phase === PH.ENDED) bad('Дело уже закрыто.');
    if (pl.do === 'extend') {
      if (game.overlay || !game.phaseEndsAt) bad('Сейчас время не продлить.');
      game.phaseEndsAt += 30000;
      return;
    }
    if (pl.do !== 'next') bad('Неизвестная кнопка.');
    if (game.overlay) { resolveOverlayTimeout(game, now); return; }
    endPhase(game, now);
  };

  HANDLERS.reveal = (game, p, pl, now) => {
    needPhase(game, PH.TURNS);
    if (game.turn.speakerId !== p.id) bad('Сейчас говорит другой игрок.');
    if (game.turn.revealed) bad('Вы уже открыли карточку в этот ход.');
    if (![...SAFE_TRAITS, 'secret'].includes(pl.trait)) bad('Эту характеристику раскрыть нельзя.');
    if (p.revealed[pl.trait]) bad('Это уже раскрыто.');
    if (lockedTrait(game, p, pl.trait)) bad('Профессию и особенность сами открывают только одну из двух. Вторую раскроют карты или исключение.');
    game.turn.revealed = true;
    publicReveal(game, now, p, pl.trait, 'choice');
  };

  HANDLERS.endturn = (game, p, pl, now) => {
    needPhase(game, PH.TURNS);
    if (game.turn.speakerId !== p.id) bad('Сейчас говорит другой игрок.');
    endTurn(game, now);
  };

  HANDLERS.vote = (game, p, pl) => {
    needPhase(game, ...VOTE_PHASES);
    needActive(p);
    const v = game.vote;
    if (game.overlay) bad('Подождите, идёт другое действие.');
    if (!v.candidates.includes(pl.target) || pl.target === p.id) bad('Выберите другого игрока из списка.');
    v.votes[p.id] = pl.target;
  };

  /** Карта защиты, когда вас исключают: «Адвокат» или ничего. */
  HANDLERS.save = (game, p, pl, now) => {
    const ov = game.overlay;
    if (!ov || ov.type !== 'save' || ov.nomineeId !== p.id) bad('Сейчас вам нечего защищать.');
    const card = pl.card || 'none';
    if (card !== 'none' && !ov.options.includes(card)) bad('Такой карты у вас нет.');
    resolveSave(game, now, card, pl.target);
  };
  // Старое имя действия: «играть Адвоката» или «не играть».
  HANDLERS.advocate = (game, p, pl, now) => HANDLERS.save(game, p, { card: pl.play ? 'advocate' : 'none' }, now);

  function resolveSave(game, now, card, target) {
    const ov = game.overlay;
    const nominee = P(game, ov.nomineeId);
    const v = game.vote;
    game.overlay = null;
    let leader = ov.nomineeId;
    if (card === 'advocate') {
      nominee.cards[unusedCard(nominee, 'advocate')].used = true;
      const voters = Object.keys(v.votes).filter((by) => v.votes[by] === nominee.id && by !== nominee.id && P(game, by).status === 'active');
      const drop = game.rng.pick(voters);
      delete v.votes[drop];
      v.count = voteCounts(game, v.votes, v.candidates);
      pushFeed(game, now, { kind: 'card', text: `${nominee.name} играет Адвоката: один голос против отменён.` });
      const max = Math.max(...v.candidates.map((id) => v.count[id]));
      const leaders = v.candidates.filter((id) => v.count[id] === max);
      leader = leaders.length > 1 ? game.rng.pick(leaders) : leaders[0];
      if (leader !== nominee.id) pushFeed(game, now, { kind: 'card', text: `Адвокат спас ${nominee.name}, но исключают другого игрока.` });
    }
    doKick(game, now, leader, ov.via);
  }

  /* Карты действий: только в общем обсуждении */
  HANDLERS.card = (game, p, pl, now) => {
    needPhase(game, PH.TALK); noOverlay(game); needActive(p);
    const type = pl.type;
    if (type === 'advocate') bad('Адвоката играют, когда вас исключают.');
    const i = unusedCard(p, type);
    if (i < 0) bad('Такой карты у вас нет.');
    const t = pl.target ? P(game, pl.target) : null;
    if (type === 'warrant') {
      if (!t || t.id === p.id || t.status !== 'active') bad('Выберите другого игрока.');
      if (!SEARCHABLE_TRAITS.includes(pl.trait) || t.revealed[pl.trait]) bad('Эта характеристика уже известна.');
      let extra = null;
      // «Ложный след» тратится, только когда настоящий ответ выдал бы игрока: совпадение с уликой или ложное алиби.
      const clueTags = game.clues.map((c) => c.tag);
      const tv = traitValue(game, t, pl.trait);
      const danger = pl.trait === 'alibi' ? lies(t) : (tv.tags || []).some((g) => clueTags.includes(g));
      const fake = danger && useTrail(game, now, t, p, `пункт «${TRAITS[pl.trait]}»`);
      let text = tv.text;
      if (fake && pl.trait !== 'alibi') text = cleanValue(game, t, pl.trait);
      if (pl.trait === 'alibi') extra = lies(t) && !fake ? 'Алиби ложное: на самом деле игрок был в другом месте.' : 'Алиби подтверждается: игрок действительно был там.';
      p.notes.push({ t: now, round: game.round, targetId: t.id, trait: pl.trait, text, extra });
    } else if (type === 'testimony') {
      if (!t || t.id === p.id || t.status !== 'active') bad('Выберите другого игрока.');
      if (!ASKABLE_TRAITS.includes(pl.trait) || t.revealed[pl.trait]) bad('Эта характеристика уже известна.');
      pushFeed(game, now, { kind: 'card', text: `Показания: ${p.name} заставляет ${t.name} раскрыть «${TRAITS[pl.trait]}».` });
      publicReveal(game, now, t, pl.trait, 'testimony');
    } else if (type === 'gossip') {
      const text = String(pl.text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      if (!text) bad('Напишите, что вбросить.');
      pushFeed(game, now, { kind: 'gossip', text, author: p.id });
    } else if (type === 'swap') {
      if (!t || t.id === p.id || t.status !== 'active') bad('Выберите другого игрока.');
      const pool = swapPool(game);
      if (!pool.length) bad('Подменять уже нечего: все улики найдены.');
      const tag = pickSwapTag(game, t, p);
      if (!tag) bad('У этого игрока не за что зацепиться. Выберите другого.');
      const clue = game.rng.pick(pool);
      const no = game.clues.indexOf(clue) + 1;
      clue.orig = { tag: clue.tag, text: clue.text, fits: clue.fits };
      clue.tag = tag;
      clue.text = game.rng.pick(Content.TAGS[tag].clues);
      clue.fits = game.order.filter((id) => P(game, id).card.tags.includes(tag));
      clue.planted = true;
      game.plants.push({ by: p.id, targetId: t.id, round: game.round, clueId: clue.id, origTag: clue.orig.tag, origText: clue.orig.text });
      p.notes.push({ t: now, round: game.round, kind: 'swap', targetId: t.id, trait: null, text: `Улика ${no} подменена. Когда её найдут, она укажет на игрока ${t.name}.` });
    } else if (type === 'lab') {
      if (!t || t.id === p.id || t.status !== 'active') bad('Выберите другого игрока.');
      const clue = game.clues.find((c) => c.id === pl.clueId && c.revealedRound !== null);
      if (!clue) bad('Выберите одну из найденных улик.');
      const no = game.clues.indexOf(clue) + 1;
      const fits = t.card.tags.includes(clue.tag) && !useTrail(game, now, t, p, `улику ${no}`);
      p.notes.push({ t: now, round: game.round, kind: 'lab', targetId: t.id, trait: null, clueId: clue.id, fits, text: `Улика ${no} (${Content.TAGS[clue.tag].label.toLowerCase()}) ${fits ? 'подходит' : 'не подходит'}.` });
    } else bad('Неизвестная карта.');
    p.cards[i].used = true;
  };

  /** Какие улики ещё можно подменить: не найденные и не подменённые раньше. */
  const swapPool = (game) => game.clues.filter((c) => c.revealedRound === null && !c.planted);

  /** Метка для подмены: есть у цели, нет у того, кто подменяет, и не повторяет другие улики. */
  function pickSwapTag(game, target, by) {
    const used = new Set(game.clues.map((c) => c.tag));
    const options = target.card.tags.filter((t) => !used.has(t) && !by.card.tags.includes(t));
    if (!options.length) return null;
    const scored = options.map((t) => {
      const h = game.order.filter((id) => P(game, id).card.tags.includes(t)).length;
      return { t, s: (h >= 2 && h <= 3 ? 0 : 1) + game.rng.next() * 0.1 };
    }).sort((a, b) => a.s - b.s);
    return scored[0].t;
  }

  /** На кого игрок может навести подменённую улику: подсказка для интерфейса и ботов. */
  function swapTargets(game, p) {
    if (!swapPool(game).length) return [];
    return active(game).filter((t) => t.id !== p.id && pickSwapTag(game, t, p)).map((t) => t.id);
  }

  HANDLERS.endspeech = (game, p, pl, now) => {
    needPhase(game, PH.DEFENSE);
    if (game.defense.order[game.defense.idx] !== p.id) bad('Сейчас говорит другой игрок.');
    nextDefender(game, now);
  };

  HANDLERS.accomplice = (game, p, pl, now) => {
    needPhase(game, PH.ACCOMPLICE);
    if (p.id !== game.accompliceId) bad('Это решение сообщника.');
    if (pl.mode === 'target') {
      const t = P(game, pl.target);
      if (!t || t.role !== 'innocent') bad('Выберите одного из невиновных.');
      finishAccomplice(game, now, { mode: 'target', target: t.id });
    } else finishAccomplice(game, now, { mode: 'stealth' });
  };

  function act(game, playerId, action, payload, now = Date.now()) {
    const p = game.players[playerId];
    if (!p) return { ok: false, error: 'Вас нет в этой партии.' };
    const h = Object.prototype.hasOwnProperty.call(HANDLERS, action) ? HANDLERS[action] : null;
    if (!h) return { ok: false, error: 'Неизвестное действие.' };
    if (game.phase === PH.ENDED) return { ok: false, error: 'Дело уже закрыто.' };
    try {
      h(game, p, payload || {}, now);
      advance(game, now);
      return { ok: true };
    } catch (e) {
      if (e instanceof GameError) return { ok: false, error: e.message };
      throw e;
    }
  }

  /* ---------- Оверлей (адвокат), время, пауза ---------- */

  function resolveOverlayTimeout(game, now) {
    const ov = game.overlay;
    if (ov.type === 'save') resolveSave(game, now, 'none');
  }

  /** Все ли, от кого фаза ждёт ответа, уже ответили. */
  function allDone(game) {
    const act = active(game);
    if (game.phase === PH.BRIEF) return game.order.every((id) => game.players[id].ready || game.players[id].auto) && game.order.every((id) => game.players[id].alibiChosen);
    if (game.phase === PH.TALK) {
      const humans = act.filter((p) => !p.auto);
      const pool = humans.length ? humans : act;
      return pool.length > 0 && pool.every((p) => p.ready);
    }
    if (VOTE_PHASES.includes(game.phase)) return act.length > 0 && act.every((p) => game.vote.votes[p.id]);
    return false;
  }

  function advance(game, now) {
    if (game.overlay) return;
    if (VOTE_PHASES.includes(game.phase)) {
      // Все проголосовали: подводим итог сразу, ведущему ничего нажимать не надо.
      if (allDone(game) && !game.autoAt) game.autoAt = now + 1500;
      return;
    }
    if (isManual(game)) return;
    if ([PH.BRIEF, PH.TALK].includes(game.phase) && allDone(game) && game.phaseEndsAt && game.phaseEndsAt - now > 1300) game.phaseEndsAt = now + 1300;
  }

  function tick(game, now = Date.now()) {
    if (game.phase === PH.ENDED || game.paused) return false;
    let changed = false;
    const manual = isManual(game);
    if (game.wasManual && !manual && game.phaseEndsAt && now > game.phaseEndsAt) game.phaseEndsAt = now + 15000;
    game.wasManual = manual;
    if (E.botStep) changed = E.botStep(game, now) || changed;
    for (let guard = 0; guard < 6; guard++) {
      if (game.overlay) {
        if (game.overlay.endsAt && now >= game.overlay.endsAt) { resolveOverlayTimeout(game, now); changed = true; continue; }
        break;
      }
      if (game.autoAt && now >= game.autoAt) { endPhase(game, now); changed = true; continue; }
      if (!isManual(game) && game.phaseEndsAt && now >= game.phaseEndsAt) { endPhase(game, now); changed = true; continue; }
      break;
    }
    advance(game, now);
    return changed;
  }

  function pause(game, now) { if (!game.paused) { game.paused = true; game.pausedAt = now; } }
  function resume(game, now) {
    if (!game.paused) return;
    const d = now - game.pausedAt;
    game.paused = false;
    if (game.phaseEndsAt) game.phaseEndsAt += d;
    if (game.autoAt) game.autoAt += d;
    if (game.overlay && game.overlay.endsAt) game.overlay.endsAt += d;
    Object.keys(game.botDue).forEach((k) => { game.botDue[k] += d; });
  }
  function skip(game, now) {
    if (game.phase === PH.ENDED) return;
    game.paused = false;
    if (game.overlay) { resolveOverlayTimeout(game, now); return; }
    endPhase(game, now);
  }

  /** Передать ведение другому игроку (хаб вызывает, когда ведущий вышел из комнаты). */
  function setHost(game, id, now = Date.now()) {
    if (!game.players[id] || game.hostId === id) return;
    game.hostId = id;
    pushFeed(game, now, { kind: 'system', text: `Ведущий теперь ${nm(game, id)}.` });
  }

  /* ---------- Представление для клиента ---------- */

  function chips(tags) { return (tags || []).map((t) => ({ key: t, label: Content.TAGS[t].label })); }

  function viewCard(game, p) {
    const c = p.card;
    return {
      profession: c.profession, proTags: chips(c.proTags), habit: c.habitText, habitTags: chips(c.habitTags),
      relation: c.relation, motive: c.motive,
      alibi: { claim: c.alibi.claim, real: c.alibi.real, lied: lies(p), window: c.alibi.window },
      secret: secretText(game, p), secretKind: c.secret.kind, goal: goalText(game, p),
      witnesses: c.witnesses.map((id) => ({ id, name: nm(game, id) })),
    };
  }

  function view(game, viewerId, opts = {}) {
    const me = game.players[viewerId];
    const ended = game.phase === PH.ENDED;
    const voting = VOTE_PHASES.includes(game.phase) && game.vote;
    const turn = game.turn && game.phase === PH.TURNS ? game.turn : null;
    const players = game.order.map((id) => {
      const p = game.players[id];
      const rev = {};
      TRAIT_KEYS.forEach((t) => { if (p.revealed[t] || ended) rev[t] = traitValue(game, p, t); });
      const knowsRole = ended || p.status === 'out' || (me && (me.role !== 'innocent') && p.role !== 'innocent') || id === viewerId;
      const qi = game.turn ? game.turn.queue.indexOf(id) : -1;
      return {
        id, name: p.name, bot: p.bot, status: p.status, revealed: rev,
        tags: chips(ended ? p.card.tags : shownTags(p)),
        role: knowsRole ? p.role : null,
        ready: p.ready, left: p.left, auto: p.auto && !p.bot, host: id === game.hostId,
        speaking: !!turn && turn.speakerId === id,
        spoke: !!game.turn && game.turn.round === game.round && qi >= 0 && (game.phase !== PH.TURNS ? game.phase !== PH.CLUE : qi < game.turn.idx),
        voted: !!voting && !!game.vote.votes[id],
      };
    });
    const ov = game.overlay;
    const v = {
      now: Date.now(), phase: game.phase, phaseStartedAt: game.phaseStartedAt, phaseEndsAt: game.phaseEndsAt, paused: game.paused,
      manual: isManual(game), mode: game.settings.mode, hostId: game.hostId,
      round: game.round, rounds: ROUNDS, finale: isFinale(game), speed: game.settings.speed,
      case: { title: game.caseData.title, victim: game.caseData.victim, time: game.caseData.time, teaser: game.caseData.teaser, locations: game.caseData.locations, scene: game.scene, icon: game.caseData.icon },
      accomplice: !!game.accompliceId, gang: !!game.gang,
      criminals: game.gang ? { total: 2, left: active(game).filter((a) => a.role !== 'innocent').length } : null,
      kicksLeft: game.gang && game.round >= ROUNDS ? game.finalLeft : null,
      players, overlay: ov ? { type: ov.type, endsAt: ov.endsAt, nomineeId: ov.nomineeId, voters: ov.voters || [], options: me && ov.nomineeId === me.id ? ov.options : null } : null,
      turn: game.turn && game.phase === PH.TURNS ? { speakerId: game.turn.speakerId, idx: game.turn.idx, total: game.turn.queue.length, queue: game.turn.queue, revealed: game.turn.revealed } : null,
      vote: voting ? { kind: game.vote.kind, candidates: game.vote.candidates, runoff: game.vote.runoff, voted: Object.keys(game.vote.votes).filter((id) => game.players[id].status === 'active'), my: me ? game.vote.votes[me.id] || null : null } : null,
      clues: game.clues.filter((c) => c.revealedRound !== null).map((c) => ({ id: c.id, round: c.revealedRound, text: c.text, tag: c.tag, label: Content.TAGS[c.tag].label, planted: ended ? !!c.planted : false, mine: !!(c.planted && me && game.plants.some((x) => x.clueId === c.id && x.by === me.id)) })),
      feed: game.feed.slice(-160).map((f) => (f.kind === 'gossip' ? { id: f.id, t: f.t, kind: 'gossip', text: f.text, author: ended ? f.author : undefined } : { id: f.id, t: f.t, kind: f.kind, text: f.text, who: f.who, clueId: f.clueId, trait: f.trait })),
      poll: game.poll ? { finalists: game.poll.finalists } : null,
      defense: game.defense ? { order: game.defense.order, idx: game.defense.idx, speaker: game.defense.order[game.defense.idx] || null } : null,
      verdict: game.verdict,
      kicks: game.kicks.map((k) => ({ id: k.id, kind: k.kind, via: k.via, round: k.round, role: k.role, count: k.count, votes: k.votes })),
      results: ended ? game.results : null,
    };
    if (me) {
      const canAct = me.status === 'active';
      const mySpeak = !!turn && turn.speakerId === me.id;
      v.me = {
        id: me.id, name: me.name, role: me.role, status: me.status, card: viewCard(game, me),
        cards: me.cards.map((c) => ({ type: c.type, name: CARDS[c.type].name, desc: CARDS[c.type].desc, used: c.used })),
        notes: me.notes.map((n) => ({ kind: n.kind || 'warrant', round: n.round, targetId: n.targetId, trait: n.trait, label: n.trait ? TRAITS[n.trait] : '', text: n.text, extra: n.extra })),
        swapTargets: game.phase === PH.TALK && me.status === 'active' && unusedCard(me, 'swap') >= 0 ? swapTargets(game, me) : [],
        revealed: Object.assign({}, me.revealed), ready: me.ready, alibiChosen: me.alibiChosen,
        isHost: me.id === game.hostId,
        can: {
          reveal: mySpeak && !game.turn.revealed ? volunteerable(game, me) : [],
          locked: mySpeak && !game.turn.revealed ? [...SAFE_TRAITS].filter((t) => !me.revealed[t] && lockedTrait(game, me, t)) : [],
          endturn: mySpeak || (game.phase === PH.DEFENSE && game.defense.order[game.defense.idx] === me.id),
          card: game.phase === PH.TALK && !game.overlay && canAct,
          vote: !!voting && !game.overlay && canAct,
        },
      };
      if (me.role === 'killer' || (game.gang && me.role === 'accomplice')) {
        v.me.killerInfo = {
          accompliceId: me.role === 'killer' ? game.accompliceId : null,
          // Убийца с самого начала знает, какие улики указывают на него. Если одну подменили, он заметит это, когда её найдут.
          clues: game.clues.map((c) => { const o = c.orig || c; return { id: c.id, text: o.text, label: Content.TAGS[o.tag].label, mine: o.fits.includes(me.id), revealed: c.revealedRound !== null, replaced: !!c.orig && c.revealedRound !== null }; }),
          locations: game.caseData.locations.filter((l) => l !== game.scene).map((l) => ({ loc: l, crowded: game.order.some((id) => id !== me.id && P(game, id).card.alibi.real.loc === l) })),
        };
      }
      if (me.role === 'accomplice') v.me.accompliceInfo = { killerId: game.killerId };
      // Сообщник не выбирает алиби, поэтому список мест ему не нужен.
      if (v.me.killerInfo && me.role !== 'killer') v.me.killerInfo.locations = [];
    }
    if (opts.god) {
      v.god = {
        killerId: game.killerId, accompliceId: game.accompliceId, seed: game.seed,
        votes: game.vote ? Object.assign({}, game.vote.votes) : {},
        players: game.order.map((id) => { const p = game.players[id]; return { id, name: p.name, role: p.role, auto: p.auto, bot: p.bot, status: p.status, card: viewCard(game, p), cards: p.cards.map((c) => ({ type: c.type, name: CARDS[c.type].name, used: c.used })), goalDone: p.goalDone }; }),
        clues: game.clues.map((c) => ({ id: c.id, tag: c.tag, label: Content.TAGS[c.tag].label, text: c.text, planted: c.planted, orig: c.orig ? Content.TAGS[c.orig.tag].label : null, revealedRound: c.revealedRound, fits: c.fits.map((i) => nm(game, i)) })),
      };
    }
    return v;
  }

  /* ---------- Симуляция партий ботов (для админки и тестов) ---------- */

  function simulate({ caseData, games = 20, players = 7, seed = 1, settings = {} }) {
    const out = { games, players, innocentWins: 0, byReason: {}, byRound: {}, minutes: [], innocentKicks: 0, violations: [], errors: [] };
    for (let g = 0; g < games; g++) {
      try {
        const list = Array.from({ length: players }, (_, i) => ({ id: 'b' + i, name: 'Бот ' + (i + 1), bot: true }));
        let now = 1000;
        const game = createGame({ caseData, players: list, seed: seed * 1000 + g, now, settings: Object.assign({ mode: 'timers' }, settings) });
        const errs = Generator.verify({ cards: Object.fromEntries(game.order.map((id) => [id, game.players[id].card])), clues: game.clues.filter((c) => !c.planted) }, game.order, game.killerId, game.gang ? game.accompliceId : null);
        if (errs.length) out.violations.push(...errs);
        let steps = 0;
        while (game.phase !== PH.ENDED && steps++ < 80000) { now += 400; tick(game, now); }
        if (game.phase !== PH.ENDED) { out.errors.push(`Партия ${g} не закончилась (фаза ${game.phase}, раунд ${game.round})`); continue; }
        const r = game.results;
        if (r.winner === 'innocent') out.innocentWins++;
        out.byReason[r.reason] = (out.byReason[r.reason] || 0) + 1;
        const key = r.reason === 'caught' ? `пойман в раунде ${game.verdict.round}` : r.reason === 'outnumbered' ? 'перевес преступников' : 'ушёл на финале';
        out.byRound[key] = (out.byRound[key] || 0) + 1;
        out.minutes.push((game.endedAt - game.startedAt) / 60000);
        out.innocentKicks += game.kicks.filter((a) => a.role === 'innocent').length;
      } catch (e) { out.errors.push(String(e && e.stack || e)); }
    }
    const m = out.minutes;
    out.avgMinutes = m.length ? m.reduce((a, b) => a + b, 0) / m.length : 0;
    return out;
  }

  const E = {
    PH, ROUNDS, GameError, createGame, act, tick, view, pause, resume, skip, setHost, simulate, alibiText, traitValue, lies, shownTags,
    nm, active, unusedCard, pushFeed, dur, computeResults, swapTargets, isManual, lockedTrait,
  };
  if (typeof self !== 'undefined' && self.DetectiveBots) self.DetectiveBots(E);
  return E;
});
