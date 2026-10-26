// The door left ajar, lit like a Turrell room. The room's own light sinks; behind the panel a door of warm light
// cracks open in the dark and a wedge of it falls across the glass toward us: a soft volume in the air with dust
// motes turning in it, a long shadow of Maya stretching at our feet, Ava's polish catching the glow, a faint patch
// on the floor far below. The camera drifts down into it, reverent. The wedge widens and its draught carries Maya one
// space south like a leaf, swaying, her pointer still east. Then the door eases shut to a line, the line goes out,
// the motes settle and the room's light comes back.
export const meta = {
  title: 'The other room',
  idea: 'The room\'s light sinks and a door of warm light cracks open in the dark behind the panel: a wedge falls across the glass with dust turning in it, Maya\'s long shadow stretching toward us, Ava gleaming, the camera drifting down into it. The wedge widens and its draught carries Maya one space south like a leaf, still facing east; then the door eases shut to a line, goes out, and the room\'s light returns.',
  notes: 'Sound: no hit at all. A low warm hum swells as the door opens (a bowed glass), soft airy glass tinkles for the motes, a gentle rising breath as she drifts, and the hum folds away to one quiet glass note as the door closes. Port: one spot light (no shadow map; Maya\'s shadow is a drawn gradient), an additive wedge on the glass, a cone of haze, a few dozen motes, the room\'s lights dimmed for 1.7 s. The wedge always opens from the panel\'s wall toward the push direction. 1.8 s.',
};

const mix = (a, b, e) => a + (b - a) * e;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const WARM = '#ffdcae';

function director(lab) {
  const A = lab.arena;
  const h = A.camHome;
  const shot = { tx: h.target.x, ty: h.target.y, tz: h.target.z, dist: h.dist, el: h.elev, az: 0, fov: 30, roll: 0 };
  const home = { ...shot };
  const sx0 = A.camCur?.sx ?? 0;
  const sy0 = A.camCur?.sy ?? 0;
  let last = lab.t;
  const release = lab.camera(() => {
    const dt = Math.max(0, lab.t - last);
    last = lab.t;
    const k = Math.min(0.9, dt * 4);
    if (A.camCur) {
      A.camCur.sx = sx0 / (1 - k);
      A.camCur.sy = sy0 / (1 - k);
    }
    return { target: new lab.THREE.Vector3(shot.tx, shot.ty, shot.tz), dist: shot.dist, el: shot.el, az: shot.az, fov: shot.fov, roll: shot.roll };
  });
  return { shot, home, release };
}

