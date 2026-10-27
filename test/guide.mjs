// The phone's Guide (chunk A): topics, clips, the map hit-test, marks and replays, and the fixed demos.
//   node test/guide.mjs
import fs from 'node:fs';
import { TOPICS, SECTIONS, sectionTopics, tileCaption, topicAtCell, cardTopic, words, UPGRADE_ORDER, bookTiles } from '../games/robo-rally/topics.js';
import { hasDemo, demoKeys, compileDemo, lessonFrames, demoDef, miniCourse } from '../games/robo-rally/demo.js';
import { previewProgram, filledRun, rebootFor } from '../games/robo-rally/minimap.js';
import * as E from '../games/robo-rally/engine.js';
import { haywireParts } from '../games/robo-rally/glyphs.js';
import { marksFor, causesFor, replayPlan, ranCards, cropFor } from '../games/robo-rally/replay.js';
import { COURSES, getCourse } from '../games/robo-rally/board.js';
import { UPGRADES, HAYWIRE, PROGRAM } from '../games/robo-rally/cards.js';

let failures = 0;
const check = (cond, msg) => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${msg}`);
  }
};

// ----- every topic: its clips exist, its words stay few -----
// settings the owner named themselves (their names are the captions, even at 4 words)
const OWNER_NAMED = new Set(['opt-lessspam']);
for (const [id, t] of Object.entries(TOPICS)) {
  for (const [key, cap] of t.clips) {
    check(hasDemo(key), `${id}: clip ${key} exists`);
    check(words(cap) <= 4, `${id}: caption "${cap}" is at most 4 words`);
  }
  check(words(t.fine ?? '') <= 25, `${id}: fine print is at most 25 words (${words(t.fine)})`);
  check(SECTIONS.some((s) => s.id === t.sec), `${id}: section ${t.sec} exists`);
  check(words(tileCaption(id)) <= (OWNER_NAMED.has(id) ? 4 : 3) || (t.sec === 'haywire' && !t.name), `${id}: tile caption "${tileCaption(id)}" is at most 3 words`);
}
check(SECTIONS.length === 13, '13 mechanics sections');
check(sectionTopics('upgrades').length === 40 && sectionTopics('haywire').length === 17, '57 generated tiles (40 upgrades, 17 Haywires)');
check(UPGRADE_ORDER.slice(0, 24).every((k) => UPGRADES[k].kind === 'perm'), 'upgrades: permanent first');
for (const s of SECTIONS) check(sectionTopics(s.id).length > 0, `section ${s.id} has tiles`);

// the Book shows each clip once per section, and every tile has a short caption (or a card face)
{
  const noRepeats = (tiles) => tiles.filter((x) => x.clip).length === new Set(tiles.filter((x) => x.clip).map((x) => x.clip[0])).size;
  for (const s of SECTIONS) {
    const tiles = bookTiles(sectionTopics(s.id));
    check(noRepeats(tiles), `the Book's ${s.id} section shows each clip once`);
    check(tiles.length > 0, `the Book's ${s.id} section isn't empty after that`);
    for (const x of tiles) check((x.cap && words(x.cap) <= (OWNER_NAMED.has(x.id) ? 4 : 3)) || (s.id === 'haywire' && !TOPICS[x.id].name), `${s.id}: tile ${x.id} has a caption of 1-3 words ("${x.cap}")`);
  }
  // "Now" while programming with a hand where several cards share a clip
  const now = bookTiles(['slots', 'line', 'lock', 'timer', 'm1', 'm2', 'm3', 'rr', 'rl', 'ut', 'ag', 'sp', 'h01', 'haywire-slot:h01', 'deck']);
  check(noRepeats(now), `"Now" shows each clip once (${now.map((x) => x.clip?.[0] ?? x.id)})`);
  check(now.every((x) => x.cap || (TOPICS[x.id].sec === 'haywire' && !TOPICS[x.id].name)), '"Now": every tile has a caption, the ✓ and the deck too');
  check(now.some((x) => x.id === 'm2' && x.clip[0] === 'push') && !now.some((x) => x.id === 'm3'), '"Now": a shared clip moves on to the next one, or the tile goes');
  check(now.find((x) => x.id === 'rl')?.cap === 'Whose left?' && now.find((x) => x.id === 'rr')?.cap === 'Stays put', '"Now": each turn card gets its own clip');
}

