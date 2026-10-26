// Revolving door, played as character acting: Maya hits the fin at full confidence, it swings her round,
// she gets one hopeful instant on the space she wanted, and the door brings her home. Ava watches it all.
export const meta = {
  title: 'Revolving door (the hopeful one)',
  idea:
    'Maya charges the fin expecting three spaces. It gives like a secret bookcase door and swings her round on its middle: she clings on and leans out, and on the far side, on the space she wanted, the door slows for an instant and she pops up and looks around ("I made it!"). The door whips on, sets her back nose to the fin with a click, and she does a double-take over her shoulder at the ring of light her own trail drew round the wall, then sags. Across the board Ava turns to watch, leans in, flinches at the click and shakes her head.',
  notes:
    'Sound: a soft glass "thup" as she meets the fin, a low airy whoosh for the swing that dips at the far side, one small glass click at the lock. She goes round once per lost step (the card says 3, the path says 2), each extra turn quicker. Rotation is about the fin\'s centre, so geometry alone returns her to (3,1) facing east; the only thing left is her trail\'s circle, which fades on the game\'s own 3.2 s trail clock.',
};

const TAU = Math.PI * 2;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
/** 0 outside [a, b], a smooth hump of height 1 inside */
const hump = (k, a, b) => (k <= a || k >= b ? 0 : Math.sin(((k - a) / (b - a)) * Math.PI));

/** A timeline on absolute seconds from the start, so sequential steps never drift. */
function timeline(lab) {
  const T0 = lab.t;
  const now = () => lab.t - T0;
  const span = (a, b, fn, easing = lab.ease.inOut) =>
    new Promise((ok) => {
      const stop = lab.every(() => {
        const t = now();
        if (t < a) return;
        const k = b <= a ? 1 : Math.min(1, (t - a) / (b - a));
        fn(easing(k), k);
        if (k >= 1) {
          stop();
          ok();
        }
      });
    });
  const at = (T, fn) => lab.at(Math.max(0, T - now()), fn);
  const until = (T) => lab.wait(Math.max(0, T - now()));
  return { now, span, at, until };
}

