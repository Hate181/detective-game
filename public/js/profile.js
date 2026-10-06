/* Личный кабинет: имя для игры, вход и выход, итоги за всё время и последние партии.
   Гость видит своё имя «Гость-12345» и кнопки входа. */
(function () {
  const { esc, toast } = UI;
  const ROLE = { innocent: 'Невиновный', killer: 'Убийца', accomplice: 'Сообщник' };
  const PROV = { discord: 'Discord', google: 'Google', email: 'почту', dev: 'тестовый вход' };

  const day = (t) => { try { return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
  const games = (n) => { const m10 = n % 10, m100 = n % 100; return `${n} ${m10 === 1 && m100 !== 11 ? 'партия' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'партии' : 'партий'}`; };

  function avatarOf(name, url, cls) {
    return url ? `<img class="${cls}" src="${esc(url)}" alt="" referrerpolicy="no-referrer">`
      : `<span class="${cls}" style="background:${esc(App.hue(name))}">${esc(UI.initial(name))}</span>`;
  }

  function guestHtml() {
    const g = App.guestName();
    return `<header class="doc-head"><p class="eyebrow">Личный кабинет</p><h1>Вы пока гость</h1></header>
      <section class="pf-card paper">
        <span class="pf-av-wrap"><span class="pf-av" style="background:${esc(App.hue(g))}">Г</span></span>
        <div class="pf-who"><div class="label">Имя за столом</div><div class="pf-name">${esc(g)}</div><div class="pf-sub">номер закреплён за этим браузером</div></div>
      </section>
      <section><h2>Зачем входить</h2>
        <ul class="doc-list">
          <li>За столом вас видят под вашим именем, а не под номером.</li>
          <li>Выпали из партии, и место ждёт вас на любом устройстве.</li>
          <li>Здесь копятся ваши партии, победы, медали и место в сезоне.</li>
        </ul>
        ${App.loginButtons()}
      </section>`;
  }

  function accountHtml(a, d) {
    const c = (d && d.career) || { games: 0, wins: 0, killer: 0, accomplice: 0, innocent: 0, points: 0, medals: 0, history: [] };
    const s = d && d.season;
    const hist = c.history.length
      ? `<ol class="pf-hist">${c.history.map((h) => `<li class="${h.won ? 'won' : 'lost'}">
          <span class="ph-date">${esc(day(h.t))}</span>
          <span class="ph-case">${esc(h.case)}<small>${esc(ROLE[h.role] || '')} · ${h.players} игроков${h.medals && h.medals.length ? ` · ${esc(h.medals.join(', '))}` : ''}</small></span>
          <span class="ph-res">${h.won ? 'Победа' : 'Поражение'}</span>
          <span class="ph-pts">${h.points > 0 ? '+' : ''}${h.points}</span></li>`).join('')}</ol>`
      : '<p class="muted">Сыгранных партий пока нет. Первая появится здесь, как только дело закроют.</p>';
    return `<header class="doc-head"><p class="eyebrow">Личный кабинет</p><h1>Личное дело</h1></header>
      <section class="pf-card paper">
        <span class="stamp">Детектив</span>
        <span class="pf-av-wrap">${avatarOf(a.name, a.avatar, 'pf-av')}</span>
        <div class="pf-who"><div class="label">Имя за столом</div><div class="pf-name">${esc(a.name)}</div>
          <div class="pf-sub">вход через ${esc(PROV[a.provider] || a.provider)}${a.providerName && a.providerName !== a.name ? `, там вы ${esc(a.providerName)}` : ''}</div></div>
      </section>

      <section class="pf-stats">
        <div><b>${c.games}</b><span>партий</span></div>
        <div><b>${pct(c.wins, c.games)}</b><span>побед</span></div>
        <div><b>${c.points}</b><span>очков</span></div>
        <div><b>${c.medals}</b><span>медалей</span></div>
      </section>
      <p class="pf-roles">Невиновным ${games(c.innocent || 0)}, убийцей ${games(c.killer || 0)}, сообщником ${games(c.accomplice || 0)}.${s && s.rank ? ` В сезоне <span class="nowrap">${esc(s.key)}</span> вы на ${s.rank} месте из ${s.total}.` : ''}</p>

      <section><h2>Последние партии</h2>${hist}</section>

      <section><h2>Имя в игре</h2>
        <p>Его видят за столом и в таблице сезона, на всех устройствах.</p>
        <form class="pf-name-form" id="pfForm" autocomplete="off">
          <input class="input" id="pfName" maxlength="18" value="${esc(a.name)}" aria-label="Имя в игре">
          <button class="btn btn-primary" type="submit">Сохранить</button>
        </form>
        ${a.custom && a.providerName ? `<p class="hint"><button type="button" class="linkish" data-reset>Вернуть имя из ${esc(PROV[a.provider] || a.provider)}</button></p>` : ''}
      </section>

      ${a.provider === 'email' ? `<section><h2>Пароль</h2>
        <form class="pf-pass" id="pfPass" autocomplete="off">
          <input class="input" id="pfOld" type="password" autocomplete="current-password" maxlength="128" placeholder="Старый пароль" aria-label="Старый пароль">
          <input class="input" id="pfNew" type="password" autocomplete="new-password" maxlength="128" placeholder="Новый, от 8 знаков" aria-label="Новый пароль">
          <button class="btn" type="submit">Сменить</button>
        </form></section>` : ''}

      <section><h2>Выход</h2>
        <p>После выхода вы снова будете играть гостем.</p>
        <button class="btn btn-ghost" type="button" data-logout>Выйти из аккаунта</button>
      </section>`;
  }

  const Screen = {
    mount(root) {
      // Обработчики вешаем на свой контейнер: корень приложения общий для всех экранов.
      root.innerHTML = '<div class="pf-root"></div>';
      root = this.root = root.firstChild; this.data = null; this.sig = null;
      document.title = 'Личный кабинет · Detective Game';
      root.addEventListener('click', (e) => this.onClick(e));
      root.addEventListener('submit', (e) => {
        e.preventDefault();
        if (e.target.id === 'pfForm') this.save({ name: root.querySelector('#pfName').value });
        else if (e.target.id === 'pfPass') this.changePass();
      });
      this.load();
    },
    async load() {
      this.loaded = false;
      const r = await Net.call('stats:me', {});
      this.data = r && r.ok ? r : null; this.loaded = true;
      this.sig = null; this.render();
    },
    update() { this.render(); },
    render() {
      if (!this.loaded) return;
      const a = Net.me && Net.me.account;
      const sig = JSON.stringify([a, this.data && this.data.career && this.data.career.games, Net.me && Net.me.providers]);
      if (sig === this.sig) return;
      // Аккаунт появился позже, чем пришли данные гостя: перезапрашиваем.
      if (a && this.data && this.data.guest) { this.data = null; this.load(); return; }
      this.sig = sig;
      this.root.innerHTML = `<article class="doc wrap profile">${a ? accountHtml(a, this.data) : guestHtml()}
        <p class="doc-back"><a class="btn" href="#/">На главную</a></p></article>`;
    },
    async save(body) {
      const r = await App.saveProfile(body);
      if (!r.ok) {
        toast(r.error || 'Не получилось сохранить.', 'err');
        const inp = this.root.querySelector('#pfName'); if (inp) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); }
        return;
      }
      toast('Имя сохранено.');
      this.sig = null; this.render();
    },
    async changePass() {
      const old = this.root.querySelector('#pfOld'), nw = this.root.querySelector('#pfNew');
      const r = await App.postJson('/auth/email/password', { old: old.value, password: nw.value });
      if (!r.ok) {
        toast(r.error || 'Не получилось.', 'err');
        const el = r.field === 'old' ? old : nw; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); el.focus();
        return;
      }
      old.value = ''; nw.value = '';
      toast('Пароль сменён. На других устройствах нужно будет войти заново.');
    },
    async onClick(e) {
      if (e.target.closest('[data-reset]')) { this.save({ reset: true }); return; }
      if (e.target.closest('[data-logout]')) {
        const inRoom = !!App.state;
        const ok = await UI.confirmBox({ title: 'Выйти из аккаунта?', sub: inRoom ? 'Вы сидите в комнате. Выйдя из аккаунта, вы потеряете это место.' : 'Дальше вы будете играть гостем.', ok: 'Выйти' });
        if (ok) Net.logout();
      }
    },
    unmount() { document.title = 'Detective Game · Убийца среди вас'; },
  };

  window.Screens = window.Screens || {};
  window.Screens.profile = Screen;
})();
