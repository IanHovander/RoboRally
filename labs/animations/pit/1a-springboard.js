// Pit, idea 19 (Evel Knievel), animator a: weight & physical comedy.
export const meta = {
  title: 'Springboard (and the floor cheats)',
  idea:
    'A ramp of light twangs up out of the glass like a diving board; Maya bends it with her weight, launches, ' +
    'clears the hole and lands nose-then-tail with a squash and a flare of her ring. The black square takes a ' +
    'tiny sneaky wind-up and yanks itself one space east under her like a rug; she rocks back on her heels. ' +
    'She hangs over nothing for a beat, looks down, eye wide... and drops. Then the hole strolls home to (4,1), ' +
    'glints innocently, and the ramp folds back into the glass.',
  notes:
    'Sound: a rising glass "twang" as the ramp springs up, a wobbling "boing" as it flexes, a two-note clink ' +
    '(nose, tail) on the landing, a soft bright chime for the ring flare, then a quick glassy zip for the rug pull ' +
    'and nothing at all for the drop; a tiny high "ting" on the glint. Port: the fake hole is a black plane over ' +
    'the glass plus a patch of the board\'s own glass material over the real pit; both go away when the hole is ' +
    'home, so the board ends exactly as built. The ramp always sits on the space before the pit along the path.',
};

const TAU = Math.PI * 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (s, a, b) => clamp01((s - a) / (b - a)); // 0..1 progress of s through [a, b]

// the timeline (scene seconds from the start of the moment)
const T = {
  windup: [0.0, 0.12],
  drive: [0.12, 0.66], // to the foot of the ramp
  rampUp: 0.3, // the ramp flicks up (0.2 s)
  climb: [0.66, 0.78], // up the ramp
  air: [0.78, 1.26], // the jump
  land: 1.26,
  skid: [1.26, 1.5],
  proud: [1.5, 1.86], // the beat: chest out
  holeWind: [1.86, 1.96], // the hole's sneaky wind-up (west)
  yank: [1.96, 2.16], // the rug pull (east)
  drop: 2.1, // her support is gone
  hang: 0.15, // over nothing, she hasn't noticed yet... then she has
  home: [2.64, 3.04], // the hole strolls back
  glint: [3.02, 3.32],
  rampDown: [3.07, 3.32],
  end: 3.36,
};

