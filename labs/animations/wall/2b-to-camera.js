// To camera, played as character acting: Maya bonks the fin, holds perfectly still, then turns and gives the
// room a deadpan look (with one slow blink). Ava follows her gaze and joins the stare, and is left holding it
// alone when Maya turns back to the wall.
export const meta = {
  title: 'To camera (and Ava gets caught)',
  idea:
    'Maya charges the fin with three spaces in mind and stops dead with a tiny tink. She holds absolutely still. Then she swivels, slowly and mechanically, to face straight out of the TV, leaning back so her eye is square on the sofa and a touch brighter, and holds a deadpan stare at whoever programmed her, with one slow blink. Across the board Ava glances at Maya, follows her gaze and turns to stare at the room too. Maya ticks back to the wall; Ava, suddenly staring at the humans on her own, gives a guilty start and whips back to where she was looking.',
  notes:
    'Sound: one soft glass tink at the fin, then silence through the stare, then a single small tick as Maya turns back (Ava\'s scramble is silent). Nothing glows or flies: the joke is two eyes and timing. The swivel is linear in its middle (a turret, not a dancer) and the stare has no idle bob. In the game, Ava is whichever robot stands nearest; with nobody else on the board Maya plays it alone.',
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
  const until = (T) => lab.wait(Math.max(0, T - now()));
  return { now, span, until };
}

