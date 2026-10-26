// The animation lab's stage: the game's real 3D arena (games/robo-rally/scene.js) on a tiny board, with the
// real robots, plus a small API an animation uses to take over the moment. README.md explains it.
import * as THREE from '/games/robo-rally/lib/three.module.min.js';
import { Arena } from '/games/robo-rally/scene.js';
import { PIECES, COURSES } from '/games/robo-rally/board.js';
import { SCENARIOS, beatTime } from './scenarios.js';

const TAU = Math.PI * 2;
const BOT_SCALE = 1.18; // scene.js draws every robot at this size
export const LEAD = 0.6; // seconds of calm before the moment starts
export const TAIL = 1.0; // seconds of the game carrying on after it
const FOV = 32;

export const ease = {
  linear: (k) => k,
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) ** 2,
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  in3: (k) => k ** 3,
  out3: (k) => 1 - (1 - k) ** 3,
  inOut3: (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  inBack: (k, s = 1.70158) => (s + 1) * k ** 3 - s * k ** 2,
  outBack: (k, s = 1.70158) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2,
  outElastic: (k) => (k === 0 || k === 1 ? k : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: (k) => {
    const n = 7.5625;
    const d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  },
};
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
export const facing = (d) => -d * (Math.PI / 2); // a robot's rotation.y when it faces d

function registerCourse(id, sc) {
  const cid = `lab-${id}`;
  if (!PIECES[cid]) {
    PIECES[cid] = { name: sc.title, grid: sc.grid, walls: sc.walls, lasers: sc.lasers, pushers: sc.pushers, reboot: sc.reboot };
    COURSES.push({ id: cid, name: sc.title, pieces: [[cid, 0, 0]], checkpoints: sc.checkpoints ?? [] });
  }
  return cid;
}

/** The real Arena, driven by the lab's clock instead of its own loop. */
class LabArena extends Arena {
  constructor(container) {
    super(container);
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.dt = 1 / 60;
    this.clock = { getDelta: () => this.dt };
    // previews skip drawing the frames nobody will look at
    this.skipRender = false;
    const draw = this.composer.render.bind(this.composer);
    this.composer.render = (dt) => this.skipRender || draw(dt);
    const plain = this.renderer.render.bind(this.renderer);
    this.renderer.render = (s, c) => this.skipRender || plain(s, c);
  }
  adapt() {} // keep full quality: the lab is for looking closely
  setCourse(id) {
    super.setCourse(id);
    // scene.js draws the floor in the transparent pass (transparent + alphaTest), so lasers and sparks on the
    // far half of the board, sorted before it, get painted over. The cut-out works the same as opaque.
    this.board.traverse((o) => {
      if (o.material?.transparent && o.material.alphaTest > 0) {
        o.material.transparent = false;
        o.material.needsUpdate = true;
      }
    });
  }
  fitCamera() {
    super.fitCamera();
    if (!this.camHome) return;
    const view = this.lab?.scenario.view ?? this.view ?? {};
    this.camHome.dist *= 0.94 * (view.zoom ?? 1); // a little closer than the game's framing, so the details read in a small video
    if (view.shift) this.camHome.target.add(new THREE.Vector3(view.shift[0], 0, view.shift[1]));
    this.camCur = null;
    super.placeCamera(0);
  }
  placeCamera(t) {
    if (!this.lab) return super.placeCamera(t);
    this.lab._tick(); // after the robots and effects are placed, before the camera and the render
    if (!this.lab._applyCamera(t)) super.placeCamera(t);
    this.lab._shakeCamera();
  }
}

/**
 * Build the stage for one scenario. `capture` makes it deterministic (fixed 30 fps steps, driven by render.mjs).
 * Returns the lab (see README.md for the full API).
 */
export async function createLab({ container, overlay, scenario: id, capture = false }) {
  const sc = SCENARIOS[id];
  if (!sc) throw new Error(`no scenario "${id}" (have: ${Object.keys(SCENARIOS).join(', ')})`);
  const arena = new LabArena(container);
  arena.view = sc.view;
  const cid = registerCourse(id, sc);

  let seed = 20261026;
  const lab = {
    THREE,
    ease,
    facing,
    arena,
    scenario: sc,
    id,
    capture,
    overlay,
    scene: arena.scene,
    camera3: arena.camera,
    renderer: arena.renderer,
    group: null, // everything you add with lab.add() lives here and is cleared between loops
    timeScale: 1, // < 1 is slow motion for everything on screen (belts, effects, your own waits)
    real: 0, // real seconds since the stage started (what the video shows)
    warnings: [],
    _timers: [],
    _realTimers: [],
    _hooks: new Set(),
    _puppets: new Map(),
    _cleanups: [],
    _cam: null,
    _shake: null,

    get t() {
      return arena.time;
    },
    /** Seeded random numbers in [0, 1): the same every run, so captures are repeatable. */
    rand() {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(a, b) {
      return a + lab.rand() * (b - a);
    },

    // ----- time -----
    /** Run fn after `sec` seconds of scene time (slow motion stretches it). */
    at(sec, fn) {
      const timer = { t: arena.time + Math.max(0, sec), fn };
      lab._timers.push(timer);
      return timer;
    },
    wait(sec) {
      return new Promise((ok) => lab.at(sec, ok));
    },
    /** Wait in real seconds, whatever the time scale. */
    waitReal(sec) {
      return new Promise((ok) => lab._realTimers.push({ t: lab.real + sec, fn: ok }));
    },
    /** Call fn(e, k) every frame for `dur` scene seconds; e is eased k. Resolves when done. */
    tween(dur, fn, easing = ease.inOut) {
      return new Promise((ok) => {
        const t0 = arena.time;
        fn(easing(0), 0);
        const hook = () => {
          const k = dur <= 0 ? 1 : Math.min(1, (arena.time - t0) / dur);
          fn(easing(k), k);
          if (k >= 1) {
            lab._hooks.delete(hook);
            ok();
          }
        };
        lab._hooks.add(hook);
      });
    },
    /** Call fn(dt, t) every frame until the returned stop() is called. */
    every(fn) {
      let last = arena.time;
      const hook = () => {
        const dt = arena.time - last;
        last = arena.time;
        fn(dt, arena.time);
      };
      lab._hooks.add(hook);
      return () => lab._hooks.delete(hook);
    },
    /** Ease the time scale to `to` over `dur` real seconds. */
    slowmo(to, dur = 0.25) {
      const from = lab.timeScale;
      const t0 = lab.real;
      return new Promise((ok) => {
        const hook = () => {
          const k = dur <= 0 ? 1 : Math.min(1, (lab.real - t0) / dur);
          lab.timeScale = from + (to - from) * ease.inOut(k);
          if (k >= 1) {
            lab._hooks.delete(hook);
            ok();
          }
        };
        lab._hooks.add(hook);
      });
    },

    // ----- the board and robots -----
    /** The arena's robot record: { group, model: { body, base, paint, trim, glow, eye, muzzle, spin }, x, y, rot, visible }. */
    bot(key) {
      return arena.bots.get(key);
    },
    /** World position of the centre of space (x, y) on the floor. Fractions and off-board spaces work. */
    pos(x, y) {
      return arena.pos(x, y);
    },
    /** Screen position (CSS px, for lab.overlay) of a world point. */
    toScreen(v) {
      const p = v.clone().project(arena.camera);
      const r = container.getBoundingClientRect();
      return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height, behind: p.z > 1 };
    },
    add(obj) {
      lab.group.add(obj);
      return obj;
    },
    /** Run fn when this loop ends (restore lights, fog, anything shared you changed). */
    cleanup(fn) {
      lab._cleanups.push(fn);
    },

    /**
     * Take a robot over. Returns a puppet whose pose you set; it's applied every frame on top of the game's
     * own placement until you release it.
     *   pose: { x, y } (spaces, fractions ok), lift (world units up), rot (radians, facing(d) faces d),
     *         pitch (lean forward +), roll (lean right +), sx, sy, sz (squash/stretch from the floor), visible
     *   puppet.release(state) hands the robot back to the game resting at state { x, y, d, on }
     *   (default: where the pose is now). puppet.each = (model, t) => {...} runs after the pose each frame,
     *   for parts: model.body, model.base, model.eye, model.glow (emissive), model.paint, model.spin.
     */
    puppet(key) {
      const b = arena.bots.get(key);
      if (!b) throw new Error(`no robot "${key}"`);
      lab._puppets.get(key)?.release();
      b.anims = [];
      b.busyUntil = 0;
      const pose = { x: b.x, y: b.y, lift: 0, rot: b.rot, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, visible: b.visible };
      const puppet = {
        key,
        bot: b,
        group: b.group,
        model: b.model,
        pose,
        each: null,
        set(p) {
          Object.assign(pose, p);
          return puppet;
        },
        face(d) {
          pose.rot = facing(d);
          return puppet;
        },
        release(state = {}) {
          if (lab._puppets.get(key) !== puppet) return;
          lab._puppets.delete(key);
          const on = state.on ?? pose.visible;
          b.x = state.x ?? Math.round(pose.x);
          b.y = state.y ?? Math.round(pose.y);
          b.rot = state.d != null ? pose.rot + wrap(facing(state.d) - pose.rot) : pose.rot;
          b.visible = on !== false;
          b.group.rotation.order = 'XYZ';
          b.model.body.rotation.set(0, 0, 0);
          b.anims = [];
          b.busyUntil = 0;
        },
      };
      b.group.rotation.order = 'YXZ';
      lab._puppets.set(key, puppet);
      return puppet;
    },
    /** Put a robot's resting state somewhere without animating (what the game would now hold). */
    rest(key, { x, y, d, on }) {
      const b = arena.bots.get(key);
      if (x != null) b.x = x;
      if (y != null) b.y = y;
      if (d != null) b.rot = b.rot + wrap(facing(d) - b.rot);
      if (on != null) b.visible = on;
    },

    // ----- camera -----
    /**
     * Drive the camera: fn(home, t) returns { target (Vector3), az, el, dist, fov, roll } (anything left out
     * stays at home). home = { target, az: 0, el, dist, fov }. Returns release(); the camera then eases home.
     */
    camera(fn) {
      const cam = { fn };
      lab._cam = cam;
      return () => {
        if (lab._cam === cam) lab._cam = null;
      };
    },
    /** Shake the camera: amount in world units, decaying over dur scene seconds. */
    shake(amount = 0.15, dur = 0.4) {
      lab._shake = { t0: arena.time, amount, dur };
    },
    /** A full-screen flash on the overlay. */
    flash(color = '#fff', dur = 0.25, peak = 0.8) {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;inset:0;background:${color};opacity:${peak};pointer-events:none`;
      overlay.append(el);
      return lab.tween(dur, (e) => (el.style.opacity = String(peak * (1 - e))), ease.out).then(() => el.remove());
    },

    // ----- the game's own effects (scene.js) -----
    /** Play one beat the way the real game does (fx list as in scenarios.js). Resolves after the game's beat time. */
    beat(fx) {
      arena.playBeat({ fx }, lab._afterList());
      return lab.wait(beatTime(fx));
    },
    /** The game's current animation for this scenario, beat by beat. */
    async baseline() {
      for (const fx of sc.beats) await lab.beat(fx);
      // a beat can outlast its slot (a fall runs into the next beat); let the robots finish
      while ([...arena.bots.values()].some((b) => b.busyUntil > arena.time)) await lab.wait(1 / 30);
    },
    sparks: (at, color, n) => arena.sparks(at, color, n),
    confetti: (at, colors, n) => arena.confetti(at, colors, n),
    ring: (at, color, size) => arena.ring(at, color, size),
    float: (at, text, color, delay, height) => arena.float(at, text, color, delay, height),
    particles: (at, colors, n, opts) => arena.particles(at, colors, n, opts),
    beam: (f) => arena.beam(f, arena.bots.get(f.src)),
    showCard: (key, types) => arena.showCard(arena.bots.get(key), types),

    // ----- internals -----
    _afterList() {
      return Object.entries(sc.bots).map(([key, r]) => ({ id: key, ...r, ...(sc.after[key] ?? {}) }));
    },
    _tick() {
      const due = (list, now) => {
        const out = [];
        for (let i = list.length - 1; i >= 0; i--) if (list[i].t <= now) out.push(...list.splice(i, 1));
        return out.sort((a, b) => a.t - b.t);
      };
      for (const tm of due(lab._timers, arena.time)) tm.fn();
      for (const tm of due(lab._realTimers, lab.real)) tm.fn();
      for (const hook of [...lab._hooks]) hook();
      for (const p of lab._puppets.values()) {
        const g = p.group;
        const q = p.pose;
        g.visible = q.visible !== false;
        const at = arena.pos(q.x, q.y);
        g.position.set(at.x, q.lift, at.z);
        g.rotation.set(q.pitch ? -q.pitch : 0, q.rot, q.roll ? -q.roll : 0);
        g.scale.set(BOT_SCALE * q.sx, BOT_SCALE * q.sy, BOT_SCALE * q.sz);
        p.model.body.rotation.x = 0;
        p.each?.(p.model, arena.time);
      }
    },
    _applyCamera(t) {
      const home = arena.camHome;
      if (!home) return false;
      const cam = arena.camera;
      if (!lab._cam) {
        if (Math.abs(cam.fov - FOV) > 0.01) {
          cam.fov += (FOV - cam.fov) * 0.08;
          cam.updateProjectionMatrix();
        }
        return false;
      }
      const h = { target: home.target.clone(), az: 0, el: home.elev, dist: home.dist, fov: FOV };
      const c = { ...h, ...(lab._cam.fn(h, t) ?? {}) };
      arena.camCur = { az: c.az, d: c.dist, el: c.el, tgt: c.target.clone() };
      cam.position.set(c.target.x + Math.sin(c.az) * Math.cos(c.el) * c.dist, c.target.y + Math.sin(c.el) * c.dist, c.target.z + Math.cos(c.az) * Math.cos(c.el) * c.dist);
      cam.lookAt(c.target);
      if (c.roll) cam.rotateZ(c.roll);
      if (Math.abs(cam.fov - c.fov) > 0.001) {
        cam.fov = c.fov;
        cam.updateProjectionMatrix();
      }
      return true;
    },
    _shakeCamera() {
      const s = lab._shake;
      if (!s) return;
      const k = (arena.time - s.t0) / s.dur;
      if (k >= 1) return (lab._shake = null);
      const a = s.amount * (1 - k) ** 2;
      arena.camera.position.add(new THREE.Vector3((lab.rand() - 0.5) * 2 * a, (lab.rand() - 0.5) * 2 * a, (lab.rand() - 0.5) * 2 * a));
    },

    /** Set the stage to the scenario's "before" state. */
    reset() {
      for (const fn of lab._cleanups.splice(0)) {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      }
      lab._timers = [];
      lab._realTimers = [];
      lab._hooks.clear();
      lab._puppets.clear();
      lab._cam = null;
      lab._shake = null;
      lab.timeScale = 1;
      seed = 20261026;
      overlay.replaceChildren();
      for (const e of arena.effects) e.end?.();
      arena.effects = [];
      for (const obj of [...arena.fxGroup.children]) arena.fxGroup.remove(obj);
      if (lab.group) arena.scene.remove(lab.group);
      lab.group = new THREE.Group();
      arena.scene.add(lab.group);
      for (const b of arena.bots.values()) arena.scene.remove(b.group);
      arena.bots.clear();
      arena.focusOn = null;
      arena.course = null;
      arena.setCourse(cid);
      const list = Object.entries(sc.bots).map(([key, r]) => ({ id: key, ...r }));
      arena.syncRobots(list.filter((r) => r.on !== false));
      for (const r of list) {
        if (r.on !== false) continue; // starts off the board: build it hidden so an animation can bring it in
        const b = arena.addBot(r);
        Object.assign(b, { x: r.x, y: r.y, rot: facing(r.d), visible: false });
      }
      for (const b of arena.bots.values()) b.pop = -10; // no pop-in: everyone is already on the board
      arena.camCur = null;
    },

    /** End of the moment: check the picture matches the game's "after" state, then hand everything back. */
    finish() {
      const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
      for (const [key, r] of Object.entries(sc.bots)) {
        const b = arena.bots.get(key);
        const want = { ...r, ...(sc.after[key] ?? {}) };
        const g = b.group;
        const shown = g.visible && g.scale.y > BOT_SCALE * 0.2;
        if (want.on === false) {
          if (shown && g.position.y > -0.3) lab.warnings.push(`${r.name} should be gone (off the board) at the end, but is still visible`);
        } else {
          if (!shown) lab.warnings.push(`${r.name} should be on the board at the end, but is hidden or tiny`);
          const gap = near(g.position, arena.pos(want.x, want.y));
          if (gap > 0.12) lab.warnings.push(`${r.name} ends ${gap.toFixed(2)} spaces from (${want.x}, ${want.y}); the game will snap it there`);
          const turnGap = Math.abs(wrap(g.rotation.y - facing(want.d)));
          if (turnGap > 0.15) lab.warnings.push(`${r.name} ends turned ${Math.round((turnGap * 180) / Math.PI)}° away from its facing; the game will snap it`);
          if (Math.abs(g.position.y) > 0.12 && !b.model.body.userData.hover) lab.warnings.push(`${r.name} ends ${g.position.y.toFixed(2)} above/below the floor`);
        }
      }
      for (const p of [...lab._puppets.values()]) p.release();
      lab._cam = null;
      lab.timeScale = 1;
      for (const [key, r] of Object.entries(sc.bots)) lab.rest(key, { ...r, ...(sc.after[key] ?? {}) });
    },

    /** One frame: dt real seconds (scaled by timeScale for the scene). */
    frame(dt, draw = true) {
      lab.real += dt;
      arena.dt = dt * lab.timeScale;
      arena.skipRender = !draw;
      arena.frame();
    },
  };
  arena.lab = lab;

  // scene.js uses setTimeout for a few delayed effects; run those on the scene clock so slow motion
  // and capture stay in step.
  const realTimeout = window.setTimeout.bind(window);
  window.__realSetTimeout = realTimeout;
  let timerId = 1;
  const pending = new Map();
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = timerId++;
    pending.set(id, lab.at(ms / 1000, () => pending.has(id) && (pending.delete(id), fn(...args))));
    return id;
  };
  window.clearTimeout = (id) => pending.delete(id);

  lab.reset();
  arena.resize();
  return lab;
}
