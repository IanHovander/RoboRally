// Checkpoint, idea 5 (Make a wish), animator a: weight and physical comedy.
export const meta = {
  title: 'Trick candle',
  idea:
    'As Maya settles on flag 1 its column of light squeezes down into a little candle flame hovering in front of her nose. She takes a huge breath (she swells, leans back, and the flame is sucked toward her), then puffs so hard she skids backwards from her own blast. The flame bends right over, fights its way half upright, and goes out: flag 1 is a dark spot with a curl of smoke made of light. A spark. Another. Then, like a trick birthday candle, it relights with a whoomp, the column springs back to full height with a wobble, Maya jumps, and her red ring lands at its foot.',
  notes:
    'Sound: a rising glass inhale, a soft breathy puff with a tiny skid, a flutter, then silence for the dark beat (the room goes quiet with it), two crackles, and a warm whoomp that rings like a struck glass as the column springs up. Porting: the column is redrawn as a bendable strip with the column\'s own texture and colour so the hand-back to the game\'s column is exact; the halo under it goes dark with it. The camera leans in for the candle (it is small from the sofa) and the whoomp blows it back home before the moment ends; her played card fades meanwhile, as in the game\'s focus mode. "Make a wish!" is something the room can say along with.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const mix = (a, b, k) => a + (b - a) * k;
const spring = (t, w, z) => {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
};

function glowSprite(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A candle flame: rounded at the foot, pointed at the tip, a bright core. */
function flameTexture(THREE) {
  const W = 64;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const s = 1 - (y + 0.5) / H; // 0 at the foot (canvas bottom), 1 at the tip
    const r = s < 0.3 ? Math.sqrt(s / 0.3) : (1 - (s - 0.3) / 0.7) ** 1.15;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - W / 2) / (W / 2);
      const q = r > 0.002 ? u / r : 99;
      const body = Math.exp(-q * q * 2.4) * (1 - 0.3 * s);
      const core = Math.exp(-q * q * 12) * Math.max(0, 1 - s * 1.25);
      const k = Math.min(1, body * 0.7 + core * 0.8);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(k * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const me = lab.bot('a');
  const maya = lab.puppet('a');
  const RED = new THREE.Color(me.color);
  const WARM = new THREE.Color('#f4efe4');
  const F = lab.pos(4, 1);
  const EAST = facing(1);
  const col = arena.columns.find((c) => c.n === 1);
  const cam = lab.camera3;

  // ---------- the flame: the column redrawn as a strip we can bend, squeeze and blow on ----------
  const SEGS = 24;
  const fgeo = new THREE.PlaneGeometry(1, 1, 1, SEGS);
  const fmat = new THREE.MeshBasicMaterial({ map: col.mat.map, color: new THREE.Color(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const flame = lab.add(new THREE.Mesh(fgeo, fmat));
  flame.frustumCulled = false;
  flame.renderOrder = 5;
  // the same strip drawn as a candle flame; the two cross-fade as the column squeezes down and springs back
  const cmat = new THREE.MeshBasicMaterial({ map: flameTexture(THREE), color: new THREE.Color(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const candle = lab.add(new THREE.Mesh(fgeo, cmat));
  candle.frustumCulled = false;
  candle.renderOrder = 5;
  const right = new THREE.Vector3();
  // base (world), height, width at the foot, bend (sideways at the tip, as a fraction of height), flutter
  const fl = { bx: F.x, by: 0, bz: F.z, h: 4.2, w: 1.1, taper: 0, bend: 0, flut: 0, k: 1, on: 1, candle: 0 };
  const drawFlame = (now) => {
    // face the camera exactly as the game's column does (a turn about the vertical)
    const yaw = Math.atan2(cam.position.x - F.x, cam.position.z - F.z);
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const pos = fgeo.attributes.position;
    for (let j = 0; j <= SEGS; j++) {
      const f = 1 - j / SEGS; // PlaneGeometry's rows run top to bottom
      const half = (fl.w / 2) * (1 - fl.taper * f ** 1.4);
      const side = fl.bend * fl.h * f * f + fl.flut * Math.sin(f * 7 - now * 38) * f;
      // a bent flame gets shorter as it lies over
      const up = fl.h * f * (1 - 0.35 * Math.min(1, Math.abs(fl.bend)) * f);
      for (let i = 0; i < 2; i++) {
        const u = i === 0 ? -half : half;
        const v = j * 2 + i;
        pos.setXYZ(v, fl.bx + right.x * (u + side), fl.by + up, fl.bz + right.z * (u + side));
      }
    }
    pos.needsUpdate = true;
    fmat.color.copy(col.mat.color).multiplyScalar(fl.k);
    fmat.opacity = fl.on * (1 - fl.candle);
    cmat.color.copy(WARM).multiplyScalar(2.2 * fl.k);
    cmat.opacity = fl.on * fl.candle;
  };

  // her breath: a few soft puffs of light leaving her front
  const tex = glowSprite(THREE);
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const s = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: WARM.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })));
    s.userData = { delay: i * 0.018, spread: lab.range(-1, 1), lift: lab.range(-0.5, 1) };
    puffs.push(s);
  }
  // the smoke: a thin curl of light rising from where the flame was
  const SM = 40;
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SM * 6), 3));
  sgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SM * 6), 3));
  const sidx = [];
  for (let i = 0; i < SM - 1; i++) sidx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  sgeo.setIndex(sidx);
  const smoke = lab.add(new THREE.Mesh(sgeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  smoke.frustumCulled = false;
  smoke.renderOrder = 6;
  // sparks before the relight, the blown-off tip, and a dark spot on the glass
  const spark = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: WARM.clone().multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })));
  const tip = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: WARM.clone().multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })));
  const dark = lab.add(new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false })));
  dark.rotation.x = -Math.PI / 2;
  dark.position.set(F.x, 0.009, F.z);
  dark.renderOrder = 3;
  // her taken ring
  const ring = lab.add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(1.8) })));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(F.x, 0.06, F.z);
  ring.visible = false;

  col.col.visible = false;
  const haloOn = col.halo.visible;
  lab.cleanup(() => {
    col.col.visible = true;
    col.halo.visible = haloOn;
  });

  // where the little flame hangs: just in front of and above her nose
  const WICK = { x: F.x + 0.32, y: 0.42, z: F.z };
  const FH = 0.95; // the little flame's height and width
  const FW = 0.62;

  const MOVE = 0.6;
  const SQZ = 0.5; // the column squeezes down into a flame
  const SQZ_MID = 0.76; // ...and the packed light hops up in front of her nose
  const SQZ1 = 0.96;
  const INHALE = 0.98;
  const PUFF = 1.32;
  const OUT = 1.66;
  const SPARK1 = 2.04;
  const SPARK2 = 2.15;
  const WHOOMP = 2.28;
  const END = 2.86;

  lab.playCard('a', ['m2']);
  const t0 = lab.t;
  const stop = lab.every(() => {
    const now = lab.t;
    const t = now - t0;

    // ---------- Maya ----------
    const pose = { x: 2 + 2 * ease.inOut3(seg(t, 0, MOVE)), rot: EAST, pitch: 0, lift: 0, sx: 1, sy: 1, sz: 1 };
    pose.pitch = -0.08 * Math.sin(Math.PI * seg(t, 0, MOVE * 0.5));
    const b = t - MOVE * 0.72;
    if (b > 0 && t < INHALE) pose.pitch += 0.22 * Math.exp(-b * 8) * Math.sin(b * 15);
    // she looks up at the little flame
    const look = ease.inOut(seg(t, SQZ1 - 0.15, INHALE));
    pose.pitch -= 0.16 * look;
    let eye = 1;
    if (t >= INHALE && t < PUFF) {
      // the big breath in: swell up, lean back
      const k = ease.inOut(seg(t, INHALE, PUFF));
      pose.sx = pose.sz = 1 + 0.18 * k;
      pose.sy = 1 + 0.12 * k;
      pose.pitch = -0.16 - 0.34 * k;
      pose.x = 4 - 0.04 * k;
      eye = 1 - 0.4 * k;
    } else if (t >= PUFF) {
      // PUFF: squeezes it all out, and the blast shoves her backwards across the glass
      const k = seg(t, PUFF, PUFF + 0.1);
      const after = t - PUFF;
      const squeeze = ease.out(k);
      const relax = spring(after - 0.1, 14, 0.4);
      const sq = mix(1, mix(-0.12, 0, relax), squeeze);
      pose.sx = pose.sz = 1 + 0.18 * (1 - squeeze) + (squeeze >= 1 ? sq : 0) * 0.6;
      pose.sy = 1 + 0.12 * (1 - squeeze) + (squeeze >= 1 ? sq * 0.6 : 0);
      const skid = after < 0.12 ? ease.out(after / 0.12) : Math.max(0, 1 - ease.inOut(seg(after, 0.28, 0.75)));
      pose.x = 4 - 0.04 - 0.26 * skid + 0.04 * seg(after, 0.28, 0.75);
      pose.pitch = mix(-0.5, -0.05, ease.out(seg(after, 0, 0.35)));
      eye = 1 + 2.4 * Math.max(0, 1 - after / 0.25);
      // the sparks: her head snaps up to look; the whoomp makes her jump
      if (t > SPARK1) pose.pitch -= 0.14 * ease.out(seg(t, SPARK1, SPARK1 + 0.08)) * (1 - seg(t, WHOOMP + 0.1, END - 0.05));
      if (t > WHOOMP) {
        const j = seg(t, WHOOMP, WHOOMP + 0.3);
        pose.lift = 0.1 * Math.sin(Math.PI * j);
        pose.sy *= 1 + 0.12 * Math.sin(Math.PI * j) - 0.08 * Math.sin(Math.PI * seg(t, WHOOMP + 0.3, WHOOMP + 0.45));
        pose.pitch += 0.1 * Math.sin(Math.PI * j);
      }
    }
    maya.set(pose);
    maya.each = (m) => m.eyeMat.color.setRGB(3.2 * eye, 3.1 * eye, 2.9 * eye);
    // while the camera leans in, her played card steps aside (as the game's own focus mode does)
    const closeK = ease.inOut(seg(t, 0.5, 0.9)) * (1 - ease.out(seg(t, WHOOMP + 0.02, END - 0.1)));
    if (me.card) me.card.material.opacity *= 1 - closeK;

    // ---------- the column / flame ----------
    const breathe = 1;
    fl.on = 1;
    fl.flut = 0;
    fl.candle = 0;
    if (t < SQZ) {
      Object.assign(fl, { bx: F.x, by: 0, bz: F.z, h: 4.2, w: 1.1, taper: 0, bend: 0, k: breathe });
    } else if (t < INHALE) {
      // first the column's top comes down: the light packs tighter and brighter...
      const kd = ease.inOut(seg(t, SQZ, SQZ_MID));
      // ...then the packed light hops off the glass to hang in front of her nose, wobbling like jelly
      const kh = seg(t, SQZ_MID, SQZ1);
      const jelly = spring(t - SQZ_MID, 20, 0.3);
      fl.bx = mix(F.x, WICK.x, ease.inOut(kh));
      fl.by = mix(0, WICK.y, ease.out(kh));
      fl.h = t < SQZ_MID ? mix(4.2, 1.25, kd) : mix(1.25, FH, jelly);
      fl.w = t < SQZ_MID ? mix(1.1, 0.8, kd) : mix(0.8, FW, jelly);
      fl.taper = 0.75 * kd;
      fl.bend = 0;
      fl.k = breathe * (1 + 0.9 * kd);
      fl.candle = seg(t, SQZ + 0.1, SQZ_MID + 0.06);
      // candle flicker
      fl.h *= 1 + kh * (0.07 * Math.sin(now * 23) + 0.05 * Math.sin(now * 37 + 1));
      fl.bend = kh * 0.05 * Math.sin(now * 13);
    } else if (t < PUFF + 0.04) {
      // the inhale sucks the flame toward her
      const k = ease.inOut(seg(t, INHALE, PUFF));
      fl.h = FH * (1 + 0.15 * k + 0.06 * Math.sin(now * 29));
      fl.w = FW * (1 - 0.15 * k);
      fl.bend = -0.45 * k + 0.05 * Math.sin(now * 17);
      fl.flut = 0.02 * k;
      fl.k = 1.6;
      fl.candle = 1;
    } else if (t < OUT) {
      // the puff: bent right over, fluttering, fighting its way half back up... then out
      const a = t - PUFF - 0.04;
      const hit = ease.out(seg(a, 0, 0.07));
      const fight = Math.sin(Math.PI * seg(t, PUFF + 0.16, OUT - 0.02)) ** 2;
      fl.bend = mix(-0.45, 1.25, hit) - 0.75 * fight;
      fl.flut = 0.07 * (1 - 0.5 * fight);
      fl.h = FH * (1 + 0.3 * hit - 0.25 * seg(t, OUT - 0.12, OUT));
      fl.w = FW * (1 - 0.35 * hit);
      fl.k = 1.6 * (1 - 0.45 * hit) * (1 - 0.6 * seg(t, OUT - 0.1, OUT));
      fl.candle = 1;
    } else if (t < WHOOMP) {
      fl.on = 0;
    } else {
      // whoomp: relit at the wick, and the column springs back to full height with a wobble
      const a = t - WHOOMP;
      const k = ease.out(seg(a, 0, 0.16));
      const s = spring(a, 17, 0.32);
      fl.bx = mix(WICK.x, F.x, k);
      fl.by = mix(WICK.y, 0, k);
      fl.h = Math.max(0.3, mix(FH * 0.8, 4.2, s));
      fl.w = mix(FW, 1.1, spring(a, 22, 0.3));
      fl.taper = 0.75 * (1 - k);
      fl.bend = 0;
      fl.k = 1 + 1.4 * Math.max(0, 1 - a / 0.4);
      fl.candle = 1 - seg(a, 0.02, 0.2);
      const settle = seg(t, END - 0.12, END);
      fl.h = mix(fl.h, 4.2, settle);
      fl.w = mix(fl.w, 1.1, settle);
      fl.k = mix(fl.k, 1, settle);
    }
    drawFlame(now);

    // the dark beat: the halo goes out, a dark spot on the glass
    const darkK = t < OUT - 0.05 ? 0 : t < WHOOMP ? seg(t, OUT - 0.05, OUT + 0.1) : 1 - seg(t, WHOOMP, WHOOMP + 0.12);
    col.halo.visible = darkK < 0.5;
    dark.material.opacity = 0.75 * darkK;

    // her breath
    for (const p of puffs) {
      const a = t - PUFF - p.userData.delay;
      const k = seg(a, 0, 0.32);
      if (a < 0 || k >= 1) {
        p.material.opacity = 0;
        continue;
      }
      const d = ease.out(k);
      p.position.set(F.x + 0.18 + 0.38 * d + 0.06 * p.userData.spread * d, 0.32 + 0.4 * d + 0.08 * p.userData.lift * d, F.z + 0.1 * p.userData.spread * d);
      p.scale.setScalar(0.12 + 0.32 * d);
      p.material.opacity = 0.75 * (1 - k) ** 1.5;
    }
    // the blown-off tip of the flame drifts away
    const tk = seg(t, OUT - 0.04, OUT + 0.4);
    if (tk > 0 && tk < 1) {
      tip.position.set(WICK.x + 0.3 + 0.45 * ease.out(tk), WICK.y + 0.35 + 0.35 * tk, WICK.z);
      tip.scale.setScalar(0.22 * (1 - tk * 0.5));
      tip.material.opacity = (1 - tk) ** 2;
    } else tip.material.opacity = 0;

    // the curl of smoke
    const sk = seg(t, OUT, WHOOMP);
    const pos = sgeo.attributes.position.array;
    const cc = sgeo.attributes.color.array;
    if (sk > 0 && sk < 1) {
      const a = t - OUT;
      const reach = Math.min(1, a / 0.45);
      for (let i = 0; i < SM; i++) {
        const f = (i / (SM - 1)) * reach;
        const y = WICK.y + 0.05 + f * 1.25;
        const x = WICK.x + 0.18 * f + 0.07 * Math.sin(f * 11 - a * 5) * (0.3 + f);
        const w = 0.016 + 0.026 * f;
        pos.set([x - w, y, WICK.z, x + w, y, WICK.z], i * 6);
        const fade = (1 - sk) ** 0.7 * Math.min(1, (1 - i / (SM - 1)) * 2) * (0.4 + 0.6 * Math.min(1, f * 4));
        const k = 1.7 * fade;
        cc.set([WARM.r * k, WARM.g * k, WARM.b * k, WARM.r * k, WARM.g * k, WARM.b * k], i * 6);
      }
      sgeo.attributes.position.needsUpdate = true;
      sgeo.attributes.color.needsUpdate = true;
      smoke.visible = true;
    } else smoke.visible = false;

    // two sparks at the wick
    const sp = Math.max(Math.max(0, 1 - Math.abs(t - SPARK1) / 0.05), 0.7 * Math.max(0, 1 - Math.abs(t - SPARK2) / 0.04), Math.max(0, 1 - Math.abs(t - WHOOMP) / 0.06) * 1.3);
    spark.position.set(WICK.x, WICK.y + 0.05, WICK.z);
    spark.scale.setScalar(0.18 + 0.3 * sp);
    spark.material.opacity = Math.min(1, sp);

    // her ring lands at the foot as the column comes back down onto the glass
    if (t > WHOOMP + 0.1) {
      ring.visible = true;
      const kd = seg(t, WHOOMP + 0.1, WHOOMP + 0.4);
      const h = kd < 0.55 ? 0.35 * (1 - (kd / 0.55) ** 2) : 0.06 * Math.sin(Math.PI * ((kd - 0.55) / 0.45));
      ring.position.y = 0.06 + h;
    }
  });
  lab.at(WHOOMP + 0.14, () => lab.ring(new THREE.Vector3(F.x, 0, F.z), '#f4efe4', 0.9, 0.02, 0.5));
  // the camera leans in for the candle (it's a small thing to see from the sofa), and is home as it relights
  let camRelease = null;
  lab.at(0.4, () => {
    camRelease = lab.camera((home) => {
      const t = lab.t - t0;
      // ...and the whoomp's blast shoves it back out: fast, then easing home
      const k = ease.inOut(seg(t, 0.42, 1.0)) * (1 - ease.out(seg(t, WHOOMP + 0.02, END - 0.04)));
      return { target: home.target.clone().lerp(new THREE.Vector3(F.x + 0.2, 0.4, F.z), 0.6 * k), dist: home.dist * (1 - 0.3 * k) };
    });
  });

  await lab.wait(END);
  stop();
  camRelease?.();
  flame.visible = false;
  candle.visible = false;
  smoke.visible = false;
  ring.visible = false;
  dark.visible = false;
  col.col.visible = true;
  col.halo.visible = haloOn;
  arena.setTaken([{ cp: 1, color: me.color }]);
  lab.cleanup(() => arena.setTaken([]));
  maya.each = null;
  maya.release({ x: 4, y: 1, d: 1 });
}
