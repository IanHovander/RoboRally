// Rear-ended by her own trail, played as character acting. Maya brakes hard at the rim, teeters, and finds her
// footing: a big "phew" and a little smug bob for the sofa. But her trail of light, which always lags, is
// still coming: it sweeps up along her path, gathering itself into a bright, bunched knot. She half-hears it:
// a glance back, nothing; a second, wide-eyed take... and it rear-ends her, mid-look. She lurches onto the
// pit and drops. The knot rolls up to the rim, stops on the edge like it meant to, and fades the way a trail
// always does. Theo sees it all coming and can't do a thing.
export const meta = {
  title: 'Pile-up',
  idea: 'Maya slams on the brakes at the rim, teeters, and recovers: a big exhale and a pleased little bob to the sofa. Behind her, her lagging trail keeps coming, sweeping itself up into a bright knot of red light. She glances back (nothing), looks ahead, then does a wide-eyed second take just as the knot rear-ends her. She lurches onto the pit and drops; the knot rolls up to the rim, sits there looking innocent, and fades like any trail.',
  notes: 'Sound: a glassy skid and a wobble for the teeter, a soft exhale chime; then a rising glass "accordion" crunch as the trail bunches up, a fat soft bonk at the impact and nothing for the fall. Port: the knot is the robot\'s real trail points pushed along the path (a snowplow: the front sweeps up the points behind it) and kept bright, then aged away. Theo leans in at the brake, sees the knot coming, flinches at the bonk and peeks at the hole.',
};