export default async function play(lab) {
  const { ease } = lab;
  const { span, until } = timeline(lab);
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');

  const fx = lab.scenario.beats[0];
  const move = fx.find((f) => f.k === 'move');
  const cardId = fx.find((f) => f.k === 'play')?.cards?.[0] ?? 'm3';
  const start = move.path[0];
  const [ex, ey] = move.path[move.path.length - 1];

  // eyes, driven by the acting
  const face = { eye: 1 };
  maya.each = (m) => m.eyeMat.color.setRGB(3.2 * face.eye, 3.1 * face.eye, 2.9 * face.eye);
  const avaFace = { eye: 1 };
  ava.each = (m) => m.eyeMat.color.setRGB(3.2 * avaFace.eye, 3.1 * avaFace.eye, 2.9 * avaFace.eye);

  const rot0 = maya.pose.rot; // east
  const toRoom = rot0 - Math.PI / 2; // a quarter turn right: straight out of the TV
  const avaRot0 = ava.pose.rot;
  const avaAt = { x: ava.pose.x, y: ava.pose.y };
  const lookFrom = (x, y) => avaRot0 + wrap(Math.atan2(-(x - avaAt.x), -(y - avaAt.y)) - avaRot0);
  const avaToMaya = lookFrom(ex, ey);
  const avaToRoom = lookFrom(avaAt.x, avaAt.y + 10);

  // the beats
  const T_GO = 0.08;
  const T_HIT = 0.5;
  const T_TURN = 0.82; // after a beat of nothing
  const T_STARE = 1.26;
  const T_BACK = 1.86;
  const T_TICK = 2.06;
  const T_END = 2.4;

  lab.playCard('a', [cardId]);

  // ----- Ava -----
  const avaShow = (async () => {
    // the tink: her head flicks round to Maya
    await span(T_HIT + 0.06, T_HIT + 0.26, (e, k) => {
      ava.set({ rot: avaRot0 + (avaToMaya - avaRot0) * e, sy: 1 + 0.05 * hump(k, 0, 1) });
    }, ease.out);
    // Maya turns to the room... Ava looks at her, then where she's looking, and joins the stare
    await span(T_STARE + 0.04, T_STARE + 0.34, (e) => {
      ava.set({ rot: avaToMaya + (avaToRoom - avaToMaya) * e, pitch: -0.24 * e });
      avaFace.eye = 1 + 0.25 * e;
    }, ease.inOut);
    // left staring at the humans on her own: a guilty start...
    await span(T_TICK + 0.1, T_TICK + 0.18, (e, k) => {
      ava.set({ sy: 1 + 0.12 * hump(k, 0, 1), lift: 0.05 * hump(k, 0, 1) });
      avaFace.eye = 1.25 + 0.5 * hump(k, 0, 1);
    }, ease.linear);
    // ...and a quick, casual look back the way she was facing, with a little overshoot
    await span(T_TICK + 0.18, T_END, (e, k) => {
      ava.set({ rot: avaToRoom + (avaRot0 - avaToRoom) * ease.outBack(k), pitch: -0.24 * (1 - e), sy: 1, lift: 0 });
      avaFace.eye = 1.25 - 0.25 * e;
    }, ease.linear);
  })();

  // ----- Maya -----
  // wind-up
  await span(0, T_GO, (e) => maya.set({ x: start[0] - 0.04 * e, pitch: -0.1 * e, sy: 1 - 0.05 * e }), ease.out);
  // off she goes, never braking: she's planning on three
  const x0 = start[0] - 0.04;
  await span(T_GO, T_HIT, (e, k) => {
    const s = 0.4 * k * k + 0.6 * k;
    maya.set({ x: x0 + (ex + 0.05 - x0) * s, pitch: -0.1 + 0.22 * clamp01(k * 3), sy: 0.95 + 0.05 * clamp01(k * 4), sz: 1 + 0.05 * clamp01(k * 3) });
  }, ease.linear);
  // tink: she squashes into the fin and settles back onto her space, then not a twitch
  await span(T_HIT, T_HIT + 0.16, (e, k) => {
    const sq = hump(k, 0, 0.7);
    maya.set({ x: ex + 0.05 * (1 - e), sz: 1 - 0.14 * sq, sx: 1 + 0.06 * sq, sy: 1 + 0.04 * sq, pitch: 0.12 * (1 - e) });
    face.eye = 1 + 0.3 * hump(k, 0, 0.4);
  }, ease.out);
  maya.set({ x: ex, sx: 1, sy: 1, sz: 1, pitch: 0 });

  // the swivel: slow, even, a little mechanical; she leans back so her eye finds the lens
  await span(T_TURN, T_STARE, (e, k) => {
    const turn = k < 0.15 ? (k / 0.15) ** 2 * 0.075 : k > 0.85 ? 1 - ((1 - k) / 0.15) ** 2 * 0.075 : 0.075 + ((k - 0.15) / 0.7) * 0.85;
    maya.set({ rot: rot0 + (toRoom - rot0) * turn, pitch: -0.4 * ease.inOut(clamp01((k - 0.3) / 0.7)), lift: 0.015 * e });
    face.eye = 1 + 0.55 * clamp01((k - 0.5) / 0.5);
  }, ease.linear);

  // the stare. Dead still. One slow blink in the middle of it.
  await span(T_STARE, T_BACK, (e, k) => {
    const blink = k < 0.42 || k > 0.62 ? 0 : k < 0.48 ? (k - 0.42) / 0.06 : k < 0.52 ? 1 : 1 - (k - 0.52) / 0.1;
    face.eye = 1.55 * (1 - 0.96 * blink);
    maya.set({ sy: 1 - 0.02 * blink });
  }, ease.linear);

  // and back to the wall, briskly, as if nothing happened. Tick.
  await span(T_BACK, T_TICK, (e) => {
    maya.set({ rot: toRoom + (rot0 - toRoom) * e, pitch: -0.4 * (1 - e), lift: 0.015 * (1 - e), sy: 1 });
    face.eye = 1.55 - 0.55 * e;
  }, ease.inOut);
  await span(T_TICK, T_TICK + 0.12, (e, k) => maya.set({ rot: rot0, sz: 1 - 0.04 * hump(k, 0, 1), pitch: 0.04 * hump(k, 0, 1) }), ease.linear);

  await avaShow;
  await until(T_END);
  maya.set({ sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, lift: 0, rot: rot0 });
  ava.set({ sy: 1, lift: 0, pitch: 0 });
  maya.each = null;
  ava.each = null;
  maya.release({ x: ex, y: ey, d: 1 });
  ava.release({ x: avaAt.x, y: avaAt.y, d: 3 });
}
