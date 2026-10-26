// Rear-ended by her own trail, played as character acting: Maya bonks the fin, collects herself with as much
// dignity as a pebble can muster, and is whacked from behind by her own trail. She whirls round to glare at it
// while Ava, across the board, tries very hard not to laugh.
export const meta = {
  title: 'Rear-ended (dignity, interrupted)',
  idea:
    'Maya stops dead against the fin: tink. She gives a little head-shake, then straightens up and lifts her chin as if she meant to stop there. Behind her the trail has not got the news: its tail cracks up the line like a whip, a bright knot racing toward her back, and slaps her nose-first into the fin a second time (tink... TINK). The spent trail crumples into an accordion on the space behind her. Maya whirls round and glares at it until it fades out of existence, then turns back to the wall in a huff. Ava doubles up with silent laughter, and snaps to innocence the moment Maya\'s gaze sweeps past her.',
  notes:
    'Sound: a small glass tink, a rising airy "fwip" as the trail cracks forward, a second, brighter tink, then a soft crinkle as the trail folds. The whip and the crumple are made from her real trail points (resampled), so they carry her colour and Lumen\'s trail look; the knot at the tip is the only extra light. Maya ends on (3,1) facing east and the trail is gone (the game would draw a fresh one on her next move).',
};

const TAU = Math.PI * 2;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
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

/** A soft round glow (canvas texture), as a sprite. */
function glow(THREE, color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  s.renderOrder = 5;
  return s;
}

