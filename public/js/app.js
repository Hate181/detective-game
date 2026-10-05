/* Приложение: маршруты, выбор экрана по состоянию комнаты, индикатор связи. */
(function () {
  const { toast } = UI;
  const Screens = window.Screens;
  const app = document.getElementById('app');
  const conn = document.getElementById('conn');
  const demoBadge = document.getElementById('demoBadge');

  const App = { state: null, current: null, key: null, route: { name: 'home' } };
  window.App = App;

  function parseRoute() {
    const h = (location.hash || '#/').replace(/^#/, '');
    const m = h.match(/^\/room\/([A-Za-z0-9]+)/);
    if (h.startsWith('/admin')) return { name: 'admin' };
    if (m) return { name: 'room', code: m[1].toUpperCase() };
    const pg = h.match(/^\/(rules|contacts|privacy|cookies)\b/);
    if (pg) return { name: 'page', page: pg[1] };
    return { name: 'home' };
  }

  /* В комнате игрок только пока адрес указывает на неё. Ушёл на главную, и место за ним остаётся, а на главной появляется «Вы в игре». */
  function pick() {
    const st = App.state;
    if (App.route.name === 'admin') return 'admin';
    if (App.route.name === 'page') return 'page';
    if (st && App.route.name === 'room' && App.route.code === st.code) {
      if (st.status === 'lobby' || !st.game) return 'lobby';
      return st.game.phase === 'ended' ? 'end' : 'game';
    }
    return 'home';
  }

  /* Пока игрок на главной, а партия идёт, он считается отошедшим: автопилот подхватит его ход. */
  function syncAway(name) {
    const st = App.state;
    if (!st) { App.awaySent = null; return; }
    const me = st.players.find((p) => p.id === st.realMeId);
    if (!me) return;
    const want = (name === 'home' || name === 'page') && st.status === 'playing';
    if (!!me.away === want) { App.awaySent = null; return; }
    if (App.awaySent === want) return;
    App.awaySent = want;
    Net.call('room:away', { away: want }).then((r) => { if (!r.ok) App.awaySent = null; });
  }

  function renderAccount() {
    const el = document.getElementById('acct');
    if (!el) return;
    const a = Net.me && Net.me.account;
    if (!a) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<button type="button" class="acct-open" data-profile title="Профиль"><span class="acct-av" style="background:hsl(${[...a.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 45% 38%)">${UI.esc(UI.initial(a.name))}</span><span class="acct-name">${UI.esc(a.name)}</span><span class="acct-prov">${a.provider === 'discord' ? 'Discord' : a.provider === 'google' ? 'Google' : 'тест'}</span></button>`;
  }

  /* Профиль: своё имя для игры, даже после входа через Discord или Google, и выход из аккаунта. */
  function openProfile() {
    const a = Net.me && Net.me.account;
    if (!a) return;
    const prov = a.provider === 'discord' ? 'Discord' : a.provider === 'google' ? 'Google' : 'тестовый вход';
    UI.modal((box, close) => {
      box.innerHTML = `<h3>Профиль</h3>
        <p class="sub">Вы вошли через ${UI.esc(prov)}${a.providerName ? ` как ${UI.esc(a.providerName)}` : ''}. Имя для игры можно поменять: его увидят за столом и в таблице сезона, на всех устройствах.</p>
        <div class="field"><label for="profName">Имя в игре</label><input class="input" id="profName" maxlength="18" value="${UI.esc(a.name)}"></div>
        ${a.custom && a.providerName ? `<p class="hint"><button type="button" class="linkish" data-reset>Вернуть имя из ${UI.esc(prov)}</button></p>` : ''}
        <div class="row"><button class="btn btn-ghost" data-logout>Выйти из аккаунта</button><button class="btn btn-primary" data-save>Сохранить</button></div>`;
      const inp = box.querySelector('#profName');
      const send = async (body) => {
        let r;
        try { r = await (await fetch('/api/profile', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(); }
        catch (e) { r = { ok: false, error: 'Нет связи с сервером.' }; }
        if (!r.ok) { toast(r.error || 'Не получилось сохранить.', 'err'); inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); return; }
        Net.me.account.name = r.name; Net.me.account.custom = !body.reset;
        Net.store.set('detective.name', r.name);
        // Если игрок сидит в лобби, имя меняется и там.
        if (App.state && App.state.status === 'lobby') Net.call('room:rename', { name: r.name });
        close(); toast('Имя сохранено.');
        renderAccount(); render();
        const homeName = document.getElementById('nameIn'); if (homeName) homeName.value = r.name;
      };
      box.addEventListener('click', async (e) => {
        if (e.target.closest('[data-save]')) send({ name: inp.value });
        else if (e.target.closest('[data-reset]')) send({ reset: true });
        else if (e.target.closest('[data-logout]')) {
          close();
          const inRoom = !!App.state;
          const ok = await UI.confirmBox({ title: 'Выйти из аккаунта?', sub: inRoom ? 'Вы сидите в комнате. Выйдя из аккаунта, вы потеряете это место: в этом браузере игра продолжится уже без привязки к аккаунту.' : 'Дальше можно играть под ником без входа.', ok: 'Выйти' });
          if (ok) Net.logout();
        }
      });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send({ name: inp.value }); } });
    });
  }
  document.getElementById('acct').addEventListener('click', (e) => { if (e.target.closest('[data-profile]')) openProfile(); });

  function render() {
    App.route = parseRoute();
    const name = pick();
    syncAway(name);
    const key = name === 'home' ? `home:${App.route.code || ''}` : name === 'page' ? `page:${App.route.page}` : name;
    if (key !== App.key) {
      if (App.current && App.current.unmount) App.current.unmount();
      app.innerHTML = '';
      document.documentElement.classList.toggle('js-anim', name === 'home');
      App.key = key; App.current = Screens[name]; document.body.dataset.screen = name;
      document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', name === 'page' && a.dataset.nav === App.route.page));
      App.current.mount(app, { route: App.route, store: Net.store });
      window.scrollTo(0, 0);
    }
    if (App.current.update) App.current.update(App.state, App.route);
  }

  Net.on('state', (s) => { App.state = s; render(); });
  Net.on('left', () => { App.state = null; location.hash = '#/'; render(); });
  Net.on('kicked', (d) => { App.state = null; toast(d && d.closed ? 'Комнату закрыли.' : 'Вас убрали из комнаты.', 'err'); location.hash = '#/'; render(); });
  const setStatus = (s) => {
    conn.dataset.state = s;
    conn.querySelector('span').textContent = s === 'on' ? 'На связи' : s === 'demo' ? 'Демо' : 'Нет связи';
    demoBadge.hidden = s !== 'demo';
  };
  Net.on('status', (s) => {
    setStatus(s);
    if (s === 'off' && App.state) toast('Связь потеряна. Пробуем вернуться…', 'err');
    if (s === 'on' && App.state) toast('Связь восстановлена.');
  });
  if (Net.mode === 'demo') setStatus('demo');
  function renderFooter() {
    const el = document.getElementById('footMail');
    const mail = Net.me && Net.me.contact;
    el.innerHTML = mail ? `Почта для связи: <a href="mailto:${UI.esc(mail)}">${UI.esc(mail)}</a>` : 'Почта для связи: <a href="#/contacts">контакты</a>';
  }

  /* Плашка про cookie: показывается на главной и страницах документов, пока игрок не нажал «Хорошо». В лобби и игре её не видно. */
  {
    const bar = document.getElementById('cookieBar');
    let seen = false;
    try { seen = Net.store.get('detective.cookies') === '1'; } catch (e) { /* хранилище недоступно */ }
    bar.hidden = seen;
    document.getElementById('cookieOk').addEventListener('click', () => {
      bar.hidden = true;
      try { Net.store.set('detective.cookies', '1'); } catch (e) { /* не запомним, покажем ещё раз */ }
    });
  }
  Net.on('me', () => { renderAccount(); renderFooter(); render(); });
  window.addEventListener('hashchange', render);
  renderAccount();
  renderFooter();

  // Результат входа приходит в адресе: ?auth=ok, fail, cancel или off.
  try {
    const m = location.search.match(/[?&]auth=(\w+)/);
    if (m) {
      const msg = { ok: 'Вы вошли. Теперь место в игре держится за аккаунтом.', fail: 'Войти не получилось. Попробуйте ещё раз.', cancel: 'Вход отменён.', off: 'Этот способ входа пока не подключён.' }[m[1]];
      if (msg) toast(msg, m[1] === 'ok' ? undefined : 'err');
      history.replaceState(null, '', location.pathname + (location.hash || '#/'));
    }
  } catch (e) { /* адрес не важен */ }

  render();
})();