const HINGE = 2.82; // where the ramp is hinged on (3,1)
const RIM = 3.5; // the near rim of the pit
const RAMP_LEN = RIM - HINGE;
const RAMP_ANGLE = 0.52; // about 30 degrees
const LAND_X = 4.86;

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const m = maya.model;
  const b = maya.bot;
  const ring = m.group.children.find((o) => o.material === m.ringMat && o.geometry?.type === 'RingGeometry');
  const warm = new THREE.Color(lab.PALETTE.light);
  const red = new THREE.Color(b.color);

  lab.playCard('a', ['m3']);

  // ---------- the ramp of light ----------
  const rampTex = canvasTex(THREE, 256, 160, (g, w, h) => {
    g.fillStyle = 'rgba(255,244,228,0.16)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,244,228,0.9)';
    g.lineWidth = 5;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = 'rgba(255,250,240,1)';
    g.fillRect(w - 14, 0, 14, h); // the lip (the high end) is brightest
    g.strokeStyle = 'rgba(255,244,228,0.35)';
    g.lineWidth = 3;
    for (const f of [0.3, 0.52, 0.74]) {
      g.beginPath();
      g.moveTo(f * w, 10);
      g.lineTo(f * w, h - 10);
      g.stroke();
    }
  });
  const rampMat = new THREE.MeshBasicMaterial({ map: rampTex, color: warm.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const pivot = new THREE.Group();
  pivot.position.copy(lab.pos(HINGE, 1)).setY(0.004); // the hinge line (pos() takes the same units as a pose)
  const plateGeo = new THREE.PlaneGeometry(RAMP_LEN, 0.5);
  plateGeo.rotateX(-Math.PI / 2);
  plateGeo.translate(RAMP_LEN / 2, 0, 0);
  const plate = new THREE.Mesh(plateGeo, rampMat);
  plate.renderOrder = 4;
  pivot.add(plate);
  lab.add(pivot);
  // its slot in the glass: a faint outline where it lies when it's down
  const slotTex = canvasTex(THREE, 256, 160, (g, w, h) => {
    g.strokeStyle = 'rgba(255,244,228,1)';
    g.lineWidth = 4;
    g.strokeRect(4, 4, w - 8, h - 8);
  });
  const slotMat = new THREE.MeshBasicMaterial({ map: slotTex, color: warm.clone().multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const slot = new THREE.Mesh(plateGeo.clone(), slotMat);
  slot.position.copy(pivot.position).setY(0.003);
  lab.add(slot);

  // ---------- the hole that moves ----------
  // a patch of the board's own glass (the space just south of the pit, which has no pit next to it) laid over the
  // real hole, and a black square above the glass that plays the hole while it moves
  const W = arena.course.w;
  const H = arena.course.h;
  const patchGeo = new THREE.PlaneGeometry(1, 1);
  const src = [4, 2];
  const uv = patchGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (src[0] + uv.getX(i)) / W, 1 - (src[1] + 1) / H + uv.getY(i) / H);
  const patchMat = arena.topMat.clone();
  const patch = new THREE.Mesh(patchGeo, patchMat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.copy(lab.pos(4, 1)).setY(0);
  patch.receiveShadow = true;
  patch.visible = false;
  lab.add(patch);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), holeMat);
  hole.rotation.x = -Math.PI / 2;
  hole.visible = false;
  lab.add(hole);
  const placeHole = (x) => {
    hole.position.copy(lab.pos(x, 1)).setY(0.002);
  };
  placeHole(4);

  // ---------- the glint ----------
  const starTex = canvasTex(THREE, 128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fff';
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      g.beginPath();
      g.moveTo(64 - dx * 62, 64 - dy * 62);
      g.lineTo(64 + dy * 5, 64 + dx * 5);
      g.lineTo(64 + dx * 62, 64 + dy * 62);
      g.lineTo(64 - dy * 5, 64 - dx * 5);
      g.closePath();
      g.fill();
    }
  });
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: warm.clone().multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  star.renderOrder = 30;
  const corner = lab.pos(4, 1).add(new THREE.Vector3(0.47, 0.03, -0.47)); // the hole's far right corner
  star.position.copy(corner);
  star.scale.setScalar(0.001);
  lab.add(star);

  lab.cleanup(() => {
    rampTex.dispose();
    slotTex.dispose();
    starTex.dispose();
    patchMat.dispose();
  });

  // ---------- Maya's light, each frame ----------
  let flare = 0; // her ring's flare of triumph, 0..1
  let look = 0; // her eye, wide, when she sees what's under her
  let cardFade = 1;
  maya.each = (model) => {
    model.ringMat.color.copy(red).multiplyScalar(1.6 + 2.0 * flare);
    model.ringMat.opacity = Math.min(1, 0.9 + flare);
    if (ring) ring.scale.setScalar(1 + 0.32 * flare);
    model.poolMat.opacity = 0.75 + 0.35 * flare;
    model.eyeMat.color.setRGB(3.2 + 2 * flare + 3 * look, 3.1 + 2 * flare + 3 * look, 2.9 + 2 * flare + 3 * look);
    if (b.card) {
      b.card.position.y -= Math.min(0, maya.pose.lift); // the card doesn't dive in after her
      b.card.material.opacity *= cardFade;
    }
  };

  // ---------- the whole moment as a function of time ----------
  const t0 = lab.t;
  let rampAngle = 0;
  let fall = null; // when she starts to fall
  const stop = lab.every((dt, now) => {
    const s = now - t0;
    // --- the ramp: flicks up with a springy overshoot, bends under her, twangs after she leaves ---
    const up = seg(s, T.rampUp, T.rampUp + 0.2);
    let angle = RAMP_ANGLE * (up <= 0 ? 0 : ease.outBack(up, 2.6));
    if (s >= T.climb[0] && s < T.air[0]) angle -= 0.14 * Math.sin(seg(s, T.climb[0], T.air[0]) * Math.PI * 0.5); // her weight
    if (s >= T.air[0]) {
      const k = s - T.air[0];
      angle -= 0.14 * Math.cos(k * 42) * Math.exp(-k * 7); // twang
    }
    const down = seg(s, T.rampDown[0], T.rampDown[1]);
    if (down > 0) angle *= 1 - ease.in(down);
    rampAngle = angle;
    pivot.rotation.z = angle;
    rampMat.opacity = clamp01(up * 3) * (1 - down);
    slotMat.opacity = 0.35 * clamp01(up * 4) * (1 - clamp01((down - 0.6) / 0.4));

    // --- Maya ---
    const pose = { x: 1, lift: 0, pitch: 0, sx: 1, sy: 1, sz: 1, trail: true };
    if (s < T.windup[1]) {
      const k = seg(s, ...T.windup);
      pose.x = 1 - 0.07 * Math.sin(k * Math.PI * 0.5);
      pose.pitch = -0.14 * Math.sin(k * Math.PI * 0.5);
    } else if (s < T.drive[1]) {
      // accelerating hard toward the ramp: a rocket of a start
      const k = seg(s, ...T.drive);
      pose.x = lerp(0.93, HINGE, 0.35 * k + 0.65 * k * k);
      pose.pitch = lerp(-0.14, -0.05, Math.min(1, k * 3));
    } else if (s < T.climb[1]) {
      const k = seg(s, ...T.climb);
      pose.x = lerp(HINGE, RIM, k);
      pose.lift = (pose.x - HINGE) * Math.tan(rampAngle);
      pose.pitch = -rampAngle * 0.9;
      pose.sy = 1 - 0.12 * Math.sin(k * Math.PI); // pressing into the board
      pose.sx = pose.sz = 1 + 0.08 * Math.sin(k * Math.PI);
    } else if (s < T.land) {
      // the jump: a parabola leaving at the ramp's angle
      const k = seg(s, ...T.air);
      const h0 = RAMP_LEN * Math.tan(RAMP_ANGLE - 0.14);
      const span = LAND_X - RIM;
      const a = Math.tan(RAMP_ANGLE - 0.05) * span;
      const bq = h0 + a;
      pose.x = lerp(RIM, LAND_X, k);
      pose.lift = Math.max(0, h0 + a * k - bq * k * k);
      const slope = (a - 2 * bq * k) / span;
      pose.pitch = -0.62 * Math.atan(slope) + 0.12 * k; // nose up, then over, nose down
      pose.sy = 1 + 0.12 * Math.sin(k * Math.PI); // stretched in flight
      pose.sx = pose.sz = 1 - 0.06 * Math.sin(k * Math.PI);
      pose.trail = false; // no trail through the air
    } else {
      pose.trail = false;
      // landing: nose first, then the tail slaps down; she skids to the middle of (5,1)
      const ks = seg(s, ...T.skid);
      pose.x = lerp(LAND_X, 5, ease.out(ks));
      const kl = s - T.land;
      const slap = clamp01(kl / 0.06);
      pose.pitch = lerp(0.42, 0, ease.in(slap)) - 0.1 * Math.sin(clamp01((kl - 0.06) / 0.22) * Math.PI) * (1 - clamp01((kl - 0.28) / 0.1));
      const sq = kl < 0.06 ? 0.15 * slap : 0.38 * Math.exp(-(kl - 0.06) * 9) * Math.cos((kl - 0.06) * 26);
      pose.sy = 1 - sq;
      pose.sx = pose.sz = 1 + sq * 0.7;
      // the beat: chest out
      const kp = seg(s, ...T.proud);
      if (kp > 0 && s < T.yank[0]) {
        pose.sy *= 1 + 0.07 * Math.sin(kp * Math.PI * 0.5);
        pose.pitch -= 0.06 * Math.sin(kp * Math.PI * 0.5);
      }
    }
    flare = s < T.land ? 0 : Math.max(0, 1 - (s - T.land - 0.04) / 0.7) ** 1.3 * clamp01((s - T.land) / 0.05);

    // --- the hole ---
    let hx = 4;
    if (s >= T.holeWind[0] && s < T.yank[0]) hx = 4 - 0.07 * ease.out(seg(s, ...T.holeWind));
    else if (s >= T.yank[0] && s < T.home[0]) {
      const k = seg(s, T.yank[0], T.yank[1]);
      hx = lerp(3.93, 5, ease.in3(k));
      if (k >= 1) hx = 5 + 0.06 * Math.sin(clamp01((s - T.yank[1]) / 0.14) * Math.PI) * Math.exp(-(s - T.yank[1]) * 6);
    } else if (s >= T.home[0]) hx = lerp(5, 4, ease.inOut(seg(s, ...T.home)));
    const moving = s >= T.holeWind[0] && s < T.home[1];
    hole.visible = patch.visible = moving;
    placeHole(hx);
    patchMat.emissiveIntensity = arena.topMat.emissiveIntensity;

    // --- losing the floor: she tips back as the edge passes under her, then drops like a stone ---
    if (s >= T.yank[0]) {
      const edge = hx + 0.5; // the hole's leading edge, in spaces
      const under = clamp01((edge - 4.68) / 0.64); // how much of her base is over nothing
      if (!fall && under >= 0.98) fall = now;
      pose.pitch += -0.5 * ease.in(under);
      pose.x -= 0.05 * under;
      if (fall) {
        // the hang: hovering over the hole, she looks down at it (eye wide), and only then drops
        const kh = clamp01((now - fall) / T.hang);
        pose.pitch += 0.42 * Math.sin(kh * Math.PI * 0.5) - 0.42 * clamp01((now - fall - T.hang) / 0.08);
        pose.roll = 0.03 * Math.sin((now - fall) * 60) * kh;
        look = kh < 1 ? Math.sin(kh * Math.PI * 0.5) : Math.max(0, 1 - (now - fall - T.hang) / 0.1);
        const k = Math.max(0, now - fall - T.hang);
        pose.lift = -0.5 * 15 * k * k;
        pose.sy = 1 + Math.min(0.28, k * 1.6); // stretched by the drop
        pose.sx = pose.sz = 1 - Math.min(0.12, k * 0.7);
        pose.pitch += -0.4 * k;
        cardFade = Math.max(0, 1 - k / 0.18);
      }
    }
    pose.visible = pose.lift > -0.75;
    maya.set(pose);

    // --- the innocent glint, once the hole is home ---
    const kg = seg(s, ...T.glint);
    const glint = kg > 0 && kg < 1 ? Math.sin(kg * Math.PI) : 0;
    star.material.opacity = glint;
    star.scale.setScalar(0.001 + 0.42 * glint);
    star.material.rotation = kg * 1.2;
  });

  await lab.wait(T.end);
  stop();
  hole.visible = patch.visible = false;
  maya.release({ on: false });
  void TAU;
}
