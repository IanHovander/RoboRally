// The website's big screen: this browser tab IS the game server. It runs the room, registers a
// room code with the PeerJS introduction server, and phones connect to it over WebRTC.
import { loadGames } from '../core/games.js';
import { Room } from '../core/room.js';
import { linkType, loadPeerJS, loadQrCode, localPair, peerOptions, PROTOCOL, RoomConn, roomPeerId } from './common.js';
import { getRelay } from './relay.js';

const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L or O: too easy to misread
const SAVED = 'gamenight.host'; // { code, token }: lets a refreshed tab get the same room code back
const SILENT_MS = 8000; // phones say something every 2 s; this long without a word means they're gone
const RECLAIM_MS = 90_000; // how long to wait for our old code after a refresh before taking a new one

/**
 * Start hosting. Returns the big screen's own socket-like connection to the room (it never touches
 * the network). `onStatus(text)` shows a problem to the person at the big screen (null = all good).
 */
export async function hostInBrowser({ onStatus }) {
  if (!(await onlyTab())) {
    // another tab is the big screen: wait our turn, and start by ourselves the moment it closes
    onStatus('Robo Rally is open in another tab. Close it and this one starts by itself.');
    await nextTab();
  }
  onStatus('Setting up the room…');
  const [Peer, qrcode, games] = await Promise.all([loadPeerJS(), loadQrCode(), loadGames()]);
  const relay = getRelay();
  const room = new Room(games);
  restorePlayers(room); // a reload (an update, or by hand): everyone's seat, name, color and robot are kept
  addEventListener('pagehide', () => savePlayers(room));
  const phones = new Set(); // RoomConn for each connected phone

  // The big screen itself: connected a moment later, once host.js is listening.
  const { client, conn } = localPair();
  setTimeout(() => room.connect(conn, { role: 'host' }), 0);

  const saved = readSaved();
  let code = saved?.code ?? newCode();
  const token = saved?.token ?? newToken();
  let peer = null;
  let reclaimingSince = 0;
  let retryDelay = 1000;

  function start() {
    peer?.destroy();
    peer = new Peer(roomPeerId(code), peerOptions({ token }, relay));
    peer.on('open', () => {
      reclaimingSince = 0;
      retryDelay = 1000;
      writeSaved({ code, token });
      room.setJoin(joinInfo(code, qrcode));
      onStatus(relay ? null : 'No relay login, so phones on mobile data may not be able to join.');
    });
    peer.on('connection', (dc) => acceptPhone(dc));
    peer.on('disconnected', () => {
      // Lost the introduction server. Phones already connected keep playing; new ones can't join until it's back.
      if (peer.destroyed) return;
      onStatus("Lost touch with the service that introduces phones. Players already in can keep playing. Reconnecting…");
      setTimeout(() => peer.disconnected && !peer.destroyed && peer.reconnect(), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 10_000);
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        // Someone (usually this same screen, just before a refresh) still holds our code.
        reclaimingSince ||= Date.now();
        if (Date.now() - reclaimingSince < RECLAIM_MS) {
          onStatus(`Getting room ${code} back… (this takes up to a minute after a refresh)`);
          setTimeout(start, 3000);
        } else {
          code = newCode();
          reclaimingSince = 0;
          start();
        }
      } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'ssl-unavailable'].includes(err.type)) {
        onStatus(`Can't reach the service that introduces phones (${peerOptions().host}). Check this computer's internet. Retrying…`);
        setTimeout(() => {
          if (peer.destroyed) start();
          else if (peer.disconnected) peer.reconnect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 10_000);
      } else if (err.type !== 'peer-unavailable') {
        console.warn('[host]', err.type, err);
      }
    });
  }

  function acceptPhone(dc) {
    let phone = null;
    const giveUp = setTimeout(() => !phone && dc.close(), 15_000);
    dc.on('data', (msg) => {
      if (phone) return phone.receive(msg);
      if (msg?.t !== 'hello') return;
      clearTimeout(giveUp);
      if (msg.v !== PROTOCOL) {
        // The phone has an older (or newer) copy of the site cached: tell it to reload.
        dc.send({ t: 'bye', reason: 'version' });
        setTimeout(() => dc.close(), 300);
        return;
      }
      phone = new RoomConn(dc.connectionId);
      phone.transmit = (m) => {
        try {
          dc.send(m);
        } catch (err) {
          console.warn('[host] send failed', err);
          phone.closed();
        }
      };
      phone.hangUp = () => dc.close();
      phone.backlog = () => dc.dataChannel?.bufferedAmount ?? 0;
      phone.peerConnection = dc.peerConnection;
      phones.add(phone);
      dc.send({ t: 'welcome' });
      // Phones are always players: only this page is the big screen.
      room.connect(phone, { role: 'player', token: msg.auth?.token, name: msg.auth?.name });
      setTimeout(() => checkLink(phone), 1500);
    });
    const gone = () => {
      clearTimeout(giveUp);
      if (phone) {
        phones.delete(phone);
        phone.closed();
      }
    };
    dc.on('close', gone);
    dc.on('error', gone);
  }

  async function checkLink(phone) {
    if (!phone.open) return;
    try {
      const link = await linkType(phone.peerConnection);
      if (link && link !== phone.link) {
        phone.link = link;
        room.scheduleSync();
      }
    } catch {}
  }

  // Every couple of seconds: drop phones that have gone quiet (a locked iPhone often never says
  // goodbye), and see how each one is connected.
  setInterval(() => {
    const now = Date.now();
    for (const phone of phones) {
      if (now - phone.lastHeard > SILENT_MS || phone.peerConnection?.connectionState === 'failed') {
        phones.delete(phone);
        phone.hangUp();
        phone.closed();
      }
    }
  }, 2000);
  setInterval(() => phones.forEach(checkLink), 5000);

  keepScreenOn();
  start();
  return client;
}

