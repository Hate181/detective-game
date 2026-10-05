// Регресс: после нескольких заходов в лобби кнопка «Закрыть комнату» открывает ровно одно окно подтверждения, и комната закрывается с первого раза.
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.URL || 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 850 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  let bad = 0;
  for (let round = 1; round <= 4; round++) {
    await page.fill('#nameIn', 'Анна');
    await page.click('[data-act="create"]');
    await page.waitForSelector('.lobby');
    await page.click('[data-a="close"]');
    await page.waitForSelector('.modal');
    await page.waitForTimeout(250);
    const dialogs = await page.locator('.modal [data-ok]').count();
    await page.locator('.modal [data-ok]').first().click();
    await page.waitForTimeout(700);
    const left = await page.locator('.lobby').count();
    const modals = await page.locator('.modal').count();
    console.log(`заход ${round}: окон подтверждения ${dialogs}, после нажатия лобби ${left}, окон ${modals}`);
    if (dialogs !== 1 || left || modals) bad++;
  }
  console.log(errors.length ? 'ошибки: ' + errors.join('; ') : 'ошибок в консоли нет');
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
