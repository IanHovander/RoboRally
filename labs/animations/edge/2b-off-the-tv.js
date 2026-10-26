export const meta = { title: 'probe', idea: 'probe' };
export default async function play(lab) {
  await lab.wait(0.1);
  const r = lab.camera3;
  const s = (x, y, l = 0) => { const v = lab.pos(x, y); v.y = l; const p = lab.toScreen(v); return `(${x},${y},${l})->${p.x.toFixed(0)},${p.y.toFixed(0)}`; };
  lab.warnings.push(`size ${JSON.stringify(lab.arena.size)} cam ${r.position.toArray().map((v) => v.toFixed(2))} home ${JSON.stringify({ d: lab.arena.camHome.dist, el: lab.arena.camHome.elev, t: lab.arena.camHome.target })}`);
  lab.warnings.push([s(-0.5, -0.5), s(6.5, -0.5), s(6.5, 3.5), s(-0.5, 3.5), s(6.5, 1), s(8, 1), s(9, 1), s(10, 1), s(11, 1)].join(' '));
  const stop = lab.camera((h) => ({}));
  await lab.wait(0.5);
  lab.warnings.push('withcam ' + [s(-0.5, -0.5), s(6.5, -0.5), s(6.5, 3.5), s(-0.5, 3.5), s(6.5, 1), s(8, 1), s(9, 1), s(10, 1), s(11, 1)].join(' '));
  stop();
  await lab.wait(1.2);
  lab.warnings.push('after ' + [s(-0.5, -0.5), s(6.5, -0.5), s(6.5, 3.5), s(-0.5, 3.5), s(6.5, 1), s(8, 1), s(9, 1), s(10, 1), s(11, 1)].join(' '));
  const m = lab.puppet('a'); m.release({ on: false });
}
