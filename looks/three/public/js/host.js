// The big screen (laptop / TV): the lobby (the rule film, the QR code, who's here), then the game.
import { html, raw } from './ui.js';
import { mountLumenLobby } from '../games/robo-rally/lobby.js';
import { robotSvg, svgGlyph } from '../games/robo-rally/glyphs.js';
import { sfx, unlock, onState as onSound, setMuted, state as soundState } from '../games/robo-rally/sound.js';
import { connect, createApi, GameStage, mode, onState } from './client.js';

const $ = (id) => document.getElementById(id);
let state = null;
let dismissedError = null;
const seenPlayers = new Set();
const film = mountLumenLobby($('lesson-stage'), $('lesson-ui'));

// Sound needs one click or key press on this page (browsers' rule).
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => unlock());
// The lobby's sound button: amber and breathing until sound is on (one click turns it on).
onSound((st) => {
  $('sound-btn').innerHTML = String(raw(svgGlyph(st === 'on' ? 'sound' : 'mute')));
  $('sound-btn').classList.toggle('warn', st !== 'on');
});
$('sound-btn').addEventListener('pointerdown', (e) => e.stopPropagation()); // this button decides for itself
$('sound-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const st = soundState();
  if (st === 'locked') unlock();
  else setMuted(st === 'on');
});
// The game's small menu shows while the mouse moves.
let pointerTimer = 0;
window.addEventListener('pointermove', () => {
  document.body.classList.add('pointer');
  clearTimeout(pointerTimer);
  pointerTimer = setTimeout(() => document.body.classList.remove('pointer'), 2500);
});

/** The band at the top: a problem with the connection (null hides it). */
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
  button.classList.toggle('warn', !relay);
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
      <div class="wordmark">Robo Rally</div>
      <p>The big screen only opens on the computer running the game (or on its Wi-Fi).</p>
      <a class="btn primary" href="./">Join as a player</a>
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
  film.setActive(!inGame, room.players);

  $('join-text').textContent = room.join.code ? room.join.text : room.join.text;
  $('join-mini').textContent = room.join.code ?? room.join.text;
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
  const list = $('players');
  const fresh = room.players.filter((p) => !seenPlayers.has(p.id));
  list.classList.toggle('two', room.players.length > 4);
  list.innerHTML = room.players.length
    ? String(html`${room.players.map((p) => html`
        <div class="lp ${!p.connected && 'away'}" style="--c:${p.color}">
          ${raw(robotSvg(p, { dim: !p.connected }))}
          <span class="lp-name">${p.name}</span>
          ${p.connected && p.link === 'relay' && html`<span class="lp-link" title="Connected through a relay server">relay</span>`}
          <button class="lp-kick" data-kick="${p.id}" data-name="${p.name}" title="Remove ${p.name}">✕</button>
        </div>`)}`)
    : '<div class="lobby-empty"><i></i><i></i><i></i></div>';
  // only new arrivals slide in
  for (const el of list.querySelectorAll('.lp')) {
    const id = el.querySelector('[data-kick]')?.dataset.kick;
    if (seenPlayers.has(id)) el.style.animation = 'none';
  }
  for (const p of fresh) {
    seenPlayers.add(p.id);
    sfx.join(room.players.indexOf(p));
  }
  $('start').disabled = !!room.startProblem;
  $('start').title = room.startProblem ?? 'Start';
  // the last race's winner, if any ("Robo Rally: Sam won the race!")
  const name = /: (.+) won the race!$/.exec(room.lastResult ?? '')?.[1];
  const winner = name && room.players.find((p) => p.name === name);
  $('last-result').hidden = !winner;
  $('last-result').innerHTML = winner ? String(html`${raw(svgGlyph('flag'))}${raw(robotSvg(winner))}<span>${winner.name}</span>`) : '';
}
