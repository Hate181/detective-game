// Собирает наполнение дел (приметы, улики профессий, связи, мотивы, тайны) из JSON-файлов в public/shared/case-content.js.
// Запуск: node scripts/build-case-content.js <папка с файлами id.json>
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
if (!dir) { console.error('Укажите папку с файлами дел.'); process.exit(1); }
const out = {};
for (const f of fs.readdirSync(dir).filter((x) => /^[a-z0-9-]+\.json$/.test(x)).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (!d.id || !Array.isArray(d.habits)) continue;
  out[d.id] = {
    habits: d.habits.map((h) => ({ key: h.key, label: h.label, habit: h.habit, clues: h.clues })),
    proClues: d.proClues || {},
    relations: d.relations, motives: d.motives, secrets: d.secrets,
  };
}
const body = `/* Наполнение встроенных дел: у каждого дела свои приметы (особенности игроков и улики), свои формулировки улик
   для меток профессий, свои связи с жертвой, мотивы и тайны. Файл собирается scripts/build-case-content.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DetectiveCaseContent = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return ${JSON.stringify(out, null, 2)};
});
`;
fs.writeFileSync(path.join(__dirname, '..', 'public', 'shared', 'case-content.js'), body);
console.log('дел:', Object.keys(out).length, Object.keys(out).join(', '));
