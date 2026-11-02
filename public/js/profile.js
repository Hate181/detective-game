/* Личный кабинет: имя для игры, вход и выход, итоги за всё время и последние партии.
   Гость видит своё имя «Гость-12345» и кнопки входа. */
(function () {
  const { esc, toast } = UI;
  const ROLE = { innocent: L('Невиновный'), killer: L('Убийца'), accomplice: L('Сообщник'), detective: L('Следователь'), mole: L('Крот') };
  const PROV = { discord: 'Discord', google: 'Google', email: L('почту'), dev: L('тестовый вход') };

  const day = (t) => { try { return new Date(t).toLocaleDateString(I18N.lang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
  const games = (n) => `${n} ${I18N.plural(n, L('партия'), L('партии'), L('партий'))}`;

  function avatarOf(name, url, cls) {
    return url ? `<img class="${cls}" src="${esc(url)}" alt="" referrerpolicy="no-referrer">`
      : `<span class="${cls}" style="background:${esc(App.hue(name))}">${esc(UI.initial(name))}</span>`;
  }

  function guestHtml() {
    const g = App.guestName();
    return `<header class="doc-head"><p class="eyebrow">${L('Личный кабинет')}</p><h1>${L('Вы пока гость')}</h1></header>
      <section class="pf-card paper">
        <span class="pf-av-wrap"><span class="pf-av" style="background:${esc(App.hue(g))}">${L('Г')}</span></span>
        <div class="pf-who"><div class="label">${L('Имя за столом')}</div><div class="pf-name">${esc(g)}</div><div class="pf-sub">${L('номер закреплён за этим браузером')}</div></div>
      </section>
      <section><h2>${L('Зачем входить')}</h2>
        <ul class="doc-list">
          <li>${L('За столом вас видят под вашим именем, а не под номером.')}</li>
          <li>${L('Выпали из партии, и место ждёт вас на любом устройстве.')}</li>
          <li>${L('Здесь копятся ваши партии, победы, медали и место в сезоне.')}</li>
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
          <span class="ph-case">${esc(h.case)}<small>${L('{0} · {1} игроков{2}', esc(ROLE[h.role] || ''), h.players, h.medals && h.medals.length ? ` · ${esc(h.medals.join(', '))}` : '')}</small></span>
          <span class="ph-res">${h.won ? L('Победа') : L('Поражение')}</span>
          <span class="ph-pts">${h.points > 0 ? '+' : ''}${h.points}</span></li>`).join('')}</ol>`
      : `<p class="muted">${L('Сыгранных партий пока нет. Первая появится здесь, как только дело закроют.')}</p>`;
    return `<header class="doc-head"><p class="eyebrow">${L('Личный кабинет')}</p><h1>${L('Личное дело')}</h1></header>
      <section class="pf-card paper">
        <span class="stamp">${L('Детектив')}</span>
        <span class="pf-av-wrap">${avatarOf(a.name, a.avatar, 'pf-av')}</span>
        <div class="pf-who"><div class="label">${L('Имя за столом')}</div><div class="pf-name">${esc(a.name)}</div>
          <div class="pf-sub">${L('вход через {0}{1}', esc(PROV[a.provider] || a.provider), a.providerName && a.providerName !== a.name ? L(', там вы {0}', esc(a.providerName)) : '')}</div></div>
      </section>

      <section class="pf-stats">
        <div><b>${c.games}</b><span>${L('партий')}</span></div>
        <div><b>${pct(c.wins, c.games)}</b><span>${L('побед')}</span></div>
        <div><b>${c.points}</b><span>${L('очков')}</span></div>
        <div><b>${c.medals}</b><span>${L('медалей')}</span></div>
      </section>
      <p class="pf-roles">${L('Невиновным {0}, убийцей {1}, сообщником {2}{3}.{4}', games(c.innocent || 0), games(c.killer || 0), games(c.accomplice || 0), c.detective || c.mole ? L(', следователем {0}, кротом {1}', games(c.detective || 0), games(c.mole || 0)) : '', s && s.rank ? ` ${L('В сезоне')} <span class="nowrap">${esc(s.key)}</span> ${L('вы на {0} месте из {1}.', s.rank, s.total)}` : '')}</p>

      <section><h2>${L('Последние партии')}</h2>${hist}</section>

      <section><h2>${L('Фото')}</h2>
        <p>${L('Его видят все за столом: в лобби, в игре и на итогах партии.{0}', a.provider === 'discord' && !a.ownPhoto ? L(' Пока своего фото нет, показываем аватарку из Discord.') : '')}</p>
        <div class="pf-photo">
          <label class="btn btn-primary" for="pfPhoto">${a.ownPhoto ? L('Заменить фото') : L('Загрузить фото')}</label>
          <input type="file" id="pfPhoto" accept="image/*" hidden>
          ${a.ownPhoto ? `<button type="button" class="btn btn-ghost" data-photo-off>${L('Убрать{0}', a.providerAvatar ? L(' и вернуть аватарку Discord') : '')}</button>` : ''}
        </div>
        <p class="hint">${L('Подойдёт любая картинка: сайт сам вырежет квадрат по центру и уменьшит его.')}</p>
      </section>

      <section><h2>${L('Имя в игре')}</h2>
        <p>${L('Его видят за столом и в таблице сезона, на всех устройствах.')}</p>
        <form class="pf-name-form" id="pfForm" autocomplete="off">
          <input class="input" id="pfName" maxlength="18" value="${esc(a.name)}" aria-label="${L('Имя в игре')}">
          <button class="btn btn-primary" type="submit">${L('Сохранить')}</button>
        </form>
        ${a.custom && a.providerName ? `<p class="hint"><button type="button" class="linkish" data-reset>${L('Вернуть имя из {0}', esc(PROV[a.provider] || a.provider))}</button></p>` : ''}
      </section>

      ${a.provider === 'email' ? `<section><h2>${L('Пароль')}</h2>
        <form class="pf-pass" id="pfPass" autocomplete="off">
          <input class="input" id="pfOld" type="password" autocomplete="current-password" maxlength="128" placeholder="${L('Старый пароль')}" aria-label="${L('Старый пароль')}">
          <input class="input" id="pfNew" type="password" autocomplete="new-password" maxlength="128" placeholder="${L('Новый, от 8 знаков')}" aria-label="${L('Новый пароль')}">
          <button class="btn" type="submit">${L('Сменить')}</button>
        </form></section>` : ''}

      <section><h2>${L('Выход')}</h2>
        <p>${L('После выхода вы снова будете играть гостем.')}</p>
        <button class="btn btn-ghost" type="button" data-logout>${L('Выйти из аккаунта')}</button>
      </section>`;
  }

  const Screen = {
    mount(root) {
      // Обработчики вешаем на свой контейнер: корень приложения общий для всех экранов.
      root.innerHTML = '<div class="pf-root"></div>';
      root = this.root = root.firstChild; this.data = null; this.sig = null;
      document.title = L('Личный кабинет · Detective Game');
      root.addEventListener('click', (e) => this.onClick(e));
      root.addEventListener('change', (e) => { if (e.target.id === 'pfPhoto' && e.target.files && e.target.files[0]) this.upload(e.target.files[0], e.target); });
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
        <p class="doc-back"><a class="btn" href="#/">${L('На главную')}</a></p></article>`;
    },
    async save(body) {
      const r = await App.saveProfile(body);
      if (!r.ok) {
        toast(r.error || L('Не получилось сохранить.'), 'err');
        const inp = this.root.querySelector('#pfName'); if (inp) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); }
        return;
      }
      toast(L('Имя сохранено.'));
      this.sig = null; this.render();
    },
    /** Квадрат по центру, 192×192, JPEG. Большие фото с телефона ужимаем, пока файл не станет меньше 55 КБ. */
    async shrink(file) {
      // Картинку открываем без blob-адресов: их не пускает политика безопасности сайта.
      const open = async () => {
        if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch (e) { /* старый браузер, ниже запасной путь */ } }
        const src = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
        return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
      };
      try {
        const img = await open();
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, side = Math.min(w, h);
        if (!side) return null;
        const c = document.createElement('canvas'); c.width = c.height = 192;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#1a120b'; ctx.fillRect(0, 0, 192, 192);
        ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 192, 192);
        if (img.close) img.close();
        for (const q of [0.86, 0.75, 0.6, 0.45]) {
          const data = c.toDataURL('image/jpeg', q);
          if (data.length * 0.75 < 55 * 1024) return data;
        }
        return null;
      } catch (e) { return null; }
    },
    async upload(file, input) {
      input.value = '';
      if (!/^image\//.test(file.type)) { toast(L('Это не картинка.'), 'err'); return; }
      if (file.size > 15 * 1024 * 1024) { toast(L('Файл слишком большой, нужен до 15 МБ.'), 'err'); return; }
      const image = await this.shrink(file);
      if (!image) { toast(L('Не получилось открыть картинку. Попробуйте JPEG или PNG.'), 'err'); return; }
      this.photoDone(await App.postJson('/api/photo', { image }), L('Фото сохранено.'), true);
    },
    photoDone(r, msg, own) {
      if (!r || !r.ok) { toast((r && r.error) || L('Не получилось.'), 'err'); return; }
      const a = Net.me.account;
      a.avatar = r.avatar; a.ownPhoto = own;
      App.renderAccount();
      toast(msg);
      this.sig = null; this.render();
    },
    async changePass() {
      const old = this.root.querySelector('#pfOld'), nw = this.root.querySelector('#pfNew');
      const r = await App.postJson('/auth/email/password', { old: old.value, password: nw.value });
      if (!r.ok) {
        toast(r.error || L('Не получилось.'), 'err');
        const el = r.field === 'old' ? old : nw; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); el.focus();
        return;
      }
      old.value = ''; nw.value = '';
      toast(L('Пароль сменён. На других устройствах нужно будет войти заново.'));
    },
    async onClick(e) {
      if (e.target.closest('[data-reset]')) { this.save({ reset: true }); return; }
      if (e.target.closest('[data-photo-off]')) { this.photoDone(await App.postJson('/api/photo', { remove: true }), L('Фото убрано.'), false); return; }
      if (e.target.closest('[data-logout]')) {
        const inRoom = !!App.state;
        const ok = await UI.confirmBox({ title: L('Выйти из аккаунта?'), sub: inRoom ? L('Вы сидите в комнате. Выйдя из аккаунта, вы потеряете это место.') : L('Дальше вы будете играть гостем.'), ok: L('Выйти') });
        if (ok) Net.logout();
      }
    },
    unmount() { document.title = UI.HOME_TITLE; },
  };

  window.Screens = window.Screens || {};
  window.Screens.profile = Screen;
})();
