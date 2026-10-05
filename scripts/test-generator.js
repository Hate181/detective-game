const G = require('../public/shared/generator.js');
const Cases = require('../public/shared/cases.js');
const { Rng } = require('../public/shared/rng.js');
let bad = 0, runs = 0;
const t0 = Date.now();
for (const c of Cases.CASES) for (let n = 4; n <= 10; n++) for (let seed = 1; seed <= 300; seed++) {
  const rng = new Rng(seed * 7919 + n);
  const ids = Array.from({ length: n }, (_, i) => 'p' + i);
  const killer = ids[rng.int(n)];
  const acc = n >= 6 ? rng.pick(ids.filter((x) => x !== killer)) : null;
  const gang = n >= 6 && seed % 3 !== 0; // две трети дел с бандой, треть со старым правилом
  runs++;
  try {
    const gen = G.generate({ caseData: c, ids, killerId: killer, accompliceId: acc, gang, rng });
    const e = G.verify(gen, ids, killer, gang ? acc : null);
    if (e.length) { bad++; if (bad < 5) console.log(c.id, n, seed, e); }
  } catch (err) { bad++; if (bad < 5) console.log('ERR', c.id, n, seed, err.message); }
}
console.log(`runs ${runs}, failures ${bad}, ${Date.now() - t0}ms`);
