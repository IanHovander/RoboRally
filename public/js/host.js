// The big screen (laptop / TV): lobby with QR code, then the game's host view.
import { html } from './ui.js';
import { avatar } from './avatar.js';
import { connect, createApi, GameStage, mode, onState } from './client.js';

const $ = (id) => document.getElementById(id);
let state = null;
let dismissedError = null;
const seenPlayers = new Set();

/** The red bar at the top: a problem with the connection (null hides it). */
function banner(text) {
  $('offline').textContent = text ?? '';
  $('offline').hidden = !text;
}

// On the laptop server, this page connects to it. On the website, this page IS the server:
// the game runs right here and phones connect to it over WebRTC.
const socket =
  mode === 'server'
    ? await connect({ role: 'host' })
    : await import('./net/peer-host.js').then(({ hostInBrowser }) => hostInBrowser({ onStatus: banner }));
const api = createApi(socket, 'host', () => state);
const stage = new GameStage($('stage'), 'host', api);
const lobby = (cmd, extra) => socket.emit('lobby', { cmd, ...extra });

if (mode === 'server') {
  socket.on('connect', () => banner(null));
  socket.on('disconnect', () => banner('Lost connection to the game server. Reconnecting…'));
} else {
  setUpRelayButton();
}

/** Website only: the relay login is built in (config.js); this button lets one computer use another one. */
async function setUpRelayButton() {
  const { getRelay, saveRelay, forgetRelay } = await import('./net/relay.js');
  const relay = getRelay();
  const button = $('relay-btn');
  const dialog = $('relay-dialog');
  button.hidden = false;
  button.textContent = relay ? (relay.builtIn ? 'Relay: built in ✓' : 'Relay: own login ✓') : 'Relay: not set up';
  button.addEventListener('click', () => {
    $('relay-user').value = '';
    $('relay-pass').value = '';
    dialog.showModal();
  });
  dialog.addEventListener('close', () => {
    const user = $('relay-user').value.trim();
    const pass = $('relay-pass').value.trim();
    $('relay-pass').value = '';
    if (dialog.returnValue === 'save' && user && pass) saveRelay(user, pass);
    else if (dialog.returnValue === 'forget') forgetRelay();
    else return;
    location.reload(); // connections are set up when the page loads
  });
}
socket.on('join-info', (join) => ($('qr').src = join.qr));
socket.on('host-denied', () => {
  document.body.innerHTML = html`
    <div class="denied">
      <div class="logo">Game <span>Night</span></div>
      <p>The big screen only opens on the computer running the game (or on its Wi-Fi).</p>
      <a class="btn btn-xl" href="./">Join as a player instead</a>
    </div>`;
});
onState(socket, (next) => {
  state = next;
  render();
});

$('start').addEventListener('click', () => lobby('start'));
$('games').addEventListener('click', (e) => {
  const card = e.target.closest('[data-game]');
  if (card) lobby('select', { gameId: card.dataset.game });
});
$('players').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-kick]');
  if (btn && confirm(`Remove ${btn.dataset.name} from the room?`)) lobby('kick', { playerId: btn.dataset.kick });
});
for (const btn of document.querySelectorAll('[data-lobby]')) {
  btn.addEventListener('click', () => {
    const question = btn.dataset.lobby === 'end' ? 'End this game and go back to the lobby?' : 'Start this game over?';
    if (confirm(question)) lobby(btn.dataset.lobby);
  });
}
$('error-close').addEventListener('click', () => {
  dismissedError = state?.error;
  $('error').hidden = true;
});

function render() {
  const { room } = state;
  const inGame = room.screen === 'game' && !!room.game;
  $('lobby').hidden = inGame;
  $('game').hidden = !inGame;

  $('join-text').textContent = room.join.text;
  $('join-text').classList.toggle('long', room.join.text.length > 24);
  $('join-mini').textContent = room.join.code ? `${room.join.text} · code ${room.join.code}` : room.join.text;
  $('join-hint').textContent = room.join.url.startsWith('https:')
    ? 'Works from anywhere with internet'
    : 'Phones need to be on the same Wi-Fi as this computer';
  $('join-local').hidden = !room.join.local;
  $('join-local-text').textContent = room.join.local ?? '';
  $('join-code').hidden = !room.join.code;
  $('join-code').innerHTML = room.join.code ? html`<span>Room code</span><b>${room.join.code}</b>` : '';

  const error = state.error;
  $('error-text').textContent = error ?? '';
  $('error').hidden = !error || error === dismissedError;

  if (inGame) {
    $('game-title').textContent = room.game.name;
    stage.show(room.game, state.view, room.games);
  } else {
    stage.show(null);
    renderLobby(room);
  }
}

function renderLobby(room) {
  const online = room.players.filter((p) => p.connected).length;
  $('player-count').textContent = room.players.length ? `${online}` : '';
  $('players').innerHTML = room.players.length
    ? html`${room.players.map((p) => {
        const isNew = !seenPlayers.has(p.id);
        seenPlayers.add(p.id);
        return html`
          <div class="chip ${isNew && 'pop'} ${!p.connected && 'away'}" style="--c:${p.color}">
            ${avatar(p)}
            <span class="chip-name">${p.name}</span>
            ${p.isVip && html`<span class="chip-vip" title="First to join: can start games from their phone">★</span>`}
            ${!p.connected && html`<span class="chip-away">away</span>`}
            ${p.connected && p.link && html`<span class="chip-link ${p.link}" title="${p.link === 'relay' ? 'Connected through a relay server' : 'Connected directly'}">${p.link}</span>`}
            <button class="chip-kick" data-kick="${p.id}" data-name="${p.name}" title="Remove ${p.name}">✕</button>
          </div>`;
      })}`
    : html`<div class="empty">Waiting for players. Scan the code to join!</div>`;
  $('players').classList.toggle('still', room.players.length > 16); // a crowd of bobbing robots is too busy

  $('games').innerHTML = html`${room.games.map(
    (g) => html`
      <button class="game-card ${g.id === room.selectedGameId && 'selected'}" data-game="${g.id}">
        <span class="game-name">${g.name}</span>
        <span class="game-desc">${g.description}</span>
        <span class="game-meta">${playerRange(g)}</span>
      </button>`,
  )}`;

  $('start').disabled = !!room.startProblem;
  $('start-problem').textContent = room.startProblem ?? '';
  $('last-result').hidden = !room.lastResult;
  $('last-result').textContent = room.lastResult ?? '';
}

function playerRange(g) {
  if (g.minPlayers === g.maxPlayers) return `${g.minPlayers} players`;
  return g.maxPlayers >= 32 ? `${g.minPlayers}+ players` : `${g.minPlayers}–${g.maxPlayers} players`;
}
