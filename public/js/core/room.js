// The game room: players, lobby, and the game being played. This file runs in two places:
// on the laptop's Node server (server/index.js) and inside the big screen's browser tab when
// the website hosts the game (js/net/peer-host.js). It doesn't care how screens are connected.

const COLORS = [
  '#ff4d6d', '#4dabf7', '#ffd43b', '#51cf66', '#cc5de8', '#ff922b',
  '#22d3ee', '#f783ac', '#a9e34b', '#9775fa', '#20c997', '#ffa8a8',
  '#74c0fc', '#e599f7', '#fab005', '#94d82d', '#ff8787', '#63e6be',
  '#ffc078', '#b197fc', '#66d9e8', '#d8f5a2', '#faa2c1', '#91a7ff',
  '#f06595', '#38d9a9', '#ffe066', '#748ffc', '#ff6b6b', '#8ce99a',
  '#da77f2', '#ffa94d',
];
const MAX_PLAYERS = 32;
const MAX_NAME = 16;
const SYNC_EVERY_MS = 33; // the big screen gets up to ~30 updates a second...
const PHONE_EVERY_MS = 66; // ...each phone up to ~15, which keeps a hotspot's upload small
const BIG_MESSAGE = 15_000; // WebRTC can't carry messages over 16 KB, so warn well before that

/**
 * The room is everything the server knows: who's connected, whether we're in the
 * lobby or a game, and the game itself. Whenever anything changes it works out what
 * each screen should see and sends it.
 *
 * Messages from browsers:
 *   'join'   {name, token}          a phone joins with a name (token: from an earlier visit, if any)
 *   'action' {type, payload}        a phone (or the big screen) does something in the game
 *   'lobby'  {cmd, ...}             select / start / restart / end / kick
 *   'clock'                         asks for the server's time (keeps countdowns in sync)
 * Messages to browsers (each only when it changed):
 *   'room'   {...}                  what everyone shares: players, games, which screen
 *   'self'   {view, ...}            this screen's own game view (phones also get `you`, `inGame`)
 *   'session' {token, name}         a phone's key for getting its seat back after a reconnect
 *   'join-info' {url, text, qr}     (big screen only) where phones should go
 *   'kicked' / 'replaced'           this phone was removed / opened somewhere else
 *
 * A connection ("conn") is anything shaped like a socket.io socket:
 *   { id, data: {}, emit(event, ...args), on(event, handler), disconnect(), canSend?() }
 * Handlers get the message's arguments plus, when the sender wants a reply, a reply function last.
 * The code that owns the connection calls room.connect(conn, { role, token, name }) and decides the
 * role, because only it knows whether that screen may be the big screen.
 */
export class Room {
  constructor(games) {
    this.games = games;
    this.conns = new Map(); // connection id -> connection
    this.players = new Map(); // id -> { id, token, name, color, connected, socketId }
    this.join = { url: '', text: '', qr: '' };
    this.screen = 'lobby';
    this.selectedGameId = games.keys().next().value ?? null;
    this.game = null;
    this.gameCount = 0;
    this.lastResult = null;
    this.sent = new Map(); // connection id -> { room, self, at }: what it was last sent, so nothing is sent twice
    this.syncTimer = null;
    this.lastSyncAt = 0;
    this.vip = undefined; // cached vipId(); undefined = work it out again
    this.warnedBig = false;
  }

  setJoin(join) {
    this.join = join;
    for (const conn of this.conns.values()) {
      if (conn.data.role === 'host') conn.emit('join-info', join);
    }
    this.scheduleSync();
  }

  // ---------- connections ----------

  /** A screen connected. `role` is 'host' (big screen) or 'player' (phone). */
  connect(socket, { role, token, name } = {}) {
    guard('connection', () => this.onConnection(socket, role, token, name));
  }

