# Robo Rally animation lab

A stage for trying animation ideas for the big moments of Robo Rally (a push, a fall, a laser hit...), inside
the game's **real** 3D arena: the same store, board, robots, lights and effects as `games/robo-rally/scene.js`,
on a tiny board set up for one moment. Each idea is one small ES module. `render.mjs` turns it into a smooth
video and a contact sheet of frames you can look at.

Nothing here is loaded by the game. A winning idea gets ported into `scene.js` later.

## Files

- `scenarios.js` — the moments: board, robots, what happens in the rules, the "before" and "after" state, and the
  beats the real engine sends (`fx`). **Read the entry for your scenario first.**
- `lab.js` — the stage and the API below. `stage.html` loads one animation (`?anim=...`), `serve.mjs` serves it.
- `render.mjs` — renders to `out/<scenario>/<name>.mp4` + `.sheet.jpg` + `.json`.
- `<scenario>/<name>.js` — the animations. Files starting with `_` are examples, not entries.

## Render and look

```sh
node labs/animations/render.mjs push/baseline --preview          # what the game does today
node labs/animations/render.mjs push/2b-my-idea.js --preview     # fast: 640x360, a contact sheet only
node labs/animations/render.mjs push/2b-my-idea.js               # final: 960x540 30 fps mp4 + sheet
```

Then **look at the contact sheet** with the Read tool (`labs/animations/out/push/2b-my-idea.sheet.jpg`). It has a
frame every 0.125 s (preview) or 0.25 s (final), timestamped, with any warnings in the title line. Use
`--every 0.0333` to see every frame of a short moment. To check a single frame up close:
`ffmpeg -loglevel error -y -ss 1.2 -i labs/animations/out/push/2b-my-idea.mp4 -frames:v 1 /path/frame.jpg`.

The render prints warnings when the end of your animation doesn't match the game's "after" state (a robot in the
wrong space, still visible after a fall, floating), when the moment runs over the scenario's time budget, or when
the module throws. **An entry is done when it renders with no warnings.**

Only 3 renders run at once on this machine (others wait for a slot), so prefer `--preview` while iterating and
do one final render per entry. A render can sit in the queue for several minutes when the machine is busy: give
the command a long timeout (10 minutes), and render several files in one command when you can. Every video starts with 0.6 s of calm and ends with 1 s of the game carrying on.

## Writing an animation

```js
// labs/animations/push/2b-my-idea.js
export const meta = {
  title: 'Short name',                       // shown in the gallery
  idea: 'One or two sentences: what happens and why it delights.',
  notes: 'Optional: sound you imagine, what it takes to port, how it varies between plays.',
};

export default async function play(lab) {
  const maya = lab.puppet('a');              // take over a robot
  await lab.tween(0.4, (e) => maya.set({ x: 1 + 2 * e }), lab.ease.out);
  maya.release({ x: 3, y: 2, d: 1 });        // hand it back where the game says it is
}
```

`play` runs once per loop, after 0.6 s of calm. When it resolves, the stage checks the picture against the
scenario's `after` state, then snaps everything to it (so a mismatch shows as a jump) and lets the game carry on.

Robots are keyed as in `scenarios.js` (`a` is always the robot the moment happens to; `b`, `c` are others).
Spaces: x grows to the right, y grows toward the camera; facing d: 0 north (away from camera), 1 east (right),
2 south (toward camera), 3 west. One space = 1 world unit; the floor is at y = 0; the store floor is at y = -0.42.

### The API (`lab`)

Time (everything runs on the scene clock, so it's deterministic and slow motion works; **never use `setTimeout`,
`Date.now`, `performance.now` or `requestAnimationFrame` yourself**):

- `await lab.wait(sec)`, `lab.at(sec, fn)` — scene seconds.
- `await lab.tween(dur, (e, k) => {...}, lab.ease.outBack)` — called every frame; `k` goes 0→1, `e` is eased.
  Eases: `linear in out inOut in3 out3 inOut3 inBack outBack outElastic outBounce`.
- `const stop = lab.every((dt, t) => {...})` — every frame until `stop()`.
- `lab.timeScale` (1 = normal), `await lab.slowmo(0.3, 0.1)` eases it (to, over real seconds). Slow motion counts
  toward your time budget in real seconds.
