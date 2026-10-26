// Edge, idea 3 (Undo, denied), animator b: character acting.
// Maya struts off the rim and tips into the dark. Then the tape runs backward: she flies back up over the rim and
// reverses onto (6,1), her trail is reeled back in and the Move 3 card over her head swells with light again.
// Everything holds still except Maya: she blinks, sees the edge, and melts with relief... and the tape plays
// forward anyway, frame for frame the same, a little faster. Her body struts off exactly as before; only her eye is
// different this time (wide with horror, then squeezed shut). Ava gasps at exactly the same frame both times, then,
// freed from the tape, slowly shakes her head: no take-backs.
export const meta = {
  title: 'Undo, denied: same tape, new feelings',
  idea:
    'Maya tips off the rim, then the picture plays backward: she flies back up over the rim onto (6,1), her trail is ' +
    'reeled back in and her Move 3 card swells with light again, as if the game offered an undo. In the still moment ' +
    'only Maya is alive: she blinks, sees the edge and sags with relief. Then the tape plays forward anyway, identical ' +
    'and a little faster: her body struts off exactly as before, but this time her eye is wide with horror the whole ' +
    'way and squeezes shut as she tips. Ava gasps on the very same frame twice, then slowly shakes her head.',
  notes:
    'Sound: take one is the normal drive and a short falling glass note; the rewind is that audio reversed (a sucked-' +
    'in glass swell, the card\'s chime played backward); the pause is near silence with one tiny glass "blink" tick ' +
    'and a soft exhale chord; the replay is the same audio again at 1.4x (a little higher). Port: the take is a pure ' +
    'function of "tape time", so the rewind and replay just scrub it; the trail is kept with the tape time each point ' +
    'was drawn at, so rewinding reels it in and un-fades it. The room dims a touch while the tape is stopped. Only the ' +
    'eye differs between the takes, which is the joke: the body is a recording, the feelings are live.',
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (T, a, b) => clamp((T - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const bump = (k) => Math.sin(Math.PI * clamp(k)); // 0 → 1 → 0

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const A = lab.arena;
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const mb = maya.bot;
  maya.set({ trail: false }); // the trail is kept on the tape (below), so it can be reeled back in
  ava.set({ trail: false });
  mb.trail = [];
  const mayaEye = maya.model.body.children.find((o) => o.material === maya.model.eyeMat);
  const ring = maya.group.children.find((o) => o.material === maya.model.ringMat && o.geometry?.type === 'RingGeometry');
  // echoes of her ring, only while the tape scrubs backward: the rewind leaves a smear of light
  const ECHO = 6;
  const echoes = [];
  for (let i = 0; i < ECHO; i++) {
    const m = new THREE.Mesh(ring.geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(mb.color).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.matrixAutoUpdate = false;
    m.renderOrder = 4;
    lab.add(m);
    echoes.push(m);
  }
  let echoTick = 0;

  // ---------------- the tape: the first take as a function of tape time τ ----------------
  const GO = 0.14; // she sets off
  const ACC = 0.2;
  const V = 3.52; // reaches the rim (6.5) at τ = 0.95
  const RIM_T = 0.95;
  const driveX = (τ) => {
    const t = Math.max(0, τ - GO);
    return t < ACC ? 4 + (V * t * t) / (2 * ACC) : 4 + (V * ACC) / 2 + V * (t - ACC);
  };
  const T6 = GO + ACC + (6 - 4 - (V * ACC) / 2) / V; // τ when she's on (6,1)
  const OUT = 1.58; // τ when she's gone into the dark
  const tape = (τ) => {
    const m = { x: 4, lift: 0, rot: facing(1), pitch: 0, roll: 0, sx: 1, sy: 1, visible: true, eye: 1, eyeW: 1, onGlass: true };
    if (τ < GO) {
      const k = seg(τ, 0, GO);
      m.x = 4 - 0.04 * bump(k);
      m.pitch = -0.18 * bump(k);
      m.sy = 1 - 0.08 * bump(k);
      m.sx = 1 + 0.06 * bump(k);
      m.eye = 1 + 0.3 * bump(k);
    } else if (τ < RIM_T) {
      m.x = driveX(τ);
      const ph = (τ - GO) * 11;
      m.lift = 0.028 * Math.abs(Math.sin(ph)); // a strut
      m.roll = 0.06 * Math.sin(ph * 0.5);
      m.pitch = 0.08 * smooth(seg(τ, GO, GO + 0.2));
      m.sy = 1 + 0.035 * Math.sin(ph * 2);
      m.eyeW = 0.6; // content, not looking
      m.eye = 1.25;
    } else {
      // over the rim: the nose dips first (she pivots over the edge), then she drops and tumbles
      const f = τ - RIM_T;
      m.x = 6.5 + 0.75 * (1 - Math.exp(-f * 3.2));
      m.lift = -0.22 * f - 5.2 * Math.max(0, f - 0.05) ** 2;
      m.pitch = 0.08 + 1.35 * smooth(seg(f, 0, 0.22)) + 1.4 * Math.max(0, f - 0.22);
      m.roll = 0.5 * f;
      m.sy = 1 + 0.22 * smooth(seg(f, 0.08, 0.3));
      m.sx = 1 - 0.07 * smooth(seg(f, 0.08, 0.3));
      m.eyeW = lerp(0.6, 2.2, smooth(seg(f, 0.0, 0.06))); // the take: eye pops wide
      m.eye = lerp(1.25, 2.4, smooth(seg(f, 0.0, 0.06))) * (1 - smooth(seg(τ, OUT - 0.18, OUT)));
      m.visible = τ < OUT;
      m.onGlass = f < 0.03;
    }
    return m;
  };
  const LOOK = -1.0; // Ava's head turned toward Maya near the rim
  const avaTape = (τ) => {
    const a = { rot: facing(0), pitch: 0, roll: 0, sx: 1, sy: 1, lift: 0, eye: 1 };
    a.rot = LOOK * smooth(seg(τ, 0.42, 0.8));
    // the gasp as Maya tips
    const g = smooth(seg(τ, 1.0, 1.08)) * (1 - 0.6 * smooth(seg(τ, 1.35, 1.6)));
    a.sy += 0.2 * g;
    a.sx -= 0.07 * g;
    a.pitch -= 0.22 * g;
    a.lift += 0.05 * bump(seg(τ, 1.0, 1.16));
    a.eye += 1.5 * g;
    a.rot += 0.12 * g; // recoils a little away
    return a;
  };

  // ---------------- the schedule: moment time T → tape time τ ----------------
  const S = {
    take: [0, 1.32], // the first take, up to her starting to fall
    rew: [1.32, 1.8], // the rewind, back onto (6,1)
    pause: [1.8, 2.22], // the breath
    replay: [2.22, 2.22 + (OUT + 0.06 - T6) / 1.4], // the same tape, 1.4x, out for good
  };
  const CODA = [S.replay[1] - 0.12, S.replay[1] + 0.42]; // Ava: no take-backs
  const END = CODA[1] + 0.02;
  const tau = (T) => {
    if (T < S.take[1]) return T;
    if (T < S.rew[1]) return lerp(S.take[1], T6, ease.inOut(seg(T, ...S.rew)));
    if (T < S.pause[1]) return T6;
    return Math.min(OUT + 0.06, T6 + (T - S.pause[1]) * 1.4);
  };
  const mode = (T) => (T < S.take[1] ? 'take' : T < S.rew[1] ? 'rew' : T < S.pause[1] ? 'pause' : 'replay');

  // ---------------- live feelings, layered over the tape (only Maya's, only in the pause and the replay) ----------------
  const live = (T, m) => {
    const md = mode(T);
    if (md === 'pause') {
      const k = seg(T, ...S.pause);
      // a blink: the tape stopped, she's still alive
      const blink = bump(seg(k, 0.04, 0.16));
      m.eyeW = lerp(0.6, 0.06, blink);
      // she peeks at the edge ahead (a lean and a wide eye)...
      const peek = bump(seg(k, 0.18, 0.56));
      m.pitch += 0.4 * peek;
      m.lift += 0.02 * peek;
      m.eyeW = lerp(m.eyeW, 1.9, peek);
      m.eye = lerp(1.25, 2.2, peek);
      // ...and melts with relief: a big sigh down and up, eye soft and bright, a tiny happy wiggle
      const sigh = seg(k, 0.52, 1);
      m.sy *= 1 - 0.16 * bump(sigh);
      m.sx *= 1 + 0.08 * bump(sigh);
      m.eye = lerp(m.eye, 2.0, smooth(seg(sigh, 0, 0.5)));
      m.eyeW = lerp(m.eyeW, 0.35, smooth(seg(sigh, 0, 0.4)));
      m.roll += 0.1 * Math.sin(sigh * Math.PI * 4) * bump(sigh);
    } else if (md === 'replay') {
      const τ = tau(T);
      // same body, new feelings: horror from the first frame, trembling, then eyes shut tight as she tips
      const shut = smooth(seg(τ, RIM_T - 0.02, RIM_T + 0.06));
      const horror = smooth(seg(T, S.replay[0], S.replay[0] + 0.06));
      m.eyeW = lerp(lerp(0.4, 2.3 + 0.25 * Math.sin(T * 70), horror), 0.1, shut);
      m.eye = lerp(lerp(1.9, 2.6, horror), 1.0, shut) * (1 - smooth(seg(τ, OUT - 0.18, OUT)));
    }
    return m;
  };

  // ---------------- every frame ----------------
  const t0 = lab.t;
  let T = 0;
  let τ = 0;
  let cardGlow = 0; // the card's light: 0 settled, 1 just played
  let offer = 0; // the card's extra light while the undo is on offer
  lab.playCard('a', ['m3']);
  const stop = lab.every(() => {
    T = lab.t - t0;
    τ = tau(T);
    const md = mode(T);
    const m = live(T, tape(τ));
    maya.set({ x: m.x, y: 1, lift: m.lift, rot: m.rot, pitch: m.pitch, roll: m.roll, sx: m.sx, sy: m.sy, sz: m.sx, visible: m.visible });
    maya.look = m;
    const a = avaTape(τ);
    // after the tape: Ava, free again, shakes her head slowly (no take-backs) and gets back to facing north
    const c = seg(T, ...CODA);
    if (c > 0) {
      const back = smooth(seg(c, 0, 0.35));
      a.rot = lerp(a.rot, facing(0), back) + 0.32 * Math.sin(seg(c, 0.15, 0.95) * Math.PI * 4) * bump(seg(c, 0.15, 0.95)) ** 0.6;
      a.sy = lerp(a.sy, 0.94, back) + 0.06 * smooth(seg(c, 0.8, 1));
      a.sx = lerp(a.sx, 1.03, back) - 0.03 * smooth(seg(c, 0.8, 1));
      a.pitch = lerp(a.pitch, 0.12, back) * (1 - smooth(seg(c, 0.75, 1)));
      a.lift *= 1 - back;
      a.eye = lerp(a.eye, 0.7, back) + 0.3 * smooth(seg(c, 0.8, 1));
    }
    ava.set({ x: 2, y: 3, lift: a.lift, rot: a.rot, pitch: a.pitch, roll: a.roll, sx: a.sx, sy: a.sy, sz: a.sx });
    ava.look = a;

    // the trail lives on the tape: drawn as she goes, reeled back in when the tape rewinds, un-fading as it goes
    const tr = mb.trail;
    if (md === 'rew') while (tr.length && tr[tr.length - 1].tau > τ) tr.pop();
    else if (m.onGlass && m.visible && (md === 'take' || md === 'replay')) {
      const p = lab.pos(Math.min(m.x, 6.5), 1);
      const last = tr[tr.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.04) tr.push({ x: p.x, z: p.z, t: lab.t, tau: τ });
    }
    if (T < S.replay[1]) for (const p of tr) p.t = lab.t - Math.max(0, τ - p.tau);
    // after the tape runs out, it ages normally, then fades out a little early so nothing pops at the hand-over
    const fk = seg(T, END - 0.4, END - 0.02);
    if (fk > 0) for (const p of tr) p.t = Math.min(p.t, lab.t - lerp(Math.max(0, OUT - p.tau) + (T - S.replay[1]), 3.25, ease.in(fk)));

    // the card's light follows the tape and rewinds to "just played"
    cardGlow = md === 'take' ? 1 - seg(τ, 0, 1.6) : md === 'rew' ? lerp(1 - seg(S.take[1], 0, 1.6), 1, smooth(seg(T, ...S.rew))) : md === 'pause' ? 1 : 1 - seg(T, S.replay[0], S.replay[0] + 1.6 / 1.4);
    // the room holds its breath while the tape is stopped
    const hold = smooth(seg(T, S.rew[0], S.rew[0] + 0.2)) * (1 - smooth(seg(T, S.pause[1] - 0.04, S.pause[1] + 0.12)));
    A.dim = A.dimCur = 0.42 * hold;
    offer = smooth(seg(T, S.rew[0] + 0.1, S.rew[1])) * (1 - smooth(seg(T, S.pause[1], S.pause[1] + 0.3)));
  });
  lab.cleanup(() => {
    A.dim = A.dimCur = 0;
  });

  maya.each = (model) => {
    const look = maya.look;
    // the rewind's smear: every other frame, the oldest echo jumps to where her ring is now
    const scrub = mode(T) === 'rew' ? bump(seg(T, ...S.rew)) ** 0.5 : 0;
    if (scrub > 0 && echoTick === 0) {
      maya.group.updateMatrixWorld(true);
      for (const e of echoes) e.matrix.copy(ring.matrixWorld);
    }
    if (scrub > 0 && echoTick++ % 2 === 0) {
      maya.group.updateMatrixWorld(true);
      const e = echoes.pop();
      e.matrix.copy(ring.matrixWorld);
      echoes.unshift(e);
    }
    echoes.forEach((e, i) => (e.material.opacity = 0.55 * scrub * (1 - i / ECHO) ** 1.3));
    model.eyeMat.color.setRGB(3.2 * look.eye, 3.1 * look.eye, 2.9 * look.eye);
    if (mayaEye) mayaEye.scale.set(look.eyeW, 1, look.eyeW);
    if (!look.visible) model.poolMat.opacity = 0;
    else model.poolMat.opacity *= clamp(1 + look.lift * 2.5); // her glow leaves the glass as she drops
    const c = mb.card;
    if (c) {
      // it stays over the rim where she left the board, at its own height, and goes out with her
      const at = lab.pos(Math.min(maya.pose.x, 6.5), 1);
      c.position.x = at.x;
      c.position.z = at.z;
      c.position.y -= maya.pose.lift;
      if (T > 0.45) {
        const s = 1 + 0.28 * Math.min(1, cardGlow * 2.2);
        c.scale.set(c.userData.base.x * s, c.userData.base.y * s, 1);
        c.position.y = 1.72 + 0.1 * cardGlow;
      }
      // while the tape is stopped, the card glows as if it had just been played: you can have it again
      c.material.color.setScalar(1 + 0.04 * offer);
      const gone = mode(T) === 'replay' ? smooth(seg(τ, OUT - 0.25, OUT)) : 0;
      c.material.opacity = 1 - gone;
      c.visible = gone < 0.99;
    }
  };
  ava.each = (model) => {
    const e = ava.look.eye;
    model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
  };

  await lab.wait(END);
  stop();
  mb.trail = [];
  if (mb.card) mb.card.material.color.setScalar(1);
  maya.release({ x: 7, y: 1, d: 1, on: false });
  ava.release({ x: 2, y: 3, d: 0 });
}
