// The phone: join with a name, wait in the lobby (tap your robot to change its form), then the game.
import { html, raw } from './ui.js';
import { robotSvg, formOf, FORMS, svgGlyph } from '../games/robo-rally/glyphs.js';
import { connect, createApi, GameStage, mode, onState } from './client.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['connecting', 'code', 'join', 'wait', 'game', 'notice'];
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

// On the website, which room (big screen) to join: from the address (?room=ABCD from the QR code, or the
// short ?ABCD the big screen shows under it), or typed in.
const ROOM = mode === 'browser' ? roomFromAddress() : null;
if (mode === 'browser' && !ROOM) {
  askForRoomCode(); // submitting it reloads this page with ?CODE
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
  showNotice('Playing elsewhere', 'You opened the game in another tab or on another device.', 'Play here');
});

// ---------- join ----------

$('name').value = store.get('localStorage', NAME) ?? '';
$('host-link').hidden = !isLocal;
// a robot of light waiting for a name: it takes your color once you're in
$('join-robot').innerHTML = robotSvg({ color: '#f4efe4', avatar: 0 }, { dim: true });
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

// ---------- the lobby: your robot ----------

let pendingForm = null;
$('me-robot').addEventListener('click', () => {
  const you = state?.you;
  if (!you || state.room.screen !== 'lobby') return;
  const next = ((pendingForm ?? formOf(you)) + 1) % FORMS.length;
  pendingForm = next;
  renderWait(state.room, { ...you, avatar: next });
  try { navigator.vibrate?.(8); } catch {}
  socket.timeout(8000).emit('avatar', { avatar: next }, () => {
    if (pendingForm === next) pendingForm = null;
  });
});

$('vip-start').addEventListener('click', () => socket.emit('lobby', { cmd: 'start' }));
// "?" on the waiting screen: the game's Book of rules, as little clips
$('ask-btn').innerHTML = svgGlyph('ask');
$('ask-btn').addEventListener('click', () => import('../games/robo-rally/guide.js').then((m) => m.openBook({ context: 'lobby', color: state?.you?.color, you: state?.you })));
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

/** ?room=ABCD, or just ?ABCD (any case; a stray "/" or space is fine). */
function roomFromAddress() {
  const params = new URLSearchParams(location.search);
  if (params.has('room')) return roomCodeFrom(params.get('room'));
  for (const [key, value] of params) if (!value && roomCodeFrom(key)) return roomCodeFrom(key);
  return null;
}

function askForRoomCode() {
  show('code');
  // The big screen shows this site's address with the code at its end; so does this screen, with the
  // code's place left open for typing.
  const site = new URL('./', location.href);
  const address = (site.host + site.pathname).replace(/\/$/, '');
  const cut = address.indexOf('/');
  $('code-site').textContent = cut > 0 ? address.slice(0, cut) : address;
  $('code-path').textContent = `${cut > 0 ? address.slice(cut) : ''}/?`;
  $('room-code').focus();
  $('code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = roomCodeFrom($('room-code').value);
    if (!code) return $('room-code').select();
    location.search = `?${code}`;
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
  if (room.screen === 'game' && room.game && state.inGame) {
    show('game');
    $('menu-btn').hidden = !you.isVip;
    if (!you.isVip) $('menu').hidden = true;
    stage.show(room.game, state.view, room.games);
  } else {
    stage.show(null);
    show('wait');
    if (pendingForm != null && formOf(you) === pendingForm) pendingForm = null;
    renderWait(room, pendingForm != null ? { ...you, avatar: pendingForm } : you);
  }
}

let shownRobot = '';
let shownLeader = '';
function renderWait(room, you) {
  const inLobby = room.screen === 'lobby';
  const robot = robotSvg(you, { cls: 'big' });
  if (robot !== shownRobot) {
    shownRobot = robot;
    $('me-robot').innerHTML = robot;
    $('me-robot').classList.remove('swap');
    void $('me-robot').offsetWidth; // restart the little turn animation
    $('me-robot').classList.add('swap');
  }
  $('me-robot').disabled = !inLobby;
  $('me-forms').hidden = !inLobby;
  $('me-forms').innerHTML = FORMS.map((_, i) => `<i class="${i === formOf(you) ? 'on' : ''}"></i>`).join('');
  $('wait-name').textContent = you.name;
  $('ask-btn').hidden = false;
  // a game is running without you: watch the big screen
  $('wait-watch').hidden = inLobby;
  $('wait-watch').innerHTML = inLobby ? '' : String(html`${raw(svgGlyph('eye'))}`);
  const vip = inLobby && you.isVip;
  $('vip-start').hidden = !vip;
  $('vip-start').disabled = !!room.startProblem;
  // not the leader: show whose phone starts the race (their robot, then ▶)
  const leader = inLobby && !vip ? room.players.find((p) => p.isVip) : null;
  $('vip-wait').hidden = !leader;
  const leaderHtml = leader ? `${robotSvg(leader)}${svgGlyph('play')}` : '';
  if (leaderHtml !== shownLeader) $('vip-wait').innerHTML = shownLeader = leaderHtml;
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
