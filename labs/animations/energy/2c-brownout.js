// Energy, idea 2 (Brownout), animator c: cinematic & graphic staging.
export const meta = {
  title: 'Brownout',
  idea:
    'The charge lands and the whole picture sags like house lights when the kettle goes on: the glass, the grid, the floor\'s glow, Ezra, the HUD and the room all dim and flicker (down, half back, down), a dark hum bar rolls up the screen and the picture shrinks a hair, as if the TV itself browned out. Only Maya holds her strength, her ring and eye going amber; in the HUD her energy ticks over, the one number still lit. Then the power surges back with an overshoot (the bloom flares) and settles. Ezra comes back a beat late, his eye stuttering like a bad contact.',
  notes:
    'Sound: the room tone drops a fifth and wobbles with the flicker, then a soft glass "whum" as the lights surge back; a small rising chime as her number ticks. Several robots charging on one register: the dip goes deeper (multiply the depth by the number charging, capped), and each charger keeps its strength. The HUD here is a stand-in for the game\'s tokens (name, flags, energy). The hum bar is a soft band on the overlay; the shrink is a 2.5% field-of-view breath with no camera move.',
};

const mix = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const smooth = (k) => k * k * (3 - 2 * k);

/** The world's light level over time (1 = normal): down, half back, down, hold, surge with an overshoot, settle. */
function level(T, at, depth = 0.7) {
  const keys = [
    [at - 0.01, 1],
    [at + 0.05, 1 - depth],
    [at + 0.12, 1 - depth * 0.45],
    [at + 0.18, 1 - depth * 1.05],
    [at + 0.42, 1 - depth * 0.95],
    [at + 0.55, 1.2],
    [at + 0.68, 0.97],
    [at + 0.86, 1.02],
    [at + 1.0, 1],
  ];
  if (T <= keys[0][0]) return 1;
  for (let i = 1; i < keys.length; i++) {
    if (T <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return mix(v0, v1, smooth((T - t0) / (t1 - t0)));
    }
  }
  return 1;
}

const BOLT = 'M22.5 6 L12.5 22 H19.5 L17.5 34 L27.5 17.5 H20.5 Z';

/** A stand-in for the game's HUD tokens: name, flag bars, energy. */
function hud(lab) {
  const H = lab.overlay.clientHeight || 540;
  const px = (k) => `${(k * H).toFixed(1)}px`;
  const bar = document.createElement('div');
  bar.style.cssText = `position:absolute;left:50%;bottom:${px(0.035)};transform:translateX(-50%);display:flex;gap:${px(0.09)};font-family:Lumen,system-ui,sans-serif;pointer-events:none;transition:none`;
  const token = (name, color, en) => {
    const el = document.createElement('div');
    el.style.cssText = `display:grid;justify-items:center;gap:${px(0.008)}`;
    el.innerHTML =
      `<div style="font-weight:500;font-size:${px(0.032)};letter-spacing:.14em;color:#f4efe4">${name}</div>` +
      `<div style="display:flex;align-items:center;gap:${px(0.016)};height:${px(0.03)}">` +
      `<span style="display:flex;gap:3px"><i style="width:${px(0.022)};height:3px;border-radius:2px;background:${color};box-shadow:0 0 6px ${color}"></i><i style="width:${px(0.022)};height:3px;border-radius:2px;background:rgba(244,239,228,.2)"></i></span>` +
      `<span class="en" style="display:inline-flex;align-items:center;gap:1px;color:#ffc56e;font-size:${px(0.036)};font-weight:400;font-variant-numeric:tabular-nums">` +
      `<svg viewBox="0 0 40 40" style="width:${px(0.036)};height:${px(0.036)}"><path d="${BOLT}" fill="currentColor"/></svg>` +
      `<span class="win" style="position:relative;display:inline-block;overflow:hidden;height:1.2em;line-height:1.2em;width:.62em"><b class="old" style="position:absolute;left:0;font-weight:400">${en}</b><b class="new" style="position:absolute;left:0;font-weight:400;top:1.2em">${en + 1}</b></span></span></div>`;
    bar.append(el);
    return el;
  };
  const maya = token('MAYA', '#ff4d6d', 3);
  const ezra = token('EZRA', '#cc5de8', 5);
  ezra.querySelector('.new').textContent = '5';
  lab.overlay.append(bar);
  return { bar, maya, ezra };
}

