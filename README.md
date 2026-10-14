# Game Night

A small framework for party games where **the laptop is the game console and everyone's phone is a controller**.
The big screen shows what everyone shares (scores, the board, clues, a timer). Each phone shows what only
that player should see or do (a secret word, their own buttons, a text box).

There's no central server and no app to install. The laptop runs the game, and phones just open a web page that the laptop serves.

```
          ┌──────────── laptop ────────────┐
          │  server (node)                 │
          │   • runs the game rules        │◄──── phone: Alice  (sees her own view)
          │   • holds the real state       │◄──── phone: Bob    (sees his own view)
          │   • serves the web pages       │◄──── phone: Cara   (sees her own view)
          │                                │
          │  browser at /host ─ big screen │
          └────────────────────────────────┘
```

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
npm start
```

The big screen opens in your browser. Put it on the TV (full screen with F11), and players scan the QR code
with their phone camera. The first player to join is the **leader** (★): they can pick and start games from
their phone, so nobody has to walk over to the laptop.

**Testing on your own:** open `http://localhost:3000` in several browser tabs. Each tab is a separate player.

## Connecting phones

### Same Wi-Fi (the normal way)

Phones talk straight to the laptop over your Wi-Fi. Nothing leaves your house, and it works even when the
internet is down. The QR code on the big screen has the address in it (something like `http://192.168.1.23:3000`).

The first time you run it, Windows may ask whether to let **Node.js** through the firewall. Click **Allow**.
Your Wi-Fi network should be set to *Private* in Windows settings.

### Over the internet

```bash
npm run online
```

This gives the laptop a public `https://…trycloudflare.com` address that anyone can open from anywhere,
using a free Cloudflare "quick tunnel" (no account needed). The laptop still runs the whole game; Cloudflare
just passes the traffic along. A few seconds after starting, the server window prints the link and the QR code
on the big screen switches to it. Players can open it in any phone browser.

- **The address is different every time** you start. Just share the new QR code or link.
- **People in the room can still use the Wi-Fi address** (shown under the QR code). It's faster than going
  out to the internet and back, which matters for quick games like Tap Race.
- **Only the laptop (or a device on your Wi-Fi) can be the big screen.** Someone opening `…/host` through the
  internet link is told to join as a player instead, so nobody online can kick players or end games.
- If the tunnel drops, the QR code switches back to the Wi-Fi address.

`cloudflared` needs installing once: `winget install --id Cloudflare.cloudflared` (Mac: `brew install cloudflared`).

**Want a permanent address** (like `games.yourname.com`)? That's a Cloudflare *named* tunnel: it needs a free
Cloudflare account and a domain name. Once it's running, point the game at it with `npm start -- --url https://games.yourname.com`.

**Other ways in**, if you'd rather nobody sat in the middle:

| Option | How | Trade-off |
|---|---|---|
| **Port forwarding** | In your router settings, forward port 3000 to this laptop. Then run `npm start -- --url http://YOUR-PUBLIC-IP:3000` | Direct, with nobody in the middle, but you need router access, and some internet providers (CGNAT) make it impossible. |
| **Tailscale** | Everyone installs Tailscale and joins your tailnet. Then run `npm start -- --url http://LAPTOP-TAILSCALE-IP:3000` | Encrypted and direct between devices, but every guest has to install an app. |

## Making your own game

Copy `games/_template` to `games/my-game` and restart the server. It appears in the lobby.
While you're working on a game, `npm run dev` restarts the server automatically whenever a `server.js` changes.
For changes to `host.js`, `player.js` and `style.css`, just reload the page.

A game is a folder with up to four files:

| File | Runs on | Job |
|---|---|---|
| `server.js` | the laptop | The rules and the real game state. Browsers can never download it. |
| `host.js` | the big screen | Draws the shared view. |
| `player.js` | each phone | Draws that player's view and sends their actions. |
| `style.css` | both | Optional styles, loaded automatically. |

Any file ending in `.server.js` (like `words.server.js` in Odd One Out) is also kept secret.

### How it fits together

1. A phone does something: `api.send('vote', { playerId })`.
2. The server runs your `actions.vote(ctx, player, payload)`, which changes `ctx.state`.
3. The framework calls your `hostView(ctx)` and `playerView(ctx, player)` and sends each screen its view.
   A screen only gets an update when its view actually changes.
4. Each screen's `update(view)` redraws.

Because each phone only ever receives *its own* `playerView`, secrets stay secret. Nobody can peek at
another player's cards, even with the browser's developer tools.

