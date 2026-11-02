/* Поисковики и превью ссылок.
   Игра живёт на адресах с решёткой (#/rules), а их поисковики не видят. Поэтому правила и документы
   отдаются ещё и по обычным адресам (/rules, /privacy…): сервер сразу кладёт в страницу готовый текст,
   свой заголовок, описание и канонический адрес. Браузер затем рисует ту же страницу сам.
   Тексты страниц берутся из public/js/pages.js (и pages-en.js), чтобы не держать их в двух местах.

   Языки: русский сайт без приставки (/, /rules), английский под /en (/en/, /en/rules). У каждой страницы
   есть ссылки hreflang на обе версии, x-default ведёт на русский адрес: он сам отправляет человека
   на язык его браузера. Выбор, сделанный переключателем, лежит в cookie lang и важнее языка браузера. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const I18N = require('../public/shared/i18n.js');

const PUBLIC = path.join(__dirname, '..', 'public');
const SITE = 'Detective Game';
const LANGS = ['ru', 'en'];
const HOME = {
  ru: {
    title: 'Detective Game: онлайн-игра в детектив для компании',
    desc: 'Онлайн-детектив в браузере для компании от 2 до 10 человек. Убийца и сообщник сидят среди вас: изучайте улики, спорьте и голосуйте, пока они не убрали всех свидетелей. Партия около 30 минут, играть можно бесплатно.',
  },
  en: {
    title: 'Detective Game: an online murder mystery game for friends',
    desc: 'A murder mystery you play in the browser with 2 to 10 friends. The killer and their accomplice are sitting among you: study the clues, argue and vote before they get rid of every witness. A game takes about 30 minutes and is free to play.',
  },
};
const HOME_TITLE = HOME.ru.title;

const PAGES = {
  rules: {
    priority: '0.8',
    desc: {
      ru: 'Правила Detective Game для компании из 6–10 человек и для игры вдвоём или впятером: роли, улики, карты действий, голосование и финал.',
      en: 'How to play Detective Game with 6–10 people, or with just two to five: roles, clues, action cards, voting and the finale.',
    },
  },
  contacts: { priority: '0.3', desc: { ru: 'Как связаться с Detective Game: сообщить об ошибке, предложить дело или удалить свои данные.', en: 'How to reach Detective Game: report a bug, suggest a case or ask us to delete your data.' } },
  privacy: { priority: '0.2', desc: { ru: 'Какие данные хранит Detective Game, зачем они нужны и как их удалить.', en: 'What data Detective Game keeps, why it needs it and how to delete it.' } },
  cookies: { priority: '0.2', desc: { ru: 'Какие cookie и записи в браузере использует Detective Game и зачем.', en: 'Which cookies and browser storage Detective Game uses, and why.' } },
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Адрес страницы на языке: '/', '/rules' → '/en/', '/en/rules'. */
const pathFor = (lang, p) => I18N.pathFor(lang, p);
// Ссылки внутри документов ведут по решётке: на сервере меняем их на обычные адреса, которые видит поисковик.
const plainLinks = (html, lang) => html
  .replace(/href="#\/(rules|contacts|privacy|cookies)"/g, (m, p) => `href="${pathFor(lang, '/' + p)}"`)
  .replace(/href="#\/"/g, `href="${pathFor(lang, '/')}"`);

/** Готовый HTML страницы документа: тот же код, что рисует её в браузере, запущенный в песочнице. */
function renderPages({ origin, contact, community, lang }) {
  const out = {};
  const ctx = {
    UI: { esc },
    I18N: Object.assign({}, I18N, { lang }),
    L: (key, ...args) => I18N.Lx(lang, key, ...args),
    DetectiveContent: require('../public/shared/content.js'),
    Net: { me: { contact, community } },
    location: { origin, hash: '' },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { title: '' },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['pages-en.js', 'pages.js']) vm.runInContext(fs.readFileSync(path.join(PUBLIC, 'js', f), 'utf8'), ctx, { filename: f });
  const screen = ctx.Screens.page;
  for (const page of Object.keys(PAGES)) {
    const root = { innerHTML: '', addEventListener() {}, removeEventListener() {} };
    screen.mount(root, { route: { page } });
    out[page] = { title: ctx.document.title, html: plainLinks(root.innerHTML, lang) };
    screen.unmount();
  }
  return out;
}