export default async function play(lab) {
  const { THREE, PALETTE, ease, facing, arena } = lab;
  const maya = lab.puppet('a');
  maya.set({ rot: facing(1) });
  const ezra = lab.bot('b');
  const ui = hud(lab);

  // everything we dim, and how to put it back
  const top = arena.topMat;
  const top0 = { color: top.color.clone() };
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  const spill0 = arena.spill.material.color.clone();
  const motes0 = arena.motes.material.opacity;
  const glows = [];
  arena.board.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      if (m && m !== top && m.emissive && m.emissiveIntensity > 0 && !glows.some((g) => g.m === m)) glows.push({ m, k: m.emissiveIntensity });
    }
  });
  const capMats = [];
  arena.board.traverse((o) => {
    if (o.isMesh && o.material?.isMeshBasicMaterial && o.material !== arena.batteryMat && !capMats.some((c) => c.m === o.material) && o.material.color.r > 1) capMats.push({ m: o.material, c: o.material.color.clone() });
  });
  const mRing0 = maya.model.ringMat.color.clone();
  const mPool0 = maya.model.poolMat.color.clone();
  const restore = () => {
    top.color.copy(top0.color);
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    arena.spill.material.color.copy(spill0);
    arena.motes.material.opacity = motes0;
    for (const g of glows) g.m.emissiveIntensity = g.k;
    for (const c of capMats) c.m.color.copy(c.c);
    maya.model.ringMat.color.copy(mRing0);
    maya.model.poolMat.color.copy(mPool0);
  };
  lab.cleanup(restore);

  // the darkness over the picture: a hole stays open around Maya, and the power comes back as a wave from her
  const dark = document.createElement('div');
  dark.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  lab.overlay.append(dark);
  // the hum bar rolling up the screen
  const hum = document.createElement('div');
  hum.style.cssText = 'position:absolute;left:0;right:0;height:38%;pointer-events:none;background:linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.34) 45%, rgba(0,0,0,.34) 55%, rgba(0,0,0,0));opacity:0';
  lab.overlay.append(hum);

  const MOVE = 0.58;
  const HIT = 0.64; // the charge lands
  const END = HIT + 1.04;
  const WHITE = new THREE.Color(3.2, 3.1, 2.9);
  const AMBER = new THREE.Color(PALETTE.energy).multiplyScalar(4.4);
  const RING = new THREE.Color(PALETTE.energy).multiplyScalar(2.4);
  const POOL = new THREE.Color(PALETTE.energy).multiplyScalar(1.2);
  const look = { L: 1, warm: 0 };

  maya.each = (m) => {
    // she holds her strength while the lights she's lit by go down: her own glow makes up for it
    const lost = Math.max(0, 1 - look.L);
    m.paint.emissiveIntensity = 0.16 + lost * 0.55;
    m.eyeMat.color.copy(WHITE).lerp(AMBER, look.warm);
    m.ringMat.color.copy(mRing0).lerp(RING, look.warm);
    m.poolMat.color.copy(mPool0).lerp(POOL, look.warm * 0.85);
    m.poolMat.opacity = 0.75 * (1 + look.warm * 0.4);
    const card = maya.bot.card;
    if (card) card.material.opacity = Math.min(card.material.opacity, Math.min(1, look.L));
  };

  lab.playCard('a', ['m2']);
  const t0 = lab.t;
  const stop = lab.every((dt, t) => {
    const T = t - t0;
    maya.set({ x: 1 + 2 * ease.inOut(seg(T, 0, MOVE)), pitch: Math.sin(seg(T, MOVE - 0.04, MOVE + 0.22) * Math.PI) * 0.08 });
    const L = level(T, HIT);
    look.L = L;
    // the world
    top.emissiveIntensity *= L;
    top.color.copy(top0.color).multiplyScalar(Math.max(0.25, L));
    arena.key.intensity = key0 * L;
    arena.hemi.intensity = hemi0 * L;
    arena.spill.material.color.copy(spill0).multiplyScalar(L);
    arena.motes.material.opacity = motes0 * L;
    for (const g of glows) g.m.emissiveIntensity = g.k * L;
    for (const c of capMats) c.m.color.copy(c.c).multiplyScalar(L);
    arena.batteryMat.color.multiplyScalar(Math.max(0, L - 0.25 * seg(T, HIT, HIT + 0.2) * (1 - seg(T, HIT + 0.5, HIT + 0.9))));
    // Ezra is on the same circuit, two frames late, and his eye stutters as he comes back
    const LE = level(T - 0.067, HIT);
    const stutter = T > HIT + 0.5 && T < HIT + 0.66 ? [1, 0.15, 1, 0.3, 1][Math.floor((T - HIT - 0.5) * 30)] ?? 1 : 1;
    const em = ezra.model;
    em.eyeMat.color.multiplyScalar(LE * stutter);
    em.ringMat.opacity *= Math.min(1.15, LE);
    em.poolMat.opacity *= LE;
    em.paint.emissiveIntensity *= LE;
    // the picture shrinks a hair as it browns out (field of view; the lab eases fov 8% toward home, so lead it)
    const cam = lab.camera3;
    const fov = 30 + (1 - L) * 1.2;
    cam.fov = 30 + (fov - 30) / 0.92;
    cam.updateProjectionMatrix();
    // Maya: amber pours into her through the dip
    look.warm = ease.out(seg(T, HIT + 0.02, HIT + 0.2)) * (1 - ease.inOut(seg(T, HIT + 0.55, END - 0.02)));
    // the HUD dims with the house; Maya's number stays lit and ticks over in the dark
    ui.bar.style.opacity = String(seg(T, 0, 0.25)); // (the stand-in HUD arrives with the moment; the game's is always there)
    ui.ezra.style.opacity = String(Math.min(1, LE * stutter));
    const roll = ease.inOut(seg(T, HIT + 0.2, HIT + 0.34));
    ui.maya.style.opacity = String(Math.min(1, mix(L, 1, seg(T, HIT, HIT + 0.05))));
    const name = ui.maya.firstElementChild;
    name.style.opacity = String(Math.min(1, L));
    ui.maya.querySelector('.old').style.top = `${-1.2 * roll}em`;
    ui.maya.querySelector('.new').style.top = `${1.2 * (1 - roll)}em`;
    const glow = look.warm;
    ui.maya.querySelector('.en').style.textShadow = glow > 0.01 ? `0 0 ${(10 * glow).toFixed(1)}px rgba(255,197,110,${glow.toFixed(2)})` : 'none';
    ui.maya.querySelector('.en').style.filter = glow > 0.01 ? `brightness(${(1 + glow * 0.6).toFixed(2)})` : 'none';
    // the darkness over the picture, with its hole around her; on the surge the hole races outward
    const H = lab.overlay.clientHeight || 540;
    const dip = T < HIT + 0.42 ? Math.max(0, 1 - L) / 0.7 : 1 - seg(T, HIT + 0.5, HIT + 0.62);
    const r0 = H * mix(0.13, 1.9, ease.in(seg(T, HIT + 0.42, HIT + 0.56)));
    if (dip > 0.003) {
      const p = lab.toScreen(lab.pos(maya.pose.x, maya.pose.y).setY(0.2));
      const a = (0.5 * dip).toFixed(3);
      dark.style.background = `radial-gradient(circle at ${p.x}px ${p.y}px, rgba(0,0,0,0) ${r0}px, rgba(0,0,0,${a}) ${r0 + H * 0.16}px)`;
    } else dark.style.background = 'none';
    // the hum bar
    const h = seg(T, HIT + 0.02, HIT + 0.5);
    hum.style.top = `${mix(100, -40, h)}%`;
    hum.style.opacity = String(h > 0 && h < 1 ? Math.sin(h * Math.PI) ** 0.5 * 0.9 : 0);
  });
  lab.cleanup(stop);

  await lab.wait(END);
  stop();
  restore();
  hum.remove();
  dark.remove();
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}
