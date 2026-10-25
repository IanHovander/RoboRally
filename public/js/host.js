// The big screen (laptop / TV): lobby with QR code, then the game's host view.
import { html, raw } from './ui.js';
import { avatar } from './avatar.js';
import { mountFactoryLobby, mountLessons } from '../games/robo-rally/lobby.js';
import { connect, createApi, GameStage, mode, onState } from './client.js';

const $ = (id) => document.getElementById(id);
// the Wi-Fi sign next to an address that only works on this computer's Wi-Fi
const WIFI = '<svg class="wifi" viewBox="0 0 24 24" aria-label="Wi-Fi" role="img"><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="19.5" r="1.8" fill="currentColor"/></svg>';
let state = null;
let dismissedError = null;
const seenPlayers = new Set();
const factory = mountFactoryLobby(document.getElementById('factory-scene'));
mountLessons(document.querySelector('[data-lessons]'));

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
  button.title = relay ? 'Connection ✓' : 'Connection setup';
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
      <div class="factory-wordmark">ROBO<span>RALLY</span></div>
      <p>The big screen only opens on the computer running the game (or on its Wi-Fi).</p>
      <a class="btn btn-xl" href="./">Join as a player instead</a>
    </div>`;
});
onState(socket, (next) => {
  state = next;
  render();
});

$('start').addEventListener('click', () => lobby('start'));
// The game bar (restart, back to the lobby) is for whoever sits at the computer: it hides until the
// mouse moves or someone taps the screen, so the race has the whole screen.
let barTimer = 0;
const wakeBar = () => {
  document.body.classList.add('show-bar');
  clearTimeout(barTimer);
  barTimer = setTimeout(() => {
    if (!document.querySelector('.game-bar:hover, .game-bar :focus')) document.body.classList.remove('show-bar');
    else wakeBar();
  }, 3500);
};
for (const type of ['pointermove', 'pointerdown', 'keydown']) addEventListener(type, wakeBar, { passive: true });

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
  factory.setActive(!inGame, room.players);

  // A plain http address only works on this computer's Wi-Fi: a Wi-Fi sign says so.
  const wifiOnly = !room.join.url.startsWith('https:');
  $('join-text').innerHTML = html`${wifiOnly && raw(WIFI)}<span>${room.join.text}</span>`;
  $('join-text').classList.toggle('long', room.join.text.length > 18);
  $('join-mini').textContent = room.join.code ? `${room.join.text} · ${room.join.code}` : room.join.text;
  $('join-local').hidden = !room.join.local;
  $('join-local').innerHTML = room.join.local ? html`${raw(WIFI)}<span>${room.join.local}</span>` : '';
  $('join-code').hidden = !room.join.code;
  $('join-code').innerHTML = room.join.code ? html`<b>${room.join.code}</b>` : '';

  const error = state.error;
  $('error-text').textContent = error ?? '';
  $('error').hidden = !error || error === dismissedError;

  if (inGame) {
    stage.show(room.game, state.view, room.games);
  } else {
    stage.show(null);
    renderLobby(room);
  }
}


/** Everyone who has joined stands in a row (with empty places to fill), next to the start button. */
function renderLobby(room) {
  const online = room.players.filter((p) => p.connected).length;
  const max = room.games.find((g) => g.id === room.selectedGameId)?.maxPlayers ?? 8;
  const empty = Math.min(Math.max(1, 4 - room.players.length), max - room.players.length);
  $('players').innerHTML = html`${room.players.map((p) => {
    const isNew = !seenPlayers.has(p.id);
    seenPlayers.add(p.id);
    return html`
      <div class="crew-bot ${isNew && 'pop'} ${!p.connected && 'away'}" style="--c:${p.color}">
        ${avatar(p)}
        <b class="crew-name">${p.name}</b>
        ${p.isVip && html`<i class="crew-vip" title="Can start from their phone">★</i>`}
        <button class="chip-kick" data-kick="${p.id}" data-name="${p.name}" title="Remove ${p.name}" aria-label="Remove ${p.name}">✕</button>
      </div>`;
  })}${Array.from({ length: Math.max(0, empty) }, (_, i) => html`<div class="crew-bot empty" aria-hidden="true">${i === 0 && html`<span class="crew-phone">📱</span>`}</div>`)}`;
  const slots = room.players.length + Math.max(0, empty);
  $('players').style.setProperty('--cols', String(Math.max(8, slots)));
  $('players').classList.toggle('crowd', slots > 12); // past 12, smaller robots in several rows
  $('players').classList.toggle('still', room.players.length > 16); // a crowd of bobbing robots is too busy

  $('start').disabled = !!room.startProblem;
  // too many for one race: show the count against the limit, in red
  $('player-count').hidden = !(room.startProblem && online > max);
  $('player-count').textContent = `${online}/${max}`;
  // the last race's winner: a trophy and their robot
  const result = room.lastResult?.replace(/^[^:]+: /, '') ?? '';
  const winner = result.startsWith('🏆') ? room.players.find((p) => p.name === result.slice(2).trim()) : null;
  $('last-result').hidden = !result;
  $('last-result').innerHTML = winner ? html`🏆 ${avatar(winner, { mood: 'happy' })}<span>${winner.name}</span>` : html`${result}`;
}