export default async function play(lab) {
  const { ease, facing, THREE } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  lab.playCard('a', ['m3']);
  const b = maya.bot;
  const RED = new THREE.Color(b.color);

  const lerp = (a, c, k) => a + (c - a) * k;
  const clamp = (k) => Math.max(0, Math.min(1, k));
  const key = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, fn] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) return lerp(v0, v1, (fn ?? ease.inOut)(clamp((t - t0) / (t1 - t0 || 1))));
    }
    return keys[keys.length - 1][1];
  };
  const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const glowTex = (() => {
    const c = canvas(64, 64);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // ---------- timing ----------
  const T = {
    brake: 0.46, // slams on the brakes
    stop: 0.62,
    phew: 0.86,
    sweep: 0.9, // the trail starts to gather itself up
    glance: 1.18, // a glance back: nothing
    glanceBack: 1.32,
    take: 1.48, // the wide-eyed second take
    hit: 1.6, // bonk
    over: 1.8, // she's over the pit
    gone: 2.1,
    rest: 1.9, // the knot stops on the rim
    fade0: 2.2,
    fade1: 2.85,
    end: 3.0,
  };
  const BACK = 2.62; // her back, when she stands on (3,1)

  // ---------- Maya ----------
  const mayaX = [[0, 1], [0.28, 1.95, ease.in], [T.brake, 2.78, ease.linear], [T.stop, 3.1, ease.out], [T.stop + 0.14, 2.98, ease.inOut], [T.stop + 0.24, 3, ease.inOut],
    [T.hit, 3], [T.over, 4, (k) => 1 - (1 - k) ** 2.4]];
  const mayaLift = [[T.over - 0.06, 0], [T.gone, -1.15, ease.in]];
  const rock = [[T.brake, 0], [T.stop, 0.42, ease.out], [T.stop + 0.12, -0.16, ease.inOut], [T.stop + 0.24, 0.08, ease.inOut], [T.stop + 0.34, 0, ease.inOut],
    [T.hit, 0], [T.hit + 0.04, -0.3, ease.out], [T.over - 0.06, 0.35, ease.inOut]];
  const squash = [[T.phew, 1], [T.phew + 0.12, 0.86, ease.out], [T.phew + 0.3, 1.06, ease.inOut], [T.phew + 0.42, 1, ease.inOut],
    [T.hit, 1], [T.hit + 0.05, 0.78, ease.out], [T.hit + 0.18, 1.08, ease.out], [T.over, 1], [T.gone, 1.2, ease.in]];
  // the hit squashes her front to back (local z), then she stretches as she lurches
  const longK = [[T.hit, 1], [T.hit + 0.04, 0.72, ease.out], [T.hit + 0.16, 1.22, ease.out], [T.over, 1.05]];
  const look = [[0, 0], [T.phew + 0.1, 0], [T.phew + 0.26, -0.42, ease.out], [T.glance - 0.06, -0.2, ease.inOut], // a pleased little turn to the sofa
    [T.glance, -1.1, ease.out], [T.glanceBack, -0.05, ease.inOut], [T.take, -0.05], [T.take + 0.08, -1.45, ease.out], [T.hit + 0.02, -1.5],
    [T.over, 0.25, ease.out]];
  const eyeK = [[0, 1], [T.brake, 1], [T.stop, 2.6, ease.out], [T.phew, 1.4], [T.phew + 0.2, 0.75], [T.glance, 0.8], [T.glance + 0.06, 1.6], [T.glanceBack, 1], [T.take, 1], [T.take + 0.06, 3.2, ease.out], [T.over, 2.4]];
  const eyeOpen = [[T.phew, 1], [T.phew + 0.15, 0.45, ease.out], [T.glance - 0.04, 0.5], [T.glance, 1, ease.out], [T.take, 1], [T.take + 0.06, 2.4, ease.out], [T.over, 2.2]];

  // ---------- the knot ----------
  // the front of the knot sweeps up the path, speeding up, and arrives at her back exactly at the hit
  const front = [[T.sweep, 0.95], [T.hit, BACK, (k) => 0.25 * k + 0.75 * k ** 2.2], [T.rest, 3.3, ease.out]];
  // the pile: each point stacks a little closer behind the one in front (an accordion)
  const stack = [0];
  for (let r = 1; r < 200; r++) stack.push(stack[r - 1] + 0.03 * 0.95 ** r);
  let pts = null; // the trail's own points, with where they lay on the path
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: RED.clone().multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat));
  glow.rotation.x = -Math.PI / 2;
  const popMat = new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(lab.PALETTE.light).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pop = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), popMat));
  pop.rotation.x = -Math.PI / 2;

  // ---------- Theo ----------
  const aim = (x, y) => Math.atan2(-(x - 5), -(y - 3));
  const theoPitch = [[T.brake, 0], [T.stop, 0.16, ease.out], [T.phew, 0.1], [T.phew + 0.2, -0.04, ease.inOut], [T.sweep + 0.2, 0], [T.take, -0.12, ease.inOut],
    [T.hit, -0.12], [T.hit + 0.05, -0.28, ease.out], [T.gone, 0.06, ease.inOut], [T.gone + 0.3, 0.2, ease.inOut], [T.fade1, 0.14], [T.end, 0, ease.inOut]];
  const theoSy = [[T.phew + 0.05, 1], [T.phew + 0.2, 0.93, ease.out], [T.phew + 0.4, 1, ease.inOut], [T.hit, 1], [T.hit + 0.05, 0.86, ease.out], [T.hit + 0.25, 1, ease.out]];
  const theoLookW = [[T.sweep + 0.1, 0], [T.sweep + 0.35, 1, ease.inOut], [T.end - 0.25, 1], [T.end, 0, ease.inOut]];

  // ---------- run ----------
  const t0 = lab.t;
  let now = 0;
  const eyeBase = new THREE.Color(3.2, 3.1, 2.9);
  const eyeMesh = maya.model.body.children.find((o) => o.material === maya.model.eyeMat);

  const stop = lab.every((dt, t) => {
    now = t - t0;
    const s = key(now, squash);
    const lk = key(now, longK);
    maya.set({
      x: key(now, mayaX),
      lift: key(now, mayaLift),
      rot: facing(1) + key(now, look),
      sy: s,
      sx: 1 / Math.sqrt(s),
      sz: lk / Math.sqrt(s),
      visible: now < T.gone,
      trail: now < T.sweep,
    });

    // the trail gathers itself up
    if (now >= T.sweep && !pts) {
      pts = b.trail.map((p) => ({ p, x0: p.x, z0: p.z }));
    }
    if (pts) {
      const F = lab.pos(key(now, front), 1).x;
      const z = lab.pos(0, 1).z;
      let rank = 0;
      // newest first: the first points the front reaches pile up right at it, the rest stack behind
      const swept = [];
      for (let i = pts.length - 1; i >= 0; i--) {
        const q = pts[i];
        if (q.x0 <= F) swept.push(q);
      }
      // keep the points under her (ahead of the front) where they are until the front gets there
      for (const q of pts) {
        if (q.x0 > F) {
          q.p.x = q.x0;
          q.p.z = q.z0;
        }
      }
      swept.sort((a, c) => c.x0 - a.x0);
      for (const q of swept) {
        const fold = Math.sin(rank * 1.25 + now * 7) * 0.19 * Math.min(1, rank / 4);
        q.p.x = F - stack[Math.min(rank, stack.length - 1)];
        q.p.z = z + fold;
        rank++;
      }
      // brightness: kept fresh while it gathers, then it ages out like any trail
      const fadeK = key(now, [[T.fade0, 0], [T.fade1, 1, ease.in]]);
      for (const q of pts) q.p.t = t - 3.2 * Math.max(0.03, fadeK, swept.includes(q) ? 0.3 : 0);
      const n = swept.length;
      const mass = clamp(n / 35);
      glow.position.set(F - stack[Math.min(n, stack.length - 1)] * 0.45, 0.012, z);
      glow.scale.setScalar(0.45 + 0.6 * mass);
      glowMat.opacity = mass * 0.55 * (1 - fadeK) * (1 + 0.5 * Math.sin(clamp((now - T.rest) / 0.3) * Math.PI));
    }
    const pk = (now - T.hit) / 0.22;
    popMat.opacity = pk > 0 && pk < 1 ? 1 - pk : 0;
    pop.scale.setScalar(0.4 + 0.9 * clamp(pk));
    pop.position.copy(lab.pos(BACK + 0.02, 1)).setY(0.15);

    // Theo watches the knot come, then the hole
    const target = now < T.hit ? aim(key(now, front), 1) : aim(lerp(3, 4, clamp((now - T.hit) / 0.3)), 1);
    const ts = key(now, theoSy);
    theo.set({ rot: target * key(now, theoLookW), sy: ts, sx: 1 / Math.sqrt(ts), sz: 1 / Math.sqrt(ts) });
  });

  maya.each = (m) => {
    m.body.rotation.x = -key(now, rock);
    m.eyeMat.color.copy(eyeBase).multiplyScalar(key(now, eyeK));
    if (eyeMesh) eyeMesh.scale.set(key(now, eyeOpen), 1, 1);
    if (b.card) b.card.visible = maya.pose.lift > -0.2;
  };
  theo.each = (m) => {
    m.body.rotation.x = -key(now, theoPitch);
    const sees = clamp((now - T.sweep - 0.3) / 0.2) * (now < T.hit + 0.3 ? 1 : 0);
    m.eyeMat.color.copy(eyeBase).multiplyScalar(1 + 1.2 * sees);
  };
  lab.cleanup(() => {
    if (eyeMesh) eyeMesh.scale.set(1, 1, 1);
    glowTex.dispose();
  });

  await lab.wait(T.end);
  stop();
  if (eyeMesh) eyeMesh.scale.set(1, 1, 1);
  b.trail.length = 0;
  maya.each = null;
  theo.each = null;
  maya.release({ on: false });
  theo.release({ x: 5, y: 3, d: 0 });
}
