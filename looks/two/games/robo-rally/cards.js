// Every card in the game: the 20-card programming deck, the damage deck (SPAM and Haywire) and the
// 40 upgrades. Cards travel as short strings "type.serial" (e.g. "m2.17"), so views stay small.

export const cardType = (id) => String(id).split('.')[0];
export const isHaywire = (id) => /^h\d\d$/.test(cardType(id));
export const isDamage = (id) => cardType(id) === 'sp' || isHaywire(id);

// The programming deck each robot starts with (20 cards).
export const DECK = [
  ['m1', 4], ['m2', 3], ['m3', 1], ['rr', 4], ['rl', 4], ['ut', 1], ['bk', 1], ['pu', 1], ['ag', 1],
];

export const PROGRAM = {
  m1: { name: 'Move 1', icon: '↑', text: 'Move forward 1 space.' },
  m2: { name: 'Move 2', icon: '↑↑', text: 'Move forward 2 spaces.' },
  m3: { name: 'Move 3', icon: '↑↑↑', text: 'Move forward 3 spaces.' },
  bk: { name: 'Move Back', icon: '↓', text: 'Move back 1 space without turning.' },
  rr: { name: 'Rotate Right', icon: '↻', text: 'Turn 90° right.' },
  rl: { name: 'Rotate Left', icon: '↺', text: 'Turn 90° left.' },
  ut: { name: 'U-Turn', icon: '⟲', text: 'Turn around.' },
  pu: { name: 'Power Up', icon: '⚡', text: 'Gain 1 Energy.' },
  ag: { name: 'Again', icon: '⟳', text: 'Repeat your previous register. In Register 1 it acts like SPAM.' },
  sp: { name: 'SPAM', icon: '⚠', text: 'Damage. When revealed it is replaced by the top card of your deck.' },
};

// The damage deck: 23 SPAM and 17 Haywire. Haywire cards sit face down in the register where they
// were taken and run there next round. The first five are from the rulebook; the rest are ours.
// ops: ['mv', side, n] (side: 0 forward, 1 right, 2 back, 3 left; facing never changes)
//      ['rt', quarter-turns right]   ['spin'] random facing   ['en', n]   ['dmg', n]
//      ['install'] ['storm'] ['double'] ['swap'] ['emp'] ['overcharge']
export const SPAM_COUNT = 23;
export const HAYWIRE = {
  h01: { name: 'Move 1, Rotate Right, Move 1', ops: [['mv', 0, 1], ['rt', 1], ['mv', 0, 1]] },
  h02: { name: 'Move 2 Sideways', text: 'Move 2 left or right without changing facing (you choose which while programming).', ops: [['mv', 'side', 2]], choice: 'side' },
  h03: { name: 'Move 3, U-Turn', ops: [['mv', 0, 3], ['rt', 2]] },
  h04: { name: 'Move 5', text: 'Move 5. If you hit a wall, take 1 damage.', ops: [['mv', 0, 5, 'wallhurt']] },
  h05: { name: 'Install an Upgrade', text: 'Install a permanent upgrade from your collection for free, even past 3. At the end of the round it goes to the upgrade discard pile.', ops: [['install']], choice: 'install' },
  h06: { name: 'Move 1, Rotate Left, Move 1', ops: [['mv', 0, 1], ['rt', -1], ['mv', 0, 1]] },
  h07: { name: 'U-Turn, Move 2', ops: [['rt', 2], ['mv', 0, 2]] },
  h08: { name: 'Move Back 3', ops: [['mv', 2, 3]] },
  h09: { name: 'Laser Storm', text: 'This register your main laser fires in all 4 directions.', ops: [['storm']] },
  h10: { name: 'Double Program', text: 'Put the top 2 cards of your deck in this register and run both. Again repeats only the second.', ops: [['double']] },
  h11: { name: 'Spin Out', text: 'Spin to a random facing, then Move 2.', ops: [['spin'], ['mv', 0, 2]] },
  h12: { name: 'Swap', text: 'Swap places with the robot your laser would hit. Nobody turns.', ops: [['swap']] },
  h13: { name: 'Power Surge', text: 'Gain 3 Energy, then take 1 damage.', ops: [['en', 3], ['dmg', 1]] },
  h14: { name: 'EMP', text: 'Every robot next to yours takes 1 damage.', ops: [['emp']] },
  h15: { name: 'Move 2, Rotate Left, Move 1', ops: [['mv', 0, 2], ['rt', -1], ['mv', 0, 1]] },
  h16: { name: 'Zigzag', text: 'Move 1, step 1 to the right without turning, Move 1.', ops: [['mv', 0, 1], ['mv', 1, 1], ['mv', 0, 1]] },
  h17: { name: 'Overcharge', text: 'This register your main laser deals 2 extra damage.', ops: [['overcharge']] },
};

