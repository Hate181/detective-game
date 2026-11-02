// Собирает английские тексты встроенных дел из docs/en-src/<id>.json в public/shared/case-content.en.js.
// Запуск: node scripts/build-case-content-en.js
// В файле дела: title, short, victim, teaser, locations, scene, professions (имена по порядку, как в cases.js),
// habits (key как в русском деле), proClues, relations, motives, secrets, npcNames (если есть в русском).
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'docs', 'en-src');
const target = path.join(__dirname, '..', 'public', 'shared', 'case-content.en.js');
const out = {};
for (const f of fs.readdirSync(dir).filter((x) => /^[a-z0-9-]+\.json$/.test(x)).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const id = f.replace(/\.json$/, '');
  out[id] = {
    title: d.title, short: d.short, victim: d.victim, teaser: d.teaser, locations: d.locations, scene: d.scene, professions: d.professions,
    habits: d.habits.map((h) => ({ key: h.key, label: h.label, habit: h.habit, clues: h.clues })),
    proClues: d.proClues || {}, relations: d.relations, motives: d.motives, secrets: d.secrets,
  };
  if (Array.isArray(d.npcNames) && d.npcNames.length) out[id].npcNames = d.npcNames;
}
const body = `/* English text of the built-in cases. Built by scripts/build-case-content-en.js from docs/en-src/*.json. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DetectiveCaseContentEn = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return ${JSON.stringify(out, null, 2)};
});
`;
fs.writeFileSync(target, body);
console.log('cases:', Object.keys(out).length, Object.keys(out).join(', '));
