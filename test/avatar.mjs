import assert from 'node:assert/strict';
import { Room } from '../public/js/core/room.js';
import { avatar, design, isAvatar, ROBOTS } from '../public/js/avatar.js';
import tapRace from '../games/tap-race/rules.js';
import oddOneOut from '../games/odd-one-out/rules.js';

const room = new Room(new Map());
let next = 0;
function connect(auth = {}) {
  const handlers = new Map();
  const socket = { id: String(++next), data: {}, sent: [],
    on(event, fn) { handlers.set(event, fn); },
    emit(event, data) { this.sent.push([event, data]); },
    disconnect() { handlers.get('disconnect')(); },
    send(event, data) { let result; handlers.get(event)(data, (r) => { result = r; }); return result; },
  };
  room.connect(socket, auth);
  return socket;
}
try {
  assert.equal(ROBOTS.length, 12);
  for (const value of [-1, 12, 1.5, '3', null, {}, NaN, Infinity]) assert.equal(isAvatar(value), false);
  const a = connect();
  assert.equal(a.send('avatar', { avatar: 3 }).ok, false);
  a.send('join', { name: 'Ada' });
  const id = a.data.playerId;
  const initial = room.publicPlayer(id);
  assert.equal(initial.avatar, 0);
  for (let n = 0; n < 12; n++) {
    assert.equal(a.send('avatar', { avatar: n }).ok, true);
    assert.equal(design(room.publicPlayer(id)), n);
    assert.equal(String(avatar(room.publicPlayer(id))), String(avatar(initial, { pose: n })));
  }
  for (const value of [-1, 12, 1.5, '3', null, {}, NaN, Infinity]) {
    assert.equal(a.send('avatar', { avatar: value }).ok, false);
    assert.equal(room.publicPlayer(id).avatar, 11);
  }
  const b = connect(); b.send('join', { name: 'Ben' });
  b.send('avatar', { avatar: 4, playerId: id });
  assert.equal(room.publicPlayer(id).avatar, 11);
  assert.equal(room.publicPlayer(b.data.playerId).avatar, 4);
  const host = connect({ role: 'host' });
  assert.equal(host.send('avatar', { avatar: 0 }).ok, false);
  room.screen = 'game';
  assert.equal(a.send('avatar', { avatar: 0 }).ok, false);
  room.screen = 'lobby';
  const token = room.players.get(id).token;
  a.disconnect();
  const resumed = connect({ token });
  assert.equal(resumed.data.playerId, id);
  assert.equal(room.publicPlayer(id).avatar, 11);
  assert.equal(a.send('avatar', { avatar: 0 }).ok, false);
  const replacement = connect({ token });
  assert.equal(resumed.send('avatar', { avatar: 0 }).ok, false);
  assert.equal(room.publicPlayer(id).avatar, 11);
  room.runSync();
  assert.equal(host.sent.findLast(([event]) => event === 'room')[1].players.find(p => p.id === id).avatar, 11);
  assert.equal(replacement.sent.findLast(([event]) => event === 'self')[1].you.avatar, 11);
  const p = room.publicPlayer(id);
  assert.equal(tapRace.hostView({ state: { taps: {} }, players: [p], player: () => p }).lanes[0].avatar, 11);
  const ctx = { state: { phase: 'vote', scores: {}, clues: {}, votes: {} }, players: [p], player: () => p };
  assert.equal(oddOneOut.hostView(ctx).players[0].avatar, 11);
  assert.equal(oddOneOut.playerView(ctx, { id: 'other' }).choices[0].avatar, 11);
  assert.doesNotThrow(() => avatar({ avatar: '__proto__' }, { pose: -1 }));
  console.log('ALL PASSED — robot selection, validation, ownership, reconnects, room/self and game views');
} finally {
  clearTimeout(room.syncTimer);
  room.stopGame();
}
