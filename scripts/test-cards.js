/* Карты механик: «Подмена улики» в общей колоде, резинка баланса («Экспертиза» и «Ложный след»), карта защиты. */
const E = require('../public/shared/engine.js');
const Cases = require('../public/shared/cases.js');
const { PH } = E;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };

function start(n, seed = 5, rules) {
  const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'И' + i, bot: false }));
  const game = E.createGame({ caseData: Cases.CASES[2], players, seed, now: 1000, settings: { mode: 'timers', rules } });
  const st = { game, now: 1000 };
  E.act(game, game.killerId, 'alibi', { loc: game.caseData.locations.find((l) => l !== game.scene) }, st.now);
  E.skip(game, st.now += 1000);
  return st;
}
const act = (g) => g.order.filter((id) => g.players[id].status === 'active');
const has = (g, id, type) => g.players[id].cards.some((c) => !c.used && c.type === type);
function toPhase(st, phases) {
  const { game } = st;
  for (let i = 0; i < 400; i++) {
    if (game.phase === PH.ENDED) return false;
    if (phases.includes(game.phase) && !game.overlay) return true;
    if (game.overlay) { E.act(game, game.overlay.nomineeId, 'save', { card: 'none' }, st.now += 100); continue; }
    E.skip(game, st.now += 1000);
  }
  return false;
}
/** Все голосуют за target; подсчёт; карту защиты не трогаем. */
function voteFor(st, target) {
  const { game } = st;
  act(game).forEach((id) => { const t = id === target ? game.vote.candidates.find((c) => c !== id) : target; E.act(game, id, 'vote', { target: t }, st.now += 10); });
  E.skip(game, st.now += 100);
}

// Колода: обе «Подмены» в игре, старой карты убийцы нет
for (const n of [6, 7, 8, 9, 10]) {
  for (const seed of [1, 2, 3]) {
    const { game } = start(n, seed);
    const types = game.order.map((id) => game.players[id].cards[0].type);
    if (seed === 1) check(types.filter((t) => t === 'swap').length === 2 && !types.includes('plant'), `${n} игроков: в колоде две «Подмены», «Подбросить улику» больше нет`);
  }
}
{
  // «Подмена» достаётся кому угодно, а не только преступникам
  let inn = 0, crim = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const { game } = start(8, seed);
    game.order.forEach((id) => { if (game.players[id].cards[0].type === 'swap') { if (game.players[id].role === 'innocent') inn++; else crim++; } });
  }
  check(inn > 60 && crim > 10, `«Подмена» у невиновных ${inn} раз, у преступников ${crim} раз из 120`);
}

{
  // Подмена: улика меняется тайно, приходит по расписанию, в конце видно, кто и что подменил
  const st = start(8, 11);
  const { game } = st;
  const holder = game.order.find((id) => has(game, id, 'swap'));
  check(toPhase(st, [PH.TALK]) && game.round === 1, 'дошли до обсуждения первого раунда');
  const targets = E.swapTargets(game, game.players[holder]);
  check(targets.length > 0 && !targets.includes(holder), 'есть на кого навести подмену, себя в списке нет');
  const target = targets[0];
  const before = game.clues.map((c) => c.tag).join();
  const feedLen = game.feed.length;
  const r = E.act(game, holder, 'card', { type: 'swap', target }, st.now += 10);
  check(r.ok, 'подмена сыграна');
  const sw = game.clues.find((c) => c.planted);
  check(!!sw && sw.revealedRound === null && game.clues.length === 4, 'подменена одна из ещё не найденных улик, всего улик по-прежнему четыре');
  check(sw.fits.includes(target) && !sw.fits.includes(holder) && sw.orig && sw.orig.tag !== sw.tag && before !== game.clues.map((c) => c.tag).join(), 'новая улика подходит цели и не подходит тому, кто подменил');
  check(game.feed.length === feedLen, 'в журнале о подмене ни слова');
  const other = game.order.find((id) => id !== holder && id !== target);
  check(/подменена/.test(E.view(game, holder).me.notes.map((n) => n.text).join(' ')), 'тот, кто подменил, видит запись об этом у себя');
  // доводим до раунда, где улика найдена
  for (let i = 0; i < 400 && sw.revealedRound === null && game.phase !== PH.ENDED; i++) {
    if (game.overlay) { E.act(game, game.overlay.nomineeId, 'save', { card: 'none' }, st.now += 100); continue; }
    if (game.vote && [PH.VOTE].includes(game.phase)) { const inn = act(game).find((id) => game.players[id].role === 'innocent' && id !== holder && id !== target && id !== other); if (inn) { voteFor(st, inn); continue; } }
    E.skip(game, st.now += 1000);
  }
  if (sw.revealedRound !== null) {
    const vo = E.view(game, other).clues.find((c) => c.id === sw.id);
    const vh = E.view(game, holder).clues.find((c) => c.id === sw.id);
    check(vo && !vo.planted && !vo.mine && /Найдена улика/.test(game.feed.filter((f) => f.clueId === sw.id).map((f) => f.text).join()), 'подменённая улика пришла как обычная: остальные её не отличат');
    check(vh && vh.mine, 'у того, кто подменил, на улике пометка «подменена вами»');
  } else check(false, 'подменённая улика так и не была найдена');
  toPhase(st, [PH.ENDED]);
  if (game.phase !== PH.ENDED) { for (let i = 0; i < 400 && game.phase !== PH.ENDED; i++) { if (game.overlay) E.act(game, game.overlay.nomineeId, 'save', { card: 'none' }, st.now += 100); else E.skip(game, st.now += 1000); } }
  const rc = game.results.clues.find((c) => c.id === sw.id);
  check(rc && rc.planted && rc.orig && rc.orig.text && game.results.plants.some((p) => p.by === holder && p.targetId === target), 'в итогах видно, кто подменил, против кого и какая была настоящая улика');
}

