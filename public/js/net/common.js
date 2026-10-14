// Shared by the website's big screen (peer-host.js) and phones (peer-client.js).
//
// Every message on a WebRTC data channel is one JSON object:
//   phone -> big screen   { t: 'hello', v, auth }        first message: who I am (auth = token, name)
//   big screen -> phone   { t: 'welcome' }               you're in ('connect' fires on the phone)
//   either way            { t: 'ev', e, a, id? }         an event with arguments; `id` = please reply
//   either way            { t: 're', id, a }             the reply to event `id`
//   big screen -> phone   { t: 'bye', reason? }          don't reconnect (kicked / replaced / out-of-date page)
import config from '../config.js';

/** Bump when the messages change, so an old cached page and a new one don't misunderstand each other. */
export const PROTOCOL = 1;

export const roomPeerId = (code) => `${config.idPrefix}${code}`;

const vendorScripts = new Map();
/** Load one of our copies of a third-party script (public/vendor/) once. */
function loadVendor(file) {
  if (!vendorScripts.has(file)) {
    vendorScripts.set(
      file,
      new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL(`../../vendor/${file}`, import.meta.url).href;
        script.onload = resolve;
        script.onerror = () => {
          vendorScripts.delete(file);
          reject(new Error(`Couldn't load ${file}`));
        };
        document.head.append(script);
      }),
    );
  }
  return vendorScripts.get(file);
}

/** PeerJS's Peer class. */
export const loadPeerJS = () => loadVendor('peerjs.min.js').then(() => window.peerjs.Peer);

/** The QR code maker: qrcode(typeNumber, errorCorrection). */
export const loadQrCode = () => loadVendor('qrcode.js').then(() => window.qrcode);

/**
 * How to connect: STUN (helps devices find a route to each other) plus the relay for when they
 * can't. `relay` is the { username, credential } from relay.js (null = no relay).
 * Testing switches for the big screen's address: ?relay=1 sends every phone through the relay,
 * ?tls=1 uses only the relay on port 443 (what gets through the strictest networks).
 * (PeerJS's built-in relays and Metered's no-account relays stopped working; checked Oct 2026.)
 */
export function iceConfig(relay = null) {
  const params = new URLSearchParams(location.search);
  const turn = relay ? [{ urls: config.turnUrls, username: relay.username, credential: relay.credential }] : [];
  if (relay && params.has('tls')) {
    return { iceServers: turn.map((s) => ({ ...s, urls: s.urls.filter((u) => u.startsWith('turns:')) })), iceTransportPolicy: 'relay' };
  }
  return {
    iceServers: [{ urls: config.stunUrls }, ...turn],
    iceTransportPolicy: relay && params.has('relay') ? 'relay' : 'all',
  };
}

export function peerOptions(extra = {}, relay = null) {
  return { ...config.peerServer, config: iceConfig(relay), debug: 1, ...extra };
}

/** 'relay' or 'direct': how a WebRTC connection actually ended up connected (null if not yet). */
export async function linkType(peerConnection) {
  if (!peerConnection) return null;
  const stats = await peerConnection.getStats();
  let pair = null;
  stats.forEach((r) => {
    if (r.type === 'transport' && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId);
  });
  if (!pair) {
    stats.forEach((r) => {
      if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected)) pair = r;
    });
  }
  if (!pair) return null;
  const local = stats.get(pair.localCandidateId);
  const remote = stats.get(pair.remoteCandidateId);
  return local?.candidateType === 'relay' || remote?.candidateType === 'relay' ? 'relay' : 'direct';
}

/**
 * The phone/big-screen side of a connection, shaped like a socket.io client socket:
 * on(event, fn), emit(event, ...args, [reply]), timeout(ms).emit(...), connected.
 * Subclasses set `transmit(msg)` and call `received(msg)` / `dropped()`.
 * Unlike socket.io, nothing is queued while disconnected: replies fail at once, other sends are dropped,
 * so a phone that wakes up doesn't replay a pile of old taps.
 */
export class ClientSocket {
  constructor() {
    this.listeners = new Map();
    this.connected = false;
    this.nextId = 1;
    this.pending = new Map(); // id -> { cb, timer }
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
    return this;
  }

