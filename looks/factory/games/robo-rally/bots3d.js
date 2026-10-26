// The robots, built from simple shapes so nothing has to be downloaded. Eight different models;
// each player's robot is painted in their color and stands on a base with an arrow showing which
// way it faces (like the figures in the box). Models face north (-z) before turning.
import * as THREE from './lib/three.module.min.js';
import { RoundedBoxGeometry } from './lib/rounded-box-geometry.js';

const metal = (color, rough = 0.5, metalness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness });
const DARK = metal(0x2a2c31, 0.55, 0.7);
const STEEL = metal(0x8a9099, 0.35, 0.85);
const RUBBER = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.95, metalness: 0.05 });

function box(w, h, d, mat, r = 0.03) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  return m;
}
function at(obj, x, y, z) {
  obj.position.set(x, y, z);
  return obj;
}

/** Tank treads on both sides: [left, right] groups, with wheels. */
function treads(width, length, height, y = height / 2) {
  const out = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    const belt = box(height * 0.8, height, length, RUBBER, height * 0.45);
    g.add(belt);
    for (let i = 0; i < 4; i++) {
      const w = cyl(height * 0.32, height * 0.32, height * 0.82, STEEL, 12);
      w.rotation.z = Math.PI / 2;
      w.position.z = -length / 2 + height * 0.5 + (i * (length - height)) / 3;
      g.add(w);
    }
    g.position.set((side * width) / 2, y, 0);
    out.push(g);
  }
  return out;
}

function eyeMat(color = 0x9ff7ff) {
  return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 2.6, roughness: 0.3 });
}

function barrel(len, r, mat = DARK) {
  const b = cyl(r, r * 1.1, len, mat, 12);
  b.rotation.x = Math.PI / 2;
  return b;
}

/**
 * A robot: returns { group, body, eye, muzzle (Object3D at the gun's tip), spin (parts that spin) }.
 * style 0-7, color is the player's color.
 */
