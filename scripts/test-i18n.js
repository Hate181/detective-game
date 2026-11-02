/* Английская версия: у каждой строки интерфейса есть перевод, подстановки и разметка в переводе те же,
   события движка переводятся шаблонами, адреса и язык браузера определяются правильно. */
const fs = require('fs');
const path = require('path');
const I18N = require('../public/shared/i18n.js');
const Content = require('../public/shared/content.js');
const Cases = require('../public/shared/cases.js');

let fails = 0;
const check = (ok, msg) => { if (!ok) { console.log('ПРОВАЛ: ' + msg); fails++; } };
const ROOT = path.join(__dirname, '..');
const dict = I18N.dict('en');

// 1. Все L('...') в клиенте (кроме админки, она только по-русски) переведены.
const files = fs.readdirSync(path.join(ROOT, 'public/js')).filter((f) => f.endsWith('.js') && f !== 'admin.js');
const keyRe = /\bL\(\s*'((?:[^'\\]|\\.)*)'/g;
let total = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, 'public/js', f), 'utf8');
  for (const m of src.matchAll(keyRe)) {
    const key = m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    if (!/[А-Яа-яЁё]/.test(key)) continue;
    total++;
    check(I18N.has('en', key), `${f}: нет перевода «${key}»`);
  }
}

// 2. В переводе те же подстановки {0} и те же теги, что в русском ключе.
const tags = (s) => (s.match(/<[^>]+>/g) || []).join('');
const holes = (s) => (s.match(/\{\d+\}/g) || []).sort().join('');
for (const part of ['ui', 'msg']) {
  for (const [k, v] of Object.entries(dict[part])) {
    check(holes(k) === holes(v), `${part}: подстановки не совпадают: «${k}» → «${v}»`);
    check(tags(k) === tags(v), `${part}: разметка не совпадает: «${k}» → «${v}»`);
    check(!/[А-Яа-яЁё]/.test(v), `${part}: в переводе кириллица: «${v}»`);
    check(/^\s/.test(k) === /^\s/.test(v) && /\s$/.test(k) === /\s$/.test(v), `${part}: пробелы по краям не совпадают: «${k}»`);
  }
}

// 3. События журнала переводятся шаблонами, имена и подстановки сохраняются.
const tr = (s) => I18N.tr(s, 'en');
check(tr('Слово: Мира.') === 'Мира has the floor.', 'шаблон «Слово»');
check(tr('Исключён: Олег. Роль: сообщник убийцы.') === "Voted out: Олег. Role: the killer's accomplice.", 'шаблон исключения с переводом подстановок');
check(tr('Мира и Олег могут сыграть карту защиты.') === 'Мира and Олег can play a defence card.', 'перечисление имён');
check(tr('Итоги голосования: Мира: 2. Не выбрали: 1.') === "Vote results: Мира: 2. Didn't vote: 1.", 'итоги голосования с пропусками');
check(tr('Профессия') === 'Profession' && tr('Обыск') === 'Search', 'подписи пунктов и карт из справочника');
check(tr('Сцена') === 'Сцена', 'неизвестная русская строка не меняется');
check(I18N.deep({ a: ['Дело закрыто.', 'Таверна «Сухой колос»'], b: 1 }, 'en').a.join('|') === 'Case closed.|Таверна «Сухой колос»', 'deep не трогает места русского дела');

// 4. Язык браузера и адреса.
check(I18N.fromHeader('ru-RU,ru;q=0.9,en;q=0.8') === 'ru', 'Accept-Language ru');
check(I18N.fromHeader('en-US,en;q=0.9') === 'en', 'Accept-Language en');
check(I18N.fromHeader('de-DE,de;q=0.9,ru;q=0.5') === 'ru', 'русский где-то в списке');
check(I18N.fromHeader('kk-KZ') === 'ru', 'казахский браузер');
check(I18N.fromHeader('uk-UA,uk;q=0.9,en;q=0.8') === 'en', 'украинский без русского');
check(I18N.fromHeader('') === null, 'без заголовка язык не выбираем');
check(I18N.pathFor('en', '/rules') === '/en/rules' && I18N.pathFor('en', '/') === '/en/' && I18N.pathFor('ru', '/en/rules') === '/rules' && I18N.pathFor('ru', '/en/') === '/', 'адреса языков');
check(I18N.plural(1, 'case', 'cases', 'cases', 'en') === 'case' && I18N.plural(21, 'case', 'cases', 'cases', 'en') === 'cases', 'английское число');
check(Content.trans(2, 'дело', 'дела', 'дел') === 'дела' && Content.trans(2, 'case', 'cases', 'cases') === 'cases', 'Content.trans на двух языках');

// 5. Английский справочник: те же ключи, свой реестр примет.
const en = Content.forLang('en');
check(en !== Content && en.forLang('ru') === Content, 'forLang');
check(Object.keys(en.TAGS).filter((k) => !k.includes('.')).join() === Object.keys(Content.TAGS).filter((k) => !k.includes('.')).join(), 'те же общие метки');
check(en.NPC_NAMES.classic.length >= 100 && en.NPC_NAMES.modern.length >= 100 && new Set(en.NPC_NAMES.modern).size === en.NPC_NAMES.modern.length, 'английские имена персонажей без повторов');

// 6. Переведённые дела: те же ключи примет, столько же профессий и мест, без кириллицы.
const EN = require('../public/shared/case-content.en.js');
for (const id of Object.keys(EN)) {
  const ru = Cases.CASES.find((c) => c.id === id);
  check(!!ru, `${id}: перевод без русского дела`);
  if (!ru) continue;
  const t = EN[id];
  check(t.locations.length === ru.locations.length && t.locations.includes(t.scene), `${id}: места`);
  check(t.professions.length === ru.professions.length, `${id}: профессий ${t.professions.length}, а в русском ${ru.professions.length}`);
  const rk = ru.habits.map((h) => h.key.replace(id + '.', '')).sort().join();
  check(t.habits.map((h) => h.key).sort().join() === rk, `${id}: ключи примет не совпадают с русскими`);
  check(Object.keys(t.proClues || {}).sort().join() === Object.keys(ru.proClues || {}).sort().join(), `${id}: улики профессий`);
  ['relations', 'motives', 'secrets'].forEach((k) => check(t[k].length >= Math.min(10, ru[k].length), `${id}: мало ${k}`));
  if (ru.npcNames) check(Array.isArray(t.npcNames) && t.npcNames.length >= 6, `${id}: имена персонажей`);
  check(!/[А-Яа-яЁё]/.test(JSON.stringify(t)), `${id}: кириллица в переводе`);
  const loc = Cases.localize(ru, 'en');
  check(loc.lang === 'en' && loc.title === t.title && loc.habits.every((h) => en.TAGS[h.key] && en.TAGS[h.key].label === t.habits.find((x) => `${id}.${x.key}` === h.key).label), `${id}: localize`);
  check(Content.TAGS[`${id}.${t.habits[0].key}`].label !== t.habits[0].label, `${id}: английские приметы не попали в русский реестр`);
}

console.log(`i18n: ${total} строк интерфейса, ${Object.keys(dict.ui).length + Object.keys(dict.msg).length} в словаре, дел на английском: ${Object.keys(EN).length}`);
if (fails) { console.log('Провалов: ' + fails); process.exit(1); }
console.log('i18n: всё на месте');