- `lab.rand()`, `lab.range(a, b)` — seeded random. (`Math.random` is seeded too in captures.)

Robots:

- `const p = lab.puppet('a')` — takes the robot over. Set its pose every frame with `p.set({...})`:
  `x, y` (spaces, fractions fine, off-board fine), `lift` (world units up), `rot` (radians; `lab.facing(d)` is the
  rotation for facing d, and turning right is negative), `pitch` (lean forward +), `roll` (lean right +),
  `sx, sy, sz` (squash and stretch from the floor up), `visible`. `p.each = (model, t) => {...}` runs after the
  pose every frame for the parts: `model.body` (everything above the base), `model.base`, `model.eye`,
  `model.glow` (its emissive material: the base ring and arrow), `model.paint`, `model.trim`, `model.spin`
  (spinning parts), `model.muzzle` (where the laser comes out). `p.group` is the robot's Object3D.
- `p.release({ x, y, d, on })` — hand the robot back to the game, resting there (`on: false` = gone).
- `lab.rest('b', { x, y, d, on })` — change where the game thinks a robot rests, without animating.
- `lab.bot('a')` — the arena's own record for a robot (`group`, `model`, `x`, `y`, `rot`, `visible`, `name`, `color`).
- Robots that start off the board (the reboot scenario) exist but are hidden: puppet them and set `visible: true`.

Camera:

- `const release = lab.camera((home, t) => ({ target, az, el, dist, fov, roll }))` — called every frame; leave
  out anything you don't change. `home` = `{ target, az: 0, el, dist, fov }` is the game's framing. After
  `release()` the camera eases home by itself (about a second). Keep the game readable: big moves are for big,
  rare moments.
- `lab.shake(amount, dur)`, `lab.flash(color, dur, peak)`.

Drawing your own things:

- `lab.THREE` is three.js (r169). `lab.add(obj)` adds to the scene (cleared each loop). `lab.scene`,
  `lab.camera3`, `lab.renderer` are there if you need them.
- `lab.pos(x, y)` — world position (Vector3) of a space's centre on the floor.
- `lab.overlay` — a DOM layer over the picture (absolutely position things in it; `lab.toScreen(vec3)` gives
  CSS pixels). It's cleared each loop. Good for 2D graphic touches; the game would put these in its HUD layer.
- Changed something shared (lights, fog, `lab.scene.background`, the store)? Undo it in `lab.cleanup(fn)`.

The game's own effects, to reuse or to compare against:

- `await lab.baseline()` — the game's current animation for this scenario.
- `await lab.beat(fx)` — one beat as the game plays it (fx as in `scenarios.js`).
- `lab.sparks(at, color, n)`, `lab.confetti(at, colors, n)`, `lab.ring(at, color, size)`,
  `lab.float(at, text, color)`, `lab.particles(at, colors, n, { speed, up, gravity, size, dur })`,
  `lab.beam(fx)`, `lab.showCard('a', ['m2'])` (card ids: m1 m2 m3 bk rr rl ut pu ag sp).
- The board's moving parts live on `lab.arena`: `gears` (Map `"x,y"` → `{ mesh, extra, kick }`), `pushers` (Map
  `"x,y"` → `{ plate, kick }`), `flags` (`[{ flag, baseMat, n, flash }]`), `belts` (`[{ tex, speed }]`),
  `board` (the board's meshes). Read `games/robo-rally/scene.js` to see how they're built.

## Rules of the lab

- **The game must be able to carry on.** However wild the moment, it ends with every robot exactly where the
  rules put it (the scenario's `after`), the camera home, and nothing left over that would confuse a player.
- **Stay inside the time budget** (`budget` in `scenarios.js`, real seconds, slow motion included).
- **Readable from across the room** on a TV: a robot in the real game is small (the board is 10-13 spaces wide),
  so the idea has to read in silhouette and motion, not in fine detail. Subtitles and long words don't work.
- Keep it self-contained: one `.js` file per entry, no new libraries, no network, no images (draw with three.js,
  canvas textures or DOM).
