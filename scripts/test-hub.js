// Прогон хаба без сети: тестовая комната, партия под управлением ведущего-человека и партия на автопилоте.
const { Hub } = require('../public/shared/hub.js');
const Cases = require('../public/shared/cases.js');
let t = 1000;
const cases = JSON.parse(JSON.stringify(Cases.CASES));
const store = { getCases: () => cases, saveCases() {}, getStats: () => store.s, saveStats(s) { store.s = s; }, s: null };
const hub = new Hub({ store, now: () => t });
hub.setAdmin('adm', true);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } };

/* 1. Админ как ведущий в режиме «ведущий»: сам листает фазы. */
let r = hub.handle('adm', 'admin:test', { name: 'Админ', bots: 7, speed: 1, role: 'innocent', mode: 'host' });
let code = r.code;
let v = hub.view('adm');
check(v.game.manual === true && v.game.hostId === v.meId, 'ведущий должен быть админом и вести вручную');
const act = (action, payload) => hub.handle('adm', 'game:act', { action, payload });
let steps = 0, hostPresses = 0;
while (hub.rooms.get(code).game.phase !== 'ended' && steps++ < 20000) {
  t += 400; hub.tick(t);
  const g = hub.view('adm').game;
  if (!g) break;
  const me = g.me;
  if (g.phase === 'turns' && g.turn.speakerId === me.id && me.can.reveal.length) act('reveal', { trait: me.can.reveal[0] });
  if (g.vote && me.can.vote && !g.vote.my) { const c = g.vote.candidates.filter((x) => x !== me.id)[0]; act('vote', { target: c }); }
  if (g.phase === 'defense' && g.defense.speaker === me.id) act('endspeech', {});
  // Ведущий нажимает «Дальше», когда фаза ждёт его (долго стоит на месте).
  if (['brief', 'clue', 'talk', 'result'].includes(g.phase) && t - g.phaseStartedAt > 2500) { const x = act('host', { do: 'next' }); if (x.ok) hostPresses++; }
  if (g.phase === 'turns' && t - g.phaseStartedAt > 15000) { const x = act('host', { do: 'next' }); if (x.ok) hostPresses++; }
  if (g.phase === 'accuse' && t - g.phaseStartedAt > 3000) { const x = act('host', { do: 'next' }); if (x.ok) hostPresses++; }
  if (g.phase === 'accomplice' && g.me.role === 'accomplice') act('accomplice', { mode: 'stealth' });
}
let g = hub.view('adm').game;
check(g.phase === 'ended', 'партия с ведущим должна закончиться');
console.log('с ведущим:', g.results.winner, g.results.reason, 'раундов', g.results.rounds, 'нажатий «Дальше»', hostPresses, 'шагов', steps);
check(hostPresses > 3, 'ведущий должен был листать фазы');
const bad = hub.handle('adm', 'game:act', { action: 'host', payload: { do: 'next' } });
check(!bad.ok, 'после конца дела кнопки ведущего не работают');

/* 2. Резервный режим: ведущий пропал, партия идёт по таймерам. */
r = hub.handle('adm', 'admin:test', { name: 'Админ', bots: 7, speed: 0.2, role: 'killer', mode: 'host' });
code = r.code;
hub.handle('adm', 'admin:room', { code, action: 'auto' });
steps = 0;
while (hub.rooms.get(code).game.phase !== 'ended' && steps++ < 60000) { t += 400; hub.tick(t); }
g = hub.view('adm').game;
check(g.phase === 'ended', 'партия без ведущего должна идти по таймерам');
console.log('автопилот:', g.results.winner, g.results.reason, 'очки', JSON.stringify(g.results.score));

/* 3. Следующая партия, настройки, Discord, симуляция. */
console.log('next', hub.handle('adm', 'room:next', {}).ok);
check(hub.handle('adm', 'room:setting', { key: 'discord', value: 'https://evil.example/x' }).ok === false, 'чужая ссылка не принимается');
check(hub.handle('adm', 'room:setting', { key: 'discord', value: 'discord.gg/noirclub' }).ok, 'ссылка Discord принимается');
check(hub.view('adm').settings.discord === 'https://discord.gg/noirclub', 'ссылка сохранилась');
const s = hub.handle('adm', 'admin:sim', { games: 40, players: 8 });
console.log('sim', JSON.stringify(s.sim));
check(!s.sim.errors.length, 'симуляция без ошибок');
{
  // Фото за столом: из личности аккаунта, только разрешённые адреса, у гостей и ботов нет.
  const ph = new Hub({ store, now: () => t });
  ph.setIdentity('acc-a', { id: 'email:a', provider: 'email', name: 'Анна', avatar: '/photo/' + 'ab'.repeat(12) + '.jpg' });
  ph.setIdentity('acc-b', { id: 'discord:1', provider: 'discord', name: 'Борис', avatar: 'https://cdn.discordapp.com/avatars/123/abc_1.png?size=128' });
  ph.setIdentity('acc-c', { id: 'discord:2', provider: 'discord', name: 'Вера', avatar: 'https://evil.example/x.png' });
  const { code } = ph.handle('acc-a', 'room:create', { name: 'Анна' });
  ph.handle('acc-b', 'room:join', { code, name: 'Борис' });
  ph.handle('acc-c', 'room:join', { code, name: 'Вера' });
  ph.handle('guest-1', 'room:join', { code, name: 'Гость' });
  const pl = ph.view('acc-a').players;
  const by = (n) => pl.find((p) => p.name === n) || {};
  check(by('Анна').photo === '/photo/' + 'ab'.repeat(12) + '.jpg' && /cdn\.discordapp\.com/.test(by('Борис').photo), 'своё фото и аватарка Discord видны за столом');
  check(by('Вера').photo === null && by('Гость').photo === null, 'чужие адреса и гости без фото');
  ph.setIdentity('acc-a', { id: 'email:a', provider: 'email', name: 'Анна', avatar: '' });
  check(ph.view('acc-b').players.find((p) => p.name === 'Анна').photo === null, 'убранное фото сразу пропадает у всех');
}
console.log(fails ? `провалов: ${fails}` : 'хаб в порядке');
process.exit(fails ? 1 : 0);
