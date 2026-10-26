# Robo Rally animation lab (Lumen)

A stage for trying animation ideas for the big moments of Robo Rally (a push, a fall, a laser hit...) inside the
**Lumen** look's real 3D arena (`looks/three/games/robo-rally/scene.js`): the same smoked-glass board, light, robots
and effects, on a tiny board set up for one moment. Read `looks/three/concepts.md` (the pick at the bottom) for
what Lumen is. Each idea is one small ES module. `render.mjs` turns it into a smooth video and a contact sheet.

Nothing here is loaded by the game. A winning idea gets ported into Lumen's `scene.js` later.

**Lumen in one paragraph:** a slab of smoked glass floats in a dark room, and every board element is drawn with
light: belts are streams of light under the glass, pits are holes where the light is missing, walls are bright
fins, lasers are lines of light, checkpoints are columns of light. Robots are polished forms (Pebble, Orb, Prism,
Capsule, Cube, Spire) in their player's colour, each with a light (its eye) at the front, a ring of light on the
glass and a pointer showing which way it faces, and they leave a fading trail of light where they go. One
material (glass), one light (warm white) plus the players' own colours, thin type, soft glass sounds.

## Files

- `scenarios.js` — the moments: board, robots, what happens in the rules, the "before" and "after" state, and the
  beats the real engine sends (`fx`). **Read the entry for your scenario first.**
- `lab.js` — the stage and the API below. `stage.html` loads one animation (`?anim=...`), `serve.mjs` serves it.
- `render.mjs` — renders to `out/<scenario>/<name>.mp4` + `.sheet.jpg` + `.json`.
- `<scenario>/<name>.js` — the animations. Files starting with `_` are examples, not entries.

## Render and look

