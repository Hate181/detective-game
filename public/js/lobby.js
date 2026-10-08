/* Лобби v2: сначала голосовая связь и ведущий, потом люди и дело. Без стола. */
(function () {
  const { esc, icon, avatar, toast, fail, setHtml } = UI;
  const Screens = (window.Screens = window.Screens || {});

  const roomLink = (code) => (Net.mode === 'server' ? `${location.origin}/r/${code}` : `${location.href.split('#')[0]}#/room/${code}`);
  const seg = (a, opts, cur, can) => `<div class="seg" role="group">${opts.map(([v, t]) => `<button data-a="${a}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" ${can ? '' : 'disabled'}>${t}</button>`).join('')}</div>`;

  Screens.lobby = {
    mount(root) {
      this.seen = new Set();
      root.innerHTML = `<div class="wrap lobby">
        <div class="lobby-head" id="lHead"></div>
        <div class="lobby-grid">
          <div style="display:grid;gap:18px;min-width:0">
            <section class="panel" id="lRoster" aria-label="Игроки"></section>
          </div>
          <div style="display:grid;gap:18px;min-width:0">
            <section class="panel" id="lCases" aria-label="Дело"></section>
            <section class="panel" id="lSet" aria-label="Как играем"></section>
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
        if (a === 'link') UI.copyText(roomLink(st.code), 'Ссылка скопирована. Отправьте её напарникам.');
        else if (a === 'code') UI.copyText(st.code, 'Код скопирован');
        else if (a === 'pack') call('room:pack', { packId: b.dataset.id });
        else if (a === 'discuss' || a === 'turn') call('room:setting', { key: a, value: Number(b.dataset.v) });
        else if (a === 'mode') call('room:setting', { key: 'mode', value: b.dataset.v });
        else if (a === 'hints') call('room:setting', { key: 'hints', value: b.dataset.v });
        else if (a === 'ready') call('room:ready');
        else if (a === 'start') call('room:start');
        else if (a === 'leave') call('room:leave');
        else if (a === 'close') { const ok = await UI.confirmBox({ title: 'Закрыть комнату?', sub: 'Все игроки выйдут из комнаты, код перестанет работать.', ok: 'Закрыть комнату', danger: true }); if (ok) call('room:close'); }
        else if (a === 'kick') call('room:kick', { playerId: b.dataset.id });
        else if (a === 'host') call('room:host', { playerId: b.dataset.id });
        else if (a === 'rename') {
          const v = await UI.ask({ title: 'Как вас называть?', placeholder: 'Имя', ok: 'Сохранить', max: 18 });
          if (v) { const r = await App.saveProfile({ name: v }); if (!r.ok) toast(r.error || 'Не получилось сохранить.', 'err'); }
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
        <div><p class="eyebrow">Комната${st.test ? ' · тестовая' : ''}</p><h1>Собираем <em style="color:var(--amber-hi)">детективов</em></h1></div>
        <div class="code-plate">
          <div class="code-tiles" aria-label="Код комнаты ${esc(st.code)}">${st.code.split('').map((c) => `<span>${esc(c)}</span>`).join('')}</div>
          <div style="display:grid;gap:6px"><button class="btn btn-sm" data-a="link">Скопировать ссылку</button><button class="btn btn-sm btn-ghost" data-a="code">Скопировать код</button></div>
        </div>`);

      this.seen = this.seen || new Set();
      const rows = st.players.map((p) => { const fresh = !this.seen.has(p.id); this.seen.add(p.id); return `
        <div class="row-p ${p.id === st.realMeId ? 'me' : ''} ${fresh && this.seen.size > 1 ? 'enter' : ''}">
          ${avatar(p.name, p.seat)}
          <div style="min-width:0"><div class="nm">${esc(p.name)}${p.id === st.realMeId ? ' <span class="muted">(вы)</span>' : ''}</div>
            ${p.away ? '<div class="muted" style="font-size:12px">отошёл на главную</div>' : !p.connected && !p.isBot ? '<div class="muted" style="font-size:12px">нет связи</div>' : ''}</div>
          <div class="tags">
            ${p.id === st.hostId ? '<span class="badge yellow">ведущий</span>' : p.ready ? '<span class="badge green">готово</span>' : '<span class="badge">ждёт</span>'}
            ${p.isBot ? '<span class="badge blue">бот</span>' : ''}
            ${p.id === st.realMeId && Net.me && Net.me.account ? '<button class="x" data-a="rename" title="Сменить имя" aria-label="Сменить имя">✎</button>' : ''}
            ${isHost && p.id !== st.hostId && !p.isBot ? `<button class="x" data-a="host" data-id="${esc(p.id)}" title="Передать ведение" aria-label="Передать ведение игроку ${esc(p.name)}">★</button>` : ''}
            ${isHost && p.id !== st.hostId ? `<button class="x" data-a="kick" data-id="${esc(p.id)}" title="Убрать из комнаты" aria-label="Убрать ${esc(p.name)}">×</button>` : ''}
          </div>
        </div>`; }).join('');
      const empties = Array.from({ length: Math.max(0, need - n) }, () => '<div class="row-p empty"><span class="av" style="background:var(--panel-2);box-shadow:none"></span><span>Свободное место</span><span></span></div>').join('');
      setHtml(root.querySelector('#lRoster'), `
        <div class="panel-head"><h2>Игроки</h2><span class="count">${n} из ${st.rules.max} · нужно от ${need}</span></div>
        <div class="roster">${rows}${empties}</div>
        <div class="rules-line"><span>Преступники: <b>${st.rules.gang ? 'убийца и сообщник, исключить нужно обоих; поровну с невиновными они побеждают' : st.rules.accomplice ? 'убийца и сообщник' : 'убийца'}</b></span><span>Ведущий играет наравне со всеми</span></div>`);

      const packOpts = st.packs.map((p) => `
        <button class="case-opt random ${st.pack === p.id ? 'sel' : ''}" data-a="pack" data-id="${esc(p.id)}" ${isHost ? '' : 'disabled'}>
          <span class="ci">${icon(p.icon || 'random')}</span><h3>${esc(p.title)}</h3><small>${p.count} ${window.DetectiveContent.trans(p.count, 'дело', 'дела', 'дел')}. ${esc(p.desc)}</small>
        </button>`).join('');
      setHtml(root.querySelector('#lCases'), `
        <div class="panel-head"><h2>Выбор пака</h2><span class="count">${isHost ? 'выбираете вы' : 'выбирает ведущий'}</span></div>
        <div class="case-grid">${packOpts}</div>
        <p class="hint" style="margin:12px 0 0">Дело из пака выберется случайно при старте и не повторит прошлое. Карточки в каждой партии раздаются заново.</p>`);

      const s = st.settings;
      setHtml(root.querySelector('#lSet'), `
        <div class="panel-head"><h2>Как играем</h2><span class="count">${isHost ? 'настраивает ведущий' : `ведущий: ${esc(hostP.name || '')}`}</span></div>
        <div class="set-row" style="margin-top:0;padding-top:0;border:0"><div><div class="label">Ход партии</div><p class="hint" style="margin:4px 0 0">${s.mode === 'host' ? 'Ведущий листает раунды и сам запускает таймер.' : 'Фазы сменяются по таймеру.'}</p></div>
          ${seg('mode', [['host', 'Ведущий'], ['timers', 'Таймеры']], s.mode, isHost)}</div>
        <div class="set-row"><div><div class="label">Режим</div><p class="hint" style="margin:4px 0 0">${s.hints === 'light' ? 'Игра сама подсвечивает, кто подходит под улику.' : 'Совпадения с уликами не подсвечиваются: слушайте и сверяйте сами.'}</p></div>
          ${seg('hints', [['normal', 'Обычный'], ['light', 'Лайт']], s.hints || 'normal', isHost)}</div>
        <div class="set-row"><div class="label">Рассказ каждого</div>${seg('turn', st.rules.turnOptions.map((v) => [v, `${v} с`]), s.turn, isHost)}</div>
        <div class="set-row"><div class="label">Обсуждение в раунде</div>${seg('discuss', st.rules.talkOptions.map((v) => [v, v >= 120 ? `${v / 60} мин` : `${v} с`]), s.discuss, isHost)}</div>`);

      const cs = st.canStart;
      const admin = st.isAdmin && st.test ? `<button class="btn btn-sm" data-a="admin" data-v="bot" ${n >= st.rules.max ? 'disabled' : ''}>+ Бот</button><button class="btn btn-sm" data-a="admin" data-v="ready">Все готовы</button>` : '';
      const why = cs.ok ? '<b>Все на месте.</b> Можно открывать дело.' : esc(cs.reason);
      const main = isHost
        ? `<button class="btn btn-primary" data-a="start" ${cs.ok ? '' : 'disabled'}>Начать партию</button>`
        : `<button class="btn ${me.ready ? '' : 'btn-primary'}" data-a="ready">${me.ready ? 'Отменить готовность' : 'Всё готово'}</button>`;
      setHtml(root.querySelector('#lBar'), `<div class="why">${isHost ? why : (me.ready ? 'Вы готовы. Ждём остальных и ведущего.' : 'Нажмите «Всё готово», когда будете на месте.')}</div>
        <div class="acts">${admin}${isHost ? '<button class="btn btn-ghost" data-a="close">Закрыть комнату</button>' : ''}<button class="btn btn-ghost" data-a="leave">Выйти</button>${main}</div>`);
    },
    unmount() {},
  };
})();
