/* Генератор дела: сердце игры.
   Гарантии (проверяет verify):
   1. Каждая улика подходит 2–3 игрокам, и убийца среди них.
   2. Значит, среди подходящих всегда есть невиновный.
   3. Все четыре улики вместе подходят ровно одному игроку: убийце. Дело решаемо.
   Для партии «банда» (убийца и сообщник) улики делятся между двоими, чтобы ни один преступник не был «открытой книгой»:
   1. Убийце подходят три улики из четырёх, сообщнику тоже три, а вместе они закрывают все четыре.
   2. Каждой улике подходят 2–3 игрока (за столом от восьми до 4): хотя бы один преступник и хотя бы один невиновный.
   3. Есть «двойники»: невиновные, которым тоже подходят три улики (один за столом до 7, двое от 8). Поэтому совпадения сами
      по себе ничего не доказывают, а решают алиби, свидетели и слова. Всем четырём уликам не подходит никто.
   4. Особенностей у всех ровно две, приметы берутся из набора самого дела: по их числу преступника не вычислить. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./content.js'));
  else root.DetectiveGenerator = factory(root.DetectiveContent);
})(typeof self !== 'undefined' ? self : this, function (Content) {
  const CLUE_COUNT = 4;
  const HABITS = 2; // особенностей у каждого игрока в партии с двумя преступниками
  // Сколько игроков может подходить под одну улику: за большим столом больше, иначе двоим двойникам не хватит места.
  const maxHolders = (n) => (n >= 8 ? 4 : 3);
  const NOISE = 0.6;
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
  function tryTags(ids, killerId, accompliceId, profs, rng, pool) {
    const n = ids.length;
    const target = clamp(Math.round(34 / n), 3, 6);
    const pro = {}, hab = {};
    ids.forEach((id, i) => {
      pro[id] = profs[i].tags.slice();
      const want = clamp(target - pro[id].length, 1, 3);
      hab[id] = rng.sample(pool.filter((t) => !pro[id].includes(t)), want);
    });
    const tagsOf = (id) => uniq(pro[id].concat(hab[id]));
    const holders = (t) => ids.filter((id) => tagsOf(id).includes(t));
    const crim = accompliceId ? [killerId, accompliceId] : [killerId];
    const others = ids.filter((id) => !crim.includes(id));

    // Сначала теги, которыми убийца уже обладает, потом те, что можно дать привычкой.
    const own = rng.shuffle(tagsOf(killerId));
    const fresh = rng.shuffle(pool.filter((t) => !own.includes(t)));
    const order = own.concat(fresh);

    // Подгоняет число носителей тега до 2–3, не трогая профессии.
    const fix = (t) => {
      for (const c of crim) {
        if (!holders(t).includes(c)) {
          if (!pool.includes(t)) return false;
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
        if (!pool.includes(t)) return false;
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
        const free = pool.filter((t) => !chosen.includes(t) && !tagsOf(id).includes(t));
        if (!free.length) return null;
        hab[id].push(rng.pick(free));
      }
    }
    const res = { pro, hab, tagsOf, chosen };
    return verifyTags(ids, crim, chosen, tagsOf) ? res : null;
  }

  /** Банда: раздаёт теги так, чтобы улики делились между убийцей и сообщником, а у невиновных были двойники.
      У каждого ровно две особенности. Поэтому третья улика у преступника и у двойника всегда приходит от профессии. */
  function tryGang(ids, killerId, accId, profs, rng, pool) {
    const n = ids.length;
    const crim = [killerId, accId];
    const inn = ids.filter((id) => !crim.includes(id));
    const pro = {}, hab = {};
    ids.forEach((id, i) => { pro[id] = profs[i].tags.slice(); hab[id] = []; });
    const tagsOf = (id) => uniq(pro[id].concat(hab[id]));
    const holders = (t) => ids.filter((id) => tagsOf(id).includes(t));
    const isHab = (t) => pool.includes(t);
    const room = (id) => HABITS - hab[id].length;
    const cap = maxHolders(n);

    // 1. Улика от профессии для каждого преступника: метка, которую профессия даёт не больше чем троим.
    const proOk = (c) => pro[c].filter((t) => holders(t).length <= cap);
    const pk = proOk(killerId), pa = proOk(accId);
    if (!pk.length || !pa.length) return null;
    const shared = pk.filter((t) => pa.includes(t));
    const proChosen = shared.length && rng.chance(0.4) ? [rng.pick(shared)] : uniq([rng.pick(pk), rng.pick(pa)]);
    // 2. Остальные улики из примет дела.
    const chosen = proChosen.concat(rng.sample(pool.filter((t) => !ids.some((id) => pro[id].includes(t))), CLUE_COUNT - proChosen.length));
    if (chosen.length < CLUE_COUNT) return null;
    const m = (id) => chosen.filter((t) => tagsOf(id).includes(t)).length;
    if (crim.some((c) => m(c) > 3) || ids.some((id) => m(id) >= CLUE_COUNT)) return null;

    // 3. Кому из преступников какие улики: по три каждому, вместе все четыре. Недостающее даём приметами.
    const options = [];
    for (const xk of chosen) for (const xa of chosen) {
      if (xk === xa) continue;
      const K = chosen.filter((t) => t !== xk), A = chosen.filter((t) => t !== xa);
      if (pro[killerId].includes(xk) || pro[accId].includes(xa)) continue;
      const needK = K.filter((t) => !pro[killerId].includes(t)), needA = A.filter((t) => !pro[accId].includes(t));
      if (needK.length > HABITS || needA.length > HABITS || !needK.every(isHab) || !needA.every(isHab)) continue;
      options.push({ needK, needA });
    }
    if (!options.length) return null;
    const pickO = rng.pick(options);
    hab[killerId].push(...pickO.needK); hab[accId].push(...pickO.needA);
    if (chosen.some((t) => holders(t).length > cap)) return null;

    // 4. Двойники: невиновные, которым тоже подходят три улики. Тогда «три совпадения» ещё не приговор.
    const decoyN = n >= 8 ? 2 : 1;
    const canDecoy = (id) => {
      const missing = chosen.filter((t) => !tagsOf(id).includes(t));
      const need = 3 - m(id);
      return need <= 0 || (need <= room(id) && missing.filter((t) => isHab(t) && holders(t).length < cap).length >= need);
    };
    const decoys = rng.shuffle(inn.filter(canDecoy)).sort((a, b) => m(b) - m(a)).slice(0, decoyN);
    if (decoys.length < decoyN) return null;
    for (const d of decoys) {
      for (const t of rng.shuffle(chosen.slice())) {
        if (m(d) >= 3) break;
        if (!tagsOf(d).includes(t) && isHab(t) && holders(t).length < cap && room(d) > 0) hab[d].push(t);
      }
      if (m(d) !== 3) return null;
    }
    // 5. У каждой улики должен быть хотя бы один невиновный.
    for (const t of chosen) {
      if (holders(t).some((id) => inn.includes(id))) continue;
      if (holders(t).length >= cap || !isHab(t)) return null;
      const free = inn.filter((id) => !decoys.includes(id) && m(id) <= 1 && room(id) > 0 && !tagsOf(id).includes(t));
      if (!free.length) return null;
      hab[rng.pick(free)].push(t);
    }
    // 6. Шум: часть остальных невиновных тоже несёт одну примету из улик, чтобы совпадение в особенности само по себе ничего не доказывало.
    for (const id of rng.shuffle(inn.filter((x) => !decoys.includes(x)))) {
      if (room(id) < 1 || m(id) >= 2 || !rng.chance(NOISE)) continue;
      const opts = chosen.filter((t) => isHab(t) && !tagsOf(id).includes(t) && holders(t).length < cap);
      if (opts.length) hab[id].push(rng.pick(opts));
    }
    // 7. Ровно две особенности у всех: добиваем приметами дела, которых нет среди улик, редкие вперёд, чтобы за столом было разнообразно.
    const used = {};
    ids.forEach((id) => hab[id].forEach((t) => { used[t] = (used[t] || 0) + 1; }));
    for (const id of rng.shuffle(ids.slice())) {
      while (hab[id].length < HABITS) {
        const free = pool.filter((t) => !chosen.includes(t) && !tagsOf(id).includes(t));
        if (!free.length) return null;
        const least = Math.min(...free.map((t) => used[t] || 0));
        const t = rng.pick(free.filter((x) => (used[x] || 0) === least));
        hab[id].push(t); used[t] = (used[t] || 0) + 1;
      }
      if (hab[id].length !== HABITS) return null;
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
      if (H.length < 2 || H.length > maxHolders(ids.length)) errors.push(`Улика «${t}» подходит ${H.length} игрокам`);
      if (!H.some((id) => crim.includes(id))) errors.push(`Улика «${t}» не указывает ни на одного преступника`);
      if (H.every((id) => crim.includes(id))) errors.push(`Улика «${t}» без невиновного`);
    });
    crim.forEach((c) => { if (m(c) !== 3) errors.push(`Преступнику подходят ${m(c)} улики из четырёх, а должно три`); });
    if (!chosen.every((t) => crim.some((c) => tagsOf(c).includes(t)))) errors.push('Преступники вместе не закрывают все улики');
    const inn = ids.filter((id) => !crim.includes(id));
    if (inn.some((id) => m(id) >= CLUE_COUNT)) errors.push('Невиновному подходят все улики');
    if (!inn.some((id) => m(id) >= 3)) errors.push('Нет двойника среди невиновных');
    ids.forEach((id) => { const h = habCount(id); if (h !== HABITS) errors.push(`Особенностей ${h}, а должно ${HABITS}`); });
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

    const habits = Content.habitPool(caseData);
    let t = null, profs = null;
    for (let attempt = 0; attempt < 2000 && !t; attempt++) {
      profs = rng.sample(pool, n);
      t = crimId ? tryGang(ids, killerId, crimId, profs, rng, habits) : tryTags(ids, killerId, null, profs, rng, habits);
    }
    if (!t) throw new Error('Не удалось собрать дело: слишком мало разных профессий.');

    // Улики
    const clues = rng.shuffle(t.chosen).map((tag, i) => ({
      id: `c${i + 1}`, tag, text: rng.pick(Content.clueTexts(caseData, tag)), planted: false,
      fits: ids.filter((id) => t.tagsOf(id).includes(tag)),
    }));

    // Алиби и секреты
    const others = ids.filter((id) => id !== killerId);
    const shuffled = rng.shuffle(others);
    const pairCount = n >= 8 ? 2 : n >= 6 ? 1 : 0;
    const real = {}, claim = {}, secret = {};
    const secretDeck = rng.shuffle(Content.caseList(caseData, 'secrets', Content.SECRET_PLAIN, n));
    const nextSecret = () => secretDeck.length ? secretDeck.shift() : rng.pick(Content.SECRET_PLAIN);
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
        secret[id] = { kind: 'plain', text: nextSecret() };
      }
    }
    real[killerId] = scene; claim[killerId] = null;
    secret[killerId] = { kind: 'plain', text: nextSecret() };

    const murder = toMin(caseData.time);
    const window = () => ({ from: fmt(murder - rng.range(15, 40)), to: fmt(murder + rng.range(10, 30)) });

    const relations = rng.shuffle(Content.caseList(caseData, 'relations', Content.RELATIONS, n));
    const motives = rng.shuffle(Content.caseList(caseData, 'motives', Content.MOTIVES, n));

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
    const base = rng.shuffle(['warrant', 'warrant', 'warrant', 'advocate', 'advocate', 'advocate', 'confront', 'confront', 'confront', 'testimony', 'testimony', 'testimony']);
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
