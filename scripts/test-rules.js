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
  while (game.overlay && game.overlay.type === 'save') E.act(game, game.overlay.nomineeId, 'save', { card: 'none' }, now += 10);
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
  // Обвинительная минута: после обсуждения по очереди рассказов каждому минута, потом голосование
  for (const mode of ['timers', 'host']) {
    const players = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
    const game = E.createGame({ caseData: Cases.CASES[0], players, seed: 11, now: 1000, hostId: 'p0', settings: { mode } });
    let now = 1000;
    E.act(game, game.killerId, 'alibi', { loc: game.caseData.locations.find((l) => l !== game.scene) }, now);
    for (let i = 0; i < 20 && game.phase !== PH.TALK; i++) E.skip(game, now += 1000);
    const turnQueue = game.turn.queue.slice();
    const rd = E.act(game, 'p1', 'ready', {}, now += 10);
    check(mode === 'host' ? !rd.ok : rd.ok, `${mode}: кнопка готовности в обсуждении ${mode === 'host' ? 'выключена, дальше ведёт ведущий' : 'работает'}`);
    E.skip(game, now += 1000);
    check(game.phase === PH.ACCUSE && !game.accuse.done, `${mode}: после обсуждения обвинительная минута`);
    check(game.accuse.queue.join() === turnQueue.join() && game.accuse.speakerId === turnQueue[0], `${mode}: говорят в том же порядке, что и рассказывали`);
    check(game.clock.full === 60000 && (mode === 'host' ? game.clock.state === 'idle' : game.clock.state === 'run'), `${mode}: у каждого минута${mode === 'host' ? ', отсчёт запускает ведущий' : ''}`);
    const s0 = turnQueue[0];
    const v0 = E.view(game, s0);
    check(v0.accuse.speakerId === s0 && v0.players.find((p) => p.id === s0).speaking, `${mode}: говорящий подсвечен`);
    check(!E.act(game, turnQueue[1], 'endaccuse', {}, now += 10).ok, `${mode}: за другого минуту не закончить`);
    if (mode === 'host') {
      check(!v0.me.can.endaccuse && !E.act(game, s0, 'endaccuse', {}, now += 10).ok, 'host: говорящий сам не переключит, листает ведущий');
      E.tick(game, now += 120000);
      check(game.accuse.speakerId === s0, 'host: сам по себе ход не переходит');
      check(E.act(game, 'p0', 'host', { do: 'next' }, now += 10).ok, 'host: ведущий включает следующего');
    } else check(v0.me.can.endaccuse && E.act(game, s0, 'endaccuse', {}, now += 10).ok, 'timers: говорящий может закончить сам');
    check(game.accuse.speakerId === turnQueue[1], `${mode}: слово у следующего`);
    while (game.phase === PH.ACCUSE && !game.accuse.done) E.skip(game, now += 1000);
    if (mode === 'host') {
      check(game.phase === PH.ACCUSE && game.accuse.done, 'host: после круга ждём ведущего');
      E.tick(game, now += 120000);
      check(game.phase === PH.ACCUSE, 'host: голосование само не начинается');
      check(E.act(game, 'p0', 'host', { do: 'next' }, now += 10).ok && game.phase === PH.VOTE, 'host: ведущий начинает голосование');
    } else check(game.phase === PH.VOTE, 'timers: после круга сразу голосование');
    // Анонимность: в ленте и в данных для игроков нет, кто за кого
    const ids = game.order.filter((id) => game.players[id].status === 'active');
    ids.forEach((id) => E.act(game, id, 'vote', { target: ids.find((x) => x !== id) }, now += 10));
    for (let i = 0; i < 5 && game.phase === PH.VOTE; i++) E.skip(game, now += 1000);
    while (game.overlay && game.overlay.type === 'save') E.act(game, game.overlay.nomineeId, 'save', { card: 'none' }, now += 10);
    const vtext = game.feed.filter((f) => f.kind === 'vote').map((f) => f.text).join(' ');
    check(/Итоги голосования/.test(vtext) && !/→/.test(vtext), `${mode}: в журнале только итоги голосования`);
    const vk = E.view(game, 'p1');
    check(vk.kicks.length && vk.kicks.every((k) => !k.votes) && (!vk.overlay || !vk.overlay.voters), `${mode}: игрокам не уходит, кто за кого голосовал`);
    const out = game.kicks[0] && game.players[game.kicks[0].id];
    if (out) {
      const pv = E.view(game, 'p1').players.find((p) => p.id === out.id);
      const opened = Object.keys(out.revealed).filter((t) => out.revealed[t]);
      check(Object.keys(pv.revealed).sort().join() === opened.sort().join(), `${mode}: у выбывшего видно только то, что он открыл сам`);
      const viewer = game.order.find((id) => id !== out.id && game.players[id].role === 'innocent');
      const vv = E.view(game, viewer);
      check(vv.players.find((p) => p.id === out.id).role === null && vv.kicks[0].role === null && !vv.criminals, `${mode}: в обычном режиме роль выбывшего и счётчик преступников скрыты`);
      check(!game.feed.some((f) => f.kind === 'kick' && /Роль:/.test(f.text)), `${mode}: в журнале роль выбывшего не названа`);
      check(E.view(game, out.id).players.find((p) => p.id === out.id).role === out.role, `${mode}: сам выбывший свою роль знает`);
    }
  }
}

