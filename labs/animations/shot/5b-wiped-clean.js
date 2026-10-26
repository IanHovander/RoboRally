// Wiped clean, acted. At the hit a sliver of Theo's beam glances off Maya's polish and flies at us, and splats on
// the TV's own glass as a soft blue smudge. All three robots look up at it, at us: Jun whips round (we see his eye
// for the first time), Maya squints, Theo slowly looks away, guilty. Jun leans left, then right, to see past the
// smudge. A thumb comes in and wipes it away in one curved stroke, all three heads following it like a crowd at
// a tennis match, and Jun gives a satisfied little nod before everyone turns back to the game.
export const meta = {
  title: 'Wiped clean (the audience)',
  idea:
    'A sliver of the beam glances off Maya\'s polish and splats on the TV\'s own glass as a soft, out-of-focus smudge of blue light. The robots notice: all three look up at us, Jun whips round, Maya squints, Theo looks away whistling, and Jun peers left and right around the smudge. A soft thumb wipes it away in one curved stroke while three heads follow it in unison; Jun nods, satisfied, and everyone turns back as if nothing happened.',
  notes:
    'Sound: the hit chime, a rising glassy "pew" as the sliver flies at us, a soft wet "pip" as it lands on the screen (close, dry, no reverb), a low hum while it hangs, a squeaky-soft glass "fwip" for the wipe, and one tiny "tik" for Jun\'s nod. Porting: the smudge and the thumb live in the HUD layer above the picture (CSS gradients, blur and a conic-gradient mask that pivots like a thumb from the bottom-right corner); keep it rare (first hit of the night, or a 1-in-20 roll). The looking-up is body only: nobody leaves their space.',
};

// ---------- small acting toolkit (kept in this file so the entry stands alone) ----------

function track(lab, list) {
  return (t) => {
    if (t <= list[0][0]) return list[0][1];
    for (let i = 1; i < list.length; i++) {
      const [t1, v1, e] = list[i];
      if (t <= t1) {
        const [t0, v0] = list[i - 1];
        const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
        return v0 + (v1 - v0) * lab.ease[e ?? 'inOut'](k);
      }
    }
    return list[list.length - 1][1];
  };
}
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const win = (t, a, b) => clamp01((t - a) / (b - a));

/** A robot as an actor: body-only lean, turn, squash and eye, so its ring and pointer stay true. */
function actor(lab, key) {
  const p = lab.puppet(key);
  const m = p.model;
  const eyes = [];
  m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && eyes.push([o, o.scale.clone()]));
  const st = { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, up: 0, eye: 1, eyeS: 1 };
  m.body.rotation.order = 'YXZ';
  p.each = (model) => {
    const b = model.body;
    b.rotation.set(-st.pitch, st.yaw, -st.roll);
    b.scale.set(st.sx, st.sy, st.sz);
    b.position.y += st.up;
    for (const [o, s] of eyes) o.scale.copy(s).multiplyScalar(st.eyeS);
    const e = st.eye;
    model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
  };
  const done = (state) => {
    p.each = null;
    m.body.scale.set(1, 1, 1);
    m.body.rotation.order = 'XYZ';
    for (const [o, s] of eyes) o.scale.copy(s);
    p.release(state);
  };
  return { p, m, st, done };
}

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------- the moment ----------