export default async function play(lab) {
  const { ease } = lab;
  const { span, at, until } = timeline(lab);
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');

  // how many steps the wall ate: the card's count minus the spaces the path really covers
  const fx = lab.scenario.beats[0];
  const move = fx.find((f) => f.k === 'move');
  const cardId = fx.find((f) => f.k === 'play')?.cards?.[0] ?? 'm3';
  const planned = Number(cardId.slice(1)) || 3;
  const start = move.path[0];
  const stop = move.path[move.path.length - 1];
  const lost = Math.max(1, planned - (move.path.length - 1));

  // the fin on the east edge of the stopping space, and the axis it pivots on (its middle)
  const axis = lab.pos(stop[0] + 0.5, stop[1]);
  const fin = lab.arena.board.children.find((o) => o.isGroup && o.children.length === 2 && Math.hypot(o.position.x - axis.x, o.position.z - axis.z) < 0.05);
  const finRot0 = fin ? fin.rotation.y : 0;
  const finMat = fin?.children[0].material;
  const capMat = fin?.children[1].material;
  const finGlow0 = finMat?.emissiveIntensity ?? 0.12;
  const cap0 = capMat?.color.clone();
  const finLight = (glow, cap) => {
    if (finMat) finMat.emissiveIntensity = glow;
    if (capMat && cap0) capMat.color.copy(cap0).multiplyScalar(cap);
  };
  lab.cleanup(() => {
    if (fin) fin.rotation.y = finRot0;
    finLight(finGlow0, 1);
  });

  // their faces: eye brightness, driven by the acting below
  const face = { eye: 1 };
  maya.each = (m) => m.eyeMat.color.setRGB(3.2 * face.eye, 3.1 * face.eye, 2.9 * face.eye);
  const avaFace = { eye: 1 };
  ava.each = (m) => m.eyeMat.color.setRGB(3.2 * avaFace.eye, 3.1 * avaFace.eye, 2.9 * avaFace.eye);

  const R = 0.5; // her centre is half a space from the axis when her nose is on the fin
  const rot0 = maya.pose.rot; // facing east
  const [ex, ey] = stop;
  // where the door has carried her after turning by th (counter-clockwise from above: she swings toward us first)
  const onDoor = (th) => ({ x: ex + 0.5 - R * Math.cos(th), y: ey + R * Math.sin(th), rot: rot0 + th });

  // the beats
  const T_GO = 0.1; // wind-up done
  const T_HIT = 0.54; // nose on the fin
  const T_TURN = 0.6; // the door gives
  const turnDur = lost === 1 ? 0.84 : Math.min(0.5, 0.9 / lost);
  const T_LOCK = T_TURN + lost * turnDur; // click
  const T_LOOK = T_LOCK + 0.24; // the double-take starts
  const T_END = T_LOOK + 0.72;

  lab.playCard('a', [cardId]);

  // ----- Ava, the audience -----
  const avaRot0 = ava.pose.rot;
  const avaAt = { x: ava.pose.x, y: ava.pose.y };
  const lookFrom = (x, y) => avaRot0 + wrap(Math.atan2(-(x - avaAt.x), -(y - avaAt.y)) - avaRot0);
  const watch = lookFrom(ex + 0.5, ey);
  const avaShow = (async () => {
    // the door starts to give: her head snaps round to it
    await span(T_TURN, T_TURN + 0.22, (e) => {
      ava.set({ rot: avaRot0 + (watch - avaRot0) * e, sy: 1 + 0.08 * Math.sin(e * Math.PI) });
      avaFace.eye = 1 + 0.08 * e;
    }, ease.out);
    // she follows Maya round, and leans right in when Maya pops out on the far side
    await span(T_TURN + 0.22, T_LOCK, (e, k) => {
      ava.set({ rot: watch + 0.18 * Math.sin(k * Math.PI), pitch: 0.2 * hump(k, 0.1, 0.9), sy: 1 + 0.05 * hump(k, 0.3, 0.7) });
    }, ease.linear);
    // the click: a little flinch backwards
    await span(T_LOCK, T_LOCK + 0.18, (e, k) => ava.set({ pitch: -0.14 * hump(k, 0, 1), sy: 1 - 0.07 * hump(k, 0, 1), lift: 0.025 * hump(k, 0, 0.6) }), ease.linear);
    // and back to the west, slowly shaking her head
    await span(T_LOOK + 0.08, T_END - 0.06, (e, k) => {
      const shake = Math.sin(k * Math.PI * 4) * 0.22 * (1 - k);
      ava.set({ rot: watch + (avaRot0 - watch) * e + shake, pitch: 0, sy: 1, lift: 0 });
      avaFace.eye = 1.08 - 0.08 * e;
    }, ease.inOut);
  })();

  // ----- Maya -----
  // wind-up: a little crouch and lean back
  await span(0, T_GO, (e) => maya.set({ x: start[0] - 0.05 * e, pitch: -0.14 * e, sy: 1 - 0.08 * e, sx: 1 + 0.05 * e }), ease.out);
  // off she goes and never brakes: she's planning on three
  const x0 = start[0] - 0.05;
  await span(T_GO, T_HIT, (e, k) => {
    const s = 0.42 * k * k + 0.58 * k;
    const lean = clamp01(k * 3);
    maya.set({ x: x0 + (ex - x0) * s, pitch: -0.14 + 0.3 * lean, sy: 0.92 + 0.08 * clamp01(k * 4), sx: 1.05 - 0.05 * clamp01(k * 4), sz: 1 + 0.07 * lean });
  }, ease.linear);

  // contact: the door takes her weight with a small thump before it gives
  await span(T_HIT, T_TURN, (e) => {
    maya.set({ sz: 1.07 - 0.17 * e, sx: 1 + 0.08 * e, pitch: 0.16 + 0.06 * e });
    finLight(finGlow0 + 0.25 * e, 1 + 0.4 * e);
  }, ease.out);

  // the swing: one full turn per lost step. It nearly stops on the far side (her moment of hope), then whips on
  for (let n = 0; n < lost; n++) {
    const first = n === 0;
    const a = T_TURN + n * turnDur;
    await span(a, a + turnDur, (e, k) => {
      const A = first && lost === 1 ? 0.86 : 0.6;
      const f = k + (A * Math.sin(TAU * k)) / TAU; // fast, nearly still at the far side, fast again
      const w = 1 + A * Math.cos(TAU * k); // its speed, relative
      const th = TAU * (n + f);
      const p = onDoor(th);
      if (fin) fin.rotation.y = finRot0 + th;
      // body: surprised at the start, clinging on and leaning out with the speed, then the hopeful pop-up on the far side
      const hope = hump(k, 0.34, 0.66);
      const look = hope * Math.sin(((k - 0.34) / 0.32) * TAU) * 0.5; // a quick look round the new room
      const whoa = first ? hump(k, 0, 0.3) : 0;
      const speed = (w / (1 + A)) ** 2;
      maya.set({
        x: p.x,
        y: p.y,
        rot: p.rot + look,
        pitch: 0.22 * (1 - clamp01(k / 0.1)) * (first ? 1 : 0) - 0.22 * speed * (1 - hope),
        roll: -0.2 * speed * (1 - hope),
        sx: 1 + 0.08 * (1 - clamp01(k / 0.1)) * (first ? 1 : 0) - 0.05 * hope,
        sz: 1 - 0.1 * (1 - clamp01(k / 0.1)) * (first ? 1 : 0),
        sy: 1 + 0.1 * whoa + 0.18 * hope,
        lift: 0.07 * hope,
      });
      face.eye = 1 + 0.35 * whoa + 0.45 * hope - 0.25 * clamp01((k - 0.7) * 4);
      finLight(finGlow0 + 0.15 + 0.12 * w, 1.3 + 0.2 * w);
    }, ease.linear);
  }

  // the lock: the door stops dead, she's jolted the way she was going, and it clicks home
  const home = onDoor(TAU * lost);
  await span(T_LOCK, T_LOCK + 0.16, (e, k) => {
    const wob = Math.exp(-k * 4) * Math.sin(k * Math.PI * 2.4);
    if (fin) fin.rotation.y = finRot0 + 0.06 * wob;
    maya.set({ x: home.x, y: home.y, rot: home.rot + 0.05 * wob, roll: 0.26 * wob, pitch: 0.08 * wob, sz: 1 - 0.07 * hump(k, 0, 0.5), sx: 1, sy: 1, lift: 0 });
    face.eye = 0.55 + 0.45 * k;
    finLight(finGlow0 + 0.3 * (1 - k), 1 + 2.2 * (1 - k) ** 2);
  }, ease.linear);
  if (fin) fin.rotation.y = finRot0;
  finLight(finGlow0, 1);
  maya.set({ roll: 0, pitch: 0, rot: home.rot });

  // a beat of nothing. Then the double-take: a glance back along her path, at the ring of light round her...
  const r = home.rot;
  await span(T_LOOK, T_LOOK + 0.12, (e) => maya.set({ rot: r - 0.75 * e, pitch: -0.06 * e }), ease.out);
  // ...and a snap back to the fin, stretching up: "wait, what?"
  await span(T_LOOK + 0.22, T_LOOK + 0.3, (e) => {
    maya.set({ rot: r - 0.75 + 0.75 * e, sy: 1 + 0.12 * e, sx: 1 - 0.05 * e, pitch: -0.06 - 0.1 * e });
    face.eye = 1 + 0.25 * e;
  }, ease.out);
  // and the sag as it sinks in
  await span(T_LOOK + 0.4, T_END, (e, k) => {
    const sag = Math.sin(k * Math.PI);
    maya.set({ rot: r, sy: 1.12 - 0.12 * e - 0.08 * sag, sx: 0.95 + 0.05 * e + 0.04 * sag, pitch: -0.16 + 0.16 * e + 0.1 * sag });
    face.eye = 1.25 - 0.25 * e - 0.3 * sag;
  }, ease.inOut);

  await avaShow;
  await until(T_END);
  maya.set({ sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, lift: 0 });
  ava.set({ sy: 1, lift: 0, pitch: 0 });
  maya.each = null;
  ava.each = null;
  maya.release({ x: ex, y: ey, d: 1 });
  ava.release({ x: avaAt.x, y: avaAt.y, d: 3 });
  void at;
}
