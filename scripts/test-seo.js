/* SEO: главная и документы на двух языках отдаются с тегами и готовым текстом, robots.txt и sitemap.xml на месте,
   язык браузера и выбранный язык уводят на нужную версию, а поисковых роботов никуда не уводят. */
const { spawn } = require('child_process');
const path = require('path');
const PORT = 3000 + Math.floor(Math.random() * 2000) + 4000;
const BASE = `http://localhost:${PORT}`;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ok  ' : '  FAIL ') + msg); if (!ok) fails++; };

(async () => {
  const srv = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, { PORT: String(PORT), PUBLIC_URL: 'https://detective-game.org', DATA_DIR: require('fs').mkdtempSync(require('os').tmpdir() + '/seo-'), GOOGLE_SITE_VERIFICATION: 'g-test', YANDEX_VERIFICATION: 'y-test', NODE_ENV: '' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/healthz'); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
  const get = async (p, h = {}) => { const r = await fetch(BASE + p, { redirect: 'manual', headers: Object.assign({ host: 'detective-game.org' }, h) }); return { status: r.status, type: r.headers.get('content-type') || '', location: r.headers.get('location') || '', body: await r.text() }; };
  try {
    const home = await get('/');
    check(home.status === 200, 'главная 200');
    check(/<title>Detective Game: онлайн-игра в детектив/.test(home.body), 'у главной свой заголовок');
    check(home.body.includes('<link rel="canonical" href="https://detective-game.org/">'), 'канонический адрес главной');
    check(home.body.includes('og:image" content="https://detective-game.org/og.jpg"'), 'картинка для превью');
    check(home.body.includes('application/ld+json') && home.body.includes('"VideoGame"'), 'структурированные данные');
    check(home.body.includes('google-site-verification" content="g-test"') && home.body.includes('yandex-verification" content="y-test"'), 'метки подтверждения из переменных');
    check((home.body.match(/<title>/g) || []).length === 1, 'один <title>');
    for (const page of ['rules', 'contacts', 'privacy', 'cookies']) {
      const r = await get('/' + page);
      check(r.status === 200 && /text\/html/.test(r.type), `/${page} отдаётся страницей, а не переадресацией`);
      check(r.body.includes(`<link rel="canonical" href="https://detective-game.org/${page}">`), `/${page}: канонический адрес`);
      check(new RegExp(`<main id="app"><article class="doc wrap" data-page="${page}">`).test(r.body), `/${page}: текст уже в странице`);
      check(!/href="#\/(rules|privacy|cookies|contacts)"/.test(r.body), `/${page}: ссылки без решётки`);
      check(!r.body.includes('application/ld+json'), `/${page}: без разметки игры`);
    }
    const rules = await get('/rules');
    check(rules.body.includes('<title>Правила игры · Detective Game</title>') && rules.body.includes('Коротко'), 'правила с заголовком и текстом');
    check(rules.body.includes('support@detective-game.org'), 'почта в подвале');
    const robots = await get('/robots.txt');
    check(robots.status === 200 && robots.body.includes('Sitemap: https://detective-game.org/sitemap.xml') && robots.body.includes('Disallow: /api/'), 'robots.txt');
    const map = await get('/sitemap.xml');
    check(map.status === 200 && /xml/.test(map.type) && map.body.includes('<loc>https://detective-game.org/rules</loc>') && !map.body.includes('#'), 'sitemap.xml');
    // Английская версия.
    const en = await get('/en/');
    check(en.status === 200 && /<html lang="en"/.test(en.body), '/en/ отдаётся на английском');
    check(en.body.includes('<link rel="canonical" href="https://detective-game.org/en/">'), '/en/: канонический адрес');
    check(en.body.includes('hreflang="ru" href="https://detective-game.org/"') && en.body.includes('hreflang="en" href="https://detective-game.org/en/"') && en.body.includes('hreflang="x-default"'), 'hreflang на обеих версиях');
    check(home.body.includes('hreflang="en" href="https://detective-game.org/en/"'), 'русская главная ссылается на английскую');
    check(en.body.includes('og:image" content="https://detective-game.org/og-en.jpg"') && en.body.includes('og:locale" content="en_US"'), '/en/: английская картинка и locale');
    check(!/[А-Яа-яЁё]/.test(en.body.replace(/<div class="langsw"[\s\S]*?<\/div>/, '').replace(/<script[\s\S]*?<\/script>/g, '')), '/en/: в разметке нет русского текста');
    const enRules = await get('/en/rules');
    check(enRules.status === 200 && enRules.body.includes('<link rel="canonical" href="https://detective-game.org/en/rules">') && /Accusations\./.test(enRules.body), '/en/rules: английские правила');
    check(map.body.includes('<loc>https://detective-game.org/en/rules</loc>') && map.body.includes('xhtml:link'), 'английские страницы в sitemap');
    check((await get('/og-en.jpg')).status === 200, '/og-en.jpg');
    // Переадресация по языку.
    let x = await get('/rules', { 'accept-language': 'de-DE,de;q=0.9,en;q=0.8' });
    check(x.status === 302 && x.location === '/en/rules', 'немецкий браузер уходит на /en/rules');
    x = await get('/en/', { 'accept-language': 'ru-RU,ru;q=0.9' });
    check(x.status === 302 && x.location === '/', 'русский браузер уходит с /en/ на главную');
    x = await get('/en/', { 'accept-language': 'ru-RU', cookie: 'lang=en' });
    check(x.status === 200, 'выбранный вручную язык важнее браузера');
    x = await get('/', { 'accept-language': 'en-US', 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
    check(x.status === 200, 'робота не уводим');
    x = await get('/r/ABCDE', { cookie: 'lang=en' });
    check(x.status === 302 && x.location === '/en/#/room/ABCDE', 'ссылка-приглашение на английском');
    for (const f of ['/og.jpg', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png']) check((await get(f)).status === 200, f);
    check((await get('/nope')).status === 404, 'несуществующий адрес 404');
  } finally {
    srv.kill();
  }
  check(!/uncaught|TypeError/i.test(log), 'в логе сервера нет падений');
  if (fails) { console.log(log); process.exit(1); }
  console.log('SEO: всё на месте');
})();
