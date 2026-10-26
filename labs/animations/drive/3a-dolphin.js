// Idea 50, "Dolphin (rare)", through the lens of weight. Once in a long while Move 2 is a dive. Maya crouches,
// hops, tips nose-down and plunges into the smoked glass: it splashes (beads of light thrown up, each one
// dripping back with a tiny ring), and for two spaces she is only a red glow gliding under the surface,
// the grid above her swimming as if seen through water, a wake of ripples behind. She breaches with too
// much speed, hangs for a beat at the top, flops onto (3, 2) with a squash and a smaller splash... and then,
// like a dog out of a pond, shakes herself dry, flinging beads of light off both sides. The holes in the
// glass close over with a last little ring, and the Rotate Right plays as normal.
export const meta = {
  title: 'Dolphin',
  idea:
    'Move 2 as a dive: Maya hops, tips nose-down and plunges into the glass with a splash of light beads that drip back as tiny rings. For two spaces she is a red glow gliding under the surface, the grid above her wavering like seen through water, ripples in her wake. She breaches with too much speed, hangs, flops onto (3, 2)... then shakes herself dry like a dog out of a pond, flinging beads of light. The glass closes over and the next card plays as normal.',
  notes:
    'Lens: weight. Gravity on everything: her hop and breach are ballistic arcs (anticipation crouch, hang at the apex, squash on landing), every bead of light is a little projectile that lands with its own ripple, and the shake-off is the physical-comedy beat. The underwater part is a small shader patch on the glass (refracted, wobbling grid lines and her glow). Rare: once in a long while, on Move 2/3. Sound: a glassy "bloop" on entry, a muffled hum under, a bright splash out, a patter of tiny glass ticks as the beads land, a quick rattle for the shake.',
};

const TAU = Math.PI * 2;

