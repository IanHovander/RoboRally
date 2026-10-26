// The laser pointer, through weight and physical comedy: Theo's beam arrives as a little dot dancing on
// the glass beside Maya, and Jun is the cat. His visor narrows to a squint, he sinks into a crouch and
// his back end wiggles faster and faster, then he pounces, and at the top of his arc the dot hops up onto
// Maya. Jun freezes in mid-air, cartoon style: gravity hasn't noticed yet. He looks at Maya, looks at us,
// blushes, and only then drops, lands with a clunk and sidles back to his space as if nothing happened.
export const meta = {
  title: 'Laser pointer (cartoon gravity)',
  idea: 'The beam lands as a shaky dot on the glass beside Maya and Jun turns into a cat: a squint, a crouch, a butt wiggle that speeds up, a pounce. At the top of his arc the dot hops onto Maya (the hit) and Jun freezes mid-air, cartoon style, until he has looked at her, then at us, and blushed. Then gravity remembers him: he drops with a clunk and sidles back to his space.',
  notes: 'Sound: a faint electric whine for the pointer, tiny glass ticks as the dot darts, a rising rattle for the wiggle, a whoosh for the pounce, a bright zap as the dot hops onto Maya, a beat of total silence for the hang, a slide-whistle drop and a hollow glass clunk, then a casual shuffle. Needs a bystander within about two spaces of the target; otherwise play the plain shot. Jun ends exactly on his space, facing north.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const theoBot = lab.bot('b');
  const color = theoBot.color;
  const glowTex = lab.bot('a').model.poolMat.map;
  const add = (c, k, op = 1) => ({ color: hdr(c, k), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });

  // ---------- the pointer: a thin line from Theo's muzzle to a dot on the glass ----------
  theoBot.model.muzzle.updateWorldMatrix(true, false);
  const muzzle = new THREE.Vector3().setFromMatrixPosition(theoBot.model.muzzle.matrixWorld);
  const lineCore = lab.add(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 6, 1, true), new THREE.MeshBasicMaterial(add('#ffffff', 2.4))));
  const lineSheath = lab.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 8, 1, true), new THREE.MeshBasicMaterial(add(color, 1.5, 0.4))));
  const up = new THREE.Vector3(0, 1, 0);
  const span = (m, a, b) => {
    const d = b.clone().sub(a);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(up, d.clone().normalize());
    m.scale.set(1, Math.max(0.001, d.length()), 1);
  };
  const dotCore = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, ...add('#ffffff', 3.2) })));
  const dotHalo = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, ...add(color, 2, 0.9) })));
  const splash = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, ...add(color, 1.3, 0.8) })));
  splash.rotation.x = -Math.PI / 2;
  splash.renderOrder = 3;
  const parts = [lineCore, lineSheath, dotCore, dotHalo, splash];
  for (const o of parts) o.visible = false;

  const BASE = lab.pos(1.62, 1.5); // the dot's home, just beside Maya (toward Jun)
  const MAYA_HIT = lab.pos(1.33, 1.08).setY(0.2); // on Maya's flank
  const dot = { x: 0, z: 0, onMaya: 0, power: 0, hop: 0 };
  const dotPos = new THREE.Vector3();
  const place = () => {
    // a shaky hand: a fine tremor on top of wherever it's been put
    const t = lab.t;
    const tremor = 1 - dot.onMaya;
    const jx = (Math.sin(t * 37) * 0.6 + Math.sin(t * 23.3 + 1) * 0.4) * 0.022 * tremor;
    const jz = (Math.sin(t * 31 + 2) * 0.6 + Math.sin(t * 19.7) * 0.4) * 0.022 * tremor;
    const g = BASE.clone().add(new THREE.Vector3(dot.x + jx, 0.012, dot.z + jz));
    dotPos.copy(g).lerp(MAYA_HIT, dot.onMaya);
    dotPos.y += Math.sin(dot.onMaya * Math.PI) * 0.35; // the hop up onto her
    return dotPos;
  };
  lab.every(() => {
    const on = dot.power > 0.001;
    for (const o of parts) o.visible = on;
    if (!on) return;
    const p = place();
    span(lineCore, muzzle, p);
    span(lineSheath, muzzle, p);
    lineCore.material.opacity = dot.power;
    lineSheath.material.opacity = 0.4 * dot.power;
    const flare = 1 + dot.hop * 2.2;
    dotCore.position.copy(p);
    dotHalo.position.copy(p);
    dotCore.scale.setScalar(0.17 * flare);
    dotHalo.scale.setScalar(0.42 * flare);
    dotCore.material.opacity = dotHalo.material.opacity = dot.power;
    splash.position.set(p.x, 0.007, p.z);
    splash.scale.setScalar(0.55 * (1 - dot.onMaya * 0.6));
    splash.material.opacity = 0.8 * dot.power * (1 - dot.onMaya);
  });

  // ---------- Jun, the cat ----------
  const jun = lab.puppet('c');
  jun.set({ trail: false });
  const visor = jun.model.body.children.find((o) => o.material === jun.model.eyeMat);
  const J0 = { x: 3, y: 3 };
  const dotSpace = () => {
    const p = place();
    return { x: p.x + 3.5 - 0.5, y: p.z + 2 - 0.5 }; // world back to spaces (7 x 4 board)
  };
  const aim = (from, to) => Math.atan2(-(to.x - from.x), -(to.y - from.y));
  const cat = { reach: 0, x: 3, y: 3, lift: 0, rot: facing(0), look: 0, lock: 0, crouch: 0, wiggle: 0, wigT: 0, stretch: 0, land: 0, squint: 0, blush: 0, eye: 1 };
  let rotV = 0;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  lab.every((dt) => {
    // while locked on, his whole body tracks the dot with a quick spring
    if (cat.lock > 0) {
      const want = aim(cat, dotSpace());
      const err = wrap(want - cat.rot);
      rotV += (err * 420 - rotV * 34) * dt * cat.lock;
      cat.rot += rotV * dt;
    }
    cat.wigT += dt * (3 + 4 * cat.wiggle) * Math.PI * 2;
  });
  jun.each = (model) => {
    const c = cat;
    const w = Math.sin(c.wigT) * c.wiggle;
    // the wiggle: his back end sways side to side (perpendicular to where he's looking)
    const px = Math.cos(c.rot) * w * 0.03;
    const py = -Math.sin(c.rot) * w * 0.03;
    const crouch = c.crouch;
    const st = c.stretch;
    const land = c.land;
    jun.set({
      x: c.x + px, y: c.y + py, lift: 0, rot: c.rot + w * 0.24,
      pitch: 0,
      roll: 0,
    });
    // squash and stretch the body only, so his ring stays round and flat on the glass
    model.body.scale.set(1 + 0.2 * crouch - 0.06 * st + 0.18 * land, 1 - 0.4 * crouch - 0.14 * st - 0.28 * land, 1 + 0.14 * crouch + 0.34 * st + 0.18 * land);
    // only his body leaves the glass: his ring stays down there, so you can see he's in the air
    model.body.position.y += c.lift / 1.3;
    // lean and wiggle the body only, so his ring stays flat on the glass
    model.body.rotation.x = -(0.06 * crouch + 0.22 * c.reach);
    model.body.rotation.z = -w * 0.06;
    if (visor) visor.scale.set(1 + 0.15 * c.squint, 1 - 0.6 * c.squint, 1);
    const e = c.eye * (1 + 1.4 * c.squint);
    model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
    if (c.blush > 0) {
      model.paint.emissive.set('#ff5a4a');
      model.paint.emissiveIntensity = 0.16 + 0.75 * c.blush;
    }
  };

  // ---------- the beats ----------
  lab.arena.emit('laser', { hit: false, src: 'b' });
  // the pointer switches on: the line shoots out and the dot pops onto the glass
  dot.x = 0.15;
  dot.z = -0.05;
  await lab.tween(0.09, (e) => (dot.power = e), ease.out);
  // the dot dances: darts, pauses, wiggles (a shaky hand teasing)
  const dart = (dur, x, z) => {
    const x0 = dot.x;
    const z0 = dot.z;
    return lab.tween(dur, (e) => {
      dot.x = x0 + (x - x0) * e;
      dot.z = z0 + (z - z0) * e;
    }, ease.inOut3);
  };
  // Jun notices: a snap turn toward it, the visor narrows
  lab.at(0.08, () => {
    cat.lock = 1;
    lab.tween(0.14, (e) => (cat.squint = e), ease.outBack);
  });
  await dart(0.1, 0.32, 0.12);
  await lab.wait(0.06);
  // he sinks into a crouch while it darts about
  lab.tween(0.15, (e) => (cat.crouch = e), ease.out);
  await dart(0.08, 0.05, 0.3);
  await lab.wait(0.05);
  lab.tween(0.36, (e) => (cat.wiggle = e), ease.in);
  await dart(0.1, -0.1, 0.12);
  await lab.wait(0.04);
  await dart(0.07, 0.22, 0.2);
  await lab.wait(0.08);
  // the pounce: the wiggle stops dead, a wind-up dip, then he launches half a space at it
  cat.wiggle = 0;
  await lab.tween(0.06, (e) => (cat.crouch = 1 + 0.25 * e), ease.out);
  cat.lock = 0;
  const target = dotSpace();
  const dx = target.x - 3;
  const dy = target.y - 3;
  const dl = Math.hypot(dx, dy);
  const P1 = { x: 3 + (dx / dl) * 0.62, y: 3 + (dy / dl) * 0.62 };
  lab.arena.emit('pounce', { id: 'c' });
  // at the top of his arc, the dot hops up onto Maya: that's the hit
  lab.at(0.17, async () => {
    lab.arena.emit('damage', { id: 'a', n: 1 });
    await lab.tween(0.1, (e) => (dot.onMaya = e), ease.inOut);
    dot.hop = 1;
    lab.glitch('a', '#ff7a6b');
    lab.ring(lab.pos(1, 1), color, 0.55, 0.02, 0.5);
    lab.tween(0.35, (e) => (dot.hop = 1 - e), ease.out);
  });
  await lab.tween(0.2, (e, k) => {
    cat.x = 3 + (P1.x - 3) * e;
    cat.y = 3 + (P1.y - 3) * e;
    cat.lift = 0.46 * ease.out3(k);
    cat.crouch = 1.25 * (1 - ease.out(Math.min(1, k * 2.2)));
    cat.stretch = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5);
    cat.reach = -0.6 + 1.6 * ease.inOut(k);
  }, ease.out);
  // FREEZE. Gravity hasn't noticed. He looks at Maya...
  const hang = { rot: cat.rot };
  await lab.wait(0.1);
  const toMaya = aim(cat, { x: 1, y: 1 });
  await lab.tween(0.08, (e) => (cat.rot = hang.rot + wrap(toMaya - hang.rot) * e), ease.out);
  await lab.wait(0.08);
  // ...then at us, and blushes; the squint goes wide
  const r1 = cat.rot;
  const toUs = facing(2);
  await lab.tween(0.08, (e) => {
    cat.rot = r1 + wrap(toUs - r1) * e;
    cat.squint = 1 - 1.4 * e;
    cat.blush = e;
    cat.reach = 1 - 0.6 * e;
  }, ease.out);
  await lab.wait(0.14);
  // gravity remembers him
  lab.tween(0.25, (e) => (dot.power = 1 - e), ease.in);
  await lab.tween(0.13, (e) => {
    cat.lift = 0.46 * (1 - e);
    cat.stretch = 1 - e;
    cat.squint = -0.4 * (1 - e);
    cat.reach = 0.4 * (1 - e);
  }, ease.in);
  // clunk
  lab.arena.emit('bump', { id: 'c' });
  lab.shake(0.01, 0.12);
  lab.ring(lab.pos(P1.x, P1.y), '#ffd43b', 0.42, 0.02, 0.35);
  lab.tween(0.3, (e, k) => (cat.land = Math.cos(k * Math.PI * 2) * (1 - k) ** 1.5), ease.linear);
  await lab.wait(0.1);
  // as if nothing happened: a casual slide back home, turning north, the blush fading
  jun.set({ trail: true });
  const r2 = cat.rot;
  await lab.tween(0.36, (e) => {
    cat.x = P1.x + (3 - P1.x) * e;
    cat.y = P1.y + (3 - P1.y) * e;
    cat.rot = r2 + wrap(facing(0) - r2 + 0.0001) * e;
    cat.blush = 1 - e;
  }, ease.inOut);
  cat.land = 0;
  cat.blush = 0;
  jun.each = null;
  jun.model.paint.emissive.set(lab.bot('c').color);
  if (visor) visor.scale.set(1, 1, 1);
  jun.model.body.scale.set(1, 1, 1);
  jun.release({ x: 3, y: 3, d: 0 });
  void clamp01;
}