/** Display info for any programming or damage card. */
export function cardInfo(id) {
  const t = cardType(id);
  if (PROGRAM[t]) return { type: t, ...PROGRAM[t], damage: t === 'sp' };
  if (HAYWIRE[t]) return { type: t, icon: '⚡', text: HAYWIRE[t].name, ...HAYWIRE[t], haywire: true, damage: true };
  return { type: t, name: '?', icon: '?', text: '' };
}

// ---------- upgrades ----------
// kind: 'perm' (yellow, up to 3 installed) or 'temp' (red, one use, up to 3 installed).
// when (temporary upgrades): 'any' = upgrade or programming phase, 'upgrade' = upgrade phase only,
// 'move' = right before or after your own programming card (arm it on your phone),
// 'turn' = when your card is revealed (arm it), 'auto' = offered when it applies.
export const UPGRADES = {
  // permanent
  'brakes': { name: 'Brakes', cost: 2, kind: 'perm', text: 'When a Move 1 card is revealed, you may treat it as Move 0.' },
  'chaos-theory': { name: 'Chaos Theory', cost: 2, kind: 'perm', text: 'When you reveal SPAM in Register 1, 2 or 3, gain 1 Energy.' },
  'crab-legs': { name: 'Crab Legs', cost: 5, kind: 'perm', text: 'Put a Move 1 in the same register as a Rotate Left/Right: you step 1 space that way without turning.' },
  'deflector-shield': { name: 'Deflector Shield', cost: 2, kind: 'perm', text: 'When lasers or weapons would damage you, pay 1 Energy to take no laser/weapon damage this register.' },
  'double-barrel': { name: 'Double-Barrel Laser', cost: 2, kind: 'perm', text: 'Your main laser deals 1 extra damage.' },
  'drifting': { name: 'Drifting', cost: 4, kind: 'perm', text: 'After a Rotate Left card, you may move 1 space forward.' },
  'energy-conversion': { name: 'Energy Conversion', cost: 3, kind: 'perm', text: 'After a board laser damages you, you may move 1 space forward or back.' },
  'firewall': { name: 'Firewall', cost: 1, kind: 'perm', text: 'No damage cards when you reboot after falling into a pit.' },
  'flash-drive': { name: 'Flash Drive', cost: 4, kind: 'perm', text: 'Draw 1 extra programming card each round.' },
  'hover-unit': { name: 'Hover Unit', cost: 1, kind: 'perm', text: 'Your own cards carry you over pits. You still fall in if you stop on one.' },
  'laser-kata': { name: 'Laser Kata', cost: 1, kind: 'perm', text: 'After you U-Turn, your main laser fires in all 4 directions that register.' },
  'memory-cards': { name: 'Memory Cards', cost: 3, kind: 'perm', text: 'After programming, keep any unused non-damage cards for next round.' },
  'mini-howitzer': { name: 'Mini Howitzer', cost: 3, kind: 'perm', weapon: true, text: 'Instead of your main laser, pay 1 Energy: 2 damage to the target and push it 1 space.' },
  'modular-chassis': { name: 'Modular Chassis', cost: 1, kind: 'perm', text: 'After your card pushes a robot, you may give them this card and take one of their installed upgrades.' },
  'power-slide': { name: 'Power Slide', cost: 4, kind: 'perm', text: 'After a Rotate Right card, you may move 1 space forward.' },
  'pressor-beam': { name: 'Pressor Beam', cost: 3, kind: 'perm', weapon: true, text: 'Instead of your main laser: push the target 1 space away.' },
  'rail-gun': { name: 'Rail Gun', cost: 2, kind: 'perm', text: 'Your main laser goes through walls and robots, hitting every robot in line.' },
  'ramming-gear': { name: 'Ramming Gear', cost: 2, kind: 'perm', text: 'When your card pushes (or tries to push) a robot, it takes 1 damage.' },
  'rear-laser': { name: 'Rear Laser', cost: 2, kind: 'perm', text: 'You also fire a laser backward.' },
  'scrambler': { name: 'Scrambler', cost: 4, kind: 'perm', weapon: true, text: 'Instead of your main laser: replace the target\'s next register with the top card of their deck. Not in Register 5.' },
  'self-diagnostics': { name: 'Self-Diagnostics', cost: 2, kind: 'perm', text: 'When you reach a Checkpoint, you may remove a card in your hand or discard pile from the game.' },
  'spam-filter': { name: 'SPAM Filter', cost: 3, kind: 'perm', text: 'After drawing your hand, see the top card of your deck.' },
  'spiky': { name: 'Spiky', cost: 2, kind: 'perm', text: 'A robot that moves or is pushed into your space takes 1 damage.' },
  'tractor-beam': { name: 'Tractor Beam', cost: 3, kind: 'perm', weapon: true, text: 'Instead of your main laser: pull the target 1 space toward you. Not on adjacent robots.' },
  // temporary
  'abort-switch': { name: 'Abort Switch', cost: 1, kind: 'temp', when: 'turn', text: 'Replace the card you just revealed with the top card of your deck.' },
  'all-aboard': { name: 'All Aboard', cost: 1, kind: 'temp', when: 'move', text: 'Run every conveyor belt for your robot only: blue, then green.' },
  'boink': { name: 'Boink', cost: 1, kind: 'temp', when: 'move', text: 'Hop to an empty space next to you without turning.' },
  'calibration-protocol': { name: 'Calibration Protocol', cost: 2, kind: 'temp', when: 'any', text: 'Return the damage cards in your hand to the damage pile and draw that many cards.' },
  'displacing-blast': { name: 'Displacing Blast', cost: 2, kind: 'temp', weapon: true, text: 'Instead of your main laser: send the target to its board\'s Reboot token (no turning).' },
  'lucky-booster': { name: 'Lucky Booster', cost: 1, kind: 'temp', when: 'turn', text: 'Flip damage cards until a Haywire. You may run it instead of the card you just revealed.' },
  'magnetic': { name: 'Magnetic', cost: 1, kind: 'temp', when: 'auto', text: 'When a robot next to you moves with a register card, you may move along with it.' },
  'memory-swap': { name: 'Memory Swap', cost: 2, kind: 'temp', when: 'program', text: 'Draw 3 cards, then put 3 cards from your hand on top of your deck.' },
  'overclocked': { name: 'Overclocked', cost: 2, kind: 'temp', when: 'move', text: 'Move 2.' },
  'piercing-drill': { name: 'Piercing Drill', cost: 1, kind: 'temp', when: 'auto', text: 'When your card pushes a robot, it takes 1 damage and you may turn it to face any way.' },
  'pressure-release': { name: 'Pressure Release', cost: 2, kind: 'temp', when: 'move', text: 'Back up to 5 spaces, stopping before you would push a robot.' },
  're-initialize': { name: 'Re-Initialize', cost: 1, kind: 'temp', when: 'any', text: 'Give the Priority Token to any player (or yourself).' },
  'recharge': { name: 'Recharge', cost: 0, kind: 'temp', when: 'any', text: 'Gain 3 Energy.' },
  'rewire': { name: 'Rewire', cost: 1, kind: 'temp', when: 'upgrade', text: 'Upgrade phase: take the face-down Haywires out of your registers into your hand. Program them all this round, anywhere.' },
  'switch': { name: 'Switch', cost: 2, kind: 'temp', when: 'move', text: 'Swap places with a robot next to you. Nobody turns.' },
  'zoop': { name: 'Zoop', cost: 1, kind: 'temp', when: 'move', text: 'Turn to face any direction.' },
};

export const UPGRADE_IDS = Object.keys(UPGRADES);
export const WEAPONS = UPGRADE_IDS.filter((k) => UPGRADES[k].weapon);
