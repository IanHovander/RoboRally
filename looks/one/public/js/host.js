// The big screen (laptop / TV): the lobby (the hall, the trailer, the join ticket, the cast), then the game.
import { html, raw } from './ui.js';
import { paint, portrait } from '../games/robo-rally/look.js';
import { mountLobby } from '../games/robo-rally/lobby.js';
import * as audio from '../games/robo-rally/audio.js';
import { connect, createApi, GameStage, mode, onState } from './client.js';

const $ = (id) => document.getElementById(id);
const TROPHY = '<svg class="tr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6"/></svg>';
let state = null;
let dismissedError = null;
const seenPlayers = new Set();
const lobbyScene = mountLobby($('factory-scene'), $('lesson'));

// ---------- sound: needs one click or key press; the speaker buttons show where it stands ----------
const SPEAKER = {
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
};
audio.onChange((s) => {
  for (const b of document.querySelectorAll('[data-sound]')) {
    b.innerHTML = s === 'on' ? SPEAKER.on : SPEAKER.off;
    b.classList.toggle('off', s === 'blocked');
  }
});
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-sound]')) audio.toggle();
  else audio.unlock();
});
document.addEventListener('keydown', () => audio.unlock());

// double-click anywhere: full screen (and back)
document.addEventListener('dblclick', (e) => {
  if (e.target.closest('button, input, dialog')) return;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});

// the host's mouse brings up the small menu (restart, back to the lobby); it fades when the mouse rests
let mouseTimer;
document.addEventListener('mousemove', () => {
  document.body.classList.add('mouse');
  clearTimeout(mouseTimer);
  mouseTimer = setTimeout(() => document.body.classList.remove('mouse'), 2600);
});

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
      <div class="ll-mark"><b>Robo</b> Rally</div>
      <p>The big screen only opens on the computer running the game (or on its Wi-Fi).</p>
      <a href="./">Join as a player instead</a>
    </div>`;
});
onState(socket, (next) => {
  state = next;
  render();
});

$('start').addEventListener('click', () => lobby('start'));
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
  lobbyScene.setActive(!inGame, room.players);

  const text = room.join.text;
  $('join-text').textContent = text;
  $('join-text').classList.toggle('long', text.length > 24);
  $('join-local').hidden = !room.join.local;
  $('join-local-text').textContent = room.join.local ?? '';
  $('join-code').hidden = !room.join.code;
  $('join-code').textContent = room.join.code ?? '';

  const error = state.error;
  $('error-text').textContent = error ?? '';
  $('error').hidden = !error || error === dismissedError;

  if (inGame) stage.show(room.game, state.view, room.games);
  else {
    stage.show(null);
    renderLobby(room);
  }
}

function renderLobby(room) {
  const cast = $('players');
  cast.classList.toggle('many', room.players.length > 5);
  cast.innerHTML = room.players.length
    ? html`${room.players.map((p) => {
        const isNew = !seenPlayers.has(p.id);
        seenPlayers.add(p.id);
        return html`
          <div class="ll-plate ${isNew && 'pop'} ${!p.connected && 'away'}" style="--c:${paint(p.color)}">
            ${raw(portrait(p, { cls: p.connected ? '' : 'away' }))}
            <span class="nm">${p.name}</span>
            <button class="kick" data-kick="${p.id}" data-name="${p.name}" title="Remove ${p.name}"></button>
          </div>`;
      })}`
    : html`<div class="ll-cast-empty"><i></i><i></i><i></i></div>`;
  $('start').disabled = !!room.startProblem;
  // the last race's winner, as a small caption in the corner of the frame
  const won = /:\s*(.+) won the race!$/.exec(room.lastResult ?? '');
  const winner = won && room.players.find((p) => p.name === won[1]);
  $('last-result').hidden = !winner;
  const key = winner ? `${winner.id}|${winner.color}|${winner.avatar}` : '';
  if ($('last-result').dataset.key !== key) {
    $('last-result').dataset.key = key;
    $('last-result').innerHTML = winner ? html`${raw(portrait(winner))}<span class="nm">${winner.name}</span>${raw(TROPHY)}` : '';
  }
}
