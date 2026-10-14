// Shared by the big screen (host.js) and the phones (play.js).
import { html, loadCss, tickDeadlines, wireActions } from './ui.js';

/** The server's clock, so countdowns agree on every device. */
export const clock = {
  offset: 0,
  sync(serverNow) {
    if (typeof serverNow === 'number') this.offset = serverNow - Date.now();
  },
  now() {
    return Date.now() + this.offset;
  },
};

setInterval(() => tickDeadlines(document, clock.now()), 200);

export function connect(auth) {
  return window.io({ auth, reconnectionDelay: 500, reconnectionDelayMax: 2000 });
}

/** The `api` object every game screen receives. */
export function createApi(socket, role, getState) {
  return {
    role,
    /** Send an action to the game's server code. Resolves with whatever the action returned. */
    send(type, payload) {
      return new Promise((resolve) => {
        socket.timeout(8000).emit('action', { type, payload }, (err, result) => resolve(err ? null : result));
      });
    },
    get room() { return getState()?.room ?? null; },
    get players() { return getState()?.room?.players ?? []; },
    /** This phone's player ({ id, name, color, isVip }); null on the big screen. */
    get you() { return getState()?.you ?? null; },
    /** Current time on the server, in ms. Compare with deadlines from the game. */
    now: () => clock.now(),
    secondsLeft: (deadline) => Math.max(0, Math.ceil((deadline - clock.now()) / 1000)),
    /** Buzz the phone (Android only; does nothing elsewhere). */
    vibrate(pattern = 15) {
      try { navigator.vibrate?.(pattern); } catch {}
    },
  };
}

/**
 * Loads a game's host.js / player.js into the page and feeds it views.
 * A game screen module looks like:
 *   export default function (root, api) {
 *     // set things up once
 *     return { update(view) { ... }, destroy() { ... } };
 *   }
 */
export class GameStage {
  constructor(container, role, api) {
    this.container = container;
    this.role = role;
    this.api = api;
    this.key = null;
    this.root = null;
    this.instance = null;
    this.view = null;
    this.viewJson = null;
    this.shownJson = undefined;
    wireActions(container, (type, payload) => api.send(type, payload));
  }

  async show(game, view, games) {
    this.view = view ?? null;
    this.viewJson = JSON.stringify(this.view);
    const key = game ? `${game.id}#${game.session}` : null;

    if (key !== this.key) {
      this.clear();
      this.key = key;
      if (!game) return;
      try {
        const base = `/games/${encodeURIComponent(game.id)}/`;
        const info = games?.find((g) => g.id === game.id);
        const [mod] = await Promise.all([import(`${base}${this.role}.js`), info?.hasStyle ? loadCss(`${base}style.css`) : null]);
        if (this.key !== key) return; // the game changed while we were loading
        if (typeof mod.default !== 'function') {
          throw new Error(`games/${game.id}/${this.role}.js must "export default function (root, api) { ... }"`);
        }
        this.root = document.createElement('div');
        this.root.className = 'game-root';
        this.container.append(this.root);
        this.instance = mod.default(this.root, this.api) || {};
      } catch (err) {
        if (this.key === key) this.fail(err);
        return;
      }
    }
    this.refresh();
  }

  refresh() {
    if (!this.instance || this.shownJson === this.viewJson) return; // only redraw when the view changed
    this.shownJson = this.viewJson;
    try {
      this.instance.update?.(this.view, this.api);
    } catch (err) {
      console.error(err);
    }
    tickDeadlines(this.container, clock.now());
  }

  clear() {
    try {
      this.instance?.destroy?.();
    } catch (err) {
      console.error(err);
    }
    this.instance = null;
    this.root = null;
    this.shownJson = undefined;
    this.container.replaceChildren();
  }

  fail(err) {
    console.error(err);
    this.instance = null;
    this.container.innerHTML = html`
      <div class="stage-error">
        <b>The ${this.role === 'host' ? 'big screen' : 'phone'} part of this game has a problem</b>
        <pre>${err?.message || err}</pre>
        <span class="muted">Fix the file, then reload this page. More detail is in the browser console (F12).</span>
      </div>`;
  }
}
