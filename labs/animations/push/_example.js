// An example of the lab API (not an entry): Maya winds up, charges, and Theo gets bonked along.
export const meta = {
  title: 'Example: wind-up and bonk',
  idea: 'Anticipation before the shove, a squash and a flash of light on contact, a skid after.',
};

export default async function play(lab) {
  const { ease, facing, THREE } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');

  // wind-up: lean back and creep backward a hair
  await lab.tween(0.25, (e) => maya.set({ x: 1 - 0.15 * e, pitch: -0.25 * e }), ease.out);
  // charge to contact (her nose reaches Theo at about x = 2.45)
  await lab.tween(0.3, (e) => maya.set({ x: 0.85 + (2.45 - 0.85) * e, pitch: -0.25 + 0.45 * e }), ease.in);
  // contact: slow motion, squash Theo, a ring of light where they meet
  lab.slowmo(0.35, 0.05);
  lab.shake(0.04, 0.25);
  lab.ring(lab.pos(2.55, 2), '#ffffff', 0.5, 0.2, 0.5);
  const glint = theo.model.paint.emissiveIntensity;
  theo.each = (m) => (m.paint.emissiveIntensity = glint + 1.2 * Math.max(0, theo.pose.sy < 1 ? 1 - theo.pose.sy : 0) * 4);
  await lab.tween(0.12, (e) => theo.set({ sx: 1 + 0.25 * e, sy: 1 - 0.2 * e }), ease.out);
  lab.slowmo(1, 0.2);
  // both slide the last space; Theo skids with a wobble and un-squashes
  await lab.tween(
    0.45,
    (e, k) => {
      maya.set({ x: 2.45 + (3 - 2.45) * e, pitch: 0.2 * (1 - e) });
      theo.set({ x: 3 + e, sx: 1.25 - 0.25 * e, sy: 0.8 + 0.2 * ease.outElastic(k), roll: Math.sin(k * 14) * 0.12 * (1 - k), rot: facing(2) + Math.sin(k * 9) * 0.2 * (1 - k) });
    },
    ease.out,
  );
  theo.each = null;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
  void THREE;
}
