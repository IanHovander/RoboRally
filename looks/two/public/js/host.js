// The big screen (laptop / TV): the lobby (the pop-up lesson, the join ticket, robots popping up as
// people join), then the game's host view.
import { html, raw } from './ui.js';
import { avatar } from './avatar.js';
import { mountLobby } from '../games/robo-rally/lobby.js';
import { glyph } from '../games/robo-rally/glyphs.js';
import { music, sfx, soundState, setMuted, onSoundChange } from '../games/robo-rally/sound.js';
import { connect, createApi, GameStage, mode, onState } from './client.js';

const $ = (id) => document.getElementById(id);
let state = null;
let dismissedError = null;
const seenPlayers = new Set();
let lobbyShown = false;
const lobbyScene = mountLobby($('factory-scene'), document.querySelector('[data-lessons]'));

/** The paper tab at the top: a problem with the connection (null hides it). */
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
  socket.on('disconnect', () => banner('Reconnecting…'));
} else {
  setUpRelayButton();
}

// ---------- the little buttons in the corner ----------

$('start').innerHTML = glyph('play');
$('crew-btn').innerHTML = glyph('dots');
$('relay-btn').innerHTML = glyph('scan');
for (const b of document.querySelectorAll('[data-lobby="restart"]')) b.innerHTML = glyph('restart');
for (const b of document.querySelectorAll('[data-lobby="end"]')) b.innerHTML = glyph('home');
function showSound() {
  const s = soundState();
  for (const b of document.querySelectorAll('[data-sound]')) {
    b.innerHTML = glyph(s === 'off' ? 'soundOff' : 'soundOn');
    b.classList.toggle('waiting', s === 'waiting');
  }
}
onSoundChange(showSound);
showSound();
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sound]');
  if (!b) return;
  // the first click only wakes sound up; after that the button turns it off and on
  if (soundState() !== 'waiting') setMuted(soundState() !== 'off');
});
$('crew-btn').addEventListener('click', () => ($('crew').hidden = !$('crew').hidden));

/** Website only: the relay login is built in (config.js); this button lets one computer use another one. */
async function setUpRelayButton() {
  const { saveRelay, forgetRelay } = await import('./net/relay.js');
  const button = $('relay-btn');
  const dialog = $('relay-dialog');
  button.hidden = false;
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
      <div class="wordmark">Robo<span>Rally</span></div>
      <p>The big screen only opens on the computer running the game (or on its Wi-Fi).</p>
      <a class="btn btn-xl" href="./">Join as a player instead</a>
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
    const question = btn.dataset.lobby === 'end' ? 'End this race and go back to the lobby?' : 'Start this race over?';
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

  const code = room.join.code;
  $('join-code').hidden = !code;
  const letters = code ? [...code].map((ch) => html`<b>${ch}</b>`) : [];
  const codeHtml = String(html`${letters}`);
  if ($('join-code').dataset.code !== codeHtml) {
    $('join-code').dataset.code = codeHtml;
    $('join-code').innerHTML = codeHtml;
  }
  $('join-text').textContent = room.join.text;
  $('join-text').classList.toggle('long', room.join.text.length > 24);
  $('join-local').hidden = !room.join.local;
  $('join-local-text').textContent = room.join.local ?? '';

  const error = state.error;
  $('error-text').textContent = error ?? '';
  $('error').hidden = !error || error === dismissedError;

  if (inGame) {
    stage.show(room.game, state.view, room.games);
  } else {
    stage.show(null); // (ends the race's own music)
    music('lobby');
    renderLobby(room);
  }
}

function renderLobby(room) {
  const online = room.players.filter((p) => p.connected).length;
  let i = 0;
  $('players').innerHTML = room.players.length
    ? html`${room.players.map((p) => {
        if (!seenPlayers.has(p.id)) {
          seenPlayers.add(p.id);
          if (lobbyShown) sfx.join(i++); // a little pop for each new arrival (not for everyone already here)
        }
        return html`
          <div class="chip ${!p.connected && 'away'}" style="--c:${p.color}">
            ${avatar(p)}<span class="chip-name">${p.name}</span>
            ${p.connected && p.link === 'relay' && html`<span class="chip-link">relay</span>`}
            <button class="chip-kick" data-kick="${p.id}" data-name="${p.name}" aria-label="Remove ${p.name}">${raw(glyph('cross'))}</button>
          </div>`;
      })}`
    : '';
  lobbyShown = true;
  $('crew-btn').hidden = !room.players.length;
  if (!room.players.length) $('crew').hidden = true;

  $('start').disabled = !!room.startProblem;
  $('start').classList.toggle('live', !room.startProblem);
  $('start-problem').hidden = online > 0;
  $('start-problem').innerHTML = online ? '' : glyph('phone');

  // "Ada won the race!" -> the winner's robot and a trophy
  const result = room.lastResult ?? '';
  const winnerName = result.replace(/ won the race!?$/, '');
  const winner = result !== winnerName ? room.players.find((p) => p.name === winnerName) : null;
  $('last-result').hidden = !winner;
  $('last-result').innerHTML = winner ? String(html`${raw(glyph('trophy'))}${avatar({ ...winner, connected: true }, { mood: 'happy' })}<b>${winner.name}</b>`) : '';
}
