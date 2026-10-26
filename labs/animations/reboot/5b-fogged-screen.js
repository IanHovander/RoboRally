// Reboot, idea 44 through a character-acting lens: someone on the sofa breathes on the TV and doodles Maya back
// in. The robots are like fish in a tank when a finger touches the glass: Theo looks up at us and follows the
// finger; Maya, behind the fog, is drawn into being: her eye switches on the moment the dot is tapped, she
// flinches at each slip of the finger, and when the fog clears she looks up at the room as if to say thanks.
export const meta = {
  title: 'Fogged screen (drawn back in)',
  idea: 'A patch of the TV fogs milky over the empty token, like a breath on the glass. A fingertip wipes a wobbly circle through it, taps a dot for an eye (and through the dot, Maya\'s real eye blinks on), draws an arrow east and slips twice (two smudges: the 2 SPAM; she flinches each time, glimpsed grey through the wipe). The lines are clear picture, so her red shows through them. Theo noticed the finger: he tips his nose up at us and follows it like a fish at the aquarium glass. A drip runs from the bottom of the circle, the fog dries from its edges inward, and there she is, exactly under the doodle. She looks up at the room for a moment, then back to business.',
  notes: 'Sound: a soft breath "hhh" and a faint squeak of a finger on glass for each stroke (a little dry tap for the dot), two short skids for the smudges, then the quiet hiss of fog drying. Built in the DOM overlay: one div with a backdrop blur and a milky tint, masked by a soft ellipse minus the finger strokes (CSS radial-gradient dabs combined with mask-composite). The doodle is drawn from random wobble each time, so it\'s never quite the same drawing.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const RED = new THREE.Color('#ff4d6d');
  const GREY = new THREE.Color('#a9b2bd');

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const track = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) {
        const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * (ease[e ?? 'inOut'] ?? ease.inOut)(k);
      }
    }
    return keys[keys.length - 1][1];
  };
  const bump = (t, t0, rise, fall) => (t < t0 - rise || t > t0 + fall ? 0 : t < t0 ? ease.out(1 - (t0 - t) / rise) : 1 - ease.inOut((t - t0) / fall));

  // ---------- screen geometry (the doodle lives on the TV's glass, in CSS pixels) ----------
  const scr = (x, y, h = 0) => {
    const s = lab.toScreen(lab.pos(x, y).setY(h));
    return { x: s.x, y: s.y };
  };
  const C = scr(3, 1, 0.17); // the middle of her body
  const east = scr(4, 1, 0.17);
  const U = Math.hypot(east.x - C.x, east.y - C.y); // one space, in pixels
  const ex = { x: (east.x - C.x) / U, y: (east.y - C.y) / U }; // which way east is on screen
  const eyeAt = scr(3 + 0.17, 1, 0.33);

  // ---------- the strokes: [{ t0, t1, pts: [{x, y}] }] ----------
  const strokes = [];
  const add = (t0, t1, pts, w = 1) => strokes.push({ t0, t1, pts, w });
  // the body: a wobbly, not-quite-closed circle, started at the top and drawn anticlockwise (as people do)
  {
    const pts = [];
    const R = 0.36 * U;
    const ph = lab.range(0, 6);
    for (let i = 0; i <= 64; i++) {
      const k = i / 64;
      const a = -Math.PI / 2 - 0.35 - k * Math.PI * 2 * 1.06;
      const r = R * (1 + 0.07 * Math.sin(k * 7 + ph) + 0.05 * k);
      pts.push({ x: C.x + Math.cos(a) * r * 1.08 + k * 0.03 * U, y: C.y + Math.sin(a) * r * 0.92 - k * 0.02 * U });
    }
    add(0.5, 1.02, pts, 1);
  }
  // the eye: a little tap and twist
  {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      pts.push({ x: eyeAt.x + Math.cos(a) * 0.035 * U, y: eyeAt.y + Math.sin(a) * 0.03 * U });
    }
    add(1.1, 1.17, pts, 0.85);
  }
  // the arrow: a shaft east from her middle, past her nose, then the head
  const tip = { x: C.x + ex.x * 0.95 * U, y: C.y + ex.y * 0.95 * U - 0.03 * U };
  {
    const a = { x: C.x + ex.x * 0.12 * U, y: C.y + ex.y * 0.12 * U + 0.02 * U };
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const k = i / 14;
      pts.push({ x: a.x + (tip.x - a.x) * k, y: a.y + (tip.y - a.y) * k - Math.sin(k * Math.PI) * 0.03 * U });
    }
    add(1.24, 1.4, pts, 0.9);
    const head = (dy) => {
      const p = [];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        p.push({ x: tip.x - k * 0.2 * U, y: tip.y + k * dy * U });
      }
      return p;
    };
    add(1.43, 1.5, head(-0.17), 0.85);
    add(1.52, 1.59, head(0.16), 0.85);
  }
  // two slips of the finger (the 2 SPAM): short skids across her body
  const slip = (x0, y0, dx, dy, t0, t1) => {
    const p = [];
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      p.push({ x: C.x + (x0 + dx * k) * U, y: C.y + (y0 + dy * k + 0.02 * Math.sin(k * Math.PI)) * U });
    }
    add(t0, t1, p, 0.75);
  };
  const SLIP1 = 1.64;
  const SLIP2 = 1.77;
  slip(-0.25, 0.08, 0.15, 0.1, SLIP1, SLIP1 + 0.05);
  slip(0.02, 0.2, 0.17, 0.05, SLIP2, SLIP2 + 0.05);
  // a drip that runs down from the bottom of the circle, slowly, while the fog is drying
  {
    const p = [];
    for (let i = 0; i <= 10; i++) p.push({ x: C.x - 0.05 * U + Math.sin(i) * 0.008 * U, y: C.y + 0.36 * U + (i / 10) * 0.42 * U });
    add(1.8, 2.5, p, 0.42);
  }

  // ---------- the fog: a blurred, milky layer masked by a soft ellipse minus the strokes ----------
  const speck = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 900; i++) {
      const b = lab.rand() < 0.75;
      g.fillStyle = b ? `rgba(255,255,255,${lab.range(0.08, 0.35).toFixed(2)})` : `rgba(120,130,140,${lab.range(0.05, 0.2).toFixed(2)})`;
      g.beginPath();
      g.arc(lab.range(0, 128), lab.range(0, 128), lab.range(0.4, 1.6), 0, Math.PI * 2);
      g.fill();
    }
    return c.toDataURL();
  })();
  const fog = document.createElement('div');
  fog.style.cssText = [
    'position:absolute',
    'inset:0',
    'pointer-events:none',
    `background:url(${speck}) repeat, radial-gradient(ellipse ${(1.3 * U).toFixed(0)}px ${(1.0 * U).toFixed(0)}px at ${C.x.toFixed(0)}px ${C.y.toFixed(0)}px, rgba(232,237,242,.74), rgba(214,222,232,.56))`,
    'backdrop-filter:blur(7px) brightness(1.18) saturate(.55)',
    '-webkit-backdrop-filter:blur(7px) brightness(1.18) saturate(.55)',
    'mask-repeat:no-repeat',
    'mask-size:100% 100%',
  ].join(';');
  lab.overlay.append(fog);
  // a soft, out-of-focus fingertip on our side of the glass, lit by the TV
  const finger = document.createElement('div');
  const FW = 0.5 * U;
  finger.style.cssText = `position:absolute;left:0;top:0;width:${FW}px;height:${FW * 1.25}px;border-radius:50%;pointer-events:none;background:radial-gradient(ellipse at 45% 40%, rgba(255,226,214,.20), rgba(255,214,200,.10) 45%, rgba(255,214,200,0) 70%);filter:blur(6px);opacity:0`;
  lab.overlay.append(finger);

  const dabR = 0.072 * U;
  const maskFor = (t, fogRX, fogRY, dens, inner) => {
    const layers = [`radial-gradient(ellipse ${fogRX.toFixed(1)}px ${fogRY.toFixed(1)}px at ${C.x.toFixed(1)}px ${(C.y - 0.05 * U).toFixed(1)}px, rgba(0,0,0,${dens.toFixed(3)}) 0, rgba(0,0,0,${dens.toFixed(3)}) ${(inner * 100).toFixed(1)}%, rgba(0,0,0,0) 100%)`];
    let tipAt = null;
    for (const s of strokes) {
      if (t < s.t0) continue;
      const k = clamp01((t - s.t0) / (s.t1 - s.t0));
      const n = s.pts.length - 1;
      const upto = k * n;
      const r = dabR * s.w;
      // dabs every ~third of a dab radius along the drawn part
      for (let i = 0; i < n && i < upto; i++) {
        const a = s.pts[i];
        const b = s.pts[i + 1];
        const f = Math.min(1, upto - i);
        const len = Math.hypot(b.x - a.x, b.y - a.y) * f;
        const steps = Math.max(1, Math.ceil(len / (r * 0.45)));
        for (let j = 0; j <= steps; j++) {
          const q = (j / steps) * f;
          const x = a.x + (b.x - a.x) * q;
          const y = a.y + (b.y - a.y) * q;
          layers.push(`radial-gradient(circle ${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, #000 ${(r * 0.5).toFixed(1)}px, rgba(0,0,0,0) ${r.toFixed(1)}px)`);
        }
      }
      if (k < 1 && s.w > 0.5) {
        const i = Math.min(n - 1, Math.floor(upto));
        const f = upto - i;
        tipAt = { x: s.pts[i].x + (s.pts[i + 1].x - s.pts[i].x) * f, y: s.pts[i].y + (s.pts[i + 1].y - s.pts[i].y) * f };
      }
    }
    return { layers, tipAt };
  };

  // ---------- the actors ----------
  const theo = lab.puppet('b');
  const maya = lab.puppet('a');
  const theoRot = facing(3);
  theo.set({ x: 5, y: 2, rot: theoRot, trail: false });
  maya.set({ x: 3, y: 1, rot: facing(1), visible: false, trail: false });
  const mm = maya.model;
  let eye = null;
  mm.body.traverse((o) => {
    if (o.isMesh && o.material === mm.eyeMat) eye = o;
  });
  const eyeScale0 = eye.scale.clone();
  lab.cleanup(() => eye.scale.copy(eyeScale0));
  const mayaTag = lab.bot('a').tag;
  const st = { eye: 0, eyeOpen: 1, grey: 0, tag: 0, theoEye: 1 };
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).lerp(GREY.clone().multiplyScalar(0.8), st.grey).multiplyScalar(st.eye);
    eye.scale.set(eyeScale0.x * Math.max(0.05, st.eyeOpen), eyeScale0.y, eyeScale0.z);
    m.paint.emissive.copy(RED).lerp(GREY, st.grey);
    m.paint.emissiveIntensity = 0.16 + 0.8 * st.grey;
    if (mayaTag) mayaTag.visible = st.tag > 0.01;
    if (mayaTag) mayaTag.material.opacity = st.tag;
  };
  theo.each = (m) => {
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(st.theoEye);
  };

  // ---------- timeline ----------
  const FOG1 = 0.38; // fogged
  const CLEAR0 = 1.86; // starts drying
  const CLEAR1 = 2.56;
  const DOT = 1.13; // the eye is tapped
  const END = 2.86;
  let fingerAt = { x: C.x - 0.15 * U, y: C.y - 0.55 * U };
  const T0 = lab.t;
  const update = () => {
    const t = lab.t - T0;

    // the fog: a breath blooms out fast, then dries from its edges inward
    const bloom = ease.out(clamp01(t / FOG1));
    const dry = clamp01((t - CLEAR0) / (CLEAR1 - CLEAR0));
    const shrink = 1 - ease.inOut(dry);
    const rx = 1.35 * U * (0.35 + 0.65 * bloom) * (0.08 + 0.92 * shrink);
    const ry = 1.08 * U * (0.35 + 0.65 * bloom) * (0.08 + 0.92 * shrink);
    const dens = 0.97 * bloom * (1 - ease.in(clamp01((dry - 0.55) / 0.45)));
    const inner = 0.42 + 0.1 * bloom - 0.25 * dry;
    const { layers, tipAt } = maskFor(t, rx, ry, dens, inner);
    fog.style.maskImage = layers.join(',');
    fog.style.maskComposite = ['subtract', ...layers.slice(1).map(() => 'add')].join(',');
    fog.style.display = dens > 0.002 ? '' : 'none';
    // the fingertip: comes in before the first stroke, follows the strokes, leaves after the slips
    const fingerOn = track(t, [[0.4, 0], [0.5, 1], [SLIP2 + 0.05, 1], [SLIP2 + 0.2, 0]]);
    if (tipAt) fingerAt = tipAt;
    const fx = fingerAt.x;
    const fy = fingerAt.y;
    finger.style.transform = `translate(${(fx - FW * 0.45).toFixed(1)}px, ${(fy - FW * 0.25).toFixed(1)}px)`;
    finger.style.opacity = String(fingerOn);

    // ----- Maya, behind the fog -----
    const vis = t > 0.3;
    // drawn into being: her eye switches on when the dot is tapped (a blink, glimpsed through the dot)
    st.eye = t > DOT + 0.03 ? 1 : 0;
    st.eyeOpen = track(t, [[DOT + 0.03, 0.1], [DOT + 0.08, 1, 'out'], [DOT + 0.18, 1], [DOT + 0.22, 0.1, 'in'], [DOT + 0.29, 1, 'out']]);
    // each slip of the finger: she flinches, a grey flash
    st.grey = Math.max(bump(t, SLIP1 + 0.03, 0.02, 0.2), bump(t, SLIP2 + 0.03, 0.02, 0.2));
    let sy = 1 - 0.14 * bump(t, SLIP1 + 0.03, 0.02, 0.16) - 0.14 * bump(t, SLIP2 + 0.03, 0.02, 0.16);
    let roll = 0.12 * bump(t, SLIP1 + 0.03, 0.02, 0.16) - 0.1 * bump(t, SLIP2 + 0.03, 0.02, 0.16);
    // the arrow points east: she was a hair off; she nudges round to match it as it's drawn
    let rot = facing(1) + track(t, [[0.3, 0.22], [1.3, 0.22], [1.42, -0.05, 'out'], [1.52, 0, 'inOut']]);
    // revealed: she looks up at the room (a little "thanks"), then back to the game
    let pitch = track(t, [[2.3, 0], [2.42, -0.34, 'out'], [2.6, -0.34], [2.76, 0, 'inOut']]);
    sy *= 1 + 0.08 * track(t, [[2.3, 0], [2.42, 1, 'out'], [2.6, 1], [2.76, 0, 'inOut']]);
    st.tag = track(t, [[2.1, 0], [2.4, 1]]);
    maya.set({ visible: vis, sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy), roll, rot, pitch });

    // ----- Theo, the fish at the aquarium glass -----
    // he notices the fog, tips his nose up at us, and follows the finger
    const look = track(t, [[0.15, 0], [0.42, 1, 'out'], [CLEAR0 + 0.1, 1], [2.2, 0.3, 'inOut'], [2.45, 0, 'inOut']]);
    const follow = tipAt ? clamp01((tipAt.x - (C.x - 0.6 * U)) / (1.6 * U)) : 0.5;
    let tRot = look * (0.55 + 0.25 * (0.5 - follow));
    let tPitch = -0.32 * look;
    // a little startle at each slip, as if he felt it too
    tPitch -= 0.08 * bump(t, SLIP1 + 0.03, 0.02, 0.1) + 0.08 * bump(t, SLIP2 + 0.03, 0.02, 0.1);
    // then he looks at her, the real one, and back to business
    tRot += track(t, [[2.2, 0], [2.36, -0.4, 'out'], [2.6, -0.4], [END - 0.04, 0, 'inOut']]);
    st.theoEye = 1 + 0.4 * look;
    theo.set({ rot: theoRot + tRot, pitch: tPitch, lift: 0.025 * look });
  };
  const stop = lab.every(update);
  update();
  await lab.wait(END);
  stop();

  fog.remove();
  finger.remove();
  maya.each = null;
  theo.each = null;
  eye.scale.copy(eyeScale0);
  if (mayaTag) {
    mayaTag.visible = true;
    mayaTag.material.opacity = 1;
  }
  maya.set({ x: 3, y: 1, lift: 0, sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, rot: facing(1), visible: true });
  theo.set({ x: 5, y: 2, lift: 0, sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, rot: theoRot });
  maya.release({ x: 3, y: 1, d: 1, on: true });
  theo.release({ x: 5, y: 2, d: 3 });
}