// every card has a topic (hand cards and slots ask by card type)
for (const t of [...Object.keys(PROGRAM), ...Object.keys(HAYWIRE)]) check(TOPICS[cardTopic(`${t}.7`)], `card ${t} has a topic`);
for (const k of Object.keys(UPGRADES)) check(TOPICS[k], `upgrade ${k} has a topic`);

// ----- every data-ask in player.js resolves to a topic -----
const src = fs.readFileSync(new URL('../games/robo-rally/player.js', import.meta.url), 'utf8');
const asks = [...src.matchAll(/data-ask="([^"]*)"/g)].map((m) => m[1]);
check(asks.length > 40, `player.js asks about many things (${asks.length})`);
for (const a of asks) {
  const literal = a.replace(/\$\{[^}]*\}/g, '');
  const id = literal.split(':')[0];
  if (!id) continue; // fully dynamic: cardTopic(id), an upgrade key, a prompt's upgrade (checked above)
  check(id === 'map' || id === 'replay' || TOPICS[id], `data-ask="${a}" resolves to a topic`);
}
const dynamic = asks.filter((a) => a.startsWith('${')).map((a) => a.slice(2, -1));
check(dynamic.every((d) => ['cardTopic(id)', 'k', 'key', 'ask', 'ask[key]', 'promptAsk(p)', 'askOf(o.v)'].includes(d)), `dynamic asks come from known helpers (${[...new Set(dynamic)].join(', ')})`);

// ----- every demo compiles; the lobby film's scenes too -----
for (const key of demoKeys()) {
  if (key.startsWith('film-')) continue;
  try {
    const c = compileDemo(key);
    check(c.frames.length > 1 && c.total > 0, `demo ${key} has frames`);
  } catch (err) {
    check(false, `demo ${key} compiles: ${err.message}`);
  }
}
try {
  const { LESSONS, runLesson } = await import('../games/robo-rally/lessons.js');
  LESSONS.slice(0, 4).forEach((lesson, i) => {
    const c = lessonFrames(runLesson(lesson));
    check(c.frames.length > 3 && c.total > 0, `film-${i + 1} (${lesson.id}) has frames`);
  });
} catch (err) {
  check(false, `the lobby film's scenes compile: ${err.message}`);
}

