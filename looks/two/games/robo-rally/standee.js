// A robot on the big screen: the player's own printed robot (the same picture as on their phone),
// cut out of card with a white edge, standing on a pointed base in their color. The base's point
// shows which way the robot faces; the cutout turns toward that way and shows its back when it
// faces away, like a cardboard figure in a pop-up book.
import * as THREE from './lib/three.module.min.js';
import { avatar } from '../../js/avatar.js';
import { PAL, canvas, grain, tagCanvas } from './paper.js';

const SIZE = 256; // texture pixels for one cutout
const EDGE = 9; // the white die-cut edge, in texture pixels
export const STANDEE_H = 1.6; // world units (a board space is 1)

const imageCache = new Map(); // key -> Promise<{front, back}>

function svgFor(r, mood) {
  const p = { id: r.id, name: r.name, color: r.color, avatar: r.avatar };
  let svg = String(avatar(p, { mood }));
  svg = svg.replace(/<ellipse[^>]*fill="#000"[^>]*\/>/, ''); // the drop shadow: the base grounds it instead
  svg = svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" `);
  return svg;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function darker(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/** Both faces of a cutout as canvases: the printed front, and a plain colored back. */
export function cutoutImages(r, mood) {
  const key = `${r.color}|${r.avatar ?? ''}|${r.id}|${mood ?? ''}`;
  if (imageCache.has(key)) return imageCache.get(key);
  const job = (async () => {
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgFor(r, mood))}`);
    // silhouette of the robot
    const sil = canvas(SIZE, SIZE);
    const sg = sil.getContext('2d');
    sg.drawImage(img, 0, 0, SIZE, SIZE);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = '#fff';
    sg.fillRect(0, 0, SIZE, SIZE);
    // the die-cut card: the silhouette grown by EDGE, with a faint shadow line where the card ends
    const cut = canvas(SIZE, SIZE);
    const cg = cut.getContext('2d');
    const ring = (radius, tint) => {
      const t = canvas(SIZE, SIZE);
      const tg = t.getContext('2d');
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        tg.drawImage(sil, Math.cos(a) * radius, Math.sin(a) * radius);
      }
      tg.drawImage(sil, 0, 0);
      tg.globalCompositeOperation = 'source-in';
      tg.fillStyle = tint;
      tg.fillRect(0, 0, SIZE, SIZE);
      cg.drawImage(t, 0, 0);
    };
    ring(EDGE + 1.6, '#cbbd9f');
    ring(EDGE, '#fbf6ec');
    const front = canvas(SIZE, SIZE);
    const fg = front.getContext('2d');
    fg.drawImage(cut, 0, 0);
    fg.save();
    fg.globalCompositeOperation = 'source-atop';
    grain(fg, 0, 0, SIZE, SIZE, 0.6);
    fg.restore();
    fg.drawImage(img, 0, 0, SIZE, SIZE);
    // the back: the robot's shape printed solid in the player's color, with an arrow pointing away
    // (you're seeing it from behind, so it's heading into the page)
    const back = canvas(SIZE, SIZE);
    const bg = back.getContext('2d');
    bg.translate(SIZE, 0);
    bg.scale(-1, 1);
    bg.drawImage(cut, 0, 0);
    const solid = canvas(SIZE, SIZE);
    const og = solid.getContext('2d');
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      og.drawImage(sil, Math.cos(a) * 2.6, Math.sin(a) * 2.6);
    }
    og.globalCompositeOperation = 'source-in';
    og.fillStyle = PAL.ink;
    og.fillRect(0, 0, SIZE, SIZE);
    og.globalCompositeOperation = 'source-over';
    const fill = canvas(SIZE, SIZE);
    const fg2 = fill.getContext('2d');
    fg2.drawImage(sil, 0, 0);
    fg2.globalCompositeOperation = 'source-in';
    fg2.fillStyle = darker(r.color, 0.82);
    fg2.fillRect(0, 0, SIZE, SIZE);
    fg2.globalCompositeOperation = 'source-atop';
    fg2.fillStyle = 'rgba(0,0,0,.1)';
    for (let y = 0; y < SIZE; y += 9) fg2.fillRect(0, y, SIZE, 3);
    og.drawImage(fill, 0, 0);
    // where the robot's body is: the middle of its shape
    const px = sg.getImageData(0, 0, SIZE, SIZE).data;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < SIZE; y += 2) for (let x = 0; x < SIZE; x += 2) if (px[(y * SIZE + x) * 4 + 3] > 128) { sx += x; sy += y; n++; }
    const cx = n ? sx / n : SIZE / 2;
    const cy = n ? sy / n : SIZE / 2;
    const k = SIZE * 0.2;
    og.fillStyle = '#fffaf0';
    og.strokeStyle = PAL.ink;
    og.lineWidth = 5;
    og.lineJoin = 'round';
    og.beginPath();
    og.moveTo(cx, cy - k * 0.75);
    og.lineTo(cx + k * 0.7, cy + k * 0.15);
    og.lineTo(cx + k * 0.32, cy + k * 0.15);
    og.lineTo(cx + k * 0.32, cy + k * 0.75);
    og.lineTo(cx - k * 0.32, cy + k * 0.75);
    og.lineTo(cx - k * 0.32, cy + k * 0.15);
    og.lineTo(cx - k * 0.7, cy + k * 0.15);
    og.closePath();
    og.stroke();
    og.fill();
    bg.drawImage(solid, 0, 0);
    return { front, back };
  })();
  imageCache.set(key, job);
  return job;
}

function texFrom(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The pointed base: a cream disc with a colored point toward the robot's front. */
function baseTexture(color) {
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const cx = S / 2;
  const cy = S / 2;
  const R = S * 0.3;
  const tip = S * 0.49;
  const shape = () => {
    g.beginPath();
    const a = 0.55;
    g.moveTo(cx, cy - tip);
    g.arc(cx, cy, R, -Math.PI / 2 + a, -Math.PI / 2 - a + Math.PI * 2);
    g.closePath();
  };
  g.fillStyle = color;
  shape();
  g.fill();
  g.lineWidth = S * 0.025;
  g.strokeStyle = PAL.ink;
  shape();
  g.stroke();
  // a white chevron in the point
  g.fillStyle = '#fffaf0';
  g.beginPath();
  g.moveTo(cx, cy - tip + S * 0.06);
  g.lineTo(cx + S * 0.1, cy - R + S * 0.04);
  g.lineTo(cx, cy - R + S * 0.0);
  g.lineTo(cx - S * 0.1, cy - R + S * 0.04);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,.12)';
  g.beginPath();
  g.arc(cx, cy, R * 0.55, 0, Math.PI * 2);
  g.fill();
  return texFrom(c);
}

let baseGeo = null;
function baseGeometry() {
  if (baseGeo) return baseGeo;
  const shape = new THREE.Shape();
  const R = 0.3;
  const tip = 0.49;
  const a = 0.55;
  shape.moveTo(0, tip);
  shape.absarc(0, 0, R, Math.PI / 2 - a, Math.PI / 2 + a - Math.PI * 2, true);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(-Math.PI / 2); // lie flat, point toward -z (north)
  // top-down UVs so the base texture lines up: x,z in [-0.5,0.5] -> u,v
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) + 0.5, 0.5 - pos.getZ(i));
  uv.needsUpdate = true;
  baseGeo = geo;
  return geo;
}

const planeGeo = new THREE.PlaneGeometry(1, 1);
planeGeo.translate(0, 0.5, 0);

/**
 * Build a robot figure. Returns { group, base, card, front, back, tag, setMood(), setColor(), dispose() }.
 * group sits on the floor at the robot's space; base turns with the robot; card faces the camera.
 */
export function makeStandee(r) {
  const group = new THREE.Group();
  const base = new THREE.Group();
  group.add(base);
  const baseMat = new THREE.MeshStandardMaterial({ map: baseTexture(r.color), roughness: 0.9 });
  const sideMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PAL.paperEdge), roughness: 0.95 });
  const baseMesh = new THREE.Mesh(baseGeometry(), [baseMat, sideMat]);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  base.add(baseMesh);

  // the cutout: two planes back to back, inside a pivot that leans and turns
  const card = new THREE.Group();
  card.position.y = 0.04;
  group.add(card);
  const mkFace = () => {
    const mat = new THREE.MeshStandardMaterial({ transparent: false, alphaTest: 0.5, roughness: 0.85, side: THREE.FrontSide });
    const m = new THREE.Mesh(planeGeo, mat);
    m.scale.set(STANDEE_H, STANDEE_H, 1);
    m.castShadow = true;
    m.receiveShadow = false;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.5 });
    return m;
  };
  const front = mkFace();
  const back = mkFace();
  back.rotation.y = Math.PI;
  back.position.z = -0.004;
  front.position.z = 0.004;
  card.add(front, back);
  front.visible = back.visible = false; // until the picture has loaded

  const fig = { group, base, card, front, back, tag: null, mood: undefined, color: r.color, avatar: r.avatar, disposed: false };

  async function paint(mood) {
    const imgs = await cutoutImages({ ...r, color: fig.color, avatar: fig.avatar }, mood);
    if (fig.disposed || fig.mood !== mood) return;
    for (const [mesh, c] of [[front, imgs.front], [back, imgs.back]]) {
      mesh.material.map?.dispose();
      mesh.material.map = texFrom(c);
      mesh.customDepthMaterial.map = mesh.material.map;
      mesh.material.needsUpdate = true;
      mesh.customDepthMaterial.needsUpdate = true;
      mesh.visible = true;
    }
  }
  fig.setMood = (mood) => {
    if (fig.mood === mood && front.material.map) return;
    fig.mood = mood;
    paint(mood);
  };
  fig.setColor = (color, av) => {
    if (fig.color === color && fig.avatar === av) return;
    fig.color = color;
    fig.avatar = av;
    baseMat.map.dispose();
    baseMat.map = baseTexture(color);
    baseMat.needsUpdate = true;
    paint(fig.mood);
  };
  fig.setName = (name) => {
    if (fig.tag?.userData.name === name) return;
    if (fig.tag) {
      group.remove(fig.tag);
      fig.tag.material.map.dispose();
      fig.tag.material.dispose();
      fig.tag = null;
    }
    if (!name) return;
    const c = tagCanvas(name, { font: 44 });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texFrom(c), transparent: true, depthWrite: false }));
    const h = 0.26;
    sp.scale.set((h * c.width) / c.height, h, 1);
    sp.center.set(0.5, 1);
    sp.position.set(0, 0.02, 0.5);
    sp.renderOrder = 5;
    sp.userData.name = name;
    group.add(sp);
    fig.tag = sp;
  };
  fig.dispose = () => {
    fig.disposed = true;
    for (const m of [front, back]) {
      m.material.map?.dispose();
      m.material.dispose();
      m.customDepthMaterial.dispose();
    }
    baseMat.map?.dispose();
    baseMat.dispose();
    sideMat.dispose();
    if (fig.tag) {
      fig.tag.material.map.dispose();
      fig.tag.material.dispose();
    }
  };
  fig.setMood(undefined);
  return fig;
}
