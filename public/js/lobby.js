/* Лобби v2: сначала голосовая связь и ведущий, потом люди и дело. Без стола. */
(function () {
  const { esc, icon, avatar, toast, fail, setHtml } = UI;
  const Screens = (window.Screens = window.Screens || {});

  const roomLink = (code) => (Net.mode === 'server' ? `${location.origin}/r/${code}` : `${location.href.split('#')[0]}#/room/${code}`);
  const seg = (a, opts, cur, can) => `<div class="seg" role="group">${opts.map(([v, t]) => `<button data-a="${a}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" ${can ? '' : 'disabled'}>${t}</button>`).join('')}</div>`;

  // Строка «Дело» под паками: случайное или выбранное ведущим.
  const caseRow = (st, isHost) => {
    const c = st.caseChoice !== 'random' && (st.cases || []).find((x) => x.id === st.caseChoice);
    const what = c ? `<b>${esc(c.title)}</b>` : `<b>${L('случайное')}</b>`;
    const hint = c ? L('Выбрано ведущим на эту партию.') : L('Выпадет дело, которое вы играли реже всего.');
    return `<div class="set-row"><div><div class="label">${L('Дело: {0}', what)}</div><p class="hint" style="margin:4px 0 0">${L('{0} Карточки в каждой партии раздаются заново.', hint)}</p></div>
      ${isHost ? `<button class="btn btn-sm" data-a="case">${c ? L('Изменить') : L('Выбрать дело')}</button>` : ''}</div>`;
  };
  const pickCase = (st, o) => UI.pickCase(st, o);

  Screens.lobby = {
    mount(root) {
      this.seen = new Set();
      root.innerHTML = `<div class="wrap lobby">
        <div class="lobby-head" id="lHead"></div>
        <div class="lobby-grid">
          <div style="display:grid;gap:18px;min-width:0">
            <section class="panel" id="lRoster" aria-label="${L('Игроки')}"></section>
          </div>
          <div style="display:grid;gap:18px;min-width:0">
            <section class="panel" id="lCases" aria-label="${L('Дело')}"></section>
            <section class="panel" id="lSet" aria-label="${L('Как играем')}"></section>
          </div>
        </div>
        <div class="startbar" id="lBar"></div>
      </div>`;
      const call = async (event, payload) => { const r = await Net.call(event, payload); if (!r.ok) fail(r); return r; };
      // Слушатель вешается на сам экран, а не на общий корень: корень живёт между экранами, и обработчики копились бы с каждым лобби.
      root.firstElementChild.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-a]');
        if (!b || b.disabled) return;
        const st = this.st; const a = b.dataset.a;
        if (a === 'link') UI.copyText(roomLink(st.code), L('Ссылка скопирована. Отправьте её напарникам.'));
        else if (a === 'code') UI.copyText(st.code, L('Код скопирован'));
        else if (a === 'pack') call('room:pack', { packId: b.dataset.id });
        else if (a === 'case') {
          const id = await pickCase(st, { title: L('Какое дело открыть'), sub: L('Выбор действует на одну партию. Потом дело снова выбирается случайно.') });
          if (id) call('room:case', { caseId: id });
        }
        else if (a === 'discuss' || a === 'turn') call('room:setting', { key: a, value: Number(b.dataset.v) });
        else if (a === 'mode') call('room:setting', { key: 'mode', value: b.dataset.v });
        else if (a === 'hints') call('room:setting', { key: 'hints', value: b.dataset.v });
        else if (a === 'table') call('room:setting', { key: 'table', value: b.dataset.v });
        else if (a === 'lang') call('room:setting', { key: 'lang', value: b.dataset.v });
        else if (a === 'ready') call('room:ready');
        else if (a === 'seat') call('room:seat');
        else if (a === 'start') call('room:start');
        else if (a === 'leave') call('room:leave');
        else if (a === 'close') { const ok = await UI.confirmBox({ title: L('Закрыть комнату?'), sub: L('Все игроки выйдут из комнаты, код перестанет работать.'), ok: L('Закрыть комнату'), danger: true }); if (ok) call('room:close'); }
        else if (a === 'kick') call('room:kick', { playerId: b.dataset.id });
        else if (a === 'host') call('room:host', { playerId: b.dataset.id });
        else if (a === 'rename') {
          const v = await UI.ask({ title: L('Как вас называть?'), placeholder: L('Имя'), ok: L('Сохранить'), max: 18 });
          if (v) { const r = await App.saveProfile({ name: v }); if (!r.ok) toast(r.error || L('Не получилось сохранить.'), 'err'); }
        } else if (a === 'admin') call('admin:room', { code: st.code, action: b.dataset.v });
      });
    },
    update(st) {
      this.st = st;
      const root = document.getElementById('app');
      const isHost = st.hostId === st.realMeId;
      const me = st.players.find((p) => p.id === st.realMeId) || {};
      const n = st.players.length;
      const need = st.rules.min;
      const hostP = st.players.find((p) => p.id === st.hostId) || {};

      setHtml(root.querySelector('#lHead'), `
        <div><p class="eyebrow">${L('Комната{0}', st.test ? L(' · тестовая') : '')}</p><h1>${L('Собираем <em style="color:var(--amber-hi)">детективов</em>')}</h1></div>
        <div class="code-plate">
          <div class="code-tiles" aria-label="${L('Код комнаты {0}', esc(st.code))}">${st.code.split('').map((c) => `<span>${esc(c)}</span>`).join('')}</div>
          <div style="display:grid;gap:6px"><button class="btn btn-sm" data-a="link">${L('Скопировать ссылку')}</button><button class="btn btn-sm btn-ghost" data-a="code">${L('Скопировать код')}</button></div>
        </div>`);

      this.seen = this.seen || new Set();
      const rows = st.players.map((p) => { const fresh = !this.seen.has(p.id); this.seen.add(p.id); return `
        <div class="row-p ${p.id === st.realMeId ? 'me' : ''} ${fresh && this.seen.size > 1 ? 'enter' : ''}">
          ${avatar(p.name, p.seat, '', null, p.photo)}
          <div style="min-width:0"><div class="nm">${esc(p.name)}${p.id === st.realMeId ? ` <span class="muted">${L('(вы)')}</span>` : ''}</div>
            ${p.away ? `<div class="muted" style="font-size:12px">${L('отошёл на главную')}</div>` : !p.connected && !p.isBot ? `<div class="muted" style="font-size:12px">${L('нет связи')}</div>` : ''}</div>
          <div class="tags">
            ${p.id === st.hostId ? `<span class="badge yellow">${L('ведущий')}</span>` : p.ready ? `<span class="badge green">${L('готово')}</span>` : `<span class="badge">${L('ждёт')}</span>`}
            ${p.isBot ? `<span class="badge blue">${L('бот')}</span>` : ''}
            ${p.id === st.realMeId && Net.me && Net.me.account ? `<button class="x" data-a="rename" title="${L('Сменить имя')}" aria-label="${L('Сменить имя')}">✎</button>` : ''}
            ${isHost && p.id !== st.hostId && !p.isBot ? `<button class="x" data-a="host" data-id="${esc(p.id)}" title="${L('Передать ведение')}" aria-label="${L('Передать ведение игроку {0}', esc(p.name))}">★</button>` : ''}
            ${isHost && p.id !== st.hostId ? `<button class="x" data-a="kick" data-id="${esc(p.id)}" title="${L('Убрать из комнаты')}" aria-label="${L('Убрать {0}', esc(p.name))}">×</button>` : ''}
          </div>
        </div>`; }).join('');
      const small = !!st.rules.small;
      const empties = Array.from({ length: Math.max(0, need - n) }, () => `<div class="row-p empty"><span class="av" style="background:var(--panel-2);box-shadow:none"></span><span>${L('Свободное место')}</span><span></span></div>`).join('');
      setHtml(root.querySelector('#lRoster'), `
        <div class="panel-head"><h2>${L('Игроки')}</h2><span class="count">${L('{0} из {1} · нужно от {2}', n, st.rules.max, need)}</span></div>
        <div class="roster">${rows}${empties}</div>
        ${small ? `<div class="npc-seats" aria-label="${L('Подозреваемые')}"><div class="label">${L('Подозреваемые')}</div><div class="npc-row">${Array.from({ length: 6 }, () => '<span class="npc-sil" aria-hidden="true"></span>').join('')}</div>
          <p class="hint">${L('Шесть персонажей дела. Кто они, узнаете, когда откроете дело.')}</p></div>` : ''}
        <div class="rules-line">${small
          ? `<span>${L('Преступники:')} <b>${L('убийца и сообщник среди персонажей, задержать нужно обоих раньше, чем двух невиновных')}</b></span><span>${n >= 3 ? L('Один из вас тайно крот и играет за преступников') : L('Вдвоём крота нет, при трёх и больше один из вас тайно крот')}</span>`
          : `<span>${L('Преступники:')} <b>${st.rules.gang ? L('убийца и сообщник, исключить нужно обоих; поровну с невиновными они побеждают') : st.rules.accomplice ? L('убийца и сообщник') : L('убийца')}</b></span><span>${L('Ведущий играет наравне со всеми')}</span>`}</div>`);

      const packOpts = st.packs.map((p) => `
        <button class="case-opt random ${st.pack === p.id ? 'sel' : ''}" data-a="pack" data-id="${esc(p.id)}" ${isHost ? '' : 'disabled'}>
          <span class="ci">${icon(p.icon || 'random')}</span><h3>${esc(p.title)}</h3><small>${p.count} ${window.DetectiveContent.trans(p.count, L('дело'), L('дела'), L('дел'))}. ${esc(p.desc)}</small>
        </button>`).join('');
      setHtml(root.querySelector('#lCases'), `
        <div class="panel-head"><h2>${L('Выбор пака')}</h2><span class="count">${isHost ? L('выбираете вы') : L('выбирает ведущий')}</span></div>
        <div class="case-grid">${packOpts}</div>
        ${caseRow(st, isHost)}`);

      const s = st.settings;
      setHtml(root.querySelector('#lSet'), `
        <div class="panel-head"><h2>${L('Как играем')}</h2><span class="count">${isHost ? L('настраивает ведущий') : L('ведущий: {0}', esc(hostP.name || ''))}</span></div>
        <div class="set-row" style="margin-top:0;padding-top:0;border:0"><div><div class="label">${L('Сколько вас')}</div><p class="hint" style="margin:4px 0 0">${s.table === 'small' ? L('Подозреваемые: шесть персонажей дела. Вы ведёте следствие, но при трёх и больше один из вас тайно крот.') : L('Подозреваемые вы сами: среди вас убийца и сообщник.')}</p></div>
          ${seg('table', [['small', '2–5'], ['full', L('6 и более')]], s.table === 'small' ? 'small' : 'full', isHost)}</div>
        <div class="set-row"><div><div class="label">${L('Язык дел')}</div><p class="hint" style="margin:4px 0 0">${L('На этом языке будут дело, улики и карточки. Кнопки у каждого на языке его сайта.')}</p></div>
          ${seg('lang', [['ru', 'Русский'], ['en', 'English']], st.lang || 'ru', isHost)}</div>
        <div class="set-row"><div><div class="label">${L('Ход партии')}</div><p class="hint" style="margin:4px 0 0">${s.mode === 'host' ? L('Ведущий листает раунды и сам запускает таймер.') : L('Фазы сменяются по таймеру.')}</p></div>
          ${seg('mode', [['host', L('Ведущий')], ['timers', L('Таймеры')]], s.mode, isHost)}</div>
        <div class="set-row"><div><div class="label">${L('Режим')}</div><p class="hint" style="margin:4px 0 0">${s.hints === 'light' ? L('Игра сама подсвечивает, кто подходит под улику.') : L('Совпадения с уликами не подсвечиваются: слушайте и сверяйте сами.')}</p></div>
          ${seg('hints', [['normal', L('Обычный')], ['light', L('Лайт')]], s.hints || 'normal', isHost)}</div>
        <div class="set-row"><div class="label">${s.table === 'small' ? L('Ход каждого') : L('Рассказ каждого')}</div>${seg('turn', st.rules.turnOptions.map((v) => [v, L('{0} с', v)]), s.turn, isHost)}</div>
        <div class="set-row"><div class="label">${L('Обсуждение в раунде')}</div>${seg('discuss', st.rules.talkOptions.map((v) => [v, v >= 120 ? L('{0} мин', v / 60) : L('{0} с', v)]), s.discuss, isHost)}</div>`);

      const cs = st.canStart;
      const admin = st.isAdmin && st.test ? `<button class="btn btn-sm" data-a="admin" data-v="bot" ${n >= st.rules.max ? 'disabled' : ''}>${L('+ Бот')}</button><button class="btn btn-sm" data-a="admin" data-v="ready">${L('Все готовы')}</button>` : '';
      const why = cs.ok ? `<b>${L('Все на месте.')}</b> ${L('Можно открывать дело.')}` : esc(cs.reason);
      const main = st.watching
        ? `<button class="btn btn-primary" data-a="seat" ${st.seatsLeft > 0 ? '' : 'disabled'}>${L('Сесть за стол')}</button>`
        : isHost
        ? `<button class="btn btn-primary" data-a="start" ${cs.ok ? '' : 'disabled'}>${L('Начать партию')}</button>`
        : `<button class="btn ${me.ready ? '' : 'btn-primary'}" data-a="ready">${me.ready ? L('Отменить готовность') : L('Всё готово')}</button>`;
      setHtml(root.querySelector('#lBar'), `<div class="why">${st.watching ? (st.seatsLeft > 0 ? L('Вы зритель. Освободилось место, можно сесть за стол.') : L('Вы зритель: все десять мест заняты.')) : isHost ? why : (me.ready ? L('Вы готовы. Ждём остальных и ведущего.') : L('Нажмите «Всё готово», когда будете на месте.'))}</div>
        <div class="acts">${admin}${isHost ? `<button class="btn btn-ghost" data-a="close">${L('Закрыть комнату')}</button>` : ''}<button class="btn btn-ghost" data-a="leave">${L('Выйти')}</button>${main}</div>`);
    },
    unmount() {},
  };
})();