  fire(event, ...args) {
    for (const fn of this.listeners.get(event) ?? []) {
      try {
        fn(...args);
      } catch (err) {
        console.error(err);
      }
    }
  }

  emit(event, ...args) {
    const reply = typeof args.at(-1) === 'function' ? args.pop() : null;
    this.request(event, args, reply && ((err, ...result) => !err && reply(...result)), 0);
    return this;
  }

  timeout(ms) {
    return {
      emit: (event, ...args) => {
        const cb = typeof args.at(-1) === 'function' ? args.pop() : () => {};
        this.request(event, args, cb, ms);
      },
      emitWithAck: (event, ...args) =>
        new Promise((resolve, reject) => this.timeout(ms).emit(event, ...args, (err, result) => (err ? reject(err) : resolve(result)))),
    };
  }

  request(event, args, cb, ms) {
    if (!this.connected) {
      if (cb) queueMicrotask(() => cb(new Error('not connected')));
      return;
    }
    let id;
    if (cb) {
      id = this.nextId++;
      const timer = ms ? setTimeout(() => this.pending.delete(id) && cb(new Error('timeout')), ms) : null;
      this.pending.set(id, { cb, timer });
    }
    this.transmit(id ? { t: 'ev', e: event, a: args, id } : { t: 'ev', e: event, a: args });
  }

  received(msg) {
    if (msg?.t === 're') {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      p.cb(null, ...(msg.a ?? []));
    } else if (msg?.t === 'ev' && typeof msg.e === 'string') {
      this.fire(msg.e, ...(Array.isArray(msg.a) ? msg.a : []));
    }
  }

  /** The connection went away: fail anything waiting for a reply. */
  dropped() {
    for (const { cb, timer } of this.pending.values()) {
      clearTimeout(timer);
      cb(new Error('disconnected'));
    }
    this.pending.clear();
  }
}

/**
 * The room's side of a connection (what Room.connect() expects): id, data, emit, on, disconnect, canSend.
 * Set `transmit(msg)`, `hangUp()` and optionally `backlog()`; call `receive(msg)` with incoming
 * messages and `closed()` when the connection is gone.
 */
export class RoomConn {
  constructor(id) {
    this.id = id;
    this.data = {};
    this.handlers = new Map();
    this.open = true;
    this.link = null;
    this.lastHeard = Date.now();
  }

  on(event, fn) {
    this.handlers.set(event, fn);
  }

  emit(event, ...args) {
    if (this.open) this.transmit({ t: 'ev', e: event, a: args });
  }

  canSend() {
    return (this.backlog?.() ?? 0) < 64_000;
  }

  receive(msg) {
    this.lastHeard = Date.now();
    if (msg?.t !== 'ev' || typeof msg.e !== 'string' || !Array.isArray(msg.a)) return;
    if (msg.e === 'disconnect') return; // reserved: only we decide that
    const fn = this.handlers.get(msg.e);
    const wantsReply = typeof msg.id === 'number';
    if (!fn) {
      if (wantsReply) this.transmit({ t: 're', id: msg.id, a: [null] });
      return;
    }
    if (wantsReply) fn(...msg.a, (...result) => this.open && this.transmit({ t: 're', id: msg.id, a: result }));
    else fn(...msg.a);
  }

  /** The room is done with this screen (kicked / replaced): tell it not to come back, then hang up. */
  disconnect() {
    if (!this.open) return;
    this.transmit({ t: 'bye' });
    setTimeout(() => this.hangUp?.(), 300); // give the goodbye time to arrive
    this.closed();
  }

  closed() {
    if (!this.open) return;
    this.open = false;
    this.handlers.get('disconnect')?.();
  }
}

/**
 * Two ends of a pretend connection inside one page: the big screen talking to the room it hosts.
 * Messages are delivered a moment later (like a network), never in the middle of the sender's code.
 */
export function localPair(id = 'host') {
  const client = new ClientSocket();
  const conn = new RoomConn(id);
  client.transmit = (msg) => queueMicrotask(() => conn.receive(msg));
  conn.transmit = (msg) => queueMicrotask(() => client.received(msg));
  client.connected = true;
  client.connect = () => {};
  return { client, conn };
}
