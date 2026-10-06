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

console.log(fails ? `провалов: ${fails}` : 'правило «одна из двух» и голоса без выбора в порядке');
process.exit(fails ? 1 : 0);
