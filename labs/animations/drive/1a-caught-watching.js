// Idea 45, "Backing away slowly", through the lens of weight: Maya is a heavy little pebble of glass on a
// sprung base. Every start and stop rocks her body on its foot (the ring and pointer never wobble: the rules
// stay exact while the mass sways). Rotate Right swings her round to face the room with momentum, and she
// catches us looking: a stiff jolt back onto her heel, the eye flaring, then a dead-still freeze. She
// tiptoes backward with her weight held back, eye locked on the sofa, and the U-Turn whips her round so fast
// her body overshoots and has to wobble itself straight, "as if nothing happened".
export const meta = {
  title: 'Caught watching',
  idea:
    'Rotate Right swings Maya round with real momentum; the moment her eye meets the room she jolts back onto her heel, her eye flares wide, and she freezes dead still, teetering. Move Back is a careful, weight-held-back tiptoe, eye never leaving us; then the U-Turn whips her round so hard her body overshoots and wobbles itself straight, as if nothing happened.',
  notes:
    'Lens: weight and physical comedy. A spring-damper "suspension" rocks the polished body on its foot from the base\'s real acceleration (lean back pulling away, pitch forward braking, yaw lag on turns) while ring and pointer stay exact. The freeze is the joke: the idle bob stops entirely for half a second. Sound: a soft glass "tink" on the jolt (like a glass set down too fast), silence through the freeze, a tiny tiptoe tick per step, a quick bright swish on the snap turn. General rule: any robot that turns to face the camera gets the jolt and eye flare with no added time; only "facing the camera, then Move Back" plays the slow tiptoe.',
};

const TAU = Math.PI * 2;

