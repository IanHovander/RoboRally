// Gear, idea 4 (coin on a table), animator b: character acting.
// The gear catches Maya off guard: she sinks, then tips up onto the rim of her base with a startled eye, and
// wobbles round like a coin settling on a table. The point where her rim touches the glass is a bead of light that
// runs round her, slowly at first, then faster and faster as her tilt flattens, while her heading creeps a quarter
// round to east. She screws her eye shut as it gets frantic. Then she drops flat with a tiny squash and EVERYTHING
// stops dead. Theo, who had been swaying along, hypnotised, is frozen mid-lean. A beat of total stillness; Maya
// opens one cautious eye; then Theo quietly straightens up as if nothing happened.
export const meta = {
  title: 'Spun out',
  idea:
    'Maya tips onto the rim of her base and wobbles round like a coin settling on a table, her ring of light the coin\'s edge and the point where it touches the glass a bead of light racing round her, faster and faster, while she creeps a quarter turn to east. She drops flat and everything stops dead, including Theo, who had been swaying along and is caught frozen mid-lean. A beat of stillness, one cautious eye, and Theo straightens up, embarrassed.',
  notes:
    'Sound: a glassy whirr rising in pitch with the bead of light, cut to dead silence on the drop (the punchline), then nothing at all while Theo is caught leaning; a tiny glass "tink" when he straightens. The wobble is a real Euler\'s-disk shape: the tilt flattens as (1-t)^0.55 and the circling speeds up as 1/sqrt(tilt). The whole robot pivots about the contact point on the rim of its own ring, so every form wobbles on its own base. Red gears circle the other way. Her heading creeps on a smooth ramp with no overshoot.',
};