{
  // Лайт: роль выбывшего раскрывается сразу, счётчик преступников виден; обычный: «Экспертиза» после любого исключения
  for (const hints of ['light', 'normal']) {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
    const game = E.createGame({ caseData: Cases.CASES[0], players, seed: 21, now: 1000, settings: { mode: 'timers', hints } });
    let now = 1000;
    E.act(game, game.killerId, 'alibi', { loc: game.caseData.locations.find((l) => l !== game.scene) }, now);
    for (let i = 0; i < 40 && game.phase !== PH.VOTE; i++) E.skip(game, now += 1000);
    const crim = game.killerId;
    const ids = game.order.filter((id) => game.players[id].status === 'active');
    ids.forEach((id) => E.act(game, id, 'vote', { target: id === crim ? ids.find((x) => x !== crim) : crim }, now += 10));
    for (let i = 0; i < 5 && game.phase === PH.VOTE; i++) E.skip(game, now += 1000);
    while (game.overlay && game.overlay.type === 'save') E.act(game, game.overlay.nomineeId, 'save', { card: 'none' }, now += 10);
    const viewer = game.order.find((id) => game.players[id].role === 'innocent' && game.players[id].status === 'active');
    const v = E.view(game, viewer);
    const labs = game.order.reduce((n, id) => n + game.players[id].cards.filter((c) => c.type === 'lab').length, 0);
    if (hints === 'light') {
      check(game.players[crim].status === 'out' && v.players.find((p) => p.id === crim).role === 'killer' && v.criminals && v.criminals.left === 1, 'лайт: роль выбывшего видна сразу, счётчик преступников на месте');
      check(labs === 0, 'лайт: за исключённого преступника «Экспертиза» не выдаётся');
    } else {
      check(game.players[crim].status === 'out' && v.players.find((p) => p.id === crim).role === null && !v.criminals, 'обычный: роль выбывшего скрыта, счётчика нет');
      check(labs >= 1 && /экспертизу/.test(game.feed.map((f) => f.text).join(' ')), 'обычный: «Экспертиза» приходит и после исключения преступника, по ней роль не понять');
      check(!/Убийцы больше нет/.test(game.feed.map((f) => f.text).join(' ')), 'обычный: в журнале нет подсказки, что ушёл убийца');
    }
  }
}

