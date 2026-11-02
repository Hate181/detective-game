/* Главная страница: создать комнату, войти по коду, коротко о правилах. */
(function () {
  const { esc, icon, toast, fail } = UI;
  const Content = UI.Content;
  const Screens = (window.Screens = window.Screens || {});

  const WHO = { swap: L('У двоих, кому повезёт'), lab: L('Когда исключили невиновного'), trail: L('Когда исключили преступника') };
  const cardsRow = ['warrant', 'testimony', 'advocate', 'swap', 'lab', 'trail'].map((k) => {
    const c = Content.CARDS[k];
    return `<div class="acard ${WHO[k] ? 'twist' : ''} reveal"><h4>${esc(c.name)}</h4><p>${esc(c.desc)}</p><div class="who"><span class="badge ${WHO[k] ? 'yellow' : ''}">${esc(WHO[k] || L('В колоде'))}</span></div></div>`;
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
    'Вставляет «короче» в каждое предложение',
    'Записывает кружочки вместо сообщений',
    'Отвечает «+» на любой вопрос',
    'Спорит с навигатором и проигрывает',
    'Ест шаурму вилкой и ножом',
    'Хранит пакет с пакетами',
    'Здоровается с котами на улице',
    'Смеётся над рилсами без звука',
    'Не вынимает наушники даже во сне',
    'Любой разговор сводит к «Сталкеру»',
    'Пишет «спс» и «пж» даже бабушке',
    'Фотографирует закаты из окна маршрутки',
    'Уверен, что шаверма и шаурма разные блюда',
    'Каждую неделю «начинает с понедельника»',
    'Объясняет новости по одному заголовку',
    'Кладёт телефон только экраном вниз',
    'Включает субтитры даже на русском',
    'Говорит «ну это база» и сам смеётся',
    'Носит ключи на карабине с плюшевым мишкой',
    'Ставит лайки собственным сторис',
    'На курьеров никогда не пи*дит',
    'Постоянно говорит «Вот такая х*йня, собачка»',
    'Украл бабушкину пенсию на дэп',
    'Спамит гифками, которые смешные только для него',
    'Купил 12 танго',
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
    'Плачет на «Короле Льве» каждый раз',
    'Ведёт аккаунт кота на десять тысяч подписчиков',
    'Платит за четыре стриминга и смотрит только ютуб',
    'Ждёт посылку с маркетплейса с прошлого года',
    'Знает все танцы из тиктока, но стесняется',
    'Считает «Шрека» главным фильмом жизни',
    'Школьные фото до сих пор висят у мамы в «Одноклассниках»',
    'Всю школу сам расписывался за родителей в дневнике',
    'Пишет поздравления в семейный чат нейросетью',
    'Выигрыш 100 рублей в лотерею считает главным успехом',
    'Панически боится голубей',
    'Разговаривает с цветами и дал им имена',
    'Знает наизусть все серии «Смешариков»',
    'Сохранил триста рецептов и ни разу не готовил',
    'Пересматривает «Интернов» в пятый раз',
    'Смотрит сторис бывших с фейкового аккаунта',
    'Дома ходит в костюме динозавра',
    'Записывает голосовые самому себе',
    'Гуглит, как правильно: «вообщем» или «в общем»',
    'Спит с плюшевым крокодилом Геной',
    'Не будет работать, будет тебя моггать',
    'Купил ВинРар',
    'Искренне кайфует от Серёги Пирата',
    'Нажимает «Мой компьютер», а он не моет',
    'Считает анекдот про гвозди самым смешным в мире',
  ];

  // Английские строки для примера карточки: свои мемы, а не перевод русских.
  const FEATURES_EN = [
    "Says “no cap” unironically",
    "TikToker, liker and streamer",
    "Rates every meal out of ten on Google Maps",
    "Likes posts at 3 a.m.",
    "Energy drink for breakfast, every day",
    "Answers every question with “it is what it is”",
    "Plays phonk at full volume in the car",
    "Scrolls the feed even at funerals",
    "Calls everyone “bro”, including grandma",
    "Wears a hoodie in a sauna",
    "Socks with sliders, all year round",
    "Replies with memes instead of words",
    "Photographs food before tasting it",
    "Shouts “Let’s go!” at the slightest excuse",
    "Has been “one more game”-ing since 2012",
    "Can quote every line of “The Office”",
    "Carries a banana just in case",
    "Wears sunglasses at night",
    "Watches every series at 2x speed",
    "Crunches crisps in the quietest moment",
    "Never answers messages but watches every story",
    "Types in caps lock when nervous",
    "Always “five minutes away”",
    "Sends twenty-minute voice notes",
    "Writes “hahaha” with a straight face",
    "Follows forty cat accounts",
    "Opens the fridge for inspiration",
    "Still has a MySpace password memorised",
    "Claps when the plane lands",
    "Has a podcast nobody listens to",
    "Says “literally” about things that aren’t",
    "Uses Comic Sans on purpose",
    "Reads the comments before the article",
    "Has 46 tabs open and needs all of them",
    "Narrates their own life in third person",
    "Gives everything a rating out of ten",
    "Says “we should hang out” and means never",
    "Owns six ring lights",
    "Leaves voice notes to say “ok”",
    "Mutes the group chat, reads it anyway",
    "Knows every Shrek line by heart",
    "Wears AirPods in the shower",
    "Calls every dog “buddy”",
    "Laughs at their own jokes first",
    "Uses three exclamation marks minimum!!!",
    "Puts pineapple on pizza and defends it",
    "Always sits with their back to the wall",
    "Has a 400-day Duolingo streak and no Spanish",
    "Hums the Netflix intro sound",
    "Never closes a cupboard door",
  ];
  const SECRETS_EN = [
    "Went to Bali “to find themselves” and found a sunburn",
    "Biggest fan of a YouTuber with 300 subscribers",
    "Has an alt account just for arguing",
    "Cried at a Pixar short last week",
    "Believes in flat Earth on weekends",
    "Spent a month’s salary on a mobile game",
    "Secretly listens to Nickelback and sings along",
    "Is in a group chat called “Black Friday Forever”",
    "Bought a “Get Rich in a Week” course on credit",
    "Keeps 200 screenshots of chats “just in case”",
    "Still dreams of becoming Spider-Man",
    "Follows a “sigma mindset” coach and takes it seriously",
    "Rewatches the Game of Thrones finale and gets angry all over again",
    "Their Tamagotchi has survived three years of neglect",
    "Knows the Wi-Fi password of every neighbour",
    "Bought an ape NFT with their last money and shows it to no one",
    "Taps a crypto hamster for coins every morning",
    "Has a secret fan account for their cat",
    "Googled “how to look busy at work” today",
    "Lost a bet and still owes someone a kebab",
    "Pretends to understand wine",
    "Faked a British accent for a whole holiday",
    "Has never finished a book but owns forty",
    "Was banned from a Minecraft server in 2014",
    "Writes fan fiction under a pseudonym",
    "Got a tattoo of a meme that is now dead",
    "Still uses Internet Explorer for one website",
    "Owns a framed photo of Keanu Reeves",
    "Has a playlist called “Main Character Energy”",
    "Asked ChatGPT for relationship advice",
    "Bought a gym membership and went twice",
    "Talks to their houseplants by name",
    "Still has their ex’s Netflix password",
    "Secretly loves pineapple on pizza",
    "Sleeps with a plushie named Gerald",
    "Lied about reading the terms and conditions",
    "Owes the library a book since 2009",
    "Practised an Oscar speech in the mirror",
    "Has watched Twilight more than five times",
    "Once tried to sell a used sock on eBay",
    "Has a drawer full of soy sauce packets",
    "Pretends to be on a call to avoid people",
    "Took a personality quiz to choose a career",
    "Is a level 80 wizard in a game nobody plays any more",
    "Signed up for a marathon and told everyone, then didn’t run",
    "Collects hotel shampoos",
    "Wrote a 3,000-word review of a toaster",
    "Still believes the Furby was listening",
    "Has a secret second LinkedIn",
    "Thinks “Inception” is a documentary",
  ];

  const html = (code) => `
<section class="hero"><div class="wrap hero-grid">
  <div>
    <p class="eyebrow">${L('Онлайн-детектив · 2–10 человек · около 30 минут')}</p>
    <h1 aria-label="Detective Game">${'DETECTIVE'.split('').map((ch, i) => `<span style="animation-delay:${0.05 * i}s" aria-hidden="true">${ch}</span>`).join('')}<span class="h1-game" style="animation-delay:.55s" aria-hidden="true">Game</span></h1>
    <p class="lead">${L('Убийца среди вас. Осталось понять кто.')}</p>
    <div id="resume"></div>
    <form class="start-card" id="startForm" autocomplete="off">
      ${code ? `<div class="resume"><span>${L('Вас зовут в комнату')} <b class="mono">${esc(code)}</b>.</span></div>` : ''}
      <div class="auth-row" id="authRow"></div>
      ${code
        ? `<button class="btn btn-primary btn-block" type="submit" data-act="join">${L('Войти в комнату')}</button>
           <div class="or">${L('или')}</div><button class="btn btn-block" type="button" data-act="create">${L('Открыть своё дело')}</button>`
        : `<button class="btn btn-primary btn-block" type="submit" data-act="create">${L('Открыть дело')}</button>
           <div class="or">${L('или войти по коду')}</div>
           <div class="row2"><input class="input code-in" id="codeIn" maxlength="6" placeholder="${L('КОД')}" aria-label="${L('Код комнаты')}"><button class="btn" type="button" data-act="join">${L('Войти')}</button></div>`}
      <p class="community" id="community"></p>
    </form>
  </div>
  <div class="paper file-card" aria-label="${L('Пример карточки игрока')}">
    <span class="stamp">${L('Секретно')}</span>
    <div class="label">${L('Карточка игрока · пример')}</div>
    <h3>${L('Мира, бухгалтер')}</h3>
    <dl class="rows" style="margin:0">
      <div><dt>${L('Связь с жертвой')}</dt><dd>${L('Деньги, которые жертва должна вернуть')}</dd></div>
      <div><dt>${L('Алиби')}</dt><dd>${L('Оранжерея, с 23:05 до 23:50')}</dd></div>
      <div><dt>${L('Особенность')}</dt><dd><span class="redact" id="redFeat" tabindex="0" role="button" aria-label="${L('Особенность скрыта. Наведите или нажмите, чтобы прочитать')}"></span></dd></div>
      <div><dt>${L('Секрет')}</dt><dd><span class="redact" id="redSecret" tabindex="0" role="button" aria-label="${L('Секрет скрыт. Наведите или нажмите, чтобы прочитать')}"></span></dd></div>
      <div><dt>${L('Цель')}</dt><dd>${L('Добиться исключения игрока Игорь')}</dd></div>
    </dl>
    <p class="fhint">${L('Наведите на чёрные строки, на телефоне нажмите')}</p>
    <div class="clue"><b>${L('Улика 1.')}</b> ${L('Сейф открыли без взлома. Преступнику был известен код.')}
      <div class="fchips"><span class="chip hit">${L('Знает код сейфа')}</span><span class="chip">${L('Подходит двоим')}</span></div></div>
  </div>
</div></section>

<section class="section about"><div class="wrap">
  <div class="section-head reveal"><p class="eyebrow">${L('Об игре')}</p><h2>${L('Найдите убийцу, пока он не нашёл вас')}</h2>
    <p>${L('Каждый за этим столом был связан с жертвой. Убийца и его сообщник сидят среди вас, и пока вы ищете их, они по одному убирают свидетелей. Вычислите и устраните обоих, пока за столом ещё есть кому им помешать.')}</p>
    <p>${L('Как играть, решаете вы. Можно работать на команду, а можно гнуть свою линию: у каждого в карточке есть личная цель, и за неё дают очки. Но чтобы дожить до конца, говорить придётся всем, и говорить убедительно.')}</p>
    <p>${L('Если вас от двух до пяти, подозреваемыми станут персонажи дела, а кто-то из вас может тайно работать на преступников.')}</p></div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head reveal"><p class="eyebrow">${L('Карты действий')}</p><h2>${L('У каждого по одной, а по ходу дела ещё')}</h2><p>${L('Кто держит «Подмену улики», не знает никто. Когда команда теряет человека, она получает карту в ответ, поэтому отстающие ещё могут отыграться.')}</p></div>
  <div class="cards-row">${cardsRow}</div>
</div></section>`;

  const DISCORD = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.6 5.3A16.5 16.5 0 0 0 15.5 4l-.2.4a15 15 0 0 1 3.7 1.9 13.6 13.6 0 0 0-12.2-.1A15 15 0 0 1 10.5 4.4L10.3 4a16.5 16.5 0 0 0-4.1 1.3C3.6 9.200 2.900 13 3.200 16.700a16.600 16.600 0 0 0 5 2.500l1.100-1.700a10.700 10.700 0 0 1-1.700-.8l.4-.3a11.800 11.800 0 0 0 10 0l.4.3c-.5.3-1.100.6-1.700.8l1.100 1.700a16.500 16.500 0 0 0 5-2.500c.4-4.300-.7-8-2.900-11.400ZM9.500 14.500c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2Zm5 0c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2Z"/></svg>';
  const phaseLabel = (st) => {
    const g = st.game;
    if (st.status === 'lobby' || !g) return L('Идёт сбор игроков.');
    if (g.phase === 'ended') return L('Партия окончена.');
    return g.round > 0 ? L('Раунд {0} из 4.', g.round) : L('Идёт вводная.');
  };

  Screens.home = {
    mount(root, ctx) {
      document.documentElement.classList.add('js-anim');
      root.innerHTML = html(ctx.route.code || '');
      const codeIn = root.querySelector('#codeIn');
      if (codeIn) codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

      // Закрашенные строки примера карточки
      {
        const feat = root.querySelector('#redFeat'), sec = root.querySelector('#redSecret');
        const order = (list) => list.map((x, i) => [Math.random(), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
        // Недавно показанные строки не повторяем: браузер помнит последние 25 из каждого списка.
        const pick = (list, key) => {
          let seen = [];
          try { seen = JSON.parse(localStorage.getItem(key) || '[]'); if (!Array.isArray(seen)) seen = []; } catch (e) { /* хранилище недоступно */ }
          const ord = order(list);
          const i = ord.find((x) => !seen.includes(list[x])) ?? ord[0];
          try { localStorage.setItem(key, JSON.stringify([list[i]].concat(seen).slice(0, 25))); } catch (e) { /* не запомним */ }
          return list[i];
        };
        const en = I18N.lang === 'en';
        feat.textContent = en ? pick(FEATURES_EN, 'detective.seen.feat.en') : pick(FEATURES, 'detective.seen.feat');
        sec.textContent = en ? pick(SECRETS_EN, 'detective.seen.secret.en') : pick(SECRETS, 'detective.seen.secret');
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
        const me = Net.me || {};
        put(community, me.community ? `${L('Нет компании?')} <a href="${esc(me.community)}" target="_blank" rel="noopener noreferrer">${L('{0} Найдите её в нашем Discord', DISCORD)}</a>` : '');
        const a = me.account;
        if (a) {
          put(authRow, `<p class="as-who">${a.avatar ? `<img class="who-av" src="${esc(a.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="who-av" style="background:${esc(App.hue(a.name))}">${esc(UI.initial(a.name))}</span>`}<span>${L('Вы играете как')} <b>${esc(a.name)}</b>. <a href="#/profile">${L('Личный кабинет')}</a></span></p>`);
          return;
        }
        const g = App.guestName();
        put(authRow, `<p class="as-who"><span class="who-av" style="background:${esc(App.hue(g))}">${L('Г')}</span><span>${L('Вы зайдёте как')} <b>${esc(g)}</b></span></p>
          <div class="lbl">${L('Войдите, чтобы играть под своим именем')}</div>${App.loginButtons()}`);
      };
      const renderResume = (st) => {
        if (!st) { put(resume, ''); return; }
        const g = st.game;
        const playing = st.status === 'playing' && g && g.phase !== 'ended';
        const ended = g && g.phase === 'ended';
        const host = st.hostId === st.realMeId;
        if (st.watching) {
          put(resume, `<div class="resume-card" role="status"><div class="rc-top"><span class="rc-dot"></span><h3>${L('Вы смотрите партию')}</h3></div><p>${esc(L('Комната {0}. {1}', st.code, phaseLabel(st)))}</p>
            <div class="rc-acts"><button class="btn btn-primary" data-resume="back">${L('Вернуться к партии')}</button><button class="btn btn-ghost" data-resume="leave">${L('Перестать смотреть')}</button></div></div>`);
          return;
        }
        const title = playing ? L('Вы в игре') : ended ? L('Партия окончена') : L('Вы в комнате {0}', st.code);
        const sub = playing ? L('Комната {0}. {1} Место за вами, пока вы не выйдете сами. Сейчас ход за вас делает автопилот.', st.code, phaseLabel(st))
          : ended ? L('Комната {0} ещё открыта. {1}', st.code, host ? L('Закройте её на экране итогов, иначе игроки не смогут присоединиться к другой игре.') : L('Закрывает её ведущий, но выйти и зайти в другую игру можно и самому.'))
          : L('Идёт сбор игроков. Ваше место сохранено.');
        put(resume, `<div class="resume-card" role="status"><div class="rc-top"><span class="rc-dot"></span><h3>${esc(title)}</h3></div><p>${esc(sub)}</p>
          <div class="rc-acts"><button class="btn btn-primary" data-resume="back">${playing ? L('Переподключиться') : ended ? L('Вернуться к итогам') : L('Вернуться в комнату')}</button><button class="btn btn-ghost" data-resume="leave">${playing ? L('Выйти из партии') : L('Покинуть комнату')}</button></div></div>`);
      };
      resume.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-resume]'); const st = App.state;
        if (!b || !st) return;
        if (b.dataset.resume === 'back') { location.hash = `#/room/${st.code}`; return; }
        const playing = st.status === 'playing' && st.game && st.game.phase !== 'ended' && !st.watching;
        const ok = playing ? await UI.confirmBox({ title: L('Выйти из партии?'), sub: L('За вас дальше будет играть автопилот. Вернуться в эту партию не получится, зато можно сразу зайти в другую комнату.'), ok: L('Выйти'), danger: true }) : true;
        if (ok) Net.call('room:leave');
      });
      this._renderAuth = renderAuth; this._renderResume = renderResume;
      renderAuth();
      renderResume(App.state);

      /* Если игрок уже сидит в другой комнате, спрашиваем, остаться там или выйти и продолжить. */
      const guarded = async (event, payload) => {
        let r = await Net.call(event, payload);
        if (!r.ok && r.code === 'in_room' && r.current) {
          const c = r.current;
          const what = c.status === 'playing' ? L('идёт партия') : c.status === 'lobby' ? L('идёт сбор игроков') : L('партия окончена');
          const pick = await UI.choose({
            title: L('Вы уже в комнате {0}', c.code), sub: L('Там {0}. Войти в другую комнату можно, только выйдя из этой.', what),
            items: [{ id: 'back', title: L('Вернуться в комнату'), sub: L('Место за вами сохранено') }, { id: 'leave', title: L('Выйти из неё и продолжить'), sub: c.status === 'playing' ? L('За вас дальше сыграет автопилот, вернуться будет нельзя') : (c.host ? L('Ведение перейдёт другому игроку') : L('Вы освободите место')) }],
            cancel: L('Отмена'),
          });
          if (pick === 'back') { location.hash = `#/room/${c.code}`; return null; }
          if (pick !== 'leave') return null;
          r = await Net.call(event, Object.assign({}, payload, { leave: true }));
        }
        return r;
      };
      const create = async () => { const r = await guarded('room:create', {}); if (!r) return; if (!r.ok) return fail(r); location.hash = `#/room/${r.code}`; };
      const join = async (code) => {
        if (!code || code.length < 4) { if (codeIn) { codeIn.classList.add('shake'); setTimeout(() => codeIn.classList.remove('shake'), 400); codeIn.focus(); } toast(L('Введите код комнаты.'), 'err'); return; }
        const r = await guarded('room:join', { code });
        if (!r) return;
        if (!r.ok) return fail(r);
        if (r.watching) toast(L('Партия уже идёт. Вы зашли зрителем.'));
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
    },
    unmount() { if (this._io) this._io.disconnect(); },
  };
})();
