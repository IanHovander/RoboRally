# Game Night

A small framework for party games where **one screen is the game console and everyone's phone is a controller**.
The big screen shows what everyone shares (scores, the board, clues, a timer). Each phone shows what only
that player should see or do (a secret word, their own buttons, a text box). Nobody installs an app.

## Three ways to run it

| | **Website** (WebRTC) | **Laptop + internet link** | **Laptop, Wi-Fi only** |
|---|---|---|---|
| Big screen | any computer's browser: open the site | this laptop: `npm run online` | this laptop: `npm start` |
| Who runs the game | the big screen's browser tab | Node on this laptop | Node on this laptop |
| Phones join over | Wi-Fi or mobile data | Wi-Fi or mobile data | the same Wi-Fi only |
| Needs internet | yes | yes | no |
| Outside services | PeerJS introductions, a relay for mobile data (Metered, login kept on the big screen) | a Cloudflare tunnel | none |

All three run the same games.

```
 Website:      phones ──WebRTC (direct, or via the relay)──► big screen's browser (runs the game)
                         PeerJS's server only does the introductions
 Laptop+link:  phones ──https──► Cloudflare ──► cloudflared on the laptop ──► Node server (runs the game)
 Wi-Fi only:   phones ──Wi-Fi──► Node server on the laptop (runs the game)
```

### Website

Open **https://ianhovander.github.io/game-night/host.html** on the computer connected to the TV, and press F11.
Players scan the QR code (or open the site and type the 4-letter room code). Nothing to install, on any computer.

- **Refreshing the big screen** keeps the same room code. Phones reconnect by themselves, back in the lobby.
- **Keep the big-screen tab in front.** Browsers slow down hidden tabs, which makes the game lag.
- **`check.html`** on the site tests a network in 10 seconds: green means that device can play from there.

#### The relay

Phones that can't reach the big screen directly (most on mobile data, and phones on strict Wi-Fi) go through a
relay server (Metered). Its login is **built into `public/js/config.js`, and it is public on purpose**: anyone can
read it, and the worst they can do is use up the free relay allowance (20 GB a month). If that happens, make a
new login in the Metered dashboard (that turns the old one off) and put it in `config.js`.

**Copies of this project are welcome to use it.** Leave `turnLogin` as it is: if it's ever replaced here, syncing a
copy with this repo brings in the new one. (`docs/adding-a-game.md`, section 2.)

To use a different login on one computer, click **Relay** at the bottom of the big screen's lobby. It's kept in
that browser only, and "Forget it" goes back to the built-in one.

### Laptop + internet link

You need [Node.js](https://nodejs.org) 20+ and, once, `winget install --id Cloudflare.cloudflared`.

```bash
npm install
```

```bash
npm run online
```

The big screen opens. A few seconds later (sometimes a minute) the server window prints a public
`https://…trycloudflare.com` link and the QR code switches to it. The laptop still runs the game; Cloudflare
just passes the traffic along.

- The address is different every time. The big screen itself only opens on the laptop or its Wi-Fi.
- People on the same Wi-Fi can use the Wi-Fi address shown under the QR code, which is faster.

### Laptop, Wi-Fi only

`npm start`. Phones on the same Wi-Fi scan the QR code. Works with no internet at all. The first time, Windows
may ask to let Node.js through the firewall: click **Allow** (and set the Wi-Fi to *Private*).

The first player to join is the **leader** (★): they can pick and start games from their phone.

## Saturday playbook

**Before leaving:** laptop charged and plugged in, lid-close set to "do nothing", Windows Update paused,
Chrome's Energy Saver off. The hotspot phone charged, with its charger.

**Arrive 30–45 minutes early:**

1. Connect the laptop to **your phone's hotspot** (players don't join the hotspot; they use their own data or the
   school Wi-Fi). Open the main mode chosen at the rehearsal, full screen.
2. One phone on school Wi-Fi and one on mobile data open **`check.html`**. If Wi-Fi shows red, tell everyone:
   **"Turn Wi-Fi off and use your data."**
3. If the main mode struggles, switch to the other (website ↔ `npm run online`). Same games either way.

**Don't change or publish the code on the day:** phones and the big screen could load different versions.

## Making your own game

Copy `games/_template` to `games/my-game` (lowercase letters, numbers and dashes). It appears in the lobby after
restarting the server (`npm run dev` restarts it automatically when `rules.js` changes) or rebuilding the site
(`npm run build`). For `host.js`, `player.js` and `style.css` changes, just reload the page.

| File | Job |
|---|---|
| `rules.js` | The rules and the real game state. Runs on the laptop server, or in the big screen's browser on the website. |
| `host.js` | Draws the big screen. |
| `player.js` | Draws one phone and sends its actions. |
| `style.css` | Optional styles, loaded automatically. |

