/* Банда: убийца и сообщник при любом числе игроков, невиновные побеждают только исключив обоих, исключений пять. */
const E = require('../public/shared/engine.js');
const Cases = require('../public/shared/cases.js');
const { PH } = E;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };

function start(n, rules, seed = 5, hints) {
  const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
  const game = E.createGame({ caseData: Cases.CASES[1], players, seed, now: 1000, settings: { mode: 'timers', rules, hints } });
  const st = { game, now: 1000 };
  E.act(game, game.killerId, 'alibi', { loc: game.caseData.locations.find((l) => l !== game.scene) }, st.now);
  E.skip(game, st.now += 1000);
  return st;
}
const act = (g) => g.order.filter((id) => g.players[id].status === 'active');
/** Доводит партию до ближайшего голосования нужного вида; переговоры пропускаются. */
function toVote(st, kinds) {
  const { game } = st;
  for (let i = 0; i < 400; i++) {
    if (game.phase === PH.ENDED) return false;
    if (game.vote && kinds.includes(game.vote.kind) && [PH.VOTE, PH.POLL, PH.FINAL].includes(game.phase) && !game.overlay) return true;
    if (game.overlay) { E.act(game, game.overlay.nomineeId, 'advocate', { play: false }, st.now += 100); continue; }
    E.skip(game, st.now += 1000);
  }
  return false;
}
/** Все голосуют за target (сам цель голосует за любого другого). */
function voteFor(st, target) {
  const { game } = st;
  act(game).forEach((id) => { const t = id === target ? game.vote.candidates.find((c) => c !== id) : target; E.act(game, id, 'vote', { target: t }, st.now += 10); });
  for (let i = 0; i < 6 && game.vote && act(game).some((id) => !game.vote.votes[id]); i++) E.skip(game, st.now += 10);
  E.skip(game, st.now += 100); // подсчёт голосов
  while (game.overlay) E.act(game, game.overlay.nomineeId, 'advocate', { play: false }, st.now += 100);
}

for (const n of [6, 7, 8, 10]) {
  const { game } = start(n);
  check(game.gang && game.accompliceId && game.accompliceId !== game.killerId, `${n} игроков: есть убийца и сообщник`);
  const tags = game.clues.map((c) => c.tag);
  const m = (id) => tags.filter((t) => game.players[id].card.tags.includes(t)).length;
  const inno = game.order.filter((id) => game.players[id].role === 'innocent');
  const crim = [game.killerId, game.accompliceId];
  check(m(game.killerId) === 3 && m(game.accompliceId) === 3, `${n} игроков: каждому преступнику подходят три улики из четырёх, а не все`);
  check(tags.every((t) => crim.some((c) => game.players[c].card.tags.includes(t))), `${n} игроков: вместе преступники закрывают все четыре улики`);
  check(inno.filter((id) => m(id) === 3).length === (n >= 8 ? 2 : 1) && !inno.some((id) => m(id) === 4), `${n} игроков: есть невиновные двойники с тремя совпадениями, всем четырём не подходит никто`);
  const cap = n >= 8 ? 4 : 3;
  check(game.clues.every((c) => c.fits.length >= 2 && c.fits.length <= cap && c.fits.some((id) => !crim.includes(id))), `${n} игроков: каждой улике подходят от 2 до ${cap} игроков, среди них есть невиновный`);
  const habs = game.order.map((id) => game.players[id].card.habitTags.length);
  check(habs.every((h) => h === 2), `${n} игроков: у всех ровно две особенности: ${habs.join(',')}`);
  check(game.order.every((id) => game.players[id].card.habitTags.every((t) => t.startsWith(game.caseData.id + '.'))), `${n} игроков: приметы взяты из набора этого дела`);
}

{
  // Обычный режим: ушёл убийца, но об этом никто не узнаёт до конца дела
  const st = start(8);
  const { game } = st;
  check(toVote(st, ['kick']), 'обычный: дошли до первого голосования');
  voteFor(st, game.killerId);
  check(game.players[game.killerId].status === 'out' && game.phase === PH.RESULT, 'обычный: убийца исключён, партия продолжается');
  const feed = game.feed.map((f) => f.text).join(' ');
  check(!/сообщник ещё в игре/.test(feed), 'обычный: журнал молчит, что ушёл преступник');
  const v = E.view(game, game.order.find((id) => id !== game.killerId && id !== game.accompliceId));
  check(!v.criminals && v.players.find((p) => p.id === game.killerId).role === null, 'обычный: счётчика преступников нет, роль скрыта');
  const va = E.view(game, game.accompliceId);
  check(va.players.find((p) => p.id === game.killerId).role === 'killer', 'обычный: сообщник знает, что убийцу исключили');
}