```sh
node labs/animations/render.mjs push/baseline --preview          # what Lumen does today
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
the command a long timeout (10 minutes), and render several files in one command when you can. Every video
starts with 0.6 s of calm and ends with 1 s of the game carrying on.

## Writing an animation

```js
// labs/animations/push/2b-my-idea.js
export const meta = {
  title: 'Short name',                       // shown in the gallery
  idea: 'One or two sentences: what happens and why it delights.',
  notes: 'Optional: the sound you imagine (Lumen synthesizes glass sounds), porting notes, how it varies.',
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
2 south (toward camera), 3 west. One space = 1 world unit; the glass top is at y = 0, the slab is 0.36 thick,
and the dark room's floor is far below at y = -1.6.

### The API (`lab`)

Time (everything runs on the scene clock, so it's deterministic and slow motion works; **never use `setTimeout`,
`Date.now`, `performance.now` or `requestAnimationFrame` yourself**):

- `await lab.wait(sec)`, `lab.at(sec, fn)` — scene seconds.
- `await lab.tween(dur, (e, k) => {...}, lab.ease.outBack)` — called every frame; `k` goes 0→1, `e` is eased.
  Eases: `linear in out inOut in3 out3 inOut3 inBack outBack outElastic outBounce`.
- `const stop = lab.every((dt, t) => {...})` — every frame until `stop()`.
- `lab.timeScale` (1 = normal), `await lab.slowmo(0.3, 0.1)` eases it (to, over real seconds). Slow motion counts
  toward your time budget in real seconds.
- `lab.real` is real seconds since the stage started and `await lab.waitReal(sec)` waits in real time. `lab.wait`,
  `lab.tween` and `lab.flash` run on the scene clock, so during a slow-motion freeze they freeze too: time a freeze
  frame's own effects on `lab.real` (`lab.every` plus `lab.real`).
- `lab.rand()`, `lab.range(a, b)` — seeded random. (`Math.random` is seeded too in captures.)

Robots:

- `const p = lab.puppet('a')` — takes the robot over. Set its pose every frame with `p.set({...})`:
  `x, y` (spaces, fractions fine, off-board fine), `lift` (world units up), `rot` (radians; `lab.facing(d)` is the
  rotation for facing d, and turning right is negative), `pitch` (lean forward +), `roll` (lean right +),
  `sx, sy, sz` (squash and stretch from the glass up), `visible`, `trail` (default true: it leaves Lumen's light
  trail on the glass as it moves, like the game's own moves; set false to move without one).
  `p.each = (model, t) => {...}` runs after the pose every frame, for the parts: `model.body` (everything above
  the ring), `model.paint` (its polished material: `color`, `emissive`, `emissiveIntensity`), `model.eyeMat` (its
  light; the game sets `color` each frame, so set yours here), `model.ringMat` / `model.poolMat` (the ring of
  light and the glow pool on the glass: `opacity`, `color`), `model.muzzle` (where the laser leaves).
  `p.group` is the robot's Object3D; `p.bot.trail` is its trail points.
- Hooks (`lab.every`, `lab.tween`) run before puppet poses are applied each frame, so inside them `p.group.position`
  is still the game's resting spot. Work from `p.pose`, or place things in `p.each`, which runs after the pose.
- `p.release({ x, y, d, on })` — hand the robot back to the game, resting there (`on: false` = gone).
- `lab.rest('b', { x, y, d, on })` — change where the game thinks a robot rests, without animating.
- `lab.bot('a')` — the arena's own record (`group`, `model`, `x`, `y`, `rot`, `visible`, `trail`, `card`, `tag`).
- Robots that start off the board (the reboot scenario) exist but are hidden: puppet them and set `visible: true`.

Camera:

- `const release = lab.camera((home, t) => ({ target, az, el, dist, fov, roll }))` — called every frame; leave
  out anything you don't change. `home` = `{ target, az: 0, el, dist, fov }` is the game's framing. After
  `release()` the camera eases home by itself (about a second). Keep the game readable: big moves are for big,
  rare moments.
- `lab.shake(amount, dur)`, `lab.flash(color, dur, peak)`.

Drawing your own things:

- `lab.THREE` is three.js (r169). `lab.add(obj)` adds to the scene (cleared each loop). `lab.scene`,
  `lab.camera3`, `lab.renderer` are there if you need them. Lumen renders with bloom: colours brighter than 1
  (`new THREE.Color(c).multiplyScalar(2.5)` on a `MeshBasicMaterial`, additive blending, `depthWrite: false`)
  glow, which is how everything luminous in Lumen is made.
- `lab.PALETTE` — Lumen's colours (`light`, `energy`, `laser`, `belt`, `express`, `right`, `left`, `reboot`, `void`).
- `lab.pos(x, y)` — world position (Vector3) of a space's centre on the glass.
- `lab.overlay` — a DOM layer over the picture (absolutely position things in it; `lab.toScreen(vec3)` gives
  CSS pixels). It's cleared each loop. The game would put these in its HUD layer.
- Changed something shared (lights, `arena.dim`, `arena.topMat`, the room)? Undo it in `lab.cleanup(fn)`.

The game's own effects, to reuse or to compare against (see `scene.js` for their arguments):

- `await lab.baseline()` — the game's current animation for this scenario.
- `await lab.beat(fx)` — one beat as the game plays it (as in `scenarios.js`).
- `lab.ring(at, color, size, y, dur)`, `lab.pillar(at, color, height, dur)`, `lab.particles(at, colors, n, opts)`,
  `lab.shards(at, color, n)`, `lab.motes(at, color, n, dur)`, `lab.glitch('a', color)`,
  `lab.popGlyph('a', name, color, text)`, `lab.beam(fx)`, `lab.playCard('a', ['m2'])`
  (card ids: m1 m2 m3 bk rr rl ut pu ag sp).
- On `lab.arena`: `setDim(k)` (the room's light going down, 0..1, eased), `pulse(color)`, `topMat` (the glass
  top: its `emissiveIntensity` is the board's light), `spill` (the board's light on the floor below), `key`/`hemi`
  (lights), `gears` (Map `"x,y"` → `{ mesh, extra, spin, kick, pulse }`), `pushers` (Map `"x,y"` → `{ plate, kick }`),
  `columns` (checkpoints: `[{ n, col, mat, flash, flashColor }]`), `belts` (`[{ tex, speed, mat, fast, pulse }]`),
  `batteries`, `emitters` (wall lasers), `board` (the board's meshes). Read `scene.js` to see how they're built.
- `lab.events` lists what the game would have played a sound for (it calls `arena.emit`).

## Rules of the lab

- **The game must be able to carry on.** However wild the moment, it ends with every robot exactly where the
  rules put it (the scenario's `after`), the camera home, and nothing left over that would confuse a player.
- **Stay inside the time budget** (`budget` in `scenarios.js`, real seconds, slow motion included).
- **Readable from across the room** on a TV: in the real game the board is 10-13 spaces wide and the bottom of
  the screen is HUD, so a robot is small. The idea has to read in light, silhouette and motion, not fine detail.
- **It should feel like Lumen**: made of light and glass. Surprise is the point, and an idea may break the look
  on purpose for a beat, but it should come home to it.
- Keep it self-contained: one `.js` file per entry, no new libraries, no network, no images (draw with three.js,
  canvas textures or DOM).
