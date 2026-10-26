// Checkpoint, idea 2 (Token flip), animator a: weight and physical comedy.
export const meta = {
  title: 'Tiddlywink',
  idea:
    'Maya brakes hard onto flag 1 and her momentum presses the tile\'s far edge down, like a thumb on a tiddlywink. The glass tile pops out of the slab (a square of darkness left behind), sails up and turns over once with Maya stuck to it: at the top she hangs upside down under the smoked glass, stretched by gravity, like her own reflection. It comes down fast and slaps back into its hole with a clack: a square ripple runs out through the glass, puffs of light squirt from the seams, Maya squashes flat, bounces, wobbles, and stands facing east with her red ring stamped at the column\'s foot.',
  notes:
    'Sound: a glass creak as the tile dips, a hollow "pok" as it pops out, a soft whoosh through the turn (lowest at the top), then a flat glassy clack with a short ring, a little "boing" as she bounces. Physics: the tile is ballistic (slow at the top, fast at the ends) and turns a little slower at the top too, so the upside-down beat reads; the turn goes the way she was driving. Porting: one tile mesh over the checkpoint\'s square, a dark square under it while it is out, and the halo hidden; the column never moves. The camera leans in a little and looks up to follow the tile, and is home before the moment ends; her played card fades while she is airborne, as in the game\'s focus mode.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const TAU = Math.PI * 2;
const spring = (t, w, z) => {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
};

function canvasTex(THREE, size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const me = lab.bot('a');
  const maya = lab.puppet('a');
  const RED = new THREE.Color(me.color);
  const WARM = new THREE.Color('#f4efe4');
  const F = lab.pos(4, 1);
  const EAST = facing(1);
  const col = arena.columns.find((c) => c.n === 1);

  // ---------- the tile: a square of the smoked glass, edges lit like the slab's ----------
  const S = 0.97;
  const TH = 0.1;
  const glassTex = canvasTex(THREE, 128, (g, n) => {
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n * 0.7);
    r.addColorStop(0, '#2c333f');
    r.addColorStop(1, '#1b2028');
    g.fillStyle = r;
    g.fillRect(0, 0, n, n);
  });
  const edgeTex = canvasTex(THREE, 128, (g, n) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, n, n);
    g.strokeStyle = '#9aa6b8';
    g.lineWidth = 4;
    g.strokeRect(2, 2, n - 4, n - 4);
  });
  const faceMat = new THREE.MeshStandardMaterial({ map: glassTex, emissive: 0xffffff, emissiveMap: edgeTex, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.6, depthWrite: false });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x10141a, roughness: 0.25, emissive: 0x8c9ab0, emissiveIntensity: 1.1 });
  const tile = lab.add(new THREE.Mesh(new THREE.BoxGeometry(S, TH, S), [sideMat, sideMat, faceMat, faceMat, sideMat, sideMat]));
  tile.visible = false;
  tile.renderOrder = 7;
  // the hole it leaves: darkness, with a hint of the far wall going down into the slab
  const holeTex = canvasTex(THREE, 64, (g, n) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, n, n);
    const gr = g.createLinearGradient(0, 0, 0, n * 0.3);
    gr.addColorStop(0, 'rgba(70,82,100,1)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n * 0.3);
  });
  const hole = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, opacity: 0, depthWrite: false })));
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(F.x, 0.003, F.z);
  hole.renderOrder = 3;
  // the clack: a square ripple running out through the glass
  const rippleTex = canvasTex(THREE, 128, (g, n) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, n, n);
    g.shadowColor = '#fff';
    g.shadowBlur = 8;
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.strokeRect(10, 10, n - 20, n - 20);
  });
  const ripple = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rippleTex, color: WARM.clone().multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.set(F.x, 0.012, F.z);
  ripple.renderOrder = 4;
  // puffs of light squirting out of the seams
  const glow = me.model.poolMat.map;
  const puffs = [];
  for (let i = 0; i < 16; i++) {
    const side = i % 4;
    const along = lab.range(-0.4, 0.4);
    const dir = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ][side];
    const s = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: WARM.clone().multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.userData = { dir, along, speed: lab.range(0.35, 0.75) };
    puffs.push(s);
  }
  // her ring, stamped at the column's foot by the slap
  const ring = lab.add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(1.8) })));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(F.x, 0.06, F.z);
  ring.visible = false;
  const stamp = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: glow, color: RED.clone().multiplyScalar(2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  stamp.rotation.x = -Math.PI / 2;
  stamp.position.set(F.x, 0.013, F.z);

  const haloOn = col.halo.visible;
  lab.cleanup(() => (col.halo.visible = haloOn));

  const MOVE = 0.6;
  const DIP = 0.55; // her braking weight presses the far edge down
  const POP = 0.68;
  const FLIGHT = 0.84;
  const SLAP = POP + FLIGHT;
  const END = SLAP + 0.78;
  const APEX = 1.15;
  const g = (8 * APEX) / (FLIGHT * FLIGHT);
  const v0 = (g * FLIGHT) / 2;

  lab.playCard('a', ['m2']);
  const t0 = lab.t;
  let shook = false;
  const stop = lab.every(() => {
    const now = lab.t;
    const t = now - t0;

    // ---------- the tile ----------
    let yc = -TH / 2; // centre height (top flush with the glass)
    let th = 0; // how far it has turned (forward, the way she drove)
    let out = 0; // 0..1 how far it is out of its hole
    if (t >= DIP && t < POP) {
      const k = seg(t, DIP, POP);
      yc -= 0.03 * Math.sin((Math.PI / 2) * k);
      th = 0.14 * ease.in(k);
    } else if (t >= POP && t < SLAP) {
      const a = t - POP;
      const k = a / FLIGHT;
      yc = -TH / 2 - 0.03 + v0 * a - 0.5 * g * a * a + 0.03 * k;
      // turns a little slower at the top, so the upside-down beat reads
      th = 0.14 + (TAU - 0.14) * (k + 0.075 * Math.sin(TAU * k));
      out = 1;
    } else if (t >= SLAP) {
      // the slap: punches a hair too deep, springs back, rattles flat
      const a = t - SLAP;
      yc = -TH / 2 - 0.035 * Math.exp(-a * 9) * Math.cos(a * 30);
      th = TAU + 0.07 * Math.exp(-a * 7) * Math.sin(a * 34);
      out = a < 0.03 ? 1 : 0;
    }
    const flying = t >= DIP && t < END - 0.05;
    tile.visible = flying;
    tile.position.set(F.x, yc, F.z);
    tile.rotation.set(0, 0, -th);
    // the seams open as it tips (the light goes out around it), then the whole square is dark while it is out
    hole.material.opacity = t >= DIP && t < POP ? 0.9 * seg(t, DIP, DIP + 0.06) : t >= POP && t < SLAP + 0.02 ? 0.95 : 0;
    col.halo.visible = !(t >= POP && t < SLAP);

    // ---------- Maya, stuck to it ----------
    const pose = { x: 4, y: 1, rot: EAST, pitch: 0, lift: 0, sx: 1, sy: 1, sz: 1, roll: 0, trail: t < DIP };
    if (t < DIP) {
      const km = seg(t, 0, MOVE);
      pose.x = 2 + 2 * ease.inOut3(km);
      pose.pitch = -0.08 * Math.sin(Math.PI * seg(t, 0, MOVE * 0.5)) + 0.12 * seg(t, MOVE * 0.75, DIP);
    } else {
      if (t < MOVE) pose.x = 2 + 2 * ease.inOut3(seg(t, 0, MOVE));
      // her base rides on the tile's top face
      pose.x += (TH / 2) * Math.sin(th);
      pose.lift = yc + TH / 2 + (TH / 2) * (Math.cos(th) - 1);
      pose.pitch = th + (t < POP ? 0.12 * (1 - seg(t, DIP, POP)) : 0);
      if (t >= POP && t < SLAP) {
        const k = (t - POP) / FLIGHT;
        // kicked up: squashed by the launch; hanging at the top: stretched by gravity
        const kick = Math.max(0, 1 - k / 0.14);
        const hang = Math.sin(Math.PI * seg(k, 0.25, 0.75)) ** 2;
        pose.sy = 1 - 0.22 * kick + 0.2 * hang;
        pose.sx = pose.sz = 1 + 0.14 * kick - 0.08 * hang;
      } else if (t >= SLAP) {
        // splat, bounce, wobble
        const a = t - SLAP;
        const squash = Math.exp(-a * 10) * Math.cos(a * 24);
        const hop = a > 0.07 && a < 0.36 ? Math.sin(Math.PI * seg(a, 0.07, 0.36)) : 0;
        pose.sy = 1 - 0.42 * squash;
        pose.sx = pose.sz = 1 + 0.3 * squash;
        pose.pitch = th - TAU;
        pose.lift += 0.2 * hop;
        pose.roll = 0.2 * Math.exp(-a * 5) * Math.sin(a * 17);
        pose.rot = EAST + 0.12 * Math.exp(-a * 5) * Math.sin(a * 13 + 0.5);
        const settle = seg(t, END - 0.15, END);
        pose.lift *= 1 - settle;
        pose.pitch *= 1 - settle;
      }
    }
    maya.set(pose);
    const blink = t > SLAP + 0.02 && t < SLAP + 0.12 ? 0.15 : 1;
    maya.each = (m) => m.eyeMat.color.setRGB(3.2 * blink, 3.1 * blink, 2.9 * blink);
    // her played card steps aside while she is airborne (the game's focus mode does the same)
    if (me.card) me.card.material.opacity *= 1 - seg(t, DIP, POP + 0.1) * (1 - seg(t, SLAP + 0.2, END - 0.1));

    // ---------- the clack ----------
    if (t >= SLAP && !shook) {
      shook = true;
      lab.shake(0.03, 0.22);
    }
    // the claim: a short flush of her colour up the column (it stands as it was)
    if (t >= SLAP) {
      const f = Math.max(0, 1 - (t - SLAP) / 0.7) ** 1.5;
      col.mat.color.lerp(RED, 0.7 * f).multiplyScalar(1 + 1.4 * f);
      col.col.scale.x = 1 + 0.3 * f;
    }
    const rk = seg(t, SLAP, SLAP + 0.5);
    ripple.material.opacity = rk > 0 && rk < 1 ? (1 - rk) ** 1.6 : 0;
    ripple.scale.setScalar(S * 1.05 + 1.9 * ease.out(rk));
    for (const p of puffs) {
      const a = t - SLAP;
      const k = seg(a, 0, 0.42);
      if (a < 0 || k >= 1) {
        p.material.opacity = 0;
        continue;
      }
      const [dx, dz] = p.userData.dir;
      const d = 0.5 + p.userData.speed * ease.out(k);
      const ox = dx !== 0 ? dx * d : p.userData.along;
      const oz = dz !== 0 ? dz * d : p.userData.along;
      p.position.set(F.x + ox, 0.04 + 0.06 * k, F.z + oz);
      p.scale.setScalar(0.12 + 0.12 * k);
      p.material.opacity = 0.8 * (1 - k) ** 1.5;
    }
    // her ring: stamped by the slap, a red glow that cools into the game's ring
    if (t >= SLAP) {
      const a = t - SLAP;
      ring.visible = true;
      stamp.material.opacity = Math.max(0, 1 - a / 0.45) ** 1.5;
      stamp.scale.setScalar(0.5 + 0.4 * ease.out(seg(a, 0, 0.2)));
    }
  });

  // the camera leans in and looks up a little to follow the tile, and is home before the moment ends
  let camRelease = null;
  lab.at(DIP - 0.12, () => {
    camRelease = lab.camera((home) => {
      const t = lab.t - t0;
      const k = ease.inOut(seg(t, DIP - 0.1, POP + 0.3)) * (1 - ease.inOut(seg(t, SLAP + 0.12, END - 0.04)));
      return { target: home.target.clone().lerp(new THREE.Vector3(F.x, 0.55, F.z), 0.5 * k), dist: home.dist * (1 - 0.2 * k) };
    });
  });

  await lab.wait(END);
  stop();
  camRelease?.();
  tile.visible = false;
  hole.visible = false;
  ripple.visible = false;
  ring.visible = false;
  stamp.visible = false;
  col.halo.visible = haloOn;
  arena.setTaken([{ cp: 1, color: me.color }]);
  lab.cleanup(() => arena.setTaken([]));
  maya.each = null;
  maya.release({ x: 4, y: 1, d: 1 });
}
