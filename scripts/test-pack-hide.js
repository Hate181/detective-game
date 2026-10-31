// Скрытие пака по дате: «Хеллоуин» пропадает из обычных комнат с 8 ноября 2026, 00:00 по Москве, но остаётся у админа.
const { Hub } = require('../public/shared/hub.js');
const Cases = require('../public/shared/cases.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };

const CUT = Date.parse('2026-11-07T21:00:00Z');
const hw = Cases.CASES.filter((c) => c.pack === 'halloween');
check(Cases.packHidden('halloween', CUT - 1) === false, 'до 8 ноября пак виден');
check(Cases.packHidden('halloween', CUT) === true, 'с 8 ноября 00:00 МСК пак скрыт');
check(!Cases.packHidden('main', CUT + 1e12) && !Cases.packHidden('onair', CUT) && !Cases.packHidden('anime', CUT), 'другие паки не скрываются');
check(hw.length === 10, 'дела пака остаются в коде');

let t = CUT - 60 * 1000;
const list = JSON.parse(JSON.stringify(Cases.CASES));
const store = { getCases: () => list, saveCases() {}, getStats: () => store.s, saveStats(s) { store.s = s; }, s: null };
const hub = new Hub({ store, now: () => t });
hub.setAdmin('adm', true);

const fill = (code, pre) => Array.from({ length: 5 }, (_, i) => { const tk = pre + i; hub.handle(tk, 'room:join', { code, name: 'Игрок' + i }); hub.handle(tk, 'room:ready', {}); return tk; });

// До даты: пак есть, комната его выбирает.
const { code: early } = hub.handle('h1', 'room:create', { name: 'Ведущий' });
check(hub.view('h1').packs.some((p) => p.id === 'halloween'), 'до даты «Хеллоуин» в «Выбор пака»');
check(hub.handle('h1', 'room:pack', { packId: 'halloween' }).ok, 'до даты пак можно выбрать');
check(hub.handle('h1', 'room:case', { caseId: hw[0].id }).ok, 'до даты можно выбрать дело пака');
fill(early, 'e');

// Наступило 8 ноября.
t = CUT + 1000;
const v1 = hub.view('h1');
check(!v1.packs.some((p) => p.id === 'halloween'), 'после даты пака нет в «Выбор пака» даже у открытой комнаты');
check(v1.pack === 'main', 'комната, выбравшая пак заранее, показывает «Основной»');
check(!v1.cases.some((c) => c.pack === 'halloween'), 'дел пака нет в списке выбора дела');
let r = hub.handle('h1', 'room:start', {});
check(r.ok && hub.rooms.get(early).game.caseData.pack !== 'halloween', 'заранее выбранное дело пака не стартует, выпадает другое');

const { code: late } = hub.handle('h2', 'room:create', { name: 'Ведущий' });
check(!hub.handle('h2', 'room:pack', { packId: 'halloween' }).ok, 'после даты выбрать пак нельзя');
check(!hub.handle('h2', 'room:case', { caseId: hw[0].id }).ok, 'после даты выбрать дело пака нельзя');
fill(late, 'l');
const room = hub.rooms.get(late);
let leaked = 0;
for (let g = 0; g < 40; g++) {
  r = g === 0 ? hub.handle('h2', 'room:start', {}) : (room.game.phase = 'ended', hub.handle('h2', 'room:next', {}));
  if (!r.ok) { check(false, 'партия стартует: ' + r.error); break; }
  if (room.game.caseData.pack === 'halloween') leaked++;
}
check(leaked === 0, `случайное дело ни разу не из «Хеллоуина» (${leaked} из 40)`);
room.game.phase = 'brief';
check(!hub.handle('h2', 'room:recase', { caseId: hw[1].id }).ok, 'на вводной сменить дело на хеллоуинское нельзя');

// Админ: тестовая комната видит и выбирает пак.
r = hub.handle('adm', 'admin:test', { name: 'Админ', bots: 5, speed: 1, role: 'innocent', mode: 'host', caseId: hw[2].id });
check(r.ok && hub.rooms.get(r.code).game.caseData.id === hw[2].id, 'админ запускает тестовую партию по делу пака');
r = hub.handle('adm', 'admin:test', { name: 'Админ', bots: 5, speed: 1, role: 'innocent', mode: 'host', autostart: false });
const va = hub.view('adm');
check(va.packs.some((p) => p.id === 'halloween'), 'в тестовой комнате админа пак виден');
check(hub.handle('adm', 'room:pack', { packId: 'halloween' }).ok, 'админ может выбрать пак в тестовой комнате');
check(hub.handle('adm', 'room:case', { caseId: hw[3].id }).ok, 'админ может выбрать дело пака в тестовой комнате');
check(hub.enabledCases().filter((c) => c.pack === 'halloween').length === 10, 'в архиве админки все 10 дел на месте');

if (fails) { console.log(`\nПровалов: ${fails}`); process.exit(1); }
console.log('\nСкрытие пака по дате работает.');
