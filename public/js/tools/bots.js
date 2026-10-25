// Fake phones for load-testing the website version (tools/bots.html).
import { keepClockInSync } from '../client.js';
import { PeerSocket } from '../net/peer-client.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const bots = [];
const CLUES = ['spots', 'tall', 'hungry', 'loud', 'cold', 'round', 'fast', 'sticky', 'tiny', 'shiny', 'wet', 'old'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

$('room').value = (params.get('room') ?? '').toUpperCase();
$('count').value = params.get('n') ?? 10;

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const room = $('room').value.trim().toUpperCase();
  const count = Number($('count').value);
  // Start them a little apart, like real people scanning a QR code.
  for (let i = 0; i < count; i++) setTimeout(() => addBot(room), i * 400);
});
$('stop').addEventListener('click', () => location.reload());

function addBot(room) {
  const bot = { name: `Bot${bots.length + 1}`, token: null, view: null, game: null, messages: 0, socket: null, pending: null, tapper: null };
  bots.push(bot);
  const el = document.createElement('div');
  el.className = 'bot';
  $('bots').append(el);
  bot.el = el;

  const socket = new PeerSocket(room, (cb) => cb(bot.token ? { token: bot.token, name: bot.name } : {}));
  bot.socket = socket;
  keepClockInSync(socket); // also tells the big screen this bot is still here
  socket.on('connect', () => {
    if (!bot.token) socket.emit('join', { name: bot.name }, () => {});
    draw(bot);
  });
  socket.on('disconnect', () => draw(bot));
  socket.on('status', (text) => {
    bot.status = text;
    draw(bot);
  });
  socket.on('session', ({ token }) => (bot.token = token));
  socket.on('room', (room) => {
    bot.messages++;
    bot.game = room.game?.id ?? null;
  });
  socket.on('self', (self) => {
    bot.messages++;
    bot.view = self.view;
    play(bot);
    draw(bot);
  });
}

/** Very simple players: tap during races, get through Odd One Out's phases, and play Robo Rally. */
function play(bot) {
  const v = bot.view;
  const racing = bot.game === 'tap-race' && v?.phase === 'go';
  if (racing && !bot.tapper) bot.tapper = setInterval(() => bot.socket.emit('action', { type: 'tap' }), 150 + Math.random() * 120);
  if (!racing && bot.tapper) {
    clearInterval(bot.tapper);
    bot.tapper = null;
  }
  if (bot.game === 'robo-rally' && v) return roboRally(bot, v);
  if (bot.game !== 'odd-one-out' || !v) return;
  const later = (type, payload) => {
    const key = `${type}:${v.round}:${v.phase}`;
    if (bot.pending === key) return;
    bot.pending = key;
    setTimeout(() => bot.socket.emit('action', { type, payload }), 800 + Math.random() * 2500);
  };
  if (v.phase === 'reveal' && !v.ready) later('ready');
  if (v.phase === 'clue' && !v.myClue) later('clue', { clue: pick(CLUES) });
  if (v.phase === 'vote' && !v.myVote && v.choices?.length) later('vote', { playerId: pick(v.choices).id });
}

/** Robo Rally: pick a start space, shop a little, program random cards, answer questions at random. */
function roboRally(bot, v) {
  const act = (type, payload) => bot.socket.emit('action', { type, payload });
  const once = (key, ms, fn) => {
    if (bot.pending === key) return;
    bot.pending = key;
    setTimeout(fn, ms + Math.random() * 1500);
  };
  const me = v.me;
  if (v.prompt) return once(`ask:${v.prompt.deadline}`, 500, () => act('answer', { v: pick(v.prompt.options).v }));
  if (v.phase === 'start' && v.myPick == null) {
    const free = [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => !v.robots.some((r) => r.pick === n));
    return once(`start:${free.join()}`, 400, () => act('pick', { n: pick(free) }));
  }
  if (!me) return;
  if (v.phase === 'upgrade' && !me.done) {
    return once(`shop:${v.round}`, 800, () => {
      if (Math.random() < 0.5) act('buy');
      if (me.up.hand.length && Math.random() < 0.7) act('install', { card: pick(me.up.hand) });
      act('done');
    });
  }
  if (v.phase === 'program' && !me.done) {
    return once(`program:${v.round}:${me.mustReturn}`, 1200, () => {
      if (me.mustReturn) return act('ret', { cards: me.hand.slice(0, me.mustReturn) });
      const hand = [...me.hand];
      const regs = me.regs.map((r) => (r.locked || !hand.length ? [] : hand.splice(Math.floor(Math.random() * hand.length), 1)));
      act('lock', { regs, rebootDir: Math.floor(Math.random() * 4) });
    });
  }
}

function draw(bot) {
  const on = bot.socket.connected;
  bot.el.className = `bot ${on ? 'on' : ''}`;
  bot.el.innerHTML = '';
  const name = document.createElement('b');
  name.textContent = bot.name;
  const info = document.createElement('span');
  info.className = 'muted';
  info.textContent = on ? `${bot.view?.phase ?? 'lobby'} · ${bot.messages} msgs` : (bot.status ?? 'connecting…');
  bot.el.append(name, info);
  const connected = bots.filter((b) => b.socket.connected).length;
  $('summary').textContent = `${connected} of ${bots.length} connected`;
}