export function makeRobot(style, color) {
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.35 });
  const trim = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.45), roughness: 0.5, metalness: 0.5 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(color), emissiveIntensity: 2.2 });
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const muzzle = new THREE.Object3D();
  const spin = [];
  let eye;

  // the base with the facing arrow
  const base = new THREE.Group();
  const disc = cyl(0.36, 0.38, 0.05, DARK, 32);
  disc.position.y = 0.025;
  base.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 40), glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  base.add(ring);
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.42);
  arrowShape.lineTo(0.13, 0.26);
  arrowShape.lineTo(-0.13, 0.26);
  arrowShape.closePath();
  const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), glow);
  arrow.rotation.x = -Math.PI / 2; // flat on the base, its tip toward north (-z)
  arrow.position.y = 0.056;
  base.add(arrow);
  group.add(base);

  switch (style % 8) {
    case 0: {
      // Tank: treads, hull, turret with a long barrel
      for (const t of treads(0.5, 0.66, 0.2, 0.15)) body.add(t);
      body.add(at(box(0.44, 0.16, 0.58, paint, 0.05), 0, 0.3, 0));
      body.add(at(box(0.46, 0.04, 0.6, trim, 0.02), 0, 0.22, 0));
      const turret = at(box(0.3, 0.16, 0.32, paint, 0.07), 0, 0.46, 0.03);
      body.add(turret);
      eye = at(box(0.2, 0.04, 0.02, eyeMat()), 0, 0.48, -0.14);
      body.add(eye);
      body.add(at(barrel(0.38, 0.035), 0, 0.46, -0.3));
      muzzle.position.set(0, 0.46, -0.5);
      body.add(at(cyl(0.012, 0.012, 0.22, STEEL, 6), 0.1, 0.62, 0.1));
      body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), glow), 0.1, 0.74, 0.1));
      break;
    }
    case 1: {
      // Hulk: a big mech torso on treads, cannons on both arms
      for (const t of treads(0.46, 0.5, 0.18, 0.13)) body.add(t);
      body.add(at(box(0.3, 0.12, 0.3, DARK, 0.03), 0, 0.27, 0));
      body.add(at(box(0.46, 0.3, 0.3, paint, 0.07), 0, 0.47, 0));
      body.add(at(box(0.3, 0.1, 0.06, trim, 0.02), 0, 0.42, -0.16));
      const head = at(box(0.2, 0.13, 0.18, paint, 0.05), 0, 0.68, -0.02);
      body.add(head);
      eye = at(box(0.15, 0.035, 0.02, eyeMat(0xffe27a)), 0, 0.69, -0.115);
      body.add(eye);
      for (const s of [-1, 1]) {
        body.add(at(box(0.12, 0.12, 0.14, trim, 0.04), s * 0.3, 0.55, 0));
        body.add(at(barrel(0.3, 0.04), s * 0.3, 0.46, -0.16));
      }
      muzzle.position.set(0.3, 0.46, -0.32);
      break;
    }
    case 2: {
      // Dome: a round body on a wheeled skirt, one big eye, antenna
      body.add(at(cyl(0.3, 0.34, 0.14, DARK, 24), 0, 0.12, 0));
      for (const s of [-1, 1]) {
        const w = cyl(0.11, 0.11, 0.08, RUBBER, 16);
        w.rotation.z = Math.PI / 2;
        body.add(at(w, s * 0.32, 0.11, 0));
      }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.29, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), paint);
      dome.castShadow = true;
      body.add(at(dome, 0, 0.2, 0));
      body.add(at(cyl(0.3, 0.3, 0.05, trim, 28), 0, 0.21, 0));
      eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), eyeMat(0xff6060));
      body.add(at(eye, 0, 0.37, -0.22));
      body.add(at(cyl(0.012, 0.012, 0.3, STEEL, 6), 0.08, 0.55, 0.06));
      body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), glow), 0.08, 0.71, 0.06));
      body.add(at(barrel(0.18, 0.03), 0, 0.27, -0.3));
      muzzle.position.set(0, 0.27, -0.4);
      break;
    }
    case 3: {
      // Hammer: a boxy hauler with a front ram and a smokestack
      for (const t of treads(0.52, 0.6, 0.18, 0.12)) body.add(t);
      body.add(at(box(0.46, 0.26, 0.48, paint, 0.05), 0, 0.33, 0.04));
      body.add(at(box(0.5, 0.22, 0.08, STEEL, 0.03), 0, 0.22, -0.3));
      for (let i = -2; i <= 2; i++) body.add(at(box(0.05, 0.2, 0.03, DARK, 0.01), i * 0.09, 0.22, -0.34));
      body.add(at(box(0.3, 0.12, 0.2, trim, 0.04), 0, 0.52, 0.08));
      eye = at(box(0.26, 0.05, 0.02, eyeMat(0x7dff9b)), 0, 0.4, -0.2);
      body.add(eye);
      body.add(at(cyl(0.05, 0.06, 0.24, DARK, 12), -0.14, 0.6, 0.18));
      body.add(at(barrel(0.2, 0.03), 0.16, 0.5, -0.12));
      muzzle.position.set(0.16, 0.5, -0.24);
      break;
    }
    case 4: {
      // Spider: a low pod on four legs with a turret
      body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.22, 22, 14), paint), 0, 0.32, 0));
      body.children.at(-1).scale.y = 0.65;
      body.children.at(-1).castShadow = true;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = new THREE.Group();
        const upper = box(0.05, 0.05, 0.26, DARK, 0.02);
        upper.rotation.x = 0.0;
        upper.position.set(0, 0.06, 0.12);
        leg.add(upper);
        const lower = box(0.05, 0.26, 0.05, STEEL, 0.02);
        lower.position.set(0, -0.06, 0.24);
        leg.add(lower);
        leg.position.set(sx * 0.16, 0.26, sz * 0.12);
        leg.rotation.y = Math.atan2(sx, sz);
        body.add(leg);
      }
      body.add(at(cyl(0.12, 0.14, 0.1, trim, 16), 0, 0.46, 0));
      eye = at(box(0.14, 0.04, 0.02, eyeMat(0xff9bf5)), 0, 0.47, -0.12);
      body.add(eye);
      body.add(at(barrel(0.26, 0.028), 0, 0.47, -0.2));
      muzzle.position.set(0, 0.47, -0.34);
      break;
    }
    case 5: {
      // Hover: a saucer that floats, with spinning fans
      const saucer = cyl(0.34, 0.24, 0.12, paint, 32);
      body.add(at(saucer, 0, 0.32, 0));
      body.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.03, 8, 32), glow), 0, 0.32, 0));
      body.children.at(-1).rotation.x = Math.PI / 2;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.75 }));
      body.add(at(cap, 0, 0.38, 0.02));
      eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), eyeMat());
      body.add(at(eye, 0, 0.42, -0.06));
      for (const s of [-1, 1]) {
        const fan = new THREE.Group();
        fan.add(cyl(0.09, 0.09, 0.03, DARK, 16));
        const blade = box(0.16, 0.01, 0.03, STEEL, 0);
        blade.position.y = 0.02;
        fan.add(blade);
        fan.position.set(s * 0.22, 0.24, 0.14);
        spin.push(blade);
        body.add(fan);
      }
      body.add(at(barrel(0.22, 0.03), 0, 0.3, -0.34));
      muzzle.position.set(0, 0.3, -0.46);
      body.userData.hover = true;
      break;
    }
    case 6: {
      // Classic: a TV-headed robot on treads
      for (const t of treads(0.42, 0.46, 0.18, 0.12)) body.add(t);
      body.add(at(box(0.3, 0.24, 0.24, paint, 0.04), 0, 0.33, 0));
      for (const s of [-1, 1]) {
        const arm = box(0.06, 0.24, 0.06, STEEL, 0.03);
        arm.rotation.x = -0.6;
        body.add(at(arm, s * 0.2, 0.32, -0.06));
      }
      const head = at(box(0.3, 0.2, 0.22, DARK, 0.05), 0, 0.57, 0);
      body.add(head);
      eye = at(box(0.22, 0.12, 0.02, eyeMat(0x9ff7ff)), 0, 0.57, -0.11);
      body.add(eye);
      for (const s of [-1, 1]) body.add(at(cyl(0.01, 0.01, 0.14, STEEL, 6), s * 0.08, 0.73, 0));
      body.add(at(barrel(0.2, 0.03), 0.2, 0.24, -0.2));
      muzzle.position.set(0.2, 0.24, -0.32);
      break;
    }
    default: {
      // Crusher: wide wedge with twin guns
      for (const t of treads(0.56, 0.62, 0.17, 0.11)) body.add(t);
      const wedge = box(0.48, 0.18, 0.56, paint, 0.04);
      wedge.rotation.x = 0.12;
      body.add(at(wedge, 0, 0.27, 0.02));
      body.add(at(box(0.26, 0.14, 0.24, trim, 0.05), 0, 0.42, 0.08));
      eye = at(box(0.2, 0.035, 0.02, eyeMat(0xffb35c)), 0, 0.43, -0.04);
      body.add(eye);
      for (const s of [-1, 1]) body.add(at(barrel(0.34, 0.03), s * 0.12, 0.33, -0.28));
      muzzle.position.set(0.12, 0.33, -0.46);
      break;
    }
  }
  body.add(muzzle);
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { group, body, eye, muzzle, spin, paint, glow };
}
