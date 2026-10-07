/* Экран партии v2: сверху очередь людей, в центре одна сцена с главным действием, под ней улики.
   Справа свернуть можно карточку, ниже журнал. Ведущий листает фазы кнопкой внизу. На телефоне три вкладки. */
(function () {
  const { esc, icon, avatar, hueOf, fmtClock, setHtml, toast, fail } = UI;
  const Content = UI.Content;
  const T = Content.TRAITS;
  const Screens = (window.Screens = window.Screens || {});

  const alibiTxt = (c) => (c ? `«${c.loc}», ${c.from}–${c.to}` : 'ещё не выбрано');
  const myVal = (card, t) => ({ profession: card.profession, habit: card.habit, relation: card.relation, motive: card.motive, alibi: alibiTxt(card.alibi.claim), secret: card.secret, goal: card.goal }[t]);
  const ROLE = {
    innocent: { cls: 'role-innocent', name: 'Невиновный', hint: 'Найдите убийцу и не дайте исключить своих.', gang: 'Среди вас убийца и его сообщник. Чтобы закрыть дело, исключить нужно обоих. Если их станет столько же, сколько вас, они победят.' },
    killer: { cls: 'role-killer', name: 'Убийца', hint: 'Не выдайте себя. Улики ниже указывают на вас.', gang: 'Не выдайте себя и сообщника. Вам подходят три улики из четырёх, сообщнику тоже три, а кому-то из невиновных столько же.' },
    accomplice: { cls: 'role-accomplice', name: 'Сообщник', hint: 'Вы знаете убийцу. Уводите подозрения.', gang: 'Вы знаете убийцу, и вас обоих ищут. Каждому из вас подходят три улики из четырёх. Вы победите, если хоть один останется в игре или если вас станет столько же, сколько невиновных.' },
  };
  const VIA = { vote: 'Больше всего голосов.', runoff: 'Решило переголосование.', random: 'Голоса дважды разделились поровну, задержала полиция.', final: 'Итог финального голосования.' };
  const PASSIVE = ['advocate', 'trail'];
  const HOST_BTN = {
    brief: ['Начать дело', 'Откроется первая улика'],
    clue: ['К рассказам', 'Каждый расскажет о себе по очереди'],
    turns: ['Передать слово дальше', 'Когда рассказ закончен'],
    talk: ['К обвинениям', 'Когда обсуждение выдохлось'],
    accuse: ['Следующий', 'Когда минута прошла'],
    vote: ['Подвести итог', 'Решает большинство'],
    result: ['Дальше', 'К следующему раунду'],
    poll: ['Подвести итог', 'Слово защиты получат самые подозреваемые'],
    defense: ['Дальше', 'Следующее слово'],
    final: ['Подвести итог', 'Исключённого не вернуть'],
    accomplice: ['Пропустить', 'Если сообщник молчит'],
  };

  Screens.game = {
    mount(root) {
      root.innerHTML = `<div class="game" data-tab="stage" id="game">
        <header class="g-top" id="gTop"></header>
        <div class="g-main">
          <section class="g-stage">
            <section class="case-file" id="gCase" aria-label="Обстоятельства дела"></section>
            <div class="queue" id="gQueue" aria-label="Игроки и очередь рассказов"></div>
            <div class="stage panel" id="gStage"></div>
            <div class="clues-row" id="gClues"></div>
          </section>
          <aside class="g-side">
            <details class="my panel" id="pCard" open></details>
            <section class="journal panel" id="pLog" aria-label="Журнал"></section>
          </aside>
        </div>
        <div class="host-bar" id="gHost"></div>
        <nav class="g-nav" id="gNav" aria-label="Разделы">
          <button data-a="tab" data-tab="stage" class="on">Сцена<i class="dot" hidden></i></button>
          <button data-a="tab" data-tab="card">Карточка</button>
          <button data-a="tab" data-tab="journal">Журнал<i class="dot" hidden></i></button>
        </nav>
        <div id="gOv"></div>
        <div id="gDock"></div>
      </div>`;
      this.root = root.firstElementChild;
      this.seenClues = null; this.phaseKey = null; this.gameKey = null; this.lastChat = 0; this.unread = false;
      this.dockOpen = false; this.godOpen = false;
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
      if (!g || !g.me) return;
      const me = g.me;
      this.me = me;
      this.idx = {}; this.byId = {}; this.conn = {};
      g.players.forEach((p, i) => { this.idx[p.id] = i; this.byId[p.id] = p; });
      st.players.forEach((p) => { this.conn[p.id] = p; });
      const key = `${st.code}:${g.players.map((p) => p.id).join()}:${g.case.title}:${g.god ? g.god.seed : ''}`;
      if (key !== this.gameKey) { this.gameKey = key; this.seenClues = null; this.phaseKey = null; this.lastChat = 0; }

      const pk = `${g.phase}:${g.round}:${g.turn ? g.turn.idx : ''}:${g.accuse ? g.accuse.idx : ''}:${g.defense ? g.defense.idx : ''}:${g.vote ? (g.vote.runoff ? 'r' : '') + g.vote.kind : ''}`;
      const phaseChanged = !!this.phaseKey && this.phaseKey !== pk;
      if (phaseChanged) this.onPhase(g);
      this.phaseKey = pk;

      this.renderTop(st); this.renderCase(); this.renderQueue(); this.renderStage(phaseChanged || !this.stageDrawn); this.renderClues(); this.renderCard(); this.renderHost(st); this.renderOverlay(); this.renderDock(st);
      this.stageDrawn = true;
      this.chat.update(g.feed, { gameKey: key, nameOf: (id) => (this.byId[id] ? this.byId[id].name : '?'), status: me.status === 'out' ? 'вы вне игры' : '' });
      this.renderNav();
      this.tickClocks();
    },

    onPhase(g) {
      if (g.phase === 'clue') toast(g.finale ? 'Последний раунд. Найдены все улики.' : `Раунд ${g.round}. Найдена новая улика.`);
      else if (g.phase === 'turns' && g.turn && g.turn.speakerId === this.me.id) toast('Ваше слово.');
      else if (g.phase === 'accuse' && g.accuse && g.accuse.speakerId === this.me.id) toast('Ваша обвинительная минута.');
      else if (g.phase === 'vote') toast(g.vote && g.vote.runoff ? 'Ничья. Переголосование.' : 'Голосование.');
      else if (g.phase === 'defense' && g.defense && g.defense.speaker === this.me.id) toast('Ваше слово защиты.');
      if (this.root.dataset.tab !== 'stage' && ['turns', 'accuse', 'vote', 'poll', 'final', 'clue', 'result', 'defense'].includes(g.phase)) { this.root.dataset.tab = 'stage'; }
    },

    renderNav() {
      const g = this.g, me = this.me;
      const tab = this.root.dataset.tab;
      if (tab === 'journal') this.unread = false;
      const needs = (me.can.reveal.length > 0) || (me.can.vote && !(g.vote && g.vote.my)) || (g.phase === 'turns' && g.turn && g.turn.speakerId === me.id) || (g.phase === 'accuse' && g.accuse && g.accuse.speakerId === me.id);
      const dots = this.root.querySelectorAll('#gNav .dot');
      dots[0].hidden = !(needs && tab !== 'stage'); dots[1].hidden = !(this.unread && tab !== 'journal');
      this.root.querySelectorAll('#gNav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    },

    /* ---------- Верхняя панель ---------- */
    renderTop(st) {
      const g = this.g;
      const fin = g.finale;
      const crim = g.criminals ? ` · преступников на свободе: ${g.criminals.left} из ${g.criminals.total}` : '';
      const eyebrow0 = g.phase === 'brief' ? 'Вводная' : g.phase === 'verdict' || g.phase === 'accomplice' ? 'Дело закрывается'
        : g.phase === 'turns' && g.turn ? `${fin ? 'Финал' : `Раунд ${g.round} из ${g.rounds}`} · рассказ ${g.turn.idx + 1} из ${g.turn.total}`
        : g.phase === 'accuse' && g.accuse && !g.accuse.done ? `${fin ? 'Финал' : `Раунд ${g.round} из ${g.rounds}`} · обвинение ${g.accuse.idx + 1} из ${g.accuse.total}`
          : `${fin ? 'Финал' : `Раунд ${g.round} из ${g.rounds}`}`;
      const eyebrow = g.phase === 'brief' || g.phase === 'verdict' ? eyebrow0 : eyebrow0 + crim;
      const title = {
        brief: esc(g.case.title), clue: g.finale ? 'Последние <em>улики</em>' : 'Новая <em>улика</em>', turns: 'Круг <em>рассказов</em>', talk: '<em>Обсуждение</em>', accuse: 'Обвинительная <em>минута</em>',
        vote: g.vote && g.vote.runoff ? '<em>Переголосование</em>' : '<em>Голосование</em>', result: 'Итог <em>раунда</em>', poll: 'Тайный <em>опрос</em>',
        defense: 'Слово <em>защиты</em>', final: 'Финальное <em>голосование</em>', verdict: '<em>Приговор</em>', accomplice: 'Последний <em>шанс</em>',
      }[g.phase] || '';
      const pips = Array.from({ length: g.rounds }, (_, i) => {
        const n = i + 1;
        const cls = (n < g.round || (n === g.round && ['verdict', 'accomplice'].includes(g.phase))) ? 'done' : n === g.round && g.phase !== 'brief' ? 'now' : '';
        return `<i class="${cls} ${n === g.rounds ? 'final' : ''}" title="${n === g.rounds ? 'Финал' : `Раунд ${n}`}"></i>`;
      }).join('');
      const dc = st.settings && st.settings.discord ? `<a class="dc-btn" href="${esc(st.settings.discord)}" target="_blank" rel="noopener noreferrer" title="Голосовой чат партии">${icon('discord')}<span>Discord</span></a>` : '';
      setHtml(this.root.querySelector('#gTop'), `
        <div class="g-title"><p class="eyebrow">${esc(eyebrow)}${g.paused ? ' · пауза' : ''}</p><h2>${title}</h2></div>
        <div class="pips" aria-label="Раунды">${pips}</div>
        <div class="g-right">${dc}<button class="leave-btn" data-a="quit" title="Выйти из игры" aria-label="Выйти из игры">×</button><div class="timer" id="gTimer" title="${g.clock && g.clock.state !== 'run' ? 'Часы стоят: отсчёт запускает ведущий' : g.manual ? 'Ориентир по времени: ведущий листает сам' : 'Время фазы'}"><svg viewBox="0 0 56 56"><circle class="bg" cx="28" cy="28" r="24"/><circle class="fg" cx="28" cy="28" r="24" stroke-dasharray="150.8" stroke-dashoffset="0"/></svg><b>0:00</b></div></div>`);
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
      setHtml(this.root.querySelector('#gCase'), `<div class="cf-head"><span class="eyebrow">Дело</span><b>${esc(c.title)}</b></div>
        <div class="cf-facts"><span><em>Жертва</em>${esc(c.victim)}</span><span><em>Время смерти</em><span class="mono">${esc(c.time)}</span></span><span><em>Место</em>${esc(c.scene)}</span></div>
        <p class="cf-text">${esc(c.teaser)}</p>`);
    },

    /* ---------- Очередь людей ---------- */
    renderQueue() {
      const g = this.g, me = this.me;
      const voting = !!g.vote && ['vote', 'poll', 'final'].includes(g.phase);
      const chips = g.players.map((p, i) => {
        const isMe = p.id === me.id, out = p.status === 'out';
        let st = '', cls = '';
        if (out) st = '<span class="st">вне игры</span>';
        else if (p.speaking || (g.phase === 'defense' && g.defense && g.defense.speaker === p.id)) { st = '<span class="st go">говорит</span>'; cls = 'speaking'; }
        else if (g.phase === 'accuse' && g.accuse && g.accuse.queue.indexOf(p.id) >= 0 && (g.accuse.done || g.accuse.queue.indexOf(p.id) < g.accuse.idx)) st = '<span class="st ok">✓</span>';
        else if (g.phase === 'accuse' && g.accuse && g.accuse.queue.includes(p.id)) st = `<span class="st">${g.accuse.queue.indexOf(p.id) + 1}-й</span>`;
        else if (g.phase === 'turns' && p.spoke) st = '<span class="st ok">✓</span>';
        else if (voting && p.voted) st = '<span class="st ok">✓</span>';
        else if ((g.phase === 'brief' || (g.phase === 'talk' && !g.manual)) && p.ready) st = '<span class="st ok">✓ готово</span>';
        else if (g.phase === 'turns' && g.turn && g.turn.queue.includes(p.id)) st = `<span class="st">${g.turn.queue.indexOf(p.id) + 1}-й</span>`;
        const c = this.conn[p.id]; const off = c && !c.connected && !c.isBot;
        const role = out && p.role === 'killer' ? '<span class="role">убийца</span>' : out && p.role === 'accomplice' ? '<span class="role" style="color:var(--amber)">сообщник</span>' : '';
        return `<button class="q-chip ${cls} ${isMe ? 'me' : ''} ${out ? 'out' : ''}" data-a="person" data-id="${esc(p.id)}" title="${esc(p.name)}: показать досье" data-pid="${esc(p.id)}">
          ${p.host ? '<span class="crown">ведущий</span>' : ''}${role}${avatar(p.name, i, off ? 'off' : '')}
          <span class="nm">${esc(p.name)}${isMe ? ' (вы)' : ''}</span>${st || `<span class="st">${p.bot ? 'бот' : off ? 'нет связи' : p.auto ? 'авто' : ''}</span>`}</button>`;
      }).join('');
      if (setHtml(this.root.querySelector('#gQueue'), chips)) {
        const sp = this.root.querySelector('.q-chip.speaking');
        if (sp && sp.scrollIntoView) { try { sp.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch (e) { /* ничего */ } }
      }
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
      const nAct = g.players.filter((p) => p.status === 'active').length;
      const wait = (txt) => `<div class="wait"><span class="dots"><i></i><i></i><i></i></span>${esc(txt)}</div>`;
      const outNote = meOut ? '<p class="muted">Вы вне игры, но можете следить за партией.</p>' : '';

      if (g.phase === 'brief') {
        const killer = me.role === 'killer';
        const readyN = g.players.filter((p) => p.ready).length;
        let alibi = '';
        if (killer && !me.alibiChosen && me.killerInfo) {
          alibi = `<div style="display:grid;gap:10px"><p><b>Выберите алиби.</b> Вы были в «${esc(g.case.scene)}», но скажете, что в другом месте. Если там кто-то был, вас могут поймать.</p>
            <div class="loc-grid">${me.killerInfo.locations.map((l) => `<button class="loc-btn" data-a="alibi" data-loc="${esc(l.loc)}">${esc(l.loc)}<small>${l.crowded ? 'там кто-то был: риск' : 'опровергнуть некому'}</small></button>`).join('')}</div></div>`;
        } else if (killer) alibi = `<p>Ваше алиби: <b>${esc(alibiTxt(me.card.alibi.claim))}</b>. На самом деле вы были в «${esc(g.case.scene)}».</p>`;
        return `<div class="s-head"><p class="eyebrow">Вводная</p><h3>Прочитайте дело и свою карточку</h3><p>Обстоятельства дела всю партию висят наверху. Стройте рассказ так, чтобы он с ними сходился.</p></div>
          ${alibi}
          <div class="act-row"><button class="btn btn-primary" data-a="ready" ${me.ready ? 'disabled' : ''}>${me.ready ? 'Всё готово' : 'Карточка прочитана'}</button><span class="muted">Готовы: ${readyN} из ${g.players.length}</span></div>`;
      }

      if (g.phase === 'clue') {
        const fresh = g.clues.filter((c) => c.round === g.round);
        return `<div class="s-head"><p class="eyebrow">${g.finale ? 'Финал' : `Раунд ${g.round} из ${g.rounds}`}</p><h3>${g.finale ? 'Последние улики' : 'Новая улика'}</h3></div>
          <div style="display:grid;gap:12px;justify-items:start">${fresh.map((c) => `<article class="paper clue big new"><span class="no">Улика ${g.clues.indexOf(c) + 1}</span><p>${esc(c.text)}</p><span class="tagname">${esc(c.label)}</span></article>`).join('')}</div>
          <div class="talk-hint">${icon('mic')}<span>Кому это подходит? Выскажите версии вслух, потом пойдёт круг рассказов.</span></div>`;
      }

      if (g.phase === 'turns' && g.turn) {
        const sp = this.byId[g.turn.speakerId], mine = sp.id === me.id;
        // Что говорящий раскрыл в свой ход
        let ti = -1; g.feed.forEach((f, i) => { if (f.kind === 'turn' && f.who === sp.id) ti = i; });
        const rev = ti >= 0 ? g.feed.slice(ti + 1).filter((f) => f.kind === 'reveal' && f.who === sp.id).slice(-1)[0] : null;
        let body = '';
        if (mine) {
          if (me.can.reveal.length) {
            body = `<div style="display:grid;gap:10px"><p><b>Выберите, что о себе рассказать.</b> Это увидят все.</p>
              <div class="trait-grid">${me.can.reveal.map((t) => `<button class="trait-btn ${t === 'secret' ? 'risky' : ''}" data-a="reveal" data-trait="${t}"><span class="t">${esc(T[t])}${t === 'secret' ? ' · рискованно' : ''}</span><span class="v">${esc(myVal(me.card, t))}</span></button>`).join('')}</div>
              ${me.can.reveal.every((t) => t === 'secret') ? '<div class="act-row"><button class="btn" data-a="endturn">Ничего не открывать</button><span class="muted">Безопасных пунктов не осталось, тайну открывать необязательно.</span></div>' : ''}
              ${me.can.locked && me.can.locked.length ? `<p class="muted card-note" style="max-width:none;margin:0">${me.can.locked.includes('habit') ? 'Особенность вы уже не откроете сами, ведь профессия открыта.' : 'Профессию вы уже не откроете сами, ведь особенность открыта.'} Её раскроют только «Обыск» или «Показания».</p>` : me.can.reveal.includes('profession') && me.can.reveal.includes('habit') ? '<p class="muted card-note" style="max-width:none;margin:0">Из особенности и профессии сами вы откроете только одно. Второе раскроют только карты.</p>' : ''}</div>`;
          } else {
            const pr = rev && rev.trait ? Content.PROMPTS[rev.trait] : Content.PROMPTS.free;
            body = `${rev ? `<div class="paper said enter"><span class="label">Вы открыли</span><p>${esc(rev.text.replace(/^[^:]+ раскрывает: /, ''))}</p></div>` : ''}
              <div class="talk-hint">${icon('mic')}<span>${esc(pr)}</span></div>
              <div class="act-row"><button class="btn btn-primary" data-a="endturn">Рассказ закончен</button><span class="muted">Следующий получит слово сразу.</span></div>`;
          }
        } else {
          body = `${rev ? `<div class="paper said enter"><span class="label">Раскрыто</span><p>${esc(rev.text.replace(/^[^:]+ раскрывает: /, ''))}</p></div>` : wait(`${sp.name} выбирает, что рассказать`)}
            <div class="talk-hint">${icon('mic')}<span>Слушайте и запоминайте. Вопросы лучше держать до обсуждения.</span></div>`;
        }
        return `<div class="speaker">${avatar(sp.name, this.idx[sp.id], 'lg')}<div><p class="eyebrow">${mine ? 'Ваше слово' : 'Говорит'}</p><h3>${esc(sp.name)}</h3></div></div>${body}${outNote}`;
      }

      if (g.phase === 'accuse' && g.accuse) {
        const a = g.accuse;
        if (a.done) {
          return `<div class="s-head"><p class="eyebrow">Обвинения окончены</p><h3>Все высказались</h3><p>Ведущий начнёт голосование.</p></div>${wait('Ждём ведущего')}${outNote}`;
        }
        const sp = this.byId[a.speakerId], mine = sp.id === me.id;
        const hint = mine ? 'У вас минута. Скажите, кого подозреваете и почему: улики, алиби, нестыковки в рассказах.'
          : `Слушайте ${sp.name}. Минута на то, кого подозревают и почему.`;
        return `<div class="speaker">${avatar(sp.name, this.idx[sp.id], 'lg')}<div><p class="eyebrow">${mine ? 'Ваша обвинительная минута' : 'Обвиняет'}</p><h3>${esc(sp.name)}</h3></div></div>
          <div class="talk-hint">${icon('mic')}<span>${esc(hint)}</span></div>
          ${mine && me.can.endaccuse ? '<div class="act-row"><button class="btn btn-primary" data-a="endaccuse">Закончить минуту</button><span class="muted">Слово перейдёт следующему.</span></div>' : ''}${g.manual ? '<p class="muted">Следующего включает ведущий.</p>' : ''}${outNote}`;
      }

      if (g.phase === 'talk') {
        const usable = me.cards.some((c) => !c.used && !PASSIVE.includes(c.type));
        const readyN = g.players.filter((p) => p.status === 'active' && p.ready).length;
        const passive = !usable && me.cards.find((c) => !c.used && PASSIVE.includes(c.type));
        const cardBtn = passive ? `<span class="muted card-note">Ваша карта «${esc(passive.name)}» сработает сама, когда вас соберутся исключить.</span>` : `<button class="btn" data-a="card" ${usable && me.can.card ? '' : 'disabled'}>${me.cards.every((c) => c.used) ? 'Карты сыграны' : 'Карта действия'}</button>`;
        const acts = !meOut ? `<div class="act-row">${cardBtn}
          ${g.manual ? '<span class="muted">К обвинениям переходит ведущий.</span>' : `<button class="btn ${me.ready ? '' : 'btn-primary'}" data-a="ready">${me.ready ? 'Отменить готовность' : 'Готово к обвинениям'}</button><span class="muted">Готовы: ${readyN} из ${nAct}</span>`}</div>` : '';
        return `<div class="s-head"><p class="eyebrow">Свободное обсуждение</p><h3>${g.gang ? 'Кто здесь убийца и сообщник?' : 'Кто из нас убийца?'}</h3><p>Сверяйте алиби, ищите совпадения с уликами, спрашивайте друг друга.</p></div>${acts}${outNote}
          <div class="dossiers">${g.players.map((p) => this.dossier(p)).join('')}</div>`;
      }

      if (['vote', 'poll', 'final'].includes(g.phase) && g.vote) {
        const v = g.vote, final = g.phase === 'final';
        const title = g.phase === 'poll' ? (g.gang ? 'Кто убийца и сообщник?' : 'Кто убийца?') : final ? 'Кого исключить окончательно?' : v.runoff ? 'Ничья. Кого исключаем?' : 'Кого исключаем?';
        const sub = g.phase === 'poll' ? (g.gang ? 'Опрос тайный. Трое с наибольшим числом голосов получат слово защиты.' : 'Опрос тайный. Двое с наибольшим числом голосов получат слово защиты.') : final ? (g.gang ? `Исключённого не вернуть. Осталось исключений: ${g.kicksLeft}, а вместе с ними решится исход дела.` : 'Последний выбор. Исключённого не вернуть, а вместе с ним решится исход дела.') : v.runoff ? 'Голоса разделились. Выбор только между теми, кто набрал поровну.' : 'Исключить придётся одного. Голос можно поменять до подведения итога.';
        const cands = v.candidates.filter((id) => id !== me.id);
        const can = me.can.vote;
        const grid = can ? `<div class="vote-grid">${cands.map((id) => {
          const p = this.byId[id];
          const hits = p.tags.filter((t) => g.clues.some((c) => c.tag === t.key)).map((t) => t.label);
          return `<button class="vote-btn ${final ? 'big' : ''} ${v.my === id ? 'on' : ''}" data-a="vote" data-id="${esc(id)}">${avatar(p.name, this.idx[id])}<span><b>${esc(p.name)}</b>${hits.length ? `<small>совпало с уликой: ${esc(hits.join(', '))}</small>` : ''}</span></button>`;
        }).join('')}</div>` : wait(meOut ? 'Голосуют те, кто ещё в игре' : 'Голоса принимаются');
        const vp = g.players.filter((p) => p.status === 'active').map((p) => `<span title="${esc(p.name)}">${avatar(p.name, this.idx[p.id], p.voted ? 'on' : '')}</span>`).join('');
        return `<div class="s-head"><p class="eyebrow">${g.phase === 'poll' ? 'Финал · опрос' : final ? 'Финал' : `Раунд ${g.round}`}</p><h3>${title}</h3><p>${sub}</p></div>${grid}
          <div class="vp"><span>Проголосовали ${v.voted.length} из ${nAct}:</span>${vp}</div>${v.my ? `<p class="muted">Ваш голос: ${esc(this.byId[v.my].name)}.</p>` : can ? `<p class="muted">${v.candidates.includes(me.id) ? 'Не выберете, и голос уйдёт против вас.' : 'Не выберете, и голос пропадёт.'}</p>` : ''}`;
      }

      if (g.phase === 'result') {
        const k = g.kicks[g.kicks.length - 1];
        if (!k) return '';
        const p = this.byId[k.id];
        // В обычном режиме роль выбывшего скрыта до конца дела, для всех одинаково.
        const hidden = g.hints !== 'light';
        const role = hidden ? 'Роль скрыта' : p.role === 'accomplice' ? 'Сообщник' : p.role === 'killer' ? 'Убийца' : 'Невиновный';
        const left = g.criminals ? g.criminals.left : null;
        const after = hidden ? 'Кем был этот игрок, станет известно в конце дела.' : p.role === 'killer' ? 'Это был убийца, но сообщник ещё среди вас.' : p.role === 'accomplice' ? (g.gang ? 'Это был сообщник, но убийца остаётся среди вас.' : 'Это был сообщник убийцы, но сам убийца остаётся среди вас.') : (g.gang ? (left === 1 ? 'Это был невиновный. Один из преступников всё ещё среди вас.' : 'Это был невиновный. Оба преступника всё ещё среди вас.') : 'Это был невиновный. Убийца всё ещё среди вас.');
        const max = Math.max(1, ...Object.values(k.count));
        const rows = Object.keys(k.count).sort((a, b) => k.count[b] - k.count[a]).map((id) => {
          return `<div class="tr ${id === k.id ? 'top' : ''}"><span>${esc(this.byId[id].name)}</span><span class="bar"><i style="width:${Math.round(100 * k.count[id] / max)}%"></i></span><b>${k.count[id]}</b></div>`;
        }).join('');
        return `<div class="s-head"><p class="eyebrow">Раунд ${k.round} из ${g.rounds}</p><h3>${esc(p.name)} вне игры</h3><p>${esc(VIA[k.via] || '')} ${esc(after)}</p></div>
          <div class="kick-card"><div class="flip"><div class="flip-inner"><div class="paper"><span class="label">${hidden ? 'Вне игры' : 'Роль раскрыта'}</span><h3>${esc(p.name)}</h3><span class="stamp">${role}</span>
            ${p.revealed.profession ? `<p style="margin-top:8px"><b>${esc(p.revealed.profession.text)}</b></p>` : ''}${p.revealed.motive ? `<p style="font-size:14px;margin-top:6px">Мотив: ${esc(p.revealed.motive.text)}</p>` : ''}</div></div></div>
            <div class="tally">${rows}</div></div>
          <div class="talk-hint">${icon('mic')}<span>Голосование анонимное. Обсудите итог голосом: кто и почему мог голосовать против.</span></div>`;
      }

      if (g.phase === 'defense' && g.defense) {
        const d = g.defense, sp = this.byId[d.speaker], mine = d.speaker === me.id;
        return `<div class="speaker">${avatar(sp.name, this.idx[sp.id], 'lg')}<div><p class="eyebrow">Слово защиты</p><h3>${esc(sp.name)}</h3></div></div>
          <p>${mine ? 'Объясните своё алиби и совпадения с уликами. Говорите вслух.' : 'Слушайте и запоминайте. Голосовать вы будете сразу после защиты.'}</p>
          <div class="act-row">${d.order.map((id, i) => `<span class="badge ${i === d.idx ? 'yellow' : i < d.idx ? 'green' : ''}">${esc(this.byId[id].name)}${i < d.idx ? ' · уже выступали' : i === d.idx ? ' · говорит' : ' · следующий'}</span>`).join('')}</div>
          ${mine ? '<div class="act-row"><button class="btn btn-primary" data-a="endspeech">Речь закончена</button></div>' : ''}`;
      }

      if (g.phase === 'verdict' && g.verdict) {
        const v = g.verdict, kp = this.byId[v.kickedId];
        const role = kp.role === 'killer' ? 'Убийца' : kp.role === 'accomplice' ? 'Сообщник' : 'Невиновный';
        const text = v.reason === 'caught' ? (g.gang ? 'Убийца и сообщник исключены. Невиновные победили.' : 'Убийца исключён. Невиновные победили.') : v.reason === 'outnumbered' ? 'Преступников осталось столько же, сколько невиновных. Они победили.' : g.gang ? 'Исключения закончились, а кто-то из преступников остался на свободе.' : 'Исключили невиновного. Убийца остаётся на свободе.';
        return `<div class="verdict"><div class="flip"><div class="flip-inner"><div class="paper"><span class="label">Исключён</span><h3>${esc(kp.name)}</h3><span class="stamp">${role}</span>
          ${kp.revealed.profession ? `<p style="margin-top:8px"><b>${esc(kp.revealed.profession.text)}</b></p>` : ''}${kp.revealed.motive ? `<p style="font-size:14px;margin-top:6px">Мотив: ${esc(kp.revealed.motive.text)}</p>` : ''}</div></div></div>
          <div class="res">${esc(text)}</div><span class="stamp">${v.winner === 'innocent' ? 'Дело раскрыто' : g.gang ? 'Преступники на свободе' : 'Убийца на свободе'}</span></div>`;
      }

      if (g.phase === 'accomplice') {
        if (me.role === 'accomplice') {
          const cands = g.players.filter((p) => p.id !== me.id && p.role !== 'killer');
          return `<div class="s-head"><p class="eyebrow">Последний шанс</p><h3>Убийцу исключили</h3><p>Назовите самого опасного из остальных: угадаете, получите очки. Или уйдите незамеченным.</p></div>
            <div class="vote-grid">${cands.map((p) => `<button class="vote-btn" data-a="accomplice" data-mode="target" data-id="${esc(p.id)}">${avatar(p.name, this.idx[p.id])}<span><b>${esc(p.name)}</b><small>назвать опасным</small></span></button>`).join('')}</div>
            <div class="act-row"><button class="btn" data-a="accomplice" data-mode="stealth">Уйти незамеченным</button></div>`;
        }
        return `<div class="s-head"><p class="eyebrow">Последний шанс</p><h3>Слово сообщника</h3></div>${wait('Сообщник решает, как поступить')}`;
      }
      return '';
    },

    /* Досье игрока: что открыто и что выяснено ордером */
    dossier(p) {
      const g = this.g, me = this.me;
      const i = this.idx[p.id], clueTags = new Set(g.clues.map((c) => c.tag));
      const keys = Object.keys(p.revealed);
      const hits = p.tags.filter((t) => clueTags.has(t.key));
      const notes = me.notes.filter((n) => n.targetId === p.id);
      return `<div class="dos ${p.id === me.id ? 'me' : ''} ${p.status === 'out' ? 'out' : ''}"><div class="dos-h">${avatar(p.name, i, 'sm')}<span>${esc(p.name)}</span></div>
        ${hits.length ? `<div class="chips">${hits.map((t) => `<span class="chip hit" title="Совпадает с уликой">${esc(t.label)}</span>`).join('')}</div>` : ''}
        ${keys.length ? keys.map((k) => `<div class="r"><span class="label">${esc(T[k])}</span><span>${esc(p.revealed[k].text)}</span></div>`).join('') : '<span class="none">Пока ничего не открыто.</span>'}
        ${notes.map((n) => `<div class="note">${n.kind === 'lab' ? `<b>Экспертиза.</b> ${esc(n.text)}` : n.kind === 'swap' ? `<b>Подмена.</b> ${esc(n.text)}` : n.kind === 'trail' ? `<b>Ложный след.</b> ${esc(n.text)}` : `<b>Обыск: ${esc(n.label)}.</b> ${esc(n.text)}${n.extra ? `<br>${esc(n.extra)}` : ''}`}</div>`).join('')}</div>`;
    },

    /* ---------- Улики ---------- */
    renderClues() {
      const g = this.g;
      const slots = Math.max(g.rounds, g.clues.length);
      if (this.seenClues === null) this.seenClues = new Set(g.clues.map((x) => x.id));
      const cl = [];
      for (let i = 0; i < slots; i++) {
        const k = g.clues[i];
        if (!k) { cl.push(`<div class="clue locked">Улика ${i + 1}<br>${i + 1 <= g.rounds ? `раунд ${i + 1}` : ''}</div>`); continue; }
        const isNew = !this.seenClues.has(k.id) && g.phase !== 'clue'; this.seenClues.add(k.id);
        cl.push(`<article class="paper clue ${isNew ? 'new' : ''}"><span class="no">Улика ${i + 1}${k.mine ? ' · подменена вами' : k.planted ? ' · подменена' : k.checked === 'fake' ? ' · экспертиза: ложная' : k.checked === 'real' ? ' · экспертиза: правдивая' : ''}</span><p>${esc(k.text)}</p><span class="tagname">${esc(k.label)}</span></article>`);
      }
      setHtml(this.root.querySelector('#gClues'), cl.join(''));
    },

    /* ---------- Моя карточка ---------- */
    renderCard() {
      const g = this.g, me = this.me, c = me.card;
      const r = ROLE[me.role];
      let hint = g.gang ? r.gang : r.hint;
      if (me.role === 'killer' && me.killerInfo && me.killerInfo.accompliceId) hint = `Не выдайте себя и сообщника. Ваш сообщник: ${this.byId[me.killerInfo.accompliceId].name}.${g.gang ? ' Каждому из вас подходят три улики из четырёх, двойникам среди невиновных тоже.' : ''}`;
      if (me.role === 'accomplice' && me.accompliceInfo) hint = `Убийца: ${this.byId[me.accompliceInfo.killerId].name}. ${g.gang ? 'Вас обоих ищут. Вам подходят три улики из четырёх, но у кого-то из невиновных тоже три совпадения: на этом и стройте защиту.' : 'Уводите подозрения.'}`;
      const row = (t, val, extra = '') => `<div class="c-row"><span class="label"><span>${esc(T[t])}</span>${me.revealed[t] ? '<em>раскрыто</em>' : ''}</span><span>${esc(val)}</span>${extra}</div>`;
      const lied = c.alibi.lied;
      const alibiExtra = (lied ? `<span class="truth lie">На самом деле вы были: «${esc(c.alibi.real.loc)}»</span>` : '') + (c.witnesses.length ? `<span class="truth">Там же были: ${esc(c.witnesses.map((w) => w.name).join(', '))}</span>` : '');
      const cardState = (k) => {
        if (k.used) return '';
        if (k.type === 'advocate') return '<p class="cstate">Сработает сама: когда вас соберутся исключить, предложим убрать один голос.</p>';
        if (k.type === 'trail') return '<p class="cstate">Сработает сама и тайно: первая проверка, которая могла бы вас выдать, покажет чистый результат. Вы узнаете, кто вас проверял.</p>';
        if (me.status !== 'active') return '';
        if (g.phase === 'talk' && me.can.card) return `<button class="btn btn-sm btn-primary" data-a="card" data-type="${esc(k.type)}">Сыграть</button>`;
        return `<p class="cstate">${g.phase === 'talk' ? 'Подождите, идёт другое действие.' : 'Играется в обсуждении.'}</p>`;
      };
      const cards = me.cards.map((k) => `<div class="cmini ${k.used ? 'used' : ''}"><h4>${esc(k.name)}${k.used ? ' · сыграна' : ''}</h4><p>${esc(k.desc)}</p>${cardState(k)}</div>`).join('');
      const killerClues = me.killerInfo ? `<div class="c-row"><span class="label"><span>${g.gang ? 'Улики по делу' : 'Улики против вас'}</span></span>${me.killerInfo.clues.map((k) => `<span class="${k.revealed && !k.replaced ? 'truth' : ''}">${esc(k.label)}${g.gang ? (k.mine ? ' · про вас' : (me.role === 'killer' ? ' · только про сообщника' : ' · только про убийцу')) : ''} ${k.replaced ? '· подменена, вместо неё нашли другую' : k.revealed ? '· уже найдена' : '· пока скрыта'}</span>`).join('')}</div>` : '';
      const el = this.root.querySelector('#pCard');
      const html = `<summary><h2>Моя карточка</h2><span class="role-banner ${r.cls}" style="padding:4px 9px">${r.name}</span><span class="chev">▾</span></summary>
        <div class="my-body"><p class="muted" style="font-size:13px">${esc(hint)}</p>
          ${row('profession', c.profession)}${row('habit', c.habit)}${row('relation', c.relation)}${row('motive', c.motive)}${row('alibi', alibiTxt(c.alibi.claim), alibiExtra)}${row('secret', c.secret)}${row('goal', c.goal)}
          ${killerClues}<div class="c-row"><span class="label"><span>${me.cards.length > 1 ? 'Карты действий' : 'Карта действия'}</span></span><div class="cards-mini">${cards}</div></div></div>`;
      if (setHtml(el, html)) el.open = this.cardOpen !== false;
    },

    /* Часы ведущего: старт или пауза, заново, +30 секунд. */
    clockButtons(g) {
      const c = g.clock;
      if (!c || g.overlay || g.phase === 'verdict' || (g.phase === 'accuse' && g.accuse && g.accuse.done)) return '';
      const run = c.state === 'run';
      return `<span class="clock-ctl" role="group" aria-label="Таймер">
        <button class="btn btn-sm ${run ? '' : 'btn-amber'}" data-a="hclock" data-v="${run ? 'pause' : 'start'}" title="${run ? 'Поставить таймер на паузу' : 'Запустить отсчёт'}" aria-label="${run ? 'Пауза' : 'Старт'}">${icon(run ? 'pause' : 'play')}<span>${run ? 'Пауза' : c.state === 'pause' ? 'Дальше' : 'Старт'}</span></button>
        <button class="btn btn-sm" data-a="hclock" data-v="reset" title="Начать время фазы заново" aria-label="Сбросить время">${icon('restart')}</button>
        <button class="btn btn-sm" data-a="hext" title="Добавить 30 секунд">+30 с</button></span>`;
    },

    /* ---------- Панель ведущего ---------- */
    renderHost(st) {
      const g = this.g, me = this.me, host = this.root.querySelector('#gHost');
      if (['verdict', 'ended'].includes(g.phase)) { setHtml(host, ''); host.className = 'host-bar'; return; }
      const hostP = this.byId[g.hostId];
      const nAct = g.players.filter((p) => p.status === 'active').length;
      let status = '';
      if (g.phase === 'brief') status = `Готовы: ${g.players.filter((p) => p.ready).length} из ${g.players.length}`;
      else if (g.phase === 'talk' && !g.manual) status = `Готовы к обвинениям: ${g.players.filter((p) => p.status === 'active' && p.ready).length} из ${nAct}`;
      else if (g.vote && ['vote', 'poll', 'final'].includes(g.phase)) status = `Проголосовали: ${g.vote.voted.length} из ${nAct}`;
      else if (g.phase === 'turns' && g.turn) status = `Слово: ${this.byId[g.turn.speakerId].name}`;
      else if (g.phase === 'accuse' && g.accuse) status = g.accuse.done ? 'Все высказались' : `Обвиняет: ${this.byId[g.accuse.speakerId].name}`;
      if (me.isHost) {
        const [label, sub] = HOST_BTN[g.phase] || ['Дальше', ''];
        let next = label;
        if (g.phase === 'turns' && g.turn && g.turn.idx + 1 >= g.turn.total) next = 'К обсуждению';
        if (g.phase === 'accuse' && g.accuse) next = g.accuse.done || g.accuse.idx + 1 >= g.accuse.total ? (g.accuse.done ? 'К голосованию' : 'Завершить обвинения') : 'Следующий';
        const modeLbl = g.manual ? 'Перейти на таймеры' : 'Вернуть ручное ведение';
        setHtml(host, `<div><div class="who"><b>Вы ведёте партию</b><span>${esc(status || sub)}${g.manual ? '' : ' · сейчас идёт по таймерам'}</span></div>
          <div class="acts"><button class="btn btn-sm btn-ghost" data-a="hmode" title="${esc(modeLbl)}">${g.manual ? 'Таймеры' : 'Вручную'}</button>${this.clockButtons(g)}<button class="btn btn-primary" data-a="hnext">${esc(next)}</button></div></div>`);
        host.className = 'host-bar';
      } else {
        const txt = g.manual ? `Ведущий ${hostP ? hostP.name : ''} листает раунды` : 'Партия идёт по таймерам';
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
      const mine = ov.nomineeId === me.id && me.status === 'active';
      const opts = (mine && ov.options) || [];
      const adv = opts.includes('advocate');
      const lead = !mine ? `${esc(nm(ov.nomineeId))} решает, сыграть ли Адвоката.`
        : 'Вас собираются исключить.' + (adv ? ' «Адвокат» отменит один голос против вас.' : '');
      const btns = mine ? `<div class="row-acts">${adv ? '<button class="btn btn-primary" data-a="advocate" data-play="1">Сыграть Адвоката</button>' : ''}<button class="btn" data-a="advocate" data-play="0">Не играть</button></div>` : '<div class="wait"><span class="dots"><i></i><i></i><i></i></span></div>';
      const inner = `<h3>Адвокат <span class="left" data-end="${ov.endsAt}">0:00</span></h3>
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
      host.innerHTML = `<div class="lot" role="alertdialog" aria-label="Полиция решает, кого задержать">
        <div class="lot-box">
          <span class="label">Голоса дважды разделились поровну</span>
          <h3>Полиция решает, кого задержать</h3>
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
        host.querySelector('.lot-res').textContent = `Задержан: ${nm(ov.winnerId)}`;
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
      const speeds = [1, 0.5, 0.25, 0.1, 0.05].map((v) => `<option value="${v}" ${Math.abs((st.speed || 1) - v) < 0.001 ? 'selected' : ''}>${v === 1 ? 'Обычная' : `×${Math.round(1 / v)} быстрее`}</option>`).join('');
      const god = g.god;
      const godHtml = god ? `<details id="godD" ${this.godOpen ? 'open' : ''}><summary class="label" style="cursor:pointer">Режим бога · сид ${esc(god.seed)}</summary><div class="god" style="margin-top:8px">
        ${god.players.map((p) => `<div class="gp ${p.role}"><b>${esc(p.name)} · ${p.role === 'killer' ? 'УБИЙЦА' : p.role === 'accomplice' ? 'сообщник' : 'невиновный'}${p.auto ? ' · авто' : ''}${god.votes[p.id] ? ` · голос → ${esc((this.byId[god.votes[p.id]] || {}).name || '?')}` : ''}</b>
          <span>${esc(p.card.profession)} · ${esc(p.card.habit)}</span>
          <span>Алиби: ${esc(alibiTxt(p.card.alibi.claim))}${p.card.alibi.lied ? ` <span class="lie" style="color:var(--red)">(правда: ${esc(p.card.alibi.real.loc)})</span>` : ''}</span>
          <span>Секрет: ${esc(p.card.secret)}</span><span>Цель: ${esc(p.card.goal)}</span>
          <span class="muted">Карты: ${p.cards.map((c) => `${esc(c.name)}${c.used ? '✗' : ''}`).join(', ')}</span></div>`).join('')}
        <div class="gp"><b>Улики</b>${god.clues.map((c) => `<span>${c.revealedRound ? '✓' : '·'} ${esc(c.label)}${c.planted ? ` (подмена, было: ${esc(c.orig)})` : ''}: ${esc(c.fits.join(', '))}</span>`).join('')}</div></div></details>` : '';
      setHtml(host, `<details class="dock" id="dockD" ${this.dockOpen ? 'open' : ''}><summary>Пульт теста <span>${esc(g.phase)}${g.round ? ` · р${g.round}` : ''}</span></summary>
        <div class="dock-body">
          <div class="row-acts"><button class="btn btn-sm" data-a="admin" data-v="${g.paused ? 'resume' : 'pause'}">${g.paused ? 'Продолжить' : 'Пауза'}</button><button class="btn btn-sm" data-a="admin" data-v="skip">Пропустить фазу</button><button class="btn btn-sm" data-a="admin" data-v="auto">Автопилот</button><button class="btn btn-sm" data-a="admin" data-v="mode" data-val="${g.mode === 'host' ? 'timers' : 'host'}">Режим: ${g.mode === 'host' ? 'ведущий' : 'таймеры'}</button></div>
          <div class="field"><label>Скорость</label><select class="input" data-a="speed">${speeds}</select></div>
          <div><div class="label" style="margin-bottom:6px">Играть за</div><div class="dock-play">${asBtns}</div></div>
          <div class="row-acts"><button class="btn btn-sm" data-a="admin" data-v="restart">Заново, тот же сид</button><button class="btn btn-sm" data-a="admin" data-v="next">Новое дело</button><button class="btn btn-sm btn-ghost" data-a="leave">Выйти</button></div>
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
      if (a === 'reveal') return this.act('reveal', { trait: b.dataset.trait });
      if (a === 'alibi') return this.act('alibi', { loc: b.dataset.loc });
      if (a === 'ready') return this.act('ready');
      if (a === 'endturn') return this.act('endturn');
      if (a === 'endaccuse') return this.act('endaccuse');
      if (a === 'vote') return this.act('vote', { target: b.dataset.id });
      if (a === 'advocate') return this.act('advocate', { play: b.dataset.play === '1' });
      if (a === 'endspeech') return this.act('endspeech');
      if (a === 'accomplice') return this.act('accomplice', { mode: b.dataset.mode, target: b.dataset.id });
      if (a === 'card') return this.playCard(b.dataset.type);
      if (a === 'hnext') return this.act('host', { do: 'next' });
      if (a === 'hext') return this.act('host', { do: 'extend' });
      if (a === 'hclock') return this.act('host', { do: 'clock', op: b.dataset.v });
      if (a === 'hmode') { const r = await Net.call('room:setting', { key: 'mode', value: g.manual ? 'timers' : 'host' }); if (!r.ok) fail(r); return; }
      if (a === 'leave') return Net.call('room:leave');
      if (a === 'quit') {
        const mine = st.hostId === st.realMeId;
        const pick = await UI.choose({
          title: 'Выйти из игры',
          sub: 'Если вы просто отвлеклись или связь пропала, вернуться можно в любой момент: зайдите на главную страницу и нажмите «Переподключиться».',
          items: [
            { id: 'home', title: 'На главную, место сохранить', sub: 'Ход за вас сделает автопилот, пока вы не вернётесь' },
            { id: 'quit', title: 'Покинуть партию насовсем', sub: mine ? 'Ведущим станет другой игрок, вернуться нельзя. Зато можно сразу зайти в другую комнату.' : 'Вернуться нельзя. Зато можно сразу зайти в другую комнату, например, если вас исключили и нашлась другая компания.' },
          ],
          cancel: 'Остаться в игре',
        });
        if (pick === 'home') location.hash = '#/';
        else if (pick === 'quit') {
          const ok = await UI.confirmBox({ title: 'Покинуть партию насовсем?', sub: 'Место займёт автопилот, и обратно в эту партию вы не попадёте.', ok: 'Покинуть', danger: true });
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
        const role = p.role === 'killer' ? '<span class="badge red">убийца</span>' : p.role === 'accomplice' ? '<span class="badge yellow">сообщник</span>' : '';
        box.innerHTML = `<div class="pop"><h3>${avatar(p.name, this.idx[id])}${esc(p.name)} ${role}</h3><div class="dossiers">${this.dossier(p)}</div>
          <div class="row"><button class="btn" data-close>Закрыть</button></div></div>`;
        box.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
      });
    },

    async pickPlayer(title, sub, ids, note) {
      return UI.choose({ title, sub, note, items: ids.map((id) => ({ id, title: this.byId[id].name, name: this.byId[id].name, avatarIdx: this.idx[id], sub: this.byId[id].tags.map((t) => t.label).join(', ') || undefined })) });
    },
    others() { return this.g.players.filter((p) => p.status === 'active' && p.id !== this.me.id).map((p) => p.id); },

    async playCard(preType) {
      const me = this.me;
      const list = me.cards.map((c, i) => ({ c, i })).filter((x) => !x.c.used);
      const type = preType || await UI.choose({ title: 'Карта действия', sub: 'Каждую карту можно сыграть один раз.', items: list.map(({ c }) => ({ id: c.type, title: c.name, sub: c.type === 'advocate' ? 'Сработает сама, когда вас будут исключать' : c.type === 'trail' ? 'Сработает сама, когда вас обыщут' : c.desc, disabled: PASSIVE.includes(c.type) })) });
      if (!type) return;
      let ids = this.others();
      if (type === 'confront') {
        if (ids.length < 2) return toast('Для очной ставки нужны двое других игроков.', 'err');
        const a = await this.pickPlayer('Очная ставка: кого сводим?', 'Выберите первого игрока. Оба при всех раскроют алиби, связь с жертвой или мотив.', ids);
        if (!a) return;
        const b = await this.pickPlayer('Очная ставка: с кем?', `Второй игрок, которого сводим с ${this.byId[a].name}.`, ids.filter((id) => id !== a));
        if (!b) return;
        const traits = Content.CONFRONT_TRAITS.filter((t) => !this.byId[a].revealed[t] || !this.byId[b].revealed[t]);
        if (!traits.length) return toast('У обоих уже открыты алиби, связь с жертвой и мотив.', 'err');
        const trait = await UI.choose({ title: 'Что сверяем?', items: traits.map((t) => ({ id: t, title: T[t] })) });
        if (trait) this.act('card', { type, target: a, target2: b, trait });
        return;
      }
      if (type === 'swap') {
        ids = (me.swapTargets || []).filter((id) => id !== me.id);
        if (!ids.length) return toast('Подменять уже нечего: все улики найдены.', 'err');
        const target = await this.pickPlayer('На кого навести улику?', 'Улика, которую найдут следующей, поменяется и укажет на этого игрока. Её откроют в начале следующего раунда, как обычную, и никто не узнает, что это вы.', ids);
        if (target) this.act('card', { type, target });
        return;
      }
      if (type === 'lab') {
        const clues = this.g.clues.filter((k) => !k.checked);
        if (!clues.length) return toast(this.g.clues.length ? 'Все найденные улики вы уже проверили.' : 'Пока нет ни одной найденной улики.', 'err');
        const clueId = await UI.choose({ title: 'Какую улику проверить?', sub: 'Узнаете только вы: правдивая улика или её подменили.', items: clues.map((k) => ({ id: k.id, title: `Улика ${this.g.clues.indexOf(k) + 1}: ${k.label}`, sub: k.text })) });
        if (!clueId) return;
        const r = await this.act('card', { type, clueId });
        if (!r.ok) return;
        // Ответ приходит вместе с новым состоянием: улика получает пометку, её и показываем.
        const say = (n) => { const k = this.g.clues.find((x) => x.id === clueId); if (k && k.checked) toast(`Экспертиза: улика ${this.g.clues.indexOf(k) + 1} ${k.checked === 'fake' ? 'ложная, её подменили' : 'правдивая'}.`); else if (n) setTimeout(() => say(n - 1), 250); };
        say(8);
        return;
      }
      const target = await this.pickPlayer(type === 'warrant' ? 'Кого обыскать?' : 'С кого потребовать показания?', 'Результат ' + (type === 'warrant' ? 'увидите только вы.' : 'увидят все.'), ids);
      if (!target) return;
      const tp = this.byId[target];
      const pool = type === 'warrant' ? Content.SEARCHABLE_TRAITS : Content.ASKABLE_TRAITS;
      const traits = pool.filter((t) => !tp.revealed[t]);
      if (!traits.length) return toast('У этого игрока уже всё раскрыто.', 'err');
      const trait = await UI.choose({ title: 'Какой пункт?', items: traits.map((t) => ({ id: t, title: T[t] })) });
      if (trait) this.act('card', { type, target, trait });
    },
  };
})();
