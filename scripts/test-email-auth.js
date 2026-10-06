// Вход по почте: регистрация, вход, неверный пароль, блокировка подбора, смена и сброс пароля.
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { createAuth } = require('../server/auth.js');

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('ПРОВАЛ:', msg); } else console.log('ок:', msg); };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'det-mail-'));
  const app = express();
  const auth = createAuth({ dataDir: dir, port: 0 });
  auth.mount(app);
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = async (url, body, cookie) => {
    const r = await fetch(base + url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, cookie ? { cookie } : {}), body: JSON.stringify(body) });
    const set = r.headers.get('set-cookie') || '';
    const m = set.match(/d_sess=([^;]*)/);
    return { status: r.status, body: await r.json(), cookie: m && m[1] ? `d_sess=${m[1]}` : null };
  };

  let r = await post('/auth/email/register', { email: 'bad', password: '12345678', name: 'Мира' });
  check(r.status === 400 && r.body.field === 'email', 'кривая почта отклоняется');
  r = await post('/auth/email/register', { email: 'mira@example.com', password: '123', name: 'Мира' });
  check(r.status === 400 && r.body.field === 'password', 'короткий пароль отклоняется');
  r = await post('/auth/email/register', { email: 'mira@example.com', password: 'секрет123', name: 'Гость-12345' });
  check(r.status === 400 && r.body.field === 'name', 'имя вида «Гость-12345» нельзя');
  r = await post('/auth/email/register', { email: 'Mira@Example.com', password: 'секрет123', name: 'Мира' });
  check(r.body.ok && r.cookie, 'регистрация выдаёт вход');
  const acc = auth.accountFrom(r.cookie);
  check(acc && acc.provider === 'email' && acc.name === 'Мира' && /^email:[0-9a-f]{24}$/.test(acc.id), 'по куке виден аккаунт с именем, почты в нём нет');
  check(!JSON.stringify(acc).includes('example.com'), 'почта не попадает в данные аккаунта');
  const stored = JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8'));
  check(stored['mira@example.com'] && !JSON.stringify(stored).includes('секрет123'), 'пароль хранится только хэшем, почта в нижнем регистре');
  r = await post('/auth/email/register', { email: 'mira@example.com', password: 'другой123', name: 'Мира2' });
  check(r.status === 409, 'вторая регистрация на ту же почту не проходит');

  r = await post('/auth/email/login', { email: 'mira@example.com', password: 'неверный1' });
  check(r.status === 401 && !r.cookie, 'неверный пароль не пускает');
  r = await post('/auth/email/login', { email: 'nobody@example.com', password: 'неверный1' });
  check(r.status === 401 && r.body.error === 'Неверная почта или пароль.', 'на чужую почту тот же ответ, что и на неверный пароль');
  r = await post('/auth/email/login', { email: 'MIRA@example.com', password: 'секрет123' });
  check(r.body.ok && auth.accountFrom(r.cookie).id === acc.id, 'вход по почте в любом регистре');
  const first = r.cookie;

  // смена пароля
  r = await post('/auth/email/password', { old: 'не тот', password: 'новый-пароль' }, first);
  check(r.status === 401 && r.body.field === 'old', 'смена без верного старого пароля не проходит');
  r = await post('/auth/email/password', { old: 'секрет123', password: 'новый-пароль' }, first);
  check(r.body.ok && r.cookie, 'пароль сменён, вход продлён');
  check(!auth.accountFrom(first) && auth.accountFrom(r.cookie), 'старые входы после смены пароля не действуют');
  r = await post('/auth/email/login', { email: 'mira@example.com', password: 'новый-пароль' });
  check(r.body.ok, 'вход с новым паролем');
  const second = r.cookie;

  // сброс админом
  const reset = await auth.resetPassword('mira@example.com');
  check(reset && reset.password.length >= 10 && reset.name === 'Мира', 'админ получает временный пароль');
  check(!auth.accountFrom(second), 'после сброса старые входы закрыты');
  r = await post('/auth/email/login', { email: 'mira@example.com', password: reset.password });
  check(r.body.ok, 'вход с временным паролем');
  check(!(await auth.resetPassword('nobody@example.com')), 'сброс для несуществующей почты ничего не делает');

  // чужой сайт
  const x = await fetch(base + '/auth/email/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ email: 'mira@example.com', password: reset.password }) });
  check(x.status === 403, 'вход с чужого сайта запрещён');

  // подбор пароля
  let last;
  for (let i = 0; i < 11; i++) last = await post('/auth/email/login', { email: 'mira@example.com', password: 'перебор' + i });
  check(last.status === 429, 'после 10 ошибок вход блокируется');
  r = await post('/auth/email/login', { email: 'mira@example.com', password: reset.password });
  check(r.status === 429, 'блокировка держится и для верного пароля');

  // перезапуск: аккаунты читаются с диска
  const auth2 = createAuth({ dataDir: dir, port: 0 });
  check(auth2.accountFrom(r.cookie || `d_sess=${''}`) === null, 'пустая кука не даёт входа');
  const again = await auth2.resetPassword('mira@example.com');
  check(!!again, 'после перезапуска аккаунт на месте');

  srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  if (fails) { console.log(`\nПровалено: ${fails}`); process.exit(1); }
  console.log('\nВход по почте в порядке');
})().catch((e) => { console.error(e); process.exit(1); });
