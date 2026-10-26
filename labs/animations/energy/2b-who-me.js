// Energy, idea 2 (brownout), animator b: character acting.
export const meta = {
  title: 'Brownout: who, me?',
  idea:
    'Maya parks on the battery, braces like someone about to drink a whole milkshake in one go, and pulls. The battery\'s arcs are sucked into her and every other light in the picture sags to half and flickers (down, half back, down, back): the glass, the room, Ezra, even the HUD. Only Maya stays at full strength, swelling with amber. The lights come back with an overshoot; Ezra\'s beacon comes back late, so he gives himself a shake like a dodgy torch, then turns to glare at her. Maya, eye still glowing, turns her nose up and away: who, me?',
  notes:
    'Sound: a deep glass "hhhup" as she pulls, the room hum sagging a semitone with the flicker, a bright tick as the lights snap back, a little rattle when Ezra shakes. ' +
    'Several robots charging on the same register: the dip gets deeper (DEPTH grows by 0.12 a robot). ' +
    'Port: the dimming is one black full-screen veil drawn after the world and before the charging robot (its materials go to a higher renderOrder), so it costs nothing; the HUD dims with a CSS brightness filter, except the charging player\'s chip.',
};

export default async function play(lab) {
  const { THREE, PALETTE } = lab;
  const AMBER = new THREE.Color(1.0, 0.62, 0.22);
  const RED = new THREE.Color(lab.bot('a').color);
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const E = lab.ease;
  const track = (keys) => (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const k = (t - t0) / (t1 - t0 || 1);
        return v0 + (v1 - v0) * (E[e] ?? E.inOut)(k);
      }
    }
    return keys[keys.length - 1][1];
  };
  // body acting: lift, pitch (rocks on its nose or tail), roll (on a side), squash; the ring stays on the glass
  const actBody = (model, a, L = 0.3, W = 0.28) => {
    const b = model.body;
    const pitch = a.pitch ?? 0;
    const roll = a.roll ?? 0;
    b.rotation.set(-pitch, 0, -roll);
    b.scale.set(a.sx ?? 1, a.sy ?? 1, a.sz ?? 1);
    const p = new THREE.Vector3(roll > 0 ? W : roll < 0 ? -W : 0, 0, pitch > 0 ? -L : pitch < 0 ? L : 0);
    const r = p.clone().applyEuler(b.rotation);
    b.position.set(p.x - r.x, (a.lift ?? 0) + p.y - r.y, p.z - r.z);
  };

  const maya = lab.puppet('a');
  const ezra = lab.puppet('b');
  const bat = lab.pos(3, 1);
  const EAST = lab.facing(1);
  const LOOK = Math.atan2(2, 2); // Ezra's tip straight at Maya
  const CHARGING = 1; // robots charging on this register
  const DEPTH = Math.min(0.9, 0.72 + 0.08 * (CHARGING - 1)); // a perceived half: the veil's alpha is in linear light

  // ----- the veil: one black full-screen quad, drawn after the world and before Maya -----
  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { k: { value: 0 } },
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform float k; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, k); }',
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  veil.frustumCulled = false;
  veil.renderOrder = 50;
  lab.add(veil);
  // Maya (and Ezra's beacon, which keeps its own late timing) draw after the veil
  const lifted = [];
  const lift = (mesh) => {
    lifted.push({ mesh, order: mesh.renderOrder, transparent: mesh.material.transparent });
    mesh.renderOrder = 60;
    mesh.material.transparent = true;
    mesh.material.needsUpdate = true;
  };
  maya.group.traverse((o) => o.isMesh && lift(o));
  ezra.group.traverse((o) => o.isMesh && o.material === ezra.model.eyeMat && lift(o));
  const renderer = lab.renderer;
  const exposure0 = renderer.toneMappingExposure;
  const ringBase = maya.model.ringMat.color.clone();
  const poolBase = maya.model.poolMat.color.clone();
  const restore = () => {
    for (const l of lifted) {
      l.mesh.renderOrder = l.order;
      l.mesh.material.transparent = l.transparent;
      l.mesh.material.needsUpdate = true;
    }
    lifted.length = 0;
    renderer.toneMappingExposure = exposure0;
    maya.model.ringMat.color.copy(ringBase);
    maya.model.poolMat.color.copy(poolBase);
    maya.model.body.scale.set(1, 1, 1);
    ezra.model.body.scale.set(1, 1, 1);
  };
  lab.cleanup(restore);

  // ----- the battery's arcs, drawn round her, sucked into her when she pulls -----
  const arcs = new THREE.Group();
  arcs.position.set(bat.x, 0.009, bat.z);
  const arcMats = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshBasicMaterial({ color: hdr(PALETTE.energy, 1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const a = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48, 1, -((i + 1) / 3) * Math.PI * 2 + 0.3, (Math.PI * 2) / 3 - 0.6), m);
    a.rotation.x = -Math.PI / 2;
    a.renderOrder = 60;
    arcs.add(a);
    arcMats.push(m);
  }
  lab.add(arcs);

  // ----- a small HUD (the game's would sit at the bottom): it sags too, except Maya's chip -----
  const H = lab.overlay.clientHeight || 540;
  const hud = document.createElement('div');
  hud.style.cssText = `position:absolute;left:${H * 0.03}px;top:${H * 0.025}px;display:flex;gap:${H * 0.014}px;font:300 ${H * 0.03}px Lumen, system-ui, sans-serif;letter-spacing:.08em;color:#f4efe4;opacity:0`;
  const bolt = (c) => `<svg viewBox="0 0 40 40" style="width:1.05em;height:1.05em;vertical-align:-.18em"><path d="M22.5 6 L12.5 22 H19.5 L17.5 34 L27.5 17.5 H20.5 Z" fill="${c}"/></svg>`;
  const chip = (name, color, n) => {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:.45em;padding:.3em .8em .3em .6em;border-radius:2em;background:rgba(8,10,14,.62);box-shadow:0 0 0 1px rgba(244,239,228,.08) inset';
    el.innerHTML = `<span style="width:.6em;height:.6em;border-radius:50%;background:${color};box-shadow:0 0 .5em ${color}"></span><span>${name}</span>${bolt(PALETTE.energy)}<b style="font-weight:400;min-width:.7em;display:inline-block">${n}</b>`;
    hud.append(el);
    return el;
  };
  const mayaChip = chip('MAYA', '#ff4d6d', 3);
  const ezraChip = chip('EZRA', '#cc5de8', 5);
  lab.overlay.append(hud);
  const mayaNum = mayaChip.querySelector('b');

  // ----- timing -----
  const ARRIVE = 0.62;
  const BRACE = 0.8;
  const DRAW = 0.94; // the lights sag
  const BACK = 1.36; // the lights come back
  const SHAKE = 1.5; // Ezra shakes himself
  const GLARE = 1.64; // Ezra turns to glare
  const WHO = 1.76; // Maya: who, me?
  const UNDO = 2.02;
  const END = 2.26;

  // the brownout: down, half back, down, back (k = how much light is missing)
  const veilK = track([[0, 0], [DRAW, 0, 'linear'], [DRAW + 0.05, DEPTH, 'out'], [DRAW + 0.15, DEPTH * 0.9, 'linear'], [DRAW + 0.19, DEPTH * 0.4, 'out'], [DRAW + 0.23, DEPTH * 1.1, 'in'], [BACK - 0.02, DEPTH * 1.04, 'linear'], [BACK + 0.04, 0, 'in']]);
  const flutter = (t) => (t > DRAW + 0.05 && t < BACK ? Math.sin(t * 90) * 0.04 + Math.sin(t * 57) * 0.03 : 0);
  const exposure = track([[0, 1], [BACK + 0.02, 1, 'linear'], [BACK + 0.08, 1.22, 'out'], [BACK + 0.4, 1, 'inOut']]);

  const x = track([[0, 1], [ARRIVE, 3, 'inOut']]);
  const drive = [[0, 0], [0.12, -0.08, 'out'], [0.45, 0, 'inOut'], [ARRIVE + 0.06, 0.2, 'out'], [ARRIVE + 0.18, -0.06, 'inOut']];
  // brace (lean back), pull (upright, straining), exhale, then nose in the air (who, me?)
  const pitch = track([...drive, [BRACE, -0.04, 'inOut'], [DRAW - 0.02, -0.2, 'out'], [DRAW + 0.08, 0.04, 'out'], [BACK, 0, 'linear'], [BACK + 0.1, 0.12, 'out'], [BACK + 0.26, 0, 'inOut'], [WHO, 0, 'linear'], [WHO + 0.14, -0.22, 'out'], [UNDO, -0.2, 'linear'], [END - 0.04, 0, 'inOut']]);
  const sy = track([[0, 1], [ARRIVE, 1, 'linear'], [ARRIVE + 0.05, 0.9, 'out'], [ARRIVE + 0.16, 1.03, 'out'], [BRACE, 1, 'inOut'], [DRAW - 0.02, 0.8, 'out'], [DRAW + 0.08, 1.2, 'out'], [BACK, 1.24, 'linear'], [BACK + 0.08, 0.88, 'in'], [BACK + 0.2, 1.05, 'out'], [BACK + 0.32, 1, 'inOut'], [END, 1, 'linear']]);
  const swell = track([[0, 1], [DRAW, 1, 'linear'], [DRAW + 0.1, 1.12, 'out'], [BACK, 1.16, 'linear'], [BACK + 0.12, 1, 'inOut']]); // she fills up
  const hic = (t) => (t > BACK + 0.04 && t < BACK + 0.16 ? Math.sin(((t - BACK - 0.04) / 0.12) * Math.PI) * 0.07 : 0); // hic!
  const tremble = (t) => (t > DRAW + 0.06 && t < BACK ? Math.sin(t * 150) * 0.035 : 0);
  const rot = track([[0, EAST], [WHO, EAST, 'linear'], [WHO + 0.16, EAST + 0.62, 'out'], [UNDO, EAST + 0.55, 'linear'], [END - 0.04, EAST, 'inOut']]);
  // her light: amber floods in on the pull, cools after
  const amber = track([[0, 0], [DRAW, 0, 'linear'], [DRAW + 0.12, 1, 'out'], [BACK + 0.1, 1, 'linear'], [END - 0.04, 0, 'inOut']]);
  const eyeK = track([[0, 1], [BRACE, 1, 'linear'], [DRAW - 0.02, 0.45, 'inOut'], [DRAW + 0.06, 2, 'out'], [BACK + 0.1, 1.6, 'linear'], [BACK + 0.4, 1.1, 'inOut'], [END, 1, 'inOut']]);
  // the arcs: peek out as she parks, get sucked into her on the pull
  const arcShow = track([[0, 0], [ARRIVE - 0.12, 0, 'linear'], [ARRIVE + 0.08, 1, 'out'], [DRAW + 0.04, 1, 'linear'], [DRAW + 0.22, 0, 'in']]);
  const arcR = track([[0, 0.3], [ARRIVE - 0.12, 0.3, 'linear'], [ARRIVE + 0.1, 0.62, 'out'], [DRAW - 0.02, 0.66, 'out'], [DRAW + 0.22, 0.2, 'in']]);
  const arcK = track([[0, 0.7], [DRAW - 0.02, 0.8, 'linear'], [DRAW + 0.08, 3.6, 'out']]);

  // Ezra: his beacon follows the brownout two frames late and stutters when it should come back;
  // he shakes himself like a dodgy torch, then turns to glare at her
  const LATE = 2 / 30;
  const ezBeacon = (t) => {
    const k = 1 - 1.25 * (veilK(t - LATE) + flutter(t - LATE));
    if (t > BACK + LATE && t < SHAKE + 0.04) return [0.15, 0.15, 1, 0.15, 0.1, 0.1, 1, 0.1][Math.floor((t - BACK - LATE) * 30) % 8];
    return k;
  };
  const ezRoll = (t) => (t > SHAKE && t < SHAKE + 0.2 ? Math.sin((t - SHAKE) * 62) * 0.2 * (1 - (t - SHAKE) / 0.2) : 0);
  const ezRot = track([[0, 0], [GLARE, 0, 'linear'], [GLARE + 0.12, LOOK * 1.06, 'out'], [GLARE + 0.2, LOOK, 'inOut'], [UNDO + 0.02, LOOK, 'linear'], [END - 0.02, 0, 'inOut']]);
  const ezPitch = track([[0, 0], [DRAW + 0.04, 0, 'linear'], [DRAW + 0.12, -0.08, 'out'], [BACK, -0.06, 'linear'], [BACK + 0.1, 0, 'inOut'], [GLARE + 0.1, 0, 'linear'], [GLARE + 0.22, 0.16, 'out'], [UNDO, 0.14, 'linear'], [END - 0.02, 0, 'inOut']]);
  const hudIn = track([[0, 0], [0.3, 1, 'out']]);

  const white = new THREE.Color(3.2, 3.1, 2.9);
  const ezEye = new THREE.Color(3.2, 3.1, 2.9);
  const st = { body: {}, ez: {}, amber: 0, eyeK: 1, beacon: 1 };
  maya.each = (m) => {
    actBody(m, st.body);
    m.eyeMat.color.copy(white).lerp(hdr(AMBER, 4.4), st.amber).multiplyScalar(st.eyeK);
    m.ringMat.color.copy(ringBase).lerp(hdr(AMBER, 2.4), st.amber * 0.85);
    m.poolMat.color.copy(poolBase).lerp(hdr(AMBER, 1.2), st.amber * 0.85);
    m.paint.emissive.copy(RED).lerp(AMBER, st.amber * 0.4);
    m.paint.emissiveIntensity = 0.16 + st.amber * 0.45;
  };
  ezra.each = (m) => {
    actBody(m, st.ez, 0.2, 0.2);
    m.eyeMat.color.copy(ezEye).multiplyScalar(Math.max(0.04, st.beacon));
  };

  // ----- go -----
  lab.playCard('a', ['m2']);
  lab.arena.emit('move', { id: 'a', n: 2, dur: ARRIVE });
  const t0 = lab.t;
  let counted = false;
  const stop = lab.every(() => {
    const t = lab.t - t0;
    const k = Math.max(0, Math.min(0.95, veilK(t) + flutter(t)));
    veil.material.uniforms.k.value = k;
    renderer.toneMappingExposure = exposure0 * exposure(t);
    const s = sy(t) ;
    const w = swell(t) / Math.sqrt(s);
    maya.set({ x: x(t), y: 1, rot: rot(t) });
    st.body = { pitch: pitch(t), roll: tremble(t), sy: s, sx: w, sz: w, lift: hic(t) };
    st.amber = amber(t);
    st.eyeK = eyeK(t);
    ezra.set({ rot: ezRot(t) });
    st.ez = { roll: ezRoll(t), pitch: ezPitch(t) };
    st.beacon = ezBeacon(t);
    arcs.scale.setScalar(arcR(t));
    for (const m of arcMats) {
      m.opacity = arcShow(t);
      m.color.copy(hdr(PALETTE.energy, arcK(t)));
    }
    // the HUD sags with the room (Ezra's chip, like his beacon, two frames late); Maya's chip doesn't
    hud.style.opacity = String(hudIn(t));
    ezraChip.style.filter = `brightness(${(0.15 + 0.85 * Math.max(0, Math.min(1.2, st.beacon))).toFixed(3)})`;
    mayaChip.style.filter = 'none';
    if (!counted && t >= DRAW + 0.1) {
      counted = true;
      mayaNum.textContent = '4';
      mayaNum.style.color = PALETTE.energy;
      mayaNum.style.textShadow = `0 0 .5em ${PALETTE.energy}`;
    }
    if (counted && t > BACK + 0.3) {
      mayaNum.style.color = '';
      mayaNum.style.textShadow = '';
    }
  });

  lab.at(DRAW, () => lab.arena.emit('energy', { id: 'a', n: 1 }));
  lab.at(BACK, () => lab.arena.emit('lights-back'));
  lab.at(SHAKE, () => lab.arena.emit('rattle', { id: 'b' }));

  await lab.wait(END);
  stop();
  veil.material.uniforms.k.value = 0;
  actBody(maya.model, {});
  actBody(ezra.model, {});
  restore();
  maya.release({ x: 3, y: 1, d: 1 });
  ezra.release({ x: 5, y: 3, d: 0 });
}
