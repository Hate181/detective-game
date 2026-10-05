/* Полный прогон лаборатории стратегий: таблицы для отчёта (docs/strategy-analysis.md). node scripts/strategy-report.js [games=1000] */
const L = require('./strategy-lab');
const games = Number(process.argv[2] || 1000);
const out = { games };
const reset = () => Object.assign(L.ABL, { capTags: false, doubles: 0, noPrivate: false, noTags: false, secretShare: 0.15, quietShare: 0, finaleAt: 3 });
const cell = (o) => { const r = L.run(Object.assign({ games }, o)); return { win: r.win, byKick: r.byKick, top: r.cnt.map((c, i) => (c ? r.top[i] / c : null)), uniq: r.cnt.map((c, i) => (c ? r.uniq[i] / c : null)), innocentKicks: r.innocentKicks / r.games }; };

reset();
out.luck = {}; [6, 8, 10].forEach((n) => { out.luck[n] = cell({ n, mix: 'noise', killer: 'random', games: games * 2 }); });

const rows = ['noise', 'ruleMatch', 'ruleHide', 'normTagFirst', 'normSelf', 'normRandom', 'normTagLast', 'allCasual', 'human'];
const killers = ['random', 'stall', 'mimic', 'smart', 'smartPush'];
out.matrix = {};
[6, 8, 10].forEach((n) => { out.matrix[n] = {}; rows.forEach((m) => { out.matrix[n][m] = {}; killers.forEach((k) => { out.matrix[n][m][k] = cell({ n, mix: m, killer: k }).win; }); }); });

out.matrixAfter = {};
[6, 8, 10].forEach((n) => { out.matrixAfter[n] = {}; rows.forEach((m) => { out.matrixAfter[n][m] = {}; killers.forEach((k) => { reset(); L.ABL.capTags = true; out.matrixAfter[n][m][k] = cell({ n, mix: m, killer: k }).win; }); }); });
reset();
out.speedAfter = {};
[6, 8, 10].forEach((n) => { out.speedAfter[n] = {}; ['normTagFirst', 'normRandom'].forEach((m) => { reset(); L.ABL.capTags = true; out.speedAfter[n][m] = cell({ n, mix: m, killer: 'smart' }); }); });
reset();
out.speed = {};
[6, 8, 10].forEach((n) => { out.speed[n] = {}; ['normTagFirst', 'normRandom', 'normTagLast'].forEach((m) => { out.speed[n][m] = cell({ n, mix: m, killer: 'smart' }); }); });

// каналы информации (острые игроки, умный убийца)
out.channels = {};
const S = L.PERSONAS.normTagFirst, orig = Object.assign({}, S);
[8, 10].forEach((n) => {
  const rowsC = {};
  const run = (label) => { rowsC[label] = cell({ n, mix: 'normTagFirst', killer: 'smart' }).win; };
  reset(); Object.assign(S, orig); run('все каналы');
  L.ABL.noPrivate = true; run('без свидетелей и обыска'); L.ABL.noPrivate = false;
  L.ABL.noTags = true; run('без улик-совпадений'); L.ABL.noTags = false;
  S.h = 0; run('не штрафуют за скрытность'); Object.assign(S, orig);
  S.cardUse = 0; run('карты не играются'); Object.assign(S, orig);
  S.coop = 0; S.herd = 0; run('никто не делится знаниями'); Object.assign(S, orig);
  L.ABL.noPrivate = true; L.ABL.noTags = false; S.h = 0; S.cardUse = 0; S.coop = 0; run('только улики'); reset(); Object.assign(S, orig);
  out.channels[n] = rowsC;
});

// варианты правил
const variants = [
  ['как сейчас', { capTags: false, doubles: 0 }],
  ['«одна из двух»', { capTags: true, doubles: 0 }],
  ['«одна из двух» + 2 двойника', { capTags: true, doubles: 2 }],
  ['«одна из двух» + 3 двойника', { capTags: true, doubles: 3 }],
  ['3 двойника', { capTags: false, doubles: 3 }],
];
out.variants = {};
[8, 10].forEach((n) => {
  out.variants[n] = {};
  variants.forEach(([label, c]) => {
    reset(); Object.assign(L.ABL, c);
    out.variants[n][label] = {};
    ['noise', 'normTagFirst', 'normRandom', 'human'].forEach((m) => { out.variants[n][label][m] = cell({ n, mix: m, killer: 'smart' }).win; });
  });
});
out.finale6 = {};
[3, 4, 5].forEach((fa) => { reset(); L.ABL.finaleAt = fa; out.finale6[fa] = {}; ['noise', 'normRandom', 'human', 'normTagFirst'].forEach((m) => { out.finale6[fa][m] = cell({ n: 6, mix: m, killer: 'smart' }).win; }); });

// набор убийцы
reset();
out.toolkit = {};
[8, 10].forEach((n) => { out.toolkit[n] = {}; ['smart', 'smartPlant', 'smartPush', 'naiveAlibi'].forEach((k) => { out.toolkit[n][k] = { human: cell({ n, mix: 'human', killer: k }).win, normRandom: cell({ n, mix: 'normRandom', killer: k }).win }; }); });
require('fs').writeFileSync(process.argv[3] || '/tmp/lab-results.json', JSON.stringify(out, null, 1));
console.log('готово');
