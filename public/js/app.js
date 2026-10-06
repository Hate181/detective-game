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
    if (/^\/(profile|me)\b/.test(h)) return { name: 'profile' };
    const pg = h.match(/^\/(rules|contacts|privacy|cookies)\b/);
    if (pg) return { name: 'page', page: pg[1] };
    return { name: 'home' };
  }

  /* В комнате игрок только пока адрес указывает на неё. Ушёл на главную, и место за ним остаётся, а на главной появляется «Вы в игре». */
  function pick() {
    const st = App.state;
    if (App.route.name === 'admin') return 'admin';
    if (App.route.name === 'page') return 'page';
    if (App.route.name === 'profile') return 'profile';
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

  /* Шапка: вошедший видит себя и попадает в кабинет, гость видит своё имя и кнопку «Войти». */
  function renderAccount() {
    const el = document.getElementById('acct');
    if (!el) return;
    const a = Net.me && Net.me.account;
    el.hidden = false;
    if (!a) {
      const g = App.guestName();
      el.innerHTML = `<a class="acct-open acct-guest" href="#/profile" title="Личный кабинет"><span class="acct-av" style="background:${UI.esc(App.hue(g))}">Г</span><span class="acct-name">${UI.esc(g)}</span><span class="acct-prov">войти</span></a>`;
      return;
    }
    const av = a.avatar ? `<img class="acct-av" src="${UI.esc(a.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="acct-av" style="background:${UI.esc(App.hue(a.name))}">${UI.esc(UI.initial(a.name))}</span>`;
    el.innerHTML = `<a class="acct-open" href="#/profile" title="Личный кабинет">${av}<span class="acct-name">${UI.esc(a.name)}</span><span class="acct-prov">${a.provider === 'discord' ? 'Discord' : a.provider === 'google' ? 'Google' : 'тест'}</span></a>`;
  }
  App.hue = (name) => `hsl(${[...String(name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 45% 38%)`;
  /** Имя, под которым гость сядет за стол. Сервер считает его так же, по токену браузера. */
  App.guestName = () => window.DetectiveHub.guestName(Net.token);

  /** Сохранить имя в профиле аккаунта ({name} или {reset:true}). Если игрок в лобби, имя меняется и там. */
  App.saveProfile = async (body) => {
    let r;
    try { r = await (await fetch('/api/profile', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { r = { ok: false, error: 'Нет связи с сервером.' }; }
    if (!r.ok) return r;
    Net.me.account.name = r.name; Net.me.account.custom = !body.reset;
    await Net.call('room:rename', { name: r.name });
    renderAccount(); render();
    return r;
  };

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