/** What the big screen shows for joining: the site address plus the room code, and a QR code with both. */
function joinInfo(code, qrcode) {
  const site = new URL('./', location.href);
  site.search = '';
  site.hash = '';
  const url = `${site.href}?room=${code}`;
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return { url, text: site.href.replace(/^https?:\/\//, '').replace(/\/$/, ''), code, local: null, qr: qr.createDataURL(10, 2) };
}

function newCode() {
  const pick = new Uint8Array(4);
  globalThis.crypto.getRandomValues(pick);
  return Array.from(pick, (n) => CODE_LETTERS[n % CODE_LETTERS.length]).join('');
}

function newToken() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36)).join('');
}

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED));
    return value && /^[A-Z]{4}$/.test(value.code) && typeof value.token === 'string' ? value : null;
  } catch {
    return null;
  }
}

function writeSaved(value) {
  try {
    localStorage.setItem(SAVED, JSON.stringify(value));
  } catch {}
}

// The room's players, kept across a reload of the big screen (it hosts the room on the website, so a reload
// starts the room afresh): phones reconnect with their tokens and get their own seats back, in the same order (so
// the same leader), with the same names, colors and robots. Only for a quick reload, not a later visit.
const PLAYERS = 'gamenight.roomPlayers';
function savePlayers(room) {
  try {
    const players = [...room.players.values()].map(({ id, token, name, color, avatar }) => ({ id, token, name, color, avatar }));
    sessionStorage.setItem(PLAYERS, JSON.stringify({ at: Date.now(), players }));
  } catch {}
}
function restorePlayers(room) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PLAYERS) ?? 'null');
    sessionStorage.removeItem(PLAYERS);
    if (!saved || Date.now() - saved.at > 2 * 60_000) return;
    for (const p of saved.players ?? []) {
      if (!p?.id || !p.name || room.players.has(p.id)) continue;
      room.players.set(p.id, { id: p.id, token: p.token ?? null, name: p.name, color: p.color, avatar: p.avatar, connected: false, socketId: null });
    }
    room.vip = undefined;
  } catch {}
}

/** Only one big screen per browser: two tabs would fight over the same room code. */
function onlyTab() {
  if (!navigator.locks) return Promise.resolve(true);
  return new Promise((resolve) => {
    navigator.locks.request('gamenight-host', { ifAvailable: true }, (lock) => {
      resolve(!!lock);
      return lock ? new Promise(() => {}) : undefined; // hold it for as long as this tab is open
    });
  });
}

/** Wait for the other big-screen tab to close (the browser hands the lock on), then hold it for this tab. */
function nextTab() {
  if (!navigator.locks) return Promise.resolve();
  return new Promise((resolve) => {
    navigator.locks.request('gamenight-host', () => {
      resolve();
      return new Promise(() => {}); // hold it for as long as this tab is open
    });
  });
}

/** Keep the laptop's screen from sleeping while it's hosting, and flag the tab if it's hidden. */
function keepScreenOn() {
  const title = document.title;
  const request = async () => {
    try {
      if (document.visibilityState === 'visible') await navigator.wakeLock?.request('screen');
    } catch {}
  };
  document.addEventListener('visibilitychange', () => {
    // A hidden tab runs slowly in most browsers, which makes the game lag for everyone.
    document.title = document.visibilityState === 'visible' ? title : '⚠ Keep Robo Rally in front!';
    request();
  });
  request();
}