function tex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// the wedge on the glass: apex at the top centre of the canvas, fanning down to TMAX each side, fading with distance
const TMAX = 0.5;
function drawWedge(g, w, h) {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dz = (y + 0.5) / h; // 0 at the apex, 1 at the far end
      const dx = ((x + 0.5) / w - 0.5) * 2 * Math.tan(TMAX); // in the same units as dz
      const a = Math.atan2(Math.abs(dx), dz) / TMAX; // 0 on the axis, 1 at the edge
      const edge = clamp01((1 - a) / 0.35);
      const fall = Math.pow(1 - dz, 0.9) * 0.85 + 0.15;
      const near = clamp01(dz / 0.04);
      const v = edge * edge * (3 - 2 * edge) * fall * near;
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * v);
    }
  }
  g.putImageData(img, 0, 0);
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const E = lab.facing(1);
  const maya = lab.puppet('a');
  const bm = lab.bot('a');
  const ava = lab.bot('b');
  const cam = director(lab);
  const { shot, home } = cam;
  const add = (m) => lab.add(m);

  const WALL = lab.pos(3, 1).z - 0.5 - 0.06; // just behind the panel
  const APEX = new THREE.Vector3(0, 0.0, WALL);
  const LEN = lab.pos(3, 3).z + 0.5 - WALL; // to the south edge of the glass

  // ---------- the door: a slit of warm light standing in the dark ----------
  const doorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(3.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const DOOR_H = 1.25;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1, DOOR_H).translate(0, DOOR_H / 2, 0), doorMat);
  door.position.set(0, 0, WALL - 0.02);
  add(door);
  const haloMat = new THREE.MeshBasicMaterial({
    map: tex(THREE, 64, 128, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,0.9)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.save();
      g.scale(1, 2);
      g.fillRect(0, 0, w, h / 2);
      g.restore();
    }),
    color: new THREE.Color(WARM).multiplyScalar(1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), haloMat);
  halo.position.set(0, DOOR_H / 2, WALL - 0.03);
  add(halo);

  // ---------- the wedge on the glass ----------
  const wedgeMat = new THREE.MeshBasicMaterial({ map: tex(THREE, 128, 128, drawWedge), color: new THREE.Color(WARM).multiplyScalar(1.15), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const WIDE = 2 * Math.tan(TMAX) * LEN;
  const wedge = new THREE.Mesh(new THREE.PlaneGeometry(WIDE, LEN).translate(0, -LEN / 2, 0), wedgeMat);
  wedge.rotation.x = -Math.PI / 2;
  wedge.position.set(0, 0.006, APEX.z);
  wedge.renderOrder = 4;
  add(wedge);

  // ---------- Maya's long shadow, stretching toward us ----------
  const shadowMat = new THREE.MeshBasicMaterial({
    map: tex(THREE, 64, 256, (g, w, h) => {
      const lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, 'rgba(0,0,0,1)');
      lg.addColorStop(0.45, 'rgba(0,0,0,0.88)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(w * 0.18, 0);
      g.lineTo(w * 0.82, 0);
      g.lineTo(w * 0.98, h);
      g.lineTo(w * 0.02, h);
      g.closePath();
      g.filter = 'blur(3px)';
      g.fill();
    }),
    transparent: true, opacity: 0, depthWrite: false,
  });
  const SH_LEN = 1.7;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, SH_LEN).translate(0, -SH_LEN / 2, 0), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 6;
  add(shadow);

  // ---------- a cone of haze in the air ----------
  const hazeMat = new THREE.MeshBasicMaterial({
    map: tex(THREE, 8, 128, (g, w, h) => {
      const lg = g.createLinearGradient(0, 0, 0, h);
      // canvas top = the cone's apex at the door: bright there, gone by the far end
      lg.addColorStop(0, 'rgba(255,255,255,1)');
      lg.addColorStop(0.45, 'rgba(255,255,255,0.3)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
    }),
    color: new THREE.Color(WARM).multiplyScalar(0.35), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const coneGeo = new THREE.ConeGeometry(1, 1, 48, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);
  const haze = new THREE.Mesh(coneGeo, hazeMat);
  haze.position.set(0, 0.45, WALL);
  haze.rotation.x = 0.16;
  haze.renderOrder = 5;
  add(haze);

  // ---------- the floor far below catches what spills off the edge ----------
  const floorMat = new THREE.MeshBasicMaterial({
    map: tex(THREE, 64, 64, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, w, h);
    }),
    color: new THREE.Color(WARM).multiplyScalar(0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMat);
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, -1.585, APEX.z + LEN + 1.3);
  add(floorGlow);

  // ---------- dust in the beam ----------
  const N = 70;
  const mote = [];
  const mpos = new Float32Array(N * 3);
  const mcol = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) mote.push({ u: lab.rand(), a: lab.range(-1, 1), h: lab.range(0.02, 0.75), ph: lab.range(0, 6.28), sp: lab.range(0.03, 0.12) });
  const mgeo = new THREE.BufferGeometry();
  mgeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
  mgeo.setAttribute('color', new THREE.BufferAttribute(mcol, 3));
  const motes = new THREE.Points(mgeo, new THREE.PointsMaterial({ size: 0.075, vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  add(motes);
  const warm = new THREE.Color(WARM);

  // ---------- the light itself, for the robots' polish ----------
  const spot = new THREE.SpotLight(0xffd3a0, 0, 7, 0.5, 0.8, 1);
  spot.position.set(0, 0.55, WALL);
  spot.target.position.set(0, 0, lab.pos(3, 3).z + 0.6);
  add(spot);
  add(spot.target);

  // ---------- the room's own light sinks while the door is open ----------
  const keyI = A.key.intensity;
  const hemiI = A.hemi.intensity;
  lab.cleanup(() => {
    A.key.intensity = keyI;
    A.hemi.intensity = hemiI;
  });

  let open = 0; // the crack: 0 shut, 1 fully open
  let light = 0; // how much light is spilling
  let iris = 0; // how far the room's own light has sunk
  let settle = 0; // the motes coming to rest at the end
  const stop = lab.every((dt, t) => {
    const theta = 0.05 + 0.4 * open; // the wedge's half-angle
    A.topMat.emissiveIntensity *= 1 - 0.62 * iris;
    A.key.intensity = keyI * (1 - 0.55 * iris);
    A.hemi.intensity = hemiI * (1 - 0.5 * iris);
    doorMat.opacity = Math.min(1, light * 1.5);
    door.scale.x = 0.012 + 0.2 * open;
    haloMat.opacity = 0.55 * light;
    halo.scale.x = 0.5 + 0.8 * open;
    wedgeMat.opacity = 0.78 * light;
    wedge.scale.x = Math.tan(theta) / Math.tan(TMAX);
    hazeMat.opacity = 0.32 * light;
    floorMat.opacity = 0.6 * light;
    floorGlow.scale.set(1.2 + 3 * Math.tan(theta) * 2, 3.2, 1);
    const r = Math.tan(theta) * LEN;
    haze.scale.set(r, r * 0.55, LEN);
    spot.intensity = 9 * light;
    spot.angle = 0.18 + 0.55 * open;
    // Maya's shadow, falling away from the door
    const mp = maya.group.position;
    shadow.position.set(mp.x, 0.009, mp.z + 0.05);
    const away = Math.atan2(mp.x - APEX.x, mp.z - APEX.z);
    shadow.rotation.z = away;
    shadowMat.opacity = light;
    shadow.scale.set(1, 0.7 + 0.5 * open, 1);
    // dust turning in the beam
    for (let i = 0; i < N; i++) {
      const m = mote[i];
      const u = (m.u + t * m.sp * 0.35) % 1;
      const z = APEX.z + 0.15 + u * (LEN - 0.3);
      const half = Math.tan(theta) * (z - APEX.z);
      const x = m.a * half + Math.sin(t * 0.9 + m.ph) * 0.04;
      const fallen = settle * settle;
      const y = mix(m.h * (0.25 + 0.75 * u) + Math.sin(t * 1.3 + m.ph * 2) * 0.03, 0.02, fallen);
      mpos.set([x, y, z], i * 3);
      const inBeam = 1 - Math.pow(Math.abs(m.a), 4);
      const tw = 0.6 + 0.4 * Math.sin(t * 5 + m.ph * 3);
      const k = light * inBeam * tw * (1.6 - u * 0.8) * (1 - 0.7 * fallen) + 0.6 * settle * (1 - settle) * 4 * inBeam * tw;
      mcol.set([warm.r * k, warm.g * k, warm.b * k], i * 3);
    }
    mgeo.attributes.position.needsUpdate = true;
    mgeo.attributes.color.needsUpdate = true;
  });

  let eyeWarm = 0;
  const amber = new THREE.Color(3.4, 2.6, 1.6);
  const white = new THREE.Color(3.2, 3.1, 2.9);
  maya.each = (m) => m.eyeMat.color.copy(white).lerp(amber, eyeWarm);
  let tagK = 1;
  const stopTag = lab.every(() => {
    for (const b of [bm, ava]) if (b.tag) b.tag.material.opacity = tagK;
  });
  lab.cleanup(() => {
    for (const b of [bm, ava]) if (b.tag) b.tag.material.opacity = 1;
  });
  maya.set({ x: 3, y: 1, rot: E });

  // ---- 0.00-0.40 the room sinks; the door cracks open; light spills
  await lab.tween(0.4, (e, k) => {
    iris = ease.inOut(k);
    light = ease.out(span(k, 0.15, 1));
    open = 0.25 * ease.inOut(span(k, 0.2, 1));
    tagK = 1 - 0.7 * k;
    eyeWarm = 0.6 * light;
    // the camera sinks a little toward the glass, into the light
    shot.el = mix(home.el, home.el - 0.1, ease.inOut(k) * 0.4);
    shot.dist = mix(home.dist, home.dist * 0.93, ease.inOut(k) * 0.4);
    shot.tz = mix(home.tz, home.tz - 0.15, ease.inOut(k) * 0.4);
  }, ease.linear);

  // ---- 0.40-1.20 the wedge widens; its draught carries her like a leaf
  await lab.tween(0.8, (e, k) => {
    open = mix(0.25, 1, ease.inOut(clamp01(k * 1.3)));
    light = 1;
    const d = ease.inOut(k);
    const sway = Math.sin(k * Math.PI * 2.2) * (1 - k * 0.6);
    maya.set({
      y: 1 + d,
      x: 3 + 0.07 * sway * Math.sin(k * Math.PI),
      lift: 0.05 * Math.sin(k * Math.PI),
      roll: 0.13 * sway,
      pitch: 0.04 * Math.sin(k * Math.PI * 2),
      rot: E,
      trail: true,
    });
    eyeWarm = 0.6 + 0.4 * Math.sin(k * Math.PI);
    const c = 0.4 + 0.6 * ease.inOut(k);
    shot.el = mix(home.el, home.el - 0.1, c);
    shot.dist = mix(home.dist, home.dist * 0.93, c);
    shot.tz = mix(home.tz, home.tz - 0.15, c);
  }, ease.linear);

  // ---- 1.20-1.70 the door eases shut to a line, the line goes out; the motes settle; the room comes back
  maya.set({ x: 3, y: 2, lift: 0, roll: 0, pitch: 0 });
  await lab.tween(0.5, (e, k) => {
    open = 1 - ease.inOut(clamp01(k / 0.65));
    light = 1 - ease.in(span(k, 0.45, 0.8));
    iris = 1 - ease.inOut(span(k, 0.45, 1));
    settle = ease.out(span(k, 0.2, 1));
    eyeWarm = 0.6 * (1 - k);
    tagK = 0.3 + 0.7 * span(k, 0.5, 1);
    const c = ease.inOut(k);
    shot.el = mix(home.el - 0.1, home.el, c);
    shot.dist = mix(home.dist * 0.93, home.dist, c);
    shot.tz = mix(home.tz - 0.15, home.tz, c);
  }, ease.linear);

  stop();
  stopTag();
  A.key.intensity = keyI;
  A.hemi.intensity = hemiI;
  spot.intensity = 0;
  motes.visible = false;
  Object.assign(shot, home);
  cam.release();
  maya.each = null;
  maya.set({ x: 3, y: 2, lift: 0, roll: 0, pitch: 0, rot: E });
  maya.release({ x: 3, y: 2, d: 1 });
}
