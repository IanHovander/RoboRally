// Checkpoint, idea 1 (Euler's disk), animator a: weight and physical comedy.
export const meta = {
  title: "Euler's disk",
  idea:
    'A hoop of red light condenses at the top of the column and drops like a dropped coin. Maya sees it coming and ducks; it clinks onto its edge around her, bounces once, then spins down like an Euler disk: the tilt sinks, the wobble races, and its point of contact smears a whirl of light on the glass that closes into a full circle just as it slaps flat with a click. Maya follows it round with her nose until she cannot keep up, flinches at the click, and the hoop cinches in under her as the game\'s own taken ring.',
  notes:
    'Sound: a glassy clink on landing, then a whirr whose pitch rises with the wobble rate (the code drives it from one number, the precession rate, so the sound can read the same value), cut dead by a dry glass click, then a tiny rubbery zip as it tightens. On a flag other robots already hold, set `others` to their count: the hoop ends 0.07 higher per ring, on top of their stack, like a tally. Porting: delay setTaken for this flag until the hoop lands (the last frame swaps the hoop for the game ring of the same size, place and colour).',
};

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

function softLine(THREE) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.3, '#3a3a3a');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.7, '#3a3a3a');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft ribbon of light lying on the glass: update(points [{x, z, w, k}], color) */
function glassRibbon(lab, N) {
  const { THREE } = lab;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  const uv = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: softLine(THREE), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  lab.add(mesh);
  return {
    mesh,
    update(pts, color, y = 0.012) {
      const n = Math.min(N, pts.length);
      if (n < 2) return geo.setDrawRange(0, 0);
      const pos = geo.attributes.position.array;
      const col = geo.attributes.color.array;
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const q = pts[Math.min(n - 1, i + 1)];
        const o = pts[Math.max(0, i - 1)];
        let dx = q.x - o.x;
        let dz = q.z - o.z;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len;
        dz /= len;
        pos.set([p.x - dz * p.w, y, p.z + dx * p.w, p.x + dz * p.w, y, p.z - dx * p.w], i * 6);
        col.set([color.r * p.k, color.g * p.k, color.b * p.k, color.r * p.k, color.g * p.k, color.b * p.k], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, (n - 1) * 6);
    },
  };
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const me = lab.bot('a');
  const maya = lab.puppet('a');
  const RED = new THREE.Color(me.color);
  const F = lab.pos(4, 1);
  const EAST = facing(1);

  const others = 0; // robots that already hold this flag: the hoop settles on top of their rings
  const restY = 0.06 + others * 0.07;
  const R0 = 0.72; // a little wider than her ring of light
  const RT = 0.27; // the game's taken ring
  const TUBE = 0.012 / RT;

  // the hoop: a torus of red light, radius 1, scaled
  const hoopMat = new THREE.MeshBasicMaterial({ color: RED.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const hoop = lab.add(new THREE.Mesh(new THREE.TorusGeometry(1, TUBE, 10, 140), hoopMat));
  hoop.renderOrder = 6;
  // where it touches the glass: a pool of light that whirls round as the wobble speeds up
  const glintMat = new THREE.MeshBasicMaterial({ map: me.model.poolMat.map, color: RED.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glint = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glintMat));
  glint.rotation.x = -Math.PI / 2;
  glint.renderOrder = 4;
  const smear = glassRibbon(lab, 140);
  // the clink and the click: a thin ring of white light on the glass, very brief
  const tinkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4efe4'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const tink = lab.add(new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), tinkMat));
  tink.rotation.x = -Math.PI / 2;
  tink.position.set(F.x, 0.011, F.z);

  const Z = new THREE.Vector3(0, 0, 1);
  const n = new THREE.Vector3();
  const hz = { y: 2.1, R: R0, a: 0.78, phi: 2.2, glow: 2.6, op: 0 };
  const placeHoop = () => {
    n.set(Math.sin(hz.a) * Math.cos(hz.phi), Math.cos(hz.a), Math.sin(hz.a) * Math.sin(hz.phi));
    hoop.quaternion.setFromUnitVectors(Z, n);
    hoop.position.set(F.x, hz.y, F.z);
    hoop.scale.setScalar(hz.R);
    hoopMat.opacity = hz.op;
    hoopMat.color.copy(RED).multiplyScalar(hz.glow);
  };

  // timeline (scene seconds from the start of the moment)
  const MOVE = 0.62;
  const APPEAR = 0.26;
  const DROP = 0.42;
  const LAND = 0.8;
  const BOUNCE = 0.15;
  const SPIN0 = LAND + BOUNCE;
  const CLICK = 2.3;
  const CINCH0 = 2.4;
  const CINCH1 = 2.66;
  const END = 2.72;

  const A0 = hz.a;
  const W0 = 8.5; // precession rate when it starts to roll (rad/s)
  const WMAX = 52;
  let rate = 0;
  let last = lab.t;
  const t0 = lab.t;
  lab.playCard('a', ['m2']);
  const hoopH = (a, R) => R * Math.sin(a) + TUBE * R * Math.cos(a);

  const stop = lab.every(() => {
    const now = lab.t;
    const dt = now - last;
    last = now;
    const t = now - t0;

    // ---------- Maya ----------
    const km = seg(t, 0, MOVE);
    const pose = { x: 2 + 2 * ease.inOut3(km), rot: EAST, pitch: 0, roll: 0, lift: 0, sx: 1, sy: 1, sz: 1 };
    // braking: her mass carries her nose forward, then she rocks back to look up at what's falling
    pose.pitch += 0.2 * Math.sin(Math.PI * seg(t, 0.38, MOVE));
    const look = seg(t, MOVE - 0.04, 0.7);
    const duck = seg(t, 0.68, LAND);
    const pop = seg(t, LAND + 0.03, LAND + 0.28);
    pose.pitch -= 0.26 * Math.sin(Math.PI * 0.5 * look) * (1 - duck);
    if (t > 0.68 && t < LAND + 0.03) {
      const d = ease.out(duck);
      pose.sy = 1 - 0.3 * d;
      pose.sx = pose.sz = 1 + 0.16 * d;
    } else if (t >= LAND + 0.03) {
      // springs back up once it has landed round her, not on her
      const s = 1 - (1 - 0.3) * 0 - 0.3 * (1 - ease.outElastic(pop));
      pose.sy = s;
      pose.sx = pose.sz = 1 + (1 - s) * 0.55;
    }
    // she follows the hoop's contact point round with her nose, until it's too fast for her
    if (t > SPIN0 && t < CLICK + 0.25) {
      const keep = Math.max(0, 1 - rate / 30); // she can keep up while it's slow
      const dizzy = clamp01((rate - 22) / 30) * (1 - seg(t, CLICK, CLICK + 0.25));
      const follow = (1 - seg(t, CLICK - 0.1, CLICK + 0.12)) * clamp01((t - SPIN0) / 0.15);
      pose.rot = EAST + 0.42 * keep * follow * Math.sin(hz.phi + Math.PI / 2 + 0.5);
      pose.roll = 0.1 * dizzy * Math.sin(now * 23);
    }
    // the click makes her jump (a flinch, not a celebration), then the hoop cinches snug round her base
    const flinch = seg(t, CLICK, CLICK + 0.22);
    if (t >= CLICK && flinch < 1) {
      pose.lift = 0.06 * Math.sin(Math.PI * flinch) * (1 - flinch);
      pose.sy *= 1 + 0.1 * Math.sin(Math.PI * flinch);
    }
    const snug = seg(t, CINCH0 + 0.08, CINCH1 + 0.05);
    if (snug > 0 && snug < 1) {
      const w = Math.sin(Math.PI * snug) * (1 - snug * 0.5);
      pose.sy *= 1 + 0.08 * w;
      pose.sx *= 1 - 0.05 * w;
      pose.sz *= 1 - 0.05 * w;
    }
    maya.set(pose);

    // ---------- the hoop ----------
    let contact = 0; // 0..1 how much it's touching the glass (for the glint and smear)
    if (t < APPEAR) {
      hz.op = 0;
    } else if (t < LAND) {
      // condenses out of the top of the column, hangs a hair, then falls like a dropped coin
      const kf = seg(t, DROP, LAND);
      hz.op = seg(t, APPEAR, APPEAR + 0.12);
      hz.y = 2.1 - (2.1 - hoopH(A0, R0)) * ease.in(kf);
      hz.phi += dt * 1.6;
      hz.a = A0 + 0.05 * Math.sin(t * 9) * (1 - kf);
      hz.glow = 2.6 + (1 - seg(t, APPEAR, APPEAR + 0.2)) * 1.2;
    } else if (t < SPIN0) {
      // clink: a small bounce off the edge it landed on
      const kb = seg(t, LAND, SPIN0);
      hz.op = 1;
      hz.a = A0 + 0.07 * Math.sin(Math.PI * kb);
      hz.y = hoopH(hz.a, R0) + 0.08 * Math.sin(Math.PI * kb);
      hz.phi += dt * W0 * 0.6;
      hz.glow = 2.6 + 2.2 * (1 - kb);
      contact = kb > 0.85 ? 1 : 0.4 * (1 - kb);
    } else if (t < CLICK) {
      // Euler's disk: the tilt sinks, and the lower it gets the faster the contact point races round
      const k = seg(t, SPIN0, CLICK);
      hz.a = A0 * (1 - k) ** 0.9;
      rate = Math.min(WMAX, W0 * Math.sqrt(Math.sin(A0) / Math.max(1e-4, Math.sin(hz.a))));
      hz.phi += dt * rate;
      hz.y = hoopH(hz.a, R0);
      hz.op = 1;
      hz.glow = 2.6;
      contact = 1;
    } else {
      // click: flat. A beat lying still, then it cinches in to the taken ring's size and height
      const kc = seg(t, CINCH0, CINCH1);
      hz.a = 0;
      const back = ease.outBack(kc, 2.2);
      hz.R = R0 + (RT - R0) * back;
      hz.y = TUBE * hz.R + (restY - TUBE * hz.R) * ease.out(kc);
      hz.glow = 1.8 + 1.6 * (1 - seg(t, CLICK, CLICK + 0.18)) + 0.8 * Math.sin(Math.PI * kc);
      hz.op = 1;
      rate = 0;
      contact = 0;
    }
    placeHoop();

    // contact glint and the smear of light it leaves as it whirls
    const rr = hz.R * Math.cos(hz.a);
    const cx = F.x + rr * Math.cos(hz.phi);
    const cz = F.z + rr * Math.sin(hz.phi);
    const speed = clamp01(rate / WMAX);
    glint.position.set(cx, 0.013, cz);
    glint.scale.setScalar(0.32 + 0.2 * speed);
    glintMat.opacity = contact * (0.55 + 0.45 * speed);
    glintMat.color.copy(RED).multiplyScalar(1.4 + 1.6 * speed);
    const clickFade = t < CLICK ? 1 : 1 - seg(t, CLICK, CLICK + 0.22);
    if (t > SPIN0 && clickFade > 0) {
      const sweep = t < CLICK ? Math.min(TAU, 0.25 + rate * 0.115) : TAU;
      const M = 120;
      const pts = [];
      for (let j = 0; j <= M; j++) {
        const f = j / M;
        const ph = hz.phi - sweep * (1 - f);
        const rad = t < CLICK ? rr : R0;
        pts.push({ x: F.x + rad * Math.cos(ph), z: F.z + rad * Math.sin(ph), w: 0.05 + 0.02 * speed, k: (0.25 + 1.6 * speed) * f ** 1.4 * clickFade * (t < CLICK ? 1 : 1.6) });
      }
      smear.update(pts, RED);
    } else smear.update([], RED);

    // the clink (landing) and the click (lying flat): a hair of white light on the glass
    const tk = t < CLICK ? seg(t, LAND, LAND + 0.3) : seg(t, CLICK, CLICK + 0.35);
    const strong = t < CLICK ? 0.5 : 1;
    if (tk > 0 && tk < 1) {
      tink.scale.setScalar(R0 * (1 + 0.45 * ease.out(tk)));
      tinkMat.opacity = strong * (1 - tk) ** 2;
      tinkMat.color.set('#f4efe4').multiplyScalar(1.6);
    } else tinkMat.opacity = 0;
  });

  await lab.wait(END);
  stop();
  // hand over: the game's own ring takes the hoop's place, same size, height and colour
  arena.setTaken([{ cp: 1, color: me.color }]);
  lab.cleanup(() => arena.setTaken([]));
  hoop.visible = false;
  glint.visible = false;
  smear.mesh.visible = false;
  tink.visible = false;
  maya.release({ x: 4, y: 1, d: 1 });
}