{
  // Лайт: убийцу исключили в первом раунде, дело не закрыто, пока есть сообщник
  const st = start(8, undefined, 5, 'light');
  const { game } = st;
  check(toVote(st, ['kick']), 'дошли до первого голосования');
  voteFor(st, game.killerId);
  check(game.players[game.killerId].status === 'out' && game.phase === PH.RESULT, 'убийца исключён, партия продолжается');
  const feed = game.feed.map((f) => f.text).join(' ');
  check(/сообщник ещё в игре/.test(feed), 'в журнале сказано, что сообщник на свободе');
  const v = E.view(game, game.order.find((id) => id !== game.killerId));
  check(v.criminals && v.criminals.left === 1, 'интерфейсу известно, что остался один преступник');
  check(toVote(st, ['kick']), 'следующее голосование идёт');
  voteFor(st, game.accompliceId);
  check(game.phase === PH.VERDICT && game.verdict.winner === 'innocent', 'после исключения обоих побеждают невиновные');
  while (game.phase !== PH.ENDED) E.skip(game, st.now += 1000);
  check(!game.accompliceChoice, 'последнего шанса сообщника нет, он уже исключён');
  check(game.results.winner === 'innocent', 'итоги записаны');
}

{
  // Пять исключений: невиновных исключили трижды, потом в финале выбыли убийца и ещё один невиновный
  const st = start(8);
  const { game } = st;
  const inno = game.order.filter((id) => game.players[id].role === 'innocent');
  let k = 0;
  for (let r = 0; r < 3; r++) { check(toVote(st, ['kick']), `голосование раунда ${r + 1}`); voteFor(st, inno[k++]); }
  check(toVote(st, ['poll']), 'финал начинается с опроса');
  check(game.round === 4, 'финальный раунд');
  voteFor(st, game.killerId);
  check(game.poll.finalists.length === 3, 'на защиту выходят трое');
  check(toVote(st, ['final']), 'первое итоговое голосование');
  check(E.view(game, game.order[0]).kicksLeft === 2, 'в финале осталось два исключения');
  voteFor(st, game.killerId);
  check(game.phase === PH.FINAL && game.vote.candidates.length === 2, 'после первого исключения идёт второе голосование между оставшимися');
  voteFor(st, game.vote.candidates.find((c) => game.players[c].role === 'innocent'));
  check(game.phase === PH.VERDICT && game.kicks.length === 5, `пять исключений использованы (было ${game.kicks.length})`);
  check(game.verdict.winner === 'killer' && game.verdict.reason === 'escaped', 'сообщник остался на свободе, побеждают преступники');
}

for (const n of [6, 7, 8, 10]) {
  // Перевес: как только преступников столько же, сколько невиновных, они побеждают сразу. Если не дошло, решают пять исключений.
  const st = start(n);
  const { game } = st;
  let guard = 0;
  while (game.phase !== PH.VERDICT && game.phase !== PH.ENDED && guard++ < 12) {
    if (game.phase === PH.DEFENSE) { E.skip(game, st.now += 100); continue; }
    if (!toVote(st, ['kick', 'poll', 'final'])) break;
    voteFor(st, game.vote.candidates.find((c) => game.players[c].role === 'innocent'));
  }
  const left = act(game);
  const crim = left.filter((id) => game.players[id].role !== 'innocent').length;
  check(game.verdict && game.verdict.winner === 'killer', `${n} игроков: если исключать только невиновных, побеждают преступники`);
  if (n <= 8) check(game.verdict.reason === 'outnumbered' && left.length === 4 && crim === 2, `${n} игроков: перевес 2 на 2 заканчивает дело досрочно`);
  else check(game.verdict.reason === 'escaped' && game.kicks.length === 5 && crim === 2, `${n} игроков: пять исключений прошли, перевеса ещё нет (${left.length} за столом)`);
}

{
  // 1 на 1 тоже перевес: убийцу исключили, сообщник остался с одним невиновным
  const st = start(6);
  const { game } = st;
  const inno = game.order.filter((id) => game.players[id].role === 'innocent');
  toVote(st, ['kick']); voteFor(st, game.killerId); // 5 игроков: 1 преступник и 4 невиновных
  toVote(st, ['kick']); voteFor(st, inno[0]); // 4: 1 и 3
  toVote(st, ['kick']); voteFor(st, inno[1]); // 3: 1 и 2, финал
  check(game.phase !== PH.VERDICT, 'один преступник против двух невиновных, дело идёт');
  toVote(st, ['poll']); voteFor(st, game.accompliceId);
  toVote(st, ['final']);
  voteFor(st, inno[2]);
  check(game.phase === PH.VERDICT && game.verdict.reason === 'outnumbered', '1 на 1: преступник побеждает, за столом не остаётся одного человека');
  check(act(game).length === 2, 'за столом двое');
}

{
  // Старое правило остаётся доступным
  const st = start(8, { gang: false });
  check(!st.game.gang, 'с выключенным правилом банды играет прежний вариант');
  const st6 = start(6, { gang: false });
  check(!st6.game.accompliceId, 'без банды при 6 игроках сообщника нет');
}

{
  // Партии ботов проходят до конца без нарушений
  const sim = E.simulate({ caseData: Cases.CASES[3], games: 30, players: 6, seed: 3 });
  check(sim.errors.length === 0 && sim.violations.length === 0, `6 ботов: 30 партий без ошибок (побед невиновных ${sim.innocentWins})`);
  const sim10 = E.simulate({ caseData: Cases.CASES[7], games: 30, players: 10, seed: 4 });
  check(sim10.errors.length === 0 && sim10.violations.length === 0, `10 ботов: 30 партий без ошибок (побед невиновных ${sim10.innocentWins})`);
}

console.log(fails ? `провалов: ${fails}` : 'банда в порядке');
process.exit(fails ? 1 : 0);
