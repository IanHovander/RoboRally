// Theo-Cam, animator b (character acting): the camera drops in beside Theo, and everyone knows it's there.
export const meta = {
  title: "Theo-Cam (b): she flashes her high beams",
  idea:
    "On a rare push the camera swoops down to the glass right beside Theo, looking back west along the row. Theo notices it next to him and turns to look into the lens: are we live? " +
    "Far down the row Maya sees it too, and flashes her headlights at us twice like a car on a dark road. Theo turns back, sees what's coming and braces. " +
    'She charges, her eye growing like oncoming headlights, her trail streaming behind her over the gleaming glass. On contact the camera is shoved one space east along with Theo: ' +
    'the whole picture lurches and tilts, and Theo, who moved with us, stays exactly where he was in the frame. Then the camera floats back up to the game\'s view, ' +
    'Theo wobbling dazed, Maya looking up at us, smug, and Jun turned round to see where the camera went.',
  notes:
    'Sound: a soft whoosh down for the dive, two quick bright glass "blinks" for the high beams, a rising hum as she charges, a muffled glass thunk and a tiny rattle as the picture lurches, ' +
    "a gentle airy sweep back up. Rare on purpose (about one push in ten, or the first push of a game): the room never knows which push will dive. " +
    'Varies: who looks into the lens is always the one being pushed; the pusher always flashes its light (an Orb its band, a Cube its visor, a Spire its beacon). ' +
    'Porting: camera via the arena camera (target, azimuth, elevation, distance, fov, roll), swooping by interpolating those from the home view; it lands back exactly on the game\'s own framing (camWish) before letting go.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (T, a, b) => clamp((T - a) / (b - a));
  const bump = (T, a, b) => Math.sin(Math.PI * seg(T, a, b));
  const track = (keys) => (T) => {
    if (T <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = ease.inOut] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (T <= t1) return lerp(v0, v1, e((T - t0) / (t1 - t0 || 1)));
    }
    return keys[keys.length - 1][1];
  };
  const toward = (fx, fy, tx, ty) => Math.atan2(-(tx - fx), -(ty - fy));
  const unwrapNear = (a, ref) => ref + ((((a - ref + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  const arena = lab.arena;

  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  const eyesOf = (m) => {
    const out = [];
    m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && out.push(o));
    return out;
  };
  const mayaEyes = eyesOf(maya.model);

  // ----- timing (play seconds) -----
  const DIVE = 0.5; // the camera is down
  const SEE = 0.3; // Theo notices the camera beside him
  const BEAM1 = 0.56;
  const BEAM2 = 0.7;
  const GO = 0.84;
  const CONTACT = 1.16;
  const SHOVED = 1.56;
  const HOME = 2.42; // the camera is back on the game's framing
  const END = 2.44;

  // ----- the camera -----
  // a camera given by where it is and what it looks at, as the lab's { target, az, el, dist }
  const spherical = (eye, at) => {
    const d = eye.clone().sub(at);
    const dist = d.length();
    return { target: at.clone(), az: Math.atan2(d.x, d.z), el: Math.asin(d.y / dist), dist };
  };
  const P = (x, y, h) => lab.pos(x, y).setY(h);
  // low and to his south-east, so he stands on the right third of the picture and the row runs away past him to Maya
  const LOW_EYE = P(4.7, 3.35, 0.45);
  const LOW_AT = P(2.05, 1.9, 0.12);
  const low = spherical(LOW_EYE, LOW_AT);
  const mix = (a, b, k) => ({
    target: a.target.clone().lerp(b.target, k),
    az: lerp(a.az, a.az + Math.atan2(Math.sin(b.az - a.az), Math.cos(b.az - a.az)), k),
    el: lerp(a.el, b.el, k),
    dist: lerp(a.dist, b.dist, k),
    fov: lerp(a.fov, b.fov, k),
    roll: lerp(a.roll ?? 0, b.roll ?? 0, k),
  });
  // the camera's distance falls much faster than linearly, so the swoop reads as a dive, not a zoom
  const mixDive = (a, b, k) => {
    const m = mix(a, b, k);
    m.dist = Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), k));
    return m;
  };
  let sceneDt = 1 / 30;
  const dtWatch = lab.every((dt) => (sceneDt = dt || sceneDt));
  // the game's own framing (its camera slides the picture to centre the board; ease that offset away and back)
  const off0 = { sx: arena.camCur?.sx ?? 0, sy: arena.camCur?.sy ?? 0 };
  const holdOffset = (k) => {
    if (!arena.camCur) return;
    const keep = 1 - Math.min(1, sceneDt * 4);
    if (keep <= 0) return;
    arena.camCur.sx = (off0.sx * k) / keep;
    arena.camCur.sy = (off0.sy * k) / keep;
  };

  const t0 = lab.t;
  let shoveCam = null; // the camera at the end of the shove, for the float home
  const releaseCam = lab.camera((home) => {
    const T = lab.t - t0;
    const homeC = { ...home, roll: 0 };
    const lowC = { ...low, fov: 40, roll: 0 };
    if (T < DIVE) {
      const k = ease.inOut(seg(T, 0, DIVE));
      holdOffset(1 - k);
      return mixDive(homeC, lowC, k);
    }
    if (T < CONTACT) {
      // hold low; as she charges, a slow push-in (narrowing the lens) for tension
      const tense = ease.in(seg(T, GO, CONTACT));
      holdOffset(0);
      return { ...lowC, fov: 40 - 5 * tense, target: lowC.target.clone().add(new THREE.Vector3(0, 0, 0)) };
    }
    if (T < SHOVED) {
      // the lurch: shoved one space east with Theo, tipping as it goes
      const k = seg(T, CONTACT, SHOVED);
      const e = ease.out3(k);
      // the camera is a body too: knocked a hair past Theo, a hop, then it settles beside him again
      const push = new THREE.Vector3(e + 0.12 * bump(k, 0.3, 1), 0.06 * bump(k, 0, 0.25), 0);
      const c = spherical(LOW_EYE.clone().add(push), LOW_AT.clone().add(push).add(new THREE.Vector3(0, 0, -0.06 * bump(k, 0, 0.6))));
      const roll = 0.2 * Math.sin(k * TAU * 1.25) * (1 - k) ** 1.2;
      holdOffset(0);
      shoveCam = { ...c, fov: 35 + 3 * e, roll };
      return shoveCam;
    }
    // float home: back up and round to exactly the game's own view
    const k = ease.inOut(seg(T, SHOVED, HOME));
    const w = arena.camWish(arena.time);
    const gameC = { target: w.tgt.clone(), az: w.az, el: w.el, dist: w.d, fov: home.fov, roll: 0 };
    holdOffset(k);
    const from = shoveCam ?? lowC;
    const m = mixDive(from, gameC, k);
    m.roll = (from.roll ?? 0) * (1 - ease.out(seg(T, SHOVED, SHOVED + 0.4)));
    return m;
  });

  // ----- the robots -----
  const mayaX = track([[0, 1], [BEAM1 - 0.06, 0.97, ease.inOut], [GO, 0.94, ease.inOut], [CONTACT, 2.4, (k) => k ** 1.7], [SHOVED, 3, ease.out3]]);
  const theoX = track([[CONTACT, 3], [SHOVED, 4, ease.out3]]);
  const south = facing(2);
  const camDir = unwrapNear(toward(3, 2, 4.7, 3.35), south); // looking into the lens
  const atMaya = south - 0.85;
  const theoRot = track([
    [SEE, south],
    [SEE + 0.1, camDir, ease.outBack],
    [BEAM1 + 0.02, camDir],
    [BEAM1 + 0.1, atMaya, ease.out], // the flash: whips round to look
    [GO + 0.06, atMaya],
    [CONTACT - 0.04, south - 0.2, ease.inOut],
    [SHOVED, south, ease.out],
  ]);
  const junHome = facing(3);
  const junAtCam = unwrapNear(facing(2) + 0.35, junHome);
  const junRot = track([[SHOVED - 0.1, junHome], [SHOVED + 0.15, junAtCam, ease.outBack], [HOME - 0.25, junAtCam], [END, junHome, ease.inOut]]);

  const stop = lab.every(() => {
    const T = lab.t - t0;
    // ---------- Maya ----------
    const watchCam = seg(T, 0.15, 0.4) * (1 - seg(T, BEAM1 - 0.08, BEAM1)); // she watches it come down (chin up)
    const rev1 = bump(T, BEAM1 - 0.04, BEAM1 + 0.1);
    const rev2 = bump(T, BEAM2 - 0.04, BEAM2 + 0.1);
    const charge = seg(T, GO, GO + 0.08) * (1 - seg(T, CONTACT, CONTACT + 0.05));
    const smug = seg(T, SHOVED + 0.05, SHOVED + 0.25) * (1 - seg(T, HOME - 0.2, END));
    maya.set({
      x: mayaX(T),
      pitch: -0.16 * watchCam - 0.1 * (rev1 + rev2) + 0.2 * charge + track([[CONTACT, 0], [CONTACT + 0.05, -0.1, ease.out], [CONTACT + 0.2, 0]])(T) - 0.24 * smug,
      sy: 1 - 0.06 * (rev1 + rev2) + 0.05 * smug,
      lift: 0.03 * smug,
    });

    // ---------- Theo ----------
    const startle = bump(T, SEE, SEE + 0.16);
    const gulp = bump(T, BEAM2 + 0.04, GO + 0.04);
    const brace = seg(T, GO + 0.04, CONTACT - 0.02) * (1 - seg(T, CONTACT, CONTACT + 0.06));
    const hit = bump(T, CONTACT, CONTACT + 0.16);
    const daze = seg(T, SHOVED - 0.1, SHOVED) * (1 - seg(T, HOME - 0.1, END));
    const wob = Math.sin((T - SHOVED) * 15) * 0.13 * daze * (1 - seg(T, SHOVED, HOME));
    theo.set({
      x: theoX(T),
      rot: theoRot(T) + wob * 0.5,
      lift: 0.06 * startle,
      pitch: -0.1 * startle + 0.08 * gulp - 0.12 * brace,
      roll: 0.12 * brace + wob,
      sy: 1 + 0.12 * startle - 0.1 * gulp - 0.1 * brace - 0.16 * hit,
      sx: 1 + 0.05 * brace + 0.16 * hit,
      sz: 1 + 0.05 * brace + 0.12 * hit,
    });

    // ---------- Jun ----------
    const jstart = bump(T, SHOVED - 0.1, SHOVED + 0.12);
    jun.set({ rot: junRot(T), pitch: -0.14 * seg(T, SHOVED, SHOVED + 0.2) * (1 - seg(T, HOME - 0.25, END)), lift: 0.04 * jstart });
  });

  // parts: eyes
  const base = [3.2, 3.1, 2.9];
  maya.each = (m) => {
    const T = lab.t - t0;
    // high beams: two quick flashes, then a steady glare as she charges
    const f1 = bump(T, BEAM1, BEAM1 + 0.08);
    const f2 = bump(T, BEAM2, BEAM2 + 0.08);
    const glare = seg(T, GO, GO + 0.1) * (1 - seg(T, SHOVED, SHOVED + 0.2));
    const flash = Math.max(f1, f2);
    for (const e of mayaEyes) e.scale.set(1 + 1.6 * flash + 0.5 * glare, 1 + 0.3 * flash, 1 + 1.6 * flash);
    const g = 1 + 4 * flash + 1.2 * glare + 0.4 * bump(T, SHOVED + 0.05, HOME);
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };
  theo.each = (m) => {
    const T = lab.t - t0;
    const shut = seg(T, GO + 0.1, CONTACT - 0.04) * (1 - seg(T, CONTACT + 0.2, SHOVED));
    const flick = seg(T, SHOVED, HOME) < 1 && T > SHOVED ? 0.5 + 0.5 * Math.sin((T - SHOVED) * 40) : 1;
    const close = seg(T, 0.2, DIVE) * (1 - seg(T, SHOVED, SHOVED + 0.4));
    const g = (1 - 0.75 * close) * (1 + 0.3 * bump(T, SEE, BEAM1)) * (1 - 0.75 * shut) * (T > SHOVED && T < SHOVED + 0.35 ? flick : 1);
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };

  // her headlight, as the low camera sees it: a soft glow on her eye and a thin lens streak, swelling as she comes
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(255,255,255,0.6)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(2.2, 2.0, 1.75), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const streak = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.6, 1.45, 1.25), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  lab.add(lamp);
  lab.add(streak);
  const lampStop = lab.every(() => {
    const T = lab.t - t0;
    const on = seg(T, DIVE - 0.12, DIVE) * (1 - seg(T, CONTACT - 0.02, CONTACT + 0.08));
    const flash = Math.max(bump(T, BEAM1, BEAM1 + 0.08), bump(T, BEAM2, BEAM2 + 0.08));
    const near = ease.in(seg(T, GO, CONTACT));
    const at = lab.pos(maya.pose.x + 0.2, 2).setY(0.34 * maya.pose.sy + maya.pose.lift);
    lamp.position.copy(at);
    streak.position.copy(at);
    lamp.material.opacity = on;
    lamp.scale.setScalar(0.3 + 1.3 * flash + 0.5 * near);
    streak.material.opacity = on * (0.25 + 0.75 * Math.max(flash, near));
    streak.scale.set(0.6 + 3.2 * flash + 2.2 * near, 0.05 + 0.05 * flash, 1);
  });

  lab.at(CONTACT, () => {
    lab.shake(0.03, 0.26);
    lab.flash('#fff6e8', 0.22, 0.18);
  });

  lab.playCard('a', ['m2']);
  await lab.wait(HOME);
  releaseCam();
  await lab.wait(END - HOME);
  stop();
  dtWatch();
  lampStop();
  lamp.visible = streak.visible = false;
  maya.each = null;
  theo.each = null;
  for (const e of mayaEyes) e.scale.set(1, 1, 1);
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
  jun.release({ x: 6, y: 0, d: 3 });
}
