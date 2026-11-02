/* Пропуск исключения: в первом голосовании можно выбрать «Никого не исключать», тогда во втором раунде исключают двоих. */
const E = require('../public/shared/engine.js');
const Cases = require('../public/shared/cases.js');
const { PH } = E;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };

function start(rules, n = 7) {
  const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
  const game = E.createGame({ caseData: Cases.CASES[0], players, seed: 21, now: 1000, settings: { mode: 'timers', rules } });
  const s = { game, now: 1000 };
  E.act(game, game.killerId, 'alibi', { loc: game.caseData.locations.find((l) => l !== game.scene) }, s.now);
  return s;
}
const activeIds = (game) => game.order.filter((id) => game.players[id].status === 'active');
/** Листает фазы, пока не начнётся голосование. */
function toVote(s) {
  for (let i = 0; i < 200 && s.game.phase !== PH.VOTE; i++) {
    if (s.game.overlay) E.act(s.game, s.game.overlay.nomineeId, 'save', { card: 'none' }, s.now);
    else E.skip(s.game, s.now += 1000);
  }
  return s.game.phase === PH.VOTE;
}
/** Все голосуют по схеме: функция получает id и возвращает цель. */
function vote(s, pick) {
  activeIds(s.game).forEach((id) => E.act(s.game, id, 'vote', { target: pick(id) }, s.now));
  E.skip(s.game, s.now += 1000);
  while (s.game.overlay && s.game.overlay.type === 'save') E.act(s.game, s.game.overlay.nomineeId, 'save', { card: 'none' }, s.now);
}
const other = (game, id, k = 0) => activeIds(game).filter((x) => x !== id)[k];

{
  const s = start();
  toVote(s);
  check(s.game.vote.canSkip && E.view(s.game, 'p0').vote.canSkip, 'в первом голосовании есть «Никого не исключать»');
  vote(s, () => 'skip');
  check(s.game.phase === PH.RESULT && s.game.kicks.length === 0, 'большинство за пропуск: никто не выбыл');
  check(!!E.view(s.game, 'p0').skip, 'экран итога знает, что исключения не было');
  E.skip(s.game, s.now += 1000);
  check(s.game.round === 2, 'после пропуска начинается второй раунд');
  toVote(s);
  check(!s.game.vote.canSkip && E.view(s.game, 'p0').roundKicks === 2, 'во втором раунде пропуска нет, исключений два');
  const r = E.act(s.game, 'p0', 'vote', { target: 'skip' }, s.now);
  check(!r.ok, 'сервер не принимает пропуск во втором раунде');
  const target = activeIds(s.game)[1];
  vote(s, (id) => (id === target ? other(s.game, id) : target));
  check(s.game.kicks.length === 1 && s.game.phase === PH.RESULT, 'первое исключение второго раунда');
  E.skip(s.game, s.now += 1000);
  check(s.game.phase === PH.VOTE && s.game.round === 2 && s.game.vote.second, 'сразу второе голосование в том же раунде');
  const t2 = activeIds(s.game)[1];
  vote(s, (id) => (id === t2 ? other(s.game, id) : t2));
  check(s.game.kicks.filter((k) => k.round === 2).length === 2 || s.game.phase === PH.VERDICT, 'во втором раунде выбыли двое');
  if (s.game.phase === PH.RESULT) {
    E.skip(s.game, s.now += 1000);
    check(s.game.round === 3, 'после двух исключений идёт третий раунд');
    toVote(s);
    check(!s.game.vote.canSkip && E.view(s.game, 'p0').roundKicks === 1, 'в третьем раунде снова одно исключение');
  }
}

{
  // Пропуск наравне с игроком: переголосование между ними, повторная ничья значит никого.
  const s = start();
  toVote(s);
  const ids = activeIds(s.game), a = ids[0];
  const half = Math.floor(ids.length / 2);
  // 7 игроков: трое за пропуск, трое против a, сам a тоже за пропуск? Делаем поровну: 3 и 3, седьмой голосует за другого.
  vote(s, (id) => { const i = ids.indexOf(id); return i === 0 ? 'skip' : i <= half - 1 ? 'skip' : i < ids.length - 1 ? a : ids[1]; });
  const v = s.game.vote;
  check(s.game.phase === PH.VOTE && v.runoff && v.canSkip && v.candidates.includes(a), 'ничья пропуска с игроком: переголосование с вариантом пропуска');
  vote(s, (id) => { const i = ids.indexOf(id); return i < 3 ? 'skip' : i < 6 ? (id === a ? 'skip' : a) : 'skip'; });
  const sk = s.game.vote.skipCount, ca = s.game.vote.count[a];
  check(s.game.kicks.length === 0 && s.game.phase === PH.RESULT, `переголосование решилось в пользу пропуска (${sk} против ${ca})`);
}

{
  const s = start({ skipFirst: false });
  toVote(s);
  check(!s.game.vote.canSkip && !E.act(s.game, 'p0', 'vote', { target: 'skip' }, s.now).ok, 'с выключенным правилом пропуска нет');
}

{
  // Малый состав: пропуска нет.
  const players = Array.from({ length: 3 }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
  const game = E.createGame({ caseData: Cases.CASES[0], players, seed: 5, now: 1000, settings: { mode: 'timers', table: 'small' } });
  const s = { game, now: 1000 };
  toVote(s);
  check(game.phase === PH.VOTE && !game.vote.canSkip, 'в режиме 2–5 пропуска нет');
}

{
  // Боты: партии доходят до конца, пропуск случается, во втором раунде после него два исключения.
  let skips = 0, ok = 0, bad = 0;
  for (let i = 0; i < 120; i++) {
    const list = Array.from({ length: 6 + (i % 5) }, (_, j) => ({ id: 'b' + j, name: 'Б' + j, bot: true }));
    let now = 1000;
    const game = E.createGame({ caseData: Cases.CASES[i % 15], players: list, seed: 100 + i, now, settings: { mode: 'timers' } });
    let st = 0;
    while (game.phase !== PH.ENDED && st++ < 80000) { now += 400; E.tick(game, now); }
    if (game.phase !== PH.ENDED) { bad++; continue; }
    ok++;
    if (game.skip) {
      skips++;
      const r2 = game.kicks.filter((k) => k.round === 2).length;
      if (game.verdict.round > 2 && r2 !== 2) bad++;
      if (game.kicks.some((k) => k.round === 1)) bad++;
    }
  }
  check(bad === 0 && skips > 0, `партии ботов: закончено ${ok}, с пропуском ${skips}, ошибок ${bad}`);
}

console.log(fails ? `Провалов: ${fails}` : 'Пропуск исключения в порядке.');
process.exit(fails ? 1 : 0);
