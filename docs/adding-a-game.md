# Adding a game to Game Night, and hosting your own copy

**Who this is for:** an AI coding agent helping someone (call them *the owner*) who wants to add a new game
("subgame") to Game Night and host the result on **their own** GitHub account. You're on a different machine
and network from the original project. Read this whole file before starting.

**The original project:** https://github.com/IanHovander/game-night (live at https://ianhovander.github.io/game-night/).

**The short version:**

1. The owner sets up GitHub and you fork the repo (section 1).
2. You make the copy theirs (section 2).
3. You add `games/<your-game>/` (sections 3–4).
4. You teach the test bots to play it (section 5).
5. You test it in the order in section 6.
6. You publish to GitHub Pages (section 7).
7. Optionally, you offer the game back to the original repo (section 8).

Steps marked **👤 owner** need the human: logins and account choices. Never type the owner's passwords
yourself; let them complete browser logins.

---

## 0. How Game Night works (2 minutes)

One screen is the **big screen** (the laptop or TV); every player's **phone** is a controller. Nobody installs anything.
The same games run in three modes (see README.md):

| Mode | Command / URL | Who runs the game's rules |
|---|---|---|
| Website (what you'll publish) | `https://<owner>.github.io/game-night/host.html` | the big screen's browser tab; phones connect over WebRTC |
| Laptop + internet link | `npm run online` | Node on the laptop, through a Cloudflare tunnel |
| Laptop, Wi-Fi only | `npm start` | Node on the laptop |

**A game is just a folder** in `games/`. The framework finds it, lists it in the lobby, handles players
joining and reconnecting, and sends each screen its view. You don't register the game anywhere.

```
games/<id>/
  rules.js    the rules and the real game state (runs in Node OR in the big screen's browser)
  host.js     draws the big screen
  player.js   draws one phone
  style.css   optional; loaded automatically
```

**The data flow:**

1. A phone sends an action.
2. `rules.js` updates `ctx.state`.
3. The framework calls `hostView(ctx)` and `playerView(ctx, player)` and sends each screen its view, only when it changed.
4. `host.js` / `player.js` redraw it in `update(view)`.

---

## 1. Setup

### 👤 Owner: tools and GitHub login (once)

Install Git, Node.js 20+ and the GitHub CLI:

- **Windows:** `winget install Git.Git OpenJS.NodeJS.LTS GitHub.cli`
- **Mac:** `brew install git node gh`

Then the owner runs this and finishes the login in their browser:

```bash
gh auth login
```

Pick GitHub.com, HTTPS, and "Login with a web browser". Check it worked with `gh auth status`.

### Agent: get the code

Fork it, so the owner can pull in future updates from the original and offer their game back:

```bash
gh repo fork IanHovander/game-night --clone
```

This creates the remotes `origin` (the owner's fork) and `upstream` (the original). Then:

```bash
cd game-night
gh repo set-default <owner>/game-night
npm install
npm test
```

**The `set-default` line matters:** after forking, `gh` defaults to the *original* repo, so commands like
`gh workflow run` would otherwise aim at it.

`npm test` must print `ALL PASSED` before you change anything. If it doesn't, stop and find out why.

**Pull the latest first** (`gh repo sync` or `git pull upstream main`), so you build on the current look.
The structure and APIs in this document don't depend on the styling.

**Privacy (recommended):** keep the owner's email out of the public commit history:

```bash
git config user.email "$(gh api user --jq '.id')+$(gh api user --jq '.login')@users.noreply.github.com"
```

---

## 2. Make the copy the owner's (before the first publish)

Edit `public/js/config.js`:

1. **`idPrefix`:** change it to something unique, such as `'gamenight-' + 6 random letters + '-'`.
   - **Why:** every copy of Game Night registers room codes on the same free PeerJS server (`0.peerjs.com`).
     With the same prefix, a phone from one site could end up in a big screen from the other, which may have different games.
2. **`turnLogin`: leave it as it is.** It's the original owner's Metered relay login, shared on purpose so every
   copy works out of the box, including for phones on mobile data.
   - **Don't change it.** If the original owner ever replaces the login, syncing your copy brings in the new one (section 9).
     If the relay checks in `check.html` suddenly turn red, sync first.
   - **It's a shared free allowance** of 20 GB a month across everyone using it. A busy game night uses at most a few
     hundred MB, so it's plenty for normal use.
   - **Optional: the owner's own relay**, for large or frequent events, or to be independent.
     - **👤 Owner:** create a free account at https://www.metered.ca, open TURN Server → Credentials, and add a credential.
     - **Agent:** put its username and password ("credential") in `turnLogin`, and the relay addresses from the dashboard in `turnUrls`.
     - Whatever is in `config.js` is public (it ships in the website). The worst case is someone using up that
       allowance; the fix is a new credential in Metered.
     - A single big screen can also use a private login with its **Relay** button (kept in that browser only).

Also replace `ianhovander.github.io` in `README.md` with the owner's address: `https://<owner>.github.io/game-night/`.
If you renamed the repo, use that name; all paths are relative, so any repo name works.

**Commit this on its own** ("Make this copy ours: room code prefix"), separate from the game. Section 8 explains why.

---

## 3. Add the game

```bash
cp -r games/_template games/my-game
```

On Windows PowerShell: `Copy-Item -Recurse games/_template games/my-game`.

- **The folder name is the game's id.** Use lowercase letters, numbers and dashes, like `word-bomb`.
- **Lobby order:** games appear alphabetically by folder name. Folders starting with `_` are ignored.
- **Examples to read first:** `games/tap-race` (real-time, simplest) and `games/odd-one-out` (phases, timers, secret info per player, voting).

### `rules.js`

```js
export default {
  name: 'My Game',                       // shown in the lobby
  description: 'One sentence for the game card.',
  minPlayers: 3,                         // the lobby won't start outside this range
  maxPlayers: 16,                        // the room holds at most 32

  setup(ctx) { return { phase: 'play', scores: {} }; },  // starting state (or assign ctx.state)

  actions: {                             // what phones can do: api.send('guess', {...}) runs actions.guess
    guess(ctx, player, payload) {        // player = { id, name, color, connected, isVip }
      if (ctx.state.phase !== 'play') return;               // ignore actions that aren't allowed right now
      const n = Number(payload?.n);
      if (!Number.isInteger(n) || n < 1 || n > 10) return { error: 'Pick 1 to 10' }; // the phone receives this
      // ...change ctx.state; screens update by themselves
    },
  },
  hostActions: {                         // buttons on the big screen (data-action="next" in host.js)
    next(ctx) { /* ... */ },
  },

  hostView(ctx) { return { /* what EVERYONE may see: no secrets until the reveal */ }; },
  playerView(ctx, player) { return { /* what THIS player may see */ }; },

  onJoin(ctx, player) {},       // optional: someone joined mid-game (return false = they wait for the next game)
  onDisconnect(ctx, player) {}, // optional: a phone dropped; don't let the game wait for them forever
  onReconnect(ctx, player) {},  // optional: it came back (it keeps its seat automatically)
};
```

**What `ctx` gives you:**

| Field | What it does |
|---|---|
| `ctx.state` | The game's data. Change it freely. |
| `ctx.players` | Everyone in this game (connected or not). |
| `ctx.player(id)` | One player, or `null`. |
| `ctx.timer(name, ms, fn)` | Named timer; a new one with the same name replaces the old. |
| `ctx.cancelTimer(name)` | Cancels a named timer. |
| `ctx.after(ms, fn)` | Unnamed timer; returns a cancel function. |
| `ctx.end(summary)` | Back to the lobby, showing `summary` (e.g. `"Sam won!"`). |
| `ctx.pick(list)`, `ctx.shuffle(list)` | Random helpers. |

### `host.js` and `player.js`

```js
import { html } from '../../js/ui.js';   // always relative: the website lives in a subfolder

export default function (root, api) {
  // runs once when the game starts
  return {
    update(view) {                         // runs whenever this screen's view changed
      root.innerHTML = html`
        <div class="center fill">
          <h1>${view.title}</h1>
          <button class="btn btn-xl" data-action="guess" data-payload="${JSON.stringify({ n: 3 })}">Guess 3</button>
          <span class="timer" data-deadline="${view.deadline}"></span>
        </div>`;
    },
    destroy() {},                          // optional: clean up your own timers/listeners
  };
}
```

- **`html` tag:** `html`…`` escapes everything inside `${}`. Use it for anything a player typed (names, clues).
  Never pass player text to `raw()`.
- **`data-action`:** a button with `data-action="x"` (plus optional `data-payload`) sends action `x` when tapped.
  A `<form data-action="x">` sends its fields.
- **`api.send(type, payload)`:** use it when you need the reply, e.g. `{ error }`.
- **`data-deadline`:** `<span class="timer" data-deadline="${ms}">` counts down by itself, in sync on every device.
  Put `deadline: Date.now() + 30000` in the state and back it with a `ctx.timer`.
- **`api` also has:** `you` (this phone's player), `players`, `now()` (game time), `secondsLeft(deadline)`, `vibrate(ms)`.
- **Redrawing everything** in `update()` is fine. For smooth animation, keep elements and update them in place (see `games/tap-race/host.js`).
- **On phones:** `var(--me)` is the player's color. The leader (first player) has `isVip`, so give them the
  "next round" button too, in case nobody is near the big screen's mouse.
- **Show players as their robot:** `import { avatar } from '../../js/avatar.js'`, then `${avatar(p)}` inside `html`.
  Each player has one of 12 posed robots in their color, the same on every screen. Size it with CSS
  (`.mg-thing .bot { width: 3rem; height: 3rem; }`). `avatar(p, { mood: 'happy' })` for winners; players who
  drop out doze off by themselves.

### `style.css`

- **Prefix every class** with a short code for your game (`mg-…`), like `tr-` and `ooo-` in the examples.
  Game stylesheets share the page with each other.
- **Use the shared variables and building blocks** from `public/css/base.css`, not hard-coded colors.
  - Brand colors (Iron Panthers): `--red`, `--red-hi`, `--black`, `--off-black`, `--grey`, `--white`. Don't add others;
    players' own colors (`--c`, `--me`) are the only exception.
  - Roles: `--accent`, `--text`, `--muted`, `--panel`, `--line`, `--me`, and `--c` for a player's color via `style="--c:${p.color}"`.
  - Fonts: `var(--display)` (Teko) for headings and big numbers, in title case; `var(--font)` (Roboto) for sentences.
    Use weights 400 or 300 for Teko, and 400 or 700 for Roboto.
  - Classes: `btn btn-xl btn-sm secondary block me`, `card`, `stack`, `row`, `center`, `fill`, `grid`, `muted`, `big`, `huge`, `timer`, `chip`, `pc`.
- **The game-show look** (white sticker cards, black outlines, hard shadows) is in `public/css/arena.css`, under
  `:root[data-theme="arena"]`. To match it, add the same kind of rule for your own classes; the two example
  games' `style.css` files end with their versions.
- **The big screen is read from across a room:** keep text big and bold, and put labels on a solid background
  rather than straight on the busy red.

---

## 4. Rules of the road (what breaks games)

- **Stay inside `games/<id>/`.** The only other file you should normally touch is the bots file (section 5).
  - `public/js/core`, `public/js/net` and `server/` are shared framework code that gets upstream updates.
    Changes there cause merge pain.
  - If you truly must change the messages between phone and big screen, bump `PROTOCOL` in `public/js/net/common.js`.
- **`rules.js` runs in Node and in browsers.**
  - Use only plain JavaScript modules with relative imports that include `.js` (e.g. `./words.js`).
  - **No npm packages:** there's no bundler. Copy a small ES-module library into your folder if you must.
  - **No `node:` imports**, and no `window`, `document`, `localStorage` or `fetch`.
  - **No `setTimeout` or `setInterval`:** use `ctx.timer` / `ctx.after`, which are cleaned up when a game ends or restarts.
- **Views must be plain JSON:** objects, arrays, strings, numbers, booleans, null. No Map, Set, class instances or functions.
- **Keep views small.**
  - Aim for under 4 KB. **16 KB is a hard limit:** the website can't send bigger messages, and the room logs a warning above 15 KB.
  - Send absolute state, not changes.
  - Phones get at most ~15 updates a second, the big screen ~30.
- **Secrets:**
  - Each phone receives only its own `playerView`.
  - `hostView` must not reveal secrets before the reveal.
  - If you leave out `hostView`/`playerView`, the framework sends the **whole state**, which is fine only for games with no secrets.
  - Everything in the repo is public on the website, so a determined player could read a word list. What each phone *receives* is still private.
- **Phones are untrusted:**
  - Validate every `payload`: type, length, range, and that the action is allowed in the current phase.
  - Return `{ error: '…' }` for problems the player should see.
- **Never stall on a missing player.**
  - Phones lock and drop all the time. They stay in `ctx.players` with `connected: false` and usually come back within seconds.
  - If a phase waits for "everyone", count only connected players, and re-check in `onDisconnect`. See `maybeAdvance` in `games/odd-one-out/rules.js`.
  - Always add a deadline timer as a backstop.
- **Many players:**
  - Set `maxPlayers` honestly; the room holds 32.
  - The big screen must fit **1366×768 without scrolling** at your `maxPlayers`. Use a compact layout above ~12 players (see `.many` in Odd One Out, or the two-column lanes in Tap Race).
- **Phones:**
  - Design for portrait 360–430 px wide.
  - Make tap targets at least ~48 px, and don't rely on hover.
- **Images and sounds:**
  - Put them in your game folder and reference them with `new URL('./pic.png', import.meta.url)`.
  - The laptop server serves only these file types: js, css, json, png, jpg, gif, svg, webp, mp3, ogg, wav, m4a, woff, woff2.
  - Keep them small.

---

## 5. Teach the test bots to play it

`public/js/tools/bots.js` creates fake phones (real WebRTC connections) that play by themselves. This is how you
test with 20+ players using one computer.

**Add a branch for your game in `play(bot)`**, following the Odd One Out example:

- `bot.game` is the running game's id.
- `bot.view` is that bot's `playerView`.
- `bot.socket.emit('action', { type, payload })` sends an action.
- Use the `later()` pattern to act once per phase after a short random delay.

```js
if (bot.game === 'my-game' && v?.phase === 'play' && !v.myGuess) later('guess', { n: 1 + Math.floor(Math.random() * 10) });
```

---

## 6. Test, in this order

Each step catches different problems. Don't publish until you've done 1–5. Step 6 needs a real phone.

### 1. Rules test in Node (fast; catches logic and privacy bugs)

Create `test/my-game.mjs` from this skeleton. It starts a real server, joins fake players, and plays.

```js
// node test/my-game.mjs
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const PORT = 3198;
const URL = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server/index.js', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => server.stdout.on('data', (d) => String(d).includes('Press Ctrl+C') && ok()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

function client(role) {
  const socket = io(URL, { auth: { role }, transports: ['websocket'], forceNew: true });
  const c = { socket, room: null, self: null };
  socket.on('room', (r) => (c.room = r));   // shared info: players, screen, games
  socket.on('self', (s) => (c.self = s));   // this screen's view: c.self.view
  return c;
}
const act = (p, type, payload) => p.socket.timeout(3000).emitWithAck('action', { type, payload });

const host = client('host');
const players = [client('player'), client('player'), client('player')];
await wait(300);
for (const [i, p] of players.entries()) await p.socket.timeout(3000).emitWithAck('join', { name: `P${i + 1}` });
host.socket.emit('lobby', { cmd: 'select', gameId: 'my-game' });
host.socket.emit('lobby', { cmd: 'start' });
await wait(300);
check(host.room.screen === 'game', 'game started');

// Play it: act(players[0], 'guess', { n: 3 }), then await wait(100) and check host.self.view / players[i].self.view.
// Always check:
//  - invalid payloads and out-of-phase actions are ignored or return { error }
//  - no phone's view contains another player's secret; hostView has no secrets before the reveal
//  - disconnecting a player (players[2].socket.disconnect()) doesn't stall the game
//  - JSON.stringify(view).length stays well under 16000 at maxPlayers

server.kill();
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
```

Also run `npm test`; it must still say `ALL PASSED`.

### 2. Play it yourself on the laptop server (fast to iterate)

```bash
npm run dev
```

It restarts when `rules.js` changes. For `host.js`, `player.js` and `style.css`, just reload the page.

- **Big screen:** http://localhost:3000/host
- **Players:** several tabs of http://localhost:3000. Each tab is a separate player.
- **A real phone on the same Wi-Fi** can scan the QR code.
- **Errors** show on the big screen and in the terminal.

### 3. The website version on this computer (how it will really run)

```bash
npm run site
```

Big screen: http://localhost:4000/game-night/host.html. Re-run it (or `npm run build` in another terminal)
after changes.

- **Add bots** at http://localhost:4000/game-night/tools/bots.html?room=CODE&n=20 (CODE is on the big screen), and play a full game.
- **Layout checks:**
  - Big screen at 1366×768 and 1920×1080, with 3, 12 and `maxPlayers` players: nothing cut off, no scrolling.
  - Phones at about 375×667 and 390×844.
- **Restarts and refreshes:**
  - Restart a game mid-round, and go back to the lobby and start again.
  - Refresh the big screen: the same room code comes back, and the bots return within ~10 s.
- **Disconnects:** close the bots tab mid-game. The game must not get stuck, because silent phones are marked away after 8 s.

### 4. Force the relay (phones on mobile data)

Open the big screen with `host.html?relay=1`, then with `host.html?tls=1` (relay over TLS on port 443 only, like a strict network).

- Every player's chip in the lobby must say **RELAY**, and the game must play normally.
- This needs a relay login (section 2).

### 5. Network check

Open http://localhost:4000/game-night/check.html. Every line should be green.

### 6. Real devices (after publishing, before using it for real)

- **Big screen:** the published site on the laptop.
- **Phones:** at least one on **mobile data with Wi-Fi off**, ideally one iPhone (Safari) and one Android (Chrome).
- **Lock a phone** for 10 s and for a minute mid-game: it must come back in its seat.
- **`check.html`** on each network you'll use.

**Done when:**

- `npm test` and your game's test pass.
- A full game with 20 bots works on `npm run site`, including through `?relay=1`.
- Layouts fit at 1366×768 with `maxPlayers`.
- A real phone on mobile data played it on the published site.

---

## 7. Publish to the owner's GitHub Pages

```bash
git add games/my-game public/js/tools/bots.js test/my-game.mjs
git commit -m "Add My Game"
git push
```

### First time only, on the fork

1. **👤 Owner:** turn on Actions for the fork. Forks start with workflows switched off. Open
   `https://github.com/<owner>/game-night/actions` and click **"I understand my workflows, go ahead and enable them"**.
2. **Agent:** turn on Pages, published by the workflow:

   ```bash
   gh api -X POST repos/<owner>/game-night/pages -f build_type=workflow
   ```

   (Or: Settings → Pages → Source: GitHub Actions.)
3. **Agent:** publish, and wait for it to finish:

   ```bash
   gh workflow run pages.yml
   ```

   ```bash
   gh run watch
   ```

   After that, every push to `main` publishes automatically (`.github/workflows/pages.yml` builds with `npm run build` into `dist/`).

**The site:** `https://<owner>.github.io/game-night/host.html`.

**Verify:**

- The big screen shows a room code, and its Relay button says built in (or it warns).
- `check.html` is green.
- `tools/bots.html` bots can join.
- One real phone joins.

**Notes:**

- GitHub Pages can serve the old version for up to ~10 minutes after a change. Phones that loaded it recently should reload.
- **Never publish on the day of an event.** Phones and the big screen could load different versions mid-game.

**Prefer a standalone repo instead of a fork?** Create it from the clone. You lose the easy link to updates, but Actions are on from the start:

```bash
git remote rename origin fork-unused
gh repo create <owner>/game-night --public --source . --remote origin --push
```

Then do step 2 above.

---

## 8. Optional: offer the game back to the original

Open a pull request with **only** the game commits (not the `config.js` changes from section 2):

```bash
git fetch upstream
git switch -c add-my-game upstream/main
git cherry-pick <commit(s) that added games/my-game, bots.js and the test>
git push -u origin add-my-game
gh pr create --repo IanHovander/game-night --title "Add My Game" --body "What it is, player range, how it was tested."
```

If the original owner merges it, the game also appears on his site.

## 9. Getting later updates from the original

```bash
gh repo sync <owner>/game-night
git pull
```

Alternatively: `git fetch upstream && git merge upstream/main`.

Then repeat the tests in section 6. Conflicts, if any, are usually only in `config.js` or the README:
- **Keep** the owner's `idPrefix`.
- **Take the original's `turnLogin`**, unless the owner set up their own relay. That's how a replaced shared relay login reaches every copy.

## 10. Troubleshooting

- **Game not in the lobby:**
  - The folder name must be lowercase with dashes, and the folder needs a `rules.js`.
  - Look for a syntax error in the terminal (`npm run dev`) or the browser console.
  - On the website, rebuild with `npm run build` / `npm run site`.
- **"The phone (or big screen) part of this game has a problem":** an error in `player.js` / `host.js`. Fix it and reload the page.
- **Console says "…is N KB…":** a view is too big. Send less: IDs instead of whole objects, and only what that screen shows.
- **A phone is stuck on "Looking for room…":** check the code, then open `check.html` on that phone. If anything is red, use mobile data.
- **Bots don't do anything in your game:** add the branch in `public/js/tools/bots.js` (section 5).
