// probe (temporary)
export const meta = { title: 'probe', idea: 'probe' };
export default async function play(lab) {
  const { THREE } = lab;
  const mk = (x, y, z, c) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3) }));
    m.position.set(x, y, z);
    lab.add(m);
  };
  for (const z of [-2.5, -3, -3.5, -4, -4.5]) for (const x of [-3, -1, 1, 3, 4.5]) mk(x, -1.55, z, z === -3.5 ? '#ff0' : '#0ff');
  for (const z of [-1, 0, 1]) for (const x of [4, 4.5, 5]) mk(x, -1.55, z, '#f0f');
  mk(0.5, 0.3, -0.5, '#fff');
  await lab.wait(0.3);
}