{
  // Ведущий и говорящий нажали «дальше» одновременно: второе нажатие опоздало. «Назад» возвращает пропущенного.
  const players = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
  const game = E.createGame({ caseData: Cases.CASES[0], players, seed: 11, now: 1000, hostId: 'p0', settings: { mode: 'host' } });
  let now = 1000;
  const next = (step) => E.act(game, 'p0', 'host', { do: 'next', step }, now += 100);
  const back = () => E.act(game, 'p0', 'host', { do: 'back' }, now += 100);
  for (let i = 0; i < 10 && game.phase !== PH.TURNS; i++) next(game.step);
  const t = game.turn;
  const a = t.speakerId, b = t.queue[t.idx + 1], c = t.queue[t.idx + 2];
  const seen = game.step;
  check(E.act(game, a, 'endturn', { step: seen }, now += 10).ok && game.turn.speakerId === b, 'говорящий передал слово');
  check(!next(seen).ok && game.turn.speakerId === b, 'опоздавшее нажатие ведущего никого не пропускает');
  check(!E.view(game, 'p1').me.can.back, 'кнопка «Назад» есть только у ведущего');
  const bRev = Object.keys(game.players[b].revealed).sort().join();
  check(next(game.step).ok && game.turn.speakerId === c, 'ведущий пропустил игрока');
  check(Object.keys(game.players[b].revealed).length > bRev.split(',').filter(Boolean).length, 'за пропущенного карточка открылась сама');
  check(E.view(game, 'p0').me.can.back && back().ok && game.turn.speakerId === b, '«Назад» вернул слово пропущенному');
  check(Object.keys(game.players[b].revealed).sort().join() === bRev && !game.turn.revealed, 'случайно открытое у пропущенного снова закрыто, он выбирает сам');
  check(!game.feed.some((f) => f.who === c && f.kind === 'turn' && f.text.startsWith('Слово')) || game.feed.filter((f) => f.who === c && f.kind === 'turn').length === 0, 'лишние строки в журнале убраны');
  check(back().ok && game.turn.speakerId === a, 'можно вернуться ещё на шаг');
  // Перебором «Назад/Дальше» карточку пропущенного не вытянуть: за него открывается одно и то же.
  const rolls = new Set();
  for (let i = 0; i < 6; i++) { next(game.step); rolls.add(Object.keys(game.players[a].revealed).sort().join()); back(); }
  check(rolls.size === 1 && game.turn.speakerId === a, 'повторные «Дальше/Назад» открывают за пропущенного одно и то же');
  check(!E.act(game, 'p0', 'host', { do: 'back', step: game.step - 1 }, now += 10).ok, 'опоздавшее второе «Назад» не откатывает лишний шаг');
  next(game.step);
  E.act(game, b, 'reveal', { trait: E.view(game, b).me.can.reveal[0] }, now += 10);
  check(!back().ok && game.turn.speakerId === b && game.turn.revealed, 'после того как игрок сам что-то открыл, шаг не вернуть');
  // Обсуждение: после сыгранной карты вернуться нельзя.
  for (let i = 0; i < 10 && game.phase === PH.TURNS; i++) next(game.step);
  check(game.phase === PH.TALK && back().ok && game.phase === PH.TURNS, 'из обсуждения можно вернуться к последнему рассказу');
  next(game.step);
  const p = game.order.find((id) => id !== 'p0');
  game.players[p].cards.push({ type: 'warrant', used: false });
  const tgt = game.order.find((id) => id !== p);
  check(E.act(game, p, 'card', { type: 'warrant', target: tgt, trait: 'alibi' }, now += 10).ok, 'в обсуждении сыграли «Обыск»');
  check(!E.view(game, 'p0').me.can.back && !back().ok && game.phase === PH.TALK, 'после сыгранной карты шаг не вернуть');
  // Обвинительная минута.
  next(game.step);
  const first = game.accuse.speakerId;
  next(game.step);
  check(game.accuse.speakerId !== first && back().ok && game.accuse.speakerId === first, '«Назад» в обвинительной минуте возвращает предыдущего');
  check(back().ok && game.phase === PH.TALK, 'из первой минуты можно вернуться в обсуждение');
  for (let i = 0; i < 20 && game.phase !== PH.VOTE; i++) next(game.step);
  check(game.phase === PH.VOTE && !back().ok, 'начатое голосование назад не отматывается');
}

console.log(fails ? `провалов: ${fails}` : 'правило «одна из двух» и голоса без выбора в порядке');
process.exit(fails ? 1 : 0);
