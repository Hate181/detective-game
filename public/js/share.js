/* Картинка «Дело закрыто» для чата: дело, вердикт, роли, очки и медали всех игроков.
   Рисуется в браузере на холсте шириной 1080, высота по числу игроков. Её можно скопировать или сохранить. */
(function () {
  const W = 1080, PAD = 72, ROW = 84;
  const C = {
    bg: '#120c09', panel: '#231910', line: '#43321f', text: '#f1e4cd', muted: '#ab9479', amber: '#eba43c',
    red: '#cf4a3a', green: '#9bb069', paper: '#f1e3c4', paper2: '#e4d3ab', ink: '#2b1d12', inkMute: '#7a6a52', oxblood: '#9e2f22', gold: '#9a6a12',
  };
  const F = { display: '"Playfair Display", Georgia, serif', ui: '"Golos Text", "Segoe UI", system-ui, sans-serif', mono: '"IBM Plex Mono", "Courier New", monospace' };

  async function fontsReady() {
    if (!document.fonts || !document.fonts.load) return;
    const sample = 'Дело закрыто Detective 0123';
    await Promise.all([
      `700 64px ${F.display}`, `italic 600 48px ${F.display}`, `600 30px ${F.ui}`, `400 24px ${F.ui}`, `500 22px ${F.mono}`,
    ].map((f) => document.fonts.load(f, sample).catch(() => null)));
  }

  /** Строка, укороченная до ширины, с многоточием. */
  function fit(ctx, text, max) {
    if (ctx.measureText(text).width <= max) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  }
  /** Перенос по словам, не больше lines строк. */
  function wrap(ctx, text, max, lines) {
    const words = String(text).split(/\s+/), out = [];
    let cur = '';
    words.forEach((w) => {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width <= max || !cur) cur = t; else { out.push(cur); cur = w; }
    });
    if (cur) out.push(cur);
    if (out.length > lines) { out.length = lines; out[lines - 1] = fit(ctx, out[lines - 1] + '…', max); }
    return out;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  function verdictOf(R, nm, round) {
    const out = new Set((R.kicks || []).map((k) => k.id));
    const free = [R.killerId, R.accompliceId].filter((id) => id && !out.has(id));
    const win = R.winner === 'innocent';
    const title = win ? 'Невиновные победили' : free.length > 1 ? 'Преступники на свободе' : free[0] === R.accompliceId ? 'Сообщник на свободе' : 'Убийца на свободе';
    return { win, title };
  }

  async function render(R, g) {
    await fontsReady();
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    // Высота картинки по содержимому: шапка (одна или две строки названия) и строка на каждого игрока
    ctx.font = `700 60px ${F.display}`;
    const titleN = wrap(ctx, g.case.title, W - PAD * 2, 2).length;
    const H = 398 + (titleN - 1) * 68 + ROW * g.players.length + 40 + 112;
    cv.width = W; cv.height = H;
    const byId = {}, idx = {};
    g.players.forEach((p, i) => { byId[p.id] = p; idx[p.id] = i; });
    const nm = (id) => (byId[id] ? byId[id].name : '?');

    // Фон: тёплая темнота, свет лампы слева сверху, лёгкое зерно
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(200, 160, 40, 200, 160, 900);
    glow.addColorStop(0, 'rgba(235,164,60,.16)'); glow.addColorStop(1, 'rgba(235,164,60,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(255,240,210,${Math.random() * 0.035})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }

    // Лента места преступления
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 22); ctx.clip();
    ctx.fillStyle = '#12100a'; ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = C.amber;
    for (let x = -40; x < W + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x + 20, 22); ctx.lineTo(x + 42, 0); ctx.lineTo(x + 22, 0); ctx.closePath(); ctx.fill(); }
    ctx.restore();

    // Шапка
    let y = 104;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.amber; ctx.font = `500 22px ${F.mono}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    ctx.fillText('DETECTIVE GAME', PAD, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    // Печать «Дело закрыто»
    ctx.save();
    ctx.translate(W - PAD - 150, 84); ctx.rotate(-5 * Math.PI / 180);
    ctx.font = `700 30px ${F.display}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    const sw = ctx.measureText('ДЕЛО ЗАКРЫТО').width + 36;
    ctx.strokeStyle = C.red; ctx.lineWidth = 4; rr(ctx, -sw / 2, -30, sw, 58, 5); ctx.stroke();
    ctx.fillStyle = C.red; ctx.textAlign = 'center'; ctx.fillText('ДЕЛО ЗАКРЫТО', 0, 11);
    ctx.restore();
    ctx.textAlign = 'left';

    // Название дела
    y += 96;
    ctx.fillStyle = C.text; ctx.font = `700 60px ${F.display}`;
    const titleLines = wrap(ctx, g.case.title, W - PAD * 2, 2);
    titleLines.forEach((l, i) => ctx.fillText(l, PAD, y + i * 68));
    y += (titleLines.length - 1) * 68 + 70;

    // Вердикт
    const v = verdictOf(R, nm, g.verdict && g.verdict.round);
    ctx.fillStyle = v.win ? C.green : C.red; ctx.font = `italic 600 48px ${F.display}`;
    ctx.fillText(fit(ctx, v.title, W - PAD * 2), PAD, y);
    y += 50;
    ctx.fillStyle = C.muted; ctx.font = `400 26px ${F.ui}`;
    const crim = [`Убийца: ${nm(R.killerId)}`].concat(R.accompliceId ? [`сообщник: ${nm(R.accompliceId)}`] : []).join(', ');
    ctx.fillText(fit(ctx, crim, W - PAD * 2), PAD, y);
    y += 38;
    const rounds = R.rounds || (g.verdict && g.verdict.round) || 0;
    ctx.fillText(`${g.players.length} ${plural(g.players.length, 'игрок', 'игрока', 'игроков')} · ${rounds} ${plural(rounds, 'раунд', 'раунда', 'раундов')} · ${R.minutes} мин`, PAD, y);
    y += 40;

    // Лист с игроками
    const top = y, n = R.rank.length, rowH = ROW;
    const sheetH = rowH * n + 40;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
    ctx.fillStyle = C.paper; rr(ctx, PAD - 16, top, W - (PAD - 16) * 2, sheetH, 8); ctx.fill();
    ctx.restore();
    const medals = {};
    (R.awards || []).forEach((a) => { (medals[a.playerId] = medals[a.playerId] || []).push(a.title); });
    const kickedRound = {};
    (R.kicks || []).forEach((k) => { kickedRound[k.id] = k.round; });
    const x0 = PAD + 8, x1 = W - PAD - 8;
    R.rank.forEach((id, i) => {
      const ry = top + 20 + i * rowH, cy = ry + rowH / 2;
      if (i === 0) { ctx.fillStyle = C.paper2; rr(ctx, PAD - 4, ry + 2, W - (PAD - 4) * 2, rowH - 4, 6); ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(43,29,18,.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, ry + 0.5); ctx.lineTo(x1, ry + 0.5); ctx.stroke(); }
      // место
      ctx.fillStyle = C.inkMute; ctx.font = `500 22px ${F.mono}`; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1).padStart(2, '0'), x0, cy);
      // аватар
      const r = Math.min(26, rowH / 2 - 8), ax = x0 + 58 + r;
      ctx.fillStyle = `hsl(${UI.hueOf(idx[id])} 46% 64%)`; ctx.beginPath(); ctx.arc(ax, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0f08'; ctx.font = `700 ${Math.round(r * 0.95)}px ${F.display}`; ctx.textAlign = 'center';
      ctx.fillText(UI.initial(nm(id)), ax, cy + 1); ctx.textAlign = 'left';
      // очки справа
      const pts = R.score[id] || 0;
      ctx.fillStyle = C.ink; ctx.font = `700 34px ${F.display}`; ctx.textAlign = 'right';
      ctx.fillText(String(pts), x1, cy - 2);
      const ptsW = Math.max(60, ctx.measureText(String(pts)).width);
      ctx.fillStyle = C.inkMute; ctx.font = `400 16px ${F.ui}`;
      ctx.fillText(plural(pts, 'очко', 'очка', 'очков'), x1, cy + 22);
      ctx.textAlign = 'left';
      // имя и роль
      const tx = ax + r + 20, maxW = x1 - ptsW - 24 - tx;
      const p = byId[id] || {};
      const role = p.role || (id === R.killerId ? 'killer' : id === R.accompliceId ? 'accomplice' : 'innocent');
      const compact = rowH < 70;
      ctx.fillStyle = C.ink; ctx.font = `600 ${compact ? 26 : 30}px ${F.ui}`;
      const name = fit(ctx, nm(id), maxW * 0.55);
      ctx.fillText(name, tx, cy - (compact ? 11 : 13));
      // медали рядом с именем
      const nw = ctx.measureText(name).width;
      if (medals[id]) {
        ctx.font = `600 ${compact ? 18 : 20}px ${F.ui}`; ctx.fillStyle = C.gold;
        ctx.fillText(fit(ctx, '★ ' + medals[id].join(' · '), maxW - nw - 16), tx + nw + 16, cy - (compact ? 11 : 13));
      }
      const roleText = role === 'killer' ? 'убийца' : role === 'accomplice' ? 'сообщник' : 'невиновный';
      const extra = kickedRound[id] ? `, исключён в раунде ${kickedRound[id]}` : '';
      ctx.font = `${role === 'innocent' ? 400 : 600} ${compact ? 18 : 20}px ${F.ui}`;
      ctx.fillStyle = role === 'killer' ? C.oxblood : role === 'accomplice' ? C.gold : C.inkMute;
      ctx.fillText(roleText, tx, cy + (compact ? 14 : 18));
      if (extra) { const rw = ctx.measureText(roleText).width; ctx.font = `400 ${compact ? 18 : 20}px ${F.ui}`; ctx.fillStyle = C.inkMute; ctx.fillText(fit(ctx, extra, maxW - rw), tx + rw, cy + (compact ? 14 : 18)); }
      ctx.textBaseline = 'alphabetic';
    });

    // Подвал
    const fy = H - 40;
    ctx.fillStyle = C.muted; ctx.font = `500 22px ${F.mono}`;
    ctx.fillText(location.host, PAD, fy);
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), W - PAD, fy);
    ctx.textAlign = 'left';
    return cv;
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  }
  const toBlob = (cv) => new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('png'))), 'image/png'));

  /** Окно с картинкой и кнопками «Скопировать» и «Сохранить». */
  async function open(R, g) {
    let cv;
    try { cv = await render(R, g); } catch (e) { UI.toast('Не получилось нарисовать картинку.', 'err'); return; }
    const blob = await toBlob(cv);
    const file = `delo-${new Date().toISOString().slice(0, 10)}.png`;
    UI.modal((box, close) => {
      box.classList.add('share-modal');
      box.innerHTML = `<h3>Картинка с итогами</h3>
        <p class="muted">Скиньте её в чат: роли, очки и медали всех игроков.</p>
        <img class="share-img" alt="Итоги дела «${UI.esc(g.case.title)}»" src="${cv.toDataURL('image/png')}">
        <div class="share-acts">
          ${navigator.clipboard && window.ClipboardItem ? '<button class="btn btn-primary" data-s="copy">Скопировать</button>' : ''}
          <button class="btn${navigator.clipboard && window.ClipboardItem ? '' : ' btn-primary'}" data-s="save">Сохранить</button>
          <button class="btn btn-ghost" data-s="close">Закрыть</button>
        </div>`;
      box.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-s]'); if (!b) return;
        if (b.dataset.s === 'close') return close();
        if (b.dataset.s === 'copy') {
          try { await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]); UI.toast('Картинка скопирована, вставьте её в чат.'); }
          catch (err) { UI.toast('Браузер не дал скопировать. Нажмите «Сохранить».', 'err'); }
          return;
        }
        // Сохранить: на телефоне через «Поделиться», если можно, иначе обычное скачивание
        const f = window.File ? new File([blob], file, { type: 'image/png' }) : null;
        if (f && matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [f] })) {
          try { await navigator.share({ files: [f], title: 'Дело закрыто' }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = file;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      });
    });
  }

  window.ShareCard = { render, open };
})();
