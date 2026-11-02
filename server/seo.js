/* Поисковики и превью ссылок.
   Игра живёт на адресах с решёткой (#/rules), а их поисковики не видят. Поэтому правила и документы
   отдаются ещё и по обычным адресам (/rules, /privacy…): сервер сразу кладёт в страницу готовый текст,
   свой заголовок, описание и канонический адрес. Браузер затем рисует ту же страницу сам.
   Тексты страниц берутся из public/js/pages.js, чтобы не держать их в двух местах. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUBLIC = path.join(__dirname, '..', 'public');
const SITE = 'Detective Game';
const HOME_TITLE = 'Detective Game: онлайн-игра в детектив для компании';
const HOME_DESC = 'Онлайн-детектив в браузере для компании от 2 до 10 человек. Убийца и сообщник сидят среди вас: изучайте улики, спорьте и голосуйте, пока они не убрали всех свидетелей. Партия около 30 минут, играть можно бесплатно.';

const PAGES = {
  rules: { desc: 'Правила Detective Game для компании из 6–10 человек и для игры вдвоём или впятером: роли, улики, карты действий, голосование и финал.', priority: '0.8' },
  contacts: { desc: 'Как связаться с Detective Game: сообщить об ошибке, предложить дело или удалить свои данные.', priority: '0.3' },
  privacy: { desc: 'Какие данные хранит Detective Game, зачем они нужны и как их удалить.', priority: '0.2' },
  cookies: { desc: 'Какие cookie и записи в браузере использует Detective Game и зачем.', priority: '0.2' },
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Ссылки внутри документов ведут по решётке: на сервере меняем их на обычные адреса, которые видит поисковик.
const plainLinks = (html) => html.replace(/href="#\/(rules|contacts|privacy|cookies)"/g, 'href="/$1"').replace(/href="#\/"/g, 'href="/"');

/** Готовый HTML страницы документа: тот же код, что рисует её в браузере, запущенный в песочнице. */
function renderPages({ origin, contact, community }) {
  const out = {};
  const ctx = {
    UI: { esc },
    DetectiveContent: require('../public/shared/content.js'),
    Net: { me: { contact, community } },
    location: { origin, hash: '' },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { title: '' },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(PUBLIC, 'js', 'pages.js'), 'utf8'), ctx, { filename: 'pages.js' });
  const screen = ctx.Screens.page;
  for (const page of Object.keys(PAGES)) {
    const root = { innerHTML: '', addEventListener() {}, removeEventListener() {} };
    screen.mount(root, { route: { page } });
    out[page] = { title: ctx.document.title, html: plainLinks(root.innerHTML) };
    screen.unmount();
  }
  return out;
}

function jsonLd(origin) {
  const data = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: origin + '/', inLanguage: 'ru' },
    {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: SITE,
      url: origin + '/',
      description: HOME_DESC,
      image: origin + '/og.jpg',
      inLanguage: 'ru',
      genre: ['Детектив', 'Социальная дедукция', 'Настольная игра онлайн'],
      gamePlatform: 'Браузер',
      applicationCategory: 'GameApplication',
      operatingSystem: 'Любая с современным браузером',
      playMode: 'MultiPlayer',
      numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 10 },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' },
    },
  ];
  // </script> внутри JSON не даст закрыть тег раньше времени.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function createSeo({ publicUrl, contact, community, googleVerify, yandexVerify } = {}) {
  const origin = (publicUrl || '').replace(/\/+$/, '');
  const abs = (p) => (origin || '') + p;
  const template = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const docs = renderPages({ origin: origin || 'сайт игры', contact, community });
  const mailHtml = contact ? `Почта для связи: <a href="mailto:${esc(contact)}">${esc(contact)}</a>` : '';

  function head({ title, desc, url, home }) {
    const tags = [
      `<title>${esc(title)}</title>`,
      `<meta name="description" content="${esc(desc)}">`,
      origin ? `<link rel="canonical" href="${esc(url)}">` : '',
      '<meta property="og:type" content="website">',
      `<meta property="og:site_name" content="${SITE}">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(desc)}">`,
      origin ? `<meta property="og:url" content="${esc(url)}">` : '',
      `<meta property="og:image" content="${esc(abs('/og.jpg'))}">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      `<meta property="og:image:alt" content="${SITE}: убийца среди вас">`,
      '<meta property="og:locale" content="ru_RU">',
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(desc)}">`,
      `<meta name="twitter:image" content="${esc(abs('/og.jpg'))}">`,
      googleVerify ? `<meta name="google-site-verification" content="${esc(googleVerify)}">` : '',
      yandexVerify ? `<meta name="yandex-verification" content="${esc(yandexVerify)}">` : '',
      home && origin ? jsonLd(origin) : '',
    ];
    return tags.filter(Boolean).join('\n');
  }

  // В шаблоне между метками <!--seo--> и <!--/seo--> стоят теги по умолчанию: их заменяем на теги страницы.
  function build({ title, desc, url, home, main }) {
    let html = template.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, head({ title, desc, url, home }));
    if (main) html = html.replace('<main id="app"></main>', `<main id="app">${main}</main>`);
    if (mailHtml) html = html.replace('<p class="sitefoot-mail" id="footMail"></p>', `<p class="sitefoot-mail" id="footMail">${mailHtml}</p>`);
    return html;
  }

  const rendered = { '/': build({ title: HOME_TITLE, desc: HOME_DESC, url: abs('/'), home: true }) };
  for (const [page, meta] of Object.entries(PAGES)) {
    rendered['/' + page] = build({
      title: docs[page].title,
      desc: meta.desc,
      url: abs('/' + page),
      main: `<article class="doc wrap" data-page="${page}">${docs[page].html}\n<p class="doc-back"><a class="btn" href="/">На главную</a></p></article>`,
    });
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[['/', '1.0'], ...Object.entries(PAGES).map(([p, m]) => ['/' + p, m.priority])].map(([p, pr]) => `  <url><loc>${esc(abs(p))}</loc><priority>${pr}</priority></url>`).join('\n')}
</urlset>
`;

  const robots = `User-agent: *
Disallow: /api/
Disallow: /auth/
Disallow: /r/
Disallow: /healthz
Allow: /

User-agent: Yandex
Disallow: /api/
Disallow: /auth/
Disallow: /r/
Disallow: /healthz
Clean-param: auth /
Allow: /
${origin ? `\nSitemap: ${origin}/sitemap.xml\n` : ''}`;

  function mount(app) {
    const send = (html) => (req, res) => { res.set('Cache-Control', 'no-cache'); res.type('html').send(html); };
    app.get(['/', '/index.html'], send(rendered['/']));
    for (const page of Object.keys(PAGES)) app.get(['/' + page, '/' + page + '/'], send(rendered['/' + page]));
    app.get('/sitemap.xml', (req, res) => { res.set('Cache-Control', 'public, max-age=3600'); res.type('application/xml').send(sitemap); });
    app.get('/robots.txt', (req, res) => { res.set('Cache-Control', 'public, max-age=3600'); res.type('text/plain').send(robots); });
  }

  return { mount, rendered, sitemap, robots, HOME_TITLE };
}

module.exports = { createSeo, PAGES, HOME_TITLE };
