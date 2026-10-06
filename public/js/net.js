/* Транспорт. С сервером: Socket.IO. Без сервера (превью, файл с диска): тот же Hub работает прямо в браузере, соседи по комнате боты. */
(function () {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } },
  };
  const makeToken = () => {
    const a = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else a.forEach((_, i) => { a[i] = Math.random() * 256; });
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  };
  let token = store.get('detective.token');
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token) || token.startsWith('acc-')) { token = makeToken(); store.set('detective.token', token); }

  const listeners = { state: [], status: [], kicked: [], left: [], me: [] };
  const emit = (type, data) => listeners[type].forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
  const Net = { token, mode: 'server', offset: 0, listeners, store, me: { account: null, providers: {}, community: '', contact: 'detective-platform-ops@proton.me', ready: false } };
  Net.on = (type, fn) => { listeners[type].push(fn); };
  Net.now = () => Date.now() + Net.offset;

  /* ---------- Сервер ---------- */
  function socketNet() {
    const socket = window.io({ auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => emit('status', 'on'));
    socket.on('disconnect', () => emit('status', 'off'));
    socket.on('connect_error', () => emit('status', 'off'));
    socket.on('room:state', (s) => { Net.offset = s.serverNow - Date.now(); emit('state', s); });
    socket.on('room:kicked', (d) => emit('kicked', d || {}));
    socket.on('room:left', () => emit('left', {}));
    return {
      mode: 'server',
      call(event, payload) {
        return new Promise((resolve) => {
          socket.timeout(8000).emit(event, payload || {}, (err, res) => resolve(err ? { ok: false, error: 'Сервер не отвечает. Проверьте соединение.' } : res));
        });
      },
      async cases() {
        try { const r = await fetch('/api/cases'); if (r.ok) return await r.json(); } catch (e) { /* офлайн */ }
        return window.DetectiveCases.CASES;
      },
    };
  }

  /* ---------- Демо в браузере ---------- */
  function demoNet() {
    const { Hub } = window.DetectiveHub;
    const Cases = window.DetectiveCases, Content = window.DetectiveContent;
    const load = (k, fb) => { try { const v = JSON.parse(store.get(k) || 'null'); return v == null ? fb : v; } catch (e) { return fb; } };
    let cases = load('detective.cases', null);
    if (!Array.isArray(cases) || !cases.length) cases = JSON.parse(JSON.stringify(Cases.CASES));
    else { const m = Cases.mergeBuiltins(cases, load('detective.cases.seen', null) || Cases.LEGACY_IDS, load('detective.cases.textrev', 0), load('detective.cases.packrev', 0)); store.set('detective.cases.seen', JSON.stringify(m.seen)); store.set('detective.cases.textrev', JSON.stringify(m.textRev)); store.set('detective.cases.packrev', JSON.stringify(m.packRev)); if (m.added || m.refreshed || m.retired) store.set('detective.cases', JSON.stringify(cases)); }
    let stats = load('detective.stats', null);
    const hub = new Hub({
      guestNames: true,
      store: {
        getCases: () => cases, saveCases: () => store.set('detective.cases', JSON.stringify(cases)),
        getStats: () => stats, saveStats: (s) => { stats = s; store.set('detective.stats', JSON.stringify(s)); },
      },
      onChange: (code, extra = {}) => {
        if (extra.kicked === token) { emit('kicked', {}); return; }
        if (extra.closed && extra.tokens && extra.tokens.includes(token)) { if (extra.by === token) emit('left', {}); else emit('kicked', { closed: true }); return; }
        const room = hub.roomOf(token);
        if (room && room.code === code) push();
      },
    });
    const push = () => { const v = hub.view(token); if (v) emit('state', v); };
    const demoHosts = new Set();
    const timers = new Set();
    const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
    const clearLater = () => { timers.forEach(clearTimeout); timers.clear(); };

    const addBot = (room) => {
      const used = new Set(room.players.map((p) => p.name));
      const nm = Content.BOT_NAMES.find((x) => !used.has(x)) || `Агент ${room.players.length + 1}`;
      return hub._addPlayer(room, 'bot-' + hub._id(12), nm, true);
    };
    const arrivals = (room, n, firstDelay = 900) => {
      for (let i = 0; i < n; i++) later(firstDelay + i * 1000, () => { if (hub.rooms.has(room.code) && room.status === 'lobby' && room.players.length < 10) { addBot(room); hub.notify(room); } });
    };

    setInterval(() => {
      hub.tick();
      // Ведущий-бот в демо сам запускает партию, когда все готовы.
      demoHosts.forEach((code) => {
        const room = hub.rooms.get(code);
        if (!room) { demoHosts.delete(code); return; }
        if (room.status === 'lobby' && room.players.length >= 6 && hub.canStart(room).ok && !room._startAt) room._startAt = Date.now() + 2500;
        if (room._startAt && Date.now() > room._startAt) { room._startAt = 0; if (room.status === 'lobby' && hub.canStart(room).ok) hub._startGame(room); }
        if (room.status === 'playing' && room.game && room.game.phase === 'ended') {
          // После финала ведущим становится живой игрок, чтобы можно было открыть следующее дело.
          const host = room.players.find((p) => p.id === room.hostId);
          const human = room.players.find((p) => !p.isBot && !p.left);
          if (host && host.isBot && human) { room.hostId = human.id; hub.notify(room); }
        }
      });
    }, 400);

    setTimeout(() => emit('status', 'demo'), 0);

    const extra = {
      'room:create': (p) => {
        clearLater();
        const r = hub.handle(token, 'room:create', p);
        if (r.ok) arrivals(hub.rooms.get(r.code), 5);
        return r;
      },
      'room:join': (p) => {
        clearLater();
        const code = window.DetectiveHub.normalizeCode(p.code);
        if (!hub.rooms.has(code)) {
          // Комнаты по коду в демо нет, поэтому «ведущий» появляется сам.
          const room = { code, createdAt: Date.now(), lastActive: Date.now(), hostId: null, status: 'lobby', caseChoice: 'random', pack: 'main', settings: { discuss: 90, turn: 40, speed: 1, mode: 'host', discord: '' }, players: [], game: null, test: false, testRole: 'random', killerCounts: {}, log: [], lastCaseId: null, statsDone: false };
          hub.rooms.set(code, room);
          const host = addBot(room); room.hostId = host.id;
          for (let i = 0; i < 4; i++) addBot(room);
          demoHosts.add(code);
        }
        return hub.handle(token, 'room:join', Object.assign({}, p, { code }));
      },
      'room:leave': () => { clearLater(); const r = hub.handle(token, 'room:leave', {}); emit('left', {}); return r; },
      'room:lobby': (p) => hub.handle(token, 'room:lobby', p),
      'admin:auth': () => { hub.setAdmin(token, true); return { ok: true }; },
    };
    return {
      mode: 'demo',
      call(event, payload) {
        return new Promise((resolve) => {
          const h = extra[event];
          resolve(h ? h(payload || {}) : hub.handle(token, event, payload || {}));
        });
      },
      async cases() { return cases.filter((c) => c.enabled !== false); },
    };
  }

  /* Аккаунт (Discord/Google) приходит от сервера. В демо входа нет: все играют гостями. */
  Net.loadMe = async () => {
    if (Net.mode === 'server') {
      try {
        const r = await fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' });
        if (r.ok) { const d = await r.json(); Net.me = { account: d.account, providers: d.providers || {}, community: d.community || '', contact: d.contact || Net.me.contact, ready: true }; }
      } catch (e) { /* без сервера входа нет */ }
    }
    Net.me.ready = true;
    emit('me', Net.me);
    return Net.me;
  };
  Net.logout = async () => {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* уже вышли */ }
    location.href = location.pathname + '#/';
    location.reload();
  };

  const impl = window.io ? socketNet() : demoNet();
  Net.mode = impl.mode;
  if (impl.mode === 'demo') Net.me.community = 'https://discord.gg/hfWsKkGVH';
  Net.call = impl.call;
  Net.cases = impl.cases;
  Net.loadMe();
  window.Net = Net;
})();
