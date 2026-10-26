// The moments the lab animates, on the Lumen look's board (looks/three). Each one is a tiny board with robots in a "before" state, the beats the
// real engine would send the big screen (engine.js `fx`), and the "after" state the game holds once the
// moment is over. An animation can do anything it likes in between, as long as it ends on `after`.
//
// Coordinates: x grows right, y grows toward the viewer. d: 0 north (away), 1 east (right), 2 south, 3 west.
// Grid cells use the board.js codes: .. floor, XX pit, EE battery, b> blue (express) belt, g> green belt,
// G+ / G- gear. walls: 'x,y:NESW'. pushers: [x, y, 'side', [registers]]. reboot: [x, y, 'dir'].
// view: { zoom, shift: [x, z] } moves the lab's camera home (zoom > 1 is further away).

// avatar picks the Lumen form (glyphs.js formOf: avatar % 6): Pebble, Orb, Prism, Capsule, Cube, Spire
const ROBOTS = {
  maya: { name: 'Maya', color: '#ff4d6d', avatar: 0 }, // Pebble
  theo: { name: 'Theo', color: '#4dabf7', avatar: 2 }, // Prism
  jun: { name: 'Jun', color: '#ffd43b', avatar: 4 }, // Cube
  ava: { name: 'Ava', color: '#51cf66', avatar: 3 }, // Capsule
  ezra: { name: 'Ezra', color: '#cc5de8', avatar: 5 }, // Spire
};
const bot = (who, x, y, d, extra = {}) => ({ ...ROBOTS[who], x, y, d, ...extra });
const FLOOR = (w) => Array(w).fill('..').join(' ');

