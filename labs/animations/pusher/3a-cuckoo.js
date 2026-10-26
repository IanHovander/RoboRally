// Pusher 3a: Cuckoo (idea 23), through the lens of weight and physical comedy.
export const meta = {
  title: 'Cuckoo on a spring',
  idea:
    'The push plate is a clock door: it flips up, warm light spills out, and a little bird drawn in three strokes of light boings out on a springy stick. Cuck-oo, cuck-oo, cuck-oo, cuck-oo: four big bobs, each one faster, and each time Maya flinches a little more. On the fifth it rears back, beak wide, and pecks her right on the head: she squashes, then skids one space south toward us, still facing east. The bird twangs on its stick like a doorstop spring, gets yanked back in, and the door slams shut with a click.',
  notes:
    'Sound: a wooden-glass "tock" as the door flips, then a soft two-note glass "cu-ckoo" per bob, each a little faster; the fifth "cuck-" is cut off by a "bonk", a slide hiss, a "twaaang" for the spring, and a clock-door click. REGISTER sets the count: 1 cuckoo on register 1 (straight to the peck after one rear-back), 3 on register 3, 5 on register 5; the fewer calls leave the beats more air. The bird is three tube strokes (body, upper beak, lower beak) and a dot of an eye, tilted toward the camera so it reads in profile from across a room.',
};

