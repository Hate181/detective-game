/* Правило «одна из двух»: профессию и особенность сами открывают только одну, вторую раскрывают карты или исключение. */
const E = require('../public/shared/engine.js');
const Cases = require('../public/shared/cases.js');
const { PH } = E;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };

function start(rules) {
  const players = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
  const game = E.createGame({ caseData: Cases.CASES[0], players, seed: 11, now: 1000, settings: { mode: 'timers', rules } });
  let now = 1000;
  const killer = game.killerId;
  E.act(game, killer, 'alibi', { loc: game.caseData.locations.find((l) => l !== game.scene) }, now);
  E.skip(game, now += 1000); // вводная -> улика
  E.skip(game, now += 1000); // улика -> рассказы
  return { game, now };
}

{
  const { game, now } = start();
  check(game.phase === PH.TURNS, 'партия дошла до круга рассказов');
  const sp = game.turn.speakerId;
  let v = E.view(game, sp).me.can;
  check(v.reveal.includes('profession') && v.reveal.includes('habit'), 'в начале можно открыть и профессию, и особенность');
  game.players[sp].revealed.profession = true; // профессия уже открыта (сами или по карте)
  v = E.view(game, sp).me.can;
  check(!v.reveal.includes('habit') && v.locked.includes('habit'), 'после профессии особенность недоступна, и интерфейс знает почему');
  const r = E.act(game, sp, 'reveal', { trait: 'habit' }, now);
  check(!r.ok, 'сервер отклоняет попытку открыть вторую половину: ' + (r.error || ''));
  check(E.act(game, sp, 'reveal', { trait: 'relation' }, now).ok, 'другие пункты по-прежнему открываются');
}

{
  // Автоматическое раскрытие по таймеру тоже не открывает запертую половину
  const { game, now } = start();
  let bad = 0, total = 0;
  for (let i = 0; i < 300 && game.phase !== PH.ENDED; i++) {
    if (game.phase === PH.TURNS) { const p = game.players[game.turn.speakerId]; E.skip(game, now); total++; if (p.revealed.profession && p.revealed.habit) bad++; continue; }
    if (game.phase === PH.VOTE) { const cands = game.vote.candidates; game.order.filter((id) => game.players[id].status === 'active').forEach((id) => E.act(game, id, 'vote', { target: cands.find((c) => c !== id) }, now)); }
    if (game.overlay) E.act(game, game.overlay.nomineeId, 'advocate', { play: false }, now); else E.skip(game, now);
  }
  check(total > 0 && bad === 0, `таймер сам не открывает обе половины (проверено ходов: ${total})`);
}

{
  const { game, now } = start({ oneOfTwo: false });
  const sp = game.turn.speakerId;
  E.act(game, sp, 'reveal', { trait: 'profession' }, now);
  E.act(game, sp, 'endturn', {}, now);
  const p = game.players[sp];
  check(!E.lockedTrait(game, p, 'habit'), 'с выключенным правилом особенность не заперта');
}

{
  // «Показания» раскрывают запертую половину
  const { game } = start();
  const a = game.order[0], b = game.order[1];
  game.players[a].cards = [{ type: 'testimony', used: false }];
  game.players[b].revealed.profession = true;
  check(E.lockedTrait(game, game.players[b], 'habit'), 'у игрока с открытой профессией особенность заперта');
  let now = 5000;
  while (game.phase !== PH.TALK && game.phase !== PH.ENDED) {
    if (game.phase === PH.TURNS) { E.act(game, game.turn.speakerId, 'endturn', {}, now); continue; }
    E.skip(game, now += 100);
  }
  const r = E.act(game, a, 'card', { type: 'testimony', target: b, trait: 'habit' }, now);
  check(r.ok && game.players[b].revealed.habit, 'карта «Показания» раскрывает запертую особенность: ' + (r.error || 'ок'));
}

// Кто не проголосовал, голосует против себя.
{
  let { game, now } = start();
  for (let i = 0; i < 20 && game.phase !== PH.VOTE; i++) E.skip(game, now += 1000);
  check(game.phase === PH.VOTE, 'партия дошла до голосования');
  const ids = Object.keys(game.players);
  const [a, b, target] = ids;
  E.act(game, a, 'vote', { target }, now);
  E.act(game, b, 'vote', { target }, now);
  check(!E.act(game, ids[3], 'vote', { target: ids[3] }, now).ok, 'против себя вручную голосовать нельзя');
  E.skip(game, now += 1000);
  const log = game.votesLog[game.votesLog.length - 1];
  check(log.count[target] === 3 && ids.slice(3).every((id) => log.count[id] === 1), 'молчащие получили по голосу против себя: ' + JSON.stringify(log.count));
  check(game.kicks.length === 1 && game.kicks[0].id === target, 'исключён лидер голосования');
  check(!game.suspicions.some((x) => x.by === x.target), 'голос «без выбора» не считается подозрением');
}