// ----- E1: Spiky. Stopping next to it does nothing; driving into it pushes it, and the pusher is hurt -----
{
  const { frames } = compileDemo('spiky');
  const moves = frames.map((f, i) => [i, f.bots.b.x]).filter(([i, x]) => i > 0 && x !== frames[i - 1].bots.b.x).map(([i]) => i);
  check(moves.length === 2, 'spiky: b moves twice');
  const hurt = frames.findIndex((f) => f.fx.some((x) => x.k === 'burst' && x.id === 'b'));
  check(hurt > moves[1], 'spiky: no burst on b before its second move');
  check(frames.at(-1).bots.a.x === 4, 'spiky: the second move pushes a');
}
// E5: the blank demos now show something (a pop, a token, a fly, a ring)
for (const key of ['re-initialize', 'h05', 'brakes', 'memory-cards', 'spam-filter', 'memory-swap', 'rewire', 'upgrades', 'h11', 'modular-chassis', 'h14', 'abort-switch', 'all-aboard', 'overclocked', 'lucky-booster']) {
  const { frames } = compileDemo(key);
  check(frames.some((f) => f.fx.length || f.ui.token || f.ui.strip?.some(Boolean)), `${key} shows its effect`);
}
// E6: Power Surge's face: a bolt and +3
check(haywireParts('h13').join(' ') === 'pu +3 dmg', `Power Surge's face is bolt +3 ! (${haywireParts('h13')})`);
// E3: a "?" ends the light line (Spin Out, Double Program, Swap say "?" like SPAM)
{
  const c = getCourse('closing-time');
  const st = c.starts[0];
  const ghosts = previewProgram(c, st, [['m1'], ['?'], ['m1']]);
  check(ghosts.length === 2 && ghosts[1].unknown, 'the line stops at "?"');
}
// the light line goes only as far as the slots filled from slot 1 without a gap; turns are marked
{
  check(filledRun([true, true, false, true, true]) === 2, 'a gap in slot 3: the line stops after slot 2');
  check(filledRun([false, true, true, true, true]) === 0, 'slot 1 empty: no line');
  check(filledRun([true, true, true, true, true]) === 5, 'all five: the whole line');
  const c = getCourse('closing-time');
  const st = c.starts[0];
  const two = previewProgram(c, st, [['rr'], ['m1']]);
  check(two.length === 2, `two slots given: two marks (${two.length})`);
  check(two[0].turned && !two[1].turned, 'a turn card is marked as a turn; a move is not');
  check(previewProgram(c, st, []).length === 0, 'no slots: no line');
}
// the settings' names, as the owner wants them
check(TOPICS['opt-safe'].name === 'Map perimeter' && TOPICS['opt-safe'].clips[0][1] === 'Map perimeter', 'lessDeadly is called "Map perimeter"');
check(TOPICS['opt-lessspam'].name === 'Spam in hand discards' && TOPICS['opt-lessspam'].clips[0][1] === 'Spam in hand discards', 'lessSpam is called "Spam in hand discards"');
check(/does nothing/.test(TOPICS.pu.fine), 'Power Up says it does nothing without upgrades');
{
  const src2 = fs.readFileSync(new URL('../games/robo-rally/player.js', import.meta.url), 'utf8');
  check(!/showOptClip|pl-optclip/.test(src2), 'no clip pops up when a setting changes');
  check(!/pl-dots/.test(src2), 'difficulty is not drawn as dots');
}
// the deck sheet and the other robots have Guide entries
for (const id of ['deck', 'discard', 'rival']) check(TOPICS[id] && TOPICS[id].fine && words(TOPICS[id].fine) <= 25, `topic ${id} exists and is short`);
check(sectionTopics('robots').includes('rival'), 'the Book lists "Look closer" under Robots');
check(/data-ui="deck"/.test(fs.readFileSync(new URL('../games/robo-rally/player.js', import.meta.url), 'utf8')), 'the phone has a way into its deck');
// E4: Hover Unit crosses pits on its own moves, but not when it stops on one, nor on belts or pushes
{
  const def = { w: 5, h: 1, cells: ['floor', 'pit', 'floor', 'pit', 'floor'].map((k) => ({ k, walls: 0, b: 0 })), lasers: [], pushers: [], checkpoints: [], boards: [{}], tokens: new Map() };
  const over = previewProgram(def, { x: 0, y: 0, d: 1 }, [['m2']], { hover: true });
  check(!over[0].fell && over[0].x === 2, 'hover: Move 2 crosses the pit');
  const into = previewProgram(def, { x: 0, y: 0, d: 1 }, [['m1']], { hover: true });
  check(into[0].fell, 'hover: stopping on a pit falls');
  const plain = previewProgram(def, { x: 0, y: 0, d: 1 }, [['m2']], {});
  check(plain[0].fell, 'no hover: Move 2 falls into the pit');
}

