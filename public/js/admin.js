/* Админка: тестовые комнаты с ботами, комнаты, редактор дел, массовая симуляция. */
(function () {
  const { esc, icon, setHtml, toast, fail } = UI;
  const Content = UI.Content, Cases = window.DetectiveCases, Gen = window.DetectiveGenerator;
  const Screens = (window.Screens = window.Screens || {});
  const TABS = [['test', 'Тестовая комната'], ['rooms', 'Комнаты'], ['cases', 'Дела'], ['sim', 'Симуляция'], ['players', 'Игроки']];
  const ICON_NAMES = { mansion: 'Особняк', train: 'Поезд', corporate: 'Бокал', yacht: 'Якорь', theatre: 'Театр', hotel: 'Отель', generic: 'Лупа', museum: 'Музей', lighthouse: 'Маяк', mountain: 'Горы', casino: 'Казино', film: 'Кино', clinic: 'Клиника', book: 'Книга', circus: 'Цирк', airship: 'Дирижабль', pyramid: 'Пирамида', radio: 'Радио', wine: 'Вино', bank: 'Банк', spa: 'Санаторий', steamboat: 'Пароход', chess: 'Шахматы' };
  const SPEEDS = [[1, 'Обычная'], [0.5, '×2'], [0.25, '×4'], [0.1, '×10'], [0.05, '×20']];
  const ROLES = [['random', 'Случайная'], ['killer', 'Убийца'], ['innocent', 'Невиновный'], ['accomplice', 'Сообщник']];
  const PHASES = { brief: 'вводная', reveal: 'улика', discuss: 'обсуждение', poll: 'голосование', defense: 'очная ставка', final: 'финал', verdict: 'приговор', accomplice: 'сообщник', ended: 'закончена' };

  Screens.admin = {
    mount(root) {
      this.tab = 'test'; this.auth = null; this.cases = []; this.edit = null; this.rooms = []; this.simOut = null;
      this.testOpts = { name: 'Админ', bots: 6, caseId: 'random', role: 'random', speed: 1, autostart: true, auto: false, mode: 'host', hints: 'normal' };
      root.innerHTML = '<div class="wrap admin" id="adm"></div>';
      this.root = root.firstElementChild;
      this.root.addEventListener('click', (e) => this.onClick(e));
      this.root.addEventListener('change', (e) => this.onChange(e));
      this.root.addEventListener('submit', (e) => { e.preventDefault(); if (e.target.id === 'loginForm') this.login(); });
      this.poll = setInterval(() => { if (this.auth && this.tab === 'rooms') this.loadRooms(); }, 3000);
      this.check();
    },
    unmount() { clearInterval(this.poll); },
    update(st) { this.st = st; if (this.auth) this.renderHead(); },

    async check() {
      const key = Net.mode === 'demo' ? '' : (sessionStorage.getItem('detective.adminKey') || '');
      if (Net.mode === 'demo' || key) {
        const a = await Net.call('admin:auth', { key });
        if (a.ok) return this.enter();
      }
      this.auth = false; this.renderLogin();
    },
    async login(key) {
      const input = this.root.querySelector('#keyIn');
      const val = key != null ? key : (input ? input.value : '');
      const a = await Net.call('admin:auth', { key: val });
      if (!a.ok) { if (input) { input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); } return fail(a); }
      try { sessionStorage.setItem('detective.adminKey', val); } catch (e) { /* ничего */ }
      this.enter();
    },
    async enter() {
      this.auth = true;
      const r = await Net.call('admin:cases');
      if (r.ok) this.cases = r.cases;
      this.render();
    },
    renderLogin() {
      this.root.innerHTML = `<div class="center-note"><p class="eyebrow">Для своих</p><h2>Админка</h2><p class="muted" style="max-width:44ch">Здесь собирают тестовые партии с ботами, правят дела и гоняют симуляции. Пароль задаётся переменной ADMIN_KEY при запуске сервера. Если её не задали, пароль напечатан в консоли сервера.</p>
        <form id="loginForm" style="display:grid;gap:10px;width:min(340px,100%)"><input class="input" id="keyIn" type="password" placeholder="Пароль" autocomplete="current-password" aria-label="Пароль"><button class="btn btn-primary" type="submit">Войти</button></form></div>`;
      const i = this.root.querySelector('#keyIn'); if (i) i.focus();
    },

    /* ---------- Каркас ---------- */
    render() {
      this.root.innerHTML = `<div id="aHead"></div><div class="tabs" id="aTabs" role="tablist"></div><div id="aBody"></div>`;
      this.renderHead(); this.renderTabs(); this.renderBody();
    },
    renderHead() {
      const st = this.st;
      setHtml(this.root.querySelector('#aHead'), `<div class="admin-head"><div><p class="eyebrow">Для тестов</p><h1>Админка</h1></div>
        ${st ? `<div class="resume" style="margin:0"><span>Вы в комнате <b class="mono">${esc(st.code)}</b>${st.test ? ' (тест)' : ''}</span><button class="btn btn-sm btn-primary" data-a="back">Вернуться</button></div>` : ''}</div>`);
    },
    renderTabs() {
      setHtml(this.root.querySelector('#aTabs'), TABS.map(([k, t]) => `<button role="tab" data-a="tab" data-tab="${k}" class="${this.tab === k ? 'on' : ''}" aria-selected="${this.tab === k}">${t}</button>`).join(''));
    },
    renderBody() {
      const body = this.root.querySelector('#aBody');
      body._html = null;
      if (this.tab === 'test') body.innerHTML = this.testHtml();
      else if (this.tab === 'rooms') { body.innerHTML = '<div class="panel"><p class="empty-note">Загружаем…</p></div>'; this.loadRooms(); }
      else if (this.tab === 'cases') body.innerHTML = this.casesHtml();
      else if (this.tab === 'players') body.innerHTML = this.playersHtml();
      else body.innerHTML = this.simHtml();
    },

    /* ---------- Игроки: сброс пароля для входа по почте ---------- */
    playersHtml() {
      return `<section class="panel" style="max-width:640px"><div class="panel-head"><h2>Сброс пароля</h2></div>
        <p class="muted">Писем сайт не отправляет. Если игрок забыл пароль, впишите его почту: сайт выдаст временный пароль, а все старые входы этого игрока закроются. Передайте пароль игроку лично, пусть сменит его в личном кабинете.</p>
        <div class="row2" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px"><input class="input" id="rpMail" type="email" placeholder="почта игрока" aria-label="Почта игрока"><button class="btn btn-primary" data-a="reset-pass">Сбросить</button></div>
        <div id="rpOut" style="margin-top:14px"></div></section>`;
    },

    /* ---------- Тестовая комната ---------- */
    testHtml() {
      const o = this.testOpts;
      const caseOpts = ['<option value="random">Случайное дело</option>'].concat(this.cases.filter((c) => c.enabled !== false).map((c) => `<option value="${esc(c.id)}" ${o.caseId === c.id ? 'selected' : ''}>${esc(c.title)}</option>`)).join('');
      const total = o.bots + 1;
      return `<div class="admin-grid"><section class="panel"><div class="panel-head"><h2>Новая тестовая комната</h2></div>
        <div class="form-grid">
          <div class="row2"><div class="field"><label for="tName">Ваше имя</label><input class="input" id="tName" data-k="name" value="${esc(o.name)}" maxlength="18"></div>
            <div class="field"><label for="tCase">Дело</label><select class="input" id="tCase" data-k="caseId">${caseOpts}</select></div></div>
          <div class="field"><label for="tBots">Ботов: ${o.bots} (всего игроков ${total}${total >= 6 ? ", убийца и сообщник" : ""})</label><input type="range" id="tBots" data-k="bots" min="3" max="9" value="${o.bots}"></div>
          <div class="field"><label>Ваша роль</label><div class="seg" role="group" style="flex-wrap:wrap">${ROLES.map(([k, t]) => `<button type="button" data-a="set" data-k="role" data-v="${k}" class="${o.role === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
          <div class="field"><label>Как идёт партия</label><div class="seg" role="group">${[['host', 'Ведущий (вы)'], ['timers', 'Таймеры']].map(([k, t]) => `<button type="button" data-a="set" data-k="mode" data-v="${k}" class="${o.mode === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
          <div class="field"><label>Режим</label><div class="seg" role="group">${[['normal', 'Обычный'], ['light', 'Лайт']].map(([k, t]) => `<button type="button" data-a="set" data-k="hints" data-v="${k}" class="${(o.hints || 'normal') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
          <div class="field"><label for="tSpeed">Скорость времени</label><select class="input" id="tSpeed" data-k="speed">${SPEEDS.map(([v, t]) => `<option value="${v}" ${o.speed === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          ${o.role === 'accomplice' && total < 6 ? '<p class="note" style="border-color:var(--amber);background:rgba(233,162,59,.1)">Сообщник появляется при шести игроках и больше. Добавьте ботов, иначе роль выпадет случайной.</p>' : ''}
          <div class="row2"><label class="switch"><input type="checkbox" data-k="autostart" ${o.autostart ? 'checked' : ''}><span></span>Сразу начать партию</label>
            <label class="switch"><input type="checkbox" data-k="auto" ${o.auto ? 'checked' : ''}><span></span>Автопилот за меня</label></div>
          <button class="btn btn-primary" data-a="create-test">Создать и войти</button>
        </div></section>
        <section class="panel"><div class="panel-head"><h2>Что есть в партии</h2></div>
          <ul class="facts"><li><span class="ico">⏸</span><span><b>Пульт теста</b> слева внизу: пауза, пропуск фазы, скорость, автопилот, перезапуск с тем же сидом, новое дело.</span></li>
            <li><span class="ico">👁</span><span><b>Режим бога.</b> Роли, карточки, карты и улики всех игроков, сид партии.</span></li>
            <li><span class="ico">↔</span><span><b>Играть за любого.</b> Переключайтесь между игроками и проверяйте рассказы, голосования и карты с обеих сторон.</span></li>
            <li><span class="ico">⚡</span><span><b>Скорость ×20</b> проходит партию за пару минут. Подойдёт, чтобы проверить финал и экран «Дело закрыто».</span></li></ul></section></div>`;
    },
    async createTest() {
      const o = this.testOpts;
      const r = await Net.call('admin:test', { name: o.name, bots: o.bots, caseId: o.caseId, speed: o.speed, role: o.role, autostart: o.autostart, mode: o.mode, hints: o.hints });
      if (!r.ok) return fail(r);
      if (o.auto) await Net.call('admin:room', { code: r.code, action: 'auto' });
      location.hash = `#/room/${r.code}`;
    },

    /* ---------- Комнаты ---------- */
    async loadRooms() {
      const r = await Net.call('admin:rooms');
      if (!r.ok) return;
      this.rooms = r.rooms;
      if (this.tab !== 'rooms') return;
      this.renderRooms();
    },
    renderRooms() {
      const body = this.root.querySelector('#aBody');
      const list = this.rooms.map((rm) => `<div class="room-card">
        <div class="head"><span class="code">${esc(rm.code)}</span>
          <span class="badge ${rm.status === 'playing' ? 'yellow' : ''}">${rm.status === 'playing' ? `${PHASES[rm.phase] || rm.phase}${rm.round ? ` · раунд ${rm.round}` : ''}` : 'лобби'}</span>
          ${rm.test ? '<span class="badge blue">тест</span>' : ''}${rm.paused ? '<span class="badge red">пауза</span>' : ''}
          <span class="muted">${esc(rm.caseTitle || (rm.caseChoice === 'random' ? 'случайное дело' : rm.caseChoice))}</span></div>
        <div class="chips">${rm.players.map((p) => `<span class="chip ${p.host ? 'hit' : ''}">${esc(p.name)}${p.isBot ? ' · бот' : ''}${!p.connected && !p.isBot ? ' · нет связи' : ''}</span>`).join('')}</div>
        <div class="acts">
          ${rm.status === 'lobby' ? `<button class="btn btn-sm" data-a="room" data-c="${rm.code}" data-v="bot">+ Бот</button><button class="btn btn-sm" data-a="room" data-c="${rm.code}" data-v="ready">Все готовы</button><button class="btn btn-sm" data-a="room" data-c="${rm.code}" data-v="start">Старт</button>`
            : `<button class="btn btn-sm" data-a="room" data-c="${rm.code}" data-v="${rm.paused ? 'resume' : 'pause'}">${rm.paused ? 'Продолжить' : 'Пауза'}</button><button class="btn btn-sm" data-a="room" data-c="${rm.code}" data-v="skip">Пропустить фазу</button><button class="btn btn-sm" data-a="room" data-c="${rm.code}" data-v="lobby">В лобби</button>`}
          <select class="input" style="width:auto;padding:7px 30px 7px 10px;font-size:13px" data-a="roomspeed" data-c="${rm.code}" aria-label="Скорость">${SPEEDS.map(([v, t]) => `<option value="${v}" ${Math.abs(rm.speed - v) < 0.001 ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <button class="btn btn-sm btn-red" data-a="close" data-c="${rm.code}">Закрыть</button></div></div>`).join('');
      setHtml(body, `<div class="panel"><div class="panel-head"><h2>Комнаты на сервере</h2><span class="count">${this.rooms.length} · обновляется само</span></div>
        <div class="case-list">${list || '<p class="empty-note">Комнат нет. Создайте тестовую или откройте обычную на главной.</p>'}</div></div>`);
    },

    /* ---------- Дела ---------- */
    blankCase() { return { id: '', title: '', short: '', icon: 'generic', year: '', difficulty: 2, victim: '', time: '23:00', teaser: '', locations: [], scene: '', professions: [], enabled: true }; },
    casesHtml() {
      const list = this.cases.map((c) => `<button class="case-li ${this.edit === c.id ? 'sel' : ''} ${c.enabled === false ? 'off' : ''}" data-a="edit" data-id="${esc(c.id)}">${icon(c.icon)}<span><h3>${esc(c.title)}</h3><small>${esc(c.victim)} · ${c.enabled === false ? 'выключено' : 'в архиве'}</small></span></button>`).join('');
      const c = this.edit === '__new' ? this.blankCase() : this.cases.find((x) => x.id === this.edit);
      return `<div class="admin-grid"><section class="panel"><div class="panel-head"><h2>Архив дел</h2><button class="btn btn-sm btn-primary" data-a="new-case">Новое дело</button></div><div class="case-list">${list}</div></section>
        <section class="panel" id="caseEd">${c ? this.editorHtml(c) : '<p class="empty-note">Выберите дело слева или создайте новое.</p>'}</section></div>`;
    },
    editorHtml(c) {
      const isNew = this.edit === '__new';
      const tags = Content.TAG_KEYS.map((k) => `<span class="chip" title="${esc(Content.TAGS[k].label)}"><b class="mono" style="font-size:11px">${k}</b> ${esc(Content.TAGS[k].label)}</span>`).join('');
      return `<div class="panel-head"><h2>${isNew ? 'Новое дело' : 'Редактор дела'}</h2><label class="switch"><input type="checkbox" id="cEnabled" ${c.enabled !== false ? 'checked' : ''}><span></span>В архиве</label></div>
        <div class="form-grid">
          <div class="row2"><div class="field"><label for="cTitle">Название</label><input class="input" id="cTitle" value="${esc(c.title)}" maxlength="80"></div>
            <div class="field"><label for="cShort">Коротко</label><input class="input" id="cShort" value="${esc(c.short)}" maxlength="24"></div></div>
          <div class="field"><label>Значок</label><div class="icon-pick" id="cIcon">${Cases.ICONS.map((i) => `<button type="button" data-a="icon" data-v="${i}" class="${i === (c.icon || 'generic') ? 'on' : ''}" title="${ICON_NAMES[i]}" aria-label="${ICON_NAMES[i]}">${icon(i)}</button>`).join('')}</div></div>
          <div class="row3"><div class="field"><label for="cYear">Год</label><input class="input" id="cYear" value="${esc(c.year)}" maxlength="12"></div>
            <div class="field"><label for="cTime">Время смерти</label><input class="input" id="cTime" value="${esc(c.time)}" maxlength="5" placeholder="23:40"></div>
            <div class="field"><label for="cDiff">Сложность</label><select class="input" id="cDiff">${[1, 2, 3].map((d) => `<option value="${d}" ${Number(c.difficulty) === d ? 'selected' : ''}>${['Лёгкая', 'Средняя', 'Сложная'][d - 1]}</option>`).join('')}</select></div></div>
          <div class="field"><label for="cVictim">Жертва</label><input class="input" id="cVictim" value="${esc(c.victim)}" maxlength="120" placeholder="Лорд Эдмунд Грейвз, хозяин дома"></div>
          <div class="field"><label for="cTeaser">Вводная</label><textarea class="input" id="cTeaser" rows="3" maxlength="400">${esc(c.teaser)}</textarea></div>
          <div class="row2"><div class="field"><label for="cLocs">Места, по одному в строке</label><textarea class="input" id="cLocs" rows="7">${esc((c.locations || []).join('\n'))}</textarea></div>
            <div class="field"><label for="cScene">Место преступления</label><input class="input" id="cScene" value="${esc(c.scene)}" maxlength="40"><p class="hint" style="margin-top:6px">Должно быть одним из мест слева.</p></div></div>
          <div class="field"><label for="cProf">Профессии: «Название | тег, тег» по строке</label><textarea class="input mono" id="cProf" rows="10" style="font-size:13.5px">${esc(Cases.professionsToText(c.professions))}</textarea></div>
          <details><summary class="label" style="cursor:pointer">Какие бывают теги улик</summary><div class="chips" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">${tags}</div></details>
          <div id="caseCheck"></div>
          <div class="row-acts"><button class="btn btn-primary" data-a="save-case">Сохранить</button><button class="btn" data-a="check-case">Проверить улики</button>${isNew ? '' : '<button class="btn btn-red" data-a="del-case">Удалить</button>'}</div>
        </div>`;
    },
    readCase() {
      const v = (id) => this.root.querySelector(id).value;
      const orig = this.edit === '__new' ? {} : (this.cases.find((x) => x.id === this.edit) || {});
      return {
        id: orig.id || '', title: v('#cTitle'), short: v('#cShort'), icon: (this.root.querySelector('#cIcon .on') || {}).dataset?.v || 'generic', year: v('#cYear'), difficulty: Number(v('#cDiff')),
        victim: v('#cVictim'), time: v('#cTime'), teaser: v('#cTeaser'), locations: v('#cLocs'), scene: v('#cScene'), professions: v('#cProf'), enabled: this.root.querySelector('#cEnabled').checked,
      };
    },
    async saveCase() {
      const r = await Net.call('admin:case:save', { data: this.readCase() });
      if (!r.ok) return fail(r);
      this.cases = r.cases; this.edit = r.case.id;
      toast('Дело сохранено.');
      this.root.querySelector('#aBody').innerHTML = this.casesHtml();
    },
    checkCase() {
      const out = this.root.querySelector('#caseCheck');
      let c;
      try { c = Cases.validateCase(this.readCase(), this.cases.map((x) => x.id)); } catch (e) { out.innerHTML = `<div class="note" style="border-color:var(--red);background:var(--red-dim)">${esc(e.message)}</div>`; return; }
      const { Rng } = window.DetectiveRng;
      const sizes = [6, 7, 8, 9, 10]; let bad = 0, total = 0; const msgs = new Set();
      sizes.forEach((n) => {
        for (let s = 1; s <= 60; s++) {
          total++;
          const ids = Array.from({ length: n }, (_, i) => `p${i}`);
          const rng = new Rng(s * 977 + n);
          const killerId = ids[s % n], accompliceId = n >= 6 ? ids[(s + 1) % n] : null;
          try {
            const gen = Gen.generate({ caseData: c, ids, killerId, accompliceId, rng });
            const errs = Gen.verify(gen, ids, killerId);
            if (errs.length) { bad++; errs.forEach((e) => msgs.add(e)); }
          } catch (e) { bad++; msgs.add(e.message); }
        }
      });
      out.innerHTML = bad ? `<div class="note" style="border-color:var(--red);background:var(--red-dim)">Проблемы в ${bad} из ${total} раскладов: ${esc(Array.from(msgs).slice(0, 3).join('; '))}. Добавьте профессий с разными тегами.</div>`
        : `<div class="note" style="border-color:var(--green);background:rgba(155,176,105,.12)">${total} раскладов для 6–10 игроков, и в каждом улики решаемы: оба преступника вычисляются по уликам, и у каждой улики есть невиновный.</div>`;
    },

    /* ---------- Симуляция ---------- */
    simHtml() {
      const caseOpts = ['<option value="all">Все включённые дела</option>'].concat(this.cases.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`)).join('');
      const s = this.simOut;
      return `<div class="admin-grid"><section class="panel"><div class="panel-head"><h2>Массовая симуляция</h2></div>
        <p class="muted" style="margin-bottom:14px">Боты играют партии на полной скорости. Движок проверяет правила и фиксирует нарушения: так видно, ломает ли что-то новое дело или правка.</p>
        <div class="form-grid"><div class="row3"><div class="field"><label for="sGames">Партий</label><input class="input" id="sGames" type="number" min="1" max="300" value="60"></div>
          <div class="field"><label for="sPl">Игроков</label><input class="input" id="sPl" type="number" min="4" max="10" value="8"></div>
          <div class="field"><label for="sCase">Дело</label><select class="input" id="sCase">${caseOpts}</select></div></div>
          <button class="btn btn-primary" data-a="run-sim">Запустить</button></div></section>
        <section class="panel" id="simOut"><div class="panel-head"><h2>Результат</h2></div>${s ? this.simResult(s) : '<p class="empty-note">Пока не запускали.</p>'}</section></div>`;
    },
    simResult(s) {
      const pct = s.games ? Math.round((s.innocentWins / s.games) * 100) : 0;
      const reasons = Object.entries(s.byRound).map(([k, v]) => `<span class="chip">${esc(k)}: ${v}</span>`).join('');
      return `<div class="sim-out"><div class="m"><span class="label">Партий</span><b>${s.games}</b></div><div class="m"><span class="label">Победы невиновных</span><b>${pct}%</b></div>
        <div class="m"><span class="label">Средняя длина</span><b>${s.avgMinutes.toFixed(1)} мин</b></div><div class="m"><span class="label">Исключено невиновных</span><b>${s.innocentKicks}</b></div><div class="m ${s.violations ? 'bad' : ''}"><span class="label">Нарушения правил</span><b>${s.violations}</b></div></div>
        <div class="chips" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:12px">${reasons}</div>
        ${s.errors.length ? `<div class="note" style="margin-top:12px;border-color:var(--red);background:var(--red-dim)">${s.errors.map((e) => esc(e)).join('<br>')}</div>` : ''}`;
    },
    async runSim() {
      const g = (id) => this.root.querySelector(id);
      const btn = this.root.querySelector('[data-a="run-sim"]');
      btn.disabled = true; btn.textContent = 'Играем…';
      await new Promise((r) => setTimeout(r, 30));
      const r = await Net.call('admin:sim', { games: Number(g('#sGames').value), players: Number(g('#sPl').value), caseId: g('#sCase').value });
      btn.disabled = false; btn.textContent = 'Запустить';
      if (!r.ok) return fail(r);
      this.simOut = r.sim;
      g('#simOut').innerHTML = `<div class="panel-head"><h2>Результат</h2></div>${this.simResult(r.sim)}`;
    },

    /* ---------- События ---------- */
    onChange(e) {
      const t = e.target;
      if (this.tab === 'test' && t.dataset.k) {
        const k = t.dataset.k; let v = t.type === 'checkbox' ? t.checked : t.value;
        if (k === 'bots') v = Number(v); if (k === 'speed') v = Number(v);
        this.testOpts[k] = v;
        if (k === 'bots') { const keep = this.root.querySelector('#aBody'); keep.innerHTML = this.testHtml(); }
      }
      if (t.dataset.a === 'roomspeed') Net.call('admin:room', { code: t.dataset.c, action: 'speed', value: Number(t.value) }).then((r) => { if (!r.ok) fail(r); else this.loadRooms(); });
    },
    async onClick(e) {
      const b = e.target.closest('[data-a]');
      if (!b || b.tagName === 'SELECT' || b.disabled) return;
      const a = b.dataset.a;
      if (a === 'tab') { this.tab = b.dataset.tab; this.renderTabs(); this.renderBody(); }
      else if (a === 'back') location.hash = `#/room/${this.st.code}`;
      else if (a === 'set') { this.testOpts[b.dataset.k] = b.dataset.v; this.root.querySelector('#aBody').innerHTML = this.testHtml(); }
      else if (a === 'create-test') this.createTest();
      else if (a === 'reset-pass') {
        const mail = this.root.querySelector('#rpMail').value.trim();
        if (!mail) return;
        if (!(await UI.confirmBox({ title: 'Сбросить пароль?', sub: `Старый пароль ${mail} перестанет работать.`, ok: 'Сбросить', danger: true }))) return;
        const r = await Net.call('admin:reset_password', { email: mail });
        const out = this.root.querySelector('#rpOut');
        if (!r.ok) { fail(r); out.innerHTML = ''; return; }
        out.innerHTML = `<div class="resume" style="margin:0"><span>${esc(r.name)} (${esc(r.email)}). Временный пароль: <b class="mono">${esc(r.password)}</b></span><button class="btn btn-sm" data-a="copy-pass">Скопировать</button></div>`;
        this.tempPass = r.password;
      } else if (a === 'copy-pass') UI.copyText(this.tempPass, 'Пароль скопирован');
      else if (a === 'room') { const r = await Net.call('admin:room', { code: b.dataset.c, action: b.dataset.v }); if (!r.ok) fail(r); else { this.rooms = r.rooms || this.rooms; this.loadRooms(); } }
      else if (a === 'close') { if (await UI.confirmBox({ title: `Закрыть комнату ${b.dataset.c}?`, sub: 'Игроков выкинет в главное меню, партия пропадёт.', ok: 'Закрыть', danger: true })) { const r = await Net.call('admin:room', { code: b.dataset.c, action: 'close' }); if (!r.ok) fail(r); else this.loadRooms(); } }
      else if (a === 'edit') { this.edit = b.dataset.id; this.root.querySelector('#aBody').innerHTML = this.casesHtml(); }
      else if (a === 'new-case') { this.edit = '__new'; this.root.querySelector('#aBody').innerHTML = this.casesHtml(); const i = this.root.querySelector('#cTitle'); if (i) i.focus(); }
      else if (a === 'icon') { this.root.querySelectorAll('#cIcon button').forEach((x) => x.classList.toggle('on', x === b)); }
      else if (a === 'save-case') this.saveCase();
      else if (a === 'check-case') this.checkCase();
      else if (a === 'del-case') {
        if (await UI.confirmBox({ title: 'Удалить дело?', sub: 'Вернуть его потом не получится.', ok: 'Удалить', danger: true })) {
          const r = await Net.call('admin:case:delete', { id: this.edit });
          if (!r.ok) return fail(r);
          this.cases = r.cases; this.edit = null; toast('Дело удалено.'); this.root.querySelector('#aBody').innerHTML = this.casesHtml();
        }
      } else if (a === 'run-sim') this.runSim();
    },
  };
})();
