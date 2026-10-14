// The phone: join with a name, wait in the lobby, then show the game's player view.
import { html } from './ui.js';
import { connect, createApi, GameStage, onState } from './client.js';

const $ = (id) => document.getElementById(id);
const TOKEN = 'gamenight.token'; // per tab (sessionStorage), so several tabs on one laptop can be different players
const LAST_TOKEN = 'gamenight.lastToken'; // per phone (localStorage): lets a new tab take back this phone's seat
const NAME = 'gamenight.name';
const SCREENS = ['connecting', 'join', 'wait', 'game', 'notice'];
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

const store = {
  get: (area, key) => {
    try { return window[area].getItem(key); } catch { return null; }
  },
  set: (area, key, value) => {
    try { value == null ? window[area].removeItem(key) : window[area].setItem(key, value); } catch {}
  },
};

let state = null;
let notice = null; // { title, message, button } shown instead of everything else

// On every (re)connect, send our token so the server gives us our seat back.
const socket = connect((cb) => {
  const token = store.get('sessionStorage', TOKEN);
  cb(token ? { role: 'player', token, name: store.get('localStorage', NAME) } : { role: 'player' });
});
const api = createApi(socket, 'player', () => state);
const stage = new GameStage($('stage'), 'player', api);

socket.on('connect', () => ($('offline').hidden = true));
socket.on('disconnect', () => ($('offline').hidden = !!notice || !state));
socket.on('session', ({ token, name }) => {
  store.set('sessionStorage', TOKEN, token);
  store.set('localStorage', LAST_TOKEN, token);
  store.set('localStorage', NAME, name);
});
onState(socket, (next) => {
  const hadYou = !!state?.you;
  state = next;
  if (!hadYou && state.you) keepAwake();
  render();
});
socket.on('kicked', () => {
  store.set('sessionStorage', TOKEN, null);
  store.set('localStorage', LAST_TOKEN, null);
  showNotice('You were removed', 'The host took you out of the room.', 'Join again');
});
socket.on('replaced', () => {
  showNotice('Playing somewhere else', 'You opened the game in another tab or on another device, so this one stepped aside.', 'Play here instead');
});

// ---------- join ----------

$('name').value = store.get('localStorage', NAME) ?? '';
$('host-link').hidden = !isLocal;
$('join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('name').value.trim();
  if (!name) return $('name').focus();
  const button = $('join-btn');
  button.disabled = true;
  const token = store.get('localStorage', LAST_TOKEN);
  socket.timeout(8000).emit('join', { name, token }, (err, res) => {
    button.disabled = false;
    if (err) return joinError("Couldn't reach the game. Check your connection and try again.");
    if (!res?.ok) return joinError(res?.error || "Couldn't join");
    $('join-error').hidden = true;
  });
});

function joinError(message) {
  $('join-error').textContent = message;
  $('join-error').hidden = false;
}

// ---------- lobby controls for the VIP ----------

$('vip-games').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-game]');
  if (btn) socket.emit('lobby', { cmd: 'select', gameId: btn.dataset.game });
});
$('vip-start').addEventListener('click', () => socket.emit('lobby', { cmd: 'start' }));
$('menu-btn').addEventListener('click', () => ($('menu').hidden = !$('menu').hidden));
$('menu').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  $('menu').hidden = true;
  if (btn.dataset.lobby) socket.emit('lobby', { cmd: btn.dataset.lobby });
});

// ---------- notices (kicked / replaced) ----------

function showNotice(title, message, button) {
  notice = { title, message, button };
  render();
}

$('notice-btn').addEventListener('click', () => {
  notice = null;
  state = null;
  render();
  socket.connect();
});

// ---------- drawing ----------

function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
}

function render() {
  if (notice) {
    $('notice-title').textContent = notice.title;
    $('notice-msg').textContent = notice.message;
    $('notice-btn').textContent = notice.button;
    $('offline').hidden = true;
    stage.show(null);
    return show('notice');
  }
  if (!state) return show('connecting');

  const { room, you } = state;
  if (!you) {
    stage.show(null);
    return show('join');
  }

  document.documentElement.style.setProperty('--me', you.color);
  if (room.screen === 'game' && room.game && state.inGame) {
    show('game');
    $('bar-name').textContent = you.name;
    $('menu-btn').hidden = !you.isVip;
    if (!you.isVip) $('menu').hidden = true;
    stage.show(room.game, state.view, room.games);
  } else {
    stage.show(null);
    show('wait');
    renderWait(room, you);
  }
}

function renderWait(room, you) {
  const inLobby = room.screen === 'lobby';
  $('wait-name').textContent = you.name;
  $('wait-title').textContent = inLobby ? "You're in!" : 'Game in progress';
  $('wait-msg').textContent = inLobby
    ? you.isVip
      ? ''
      : 'Watch the big screen. The game will start soon.'
    : "You'll be in the next one. Watch the big screen!";

  const vip = inLobby && you.isVip;
  $('vip').hidden = !vip;
  if (vip) {
    $('vip-games').innerHTML = html`${room.games.map(
      (g) => html`<button class="vip-game ${g.id === room.selectedGameId && 'selected'}" data-game="${g.id}">${g.name}</button>`,
    )}`;
    $('vip-start').disabled = !!room.startProblem;
    $('vip-problem').textContent = room.startProblem ?? '';
  }

  $('wait-players').innerHTML = html`${room.players.map(
    (p) => html`
      <div class="chip ${!p.connected && 'away'}" style="--c:${p.color}">
        <span class="chip-dot"></span><span class="chip-name">${p.name}</span>
        ${p.isVip && html`<span class="chip-vip">★</span>`}
      </div>`,
  )}`;
}

// ---------- keep the screen on (only works over https or localhost) ----------

async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen');
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state?.you) keepAwake();
});