// ----- every Haywire says exactly what it does: a plain sentence, and a clip that matches the real rules -----
{
  const sayOf = { rt: { 1: 'turn right', '-1': 'turn left', 2: 'turn around' } };
  for (const [t, hw] of Object.entries(HAYWIRE)) {
    const T = TOPICS[t];
    check(T?.does && words(T.does) >= 3 && words(T.does) <= 25, `${t}: says what it does in 3-25 words ("${T?.does}")`);
    check(T.clips.length && T.clips.every(([k]) => hasDemo(k)) && T.clips[0][0] === t, `${t}: has its own clip`);
    // its moves, in order, in the words: Move n / back up n / step 1 right / slide 2 sideways / turn ...
    if (hw.ops.every(([k]) => k === 'mv' || k === 'rt')) {
      const parts = hw.ops.map(([k, a, b]) => (k === 'rt' ? sayOf.rt[a] : a === 0 ? `move ${b}` : a === 2 ? `back up ${b}` : a === 'side' ? `${b} spaces sideways` : `step ${b} ${a === 1 ? 'right' : 'left'}`));
      const text = T.does.toLowerCase();
      let from = 0;
      const inOrder = parts.every((p) => {
        const i = text.indexOf(p, from);
        if (i < 0) return false;
        from = i + p.length;
        return true;
      });
      check(inOrder, `${t}: "${T.does}" says ${parts.join(', ')}, in that order`);
    }
  }
  // the clip ends where the engine puts the robots, on the clip's own little board
  const L = { N: 0, E: 1, S: 2, W: 3 };
  const runReal = (t) => {
    const def = demoDef(t);
    const course = miniCourse(def);
    course.starts = Object.values(def.bots).map(([x, y, d], i) => ({ x, y, d: L[d], n: i + 1 }));
    const ids = Object.keys(def.bots);
    const s = E.newGame({ order: ids, seed: 3, opts: { upgrades: true } });
    const env = { course, connected: () => true, now: () => 0, name: (id) => id };
    ids.forEach((id, i) => (s.picks[id] = i + 1));
    E.startRace(s, env);
    s.prio = 0;
    for (const id of ids) {
      Object.assign(s.robots[id], { hand: [], done: true, draft: { regs: [[], [], [], [], []], keep: [] }, energy: 3 });
      s.robots[id].up = { perm: [], temp: [], hand: id === 'a' ? ['brakes'] : [] };
    }
    const A = s.robots.a;
    Object.assign(A.regs[0], { cards: [`${t}.1`], locked: true });
    A.deck = ['m1.501', 'rr.502', ...A.deck]; // Double Program's clip runs Move 1, then Rotate Right
    s.damage = Array.from({ length: 20 }, (_, i) => `sp.${700 + i}`);
    s.phase = 'program';
    E.beginActivation(s, env);
    for (let i = 0; i < 3000 && s.reg < 1 && s.phase === 'activate'; i++) {
      E.step(s, env);
      if (s.prompt) E.answerPrompt(s, env, s.prompt.id, s.prompt.def);
    }
    return { s, R: s.robots, hurt: (id) => s.robots[id].discard.filter((c) => c.startsWith('sp')).length };
  };
  for (const t of Object.keys(HAYWIRE)) {
    if (t === 'h11') continue; // Spin Out faces a random way
    const { R } = runReal(t);
    const end = compileDemo(t).frames.at(-1).bots;
    for (const id of Object.keys(end)) {
      const a = end[id];
      const b = R[id];
      check(a.x === b.x && a.y === b.y && a.d === b.d, `${t}: the clip leaves robot ${id} where the rules do (clip ${a.x},${a.y},${a.d}; rules ${b.x},${b.y},${b.d})`);
    }
  }
  check(runReal('h04').hurt('a') === 1, 'h04: a wall stops Move 5: 1 damage');
  check(runReal('h05').R.a.up.perm.includes('brakes'), 'h05: a permanent upgrade from the collection is installed');
  { const r = runReal('h09'); check(r.hurt('b') === 1 && r.hurt('c') === 1, 'h09: the laser hits a robot to the left and one behind'); }
  { const r = runReal('h13'); check(r.R.a.energy === 6 && r.hurt('a') === 1, 'h13: +3 energy, then 1 damage'); }
  { const r = runReal('h14'); check(r.hurt('b') === 1 && r.hurt('c') === 1, 'h14: both neighbours take 1 damage'); }
  check(runReal('h17').hurt('b') === 3, 'h17: the laser deals 3 damage');
  // the clip shows each move and turn as a little card over the robot
  for (const t of ['h01', 'h08', 'h16']) {
    const cards = compileDemo(t).frames.flatMap((f) => f.fx.filter((x) => x.k === 'card'));
    check(cards.length === HAYWIRE[t].ops.length, `${t}: a little card for each step (${cards.length})`);
  }
}