const REGISTER = 5; // which register is playing: the bird calls this many times, the last one is the peck

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const bot = maya.bot;
  const EAST = lab.facing(1);
  const pusher = arena.pushers.get('3,1');
  const plate = pusher.plate;
  pusher.kick = null;
  const plateMat = plate.material;
  const plateEm0 = plateMat.emissiveIntensity;
  lab.cleanup(() => {
    plate.rotation.x = 0;
    plate.position.set(0, 0, 0.05);
    plateMat.emissiveIntensity = plateEm0;
  });

  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const WARM = '#ffd49a';

  // ---------- timeline ----------
  const calls = [];
  {
    let t = 0.24;
    let d = REGISTER >= 5 ? 0.3 : REGISTER >= 3 ? 0.34 : 0.36;
    for (let i = 0; i < REGISTER - 1; i++) {
      calls.push([t, t + d]);
      t += d;
      d *= 0.83; // faster each time
    }
    calls.push([t, t + 0.1]); // the last: it rears back...
  }
  const rear = calls[calls.length - 1];
  const T = {
    door: 0.12,
    pop: 0.24,
    rear0: rear[0],
    strike: rear[1] + 0.06, // ...and pecks
  };
  T.hold = T.strike + 0.06; // beak on her head for two frames
  T.slideEnd = T.strike + 0.38;
  T.twangEnd = T.hold + 0.16;
  T.inside = T.hold + 0.26;
  T.shut = T.inside + 0.1;
  T.end = Math.max(T.slideEnd, T.shut) + 0.12;

  // ---------- the bird: three strokes of warm light and a dot of an eye ----------
  const strokeMat = new THREE.MeshBasicMaterial({ color: hdr(WARM, 2.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const stroke = (pts, r) => {
    const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'catmullrom', 0.5);
    return new THREE.Mesh(new THREE.TubeGeometry(c, 48, r, 6, false), strokeMat);
  };
  const S = 1.4; // big enough to read from the couch
  const sc = (pts) => pts.map(([x, y]) => [x * S, y * S]);
  const birdRoot = lab.add(new THREE.Group()); // at its feet, on the stick
  const birdTilt = new THREE.Group(); // leaned toward the camera so its profile reads
  birdTilt.rotation.x = -0.45;
  birdRoot.add(birdTilt);
  const birdPitch = new THREE.Group(); // the bob: rotates about its feet
  birdTilt.add(birdPitch);
  const body = stroke(sc([[-0.21, 0.12], [-0.12, 0.06], [-0.03, 0.08], [0.04, 0.15], [0.09, 0.19], [0.135, 0.165], [0.125, 0.1], [0.08, 0.03], [-0.01, -0.005], [-0.1, 0.025], [-0.2, 0.09]]), 0.021);
  birdPitch.add(body);
  const upper = stroke(sc([[0.135, 0.158], [0.18, 0.152], [0.235, 0.14]]), 0.017);
  birdPitch.add(upper);
  const jaw = new THREE.Group(); // the lower beak, hinged at the mouth
  jaw.position.set(0.128 * S, 0.135 * S, 0);
  jaw.add(stroke(sc([[0, 0], [0.045, -0.004], [0.095, -0.012]]), 0.016));
  birdPitch.add(jaw);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: hdr(WARM, 3.2) }));
  eye.position.set(0.085 * S, 0.15 * S, 0.01);
  birdPitch.add(eye);
  birdRoot.visible = false;
  // the stick of light it rides on
  const stickMat = new THREE.MeshBasicMaterial({ color: hdr(WARM, 1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const stickGeo = new THREE.CylinderGeometry(0.009, 0.009, 1, 6);
  stickGeo.translate(0, 0.5, 0);
  stickGeo.rotateX(Math.PI / 2);
  const stick = lab.add(new THREE.Mesh(stickGeo, stickMat));
  stick.visible = false;
  // the doorway: warm light inside the clock
  const doorwayMat = new THREE.MeshBasicMaterial({ color: hdr(WARM, 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const doorway = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.17), doorwayMat));
  doorway.position.set(0, 0.16, -0.9);
  const spillMat = new THREE.MeshBasicMaterial({ map: glow(), color: hdr(WARM, 0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const spill = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), spillMat));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, 0.012, -0.72);

  function glow() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }

  const HOLE = new THREE.Vector3(0, 0.17, -0.91);
  const PERCH = new THREE.Vector3(-0.08, 0.6, -0.84);
  const STRIKE = new THREE.Vector3(-0.13, 0.52, -0.72);

  // ---------- her parts ----------
  const her = { sx: 1, sy: 1, sz: 1 };
  maya.each = (m) => {
    m.body.scale.set(her.sx, her.sy, her.sz);
    // the bird owns the space above her for a moment: her name steps back
    if (bot.tag) bot.tag.material.opacity *= tagFade;
  };
  let tagFade = 1;

  // ---------- the camera leans in to watch the clock; the peck knocks it back home ----------
  let camMix = 0;
  const FOCUS = new THREE.Vector3(0, 0.36, -0.6);
  const off0 = { sx: arena.camCur?.sx ?? 0, sy: arena.camCur?.sy ?? 0 };
  const stopOff = lab.every(() => {
    if (!arena.camCur) return;
    const k = Math.min(0.9, arena.dt * 4);
    arena.camCur.sx = (off0.sx * (1 - Math.min(1, camMix))) / (1 - k);
    arena.camCur.sy = (off0.sy * (1 - Math.min(1, camMix))) / (1 - k);
  });
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(FOCUS, camMix),
    dist: home.dist * (1 - 0.42 * camMix),
    el: home.el - 0.36 * camMix,
    az: 0,
    fov: home.fov,
  }));

  // ---------- run ----------
  const T0 = lab.t;
  let struck = false;
  let lastCall = -1;
  const stop = lab.every(() => {
    const t = lab.t - T0;

    // --- the door: flips up on its top hinge, slams shut at the end with a bounce
    let open;
    if (t < T.inside) open = ease.outBack(seg(t, 0, T.door), 2.2);
    else {
      const k = seg(t, T.inside, T.shut);
      open = 1 - ease.in(k);
      if (k >= 1) open = -0.12 * Math.sin(seg(t, T.shut, T.shut + 0.1) * Math.PI) * (t < T.shut + 0.1 ? 1 : 0);
    }
    const th = -1.75 * open;
    plate.rotation.x = th;
    plate.position.set(0, 0.1 - 0.1 * Math.cos(th), 0.05 - 0.1 * Math.sin(th));
    const slam = t > T.shut ? Math.exp(-(t - T.shut) * 12) : 0;
    plateMat.emissiveIntensity = plateEm0 + slam * 3;
    const lightIn = clamp01(open) * (t < T.inside ? 1 : 0.6);
    doorwayMat.opacity = 0.4 * lightIn;
    spillMat.opacity = 0.3 * lightIn;
    doorway.visible = lightIn > 0.01;
    spill.visible = lightIn > 0.01;

    // --- the bird
    let root = HOLE.clone();
    let pitch = 0; // + leans forward (beak down)
    let jawOpen = 0;
    let stretch = 1;
    let wob = 0;
    let shown = t > 0.05 && t < T.inside + 0.02;
    if (t < T.pop + 0.15) {
      // boing out of the door on its spring
      const k = seg(t, 0.05, T.pop);
      const e = ease.outBack(k, 2.6);
      root = HOLE.clone().lerp(PERCH, e);
      stretch = 1 + 0.25 * Math.sin(k * Math.PI) * (1 - k);
      wob = Math.sin(seg(t, T.pop - 0.04, T.pop + 0.15) * Math.PI * 3) * 0.08 * (1 - seg(t, T.pop - 0.04, T.pop + 0.15));
    } else root = PERCH.clone();
    // the calls
    for (let i = 0; i < calls.length - 1; i++) {
      const [a, b] = calls[i];
      if (t < a || t > b) continue;
      const k = seg(t, a, b);
      const amp = 1 + i * 0.15;
      // "cu-": a big bob forward with the beak open; "-ckoo": back up, a smaller open
      pitch = (0.55 * Math.sin(Math.min(1, k / 0.55) * Math.PI) + 0.12 * Math.sin(seg(k, 0.55, 1) * Math.PI)) * amp;
      jawOpen = Math.max(Math.sin(Math.min(1, k / 0.45) * Math.PI), 0.7 * Math.sin(seg(k, 0.55, 0.9) * Math.PI));
      root.add(new THREE.Vector3(0, 0, 0.045 * Math.sin(k * Math.PI) * amp));
      stretch = 1 + 0.08 * Math.sin(k * Math.PI * 2);
      if (lastCall < i) {
        lastCall = i;
        arena.emit?.('cuckoo');
      }
    }
    // the rear-back, then the peck
    if (t >= T.rear0 && t < T.strike) {
      const k = seg(t, T.rear0, rear[1]);
      pitch = -0.55 * ease.out(k);
      jawOpen = 1.3 * ease.out(k);
      root = PERCH.clone().add(new THREE.Vector3(0, 0.06 * ease.out(k), -0.07 * ease.out(k)));
      stretch = 1 - 0.12 * ease.out(k);
      if (t >= rear[1]) {
        const kp = seg(t, rear[1], T.strike);
        const from = PERCH.clone().add(new THREE.Vector3(0, 0.06, -0.07));
        root = from.lerp(STRIKE, ease.in(kp));
        pitch = lerp(-0.55, 1.42, ease.in(kp));
        jawOpen = lerp(1.3, 0.2, kp);
        stretch = 1 + 0.2 * kp;
      }
    }
    if (t >= T.strike) {
      if (!struck) {
        struck = true;
        arena.emit?.('push');
        lab.shake(0.025, 0.18);
        lab.particles(new THREE.Vector3(0.1, 0.33, -0.62), [WARM, '#ffffff'], 10, { speed: 0.7, up: 0.9, gravity: 4, size: 0.035, dur: 0.35 });
      }
      // a held beat with the beak on her head, then the recoil: the stick twangs like a doorstop spring
      // and the bird is yanked back inside
      const d = Math.max(0, t - T.hold);
      const tw = Math.exp(-d * 9);
      const back = ease.in(seg(t, T.twangEnd, T.inside));
      const off = t < T.hold ? 0 : ease.out(seg(t, T.hold, T.hold + 0.07));
      root = STRIKE.clone().lerp(PERCH, off).lerp(HOLE, back);
      wob = t < T.hold ? 0 : 0.13 * Math.sin(d * Math.PI * 2 * 9) * tw;
      pitch = lerp(1.42, 0, off) + (t < T.hold ? 0 : 0.35 * Math.sin(d * Math.PI * 2 * 7) * tw);
      jawOpen = t < T.hold ? 0.2 : 0.15 * (1 - back);
      stretch = t < T.hold ? 1.2 : 1 - 0.15 * back;
    }
    birdRoot.visible = shown;
    birdRoot.position.copy(root).add(new THREE.Vector3(wob, 0, 0));
    birdPitch.rotation.z = -pitch;
    birdPitch.scale.set(1 / Math.sqrt(stretch), stretch, 1);
    jaw.rotation.z = -0.55 * jawOpen;
    strokeMat.color.copy(hdr(WARM, 2.1 + (jawOpen > 0.5 ? 0.6 : 0)));
    // the stick from the hole to its feet
    stick.visible = shown;
    stick.position.copy(HOLE);
    stick.lookAt(birdRoot.position);
    stick.scale.set(1, 1, Math.max(0.001, HOLE.distanceTo(birdRoot.position)));

    // --- Maya: flinches at each call, gets pecked, skids one space south
    let y = 1;
    let roll = 0;
    let squash = 0;
    let lift = 0;
    for (let i = 0; i < calls.length - 1; i++) {
      const [a, b] = calls[i];
      if (t >= a && t <= b) {
        const k = seg(t, a, b);
        squash = 0.06 * (1 + i * 0.3) * Math.sin(Math.min(1, k / 0.5) * Math.PI);
        roll = 0.03 * (1 + i) * Math.sin(Math.min(1, k / 0.6) * Math.PI);
      }
    }
    if (t >= T.rear0 && t < T.strike) {
      // she braces: leans away and scrunches
      const k = ease.out(seg(t, T.rear0, rear[1]));
      roll = 0.12 * k;
      squash = 0.08 * k;
    }
    if (t >= T.strike) {
      const k = seg(t, T.hold - 0.02, T.slideEnd); // squashed under the beak for a beat, then away
      const d = t - T.strike;
      // BONK: squashed flat for a frame, then away she skids, overshooting a hair and settling
      squash = 0.3 * Math.exp(-Math.max(0, t - T.hold) * 16) + 0.08 * Math.sin(d * Math.PI * 2 * 5) * Math.exp(-d * 7);
      const e = 1 - (1 - k) ** 3;
      y = 1 + e + 0.05 * Math.sin(seg(k, 0.55, 1) * Math.PI);
      roll = 0.3 * Math.sin(d * Math.PI * 2 * 2.6) * Math.exp(-d * 6) * (1 - seg(t, T.end - 0.1, T.end));
      lift = 0.04 * Math.max(0, Math.sin(seg(d, 0.03, 0.15) * Math.PI));
    }
    maya.set({ y, roll, lift, rot: EAST, trail: true });
    her.sy = 1 - squash;
    her.sx = 1 + squash * 0.5;
    her.sz = 1 + squash * 0.5;
    // in during the door and the first call; after the peck it springs home with a little overshoot
    const kIn = ease.inOut(seg(t, 0.0, 0.4));
    // the bonk knocks the camera back: a jolt, then it eases home with a small overshoot
    const kOut = seg(t, T.strike + 0.03, T.end - 0.02);
    const back = kOut <= 0 ? 0 : ease.inOut(kOut) + 0.06 * Math.sin(kOut * Math.PI);
    camMix = kIn * (1 - back) + (t >= T.strike && t < T.strike + 0.06 ? 0.04 * Math.sin(seg(t, T.strike, T.strike + 0.06) * Math.PI) : 0);
    if (kOut >= 1) camMix = 0;
    tagFade = t < 0.05 ? 1 - seg(t, 0, 0.05) : shown ? 0 : seg(t, T.inside, T.end);
  });

  await lab.wait(T.end);
  stop();
  camMix = 0;
  stopOff();
  releaseCam();
  birdRoot.visible = false;
  stick.visible = doorway.visible = spill.visible = false;
  plate.rotation.x = 0;
  plate.position.set(0, 0, 0.05);
  plateMat.emissiveIntensity = plateEm0;
  maya.each = null;
  maya.model.body.scale.set(1, 1, 1);
  maya.set({ y: 2, roll: 0, lift: 0, rot: EAST });
  maya.release({ x: 3, y: 2, d: 1 });
}
