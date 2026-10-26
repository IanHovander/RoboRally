// Gear, idea 5 (singing glass), animator b: character acting.
// Maya is the musician. She draws a breath, closes her eye, and starts to play the glass: a bead of light runs
// round her ring like a wet finger round a wine glass, and her whole body leans into the circling. The smoked
// glass around her shimmers with restless ripples of light, hunting for its shape... and finds it: the light
// gathers onto the still lines and settles into a four-petal compass with the east petal longest. Her eye opens
// on the note ("there it is") and she turns smoothly to east inside the figure, then lets the tone sink back into
// the glass with a small bow. Theo sways along, rapt, eyes half shut, and gives a tiny hop of applause.
export const meta = {
  title: 'Finding the note',
  idea:
    'Maya plays the glass like a wine glass: a bead of light circles her ring and she leans into it, eyes closed, while the glass around her shimmers with restless ripples looking for their shape. They find it, a four-petal compass with the long petal pointing east; her eye opens on the note and she turns into it, then bows as the tone sinks back into the glass. Theo sways along, rapt, and hops a little bravo.',
  notes:
    'Sound: a wet-glass tone that wavers while the shimmer hunts (seeded), steadies and swells exactly as the figure locks, and fades with it. The figure is a shader: the light sits on the zero lines of a sum of seeded standing waves, which are morphed into the zero lines of the compass (a rose |cos 2θ| with the petal toward her new heading stretched), so the light visibly slides onto the still lines. A red gear runs the bead and her lean the other way; the long petal always points where she will end.',
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
  const circ = rot1 < rot0 ? 1 : -1; // the direction the bead runs: clockwise from above for a green gear
  const C = lab.pos(gx, gy);
  const warm = new THREE.Color(lab.PALETTE.light);
  const tint = new THREE.Color(spin > 0 ? lab.PALETTE.right : lab.PALETTE.left);

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const bump = (k) => Math.sin(Math.PI * clamp(k));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ----- the plan -----
  const BREATH = 0.0; // she draws a breath and closes her eye
  const PLAY = 0.16; // the bead starts round her ring
  const HUNT = 0.3; // the glass shimmers, hunting
  const FIND = 0.78; // the light starts gathering onto the still lines
  const LOCK = 1.02; // the compass: her eye opens
  const TURN0 = 1.0;
  const TURN1 = 1.38;
  const SINK = 1.36; // the tone and the figure sink back into the glass
  const BOW = 1.42;
  const END = 1.8;

  // ----- the singing glass: a disc of light about three spaces across -----
  const RAD = 1.6;
  const modes = [];
  for (let i = 0; i < 3; i++) {
    modes.push(new THREE.Vector4(2 + Math.floor(lab.rand() * 5), lab.range(3.5, 8), lab.range(0, TAU), lab.range(5, 11)));
  }
  const longAng = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][A.d]; // in the disc: x east, y north
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 },
      uAmp: { value: 0 }, // how much the glass is ringing
      uSettle: { value: 0 }, // 0: restless shimmer, 1: the compass
      uSink: { value: 0 },
      uM0: { value: modes[0] },
      uM1: { value: modes[1] },
      uM2: { value: modes[2] },
      uLong: { value: longAng },
      uWarm: { value: warm.clone().multiplyScalar(1.5) },
      uTint: { value: tint.clone().multiplyScalar(1.3) },
    },
    vertexShader: `
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uT, uAmp, uSettle, uSink, uLong;
      uniform vec4 uM0, uM1, uM2;
      uniform vec3 uWarm, uTint;
      varying vec2 vP;
      float mode(vec4 m, float r, float th, float t, float ph) {
        return cos(m.x * th + m.z) * sin(m.y * r + ph) * cos(t * m.w + ph * 2.0);
      }
      void main() {
        float r = length(vP);
        if (r > ${RAD.toFixed(2)}) discard;
        float th = atan(vP.y, vP.x);
        // the restless shimmer: the zero lines of a few standing waves beating against each other
        float fs = mode(uM0, r, th, uT, 0.3) + 0.8 * mode(uM1, r, th, uT, 1.7) + 0.6 * mode(uM2, r, th, uT, 4.1);
        // the compass: a four-petal rose on the axes, the petal toward her new heading stretched like a needle
        float dl = cos(th - uLong);
        float petal = 1.02 + 0.5 * pow(max(dl, 0.0), 6.0);
        float rose = petal * pow(abs(cos(2.0 * th)), 0.7);
        float fc = (r - rose) * 2.2;
        float f = mix(fs, fc, uSettle);
        float w = mix(0.11, 0.075, uSettle) + 0.12 * uSink;
        float line = exp(-(f * f) / (w * w));
        // a needle down the middle of the long petal, and a quiet ring where her ring touches the glass
        float needle = uSettle * exp(-pow(r * sin(th - uLong) / 0.035, 2.0)) * step(0.0, dl) * smoothstep(rose + 0.05, rose - 0.2, r);
        // fine restless ripples while it hunts
        float fine = (1.0 - uSettle) * 0.5 * (0.5 + 0.5 * sin(r * 34.0 - uT * 26.0 + th * 3.0));
        float env = smoothstep(${RAD.toFixed(2)}, ${(RAD * 0.6).toFixed(2)}, r) * smoothstep(0.36, 0.56, r);
        float a = (line * (0.6 + 0.25 * uSettle) + 0.7 * needle + fine * line * 0.6) * env * uAmp * (1.0 - uSink);
        vec3 col = mix(uTint, uWarm, 0.35 + 0.65 * uSettle);
        gl_FragColor = vec4(col * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(RAD, 96), mat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(C.x, 0.013, C.z);
  disc.renderOrder = 6;
  lab.add(disc);

  // the wet finger: a bead of light running round her ring
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
  const beads = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshBasicMaterial({ map: glowTex, color: warm.clone().lerp(new THREE.Color(sc.bots.a.color), 0.35).multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 7;
    lab.add(m);
    beads.push(m);
  }
  const RING = 0.41 * 1.3;

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
    for (const m of [maya.model, theo.model]) {
      m.body.scale.set(1, 1, 1);
      m.body.rotation.set(0, 0, 0);
    }
    if (mEye) mEye.scale.set(1, 1, 1);
    if (tEye) tEye.scale.set(1, 1, 1);
  };
  lab.cleanup(restore);

  const t0 = lab.t;
  let prevS = 0;
  let ang = Math.PI / 2; // the bead's angle on her ring (x-z), starting at her back
  const stop = lab.every(() => {
    const s = lab.t - t0;
    const dt = Math.max(0, s - prevS);
    prevS = s;

    // the tone: rubbing builds it, the lock steadies it, then it sinks
    const play = ease.inOut(seg(s, PLAY, HUNT)) * (1 - ease.inOut(seg(s, SINK - 0.05, SINK + 0.25)));
    const settle = ease.inOut(seg(s, FIND, LOCK));
    const sink = ease.in(seg(s, SINK, END - 0.05));
    const rate = 5 + 7 * ease.inOut(seg(s, PLAY, FIND)) - 4 * settle; // the finger goes round faster, then calms
    ang += circ * rate * dt * play;
    mat.uniforms.uT.value = s * (1 - 0.85 * settle); // the shimmer slows to a standstill as it locks
    mat.uniforms.uAmp.value = ease.out(seg(s, HUNT - 0.08, FIND)) * (1 + 0.5 * bump(seg(s, LOCK - 0.06, LOCK + 0.3)));
    mat.uniforms.uSettle.value = settle;
    mat.uniforms.uSink.value = sink;

    // the bead and a short tail
    beads.forEach((m, i) => {
      const a = ang - circ * i * 0.13;
      m.position.set(C.x + RING * Math.cos(a), 0.015, C.z + RING * Math.sin(a));
      m.material.opacity = play * (i === 0 ? 1 : 0.5 * (1 - i / beads.length));
      m.scale.setScalar(i === 0 ? 1 : 0.8);
    });

    // ----- Maya: the musician -----
    const breath = bump(seg(s, BREATH, PLAY + 0.06)); // draws herself up
    const lost = ease.inOut(seg(s, 0.08, 0.26)) * (1 - ease.out(seg(s, LOCK - 0.04, LOCK + 0.06))); // eye shut, lost in it
    const found = ease.out(seg(s, LOCK - 0.04, LOCK + 0.08)) * (1 - ease.inOut(seg(s, SINK + 0.1, END))); // "there it is"
    const sway = play * (1 - 0.7 * settle); // her body leans into the circling
    const turnK = ease.inOut(seg(s, TURN0, TURN1));
    const bow = bump(seg(s, BOW, BOW + 0.3));
    const gasp = bump(seg(s, LOCK - 0.04, LOCK + 0.2)); // a little rise as the note locks
    const rot = lerp(rot0, rot1, turnK);
    maya.set({ rot, lift: 0.03 * breath + 0.05 * gasp });
    // the lean follows the bead: express the bead's direction in her own frame
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const fwd = -(dx * Math.sin(rot) + dz * Math.cos(rot)); // + = bead in front of her
    const right = dx * Math.cos(rot) - dz * Math.sin(rot); // + = bead on her right
    const mPitch = 0.15 * sway * fwd - 0.1 * breath + 0.34 * bow - 0.1 * gasp;
    const mRoll = 0.15 * sway * right;
    maya.each = (m) => {
      m.body.rotation.x = -mPitch;
      m.body.rotation.z = -mRoll;
      m.body.position.y += 0.2 * Math.abs(Math.sin(mPitch));
      const sy = 1 + 0.1 * breath + 0.05 * found + 0.06 * gasp - 0.1 * bow;
      const sxz = 1 / Math.sqrt(sy);
      m.body.scale.set(sxz, sy, sxz);
      if (mEye) {
        const open = (1 - 0.88 * lost) * (1 + 0.45 * found);
        mEye.scale.set(Math.max(0.06, open), 1 + 0.15 * found, Math.max(0.06, open));
      }
      m.eyeMat.color.multiplyScalar((1 - 0.4 * lost) * (1 + 0.9 * found));
    };

    // ----- Theo: the audience -----
    const rapt = ease.inOut(seg(s, HUNT, FIND)) * (1 - ease.out(seg(s, LOCK - 0.02, LOCK + 0.08)));
    const struck = ease.out(seg(s, LOCK, LOCK + 0.1)) * (1 - ease.inOut(seg(s, SINK, SINK + 0.2))); // sits up at the note
    const hopK = seg(s, BOW + 0.14, BOW + 0.32);
    const hop = Math.sin(Math.PI * hopK) * (hopK > 0 && hopK < 1 ? 1 : 0); // a tiny hop of applause
    const tSway = Math.sin(s * 7.5) * 0.1 * rapt;
    theo.set({ x: B.x, y: B.y, lift: 0.1 * hop });
    theo.each = (m) => {
      m.body.rotation.z = tSway;
      m.body.rotation.x = -(-0.12 * struck + 0.05 * rapt);
      const sy = 1 + 0.08 * struck + 0.12 * hop - 0.05 * rapt;
      m.body.scale.set(1, sy, 1);
      if (tEye) tEye.scale.set(1, 1, 1 - 0.6 * rapt);
      m.eyeMat.color.multiplyScalar((1 - 0.45 * rapt) * (1 + 0.8 * struck + 0.6 * hop));
    };
  });

  await lab.wait(END);
  stop();
  restore();
  maya.each = null;
  theo.each = null;
  disc.visible = false;
  beads.forEach((m) => (m.visible = false));
  maya.release({ x: A.x, y: A.y, d: A.d });
  theo.release({ x: B.x, y: B.y, d: B.d });
}
