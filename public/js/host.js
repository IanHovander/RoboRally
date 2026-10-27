// The big screen (laptop / TV): the lobby (the rule film, the QR code, who's here), then the game.
import { html, raw } from './ui.js';
import { mountLumenLobby, LEADER } from '../games/robo-rally/lobby.js';
import { robotSvg, svgGlyph } from '../games/robo-rally/glyphs.js';
import { sfx, unlock, onState as onSound, setMuted, state as soundState } from '../games/robo-rally/sound.js';
import { connect, createApi, GameStage, mode, onState } from './client.js';

const $ = (id) => document.getElementById(id);
let state = null;
let dismissedError = null;
const seenPlayers = new Set();
// shown beside each player whose phone comes through the relay server (information, not a control)
const RELAY_ICON = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M13 27 a8 8 0 0 1 0 -14 M27 13 a8 8 0 0 1 0 14 M17 20 H23" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
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

  $('join-mini').textContent = joinAddress(room.join);
  $('join-local').hidden = !room.join.local;
  $('join-local-text').textContent = room.join.local ?? '';

  const error = state.error;
  $('error-text').textContent = error ?? '';
  $('error').hidden = !error || error === dismissedError;

  if (inGame) stage.show(room.game, state.view, room.games);
  else {
    stage.show(null);
    renderLobby(room);
  }
}

/**
 * The address to type, for anyone who doesn't scan. On the website it has the room code in it
 * (ianhovander.github.io/RoboRally/?ABCD opens the room, like the QR code), so there's no separate code to enter.
 * On the laptop server there's no code: it's just the address.
 */
const joinAddress = (join) => (join.text ? (join.code ? `${join.text}/?${join.code}` : join.text) : '');

/** The address, big: broken before its first "/" (and a long site name before its first "."), sized to fit the column. */
let shownAddress = null;
function renderJoinLink(join) {
  const text = joinAddress(join);
  const el = $('join-link');
  if (text !== shownAddress) {
    shownAddress = text;
    if (join.url) el.href = join.url;
    else el.removeAttribute('href');
    const cut = text.indexOf('/');
    let lines = cut > 0 ? [text.slice(0, cut), text.slice(cut)] : [text];
    if (lines[0].length > 24 && lines[0].indexOf('.') > 0) {
      const dot = lines[0].indexOf('.');
      lines = [lines[0].slice(0, dot), lines[0].slice(dot), ...lines.slice(1)];
    }
    const tail = join.code ? `?${join.code}` : null;
    el.innerHTML = text
      ? String(html`${lines.map((line, i) =>
          i === lines.length - 1 && tail && line.endsWith(tail)
            ? html`<span>${line.slice(0, -join.code.length)}<b>${join.code}</b></span>`
            : html`<span>${line}</span>`)}`)
      : '';
  }
  fitJoinLink();
}

/** The address is exactly as wide as the QR card above it, so the two read as one block. */
function fitJoinLink() {
  const el = $('join-link');
  const lines = [...el.children];
  const qr = document.querySelector('.join-qr');
  if (!lines.length || !qr?.offsetWidth) return;
  el.style.fontSize = '';
  const base = parseFloat(getComputedStyle(el).fontSize);
  const widest = Math.max(...lines.map((line) => line.offsetWidth));
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const size = Math.min(4 * rem, Math.max(rem, (base * qr.offsetWidth) / widest));
  el.style.fontSize = `${size}px`;
}
addEventListener('resize', fitJoinLink);
document.fonts?.ready.then(fitJoinLink);

// Touch screens have no hover: holding the QR down shows the address; touching anywhere else hides it.
{
  const scan = $('join-scan');
  let hold = null;
  const cancel = () => clearTimeout(hold);
  scan.querySelector('.join-qr').addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    cancel();
    hold = setTimeout(() => {
      scan.classList.add('reveal');
      fitJoinLink();
    }, 400);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) scan.addEventListener(type, cancel);
  scan.addEventListener('contextmenu', (e) => e.target.closest('.join-qr') && e.preventDefault());
  document.addEventListener('pointerdown', (e) => {
    if (!scan.contains(e.target)) scan.classList.remove('reveal');
  });
}

function renderLobby(room) {
  renderJoinLink(room.join);
  const list = $('players');
  const fresh = room.players.filter((p) => !seenPlayers.has(p.id));
  list.classList.toggle('two', room.players.length > 4);
  list.innerHTML = room.players.length
    ? String(html`${room.players.map((p) => html`
        <div class="lp ${!p.connected && 'away'} ${p.isVip && 'leader'}" style="--c:${p.color}">
          <span class="lp-bot">${raw(robotSvg(p, { dim: !p.connected }))}${p.isVip && html`<span class="lp-leader" title="Leader: starts the game">${raw(LEADER)}</span>`}</span>
          <span class="lp-name">${p.name}</span>
          ${p.connected && p.link === 'relay' && html`<span class="lp-link" title="Connected through a relay server">${raw(RELAY_ICON)}</span>`}
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
