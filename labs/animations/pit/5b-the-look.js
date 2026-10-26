// Look to camera, played as character acting: Maya is simply gone, and Theo (the nearest witness) gives the
// sofa a slow, deadpan documentary look: a pause to process, a slow turn past the hole to face us, one blink,
// a tiny "hm" and a slightly-too-quick turn back. The camera reacts like a documentary operator would.
export const meta = {
  title: 'The look',
  idea: 'Maya drops into the hole, clean and silent: just gone. A beat. Then Theo, the only witness, slowly turns past the hole to face the room, his eye brightening as it swings onto the sofa, and the camera does a little documentary push-in on him. He holds the look, blinks once, deadpan. Then he turns back north a touch too quickly, as if nothing happened, and the camera slips back home.',
  notes: 'Sound: nothing at all for the drop (the silence is the setup); one soft glass "tick" as Theo locks onto the camera, maybe a faint room-tone swell under the hold. In the game the witness is the robot nearest the pit, so the gag varies by itself. Theo turns the long way round via the hole, so his gaze passes over where she went before landing on us; he turns back the same way, faster.',
};

export default async function play(lab) {
  const { ease, THREE } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  lab.playCard('a', ['m3']);

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (k) => Math.max(0, Math.min(1, k));
  // keyframes: [[t, value, easeIntoThisKey?], ...]
  const key = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, fn] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) return lerp(v0, v1, (fn ?? ease.inOut)(clamp((t - t0) / (t1 - t0 || 1))));
    }
    return keys[keys.length - 1][1];
  };

  // ---- timing (seconds from the start of the moment) ----
  const T = {
    gone: 0.98, // Maya is out of sight
    turn0: 1.28, // Theo starts to turn (a beat to process)
    turn1: 2.08, // ...facing the sofa
    blink: 2.36,
    hm: 2.6,
    back0: 2.74, // turns back, quicker
    back1: 3.12,
    end: 3.22,
  };

  // ---- Maya: the normal move, then straight down, no fuss ----
  const mayaX = [[0, 1], [0.3, 2, ease.in], [0.64, 3.55, ease.linear], [0.84, 4, ease.out]];
  const mayaLift = [[0.66, 0], [T.gone, -1.05, ease.in3]];

  // ---- Theo ----
  // rot: north is 0; turning left (+) goes via west, so his gaze sweeps over the hole on the way round
  const theoRot = [[T.turn0, 0], [T.turn1, Math.PI, ease.inOut], [T.back0, Math.PI], [T.back1, 0, (k) => ease.inOut3(k)]];
  // a breath in before he turns (a tiny lean back), a tiny "hm" at the end of the hold
  const theoPitch = [[T.turn0 - 0.2, 0], [T.turn0, -0.05, ease.out], [T.turn0 + 0.3, 0], [T.hm, 0], [T.hm + 0.07, -0.07, ease.out], [T.back0 + 0.05, 0], [T.back1, 0.035], [T.end, 0]];
  const theoSy = [[T.turn0 - 0.2, 1], [T.turn0, 1.04, ease.out], [T.turn0 + 0.3, 1], [T.back1 - 0.04, 1], [T.back1 + 0.04, 0.96, ease.out], [T.end, 1]];

  // ---- camera: a documentary push-in once he's looking at us, then back home as if nothing happened ----
  const theoAt = lab.pos(5, 3).add(new THREE.Vector3(0, 0.35, 0));
  const zoomK = [[T.turn1 - 0.12, 0], [T.turn1 + 0.14, 1.07, ease.out3], [T.turn1 + 0.3, 1, ease.inOut], [T.back0, 1.03, ease.linear], [T.back1 + 0.08, 0, ease.inOut]];

  const t0 = lab.t;
  let now = 0;
  const stop = lab.every((dt, t) => {
    now = t - t0;
    maya.set({ x: key(now, mayaX), lift: key(now, mayaLift), visible: now < T.gone + 0.02 });
    const sy = key(now, theoSy);
    theo.set({ rot: key(now, theoRot), sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy) });
  });

  maya.each = (m) => {
    const b = maya.bot;
    if (b.card) b.card.visible = maya.pose.lift > -0.25;
  };
  const base = new THREE.Color(3.2, 3.1, 2.9);
  theo.each = (m) => {
    // the eye brightens as it swings onto the sofa, and blinks once, slowly
    const facingUs = (1 - Math.cos(theo.pose.rot)) / 2;
    const blink = now > T.blink && now < T.blink + 0.2 ? 1 - Math.sin(((now - T.blink) / 0.2) * Math.PI) * 0.92 : 1;
    m.eyeMat.color.copy(base).multiplyScalar((1 + 1.1 * facingUs ** 2) * blink);
    m.ringMat.opacity = 0.9 * (1 + 0.25 * facingUs);
    m.body.rotation.x = -key(now, theoPitch); // lean the body only: the ring stays flat on the glass
  };

  const camRelease = lab.camera((home) => {
    const z = key(now, zoomK);
    // a hand-held operator: the smallest drift while zoomed in
    const drift = new THREE.Vector3(Math.sin(now * 2.1) * 0.012, Math.sin(now * 2.9 + 1) * 0.008, 0).multiplyScalar(z);
    return { target: home.target.clone().lerp(theoAt, 0.86 * z).add(drift), fov: home.fov * (1 - 0.5 * z) };
  });

  await lab.wait(T.end);
  stop();
  camRelease();
  theo.each = null;
  maya.release({ on: false });
  theo.release({ x: 5, y: 3, d: 0 });
}
