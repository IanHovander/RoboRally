// A phone page inside the big screen's own page (host.html's "play on this screen too" panel): a phone used as
// both the big screen and a controller. It talks to the room the page around it hosts by postMessage, in the
// same tab, so nothing has to keep running in a background tab. Same shape as PeerSocket (on / emit / connect).
import { ClientSocket, PROTOCOL } from './common.js';

/** True when this page is the panel inside the big screen's page (?embed in the address, same site). */
export function isEmbedded() {
  try {
    return window.parent !== window && new URLSearchParams(location.search).has('embed') && window.parent.location.origin === location.origin;
  } catch {
    return false; // a parent on another site can't be read: not ours
  }
}

export class EmbedSocket extends ClientSocket {
  constructor(auth) {
    super();
    this.auth = auth; // object, or socket.io-style function(cb) asked on every connection
    this.transmit = (msg) => window.parent.postMessage({ gameNight: msg }, location.origin);
    addEventListener('message', (e) => {
      if (e.source !== window.parent || e.origin !== location.origin || !e.data?.gameNight) return;
      const msg = e.data.gameNight;
      if (msg.t === 'welcome') {
        this.connected = true;
        this.fire('connect');
      } else if (msg.t === 'bye') {
        this.connected = false;
        this.dropped();
        this.fire('disconnect', 'io server disconnect');
      } else this.received(msg);
    });
    queueMicrotask(() => this.connect());
  }

  async connect() {
    const auth = typeof this.auth === 'function' ? await new Promise((resolve) => this.auth(resolve)) : this.auth ?? {};
    window.parent.postMessage({ gameNight: { t: 'hello', v: PROTOCOL, auth } }, location.origin);
  }
}