function softDisc(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { ease, facing, THREE } = lab;
  const maya = lab.puppet('a');
  const bot = lab.bot('a');
  const red = new THREE.Color(bot.color);
  const warm = new THREE.Color('#fff1dc');
  const origin = lab.pos(0, 0);
  const at = (x, y, h = 0) => new THREE.Vector3(x + origin.x, h, y + origin.z);

  // ----- the glass from inside: a dark well, and a lens of refracted grid lines with her glow in it -----
  const disc = softDisc(THREE);
  const well = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: disc, color: 0x000000, transparent: true, opacity: 0, depthWrite: false })));
  well.rotation.x = -Math.PI / 2;
  well.renderOrder = 4;
  const lensMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector2(1, 2) },
      uOrigin: { value: new THREE.Vector2(origin.x, origin.z) },
      uStrength: { value: 0 },
      uGlow: { value: 0 },
      uColor: { value: red.clone().multiplyScalar(2.2) },
      uLine: { value: warm.clone().multiplyScalar(1.3) },
    },
    vertexShader: `
      uniform vec2 uOrigin;
      varying vec2 vB;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vB = vec2(wp.x - uOrigin.x, wp.z - uOrigin.y);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime, uStrength, uGlow;
      uniform vec2 uCenter;
      uniform vec3 uColor, uLine;
      varying vec2 vB;
      void main() {
        vec2 d = vB - uCenter;
        float r = length(d);
        float fall = smoothstep(1.3, 0.2, r);
        // refraction: the grid swims and swells over her
        vec2 q = vB - d * 0.22 * fall
          + fall * 0.1 * vec2(sin(vB.y * 7.0 + uTime * 8.0), sin(vB.x * 7.0 - uTime * 7.0));
        vec2 e = abs(fract(q) - 0.5);
        float line = max(smoothstep(0.03, 0.0, e.x), smoothstep(0.03, 0.0, e.y));
        vec3 col = uLine * line * fall * uStrength;
        // her glow, soft and rippling, seen from above through the glass
        float glow = exp(-(d.x * d.x / 0.22 + d.y * d.y / 0.1)) * (0.85 + 0.15 * sin(uTime * 12.0 + r * 18.0));
        float core = exp(-(d.x * d.x / 0.05 + d.y * d.y / 0.025));
        col += uColor * (glow * 0.9 + core * 0.6) * uGlow;
        gl_FragColor = vec4(col, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lens = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), lensMat));
  lens.rotation.x = -Math.PI / 2;
  lens.renderOrder = 5;
  const water = { x: 1, y: 2, on: 0, glow: 0 };
  const stopWater = lab.every((dt, t) => {
    lensMat.uniforms.uTime.value = t;
    lensMat.uniforms.uCenter.value.set(water.x, water.y);
    lensMat.uniforms.uStrength.value = water.on;
    lensMat.uniforms.uGlow.value = water.glow;
    lens.position.copy(at(water.x, water.y, 0.012));
    well.position.copy(at(water.x, water.y, 0.01));
    well.material.opacity = 0.85 * water.on;
    lens.visible = well.visible = water.on > 0.001 || water.glow > 0.001;
  });

  // ----- ripples on the glass (expanding, or closing over) -----
  const ringGeo = new THREE.RingGeometry(0.94, 1, 72);
  const ripples = [];
  const ripple = (x, y, { color = warm, size = 0.8, dur = 0.7, k = 1.6, close = false, delay = 0 } = {}) => {
    const m = lab.add(new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at(x, y, 0.02));
    ripples.push({ m, t0: null, delay, dur, size, close });
  };
  const stopRipples = lab.every((dt, t) => {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      if (r.t0 == null) r.t0 = t + r.delay;
      const k = (t - r.t0) / r.dur;
      if (k < 0) continue;
      if (k >= 1) {
        r.m.visible = false;
        ripples.splice(i, 1);
        continue;
      }
      const s = r.close ? 0.05 + r.size * (1 - ease.in(k)) : 0.08 + r.size * ease.out(k);
      r.m.scale.setScalar(s);
      r.m.material.opacity = r.close ? Math.sin(k * Math.PI) ** 0.7 : (1 - k) ** 1.6;
    }
  });

  // ----- beads of light: little projectiles that land with their own tiny ripple -----
  const beadGeo = new THREE.SphereGeometry(0.048, 8, 6);
  const beads = [];
  const bead = (x, y, h, vx, vy, vh, color = warm) => {
    const m = lab.add(new THREE.Mesh(beadGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    m.position.copy(at(x, y, h)); // placed now, so it never shows a frame at the world's origin
    beads.push({ m, x, y, h, vx, vy, vh, color, drip: (beads.length + lab.rand() * 2) % 2 < 1 });
  };
  const splash = (x, y, n, { up = 2.6, out = 1.0, bias = [0, 0] } = {}) => {
    for (let i = 0; i < n; i++) {
      const a = lab.range(0, TAU);
      const s = lab.range(0.35, 1) * out;
      bead(x, y, 0.05, Math.cos(a) * s + bias[0], Math.sin(a) * s + bias[1], lab.range(0.5, 1) * up, lab.rand() < 0.45 ? red : warm);
    }
  };
  const stopBeads = lab.every((dt) => {
    if (dt <= 0) return;
    for (let i = beads.length - 1; i >= 0; i--) {
      const b = beads[i];
      b.vh -= 9.5 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.h += b.vh * dt;
      if (b.h <= 0.02) {
        // it lands: a drip of light and a tiny ring
        if (b.drip) ripple(b.x, b.y, { color: b.color, size: 0.16, dur: 0.32, k: 1.2 });
        b.m.visible = false;
        beads.splice(i, 1);
        continue;
      }
      b.m.position.copy(at(b.x, b.y, b.h));
      const sp = Math.hypot(b.vx, b.vy, b.vh);
      b.m.scale.set(1, 1 + sp * 0.12, 1);
    }
  });

  // the card stays above the glass while she's under it
  maya.each = () => {
    if (bot.card && maya.pose.lift < 0) bot.card.position.y -= maya.pose.lift;
  };

  // ================= Move 2: the dive, as one timeline =================
  lab.playCard('a', ['m2']);
  await lab.wait(0.12);
  maya.set({ trail: false });
  const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const once = new Set();
  const cue = (name, fn) => {
    if (once.has(name)) return;
    once.add(name);
    fn();
  };
  const xIn = 1.62; // where her nose meets the glass
  const xA = 1.87; // fully under
  const xB = 2.42; // where she breaches
  const xLand = 3;
  const APEX = 0.8;
  const T = { crouch: 0.12, hop: 0.42, sink: 0.54, glide: 0.92, apex: 1.12, land: 1.36, settle: 1.52, shake: 1.84 };
  let flung = 0;
  await lab.tween(
    T.shake,
    (e, k) => {
      const t = k * T.shake;
      if (t < T.crouch) {
        // anticipation: a crouch, nose up a touch
        const c = ease.out(seg(t, 0, T.crouch));
        maya.set({ sy: 1 - 0.22 * c, sx: 1 + 0.1 * c, sz: 1 + 0.1 * c, pitch: -0.15 * c });
      } else if (t < T.hop) {
        // the hop: up and over, tipping nose-down, into the glass
        const u = seg(t, T.crouch, T.hop);
        const spring = Math.max(0, 1 - u * 5);
        maya.set({
          x: 1 + (xIn - 1) * u,
          lift: Math.max(0.02, 0.45 * Math.sin(u * Math.PI)),
          pitch: -0.15 + 1.4 * ease.in(u),
          sy: 1 - 0.22 * spring + 0.1 * Math.sin(Math.min(1, u * 2) * Math.PI),
          sx: 1 + 0.1 * spring,
          sz: 1 + 0.1 * spring,
        });
        if (u > 0.82)
          cue('in', () => {
            // in she goes: the glass splashes
            splash(xIn + 0.1, 2, 12, { up: 3.2, out: 1.3, bias: [-0.25, 0] });
            ripple(xIn + 0.1, 2, { size: 0.95, dur: 0.75, k: 2 });
            ripple(xIn + 0.1, 2, { color: red, size: 0.55, dur: 0.6, k: 1.8, delay: 0.08 });
            lab.shake(0.012, 0.15);
            water.x = xIn + 0.15;
            lab.tween(0.16, (e2) => {
              water.on = e2;
              water.glow = e2;
            }, ease.out);
          });
      } else if (t < T.sink) {
        const u = seg(t, T.hop, T.sink);
        maya.set({ x: xIn + (xA - xIn) * u, lift: -0.65 * ease.in(u), pitch: 1.25 + 0.2 * u, sy: 1, sx: 1, sz: 1, visible: true });
      } else if (t < T.glide) {
        // under the glass: a red glow gliding, the grid swimming over her, a ripple or two in her wake
        const u = seg(t, T.sink, T.glide);
        const x = xA + (xB - xA) * ease.inOut(u);
        water.x = x;
        maya.set({ x, lift: -0.65, visible: false });
        if (u > 0.15) cue('wake1', () => ripple(x, 2, { size: 0.45, dur: 0.55, k: 0.8 }));
        if (u > 0.65) cue('wake2', () => ripple(x, 2, { size: 0.45, dur: 0.55, k: 0.8 }));
      } else if (t < T.land) {
        // the breach: out with too much speed, a hang at the top, a flop onto (3, 2)
        cue('out', () => {
          splash(xB + 0.1, 2, 14, { up: 3.6, out: 1.1, bias: [0.4, 0] });
          ripple(xB + 0.1, 2, { size: 1.0, dur: 0.75, k: 2 });
          ripple(xB + 0.1, 2, { color: red, size: 0.6, dur: 0.6, k: 1.8, delay: 0.06 });
          lab.tween(0.22, (e2) => {
            water.glow = 1 - e2;
            water.on = 1 - e2;
          }, ease.out);
        });
        let lift;
        if (t < T.apex) lift = -0.65 + (0.65 + APEX) * ease.out3(seg(t, T.glide, T.apex));
        else lift = APEX * (1 - ease.in(seg(t, T.apex, T.land)));
        const u = seg(t, T.glide, T.land);
        const rise = 1 - seg(t, T.glide, T.apex);
        maya.set({
          visible: true,
          x: xB + (xLand - xB) * ease.inOut(u),
          lift,
          pitch: -1.15 + 1.45 * ease.inOut(u),
          sy: 1 + 0.14 * rise * (t < T.apex ? 1 : 0),
          sx: 1 - 0.05 * rise * (t < T.apex ? 1 : 0),
          sz: 1 - 0.05 * rise * (t < T.apex ? 1 : 0),
        });
      } else if (t < T.settle) {
        // the flop: squash, a smaller splash
        cue('land', () => {
          ripple(xLand, 2, { size: 0.75, dur: 0.5, k: 1.6 });
          splash(xLand, 2, 6, { up: 1.8, out: 0.9 });
          lab.shake(0.01, 0.12);
        });
        const u = seg(t, T.land, T.settle);
        const sq = Math.sin(u * Math.PI) * Math.exp(-u * 1.2);
        maya.set({ x: xLand, lift: 0, pitch: 0.3 * (1 - u), sy: 1 - 0.28 * sq, sx: 1 + 0.14 * sq, sz: 1 + 0.14 * sq });
      } else {
        // the shake: like a dog out of a pond, beads of light flung off both sides
        const u = seg(t, T.settle, T.shake);
        const env = Math.sin(u * Math.PI) ** 0.5;
        maya.set({ x: xLand, lift: 0, pitch: 0, roll: Math.sin(u * TAU * 3) * 0.42 * env, sy: 1 + 0.03 * env, sx: 1, sz: 1 });
        const phase = Math.floor(u * 6);
        if (phase > flung && u < 0.92) {
          flung = phase;
          const side = phase % 2 ? 1 : -1; // flung north, then south...
          for (let j = 0; j < 3; j++) bead(xLand + lab.range(-0.2, 0.2), 2 + side * 0.22, 0.32, lab.range(-0.35, 0.35), side * lab.range(1.3, 2.1), lab.range(0.9, 1.7), j === 1 ? red : warm);
        }
      }
    },
    ease.linear,
  );
  maya.set({ x: xLand, lift: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, visible: true });
  // the glass closes over where she went in and came out, each with a last little drip
  ripple(xIn + 0.1, 2, { size: 0.55, dur: 0.28, k: 1.8, close: true });
  ripple(xB + 0.1, 2, { size: 0.55, dur: 0.28, k: 1.8, close: true, delay: 0.05 });
  lab.at(0.27, () => bead(xIn + 0.1, 2, 0.03, 0, 0, 1.0));
  lab.at(0.32, () => bead(xB + 0.1, 2, 0.03, 0, 0, 1.0));
  maya.release({ x: 3, y: 2, d: 1 });

  // ================= the rest of the program, as the game plays it =================
  await lab.beat(lab.scenario.beats[1]);
  await lab.beat(lab.scenario.beats[2]);
  await lab.beat(lab.scenario.beats[3]);
  void stopWater;
  void stopRipples;
  void stopBeads;
  void facing;
}