// Часы ведущего: при ручном ведении фаза ждёт старта, пауза замораживает остаток, сброс возвращает полное время.
{
  const players = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
  const game = E.createGame({ caseData: Cases.CASES[0], players, seed: 11, now: 1000, hostId: 'p0', settings: { mode: 'host' } });
  let now = 1000;
  const v = () => E.view(game, 'p0').clock;
  check(v().state === 'idle' && game.phaseEndsAt === 0, 'при ручном ведении часы фазы стоят, пока ведущий их не запустит');
  check(!E.act(game, 'p1', 'host', { do: 'clock', op: 'start' }, now).ok, 'запустить часы может только ведущий');
  E.act(game, 'p0', 'host', { do: 'clock', op: 'start' }, now);
  check(v().state === 'run' && game.phaseEndsAt === now + game.clock.full, 'ведущий запустил отсчёт');
  now += 5000; E.act(game, 'p0', 'host', { do: 'clock', op: 'pause' }, now);
  check(game.clock.state === 'pause' && game.clock.left === game.clock.full - 5000, 'пауза запоминает остаток');
  now += 60000; E.tick(game, now);
  check(game.clock.left === game.clock.full - 5000, 'на паузе время не уходит');
  E.act(game, 'p0', 'host', { do: 'clock', op: 'reset' }, now);
  check(game.clock.state === 'idle' && game.clock.left === game.clock.full, 'сброс возвращает полное время');
  E.act(game, 'p0', 'host', { do: 'extend' }, now);
  check(game.clock.left === game.clock.full + 30000, '+30 секунд работает и на стоящих часах');
  E.act(game, 'p0', 'host', { do: 'next' }, now);
  check(game.phase === PH.CLUE && game.clock.state === 'idle', 'новая фаза снова ждёт старта');
  game.players.p0.auto = true; E.tick(game, now += 400);
  check(game.clock.state === 'run', 'за ведущего на автопилоте часы идут сами');
}

{
  // Две ничьи подряд: «Полиция решает, кого задержать», рулетка у всех, исключают того, на ком она остановилась
  const { game } = start();
  let now = 2000;
  for (let i = 0; i < 40 && game.phase !== PH.VOTE; i++) E.skip(game, now += 1000);
  check(game.phase === PH.VOTE, 'дошли до голосования');
  const act = () => game.order.filter((id) => game.players[id].status === 'active');
  const pair = act().slice(0, 2);
  // Голоса поровну между двумя: половина против первого, половина против второго
  const split = () => act().forEach((id, i) => E.act(game, id, 'vote', { target: id === pair[0] ? pair[1] : id === pair[1] ? pair[0] : pair[i % 2] }, now += 10));
  split(); E.skip(game, now += 100);
  check(game.phase === PH.VOTE && game.vote.runoff, 'первая ничья: переголосование');
  split(); E.skip(game, now += 100);
  const ov = game.overlay;
  check(ov && ov.type === 'lottery' && ov.candidates.length === 2 && pair.includes(ov.winnerId), 'вторая ничья: окно полиции с рулеткой');
  check(/Полиция решает/.test(game.feed.map((f) => f.text).join(' ')), 'в журнале: полиция решает');
  const v = E.view(game, pair[0]);
  check(v.overlay.type === 'lottery' && v.overlay.winnerId === ov.winnerId && v.overlay.startedAt, 'все видят одну и ту же рулетку');
  check(!E.act(game, pair[0], 'vote', { target: pair[1] }, now += 10).ok, 'пока крутится рулетка, голосовать нельзя');
  check(!E.act(game, game.hostId, 'host', { do: 'next' }, now += 10).ok && game.overlay && game.overlay.type === 'lottery', 'ведущий не может пропустить рулетку');
  const winner = ov.winnerId;
  E.tick(game, now += 2000);
  check(game.overlay && game.overlay.type === 'lottery', 'рулетка ещё крутится');
  E.tick(game, ov.endsAt + 10);
  while (game.overlay && game.overlay.type === 'save') E.act(game, game.overlay.nomineeId, 'save', { card: 'none' }, ov.endsAt + 20);
  check(game.players[winner].status === 'out', 'вылетел тот, на ком остановилась рулетка');
  check(game.kicks[game.kicks.length - 1].via === 'random', 'в итогах отмечено: решила полиция');
}