export default async function play(lab) {
  const { THREE } = lab;
  const K = (list) => track(lab, list);
  const maya = actor(lab, 'a');
  const theo = actor(lab, 'b');
  const jun = actor(lab, 'c');
  const BLUE = lab.bot('b').color;
  const glowTex = glowTexture(THREE);

  // ----- timing -----
  const T_FIRE = 0.14;
  const T_HIT = 0.19;
  const T_LAND = 0.56; // the sliver hits the screen
  const T_WIPE = 1.2; // the thumb comes in
  const T_CLEAN = 1.56;
  const T_END = 2.3;

  // ----- the shot: an ordinary beam -----
  theo.m.muzzle.updateWorldMatrix(true, false);
  const muzzle = new THREE.Vector3().setFromMatrixPosition(theo.m.muzzle.matrixWorld);
  const mayaC = lab.pos(1, 1);
  const flank = new THREE.Vector3(mayaC.x + 0.3, muzzle.y, muzzle.z);
  const mkBeam = (r, color, opacity) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.z = Math.PI / 2;
    m.renderOrder = 6;
    m.visible = false;
    lab.add(m);
    return m;
  };
  const beamCore = mkBeam(0.01, new THREE.Color('#ffffff').multiplyScalar(3), 1);
  const beamGlow = mkBeam(0.032, new THREE.Color(BLUE).multiplyScalar(1.5), 0.5);

  // ----- the sliver: a bright fleck that flies at the camera, growing as it comes -----
  const sliver = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#cfe8ff').multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  sliver.renderOrder = 40;
  sliver.visible = false;
  lab.add(sliver);
  const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE).multiplyScalar(2), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  streak.renderOrder = 39;
  streak.visible = false;
  lab.add(streak);

  // ----- the screen: where the smudge lands (CSS px in the overlay) -----
  const box = lab.overlay.getBoundingClientRect();
  const W = box.width || 960;
  const H = box.height || 540;
  const S = { x: W * 0.46, y: H * 0.36 }; // a little above the middle, over the row of the shot
  const SR = Math.min(W, H) * 0.24; // the smudge's size
  // the 3D point just in front of the lens that lands on S
  const cam = lab.camera3;
  cam.updateMatrixWorld();
  const ndc = new THREE.Vector3((S.x / W) * 2 - 1, -(S.y / H) * 2 + 1, 0.5).unproject(cam);
  const lens = cam.position.clone().add(ndc.sub(cam.position).normalize().multiplyScalar(0.9));
  const ctrl = flank.clone().lerp(lens, 0.35).add(new THREE.Vector3(0.6, 1.1, 0)); // it ricochets up and across
  const visW = 2 * 0.9 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (W / H); // world width at the lens point
  const landScale = ((SR * 2.2) / W) * visW;
  const bez = (k, out) => {
    const a = 1 - k;
    return out.set(0, 0, 0).addScaledVector(flank, a * a).addScaledVector(ctrl, 2 * a * k).addScaledVector(lens, k * k);
  };
  const sp = new THREE.Vector3();
  const sp2 = new THREE.Vector3();
  const upV = new THREE.Vector3(0, 1, 0);

  // the smudge: layered soft gradients, blurred (out of focus), screen-blended over the picture
  const el = (css) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;pointer-events:none;${css}`;
    lab.overlay.append(d);
    return d;
  };
  const smearWrap = el(`left:0;top:0;width:${W}px;height:${H}px;opacity:0;`);
  const smear = document.createElement('div');
  smear.style.cssText = `position:absolute;left:${S.x - SR * 1.3}px;top:${S.y - SR}px;width:${SR * 2.6}px;height:${SR * 2}px;
    background:
      radial-gradient(ellipse 30% 26% at 46% 48%, rgba(235,246,255,.95), rgba(160,205,255,.55) 45%, rgba(77,171,247,0) 100%),
      radial-gradient(ellipse 50% 40% at 52% 52%, rgba(120,185,255,.55), rgba(77,171,247,.18) 55%, rgba(77,171,247,0) 100%),
      radial-gradient(ellipse 18% 12% at 70% 64%, rgba(200,230,255,.6), rgba(77,171,247,0) 100%),
      radial-gradient(ellipse 12% 10% at 26% 40%, rgba(200,230,255,.5), rgba(77,171,247,0) 100%);
    filter: blur(${Math.round(SR * 0.09)}px); mix-blend-mode: screen; transform-origin: 46% 48%; border-radius: 50%;`;
  smearWrap.append(smear);
  // a faint lens blur of the picture behind the smudge (a smudge on glass softens what's behind it)
  const haze = el(`left:${S.x - SR * 0.9}px;top:${S.y - SR * 0.7}px;width:${SR * 1.8}px;height:${SR * 1.4}px;border-radius:50%;
    backdrop-filter: blur(3px); -webkit-mask-image: radial-gradient(closest-side, #000 40%, transparent); mask-image: radial-gradient(closest-side, #000 40%, transparent); opacity:0;`);
  // splash droplets when it lands
  const drops = [];
  for (let i = 0; i < 5; i++) {
    const a = -0.6 + i * 1.35 + (i % 2) * 0.4;
    const r = SR * (0.12 + 0.05 * (i % 3));
    drops.push({ a, d: SR * (0.95 + 0.25 * (i % 2)), node: el(`width:${r}px;height:${r}px;border-radius:50%;background:radial-gradient(circle, rgba(220,240,255,.9), rgba(77,171,247,0) 70%);filter:blur(2px);mix-blend-mode:screen;opacity:0;`), r });
  }
  // the thumb: a soft, out-of-focus pad of darkness with a faint rim of the smudge's light
  const P = { x: W * 1.08, y: H * 1.32 }; // the wrist: off the bottom-right corner
  const dx = S.x - P.x;
  const dy = S.y - P.y;
  const RAD = Math.hypot(dx, dy);
  const angS = (Math.atan2(dx, -dy) * 180) / Math.PI + 360; // CSS conic angle of the smudge's centre
  const A0 = angS + 26; // the stroke starts right of the smudge...
  const A1 = angS - 30; // ...and ends left of it
  const TW = SR * 1.5;
  const TH = SR * 1.05;
  const thumb = el(`left:0;top:0;width:${TW}px;height:${TH}px;border-radius:50% 50% 46% 54% / 60% 60% 40% 40%;
    background: radial-gradient(ellipse at 50% 40%, rgba(10,12,16,.62), rgba(10,12,16,.4) 55%, rgba(10,12,16,0) 72%);
    box-shadow: inset 0 0 ${SR * 0.12}px rgba(140,190,255,.14); filter: blur(${Math.round(SR * 0.1)}px); opacity:0;`);
  // the streak the thumb drags behind it, fading
  const streakCss = el(`left:0;top:0;width:${W}px;height:${H}px;opacity:0;mix-blend-mode:screen;`);

  // ----- the acting -----
  // Theo: fires; when it lands on the screen he looks round at us... then slowly away, whistling; follows the thumb
  const tPitch = K([[0, 0], [T_FIRE - 0.02, -0.16, 'out'], [T_FIRE + 0.06, 0.1, 'out'], [T_FIRE + 0.25, 0, 'inOut'], [T_LAND + 0.16, 0], [T_LAND + 0.3, -0.24, 'inOut'], [T_LAND + 0.48, -0.24], [T_WIPE, -0.06, 'inOut'], [T_CLEAN + 0.25, -0.12], [T_END - 0.08, 0, 'inOut']]);
  const tYaw = K([[0, 0], [T_LAND + 0.16, 0], [T_LAND + 0.32, 1.25, 'inOut'], [T_LAND + 0.48, 1.25], [T_WIPE - 0.04, 0.55, 'inOut'], [T_WIPE + 0.08, 1.15, 'inOut'], [T_CLEAN + 0.3, 1.15], [T_END - 0.06, 0, 'inOut']]);
  const tEye = K([[0, 1], [T_FIRE - 0.02, 1.8], [T_FIRE + 0.1, 1], [T_LAND + 0.48, 1], [T_LAND + 0.6, 0.55, 'inOut'], [T_WIPE + 0.08, 0.9], [T_END, 1]]);
  // Jun: whips round to face us (we see his eye), looks up, peers left and right round the smudge, nods
  const jYaw = K([[0, 0], [T_LAND + 0.06, 0], [T_LAND + 0.24, Math.PI, 'outBack'], [T_CLEAN + 0.32, Math.PI], [T_END - 0.04, 0, 'inOut']]);
  const jPitch = K([[0, 0], [T_LAND + 0.18, 0], [T_LAND + 0.3, -0.3, 'out'], [T_WIPE, -0.26], [T_CLEAN, -0.26], [T_CLEAN + 0.06, 0.1, 'out'], [T_CLEAN + 0.12, -0.12, 'inOut'], [T_CLEAN + 0.18, 0.08, 'inOut'], [T_CLEAN + 0.26, -0.06, 'inOut'], [T_END - 0.08, 0, 'inOut']]);
  const jPeer = K([[0, 0], [T_LAND + 0.32, 0], [T_LAND + 0.44, -0.2, 'inOut'], [T_LAND + 0.52, -0.2], [T_LAND + 0.62, 0.22, 'inOut'], [T_WIPE - 0.04, 0.2], [T_WIPE + 0.06, 0, 'inOut']]);
  const jSy = K([[0, 1], [T_LAND, 1], [T_LAND + 0.05, 0.86, 'out'], [T_LAND + 0.25, 1.06, 'out'], [T_WIPE, 1.06], [T_CLEAN + 0.3, 1, 'inOut']]);
  // Maya: takes the hit, then looks up at us; squints at the smudge; follows the thumb; settles
  const mRoll = K([[0, 0], [T_HIT, 0], [T_HIT + 0.04, 0.16, 'out'], [T_HIT + 0.32, 0, 'outElastic']]);
  const mPitch = K([[0, 0], [T_LAND, 0], [T_LAND + 0.12, -0.36, 'outBack'], [T_CLEAN + 0.2, -0.32], [T_END - 0.1, 0, 'inOut']]);
  const mEyeS = K([[0, 1], [T_LAND, 1], [T_LAND + 0.1, 1.6, 'outBack'], [T_LAND + 0.3, 1.5], [T_LAND + 0.4, 0.62, 'inOut'], [T_WIPE, 0.62], [T_WIPE + 0.1, 1.2, 'out'], [T_CLEAN + 0.25, 1.15], [T_END - 0.06, 1, 'inOut']]);
  const mSy = K([[0, 1], [T_LAND, 1], [T_LAND + 0.05, 0.88, 'out'], [T_LAND + 0.25, 1.04, 'out'], [T_CLEAN + 0.2, 1.04], [T_CLEAN + 0.3, 0.95, 'inOut'], [T_END - 0.06, 1, 'inOut']]);
  // everyone's heads follow the thumb across the screen (to screen-left is to the right of a robot facing us)
  const follow = (t) => {
    const k = win(t, T_WIPE, T_CLEAN);
    return (0.5 - lab.ease.inOut(k)) * (t > T_WIPE - 0.1 && t < T_CLEAN + 0.25 ? 1 : 0) * (1 - win(t, T_CLEAN, T_CLEAN + 0.25));
  };

  const T0 = lab.t;
  let fired = false;
  let hit = false;
  let landed = false;
  const stop = lab.every(() => {
    const t = lab.t - T0;
    const fl = follow(t);
    Object.assign(theo.st, { pitch: tPitch(t), yaw: tYaw(t) + 0.5 * fl, eye: tEye(t) });
    Object.assign(jun.st, { yaw: jYaw(t) + 0.55 * fl, pitch: jPitch(t), roll: jPeer(t), sy: jSy(t), sx: 1 + (1 - jSy(t)) * 0.5, sz: 1 + (1 - jSy(t)) * 0.5 });
    Object.assign(maya.st, { roll: mRoll(t), pitch: mPitch(t), yaw: 0.5 * fl, eyeS: mEyeS(t), sy: mSy(t), sx: 1 + (1 - mSy(t)) * 0.6, sz: 1 + (1 - mSy(t)) * 0.6 });

    // the beam
    if (!fired && t >= T_FIRE) {
      fired = true;
      lab.arena.emit('laser', { board: false, hit: true, src: 'b' });
    }
    const bk = win(t, T_FIRE, T_HIT);
    const bOn = t >= T_FIRE ? 1 - win(t, T_HIT + 0.2, T_HIT + 0.5) : 0;
    const xHead = muzzle.x + (flank.x - muzzle.x) * bk;
    for (const b of [beamCore, beamGlow]) {
      b.visible = bOn > 0.001;
      b.scale.y = Math.max(0.001, muzzle.x - xHead);
      b.position.set((muzzle.x + xHead) / 2, muzzle.y, muzzle.z);
    }
    beamCore.material.opacity = bOn;
    beamGlow.material.opacity = 0.5 * bOn;
    if (!hit && t >= T_HIT) {
      hit = true;
      lab.glitch('a', '#ff7a6b');
      lab.shards(flank.clone(), '#ff7a6b', 10);
      lab.arena.emit('damage', { id: 'a', n: 1, hw: 0 });
    }

    // the sliver: off her polish, up and at us, accelerating and growing
    const fk = win(t, T_HIT + 0.02, T_LAND);
    sliver.visible = streak.visible = t > T_HIT + 0.02 && t < T_LAND;
    if (sliver.visible) {
      const e = lab.ease.in(fk);
      bez(e, sp);
      bez(Math.max(0, e - 0.08), sp2);
      sliver.position.copy(sp);
      const s = 0.06 + (landScale - 0.06) * e * e;
      sliver.scale.setScalar(s);
      const len = sp.distanceTo(sp2);
      streak.position.copy(sp).add(sp2).multiplyScalar(0.5);
      streak.quaternion.setFromUnitVectors(upV, sp2.clone().sub(sp).normalize());
      streak.scale.set(s * 0.18, Math.max(0.001, len), s * 0.18);
    }

    // the splat on the screen, the hang, the wipe
    if (!landed && t >= T_LAND) {
      landed = true;
      lab.arena.emit('bump', { id: 'a' });
    }
    const lk = t - T_LAND;
    if (lk >= 0) {
      const splat = lk < 0.07 ? 0.55 + 0.55 * lab.ease.out(lk / 0.07) : 1.1 - 0.1 * lab.ease.out(Math.min(1, (lk - 0.07) / 0.2));
      const breathe = 0.92 + 0.08 * Math.sin(lk * 9);
      const sag = Math.min(1, lk / 0.7) * SR * 0.05;
      smear.style.transform = `translateY(${sag}px) rotate(-8deg) scale(${splat * 1.04}, ${splat * 0.96})`;
      smearWrap.style.opacity = String(Math.min(1, lk / 0.04) * breathe);
      haze.style.opacity = String(Math.min(1, lk / 0.1) * (1 - win(t, T_WIPE + 0.1, T_CLEAN)));
      // droplets fly out a little and fade
      const dk = clamp01(lk / 0.22);
      for (const d of drops) {
        const r = d.d * (0.6 + 0.4 * lab.ease.out(dk));
        d.node.style.left = `${S.x + Math.cos(d.a) * r * 1.2 - d.r / 2}px`;
        d.node.style.top = `${S.y + Math.sin(d.a) * r * 0.85 - d.r / 2}px`;
        d.node.style.opacity = String((lk < 0.03 ? lk / 0.03 : 1) * (1 - win(t, T_WIPE + 0.04, T_WIPE + 0.22)) * (0.6 + 0.4 * breathe));
      }
    }
    // the stroke: the thumb swings round its wrist (a curve), and everything it has passed is clean
    const wk = win(t, T_WIPE, T_CLEAN);
    const we = lab.ease.inOut(wk);
    const ang = A0 + (A1 - A0) * we; // the thumb's leading edge
    if (t >= T_WIPE) {
      const mask = `conic-gradient(from 0deg at ${P.x}px ${P.y}px, #000 0deg, #000 ${ang - 9}deg, transparent ${ang + 3}deg)`;
      smearWrap.style.webkitMaskImage = mask;
      smearWrap.style.maskImage = mask;
      for (const d of drops) d.node.style.webkitMaskImage = d.node.style.maskImage = mask;
      // the thumb pad rides the stroke, just past the clean edge
      const a = ((ang + 4) * Math.PI) / 180;
      const tx = P.x + Math.sin(a) * RAD;
      const ty = P.y - Math.cos(a) * RAD;
      thumb.style.transform = `translate(${tx - TW / 2}px, ${ty - TH / 2}px) rotate(${ang - 360 + 20}deg)`;
      thumb.style.opacity = String(Math.min(1, wk * 6) * (1 - win(wk, 0.82, 1)));
      // a faint smear of light dragged along behind the thumb, fading
      const tail = 1 - win(t, T_CLEAN - 0.1, T_CLEAN + 0.25);
      streakCss.style.opacity = String(Math.min(1, wk * 4) * tail * 0.55);
      streakCss.style.background = `radial-gradient(circle at ${P.x}px ${P.y}px, transparent ${RAD - SR * 0.42}px, rgba(120,185,255,.35) ${RAD - SR * 0.05}px, rgba(120,185,255,.1) ${RAD + SR * 0.3}px, transparent ${RAD + SR * 0.5}px)`;
      const smask = `conic-gradient(from 0deg at ${P.x}px ${P.y}px, transparent 0deg, transparent ${ang + 2}deg, #000 ${ang + 10}deg, #000 ${Math.min(A0, ang + 34)}deg, transparent ${Math.min(A0 + 6, ang + 44)}deg)`;
      streakCss.style.webkitMaskImage = smask;
      streakCss.style.maskImage = smask;
      streakCss.style.filter = `blur(${Math.round(SR * 0.06)}px)`;
    }
    if (t >= T_CLEAN + 0.3) {
      smearWrap.style.opacity = '0';
      haze.style.opacity = '0';
      thumb.style.opacity = '0';
      streakCss.style.opacity = '0';
    }
  });

  await lab.wait(T_END);
  stop();
  for (const n of [smearWrap, haze, thumb, streakCss, ...drops.map((d) => d.node)]) n.remove();
  sliver.visible = streak.visible = false;
  maya.done({ x: 1, y: 1, d: 2 });
  theo.done({ x: 5, y: 1, d: 3 });
  jun.done({ x: 3, y: 3, d: 0 });
}
