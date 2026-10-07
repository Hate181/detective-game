/* Надёжные JSON-файлы с данными игроков: аккаунты, профили, учёт входов, статистика.
   - Пишем во временный файл с правами 0600 и переименовываем: файл никогда не остаётся записанным наполовину.
   - Перед заменой прошлая версия уходит в .bak: если основной файл не прочитался, поднимаем копию,
     а битый файл откладываем рядом, а не затираем. Иначе первая же запись после сбоя стёрла бы всех игроков.
   - Раз в сутки кладём снимок в backup/ и храним последние 14. */
const fs = require('fs');
const path = require('path');

const KEEP_DAYS = 14;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch (e) { /* чужая папка или Windows */ }
}

/** Прочитать файл. Битый основной файл откладывается в сторону, данные берутся из .bak. */
function readSafe(file, fallback) {
  const parse = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!fs.existsSync(file)) {
    try { return parse(file + '.bak'); } catch (e) { return fallback; }
  }
  try { return parse(file); } catch (e) {
    const aside = `${file}.broken-${Date.now()}`;
    try { fs.renameSync(file, aside); } catch (e2) { /* оставим как есть */ }
    console.error(`vault: ${path.basename(file)} не читается, отложен в ${path.basename(aside)}, беру резервную копию`);
    try { return parse(file + '.bak'); } catch (e3) {
      // Ни основного файла, ни копии: запускаться с пустыми данными опасно, первая запись сотрёт всех.
      throw new Error(`vault: ${path.basename(file)} повреждён и резервной копии нет. Данные отложены в ${path.basename(aside)}.`);
    }
  }
}

/** Записать файл целиком: временный файл, прошлая версия в .bak, суточный снимок, если просили. */
function writeSafe(file, data, { daily = false } = {}) {
  const dir = path.dirname(file);
  ensureDir(dir);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  if (fs.existsSync(file)) { try { fs.copyFileSync(file, file + '.bak'); fs.chmodSync(file + '.bak', 0o600); } catch (e) { /* копия не главное */ } }
  fs.renameSync(tmp, file);
  if (daily) snapshot(file);
}

function snapshot(file) {
  try {
    const dir = path.join(path.dirname(file), 'backup');
    ensureDir(dir);
    const base = path.basename(file, '.json');
    const day = new Date().toISOString().slice(0, 10);
    const target = path.join(dir, `${base}-${day}.json`);
    fs.copyFileSync(file, target);
    fs.chmodSync(target, 0o600);
    const old = fs.readdirSync(dir).filter((f) => f.startsWith(base + '-') && f.endsWith('.json')).sort();
    old.slice(0, Math.max(0, old.length - KEEP_DAYS)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
  } catch (e) { console.error('vault: снимок не сделан', e.message); }
}

/** Удалить запись из резервной копии и всех суточных снимков: просьба удалить данные касается и их. */
function purge(file, drop) {
  const base = path.basename(file, '.json'), dir = path.join(path.dirname(file), 'backup');
  const list = [file + '.bak'];
  try { fs.readdirSync(dir).filter((f) => f.startsWith(base + '-') && f.endsWith('.json')).forEach((f) => list.push(path.join(dir, f))); } catch (e) { /* снимков нет */ }
  list.forEach((f) => {
    let data; try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return; }
    if (!drop(data)) return;
    const tmp = `${f}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, f);
  });
}

/** Права 0600 на уже лежащие файлы с данными игроков (их могли создать до этой версии). */
function tighten(dir, names) {
  try { fs.chmodSync(dir, 0o700); } catch (e) { /* нет папки */ }
  names.forEach((n) => { for (const f of [n, n + '.bak']) { try { fs.chmodSync(path.join(dir, f), 0o600); } catch (e) { /* нет файла */ } } });
}

module.exports = { readSafe, writeSafe, purge, tighten, ensureDir };