/** Статичная разметка страницы (шапка, подвал, плашка cookie) на английском: тексты и подписи по словарю, ссылки под /en. */
function translateTemplate(html, lang) {
  if (lang === 'ru') return html;
  const CYR = /[А-Яа-яЁё]/;
  const head = html.indexOf('<body>');
  const body = html.slice(head)
    .replace(/>([^<>]*)</g, (m, text) => {
      if (!CYR.test(text)) return m;
      const key = text.trim();
      const t = I18N.look(lang, key);
      return t === key ? m : '>' + text.replace(key, esc(t)) + '<';
    })
    .replace(/ (aria-label|title|alt|placeholder)="([^"]*)"/g, (m, attr, val) => (CYR.test(val) ? ` ${attr}="${esc(I18N.look(lang, val))}"` : m))
    .replace(/<a\b[^>]*>/g, (tag) => (/data-lang/.test(tag) ? tag : tag.replace(/href="(\/(?:rules|contacts|privacy|cookies)?)"/, (m, href) => `href="${pathFor(lang, href)}"`)));
  return html.slice(0, head) + body;
}

function jsonLd(origin, lang) {
  const en = lang === 'en';
  const url = origin + pathFor(lang, '/');
  const data = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url, inLanguage: lang },
    {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: SITE,
      url,
      description: HOME[lang].desc,
      image: origin + (en ? '/og-en.jpg' : '/og.jpg'),
      inLanguage: ['ru', 'en'],
      genre: en ? ['Murder mystery', 'Social deduction', 'Online board game'] : ['Детектив', 'Социальная дедукция', 'Настольная игра онлайн'],
      gamePlatform: en ? 'Web browser' : 'Браузер',
      applicationCategory: 'GameApplication',
      operatingSystem: en ? 'Any with a modern browser' : 'Любая с современным браузером',
      playMode: 'MultiPlayer',
      numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 10 },
      offers: { '@type': 'Offer', price: '0', priceCurrency: en ? 'USD' : 'RUB' },
    },
  ];
  // </script> внутри JSON не даст закрыть тег раньше времени.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** Ботам язык не подбираем: им нужен ровно тот адрес, который они запросили. */
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|whatsapp|telegram|vkshare|discord|skype|lighthouse|headless/i;
/** Язык, на который стоит отправить человека: выбор из cookie, иначе язык браузера. null — оставить как есть. */
function wantedLang(req) {
  const m = /(?:^|;\s*)lang=(ru|en)\b/.exec(req.headers.cookie || '');
  if (m) return m[1];
  if (BOT_UA.test(req.headers['user-agent'] || '')) return null;
  return I18N.fromHeader(req.headers['accept-language']);
}