  onConnection(socket, role, token, name) {
    socket.data ??= {};
    if (role === 'host') {
      socket.data.role = 'host';
      socket.emit('join-info', this.join);
    } else {
      socket.data.role = 'player';
      // A phone that has played before sends its token so it gets its seat back.
      if (typeof token === 'string') this.attach(socket, token, name);
    }
    this.conns.set(socket.id, socket);
    socket.on('join', (msg, ack) => guard('join', () => reply(ack, this.onJoin(socket, msg))));
    socket.on('action', (msg, ack) => guard('action', () => reply(ack, this.onAction(socket, msg))));
    socket.on('lobby', (msg) => guard('lobby', () => this.onLobby(socket, msg)));
    socket.on('clock', (...args) => {
      const ack = args.at(-1);
      if (typeof ack === 'function') ack(Date.now());
    });
    socket.on('disconnect', () => guard('disconnect', () => this.onDisconnect(socket)));
    this.scheduleSync();
  }

  onJoin(socket, msg) {
    if (socket.data.role !== 'player') return { ok: false, error: 'Only phones can join' };
    if (this.players.has(socket.data.playerId)) return { ok: true };
    return this.attach(socket, null, msg?.name, msg?.token);
  }

  /**
   * Seat a phone. `token` (from the connection) gets a returning phone its seat straight back.
   * Otherwise it joins by name; `lastToken` is the token this phone had before (e.g. the QR code
   * was scanned again and opened a new tab), which lets it take over its own seat even if the
   * old tab still looks connected.
   */
  attach(socket, token, rawName, lastToken) {
    let player = token ? this.find((p) => p.token === token) : null;
    if (!player) {
      const name = cleanName(rawName);
      if (!name) return { ok: false, error: 'Type your name first' };
      const sameName = this.find((p) => p.name.toLowerCase() === name.toLowerCase());
      const isMine = sameName && typeof lastToken === 'string' && lastToken === sameName.token;
      if (sameName?.connected && !isMine) return { ok: false, error: `Someone here is already called "${sameName.name}"` };
      if (sameName) {
        player = sameName; // came back from a new tab or device: give them their old seat
      } else {
        if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'Sorry, the room is full' };
        player = this.addPlayer(name);
      }
      player.token = randomHex(16);
    }

    // Still attached to an older connection (e.g. a duplicated tab)? Retire that one.
    if (player.socketId && player.socketId !== socket.id) {
      const old = this.conns.get(player.socketId);
      if (old) {
        old.data.playerId = null;
        old.emit('replaced');
        old.disconnect();
      }
    }
    const wasConnected = player.connected;
    player.connected = true;
    player.socketId = socket.id;
    this.vip = undefined;
    socket.data.playerId = player.id;
    socket.emit('session', { token: player.token, name: player.name });