/** A spring-damper on the body: it rocks on its foot from the base's acceleration (forward, sideways, turning). */
function suspension(lab, p, { k = 190, c = 11, lean = 0.028, side = 0.02, twist = 0.05 } = {}) {
  const s = { pitch: 0, vp: 0, roll: 0, vr: 0, yaw: 0, vyaw: 0, kick: { p: 0, r: 0, y: 0 }, gain: { p: 1, r: 1, y: 1 } };
  let prev = null;
  const stop = lab.every((dt) => {
    if (dt <= 1e-5) return;
    const q = p.pose;
    const cur = { x: q.x, y: q.y, r: q.rot };
    if (!prev) {
      prev = { ...cur, vx: 0, vy: 0, w: 0 };
      return;
    }
    const vx = (cur.x - prev.x) / dt;
    const vy = (cur.y - prev.y) / dt;
    const w = (cur.r - prev.r) / dt;
    const ax = (vx - prev.vx) / dt;
    const ay = (vy - prev.vy) / dt;
    const aw = (w - prev.w) / dt;
    prev = { ...cur, vx, vy, w };
    const fx = -Math.sin(cur.r);
    const fy = -Math.cos(cur.r);
    const aF = ax * fx + ay * fy;
    const aR = ax * -fy + ay * fx;
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    const drive = { p: clamp(-aF * lean, 6) * s.gain.p, r: clamp(-aR * side, 6) * s.gain.r, y: clamp(-aw * twist * 0.02, 8) * s.gain.y };
    const n = 6;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      s.vp += (-k * s.pitch - c * s.vp + drive.p * k * 0.06 + s.kick.p) * h;
      s.pitch += s.vp * h;
      s.vr += (-k * s.roll - c * s.vr + drive.r * k * 0.06 + s.kick.r) * h;
      s.roll += s.vr * h;
      s.vyaw += (-k * 0.8 * s.yaw - c * 0.8 * s.vyaw + drive.y * k + s.kick.y) * h;
      s.yaw += s.vyaw * h;
    }
    s.kick = { p: 0, r: 0, y: 0 };
  });
  s.stop = stop;
  return s;
}

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,.1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function streakTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = (x - 128) / 128;
      const dy = (y - 16) / 16;
      const v = Math.exp(-dy * dy * 9) * Math.max(0, 1 - Math.abs(dx)) ** 2.2;
      const i = (y * 256 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(v * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { ease, facing, THREE } = lab;
  const maya = lab.puppet('a');
  const m = maya.model;
  const eye = m.body.children.find((o) => o.isMesh && o.material === m.eyeMat);
  const eyeBase = eye ? eye.scale.clone() : null;
  const sus = suspension(lab, maya);

  // the look: the eye's light flares (wider, brighter), with a soft bloom and a thin horizontal glint
  const warm = new THREE.Color('#fff3df');
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE), color: warm.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  glow.renderOrder = 40;
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: streakTexture(THREE), color: warm.clone().multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  glint.renderOrder = 41;
  lab.add(glow);
  lab.add(glint);

  const st = { eye: 0, flash: 0, frozen: false, extraPitch: 0 };
  const wp = new THREE.Vector3();
  maya.each = (model) => {
    // the body rocks on its foot (the ring and pointer stay put: they're the rules)
    model.body.rotation.set(-(sus.pitch + st.extraPitch), sus.yaw, -sus.roll);
    if (st.frozen) model.body.position.y = 0; // the freeze: even the idle breathing stops
    const k = st.eye;
    if (eye) eye.scale.set(eyeBase.x * (1 + 1.5 * k), eyeBase.y * (1 + 0.75 * k), eyeBase.z * (1 + 1.5 * k));
    const b = 1 + 0.7 * k + 1.4 * st.flash;
    model.eyeMat.color.setRGB(3.2 * b, 3.1 * b, 2.9 * b);
    if (eye) {
      eye.getWorldPosition(wp);
      glow.position.copy(wp);
      glint.position.copy(wp);
    }
    const g = Math.min(1, k * 1.2 + st.flash);
    glow.material.opacity = 0.32 * st.flash + 0.1 * k;
    glow.scale.setScalar(0.16 + 0.3 * st.flash);
    glint.material.opacity = 0.9 * Math.min(1, 0.3 * k + st.flash);
    glint.scale.set(0.28 + 0.25 * k + 1.0 * st.flash, 0.03 + 0.025 * st.flash, 1);
    void g;
  };

  // ----- Move 2: a heavy pull-away and a braking rock forward -----
  lab.playCard('a', ['m2']);
  await lab.wait(0.08);
  await lab.tween(0.62, (e) => maya.set({ x: 1 + 2 * e }), ease.inOut);
  await lab.wait(0.12);

  // ----- Rotate Right: she swings round with momentum... and finds us watching -----
  lab.playCard('a', ['rr']);
  await lab.wait(0.05);
  const r0 = facing(1);
  const r1 = facing(2);
  await lab.tween(0.3, (e) => maya.set({ rot: r0 + (r1 - r0) * e }), ease.in);
  // she arrives facing the room at full swing: the body would carry on, but she stops it dead
  sus.gain.y = 0; // ...but she stops it dead
  sus.vyaw = 0;
  sus.yaw = 0;
  st.flash = 1;
  // the jolt: back onto her heel, a hair up off the glass, stretched tall with surprise (four frames)
  lab.tween(0.5, (e, k) => (st.flash = Math.max(0, 1 - k) ** 2), ease.linear);
  await lab.tween(
    0.09,
    (e) => {
      st.eye = e;
      st.extraPitch = -0.26 * e;
      maya.set({ y: 2 - 0.08 * e, lift: 0.06 * Math.sin(e * Math.PI * 0.5), sy: 1 + 0.08 * e, sx: 1 - 0.04 * e, sz: 1 - 0.04 * e });
    },
    ease.out,
  );
  // teeter on the heel, then settle back to a held lean... and freeze
  st.frozen = true;
  await lab.tween(
    0.24,
    (e, k) => {
      const wob = Math.sin(k * TAU * 1.25) * Math.exp(-k * 3.2) * (1 - k);
      st.extraPitch = -0.26 + 0.16 * e + 0.07 * wob;
      maya.set({ lift: 0.06 * (1 - ease.outBounce(k)), sy: 1.08 - 0.08 * e, sx: 0.96 + 0.04 * e, sz: 0.96 + 0.04 * e });
    },
    ease.out,
  );
  maya.set({ lift: 0, sx: 1, sy: 1, sz: 1 });
  // the stare: nothing moves at all (that's the joke)
  await lab.wait(0.36);
  // a tiny gulp
  await lab.tween(0.14, (e, k) => maya.set({ sy: 1 - 0.035 * Math.sin(k * Math.PI), sx: 1 + 0.015 * Math.sin(k * Math.PI) }), ease.linear);

  // ----- Move Back: a slow, careful tiptoe, weight held back, eye locked on the room -----
  lab.playCard('a', ['bk']);
  await lab.wait(0.05);
  st.frozen = false;
  sus.gain.y = 1;
  const steps = 3;
  await lab.tween(
    0.78,
    (e, k) => {
      const ph = k * steps;
      const step = Math.sin(Math.min(1, ph % 1) * Math.PI);
      const side = Math.floor(ph) % 2 ? -1 : 1;
      // creep: each tiptoe step is a little lift and a sway onto one side
      const yk = (Math.floor(ph) + ease.inOut(ph % 1)) / steps;
      maya.set({ y: 1.92 - (k >= 1 ? 0.92 : 0.92 * yk), lift: 0.04 * step, roll: 0.11 * side * step, sy: 1 + 0.03 * step });
      st.extraPitch = -0.1 - 0.03 * step;
    },
    ease.linear,
  );
  maya.set({ y: 1, lift: 0, roll: 0, sy: 1 });
  await lab.wait(0.1);

  // ----- U-Turn: whip round as if nothing happened -----
  lab.playCard('a', ['ut']);
  const u0 = facing(2);
  const u1 = facing(2) - Math.PI;
  lab.tween(0.16, (e) => (st.eye = 1 - e), ease.out);
  await lab.tween(
    0.2,
    (e) => {
      maya.set({ rot: u0 + (u1 - u0) * e });
      st.extraPitch = -0.1 * (1 - e);
    },
    ease.out3,
  );
  // the body overshoots the snap and wobbles itself straight
  sus.vyaw -= 4.5;
  st.extraPitch = 0;
  st.eye = 0;
  await lab.wait(0.36);
  // let the last of the wobble die before handing her back
  await lab.tween(0.12, (e) => {
    sus.yaw *= 1 - e;
    sus.pitch *= 1 - e;
    sus.roll *= 1 - e;
  }, ease.linear);
  sus.stop();
  maya.each = null;
  m.body.rotation.set(0, 0, 0);
  if (eye) eye.scale.copy(eyeBase);
  glow.visible = glint.visible = false;
  maya.release({ x: 3, y: 1, d: 0 });
}
