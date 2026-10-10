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
    el.innerHTML = `<a class="acct-open" href="#/profile" title="Личный кабинет">${av}<span class="acct-name">${UI.esc(a.name)}</span><span class="acct-prov">${a.provider === 'discord' ? 'Discord' : a.provider === 'google' ? 'Google' : a.provider === 'email' ? 'почта' : 'тест'}</span></a>`;
  }
  App.renderAccount = renderAccount;
  App.hue = (name) => `hsl(${[...String(name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 45% 38%)`;
  /** Имя, под которым гость сядет за стол. Сервер считает его так же, по токену браузера. */
  App.guestName = () => window.DetectiveHub.guestName(Net.token);

  const postJson = async (url, body) => {
    try { return await (await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { return { ok: false, error: 'Нет связи с сервером.' }; }
  };
  App.postJson = postJson;

  /** Вход и регистрация по почте с паролем. После успеха страница перезагружается и садится под аккаунтом. */
  App.emailLogin = (mode = 'login') => {
    if (Net.mode === 'demo') { UI.toast('В демо входа нет, играйте гостем.'); return; }
    UI.modal((box, close) => {
      const draw = () => {
        const reg = mode === 'register';
        box.innerHTML = `<h3>${reg ? 'Регистрация' : 'Вход по почте'}</h3>
          <div class="seg em-tabs" role="tablist"><button type="button" role="tab" data-mode="login" class="${reg ? '' : 'on'}" aria-selected="${!reg}">Вход</button><button type="button" role="tab" data-mode="register" class="${reg ? 'on' : ''}" aria-selected="${reg}">Регистрация</button></div>
          <form class="em-form" novalidate>
            <div class="field"><label for="emMail">Почта</label><input class="input" id="emMail" type="email" autocomplete="email" maxlength="200" required></div>
            <div class="field"><label for="emPass">Пароль</label><input class="input" id="emPass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" maxlength="128" required>${reg ? '<small class="hint">Не меньше 8 знаков</small>' : ''}</div>
            ${reg ? '<div class="field"><label for="emName">Имя в игре</label><input class="input" id="emName" maxlength="18" autocomplete="nickname" required></div>' : ''}
            <p class="em-err" role="alert"></p>
            <div class="row"><button class="btn btn-ghost" type="button" data-cancel>Отмена</button><button class="btn btn-primary" type="submit">${reg ? 'Создать аккаунт' : 'Войти'}</button></div>
            ${reg ? '' : '<p class="hint">Забыли пароль? Напишите нам на почту из подвала сайта, пришлём временный.</p>'}
          </form>`;
        box.querySelector('#emMail').focus();
      };
      draw();
      box.addEventListener('click', (e) => {
        const t = e.target.closest('[data-mode]');
        if (t && t.dataset.mode !== mode) { const mail = box.querySelector('#emMail').value; mode = t.dataset.mode; draw(); box.querySelector('#emMail').value = mail; }
        else if (e.target.closest('[data-cancel]')) close();
      });
      box.addEventListener('submit', async (e) => {
        e.preventDefault();
        const val = (id) => { const el = box.querySelector(id); return el ? el.value : undefined; };
        const btn = box.querySelector('button[type="submit"]'); btn.disabled = true;
        const r = await postJson(mode === 'register' ? '/auth/email/register' : '/auth/email/login', { email: val('#emMail'), password: val('#emPass'), name: val('#emName') });
        btn.disabled = false;
        if (!r.ok) {
          box.querySelector('.em-err').textContent = r.error || 'Не получилось.';
          const el = box.querySelector({ email: '#emMail', password: '#emPass', name: '#emName' }[r.field] || '#emPass');
          if (el) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); el.focus(); }
          return;
        }
        close();
        location.reload();
      });
    });
  };

  const DISCORD_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.6 5.3A16.5 16.5 0 0 0 15.5 4l-.2.4a15 15 0 0 1 3.7 1.9 13.6 13.6 0 0 0-12.2-.1A15 15 0 0 1 10.5 4.4L10.3 4a16.5 16.5 0 0 0-4.1 1.3C3.6 9.2 2.9 13 3.2 16.7a16.6 16.6 0 0 0 5 2.5l1.1-1.7a10.7 10.7 0 0 1-1.7-.8l.4-.3a11.8 11.8 0 0 0 10 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.7a16.5 16.5 0 0 0 5-2.5c.4-4.3-.7-8-2.9-11.4ZM9.5 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm5 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg>';
  const MAIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>';
  const GOOGLE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ea4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8a6 6 0 0 1 0-12c1.9 0 3.1.8 3.8 1.5l2.6-2.5A9.5 9.5 0 0 0 12 2.5a9.5 9.5 0 1 0 0 19c5.5 0 9.1-3.8 9.1-9.3 0-.6-.1-1.1-.2-1.6H12Z"/></svg>';
  /** Кнопки входа: Discord (если заданы ключи), почта всегда, Google только если ключи заданы. */
  App.loginButtons = () => {
    const pr = (Net.me && Net.me.providers) || {};
    const demo = Net.mode === 'demo';
    const discord = !demo && pr.discord ? `<a class="btn" href="/auth/discord">${DISCORD_SVG} Discord</a>` : `<button class="btn" type="button" aria-disabled="true" data-off-auth>${DISCORD_SVG} Discord</button>`;
    const google = !demo && pr.google ? `<a class="btn" href="/auth/google">${GOOGLE_SVG} Google</a>` : '';
    return `<div class="auth-btns">${discord}<button class="btn" type="button" data-email="login">${MAIL_SVG} Почта</button>${google}${pr.dev ? '<a class="btn" href="/auth/dev?name=Тест">Тестовый вход</a>' : ''}</div>`;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-email]');
    if (b) { e.preventDefault(); App.emailLogin(b.dataset.email || 'login'); return; }
    if (e.target.closest('[data-off-auth]')) UI.toast(Net.mode === 'demo' ? 'В демо входа нет, играйте гостем.' : 'Вход через Discord скоро заработает. Пока можно войти по почте.');
  });

  /** Сохранить имя в профиле аккаунта ({name} или {reset:true}). Если игрок в лобби, имя меняется и там. */
  App.saveProfile = async (body) => {
    const r = await postJson('/api/profile', body);
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