// ----- the reboot ring I'd come back on -----
{
  const c = getCourse('closing-time');
  const boardOf = (x, y) => c.cells[y * c.w + x]?.b;
  const ringBoard = c.boards.findIndex((b) => b.reboot && !b.dock);
  const ring = c.boards[ringBoard].reboot;
  const archive = { ...c.starts[0] };
  // a square on that board, and one on the dock
  const onBoard = c.cells.findIndex((q, i) => q && q.b === ringBoard && q.k === 'floor' && i !== ring.y * c.w + ring.x);
  const sq = { x: onBoard % c.w, y: Math.floor(onBoard / c.w), d: 0 };
  const here = rebootFor(c, sq, [], archive);
  check(here && here.x === ring.x && here.y === ring.y && !here.fall && !here.archive, 'ring: the board I am on');
  const dock = rebootFor(c, archive, [], archive);
  check(dock && dock.archive && dock.x === archive.x && dock.y === archive.y, 'ring: on the dock it is my start pad');
  // a planned line that falls off an edge of that board: its ring, and the fall to link from
  let fallCase = null;
  for (let i = 0; i < c.cells.length && !fallCase; i++) {
    const q = c.cells[i];
    if (!q || q.b !== ringBoard || q.k !== 'floor') continue;
    for (let d = 0; d < 4 && !fallCase; d++) {
      const st = { x: i % c.w, y: Math.floor(i / c.w), d };
      const gh = previewProgram(c, st, [['m1']]);
      if (gh[0]?.fell) fallCase = { st, gh };
    }
  }
  check(!!fallCase, 'closing-time has a square on a ring board one step from a fall');
  if (fallCase) {
    const r = rebootFor(c, sq, fallCase.gh, archive);
    check(r.fall && r.fall.x === fallCase.gh[0].x && r.fall.y === fallCase.gh[0].y, 'ring: a planned fall links from its cross');
    const fb = boardOf(fallCase.gh[0].x, fallCase.gh[0].y) ?? boardOf(fallCase.st.x, fallCase.st.y);
    const want = c.boards[fb]?.reboot && !c.boards[fb].dock ? c.boards[fb].reboot : archive;
    check(r.x === want.x && r.y === want.y, 'ring: a planned fall uses the board where it falls');
  }
  // from the dock, a planned fall onto a ring board's pit uses that board's ring (not my start pad)
  const pit = c.cells.findIndex((q) => q?.k === 'pit' && c.boards[q.b]?.reboot && !c.boards[q.b].dock);
  if (pit >= 0) {
    const gh = [{ x: pit % c.w, y: Math.floor(pit / c.w), d: 0, n: 1, fell: true, path: [[archive.x, archive.y], [pit % c.w, Math.floor(pit / c.w)]] }];
    const r = rebootFor(c, archive, gh, archive);
    const b = c.boards[c.cells[pit].b].reboot;
    check(r.x === b.x && r.y === b.y && !r.archive, 'ring: falling into a pit on another board uses that board’s ring');
  }
  check(topicAtCell(c, archive.x, archive.y, 0.5, 0.5, { ring: { x: archive.x, y: archive.y } }).includes('reboot-ring'), 'the map: my lit start pad answers "reboot ring"');
  check(/your color/.test(TOPICS['reboot-ring'].fine), 'the Guide: the reboot ring says yours is lit in your color');
}

// ----- the map hit-test, on every course -----
const kinds = new Set();
for (const info of COURSES) {
  const c = getCourse(info.id);
  for (let y = -1; y <= c.h; y++) {
    for (let x = -1; x <= c.w; x++) {
      for (const [fx, fy] of [[0.5, 0.5], [0.1, 0.5], [0.9, 0.5], [0.5, 0.1], [0.5, 0.9]]) for (const id of topicAtCell(c, x, y, fx, fy)) kinds.add(id);
    }
  }
  // specific squares
  const belt = c.cells.findIndex((q) => q?.k === 'belt' && !c.lasers.length);
  if (belt >= 0) check(topicAtCell(c, belt % c.w, Math.floor(belt / c.w))[0]?.startsWith('belt'), `${info.id}: a belt is a belt`);
  check(topicAtCell(c, -1, 0)[0] === 'edge', `${info.id}: off the board is the edge`);
  const cp = c.checkpoints[0];
  check(topicAtCell(c, cp.x, cp.y).includes('flag'), `${info.id}: a flag is a flag`);
  const rb = c.boards.find((b) => b.reboot)?.reboot;
  if (rb) check(topicAtCell(c, rb.x, rb.y).includes('reboot-ring'), `${info.id}: the reboot ring`);
  const L = c.lasers[0];
  if (L) check(topicAtCell(c, L.x, L.y).includes('board-laser'), `${info.id}: a laser's square`);
  const P = c.pushers[0];
  if (P) check(topicAtCell(c, P.x, P.y, P.side === 1 ? 0.95 : P.side === 3 ? 0.05 : 0.5, P.side === 0 ? 0.05 : P.side === 2 ? 0.95 : 0.5).includes('pusher'), `${info.id}: a push panel`);
}
for (const k of ['belt-green', 'belt-blue', 'gear', 'pit', 'battery', 'wall', 'pusher', 'flag', 'reboot-ring', 'board-laser', 'edge', 'dock']) check(kinds.has(k), `the map can answer "${k}"`);
{
  const c = getCourse('closing-time');
  const st = c.starts[0];
  const at = topicAtCell(c, st.x, st.y, 0.5, 0.5, { robots: [{ ...st, me: true }], ghosts: [{ x: st.x, y: st.y, path: [[st.x, st.y]] }] });
  check(at[0] === 'me' && at.includes('line') && at.includes('dock'), `my robot first, then the line, then the square (${at})`);
}