const TAU = Math.PI * 2;

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const sc = lab.scenario;
  const A = sc.after.a;
  const B = sc.bots.b;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  maya.set({ trail: false });
  theo.set({ trail: false });
  const gx = sc.bots.a.x;
  const gy = sc.bots.a.y;
  const gear = lab.arena.gears.get(`${gx},${gy}`);
  const spin = gear?.spin ?? 1;
  const rot0 = maya.pose.rot;
  const rot1 = rot0 + ((facing(A.d) - rot0 + 3 * Math.PI) % TAU) - Math.PI;
  const C = lab.pos(gx, gy);
  const T = lab.pos(B.x, B.y);
  const circ = rot1 < rot0 ? 1 : -1; // green: clockwise seen from above (+ in x-z), red: the other way

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const bump = (k) => Math.sin(Math.PI * clamp(k));
  const lerp = (a, b, k) => a + (b - a) * k;

  // the rim she rolls on: her ring of light is the coin's edge
  const R = 0.41 * 1.3;

  // ----- the plan -----
  const SINK = 0.0; // the gear catches her: she sinks
  const TIP = 0.12; // up onto her rim
  const WOB = 0.24; // the wobble proper
  const DROP = 1.3; // flat. silence.
  const PEEK = DROP + 0.2; // one cautious eye
  const SHEEP = DROP + 0.3; // Theo straightens up
  const END = DROP + 0.52;
  const A0 = 0.32; // starting tilt, radians
  // precession: the contact point's angle, integrated frame by frame (speeds up as the tilt flattens)
  let phi = Math.atan2(Math.cos(rot0), -Math.sin(rot0)) + Math.PI * 0.5 * circ; // start on her side
  const tiltAt = (s) => {
    if (s < TIP) return 0;
    if (s < WOB) return A0 * ease.out(seg(s, TIP, WOB));
    if (s < DROP) return A0 * Math.pow(1 - seg(s, WOB, DROP), 0.55) + 0.018;
    return 0;
  };
  const rateAt = (s, a) => (s < TIP ? 0 : Math.min(33, 3.2 * Math.sqrt(A0 / Math.max(a, 0.02)) + (s < WOB ? 0 : 2)));
  const headAt = (s) => {
    const k = seg(s, TIP, DROP);
    return lerp(rot0, rot1, k - Math.sin(TAU * k) / TAU); // a steady creep, soft at both ends, no overshoot
  };

  // the contact point: a bead of light racing round her on the glass
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.2, 'rgba(255,255,255,.55)');
    gr.addColorStop(0.55, 'rgba(255,255,255,.1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const col = new THREE.Color(sc.bots.a.color);
  const beadMat = new THREE.MeshBasicMaterial({ map: glowTex, color: col.clone().lerp(new THREE.Color(lab.PALETTE.light), 0.55).multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const bead = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), beadMat);
  bead.rotation.x = -Math.PI / 2;
  bead.renderOrder = 7;
  lab.add(bead);
  // a short smear behind the bead, so the speed reads
  const smear = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), beadMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 7;
    lab.add(m);
    smear.push(m);
  }

  // ----- parts -----
  const findEye = (model) => {
    let eye = null;
    model.body.traverse((o) => {
      if (!eye && o.isMesh && o.material === model.eyeMat) eye = o;
    });
    return eye;
  };
  const mEye = findEye(maya.model);
  const tEye = findEye(theo.model);
  const restore = () => {
    for (const m of [maya.model, theo.model]) m.body.scale.set(1, 1, 1);
    if (mEye) mEye.scale.set(1, 1, 1);
    if (tEye) tEye.scale.set(1, 1, 1);
  };
  lab.cleanup(restore);

  const UP = new THREE.Vector3(0, 1, 0);
  const qYaw = new THREE.Quaternion();
  const qTilt = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const off = new THREE.Vector3();
  // the name tags ride on the robots' groups: keep them steady over the spaces while the robots tip
  const tags = [lab.bot('a')?.tag, lab.bot('b')?.tag];
  const tagY = tags.map((t) => (t ? t.position.y : 0));
  const unTag = () => tags.forEach((t, i) => t && t.position.set(0, tagY[i], 0));
  lab.cleanup(unTag);
  const tagW = new THREE.Vector3();
  const steadyTag = (p, tag, at, y) => {
    if (!tag) return;
    p.group.updateMatrixWorld(true);
    tag.position.copy(p.group.worldToLocal(tagW.set(at.x, y * 1.3, at.z)));
  };
  /** stand robot `p` (centre `at`, heading `yaw`) tilted by `a` towards the contact angle `ph`, pivoting on its rim */
  const pose = (p, at, yaw, a, ph, lift = 0) => {
    const g = p.group;
    const cx = Math.cos(ph);
    const cz = Math.sin(ph);
    axis.set(cz, 0, -cx).normalize(); // up x contact: tipping about it lowers the contact side
    qTilt.setFromAxisAngle(axis, a);
    qYaw.setFromAxisAngle(UP, yaw);
    g.quaternion.copy(qTilt).multiply(qYaw);
    off.set(R * cx, 0, R * cz).applyQuaternion(qTilt);
    g.position.set(at.x + R * cx - off.x, lift - off.y, at.z + R * cz - off.z);
  };

  // Theo sways along, hypnotised: a smaller copy of her wobble, a beat behind
  let tPhi = phi;
  let frozen = null; // Theo's lean when everything stopped
  const t0 = lab.t;
  let prevS = 0;
  const stop = lab.every(() => {
    const s = lab.t - t0;
    const dt = Math.max(0, s - prevS);
    prevS = s;
    const a = tiltAt(s);
    const w = rateAt(s, a);
    if (s < DROP) phi += circ * w * dt;
    const head = s < DROP ? headAt(s) : rot1;

    // ----- Maya -----
    const sink = bump(seg(s, SINK, TIP + 0.04)); // caught by the gear
    const whoa = ease.out(seg(s, TIP, TIP + 0.1)) * (1 - seg(s, 0.55, 0.85)); // wide-eyed
    const brace = ease.inOut(seg(s, 0.7, 1.05)); // eye screwed shut as it gets frantic
    const dropK = seg(s, DROP, DROP + 0.09);
    const squash = s >= DROP ? Math.sin(Math.PI * dropK) * (1 - dropK * 0.2) : 0; // one tiny squash, no bounce
    const peek = ease.inOut(seg(s, PEEK, PEEK + 0.16));
    maya.set({ rot: head, x: gx, y: gy, lift: 0 });
    maya.each = (m) => {
      if (s < DROP) {
        pose(maya, C, head, a, phi);
        steadyTag(maya, tags[0], C, tagY[0]);
      } else if (tags[0]) tags[0].position.set(0, tagY[0], 0);
      const sy = 1 - 0.08 * sink - 0.1 * squash;
      const sxz = 1 + 0.04 * sink + 0.06 * squash;
      m.body.scale.set(sxz, sy, sxz);
      // the eye: wide on the tip, narrowing as it speeds up, shut tight for the last of it; after the drop it
      // stays shut through the silence, then opens a crack... and all the way
      const open = s < DROP ? (1 + 0.6 * whoa) * (1 - 0.92 * brace) : 0.08 + 0.92 * peek;
      if (mEye) mEye.scale.set(Math.max(0.05, open), 1 + 0.2 * whoa, Math.max(0.05, open));
      m.eyeMat.color.multiplyScalar(s < DROP ? 1 + 0.5 * whoa : 0.4 + 0.6 * peek);
    };

    // ----- the bead of light where her rim meets the glass -----
    const on = s >= TIP && s < DROP ? ease.out(seg(s, TIP, WOB)) : 0;
    const bx = C.x + R * Math.cos(phi);
    const bz = C.z + R * Math.sin(phi);
    bead.position.set(bx, 0.014, bz);
    beadMat.opacity = on * (0.55 + 0.45 * clamp(w / 20));
    bead.scale.setScalar(0.8 + 0.5 * clamp(w / 30));
    smear.forEach((m, i) => {
      const back = phi - circ * (i + 1) * clamp(w / 30) * 0.22;
      m.position.set(C.x + R * Math.cos(back), 0.013, C.z + R * Math.sin(back));
      m.material.opacity = on * clamp((w - 6) / 20) * 0.6 * (1 - i / smear.length);
    });

    // ----- Theo -----
    const join = ease.inOut(seg(s, 0.3, 0.7)); // starts swaying along as she speeds up
    const lag = 0.5;
    tPhi = phi - circ * lag;
    const tA = 0.2 * join;
    const tHead = theo.pose.rot;
    if (s < DROP) {
      theo.set({ x: B.x, y: B.y });
      theo.each = () => {
        pose(theo, T, tHead, tA, tPhi);
        steadyTag(theo, tags[1], T, tagY[1]);
      };
    } else {
      if (!frozen) frozen = { a: tA, ph: tPhi };
      // caught mid-lean: perfectly still... then quietly straightens up
      const k = ease.inOut(seg(s, SHEEP, SHEEP + 0.18));
      const settle = s > SHEEP + 0.18 ? Math.exp(-seg(s, SHEEP + 0.18, END) * 6) * Math.sin(seg(s, SHEEP + 0.18, END) * 16) * 0.02 : 0;
      theo.each = (m) => {
        pose(theo, T, tHead, frozen.a * (1 - k), frozen.ph);
        steadyTag(theo, tags[1], T, tagY[1]);
        m.body.scale.set(1, 1 - 0.05 * bump(seg(s, SHEEP + 0.1, SHEEP + 0.24)) + settle, 1);
        // he looks away: his eye dims a touch while he straightens, as if nothing happened
        m.eyeMat.color.multiplyScalar(1 - 0.5 * bump(seg(s, SHEEP - 0.04, END)));
      };
    }
  });

  await lab.wait(END);
  stop();
  restore();
  unTag();
  maya.each = null;
  theo.each = null;
  bead.visible = false;
  smear.forEach((m) => (m.visible = false));
  maya.release({ x: A.x, y: A.y, d: A.d });
  theo.release({ x: B.x, y: B.y, d: B.d });
}