### `server.js`

```js
export default {
  name: 'My Game',
  description: 'Shown on the game card in the lobby.',
  minPlayers: 2,
  maxPlayers: 8,

  setup(ctx) { return { /* starting state */ }; },          // game starts

  actions: {                                                 // phones call these
    guess(ctx, player, payload) { ... return { error: 'Too late!' }; },  // return value goes back to the phone
  },
  hostActions: {                                             // the big screen calls these (e.g. a "Skip" button)
    skip(ctx, payload) { ... },
  },

  hostView(ctx) { return { ... }; },                         // what the big screen sees
  playerView(ctx, player) { return { ... }; },               // what one phone sees

  // optional
  onJoin(ctx, player) {},        // someone joined mid-game. Return false to make them wait for the next game.
  onDisconnect(ctx, player) {},  // a phone dropped (locked screen, bad Wi-Fi...)
  onReconnect(ctx, player) {},   // ...and came back. They keep their seat automatically.
};
```

What `ctx` gives you:

| | |
|---|---|
| `ctx.state` | Your game's data. Change it freely; the screens update by themselves. Plain data only. |
| `ctx.players` | Everyone in this game: `{ id, name, color, connected, isVip }` |
| `ctx.player(id)` | One player, or `null` |
| `ctx.timer(name, ms, fn)` | Run `fn` later. Starting a timer with the same name replaces the old one. |
| `ctx.cancelTimer(name)` | Cancel a named timer |
| `ctx.after(ms, fn)` | Unnamed timer; returns a cancel function |
| `ctx.end(summary)` | Back to the lobby, showing `summary` there (e.g. `"Sam won!"`) |
| `ctx.pick(list)`, `ctx.shuffle(list)` | Random helpers |

For countdowns, put a deadline in the state (`Date.now() + 30000`) and show it with
`<span class="timer" data-deadline="${view.deadline}"></span>`. It ticks by itself and agrees across devices.

### `host.js` and `player.js`

```js
import { html } from '/js/ui.js';

export default function (root, api) {
  // runs once when the game starts: set things up here
  return {
    update(view) {
      root.innerHTML = html`
        <div class="center fill">
          <h1>${view.title}</h1>
          <button class="btn btn-xl" data-action="guess" data-payload="${JSON.stringify({ n: 3 })}">Guess 3</button>
        </div>`;
    },
    destroy() {},  // optional: clean up timers etc.
  };
}
```

- **The `html` tag** escapes everything you put in `${}`, so a player named `<script>` can't break anything.
  Arrays are joined and `false`/`null` print nothing, so `${list.map(...)}` and `${cond && html`...`}` both work.
- **`data-action`** on a button sends that action when it's tapped (with `data-payload` as the payload).
  On a `<form data-action="...">`, submitting sends the form's fields.
- **`api.send(type, payload)`** sends an action from code and resolves with whatever the action returned.
- `api.you` (this phone's player), `api.players`, `api.now()` (server time), `api.vibrate(ms)`.
- On phones, the CSS variable `--me` is the player's color.
- Ready-made classes: `btn btn-xl btn-sm secondary block me`, `card`, `stack`, `row`, `center`, `fill`, `grid`,
  `muted`, `big`, `huge`, `timer`, `chip`, `pc` (player-colored text, `style="--c:${p.color}"`).

If a game crashes, the error shows up on the big screen and in the server window, and the server keeps running.

### The example games

- **Tap Race** (`games/tap-race`): the simplest real game. Real-time, with smooth animation on the big screen.
- **Odd One Out** (`games/odd-one-out`): secret info per player, phases with timers, actions that reply
  with errors, buttons on the big screen. A good model for turn-based or party games.

## Options

```bash
npm start -- --port 4000                   # a different port
npm start -- --url https://example.com     # the address phones should use (shown in the QR code)
npm run online                             # also open a Cloudflare tunnel for internet play
npm run dev                                # restart automatically when server code changes
```

## Troubleshooting

- **Phones can't connect.** Check they're on the same Wi-Fi (not a guest network: those often block devices
  from seeing each other). Allow Node.js in Windows Firewall, and set the Wi-Fi to *Private*. If the laptop has
  several network adapters, the server window lists the other addresses to try.
- **A phone shows "Reconnecting…"** Phones disconnect when the screen locks. They rejoin automatically, in the
  same seat, when the page comes back.
- **Someone's phone died.** They open the page again and join with the same name. They get their old seat back.