// ----- marks and replays -----
{
  const steps = [['s', 3, 5, 1], ['x', 'sp', 'm2'], ['c', ['m2'], [3, 5, 4, 5, 5, 5], 0], ['p', 'p1', [5, 5, 6, 5], [4, 5, 5, 5]], ['b', true, [6, 5, 8, 5], 1], ['l', 0, 5, 9, 0, 1], ['d', 1, 1, 'laser'], ['g', -1], ['e', 1], ['w'], ['cp', 1], ['u', 'boink', [8, 5, 8, 4], 0], ['zz', 1], ['f', false], ['r', 6, 4, 2]];
  const m = marksFor(steps, { auto: true });
  check(m.length === 3 && m[0].k === 'fall' && m[1].k === 'dmg' && m[2].k === 'pushed', `marks: the three most important (${m.map((x) => x.k)})`);
  check(m[1].sp === 1 && m[1].hw === 1, 'marks: SPAM and Haywire together');
  const causes = causesFor(steps, { auto: true });
  check(causes[0].k === 'auto' && causes.some((x) => x.k === 'belt' && x.fast) && causes.some((x) => x.k === 'gear'), 'the cause row lists everything in order');
  const plan = replayPlan(steps);
  check(plan.start.x === 3 && plan.start.y === 5 && plan.start.d === 1, 'replay: starts at the reveal pose');
  check(plan.segs.length === steps.length - 2, `replay: a segment per known step (${plan.segs.length})`);
  check(plan.end.x === 6 && plan.end.y === 4 && plan.end.d === 2 && plan.end.vis, 'replay: ends where I rebooted, facing the way I chose');
  const r = replayPlan([['r', 2, 2, 3], ['c', ['m1'], [2, 2, 1, 2], 0]]);
  check(r.start.x === 2 && !r.start.vis && r.end.x === 1, 'replay: a register that begins with a reboot');
  const cards = ranCards(steps);
  check(cards[0].t === 'sp' && cards[0].was && cards[1].t === 'm2' && !cards[1].was, 'the replay header: the replaced card greyed, then what ran');
  const crop = cropFor(getCourse('closing-time'), [[3, 5], [8, 5]], 340, 212);
  check(crop.tile >= 28 && crop.tile <= 56, `the replay crops to 28-56 px squares (${crop.tile})`);
  const far = cropFor(getCourse('closing-time'), [[0, 0], [12, 9]], 340, 212, { x: 3, y: 5 });
  check(far.tile === 28, 'a big replay centres on my robot');
  // the view never shows space beyond the course, and what happened stays in it (it shifts, not centres blindly)
  for (const info of COURSES) {
    const c = getCourse(info.id);
    for (const [W, H] of [[328, 205], [398, 249]]) {
      for (const [x, y] of [[0, 0], [1, 4], [c.w - 1, c.h - 1], [0, c.h - 1], [c.w - 1, 0], [6, 5], [-1, 3]]) {
        const cells = [[x, y], [x + 1, y], [x + 1, y + 1]];
        const v = cropFor(c, cells, W, H, { x, y });
        const inside = v.ox <= 0.01 && v.ox + c.w * v.tile >= W - 0.01 && v.oy <= 0.01 && v.oy + c.h * v.tile >= H - 0.01;
        check(inside, `${info.id} ${W}x${H}: a replay at ${x},${y} stays inside the course (${JSON.stringify(v)})`);
        const sx = v.ox + (Math.max(0, Math.min(c.w - 1, x)) + 0.5) * v.tile;
        const sy = v.oy + (Math.max(0, Math.min(c.h - 1, y)) + 0.5) * v.tile;
        check(sx > 0 && sx < W && sy > 0 && sy < H, `${info.id} ${W}x${H}: my robot at ${x},${y} is in view`);
      }
    }
  }
}

console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
