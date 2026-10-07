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

  // учёт аккаунтов для админки
  auth.touchUser('discord:42', 'discord', 'Игорь');
  auth.touchUser('dev:test', 'dev', 'Тест');
  const sum = auth.usersSummary(new Set(['discord:42']));
  check(sum.total === 2 && sum.byProvider.email === 1 && sum.byProvider.discord === 1, `админка видит 2 аккаунта: ${JSON.stringify(sum.byProvider)}`);
  check(sum.new7 === 2 && sum.online === 1, 'новые за неделю и кто на сайте');
  const mailRow = sum.rows.find((u) => u.provider === 'email');
  check(mailRow && mailRow.email === 'mi••••@example.com' && mailRow.name === 'Мира', `в списке админки почта видна не целиком: ${mailRow && mailRow.email}`);
  check(!JSON.stringify(sum).includes('mira@example.com'), 'полного адреса в ответе админке нет');
  auth.flushUsers();

  // перезапуск: аккаунты читаются с диска
  const auth2 = createAuth({ dataDir: dir, port: 0 });
  check(auth2.accountFrom(r.cookie || `d_sess=${''}`) === null, 'пустая кука не даёт входа');
  const again = await auth2.resetPassword('mira@example.com');
  check(!!again, 'после перезапуска аккаунт на месте');
  check(auth2.usersSummary().total === 2, 'учёт аккаунтов переживает перезапуск');

  // файлы с данными игроков: только для сервера, с копией прошлой версии и суточным снимком
  const mode = (f) => fs.statSync(path.join(dir, f)).mode & 0o777;
  check(['accounts.json', 'users.json', 'accounts.json.bak'].every((f) => mode(f) === 0o600), 'файлы аккаунтов доступны только серверу (0600)');
  check(fs.readdirSync(path.join(dir, 'backup')).some((f) => /^accounts-\d{4}-\d{2}-\d{2}\.json$/.test(f)), 'есть суточный снимок аккаунтов');
  check(!fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8').includes(reset.password), 'временный пароль на диск не попадает');

  // удаление аккаунта по просьбе игрока
  r = await post('/auth/email/register', { email: 'del@example.com', password: 'удалить-меня', name: 'Удалим' });
  const delCookie = r.cookie;
  const gone = auth.deleteAccount('DEL@example.com');
  check(gone && gone.name === 'Удалим' && !auth.accountFrom(delCookie), 'удалённый аккаунт сразу теряет все входы');
  r = await post('/auth/email/login', { email: 'del@example.com', password: 'удалить-меня' });
  check(!r.body.ok, 'войти в удалённый аккаунт нельзя');
  const onDisk = ['accounts.json', 'accounts.json.bak'].concat(fs.readdirSync(path.join(dir, 'backup')).map((f) => 'backup/' + f)).filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes('del@example.com'));
  check(!onDisk.length, `почты удалённого аккаунта нет ни в файле, ни в копиях: ${onDisk.join(', ') || 'чисто'}`);
  check(!auth.deleteAccount('del@example.com'), 'повторное удаление ничего не делает');

  // перебор чужих почт через регистрацию упирается в лимит
  let probe;
  for (let i = 0; i < 6; i++) probe = await post('/auth/email/register', { email: 'mira@example.com', password: 'что-угодно1', name: 'Проба' });
  check(probe.status === 429, 'проверять занятость почт через регистрацию можно не больше пяти раз в час');

  srv.close();
  fs.rmSync(dir, { recursive: true, force: true });

  // старый хэш (N=16384) усиливается при входе, а входы на других устройствах остаются
  {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'det-mail-'));
    const salt = require('crypto').randomBytes(16).toString('hex');
    const hash = require('crypto').scryptSync('старый-пароль', Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
    fs.writeFileSync(path.join(d, 'accounts.json'), JSON.stringify({ 'old@example.com': { id: 'ab'.repeat(12), name: 'Старый', salt, hash, v: 1, at: 1 } }));
    const app2 = express(); const a2 = createAuth({ dataDir: d, port: 0 }); a2.mount(app2);
    const s2 = app2.listen(0); const b2 = `http://127.0.0.1:${s2.address().port}`;
    const login = () => fetch(b2 + '/auth/email/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'old@example.com', password: 'старый-пароль' }) });
    const r1 = await login();
    const keep = (r1.headers.get('set-cookie') || '').match(/d_sess=[^;]*/)[0];
    const st = JSON.parse(fs.readFileSync(path.join(d, 'accounts.json'), 'utf8'))['old@example.com'];
    check(r1.ok && st.n === 32768 && st.hash !== hash && st.salt !== salt, 'старый хэш пересчитан с большей сложностью и новой солью');
    check(!!a2.accountFrom(keep) && (await login()).ok, 'после усиления вход работает, сессии не сброшены');
    s2.close();
    // битый файл: берётся копия, сам файл откладывается, а не затирается
    fs.writeFileSync(path.join(d, 'accounts.json'), '{"old@example.com": {"id"');
    const a3 = createAuth({ dataDir: d, port: 0 });
    check(!!(await a3.resetPassword('old@example.com')) && fs.readdirSync(d).some((f) => f.startsWith('accounts.json.broken-')), 'битый файл аккаунтов отложен, данные подняты из копии');
    fs.writeFileSync(path.join(d, 'accounts.json'), 'мусор'); fs.rmSync(path.join(d, 'accounts.json.bak'));
    let threw = false; try { createAuth({ dataDir: d, port: 0 }); } catch (e) { threw = true; }
    check(threw, 'без копии сервер не стартует с пустыми аккаунтами, чтобы их не затереть');
    fs.rmSync(d, { recursive: true, force: true });
  }
  if (fails) { console.log(`\nПровалено: ${fails}`); process.exit(1); }
  console.log('\nВход по почте в порядке');
})().catch((e) => { console.error(e); process.exit(1); });
