// Drive, idea 4 (ribbon), animator c: the trail as a long-exposure light painting with a ribbon's physics.
// Maya's trail becomes a thin twisting ribbon of light tied to the back of her ring. Move 2 lays it out
// straight. Rotate Right flicks a quarter curl of it out beside her, smeared like a fast stroke in a long
// exposure; Move Back tugs the curl taut and a crack of light runs down its whole length like a whip. The U-Turn
// whips it once and a half round her ring in a blur and it pulls tight into a bow at her feet, sealed with a
// star-filter glint, and then the whole painting fades on the trail's usual schedule.
export const meta = {
  title: 'Light-painted ribbon',
  idea:
    "Maya's trail is a thin twisting ribbon of light tied to her ring, drawn like a long-exposure light painting. Move 2 lays it out straight; Rotate Right flicks a curl of it out beside her, smeared like a fast stroke; Move Back tugs the curl taut and a crack of light runs down its whole length like a whip. The U-Turn whips it once and a half round her ring in a blur and it pulls tight into a little bow at her feet with a star glint, then the whole painting fades on the trail's usual schedule.",
  notes:
    'Everyday: no added time (the cards keep the game\'s pace) and no camera move; the touches are the stroke smear, the whip-crack of light and the glint. Anyone looking up late reads "she turned here" off the curl or the bow. Sound: a soft silk "fwip" for the flick, a light glass tick as it pulls taut with a short shimmer running down the length, and a tiny two-note chime for the bow. Porting: replaces updateTrail for a robot; the ribbon is the trail\'s points plus procedural curls generated from each turn (a quarter curl per 90 degrees, a loop and bow for a U-Turn), straightened by the next move.',
};

const TAU = Math.PI * 2;
const LIFE = 3.2; // the game's trail life
const R0 = 0.62; // the ribbon wraps just outside her ring

function stripTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(0.7, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  for (const h of [true, false]) {
    const grad = h ? g.createLinearGradient(0, 0, 256, 0) : g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    if (h) g.fillRect(0, 125, 256, 6);
    else g.fillRect(125, 0, 6, 256);
  }
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 34);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(90, 90, 76, 76);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A flat strip of light on the glass along a polyline: draw([{ x, z, w, g }]) (half-width, gain). */
function makeStrip(THREE, n, color, tex) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 6);
  const col = new Float32Array(n * 6);
  const uv = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) uv.set([0, 0.5, 1, 0.5], i * 4);
  const idx = [];
  for (let i = 0; i < n - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setDrawRange(0, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  const c = new THREE.Color(color);
  mesh.draw = (pts, y = 0.012) => {
    const m = Math.min(n, pts.length);
    if (m < 2) return geo.setDrawRange(0, 0);
    const off = pts.length - m;
    for (let i = 0; i < m; i++) {
      const p = pts[off + i];
      const q = pts[off + Math.min(m - 1, i + 1)];
      const o = pts[off + Math.max(0, i - 1)];
      let dx = q.x - o.x;
      let dz = q.z - o.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      pos.set([p.x - dz * p.w, y, p.z + dx * p.w, p.x + dz * p.w, y, p.z - dx * p.w], i * 6);
      const k = p.g;
      col.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, (m - 1) * 6);
  };
  return mesh;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const end = lab.scenario.after.a;
  const maya = lab.puppet('a');
  maya.set({ trail: false }); // the ribbon replaces her trail
  const color = new THREE.Color(maya.bot.color).lerp(new THREE.Color('#ffffff'), 0.12);
  const tex = stripTexture(THREE);
  const ribbon = lab.add(makeStrip(THREE, 600, color, tex));
  const echoes = [0, 1, 2, 3].map(() => lab.add(makeStrip(THREE, 300, color, tex)));
  const bow = lab.add(makeStrip(THREE, 200, color, tex));
  const glint = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(THREE), color: new THREE.Color('#fff3e6').multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false })));
  glint.renderOrder = 40;

  const dir = (deg) => {
    const a = (deg * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
  };
  const centre = () => lab.pos(maya.pose.x, maya.pose.y);
  const heading = () => (-maya.pose.rot * 180) / Math.PI; // compass degrees
  const tie = () => centre().add(dir(heading() + 180).multiplyScalar(R0 - 0.08));

  // ---- the ribbon's state ----
  const rec = []; // laid-down points { x, z, t }
  let phase = 'lay';
  let curlAmp = 0;
  let W = null; // where the curl starts (pinned on the glass)
  let taut = 0;
  let shiverT = -9;
  let pulseT = -9;
  let sweep = 0; // U-Turn: degrees of loop wound so far
  let sweepT0 = 0;
  let bowK = 0;
  let bowAt = null;
  let echoK = 0;
  const history = []; // the procedural tail's last few frames, for the stroke smear
  let frozenTail = null; // after the moment: the tail as it was left

  const layPoint = (p, t) => {
    const last = rec[rec.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.025) rec.push({ x: p.x, z: p.z, t });
  };

  // the procedural part of the ribbon (the curl, or the loop), from the end of `rec` to her tie point
  const buildTail = (now) => {
    const out = [];
    const C = centre();
    if (phase === 'curl' || phase === 'tug') {
      const h = heading();
      const a0 = 270;
      const a1 = h + 180 > a0 ? h + 180 : a0;
      const N = 40;
      const arc0 = C.clone().add(dir(a0).multiplyScalar(R0 - 0.08));
      const T = tie();
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const a = a0 + (Math.max(a1, a0 + 1) - a0) * u;
        const r = R0 - 0.08 + curlAmp * Math.sin(Math.PI * u) ** 0.8;
        let p = C.clone().add(dir(a).multiplyScalar(r));
        // the first end stays pinned where the ribbon met the glass
        p.add(W.clone().sub(arc0).multiplyScalar(1 - u));
        if (taut > 0) {
          const s = W.clone().lerp(T, u);
          p.lerp(s, taut);
        }
        // the shiver: a travelling wave, pinned at both ends, dying away
        const st = now - shiverT;
        if (st > 0 && st < 0.6) {
          const d = T.clone().sub(W);
          const perp = new THREE.Vector3(-d.z, 0, d.x).normalize();
          p.add(perp.multiplyScalar(0.07 * Math.exp(-st * 7) * Math.sin(u * Math.PI * 5 - st * 45) * Math.sin(Math.PI * u)));
        }
        out.push({ x: p.x, z: p.z, t: now });
      }
    } else if (phase === 'loop') {
      // from her old tie point (north), clockwise round her ring, spiralling in a hair
      const N = Math.max(2, Math.round(sweep / 6));
      for (let i = 0; i <= N; i++) {
        const a = (sweep * i) / N;
        const r = R0 + 0.05 - (0.07 * a) / 540;
        const p = C.clone().add(dir(a).multiplyScalar(r));
        out.push({ x: p.x, z: p.z, t: sweepT0 + (a / 540) * 0.4 });
      }
    }
    return out;
  };

  const draw = () => {
    const now = lab.t;
    if (phase === 'lay') layPoint(tie(), now);
    const tail = frozenTail ?? buildTail(now);
    const all = rec.concat(tail);
    // gains: the trail's fade, the twist of the ribbon, the whip-crack pulse
    let s = 0;
    const pts = [];
    const total = (() => {
      let L = 0;
      for (let i = 1; i < all.length; i++) L += Math.hypot(all[i].x - all[i - 1].x, all[i].z - all[i - 1].z);
      return L;
    })();
    const pulse = now - pulseT;
    const pulseAt = total - (pulse / 0.32) * total; // runs from her end back to the tail
    for (let i = 0; i < all.length; i++) {
      if (i > 0) s += Math.hypot(all[i].x - all[i - 1].x, all[i].z - all[i - 1].z);
      const p = all[i];
      const age = Math.max(0, (now - p.t) / LIFE);
      const fade = Math.max(0, 1 - age) ** 1.6 * Math.min(1, i / 4);
      const tw = Math.abs(Math.cos(s * 2.6 + now * 1.5));
      let g = fade * (1.3 + 1.3 * tw);
      if (pulse > 0 && pulse < 0.4) g += 3.2 * Math.exp(-(((s - pulseAt) / 0.22) ** 2)) * (1 - pulse / 0.4) * fade;
      pts.push({ x: p.x, z: p.z, w: 0.032 + 0.04 * tw, g });
    }
    ribbon.draw(pts);
    // the stroke smear: the tail's last few frames, fainter (a long exposure of a fast flick)
    history.unshift(tail.map((p) => ({ x: p.x, z: p.z })));
    history.length = Math.min(history.length, 5);
    echoes.forEach((e, k) => {
      const h = history[k + 1];
      if (!h || echoK < 0.01) return e.draw([]);
      e.draw(h.map((p) => ({ x: p.x, z: p.z, w: 0.05, g: echoK * 0.5 * (1 - k / 4) })), 0.011);
    });
    // the bow at her feet
    if (bowK > 0.001 && bowAt) {
      const bp = [];
      const age = Math.max(0, (now - bowAt.t) / LIFE);
      const fade = Math.max(0, 1 - age) ** 1.6;
      const S = bowAt.p;
      const loop = (side, from, to, list) => {
        const N = 26;
        for (let i = 0; i <= N; i++) {
          const f = from + ((to - from) * i) / N;
          const L = 0.46 * bowK;
          const Wd = 0.19 * bowK;
          // a teardrop lobe out to the side, tipped toward the room
          const x = side * L * (1 - Math.cos(f)) * 0.5;
          const z = Wd * Math.sin(f) + 0.1 * bowK * (1 - Math.cos(f)) * 0.5;
          list.push({ x: S.x + x, z: S.z + z, w: 0.032 + 0.014 * Math.abs(Math.cos(f * 2)), g: 2.6 * fade });
        }
      };
      // left tail, left lobe, right lobe, right tail
      for (let i = 0; i <= 8; i++) {
        const u = 1 - i / 8;
        bp.push({ x: S.x - 0.16 * bowK * u, z: S.z + 0.3 * bowK * u + 0.03 * Math.sin(u * 5), w: 0.03, g: 2.3 * fade * (1 - 0.5 * u) });
      }
      loop(-1, 0, TAU, bp);
      loop(1, 0, -TAU, bp);
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        bp.push({ x: S.x + 0.18 * bowK * u, z: S.z + 0.28 * bowK * u - 0.03 * Math.sin(u * 5), w: 0.03, g: 2.3 * fade * (1 - 0.5 * u) });
      }
      bow.draw(bp, 0.013);
    } else bow.draw([]);
  };
  // drawn after her pose is placed each frame
  maya.each = () => draw();

  // ---- Move 2: laid out straight ----
  lab.playCard('a', ['m2']);
  layPoint(tie(), lab.t);
  await lab.wait(0.06);
  await lab.tween(0.6, (e, k) => maya.set({ x: 1 + 2 * e, pitch: 0.06 * Math.sin(k * Math.PI) }), ease.inOut);
  await lab.wait(0.06);

  // ---- Rotate Right: a quarter curl flicks out beside her, smeared like a fast stroke ----
  lab.playCard('a', ['rr']);
  await lab.wait(0.05);
  W = rec[rec.length - 1] ? new THREE.Vector3(rec[rec.length - 1].x, 0, rec[rec.length - 1].z) : tie();
  phase = 'curl';
  echoK = 1;
  lab.tween(0.5, (e, k) => {
    // flung out wide, then settling into a small curl with a little spring
    curlAmp = k < 0.3 ? 0.7 * ease.out(k / 0.3) : 0.28 + 0.42 * Math.exp(-(k - 0.3) * 9) * Math.cos((k - 0.3) * 16);
    echoK = 1 - ease.in(k);
  }, ease.linear);
  await lab.tween(0.32, (e) => maya.set({ rot: facing(1) + (facing(2) - facing(1)) * e }), ease.out3);
  await lab.wait(0.24);

  // ---- Move Back: the curl is dragged taut, a crack of light runs down the ribbon ----
  lab.playCard('a', ['bk']);
  await lab.wait(0.05);
  phase = 'tug';
  let cracked = false;
  await lab.tween(0.4, (e, k) => {
    maya.set({ y: 2 - e });
    taut = ease.inOut(Math.min(1, k / 0.7));
    if (!cracked && k >= 0.7) {
      cracked = true;
      shiverT = lab.t;
      pulseT = lab.t;
    }
  }, ease.inOut);
  // she feels the tug: a tiny jolt
  lab.tween(0.16, (e, k) => maya.set({ pitch: -0.08 * Math.sin(k * Math.PI) }), ease.linear);
  await lab.wait(0.18);
  // what's left is ordinary ribbon on the glass
  const tailNow = buildTail(lab.t);
  for (const p of tailNow) rec.push({ x: p.x, z: p.z, t: lab.t - 0.25 });
  phase = 'none';

  // ---- U-Turn: whipped once and a half round her ring, pulled tight into a bow ----
  lab.playCard('a', ['ut']);
  await lab.wait(0.05);
  phase = 'loop';
  sweepT0 = lab.t;
  echoK = 1;
  await lab.tween(0.45, (e, k) => {
    maya.set({ rot: facing(2) - Math.PI * e });
    sweep = 540 * ease.out(k);
    echoK = 1 - k * 0.8;
  }, ease.inOut);
  echoK = 0;
  bowAt = { p: centre().add(dir(180).multiplyScalar(R0 - 0.02)), t: lab.t };
  glint.position.copy(bowAt.p).setY(0.06);
  lab.tween(0.4, (e) => {
    glint.material.opacity = e < 0.15 ? e / 0.15 : 1 - (e - 0.15) / 0.85;
    glint.scale.setScalar(0.25 + 0.55 * Math.sin(Math.min(1, e * 2) * Math.PI * 0.5));
    glint.material.rotation = e * 0.8;
  }, ease.linear);
  // a tiny pleased bounce as it pulls tight
  lab.tween(0.24, (e, k) => maya.set({ sy: 1 + 0.06 * Math.sin(k * Math.PI), lift: 0.03 * Math.sin(k * Math.PI) }), ease.linear);
  await lab.tween(0.2, (e) => (bowK = e), (k) => ease.outBack(k, 2.2));
  await lab.wait(0.08);

  // hand her back; the painting stays on the glass and fades on schedule
  frozenTail = buildTail(lab.t);
  maya.each = null;
  maya.set({ sy: 1, lift: 0 });
  maya.release({ x: end.x, y: end.y, d: end.d });
  lab.every(() => draw());
}
