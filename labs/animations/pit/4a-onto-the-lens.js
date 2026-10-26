// Pit, idea 38 (Onto the lens), animator a: weight & physical comedy.
export const meta = {
  title: 'Onto the lens (splat, and slide)',
  idea:
    'Maya drives up to the hole, teeters on the rim nose-down and tail-up, and tips in. Cut: we are under the ' +
    'board, looking up at a ceiling of soft light with a black square in it, and Maya tumbles out of the square ' +
    'straight at us, eye wide, growing fast. SPLAT: she hits the lens. The whole picture jolts, her red light ' +
    'presses flat across the screen in her Pebble shape and wobbles like jelly, sticks for a beat... then slowly ' +
    'slides down the glass of the TV, leaving a streak, and drops off the bottom. Fade to dark, and cut back to ' +
    'the calm board, hole empty, as if nothing happened.',
  notes:
    'Sound: the drive and a wobbling "tink... tink" on the rim; at the cut a whoosh of air from below rising to a ' +
    'flat, close "THWAP" of something soft on glass (the loudest sound in the game, but short), a jelly wobble, a ' +
    'long rubbery squeak as she slides down the screen, and silence. Port: the underside is a texture painted from ' +
    'the board (its light, its seams, the pits as black squares, robots\' glows); the splat is HUD-layer DOM. Too ' +
    'big a moment to repeat every time: once a game, or for the first fall of the night.',
};

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (s, a, b) => clamp01((s - a) / (b - a));