    const g = this.game;
    if (g?.participants.has(player.id)) {
      if (!wasConnected) g.call('onReconnect', this.publicPlayer(player.id));
    } else if (g && typeof g.def.onJoin === 'function') {
      // Joined mid-game. The game decides whether they can jump in (return false to say no).
      g.participants.add(player.id);
      if (g.call('onJoin', this.publicPlayer(player.id)) === false) g.participants.delete(player.id);
    }
    this.scheduleSync();
    return { ok: true };
  }

  onDisconnect(socket) {
    this.conns.delete(socket.id);
    this.sent.delete(socket.id);
    const player = this.players.get(socket.data.playerId);
    if (!player || player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = null;
    this.vip = undefined;
    if (this.game?.participants.has(player.id)) this.game.call('onDisconnect', this.publicPlayer(player.id));
    this.scheduleSync();
  }

  addPlayer(name) {
    const used = new Set([...this.players.values()].map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c)) ?? COLORS[this.players.size % COLORS.length];
    const player = { id: 'p' + randomHex(4), token: null, name, color, connected: false, socketId: null };
    this.players.set(player.id, player);
    return player;
  }

  kick(id) {
    const player = this.players.get(id);
    if (!player) return;
    const socket = player.socketId && this.conns.get(player.socketId);
    if (socket) {
      socket.data.playerId = null;
      socket.emit('kicked');
      socket.disconnect();
    }
    this.players.delete(id);
    this.vip = undefined;
  }

  find(test) {
    for (const p of this.players.values()) if (test(p)) return p;
    return null;
  }

  connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected);
  }

  /** The first connected player is the VIP: they can pick and start games from their phone. */
  vipId() {
    this.vip ??= this.find((p) => p.connected)?.id ?? null;
    return this.vip;
  }

  /** The player info that's safe to share with everyone. */
  publicPlayer(id) {
    const p = this.players.get(id);
    if (!p) return null;
    return { id: p.id, name: p.name, color: p.color, connected: p.connected, isVip: p.id === this.vipId() };
  }

  // ---------- lobby ----------

  onLobby(socket, msg) {
    if (!msg || typeof msg !== 'object') return;
    const isHost = socket.data.role === 'host';
    const isVip = !isHost && socket.data.playerId != null && socket.data.playerId === this.vipId();
    if (!isHost && !isVip) return;

    switch (msg.cmd) {
      case 'select':
        if (this.screen === 'lobby' && this.games.has(msg.gameId)) this.selectedGameId = msg.gameId;
        break;
      case 'start':
        if (this.screen === 'lobby') this.startGame(this.selectedGameId);
        break;
      case 'restart':
        if (this.game) this.startGame(this.game.id);
        break;
      case 'end':
        this.endGame();
        break;
      case 'kick':
        if (isHost && this.screen === 'lobby') this.kick(msg.playerId);
        break;
    }
    this.scheduleSync();
  }

  startProblem(info) {
    const n = this.connectedPlayers().length;
    if (n < info.minPlayers) return `${info.name} needs at least ${info.minPlayers} player${info.minPlayers === 1 ? '' : 's'}`;
    if (n > info.maxPlayers) return `${info.name} allows at most ${info.maxPlayers} players`;
    return null;
  }

  startGame(gameId) {
    const info = this.games.get(gameId);
    if (!info || this.startProblem(info)) return;
    this.stopGame();
    const g = new GameSession(this, info, this.connectedPlayers().map((p) => p.id), ++this.gameCount);
    this.game = g;
    this.screen = 'game';
    this.lastResult = null;
    if (typeof info.def.setup === 'function') {
      try {
        const initial = info.def.setup.call(info.def, g.ctx);
        if (initial !== undefined) g.state = initial;
      } catch (err) {
        console.error(`\n[${info.id}] Error in setup:\n`, err);
        this.stopGame();
        this.screen = 'lobby';
        this.lastResult = `${info.name} crashed while starting. The error is in the server window (or the browser console).`;
      }
    }
    this.scheduleSync();
  }

  /** Back to the lobby. `summary` (optional) is shown there, e.g. "Sam won!". */
  endGame(session = this.game, summary) {
    if (!session || session !== this.game) return;
    this.stopGame();
    this.screen = 'lobby';
    this.lastResult = summary ? `${session.info.name}: ${summary}` : null;
    this.scheduleSync();
  }

  stopGame() {
    this.game?.dispose();
    this.game = null;
  }

  onAction(socket, msg) {
    const g = this.game;
    if (!g || !msg || typeof msg.type !== 'string') return null;
    if (socket.data.role === 'host') {
      const fn = ownFunction(g.def.hostActions, msg.type);
      if (!fn) return g.warn(`hostActions has no "${msg.type}"`);
      return g.run(`hostActions.${msg.type}`, () => fn.call(g.def, g.ctx, msg.payload));
    }
    const id = socket.data.playerId;
    if (!id || !g.participants.has(id)) return null;
    const fn = ownFunction(g.def.actions, msg.type);
    if (!fn) return g.warn(`actions has no "${msg.type}"`);
    return g.run(`actions.${msg.type}`, () => fn.call(g.def, g.ctx, this.publicPlayer(id), msg.payload));
  }

  // ---------- sending views ----------

  scheduleSync() {
    if (this.syncTimer) {
      // A browser can hold timers back by up to a second when the big screen's tab isn't in front.
      // If the update is overdue and something new happens, send it now instead of waiting.
      if (Date.now() > this.syncDue + 100) this.runSync();
      return;
    }
    const wait = Math.max(0, this.lastSyncAt + SYNC_EVERY_MS - Date.now());
    this.syncDue = Date.now() + wait;
    this.syncTimer = setTimeout(() => this.runSync(), wait);
  }

  runSync() {
    clearTimeout(this.syncTimer);
    this.syncTimer = null;
    this.lastSyncAt = Date.now();
    guard('sync', () => this.sync());
  }

  meta() {
    const selected = this.games.get(this.selectedGameId);
    return {
      screen: this.screen,
      join: { url: this.join.url, text: this.join.text, local: this.join.local ?? null, code: this.join.code ?? null },
      // `link`: how that phone is connected ('direct' / 'relay'), when the connection knows.
      players: [...this.players.values()].map((p) => ({ ...this.publicPlayer(p.id), link: this.conns.get(p.socketId)?.link ?? null })),
      games: [...this.games.values()].map(({ id, name, description, minPlayers, maxPlayers, hasStyle }) => ({
        id, name, description, minPlayers, maxPlayers, hasStyle,
      })),
      selectedGameId: this.selectedGameId,
      startProblem: selected ? this.startProblem(selected) : 'No games found in the games folder',
      game: this.game ? { id: this.game.id, name: this.game.info.name, session: this.game.number } : null,
      lastResult: this.lastResult,
    };
  }

  /**
   * Send every screen what changed since it was last sent anything. The shared room info and each
   * screen's own view travel separately, so a busy game only sends small per-player views.
   * Phones are capped at ~15 updates a second; a phone that's due an update but capped (or whose
   * connection is backed up) gets the latest one on a later pass.
   */
  sync() {
    const now = Date.now();
    const g = this.game;
    const room = this.meta();
    const roomJson = this.encode(room, 'the room info');
    const hostSelf = {
      view: g ? g.view('hostView', () => (g.def.hostView ? g.def.hostView.call(g.def, g.ctx) : g.state)) : null,
      error: g?.lastError ?? null,
    };
    const hostJson = this.encode(hostSelf, 'hostView');
    let behind = false;

    for (const conn of this.conns.values()) {
      const role = conn.data.role;
      if (role !== 'host' && role !== 'player') continue;
      let self = hostSelf;
      let selfJson = hostJson;
      if (role === 'player') {
        const you = this.publicPlayer(conn.data.playerId);
        const inGame = !!(g && you && g.participants.has(you.id));
        const view = inGame
          ? g.view('playerView', () => (g.def.playerView ? g.def.playerView.call(g.def, g.ctx, you) : g.state))
          : null;
        self = { you, inGame, view };
        selfJson = this.encode(self, 'playerView');
      }

      const sent = this.sent.get(conn.id) ?? { room: null, self: null, at: 0 };
      const roomChanged = roomJson !== null && roomJson !== sent.room;
      const selfChanged = selfJson !== null && selfJson !== sent.self;
      if (!roomChanged && !selfChanged) continue;
      if ((role === 'player' && now - sent.at < PHONE_EVERY_MS) || conn.canSend?.() === false) {
        behind = true;
        continue;
      }
      if (roomChanged) conn.emit('room', room);
      if (selfChanged) conn.emit('self', self);
      this.sent.set(conn.id, { room: roomJson, self: selfJson, at: now });
    }
    if (behind) this.scheduleSync();
  }

  /** JSON for comparing with what was sent last time (null if it can't be sent at all). */
  encode(value, label) {
    let json;
    try {
      json = JSON.stringify(value);
    } catch (err) {
      this.game?.report(`${label} (views must be plain data)`, err);
      return null;
    }
    if (json.length > BIG_MESSAGE && !this.warnedBig) {
      this.warnedBig = true;
      console.warn(`[room] ${label} is ${Math.round(json.length / 1024)} KB. Keep views small: phones on WebRTC can't receive more than 16 KB at once.`);
    }
    return json;
  }
}

