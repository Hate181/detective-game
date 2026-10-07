/* Боты и автопилот. Играют теми же действиями, что и люди, поэтому подчиняются тем же правилам.
   Автопилот включается и для живого игрока, если тот пропал со связи. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./content.js'));
  else root.DetectiveBots = factory(root.DetectiveContent);
})(typeof self !== 'undefined' ? self : this, function (Content) {
  return function install(E) {
    const { PH, act, nm, active } = E;
    const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : ''));

    const delay = (game, a, b) => Math.max(350, (a + game.rng.next() * (b - a)) * 1000 * (game.settings.speed || 1));
    const mem = (game, p) => (game.botMem[p.id] = game.botMem[p.id] || { said: {}, spoke: false, advised: false });

    /** Оценка подозрительности каждого игрока с точки зрения бота. */
    function suspicion(game, viewer) {
      const out = {};
      const clues = game.clues.filter((c) => c.revealedRound !== null);
      for (const t of active(game)) {
        if (t.id === viewer.id) continue;
        let s = 0;
        const shown = E.shownTags(t);
        const full = t.revealed.profession && t.revealed.habit;
        for (const c of clues) {
          if (shown.includes(c.tag)) s += 3;
          else if (full) s -= game.gang ? 2 : 6; // в банде улика подходит одному из двоих, несовпадение мало что значит
          else s += 0.4;
        }
        const a = t.revealed.alibi && t.card.alibi.claim;
        if (a) {
          const mine = viewer.card.alibi.real.loc;
          const seen = viewer.card.witnesses.includes(t.id);
          if (a.loc === mine && !seen && viewer.role !== 'killer') s += 4;
          if (seen && a.loc !== mine) s += 4;
        }
        // «Экспертиза»: личное знание, подходит ли улика этому игроку
        viewer.notes.filter((n) => n.kind === 'lab' && n.targetId === t.id).forEach((n) => { s += n.fits ? 3 : -4; });
        if (viewer.role !== 'innocent' && t.role !== 'innocent') s -= 50; // своих не сдают
        out[t.id] = s + game.rng.next() * 1.2;
      }
      return out;
    }
    const topOf = (map, filter) => Object.keys(map).filter(filter || (() => true)).sort((a, b) => map[b] - map[a])[0] || null;
    const rankOf = (map, id) => Object.keys(map).sort((a, b) => map[b] - map[a]).indexOf(id);

    /** Метки улик, которые знает преступник: найденные как есть, ненайденные по исходному делу (о подмене он ещё не знает). */
    const knownTags = (game) => new Set(game.clues.map((c) => (c.orig && c.revealedRound === null ? c.orig.tag : c.tag)));

    function chooseReveal(game, p) {
      const left = Content.SAFE_TRAITS.filter((t) => !p.revealed[t] && !E.lockedTrait(game, p, t));
      if (!left.length) return null;
      const clueTags = knownTags(game);
      const score = (t) => {
        let s = game.rng.next();
        if (p.role === 'killer') {
          if (t === 'profession' && p.card.proTags.some((x) => clueTags.has(x))) s -= 5;
          if (t === 'habit' && p.card.habitTags.some((x) => clueTags.has(x))) s -= 5;
        }
        if (t === 'alibi') s += 0.3;
        return s;
      };
      return left.sort((a, b) => score(b) - score(a))[0];
    }

    function dangerous(game, p, trait) {
      const tags = knownTags(game);
      if (p.role === 'killer') {
        if (trait === 'profession') return p.card.proTags.some((x) => tags.has(x));
        if (trait === 'habit') return p.card.habitTags.some((x) => tags.has(x));
        return trait === 'alibi' || trait === 'secret';
      }
      return trait === 'secret' || (trait === 'alibi' && E.lies(p));
    }

    function useCard(game, p, now) {
      const types = ['warrant', 'testimony', 'confront', 'swap', 'lab'];
      const card = p.cards.find((c) => !c.used && types.includes(c.type));
      if (!card) return false;
      const sus = suspicion(game, p);
      const top = topOf(sus);
      if (card.type === 'swap') {
        // Преступник наводит улику на невиновного. Невиновный подменяет, только если хочет посадить свою цель.
        const ok = E.swapTargets(game, p).filter((id) => game.players[id].role === 'innocent' || p.role === 'innocent');
        const g = p.card.goal;
        const target = p.role !== 'innocent' ? (ok.length ? game.rng.pick(ok) : null)
          : g && g.type === 'arrest' && ok.includes(g.target) && game.rng.chance(0.5) ? g.target : null;
        return target ? act(game, p.id, 'card', { type: 'swap', target }, now).ok : false;
      }
      if (card.type === 'lab') {
        // Проверяет самую свежую найденную улику, которую ещё не проверял.
        const done = new Set(p.notes.filter((n) => n.kind === 'lab').map((n) => n.clueId));
        const clue = game.clues.filter((c) => c.revealedRound !== null && !done.has(c.id)).pop();
        return clue ? act(game, p.id, 'card', { type: 'lab', clueId: clue.id }, now).ok : false;
      }
      if (card.type === 'confront') {
        // Сводит двух самых подозрительных (преступник прикрывает напарника), лучше всего по алиби.
        const ok = (id) => id !== p.id && game.players[id].status === 'active' && (p.role === 'innocent' || game.players[id].role === 'innocent');
        const first = topOf(sus, ok), second = first && topOf(sus, (id) => id !== first && ok(id));
        if (!second) return false;
        const t1 = game.players[first], t2 = game.players[second];
        const pool = Content.CONFRONT_TRAITS.filter((x) => !t1.revealed[x] || !t2.revealed[x]);
        if (!pool.length) return false;
        return act(game, p.id, 'card', { type: 'confront', target: first, target2: second, trait: pool.includes('alibi') ? 'alibi' : game.rng.pick(pool) }, now).ok;
      }
      if (!top) return false;
      const t = game.players[top];
      const pool = (card.type === 'warrant' ? Content.SEARCHABLE_TRAITS : Content.ASKABLE_TRAITS).filter((x) => !t.revealed[x]);
      if (!pool.length) return false;
      const pref = ['profession', 'habit', 'alibi'].filter((x) => pool.includes(x));
      const trait = pref.length ? game.rng.pick(pref) : game.rng.pick(pool);
      return act(game, p.id, 'card', { type: card.type, target: top, trait }, now).ok;
    }

    /** Карта защиты: «Адвокат», если есть. */
    function saveChoice(game, p) {
      return { card: p.cards.some((c) => !c.used && c.type === 'advocate') ? 'advocate' : 'none' };
    }

    /** За кого голосует бот: самый подозрительный из списка. Убийца и сообщник прикрывают друг друга. */
    function pickVote(game, p, candidates, finalists) {
      const sus = suspicion(game, p);
      const pool = candidates.filter((id) => id !== p.id);
      if (!pool.length) return null;
      pool.forEach((id) => { if (sus[id] === undefined) sus[id] = game.rng.next(); });
      if (p.role === 'innocent' && finalists) finalists.forEach((id) => { if (sus[id] !== undefined) sus[id] += 2; });
      if (p.role !== 'innocent') pool.forEach((id) => { if (game.players[id].role !== 'innocent') sus[id] -= 50; });
      return pool.sort((a, b) => sus[b] - sus[a])[0];
    }

    function botAct(game, p, now) {
      if (game.overlay) return p.status === 'active' && game.overlay.nomineeId === p.id ? act(game, p.id, 'save', saveChoice(game, p), now).ok : false;
      const m = mem(game, p);
      const ph = game.phase;
      if (ph === PH.BRIEF) {
        if (p.role === 'killer' && !p.alibiChosen) {
          const locs = game.caseData.locations.filter((l) => l !== game.scene);
          const free = locs.filter((l) => !game.order.some((id) => id !== p.id && game.players[id].card.alibi.real.loc === l));
          const pool = free.length && game.rng.chance(0.8) ? free : locs;
          return act(game, p.id, 'alibi', { loc: game.rng.pick(pool) }, now).ok;
        }
        if (!p.ready) return act(game, p.id, 'ready', {}, now).ok;
        return false;
      }
      if (ph === PH.TURNS) {
        if (!game.turn || game.turn.speakerId !== p.id) return false;
        const key = `${game.round}:${game.turn.idx}`;
        const stage = m.turn && m.turn.key === key ? m.turn.stage : 0;
        m.turn = { key, stage: stage + 1 };
        if (stage === 0) {
          const t = chooseReveal(game, p);
          return t ? act(game, p.id, 'reveal', { trait: t }, now).ok : true;
        }
        if (stage === 1 && p.bot) return true;
        return act(game, p.id, 'endturn', {}, now).ok;
      }
      if (ph === PH.TALK) {
        if (p.status !== 'active') return false;
        const elapsed = now - game.phaseStartedAt;
        const total = game.clock ? game.clock.full : 1;
        const r = game.rng.next();
        if (r < 0.35 && elapsed > total * 0.1 && useCard(game, p, now)) return true;
        if (elapsed > total * 0.4 && !p.ready && game.rng.chance(0.5)) return act(game, p.id, 'ready', {}, now).ok;
        return false;
      }
      if (ph === PH.QUESTION) {
        const a = game.ask;
        if (!a) return false;
        if (a.stage === 'pick' && a.askerId === p.id) {
          // Отошедший игрок на автопилоте вопросов не задаёт, бот спрашивает того, кого больше подозревает.
          const pool = game.order.filter((id) => id !== p.id && game.players[id].status === 'active');
          const t = p.bot && game.rng.chance(0.85) ? pickVote(game, p, pool) : null;
          return act(game, p.id, 'ask', t ? { target: t } : { pass: true }, now).ok;
        }
        if (a.stage === 'answer' && a.targetId === p.id) {
          const key = `${game.round}:${a.idx}`;
          if (p.bot && m.answer !== key) { m.answer = key; return true; }
          return act(game, p.id, 'answered', {}, now).ok;
        }
        return false;
      }
      if (ph === PH.VOTE || ph === PH.POLL || ph === PH.FINAL) {
        if (p.status !== 'active' || game.vote.votes[p.id]) return false;
        const t = pickVote(game, p, game.vote.candidates, ph === PH.FINAL ? game.vote.candidates : null);
        return t ? act(game, p.id, 'vote', { target: t }, now).ok : false;
      }
      if (ph === PH.DEFENSE) {
        if (game.defense.order[game.defense.idx] !== p.id) return false;
        if (!m.spoke) { m.spoke = true; return true; }
        m.spoke = false;
        return act(game, p.id, 'endspeech', {}, now).ok;
      }
      if (ph === PH.ACCOMPLICE) {
        if (p.id !== game.accompliceId) return false;
        if (game.rng.chance(0.5)) return act(game, p.id, 'accomplice', { mode: 'stealth' }, now).ok;
        const inn = game.order.filter((id) => game.players[id].role === 'innocent');
        return act(game, p.id, 'accomplice', { mode: 'target', target: game.rng.pick(inn) }, now).ok;
      }
      return false;
    }

    function botStep(game, now) {
      let changed = false;
      for (const id of game.order) {
        const p = game.players[id];
        if (!p.auto) continue;
        const due = game.botDue[id];
        if (due === undefined) { game.botDue[id] = now + delay(game, 0.5, 3); continue; }
        if (now < due) continue;
        const did = botAct(game, p, now);
        // В свой ход и в голосовании бот не тянет: важно, чтобы партия шла бодро.
        const fast = game.phase === PH.TURNS || game.phase === PH.DEFENSE || game.phase === PH.QUESTION;
        game.botDue[id] = now + (did ? (fast ? delay(game, 3, 8) : delay(game, 2, 7)) : delay(game, 0.8, 2.5));
        changed = changed || did;
        if (game.phase === PH.ENDED) break;
      }
      return changed;
    }

    E.botStep = botStep;
    E.suspicion = suspicion;
  };
});