const T = {
  windup: [0, 0.06],
  drive: [0.06, 0.66], // 0.96 -> the rim
  teeter: [0.66, 0.98],
  under: 1.02, // cut to underneath
  fall: [1.02, 1.5],
  splat: 1.5,
  stick: [1.5, 1.82],
  slide: [1.82, 2.36],
  dark: [2.2, 2.46],
  back: 2.56, // cut back to the board
  end: 2.86,
};
const Y = 1;
const PIT = 4;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export default async function play(lab) {
  const { THREE, ease, arena } = lab;
  const maya = lab.puppet('a');
  const b = maya.bot;
  const model = maya.model;
  const red = new THREE.Color(b.color);
  const course = arena.course;
  const W = course.w;
  const H = course.h;

  lab.playCard('a', ['m3']);

  // ---------- the underside of the board: a ceiling of soft light with the pit as a black square ----------
  const PX = 96;
  const cv = canvas(W * PX, H * PX);
  {
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient((W * PX) / 2, (H * PX) / 2, 0, (W * PX) / 2, (H * PX) / 2, W * PX * 0.62);
    grad.addColorStop(0, 'rgb(84,88,100)');
    grad.addColorStop(0.5, 'rgb(46,51,63)');
    grad.addColorStop(1, 'rgb(16,19,26)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W * PX, H * PX);
    // the seams, seen through the glass
    g.strokeStyle = 'rgba(0,0,0,.12)';
    g.lineWidth = 1.5;
    for (let x = 1; x < W; x++) {
      g.beginPath();
      g.moveTo(x * PX, 0);
      g.lineTo(x * PX, H * PX);
      g.stroke();
    }
    for (let y = 1; y < H; y++) {
      g.beginPath();
      g.moveTo(0, y * PX);
      g.lineTo(W * PX, y * PX);
      g.stroke();
    }
    // the other robots' light, through the glass
    for (const [key, r] of Object.entries(lab.scenario.bots)) {
      if (key === 'a') continue;
      const cx = (r.x + 0.5) * PX;
      const cy = (r.y + 0.5) * PX;
      const gl = g.createRadialGradient(cx, cy, 0, cx, cy, PX * 0.8);
      const c = new THREE.Color(r.color);
      const rgb = `${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0}`;
      gl.addColorStop(0, `rgba(${rgb},.85)`);
      gl.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gl;
      g.fillRect(cx - PX, cy - PX, PX * 2, PX * 2);
    }
    // the pits: holes, no light at all
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (course.cells[y * W + x]?.k !== 'pit') continue;
        g.fillStyle = '#000';
        g.fillRect(x * PX + 2, y * PX + 2, PX - 4, PX - 4);
        // the glass's cut edge catches the light
        g.strokeStyle = 'rgba(255,238,215,.7)';
        g.lineWidth = 3;
        g.strokeRect(x * PX + 1, y * PX + 1, PX - 2, PX - 2);
      }
    }
  }
  const ceilTex = new THREE.CanvasTexture(cv);
  ceilTex.colorSpace = THREE.SRGBColorSpace;
  ceilTex.flipY = false; // seen from below: canvas rows run north -> south
  const ceilGeo = new THREE.PlaneGeometry(W, H);
  ceilGeo.rotateX(Math.PI / 2); // facing down; texture rows run north -> south as on the board
  const ceiling = new THREE.Mesh(ceilGeo, new THREE.MeshBasicMaterial({ map: ceilTex, color: new THREE.Color(1.25, 1.2, 1.12) }));
  ceiling.position.y = -0.372;
  ceiling.visible = false;
  lab.add(ceiling);
  // the glow of her eye, for when she's coming at us
  const glowCv = canvas(128, 128);
  {
    const g = glowCv.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,.55)');
    grad.addColorStop(0.55, 'rgba(255,255,255,.1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const glowTex = new THREE.CanvasTexture(glowCv);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.6, 1.55, 1.45), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  eyeGlow.position.set(0, 0.255, -0.13);
  model.body.add(eyeGlow);
  lab.cleanup(() => {
    model.body.remove(eyeGlow);
    ceilTex.dispose();
    glowTex.dispose();
  });

  // ---------- the splat: on the screen itself (the HUD layer) ----------
  const ov = lab.overlay;
  const mk = (css) => {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;pointer-events:none;${css}`;
    ov.append(el);
    return el;
  };
  const NS = 'http://www.w3.org/2000/svg';
  const pebblePath = 'M0,-0.29 C0.11,-0.29 0.31,0.12 0.29,0.22 C0.27,0.31 0.13,0.33 0,0.29 C-0.13,0.33 -0.27,0.31 -0.29,0.22 C-0.31,0.12 -0.11,-0.29 0,-0.29 Z';
  const streak = mk('left:50%;top:0;width:0;height:0;opacity:0;transform:translateX(-50%);border-radius:40%;filter:blur(10px);mix-blend-mode:screen;');
  const splat = mk('left:50%;top:50%;width:0;height:0;opacity:0;mix-blend-mode:screen;transform-origin:0 0;');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-0.5 -0.5 1 1');
  svg.style.cssText = 'position:absolute;left:-50%;top:-50%;width:100%;height:100%;overflow:visible';
  svg.innerHTML =
    `<defs><radialGradient id="lensR" cx="0" cy="0.04" r="0.42" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#ffd2da"/><stop offset="0.45" stop-color="#ff6d88"/><stop offset="1" stop-color="#d8203f"/></radialGradient>` +
    `<filter id="lensB" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.022"/></filter>` +
    `<filter id="lensG" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="0.07"/></filter></defs>` +
    `<path d="${pebblePath}" transform="scale(1.32)" fill="#ff4d6d" opacity="0.65" filter="url(#lensG)"/>` +
    `<ellipse cx="0" cy="0.01" rx="0.47" ry="0.44" fill="none" stroke="#ff7590" stroke-width="0.022" opacity="0.9" filter="url(#lensB)"/>` +
    `<path d="${pebblePath}" transform="scale(1.18)" fill="url(#lensR)" filter="url(#lensB)"/>` +
    `<rect x="-0.11" y="-0.13" width="0.22" height="0.05" rx="0.025" fill="#fff8ec" filter="url(#lensB)"/>`;
  splat.append(svg);
  const dark = mk('inset:0;background:#000;opacity:0;');
  const canvasEl = lab.renderer.domElement;
  const css0 = canvasEl.style.transform;
  lab.cleanup(() => (canvasEl.style.transform = css0));

  // ---------- Maya's light ----------
  let eye = 1;
  let under = false;
  let cardFade = 1;
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * eye, 3.1 * eye, 2.9 * eye);
    if (under) {
      m.paint.emissiveIntensity = 0.75; // lit from her own colour; the room's light is above the board
      m.ringMat.opacity = 0.5;
      m.poolMat.opacity = 0;
    }
    if (b.card) {
      b.card.position.y -= Math.min(0, maya.pose.lift);
      b.card.material.opacity *= cardFade;
    }
  };

  // ---------- the camera ----------
  const saved = arena.camCur ? { ...arena.camCur, tgt: arena.camCur.tgt.clone() } : null;
  const below = lab.pos(PIT, Y).setY(-0.372);
  const EL = -1.28;
  const AZ = Math.PI / 2; // under the board's east side, looking up and back at the hole
  const DIST = 1.9;
  const camPos = new THREE.Vector3(below.x + Math.sin(AZ) * Math.cos(EL) * DIST, below.y + Math.sin(EL) * DIST, below.z + Math.cos(AZ) * Math.cos(EL) * DIST);
  let releaseCam = null;

  const t0 = lab.t;
  let cutDone = false;
  let splatted = false;
  let backDone = false;
  const stop = lab.every((dt, now) => {
    const s = now - t0;
    const pose = { x: 1, y: Y, lift: 0, pitch: 0, roll: 0, rot: lab.facing(1), sx: 1, sy: 1, sz: 1, trail: true, visible: true };
    if (s < T.drive[0]) {
      const k = seg(s, ...T.windup);
      pose.x = 1 - 0.04 * Math.sin(k * Math.PI * 0.5);
    } else if (s < T.drive[1]) {
      const k = seg(s, ...T.drive);
      pose.x = lerp(0.96, 3.46, 0.3 * k * k + 0.7 * k);
    } else if (s < T.under) {
      // over the edge: nose down, tail up, balanced on the rim... wobble... tip
      const k = seg(s, ...T.teeter);
      const kk = s - T.teeter[0];
      const wob = 0.42 + 0.16 * Math.sin(kk * 26) * Math.exp(-kk * 5);
      const tip = ease.in3(seg(s, T.teeter[0] + 0.2, T.under));
      pose.x = 3.46 + 0.12 * (1 - Math.exp(-kk * 12)) + 0.18 * tip;
      pose.pitch = wob + 1.0 * tip;
      pose.lift = -0.06 * Math.sin(Math.min(1, kk * 6) * Math.PI * 0.5) - 0.45 * tip;
      pose.trail = false;
      eye = 1 + 0.6 * k;
    } else if (s < T.splat) {
      // underneath: she drops out of the hole straight at us, tumbling, eye wide
      if (!cutDone) {
        cutDone = true;
        under = true;
        ceiling.visible = true;
        releaseCam = lab.camera(() => ({ target: below.clone().add(new THREE.Vector3(0, -0.15, 0)), az: AZ, el: EL, dist: DIST, fov: 52 }));
        lab.timeScale = 1;
      }
      const k = seg(s, ...T.fall);
      const g = k * k * 0.82 + 0.02 * k; // gravity: slow out of the hole, fast at us
      const start = lab.pos(PIT, Y).setY(-0.32);
      const p = start.clone().lerp(camPos, g);
      // world -> pose: x/y in spaces, lift in world units
      pose.x = PIT + (p.x - start.x);
      pose.lift = p.y;
      pose.trail = false;
      pose.pitch = lerp(1.25, Math.PI / 2 - EL, ease.out(k)); // tumbling round to face us
      pose.roll = 0.25 * Math.sin(k * 3);
      eye = 1.6 + 1.2 * k;
      eyeGlow.material.opacity = 0.3 + 0.7 * k;
      eyeGlow.scale.setScalar(0.18 + 0.22 * k);
      cardFade = 0;
    } else {
      pose.visible = false;
      pose.trail = false;
      pose.lift = -3;
      eyeGlow.material.opacity = 0;
    }
    maya.set(pose);

    // --- the splat on the lens ---
    const r = ov.getBoundingClientRect();
    const SH = r.height;
    if (s >= T.splat && s < T.back) {
      if (!splatted) {
        splatted = true;
        lab.shake(0.06, 0.3);
      }
      const ks = s - T.splat;
      // it lands a touch too big and slaps flat; jelly wobble
      const land = Math.exp(-ks * 16);
      const jelly = Math.exp(-ks * 7) * Math.sin(ks * 38);
      let sx = 1 + 0.18 * land + 0.08 * jelly;
      let sy = 1 + 0.1 * land - 0.08 * jelly;
      // the slide: sticks, then gravity wins
      const kl = seg(s, ...T.slide);
      const drop = ease.in3(kl) * 0.95 + 0.04 * kl;
      sy *= 1 + 0.18 * kl; // smeared longer as it slides
      sx *= 1 - 0.06 * kl;
      const size = SH * 1.3;
      const cy = 0.5 * SH + drop * SH * 1.05;
      splat.style.opacity = String(1 - 0.35 * kl);
      splat.style.width = `${size}px`;
      splat.style.height = `${size}px`;
      splat.style.left = `${r.width / 2}px`;
      splat.style.top = `${cy}px`;
      splat.style.transform = `rotate(180deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
      // the streak it leaves on the glass
      const top = 0.5 * SH - size * 0.18;
      streak.style.opacity = String(kl > 0 ? 0.55 * (1 - 0.5 * kl) : 0);
      streak.style.top = `${top}px`;
      streak.style.height = `${Math.max(0, cy - top)}px`;
      streak.style.width = `${size * 0.5}px`;
      streak.style.background = 'linear-gradient(to bottom, rgba(255,77,109,0), rgba(255,77,109,.5) 55%, rgba(255,120,140,.8))';
      // the TV's glass flexes
      const flex = Math.exp(-ks * 9) * Math.cos(ks * 30);
      canvasEl.style.transform = `translateY(${(flex * SH * 0.012).toFixed(2)}px) scale(${(1 + 0.018 * flex).toFixed(4)})`;
      dark.style.opacity = String(ease.inOut(seg(s, ...T.dark)));
    }
    if (s >= T.back && !backDone) {
      // cut: the calm board, from the usual camera, as if nothing happened
      backDone = true;
      under = false;
      ceiling.visible = false;
      releaseCam?.();
      releaseCam = null;
      if (saved) arena.camCur = { ...saved, tgt: saved.tgt.clone() };
      lab.camera3.fov = 30;
      lab.camera3.updateProjectionMatrix();
      canvasEl.style.transform = css0;
      for (const el of [splat, streak, dark]) el.style.opacity = '0';
    }
  });

  await lab.wait(T.end);
  stop();
  maya.release({ on: false });
}
