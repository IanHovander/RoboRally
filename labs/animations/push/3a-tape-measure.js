// Push, idea 16 (Refraction Kiss), animator a: weight & physical comedy.
export const meta = {
  title: 'Refraction Kiss: the tape measure',
  idea:
    "Maya's nose hits Theo's glass Prism and her eye's warm white light goes in at the contact. It comes out of his far side as a rainbow that spills across the glass like poured liquid, sloshes a little too far and settles with its bright edge exactly on space 4. Theo rides his own spectrum there, and in the last stretch the colours reel back into him like a tape measure snapping home: they zip up into his ridge, glint once, and he gets a little hiccup from swallowing them.",
  notes:
    "Sound: a glass clink, a soft rising chord as the light spills (one note per colour, quick arpeggio), a sliding hum, then the zzzip-clack of a tape measure in glass-chime form and a tiny 'hic'. Physics: the spill overshoots and sloshes back (a damped spring on its leading edge); the reel-in accelerates (ease-in, like a sprung tape) and its arrival gives him a recoil hop. Each form bends the pusher's light its own way when it is the one pushed (porting idea: switch on model.form): Orb focuses it into a hot dot that skitters onto the destination and burns there until he arrives; Cube mirrors it straight back at the pusher's own eye (she blinks); Capsule throws a long caustic line that wobbles like a jump rope; Spire splits it into a thin rainbow corkscrew; Pebble pools it into a puddle that he slips on.",
};

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const F = (s) => Math.round(s * 30) / 30 - 0.004; // whole frames, so tweens don't drift
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};

function starTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.12, 'rgba(255,255,255,.7)');
  gr.addColorStop(0.35, 'rgba(255,255,255,.08)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  // four thin spikes
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[128, 5], [5, 128]]) {
    const lg = w > h ? g.createLinearGradient(0, 0, 128, 0) : g.createLinearGradient(0, 0, 0, 128);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(64 - w / 2, 64 - h / 2, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const EAST = facing(1);
  const SOUTH = facing(2);
  maya.set({ x: 1, y: 2, rot: EAST });
  theo.set({ x: 3, y: 2, rot: SOUTH });
  lab.playCard('a', ['m2']);

  const row = lab.pos(0, 2).z; // the row's z in the world
  const X = (sx) => lab.pos(sx, 2).x; // a space's x in the world

  // ----- the spectrum: a fan of light lying on the glass -----
  const NU = 26;
  const NV = 36;
  const fanGeo = new THREE.PlaneGeometry(1, 1, NU, NV);
  const fanPos = fanGeo.attributes.position.array;
  const fanCol = new Float32Array((NU + 1) * (NV + 1) * 3);
  fanGeo.setAttribute('color', new THREE.BufferAttribute(fanCol, 3));
  const fanMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fan = new THREE.Mesh(fanGeo, fanMat);
  fan.frustumCulled = false;
  fan.renderOrder = 4;
  lab.add(fan);
  const BANDS = ['#ff3b3b', '#ff8a2a', '#ffe23a', '#4dff6a', '#3ad8ff', '#4a6bff', '#a14dff'].map((c) => new THREE.Color(c));
  const spectrum = (v, out) => {
    // v in [0, 1] across the fan; crisp bands with soft joins
    const f = v * (BANDS.length - 1);
    const i = Math.min(BANDS.length - 2, Math.floor(f));
    const k = f - i;
    const s = smooth(0.35, 0.65, k);
    return out.copy(BANDS[i]).lerp(BANDS[i + 1], s);
  };
  const tmp = new THREE.Color();
  // fan state: base (world x where it leaves his far face), len (to its bright edge), spread (half angle),
  // glow (overall), edge (the bright arc at its end)
  const S = { base: 0, len: 0, spread: 0.4, glow: 0, edge: 1 };
  const drawFan = () => {
    let n = 0;
    for (let j = 0; j <= NV; j++) {
      const v = j / NV;
      const th = (v * 2 - 1) * S.spread;
      const side = 1 - Math.abs(v * 2 - 1) ** 6;
      spectrum(v, tmp);
      for (let i = 0; i <= NU; i++) {
        const u = i / NU;
        const r = u * S.len;
        const idx = (j * (NU + 1) + i) * 3;
        fanPos[idx] = S.base + r * Math.cos(th);
        fanPos[idx + 1] = 0.014;
        fanPos[idx + 2] = row + r * Math.sin(th);
        // dim near his face, brighter toward the end, a bright arc right at the edge
        const I = (smooth(0, 0.3, u) * (0.45 + 0.4 * u) + S.edge * 0.9 * Math.exp(-(((1 - u) / 0.07) ** 2))) * side * S.glow * (u > 0.995 ? 0.4 : 1);
        fanCol[idx] = tmp.r * I * 2.3;
        fanCol[idx + 1] = tmp.g * I * 2.3;
        fanCol[idx + 2] = tmp.b * I * 2.3;
        n++;
      }
    }
    fanGeo.attributes.position.needsUpdate = true;
    fanGeo.attributes.color.needsUpdate = true;
  };
  drawFan();

  // ----- the white light going in, and the glint -----
  const star = starTexture(THREE);
  const inMat = new THREE.SpriteMaterial({ map: star, color: new THREE.Color('#fff3df').multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const inFlare = new THREE.Sprite(inMat);
  inFlare.scale.set(0.5, 0.5, 1);
  lab.add(inFlare);
  const glintMat = new THREE.SpriteMaterial({ map: star, color: new THREE.Color('#ffffff').multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glint = new THREE.Sprite(glintMat);
  lab.add(glint);

  // Theo's glass fills with light from inside
  const paint = theo.model.paint;
  const baseEmissive = paint.emissive.clone();
  const baseEI = paint.emissiveIntensity;
  const eye = theo.model.eyeMat;
  lab.cleanup(() => {
    paint.emissive.copy(baseEmissive);
    paint.emissiveIntensity = baseEI;
  });
  const T = { fill: 0, ridge: 0, ridgeHue: -1 };
  const warm = new THREE.Color('#fff1dc');
  theo.each = (m) => {
    paint.emissive.copy(baseEmissive).lerp(warm, clamp01(T.fill) * 0.85);
    paint.emissiveIntensity = baseEI + 1.3 * T.fill;
    // his ridge: rainbow while he swallows it, then white-hot for the glint
    if (T.ridgeHue >= 0) eye.color.copy(spectrum(T.ridgeHue % 1, tmp)).multiplyScalar(3.4);
    else eye.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(1 + T.ridge * 1.6);
  };

  // ----- 1. Maya rocks back, then rolls through her free space -----
  await lab.tween(F(0.12), (e) => maya.set({ x: 1 - 0.06 * e, pitch: -0.12 * e }), ease.out);
  const XC = 2.37;
  await lab.tween(F(0.3), (e, k) => maya.set({ x: 0.94 + (XC - 0.94) * e, pitch: -0.12 + 0.22 * k }), ease.in);

  // ----- 2. contact: a two-frame hit-stop, white light pours into his glass -----
  maya.set({ sz: 0.9, pitch: 0.12 });
  theo.set({ sx: 0.86, sy: 1.05 });
  const cp = lab.pos(2.62, 2);
  inFlare.position.set(cp.x, 0.26, cp.z);
  await lab.tween(F(0.07), (e, k) => {
    inMat.opacity = k;
    inFlare.scale.setScalar(0.3 + 0.4 * k);
    T.fill = k * 0.8;
  }, ease.linear);

  // ----- 3. the spill: out of his far side, across the glass, a little too far, and back -----
  const faceOff = 0.27; // his far face, from his centre
  const target = X(4) - (X(3) + faceOff); // the fan's length when its edge sits on space 4
  S.base = X(3) + faceOff;
  const SPILL = F(0.36);
  await lab.tween(SPILL, (e, k) => {
    const t = k * SPILL;
    // the leading edge runs out fast, overshoots, sloshes back: a damped spring
    const run = clamp01(t / 0.13);
    const slosh = t < 0.13 ? 0 : 0.14 * Math.exp(-(t - 0.13) / 0.07) * Math.cos((t - 0.13) * 26);
    S.len = target * (1 - (1 - run) ** 2) + (t < 0.13 ? 0.14 * run ** 3 : slosh);
    S.spread = 0.14 + 0.41 * ease.out(clamp01(t / 0.2));
    S.glow = clamp01(t / 0.06);
    S.edge = 0.6 + 0.4 * clamp01(t / 0.2);
    drawFan();
    // Maya keeps leaning in; Theo bulges with light
    maya.set({ x: XC + 0.04 * ease.out(k), sz: 0.9 + 0.05 * k });
    theo.set({ sx: 0.86 + 0.06 * k, sy: 1.05 - 0.03 * k });
    inMat.opacity = 1 - 0.4 * k;
    inFlare.scale.setScalar(0.7 - 0.15 * k + 0.05 * Math.sin(t * 40));
    T.fill = 0.8 + 0.2 * Math.sin(t * 22) * (1 - k);
  }, ease.linear);
  S.len = target;
  drawFan();

  // ----- a held beat: the rainbow points at 4, Maya strains into him, his glass bulges -----
  const HOLD = F(0.2);
  await lab.tween(HOLD, (e, k) => {
    const t = k * HOLD;
    maya.set({ x: XC + 0.04 + 0.025 * k, sz: 0.95 - 0.06 * k, pitch: 0.12 + 0.06 * k });
    theo.set({ sx: 0.92 - 0.1 * k + 0.015 * Math.sin(t * 60), roll: 0.05 * k });
    S.edge = 1 + 0.3 * Math.sin(t * 20);
    drawFan();
    T.fill = 0.85 + 0.15 * Math.sin(t * 30);
  }, ease.linear);

  // ----- 4. he rides his spectrum to its edge; near the end it reels in like a sprung tape -----
  const RIDE = F(0.5);
  const x0m = maya.pose.x;
  const base0 = S.base;
  await lab.tween(RIDE, (e, k) => {
    const t = k * RIDE;
    // Theo: a quick launch, a glide, a soft stop exactly on 4
    const u = 1 - (1 - k) ** 2.4;
    const tx = 3 + u;
    theo.set({ x: tx, sx: 0.82 + 0.18 * ease.outElastic(clamp01(t / 0.3)), sy: 1.02 - 0.02 * clamp01(t / 0.2), roll: -0.12 * Math.sin(Math.min(1, k * 1.4) * Math.PI) });
    maya.set({ x: x0m + (3 - x0m) * (1 - (1 - clamp01(t / 0.38)) ** 2), sz: 0.95 + 0.05 * clamp01(t / 0.15), pitch: 0.12 * Math.cos(t * 14) * Math.exp(-t * 6) });
    // the spilled light stays where it lies while he glides over it; near the end it reels into him
    // from behind like a sprung tape: its tail races east, faster and faster, into his centre
    const reel = smooth(0.55, 1, k) ** 2.4;
    S.base = base0 + (X(4) - base0) * reel;
    S.len = Math.max(0, X(4) - S.base);
    drawFan();
    inMat.opacity = 0.6 * (1 - clamp01(t / 0.15));
    T.fill = 1 - 0.5 * k;
    T.ridgeHue = reel > 0.05 ? reel * 2.2 : -1;
  }, ease.linear);
  S.glow = 0;
  drawFan();
  fan.visible = false;
  inFlare.visible = false;
  maya.set({ x: 3, sz: 1, pitch: 0 });

  // ----- 5. clack: the glint, and a hiccup -----
  T.ridgeHue = -1;
  const ridgeTop = lab.pos(4, 2);
  glint.position.set(ridgeTop.x, 0.62, ridgeTop.z + 0.02);
  const HIC = F(0.34);
  await lab.tween(HIC, (e, k) => {
    const t = k * HIC;
    const g = Math.exp(-t / 0.07) * clamp01(t / 0.02);
    glintMat.opacity = Math.min(1, g * 1.4);
    glint.scale.setScalar(0.25 + 0.6 * g);
    glintMat.rotation = 0.6 * t;
    T.ridge = g;
    T.fill = 0.5 * (1 - clamp01(t / 0.18)) + 0.9 * g;
    // the hiccup: a little hop with a stretch, a squash on landing, settle
    const hop = Math.max(0, Math.sin(clamp01((t - 0.03) / 0.16) * Math.PI));
    const land = t > 0.19 ? Math.exp(-(t - 0.19) / 0.05) * Math.sin(clamp01((t - 0.19) / 0.15) * Math.PI) : 0;
    theo.set({ x: 4, lift: 0.07 * hop, sy: 1 + 0.12 * hop - 0.1 * land, sx: 1 - 0.05 * hop + 0.07 * land, sz: 1 - 0.05 * hop + 0.07 * land, roll: 0.05 * Math.sin(t * 30) * Math.exp(-t / 0.1) });
  }, ease.linear);

  T.fill = 0;
  T.ridge = 0;
  theo.each = null;
  paint.emissive.copy(baseEmissive);
  paint.emissiveIntensity = baseEI;
  glint.visible = false;
  theo.set({ lift: 0, sx: 1, sy: 1, sz: 1, roll: 0 });
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
}
