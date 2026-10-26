// Token flip, as a sports replay. The tile under the flag pops out of the slab with Maya on it and turns over;
// at the halfway point, with Maya hanging upside down beneath her own smoked-glass tile, time freezes, the room
// irises down to the tile and the camera swings round and low through the frozen moment (bullet time). Time
// starts again, leaving the frozen Maya behind as a ghost of light; the tile finishes its turn and slaps home
// with a clack, her ring on its face, and the camera whips back to the game.
export const meta = {
  title: 'Token flip, freeze-frame',
  idea:
    'The glass tile under the flag pops out of the slab with Maya stuck to it and flips like a cardboard token. Halfway round, with Maya hanging upside down under the smoked glass like her own reflection, time stops: the room irises down to the tile and the camera swings low around the frozen moment like a sports replay. Time snaps back, leaving her upside-down ghost hanging in the air, and the tile slaps home with a clack, her ring now on its face.',
  notes:
    'Sound: a glassy pop, a rising whoosh cut dead at the freeze (silence, maybe one high sustained glass tone while the camera moves), a reversed-swell as time restarts, then a solid glass clack on the slap. Port: the tile is a box plus a square of light for its seams; the hole is a black square over the glass; the iris is a radial gradient in the HUD layer. The freeze is real-time (about half a second) and the camera move is a big one, which suits a moment that happens a handful of times a game.',
};

