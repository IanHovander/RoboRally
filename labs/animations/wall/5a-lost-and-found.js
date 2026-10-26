export const meta = { title: 'debug', idea: 'debug' };
export default async function play(lab) {
  const { THREE } = lab;
  const pts = [];
  for (const [x, z] of [[0, 2.4], [1, 2.6], [2, 2.4], [-2, 2.4], [3, 2.3], [3.9, 1], [3.9, 0], [-3.9, 0], [0, 2.1], [1.5, 2.1]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#00ff00').multiplyScalar(2) }));
    m.position.set(x, -1.55, z);
    lab.add(m);
    pts.push([x, z, m.position.clone()]);
  }
  await lab.wait(0.1);
  for (const [x, z, p] of pts) {
    const s = lab.toScreen(p);
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:${s.x}px;top:${s.y}px;color:#0f0;font:10px monospace`;
    el.textContent = `${x},${z}`;
    lab.overlay.append(el);
  }
  const c = lab.camera3.position;
  lab.warnings.push(`cam ${c.x.toFixed(2)} ${c.y.toFixed(2)} ${c.z.toFixed(2)} fov ${lab.camera3.fov}`);
  await lab.wait(0.5);
}
