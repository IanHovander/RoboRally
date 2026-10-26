// Lumen's robots: six polished forms in the player's color, each with a light (its eye) at the front,
// a thin ring of light on the glass and a pointer showing which way it faces. Built from simple
// shapes, nothing to download. Models face north (-z) before turning.
import * as THREE from './lib/three.module.min.js';
import { RoundedBoxGeometry } from './lib/rounded-box-geometry.js';

const TAU = Math.PI * 2;

/** A soft round glow (white in the middle, clear at the edge), shared by every robot. */
let poolTex = null;
export function glowTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  poolTex.userData.shared = true;
  return poolTex;
}

function mesh(geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  return m;
}

/** The outline of a pebble seen from above, front at +y (it becomes -z). */
function pebbleShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.29 * s);
  sh.bezierCurveTo(0.11 * s, 0.29 * s, 0.31 * s, -0.12 * s, 0.29 * s, -0.22 * s);
  sh.bezierCurveTo(0.27 * s, -0.31 * s, 0.13 * s, -0.33 * s, 0, -0.29 * s);
  sh.bezierCurveTo(-0.13 * s, -0.33 * s, -0.27 * s, -0.31 * s, -0.29 * s, -0.22 * s);
  sh.bezierCurveTo(-0.31 * s, -0.12 * s, -0.11 * s, 0.29 * s, 0, 0.29 * s);
  return sh;
}

/**
 * A robot: { group, body, paint, eyeMat, ringMat, pool, muzzle, setColor(c), hover }.
 * form 0-5 (Pebble, Orb, Prism, Capsule, Cube, Spire); color is the player's color.
 */