export default async function play(lab) {
  const { ease, THREE } = lab;
  const { now, span, until } = timeline(lab);
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const bot = maya.bot;

  const fx = lab.scenario.beats[0];
  const move = fx.find((f) => f.k === 'move');
  const cardId = fx.find((f) => f.k === 'play')?.cards?.[0] ?? 'm3';
  const start = move.path[0];
  const [ex, ey] = move.path[move.path.length - 1];
  const here = lab.pos(ex, ey);
  const dirX = Math.sign(ex - start[0]) || 1; // she drives along x (east here)

  const face = { eye: 1 };
  maya.each = (m) => m.eyeMat.color.setRGB(3.2 * face.eye, 3.1 * face.eye, 2.9 * face.eye);
  const avaFace = { eye: 1 };
  ava.each = (m) => m.eyeMat.color.setRGB(3.2 * avaFace.eye, 3.1 * avaFace.eye, 2.9 * avaFace.eye);

  const rot0 = maya.pose.rot; // east
  const avaRot0 = ava.pose.rot;
  const avaAt = { x: ava.pose.x, y: ava.pose.y };
  const lookFrom = (x, y) => avaRot0 + wrap(Math.atan2(-(x - avaAt.x), -(y - avaAt.y)) - avaRot0);
  const avaToMaya = lookFrom(ex, ey);

  // the beats
  const T_GO = 0.08;
  const T_HIT = 0.5; // tink
  const T_WHIP = 0.7; // a heartbeat later the trail's tail sets off
  const T_SLAP = 1.06; // TINK
  const T_TURN = 1.32; // she whirls round
  const T_HUFF = 1.8; // and back to the wall
  const T_END = 2.22;

  lab.playCard('a', [cardId]);

  // ----- the trail: a whip, then an accordion -----
  const knot = lab.add(glow(THREE, new THREE.Color(bot.color).lerp(new THREE.Color('#fff'), 0.55).multiplyScalar(1.7), 0.3));
  knot.visible = false;
  const trailShow = (async () => {
    await until(T_WHIP);
    // resample her real trail densely (it was laid down a point per frame), keeping its age
    const raw = bot.trail.slice();
    if (raw.length < 2) return;
    const head = raw[raw.length - 1];
    const N = 64;
    const len = Math.abs(head.x - raw[0].x);
    const pts = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = raw[0].x + (head.x - raw[0].x) * u;
      // its age where it was laid down
      let j = 0;
      while (j < raw.length - 2 && Math.abs(raw[j + 1].x - raw[0].x) < Math.abs(x - raw[0].x)) j++;
      const a = raw[j];
      const b = raw[j + 1];
      const f = clamp01(Math.abs(x - a.x) / (Math.abs(b.x - a.x) || 1));
      pts.push({ x, z: head.z, t: lerp(a.t, b.t, f), d0: (head.x - x) * dirX, t0: lerp(a.t, b.t, f) });
    }
    bot.trail = pts;
    const backD = 0.3; // her back, behind her centre
    // the whip: the tail tip F races toward her back, accelerating; points behind it are gathered into the knot
    await span(T_WHIP, T_SLAP, (e, k) => {
      const F = lerp(len, backD, k ** 2.2);
      const t = lab.t;
      for (const p of pts) {
        if (p.d0 >= F) {
          // gathered at the tip, packed tight
          const into = (p.d0 - F) / Math.max(0.001, len - F + 0.001);
          p.x = head.x - dirX * (F + 0.08 * into);
          p.z = head.z;
          p.t = t - 2.9; // a dim bundle: the knot sprite carries the light
        } else {
          // the line ahead of the tip: a travelling loop, and the whole line gets hotter as the tip comes
          const ahead = F - p.d0;
          const loop = ahead < 0.7 ? Math.sin((ahead / 0.7) * Math.PI) * 0.17 * (0.5 + 0.5 * e) : 0;
          p.x = head.x - dirX * p.d0;
          p.z = head.z - loop;
          p.t = lerp(p.t0, t, 0.5 + 0.5 * k);
        }
      }
      knot.visible = true;
      knot.position.set(head.x - dirX * F, 0.05, head.z);
      knot.scale.setScalar(0.26 + 0.2 * e);
      knot.material.opacity = 0.6 + 0.4 * e;
    }, ease.linear);

    // the slap: a flash of her colour at her back
    knot.scale.setScalar(0.45);
    lab.ring(new THREE.Vector3(head.x - dirX * backD, 0, head.z), bot.color, 0.4, 0.06, 0.4);
    // the crumple: the spent trail folds into an accordion on the space behind her, then fades
    const folds = 5;
    const zig = (u) => {
      const w = (u * folds * 2) % 2;
      return w < 1 ? w : 2 - w; // a triangle wave 0..1
    };
    await span(T_SLAP, T_SLAP + 0.26, (e, k) => {
      const t = lab.t;
      pts.forEach((p, i) => {
        const u = i / (N - 1); // 0 = tail end
        const tx = head.x - dirX * lerp(1.0, 0.38, u);
        const tz = head.z + (zig(u) - 0.5) * 0.36 * (1 - 0.25 * e);
        const fromX = head.x - dirX * backD;
        p.x = lerp(fromX, tx, e);
        p.z = lerp(head.z, tz, e);
        p.t = t - 1.3;
      });
      knot.scale.setScalar(0.45 * (1 - k) + 0.01);
      knot.material.opacity = 1 - k;
    }, ease.outBack);
    knot.visible = false;
    // it sags flat as Maya glares at it, and fades out of existence
    await span(T_SLAP + 0.26, T_HUFF + 0.05, (e, k) => {
      const t = lab.t;
      pts.forEach((p, i) => {
        const u = i / (N - 1);
        p.z = head.z + (zig(u) - 0.5) * 0.36 * 0.75 * (1 - 0.45 * e);
        p.t = t - 1.3 - 1.65 * e; // its age runs out
      });
    }, ease.in);
    bot.trail = [];
  })();

  // ----- Ava -----
  const avaShow = (async () => {
    // the first tink: her head flicks round to Maya
    await span(T_HIT + 0.06, T_HIT + 0.24, (e, k) => ava.set({ rot: avaRot0 + (avaToMaya - avaRot0) * e, sy: 1 + 0.04 * hump(k, 0, 1) }), ease.out);
    // the slap: a flinch...
    await span(T_SLAP + 0.02, T_SLAP + 0.12, (e, k) => {
      ava.set({ sy: 1 - 0.08 * hump(k, 0, 1), pitch: -0.12 * hump(k, 0, 1) });
      avaFace.eye = 1 + 0.4 * hump(k, 0, 1);
    }, ease.linear);
    // ...then doubled up with silent giggles
    await span(T_SLAP + 0.12, T_HUFF + 0.02, (e, k) => {
      const shake = Math.sin(k * TAU * 6.5);
      const on = clamp01(k * 6) * clamp01((1 - k) * 12);
      ava.set({ pitch: 0.2 * on, sy: 1 + 0.04 * shake * on, roll: 0.05 * Math.sin(k * TAU * 3.25) * on, lift: 0.015 * Math.abs(shake) * on });
      avaFace.eye = 1 + 0.35 * on * (0.5 + 0.5 * shake);
    }, ease.linear);
    // Maya's glare sweeps past: instant innocence, then she looks away the way she was facing
    await span(T_HUFF + 0.02, T_HUFF + 0.1, (e) => {
      ava.set({ pitch: 0, roll: 0, lift: 0, sy: 1 + 0.06 * e });
      avaFace.eye = 1;
    }, ease.out);
    await span(T_HUFF + 0.14, T_END, (e) => ava.set({ rot: avaToMaya + (avaRot0 - avaToMaya) * e, sy: 1.06 - 0.06 * e }), ease.inOut);
  })();

  // ----- Maya -----
  await span(0, T_GO, (e) => maya.set({ x: start[0] - 0.04 * e, pitch: -0.1 * e, sy: 1 - 0.05 * e }), ease.out);
  const x0 = start[0] - 0.04;
  await span(T_GO, T_HIT, (e, k) => {
    const s = 0.4 * k * k + 0.6 * k;
    maya.set({ x: x0 + (ex + 0.04 - x0) * s, pitch: -0.1 + 0.22 * clamp01(k * 3), sy: 0.95 + 0.05 * clamp01(k * 4), sz: 1 + 0.05 * clamp01(k * 3) });
  }, ease.linear);
  maya.set({ trail: false }); // from here the trail is the whip's

  // tink: a small squash and a recoil off the fin
  await span(T_HIT, T_HIT + 0.14, (e, k) => {
    const sq = hump(k, 0, 0.6);
    maya.set({ x: ex + 0.04 - 0.08 * e, sz: 1 - 0.13 * sq, sx: 1 + 0.06 * sq, pitch: 0.12 * (1 - e) });
    face.eye = 1 + 0.4 * hump(k, 0, 0.35);
  }, ease.out);
  // shakes it off, then straightens up, chin high: "meant to do that"
  const xR = ex - 0.04;
  await span(T_HIT + 0.14, T_SLAP, (e, k) => {
    const shake = Math.sin(clamp01(k / 0.5) * TAU * 1.5) * 0.14 * (1 - clamp01(k / 0.5));
    const proud = ease.inOut(clamp01((k - 0.4) / 0.45));
    maya.set({ x: xR, rot: rot0 + shake, pitch: -0.17 * proud, sy: 1 + 0.08 * proud, sx: 1 - 0.03 * proud, sz: 1 });
    face.eye = 1 + 0.15 * proud;
  }, ease.linear);

  // TINK: slapped nose-first into the fin
  await span(T_SLAP, T_SLAP + 0.12, (e, k) => {
    const hit = clamp01(k / 0.35);
    const sq = hump(k, 0.2, 1);
    maya.set({ x: lerp(xR, ex + 0.07, ease.out(hit)), rot: rot0, pitch: lerp(-0.17, 0.3, ease.out(hit)), sy: lerp(1.08, 0.9, hit), sz: 1 - 0.2 * sq, sx: 1 + 0.08 * sq, roll: 0.06 * sq });
    face.eye = 1 + 1.0 * hump(k, 0, 0.6);
  }, ease.linear);
  // bounce back onto her space
  await span(T_SLAP + 0.12, T_TURN, (e) => maya.set({ x: lerp(ex + 0.07, ex, e), pitch: 0.3 * (1 - e), sy: 0.9 + 0.1 * e, sz: 1, sx: 1, roll: 0.06 * (1 - e) }), ease.outBack);

  // whirls round over her shoulder to glare at it
  const glare = rot0 - 2.25;
  await span(T_TURN, T_TURN + 0.18, (e) => {
    maya.set({ rot: lerp(rot0, glare, e), pitch: 0.12 * e, sy: 1 - 0.07 * e, roll: 0 });
    face.eye = 1 + 0.8 * e;
  }, ease.out);
  // the glare, with one indignant jab at it
  await span(T_TURN + 0.18, T_HUFF, (e, k) => {
    const jab = hump(k, 0.25, 0.55);
    maya.set({ rot: glare, pitch: 0.12 + 0.14 * jab, x: ex - dirX * 0.05 * jab, sy: 0.93 - 0.04 * jab });
    face.eye = 1.8 + 0.5 * jab;
  }, ease.linear);
  // and back to the wall in a huff
  await span(T_HUFF, T_HUFF + 0.24, (e) => {
    maya.set({ rot: lerp(glare, rot0, e), pitch: 0.12 * (1 - e), sy: 0.93 + 0.07 * e, x: ex });
    face.eye = 1.8 - 0.8 * e;
  }, ease.inOut);
  await span(T_HUFF + 0.24, T_END, (e, k) => maya.set({ rot: rot0, sy: 1 + 0.05 * hump(k, 0, 1), sx: 1 - 0.02 * hump(k, 0, 1) }), ease.linear);

  await trailShow;
  await avaShow;
  await until(T_END);
  maya.set({ sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, lift: 0, rot: rot0, x: ex });
  ava.set({ sy: 1, lift: 0, pitch: 0, roll: 0 });
  maya.each = null;
  ava.each = null;
  maya.release({ x: ex, y: ey, d: 1 });
  ava.release({ x: avaAt.x, y: avaAt.y, d: 3 });
  void now;
  void here;
}
