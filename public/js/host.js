// The big screen (laptop / TV): lobby with QR code, then the game's host view.
import { html } from './ui.js';
import { connect, createApi, GameStage, onState } from './client.js';

const $ = (id) => document.getElementById(id);
let state = null;
let dismissedError = null;
const seenPlayers = new Set();

const socket = connect({ role: 'host' });
const api = createApi(socket, 'host', () => state);
const stage = new GameStage($('stage'), 'host', api);
const lobby = (cmd, extra) => socket.emit('lobby', { cmd, ...extra });

socket.on('connect', () => ($('offline').hidden = true));
socket.on('disconnect', () => ($('offline').hidden = false));
socket.on('join-info', (join) => ($('qr').src = join.qr));
socket.on('host-denied', () => {
  document.body.innerHTML = html`
    <div class="denied">
      <div class="logo">Game <span>Night</span></div>
      <p>The big screen only opens on the computer running the game (or on its Wi-Fi).</p>
      <a class="btn btn-xl" href="/">Join as a player instead</a>
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
  $('join-mini').textContent = room.join.text;
  $('join-hint').textContent = room.join.url.startsWith('https:')
    ? 'Works from anywhere with internet'
    : 'Phones need to be on the same Wi-Fi as this computer';
  $('join-local').hidden = !room.join.local;
  $('join-local-text').textContent = room.join.local ?? '';

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
            <span class="chip-dot"></span>
            <span class="chip-name">${p.name}</span>
            ${p.isVip && html`<span class="chip-vip" title="First to join: can start games from their phone">★</span>`}
            ${!p.connected && html`<span class="chip-away">away</span>`}
            <button class="chip-kick" data-kick="${p.id}" data-name="${p.name}" title="Remove ${p.name}">✕</button>
          </div>`;
      })}`
    : html`<div class="empty">Waiting for players. Scan the code to join!</div>`;

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
  return g.maxPlayers >= 24 ? `${g.minPlayers}+ players` : `${g.minPlayers}–${g.maxPlayers} players`;
}
