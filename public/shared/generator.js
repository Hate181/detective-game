/* Генератор дела: сердце игры.
   Гарантии (проверяет verify):
   1. Каждая улика подходит 2–3 игрокам, и убийца среди них.
   2. Значит, среди подходящих всегда есть невиновный.
   3. Все четыре улики вместе подходят ровно одному игроку: убийце. Дело решаемо.
   Для партии «банда» (убийца и сообщник) улики делятся между двоими, чтобы ни один преступник не был «открытой книгой»:
   1. Убийце подходят три улики из четырёх, сообщнику тоже три, а вместе они закрывают все четыре.
   2. Каждой улике подходят 2–3 игрока: хотя бы один преступник и хотя бы один невиновный.
   3. Есть «двойники»: невиновные, которым тоже подходят три улики (один за столом до 7, двое от 8). Поэтому совпадения сами
      по себе ничего не доказывают, а решают алиби, свидетели и слова. Всем четырём уликам не подходит никто.
   4. Особенностей у всех 2–3: по их числу преступника не вычислить. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./content.js'));
  else root.DetectiveGenerator = factory(root.DetectiveContent);
})(typeof self !== 'undefined' ? self : this, function (Content) {
  const CLUE_COUNT = 4;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const uniq = (a) => Array.from(new Set(a));

  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const fmt = (min) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

  function professionPool(caseData) {
    const own = (caseData.professions || []).map((p) => ({ name: p.name, tags: (p.tags || []).filter((t) => Object.prototype.hasOwnProperty.call(Content.TAGS, t)) }));
    const names = new Set(own.map((p) => p.name));
    const extra = Content.GENERIC_PROFESSIONS.filter((p) => !names.has(p.name));
    return own.concat(extra);
  }

  /** Раздаёт теги и подбирает четыре улики. Возвращает null, если попытка не удалась. */
  function tryTags(ids, killerId, accompliceId, profs, rng) {
    const n = ids.length;
    const target = clamp(Math.round(34 / n), 3, 6);
    const pro = {}, hab = {};
    ids.forEach((id, i) => {
      pro[id] = profs[i].tags.slice();
      const want = clamp(target - pro[id].length, 1, 3);
      hab[id] = rng.sample(Content.HABIT_TAGS.filter((t) => !pro[id].includes(t)), want);
    });
    const tagsOf = (id) => uniq(pro[id].concat(hab[id]));
    const holders = (t) => ids.filter((id) => tagsOf(id).includes(t));
    const crim = accompliceId ? [killerId, accompliceId] : [killerId];
    const others = ids.filter((id) => !crim.includes(id));

    // Сначала теги, которыми убийца уже обладает, потом те, что можно дать привычкой.
    const own = rng.shuffle(tagsOf(killerId));
    const fresh = rng.shuffle(Content.HABIT_TAGS.filter((t) => !own.includes(t)));
    const order = own.concat(fresh);

    // Подгоняет число носителей тега до 2–3, не трогая профессии.
    const fix = (t) => {
      for (const c of crim) {
        if (!holders(t).includes(c)) {
          if (!Content.TAGS[t].habit) return false;
          hab[c].push(t);
        }
      }
      let H = holders(t);
      while (H.length > 3) {
        const removable = H.filter((id) => !crim.includes(id) && hab[id].includes(t) && !pro[id].includes(t));
        if (!removable.length) return false;
        const id = rng.pick(removable);
        hab[id] = hab[id].filter((x) => x !== t);
        H = holders(t);
      }
      while (H.length < crim.length + 1) {
        if (!Content.TAGS[t].habit) return false;
        const free = others.filter((id) => !tagsOf(id).includes(t));
        if (!free.length) return false;
        hab[rng.pick(free)].push(t);
        H = holders(t);
      }
      return true;
    };

    const chosen = [];
    for (const t of order) {
      if (chosen.length >= CLUE_COUNT) break;
      const snapshot = JSON.stringify(hab);
      if (fix(t)) chosen.push(t);
      else { const s = JSON.parse(snapshot); ids.forEach((id) => { hab[id] = s[id]; }); }
    }
    if (chosen.length < CLUE_COUNT) return null;

    // Ни один невиновный не должен подходить под все четыре улики сразу.
    for (const id of others) {
      if (chosen.every((t) => tagsOf(id).includes(t))) {
        const drop = chosen.filter((t) => hab[id].includes(t) && !pro[id].includes(t));
        if (!drop.length) return null;
        const t = rng.pick(drop);
        hab[id] = hab[id].filter((x) => x !== t);
        if (!fix(t)) return null;
      }
    }
    // У каждого должна остаться хотя бы одна особенность.
    for (const id of ids) {
      if (!hab[id].length) {
        const free = Content.HABIT_TAGS.filter((t) => !chosen.includes(t) && !tagsOf(id).includes(t));
        if (!free.length) return null;
        hab[id].push(rng.pick(free));
      }
    }
    const res = { pro, hab, tagsOf, chosen };
    return verifyTags(ids, crim, chosen, tagsOf) ? res : null;
  }

  /** Банда: раздаёт теги так, чтобы улики делились между убийцей и сообщником, а у невиновных были двойники. */
  function tryGang(ids, killerId, accId, profs, rng) {
    const n = ids.length;
    const crim = [killerId, accId];
    const inn = ids.filter((id) => !crim.includes(id));
    const pro = {}, hab = {};
    ids.forEach((id, i) => { pro[id] = profs[i].tags.slice(); hab[id] = []; });
    const tagsOf = (id) => uniq(pro[id].concat(hab[id]));
    const holders = (t) => ids.filter((id) => tagsOf(id).includes(t));

    // 1. Четыре улики: метки, которые можно дать привычкой и которые профессия даёт не больше чем одному игроку.
    //    Сначала те, что уже есть у преступников по профессии: так улика естественнее.
    const proCount = (t) => ids.filter((id) => pro[id].includes(t)).length;
    const cand = rng.shuffle(Content.HABIT_TAGS.filter((t) => proCount(t) <= 1));
    const pref = cand.filter((t) => crim.some((c) => pro[c].includes(t)));
    const chosen = uniq(pref.slice(0, 2).concat(cand)).slice(0, CLUE_COUNT);
    if (chosen.length < CLUE_COUNT) return null;

    // 2. Кому из преступников какая улика: по три каждому, вместе все четыре (две общие, по одной своей).
    const K0 = chosen.filter((t) => pro[killerId].includes(t)), A0 = chosen.filter((t) => pro[accId].includes(t));
    if (K0.length > 3 || A0.length > 3) return null;
    let K = null, A = null;
    for (let i = 0; i < 20 && !K; i++) {
      const k = K0.concat(rng.shuffle(chosen.filter((t) => !K0.includes(t)))).slice(0, 3);
      const a = uniq(A0.concat(chosen.filter((t) => !k.includes(t))));
      for (const t of rng.shuffle(chosen.filter((x) => !a.includes(x)))) if (a.length < 2 || a.length < 3) a.push(t);
      if (a.length === 3 && k.length === 3) { K = k; A = a; }
    }
    if (!K) return null;
    K.forEach((t) => { if (!pro[killerId].includes(t)) hab[killerId].push(t); });
    A.forEach((t) => { if (!pro[accId].includes(t)) hab[accId].push(t); });
    if (chosen.some((t) => holders(t).length > 3)) return null;

    // 3. Двойники: невиновные, которым тоже подходят три улики. Тогда «три совпадения» ещё не приговор.
    const matches = (id) => chosen.filter((t) => tagsOf(id).includes(t)).length;
    const decoyN = n >= 8 ? 2 : 1;
    const decoys = inn.slice().sort((a, b) => matches(b) - matches(a) || rng.next() - 0.5).slice(0, decoyN);
    for (const d of decoys) {
      const want = 3;
      for (const t of rng.shuffle(chosen.slice())) {
        if (matches(d) >= want) break;
        if (!tagsOf(d).includes(t) && holders(t).length < 3) hab[d].push(t);
      }
      if (matches(d) < want) return null;
    }
    // 4. У каждой улики должен быть хотя бы один невиновный.
    for (const t of chosen) {
      if (holders(t).some((id) => inn.includes(id))) continue;
      if (holders(t).length >= 3) return null;
      const free = inn.filter((id) => !decoys.includes(id) && matches(id) <= 1 && !tagsOf(id).includes(t));
      if (!free.length) return null;
      hab[rng.pick(free)].push(t);
    }
    // 5. Особенностей у всех 2–3: добиваем безобидными метками, которых нет среди улик.
    for (const id of ids) {
      if (hab[id].length > 3) return null;
      // Преступникам улики часто сами дают третью особенность, поэтому невиновным третья выпадает чаще: по числу не отличить.
      const want = Math.max(hab[id].length, crim.includes(id) ? 2 : rng.chance(0.62) ? 3 : 2);
      const free = rng.shuffle(Content.HABIT_TAGS.filter((t) => !chosen.includes(t) && !tagsOf(id).includes(t)));
      while (hab[id].length < want && free.length) hab[id].push(free.shift());
      if (hab[id].length < 2) return null;
    }
    const res = { pro, hab, tagsOf, chosen };
    return verifyGang(ids, killerId, accId, chosen, tagsOf, hab) ? res : null;
  }

  function verifyGang(ids, killerId, accId, chosen, tagsOf, hab) {
    return gangErrors(ids, killerId, accId, chosen, tagsOf, (id) => hab[id].length).length === 0;
  }

  /** Нарушения правил банды (пустой список: всё хорошо). */
  function gangErrors(ids, killerId, accId, chosen, tagsOf, habCount) {
    const errors = [];
    const crim = [killerId, accId];
    const m = (id) => chosen.filter((t) => tagsOf(id).includes(t)).length;
    chosen.forEach((t) => {
      const H = ids.filter((id) => tagsOf(id).includes(t));
      if (H.length < 2 || H.length > 3) errors.push(`Улика «${t}» подходит ${H.length} игрокам`);
      if (!H.some((id) => crim.includes(id))) errors.push(`Улика «${t}» не указывает ни на одного преступника`);
      if (H.every((id) => crim.includes(id))) errors.push(`Улика «${t}» без невиновного`);
    });
    crim.forEach((c) => { if (m(c) !== 3) errors.push(`Преступнику подходят ${m(c)} улики из четырёх, а должно три`); });
    if (!chosen.every((t) => crim.some((c) => tagsOf(c).includes(t)))) errors.push('Преступники вместе не закрывают все улики');
    const inn = ids.filter((id) => !crim.includes(id));
    if (inn.some((id) => m(id) >= CLUE_COUNT)) errors.push('Невиновному подходят все улики');
    if (!inn.some((id) => m(id) >= 3)) errors.push('Нет двойника среди невиновных');
    ids.forEach((id) => { const h = habCount(id); if (h < 1 || h > 3) errors.push(`Особенностей ${h}`); });
    return errors;
  }

  function verifyTags(ids, crim, chosen, tagsOf) {
    for (const t of chosen) {
      const H = ids.filter((id) => tagsOf(id).includes(t));
      if (H.length < crim.length + 1 || H.length > 3 || !crim.every((c) => H.includes(c))) return false;
    }
    const all = ids.filter((id) => chosen.every((t) => tagsOf(id).includes(t)));
    return all.length === crim.length && crim.every((c) => all.includes(c));
  }

  function generate({ caseData, ids, killerId, accompliceId = null, gang = false, rng }) {
    const crimId = gang && accompliceId ? accompliceId : null; // сообщник получает те же улики, только если победа требует исключить обоих
    const n = ids.length;
    const pool = professionPool(caseData);
    const locs = caseData.locations;
    const scene = caseData.scene && locs.includes(caseData.scene) ? caseData.scene : locs[0];
    const nonScene = locs.filter((l) => l !== scene);

    let t = null, profs = null;
    for (let attempt = 0; attempt < 600 && !t; attempt++) {
      profs = rng.sample(pool, n);
      t = crimId ? tryGang(ids, killerId, crimId, profs, rng) : tryTags(ids, killerId, null, profs, rng);
    }
    if (!t) throw new Error('Не удалось собрать дело: слишком мало разных профессий.');

    // Улики
    const clues = rng.shuffle(t.chosen).map((tag, i) => ({
      id: `c${i + 1}`, tag, text: rng.pick(Content.TAGS[tag].clues), planted: false,
      fits: ids.filter((id) => t.tagsOf(id).includes(tag)),
    }));

    // Алиби и секреты
    const others = ids.filter((id) => id !== killerId);
    const shuffled = rng.shuffle(others);
    const pairCount = n >= 8 ? 2 : n >= 6 ? 1 : 0;
    const real = {}, claim = {}, secret = {};
    const otherLoc = (L) => rng.pick(nonScene.filter((x) => x !== L));
    let k = 0;
    for (let i = 0; i < pairCount; i++) {
      const a = shuffled[k++], b = shuffled[k++];
      if (!b) break;
      const L = rng.pick(nonScene);
      real[a] = real[b] = L;
      claim[a] = otherLoc(L); claim[b] = otherLoc(L);
      secret[a] = { kind: 'meet', loc: L, partnerId: b };
      secret[b] = { kind: 'meet', loc: L, partnerId: a };
    }
    for (; k < shuffled.length; k++) {
      const id = shuffled[k];
      if (rng.chance(0.45)) {
        const L = rng.pick(nonScene);
        real[id] = L; claim[id] = otherLoc(L);
        secret[id] = { kind: 'loc', loc: L, text: rng.pick(Content.SECRET_LOC) };
      } else {
        const L = rng.pick(nonScene);
        real[id] = L; claim[id] = L;
        secret[id] = { kind: 'plain', text: rng.pick(Content.SECRET_PLAIN) };
      }
    }
    real[killerId] = scene; claim[killerId] = null;
    secret[killerId] = { kind: 'plain', text: rng.pick(Content.SECRET_PLAIN) };

    const murder = toMin(caseData.time);
    const window = () => ({ from: fmt(murder - rng.range(15, 40)), to: fmt(murder + rng.range(10, 30)) });

    const relations = rng.shuffle(Content.RELATIONS);
    const motives = rng.shuffle(Content.MOTIVES);

    // Цели
    const nonKiller = (excl) => ids.filter((id) => id !== killerId && id !== excl);
    const goals = {};
    ids.forEach((id) => {
      if (id === accompliceId) { goals[id] = { type: 'protect', target: killerId }; return; }
      if (secret[id].kind === 'meet' && rng.chance(0.75)) { goals[id] = { type: 'hide', target: secret[id].partnerId }; return; }
      const r = rng.next();
      if (id === killerId || r < 0.4) goals[id] = { type: 'arrest', target: rng.pick(nonKiller(id)) };
      else if (r < 0.7) goals[id] = { type: 'protect', target: rng.pick(nonKiller(id)) };
      else goals[id] = { type: 'expose', target: rng.pick(nonKiller(id)) };
    });

    // Карты действий
    // Карты действий: «Подмены» у случайных игроков (кто угодно, не только преступники), остальным по кругу.
    // Колода ровно на число игроков, поэтому обе «Подмены» всегда в игре.
    const base = rng.shuffle(['warrant', 'warrant', 'warrant', 'advocate', 'advocate', 'advocate', 'gossip', 'gossip', 'gossip', 'testimony', 'testimony', 'testimony']);
    const swaps = Math.min(Content.SWAPS_IN_DECK, Math.max(0, ids.length - 4));
    const deck = rng.shuffle(Array(swaps).fill('swap').concat(Array.from({ length: ids.length - swaps }, (_, i) => base[i % base.length])));
    const cardType = {};
    ids.forEach((id, i) => { cardType[id] = deck[i]; });

    const cards = {};
    ids.forEach((id, i) => {
      const tags = t.tagsOf(id);
      const w = window();
      cards[id] = {
        profession: profs[i].name,
        proTags: t.pro[id],
        habitTags: t.hab[id],
        habitText: t.hab[id].map((h) => Content.TAGS[h].habit).join(', '),
        tags,
        relation: relations[i % relations.length],
        motive: motives[i % motives.length],
        alibi: { claim: claim[id] ? { loc: claim[id], from: w.from, to: w.to } : null, real: { loc: real[id], from: w.from, to: w.to }, window: w },
        secret: secret[id],
        goal: goals[id],
        witnesses: ids.filter((o) => o !== id && real[o] === real[id]),
        cardType: cardType[id],
      };
    });
    return { cards, clues, scene, tagsOf: t.tagsOf };
  }

  /** Независимая проверка готового дела. Возвращает список нарушений (пустой — всё хорошо). */
  function verify(gen, ids, killerId, accompliceId = null) {
    const errors = [];
    const crim = accompliceId ? [killerId, accompliceId] : [killerId];
    const tagsOf = (id) => gen.cards[id].tags;
    const tags = gen.clues.map((c) => c.tag);
    if (new Set(tags).size !== tags.length) errors.push('Улики повторяются');
    if (gen.clues.length !== CLUE_COUNT) errors.push('Улик должно быть четыре');
    if (accompliceId) return errors.concat(gangErrors(ids, killerId, accompliceId, tags, tagsOf, (id) => gen.cards[id].habitTags.length));
    gen.clues.forEach((c) => {
      const H = ids.filter((id) => tagsOf(id).includes(c.tag));
      if (H.length < crim.length + 1 || H.length > 3) errors.push(`Улика «${c.tag}» подходит ${H.length} игрокам`);
      crim.forEach((x) => { if (!H.includes(x)) errors.push(`Улика «${c.tag}» не указывает на преступника`); });
      if (H.every((id) => crim.includes(id))) errors.push(`Улика «${c.tag}» без невиновного`);
    });
    const all = ids.filter((id) => tags.every((t) => tagsOf(id).includes(t)));
    if (all.length !== crim.length || !crim.every((x) => all.includes(x))) errors.push(`Улики сходятся на ${all.length} игроках`);
    ids.forEach((id) => { if (!gen.cards[id].habitTags.length) errors.push('Пустая особенность'); });
    return errors;
  }

  return { generate, verify, CLUE_COUNT, toMin, fmt };
});
