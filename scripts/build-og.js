/* Картинка для превью ссылок (public/og.jpg, 1200×630) и иконки сайта: favicon.svg, favicon.ico, apple-touch-icon.png.
   Запуск: node scripts/build-og.js (нужен Playwright с Chromium; путь можно задать в CHROME). */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'public');
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#120c09"/><circle cx="14" cy="14" r="7" fill="none" stroke="#eba43c" stroke-width="2.4"/><path d="M19 19l7 7" stroke="#eba43c" stroke-width="3" stroke-linecap="round"/></svg>`;

const OG = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500&family=IBM+Plex+Mono:wght@500&family=Playfair+Display:wght@700&display=swap">
<style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:radial-gradient(ellipse 70% 90% at 78% 30%,#3a2614 0%,#1c130c 45%,#0d0907 100%);color:#f1e4cc;font-family:'Golos Text',sans-serif;position:relative}
.blinds{position:absolute;inset:0;background:repeating-linear-gradient(-28deg,rgba(235,164,60,.07) 0 26px,transparent 26px 70px);mask-image:linear-gradient(90deg,transparent 30%,#000 75%)}
.wrap{position:absolute;left:84px;top:96px;right:84px}
.eyebrow{font-family:'IBM Plex Mono',monospace;font-size:24px;letter-spacing:.14em;text-transform:uppercase;color:#eba43c;margin:0 0 26px}
h1{font-family:'Playfair Display',serif;font-size:150px;line-height:.9;letter-spacing:.04em;margin:0;color:#f6ead2}
h1 span{display:block;font-size:84px;letter-spacing:.02em;color:#eba43c;font-style:normal;margin-top:10px}
.lead{font-size:40px;margin:44px 0 0;color:#e7d6b8}
.tape{position:absolute;left:0;right:0;bottom:0;height:22px;background:repeating-linear-gradient(-45deg,#eba43c 0 28px,#120c09 28px 56px);opacity:.85}
.glass{position:absolute;right:70px;top:270px;width:230px;height:230px;opacity:.9}
.url{position:absolute;right:84px;bottom:52px;font-family:'IBM Plex Mono',monospace;font-size:26px;color:#b89c76}
</style></head><body><div class="blinds"></div>
<svg class="glass" viewBox="0 0 32 32"><circle cx="13" cy="13" r="8.5" fill="none" stroke="#eba43c" stroke-width="2"/><path d="M19.5 19.5 28 28" stroke="#eba43c" stroke-width="2.8" stroke-linecap="round"/></svg>
<div class="wrap"><p class="eyebrow">Онлайн-детектив · 2–10 человек · 30 минут</p>
<h1>DETECTIVE<span>Game</span></h1>
<p class="lead">Убийца среди вас. Осталось понять кто.</p></div>
<div class="url">detective-game.org</div><div class="tape"></div></body></html>`;

// ICO с PNG внутри: так его понимают все браузеры и Яндекс.
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, o); head.writeUInt8(size >= 256 ? 0 : size, o + 1);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(OG, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, "og.jpg"), type: "jpeg", quality: 88 });
  fs.writeFileSync(path.join(OUT, 'favicon.svg'), ICON);
  const shot = async (size, rounded) => {
    await page.setViewportSize({ width: size, height: size });
    const svg = rounded ? ICON : ICON.replace('rx="6"', 'rx="0"');
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    return page.screenshot({ omitBackground: true });
  };
  const pngs = [];
  for (const size of [16, 32, 48]) pngs.push({ size, buf: await shot(size, true) });
  fs.writeFileSync(path.join(OUT, 'favicon.ico'), ico(pngs));
  fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), await shot(180, false));
  await browser.close();
  console.log('og.jpg, favicon.svg, favicon.ico, apple-touch-icon.png готовы');
})();
