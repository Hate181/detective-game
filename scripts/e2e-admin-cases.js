// Админка: редактор дел (правка, проверка улик, новое дело, удаление) и симуляция.
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.URL || 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL + '/#/admin');
  await page.waitForSelector('#keyIn');
  await page.fill('#keyIn', 'wrong');
  await page.click('#loginForm button');
  await page.waitForSelector('.toast.err');
  console.log('bad key rejected');
  await page.fill('#keyIn', process.env.ADMIN_KEY || 'noir-test');
  await page.click('#loginForm button');
  await page.waitForSelector('[data-a="create-test"]');
  await page.click('[data-tab="cases"]');
  await page.click('.case-li >> nth=0');
  await page.waitForSelector('#cTitle');
  await page.screenshot({ path: 'shots/admin-cases.png' });
  await page.click('[data-a="check-case"]');
  await page.waitForSelector('#caseCheck .note');
  console.log('check:', (await page.textContent('#caseCheck')).slice(0, 90));
  // новое дело
  await page.click('[data-a="new-case"]');
  await page.fill('#cTitle', 'Тестовое дело: Театр «Эхо»');
  await page.fill('#cVictim', 'Режиссёр Павел Корин');
  await page.fill('#cTime', '21:15');
  await page.fill('#cTeaser', 'Премьера сорвана: за кулисами нашли режиссёра, а занавес так и не поднялся.');
  await page.fill('#cLocs', 'Сцена\nГримёрка\nБуфет\nКолосники\nКассы');
  await page.fill('#cScene', 'Сцена');
  await page.fill('#cProf', 'Суфлёр | quiet, keys\nМашинист сцены | strong, tools\nКостюмер | tools\nКассир | cash, safe\nАктёр | french\nОсветитель | tech\nДиректор театра | safe, keys\nГардеробщик | passages');
  await page.click('[data-a="check-case"]');
  await page.waitForSelector('#caseCheck .note');
  console.log('new check:', (await page.textContent('#caseCheck')).slice(0, 100));
  await page.click('[data-a="icon"][data-v="theatre"]');
  await page.click('[data-a="save-case"]');
  await page.waitForSelector('.toast');
  await page.screenshot({ path: 'shots/admin-cases-new.png' });
  const n = await page.evaluate(() => document.querySelectorAll('.case-li').length);
  console.log('cases now', n);
  // ошибка валидации
  await page.click('[data-a="new-case"]');
  await page.fill('#cTitle', 'Сломанное');
  await page.click('[data-a="save-case"]');
  await page.waitForSelector('.toast.err');
  console.log('validation toast:', await page.textContent('.toast.err >> nth=-1'));
  // удалить тестовое
  await page.click('.case-li:has-text("Театр") >> nth=0');
  await page.click('[data-a="del-case"]');
  await page.click('.modal [data-ok]');
  await page.waitForTimeout(500);
  console.log('cases after delete', await page.evaluate(() => document.querySelectorAll('.case-li').length));
  // симуляция
  await page.click('[data-tab="sim"]');
  await page.fill('#sGames', '30');
  await page.click('[data-a="run-sim"]');
  await page.waitForSelector('.sim-out', { timeout: 60000 });
  console.log('sim:', (await page.textContent('.sim-out')).replace(/\s+/g, ' ').slice(0, 160));
  await page.screenshot({ path: 'shots/admin-sim.png' });
  // комнаты
  await page.click('[data-tab="rooms"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/admin-rooms.png' });
  console.log('errors', errors);
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
