/* Экран партии v2: сверху очередь людей, в центре одна сцена с главным действием, под ней улики.
   Справа свернуть можно карточку, ниже журнал. Ведущий листает фазы кнопкой внизу. На телефоне три вкладки. */
(function () {
  const { esc, icon, hueOf, fmtClock, setHtml, toast, fail } = UI;
  // В партии у каждого аватара номер места: i — индекс игрока в порядке стола, номер на единицу больше.
  // Фото игроков по месту за столом: заполняется при каждой отрисовке из состояния комнаты.
  let photoAt = {};
  const avatar = (name, i, cls = '') => UI.avatar(name, i, cls, i == null ? null : i + 1, i == null ? null : photoAt[i]);
  const Content = UI.Content;
  const T = Content.TRAITS;
  const Screens = (window.Screens = window.Screens || {});

  const Q = (s) => I18N.q(s);
  const alibiTxt = (c) => (c ? `${Q(c.loc)}, ${c.from}–${c.to}` : L('ещё не выбрано'));
  const myVal = (card, t) => ({ profession: card.profession, habit: card.habit, relation: card.relation, motive: card.motive, alibi: alibiTxt(card.alibi.claim), secret: card.secret, goal: card.goal }[t]);
  const ROLE = {
    innocent: { cls: 'role-innocent', name: L('Невиновный'), hint: L('Найдите убийцу и не дайте исключить своих.'), gang: L('Среди вас убийца и его сообщник. Чтобы закрыть дело, исключить нужно обоих. Если их станет столько же, сколько вас, они победят.') },
    killer: { cls: 'role-killer', name: L('Убийца'), hint: L('Не выдайте себя. Улики ниже указывают на вас.'), gang: L('Не выдайте себя и сообщника. Вам подходят три улики из четырёх, сообщнику тоже три, а кому-то из невиновных столько же.') },
    accomplice: { cls: 'role-accomplice', name: L('Сообщник'), hint: L('Вы знаете убийцу. Уводите подозрения.'), gang: L('Вы знаете убийцу, и вас обоих ищут. Каждому из вас подходят три улики из четырёх. Вы победите, если хоть один останется в игре или если вас станет столько же, сколько невиновных.') },
    // Малый состав: люди ведут следствие, подозреваемые персонажи дела.
    detective: { cls: 'role-innocent', name: L('Следователь'), hint: L('Среди шести персонажей убийца и сообщник. Задержите обоих раньше, чем за решёткой окажутся двое невиновных.'), mole: L(' Один из сидящих с вами за столом крот: он знает преступников и уводит следствие в сторону.') },
    mole: { cls: 'role-killer', name: L('Крот'), hint: L('Вы работаете на преступников. Уводите следствие к невиновным, пока за решёткой не окажутся двое из них. В конце все попробуют вычислить крота.') },
  };
  const VIA = { vote: L('Больше всего голосов.'), runoff: L('Решило переголосование.'), random: L('Голоса разделились поровну, задержала полиция.'), final: L('Итог финального голосования.') };
  const PASSIVE = ['advocate', 'trail'];
  // Зритель: своей карточки нет, кнопок нет. Экран тот же, что у игроков, только без личного.
  const WATCHER = { id: null, status: 'watch', role: null, card: null, cards: [], notes: [], revealed: {}, ready: false, isHost: false, can: { reveal: [], locked: [], card: false, vote: false, endturn: false, endaccuse: false, back: false } };
  const HOST_BTN = {
    brief: [L('Начать дело'), L('Откроется первая улика')],
    clue: [L('К рассказам'), L('Каждый расскажет о себе по очереди')],
    mole: [L('Подвести итог'), L('Кто крот, решит большинство')],
    turns: [L('Передать слово дальше'), L('Когда рассказ закончен')],
    talk: [L('К обвинениям'), L('Когда обсуждение выдохлось')],
    accuse: [L('Следующий'), L('Когда минута прошла')],
    vote: [L('Подвести итог'), L('Решает большинство')],
    result: [L('Дальше'), L('К следующему раунду')],
    poll: [L('Подвести итог'), L('Слово защиты получат самые подозреваемые')],
    defense: [L('Дальше'), L('Следующее слово')],
    final: [L('Подвести итог'), L('Исключённого не вернуть')],
    accomplice: [L('Пропустить'), L('Если сообщник молчит')],
  };

  Screens.game = {
    mount(root) {
      root.innerHTML = `<div class="game" data-tab="stage" id="game">
        <header class="g-top" id="gTop"></header>
        <div class="g-main">
          <section class="g-stage">
            <section class="case-file" id="gCase" aria-label="${L('Обстоятельства дела')}"></section>
            <div class="queue" id="gQueue" aria-label="${L('Игроки и очередь рассказов')}"></div>
            <div class="stage panel" id="gStage"></div>
            <div class="clues-row" id="gClues"></div>
          </section>
          <aside class="g-side">
            <details class="my panel" id="pCard" open></details>
            <section class="journal panel" id="pLog" aria-label="${L('Журнал')}"></section>
          </aside>
        </div>
        <div class="host-bar" id="gHost"></div>
        <nav class="g-nav" id="gNav" aria-label="${L('Разделы')}">
          <button data-a="tab" data-tab="stage" class="on">${L('Сцена')}<i class="dot" hidden></i></button>
          <button data-a="tab" data-tab="card">${L('Карточка')}</button>
          <button data-a="tab" data-tab="journal">${L('Журнал')}<i class="dot" hidden></i></button>
        </nav>
        <div id="gOv"></div>
        <div id="gDock"></div>
      </div>`;
      this.root = root.firstElementChild;
      this.seenClues = null; this.phaseKey = null; this.gameKey = null; this.lastChat = 0; this.unread = false;
      this.dockOpen = false; this.godOpen = false; this.lastSpeaker = null; this.queueTouched = 0;
      const touched = () => { this.queueTouched = Date.now(); };
      ['touchstart', 'touchmove', 'wheel', 'pointerdown'].forEach((t) => this.root.querySelector('#gQueue').addEventListener(t, touched, { passive: true }));
      this.chat = UI.makeLog(this.root.querySelector('#pLog'));
      this.root.addEventListener('click', (e) => this.onClick(e));
      this.root.addEventListener('toggle', (e) => { if (e.target.id === 'dockD') this.dockOpen = e.target.open; if (e.target.id === 'godD') this.godOpen = e.target.open; if (e.target.id === 'pCard') this.cardOpen = e.target.open; }, true);
      this.root.addEventListener('change', async (e) => {
        if (e.target.dataset && e.target.dataset.a === 'speed') {
          const r = await Net.call('admin:room', { code: this.st.code, action: 'speed', value: Number(e.target.value) });
          if (!r.ok) fail(r);
        }
      });
      this.cardOpen = true;
      this.clock = setInterval(() => this.tickClocks(), 250);
    },
    unmount() { clearInterval(this.clock); },

    async act(action, payload) {
      const r = await Net.call('game:act', { action, payload: payload || {} });
      if (!r.ok) fail(r);
      return r;
    },

    /* ---------- Обновление ---------- */
    update(st) {
      const g = st.game;
      this.st = st; this.g = g;
      if (!g) return;
      const me = g.me || (st.watching ? WATCHER : null);
      if (!me) return;
      this.me = me;
      this.watch = me === WATCHER;
      this.root.classList.toggle('watching', this.watch);
      if (this.watch && this.root.dataset.tab === 'card') this.root.dataset.tab = 'stage';
      this.idx = {}; this.byId = {}; this.conn = {};
      g.players.forEach((p, i) => { this.idx[p.id] = i; this.byId[p.id] = p; });
      st.players.forEach((p) => { this.conn[p.id] = p; });
      // Малый состав: люди не сидят в ленте персонажей, у них свой ряд в шапке и аватар без номера места.
      this.small = !!g.small; this.tIdx = {};
      if (g.small) g.small.team.forEach((p, i) => { this.tIdx[p.id] = i; this.byId[p.id] = p; });
      photoAt = {}; g.players.forEach((p, i) => { if (this.conn[p.id] && this.conn[p.id].photo) photoAt[i] = this.conn[p.id].photo; });
      const key = `${st.code}:${g.players.map((p) => p.id).join()}:${g.small ? g.small.team.map((p) => p.id).join() : ''}:${g.case.title}:${g.god ? g.god.seed : ''}`;
      if (key !== this.gameKey) { this.gameKey = key; this.seenClues = null; this.phaseKey = null; this.lastChat = 0; }

      const pk = `${g.phase}:${g.round}:${g.turn ? g.turn.idx : ''}:${g.accuse ? g.accuse.idx : ''}:${g.defense ? g.defense.idx : ''}:${g.vote ? (g.vote.runoff ? 'r' : '') + g.vote.kind : ''}`;
      const phaseChanged = !!this.phaseKey && this.phaseKey !== pk;
      if (phaseChanged) this.onPhase(g);
      this.phaseKey = pk;

      this.renderTop(st); this.renderCase(); this.renderQueue(); this.renderStage(phaseChanged || !this.stageDrawn); this.renderClues(); this.renderCard(); this.renderHost(st); this.renderOverlay(); this.renderDock(st);
      this.stageDrawn = true;
      this.chat.update(g.feed, { gameKey: key, nameOf: (id) => (this.byId[id] ? this.byId[id].name : '?'), status: me.status === 'out' ? L('вы вне игры') : this.watch ? L('вы зритель') : '' });
      this.renderNav();
      this.tickClocks();
    },

    /** Аватар по id: персонаж или игрок за столом с номером места, человек малого состава без номера. */
    av(id, cls = '') {
      const p = this.byId[id] || { name: '?' };
      if (this.tIdx && this.tIdx[id] !== undefined) { const c = this.conn[id]; return UI.avatar(p.name, 10 + this.tIdx[id], cls, null, c && c.photo); }
      return avatar(p.name, this.idx[id], cls);
    },
    /** Кто за столом ходит и голосует: все игроки или, в малом составе, люди. */
    people() { return this.small ? this.g.small.team : this.g.players; },

    onPhase(g) {
      if (g.phase === 'mole') toast(L('Кто из вас крот? Назовите одного.'));
      else if (this.small && g.phase === 'turns' && g.turn && g.turn.speakerId === this.me.id) toast(L('Ваш ход: откройте строку одного из персонажей.'));
      else if (g.phase === 'clue') toast(g.finale ? L('Последний раунд. Найдены все улики.') : L('Раунд {0}. Найдена новая улика.', g.round));
      else if (g.phase === 'turns' && g.turn && g.turn.speakerId === this.me.id) toast(L('Ваше слово.'));
      else if (g.phase === 'accuse' && g.accuse && g.accuse.speakerId === this.me.id) toast(L('Ваша обвинительная минута.'));
      else if (g.phase === 'vote') toast(g.vote && g.vote.runoff ? L('Ничья. Переголосование.') : L('Голосование.'));
      else if (g.phase === 'defense' && g.defense && g.defense.speaker === this.me.id) toast(L('Ваше слово защиты.'));
      if (this.root.dataset.tab !== 'stage' && ['turns', 'accuse', 'vote', 'poll', 'final', 'clue', 'result', 'defense'].includes(g.phase)) { this.root.dataset.tab = 'stage'; }
    },

    renderNav() {
      const g = this.g, me = this.me;
      const tab = this.root.dataset.tab;
      if (tab === 'journal') this.unread = false;
      const needs = (me.can.reveal.length > 0) || (me.can.vote && !(g.vote && g.vote.my)) || (me.can.molevote && !(g.small.moleVote && g.small.moleVote.my)) || (g.phase === 'turns' && g.turn && g.turn.speakerId === me.id) || (g.phase === 'accuse' && g.accuse && g.accuse.speakerId === me.id);
      const dots = this.root.querySelectorAll('#gNav .dot');
      dots[0].hidden = !(needs && tab !== 'stage'); dots[1].hidden = !(this.unread && tab !== 'journal');
      this.root.querySelectorAll('#gNav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    },

    /* ---------- Верхняя панель ---------- */
    renderTop(st) {
      const g = this.g;
      const fin = g.finale;
      const crim = g.criminals ? ` ${L('· преступников на свободе: {0} из {1}', g.criminals.left, g.criminals.total)}` : '';
      const eyebrow0 = g.phase === 'brief' ? L('Вводная') : g.phase === 'verdict' || g.phase === 'accomplice' ? L('Дело закрывается')
        : g.phase === 'mole' ? L('Дело закрыто')
        : g.phase === 'turns' && g.turn ? L('{0} · {1} {2} из {3}', fin ? L('Финал') : L('Раунд {0} из {1}', g.round, g.rounds), this.small ? L('ход') : L('рассказ'), g.turn.idx + 1, g.turn.total)
        : g.phase === 'accuse' && g.accuse && !g.accuse.done ? L('{0} · обвинение {1} из {2}', fin ? L('Финал') : L('Раунд {0} из {1}', g.round, g.rounds), g.accuse.idx + 1, g.accuse.total)
          : `${fin ? L('Финал') : L('Раунд {0} из {1}', g.round, g.rounds)}`;
      const eyebrow = g.phase === 'brief' || g.phase === 'verdict' ? eyebrow0 : eyebrow0 + crim;
      const title = {
        brief: esc(g.case.title), clue: g.finale ? `${L('Последние <em>улики</em>')}` : this.small && g.round === 1 ? `${L('Первые <em>улики</em>')}` : `${L('Новая <em>улика</em>')}`, turns: this.small ? `${L('Круг <em>показаний</em>')}` : `${L('Круг <em>рассказов</em>')}`, mole: `${L('Кто <em>крот</em>?')}`, talk: `<em>${L('Обсуждение')}</em>`, accuse: `${L('Обвинительная <em>минута</em>')}`,
        vote: g.vote && g.vote.runoff ? `<em>${L('Переголосование')}</em>` : `<em>${L('Голосование')}</em>`, result: `${L('Итог <em>раунда</em>')}`, poll: `${L('Тайный <em>опрос</em>')}`,
        defense: `${L('Слово <em>защиты</em>')}`, final: `${L('Финальное <em>голосование</em>')}`, verdict: `<em>${L('Приговор')}</em>`, accomplice: `${L('Последний <em>шанс</em>')}`,
      }[g.phase] || '';
      const pips = Array.from({ length: g.rounds }, (_, i) => {
        const n = i + 1;
        const cls = (n < g.round || (n === g.round && ['verdict', 'accomplice'].includes(g.phase))) ? 'done' : n === g.round && g.phase !== 'brief' ? 'now' : '';
        return `<i class="${cls} ${n === g.rounds ? 'final' : ''}" title="${n === g.rounds ? L('Финал') : L('Раунд {0}', n)}"></i>`;
      }).join('');
      const eye = st.watchers ? `<span class="watch-n" title="${L('Зрители: {0}', st.watchers)}" aria-label="${L('Зрители: {0}', st.watchers)}">${icon('eye')}<b>${st.watchers}</b></span>` : '';
      const dc = st.settings && st.settings.discord ? `<a class="dc-btn" href="${esc(st.settings.discord)}" target="_blank" rel="noopener noreferrer" title="${L('Голосовой чат партии')}">${icon('discord')}<span>Discord</span></a>` : '';
      setHtml(this.root.querySelector('#gTop'), `
        <div class="g-title"><p class="eyebrow">${esc(eyebrow)}${g.paused ? L(' · пауза') : ''}</p><h2>${title}</h2></div>
        <div class="pips" aria-label="${L('Раунды')}">${pips}</div>
        <div class="g-right">${this.teamRow()}${eye}${dc}<button class="leave-btn" data-a="quit" title="${L('Выйти из игры')}" aria-label="${L('Выйти из игры')}">×</button><div class="timer" id="gTimer" title="${g.clock && g.clock.state !== 'run' ? L('Часы стоят: отсчёт запускает ведущий') : g.manual ? L('Ориентир по времени: ведущий листает сам') : L('Время фазы')}"><svg viewBox="0 0 56 56"><circle class="bg" cx="28" cy="28" r="24"/><circle class="fg" cx="28" cy="28" r="24" stroke-dasharray="150.8" stroke-dashoffset="0"/></svg><b>0:00</b></div></div>`);
    },

    /* Малый состав: люди за столом маленьким рядом в шапке. Видно, чей ход и кто уже проголосовал. */
    teamRow() {
      if (!this.small) return '';
      const g = this.g;
      const voting = (!!g.vote && ['vote', 'poll', 'final'].includes(g.phase)) || g.phase === 'mole';
      return `<div class="team-row" aria-label="${L('За столом')}">${g.small.team.map((p) => {
        const c = this.conn[p.id], off = c && !c.connected && !c.isBot;
        const st = p.speaking ? L('говорит') : voting && p.voted ? L('голос отдан') : p.host ? L('ведущий') : '';
        return `<span class="tm ${p.speaking ? 'speaking' : ''} ${voting && p.voted ? 'voted' : ''} ${p.id === this.me.id ? 'me' : ''}" title="${esc(p.name)}${p.id === this.me.id ? L(' (вы)') : ''}${st ? `: ${st}` : ''}">${this.av(p.id, off ? 'off sm' : 'sm')}${p.host ? '<i class="crown-dot" aria-hidden="true"></i>' : ''}</span>`;
      }).join('')}</div>`;
    },

    tickClocks() {
      const g = this.g; if (!g) return;
      const now = Net.now();
      const t = this.root.querySelector('#gTimer');
      if (t) {
        const b = t.querySelector('b'), fg = t.querySelector('.fg');
        const c = g.clock;
        t.classList.toggle('stopped', !!c && c.state !== 'run');
        if (g.paused) { b.textContent = 'II'; fg.style.strokeDashoffset = 0; }
        else if (c) {
          const rem = c.state === 'run' ? g.phaseEndsAt - now : c.left, total = Math.max(1, c.full);
          b.textContent = fmtClock(Math.max(0, rem));
          fg.style.strokeDashoffset = String(150.8 * (1 - Math.max(0, Math.min(1, rem / total))));
          t.classList.toggle('low', c.state === 'run' && rem < 10000 && rem >= 0 && !g.manual);
          t.classList.toggle('over', rem < 0 && g.manual);
        } else { b.textContent = '·'; fg.style.strokeDashoffset = 0; }
      }
      this.root.querySelectorAll('[data-end]').forEach((el) => { el.textContent = fmtClock(Number(el.dataset.end) - now); });
    },

    /* ---------- Обстоятельства дела: всю партию в одном месте ---------- */
    renderCase() {
      const c = this.g.case;
      setHtml(this.root.querySelector('#gCase'), `<div class="cf-head"><span class="eyebrow">${L('Дело')}</span><b>${esc(c.title)}</b></div>
        <div class="cf-facts"><span><em>${L('Жертва')}</em>${esc(c.victim)}</span><span><em>${L('Время смерти')}</em><span class="mono">${esc(c.time)}</span></span><span><em>${L('Место')}</em>${esc(c.scene)}</span></div>
        <p class="cf-text">${esc(c.teaser)}</p>`);
    },

    /* ---------- Очередь людей ---------- */
    renderQueue() {
      const g = this.g, me = this.me;
      const voting = !!g.vote && ['vote', 'poll', 'final'].includes(g.phase);
      const chips = g.players.map((p, i) => {
        const isMe = p.id === me.id, out = p.status === 'out';
        let st = '', cls = '';
        if (out) st = `<span class="st">${p.npc ? L('задержан') : L('вне игры')}</span>`;
        else if (p.speaking || (g.phase === 'defense' && g.defense && g.defense.speaker === p.id)) { st = `<span class="st go">${L('говорит')}</span>`; cls = 'speaking'; }
        else if (g.phase === 'accuse' && g.accuse && g.accuse.queue.indexOf(p.id) >= 0 && (g.accuse.done || g.accuse.queue.indexOf(p.id) < g.accuse.idx)) st = '<span class="st ok">✓</span>';
        else if (g.phase === 'accuse' && g.accuse && g.accuse.queue.includes(p.id)) st = `<span class="st">${g.accuse.queue.indexOf(p.id) + 1}</span>`;
        else if (g.phase === 'turns' && p.spoke) st = '<span class="st ok">✓</span>';
        else if (voting && p.voted) st = '<span class="st ok">✓</span>';
        else if ((g.phase === 'brief' || (g.phase === 'talk' && !g.manual)) && p.ready) st = `<span class="st ok">${L('✓ готово')}</span>`;
        else if (g.phase === 'turns' && g.turn && g.turn.queue.includes(p.id)) st = `<span class="st">${g.turn.queue.indexOf(p.id) + 1}</span>`;
        const c = this.conn[p.id]; const off = c && !c.connected && !c.isBot;
        const role = out && p.role === 'killer' ? `<span class="role">${L('убийца')}</span>` : out && p.role === 'accomplice' ? `<span class="role" style="color:var(--amber)">${L('сообщник')}</span>` : '';
        return `<button class="q-chip ${cls} ${isMe ? 'me' : ''} ${out ? 'out' : ''}" data-a="person" data-id="${esc(p.id)}" title="${L('№{0} {1}: показать досье', i + 1, esc(p.name))}" data-pid="${esc(p.id)}">
          ${p.host ? `<span class="crown">${L('ведущий')}</span>` : ''}${role}${avatar(p.name, i, off ? 'off' : '')}
          <span class="nm">${esc(p.name)}${isMe ? L(' (вы)') : ''}</span>${st || `<span class="st">${p.npc ? (p.revealed.profession ? esc(p.revealed.profession.text) : '') : p.bot ? L('бот') : off ? L('нет связи') : p.auto ? L('авто') : ''}</span>`}</button>`;
      }).join('');
      const q = this.root.querySelector('#gQueue');
      setHtml(q, chips);
      // Ленту двигаем к говорящему только при смене говорящего и только саму ленту (страница стоит на месте).
      // Если человек только что листал ленту пальцем, не мешаем ему.
      const sp = q && q.querySelector('.q-chip.speaking'), spId = sp ? sp.dataset.id : '';
      if (spId === this.lastSpeaker) return;
      this.lastSpeaker = spId;
      if (!sp || Date.now() - (this.queueTouched || 0) < 6000) return;
      const left = sp.offsetLeft - (q.clientWidth - sp.offsetWidth) / 2;
      try { q.scrollTo({ left: Math.max(0, left), behavior: 'smooth' }); } catch (e) { q.scrollLeft = Math.max(0, left); }
    },

    /* ---------- Сцена ---------- */
    renderStage(animate) {
      const el = this.root.querySelector('#gStage');
      const html = this.stageHtml();
      const changed = setHtml(el, html, { fresh: animate });
      if (animate && changed) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
      if (changed) this.tickClocks();
    },

    stageHtml() {
      const g = this.g, me = this.me;
      const meOut = me.status === 'out';
      const nAct = this.people().filter((p) => this.small || p.status === 'active').length;
      const wait = (txt) => `<div class="wait"><span class="dots"><i></i><i></i><i></i></span>${esc(txt)}</div>`;
      const outNote = meOut ? `<p class="muted">${L('Вы вне игры, но можете следить за партией.')}</p>` : '';

      if (g.phase === 'brief' && this.watch) {
        const readyN = g.players.filter((p) => p.ready).length;
        return `<div class="s-head"><p class="eyebrow">${L('Вводная')}</p><h3>${L('Игроки читают свои карточки')}</h3><p>${L('Дело наверху. Роли и карточки откроются, когда дело закроют.')}</p></div>
          <div class="act-row"><span class="muted">${L('Готовы: {0} из {1}', readyN, g.players.length)}</span></div>`;
      }
      if (g.phase === 'brief' && this.small) {
        const readyN = g.small.team.filter((p) => p.ready).length;
        return `<div class="s-head"><p class="eyebrow">${L('Вводная')}</p><h3>${L('Прочитайте дело и свою роль')}</h3><p>${L('Подозреваемые: шесть персонажей в ленте выше. Их карточки закрыты, по строке за ход их откроете вы сами.{0}', g.small.mole ? L(' Один из вас крот.') : '')}</p></div>
          <div class="act-row"><button class="btn btn-primary" data-a="ready" ${me.ready ? 'disabled' : ''}>${me.ready ? L('Всё готово') : L('Роль прочитана')}</button><span class="muted">${L('Готовы: {0} из {1}', readyN, g.small.team.length)}</span></div>
          ${me.isHost ? `<div class="act-row recase"><span class="muted">${L('Это дело уже играли?')}</span><button class="btn btn-sm btn-ghost" data-a="recase">${L('Сменить дело')}</button></div>` : ''}`;
      }
      if (g.phase === 'brief') {
        const killer = me.role === 'killer';
        const readyN = g.players.filter((p) => p.ready).length;
        let alibi = '';
        if (killer && !me.alibiChosen && me.killerInfo) {
          alibi = `<div style="display:grid;gap:10px"><p><b>${L('Выберите алиби.')}</b> ${L('Вы были в «{0}», но скажете, что в другом месте. Если там кто-то был, вас могут поймать.', esc(g.case.scene))}</p>
            <div class="loc-grid">${me.killerInfo.locations.map((l) => `<button class="loc-btn" data-a="alibi" data-loc="${esc(l.loc)}">${esc(l.loc)}<small>${l.crowded ? L('там кто-то был: риск') : L('опровергнуть некому')}</small></button>`).join('')}</div></div>`;
        } else if (killer) alibi = `<p>${L('Ваше алиби:')} <b>${esc(alibiTxt(me.card.alibi.claim))}</b>${L('. На самом деле вы были в «{0}».', esc(g.case.scene))}</p>`;
        return `<div class="s-head"><p class="eyebrow">${L('Вводная')}</p><h3>${L('Прочитайте дело и свою карточку')}</h3><p>${L('Обстоятельства дела всю партию висят наверху. Стройте рассказ так, чтобы он с ними сходился.')}</p></div>
          ${alibi}
          <div class="act-row"><button class="btn btn-primary" data-a="ready" ${me.ready ? 'disabled' : ''}>${me.ready ? L('Всё готово') : L('Карточка прочитана')}</button><span class="muted">${L('Готовы: {0} из {1}', readyN, g.players.length)}</span></div>
          ${me.isHost ? `<div class="act-row recase"><span class="muted">${L('Это дело уже играли?')}</span><button class="btn btn-sm btn-ghost" data-a="recase">${L('Сменить дело')}</button></div>` : ''}`;
      }

      if (g.phase === 'clue') {
        const fresh = g.clues.filter((c) => c.round === g.round);
        return `<div class="s-head"><p class="eyebrow">${g.finale ? L('Финал') : L('Раунд {0} из {1}', g.round, g.rounds)}</p><h3>${g.finale ? L('Последние улики') : L('Новая улика')}</h3></div>
          <div style="display:grid;gap:12px;justify-items:start">${fresh.map((c) => `<article class="paper clue big new"><span class="no">${L('Улика {0}', g.clues.indexOf(c) + 1)}</span><p>${esc(c.text)}</p><span class="tagname">${esc(c.label)}</span></article>`).join('')}</div>
          <div class="talk-hint">${icon('mic')}<span>${this.small ? L('Кому из персонажей это подходит? Выскажите версии вслух, потом каждый откроет {0}.', g.small.team.length < 4 ? L('по две строки') : L('по строке')) : L('Кому это подходит? Выскажите версии вслух, потом пойдёт круг рассказов.')}</span></div>`;
      }

      if (g.phase === 'turns' && g.turn && this.small) return this.smallTurn();
      if (g.phase === 'turns' && g.turn) {
        const sp = this.byId[g.turn.speakerId], mine = sp.id === me.id;
        // Что говорящий раскрыл в свой ход
        let ti = -1; g.feed.forEach((f, i) => { if (f.kind === 'turn' && f.who === sp.id) ti = i; });
        const rev = ti >= 0 ? g.feed.slice(ti + 1).filter((f) => f.kind === 'reveal' && f.who === sp.id).slice(-1)[0] : null;
        let body = '';
        if (mine) {
          if (me.can.reveal.length) {
            body = `<div style="display:grid;gap:10px"><p><b>${L('Выберите, что о себе рассказать.')}</b> ${L('Это увидят все.')}</p>
              <div class="trait-grid">${me.can.reveal.map((t) => `<button class="trait-btn ${t === 'secret' ? 'risky' : ''}" data-a="reveal" data-trait="${t}"><span class="t">${esc(T[t])}${t === 'secret' ? L(' · рискованно') : ''}</span><span class="v">${esc(myVal(me.card, t))}</span></button>`).join('')}</div>
              ${me.can.reveal.every((t) => t === 'secret') ? `<div class="act-row"><button class="btn" data-a="endturn">${L('Ничего не открывать')}</button><span class="muted">${L('Безопасных пунктов не осталось, тайну открывать необязательно.')}</span></div>` : ''}
              ${me.can.locked && me.can.locked.length ? `<p class="muted card-note" style="max-width:none;margin:0">${L('{0} Её раскроют только «Обыск» или «Показания».', me.can.locked.includes('habit') ? L('Особенность вы уже не откроете сами, ведь профессия открыта.') : L('Профессию вы уже не откроете сами, ведь особенность открыта.'))}</p>` : me.can.reveal.includes('profession') && me.can.reveal.includes('habit') ? `<p class="muted card-note" style="max-width:none;margin:0">${L('Из особенности и профессии сами вы откроете только одно. Второе раскроют только карты.')}</p>` : ''}</div>`;
          } else {
            const pr = rev && rev.trait ? Content.PROMPTS[rev.trait] : Content.PROMPTS.free;
            body = `${rev ? `<div class="paper said enter"><span class="label">${L('Вы открыли')}</span><p>${esc(rev.text.replace(/^[^:]+ (?:раскрывает|reveals): /, ''))}</p></div>` : ''}
              <div class="talk-hint">${icon('mic')}<span>${esc(pr)}</span></div>
              <div class="act-row"><button class="btn btn-primary" data-a="endturn">${L('Рассказ закончен')}</button><span class="muted">${L('Следующий получит слово сразу.')}</span></div>`;
          }
        } else {
          body = `${rev ? `<div class="paper said enter"><span class="label">${L('Раскрыто')}</span><p>${esc(rev.text.replace(/^[^:]+ (?:раскрывает|reveals): /, ''))}</p></div>` : wait(L('{0} выбирает, что рассказать', sp.name))}
            <div class="talk-hint">${icon('mic')}<span>${L('Слушайте и запоминайте. Вопросы лучше держать до обсуждения.')}</span></div>`;
        }
        return `<div class="speaker">${avatar(sp.name, this.idx[sp.id], 'lg')}<div><p class="eyebrow">${mine ? L('Ваше слово') : L('Говорит')}</p><h3>${esc(sp.name)}</h3></div></div>${body}${outNote}`;
      }

      if (g.phase === 'accuse' && g.accuse) {
        const a = g.accuse;
        if (a.done) {
          return `<div class="s-head"><p class="eyebrow">${L('Обвинения окончены')}</p><h3>${L('Все высказались')}</h3><p>${L('Ведущий начнёт голосование.')}</p></div>${wait(L('Ждём ведущего'))}${outNote}`;
        }
        const sp = this.byId[a.speakerId], mine = sp.id === me.id;
        const hint = mine ? (this.small ? L('У вас минута. Скажите, кого из персонажей подозреваете и почему: улики, алиби, ваши «Обыски».') : L('У вас минута. Скажите, кого подозреваете и почему: улики, алиби, нестыковки в рассказах.'))
          : L('Слушайте {0}. Минута на то, кого подозревают и почему.', sp.name);
        return `<div class="speaker">${this.av(sp.id, 'lg')}<div><p class="eyebrow">${mine ? L('Ваша обвинительная минута') : L('Обвиняет')}</p><h3>${esc(sp.name)}</h3></div></div>
          <div class="talk-hint">${icon('mic')}<span>${esc(hint)}</span></div>
          ${mine && me.can.endaccuse ? `<div class="act-row"><button class="btn btn-primary" data-a="endaccuse">${L('Закончить минуту')}</button><span class="muted">${L('Слово перейдёт следующему.')}</span></div>` : ''}${g.manual ? `<p class="muted">${L('Следующего включает ведущий.')}</p>` : ''}${outNote}`;
      }

      if (g.phase === 'talk') {
        const usable = me.cards.some((c) => !c.used && !PASSIVE.includes(c.type));
        const readyN = this.people().filter((p) => (this.small || p.status === 'active') && p.ready).length;
        const passive = !usable && me.cards.find((c) => !c.used && PASSIVE.includes(c.type));
        const cardBtn = passive ? `<span class="muted card-note">${L('Ваша карта «{0}» сработает сама, когда вас соберутся исключить.', esc(passive.name))}</span>` : `<button class="btn" data-a="card" ${usable && me.can.card ? '' : 'disabled'}>${me.cards.every((c) => c.used) ? L('Карты сыграны') : L('Карта действия')}</button>`;
        const acts = !meOut && !this.watch ? `<div class="act-row">${cardBtn}
          ${g.manual ? `<span class="muted">${L('К обвинениям переходит ведущий.')}</span>` : `<button class="btn ${me.ready ? '' : 'btn-primary'}" data-a="ready">${me.ready ? L('Отменить готовность') : L('Готово к обвинениям')}</button><span class="muted">${L('Готовы: {0} из {1}', readyN, nAct)}</span>`}</div>` : '';
        return `<div class="s-head"><p class="eyebrow">${L('Свободное обсуждение')}</p><h3>${this.small ? L('Кто из них убийца и сообщник?') : g.gang ? L('Кто здесь убийца и сообщник?') : L('Кто из нас убийца?')}</h3><p>${this.small ? L('Сверяйте открытые строки с уликами, играйте карты, спорьте. Помните, что кто-то из вас может врать.') : L('Сверяйте алиби, ищите совпадения с уликами, спрашивайте друг друга.')}</p></div>${acts}${outNote}
          <div class="dossiers">${g.players.map((p) => this.dossier(p)).join('')}</div>`;
      }

      if (['vote', 'poll', 'final'].includes(g.phase) && g.vote) {
        const v = g.vote, final = g.phase === 'final';
        const title = this.small ? (v.runoff ? L('Ничья. Кого задерживаем?') : L('Кого задерживаем?')) : g.phase === 'poll' ? (g.gang ? L('Кто убийца и сообщник?') : L('Кто убийца?')) : final ? L('Кого исключить окончательно?') : v.runoff ? L('Ничья. Кого исключаем?') : L('Кого исключаем?');
        const sub = this.small ? (v.runoff ? L('Голоса разделились. Выбор только между теми, кто набрал поровну.') : L('Задержать придётся одного. {0}', g.small.wrongOut ? L('Ещё один невиновный за решёткой, и преступники уйдут.') : L('Двое невиновных за решёткой, и преступники уйдут.'))) : g.phase === 'poll' ? (g.gang ? L('Опрос тайный. Трое с наибольшим числом голосов получат слово защиты.') : L('Опрос тайный. Двое с наибольшим числом голосов получат слово защиты.')) : final ? (g.gang && g.players.filter((p) => p.status === 'active').length > 3 ? L('Исключённого не вернуть. Осталось исключений: {0}, а вместе с ними решится исход дела.', g.kicksLeft) : g.gang ? L('Решающее голосование. Исключённого не вернуть, и сразу после него решится исход дела.') : L('Последний выбор. Исключённого не вернуть, а вместе с ним решится исход дела.')) : v.runoff ? L('Голоса разделились. Выбор только между теми, кто набрал поровну.') : L('Исключить придётся одного. Голос можно поменять до подведения итога.');
        const cands = v.candidates.filter((id) => id !== me.id);
        const can = me.can.vote;
        const grid = can ? `<div class="vote-grid">${cands.map((id) => {
          const p = this.byId[id];
          const hits = p.tags.filter((t) => g.clues.some((c) => c.tag === t.key)).map((t) => t.label);
          return `<button class="vote-btn ${final ? 'big' : ''} ${v.my === id ? 'on' : ''}" data-a="vote" data-id="${esc(id)}">${avatar(p.name, this.idx[id])}<span><b>${esc(p.name)}</b>${hits.length ? `<small>${L('совпало с уликой: {0}', esc(hits.join(', ')))}</small>` : ''}</span></button>`;
        }).join('')}</div>` : wait(meOut || this.watch ? L('Голосуют те, кто ещё в игре') : L('Голоса принимаются'));
        const vp = this.people().filter((p) => this.small || p.status === 'active').map((p) => `<span title="${esc(p.name)}">${this.av(p.id, p.voted ? 'on' : '')}</span>`).join('');
        return `<div class="s-head"><p class="eyebrow">${g.phase === 'poll' ? L('Финал · опрос') : final ? L('Финал') : L('Раунд {0}', g.round)}</p><h3>${title}</h3><p>${esc(sub)}</p></div>${grid}
          <div class="vp"><span>${L('Проголосовали {0} из {1}:', v.voted.length, nAct)}</span>${vp}</div>${v.my ? `<p class="muted">${L('Ваш голос: {0}.', esc(this.byId[v.my].name))}</p>` : can ? `<p class="muted">${v.candidates.includes(me.id) ? L('Не выберете, и голос уйдёт против вас.') : L('Не выберете, и голос пропадёт.')}</p>` : ''}`;
      }

      if (g.phase === 'result') {
        const k = g.kicks[g.kicks.length - 1];
        if (!k) return '';
        const p = this.byId[k.id];
        // В обычном режиме роль выбывшего скрыта до конца дела, для всех одинаково.
        const hidden = g.hints !== 'light';
        const role = hidden ? L('Роль скрыта') : p.role === 'accomplice' ? L('Сообщник') : p.role === 'killer' ? L('Убийца') : L('Невиновный');
        const left = g.criminals ? g.criminals.left : null;
        const after = this.small ? (hidden ? L('Кто это был, станет известно в конце дела.') : p.role === 'killer' ? L('Это убийца. Сообщник ещё на свободе.') : p.role === 'accomplice' ? L('Это сообщник. Убийца ещё на свободе.') : L('Это невиновный. Ещё одна такая ошибка, и преступники уйдут.'))
          : hidden ? L('Кем был этот игрок, станет известно в конце дела.') : p.role === 'killer' ? L('Это был убийца, но сообщник ещё среди вас.') : p.role === 'accomplice' ? (g.gang ? L('Это был сообщник, но убийца остаётся среди вас.') : L('Это был сообщник убийцы, но сам убийца остаётся среди вас.')) : (g.gang ? (left === 1 ? L('Это был невиновный. Один из преступников всё ещё среди вас.') : L('Это был невиновный. Оба преступника всё ещё среди вас.')) : L('Это был невиновный. Убийца всё ещё среди вас.'));
        const max = Math.max(1, ...Object.values(k.count));
        const rows = Object.keys(k.count).sort((a, b) => k.count[b] - k.count[a]).map((id) => {
          return `<div class="tr ${id === k.id ? 'top' : ''}"><span>${esc(this.byId[id].name)}</span><span class="bar"><i style="width:${Math.round(100 * k.count[id] / max)}%"></i></span><b>${k.count[id]}</b></div>`;
        }).join('');
        return `<div class="s-head"><p class="eyebrow">${L('Раунд {0} из {1}', k.round, g.rounds)}</p><h3>${esc(p.name)} ${this.small ? L('за решёткой') : L('вне игры')}</h3><p>${esc(VIA[k.via] || '')} ${esc(after)}</p></div>
          <div class="kick-card"><div class="flip"><div class="flip-inner"><div class="paper"><span class="label">${hidden ? (this.small ? L('Задержан') : L('Вне игры')) : L('Роль раскрыта')}</span><h3>${esc(p.name)}</h3><span class="stamp">${role}</span>
            ${p.revealed.profession ? `<p style="margin-top:8px"><b>${esc(p.revealed.profession.text)}</b></p>` : ''}${p.revealed.motive ? `<p style="font-size:14px;margin-top:6px">${L('Мотив: {0}', esc(p.revealed.motive.text))}</p>` : ''}</div></div></div>
            <div class="tally">${rows}</div></div>
          <div class="talk-hint">${icon('mic')}<span>${L('Голосование анонимное. Обсудите итог голосом: кто и почему мог голосовать против.')}</span></div>`;
      }

      if (g.phase === 'defense' && g.defense) {
        const d = g.defense, sp = this.byId[d.speaker], mine = d.speaker === me.id;
        return `<div class="speaker">${avatar(sp.name, this.idx[sp.id], 'lg')}<div><p class="eyebrow">${L('Слово защиты')}</p><h3>${esc(sp.name)}</h3></div></div>
          <p>${mine ? L('Объясните своё алиби и совпадения с уликами. Говорите вслух.') : this.watch ? L('Сразу после защиты игроки проголосуют.') : L('Слушайте и запоминайте. Голосовать вы будете сразу после защиты.')}</p>
          <div class="act-row">${d.order.map((id, i) => `<span class="badge ${i === d.idx ? 'yellow' : i < d.idx ? 'green' : ''}">${esc(this.byId[id].name)}${i < d.idx ? L(' · уже выступали') : i === d.idx ? L(' · говорит') : L(' · следующий')}</span>`).join('')}</div>
          ${mine ? `<div class="act-row"><button class="btn btn-primary" data-a="endspeech">${L('Речь закончена')}</button></div>` : ''}`;
      }

      if (g.phase === 'verdict' && g.verdict) {
        const v = g.verdict, kp = this.byId[v.kickedId];
        const role = kp.role === 'killer' ? L('Убийца') : kp.role === 'accomplice' ? L('Сообщник') : L('Невиновный');
        const text = this.small ? (v.reason === 'caught' ? L('Убийца и сообщник за решёткой. Дело раскрыто.') : L('За решёткой двое невиновных. Преступники ушли.')) : v.reason === 'caught' ? (g.gang ? L('Убийца и сообщник исключены. Невиновные победили.') : L('Убийца исключён. Невиновные победили.')) : v.reason === 'outnumbered' ? L('Преступников осталось столько же, сколько невиновных. Они победили.') : g.gang ? L('Исключения закончились, а кто-то из преступников остался на свободе.') : L('Исключили невиновного. Убийца остаётся на свободе.');
        return `<div class="verdict"><div class="flip"><div class="flip-inner"><div class="paper"><span class="label">${L('Исключён')}</span><h3>${esc(kp.name)}</h3><span class="stamp">${role}</span>
          ${kp.revealed.profession ? `<p style="margin-top:8px"><b>${esc(kp.revealed.profession.text)}</b></p>` : ''}${kp.revealed.motive ? `<p style="font-size:14px;margin-top:6px">${L('Мотив: {0}', esc(kp.revealed.motive.text))}</p>` : ''}</div></div></div>
          <div class="res">${esc(text)}</div><span class="stamp">${v.winner === 'innocent' ? L('Дело раскрыто') : g.gang ? L('Преступники на свободе') : L('Убийца на свободе')}</span></div>`;
      }

      if (g.phase === 'mole' && this.small) {
        const mv = g.small.moleVote || { voted: [], my: null };
        const others = g.small.team.filter((p) => p.id !== me.id);
        const grid = me.can.molevote ? `<div class="vote-grid">${others.map((p) => `<button class="vote-btn ${mv.my === p.id ? 'on' : ''}" data-a="molevote" data-id="${esc(p.id)}">${this.av(p.id)}<span><b>${esc(p.name)}</b></span></button>`).join('')}</div>` : wait(L('Игроки называют крота'));
        const vp = g.small.team.map((p) => `<span title="${esc(p.name)}">${this.av(p.id, mv.voted.includes(p.id) ? 'on' : '')}</span>`).join('');
        return `<div class="s-head"><p class="eyebrow">${L('Дело закрыто')}</p><h3>${L('Кто из вас крот?')}</h3><p>${me.role === 'mole' ? L('Вы крот. Голосуйте вместе со всеми, чтобы не выдать себя.') : L('Назовите одного. Крота вычислят, если на нём больше всего голосов.')}</p></div>${grid}
          <div class="vp"><span>${L('Проголосовали {0} из {1}:', mv.voted.length, g.small.team.length)}</span>${vp}</div>${mv.my ? `<p class="muted">${L('Ваш выбор: {0}.', esc(this.byId[mv.my].name))}</p>` : ''}`;
      }

      if (g.phase === 'accomplice') {
        if (me.role === 'accomplice') {
          const cands = g.players.filter((p) => p.id !== me.id && p.role !== 'killer');
          return `<div class="s-head"><p class="eyebrow">${L('Последний шанс')}</p><h3>${L('Убийцу исключили')}</h3><p>${L('Назовите самого опасного из остальных: угадаете, получите очки. Или уйдите незамеченным.')}</p></div>
            <div class="vote-grid">${cands.map((p) => `<button class="vote-btn" data-a="accomplice" data-mode="target" data-id="${esc(p.id)}">${avatar(p.name, this.idx[p.id])}<span><b>${esc(p.name)}</b><small>${L('назвать опасным')}</small></span></button>`).join('')}</div>
            <div class="act-row"><button class="btn" data-a="accomplice" data-mode="stealth">${L('Уйти незамеченным')}</button></div>`;
        }
        return `<div class="s-head"><p class="eyebrow">${L('Последний шанс')}</p><h3>${L('Слово сообщника')}</h3></div>${wait(L('Сообщник решает, как поступить'))}`;
      }
      return '';
    },

    /* Малый состав, круг показаний: в свой ход человек открывает одну строку любого персонажа на свободе. */
    smallTurn() {
      const g = this.g, me = this.me;
      const sp = this.byId[g.turn.speakerId], mine = sp.id === me.id;
      const wait = (txt) => `<div class="wait"><span class="dots"><i></i><i></i><i></i></span>${esc(txt)}</div>`;
      let ti = -1; g.feed.forEach((f, i) => { if (f.kind === 'turn' && f.who === sp.id) ti = i; });
      const rev = ti >= 0 ? g.feed.slice(ti + 1).filter((f) => f.kind === 'reveal').slice(-1)[0] : null;
      const said = rev && this.byId[rev.who] ? `<div class="paper said enter"><span class="label">${esc(this.byId[rev.who].name)} · ${esc(T[rev.trait] || '')}</span><p>${esc((this.byId[rev.who].revealed[rev.trait] || {}).text || '')}</p></div>` : '';
      let body;
      if (mine && me.can.reveal.length) {
        body = `<div style="display:grid;gap:10px"><p><b>${L('Выберите строку, которую откроете при всех.')}</b> ${L('Из профессии и особенности у персонажа при всех открывается только одно, второе покажут карты.')}</p>
          <div class="npc-pick">${me.can.reveal.map((o) => `<div class="np">${this.av(o.id, 'sm')}<b>${esc(this.byId[o.id].name)}</b><div class="np-t">${o.traits.map((t) => `<button class="btn btn-sm" data-a="reveal" data-id="${esc(o.id)}" data-trait="${t}">${esc(T[t])}</button>`).join('')}</div></div>`).join('')}</div></div>`;
      } else if (mine) {
        body = `${said}<div class="talk-hint">${icon('mic')}<span>${L('Скажите вслух, что это меняет в деле.')}</span></div>
          <div class="act-row"><button class="btn btn-primary" data-a="endturn">${L('Ход закончен')}</button><span class="muted">${L('Следующий откроет свою строку.')}</span></div>`;
      } else {
        body = `${said || wait(L('{0} выбирает, чью строку открыть', sp.name))}<div class="talk-hint">${icon('mic')}<span>${me.role === 'mole' ? L('Следите, к кому идёт следствие, и вовремя уводите его в сторону.') : L('Сверяйте с уликами. Обсудить можно будет после круга.')}</span></div>`;
      }
      return `<div class="speaker">${this.av(sp.id, 'lg')}<div><p class="eyebrow">${mine ? L('Ваш ход') : L('Ход')}</p><h3>${esc(sp.name)}</h3></div></div>${body}`;
    },

    /* Досье игрока: что открыто и что выяснено ордером */
    dossier(p) {
      const g = this.g, me = this.me;
      const i = this.idx[p.id], clueTags = new Set(g.clues.map((c) => c.tag));
      const keys = Object.keys(p.revealed);
      const hits = p.tags.filter((t) => clueTags.has(t.key));
      const notes = me.notes.filter((n) => n.targetId === p.id);
      return `<div class="dos ${p.id === me.id ? 'me' : ''} ${p.status === 'out' ? 'out' : ''}"><div class="dos-h">${avatar(p.name, i, 'sm')}<span>${esc(p.name)}</span></div>
        ${hits.length ? `<div class="chips">${hits.map((t) => `<span class="chip hit" title="${L('Совпадает с уликой')}">${esc(t.label)}</span>`).join('')}</div>` : ''}
        ${keys.length ? keys.map((k) => `<div class="r"><span class="label">${esc(T[k])}</span><span>${esc(p.revealed[k].text)}</span></div>`).join('') : `<span class="none">${L('Пока ничего не открыто.')}</span>`}
        ${notes.map((n) => `<div class="note">${n.kind === 'lab' ? `<b>${L('Экспертиза.')}</b> ${esc(n.text)}` : n.kind === 'swap' ? `<b>${L('Подмена.')}</b> ${esc(n.text)}` : n.kind === 'trail' ? `<b>${L('Ложный след.')}</b> ${esc(n.text)}` : `<b>${L('Обыск: {0}.', esc(n.label))}</b> ${esc(n.text)}${n.extra ? `<br>${esc(n.extra)}` : ''}`}</div>`).join('')}</div>`;
    },

    /* ---------- Улики ---------- */
    renderClues() {
      const g = this.g;
      // В малом составе улик четыре на три раунда: две находят сразу.
      const slots = this.small ? 4 : Math.max(g.rounds, g.clues.length);
      const roundOf = (i) => (this.small ? Math.max(1, i) : i + 1);
      if (this.seenClues === null) this.seenClues = new Set(g.clues.map((x) => x.id));
      const cl = [];
      for (let i = 0; i < slots; i++) {
        const k = g.clues[i];
        if (!k) { cl.push(`<div class="clue locked">${L('Улика {0}', i + 1)}<br>${roundOf(i) <= g.rounds ? L('раунд {0}', roundOf(i)) : ''}</div>`); continue; }
        const isNew = !this.seenClues.has(k.id) && g.phase !== 'clue'; this.seenClues.add(k.id);
        cl.push(`<article class="paper clue ${isNew ? 'new' : ''}"><span class="no">${L('Улика {0}{1}', i + 1, k.mine ? L(' · подменена вами') : k.planted ? L(' · подменена') : k.checked === 'fake' ? L(' · экспертиза: ложная') : k.checked === 'real' ? L(' · экспертиза: правдивая') : '')}</span><p>${esc(k.text)}</p><span class="tagname">${esc(k.label)}</span></article>`);
      }
      setHtml(this.root.querySelector('#gClues'), cl.join(''));
    },

    /* ---------- Моя карточка ---------- */
    renderCard() {
      if (this.watch) {
        setHtml(this.root.querySelector('#pCard'), `<summary><h2>${L('Вы зритель')}</h2></summary>
          <div class="my-body"><p class="muted" style="font-size:13px">${L('Вы видите то же, что все за столом. Роли, карточки и тайные ходы откроются, когда дело закроют. Сесть за стол можно будет перед следующим делом.')}</p></div>`);
        return;
      }
      if (this.small) return this.renderRole();
      const g = this.g, me = this.me, c = me.card;
      const r = ROLE[me.role];
      let hint = g.gang ? r.gang : r.hint;
      if (me.role === 'killer' && me.killerInfo && me.killerInfo.accompliceId) hint = L('Не выдайте себя и сообщника. Ваш сообщник: {0}.{1}', this.byId[me.killerInfo.accompliceId].name, g.gang ? L(' Каждому из вас подходят три улики из четырёх, двойникам среди невиновных тоже.') : '');
      if (me.role === 'accomplice' && me.accompliceInfo) hint = L('Убийца: {0}. {1}', this.byId[me.accompliceInfo.killerId].name, g.gang ? L('Вас обоих ищут. Вам подходят три улики из четырёх, но у кого-то из невиновных тоже три совпадения: на этом и стройте защиту.') : L('Уводите подозрения.'));
      const row = (t, val, extra = '') => `<div class="c-row"><span class="label"><span>${esc(T[t])}</span>${me.revealed[t] ? `<em>${L('раскрыто')}</em>` : ''}</span><span>${esc(val)}</span>${extra}</div>`;
      const lied = c.alibi.lied;
      const alibiExtra = (lied ? `<span class="truth lie">${L('На самом деле вы были: «{0}»', esc(c.alibi.real.loc))}</span>` : '') + (c.witnesses.length ? `<span class="truth">${L('Там же были: {0}', esc(c.witnesses.map((w) => w.name).join(', ')))}</span>` : '');
      const cardState = (k) => {
        if (k.used) return '';
        if (k.type === 'advocate') return `<p class="cstate">${L('Сработает сама: когда вас соберутся исключить, предложим убрать один голос.')}</p>`;
        if (k.type === 'trail') return `<p class="cstate">${L('Сработает сама и тайно: первая проверка, которая могла бы вас выдать, покажет чистый результат. Вы узнаете, кто вас проверял.')}</p>`;
        if (me.status !== 'active') return '';
        if (g.phase === 'talk' && me.can.card) return `<button class="btn btn-sm btn-primary" data-a="card" data-type="${esc(k.type)}">${L('Сыграть')}</button>`;
        return `<p class="cstate">${g.phase === 'talk' ? L('Подождите, идёт другое действие.') : L('Играется в обсуждении.')}</p>`;
      };
      const cards = me.cards.map((k) => `<div class="cmini ${k.used ? 'used' : ''}"><h4>${esc(k.name)}${k.used ? L(' · сыграна') : ''}</h4><p>${esc(k.desc)}</p>${cardState(k)}</div>`).join('');
      const killerClues = me.killerInfo ? `<div class="c-row"><span class="label"><span>${g.gang ? L('Улики по делу') : L('Улики против вас')}</span></span>${me.killerInfo.clues.map((k) => `<span class="${k.revealed && !k.replaced ? 'truth' : ''}">${esc(k.label)}${g.gang ? (k.mine ? L(' · про вас') : (me.role === 'killer' ? L(' · только про сообщника') : L(' · только про убийцу'))) : ''} ${k.replaced ? L('· подменена, вместо неё нашли другую') : k.revealed ? L('· уже найдена') : L('· пока скрыта')}</span>`).join('')}</div>` : '';
      const el = this.root.querySelector('#pCard');
      const html = `<summary><h2>${L('Моя карточка')}</h2><span class="role-banner ${r.cls}" style="padding:4px 9px">${r.name}</span><span class="chev">▾</span></summary>
        <div class="my-body"><p class="muted" style="font-size:13px">${esc(hint)}</p>
          ${row('profession', c.profession)}${row('habit', c.habit)}${row('relation', c.relation)}${row('motive', c.motive)}${row('alibi', alibiTxt(c.alibi.claim), alibiExtra)}${row('secret', c.secret)}${row('goal', c.goal)}
          ${killerClues}<div class="c-row"><span class="label"><span>${me.cards.length > 1 ? L('Карты действий') : L('Карта действия')}</span></span><div class="cards-mini">${cards}</div></div></div>`;
      if (setHtml(el, html)) el.open = this.cardOpen !== false;
    },

    /* Малый состав: вместо своей карточки карточка роли и карты на руках. Крот видит преступников и их улики. */
    renderRole() {
      const g = this.g, me = this.me, r = ROLE[me.role] || ROLE.detective;
      const hint = r.hint + (me.role === 'detective' && g.small.mole ? r.mole : '');
      const nm = (id) => esc((this.byId[id] || {}).name || '?');
      const mi = me.moleInfo;
      const crim = mi ? `<div class="c-row"><span class="label"><span>${L('Преступники')}</span></span><span>${L('Убийца:')} <b>${nm(mi.killerId)}</b></span><span>${L('Сообщник:')} <b>${nm(mi.accompliceId)}</b></span></div>
        <div class="c-row"><span class="label"><span>${L('Улики по делу')}</span></span>${mi.clues.map((k) => `<span class="${k.revealed && !k.replaced ? 'truth' : ''}">${esc(k.label)} · ${k.fits.map(nm).join(L(' и '))}${k.replaced ? L(' · подменена') : k.revealed ? L(' · найдена') : L(' · пока скрыта')}</span>`).join('')}</div>` : '';
      const cardState = (k) => {
        if (k.used) return '';
        if (g.phase === 'talk' && me.can.card) return `<button class="btn btn-sm btn-primary" data-a="card" data-type="${esc(k.type)}">${L('Сыграть')}</button>`;
        return `<p class="cstate">${g.phase === 'talk' ? L('Подождите, идёт другое действие.') : L('Играется в обсуждении.')}</p>`;
      };
      const cards = me.cards.map((k) => `<div class="cmini ${k.used ? 'used' : ''}"><h4>${esc(k.name)}${k.used ? L(' · сыграна') : ''}</h4><p>${esc(k.desc)}</p>${cardState(k)}</div>`).join('');
      const notes = me.notes.length ? `<div class="c-row"><span class="label"><span>${L('Что вы узнали')}</span></span>${me.notes.map((n) => `<span>${n.targetId ? `${nm(n.targetId)}: ` : ''}${n.label ? `${esc(n.label)}. ` : ''}${esc(n.text)}${n.extra ? ` ${esc(n.extra)}` : ''}</span>`).join('')}</div>` : '';
      const el = this.root.querySelector('#pCard');
      const html = `<summary><h2>${L('Моя роль')}</h2><span class="role-banner ${r.cls}" style="padding:4px 9px">${r.name}</span><span class="chev">▾</span></summary>
        <div class="my-body"><p class="muted" style="font-size:13px">${esc(hint)}</p>${crim}${notes}
          <div class="c-row"><span class="label"><span>${me.cards.length > 1 ? L('Карты действий') : L('Карта действия')}</span></span><div class="cards-mini">${cards}</div></div></div>`;
      if (setHtml(el, html)) el.open = this.cardOpen !== false;
    },

    /* Часы ведущего: старт или пауза, заново, +30 секунд. */
    clockButtons(g) {
      const c = g.clock;
      if (!c || g.overlay || g.phase === 'verdict' || (g.phase === 'accuse' && g.accuse && g.accuse.done)) return '';
      const run = c.state === 'run';
      return `<span class="clock-ctl" role="group" aria-label="${L('Таймер')}">
        <button class="btn btn-sm ${run ? '' : 'btn-amber'}" data-a="hclock" data-v="${run ? 'pause' : 'start'}" title="${run ? L('Поставить таймер на паузу') : L('Запустить отсчёт')}" aria-label="${run ? L('Пауза') : L('Старт')}">${icon(run ? 'pause' : 'play')}<span>${run ? L('Пауза') : c.state === 'pause' ? L('Дальше') : L('Старт')}</span></button>
        <button class="btn btn-sm" data-a="hclock" data-v="reset" title="${L('Начать время фазы заново')}" aria-label="${L('Сбросить время')}">${icon('restart')}</button>
        <button class="btn btn-sm" data-a="hext" title="${L('Добавить 30 секунд')}">${L('+30 с')}</button></span>`;
    },

    /* ---------- Панель ведущего ---------- */
    renderHost(st) {
      const g = this.g, me = this.me, host = this.root.querySelector('#gHost');
      if (['verdict', 'ended'].includes(g.phase)) { setHtml(host, ''); host.className = 'host-bar'; return; }
      const sm = this.small ? { clue: [L('К показаниям'), g.small.team.length < 4 ? L('Каждый откроет по две строки персонажей') : L('Каждый откроет по строке персонажа')], turns: [L('Передать ход дальше'), L('Когда строка открыта и обсуждена')] } : {};
      const hostP = this.byId[g.hostId];
      const ppl = this.people().filter((p) => this.small || p.status === 'active');
      const nAct = ppl.length;
      let status = '';
      if (g.phase === 'brief') status = L('Готовы: {0} из {1}', this.people().filter((p) => p.ready).length, this.people().length);
      else if (g.phase === 'talk' && !g.manual) status = L('Готовы к обвинениям: {0} из {1}', ppl.filter((p) => p.ready).length, nAct);
      else if (g.phase === 'mole' && g.small.moleVote) status = L('Назвали крота: {0} из {1}', g.small.moleVote.voted.length, nAct);
      else if (g.vote && ['vote', 'poll', 'final'].includes(g.phase)) status = L('Проголосовали: {0} из {1}', g.vote.voted.length, nAct);
      else if (g.phase === 'turns' && g.turn) status = L('Слово: {0}', this.byId[g.turn.speakerId].name);
      else if (g.phase === 'accuse' && g.accuse) status = g.accuse.done ? L('Все высказались') : L('Обвиняет: {0}', this.byId[g.accuse.speakerId].name);
      if (me.isHost) {
        const [label, sub] = sm[g.phase] || HOST_BTN[g.phase] || [L('Дальше'), ''];
        let next = label;
        if (g.phase === 'turns' && g.turn && g.turn.idx + 1 >= g.turn.total) next = L('К обсуждению');
        if (g.phase === 'accuse' && g.accuse) next = g.accuse.done || g.accuse.idx + 1 >= g.accuse.total ? (g.accuse.done ? L('К голосованию') : L('Завершить обвинения')) : L('Следующий');
        const modeLbl = g.manual ? L('Перейти на таймеры') : L('Вернуть ручное ведение');
        setHtml(host, `<div><div class="who"><b>${L('Вы ведёте партию')}</b><span>${esc(status || sub)}${g.manual ? '' : L(' · сейчас идёт по таймерам')}</span></div>
          <div class="acts"><button class="btn btn-sm btn-ghost" data-a="hmode" title="${esc(modeLbl)}">${g.manual ? L('Таймеры') : L('Вручную')}</button>${this.clockButtons(g)}${['turns', 'talk', 'accuse'].includes(g.phase) ? `<button class="btn btn-sm host-back" data-a="hback" ${me.can && me.can.back ? '' : 'disabled'} title="${L('Вернуть предыдущий шаг: слово получит тот, кого пропустили')}" aria-label="${L('Назад')}">${icon('undo')}<span>${L('Назад')}</span></button>` : ''}<button class="btn btn-primary" data-a="hnext">${esc(next)}</button></div></div>`);
        host.className = 'host-bar';
      } else {
        const txt = (this.watch ? L('Вы зритель · ') : '') + (g.manual ? L('Ведущий {0} листает раунды', hostP ? hostP.name : '') : L('Партия идёт по таймерам'));
        setHtml(host, `<div><div class="who"><b>${esc(txt)}</b>${status ? `<span>${esc(status)}</span>` : ''}</div></div>`);
        host.className = 'host-bar guest';
      }
    },

    /* ---------- Карта защиты: Адвокат ---------- */
    renderOverlay() {
      const g = this.g, me = this.me, ov = g.overlay;
      const host = this.root.querySelector('#gOv');
      if (ov && ov.type === 'lottery') return this.renderLottery(host, ov);
      // Рулетку строили вручную, мимо setHtml: убираем её так же и сбрасываем запомненную разметку.
      if (this.lotKey) { this.lotKey = null; host.innerHTML = ''; host._html = undefined; }
      if (!ov) { setHtml(host, ''); return; }
      const nm = (id) => (this.byId[id] ? this.byId[id].name : '?');
      const pending = ov.pending || [ov.nomineeId], all = ov.nominees || pending;
      const mine = pending.includes(me.id) && me.status === 'active';
      const opts = (mine && ov.options) || [];
      const adv = opts.includes('advocate');
      const others = all.filter((id) => id !== me.id).map((id) => esc(nm(id)));
      const waitFor = pending.map((id) => esc(nm(id))).join(L(' и '));
      const lead = !mine ? (pending.length > 1 ? L('{0} решают, сыграть ли Адвоката.', waitFor) : L('{0} решает, сыграть ли Адвоката.', waitFor))
        : (all.length > 1 ? L('Голоса против вас и {0} разделились поровну.', others.join(L(' и '))) : L('Вас собираются исключить.'))
          + (adv ? L(' «Адвокат» отменит один голос против вас.') : '') + (all.length > 1 ? L(' Если поровну останется, решит полиция.') : '');
      const btns = mine ? `<div class="row-acts">${adv ? `<button class="btn btn-primary" data-a="advocate" data-play="1">${L('Сыграть Адвоката')}</button>` : ''}<button class="btn" data-a="advocate" data-play="0">${L('Не играть')}</button></div>` : '<div class="wait"><span class="dots"><i></i><i></i><i></i></span></div>';
      const inner = `<h3>${L('Адвокат')} <span class="left" data-end="${ov.endsAt}">0:00</span></h3>
        <p>${lead}</p>${btns}`;
      if (setHtml(host, `<div class="ov" role="alertdialog">${inner}</div>`)) this.tickClocks();
    },

    /* ---------- Ничья после переголосования: рулетка «Полиция решает» ----------
       Лента строится один раз на ничью и крутится один раз; при обновлениях состояния её не трогаем.
       Кто вылетит, решил сервер, лента лишь останавливается на нём. Опоздавший видит уже остановленную ленту. */
    renderLottery(host, ov) {
      const key = String(ov.startedAt);
      if (this.lotKey === key) return;
      this.lotKey = key;
      host._html = undefined;
      const ids = ov.candidates || [];
      const nm = (id) => (this.byId[id] ? this.byId[id].name : '?');
      const N = 46, W = 38;
      // Лента из перемешанных блоков по всем кандидатам: имена чередуются, а не идут подряд.
      const seq = [];
      while (seq.length < N) { const blk = ids.slice().sort(() => Math.random() - 0.5); if (seq.length && blk[0] === seq[seq.length - 1]) blk.push(blk.shift()); seq.push(...blk); }
      seq.length = N; seq[W] = ov.winnerId;
      host.innerHTML = `<div class="lot" role="alertdialog" aria-label="${L('Полиция решает, кого задержать')}">
        <div class="lot-box">
          <span class="label">${L('Голоса дважды разделились поровну')}</span>
          <h3>${L('Полиция решает, кого задержать')}</h3>
          <div class="lot-win"><div class="lot-strip">${seq.map((id, i) => `<div class="lot-item${i === W ? ' pick' : ''}">${avatar(nm(id), this.idx[id], 'lg')}<b>${esc(nm(id))}</b></div>`).join('')}</div></div>
          <p class="lot-res" aria-live="polite">&nbsp;</p>
        </div></div>`;
      const win = host.querySelector('.lot-win'), strip = host.querySelector('.lot-strip'), items = strip.children;
      const total = Math.max(1500, ov.endsAt - ov.startedAt), spin = Math.min(6500, total - 1500);
      const left = spin - (Net.now() - ov.startedAt);
      const step = items[1].offsetLeft - items[0].offsetLeft, iw = items[0].offsetWidth;
      const jitter = (Math.random() - 0.5) * iw * 0.6;
      const to = -(W * step + iw / 2 - win.clientWidth / 2 + jitter);
      const done = () => {
        if (this.lotKey !== key) return;
        items[W].classList.add('won');
        host.querySelector('.lot-res').textContent = L('Задержан: {0}', nm(ov.winnerId));
      };
      const still = left < 300 || matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (still) { strip.style.transform = `translateX(${to}px)`; done(); return; }
      strip.style.transform = 'translateX(0px)';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        strip.style.transition = `transform ${left}ms cubic-bezier(.06, .62, .12, 1)`;
        strip.style.transform = `translateX(${to}px)`;
      }));
      setTimeout(done, left + 50);
    },

    /* ---------- Админский пульт ---------- */
    renderDock(st) {
      const host = this.root.querySelector('#gDock');
      if (!(st.isAdmin && st.test)) { setHtml(host, ''); return; }
      const g = this.g;
      const asBtns = st.players.map((p) => `<button class="${st.meId === p.id ? 'on' : ''}" data-a="as" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join('');
      const speeds = [1, 0.5, 0.25, 0.1, 0.05].map((v) => `<option value="${v}" ${Math.abs((st.speed || 1) - v) < 0.001 ? 'selected' : ''}>${v === 1 ? L('Обычная') : L('×{0} быстрее', Math.round(1 / v))}</option>`).join('');
      const god = g.god;
      const godHtml = god ? `<details id="godD" ${this.godOpen ? 'open' : ''}><summary class="label" style="cursor:pointer">${L('Режим бога · сид {0}', esc(god.seed))}</summary><div class="god" style="margin-top:8px">
        ${god.players.map((p) => `<div class="gp ${p.role}"><b>${esc(p.name)} · ${p.role === 'killer' ? L('УБИЙЦА') : p.role === 'accomplice' ? L('сообщник') : L('невиновный')}${p.auto ? L(' · авто') : ''}${god.votes[p.id] ? ` ${L('· голос → {0}', esc((this.byId[god.votes[p.id]] || {}).name || '?'))}` : ''}</b>
          <span>${esc(p.card.profession)} · ${esc(p.card.habit)}</span>
          <span>${L('Алиби: {0}{1}', esc(alibiTxt(p.card.alibi.claim)), p.card.alibi.lied ? ` <span class="lie" style="color:var(--red)">${L('(правда: {0})', esc(p.card.alibi.real.loc))}</span>` : '')}</span>
          <span>${L('Секрет: {0}', esc(p.card.secret))}</span>${p.card.goal && !g.small ? `<span>${L('Цель: {0}', esc(p.card.goal))}</span>` : ''}
          <span class="muted">${L('Карты: {0}', p.cards.map((c) => `${esc(c.name)}${c.used ? '✗' : ''}`).join(', '))}</span></div>`).join('')}
        ${god.team ? god.team.map((p) => `<div class="gp ${p.role === 'mole' ? 'killer' : ''}"><b>${esc(p.name)} · ${p.role === 'mole' ? L('КРОТ') : L('следователь')}${p.auto ? L(' · авто') : ''}${god.votes[p.id] ? ` ${L('· голос → {0}', esc((this.byId[god.votes[p.id]] || {}).name || '?'))}` : ''}</b>
          <span class="muted">${L('Карты: {0}', p.cards.map((c) => `${esc(c.name)}${c.used ? '✗' : ''}`).join(', '))}</span></div>`).join('') : ''}
        <div class="gp"><b>${L('Улики')}</b>${god.clues.map((c) => `<span>${c.revealedRound ? '✓' : '·'} ${esc(c.label)}${c.planted ? ` ${L('(подмена, было: {0})', esc(c.orig))}` : ''}: ${esc(c.fits.join(', '))}</span>`).join('')}</div></div></details>` : '';
      setHtml(host, `<details class="dock" id="dockD" ${this.dockOpen ? 'open' : ''}><summary>${L('Пульт теста')} <span>${esc(g.phase)}${g.round ? ` ${L('· р{0}', g.round)}` : ''}</span></summary>
        <div class="dock-body">
          <div class="row-acts"><button class="btn btn-sm" data-a="admin" data-v="${g.paused ? 'resume' : 'pause'}">${g.paused ? L('Продолжить') : L('Пауза')}</button><button class="btn btn-sm" data-a="admin" data-v="skip">${L('Пропустить фазу')}</button><button class="btn btn-sm" data-a="admin" data-v="auto">${L('Автопилот')}</button><button class="btn btn-sm" data-a="admin" data-v="mode" data-val="${g.mode === 'host' ? 'timers' : 'host'}">${L('Режим: {0}', g.mode === 'host' ? L('ведущий') : L('таймеры'))}</button></div>
          <div class="field"><label>${L('Скорость')}</label><select class="input" data-a="speed">${speeds}</select></div>
          <div><div class="label" style="margin-bottom:6px">${L('Играть за')}</div><div class="dock-play">${asBtns}</div></div>
          <div class="row-acts"><button class="btn btn-sm" data-a="admin" data-v="restart">${L('Заново, тот же сид')}</button><button class="btn btn-sm" data-a="admin" data-v="next">${L('Новое дело')}</button><button class="btn btn-sm btn-ghost" data-a="leave">${L('Выйти')}</button></div>
          ${godHtml}</div></details>`);
    },

    /* ---------- Клики ---------- */
    async onClick(e) {
      const b = e.target.closest('[data-a]');
      if (!b || b.disabled) return;
      const a = b.dataset.a, st = this.st, g = this.g;
      if (!g) return;
      if (a === 'tab') { this.root.dataset.tab = b.dataset.tab; if (b.dataset.tab === 'journal') { this.unread = false; const l = this.root.querySelector('.j-list'); l.scrollTop = l.scrollHeight; } this.renderNav(); return; }
      if (a === 'person') return this.popover(b.dataset.id);
      if (a === 'reveal') return this.act('reveal', { trait: b.dataset.trait, target: b.dataset.id });
      if (a === 'molevote') return this.act('molevote', { target: b.dataset.id });
      if (a === 'alibi') return this.act('alibi', { loc: b.dataset.loc });
      if (a === 'ready') return this.act('ready');
      if (a === 'endturn') return this.act('endturn', { step: g.step });
      if (a === 'endaccuse') return this.act('endaccuse', { step: g.step });
      if (a === 'vote') return this.act('vote', { target: b.dataset.id });
      if (a === 'advocate') return this.act('advocate', { play: b.dataset.play === '1' });
      if (a === 'endspeech') return this.act('endspeech');
      if (a === 'accomplice') return this.act('accomplice', { mode: b.dataset.mode, target: b.dataset.id });
      if (a === 'card') return this.playCard(b.dataset.type);
      if (a === 'recase') {
        const cur = (this.st.cases || []).find((c) => c.title === g.case.title);
        const id = await UI.pickCase(this.st, { title: L('Сменить дело'), sub: L('Партия начнётся заново с другим делом, карточки раздадутся заново.'), current: cur && cur.id });
        if (!id) return;
        const r = await Net.call('room:recase', { caseId: id });
        if (!r.ok) fail(r); else toast(L('Дело сменилось. Прочитайте новую карточку.'));
        return;
      }
      if (a === 'hnext') return this.act('host', { do: 'next', step: g.step });
      if (a === 'hback') return this.act('host', { do: 'back', step: g.step });
      if (a === 'hext') return this.act('host', { do: 'extend' });
      if (a === 'hclock') return this.act('host', { do: 'clock', op: b.dataset.v });
      if (a === 'hmode') { const r = await Net.call('room:setting', { key: 'mode', value: g.manual ? 'timers' : 'host' }); if (!r.ok) fail(r); return; }
      if (a === 'leave') return Net.call('room:leave');
      if (a === 'quit' && this.watch) {
        const ok = await UI.confirmBox({ title: L('Перестать смотреть?'), sub: L('Вернуться можно по той же ссылке или коду комнаты.'), ok: L('Выйти') });
        if (ok) Net.call('room:leave');
        return;
      }
      if (a === 'quit') {
        const mine = st.hostId === st.realMeId;
        const pick = await UI.choose({
          title: L('Выйти из игры'),
          sub: L('Если вы просто отвлеклись или связь пропала, вернуться можно в любой момент: зайдите на главную страницу и нажмите «Переподключиться».'),
          items: [
            { id: 'home', title: L('На главную, место сохранить'), sub: L('Ход за вас сделает автопилот, пока вы не вернётесь') },
            { id: 'quit', title: L('Покинуть партию насовсем'), sub: mine ? L('Ведущим станет другой игрок, вернуться нельзя. Зато можно сразу зайти в другую комнату.') : L('Вернуться нельзя. Зато можно сразу зайти в другую комнату, например, если вас исключили и нашлась другая компания.') },
          ],
          cancel: L('Остаться в игре'),
        });
        if (pick === 'home') location.hash = '#/';
        else if (pick === 'quit') {
          const ok = await UI.confirmBox({ title: L('Покинуть партию насовсем?'), sub: L('Место займёт автопилот, и обратно в эту партию вы не попадёте.'), ok: L('Покинуть'), danger: true });
          if (ok) Net.call('room:leave');
        }
        return;
      }
      if (a === 'as') { const r = await Net.call('admin:as', { playerId: b.dataset.id === st.realMeId ? null : b.dataset.id }); if (!r.ok) fail(r); return; }
      if (a === 'admin') { const r = await Net.call('admin:room', { code: st.code, action: b.dataset.v, value: b.dataset.val, playerId: st.realMeId }); if (!r.ok) fail(r); return; }
    },

    popover(id) {
      const p = this.byId[id]; if (!p) return;
      UI.modal((box, close) => {
        const role = p.role === 'killer' ? `<span class="badge red">${L('убийца')}</span>` : p.role === 'accomplice' ? `<span class="badge yellow">${L('сообщник')}</span>` : '';
        box.innerHTML = `<div class="pop"><h3>${avatar(p.name, this.idx[id])}${esc(p.name)} ${role}</h3><div class="dossiers">${this.dossier(p)}</div>
          <div class="row"><button class="btn" data-close>${L('Закрыть')}</button></div></div>`;
        box.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
      });
    },

    async pickPlayer(title, sub, ids, note) {
      return UI.choose({ title, sub, note, items: ids.map((id) => ({ id, title: this.byId[id].name, name: this.byId[id].name, avatarIdx: this.idx[id], seat: this.idx[id] + 1, photo: photoAt[this.idx[id]], sub: this.byId[id].tags.map((t) => t.label).join(', ') || undefined })) });
    },
    others() { return this.g.players.filter((p) => p.status === 'active' && p.id !== this.me.id).map((p) => p.id); },

    async playCard(preType) {
      const me = this.me;
      const list = me.cards.map((c, i) => ({ c, i })).filter((x) => !x.c.used);
      const type = preType || await UI.choose({ title: L('Карта действия'), sub: L('Каждую карту можно сыграть один раз.'), items: list.map(({ c }) => ({ id: c.type, title: c.name, sub: c.type === 'advocate' ? L('Сработает сама, когда вас будут исключать') : c.type === 'trail' ? L('Сработает сама, когда вас обыщут') : c.desc, disabled: PASSIVE.includes(c.type) })) });
      if (!type) return;
      let ids = this.others();
      if (type === 'confront') {
        if (ids.length < 2) return toast(L('Для очной ставки нужны двое других игроков.'), 'err');
        const a = await this.pickPlayer(L('Очная ставка: кого сводим?'), L('Выберите первого игрока. Оба при всех раскроют алиби, связь с жертвой или мотив.'), ids);
        if (!a) return;
        const b = await this.pickPlayer(L('Очная ставка: с кем?'), L('Второй игрок, которого сводим с {0}.', this.byId[a].name), ids.filter((id) => id !== a));
        if (!b) return;
        const traits = Content.CONFRONT_TRAITS.filter((t) => !this.byId[a].revealed[t] || !this.byId[b].revealed[t]);
        if (!traits.length) return toast(L('У обоих уже открыты алиби, связь с жертвой и мотив.'), 'err');
        const trait = await UI.choose({ title: L('Что сверяем?'), items: traits.map((t) => ({ id: t, title: T[t] })) });
        if (trait) this.act('card', { type, target: a, target2: b, trait });
        return;
      }
      if (type === 'swap') {
        ids = (me.swapTargets || []).filter((id) => id !== me.id);
        if (!ids.length) return toast(this.small && this.g.round < 2 ? L('«Подмену улики» можно сыграть со второго раунда.') : L('Подменять уже нечего: все улики найдены.'), 'err');
        const target = await this.pickPlayer(L('На кого навести улику?'), L('Улика, которую найдут следующей, поменяется и укажет на этого игрока. Её откроют в начале следующего раунда, как обычную, и никто не узнает, что это вы.'), ids);
        if (target) this.act('card', { type, target });
        return;
      }
      if (type === 'lab') {
        const clues = this.g.clues.filter((k) => !k.checked);
        if (!clues.length) return toast(this.g.clues.length ? L('Все найденные улики вы уже проверили.') : L('Пока нет ни одной найденной улики.'), 'err');
        const clueId = await UI.choose({ title: L('Какую улику проверить?'), sub: L('Узнаете только вы: правдивая улика или её подменили.'), items: clues.map((k) => ({ id: k.id, title: L('Улика {0}: {1}', this.g.clues.indexOf(k) + 1, k.label), sub: k.text })) });
        if (!clueId) return;
        const r = await this.act('card', { type, clueId });
        if (!r.ok) return;
        // Ответ приходит вместе с новым состоянием: улика получает пометку, её и показываем.
        const say = (n) => { const k = this.g.clues.find((x) => x.id === clueId); if (k && k.checked) toast(L('Экспертиза: улика {0} {1}.', this.g.clues.indexOf(k) + 1, k.checked === 'fake' ? L('ложная, её подменили') : L('правдивая'))); else if (n) setTimeout(() => say(n - 1), 250); };
        say(8);
        return;
      }
      const target = await this.pickPlayer(type === 'warrant' ? L('Кого обыскать?') : L('С кого потребовать показания?'), (type === 'warrant' ? L('Результат увидите только вы.') : L('Результат увидят все.')), ids);
      if (!target) return;
      const tp = this.byId[target];
      const pool = type === 'warrant' && !this.small ? Content.SEARCHABLE_TRAITS : Content.ASKABLE_TRAITS;
      const traits = pool.filter((t) => !tp.revealed[t]);
      if (!traits.length) return toast(L('У этого игрока уже всё раскрыто.'), 'err');
      const trait = await UI.choose({ title: L('Какой пункт?'), items: traits.map((t) => ({ id: t, title: T[t] })) });
      if (trait) this.act('card', { type, target, trait });
    },
  };
})();
