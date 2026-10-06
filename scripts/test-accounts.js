// Гости и аккаунты: «Гость-12345» без входа, имя аккаунта после входа, личный кабинет.
const { Hub, guestName } = require('../public/shared/hub.js');
const Cases = require('../public/shared/cases.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };
const cases = JSON.parse(JSON.stringify(Cases.CASES));
const store = { getCases: () => cases, saveCases() {}, getStats: () => store.s, saveStats(s) { store.s = s; }, s: null };
const hub = new Hub({ store, guestNames: true });
const tok = (n) => 'guest-' + String(n).padStart(12, '0');
const me = (t) => { const v = hub.view(t); return v.players.find((p) => p.id === v.realMeId); };

// 1. Гость получает «Гость-» и пять цифр, присланное имя игнорируется
const r = hub.handle(tok(1), 'room:create', { name: 'Шерлок' });
check(r.ok, 'гость открывает комнату без имени');
check(/^Гость-\d{5}$/.test(me(tok(1)).name), `имя гостя: ${me(tok(1)).name}`);
check(me(tok(1)).name === guestName(tok(1)), 'номер совпадает с тем, что видит браузер');
check(guestName(tok(1)) === guestName(tok(1)) && guestName(tok(1)) !== guestName(tok(2)), 'номер постоянный для браузера и разный у разных браузеров');
for (let i = 2; i <= 10; i++) hub.handle(tok(i), 'room:join', { code: r.code, name: 'Шерлок' });
const names = hub.view(tok(1)).players.map((p) => p.name);
check(names.length === 10 && new Set(names).size === 10 && names.every((n) => /^Гость-\d{5}$/.test(n)), '10 гостей за столом, все имена разные');
check(!hub.handle(tok(2), 'room:rename', { name: 'Ватсон' }).ok, 'гость не может сменить имя');

// 2. Совпадение номера: второй гость получает другой номер
{
  const h2 = new Hub({ store, guestNames: true });
  const a = h2.handle('aaaaaaaaaaaaaaaa', 'room:create', {});
  const room = h2.rooms.get(a.code);
  room.players[0].name = guestName('bbbbbbbbbbbbbbbb');
  h2.handle('bbbbbbbbbbbbbbbb', 'room:join', { code: a.code });
  const ns = room.players.map((p) => p.name);
  check(new Set(ns.map((n) => n.toLowerCase())).size === 2 && /^Гость-\d{5}$/.test(ns[1]), 'при совпадении номера гость получает другой');
}

// 3. Вошедший игрок садится под именем аккаунта и меняет его
const acc = 'acc-' + 'f'.repeat(32);
hub.setIdentity(acc, { id: 'discord:42', provider: 'discord', name: 'Мира' });
const r2 = hub.handle(acc, 'room:create', { name: 'Кто-то другой' });
check(r2.ok && me(acc).name === 'Мира', 'аккаунт садится под своим именем');
check(hub.handle(acc, 'room:rename', { name: 'Мира Ч.' }).ok && me(acc).name === 'Мира Ч.', 'аккаунт меняет имя в лобби');
check(hub.identityOf(acc).name === 'Мира Ч.', 'новое имя запоминается за аккаунтом');
check(!hub.handle(acc, 'room:rename', { name: 'Гость-12345' }).ok, 'имя вида «Гость-12345» аккаунту не дать');

// 4. Гость вошёл в аккаунт в лобби: место переходит, имя меняется на имя аккаунта
{
  const g = 'guest-migrate-000001', a = 'acc-' + 'e'.repeat(32);
  hub.handle(g, 'room:join', { code: r2.code });
  hub.setIdentity(a, { id: 'google:7', provider: 'google', name: 'Игорь' });
  check(hub.migrate(g, a) && me(a).name === 'Игорь', 'после входа гость за столом становится Игорем');
}

// 5. Личный кабинет: итоги копятся по аккаунту за всё время
{
  const room = hub.rooms.get(r2.code);
  const pa = room.players.find((p) => p.token === acc), pb = room.players.find((p) => p.token !== acc);
  const play = (roleA, winner, ptsA) => {
    room.statsDone = false;
    room.game = {
      players: { [pa.id]: { role: roleA }, [pb.id]: { role: 'innocent' } }, order: [pa.id, pb.id], killerId: pa.id,
      caseData: { title: 'Смерть в оранжерее' },
      results: { winner, score: { [pa.id]: ptsA, [pb.id]: 3 }, awards: [{ playerId: pa.id, title: 'Шерлок' }] },
    };
    hub._recordGame(room);
  };
  play('innocent', 'innocent', 9);
  play('killer', 'innocent', 2);
  const d = hub.handle(acc, 'stats:me', {});
  check(d.ok && !d.guest && d.name === 'Мира Ч.', 'кабинет отдаёт имя аккаунта');
  check(d.career.games === 2 && d.career.wins === 1 && d.career.killer === 1 && d.career.innocent === 1, 'партии, победы и роли посчитаны');
  check(d.career.points === 11 && d.career.medals === 2, 'очки и медали посчитаны');
  check(d.career.history.length === 2 && d.career.history[0].role === 'killer' && d.career.history[0].case === 'Смерть в оранжерее' && !d.career.history[0].won, 'последняя партия сверху');
  check(d.season.rank === 1 && d.season.games === 2, 'место в сезоне');
  const gst = hub.handle(tok(3), 'stats:me', {});
  check(gst.ok && gst.guest && gst.name === guestName(tok(3)), 'гость видит только своё имя');
  // сезон сменился: личные итоги остаются
  store.s.season = '1999-К1';
  check(hub.handle(acc, 'stats:me', {}).career.games === 2, 'смена сезона не обнуляет личные итоги');
}

// 6. Без флага имя по-прежнему приходит от клиента (тесты и старые сценарии)
{
  const h3 = new Hub({ store });
  const x = h3.handle('cccccccccccccccc', 'room:create', { name: 'Анна' });
  check(x.ok && h3.view('cccccccccccccccc').players[0].name === 'Анна', 'без guestNames имя берётся от клиента');
}

if (fails) { console.log(`\nПровалено: ${fails}`); process.exit(1); }
console.log('\nГости и аккаунты: всё в порядке');
