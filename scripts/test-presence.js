// Присутствие игроков: один активный вход, возврат на место, выход, закрытие комнаты, перенос гостя в аккаунт.
const { Hub } = require('../public/shared/hub.js');
const Cases = require('../public/shared/cases.js');
let t = 1000, fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };
const cases = JSON.parse(JSON.stringify(Cases.CASES));
const events = [];
const store = { getCases: () => cases, saveCases() {}, getStats: () => store.s, saveStats(s) { store.s = s; }, s: null };
const hub = new Hub({ store, now: () => t, onChange: (code, extra) => { if (extra && (extra.closed || extra.kicked)) events.push(extra); } });
const tok = (n) => 'tok-' + String(n).padStart(14, '0');

function fillRoom(n, base = 0) {
  const host = tok(base + 1);
  const r = hub.handle(host, 'room:create', { name: 'Ведущий' });
  for (let i = 2; i <= n; i++) { const j = hub.handle(tok(base + i), 'room:join', { code: r.code, name: 'Игрок' + i }); if (!j.ok) throw new Error(j.error); hub.handle(tok(base + i), 'room:ready'); }
  return r.code;
}

const code = fillRoom(6);
check(hub.handle(tok(1), 'room:start').ok, 'ведущий запускает партию');
let g = hub.view(tok(2)).game;
check(!!g, 'партия идёт');

// 1. Нельзя открыть или занять вторую комнату, пока сидишь в первой
let r = hub.handle(tok(2), 'room:create', { name: 'Игрок2' });
check(!r.ok && r.code === 'in_room' && r.current && r.current.code === code && r.current.status === 'playing', 'создать вторую комнату нельзя, ответ называет текущую');
const other = hub.handle(tok(20), 'room:create', { name: 'Чужой' }).code;
r = hub.handle(tok(2), 'room:join', { code: other, name: 'Игрок2' });
check(!r.ok && r.code === 'in_room', 'войти в другую комнату нельзя, пока сидишь в партии');
check(hub.view(tok(2)) && hub.view(tok(2)).code === code, 'место в партии не потеряно после отказа');

// 2. Обрыв связи и возврат: место и карточка те же
const before = hub.view(tok(3)).game.me;
hub.setConnected(tok(3), false);
t += 20000; hub.tick(t);
check(hub.view(tok(1)).players.find((p) => p.name === 'Игрок3').auto === true, 'через 12 секунд без связи включается автопилот');
hub.setConnected(tok(3), true); t += 400; hub.tick(t);
const after = hub.view(tok(3)).game.me;
check(after.id === before.id && after.role === before.role, 'после возврата тот же игрок и та же роль');
check(hub.view(tok(1)).players.find((p) => p.name === 'Игрок3').auto === false, 'автопилот выключается после возврата');

// 3. Ушёл на главную: место держится, автопилот включается, возвращение выключает
hub.handle(tok(4), 'room:away', { away: true });
check(hub.view(tok(1)).players.find((p) => p.name === 'Игрок4').away === true, 'отошедший виден в списке');
t += 13000; hub.tick(t);
check(hub.view(tok(1)).players.find((p) => p.name === 'Игрок4').auto === true, 'у отошедшего играет автопилот');
hub.handle(tok(4), 'room:away', { away: false }); t += 400; hub.tick(t);
check(hub.view(tok(1)).players.find((p) => p.name === 'Игрок4').auto === false, 'вернулся, и ход снова его');

// 4. Уйти из партии самому и сразу зайти в другую комнату
r = hub.handle(tok(5), 'room:leave');
check(r.ok && !hub.view(tok(5)), 'игрок покинул партию');
r = hub.handle(tok(5), 'room:join', { code: other, name: 'Игрок5' });
check(r.ok && hub.view(tok(5)).code === other, 'после выхода можно войти в другую комнату');
r = hub.handle(tok(5), 'room:join', { code, name: 'Игрок5' });
check(!r.ok, 'обратно в идущую партию не пустят');

// 5. Дойти до конца и закрыть комнату
const room = hub.rooms.get(code);
hub.handle(tok(1), 'room:setting', { key: 'mode', value: 'timers' });
room.players.forEach((p) => { p.forceAuto = true; });
for (let i = 0; i < 30000 && room.game.phase !== 'ended'; i++) { t += 500; hub.tick(t); }
check(room.game.phase === 'ended', 'партия дошла до конца');
r = hub.handle(tok(2), 'room:create', { name: 'Игрок2' });
check(!r.ok && r.code === 'in_room', 'пока ведущий не закрыл комнату, игрок не может открыть новую игру');
r = hub.handle(tok(2), 'room:close');
check(!r.ok && r.code === 'not_host', 'закрыть комнату может только ведущий');
events.length = 0;
r = hub.handle(tok(1), 'room:close');
check(r.ok && !hub.rooms.has(code), 'ведущий закрыл комнату');
check(events.length === 1 && events[0].closed && events[0].tokens.length >= 4 && events[0].by === tok(1), 'всем игрокам ушло уведомление о закрытии');
r = hub.handle(tok(2), 'room:join', { code: other, name: 'Игрок2' });
check(r.ok, 'после закрытия игроки свободно заходят в другую игру');

// 6. Аккаунт: гость входит посреди лобби, место переходит на аккаунт
const c2 = fillRoom(3, 100);
hub.setIdentity('acc-' + 'a'.repeat(32), { id: 'discord:42', provider: 'discord', name: 'Мира' });
check(hub.migrate(tok(131), 'acc-' + 'a'.repeat(32)) === false, 'несуществующий гость не мигрирует');
hub.handle(tok(2), 'room:leave');
r = hub.handle(tok(2), 'room:join', { code: c2, name: 'Гость' });
check(r.ok, 'гость вошёл');
check(hub.migrate(tok(2), 'acc-' + 'a'.repeat(32)) === true, 'место гостя перенесено на аккаунт');
check(hub.view('acc-' + 'a'.repeat(32)) && hub.view('acc-' + 'a'.repeat(32)).code === c2 && !hub.view(tok(2)), 'аккаунт видит комнату на другом устройстве');
check(hub.view('acc-' + 'a'.repeat(32)).players.some((p) => p.provider === 'discord'), 'в списке игроков виден способ входа');

// 7. Ведущий уходит из лобби, ведение переходит
const c3 = fillRoom(3, 200);
hub.handle(tok(201), 'room:leave');
check(hub.view(tok(202)).hostId !== null && hub.view(tok(202)).players.length === 2, 'после ухода ведущего комната живёт, ведущий назначен');

console.log(fails ? `ПРОВАЛОВ: ${fails}` : 'присутствие в порядке');
process.exit(fails ? 1 : 0);
