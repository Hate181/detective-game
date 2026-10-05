const E = require('../public/shared/engine.js');
const Cases = require('../public/shared/cases.js');
const t0 = Date.now();
let bad = 0;
for (const players of [4, 6, 7, 8, 10]) {
  const res = E.simulate({ caseData: Cases.CASES[players % 4], games: 60, players, seed: players });
  console.log(`n=${players}: невиновные ${res.innocentWins}/${res.games}`, JSON.stringify(res.byRound), `в среднем ${res.avgMinutes.toFixed(1)} мин`, `невиновных исключили ${res.innocentKicks}`, 'нарушений', res.violations.length, 'ошибок', res.errors.length);
  if (res.errors.length) { console.log(res.errors.slice(0, 2).join('\n')); bad++; }
  if (res.violations.length) bad++;
}
console.log((Date.now() - t0) + ' мс');
process.exit(bad ? 1 : 0);