export function makeRobot(form, color) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const paint = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.24, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.06, emissive: color, emissiveIntensity: 0.16,
  });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x14171c, roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.1, 2.9) });
  const muzzle = new THREE.Object3D();
  let hover = false;

  switch (form) {
    case 1: {
      // Orb: a sphere floating over a ring
      const orb = mesh(new THREE.SphereGeometry(0.2, 40, 28), paint);
      orb.position.y = 0.36;
      body.add(orb);
      const band = mesh(new THREE.TorusGeometry(0.201, 0.017, 8, 32, 1.3), eyeMat, false);
      band.rotation.x = Math.PI / 2;
      band.rotation.z = -Math.PI / 2 - 0.65;
      band.position.y = 0.38;
      body.add(band);
      const ring = mesh(new THREE.TorusGeometry(0.25, 0.024, 10, 48), dark);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.07;
      group.add(ring);
      muzzle.position.set(0, 0.36, -0.22);
      hover = true;
      break;
    }
    case 2: {
      // Prism: a faceted wedge, its ridge lit
      const tip = [0, 0.04, -0.33];
      const bl = [-0.27, 0.04, 0.22];
      const br = [0.27, 0.04, 0.22];
      const apex = [0, 0.4, 0.08];
      const v = new Float32Array([...tip, ...br, ...apex, ...br, ...bl, ...apex, ...bl, ...tip, ...apex, ...tip, ...bl, ...br]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
      geo.computeVertexNormals();
      const prism = mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04, emissive: color, emissiveIntensity: 0.16, flatShading: true }));
      body.add(prism);
      paint.dispose();
      const ridgeLen = Math.hypot(0, apex[1] - tip[1], apex[2] - tip[2]);
      const ridge = mesh(new THREE.CylinderGeometry(0.012, 0.012, ridgeLen * 0.62, 8), eyeMat, false);
      ridge.position.set(0, tip[1] + (apex[1] - tip[1]) * 0.42, tip[2] + (apex[2] - tip[2]) * 0.42);
      ridge.rotation.x = -Math.atan2(apex[2] - tip[2], apex[1] - tip[1]);
      body.add(ridge);
      muzzle.position.set(0, 0.1, -0.33);
      return finish(form, group, body, prism.material, eyeMat, muzzle, color, hover);
    }
    case 3: {
      // Capsule: a pill lying along its heading, with a lit collar at the front
      const cap = mesh(new THREE.CapsuleGeometry(0.15, 0.3, 10, 28), paint);
      cap.rotation.x = Math.PI / 2;
      cap.position.y = 0.17;
      body.add(cap);
      const collar = mesh(new THREE.TorusGeometry(0.152, 0.016, 8, 36), eyeMat, false);
      collar.position.set(0, 0.17, -0.17);
      body.add(collar);
      muzzle.position.set(0, 0.17, -0.31);
      break;
    }
    case 4: {
      // Cube: a soft block with a visor
      const cube = mesh(new RoundedBoxGeometry(0.42, 0.34, 0.42, 4, 0.08), paint);
      cube.position.y = 0.19;
      body.add(cube);
      const visor = mesh(new RoundedBoxGeometry(0.28, 0.045, 0.02, 2, 0.01), eyeMat, false);
      visor.position.set(0, 0.25, -0.212);
      body.add(visor);
      muzzle.position.set(0, 0.22, -0.22);
      break;
    }
    case 5: {
      // Spire: an obelisk leaning into its heading, a light at its tip
      const disc = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 40), dark);
      disc.position.y = 0.02;
      body.add(disc);
      const spire = mesh(new THREE.ConeGeometry(0.23, 0.66, 4, 1), new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, emissive: color, emissiveIntensity: 0.16, flatShading: true }));
      paint.dispose();
      spire.rotation.y = Math.PI / 4;
      const lean = new THREE.Group();
      lean.add(spire);
      spire.position.y = 0.33;
      lean.rotation.x = -0.3;
      lean.position.z = 0.04;
      body.add(lean);
      const beacon = mesh(new THREE.SphereGeometry(0.035, 14, 10), eyeMat, false);
      beacon.position.set(0, 0.67, 0);
      lean.add(beacon);
      muzzle.position.set(0, 0.42, -0.2);
      return finish(form, group, body, spire.material, eyeMat, muzzle, color, hover);
    }
    default: {
      // Pebble: a smooth rounded arrowhead
      const geo = new THREE.ExtrudeGeometry(pebbleShape(), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 6, curveSegments: 28 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0.08, 0);
      const peb = mesh(geo, paint);
      body.add(peb);
      const eye = mesh(new THREE.CapsuleGeometry(0.016, 0.12, 4, 10), eyeMat, false);
      eye.rotation.z = Math.PI / 2;
      eye.position.set(0, 0.252, -0.13);
      body.add(eye);
      muzzle.position.set(0, 0.16, -0.32);
    }
  }
  return finish(form, group, body, paint, eyeMat, muzzle, color, hover);
}

function finish(form, group, body, paint, eyeMat, muzzle, color, hover) {
  body.add(muzzle);
  // the ring of light on the glass, and a pointer in front
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.385, 0.41, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.006;
  group.add(ring);
  const tri = new THREE.Shape();
  tri.moveTo(0, 0.085);
  tri.lineTo(0.075, -0.02);
  tri.lineTo(-0.075, -0.02);
  tri.closePath();
  const tick = new THREE.Mesh(new THREE.ShapeGeometry(tri), ringMat);
  tick.rotation.x = -Math.PI / 2;
  tick.position.set(0, 0.006, -0.47);
  group.add(tick);
  // the pool of colored light it throws on the glass
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(color).multiplyScalar(0.9), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.004;
  pool.renderOrder = 2;
  group.add(pool);
  group.traverse((o) => {
    if (o.isMesh && o !== pool && o !== ring && o !== tick) o.castShadow = true;
  });
  return {
    form,
    group,
    body,
    paint,
    eyeMat,
    ringMat,
    poolMat,
    muzzle,
    hover,
    setColor(c) {
      paint.color.set(c);
      paint.emissive.set(c);
      ringMat.color.set(c).multiplyScalar(1.6);
      poolMat.color.set(c).multiplyScalar(0.9);
    },
    dispose() {
      group.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          o.material.dispose?.();
        }
      });
    },
  };
}

export { TAU };
