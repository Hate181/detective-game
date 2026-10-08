/* Общие помощники интерфейса: экранирование, иконки, аватары, тосты, модальные окна. */
(function () {
  const Content = window.DetectiveContent;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const svg = (body) => `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
  const S = 'fill="none" stroke="currentColor" stroke-width="1.8"';
  const ICONS = {
    random: svg(`<rect x="5" y="5" width="22" height="22" rx="4" ${S}/><circle cx="11" cy="11" r="1.9" fill="currentColor"/><circle cx="21" cy="11" r="1.9" fill="currentColor"/><circle cx="16" cy="16" r="1.9" fill="currentColor"/><circle cx="11" cy="21" r="1.9" fill="currentColor"/><circle cx="21" cy="21" r="1.9" fill="currentColor"/>`),
    mansion: svg(`<path d="M4 15 16 6l12 9M7 13v13h18V13M13 26v-7h6v7M10 17h2M20 17h2" ${S} stroke-linejoin="round"/><path d="M22 9V5h3v6" ${S}/>`),
    train: svg(`<rect x="7" y="5" width="18" height="18" rx="4" ${S}/><path d="M7 14h18M12 9h8" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor"/><circle cx="20" cy="18.5" r="1.4" fill="currentColor"/><path d="M10 23l-3 5M22 23l3 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`),
    corporate: svg(`<path d="M9 4h14l-2 9a5 5 0 0 1-10 0z" ${S} stroke-linejoin="round"/><path d="M16 18v8M11 27h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`),
    yacht: svg(`<circle cx="16" cy="7" r="2.6" ${S}/><path d="M16 9.6V27M10 14h12M6 19c1 5 5 8 10 8s9-3 10-8" ${S} stroke-linecap="round"/>`),
    theatre: svg(`<path d="M6 6h20v8a10 10 0 0 1-20 0z" ${S} stroke-linejoin="round"/><path d="M11 12h2M19 12h2M12 18c2 1.5 6 1.5 8 0" ${S} stroke-linecap="round"/>`),
    hotel: svg(`<path d="M7 27V7h18v20M4 27h24M12 11h2M18 11h2M12 16h2M18 16h2M14 27v-5h4v5" ${S} stroke-linejoin="round"/>`),
    museum: svg(`<path d="M4 12 16 5l12 7zM6 12h20M8.500 15v8M13.500 15v8M18.500 15v8M23.500 15v8M5 26h22M4 23h24" ${S} stroke-linejoin="round" stroke-linecap="round"/>`),
    lighthouse: svg(`<path d="M12 27 14 12h4l2 15zM13 12V8h6v4M12 8l4-3 4 3M8 27h16M13.200 19h5.600M5 8l5 1.500M27 8l-5 1.500" ${S} stroke-linejoin="round" stroke-linecap="round"/>`),
    mountain: svg(`<path d="M3 26 13 8l6 10 3-4 7 12z" ${S} stroke-linejoin="round"/><path d="M9.400 14.500l2.400 2 1.200-1.500 2 2 1.900-2.500" ${S} stroke-linejoin="round" stroke-linecap="round"/>`),
    casino: svg(`<circle cx="16" cy="16" r="11" ${S}/><circle cx="16" cy="16" r="4" ${S}/><path d="M16 5v7M16 20v7M5 16h7M20 16h7M8.200 8.200l3.600 3.600M20.200 20.200l3.600 3.600M23.800 8.200l-3.600 3.600M11.800 20.200l-3.600 3.600" ${S} stroke-linecap="round"/>`),
    film: svg(`<rect x="5" y="15" width="22" height="12" rx="1.500" ${S} stroke-linejoin="round"/><path d="M5 9.500 26.500 5.500 27.500 10 6 14zM10 13.300l2.600-5.200M16 12.200l2.600-5.200M22 11.100l2.600-5.200" ${S} stroke-linejoin="round" stroke-linecap="round"/>`),
    clinic: svg(`<path d="M12 5h8v7h7v8h-7v7h-8v-7H5v-8h7z" ${S} stroke-linejoin="round"/>`),
    book: svg(`<path d="M16 8c-3-2.500-8-3-12-2v18c4-1 9-.5 12 2 3-2.500 8-3 12-2V6c-4-1-9-.5-12 2zM16 8v18M8 11c2-.4 4-.2 5 .5M8 15c2-.4 4-.2 5 .5M19 11.500c1-.7 3-.9 5-.5M19 15.500c1-.7 3-.9 5-.5" ${S} stroke-linejoin="round" stroke-linecap="round"/>`),
    circus: svg(`<path d="M16 6 3 15h26zM5 15v11h22V15M13 26v-6a3 3 0 0 1 6 0v6M16 6l-4 9M16 6l4 9M16 6V3l4 1.500-4 1.500" ${S} stroke-linejoin="round" stroke-linecap="round"/>`),
    airship: svg(`<ellipse cx="16" cy="13" rx="12" ry="6.500" ${S}/><path d="M6 9 3 6M6 17l-3 3M10 7.500v11M16 6.500v13M22 7.500v11M13 19.500l-1 2.500M19 19.500l1 2.500" ${S} stroke-linecap="round"/><rect x="12" y="22" width="8" height="4" rx="1" ${S}/>`),
    pyramid: svg(`<path d="M3 26 16 6l13 20zM16 6l4 20M9.500 16h13M6.300 21h19.400" ${S} stroke-linejoin="round" stroke-linecap="round"/><circle cx="26" cy="7" r="2.500" ${S}/>`),
    radio: svg(`<rect x="4" y="11" width="24" height="16" rx="3" ${S}/><path d="M9 11 22 4M19 16h5M19 19.500h5M19 23h5" ${S} stroke-linecap="round"/><circle cx="11.500" cy="19" r="3.500" ${S}/>`),
    wine: svg(`<path d="M13.500 3h5v7c0 1.500 3.500 3 3.500 7v10H10V17c0-4 3.500-5.500 3.500-7zM10 20h12v4H10z" ${S} stroke-linejoin="round"/>`),
    bank: svg(`<rect x="4" y="5" width="24" height="21" rx="2" ${S}/><circle cx="16" cy="15.500" r="6" ${S}/><circle cx="16" cy="15.500" r="1.500" fill="currentColor"/><path d="M16 9.500v3M16 18.500v3M10 15.500h3M19 15.500h3M9 26v2M23 26v2" ${S} stroke-linecap="round"/>`),
    spa: svg(`<path d="M9 7c-2 2 2 4 0 6M16 5c-2 2 2 4 0 6M23 7c-2 2 2 4 0 6M5 17h22c0 6-4 10-11 10S5 23 5 17z" ${S} stroke-linejoin="round" stroke-linecap="round"/>`),
    steamboat: svg(`<path d="M3 20h26l-4 7H7zM8 20v-5h15v5M11 15v-4h9v4" ${S} stroke-linejoin="round"/><rect x="12" y="5" width="3" height="6" ${S}/><rect x="17" y="7" width="3" height="4" ${S}/>`),
    chess: svg(`<path d="M9 27h14M10 27v-3h12v3M11 24l1-10h8l1 10M10 14V8h3v3h2V8h2v3h2V8h3v6z" ${S} stroke-linejoin="round" stroke-linecap="round"/>`),
    pumpkin: svg(`<path d="M16 9.500c-6.500 0-11.500 3.500-11.500 8.800S9.500 27 16 27s11.500-3.400 11.500-8.700S22.500 9.500 16 9.500z" ${S}/><path d="M16 9.500c-3.300 2.600-3.300 14.900 0 17.500M16 9.500c3.300 2.600 3.300 14.900 0 17.500M16 9.500V6c.8-1.300 2.300-2 4-2" ${S} stroke-linecap="round"/>`),
    mask: svg(`<path d="M3.500 11.500c4-1.800 8.500-1.500 12.500 1.500 4-3 8.500-3.300 12.500-1.500 0 6.500-3 9.500-6.500 9.500-3 0-4.500-2.500-6-2.500S13 21 10 21c-3.500 0-6.500-3-6.500-9.500z" ${S} stroke-linejoin="round"/><ellipse cx="10.300" cy="15" rx="2.600" ry="1.600" ${S}/><ellipse cx="21.700" cy="15" rx="2.600" ry="1.600" ${S}/><path d="M27 19.500l1.500 8" ${S} stroke-linecap="round"/>`),
    candle: svg(`<path d="M12 13h8v14h-8z" ${S} stroke-linejoin="round"/><path d="M16 3.500c2.200 3 3 4.600 3 6.300a3 3 0 0 1-6 0c0-1.700.8-3.300 3-6.300zM15 13v4M8 27h16" ${S} stroke-linejoin="round" stroke-linecap="round"/>`),
    bat: svg(`<path d="M16 12l-1.500-3-.5 3.500C11 11 6 9 2 10c2 2 3 5 3 8 1.500-1.500 3.500-1.500 5 0 1-1.500 3-1.500 4 .5l2 3 2-3c1-2 3-2 4-.5 1.500-1.500 3.500-1.500 5 0 0-3 1-6 3-8-4-1-9 1-12 2.500l-.5-3.500z" ${S} stroke-linejoin="round"/>`),
    grave: svg(`<path d="M9 27V12a7 7 0 0 1 14 0v15M5 27h22M16 11v8M13 14h6" ${S} stroke-linejoin="round" stroke-linecap="round"/>`),
    campfire: svg(`<path d="M6 27l20-5M6 22l20 5" ${S} stroke-linecap="round"/><path d="M16 4c3 4 5.500 6.300 5.500 9.500a5.500 5.500 0 0 1-11 0c0-2 .8-3.400 2-4.500.2 2 1.200 3 2.300 3.200-.5-2.800.3-5.300 1.200-8.200z" ${S} stroke-linejoin="round"/>`),
    ghost: svg(`<path d="M8 27V14a8 8 0 0 1 16 0v13l-2.700-2.500L18.700 27 16 24.500 13.300 27l-2.600-2.500z" ${S} stroke-linejoin="round"/><circle cx="13" cy="14" r="1.500" fill="currentColor"/><circle cx="19" cy="14" r="1.500" fill="currentColor"/>`),
    raven: svg(`<circle cx="20" cy="9" r="3.200" ${S}/><path d="M23 8.200l4.500 1.600-4.500 1M18 12c-5.500 1-9.500 5-12 10.500l6.500-.8 3 1.800c3-2.300 4.600-6.500 3.700-11.500M12.500 21.700V27M16 23.500V27M11 27h7" ${S} stroke-linejoin="round" stroke-linecap="round"/><circle cx="20.800" cy="8.500" r=".9" fill="currentColor"/>`),
    generic: svg(`<circle cx="14" cy="14" r="8" ${S}/><path d="M20 20l7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`),
    discord: svg(`<path d="M7 9c3-2 6-2.6 9-2.6S22 7 25 9c2 3.5 3 7 3 11-2.5 2-5 3-8 3l-1.3-2c1.1-.3 2.1-.8 3-1.5-2.4 1.2-5 1.2-7.4 0-.9.7-1.9 1.2-3 1.5L10 23c-3 0-5.5-1-8-3 0-4 1-7.500 3-11z" ${S} stroke-linejoin="round" transform="translate(1 0)"/><circle cx="12.500" cy="16" r="1.600" fill="currentColor"/><circle cx="20.500" cy="16" r="1.600" fill="currentColor"/>`),
    play: svg(`<path d="M11 7v18l15-9z" fill="currentColor"/>`),
    pause: svg(`<rect x="9" y="7" width="5" height="18" rx="1.5" fill="currentColor"/><rect x="18" y="7" width="5" height="18" rx="1.5" fill="currentColor"/>`),
    restart: svg(`<path d="M8 16a8 8 0 1 0 2.5-5.8" ${S} stroke-linecap="round"/><path d="M8 6v5h5" ${S} stroke-linecap="round" stroke-linejoin="round"/>`),
    undo: svg(`<path d="M12 9 6 15l6 6" ${S} stroke-linecap="round" stroke-linejoin="round"/><path d="M6 15h12a7 7 0 0 1 0 14h-4" ${S} stroke-linecap="round"/>`),
    mic: svg(`<rect x="12" y="4" width="8" height="14" rx="4" ${S}/><path d="M8 15a8 8 0 0 0 16 0M16 23v5M11 28h10" ${S} stroke-linecap="round"/>`),
    warrant: svg(`<path d="M8 3h12l5 5v21H8z" ${S} stroke-linejoin="round"/><path d="M20 3v5h5M12 14h9M12 18h9M12 22h5" ${S} stroke-linecap="round"/>`),
  };
  const icon = (id) => ICONS[id] || ICONS.generic;

  /* Цвет игрока: золотой угол даёт различимые оттенки для десяти человек. */
  const hueOf = (idx) => Math.round((idx * 137.5 + 20) % 360);
  const initial = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();
  // seat: номер места за столом в партии, по нему к игроку можно обратиться голосом.
  const avatar = (name, idx, cls = '', seat = null) => `<span class="av ${cls}" style="--h:${hueOf(idx)}" aria-hidden="true">${esc(initial(name))}${seat != null ? `<i class="seat">${seat}</i>` : ''}</span>`;

  const fmtClock = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  /* Обновляет HTML только если он изменился: не сбрасывает прокрутку и фокус зря. */
  /* Обновление разметки на месте. Прежний innerHTML пересоздавал все элементы при любой мелочи (счётчик готовых,
     чужой голос), и CSS-анимации на них стартовали заново: карточки подпрыгивали, подсветка говорящего мигала.
     Теперь совпадающие элементы остаются, меняются только отличающиеся атрибуты и текст. */
  const sameKind = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName
    && (a.nodeType !== 1 || (a.getAttribute('data-key') || a.id || '') === (b.getAttribute('data-key') || b.id || ''));
  function syncAttrs(a, b) {
    for (const at of Array.from(a.attributes)) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
    for (const at of Array.from(b.attributes)) {
      if (at.name === 'value' && (a.nodeName === 'INPUT' || a.nodeName === 'TEXTAREA')) continue;
      if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
    }
  }
  function morphNode(a, b) {
    if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    syncAttrs(a, b);
    if (a.nodeName === 'INPUT' || a.nodeName === 'TEXTAREA' || a.nodeName === 'SELECT') {
      if (document.activeElement !== a) {
        if (a.nodeName === 'INPUT' && (a.type === 'checkbox' || a.type === 'radio')) a.checked = b.checked; else if (a.value !== b.value && a.nodeName !== 'SELECT') a.value = b.value;
      }
      if (a.nodeName !== 'TEXTAREA') return;
    }
    morphKids(a, b);
  }
  function morphKids(a, b) {
    const nb = Array.from(b.childNodes);
    nb.forEach((n, i) => {
      const o = a.childNodes[i];
      if (!o) a.appendChild(n);
      else if (sameKind(o, n)) morphNode(o, n);
      else a.replaceChild(n, o);
    });
    while (a.childNodes.length > nb.length) a.removeChild(a.lastChild);
  }
  function setHtml(el, html, opts) {
    if (!el) return false;
    if (el._html === html) return false;
    const first = el._html === undefined || (opts && opts.fresh);
    el._html = html;
    if (first) { el.innerHTML = html; return true; }
    const t = document.createElement('template');
    t.innerHTML = html;
    morphKids(el, t.content);
    return true;
  }


  /* Тосты */
  function toast(text, kind) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' err' : '');
    el.textContent = text;
    root.appendChild(el);
    while (root.children.length > 4) root.removeChild(root.firstChild);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, kind === 'err' ? 4200 : 2800);
  }
  const fail = (res) => { toast((res && res.error) || 'Не получилось. Попробуйте ещё раз.', 'err'); return false; };

  /* Модальное окно. Возвращает { close, el }. build(el, close) заполняет содержимое. */
  function modal(build) {
    const root = document.getElementById('modalRoot');
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal" role="dialog" aria-modal="true"></div>';
    const box = back.firstChild;
    const prev = document.activeElement;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (prev && prev.focus) { try { prev.focus(); } catch (e) { /* ничего */ } } };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    root.appendChild(back);
    build(box, close);
    const first = box.querySelector('input,textarea,.opt:not([disabled]),button');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
    return { close, el: box };
  }

  /* Выбор из списка. items: [{ id, title, sub, avatarIdx, name, disabled }] → Promise<id|null> */
  function choose({ title, sub, items, cancel = 'Отмена', note }) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal((box, close) => {
        box.innerHTML = `<h3>${esc(title)}</h3>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
          <div class="opt-list">${items.map((it, i) => `<button class="opt" data-i="${i}" ${it.disabled ? 'disabled' : ''}>
            ${it.avatarIdx != null ? avatar(it.name || it.title, it.avatarIdx, '', it.seat) : '<span></span>'}
            <span><b>${esc(it.title)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`).join('')}</div>
          ${note ? `<p class="hint">${esc(note)}</p>` : ''}
          <div class="row"><button class="btn btn-ghost" data-cancel>${esc(cancel)}</button></div>`;
        box.addEventListener('click', (e) => {
          const o = e.target.closest('.opt');
          if (o && !o.disabled) { done = true; close(); resolve(items[Number(o.dataset.i)].id); }
          else if (e.target.closest('[data-cancel]')) { close(); }
        });
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(null); } });
      obs.observe(document.getElementById('modalRoot'), { childList: true });
    });
  }

  /* Окно с текстовым вводом → Promise<string|null> */
  function ask({ title, sub, placeholder, ok = 'Готово', max = 160, multiline = false }) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal((box, close) => {
        box.innerHTML = `<h3>${esc(title)}</h3>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
          ${multiline ? `<textarea class="input" rows="3" maxlength="${max}" placeholder="${esc(placeholder || '')}"></textarea>` : `<input class="input" maxlength="${max}" placeholder="${esc(placeholder || '')}">`}
          <div class="row"><button class="btn btn-ghost" data-cancel>Отмена</button><button class="btn btn-primary" data-ok>${esc(ok)}</button></div>`;
        const inp = box.querySelector('.input');
        const submit = () => { const v = inp.value.trim(); if (!v) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); return; } done = true; close(); resolve(v); };
        box.addEventListener('click', (e) => { if (e.target.closest('[data-ok]')) submit(); else if (e.target.closest('[data-cancel]')) close(); });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(null); } });
      obs.observe(document.getElementById('modalRoot'), { childList: true });
    });
  }

  /* Подтверждение → Promise<boolean> */
  function confirmBox({ title, sub, ok = 'Да', danger = false, cancel = 'Отмена' }) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal((box, close) => {
        box.innerHTML = `<h3>${esc(title)}</h3>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
          <div class="row"><button class="btn btn-ghost" data-cancel>${esc(cancel)}</button><button class="btn ${danger ? 'btn-red' : 'btn-primary'}" data-ok>${esc(ok)}</button></div>`;
        box.addEventListener('click', (e) => { if (e.target.closest('[data-ok]')) { done = true; close(); resolve(true); } else if (e.target.closest('[data-cancel]')) close(); });
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); } });
      obs.observe(document.getElementById('modalRoot'), { childList: true });
    });
  }

  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg || 'Скопировано'); }
    catch (e) { toast(`Скопируйте вручную: ${text}`); }
  }

  /* Журнал: только события партии (улики, голоса, карты, итоги). Писать в него нельзя. Записи дописываются по id. */
  function makeLog(root) {
    root.innerHTML = `<div class="j-head"><h2>Журнал</h2><span class="muted mono" data-st style="font-size:11px"></span></div>
      <div class="j-list" data-list></div>`;
    const list = root.querySelector('[data-list]');
    const st = root.querySelector('[data-st]');
    let lastId = 0, key = null;
    return {
      update(feed, { gameKey, nameOf, status }) {
        if (key !== gameKey) { key = gameKey; lastId = 0; list.innerHTML = ''; }
        const near = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        let added = false;
        // Ведущий нажал «Назад»: хвост журнала откатился, лишние строки убираем.
        const top = feed.length ? feed[feed.length - 1].id : 0;
        if (top < lastId) { [...list.children].forEach((el) => { if (Number(el.dataset.id) > top) el.remove(); }); lastId = top; }
        feed.forEach((f) => {
          if (f.id <= lastId) return;
          lastId = f.id; added = true;
          const el = document.createElement('div');
          el.dataset.id = f.id;
          el.className = 'sys ' + f.kind;
          el.textContent = f.text;
          list.appendChild(el);
        });
        if (added && near) list.scrollTop = list.scrollHeight;
        st.textContent = status || '';
      },
    };
  }

  window.UI = { esc, $, $$, icon, ICONS, hueOf, initial, avatar, fmtClock, setHtml, toast, fail, modal, choose, ask, confirmBox, copyText, makeLog, Content };
})();
