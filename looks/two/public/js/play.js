// The phone: join with a name, wait in the lobby with your robot (flip through the robots with the
// arrows), then the game's player view. The leader's start button sits at the bottom, grey until a
// race can start.
import { html } from './ui.js';
import { avatar, design, ROBOTS } from './avatar.js';
import { glyph } from '../games/robo-rally/glyphs.js';
import { connect, createApi, GameStage, mode, onState } from './client.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['connecting', 'code', 'join', 'wait', 'game', 'notice'];
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

// pictures on the buttons
for (const b of document.querySelectorAll('#code-form .btn, #join-btn')) b.innerHTML = glyph('next');
$('vip-start').innerHTML = glyph('play');
$('robot-prev').innerHTML = glyph('back');
$('robot-next').innerHTML = glyph('next');
$('menu-btn').innerHTML = glyph('dots');
for (const [sel, g] of [['[data-lobby="restart"]', 'restart'], ['[data-lobby="end"]', 'home'], ['#menu .ghost', 'cross']]) document.querySelector(sel).innerHTML = glyph(g);

// On the website, which room (big screen) to join: ?room=ABCD from the QR code, or typed in.
const ROOM = mode === 'browser' ? roomCodeFrom(new URLSearchParams(location.search).get('room')) : null;
if (mode === 'browser' && !ROOM) {
  askForRoomCode(); // submitting it reloads this page with ?room=CODE
  await new Promise(() => {}); // nothing else to do until then
}

const scope = ROOM ? `.${ROOM}` : '';
const TOKEN = `gamenight.token${scope}`; // per tab (sessionStorage), so several tabs on one laptop can be different players
const LAST_TOKEN = `gamenight.lastToken${scope}`; // per phone (localStorage): lets a new tab take back this phone's seat
const NAME = 'gamenight.name';

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

// On every (re)connect, send our token so the game gives us our seat back.
const socket = await connect(
  (cb) => {
    const token = store.get('sessionStorage', TOKEN);
    cb(token ? { role: 'player', token, name: store.get('localStorage', NAME) } : { role: 'player' });
  },
  { room: ROOM },
);
const api = createApi(socket, 'player', () => state);
const stage = new GameStage($('stage'), 'player', api);

socket.on('connect', () => ($('offline').hidden = true));
socket.on('disconnect', () => ($('offline').hidden = !!notice || !state));
// Website: what the connection is up to ("Looking for room ABCD…") while we wait.
socket.on('status', (text) => ($('connecting-msg').textContent = text ?? ''));
$('change-room').hidden = !ROOM;
$('check-link').hidden = !ROOM;
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

// a few robots say hello over the name box
const PARADE = [['#4dabf7', 2], ['#ffd43b', 0], ['#ff922b', 6], ['#51cf66', 7], ['#cc5de8', 11]]; // [color, pose]
const parade = html`<div class="bot-parade">${PARADE.map(([color, pose], i) => avatar({ id: `hello${i}`, color }, { pose }))}</div>`;
$('join-form').insertAdjacentHTML('beforebegin', String(parade));

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

// ---------- choosing a robot (in the lobby) ----------

let pendingRobot = null; // the robot we asked for, shown right away while the room confirms
function chooseRobot(step) {
  const you = state?.you;
  if (!you || state.room.screen !== 'lobby') return;
  const now = pendingRobot ?? design(you);
  const next = (now + step + ROBOTS.length) % ROBOTS.length;
  pendingRobot = next;
  drawRobot(true);
  try { navigator.vibrate?.(8); } catch {}
  socket.timeout(8000).emit('avatar', { avatar: next }, () => {
    if (pendingRobot === next) pendingRobot = null;
    drawRobot(false);
  });
}
$('robot-prev').addEventListener('click', () => chooseRobot(-1));
$('robot-next').addEventListener('click', () => chooseRobot(1));
// a swipe on the robot flips it too
let swipeX = null;
$('wait-robot').addEventListener('pointerdown', (e) => (swipeX = e.clientX));
$('wait-robot').addEventListener('pointerup', (e) => {
  if (swipeX != null && Math.abs(e.clientX - swipeX) > 40) chooseRobot(e.clientX < swipeX ? 1 : -1);
  swipeX = null;
});

function drawRobot(swap) {
  const you = state?.you;
  if (!you) return;
  const pose = pendingRobot ?? design(you);
  const box = $('wait-robot');
  const svg = String(avatar(you, { pose }));
  if (box.dataset.svg !== svg) {
    box.dataset.svg = svg;
    box.innerHTML = svg;
    if (swap) {
      box.classList.remove('swap');
      void box.offsetWidth;
      box.classList.add('swap');
    }
  }
}

// ---------- lobby controls for the leader ----------

$('vip-start').addEventListener('click', () => socket.emit('lobby', { cmd: 'start' }));
$('menu-btn').addEventListener('click', () => ($('menu').hidden = !$('menu').hidden));
$('menu').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  $('menu').hidden = true;
  if (btn.dataset.lobby) socket.emit('lobby', { cmd: btn.dataset.lobby });
});

// ---------- room code (website only) ----------

function roomCodeFrom(text) {
  const code = String(text ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  return code.length === 4 ? code : null;
}

function askForRoomCode() {
  show('code');
  $('room-code').focus();
  $('code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = roomCodeFrom($('room-code').value);
    if (!code) return $('room-code').select();
    location.search = `?room=${code}`;
  });
}

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
  const robot = String(avatar(you));
  for (const dot of document.querySelectorAll('.me-dot')) {
    if (dot.dataset.robot !== robot) dot.innerHTML = dot.dataset.robot = robot; // only when it changes, so it keeps bobbing
  }
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
  if (pendingRobot === design(you)) pendingRobot = null;
  drawRobot(false);
  $('wait-name').textContent = you.name;
  $('robot-prev').hidden = $('robot-next').hidden = !inLobby;
  // a race already running: you're in the next one; watch it on the big screen
  $('wait-msg').hidden = inLobby;
  $('wait-msg').innerHTML = inLobby ? '' : glyph('eye');
  const vip = inLobby && you.isVip;
  $('vip-start').hidden = !vip;
  if (vip) $('vip-start').disabled = !!room.startProblem;
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
