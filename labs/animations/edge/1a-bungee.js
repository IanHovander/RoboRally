export const meta = { title: 'probe', idea: 'probe' };
export default async function play(lab) {
  const { THREE } = lab;
  await lab.wait(0.1);
  const cam = lab.camera3;
  const out = [];
  out.push(`cam ${cam.position.x.toFixed(2)},${cam.position.y.toFixed(2)},${cam.position.z.toFixed(2)} fov ${cam.fov}`);
  const h = lab.arena.camHome;
  out.push(`home dist ${h.dist.toFixed(2)} elev ${h.elev.toFixed(2)} tgt ${h.target.x.toFixed(2)},${h.target.z.toFixed(2)}`);
  const r = lab.overlay.getBoundingClientRect();
  out.push(`overlay ${r.width}x${r.height}`);
  for (const [x, y, l] of [[6.5, 1, 0], [7, 1, 0], [8, 1, 0], [8.5, 1, 0], [9, 1, 0], [7, 1, -1], [7, 1, -1.6], [-0.5, -0.5, 0], [6.5, 3.5, 0], [6.5, -0.5, 0]]) {
    const v = lab.pos(x, y); v.y = l;
    const s = lab.toScreen(v);
    out.push(`(${x},${y},${l})->${(s.x / r.width).toFixed(2)},${(s.y / r.height).toFixed(2)}`);
  }
  lab.warnings.push(out.join(' | '));
  lab.puppet('a').release({ on: false });
}