export const SCENARIOS = {
  push: {
    title: 'Pushing another robot',
    what: 'Maya (red) plays Move 2. Theo (blue) is in her way, so she shoves him: both slide east, Theo ends one space ahead of her.',
    rule: 'A moving robot pushes any robot in its way, one space per space it moves. Pushed robots keep facing the way they faced. Walls stop the whole line.',
    often: 'Very common: several times a game, the moment players cheer or groan at.',
    budget: 2.5,
    grid: [FLOOR(7), FLOOR(7), FLOOR(7), FLOOR(7)],
    bots: { a: bot('maya', 1, 2, 1), b: bot('theo', 3, 2, 2), c: bot('jun', 6, 0, 3) },
    after: { a: { x: 3, y: 2, d: 1 }, b: { x: 4, y: 2, d: 2 } },
    beats: [[{ k: 'play', id: 'a', cards: ['m2'] }, { k: 'move', id: 'a', path: [[1, 2], [2, 2], [3, 2]] }, { k: 'move', id: 'b', path: [[3, 2], [4, 2]] }]],
  },

  edge: {
    title: 'Driving off the edge of the board',
    what: 'Maya (red) plays Move 3 toward the east edge and drives straight off the board. She is out until she reboots.',
    rule: 'A robot that leaves the board falls: its program for the round is cancelled, it takes 2 damage, and it comes back at a Reboot token later.',
    often: 'A few times a game. Big, funny, a little cruel.',
    budget: 3.5,
    grid: [FLOOR(7), FLOOR(7), FLOOR(7), FLOOR(7)],
    view: { zoom: 1.12, shift: [0.9, 0] }, // room past the east edge to see where she goes
    bots: { a: bot('maya', 4, 1, 1), b: bot('ava', 2, 3, 0) },
    after: { a: { on: false } },
    beats: [[{ k: 'play', id: 'a', cards: ['m3'] }, { k: 'move', id: 'a', path: [[4, 1], [5, 1], [6, 1], [7, 1]] }, { k: 'fall', id: 'a', x: 7, y: 1, edge: true }]],
  },

  pit: {
    title: 'Falling into a pit',
    what: 'Maya (red) plays Move 3 and drives into the pit two spaces ahead. She is out until she reboots.',
    rule: 'A robot that moves onto a pit falls in: its program for the round is cancelled, it takes 2 damage, and it comes back at a Reboot token later.',
    often: 'A few times a game. The classic Robo Rally disaster.',
    budget: 3.5,
    grid: [FLOOR(7), '.. .. .. .. XX .. ..', FLOOR(7), FLOOR(7)],
    bots: { a: bot('maya', 1, 1, 1), b: bot('theo', 5, 3, 0) },
    after: { a: { on: false } },
    beats: [[{ k: 'play', id: 'a', cards: ['m3'] }, { k: 'move', id: 'a', path: [[1, 1], [2, 1], [3, 1], [4, 1]] }, { k: 'fall', id: 'a', x: 4, y: 1, edge: false }]],
  },

  shot: {
    title: 'Getting shot',
    what: 'Theo (blue) faces west with Maya (red) in his line of fire. Robot lasers fire: Theo hits Maya and she takes 1 damage (a SPAM card goes into her deck).',
    rule: 'At the end of every register each robot fires its laser straight ahead; the first robot in line takes 1 damage (1 SPAM card, a junk card that clogs its future hands). Walls block lasers.',
    often: 'Every register, for every robot in someone\'s line. The most frequent "bad thing".',
    budget: 2.5,
    grid: [FLOOR(7), FLOOR(7), FLOOR(7), FLOOR(7)],
    bots: { a: bot('maya', 1, 1, 2), b: bot('theo', 5, 1, 3), c: bot('jun', 3, 3, 0) },
    after: { a: { x: 1, y: 1, d: 2 }, b: { x: 5, y: 1, d: 3 } },
    beats: [[{ k: 'beam', src: 'b', x0: 5, y0: 1, x1: 1, y1: 1, d: 3, n: 1, hit: ['a'] }, { k: 'dmg', id: 'a', sp: 1, hw: 0, src: 'weapon' }]],
  },

  reboot: {
    title: 'Rebooting',
    what: 'Maya (red) fell earlier. At the start of the next round she comes back on the Reboot token (arrow pointing east) and takes 2 damage.',
    rule: 'A fallen robot returns on its board\'s Reboot token, facing the way the player chose, and draws 2 SPAM damage cards. If a robot is on the token it gets nudged along the arrow.',
    often: 'Once for every fall: a few times a game.',
    budget: 3,
    grid: [FLOOR(7), FLOOR(7), FLOOR(7), FLOOR(7)],
    reboot: [3, 1, 'E'],
    bots: { a: bot('maya', 3, 1, 1, { on: false }), b: bot('theo', 5, 2, 3) },
    after: { a: { x: 3, y: 1, d: 1, on: true } },
    beats: [[{ k: 'reboot', id: 'a', x: 3, y: 1 }], [{ k: 'dmg', id: 'a', sp: 2, hw: 0, src: 'reboot' }]],
  },

  wall: {
    title: 'Bumping into a wall',
    what: 'Maya (red) plays Move 3. After two spaces a wall is in the way, so the third space never happens: she stops against it.',
    rule: 'Walls block movement. A robot that would move into a wall simply stops; the rest of that move is lost.',
    often: 'Common: whenever someone miscounts.',
    budget: 2.5,
    grid: [FLOOR(7), FLOOR(7), FLOOR(7), FLOOR(7)],
    walls: ['3,1:E'],
    bots: { a: bot('maya', 1, 1, 1), b: bot('ava', 5, 3, 3) },
    after: { a: { x: 3, y: 1, d: 1 } },
    beats: [[{ k: 'play', id: 'a', cards: ['m3'] }, { k: 'move', id: 'a', path: [[1, 1], [2, 1], [3, 1]] }]],
  },

  belt: {
    title: 'Riding a conveyor belt',
    what: 'Maya (red) ends her move on a blue express belt. The belts run: she is carried two spaces east, and the second space is a corner, so the belt turns her to face east.',
    rule: 'After the programmed moves, blue (express) belts move robots 1 space, then all belts move them 1 more. A belt corner turns the robot with it.',
    often: 'Very common: belts run every register on most courses.',
    budget: 2.5,
    grid: [FLOOR(7), '.. b> b> bv .. .. ..', '.. .. .. bv .. .. ..', '.. .. .. bv .. .. ..'],
    bots: { a: bot('maya', 1, 1, 0), b: bot('jun', 5, 2, 3) },
    after: { a: { x: 3, y: 1, d: 1 } },
    beats: [[{ k: 'move', id: 'a', path: [[1, 1], [2, 1]] }], [{ k: 'move', id: 'a', path: [[2, 1], [3, 1]] }, { k: 'turn', id: 'a', by: 1 }]],
  },

  gear: {
    title: 'Spinning on a gear',
    what: 'Maya (red) is standing on a green gear, which turns her 90° to the right: from facing north (away from us) to facing east.',
    rule: 'Gears rotate the robot on them 90°: green gears to the right, red gears to the left. The robot stays on its space.',
    often: 'Common on most courses.',
    budget: 2,
    grid: [FLOOR(7), '.. .. .. G+ .. .. ..', FLOOR(7), FLOOR(7)],
    bots: { a: bot('maya', 3, 1, 0), b: bot('theo', 1, 3, 1) },
    after: { a: { x: 3, y: 1, d: 1 } },
    beats: [[{ k: 'gear', x: 3, y: 1, spin: 1 }, { k: 'turn', id: 'a', by: 1 }]],
  },

  pusher: {
    title: 'Getting shoved by a push panel',
    what: 'Maya (red) is next to a push panel on the north wall. It fires this register and shoves her one space south, toward us. She keeps facing east.',
    rule: 'Push panels fire on the registers printed on them and push the robot in front of them 1 space. They push other robots along like a robot would.',
    often: 'Occasional: a couple of courses have them.',
    budget: 2,
    grid: [FLOOR(7), FLOOR(7), FLOOR(7), FLOOR(7)],
    pushers: [[3, 1, 'N', [1, 3, 5]]],
    bots: { a: bot('maya', 3, 1, 1), b: bot('ava', 5, 3, 3) },
    after: { a: { x: 3, y: 2, d: 1 } },
    beats: [[{ k: 'pusher', x: 3, y: 1, side: 0 }, { k: 'move', id: 'a', path: [[3, 1], [3, 2]] }]],
  },

  energy: {
    title: 'Charging up on a battery',
    what: 'Maya (red) plays Move 2 and stops on a battery space. At the end of the register it gives her 1 energy cube (energy buys upgrades).',
    rule: 'A robot that ends a register on a battery space gains 1 energy (max 10). Energy pays for upgrades and powers some of them.',
    often: 'Common: a small reward, several times a game.',
    budget: 2.5,
    grid: [FLOOR(7), '.. .. .. EE .. .. ..', FLOOR(7), FLOOR(7)],
    bots: { a: bot('maya', 1, 1, 1), b: bot('ezra', 5, 3, 0) },
    after: { a: { x: 3, y: 1, d: 1 } },
    beats: [[{ k: 'play', id: 'a', cards: ['m2'] }, { k: 'move', id: 'a', path: [[1, 1], [2, 1], [3, 1]] }], [{ k: 'en', id: 'a', n: 1 }]],
  },

  checkpoint: {
    title: 'Reaching a checkpoint flag',
    what: 'Maya (red) plays Move 2 and ends the register on flag 1, her next flag. She has it: now she needs flag 2.',
    rule: 'Robots must touch the flags in order. Ending a register on your next flag claims it.',
    often: 'A handful of times a game: the big progress moment.',
    budget: 3,
    grid: [FLOOR(7), FLOOR(7), FLOOR(7), FLOOR(7)],
    checkpoints: [[4, 1], [1, 3]],
    bots: { a: bot('maya', 2, 1, 1), b: bot('theo', 5, 3, 3) },
    after: { a: { x: 4, y: 1, d: 1 } },
    beats: [[{ k: 'play', id: 'a', cards: ['m2'] }, { k: 'move', id: 'a', path: [[2, 1], [3, 1], [4, 1]] }], [{ k: 'cp', id: 'a', n: 1 }]],
  },

  win: {
    title: 'Winning the race',
    what: 'Maya (red) already has flag 1. She plays Move 2, lands on flag 2, the last one, and wins the game. Theo and Jun are still racing.',
    rule: 'The first robot to touch every flag in order wins and the game ends.',
    often: 'Once per game. The finale everyone is watching.',
    budget: 6,
    grid: [FLOOR(7), FLOOR(7), FLOOR(7), FLOOR(7)],
    checkpoints: [[1, 3], [4, 1]],
    bots: { a: bot('maya', 2, 1, 1), b: bot('theo', 5, 3, 3), c: bot('jun', 1, 0, 2) },
    after: { a: { x: 4, y: 1, d: 1 } },
    beats: [[{ k: 'play', id: 'a', cards: ['m2'] }, { k: 'move', id: 'a', path: [[2, 1], [3, 1], [4, 1]] }], [{ k: 'cp', id: 'a', n: 2 }, { k: 'win', id: 'a' }]],
  },

  drive: {
    title: 'Everyday driving and turning',
    what: 'Maya (red) runs four ordinary program cards, one per beat: Move 2, Rotate Right, Move Back, U-Turn.',
    rule: 'Move 1/2/3 drive forward, Move Back drives 1 space backward without turning, Rotate Right/Left turn 90° in place, U-Turn rotates 180° in place.',
    often: 'Constantly: every robot, every register. Whatever happens here is seen hundreds of times a game, so it must stay quick and never get tiring.',
    budget: 4.5,
    grid: [FLOOR(7), FLOOR(7), FLOOR(7), FLOOR(7)],
    bots: { a: bot('maya', 1, 2, 1), b: bot('theo', 5, 0, 2) },
    after: { a: { x: 3, y: 1, d: 0 } },
    beats: [
      [{ k: 'play', id: 'a', cards: ['m2'] }, { k: 'move', id: 'a', path: [[1, 2], [2, 2], [3, 2]] }],
      [{ k: 'play', id: 'a', cards: ['rr'] }, { k: 'turn', id: 'a', by: 1 }],
      [{ k: 'play', id: 'a', cards: ['bk'] }, { k: 'move', id: 'a', path: [[3, 2], [3, 1]] }],
      [{ k: 'play', id: 'a', cards: ['ut'] }, { k: 'turn', id: 'a', by: 2 }],
    ],
  },
};

/** How long the real game waits on a beat (engine.js beatTime). */
export function beatTime(list) {
  let ms = 350;
  for (const f of list) {
    if (f.k === 'move') ms = Math.max(ms, 200 + (f.path.length - 1) * 330);
    else if (f.k === 'turn') ms = Math.max(ms, 600);
    else if (f.k === 'beam') ms = Math.max(ms, 1000);
    else if (f.k === 'fall') ms = Math.max(ms, 1300);
    else if (f.k === 'reboot') ms = Math.max(ms, 1100);
    else if (f.k === 'cp') ms = Math.max(ms, 1400);
    else if (f.k === 'win') ms = Math.max(ms, 3000);
    else if (f.k === 'dmg') ms = Math.max(ms, 900);
    else ms = Math.max(ms, 700);
  }
  return ms / 1000;
}
