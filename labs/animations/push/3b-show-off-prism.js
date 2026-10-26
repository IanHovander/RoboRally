// Refraction Kiss, animator b (character acting): Theo the Prism is a show-off, and Maya's light is his big moment.
export const meta = {
  title: 'Refraction Kiss (b): the show-off',
  idea:
    "Theo sees Maya's headlight coming and braces, eyes shut. On the touch her warm light pours into his glass (her own eye goes dim: hey, that was mine) " +
    'and comes out of his far side as a little rainbow that unrolls along the glass and lands exactly on space 4. Theo opens his eyes, sees it and is enchanted: a little hop of joy. ' +
    "Then he rides his own spectrum like a red carpet, chin up and shimmering with its colours, while Maya does all the work behind him. " +
    'On 4 the colours fold back into his ridge in one bright glint; Jun is dazzled and squints, Maya gets her light back, and Theo holds the pose and winks one last sparkle.',
  notes:
    'Sound: a held glass tone as her light goes in, a quick harp-like run up the scale as the rainbow unrolls (one note per colour), a soft "ting" of a wine glass for the glint, and a tiny high tick for the wink. ' +
    "The rainbow quietly shows where he'll land before he gets there. Each form would bend the pusher's light its own way: an Orb focuses it to a hot point on its destination (and looks cross-eyed at it), " +
    'a Cube mirrors it back (the pusher gets dazzled instead), a Capsule draws a line of caustic it rolls along; the character beat stays the same: the pushed one is delighted, the pusher robbed. ' +
    'Porting: the fan is a 16x8 plane bent into a wedge each frame with a rainbow canvas texture, additive; the glint is a sprite star at the ridge.',
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

  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  const eyesOf = (m) => {
    const out = [];
    m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && out.push(o));
    return out;
  };
  const mayaEyes = eyesOf(maya.model);
  const junEyes = eyesOf(jun.model);
  const tPaint = theo.model.paint;
  const paint0 = { e: tPaint.emissive.clone(), i: tPaint.emissiveIntensity };
  lab.cleanup(() => {
    tPaint.emissive.copy(paint0.e);
    tPaint.emissiveIntensity = paint0.i;
  });

  // ----- timing (play seconds) -----
  const BRACE = 0.22;
  const CONTACT = 0.42;
  const FILL = 0.5; // her light is inside him
  const UNROLL = 0.66; // the rainbow has landed on 4
  const JOY = 0.74;
  const GO = 0.84;
  const ARRIVE = 1.34;
  const POSE = 1.5;
  const WINK = 1.8;
  const END = 2.1;

  // ----- the rainbow fan -----
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const fanTex = canvasTex(256, 128, (g, w, h) => {
    // across (v): the spectrum, red on the north side to violet on the south; along (u): light thinning out, a bright landing edge
    for (let y = 0; y < h; y++) {
      const k = y / (h - 1);
      g.fillStyle = `hsl(${Math.round(k * 275)}, 100%, 58%)`;
      g.fillRect(0, y, w, 1);
    }
    g.globalCompositeOperation = 'destination-in';
    const al = g.createLinearGradient(0, 0, w, 0);
    al.addColorStop(0, 'rgba(0,0,0,0.95)');
    al.addColorStop(0.55, 'rgba(0,0,0,0.55)');
    al.addColorStop(0.86, 'rgba(0,0,0,0.6)');
    al.addColorStop(0.93, 'rgba(0,0,0,1)');
    al.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = al;
    g.fillRect(0, 0, w, h);
    const ed = g.createLinearGradient(0, 0, 0, h);
    ed.addColorStop(0, 'rgba(0,0,0,0)');
    ed.addColorStop(0.12, 'rgba(0,0,0,1)');
    ed.addColorStop(0.88, 'rgba(0,0,0,1)');
    ed.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ed;
    g.fillRect(0, 0, w, h);
  });
  const NU = 16;
  const NV = 8;
  const fanGeo = new THREE.PlaneGeometry(1, 1, NU, NV);
  const fanMat = new THREE.MeshBasicMaterial({ map: fanTex, color: new THREE.Color(1.35, 1.35, 1.35), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const fan = new THREE.Mesh(fanGeo, fanMat);
  fan.renderOrder = 3;
  lab.add(fan);
  const fanPos = fanGeo.attributes.position;
  // the wedge: apex (ax, ay) in spaces, reaching east to x = ex, half-width hw at the far end
  const setFan = (ax, ay, ex, hw, apexW = 0.05) => {
    const a = lab.pos(ax, ay);
    const e = lab.pos(ex, 2);
    let i = 0;
    for (let iv = 0; iv <= NV; iv++) {
      for (let iu = 0; iu <= NU; iu++) {
        const u = iu / NU;
        const v = iv / NV;
        const x = lerp(a.x, e.x, u);
        const zc = lerp(a.z, e.z, u);
        const half = lerp(apexW, hw, u);
        fanPos.setXYZ(i++, x, 0.014, zc + (v - 0.5) * 2 * half);
      }
    }
    fanPos.needsUpdate = true;
  };
  // PlaneGeometry's uv: u along x (0 → 1), v along y (bottom 1 → top 0 ... it's 1 at the first row); our rows go v = 0 → 1 north to south
  // so flip the v of the uvs once: the first row (iv = 0) is north, which should be red (v near 1 in texture space means the top of the canvas)
  const uvs = fanGeo.attributes.uv;
  for (let i = 0; i < uvs.count; i++) uvs.setY(i, 1 - Math.floor(i / (NU + 1)) / NV);
  uvs.needsUpdate = true;

  // a rainbow ring where it lands (the spot it's showing him)
  const ringTex = canvasTex(128, 128, (g, w, h) => {
    const cg = g.createConicGradient(0, w / 2, h / 2);
    for (let i = 0; i <= 6; i++) cg.addColorStop(i / 6, `hsl(${(i * 60) % 360}, 100%, 60%)`);
    g.fillStyle = cg;
    g.fillRect(0, 0, w, h);
  });
  const landMat = new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const land = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.42, 64), landMat);
  land.rotation.x = -Math.PI / 2;
  land.position.copy(lab.pos(4, 2)).setY(0.012);
  lab.add(land);

  // the glint: a four-point star sprite
  const starTex = canvasTex(128, 128, (g, w, h) => {
    const c = w / 2;
    const ray = (dx, dy, len, wid) => {
      const gr = g.createLinearGradient(c - dx * len, c - dy * len, c + dx * len, c + dy * len);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = gr;
      g.lineWidth = wid;
      g.beginPath();
      g.moveTo(c - dx * len, c - dy * len);
      g.lineTo(c + dx * len, c + dy * len);
      g.stroke();
    };
    ray(1, 0, 62, 3);
    ray(0, 1, 62, 3);
    ray(0.707, 0.707, 26, 2);
    ray(0.707, -0.707, 26, 2);
    const core = g.createRadialGradient(c, c, 0, c, c, 18);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core;
    g.fillRect(0, 0, w, h);
  });
  const starMat = new THREE.SpriteMaterial({ map: starTex, color: new THREE.Color(3, 2.9, 2.7), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const star = new THREE.Sprite(starMat);
  star.renderOrder = 10;
  lab.add(star);
  const ridgeWorld = new THREE.Vector3();

  // ----- the robots -----
  const mayaX = track([[0, 1], [CONTACT, 2.4, (k) => k ** 1.6], [GO, 2.43, ease.out], [ARRIVE, 3, ease.inOut]]);
  const theoX = track([[GO, 3], [ARRIVE, 4, ease.inOut]]);
  const junHome = facing(3);
  const junAtTheo = (tx) => unwrapNear(toward(6, 0, tx, 2), junHome);

  let sparkle = 0;
  let chinUp = 0;
  let fanOn = 0;
  const t0 = lab.t;
  const stop = lab.every(() => {
    const T = lab.t - t0;
    // ---------- Maya ----------
    const pressed = seg(T, CONTACT, CONTACT + 0.04) * (1 - seg(T, GO - 0.04, GO));
    const robbed = seg(T, FILL, FILL + 0.1) * (1 - seg(T, ARRIVE + 0.02, ARRIVE + 0.1));
    const relief = bump(T, ARRIVE + 0.04, ARRIVE + 0.3);
    maya.set({
      x: mayaX(T),
      pitch: track([[0, 0], [0.3, 0.1], [CONTACT, 0.2, ease.in], [CONTACT + 0.08, 0.05, ease.out]])(T) - 0.12 * robbed * bump(T, FILL, GO) + 0.12 * seg(T, GO, GO + 0.1) * (1 - seg(T, ARRIVE - 0.1, ARRIVE)) - 0.1 * relief,
      sy: 1 - 0.07 * pressed - 0.05 * robbed + 0.06 * relief,
      sx: 1 + 0.04 * pressed,
      roll: 0.06 * Math.sin(seg(T, GO, ARRIVE) * TAU * 2) * robbed, // trudging
    });

    // ---------- Theo ----------
    const brace = seg(T, BRACE, CONTACT) * (1 - seg(T, FILL, FILL + 0.1));
    const look = bump(T, FILL + 0.04, GO + 0.04); // leans to see the rainbow by his side
    const hop = bump(T, JOY, GO + 0.02);
    const glide = seg(T, GO, GO + 0.12) * (1 - seg(T, ARRIVE + 0.1, POSE + 0.2));
    const pose = seg(T, ARRIVE, ARRIVE + 0.08) * (1 - seg(T, WINK + 0.05, END));
    const sway = Math.sin(seg(T, GO, ARRIVE) * TAU) * 0.07 * glide;
    chinUp = 0.2 * glide + 0.3 * pose;
    theo.set({
      x: theoX(T),
      roll: 0.1 * brace - 0.2 * look + sway, // braces away from her, then leans east (his left) to see
      pitch: 0.06 * brace + 0.12 * look,
      lift: 0.09 * hop,
      sy: 1 - 0.1 * brace + 0.12 * hop + 0.09 * glide + 0.12 * pose,
      sx: 1 + 0.05 * brace - 0.03 * glide,
      sz: 1 + 0.05 * brace - 0.03 * glide,
    });

    // ---------- Jun ----------
    const dazzle = seg(T, ARRIVE + 0.02, ARRIVE + 0.08) * (1 - seg(T, WINK, END - 0.02));
    const admire = seg(T, UNROLL, UNROLL + 0.15) * (1 - seg(T, ARRIVE, ARRIVE + 0.05));
    const watch = seg(T, CONTACT, CONTACT + 0.14) * (1 - seg(T, WINK, END - 0.02));
    jun.set({
      rot: lerp(junHome, junAtTheo(theoX(T) + 0.3), ease.out(watch)),
      pitch: 0.14 * admire - 0.22 * dazzle,
      lift: 0.03 * bump(T, ARRIVE + 0.02, ARRIVE + 0.2),
      sy: 1 + 0.05 * admire - 0.06 * dazzle,
    });

    // ---------- the rainbow ----------
    const tx = theoX(T);
    const apexX = tx + 0.3;
    const endX = 4.32;
    const grow = ease.out3(seg(T, FILL, UNROLL));
    fanOn = T < FILL ? 0 : T < ARRIVE ? 1 : 0;
    const len = Math.max(0, (endX - apexX) * grow);
    if (T >= FILL && T < ARRIVE) {
      const hw = 0.06 + len * 0.36;
      setFan(apexX, 2.06, apexX + len, hw, 0.04 + 0.03 * (1 - grow));
      fanMat.opacity = 0.95 * seg(T, FILL, FILL + 0.05);
    } else {
      fanMat.opacity = 0;
    }
    // where it lands: a spectral ring flares on 4, then waits for him
    const landed = T >= UNROLL - 0.02 ? 1 : 0;
    landMat.opacity = landed * (0.45 + 0.55 * bump(T, UNROLL - 0.02, UNROLL + 0.2)) * (1 - seg(T, ARRIVE - 0.12, ARRIVE + 0.02));
    land.rotation.z = T * 1.2;
    land.scale.setScalar(1 + 0.25 * bump(T, UNROLL - 0.02, UNROLL + 0.22));

    // ---------- the glint ----------
    sparkle = Math.max(bump(T, ARRIVE - 0.02, ARRIVE + 0.3) ** 0.7, 0.55 * bump(T, WINK, WINK + 0.14));
    ridgeWorld.copy(lab.pos(theo.pose.x, theo.pose.y + 0.12)).setY(0.44 * theo.pose.sy + theo.pose.lift);
    star.position.copy(ridgeWorld);
    starMat.opacity = sparkle;
    const big = T < WINK ? 1.15 : 0.6;
    star.scale.setScalar(0.1 + big * sparkle);
    starMat.rotation = T * 1.6;
  });

  // parts: eyes and Theo's glass
  const base = [3.2, 3.1, 2.9];
  theo.each = (m) => {
    const T = lab.t - t0;
    // chin up (leaning back over his back edge, local z = +0.22), so his ring stays flat on the glass
    m.body.rotation.x = chinUp;
    m.body.position.set(0, 0.22 * Math.sin(chinUp), 0.22 - 0.22 * Math.cos(chinUp));
    const shut = seg(T, BRACE, CONTACT - 0.04) * (1 - seg(T, FILL + 0.04, FILL + 0.12));
    const filled = bump(T, CONTACT, FILL + 0.24);
    const g = 1 - 0.85 * shut + 0.6 * fanOn + 3.2 * sparkle;
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
    // his glass: warm white as her light fills him, then the spectrum's colours shimmer through it as he glides
    const hue = (T * 0.9) % 1;
    if (T > CONTACT && T < ARRIVE + 0.2) {
      const shimmer = seg(T, FILL, FILL + 0.12) * (1 - seg(T, ARRIVE - 0.04, ARRIVE + 0.12));
      m.paint.emissive.setRGB(1, 0.92, 0.8).lerp(new THREE.Color().setHSL(hue, 1, 0.55), shimmer * 0.8).lerp(paint0.e, seg(T, ARRIVE, ARRIVE + 0.16));
      m.paint.emissiveIntensity = paint0.i + 1.3 * filled + 0.45 * shimmer;
    } else {
      m.paint.emissive.copy(paint0.e);
      m.paint.emissiveIntensity = paint0.i + 0.4 * sparkle;
    }
  };
  maya.each = (m) => {
    const T = lab.t - t0;
    // her eye: bright as she comes (a headlight), drained into him, a blink when it comes back
    const head = seg(T, 0.1, CONTACT);
    const drained = seg(T, CONTACT + 0.02, FILL + 0.06) * (1 - seg(T, ARRIVE + 0.02, ARRIVE + 0.08));
    const blink = bump(T, ARRIVE + 0.08, ARRIVE + 0.2);
    for (const e of mayaEyes) e.scale.set(1 - 0.85 * blink + 0.25 * head * (1 - drained) - 0.35 * drained, 1, 1);
    const g = (1 + 0.6 * head) * (1 - 0.94 * drained) + 0.5 * bump(T, ARRIVE + 0.18, ARRIVE + 0.4);
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };
  jun.each = (m) => {
    const T = lab.t - t0;
    const squint = seg(T, ARRIVE + 0.02, ARRIVE + 0.07) * (1 - seg(T, WINK + 0.05, END - 0.02));
    for (const e of junEyes) e.scale.set(1, 1 - 0.75 * squint, 1);
    const g = 1 + 0.4 * seg(T, UNROLL, UNROLL + 0.1) * (1 - seg(T, ARRIVE, ARRIVE + 0.04)) - 0.3 * squint;
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };

  lab.playCard('a', ['m2']);
  await lab.wait(END);
  stop();
  theo.each = null;
  maya.each = null;
  jun.each = null;
  theo.model.body.position.set(0, 0, 0);
  tPaint.emissive.copy(paint0.e);
  tPaint.emissiveIntensity = paint0.i;
  for (const e of [...mayaEyes, ...junEyes]) e.scale.set(1, 1, 1);
  fan.visible = false;
  land.visible = false;
  star.visible = false;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
  jun.release({ x: 6, y: 0, d: 3 });
}