{
  // Невиновного исключили: «Экспертиза» уходит невиновному (на шестерых двоим), карта показывает правду только владельцу
  for (const n of [6, 8]) {
    const st = start(n, 21);
    const { game } = st;
    toPhase(st, [PH.VOTE]);
    const victim = act(game).find((id) => game.players[id].role === 'innocent');
    voteFor(st, victim);
    const holders = act(game).filter((id) => has(game, id, 'lab'));
    check(game.players[victim].status === 'out' && holders.length === (n <= 6 ? 2 : 1) && holders.every((id) => game.players[id].role === 'innocent'), `${n} игроков: исключили невиновного, «Экспертизу» получили невиновные: ${holders.length}`);
    check(/Экспертиза/.test(game.feed.slice(-3).map((f) => f.text).join(' ')), 'в журнале сказано, что кто-то получил «Экспертизу»');
    toPhase(st, [PH.TALK]);
    const me = holders[0];
    const clue = game.clues.find((c) => c.revealedRound !== null);
    const t = act(game).find((id) => id !== me && game.players[id].card.tags.includes(clue.tag)) || act(game).find((id) => id !== me);
    const r = E.act(game, me, 'card', { type: 'lab', target: t, clueId: clue.id }, st.now += 10);
    const note = game.players[me].notes.find((x) => x.kind === 'lab');
    check(r.ok && note && note.fits === game.players[t].card.tags.includes(clue.tag), `«Экспертиза» ответила правду: ${note && note.text}`);
    check(!E.view(game, t).me.notes.some((x) => x.kind === 'lab'), 'результат видит только владелец карты');
    const bad = E.act(game, me, 'card', { type: 'lab', target: t, clueId: game.clues.find((c) => c.revealedRound === null).id }, st.now += 10);
    check(!bad.ok, 'ненайденную улику на экспертизу не отдать');
  }
}

{
  // Преступника исключили: «Ложный след» получает только оставшийся преступник
  const st = start(8, 31);
  const { game } = st;
  toPhase(st, [PH.VOTE]);
  voteFor(st, game.killerId);
  while (game.overlay) E.act(game, game.overlay.nomineeId, 'save', { card: 'none' }, st.now += 100);
  const acc = game.accompliceId;
  const holders = act(game).filter((id) => has(game, id, 'trail'));
  check(holders.length === 1 && holders[0] === acc, 'исключили убийцу: «Ложный след» только у сообщника');
  check(!game.feed.some((f) => /Ложный след/.test(f.text)), 'в журнале о «Ложном следе» ни слова');
  const v = E.view(game, acc);
  check(v.me.cards.some((c) => c.type === 'trail'), 'сообщник видит карту у себя');

  // Обыск по безобидному пункту карту не тратит
  toPhase(st, [PH.TALK]);
  const clueTags = game.clues.map((c) => c.tag);
  const card = game.players[acc].card;
  const cop = act(game).find((id) => game.players[id].role === 'innocent');
  game.players[cop].cards.push({ type: 'warrant', used: false }, { type: 'warrant', used: false }, { type: 'lab', used: false });
  E.act(game, cop, 'card', { type: 'warrant', target: acc, trait: 'relation' }, st.now += 10);
  check(has(game, acc, 'trail'), 'Обыск по связи с жертвой «Ложный след» не тратит');

  // Обыск по пункту, который совпал бы с уликой, показывает чистый результат
  const trait = ['habit', 'profession'].find((t) => !game.players[acc].revealed[t] && (t === 'profession' ? card.proTags : card.habitTags).some((g) => clueTags.includes(g))) || 'habit';
  check((trait === 'profession' ? card.proTags : card.habitTags).some((g) => clueTags.includes(g)), 'у сообщника есть пункт, который выдал бы его');
  const r = E.act(game, cop, 'card', { type: 'warrant', target: acc, trait }, st.now += 10);
  const note = game.players[cop].notes[game.players[cop].notes.length - 1];
  const real = trait === 'profession' ? card.profession : card.habitText;
  check(r.ok && note.text !== real, `Обыск показал чистое значение: «${note.text}» вместо «${real}»`);
  check(!has(game, acc, 'trail'), '«Ложный след» сработал и потрачен');
  const tn = game.players[acc].notes.find((x) => x.kind === 'trail');
  check(tn && tn.targetId === cop && E.view(game, acc).me.notes.some((x) => x.kind === 'trail'), `сообщник узнал, кто его проверял: ${tn && tn.text}`);
  check(!E.view(game, cop).me.notes.some((x) => x.kind === 'trail'), 'проверявший о срабатывании не знает');

  // Второй раз не срабатывает: Экспертиза говорит правду
  const clue = game.clues.find((c) => c.revealedRound !== null && card.tags.includes(c.tag));
  if (clue) {
    E.act(game, cop, 'card', { type: 'lab', target: acc, clueId: clue.id }, st.now += 10);
    const ln = game.players[cop].notes.find((x) => x.kind === 'lab');
    check(ln && ln.fits === true, 'после срабатывания Экспертиза показывает правду');
  }
}

