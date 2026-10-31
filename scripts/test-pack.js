/* Паки и уникальность партий: в паке 15 дел, комната выбирает дело из пака случайно, карточки при повторе дела разные. */
const { Hub } = require('../public/shared/hub.js');
const Cases = require('../public/shared/cases.js');
const Gen = require('../public/shared/generator.js');
const Content = require('../public/shared/content.js');
const { Rng } = require('../public/shared/rng.js');
const Engine = require('../public/shared/engine.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };

// 1. Состав пака
const main = Cases.CASES.filter((c) => c.pack === 'main');
check(main.length === 15, `в паке «Основной» 15 дел (сейчас ${main.length})`);
check(new Set(main.map((c) => c.id)).size === 15 && new Set(main.map((c) => c.title)).size === 15, 'названия и id не повторяются');
check(!main.some((c) => Cases.RETIRED_IDS.includes(c.id)), 'ни одно новое дело не носит id старых');
check(new Set(main.map((c) => c.teaser.split(' ').slice(0, 3).join(' '))).size >= 14, 'вводные начинаются по-разному');
check(main.every((c) => c.locations.length >= 7 && c.professions.length >= 18), 'в каждом деле 7 мест и 18 профессий');
check(Content.RELATIONS.length >= 40 && Content.MOTIVES.length >= 40 && Content.HABIT_TAGS.length >= 14, `пулы черт большие: связей ${Content.RELATIONS.length}, мотивов ${Content.MOTIVES.length}, привычек ${Content.HABIT_TAGS.length}`);
check(Content.SECRET_LOC.length >= 20 && Content.SECRET_PLAIN.length >= 24, 'пулы секретов большие');
check(main.every((c) => !/—/.test(c.teaser + c.title + c.victim)), 'в текстах дел нет длинных тире');

// 2. Хаб: пак, случайный выбор без повтора
let t = 1000;
const list = JSON.parse(JSON.stringify(Cases.CASES));
const store = { getCases: () => list, saveCases() {}, getStats: () => store.s, saveStats(s) { store.s = s; }, s: null };
const hub = new Hub({ store, now: () => t });
const seen = [];
let prev = null, repeats = 0;
for (let g = 0; g < 75; g++) {
  const toks = Array.from({ length: 6 }, (_, i) => 'tk' + g + '_' + i);
  const { code } = hub.handle(toks[0], 'room:create', { name: 'Ведущий' });
  const room = hub.rooms.get(code);
  if (g === 0) {
    check(room.pack === 'main' && hub.view(toks[0]).packs[0].count === 15, 'у новой комнаты пак «Основной», в нём 15 дел');
    check(!hub.handle(toks[0], 'room:pack', { packId: 'nope' }).ok, 'несуществующий пак отклоняется');
    check(hub.handle(toks[0], 'room:pack', { packId: 'main' }).ok, 'выбор пака принимается');
  }
  toks.slice(1).forEach((tk, i) => { hub.handle(tk, 'room:join', { code, name: 'Игрок' + i }); hub.handle(tk, 'room:ready', {}); });
  const r = hub.handle(toks[0], 'room:start', {});
  if (!r.ok) { check(false, 'партия стартует: ' + r.error); break; }
  const id = room.game.caseData.id;
  seen.push(id);
  if (id === prev) repeats++;
  prev = id;
  // следующая партия в той же комнате
  hub.handle(toks[0], 'game:act', { action: 'noop', payload: {} });
  room.lastCaseId = id;
  t += 1000;
}
check(new Set(seen).size >= 13, `за 75 запусков выпало ${new Set(seen).size} разных дел из 15`);
{
  // повтор подряд в одной комнате: дело не выпадает дважды подряд
  const toks = Array.from({ length: 6 }, (_, i) => 'rp' + i);
  const { code } = hub.handle(toks[0], 'room:create', { name: 'Ведущий' });
  toks.slice(1).forEach((tk, i) => { hub.handle(tk, 'room:join', { code, name: 'И' + i }); hub.handle(tk, 'room:ready', {}); });
  const room = hub.rooms.get(code);
  let last = null, again = 0;
  for (let k = 0; k < 40; k++) {
    room.status = 'lobby'; room.game = null;
    room.players.forEach((p) => { p.ready = true; });
    if (!hub.handle(toks[0], 'room:start', {}).ok) break;
    const id = room.game.caseData.id;
    if (id === last) again++;
    last = id; room.lastCaseId = id;
  }
  check(again === 0, 'в одной комнате то же дело не выпадает дважды подряд');
}

// 3. Миграция сохранённого архива: старые встроенные дела уходят, новые приходят, правки админа сохраняются
{
  const old = Cases.RETIRED_IDS.map((id) => ({ id, title: 'Старое ' + id, pack: undefined, professions: [], enabled: true }));
  old.push({ id: 'custom-1', title: 'Дело админа', professions: [], enabled: true });
  const m = Cases.mergeBuiltins(old, Cases.RETIRED_IDS, 2, 0);
  check(m.retired === 20 && m.added === Cases.CASES.length, `миграция: убрано ${m.retired} старых, добавлено ${m.added} новых`);
  check(old.some((c) => c.id === 'custom-1' && c.pack === 'main'), 'дело админа осталось и попало в основной пак');
  const again = Cases.mergeBuiltins(old, m.seen, m.textRev, m.packRev);
  check(!again.added && !again.retired, 'повторный запуск ничего не меняет');
}

// 4. Уникальность партий при повторе дела
const sig = (card) => [card.profession, card.habitText, card.relation, card.motive].join('|');
let totalMatch = 0, totalCmp = 0, sameClues = 0, cmpClues = 0, sameKiller = 0, cmpKillers = 0, sameRoles = 0;
for (const c of main) {
  const games = [];
  for (let g = 0; g < 40; g++) {
    const n = 6 + (g % 5);
    const rng = new Rng(5000 + g * 31 + c.id.length);
    const ids = Array.from({ length: n }, (_, i) => 'p' + i);
    const killer = ids[rng.int(n)], acc = rng.pick(ids.filter((x) => x !== killer));
    const gen = Gen.generate({ caseData: c, ids, killerId: killer, accompliceId: acc, gang: true, rng });
    games.push({ n, gen, killer, acc });
  }
  for (let i = 0; i < games.length; i++) for (let j = i + 1; j < games.length; j++) {
    const A = games[i], B = games[j];
    const setA = new Set(Object.values(A.gen.cards).map(sig));
    Object.values(B.gen.cards).forEach((card) => { totalCmp++; if (setA.has(sig(card))) totalMatch++; });
    cmpClues++; if (A.gen.clues.map((x) => x.tag).sort().join() === B.gen.clues.map((x) => x.tag).sort().join()) sameClues++;
    cmpKillers++; if (A.gen.cards[A.killer].profession === B.gen.cards[B.killer].profession) sameKiller++;
  }
}
const pct = (a, b) => (100 * a / b).toFixed(2);
check(totalMatch / totalCmp < 0.01, `одинаковая карточка (профессия, особенность, связь, мотив) в двух партиях одного дела: ${pct(totalMatch, totalCmp)}%`);
check(sameClues / cmpClues < 0.02, `одинаковый набор улик в двух партиях одного дела: ${pct(sameClues, cmpClues)}%`);
check(sameKiller / cmpKillers < 0.12, `профессия убийцы совпадает в двух партиях: ${pct(sameKiller, cmpKillers)}%`);
{
  // Внутри одной партии связи и мотивы не повторяются
  let dup = 0, games = 0;
  for (const c of main) for (let g = 0; g < 20; g++) {
    const rng = new Rng(900 + g);
    const ids = Array.from({ length: 10 }, (_, i) => 'p' + i);
    const gen = Gen.generate({ caseData: c, ids, killerId: 'p3', accompliceId: 'p7', gang: true, rng });
    games++;
    const rel = Object.values(gen.cards).map((x) => x.relation), mot = Object.values(gen.cards).map((x) => x.motive), pro = Object.values(gen.cards).map((x) => x.profession);
    if (new Set(rel).size < 10 || new Set(mot).size < 10 || new Set(pro).size < 10) dup++;
  }
  check(dup === 0, `в одной партии на десятерых связи, мотивы и профессии не повторяются (${games} партий)`);
}

// 5. Тематические паки «Хеллоуин», «В эфире» и «Аниме»
for (const [packId, packTitle, size, pros] of [['halloween', 'Хеллоуин', 10, 18], ['onair', 'В эфире', 10, 18], ['anime', 'Аниме', 11, 20]]) {
  const hw = Cases.CASES.filter((c) => c.pack === packId);
  check(hw.length === size && new Set(hw.map((c) => c.title)).size === size, `в паке «${packTitle}» ${size} дел (сейчас ${hw.length})`);
  check(hw.every((c) => c.locations.length === 7 && c.locations.includes(c.scene) && c.professions.length === pros), `в каждом деле пака «${packTitle}» 7 мест и ${pros} профессий`);
  check(hw.every((c) => c.habits.length === 16 && c.relations.length === 12 && c.motives.length === 12 && c.secrets.length === 8), `у каждого дела пака «${packTitle}» 16 примет, 12 связей, 12 мотивов, 8 секретов`);
  check(hw.every((c) => c.professions.every((p) => p.tags.length && p.tags.every((t) => Content.clueTexts(c, t) === c.proClues[t]))), 'у каждой профессии есть умение, и у каждого умения свои улики дела');
  check(hw.every((c) => Cases.ICONS.includes(c.icon) && c.teaser.length <= 400), 'значки из набора, вводные не длиннее 400 знаков');
  const txt = JSON.stringify(hw);
  check(!/[—–]/.test(txt), `в делах пака «${packTitle}» нет тире`);
  const all = hw.flatMap((c) => c.habits.flatMap((h) => h.clues).concat(Object.values(c.proClues).flat()));
  check(new Set(all).size === all.length, `улики не повторяются (${all.length})`);
  // Партии собираются при любом составе
  let broken = 0, runs = 0;
  for (const c of hw) for (let n = 6; n <= 10; n++) for (let g = 0; g < 30; g++) {
    runs++;
    const rng = new Rng(77 + g * 13 + n);
    const ids = Array.from({ length: n }, (_, i) => 'p' + i);
    try {
      const gen = Gen.generate({ caseData: c, ids, killerId: 'p1', accompliceId: 'p4', gang: true, rng });
      if (Gen.verify(gen, ids, 'p1', 'p4').length) broken++;
    } catch (e) { broken++; }
  }
  check(broken === 0, `партии пака «${packTitle}» собираются и проходят проверку (${runs} партий, сломано ${broken})`);
  // Комната с паком берёт дела только из него
  const toks = Array.from({ length: 7 }, (_, i) => packId + i);
  const { code } = hub.handle(toks[0], 'room:create', { name: 'Ведущий' });
  check(hub.handle(toks[0], 'room:pack', { packId }).ok, `пак «${packTitle}» выбирается в лобби`);
  check(hub.view(toks[0]).packs.find((p) => p.id === packId).count === size, `в лобби у пака видно ${size} дел`);
  toks.slice(1).forEach((tk, i) => { hub.handle(tk, 'room:join', { code, name: 'Х' + i }); hub.handle(tk, 'room:ready', {}); });
  const room = hub.rooms.get(code);
  const got = new Set();
  for (let k = 0; k < 30; k++) {
    room.status = 'lobby'; room.game = null; room.players.forEach((p) => { p.ready = true; });
    if (!hub.handle(toks[0], 'room:start', {}).ok) break;
    got.add(room.game.caseData.id); room.lastCaseId = room.game.caseData.id;
  }
  check(got.size >= 8 && [...got].every((id) => hw.some((c) => c.id === id)), `из пака «${packTitle}» выпадают только его дела (${got.size} разных за 30 запусков)`);
  // Сохранённый архив сервера получает новые дела один раз
  const saved = JSON.parse(JSON.stringify(Cases.CASES.filter((c) => c.pack === 'main')));
  const mm = Cases.mergeBuiltins(saved, saved.map((c) => c.id), Cases.TEXT_REV, Cases.PACK_REV);
  const themed = Cases.CASES.filter((c) => c.pack !== 'main').length;
  check(mm.added === themed && saved.filter((c) => c.pack === packId).length === size, `архив сервера получил ${mm.added} новых дел, из них ${size} из «${packTitle}»`);
  check(!Cases.mergeBuiltins(saved, mm.seen, mm.textRev, mm.packRev).added, 'второй запуск ничего не добавляет');
  // Правка дела в админке не переносит его в другой пак
  hub.setAdmin('adm', true);
  const form = Object.assign({}, list.find((c) => c.id === hw[0].id), { teaser: hw[0].teaser + ' Правка.' });
  delete form.pack; ['habits', 'proClues', 'relations', 'motives', 'secrets'].forEach((k) => delete form[k]);
  const sv = hub.handle('adm', 'admin:case_save', { data: form });
  check(sv.ok && sv.case.pack === packId && sv.case.habits.length === 16, `правка дела в админке без поля пака оставляет дело в паке «${packTitle}» вместе с приметами`);
  const mv = hub.handle('adm', 'admin:case_save', { data: Object.assign({}, form, { pack: 'main' }) });
  check(mv.ok && mv.case.pack === 'main', 'в админке дело можно перенести в другой пак');
  if (packId === 'anime') {
    check(sv.case.npcNames && sv.case.npcNames.length === hw[0].npcNames.length, 'правка дела в админке сохраняет имена персонажей для «2–5»');
    const allNames = hw.flatMap((c) => c.npcNames || []);
    check(hw.every((c) => (c.npcNames || []).length >= 60 && new Set(c.npcNames).size === c.npcNames.length), 'у каждого аниме-дела от 60 своих имён персонажей без повторов');
    check(new Set(allNames).size === allNames.length, 'имена персонажей не повторяются между делами пака');
    const pool = new Set([...Content.NPC_NAMES.modern, ...Content.NPC_NAMES.classic]);
    for (const c of hw) {
      const g = Engine.createGame({ caseData: c, players: [{ id: 'a', name: 'А' }, { id: 'b', name: 'Б' }, { id: 'c', name: 'В' }], settings: { table: 'small' }, seed: 5 });
      const names = Object.values(g.players).filter((p) => p.npc).map((p) => p.name);
      if (!(names.length === 6 && names.every((n) => c.npcNames.includes(n) && !pool.has(n)))) { check(false, `в «2–5» дело ${c.id} берёт имена из своего списка (${names.join(', ')})`); break; }
    }
    check(true, 'в «2–5» аниме-дела берут имена персонажей из своего списка');
  }
}

// 6. Выбор дела ведущим и случайное дело без повторов в комнате
{
  const store6 = { getCases: () => list, saveCases() {}, getStats: () => store6.s, saveStats(s) { store6.s = s; }, s: null };
  const hub6 = new Hub({ store: store6, now: () => t });
  const toks = Array.from({ length: 6 }, (_, i) => 'cs_' + i);
  const { code } = hub6.handle(toks[0], 'room:create', { name: 'Ведущий' });
  const room = hub6.rooms.get(code);
  toks.slice(1).forEach((tk, i) => { hub6.handle(tk, 'room:join', { code, name: 'Игрок' + i }); hub6.handle(tk, 'room:ready', {}); });
  check(!hub6.handle(toks[1], 'room:case', { caseId: 'lyra' }).ok, 'не ведущий дело не выбирает');
  const pick = main[3].id;
  check(hub6.handle(toks[0], 'room:case', { caseId: pick }).ok && hub6.view(toks[1]).caseChoice === pick, 'ведущий выбрал дело в лобби, его видят все');
  hub6.handle(toks[0], 'room:start', {});
  check(room.game.caseData.id === pick, 'партия открылась с выбранным делом');
  check(room.caseChoice === 'random', 'выбор действует на одну партию');
  // смена дела на вводной
  check(!hub6.handle(toks[1], 'room:recase', { caseId: 'random' }).ok, 'не ведущий дело не меняет');
  check(!hub6.handle(toks[0], 'room:recase', { caseId: pick }).ok, 'то же дело второй раз не открыть');
  const other = main[5].id;
  const r1 = hub6.handle(toks[0], 'room:recase', { caseId: other });
  check(r1.ok && room.game.caseData.id === other && room.game.phase === 'brief', 'на вводной ведущий сменил дело на выбранное');
  const r2 = hub6.handle(toks[0], 'room:recase', { caseId: 'random' });
  check(r2.ok && room.game.caseData.id !== other, 'смена на случайное даёт другое дело');
  const v = hub6.view(toks[0]);
  check(v.cases.every((c) => c.pack) && v.playedCases.includes(pick) && v.playedCases.includes(other), 'в состоянии комнаты есть пак дел и уже открытые дела');
  room.game.phase = 'clue';
  check(!hub6.handle(toks[0], 'room:recase', { caseId: 'random' }).ok, 'после вводной дело уже не сменить');
  // «Следующее дело» без повторов, пока в паке есть несыгранные
  const ids = [room.game.caseData.id];
  for (let i = 0; i < 11; i++) {
    room.game.phase = 'ended';
    const r = hub6.handle(toks[0], 'room:next', {});
    if (!r.ok) { check(false, 'следующее дело: ' + r.error); break; }
    ids.push(room.game.caseData.id);
  }
  const fresh = ids.filter((id) => id !== pick && id !== other);
  check(new Set(fresh).size === fresh.length && !fresh.includes(pick) && !fresh.includes(other), `12 партий подряд в комнате без повторов (${new Set(ids).size} разных)`);
  // Игроки с аккаунтом: дело, которое они недавно играли, выпадает последним
  const store7 = { getCases: () => list, saveCases() {}, getStats: () => store7.s, saveStats(s) { store7.s = s; }, s: null };
  const hub7 = new Hub({ store: store7, now: () => t });
  const all7 = hub7.enabledCases().filter((c) => (c.pack || 'main') === 'main');
  const s7 = hub7._stats();
  s7.career.acc1 = { games: all7.length - 1, history: all7.slice(0, -1).map((c) => ({ case: c.title })) };
  store7.saveStats(s7);
  let hits = 0;
  for (let k = 0; k < 20; k++) {
    const tk = Array.from({ length: 6 }, (_, i) => `a${k}_${i}`);
    const { code: c7 } = hub7.handle(tk[0], 'room:create', { name: 'Ведущий' });
    const room7 = hub7.rooms.get(c7);
    room7.players[0].account = 'acc1';
    tk.slice(1).forEach((x, i) => { hub7.handle(x, 'room:join', { code: c7, name: 'И' + i }); hub7.handle(x, 'room:ready', {}); });
    hub7.handle(tk[0], 'room:start', {});
    if (room7.game.caseData.id === all7[all7.length - 1].id) hits++;
  }
  check(hits === 20, `несыгранное компанией дело выбрано ${hits} из 20 раз`);
}

console.log(fails ? `провалов: ${fails}` : 'паки в порядке');
process.exit(fails ? 1 : 0);