{
  // Допрос: после обсуждения по очереди рассказов каждый задаёт один вопрос одному игроку, потом голосование
  for (const mode of ['timers', 'host']) {
    const players = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
    const game = E.createGame({ caseData: Cases.CASES[0], players, seed: 11, now: 1000, hostId: 'p0', settings: { mode } });
    let now = 1000;
    E.act(game, game.killerId, 'alibi', { loc: game.caseData.locations.find((l) => l !== game.scene) }, now);
    for (let i = 0; i < 20 && game.phase !== PH.TALK; i++) E.skip(game, now += 1000);
    const turnQueue = game.turn.queue.slice();
    E.skip(game, now += 1000);
    check(game.phase === PH.QUESTION && game.ask.stage === 'pick', `${mode}: после обсуждения начинается допрос`);
    check(game.ask.queue.join() === turnQueue.join() && game.ask.askerId === turnQueue[0], `${mode}: спрашивают в том же порядке, что и рассказывали`);
    const a0 = game.ask.askerId, other = turnQueue[1];
    check(!E.act(game, other, 'ask', { target: a0 }, now += 10).ok, `${mode}: вне очереди спросить нельзя`);
    for (const bad of [a0, '__proto__', 'nobody']) check(!E.act(game, a0, 'ask', { target: bad }, now += 10).ok, `${mode}: нельзя спросить «${bad}»`);
    const v0 = E.view(game, a0);
    check(v0.me.can.ask && v0.ask.askerId === a0 && v0.players.find((p) => p.id === a0).speaking, `${mode}: спрашивающий видит свой ход, у остальных он подсвечен`);
    check(E.act(game, a0, 'ask', { target: other }, now += 10).ok && game.ask.stage === 'answer' && game.ask.targetId === other, `${mode}: вопрос задан, отвечает выбранный`);
    check(E.view(game, other).me.can.answered && E.view(game, other).players.find((p) => p.id === other).speaking, `${mode}: у отвечающего кнопка «Ответ дан» и подсветка`);
    check(game.clock.full === 30000 && (mode === 'host' ? game.clock.state === 'idle' : game.clock.state === 'run'), `${mode}: на ответ 30 секунд${mode === 'host' ? ', отсчёт запускает ведущий' : ''}`);
    check(/задаёт вопрос игроку/.test(game.feed[game.feed.length - 1].text), `${mode}: в журнале видно, кто кого спросил`);
    check(!E.act(game, turnQueue[2], 'answered', {}, now += 10).ok, `${mode}: за другого ответ не закончить`);
    check(E.act(game, other, 'answered', {}, now += 10).ok && game.ask.askerId === other && game.ask.stage === 'pick', `${mode}: после ответа ход у следующего`);
    check(E.act(game, other, 'ask', { pass: true }, now += 10).ok && game.ask.askerId === turnQueue[2] && /нет вопросов/.test(game.feed[game.feed.length - 1].text), `${mode}: «Нет вопросов» передаёт ход дальше`);
    // Остальные отказываются; последний отказ
    while (game.phase === PH.QUESTION && game.ask.stage === 'pick') E.act(game, game.ask.askerId, 'ask', { pass: true }, now += 10);
    if (mode === 'host') {
      check(game.phase === PH.QUESTION && game.ask.stage === 'done', 'ведущий: после круга допроса ждём, пока ведущий начнёт голосование');
      E.tick(game, now += 120000);
      check(game.phase === PH.QUESTION, 'ведущий: сам по таймеру голосование не начинается');
      check(E.act(game, 'p0', 'host', { do: 'next' }, now += 10).ok && game.phase === PH.VOTE, 'ведущий: кнопка ведущего начинает голосование');
    } else check(game.phase === PH.VOTE, 'таймеры: после круга допроса сразу голосование');
  }
  // Исключённые в очереди допроса пропускаются, спросить их нельзя
  {
    const players = Array.from({ length: 7 }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
    const game = E.createGame({ caseData: Cases.CASES[0], players, seed: 12, now: 1000, settings: { mode: 'timers' } });
    let now = 1000;
    E.act(game, game.killerId, 'alibi', { loc: game.caseData.locations.find((l) => l !== game.scene) }, now);
    for (let i = 0; i < 20 && game.phase !== PH.TALK; i++) E.skip(game, now += 1000);
    const out = game.order.find((id) => id !== game.turn.queue[0]);
    game.players[out].status = 'out';
    E.skip(game, now += 1000);
    check(!game.ask.queue.includes(out), 'исключённого нет в очереди допроса');
    check(!E.act(game, game.ask.askerId, 'ask', { target: out }, now += 10).ok, 'исключённого спросить нельзя');
    // Таймер выбора истёк: ход сгорает
    const a = game.ask.askerId;
    E.tick(game, now += 60000);
    check(game.ask.askerId !== a && game.feed.some((f) => f.text === `${game.players[a].name} не задаёт вопрос.`), 'кто не выбрал вовремя, тот пропускает ход');
  }
}

console.log(fails ? `провалов: ${fails}` : 'правило «одна из двух» и голоса без выбора в порядке');
process.exit(fails ? 1 : 0);