{
  // Экспертиза и ложное алиби тоже прикрыты «Ложным следом»
  let labOk = false, alibiOk = false;
  for (let seed = 1; seed < 80 && !(labOk && alibiOk); seed++) {
    const st = start(8, seed);
    const { game } = st;
    if (!toPhase(st, [PH.TALK])) continue;
    const crim = game.accompliceId;
    const cop = act(game).find((id) => game.players[id].role === 'innocent');
    const clue = game.clues.find((c) => c.revealedRound !== null && game.players[crim].card.tags.includes(c.tag));
    if (!labOk && clue) {
      game.players[crim].cards.push({ type: 'trail', used: false });
      game.players[cop].cards.push({ type: 'lab', used: false });
      E.act(game, cop, 'card', { type: 'lab', target: crim, clueId: clue.id }, st.now += 10);
      const ln = game.players[cop].notes.find((x) => x.kind === 'lab');
      check(ln && ln.fits === false && /не подходит/.test(ln.text) && !has(game, crim, 'trail'), 'Экспертиза против владельца карты: «не подходит»');
      labOk = true;
      continue;
    }
    const pc = game.players[crim].card;
    if (!alibiOk && pc.alibi.claim && pc.alibi.claim.loc !== pc.alibi.real.loc) {
      game.players[crim].cards.push({ type: 'trail', used: false });
      game.players[cop].cards.push({ type: 'warrant', used: false });
      E.act(game, cop, 'card', { type: 'warrant', target: crim, trait: 'alibi' }, st.now += 10);
      const wn = game.players[cop].notes[game.players[cop].notes.length - 1];
      check(/подтверждается/.test(wn.extra || '') && !has(game, crim, 'trail'), 'ложное алиби под «Ложным следом» выглядит подтверждённым');
      alibiOk = true;
    }
  }
  check(labOk && alibiOk, 'нашли партии для проверки Экспертизы и алиби');
}

{
  // Без банды и с rules.trail === false карты нет
  const st = start(8, 31, { trail: false });
  const { game } = st;
  toPhase(st, [PH.VOTE]);
  voteFor(st, game.killerId);
  while (game.overlay) E.act(game, game.overlay.nomineeId, 'save', { card: 'none' }, st.now += 100);
  check(!act(game).some((id) => has(game, id, 'trail')), 'правило trail: false отключает карту');
}

{
  // Адвокат по-прежнему работает через старое действие
  let tried = false;
  for (let seed = 1; seed < 40 && !tried; seed++) {
    const st = start(7, seed);
    const { game } = st;
    const adv = game.order.find((id) => has(game, id, 'advocate'));
    if (!adv) continue;
    toPhase(st, [PH.VOTE]);
    voteFor(st, adv);
    if (!game.overlay) continue;
    tried = true;
    const r = E.act(game, adv, 'advocate', { play: true }, st.now += 10);
    check(r.ok && /Адвоката/.test(game.feed.map((f) => f.text).join(' ')), 'Адвокат играется как раньше');
  }
  check(tried, 'нашли партию с Адвокатом');
}

{
  // Боты доигрывают партии с новыми картами без ошибок
  for (const n of [6, 8, 10]) {
    const r = E.simulate({ caseData: Cases.CASES[n % Cases.CASES.length], games: 15, players: n, seed: 9 });
    check(!r.errors.length && !r.violations.length, `${n} ботов: 15 партий без ошибок`);
  }
}

console.log(fails ? `\nПровалов: ${fails}` : '\nВсе проверки карт пройдены.');
process.exit(fails ? 1 : 0);
