/* Языки сайта: русский (основной) и английский.
   Тексты в коде пишутся по-русски и оборачиваются в L('Текст {0}', значение). Русская строка служит ключом,
   английский перевод лежит в словаре public/shared/lang-en.js. Нет перевода — показывается русский текст.
   tr() переводит готовую строку целиком: так переводятся ошибки сервера и события журнала,
   которые движок пишет по-русски («Слово: Мира.» → «Floor: Mira.»). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { const api = factory(); api.add('en', require('./lang-en.js')); module.exports = api; }
  else { root.I18N = factory(); root.L = root.I18N.L; }
})(typeof self !== 'undefined' ? self : this, function () {
  const LANGS = ['ru', 'en'];
  // ui: строки интерфейса (L), msg: сообщения сервера и движка (tr, в том числе шаблоны с подстановками).
  const dicts = { en: { ui: {}, msg: {} } };
  const cache = { en: { patterns: null, memo: new Map() } };
  let cur = 'ru';

  /* Язык по списку языков браузера: русский, если он есть в списке или первым стоит язык, где русский
     понимают почти все. Иначе английский. */
  const RU_AREA = ['ru', 'be', 'kk', 'ky', 'tg', 'uz'];
  function fromList(list) {
    const codes = (list || []).map((x) => String(x || '').trim().toLowerCase().split(/[-_]/)[0]).filter(Boolean);
    if (!codes.length) return null;
    if (codes.includes('ru') || RU_AREA.includes(codes[0])) return 'ru';
    return 'en';
  }
  /** Заголовок Accept-Language → 'ru' | 'en' | null (заголовка нет). */
  function fromHeader(h) {
    if (!h) return null;
    const list = String(h).split(',').map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qp = params.find((p) => p.trim().startsWith('q='));
      return { tag, q: qp ? Number(qp.trim().slice(2)) || 0 : 1 };
    }).filter((x) => x.tag && x.tag !== '*' && x.q > 0).sort((a, b) => b.q - a.q).map((x) => x.tag);
    return fromList(list);
  }
  const norm = (l) => (LANGS.includes(l) ? l : 'ru');
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

  function fmt(s, args) {
    if (!args.length) return s;
    return s.replace(/\{(\d+)\}/g, (m, i) => (args[i] == null ? '' : String(args[i])));
  }
  function look(lang, key) {
    const d = dicts[lang];
    if (lang === 'ru' || !d) return key;
    return own(d.ui, key) ? d.ui[key] : own(d.msg, key) ? d.msg[key] : key;
  }
  /** Перевод на текущий язык страницы. */
  function L(key, ...args) { return fmt(look(cur, key), args); }
  /** Перевод на заданный язык (сервер: язык комнаты). */
  function Lx(lang, key, ...args) { return fmt(look(lang, key), args); }

  function add(lang, dict) {
    const d = dicts[lang] || (dicts[lang] = { ui: {}, msg: {} });
    Object.assign(d.ui, dict.ui || {});
    Object.assign(d.msg, dict.msg || {});
    cache[lang] = { patterns: null, memo: new Map() };
  }

  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function patterns(lang) {
    const c = cache[lang];
    if (c.patterns) return c.patterns;
    const list = [];
    for (const [key, val] of Object.entries(dicts[lang].msg)) {
      if (!/\{\d+\}/.test(key)) continue;
      const stat = key.replace(/\{\d+\}/g, '');
      if (!/[А-Яа-яЁё]/.test(stat)) continue;
      const order = [];
      const src = key.split(/(\{\d+\})/).map((part) => {
        const m = part.match(/^\{(\d+)\}$/);
        if (m) { order.push(Number(m[1])); return '([\\s\\S]*?)'; }
        return reEsc(part);
      }).join('');
      list.push({ re: new RegExp('^' + src + '$'), order, val, weight: stat.length });
    }
    list.sort((a, b) => b.weight - a.weight);
    return (c.patterns = list);
  }
  /** Перевести готовую строку от сервера: точное совпадение или шаблон с подстановками (подстановки тоже переводятся). */
  function tr(s, lang = cur, depth = 0) {
    if (lang === 'ru' || typeof s !== 'string' || !s || !/[А-Яа-яЁё]/.test(s) || !dicts[lang]) return s;
    const msg = dicts[lang].msg;
    if (own(msg, s)) return msg[s];
    const c = cache[lang];
    const mk = depth + '|' + s;
    if (c.memo.has(mk)) return c.memo.get(mk);
    let out = s;
    if (depth < 3) {
      let hit = false;
      for (const p of patterns(lang)) {
        const m = s.match(p.re);
        if (!m) continue;
        const args = [];
        p.order.forEach((idx, i) => { args[idx] = tr(m[i + 1], lang, depth + 1); });
        out = fmt(p.val, args);
        hit = true;
        break;
      }
      // Перечисление имён: «Мира и Олег».
      if (!hit && depth > 0) out = s.replace(/ и /g, ' and ');
    }
    if (c.memo.size > 5000) c.memo.clear();
    c.memo.set(mk, out);
    return out;
  }
  /** Перевести все строки объекта (состояние комнаты от сервера). Возвращает новый объект. */
  // В английском тексте ёлочки заменяем на английские кавычки.
  // Кавычки вокруг названия в языке страницы: «Сцена» или “The stage”.
  const q = (s, lang) => ((lang || cur) === 'en' ? '\u201c' + s + '\u201d' : '\u00ab' + s + '\u00bb');
  const quotes = (s) => (s.indexOf('«') < 0 && s.indexOf('»') < 0 ? s : s.replace(/«/g, '\u201c').replace(/»/g, '\u201d'));
  function deep(o, lang = cur) {
    if (lang === 'ru') return o;
    if (typeof o === 'string') {
      // Русские строки, которых нет в словаре (места и тексты русского дела), не трогаем: их могут отправить обратно на сервер.
      if (!/[А-Яа-яЁё]/.test(o)) return quotes(o);
      const t = tr(o, lang);
      return t === o ? o : quotes(t);
    }
    if (Array.isArray(o)) return o.map((x) => deep(x, lang));
    if (o && typeof o === 'object') {
      const r = {};
      for (const k of Object.keys(o)) r[k] = deep(o[k], lang);
      return r;
    }
    return o;
  }

  /* Английское правило для чисел: 1 case, 2 cases. Русское: 1 дело, 2 дела, 5 дел. */
  function plural(n, one, few, many, lang = cur) {
    if (lang !== 'ru') return Math.abs(n) === 1 ? one : many;
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  /* Адреса: русский сайт без приставки, английский под /en. */
  const strip = (p) => String(p || '/').replace(/^\/en(?=\/|$)/, '') || '/';
  const pathFor = (lang, p) => { const b = strip(p); return lang === 'en' ? (b === '/' ? '/en/' : '/en' + b) : b; };
  const pathLang = (p) => (/^\/en(\/|$)/.test(String(p || '')) ? 'en' : 'ru');

  const api = {
    LANGS, L, Lx, tr, deep, quotes, q, add, applyDom, look, plural, fromList, fromHeader, pathFor, pathLang, strip,
    get lang() { return cur; },
    set(lang) { cur = norm(lang); },
    /** Приставка адреса для текущего языка: '' или '/en'. */
    get prefix() { return cur === 'en' ? '/en' : ''; },
    has(lang, key) { return !!dicts[lang] && (own(dicts[lang].ui, key) || own(dicts[lang].msg, key)); },
    dict(lang) { return dicts[lang]; },
  };

  /** Перевести статичную разметку страницы (шапка, подвал, плашка cookie): тексты, подписи и ссылки на страницы сайта. */
  function applyDom(root) {
    if (cur === 'ru' || !root || typeof document === 'undefined') return;
    const CYR = /[А-Яа-яЁё]/;
    const walker = document.createTreeWalker(root, 4);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach((n) => {
      const v = n.nodeValue;
      if (!CYR.test(v)) return;
      const key = v.trim();
      const t = look(cur, key);
      if (t !== key) n.nodeValue = v.replace(key, t);
    });
    root.querySelectorAll('[aria-label],[title],[placeholder],[alt]').forEach((el) => {
      ['aria-label', 'title', 'placeholder', 'alt'].forEach((a) => {
        const v = el.getAttribute(a);
        if (v && CYR.test(v)) el.setAttribute(a, look(cur, v));
      });
    });
    root.querySelectorAll('a[href^="/"]').forEach((a) => {
      const h = a.getAttribute('href');
      if (a.hasAttribute('data-lang')) return;
      if (/^\/(rules|contacts|privacy|cookies)?\/?$/.test(h)) a.setAttribute('href', pathFor(cur, h));
    });
  }

  /* В браузере язык известен сразу. Сервер помечает страницу (data-srv) и ставит lang по адресу.
     Без сервера (демо из файла) берём сохранённый выбор, а без него язык системы. */
  if (typeof document !== 'undefined' && document.documentElement) {
    const html = document.documentElement;
    let lang = null;
    if (html.hasAttribute('data-srv')) lang = html.getAttribute('lang');
    else {
      try { lang = localStorage.getItem('detective.lang'); } catch (e) { /* хранилище недоступно */ }
      if (!lang && typeof navigator !== 'undefined') lang = fromList(navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
    }
    cur = norm(lang);
    html.setAttribute('lang', cur);
  }
  return api;
});
