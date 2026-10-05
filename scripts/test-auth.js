// Вход через Discord и Google: настоящий сервер игры и поддельный провайдер на localhost.
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };
const GAME = 3107, PROV = 3108;

// Поддельный провайдер: authorize сразу возвращает код, token обменивает код, userinfo отдаёт профиль.
const users = { 'code-d': { id: '777', username: 'miralex', global_name: 'Мира', avatar: 'abc' }, 'code-g': { sub: 'g-555', name: 'Игорь', picture: 'http://x/p.png' } };
let tokenCalls = [];
const prov = http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PROV}`);
  if (u.pathname.endsWith('/authorize')) {
    const kind = u.pathname.includes('discord') ? 'd' : 'g';
    const back = new URL(u.searchParams.get('redirect_uri'));
    back.searchParams.set('code', 'code-' + kind); back.searchParams.set('state', u.searchParams.get('state'));
    res.writeHead(302, { Location: back.toString() }); return res.end();
  }
  if (u.pathname.endsWith('/token')) {
    let body = ''; req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const f = new URLSearchParams(body); tokenCalls.push(Object.fromEntries(f));
      if (f.get('client_secret') !== 'sec' || !users[f.get('code')]) { res.writeHead(400); return res.end('{}'); }
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ access_token: 'at-' + f.get('code') }));
    }); return;
  }
  if (u.pathname.endsWith('/user')) {
    const code = String(req.headers.authorization || '').replace('Bearer at-', '');
    const prof = users[code]; if (!prof) { res.writeHead(401); return res.end('{}'); }
    res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(prof));
  }
  res.writeHead(404); res.end();
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'det-auth-'));
let srv;
const jar = {};
const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
const absorb = (res) => (res.headers.getSetCookie ? res.headers.getSetCookie() : []).forEach((c) => { const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0/.test(c) || !v) delete jar[k]; else jar[k] = v; });
const go = async (url, opt = {}) => { const r = await fetch(url, Object.assign({ redirect: 'manual', headers: { cookie: cookieHeader() } }, opt)); absorb(r); return r; };

async function flow(name, expectName) {
  const r1 = await go(`http://localhost:${GAME}/auth/${name}`);
  const loc = r1.headers.get('location');
  check(r1.status === 302 && loc.startsWith(`http://localhost:${PROV}/${name}/authorize`) && loc.includes('client_id=cid') && loc.includes('state=') && /scope=/.test(loc), `${name}: переход к провайдеру с client_id и state`);
  check(!!jar.d_oauth, `${name}: кука состояния выдана`);
  const r2 = await go(loc);                      // провайдер отвечает редиректом на наш callback
  const cb = r2.headers.get('location');
  check(cb.startsWith(`http://localhost:${GAME}/auth/${name}/callback?code=`), `${name}: провайдер вернул на callback`);
  const r3 = await go(cb);
  check(r3.status === 302 && r3.headers.get('location') === '/?auth=ok', `${name}: вход завершён`);
  check(!!jar.d_sess && !jar.d_oauth, `${name}: сессия выдана, кука состояния убрана`);
  const me = await (await go(`http://localhost:${GAME}/api/me`)).json();
  check(me.account && me.account.name === expectName && me.account.provider === name, `${name}: /api/me отдаёт ${expectName}`);
}