/**
 * One play-through of a game. `ctx` is the toolbox handed to the game's code.
 */
class GameSession {
  constructor(room, info, playerIds, number) {
    this.room = room;
    this.info = info;
    this.def = info.def;
    this.id = info.id;
    this.number = number;
    this.participants = new Set(playerIds);
    this.state = {};
    this.timers = new Map();
    this.alive = true;
    this.lastError = null;
    this.lastErrorText = null;

    const g = this;
    this.ctx = {
      /** The game's data. Change it however you like; screens update automatically. */
      get state() { return g.state; },
      set state(value) { g.state = value; },
      /** Everyone in this game: [{ id, name, color, connected, isVip }] */
      get players() { return [...g.participants].map((id) => room.publicPlayer(id)).filter(Boolean); },
      /** One player by id (null if they're not in this game). */
      player: (id) => (g.participants.has(id) ? room.publicPlayer(id) : null),
      /** Run fn after ms milliseconds. Returns a function that cancels it. */
      after: (ms, fn) => g.setTimer(Symbol('after'), ms, fn),
      /** Like after(), but named: starting a timer with the same name replaces the old one. */
      timer: (name, ms, fn) => g.setTimer(name, ms, fn),
      cancelTimer: (name) => g.clearTimer(name),
      /** Finish the game and go back to the lobby. `summary` is shown there, e.g. "Sam won!". */
      end: (summary) => room.endGame(g, summary),
      pick: (list) => list[Math.floor(Math.random() * list.length)],
      shuffle: (list) => {
        const a = [...list];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
    };
  }

  setTimer(key, ms, fn) {
    this.clearTimer(key);
    const handle = setTimeout(() => {
      this.timers.delete(key);
      if (this.alive) this.run('a timer', () => fn(this.ctx));
    }, Math.max(0, Number(ms) || 0));
    this.timers.set(key, handle);
    return () => this.clearTimer(key);
  }

  clearTimer(key) {
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
  }

  /** Call one of the game's optional hooks (onJoin, onDisconnect, ...). */
  call(hook, ...args) {
    const fn = this.def[hook];
    if (typeof fn !== 'function') return undefined;
    return this.run(hook, () => fn.call(this.def, this.ctx, ...args));
  }

  /** Run game code that may change the state, then refresh every screen. */
  run(label, fn) {
    try {
      return fn();
    } catch (err) {
      this.report(label, err);
      return null;
    } finally {
      this.room.scheduleSync();
    }
  }

  /** Run game code that computes a view (must not change anything). */
  view(label, fn) {
    try {
      return fn();
    } catch (err) {
      this.report(label, err);
      return null;
    }
  }

  report(label, err) {
    const text = `${label}: ${err?.stack || err}`;
    if (text === this.lastErrorText) return; // don't flood the console 30 times a second
    this.lastErrorText = text;
    this.lastError = `${this.info.name}: error in ${label}: ${err?.message || err}`;
    console.error(`\n[${this.id}] Error in ${label}:\n${err?.stack || err}\n`);
  }

  warn(message) {
    if (this.lastErrorText !== message) console.warn(`[${this.id}] ${message}`);
    this.lastErrorText = message;
    return null;
  }

  dispose() {
    this.alive = false;
    for (const handle of this.timers.values()) clearTimeout(handle);
    this.timers.clear();
  }
}

/** Random hex string. Works in Node and in any browser page (crypto.randomUUID needs https). */
function randomHex(bytes) {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

function cleanName(name) {
  const text = String(name ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(text).slice(0, MAX_NAME).join('').trim();
}

function ownFunction(obj, key) {
  return obj && Object.hasOwn(obj, key) && typeof obj[key] === 'function' ? obj[key] : null;
}

function reply(ack, value) {
  if (typeof ack !== 'function') return;
  let data = null;
  try {
    data = value === undefined ? null : JSON.parse(JSON.stringify(value));
  } catch {
    data = null;
  }
  ack(data);
}

function guard(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`[room] ${label} failed:`, err);
    return undefined;
  }
}
