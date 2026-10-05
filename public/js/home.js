/* Главная страница: создать комнату, войти по коду, коротко о правилах. */
(function () {
  const { esc, icon, toast, fail } = UI;
  const Content = UI.Content;
  const Screens = (window.Screens = window.Screens || {});

  const WHO = { swap: 'У двоих, кому повезёт', lab: 'Когда исключили невиновного', trail: 'Когда исключили преступника' };
  const cardsRow = ['warrant', 'testimony', 'advocate', 'swap', 'lab', 'trail'].map((k) => {
    const c = Content.CARDS[k];
    return `<div class="acard ${WHO[k] ? 'twist' : ''} reveal"><h4>${esc(c.name)}</h4><p>${esc(c.desc)}</p><div class="who"><span class="badge ${WHO[k] ? 'yellow' : ''}">${esc(WHO[k] || 'В колоде')}</span></div></div>`;
  }).join('');

  /* Закрашенные строки примера: при наведении открываются, у каждого посетителя свои, меняются при новом заходе на страницу. */
  const FEATURES = [
    'Выбрал вилкой в глаз',
    'Тиктокер, лайкер и стример',
    'Любит Gachi-ремиксы',
    'Ставит лайки в три часа ночи',
    'Пьёт энергетик на завтрак',
    'Говорит «ну такое» про всё подряд',
    'Слушает фонк на полную громкость',
    'Скроллит ленту даже на похоронах',
    'Называет всех «брат»',
    'Не снимает худи даже в бане',
    'Ходит в шлёпанцах с носками',
    'Отвечает мемами вместо слов',
    'Фотографирует еду раньше, чем пробует',
    'Кричит «Эщкере» при любом удобном случае',
    'Играет в Доту с 2012-го: «ещё одну катку»',
    'Знает все реплики из «Бригады»',
    'Носит с собой бананы на всякий случай',
    'Надевает солнечные очки ночью',
    'Смотрит сериалы на скорости 2х',
    'Хрустит чипсами в самый тихий момент',
    'Не отвечает в мессенджерах, но смотрит статусы',
    'Печатает капслоком, когда нервничает',
    'Всегда «буду через пять минут»',
    'Копит голосовые на двадцать минут',
    'Пишет «ахахах» с каменным лицом',
    'Подписан на сорок каналов про котиков',
    'Пьёт чай из банки из-под майонеза',
    'Верит гороскопам, только когда они хорошие',
    'Рассказывает про крипту всем подряд',
    'Постоянно «на минутку в телефон»',
    'Говорит «по фактам» и не называет фактов',
    'Неделю не снимает один и тот же свитер',
    'Любит караоке, слуха нет',
    'Приходит на встречи на самокате',
    'Носит с собой повербанк на шесть зарядов',
    'Читает всё с конца',
    'Кидает мемы в рабочий чат',
    'Кивает в такт чужому плейлисту',
    'Спит днём, а ночью «ещё чуть-чуть»',
    'Каждый вечер обещает «лечь пораньше»',
  ];
  const SECRETS = [
    'Полгода назад ездил на Пхукет',
    'Фанат Ивана Золо',
    'Главный фанат Sweetie Fox',
    'Скуф в 18 лет',
    'Фембой',
    'Смотрит «Масяню» и плачет от ностальгии',
    'По выходным верит в плоскую Землю',
    'Спускает зарплату на донат в мобильной игре',
    'Тайно слушает Басту и подпевает',
    'Состоит в чате «Чёрная пятница навсегда»',
    'Курс «Как стать миллионером за неделю» куплен в кредит',
    'Хранит двести скриншотов переписок «на всякий случай»',
    'До сих пор мечтает стать Человеком-пауком',
    'Подписан на «Сигма-мышление» и всерьёз пробует',
    'Пересматривает финал «Игры престолов» и злится заново',
    'Тамагочи забыт на три года, но жив',
    'Помнит пароль от вай-фая всех соседей',
    'NFT с обезьянкой куплен на последние деньги и никому не показан',
    'Кликает «Хомяка» ради монеток',
    'Тайно смотрит дорамы и плачет на третьей серии',
    'Прячет в шкафу костюм Наруто',
    'Ставит будильник на 6:00 и встаёт в 14:00',
    'Был админом «Подслушано» и всё помнит',
    'Автор фанфика на сорок глав под псевдонимом',
    'Заказывает доставку и называет это «режимом экономии»',
    'Лайк под фото бывшей трёхлетней давности: «палец соскользнул»',
    'Гироскутер куплен для города, а ездит на нём по квартире',
    'Победитель конкурса по поеданию пельменей',
    'Даёт советы по отношениям, а у самого пять лет «всё сложно»',
    'Помнит наизусть рекламные джинглы нулевых',
    'Мечтает о блоге, подписчиков пять, трое из них боты',
    'Покупает книги по саморазвитию и бросает на второй главе',
    'Каждый вечер смотрит, как чистят ковры',
    'Одну и ту же миссию проходит в четвёртый раз: «не засчитало»',
    'Любит ананасы на пицце и защищает их в комментариях',
    'Состоит в трёх чатах распавшейся группы',
    'Включает реалити-шоу «для фона» и знает всех участников',
    'Пересылает в семейный чат «зелёную воду» с пометкой «срочно!!»',
    'Три года не удаляет приложение для знакомств «просто посмотреть»',
    'Говорит «и вам того же», когда официант желает приятного аппетита',
  ];

  const html = (code) => `
<section class="hero"><div class="wrap hero-grid">
  <div>
    <p class="eyebrow">Онлайн-детектив · 6–10 человек · около 30 минут</p>
    <h1 aria-label="Detective">${'DETECTIVE'.split('').map((ch, i) => `<span class="${i > 5 ? 'accent' : ''}" style="animation-delay:${0.05 * i}s" aria-hidden="true">${ch}</span>`).join('')}</h1>
    <p class="lead">Убийца среди вас. Осталось понять кто.</p>
    <div id="resume"></div>
    <form class="start-card" id="startForm" autocomplete="off">
      ${code ? `<div class="resume"><span>Вас зовут в комнату <b class="mono">${esc(code)}</b>. Назовите имя и заходите.</span></div>` : ''}
      <div class="field"><label for="nameIn">Ваше имя</label><input class="input" id="nameIn" maxlength="18" placeholder="Как к вам обращаться" required></div>
      <div class="auth-row" id="authRow"></div>
      ${code
        ? `<button class="btn btn-primary btn-block" type="submit" data-act="join">Войти в комнату</button>
           <div class="or">или</div><button class="btn btn-block" type="button" data-act="create">Открыть своё дело</button>`
        : `<button class="btn btn-primary btn-block" type="submit" data-act="create">Открыть дело</button>
           <div class="or">или войти по коду</div>
           <div class="row2"><input class="input code-in" id="codeIn" maxlength="6" placeholder="КОД" aria-label="Код комнаты"><button class="btn" type="button" data-act="join">Войти</button></div>`}
      <p class="community" id="community"></p>
    </form>
  </div>
  <div class="paper file-card" aria-label="Пример карточки игрока">
    <span class="stamp">Секретно</span>
    <div class="label">Карточка игрока · пример</div>
    <h3>Мира, бухгалтер</h3>
    <dl class="rows" style="margin:0">
      <div><dt>Связь с жертвой</dt><dd>Деньги, которые жертва должна вернуть</dd></div>
      <div><dt>Алиби</dt><dd>Оранжерея, с 23:05 до 23:50</dd></div>
      <div><dt>Особенность</dt><dd><span class="redact" id="redFeat" tabindex="0" role="button" aria-label="Особенность скрыта. Наведите или нажмите, чтобы прочитать"></span></dd></div>
      <div><dt>Секрет</dt><dd><span class="redact" id="redSecret" tabindex="0" role="button" aria-label="Секрет скрыт. Наведите или нажмите, чтобы прочитать"></span></dd></div>
      <div><dt>Цель</dt><dd>Добиться исключения игрока Игорь</dd></div>
    </dl>
    <p class="fhint">Наведите на чёрные строки, на телефоне нажмите</p>
    <div class="clue"><b>Улика 1.</b> Сейф открыли без взлома. Преступнику был известен код.
      <div class="fchips"><span class="chip hit">Знает код сейфа</span><span class="chip">Подходит двоим</span></div></div>
  </div>
</div></section>

<section class="section about"><div class="wrap">
  <div class="section-head reveal"><p class="eyebrow">Об игре</p><h2>Раскрыть дело можно только вместе</h2>
    <p>Это кооперативная игра: вы расследуете убийство всей компанией. Среди вас убийца и его сообщник, и они делают всё, чтобы остаться незамеченными.</p>
    <p>Каждому достаётся карточка с профессией, алиби и связью с жертвой. В каждом раунде появляется улика, вы по очереди рассказываете о себе и в конце исключаете одного подозреваемого. Исключили обоих преступников, и дело раскрыто. Не успели, и они выиграли.</p></div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head reveal"><p class="eyebrow">Карты действий</p><h2>У каждого по одной, а по ходу дела ещё</h2><p>Кто держит «Подмену улики», не знает никто. Когда команда теряет человека, она получает карту в ответ, поэтому отстающие ещё могут отыграться.</p></div>
  <div class="cards-row">${cardsRow}</div>
</div></section>`;

  const DISCORD = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.6 5.3A16.5 16.5 0 0 0 15.5 4l-.2.4a15 15 0 0 1 3.7 1.9 13.6 13.6 0 0 0-12.2-.1A15 15 0 0 1 10.5 4.4L10.3 4a16.5 16.5 0 0 0-4.1 1.3C3.6 9.200 2.900 13 3.200 16.700a16.600 16.600 0 0 0 5 2.500l1.100-1.700a10.700 10.700 0 0 1-1.700-.8l.4-.3a11.800 11.800 0 0 0 10 0l.4.3c-.5.3-1.100.6-1.700.8l1.100 1.700a16.500 16.500 0 0 0 5-2.500c.4-4.300-.7-8-2.900-11.400ZM9.500 14.500c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2Zm5 0c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2Z"/></svg>';
  const GOOGLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ea4335" d="M12 10.200v3.900h5.500c-.2 1.300-1.600 3.800-5.500 3.800a6 6 0 0 1 0-12c1.900 0 3.100.8 3.800 1.500l2.600-2.500A9.500 9.500 0 0 0 12 2.500a9.500 9.500 0 1 0 0 19c5.500 0 9.100-3.800 9.100-9.300 0-.6-.1-1.100-.2-1.600H12Z"/></svg>';
  const phaseLabel = (st) => {
    const g = st.game;
    if (st.status === 'lobby' || !g) return 'Идёт сбор игроков.';
    if (g.phase === 'ended') return 'Партия окончена.';
    return g.round > 0 ? `Раунд ${g.round} из 4.` : 'Идёт вводная.';
  };

  Screens.home = {
    mount(root, ctx) {
      document.documentElement.classList.add('js-anim');
      root.innerHTML = html(ctx.route.code || '');
      const name = (ctx.store.get('detective.name') || '');
      const nameIn = root.querySelector('#nameIn'), codeIn = root.querySelector('#codeIn');
      const acc = Net.me && Net.me.account;
      // Имя из профиля важнее того, что запомнил браузер: его игрок задал сам.
      nameIn.value = (acc && acc.custom ? acc.name : name) || (acc ? acc.name.slice(0, 18) : '');
      if (name && !ctx.route.code && codeIn) codeIn.focus(); else if (!name) nameIn.focus();
      if (codeIn) codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

      // Закрашенные строки примера карточки
      {
        const feat = root.querySelector('#redFeat'), sec = root.querySelector('#redSecret');
        const order = (list) => list.map((x, i) => [Math.random(), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
        const fo = order(FEATURES), so = order(SECRETS);
        feat.textContent = FEATURES[fo[0]];
        sec.textContent = SECRETS[so[0]];
        // Тексты выбираются один раз при заходе на страницу; по наведению, фокусу и нажатию строка только открывается
        [feat, sec].forEach((el) => {
          el.addEventListener('click', () => el.classList.toggle('open'));
          el.addEventListener('blur', () => el.classList.remove('open'));
        });
      }

      const authRow = root.querySelector('#authRow'), resume = root.querySelector('#resume');
      const put = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
      const community = root.querySelector('#community');
      const renderAuth = () => {
        const me = Net.me || {}, pr = me.providers || {};
        put(community, me.community ? `Нет компании? <a href="${esc(me.community)}" target="_blank" rel="noopener noreferrer">${DISCORD} Найдите её в нашем Discord</a>` : '');
        const a = me.account;
        if (a) {
          put(authRow, `<p class="auth-note">Вы вошли как <b>${esc(a.name)}</b> (${a.provider === 'discord' ? 'Discord' : a.provider === 'google' ? 'Google' : 'тест'}). Если вы выпадете из игры, место за вами сохранится на любом устройстве.</p>`);
          return;
        }
        if (Net.mode === 'demo') {
          put(authRow, `<div class="lbl">Вход</div><div class="auth-btns"><button class="btn" type="button" aria-disabled="true" data-demo-auth>${DISCORD} Discord</button><button class="btn" type="button" aria-disabled="true" data-demo-auth>${GOOGLE} Google</button></div><p class="auth-note">Вход через Discord и Google работает на сервере игры. В демо играем по нику.</p>`);
          return;
        }
        if (!pr.discord && !pr.google && !pr.dev) { put(authRow, ''); return; }
        put(authRow, `<div class="lbl">Можно войти, а можно и без этого</div><div class="auth-btns">${pr.discord ? `<a class="btn" href="/auth/discord">${DISCORD} Discord</a>` : ''}${pr.google ? `<a class="btn" href="/auth/google">${GOOGLE} Google</a>` : ''}${pr.dev ? '<a class="btn" href="/auth/dev?name=Тест">Тестовый вход</a>' : ''}</div><p class="auth-note">Без входа место за вами держится в этом браузере. Со входом вы вернётесь в игру с любого устройства.</p>`);
      };
      authRow.addEventListener('click', (e) => { if (e.target.closest('[data-demo-auth]')) toast('В демо входа нет, играйте по нику. На сервере работают Discord и Google.'); });
      const renderResume = (st) => {
        if (!st) { put(resume, ''); return; }
        const g = st.game;
        const playing = st.status === 'playing' && g && g.phase !== 'ended';
        const ended = g && g.phase === 'ended';
        const host = st.hostId === st.realMeId;
        const title = playing ? 'Вы в игре' : ended ? 'Партия окончена' : `Вы в комнате ${st.code}`;
        const sub = playing ? `Комната ${st.code}. ${phaseLabel(st)} Место за вами, пока вы не выйдете сами. Сейчас ход за вас делает автопилот.`
          : ended ? `Комната ${st.code} ещё открыта. ${host ? 'Закройте её на экране итогов, иначе игроки не смогут присоединиться к другой игре.' : 'Закрывает её ведущий, но выйти и зайти в другую игру можно и самому.'}`
          : 'Идёт сбор игроков. Ваше место сохранено.';
        put(resume, `<div class="resume-card" role="status"><div class="rc-top"><span class="rc-dot"></span><h3>${esc(title)}</h3></div><p>${esc(sub)}</p>
          <div class="rc-acts"><button class="btn btn-primary" data-resume="back">${playing ? 'Переподключиться' : ended ? 'Вернуться к итогам' : 'Вернуться в комнату'}</button><button class="btn btn-ghost" data-resume="leave">${playing ? 'Выйти из партии' : 'Покинуть комнату'}</button></div></div>`);
      };
      resume.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-resume]'); const st = App.state;
        if (!b || !st) return;
        if (b.dataset.resume === 'back') { location.hash = `#/room/${st.code}`; return; }
        const playing = st.status === 'playing' && st.game && st.game.phase !== 'ended';
        const ok = playing ? await UI.confirmBox({ title: 'Выйти из партии?', sub: 'За вас дальше будет играть автопилот. Вернуться в эту партию не получится, зато можно сразу зайти в другую комнату.', ok: 'Выйти', danger: true }) : true;
        if (ok) Net.call('room:leave');
      });
      this._renderAuth = renderAuth; this._renderResume = renderResume; this._nameIn = nameIn;
      renderAuth();
      renderResume(App.state);

      const need = () => {
        const v = nameIn.value.trim();
        if (!v) { nameIn.classList.add('shake'); setTimeout(() => nameIn.classList.remove('shake'), 400); nameIn.focus(); toast('Сначала представьтесь, детектив.', 'err'); return null; }
        ctx.store.set('detective.name', v);
        return v;
      };
      /* Если игрок уже сидит в другой комнате, спрашиваем, остаться там или выйти и продолжить. */
      const guarded = async (event, payload) => {
        let r = await Net.call(event, payload);
        if (!r.ok && r.code === 'in_room' && r.current) {
          const c = r.current;
          const what = c.status === 'playing' ? 'идёт партия' : c.status === 'lobby' ? 'идёт сбор игроков' : 'партия окончена';
          const pick = await UI.choose({
            title: `Вы уже в комнате ${c.code}`, sub: `Там ${what}. Войти в другую комнату можно, только выйдя из этой.`,
            items: [{ id: 'back', title: 'Вернуться в комнату', sub: 'Место за вами сохранено' }, { id: 'leave', title: 'Выйти из неё и продолжить', sub: c.status === 'playing' ? 'За вас дальше сыграет автопилот, вернуться будет нельзя' : (c.host ? 'Ведение перейдёт другому игроку' : 'Вы освободите место') }],
            cancel: 'Отмена',
          });
          if (pick === 'back') { location.hash = `#/room/${c.code}`; return null; }
          if (pick !== 'leave') return null;
          r = await Net.call(event, Object.assign({}, payload, { leave: true }));
        }
        return r;
      };
      const create = async () => { const n = need(); if (!n) return; const r = await guarded('room:create', { name: n }); if (!r) return; if (!r.ok) return fail(r); location.hash = `#/room/${r.code}`; };
      const join = async (code) => {
        const n = need(); if (!n) return;
        if (!code || code.length < 4) { if (codeIn) { codeIn.classList.add('shake'); setTimeout(() => codeIn.classList.remove('shake'), 400); codeIn.focus(); } toast('Введите код комнаты.', 'err'); return; }
        const r = await guarded('room:join', { code, name: n });
        if (!r) return;
        if (!r.ok) return fail(r);
        location.hash = `#/room/${r.code}`;
      };
      root.querySelector('#startForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const act = (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.act) || (ctx.route.code ? 'join' : (codeIn && codeIn.value ? 'join' : 'create'));
        if (act === 'join') join(ctx.route.code || (codeIn && codeIn.value)); else create();
      });
      root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
        if (b.type === 'submit') return;
        e.preventDefault();
        if (b.dataset.act === 'create') create(); else join(ctx.route.code || (codeIn && codeIn.value));
      }));

      const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('seen'); io.unobserve(en.target); } }), { threshold: 0.12 }) : null;
      root.querySelectorAll('.reveal').forEach((el) => { if (io) io.observe(el); else el.classList.add('seen'); });
      this._io = io;
    },
    update(st) {
      if (this._renderResume) { this._renderResume(st); this._renderAuth(); }
      const acc = Net.me && Net.me.account;
      if (this._nameIn && acc && (!this._nameIn.value || (acc.custom && document.activeElement !== this._nameIn))) this._nameIn.value = acc.name.slice(0, 18);
    },
    unmount() { if (this._io) this._io.disconnect(); },
  };
})();
