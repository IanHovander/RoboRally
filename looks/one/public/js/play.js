// The phone: a name, then your robot under a warm light (swipe or tap the arrows to change it), then the game.
// Shared information lives on the big screen; the phone shows only what's yours.
import { AVATAR_FOR_MODEL, MODEL_ORDER, modelOf, paint, portrait } from '../games/robo-rally/look.js';
import { connect, createApi, GameStage, mode, onState } from './client.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['connecting', 'code', 'join', 'wait', 'game', 'notice'];
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

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
  showNotice('Removed', 'The big screen took you out of the room.', 'Join again');
});
socket.on('replaced', () => {
  showNotice('Playing elsewhere', 'This game opened in another tab or on another phone.', 'Play here');
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
    if (err) return joinError("Couldn't reach the game. Check your connection.");
    if (!res?.ok) return joinError(res?.error || "Couldn't join");
    $('join-error').hidden = true;
  });
});

function joinError(message) {
  $('join-error').textContent = message;
  $('join-error').hidden = false;
}

// ---------- your robot ----------

let pendingModel = null;
function chooseModel(step) {
  const you = state?.you;
  if (!you || state.room.screen !== 'lobby') return;
  const cur = pendingModel ?? modelOf(you);
  const i = MODEL_ORDER.indexOf(cur);
  const next = MODEL_ORDER[(i + step + MODEL_ORDER.length) % MODEL_ORDER.length];
  pendingModel = next;
  renderMe(you);
  try { navigator.vibrate?.(8); } catch {}
  socket.timeout(8000).emit('avatar', { avatar: AVATAR_FOR_MODEL[next] }, () => {
    pendingModel = null;
    if (state?.you) renderMe(state.you);
  });
}
$('robot-prev').addEventListener('click', () => chooseModel(-1));
$('robot-next').addEventListener('click', () => chooseModel(1));
$('me-robot').addEventListener('click', () => chooseModel(1));
// swipe the robot sideways to change it
let touchX = null;
$('wait').addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
$('wait').addEventListener('touchend', (e) => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) chooseModel(dx < 0 ? 1 : -1);
});

function renderMe(you) {
  const model = pendingModel ?? modelOf(you);
  const key = `${model}|${you.color}`;
  const box = $('me-robot');
  if (box.dataset.key !== key) {
    box.dataset.key = key;
    box.innerHTML = portrait(you, { model });
    box.firstElementChild.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }
  $('me-dots').innerHTML = MODEL_ORDER.map((m) => `<i class="${m === model ? 'on' : ''}"></i>`).join('');
}

// ---------- lobby controls for the leader ----------

$('vip-start').addEventListener('click', () => socket.emit('lobby', { cmd: 'start' }));
$('menu-btn').addEventListener('click', () => ($('menu').hidden = !$('menu').hidden));
// restart / end need a second tap (the button lights up first), so a stray thumb can't end the race
let armed = null;
$('menu').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.lobby && armed !== btn) {
    armed?.classList.remove('armed');
    armed = btn;
    btn.classList.add('armed');
    try { navigator.vibrate?.(15); } catch {}
    clearTimeout(armed.t);
    btn.t = setTimeout(() => { btn.classList.remove('armed'); if (armed === btn) armed = null; }, 3000);
    return;
  }
  armed?.classList.remove('armed');
  armed = null;
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

  document.documentElement.style.setProperty('--me', paint(you.color));
  if (room.screen === 'game' && room.game && state.inGame) {
    show('game');
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
  renderMe(you);
  $('me-name').textContent = you.name;
  $('robot-prev').hidden = $('robot-next').hidden = !inLobby;
  $('me-dots').hidden = !inLobby;
  const vip = inLobby && you.isVip;
  $('vip-start').hidden = !vip;
  if (vip) $('vip-start').disabled = !!room.startProblem;
  $('wait-pulse').hidden = vip || !inLobby;
  $('look-up').hidden = inLobby; // a game is on without you: watch the big screen
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

