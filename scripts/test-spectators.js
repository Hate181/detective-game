// Зрители: кто пришёл по ссылке в идущую партию, смотрит её без ролей и карточек и ничего не меняет.
const { Hub } = require('../public/shared/hub.js');
const Cases = require('../public/shared/cases.js');
let t = 1000;
const cases = JSON.parse(JSON.stringify(Cases.CASES));
const store = { getCases: () => cases, saveCases() {}, getStats: () => store.s, saveStats(s) { store.s = s; }, s: null };
const events = [];
const hub = new Hub({ store, now: () => t, guestNames: true, onChange: (code, extra) => events.push(extra || {}) });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } };

const tok = (i) => 'tok' + String(i).padStart(14, '0');
const host = tok(0);
const code = hub.handle(host, 'room:create', {}).code;
for (let i = 1; i < 6; i++) check(hub.handle(tok(i), 'room:join', { code }).ok, 'игрок садится в лобби');
for (let i = 1; i < 6; i++) hub.handle(tok(i), 'room:ready', {});
check(hub.handle(host, 'room:start', {}).ok, 'партия стартует');
const room = hub.rooms.get(code);

/* Вход в идущую партию: зритель, а не ошибка. */
const fan = tok(50);
let r = hub.handle(fan, 'room:join', { code });
check(r.ok && r.watching, 'в идущую партию заходят зрителем');
check(room.players.length === 6 && Object.keys(room.game.players).length === 6, 'зритель не садится за стол');
let v = hub.view(fan);
check(v && v.watching && v.meId === null && v.game && !v.game.me, 'у зрителя нет своей карточки');
check(v.game.players.every((p) => p.role === null), 'зритель не видит ролей во время партии');
check(!v.game.god && v.cases.length === 0, 'зрителю не уходят лишние данные');
check(hub.view(host).watchers === 1, 'игроки видят число зрителей');
check(hub.view(host).game.me, 'у игрока карточка на месте');

/* Зритель ничего не может сделать в партии. */
for (const [ev, p] of [['game:act', { action: 'ready', payload: {} }], ['game:act', { action: 'vote', payload: { target: room.game.order[0] } }], ['room:ready', {}], ['room:next', {}], ['room:close', {}], ['room:seat', {}]]) {
  check(!hub.handle(fan, ev, p).ok, `зрителю нельзя ${ev}`);
}

/* Повторный вход тем же браузером: снова зритель, без дублей. */
r = hub.handle(fan, 'room:join', { code });
check(r.ok && r.watching && room.watchers.length === 1, 'повторный вход зрителя не плодит записи');

/* Игрок, который переподключается, получает своё место, а не становится зрителем. */
hub.setConnected(tok(3), false);
r = hub.handle(tok(3), 'room:join', { code });
check(r.ok && !r.watching && hub.view(tok(3)).game.me, 'вернувшийся игрок снова за столом');

/* Связь у зрителя пропала: в счётчике его нет, через 10 минут он забыт. */
hub.setConnected(fan, false);
check(hub.view(host).watchers === 0, 'зритель без связи не считается');
hub.setConnected(fan, true);
check(hub.view(host).watchers === 1, 'зритель вернулся');

/* Зритель уходит сам. */
const fan2 = tok(51);
hub.handle(fan2, 'room:join', { code });
check(hub.handle(fan2, 'room:leave', {}).ok && !hub.roomOf(fan2) && room.watchers.length === 1, 'зритель уходит');

/* Зритель открывает свою комнату: из зрителей уходит без вопросов. */
const fan3 = tok(52);
hub.handle(fan3, 'room:join', { code });
r = hub.handle(fan3, 'room:create', {});
check(r.ok && hub.roomOf(fan3).code === r.code && !room.watchers.some((w) => w.token === fan3), 'зритель может открыть свою комнату');
hub.handle(fan3, 'room:leave', {});

/* Конец партии: зритель видит итог и может сесть за стол на следующее дело. */
hub.handle(host, 'room:setting', { key: 'mode', value: 'timers' });
room.players.forEach((p) => { p.forceAuto = true; });
let steps = 0;
while (room.game.phase !== 'ended' && steps++ < 80000) { t += 400; hub.tick(t); }
check(room.game.phase === 'ended', 'партия доиграна');
v = hub.view(fan);
check(v.game.results && v.game.players.every((p) => p.role), 'после конца дела роли видны всем');
check(hub.handle(fan, 'room:seat', {}).ok, 'зритель садится за стол после конца дела');
check(room.players.length === 7 && !room.watchers.length, 'за столом семеро');
v = hub.view(fan);
check(!v.watching && v.meId && !v.game.me, 'севший ждёт следующего дела');
room.players.forEach((p) => { p.forceAuto = false; });
check(hub.handle(host, 'room:next', {}).ok && Object.keys(room.game.players).length === 7, 'новый игрок в следующем деле');
check(hub.view(fan).game.me, 'у нового игрока своя карточка');

/* Закрытие комнаты освобождает зрителей. */
const fan4 = tok(53);
hub.handle(fan4, 'room:join', { code });
events.length = 0;
hub.handle(host, 'room:close', {});
check(!hub.roomOf(fan4) && events.some((e) => e.closed && e.tokens.includes(fan4)), 'зритель узнаёт, что комнату закрыли');

/* Ушедший из партии игрок, уже севший в другую комнату, не теряет её, когда старую закрывают. */
{
  const c2 = hub.handle(tok(10), 'room:create', {}).code;
  for (let i = 11; i < 16; i++) { hub.handle(tok(i), 'room:join', { code: c2 }); hub.handle(tok(i), 'room:ready', {}); }
  hub.handle(tok(10), 'room:start', {});
  hub.handle(tok(15), 'room:leave', {});
  const c3 = hub.handle(tok(15), 'room:create', {}).code;
  hub.handle(tok(10), 'room:close', {});
  check(hub.roomOf(tok(15)) && hub.roomOf(tok(15)).code === c3, 'новая комната ушедшего игрока на месте');
}

/* Лимит зрителей. */
{
  const c4 = hub.handle(tok(20), 'room:create', {}).code;
  for (let i = 21; i < 26; i++) { hub.handle(tok(i), 'room:join', { code: c4 }); hub.handle(tok(i), 'room:ready', {}); }
  hub.handle(tok(20), 'room:start', {});
  for (let i = 0; i < 30; i++) hub.handle(tok(100 + i), 'room:join', { code: c4 });
  check(hub.handle(tok(200), 'room:join', { code: c4 }).code === 'watch_full', 'больше 30 зрителей не пускаем');
}

if (fails) { console.log(`Зрители: провалов ${fails}`); process.exit(1); }
console.log('Зрители: всё в порядке');
