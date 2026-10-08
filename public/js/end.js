/* Экран «Дело закрыто»: итог, хронология вечера, очки, награды, улики, сезон, лента. */
(function () {
  const { esc, setHtml, fail } = UI;
  const avatar = (name, i, cls = '') => UI.avatar(name, i, cls, i == null ? null : i + 1);
  const Screens = (window.Screens = window.Screens || {});
  const TABS = [['chrono', 'Хронология'], ['score', 'Очки'], ['awards', 'Награды'], ['votes', 'Голоса'], ['clues', 'Улики'], ['season', 'Сезон'], ['log', 'Журнал']];

  const mins = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const rel = (t, base) => ((mins(t) - base + 720 + 1440) % 1440) - 720;
  const clock = (abs) => { const m = ((abs % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const roleName = (r) => (r === 'killer' ? 'убийца' : r === 'accomplice' ? 'сообщник' : 'невиновный');
  const roleBadge = (r) => (r === 'killer' ? '<span class="badge red">убийца</span>' : r === 'accomplice' ? '<span class="badge yellow">сообщник</span>' : '');

  Screens.end = {
    mount(root) {
      root.innerHTML = `<div class="wrap end" id="end">
        <div class="end-hero" id="eHero"></div>
        <div class="tabs" id="eTabs" role="tablist"></div>
        <div id="eBody"></div>
        <div id="eChat" class="panel" style="padding:0;display:none;height:480px;flex-direction:column;overflow:hidden"></div>
        <div class="end-actions" id="eActs"></div>
      </div>`;
      this.root = root.firstElementChild;
      this.tab = 'chrono'; this.season = null; this.chat = null; this.seasonLoading = false;
      this.root.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
        const a = b.dataset.a, st = this.st;
        if (a === 'tab') { this.tab = b.dataset.tab; this.render(); if (this.tab === 'season') this.loadSeason(); }
        else if (a === 'next') { const r = await Net.call('room:next'); if (!r.ok) fail(r); }
        else if (a === 'leave') Net.call('room:leave');
        else if (a === 'share') { b.disabled = true; try { await ShareCard.open(this.g.results, this.g); } finally { b.disabled = false; } }
        else if (a === 'close') {
          const ok = await UI.confirmBox({ title: 'Закрыть комнату?', sub: 'Все игроки освободятся и смогут зайти в другую игру. Итоги этого дела останутся в сезонной таблице.', ok: 'Закрыть комнату', danger: true });
          if (ok) { const r = await Net.call('room:close'); if (!r.ok) fail(r); }
        }
      });
    },
    unmount() {},
    async loadSeason() {
      if (this.seasonLoading) return;
      this.seasonLoading = true;
      const r = await Net.call('stats:get');
      this.seasonLoading = false;
      if (r.ok) { this.season = r; this.render(); }
    },
    update(st) { this.st = st; this.g = st.game; this.render(); },

    render() {
      const st = this.st, g = this.g;
      if (!g || !g.results) return;
      const R = g.results;
      const byId = {}, idx = {};
      g.players.forEach((p, i) => { byId[p.id] = p; idx[p.id] = i; });
      this.byId = byId; this.idx = idx;
      const nm = (id) => (byId[id] ? byId[id].name : '?');
      const me = g.me;
      const myRank = R.rank.indexOf(me.id) + 1;

      const win = R.winner === 'innocent';
      const keptOut = new Set((R.kicks || []).map((k) => k.id));
      const free = [R.killerId, R.accompliceId].filter((id) => id && !keptOut.has(id));
      const reasonText = R.gang
        ? (R.reason === 'caught' ? `Убийца ${nm(R.killerId)} и сообщник ${nm(R.accompliceId)} исключены, последнего из них исключили в раунде ${g.verdict.round}.` : R.reason === 'outnumbered' ? `Преступников осталось столько же, сколько невиновных, на свободе: ${free.map(nm).join(' и ')}.` : `Исключения закончились, а на свободе остались: ${free.map(nm).join(' и ')}.`)
        : R.reason === 'caught' ? `Убийца ${nm(R.killerId)} исключён в раунде ${g.verdict.round}.`
          : `Исключили ${nm(R.kickedId)}, но это не убийца. Убийца ${nm(R.killerId)} остаётся на свободе.`;
      const acc = R.gang ? '' : R.accompliceId ? (R.accompliceChoice ? (R.accompliceChoice.mode === 'target' ? `Сообщник: ${nm(R.accompliceId)}. Назван опасным: ${nm(R.accompliceChoice.target)}.` : `Сообщник: ${nm(R.accompliceId)}. Остался вне подозрений.`) : `Сообщник: ${nm(R.accompliceId)}.`) : '';
      setHtml(this.root.querySelector('#eHero'), `<div class="tape"></div>
        <div class="eh-top"><p class="eyebrow">${esc(g.case.title)} · ${R.minutes} мин</p><span class="stamp">Дело закрыто</span></div>
        <h1 class="${win ? 'win-innocent' : 'win-killer'}">${win ? 'Невиновные победили' : R.gang ? (free.length > 1 ? 'Преступники на свободе' : free[0] === R.killerId ? 'Убийца на свободе' : 'Сообщник на свободе') : 'Убийца на свободе'}</h1>
        <p style="max-width:60ch;color:#e0d0b6">${esc(reasonText)} ${esc(acc)}</p>
        <div class="who">
          <div>${avatar(nm(R.killerId), idx[R.killerId])}<span><span class="label">Убийца</span><br><b>${esc(nm(R.killerId))}</b></span></div>
          ${R.accompliceId ? `<div>${avatar(nm(R.accompliceId), idx[R.accompliceId])}<span><span class="label">Сообщник</span><br><b>${esc(nm(R.accompliceId))}</b></span></div>` : ''}
          <div><span class="label">Место и время</span><br><b>${esc(R.scene)}, ${esc(R.murderTime)}</b></div>
          <div><span class="label">Ваш результат</span><br><b>${R.score[me.id]} очк. · ${myRank} место из ${g.players.length}</b></div>
        </div>
        <div class="e-share"><button class="btn" data-a="share">Картинка с итогами для чата</button></div>`);

      setHtml(this.root.querySelector('#eTabs'), TABS.map(([k, t]) => `<button role="tab" data-a="tab" data-tab="${k}" class="${this.tab === k ? 'on' : ''}" aria-selected="${this.tab === k}">${t}</button>`).join(''));

      const body = this.root.querySelector('#eBody'), chatBox = this.root.querySelector('#eChat');
      if (this.tab === 'log') {
        body.style.display = 'none'; chatBox.style.display = 'flex';
        if (!this.chat) this.chat = UI.makeLog(chatBox);
        this.chat.update(g.feed, { gameKey: 'end', nameOf: nm, status: '' });
      } else {
        chatBox.style.display = 'none'; body.style.display = '';
        this.chat = null; chatBox._html = null; chatBox.innerHTML = '';
        setHtml(body, this.tabHtml(R, g, nm));
      }

      const host = st.hostId === st.realMeId;
      setHtml(this.root.querySelector('#eActs'), host
        ? `<button class="btn btn-primary" data-a="next">Следующее дело</button><button class="btn btn-red" data-a="close">Закрыть комнату</button>
           <div class="end-close" style="flex-basis:100%"><p><b>Когда доиграли, закройте комнату.</b> Пока она открыта, ни один из игроков не сможет присоединиться к другой игре. Хотите ещё партию, откройте следующее дело.</p></div>`
        : `<button class="btn" data-a="leave">Выйти из комнаты</button>
           <div class="end-close" style="flex-basis:100%"><p>Следующее дело откроет ведущий, а закроет комнату тоже он. Если вас ждут в другой игре, выйдите сами, и можно присоединяться.</p></div>`);
    },

    tabHtml(R, g, nm) {
      if (this.tab === 'chrono') return this.chrono(R, g, nm);
      if (this.tab === 'score') return this.score(R, nm);
      if (this.tab === 'awards') return this.awards(R, nm);
      if (this.tab === 'votes') return this.votes(R, g, nm);
      if (this.tab === 'clues') return this.clues(R, g, nm);
      return this.seasonHtml();
    },

    chrono(R, g, nm) {
      const base = mins(R.murderTime);
      const all = R.chronology.flatMap((c) => [c.real, c.claim].filter(Boolean));
      let lo = Math.min(0, ...all.map((a) => rel(a.from, base))) - 6, hi = Math.max(0, ...all.map((a) => rel(a.to, base))) + 6;
      if (hi - lo < 30) { lo -= 10; hi += 10; }
      const x = (d) => ((d - lo) / (hi - lo)) * 100;
      const ticks = [0, 1, 2, 3, 4].map((i) => { const d = lo + ((hi - lo) * i) / 4; return `<span style="left:${i * 25}%;${i === 0 ? 'transform:none' : i === 4 ? 'transform:translateX(-100%)' : ''}">${clock(base + Math.round(d))}</span>`; }).join('');
      const markX = x(0);
      const locs = [R.scene].concat(g.case.locations.filter((l) => l !== R.scene));
      const rows = locs.map((loc) => {
        const bars = [];
        R.chronology.forEach((c) => {
          const hue = UI.hueOf(this.idx[c.id]);
          const k = c.role === 'killer' ? ' killer' : '';
          if (c.real.loc === loc) bars.push(`<div class="g-bar${k}" style="--h:${hue};margin-left:${x(rel(c.real.from, base))}%;width:${x(rel(c.real.to, base)) - x(rel(c.real.from, base))}%" title="${esc(c.name)}: был здесь">${esc(c.name)}</div>`);
          if (c.lied && c.claim && c.claim.loc === loc) bars.push(`<div class="g-bar ghost false" style="--h:${hue};margin-left:${x(rel(c.claim.from, base))}%;width:${x(rel(c.claim.to, base)) - x(rel(c.claim.from, base))}%" title="${esc(c.name)}: назвал это алиби">${esc(c.name)}</div>`);
        });
        return `<div class="g-row"><div class="g-loc ${loc === R.scene ? 'scene' : ''}">${esc(loc)}</div><div class="g-track">${loc === R.scene ? `<span class="g-mark" style="left:${markX}%"></span>` : ''}${bars.join('') || '<span class="muted" style="font-size:12px;padding-left:8px">никого</span>'}</div></div>`;
      }).join('');
      const liars = R.chronology.map((c) => `<div class="liar ${c.role === 'killer' ? 'killer' : ''}">
          <div class="l-top">${avatar(c.name, this.idx[c.id])}<b>${esc(c.name)}</b>${roleBadge(c.role)}${c.out ? '<span class="badge">вне игры</span>' : ''}</div>
          <div class="claim">Говорил: ${c.claim ? (c.lied ? `<s>«${esc(c.claim.loc)}»</s>` : `«${esc(c.claim.loc)}»`) : 'ничего'}</div>
          <div class="real">${c.lied ? `На самом деле: <b>«${esc(c.real.loc)}»</b>` : 'Алиби честное'}${c.witnesses.length ? `, рядом: ${esc(c.witnesses.join(', '))}` : ''}</div>
          <div class="sec"><b>Секрет:</b> ${esc(c.secret)}</div>
          <div class="sec"><b>Цель:</b> ${esc(c.goal)} · ${c.goalDone ? '<span style="color:var(--green)">выполнена</span>' : 'не выполнена'}</div></div>`).join('');
      return `<div class="panel"><div class="panel-head"><h2>Где все были на самом деле</h2><span class="count">убийство в ${esc(R.murderTime)}</span></div>
        <div class="table-scroll"><div class="gantt" style="min-width:560px"><div class="g-axis"><span></span><div class="scale">${ticks}</div></div>${rows}</div></div>
        <div class="legend"><span>Сплошная полоса: где человек был.</span><span>Пунктир «ложь»: где он говорил, что был.</span><span style="color:var(--red)">Красная обводка: убийца.</span></div>
        <div class="liars">${liars}</div></div>`;
    },

    score(R, nm) {
      const rows = R.rank.map((id, i) => `<tr><td class="mono">${i + 1}</td><td><span class="pl">${avatar(nm(id), this.idx[id], 'sm')}${esc(nm(id))} ${roleBadge(this.byId[id].role)}</span></td>
        <td><div class="it">${R.items[id].map((it) => `<span class="${it.val < 0 ? 'neg' : ''}">${esc(it.label)} ${it.val > 0 ? '+' : ''}${it.val}</span>`).join('') || '<span>без очков</span>'}</div></td><td class="tot">${R.score[id]}</td></tr>`).join('');
      return `<div class="panel"><div class="panel-head"><h2>Очки партии</h2><span class="count">победа команды, секрет, цель, верные голоса</span></div><div class="table-scroll"><table class="score-table"><thead><tr><th>#</th><th>Игрок</th><th>За что</th><th style="text-align:right">Итого</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    },

    awards(R, nm) {
      if (!R.awards.length) return '<div class="panel"><p class="empty-note">В этой партии награды никому не достались. Бывает.</p></div>';
      return `<div class="awards">${R.awards.map((a, i) => `<div class="award" style="animation-delay:${i * 0.12}s"><span class="medal">★</span><h3>${esc(a.title)}</h3><span class="p">${avatar(nm(a.playerId), this.idx[a.playerId], 'sm')}${esc(nm(a.playerId))}</span><small>${esc(a.text)}</small></div>`).join('')}</div>`;
    },

    votes(R, g, nm) {
      const KIND = { kick: 'Голосование', poll: 'Тайный опрос', final: 'Финальное голосование' };
      if (!R.votes.length) return '<div class="panel"><p class="empty-note">Голосований не было.</p></div>';
      const cards = R.votes.map((v) => {
        const kick = R.kicks.find((k) => k.round === v.round && (v.kind === 'kick' ? k.kind === 'kick' : k.kind === v.kind));
        const rows = Object.keys(v.count).sort((a, b) => v.count[b] - v.count[a]).map((id) => {
          return `<div class="liar"><div class="l-top">${avatar(nm(id), this.idx[id], 'sm')}<b>${esc(nm(id))}</b><span class="badge ${kick && kick.id === id ? 'red' : ''}">${v.count[id]}</span></div></div>`;
        }).join('');
        return `<div class="panel" style="margin-bottom:14px"><div class="panel-head"><h2>${KIND[v.kind]}${v.runoff ? ' · переголосование' : ''}</h2><span class="count">раунд ${v.round}${kick ? ` · вне игры: ${esc(nm(kick.id))}` : ''}${v.skipped ? ` · не выбрали: ${v.skipped}` : ''}</span></div><div class="liars" style="margin-top:0">${rows}</div></div>`;
      }).join('');
      return cards;
    },

    clues(R, g, nm) {
      const planted = {}; (R.plants || []).filter((p) => !p.overridden).forEach((p) => { planted[p.clueId] = p; });
      return `<div class="clues">${R.clues.map((c, i) => `<article class="paper clue"><span class="no">Улика ${i + 1}${c.planted ? ' · подменена' : ''}</span><p>${esc(c.text)}</p>
        <div class="fits"><span class="tagname">${esc(Content_label(c.tag))}</span><span>подходит: ${esc(c.fits.map(nm).join(', '))}</span></div>
        ${c.planted && planted[c.id] ? `<div class="fits" style="margin-top:6px"><span>Подменил игрок ${esc(nm(planted[c.id].by))}, чтобы указать на игрока ${esc(nm(planted[c.id].targetId))}.${c.orig ? ` Настоящая улика: ${esc(c.orig.text)}` : ''}</span></div>` : ''}</article>`).join('')}</div>`;
    },

    seasonHtml() {
      const st = this.st;
      if (st.test) return '<div class="panel"><p class="empty-note">В тестовых комнатах статистика не ведётся.</p></div>';
      if (!this.season) { this.loadSeason(); return '<div class="panel"><p class="empty-note">Загружаем сезон…</p></div>'; }
      const s = this.season;
      const me = st.players.find((p) => p.id === st.realMeId);
      const rows = s.rows.map((r, i) => `<tr style="${me && r.name.toLowerCase() === me.name.toLowerCase() ? 'background:rgba(233,162,59,.1)' : ''}"><td class="mono">${i + 1}</td><td><b>${esc(r.name)}</b></td><td>${r.games}</td><td>${r.killer}</td><td>${r.solvedPct == null ? '—' : r.solvedPct + '%'}</td><td>${r.medals}</td><td class="tot">${r.points}</td></tr>`).join('');
      return `<div class="panel"><div class="panel-head"><h2>Сезон ${esc(s.season)}</h2><span class="count">по именам игроков</span></div>
        ${rows ? `<div class="table-scroll"><table class="score-table"><thead><tr><th>#</th><th>Игрок</th><th>Партий</th><th>Убийцей</th><th>Раскрыто дел</th><th>Наград</th><th style="text-align:right">Очки</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty-note">Пока это первая сыгранная партия сезона.</p>'}</div>`;
    },
  };
  const Content_label = (tag) => (UI.Content.TAGS[tag] ? UI.Content.TAGS[tag].label : tag);
})();