(async () => {
  await new Promise((r) => prov.listen(PROV, r));
  const env = Object.assign({}, process.env, {
    PORT: String(GAME), DATA_DIR: dir, ADMIN_KEY: 'k',
    DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'sec', DISCORD_AUTH_URL: `http://localhost:${PROV}/discord/authorize`, DISCORD_TOKEN_URL: `http://localhost:${PROV}/discord/token`, DISCORD_USER_URL: `http://localhost:${PROV}/discord/user`,
    GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'sec', GOOGLE_AUTH_URL: `http://localhost:${PROV}/google/authorize`, GOOGLE_TOKEN_URL: `http://localhost:${PROV}/google/token`, GOOGLE_USER_URL: `http://localhost:${PROV}/google/user`,
  });
  srv = spawn('node', ['server/index.js'], { env, cwd: path.join(__dirname, '..') });
  let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50 && !/Detective:/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
  check(/Адреса возврата[\s\S]*Discord: http:\/\/localhost:3107\/auth\/discord\/callback/.test(log), 'в консоли напечатаны адреса возврата для настройки провайдеров');

  const pre = await (await go(`http://localhost:${GAME}/api/me`)).json();
  check(pre.account === null && pre.providers.discord && pre.providers.google && !pre.providers.dev, 'до входа аккаунта нет, оба провайдера включены');

  await flow('discord', 'Мира');
  check(tokenCalls[0].grant_type === 'authorization_code' && tokenCalls[0].redirect_uri === `http://localhost:${GAME}/auth/discord/callback`, 'код обменивается по стандарту OAuth 2.0');
  await go(`http://localhost:${GAME}/auth/logout`, { method: 'POST' });
  check(!jar.d_sess && (await (await go(`http://localhost:${GAME}/api/me`)).json()).account === null, 'выход убирает сессию');
  await flow('google', 'Игорь');

  // Профиль: своё имя после входа, хранится по аккаунту и переживает выход и новый вход
  const post = (body, headers = {}) => go(`http://localhost:${GAME}/api/profile`, { method: 'POST', headers: Object.assign({ cookie: cookieHeader(), 'content-type': 'application/json' }, headers), body: JSON.stringify(body) });
  check((await post({ name: 'А' })).status === 400, 'профиль: имя из одной буквы не принимается');
  check((await post({ name: 'Чужой' }, { origin: 'https://evil.example' })).status === 403, 'профиль: чужой сайт имя не поменяет');
  const set = await (await post({ name: '  Шерлок\u200B ' })).json();
  check(set.ok && set.name === 'Шерлок', 'профиль: имя сохранено и очищено');
  let meNow = await (await go(`http://localhost:${GAME}/api/me`)).json();
  check(meNow.account.name === 'Шерлок' && meNow.account.custom && meNow.account.providerName === 'Игорь', 'профиль: /api/me отдаёт своё имя и помнит имя из Google');
  await go(`http://localhost:${GAME}/auth/logout`, { method: 'POST' });
  check((await post({ name: 'Гость' })).status === 401, 'профиль: без входа имя не поменять');
  await flow('google', 'Шерлок');
  const reset = await (await post({ reset: true })).json();
  meNow = await (await go(`http://localhost:${GAME}/api/me`)).json();
  check(reset.ok && meNow.account.name === 'Игорь' && !meNow.account.custom, 'профиль: можно вернуть имя из Google');

  // Подделка: чужое состояние и испорченная подпись
  for (const k of Object.keys(jar)) delete jar[k];
  await go(`http://localhost:${GAME}/auth/discord`);
  const bad = await go(`http://localhost:${GAME}/auth/discord/callback?code=code-d&state=wrong`);
  check(bad.headers.get('location') === '/?auth=fail' && !jar.d_sess, 'неверный state отклоняется');
  const noState = await go(`http://localhost:${GAME}/auth/discord/callback?code=code-d&state=x`);
  check(noState.headers.get('location') === '/?auth=fail' && !jar.d_sess, 'без куки состояния вход отклоняется');
  jar.d_sess = 'e30.forged';
  check((await (await go(`http://localhost:${GAME}/api/me`)).json()).account === null, 'подделанная кука сессии не принимается');
  delete jar.d_sess;
  const cancel = await go(`http://localhost:${GAME}/auth/discord/callback?error=access_denied`);
  check(cancel.headers.get('location') === '/?auth=cancel', 'отказ пользователя обработан');
  const off = await go(`http://localhost:${GAME}/auth/nope`);
  check(off.headers.get('location') === '/?auth=off', 'неизвестный провайдер не падает');

  srv.kill(); prov.close();
  console.log(fails ? `ПРОВАЛОВ: ${fails}` : 'вход в порядке');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); if (srv) srv.kill(); process.exit(1); });