On the website every file is public, so a curious player could read a game's word list. What each phone
*receives* is still private: a phone only ever gets its own `playerView`.

### How it fits together

1. A phone does something: `api.send('vote', { playerId })`.
2. The game runs your `actions.vote(ctx, player, payload)`, which changes `ctx.state`.
3. The framework calls your `hostView(ctx)` and `playerView(ctx, player)` and sends each screen its view,
   only when it changed (phones at most ~15 times a second, the big screen ~30).
4. Each screen's `update(view)` redraws.

### `rules.js`

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
  onDisconnect(ctx, player) {},  // a phone dropped (locked screen, bad signal...)
  onReconnect(ctx, player) {},   // ...and came back. They keep their seat automatically.
};
```

| `ctx` | |
|---|---|
| `ctx.state` | Your game's data. Change it freely; the screens update by themselves. Plain data only. |
| `ctx.players` | Everyone in this game: `{ id, name, color, connected, isVip }` |
| `ctx.player(id)` | One player, or `null` |
| `ctx.timer(name, ms, fn)` | Run `fn` later. Starting a timer with the same name replaces the old one. |
| `ctx.cancelTimer(name)` / `ctx.after(ms, fn)` | Cancel a named timer / unnamed timer (returns a cancel function) |
| `ctx.end(summary)` | Back to the lobby, showing `summary` there (e.g. `"Sam won!"`) |
| `ctx.pick(list)`, `ctx.shuffle(list)` | Random helpers |

Keep views small (a few KB): the website can't send a message over 16 KB. For countdowns, put a deadline in
the state (`Date.now() + 30000`) and show it with `<span class="timer" data-deadline="${view.deadline}"></span>`.

### `host.js` and `player.js`

```js
import { html } from '../../js/ui.js';

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
- **`data-action`** on a button sends that action when tapped (`data-payload` is the payload). On a
  `<form data-action="...">`, submitting sends the form's fields.
- **`api.send(type, payload)`** sends an action from code and resolves with whatever the action returned.
- `api.you` (this phone's player), `api.players`, `api.now()` (game time), `api.vibrate(ms)`.
- **`avatar(player)`** (from `../../js/avatar.js`) draws that player's robot: one of 12 posed characters in their color,
  the same on every screen. `avatar(player, { mood: 'happy' })` for winners; disconnected players doze off by themselves.
- The look follows the Iron Panthers brand: colors are CSS variables in `css/base.css` (`--red`, `--red-hi`, `--black`…),
  headings use Teko and body text Roboto. The game-show styling is `css/arena.css`, switched on by `data-theme="arena"`
  on the `<html>` tag; remove it for the plainer red, black and white look.
- Ready-made classes: `btn btn-xl btn-sm secondary block me`, `card`, `stack`, `row`, `center`, `fill`, `grid`,
  `muted`, `big`, `huge`, `timer`, `chip`, `pc` (player-colored text, `style="--c:${p.color}"`). On phones,
  `var(--me)` is the player's color.
- Always use relative imports (`../../js/ui.js`): the website lives in a subfolder.

If a game crashes, the error shows on the big screen and in the server window (or browser console).

**Example games:** Tap Race (real-time, up to 32 players) and Odd One Out (secret words, phases, timers, voting; up to 24).

## Testing

```bash
npm test                 # end-to-end checks of the room on the laptop server (32 players, update rates, secrets)
npm run site             # the website version on this computer: http://localhost:4000/game-night/host.html
node test/load.mjs --join https://xxxx.trycloudflare.com --local http://localhost:3000 --bots 25 --seconds 300
```

- **`tools/bots.html?room=ABCD&n=20`** (on the site) adds 20 fake phones that play by themselves, each a real WebRTC
  connection.
- **`host.html?relay=1`** makes the big screen send every phone through the relay (like phones on mobile data);
  **`host.html?tls=1`** uses only the relay over TLS on port 443 (like a strict school network). Each player's
  chip shows RELAY or DIRECT.
- `test/load.mjs` does the same for the laptop server, measuring data use and tap delay through the tunnel.

## Publishing the website

Pushing to `main` on GitHub runs `.github/workflows/pages.yml`, which builds the site (`npm run build` → `dist/`)
and publishes it to GitHub Pages. Phones may keep an old copy for ~10 minutes after a change.

## Troubleshooting

- **A phone is stuck on "Looking for room…"** Check the code. If it's right, open `check.html` on that phone; if
  anything is red, switch it to mobile data.
- **A phone shows "Reconnecting…"** Phones disconnect when the screen locks. They rejoin by themselves, in the
  same seat, when they wake up.
- **Someone's phone died or they closed the tab.** They open the page again and join with the same name.
- **Wi-Fi-only mode: phones can't connect.** Same Wi-Fi (not a guest network, which often isolates devices),
  Node.js allowed in Windows Firewall, Wi-Fi set to *Private*.
