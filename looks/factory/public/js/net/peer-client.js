// A phone's connection to the website's big screen, over WebRTC. Looks like a socket.io socket to
// play.js (on / emit / timeout().emit / connected / connect) so the phone page works the same
// whether the game runs on the laptop server or in the big screen's browser.
import { ClientSocket, loadPeerJS, peerOptions, PROTOCOL, roomPeerId } from './common.js';
import { getRelay } from './relay.js';

const SILENT_MS = 6000; // the big screen answers our clock question every 2 s; silence this long = gone
const WELCOME_MS = 12_000; // give up on a connection attempt after this long and try again
const RELOADED = 'gamenight.reloadedForVersion';

export class PeerSocket extends ClientSocket {
  constructor(code, auth) {
    super();
    this.code = code;
    this.auth = auth; // object, or socket.io-style function(cb) asked on every connection
    this.wanted = true; // false once the big screen says goodbye (kicked / replaced)
    this.peer = null;
    this.dc = null;
    this.opening = false;
    this.lastHeard = 0;
    this.retryTimer = null;
    this.retries = 0;

    setInterval(() => this.watch(), 1000);
    const wake = () => this.wake();
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wake());
    window.addEventListener('pageshow', wake);
    window.addEventListener('online', wake);
    setTimeout(() => this.open(), 0); // once the page has added its listeners
  }

  /** Come back after the big screen said goodbye (the player tapped "Join again" / "Play here"). */
  connect() {
    this.wanted = true;
    this.retries = 0;
    this.open();
  }

  transmit(msg) {
    try {
      this.dc?.send(msg);
    } catch (err) {
      console.warn('[phone] send failed', err);
    }
  }

  status(text) {
    this.fire('status', text);
  }

  async open() {
    if (!this.wanted || this.dc || this.opening) return;
    this.opening = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    try {
      const peer = await this.newPeer();
      this.status(`Looking for room ${this.code}…`);
      const dc = peer.connect(roomPeerId(this.code), { reliable: true, serialization: 'json' });
      this.dc = dc;
      const welcome = setTimeout(() => {
        if (this.dc === dc && !this.connected) this.lost(dc, `Still looking for room ${this.code}. Is the big screen open?`);
      }, WELCOME_MS);
      dc.on('open', async () => {
        const auth = await this.askAuth();
        if (this.dc === dc) dc.send({ t: 'hello', v: PROTOCOL, auth });
      });
      dc.on('data', (msg) => {
        if (this.dc !== dc) return;
        this.lastHeard = Date.now();
        if (msg?.t === 'welcome') {
          clearTimeout(welcome);
          this.connected = true;
          this.retries = 0;
          sessionStorage.removeItem(RELOADED);
          this.status(null);
          this.fire('connect');
        } else if (msg?.t === 'bye') {
          this.goodbye(msg.reason);
        } else {
          this.received(msg);
        }
      });
      dc.on('close', () => this.lost(dc));
      dc.on('error', () => this.lost(dc));
    } catch (err) {
      this.status(err.message);
      this.retryLater();
    } finally {
      this.opening = false;
    }
  }

  /**
   * A fresh PeerJS connection to the introduction server for every attempt: after a phone has
   * been asleep its old one is often dead without knowing it.
   */
  async newPeer() {
    const Peer = await loadPeerJS();
    this.peer?.destroy();
    const peer = new Peer(peerOptions({}, getRelay()));
    this.peer = peer;
    peer.on('error', (err) => this.peerError(peer, err));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Can't reach the service that connects phones. Trying again…")), 10_000);
      peer.on('open', () => {
        clearTimeout(timer);
        resolve(peer);
      });
      peer.on('error', () => {
        clearTimeout(timer);
        reject(new Error("Can't reach the service that connects phones. Trying again…"));
      });
    });
  }

  peerError(peer, err) {
    if (peer !== this.peer) return;
    if (err.type === 'peer-unavailable') {
      // Nobody has that room code right now.
      this.lost(this.dc, `Can't find room ${this.code}. Is the big screen open? Trying again…`);
    } else if (err.type === 'browser-incompatible') {
      this.wanted = false;
      this.status("This browser can't connect to the game. Try Chrome or Safari.");
    } else if (!this.connected) {
      console.warn('[phone]', err.type, err);
    }
    // Once connected, losing the introduction server doesn't matter: we talk to the big screen directly.
  }

  async askAuth() {
    if (typeof this.auth !== 'function') return this.auth ?? {};
    return new Promise((resolve) => this.auth(resolve));
  }

  goodbye(reason) {
    this.wanted = false;
    if (reason === 'version') {
      // The big screen runs a newer (or older) copy of the site than this phone has cached.
      if (!sessionStorage.getItem(RELOADED)) {
        sessionStorage.setItem(RELOADED, '1');
        location.reload();
        return;
      }
      this.status('This page is out of date. Reload it to join.');
    }
    this.lost(this.dc, null, 'io server disconnect');
  }

  /** This connection is finished; try again unless the big screen said goodbye. */
  lost(dc, message = null, reason = 'transport close') {
    if (!dc || dc !== this.dc) return;
    this.dc = null;
    try {
      dc.close();
    } catch {}
    this.peer?.destroy();
    this.peer = null;
    const wasConnected = this.connected;
    this.connected = false;
    this.dropped();
    if (wasConnected) this.fire('disconnect', reason);
    if (message) this.status(message);
    if (this.wanted) this.retryLater();
  }

  retryLater() {
    if (this.retryTimer || !this.wanted) return;
    const delay = [300, 1000, 2000, 3000][Math.min(this.retries++, 3)];
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, delay);
  }

  watch() {
    if (this.connected && Date.now() - this.lastHeard > SILENT_MS) this.lost(this.dc, null, 'ping timeout');
  }

  /** The phone woke up or came back to this tab: check the connection right away. */
  wake() {
    if (this.connected && Date.now() - this.lastHeard > 2500) {
      this.lost(this.dc, null, 'ping timeout');
    } else if (!this.connected && !this.dc && this.wanted) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      this.retries = 0;
      this.open();
    }
  }
}