function createSeo({ publicUrl, contact, community, googleVerify, yandexVerify } = {}) {
  const origin = (publicUrl || '').replace(/\/+$/, '');
  const abs = (p) => (origin || '') + p;
  const raw = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const mailHtml = (lang) => (contact ? `${esc(I18N.Lx(lang, 'Почта для связи:'))} <a href="mailto:${esc(contact)}">${esc(contact)}</a>` : '');

  function head({ title, desc, page, lang, home }) {
    const url = abs(pathFor(lang, page));
    const img = abs(lang === 'en' ? '/og-en.jpg' : '/og.jpg');
    const alt = lang === 'en' ? `${SITE}: the killer is among you` : `${SITE}: убийца среди вас`;
    const tags = [
      `<title>${esc(title)}</title>`,
      `<meta name="description" content="${esc(desc)}">`,
      origin ? `<link rel="canonical" href="${esc(url)}">` : '',
      ...(origin ? LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(abs(pathFor(l, page)))}">`) : []),
      origin ? `<link rel="alternate" hreflang="x-default" href="${esc(abs(pathFor('ru', page)))}">` : '',
      '<meta property="og:type" content="website">',
      `<meta property="og:site_name" content="${SITE}">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(desc)}">`,
      origin ? `<meta property="og:url" content="${esc(url)}">` : '',
      `<meta property="og:image" content="${esc(img)}">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      `<meta property="og:image:alt" content="${esc(alt)}">`,
      `<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ru_RU'}">`,
      `<meta property="og:locale:alternate" content="${lang === 'en' ? 'ru_RU' : 'en_US'}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(desc)}">`,
      `<meta name="twitter:image" content="${esc(img)}">`,
      googleVerify ? `<meta name="google-site-verification" content="${esc(googleVerify)}">` : '',
      yandexVerify ? `<meta name="yandex-verification" content="${esc(yandexVerify)}">` : '',
      home && origin ? jsonLd(origin, lang) : '',
    ];
    return tags.filter(Boolean).join('\n');
  }

  const rendered = {};
  for (const lang of LANGS) {
    // Страница помечена data-srv: браузер берёт язык из lang, а не угадывает сам.
    const template = translateTemplate(raw, lang).replace(/<html lang="[a-z]+">/, `<html lang="${lang}" data-srv>`);
    const docs = renderPages({ origin: origin || I18N.Lx(lang, 'сайт игры'), contact, community, lang });
    // В шаблоне между метками <!--seo--> и <!--/seo--> стоят теги по умолчанию: их заменяем на теги страницы.
    const build = ({ title, desc, page, home, main }) => {
      let html = template.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, head({ title, desc, page, lang, home }));
      if (main) html = html.replace('<main id="app"></main>', `<main id="app">${main}</main>`);
      const mail = mailHtml(lang);
      if (mail) html = html.replace('<p class="sitefoot-mail" id="footMail"></p>', `<p class="sitefoot-mail" id="footMail">${mail}</p>`);
      return html;
    };
    rendered[pathFor(lang, '/')] = build({ title: HOME[lang].title, desc: HOME[lang].desc, page: '/', home: true });
    for (const [page, meta] of Object.entries(PAGES)) {
      rendered[pathFor(lang, '/' + page)] = build({
        title: docs[page].title,
        desc: meta.desc[lang],
        page: '/' + page,
        main: `<article class="doc wrap" data-page="${page}">${docs[page].html}\n<p class="doc-back"><a class="btn" href="${pathFor(lang, '/')}">${esc(I18N.Lx(lang, 'На главную'))}</a></p></article>`,
      });
    }
  }

  const urls = [['/', '1.0'], ...Object.entries(PAGES).map(([p, m]) => ['/' + p, m.priority])];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.flatMap(([p, pr]) => LANGS.map((lang) => `  <url><loc>${esc(abs(pathFor(lang, p)))}</loc><priority>${pr}</priority>${LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(abs(pathFor(l, p)))}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${esc(abs(pathFor('ru', p)))}"/></url>`)).join('\n')}
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
    // Человек без явного выбора попадает на язык браузера, с выбором — на выбранный. Боты получают то, что просили.
    const send = (lang, p) => (req, res) => {
      const want = req.method === 'GET' ? wantedLang(req) : null;
      if (want && want !== lang) {
        const q = req.originalUrl.indexOf('?');
        res.set('Vary', 'Accept-Language, Cookie');
        return res.redirect(302, pathFor(want, p) + (q >= 0 ? req.originalUrl.slice(q) : ''));
      }
      res.set('Cache-Control', 'no-cache');
      res.set('Vary', 'Accept-Language, Cookie');
      res.type('html').send(rendered[pathFor(lang, p)]);
    };
    app.get(['/', '/index.html'], send('ru', '/'));
    app.get(['/en', '/en/', '/en/index.html'], send('en', '/'));
    for (const page of Object.keys(PAGES)) {
      app.get(['/' + page, '/' + page + '/'], send('ru', '/' + page));
      app.get(['/en/' + page, '/en/' + page + '/'], send('en', '/' + page));
    }
    app.get('/sitemap.xml', (req, res) => { res.set('Cache-Control', 'public, max-age=3600'); res.type('application/xml').send(sitemap); });
    app.get('/robots.txt', (req, res) => { res.set('Cache-Control', 'public, max-age=3600'); res.type('text/plain').send(robots); });
  }

  return { mount, rendered, sitemap, robots, HOME_TITLE, wantedLang };
}

module.exports = { createSeo, PAGES, HOME_TITLE, wantedLang };
