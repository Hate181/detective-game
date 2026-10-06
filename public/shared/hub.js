/* Хаб: комнаты, лобби, запуск партий, админские команды.
   Не знает про сеть: сервер подключает к нему сокеты, а демо-режим браузера вызывает напрямую. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./content.js'), require('./cases.js'), require('./engine.js'));
  else root.DetectiveHub = factory(root.DetectiveContent, root.DetectiveCases, root.DetectiveEngine);
})(typeof self !== 'undefined' ? self : this, function (Content, Cases, Engine) {
  const MIN_PLAYERS = 6, MAX_PLAYERS = 10, TEST_MIN = 4;
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const CODE_LENGTH = 5;
  const NAME_MAX = 18;
  const OFFLINE_AUTOPILOT_MS = 12000;
  const HOST_PASS_MS = 45000;

  class HubError extends Error { constructor(code, message, extra) { super(message); this.code = code; this.extra = extra || null; } }
  const fail = (code, msg, extra) => { throw new HubError(code, msg, extra); };

  const normalizeCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const TURN_OPTIONS = [30, 40, 60, 90];
  const TALK_OPTIONS = [60, 90, 120, 180];
  /** Ссылка-приглашение в Discord: принимаем только адреса самого Discord, остальное отбрасываем. */
  const cleanDiscord = (v) => {
    const raw = String(v || '').trim();
    if (!raw) return '';
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const m = url.match(/^https:\/\/(?:www\.)?(discord\.gg|discord\.com|discordapp\.com)\/([A-Za-z0-9\-_\/.]{2,80})$/i);
    return m ? `https://${m[1].toLowerCase()}/${m[2]}` : null;
  };
  const seasonKey = (d = new Date()) => `${d.getFullYear()}-К${Math.floor(d.getMonth() / 3) + 1}`;

  class Hub {
    constructor({ store, onChange, now, maxRooms } = {}) {
      this.store = store;
      this.maxRooms = maxRooms || Infinity;
      this.onChange = onChange || (() => {});
      this.now = now || Date.now;
      this.rooms = new Map();
      this.tokens = new Map();
      this.admins = new Set();
      this.actAs = new Map();
      this.identities = new Map();
    }

    /* ---------- Вспомогательное ---------- */
    _rand(n) { return Math.floor(Math.random() * n); }
    _id(len, alphabet = CODE_ALPHABET) { let s = ''; for (let i = 0; i < len; i++) s += alphabet[this._rand(alphabet.length)]; return s; }
    _newCode() {
      if (this.rooms.size >= this.maxRooms) fail('busy', 'Сейчас открыто слишком много комнат. Попробуйте через пару минут.');
      for (let i = 0; i < 1000; i++) { const c = this._id(CODE_LENGTH); if (!this.rooms.has(c)) return c; }
      fail('full', 'Не удалось выделить код комнаты.');
    }
    cases() { return this.store.getCases(); }
    enabledCases() { return this.cases().filter((c) => c.enabled !== false); }
    roomOf(token) { const code = this.tokens.get(token); return code ? this.rooms.get(code) || null : null; }
    _room(code) { const r = this.rooms.get(normalizeCode(code)); if (!r) fail('not_found', 'Комната с таким кодом не найдена.'); return r; }
    _me(room, token) { const p = room.players.find((x) => x.token === token && !x.left); if (!p) fail('not_member', 'Вы не в этой комнате.'); return p; }
    _host(room, token) { const p = this._me(room, token); if (p.id !== room.hostId) fail('not_host', 'Это может сделать только ведущий.'); return p; }
    _admin(token) { if (!this.admins.has(token)) fail('not_admin', 'Нужно войти в админку.'); }
    isAdmin(token) { return this.admins.has(token); }
    /** Личность из входа через Discord/Google. Для гостей записи нет. */
    setIdentity(token, ident) { if (ident) this.identities.set(token, ident); else this.identities.delete(token); }
    identityOf(token) { return this.identities.get(token) || null; }
    /** Гость вошёл в аккаунт посреди партии: место в комнате переходит на токен аккаунта. */
    migrate(fromToken, toToken) {
      if (!fromToken || !toToken || fromToken === toToken) return false;
      const from = this.roomOf(fromToken);
      if (!from || this.roomOf(toToken)) return false;
      const p = from.players.find((x) => x.token === fromToken && !x.left);
      if (!p) return false;
      p.token = toToken;
      const ident = this.identities.get(toToken);
      if (ident) { p.account = ident.id; p.provider = ident.provider; }
      this.tokens.delete(fromToken); this.tokens.set(toToken, from.code);
      this.notify(from);
      return true;
    }
    setAdmin(token, on) { if (on) this.admins.add(token); else this.admins.delete(token); }
    _cleanName(name) {
      // Без управляющих и невидимых символов: иначе можно выдать себя за другого игрока.
      const n = String(typeof name === 'string' ? name : '').replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
      if (!n) fail('name', 'Представьтесь, детектив.');
      if (/^(__proto__|constructor|prototype)$/i.test(n)) fail('name', 'Возьмите другое имя.');
      return n;
    }
    _log(room, text) { room.log.push({ t: this.now(), text }); if (room.log.length > 30) room.log.shift(); }
    _touch(room) { room.lastActive = this.now(); }
    notify(room) { this.onChange(room.code); }
    roomTokens(code) { const r = this.rooms.get(code); return r ? r.players.filter((p) => !p.isBot && !p.left).map((p) => p.token) : []; }

    _addPlayer(room, token, name, isBot = false) {
      const taken = new Set(room.players.filter((p) => !p.left).map((p) => p.seat));
      let seat = -1;
      for (let s = 0; s < MAX_PLAYERS; s++) if (!taken.has(s)) { seat = s; break; }
      if (seat < 0) fail('room_full', 'В комнате уже 10 детективов.');
      const clean = this._cleanName(name);
      if (!isBot && room.players.some((p) => !p.left && p.token !== token && p.name.toLowerCase() === clean.toLowerCase())) fail('name_taken', 'Это имя в комнате уже занято. Добавьте букву или возьмите другое.');
      const player = { id: this._id(8, 'abcdefghijkmnpqrstuvwxyz23456789'), token, name: clean, seat, ready: isBot, connected: true, isBot, joinedAt: this.now(), left: false, offlineSince: 0, away: false, account: null, provider: null };
      if (!isBot) { const ident = this.identities.get(token); if (ident) { player.account = ident.id; player.provider = ident.provider; } }
      room.players.push(player);
      if (!isBot) this.tokens.set(token, room.code);
      return player;
    }

    /* ---------- Обработчик событий ---------- */
    handle(token, event, p = {}) {
      try {
        const fn = this['ev_' + event.replace(/[:]/g, '_')];
        if (!fn) return { ok: false, error: 'Неизвестная команда.' };
        const res = fn.call(this, token, p || {});
        return Object.assign({ ok: true }, res || {});
      } catch (e) {
        if (e instanceof HubError) return Object.assign({}, e.extra || {}, { ok: false, code: e.code, error: e.message });
        if (e instanceof Engine.GameError) return { ok: false, error: e.message };
        console.error(event, e);
        return { ok: false, error: 'Что-то пошло не так.' };
      }
    }

    /* ---------- Лобби ---------- */
    /** Игрок сидит в комнате и пытается открыть или занять другую: просим сначала решить, остаться или уйти. */
    _guardOther(token, code, leave) {
      const cur = this.roomOf(token);
      if (!cur || !cur.players.some((x) => x.token === token && !x.left)) return;
      if (code && cur.code === code) return;
      if (!leave) {
        const g = cur.game;
        fail('in_room', `Вы уже в комнате ${cur.code}. Вернитесь туда или выйдите из неё.`, { current: { code: cur.code, status: cur.status, phase: g ? g.phase : null, round: g ? g.round : 0, host: cur.players.some((x) => x.token === token && x.id === cur.hostId) } });
      }
      this._leave(token);
    }

    ev_room_create(token, { name, leave }) {
      this._guardOther(token, null, leave);
      const room = {
        code: this._newCode(), createdAt: this.now(), lastActive: this.now(), hostId: null, status: 'lobby', caseChoice: 'random', pack: 'main',
        settings: { discuss: 90, turn: 40, speed: 1, mode: 'host', hints: 'normal', discord: '' }, players: [], game: null, test: false, testRole: 'random', killerCounts: {}, log: [], lastCaseId: null, statsDone: false,
      };
      this.rooms.set(room.code, room);
      const host = this._addPlayer(room, token, name);
      room.hostId = host.id;
      this._log(room, `${host.name} открыл дело и ждёт напарников.`);
      this.notify(room);
      return { code: room.code };
    }

    ev_room_join(token, { code, name, leave }) {
      const room = this._room(code);
      const had = room.players.find((x) => x.token === token && !x.left);
      if (had) { had.connected = true; if (name) had.name = this._cleanName(name); this.tokens.set(token, room.code); this.notify(room); return { code: room.code }; }
      if (room.status !== 'lobby') fail('in_progress', 'Партия уже идёт. Дождитесь следующего дела.');
      this._guardOther(token, room.code, leave);
      const pl = this._addPlayer(room, token, name);
      this._log(room, `${pl.name} входит в комнату.`);
      this._touch(room); this.notify(room);
      return { code: room.code };
    }

    _leave(token) {
      const room = this.roomOf(token);
      if (!room) return;
      const p = room.players.find((x) => x.token === token && !x.left);
      this.tokens.delete(token);
      this.actAs.delete(token);
      if (!p) return;
      if (room.status === 'playing' && room.game && room.game.phase !== 'ended') {
        p.left = true; p.connected = false;
        const gp = room.game.players[p.id]; if (gp) { gp.auto = true; gp.left = true; }
        this._log(room, `${p.name} покидает партию, дальше играет автопилот.`);
      } else {
        room.players.splice(room.players.indexOf(p), 1);
        this._log(room, `${p.name} покидает комнату.`);
      }
      if (!room.players.some((x) => !x.isBot && !x.left)) { this.rooms.delete(room.code); return; }
      if (room.hostId === p.id) this._passHost(room);
      this.notify(room);
    }
    ev_room_leave(token) { this._leave(token); return {}; }
    /** Ведущий закрывает комнату: все игроки освобождаются и могут зайти в другую игру. */
    ev_room_close(token) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      this._host(room, token);
      this._closeRoom(room, token);
    }
    _closeRoom(room, by = null) {
      const tokens = room.players.filter((p) => !p.isBot && !p.left).map((p) => p.token);
      room.players.forEach((p) => { if (!p.isBot) { this.tokens.delete(p.token); this.actAs.delete(p.token); } });
      this.rooms.delete(room.code);
      this.onChange(room.code, { closed: true, tokens, by });
    }
    /** Игрок ушёл на главную страницу, но место за ним держится: для автопилота он считается отошедшим. */
    ev_room_away(token, { away }) {
      const room = this.roomOf(token); if (!room) return {};
      const p = room.players.find((x) => x.token === token && !x.left); if (!p) return {};
      const on = !!away;
      if (p.away !== on) { p.away = on; p.offlineSince = on || !p.connected ? this.now() : 0; this.notify(room); }
      return {};
    }

    _passHost(room, toId = null, excludeId = null) {
      const humans = room.players.filter((p) => !p.isBot && !p.left && p.id !== excludeId);
      const next = (toId && humans.find((p) => p.id === toId)) || humans.filter((p) => p.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0] || humans.sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (!next) return;
      room.hostId = next.id;
      this._log(room, `Ведущим становится ${next.name}.`);
      if (room.game && room.game.phase !== 'ended') Engine.setHost(room.game, next.id, this.now());
    }
    ev_room_host(token, { playerId }) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      this._host(room, token);
      const t = room.players.find((p) => p.id === playerId && !p.left && !p.isBot);
      if (!t) fail('bad_target', 'Передать ведение можно только живому игроку.');
      this._passHost(room, t.id);
      this.notify(room);
    }

    ev_room_case(token, { caseId }) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      this._host(room, token);
      if (room.status !== 'lobby') fail('in_progress', 'Дело уже начато.');
      if (caseId !== 'random' && !Cases.byId(caseId, this.enabledCases())) fail('bad_case', 'Такого дела нет в архиве.');
      room.caseChoice = caseId;
      this.notify(room);
    }
    ev_room_pack(token, { packId }) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      this._host(room, token);
      if (room.status !== 'lobby') fail('in_progress', 'Дело уже начато.');
      if (!Cases.PACKS.some((p) => p.id === packId) || !this._packCases(packId).length) fail('bad_pack', 'Такого пака нет или в нём нет дел.');
      room.pack = packId;
      room.caseChoice = 'random';
      this.notify(room);
    }
    _packCases(packId) { return this.enabledCases().filter((c) => (c.pack || 'main') === packId); }
    ev_room_setting(token, { key, value }) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      this._host(room, token);
      if (key === 'discord') {
        const url = cleanDiscord(value);
        if (url === null) fail('bad_setting', 'Нужна ссылка вида discord.gg/код.');
        room.settings.discord = url;
      } else if (key === 'mode') {
        if (!['host', 'timers'].includes(value)) fail('bad_setting', 'Недопустимая настройка.');
        room.settings.mode = value;
        if (room.game) room.game.settings.mode = value;
      } else if (key === 'hints') {
        // Обычный режим: связь игроков с уликами в интерфейсе не подсвечивается. Лайт: подсвечивается.
        if (room.status !== 'lobby') fail('in_progress', 'Режим меняют до начала партии.');
        if (!['normal', 'light'].includes(value)) fail('bad_setting', 'Недопустимая настройка.');
        room.settings.hints = value;
      } else if (key === 'turn' || key === 'discuss') {
        if (room.status !== 'lobby') fail('in_progress', 'Время меняют до начала партии.');
        if (!(key === 'turn' ? TURN_OPTIONS : TALK_OPTIONS).includes(Number(value))) fail('bad_setting', 'Недопустимая настройка.');
        room.settings[key] = Number(value);
      } else fail('bad_setting', 'Недопустимая настройка.');
      this.notify(room);
    }
    ev_room_ready(token) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      const p = this._me(room, token);
      if (room.status === 'lobby') { p.ready = !p.ready; this.notify(room); }
    }
    ev_room_rename(token, { name }) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      const clean = this._cleanName(name);
      if (room.players.some((p) => !p.left && p.token !== token && p.name.toLowerCase() === clean.toLowerCase())) fail('name_taken', 'Это имя в комнате уже занято.');
      this._me(room, token).name = clean;
      this.notify(room);
    }
    ev_room_kick(token, { playerId }) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      this._host(room, token);
      if (room.status !== 'lobby') fail('in_progress', 'Во время партии убрать игрока нельзя.');
      const t = room.players.find((p) => p.id === playerId);
      if (!t || t.id === room.hostId) fail('bad_target', 'Некого убирать.');
      room.players.splice(room.players.indexOf(t), 1);
      this.tokens.delete(t.token);
      this._log(room, `${t.name} убран из комнаты.`);
      this.notify(room);
      this.onChange(room.code, { kicked: t.token });
    }

    canStart(room) {
      const n = room.players.filter((p) => !p.left).length;
      const min = room.test ? TEST_MIN : MIN_PLAYERS;
      if (n < min) { const d = min - n; return { ok: false, reason: `Нужно ещё ${d} ${Content.trans(d, 'детектив', 'детектива', 'детективов')}` }; }
      const not = room.players.filter((p) => !p.left && p.id !== room.hostId && !p.ready).length;
      if (not) return { ok: false, reason: `Не готовы: ${not}` };
      return { ok: true, reason: '' };
    }

    ev_room_start(token) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      this._host(room, token);
      if (room.status !== 'lobby') fail('in_progress', 'Дело уже начато.');
      const c = this.canStart(room);
      if (!c.ok) fail('cannot_start', c.reason);
      this._startGame(room);
    }

    _pickCase(room) {
      const all = this.enabledCases();
      if (!all.length) fail('no_cases', 'В архиве нет ни одного включённого дела.');
      const inPack = this._packCases(room.pack || 'main');
      const pool = inPack.length ? inPack : all;
      const chosen = room.caseChoice !== 'random' && Cases.byId(room.caseChoice, all);
      if (chosen) return { c: chosen, random: false };
      const fresh = pool.filter((c) => c.id !== room.lastCaseId);
      const list = fresh.length ? fresh : pool;
      return { c: list[this._rand(list.length)], random: true };
    }

    _startGame(room, opts = {}) {
      const members = room.players.filter((p) => !p.left);
      if (members.length < (room.test ? TEST_MIN : MIN_PLAYERS) && !opts.force) fail('cannot_start', 'Не хватает игроков.');
      if (members.length < TEST_MIN) fail('cannot_start', `Нужно минимум ${TEST_MIN} человека.`);
      const { c, random } = opts.caseData ? { c: opts.caseData, random: false } : this._pickCase(room);
      const host = members.find((p) => p.id === room.hostId);
      let forceKiller = null, forceAccomplice = null;
      if (room.test && host) {
        const bots = members.filter((p) => p.isBot);
        if (room.testRole === 'killer') forceKiller = host.id;
        else if (room.testRole === 'innocent' && bots.length) forceKiller = bots[this._rand(bots.length)].id;
        else if (room.testRole === 'accomplice' && bots.length) { forceKiller = bots[this._rand(bots.length)].id; forceAccomplice = host.id; }
      }
      const seed = opts.seed || ((Math.random() * 0x7fffffff) | 0);
      room.game = Engine.createGame({
        caseData: c, seed, now: this.now(),
        players: members.map((p) => ({ id: p.id, name: p.name, bot: p.isBot })),
        settings: { discuss: room.settings.discuss, speed: room.settings.speed, mode: room.settings.mode, hints: room.settings.hints === 'light' ? 'light' : 'normal', durations: { turn: room.settings.turn } },
        hostId: room.hostId, history: { killerCounts: room.killerCounts }, forceKiller, forceAccomplice,
      });
      room.gameMeta = { caseData: c, seed };
      room.game.wasRandom = random;
      room.status = 'playing';
      room.statsDone = false;
      room.lastCaseId = c.id;
      members.forEach((p) => { p.ready = p.isBot || p.id === room.hostId; });
      this._log(room, `Дело открыто: ${c.title}.`);
      this._touch(room); this.notify(room);
    }

    ev_room_lobby(token) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      this._host(room, token);
      this._toLobby(room);
    }
    _toLobby(room) {
      room.players = room.players.filter((p) => !p.left);
      room.players.forEach((p) => { p.ready = p.isBot; });
      room.status = 'lobby'; room.game = null;
      this._log(room, 'Лобби снова открыто.');
      this.notify(room);
    }

    ev_room_next(token) {
      const room = this.roomOf(token); if (!room) fail('not_member', 'Вы не в комнате.');
      this._host(room, token);
      if (!room.game || room.game.phase !== 'ended') fail('in_progress', 'Сначала нужно закрыть дело.');
      room.players = room.players.filter((p) => !p.left);
      this._startGame(room, { force: room.test });
    }

    /* ---------- Игровые действия ---------- */
    _actingId(room, token) {
      const me = this._me(room, token);
      const as = this.actAs.get(token);
      if (as && room.test && this.admins.has(token) && room.game && room.game.players[as]) return as;
      return me.id;
    }

    ev_game_act(token, { action, payload }) {
      const room = this.roomOf(token); if (!room || !room.game) fail('no_game', 'Партия не идёт.');
      const pid = this._actingId(room, token);
      const r = Engine.act(room.game, pid, action, payload, this.now());
      if (!r.ok) fail('game', r.error);
      this._touch(room); this.notify(room);
    }

    ev_stats_get() { return this.statsView(); }

    /* ---------- Тик: время партий, автопилот, статистика ---------- */
    tick(now = this.now()) {
      for (const room of Array.from(this.rooms.values())) {
        const g = room.game;
        if (g) {
          for (const lp of room.players) {
            if (lp.isBot || lp.left) continue;
            const gp = g.players[lp.id];
            if (!gp) continue;
            const off = !lp.connected || lp.away;
            if (off && lp.offlineSince && now - lp.offlineSince > OFFLINE_AUTOPILOT_MS) gp.auto = true;
            else if (!off && !lp.forceAuto) gp.auto = false;
            if (lp.forceAuto) gp.auto = true;
          }
          const hostLp = room.players.find((p) => p.id === room.hostId);
          if (hostLp && !hostLp.isBot && (!hostLp.connected || hostLp.away) && hostLp.offlineSince && now - hostLp.offlineSince > HOST_PASS_MS && room.players.some((p) => !p.isBot && !p.left && p.connected && !p.away && p.id !== hostLp.id)) {
            this._passHost(room, null, hostLp.id); this.notify(room);
          }
          if (Engine.tick(g, now)) { this._touch(room); this.notify(room); }
          if (g.phase === 'ended' && !room.statsDone) { room.statsDone = true; this._recordGame(room); this.notify(room); }
        }
        const humans = room.players.filter((p) => !p.isBot && !p.left);
        // Пустое лобби живёт 15 минут, законченная партия 30 минут, идущая 6 часов.
        const idle = !room.game ? 15 * 60 * 1000 : room.game.phase === 'ended' ? 30 * 60 * 1000 : 6 * 3600 * 1000;
        if (now - room.lastActive > idle && humans.every((p) => !p.connected)) {
          humans.forEach((p) => this.tokens.delete(p.token));
          this.rooms.delete(room.code);
        }
      }
    }

    setConnected(token, connected) {
      const room = this.roomOf(token); if (!room) return null;
      const p = room.players.find((x) => x.token === token && !x.left);
      if (!p) return null;
      if (p.connected === connected) return room;
      p.connected = connected;
      if (!connected) p.offlineSince = this.now();
      else p.offlineSince = p.away ? (p.offlineSince || this.now()) : 0;
      this.notify(room);
      return room;
    }

    /* ---------- Статистика сезона ---------- */
    _stats() {
      const s = this.store.getStats() || {};
      const key = seasonKey();
      if (s.season !== key) { s.season = key; s.players = {}; }
      // Ключи игроков задают сами игроки: объект без прототипа, чтобы имя «__proto__» ничего не сломало.
      if (Object.getPrototypeOf(s.players || {}) !== null) s.players = Object.assign(Object.create(null), s.players);
      return s;
    }
    _recordGame(room) {
      if (room.test) return;
      const g = room.game, r = g.results;
      const s = this._stats();
      room.players.forEach((lp) => {
        if (lp.isBot) return;
        const gp = g.players[lp.id]; if (!gp) return;
        const key = lp.account || lp.name.toLowerCase();
        const e = s.players[key] = s.players[key] || { name: lp.name, games: 0, killer: 0, caught: 0, innocentGames: 0, solved: 0, points: 0, medals: 0 };
        e.name = lp.name; e.games += 1;
        if (gp.role === 'killer') { e.killer += 1; if (r.winner === 'innocent') e.caught += 1; }
        if (gp.role === 'innocent') { e.innocentGames += 1; if (r.winner === 'innocent') e.solved += 1; }
        e.points += r.score[lp.id] || 0;
        e.medals += r.awards.filter((a) => a.playerId === lp.id).length;
      });
      room.killerCounts[g.killerId] = (room.killerCounts[g.killerId] || 0) + 1;
      this.store.saveStats(s);
    }
    statsView() {
      const s = this._stats();
      const rows = Object.values(s.players).map((e) => ({
        name: e.name, games: e.games, killer: e.killer, solvedPct: e.innocentGames ? Math.round((e.solved / e.innocentGames) * 100) : null,
        caught: e.caught, points: e.points, medals: e.medals,
      })).sort((a, b) => b.points - a.points);
      return { season: s.season, rows };
    }

    /* ---------- Представление для клиента ---------- */
    view(token) {
      const room = this.roomOf(token);
      if (!room) return null;
      const me = room.players.find((x) => x.token === token && !x.left);
      if (!me) return null;
      const admin = this.admins.has(token);
      const as = this.actAs.get(token);
      const meId = as && room.test && admin && room.game && room.game.players[as] ? as : me.id;
      const vis = room.players.filter((p) => !p.left || room.status === 'playing');
      return {
        serverNow: this.now(), code: room.code, status: room.status, hostId: room.hostId, caseChoice: room.caseChoice, pack: room.pack || 'main', settings: Object.assign({}, room.settings),
        test: room.test, isAdmin: admin, meId, realMeId: me.id, speed: room.settings.speed,
        players: vis.slice().sort((a, b) => a.seat - b.seat).map((p) => ({ id: p.id, name: p.name, seat: p.seat, ready: p.ready, connected: p.connected && !p.away, away: !!p.away, provider: p.provider || null, isBot: p.isBot, left: p.left, auto: !!(room.game && room.game.players[p.id] && room.game.players[p.id].auto && !p.isBot) })),
        rules: { min: room.test ? TEST_MIN : MIN_PLAYERS, max: MAX_PLAYERS, accomplice: true, gang: true, turnOptions: TURN_OPTIONS, talkOptions: TALK_OPTIONS },
        canStart: this.canStart(room),
        packs: Cases.PACKS.map((p) => ({ id: p.id, title: p.title, desc: p.desc, count: this._packCases(p.id).length })),
        cases: this.enabledCases().map(({ id, title, icon, victim, difficulty, teaser }) => ({ id, title, icon, victim, difficulty, teaser })),
        log: room.log.slice(-8),
        game: room.game ? Engine.view(room.game, meId, { god: admin && room.test }) : null,
      };
    }

    /* ---------- Админка ---------- */
    ev_admin_cases(token) { this._admin(token); return { cases: this.cases() }; }

    ev_admin_case_save(token, { data }) {
      this._admin(token);
      let c;
      const list = this.cases();
      try { c = Cases.validateCase(data || {}, list.map((x) => x.id)); } catch (e) { fail('bad_case', e.message); }
      const i = list.findIndex((x) => x.id === c.id);
      if (i < 0 && list.length >= 300) fail('bad_case', 'В архиве уже 300 дел. Удалите лишние.');
      // Приметы, связи, мотивы и тайны в админке не редактируются: при правке дела они сохраняются как были.
      if (i >= 0) ['habits', 'proClues', 'relations', 'motives', 'secrets'].forEach((k) => { if (c[k] === undefined && list[i][k] !== undefined) c[k] = list[i][k]; });
      if (i >= 0) list[i] = c; else list.push(c);
      this.store.saveCases();
      this._sanitizeChoices();
      return { case: c, cases: list };
    }
    ev_admin_case_delete(token, { id }) {
      this._admin(token);
      const list = this.cases();
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) fail('bad_case', 'Такого дела уже нет.');
      if (list.length === 1) fail('bad_case', 'Последнее дело удалить нельзя: играть будет не во что.');
      list.splice(i, 1);
      this.store.saveCases();
      this._sanitizeChoices();
      return { cases: list };
    }
    _sanitizeChoices() {
      for (const room of this.rooms.values()) {
        if (room.status === 'lobby' && room.caseChoice !== 'random' && !Cases.byId(room.caseChoice, this.enabledCases())) room.caseChoice = 'random';
        if (room.status === 'lobby') this.notify(room);
      }
    }

    adminRooms() {
      return Array.from(this.rooms.values()).map((r) => ({
        code: r.code, status: r.status, test: r.test, createdAt: r.createdAt, caseChoice: r.caseChoice,
        caseTitle: r.game ? r.game.caseData.title : null, phase: r.game ? r.game.phase : null, round: r.game ? r.game.round : 0,
        paused: r.game ? r.game.paused : false, speed: r.settings.speed, mode: r.settings.mode,
        players: r.players.filter((p) => !p.left).sort((a, b) => a.seat - b.seat).map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, ready: p.ready, connected: p.connected, host: p.id === r.hostId })),
      })).sort((a, b) => b.createdAt - a.createdAt);
    }
    ev_admin_rooms(token) { this._admin(token); return { rooms: this.adminRooms() }; }

    ev_admin_test(token, { name, bots, caseId, speed, role, autostart, mode, hints }) {
      this._admin(token);
      this._leave(token);
      const room = {
        code: this._newCode(), createdAt: this.now(), lastActive: this.now(), hostId: null, status: 'lobby', caseChoice: 'random', pack: 'main',
        settings: { discuss: 90, turn: 40, speed: Math.min(1, Math.max(0.03, Number(speed) || 1)), mode: mode === 'timers' ? 'timers' : 'host', hints: hints === 'light' ? 'light' : 'normal', discord: '' }, players: [], game: null, test: true,
        testRole: ['killer', 'innocent', 'accomplice', 'random'].includes(role) ? role : 'random', killerCounts: {}, log: [], lastCaseId: null, statsDone: false,
      };
      this.rooms.set(room.code, room);
      const host = this._addPlayer(room, token, name || 'Админ');
      room.hostId = host.id;
      if (caseId && caseId !== 'random' && Cases.byId(caseId, this.enabledCases())) room.caseChoice = caseId;
      const n = Math.max(3, Math.min(9, Number(bots) || 5));
      const used = new Set();
      for (let i = 0; i < n; i++) {
        const nm = Content.BOT_NAMES.find((x) => !used.has(x)) || `Агент ${i + 1}`;
        used.add(nm); this._addPlayer(room, 'bot-' + this._id(12), nm, true);
      }
      this._log(room, 'Тестовая комната создана.');
      if (autostart !== false) this._startGame(room, { force: true });
      this.notify(room);
      return { code: room.code };
    }

    ev_admin_room(token, { code, action, value, playerId }) {
      this._admin(token);
      const room = this._room(code);
      const g = room.game;
      const now = this.now();
      switch (action) {
        case 'bot': {
          if (room.status !== 'lobby') fail('in_progress', 'Бота можно добавить только в лобби.');
          const used = new Set(room.players.map((p) => p.name));
          const nm = Content.BOT_NAMES.find((x) => !used.has(x)) || `Агент ${room.players.length + 1}`;
          this._addPlayer(room, 'bot-' + this._id(12), nm, true); break;
        }
        case 'unbot':
          if (room.status !== 'lobby') fail('in_progress', 'Ботов можно убрать только в лобби.');
          room.players = room.players.filter((p) => !p.isBot); break;
        case 'ready': room.players.forEach((p) => { p.ready = true; }); break;
        case 'start': if (room.status === 'lobby') this._startGame(room, { force: true }); break;
        case 'lobby': this._toLobby(room); break;
        case 'close':
          this._closeRoom(room);
          return { rooms: this.adminRooms() };
        case 'skip': if (g) Engine.skip(g, now); break;
        case 'pause': if (g) Engine.pause(g, now); break;
        case 'resume': if (g) Engine.resume(g, now); break;
        case 'speed': {
          const v = Math.min(1, Math.max(0.03, Number(value) || 1));
          room.settings.speed = v;
          if (g) {
            const old = g.settings.speed || 1;
            // Оставшееся время пересчитывается под новую скорость, чтобы фаза не зависала.
            const k = v / old;
            if (g.phaseEndsAt) g.phaseEndsAt = now + Math.max(500, (g.phaseEndsAt - now) * k);
            if (g.overlay && g.overlay.endsAt) g.overlay.endsAt = now + Math.max(500, (g.overlay.endsAt - now) * k);
            g.settings.speed = v;
          }
          break;
        }
        case 'mode': room.settings.mode = value === 'timers' ? 'timers' : 'host'; if (g) g.settings.mode = room.settings.mode; break;
        case 'restart': if (g) this._startGame(room, { force: true, caseData: room.gameMeta.caseData, seed: room.gameMeta.seed }); break;
        case 'next': if (g) { room.players = room.players.filter((p) => !p.left); this._startGame(room, { force: true }); } break;
        case 'auto': {
          const lp = room.players.find((p) => p.id === playerId) || room.players.find((p) => p.token === token);
          if (lp && !lp.isBot) { lp.forceAuto = !lp.forceAuto; if (g && g.players[lp.id]) g.players[lp.id].auto = !!lp.forceAuto; }
          break;
        }
        default: fail('bad_action', 'Неизвестное действие.');
      }
      this._touch(room); this.notify(room);
      return { rooms: this.adminRooms() };
    }

    ev_admin_as(token, { playerId }) {
      this._admin(token);
      const room = this.roomOf(token);
      if (!room || !room.test) fail('bad_action', 'Играть за другого можно только в тестовой комнате.');
      if (!playerId) this.actAs.delete(token);
      else {
        if (!room.game || !room.game.players[playerId]) fail('bad_action', 'Такого игрока нет в партии.');
        this.actAs.set(token, playerId);
      }
      this.notify(room);
    }

    ev_admin_sim(token, { games, players, caseId }) {
      this._admin(token);
      const list = this.enabledCases();
      const n = Math.max(4, Math.min(10, Number(players) || 7));
      const total = Math.max(1, Math.min(300, Number(games) || 50));
      const picked = caseId && caseId !== 'all' ? [Cases.byId(caseId, list)].filter(Boolean) : list;
      const agg = { games: 0, players: n, innocentWins: 0, byReason: {}, byRound: {}, avgMinutes: 0, innocentKicks: 0, violations: 0, errors: [] };
      let minutes = 0;
      picked.forEach((c, i) => {
        const part = Math.max(1, Math.round(total / picked.length));
        const r = Engine.simulate({ caseData: c, games: part, players: n, seed: 100 + i });
        agg.games += r.games; agg.innocentWins += r.innocentWins; agg.innocentKicks += r.innocentKicks;
        agg.violations += r.violations.length; agg.errors.push(...r.errors.slice(0, 3)); minutes += r.avgMinutes * r.games;
        Object.entries(r.byReason).forEach(([k, v]) => { agg.byReason[k] = (agg.byReason[k] || 0) + v; });
        Object.entries(r.byRound).forEach(([k, v]) => { agg.byRound[k] = (agg.byRound[k] || 0) + v; });
      });
      agg.avgMinutes = agg.games ? minutes / agg.games : 0;
      return { sim: agg };
    }
  }

  return { Hub, HubError, normalizeCode, MIN_PLAYERS, MAX_PLAYERS, CODE_LENGTH, cleanDiscord };
});