export default async function play(lab) {
  const { THREE, ease, arena } = lab;
  const mayaRec = lab.bot('a');
  const RED = mayaRec.color;
  const P = lab.pos(4, 1);
  const LIGHT = lab.PALETTE.light;

  // a tween on real seconds (for the frozen moment, when scene time stands still)
  const realTween = (dur, fn, easing = ease.inOut) =>
    new Promise((ok) => {
      const t0 = lab.real;
      fn(easing(0), 0);
      const stop = lab.every(() => {
        const k = Math.min(1, (lab.real - t0) / dur);
        fn(easing(k), k);
        if (k >= 1) {
          stop();
          ok();
        }
      });
    });

  // ---------- the tile, its seams of light, and the hole it leaves ----------
  const S = 0.96;
  const TH = 0.12;
  const tile = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x121a26, roughness: 0.14, metalness: 0, transparent: true, opacity: 0.8, emissive: 0x1d2838, emissiveIntensity: 0.9, depthWrite: false });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x10141a, roughness: 0.25, metalness: 0, emissive: 0x8090a8, emissiveIntensity: 0.55 });
  // faces: +x -x +y -y +z -z (the four sides glow like the slab's edges)
  const slabBox = new THREE.Mesh(new THREE.BoxGeometry(S, TH, S), [edgeMat, edgeMat, glassMat, glassMat, edgeMat, edgeMat]);
  slabBox.renderOrder = 6;
  tile.add(slabBox);
  const seamGeo = new THREE.RingGeometry(0.655, 0.685, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2);
  const seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(LIGHT).multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const y of [TH / 2 + 0.003, -TH / 2 - 0.003]) {
    const s = new THREE.Mesh(seamGeo, seamMat);
    s.position.y = y;
    s.renderOrder = 7;
    tile.add(s);
  }
  tile.visible = false;
  lab.add(tile);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 }));
  hole.position.set(P.x, 0.012, P.z);
  hole.renderOrder = 4;
  lab.add(hole);
  // the seam on the glass before it lifts (a square of light around the space)
  const seamFloor = new THREE.Mesh(seamGeo, seamMat);
  seamFloor.position.set(P.x, 0.014, P.z);
  seamFloor.renderOrder = 7;
  lab.add(seamFloor);

  let h = -TH / 2 + 0.002; // the tile's centre height (its top is flush with the glass)
  let psi = 0; // its turn about the north-south axis
  let maya = null;
  let squash = 1;
  const poseAll = () => {
    tile.position.set(P.x, h, P.z);
    tile.rotation.set(0, 0, psi);
    if (maya) {
      const ox = -(TH / 2) * Math.sin(psi);
      const oy = (TH / 2) * Math.cos(psi);
      maya.set({ x: 4 + ox, y: 1, lift: h + oy, pitch: -psi, sy: squash, sx: 1 / Math.sqrt(squash), sz: 1 / Math.sqrt(squash) });
    }
  };

  // the iris: the room closes down to the tile while time stands still
  const iris = document.createElement('div');
  iris.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0';
  lab.overlay.append(iris);
  let irisK = 0;
  const drawIris = () => {
    const c = lab.toScreen(new THREE.Vector3(P.x, h + 0.2, P.z));
    const r = 900 - 640 * irisK;
    iris.style.opacity = String(Math.min(1, irisK * 1.4));
    iris.style.background = `radial-gradient(circle at ${c.x}px ${c.y}px, rgba(0,0,0,0) ${r * 0.45}px, rgba(2,3,5,.92) ${r}px)`;
  };

  // labels (the card over Maya, name tags) hide while the camera is close and fade back after
  let labelFade = 1;
  const stop = lab.every(() => {
    poseAll();
    if (irisK > 0) drawIris();
    if (labelFade < 1) {
      if (mayaRec.card) mayaRec.card.material.opacity *= labelFade;
      for (const b of arena.bots.values()) if (b.tag) b.tag.material.opacity *= labelFade;
    }
  });
  lab.cleanup(stop);

  // ---------- camera: the replay arc ----------
  let arc = 0; // 0 home .. 1 low and round
  let push = 0; // a small push-in on the pop
  const releaseCam = lab.camera((home) => {
    const tgt = home.target.clone().lerp(new THREE.Vector3(P.x, 0.8, P.z), Math.max(0.35 * push, 0.9 * arc));
    return {
      target: tgt,
      dist: home.dist * (1 - 0.12 * push - 0.52 * arc),
      el: home.el - 0.5 * arc,
      az: 0.75 * arc,
      fov: 30 - 3 * push * (1 - arc),
    };
  });

  // 1. the game's own move onto the flag
  lab.beat(lab.scenario.beats[0]);
  await lab.wait(0.5);
  // 2. the seam of the tile lights as she arrives
  lab.tween(0.15, (e) => (seamMat.opacity = e), ease.out);
  await lab.wait(0.16);
  maya = lab.puppet('a');
  maya.set({ trail: false });
  tile.visible = true;
  arena.focusOn = 'a';
  labelFade = 0;
  // anticipation: the tile sinks a hair, Maya crouches
  await lab.tween(0.13, (e) => ((h = -TH / 2 + 0.002 - 0.04 * e), (squash = 1 - 0.14 * e)), ease.out);

  // 3. POP and the first half of the turn
  hole.material.opacity = 1;
  lab.ring(P, LIGHT, 0.7, 0.02, 0.35);
  lab.tween(0.3, (e) => (push = e), ease.out);
  lab.tween(0.16, (e) => (squash = 0.86 + 0.14 * ease.outBack(e)), ease.linear);
  await lab.tween(
    0.32,
    (e, k) => {
      h = -TH / 2 - 0.038 + 1.3 * ease.out3(k);
      psi = Math.PI * ease.inOut(Math.min(1, k * 1.0));
    },
    ease.linear,
  );

  // 4. FREEZE: halfway round, Maya hangs upside down under the glass. The room irises in, the camera swings.
  lab.slowmo(0.015, 0.05);
  realTween(0.16, (e) => (irisK = e), ease.out);
  await realTween(0.58, (e) => (arc = e), ease.inOut);
  await lab.waitReal(0.14); // hold the frozen frame
  // the frozen image stays behind as a ghost of light
  maya.group.updateMatrixWorld(true);
  const ghost = maya.group.clone(true);
  const ghostMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(RED).multiplyScalar(1.6), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  ghost.traverse((o) => {
    if (o.isSprite) o.visible = false;
    else if (o.isMesh) o.material = ghostMat;
  });
  lab.add(ghost);

  // 5. time snaps back: the ghost hangs and fades, the tile finishes its turn and falls home
  lab.slowmo(1, 0.06);
  realTween(0.2, (e) => (irisK = 1 - e), ease.in);
  const home = realTween(0.75, (e) => (arc = 1 - e), ease.inOut3);
  lab.tween(0.5, (e) => (push = 1 - e), ease.inOut);
  lab.tween(0.45, (e) => {
    ghostMat.opacity = 0.7 * (1 - e) ** 1.5;
    ghost.scale.setScalar(1.3 * (1 + 0.15 * e));
  });
  await lab.tween(
    0.28,
    (e, k) => {
      h = 1.202 - 1.26 * k * k; // falling
      psi = Math.PI + Math.PI * ease.out(k);
    },
    ease.linear,
  );

  // 6. CLACK: flush with the glass, upright, her ring on its face
  h = -TH / 2 + 0.002;
  psi = 0;
  hole.material.opacity = 0;
  lab.shake(0.05, 0.22);
  lab.ring(P, LIGHT, 1.1, 0.02, 0.45);
  lab.particles(new THREE.Vector3(P.x, 0.03, P.z), [LIGHT, RED], 26, { speed: 1.6, up: 0.6, gravity: 2, size: 0.04, dur: 0.6 });
  seamMat.color.set(RED).multiplyScalar(2.6);
  arena.setTaken([{ color: RED, cp: 1 }]);
  arena.emit('checkpoint', { id: 'a', n: 1 });
  arena.focusOn = null;
  lab.tween(0.5, (e) => (labelFade = e), ease.in);
  ghost.visible = false;
  // the landing squash, and the seam fades back into the glass
  lab.tween(0.5, (e) => (seamMat.opacity = 1 - e), ease.in);
  await lab.tween(0.32, (e, k) => (squash = 1 - 0.16 * (1 - k) * Math.cos(k * Math.PI * 2.5) * (1 - k)), ease.linear);
  squash = 1;
  poseAll();
  maya.release({ x: 4, y: 1, d: 1 });
  maya = null;
  tile.visible = false;
  await home;
  releaseCam();
}
