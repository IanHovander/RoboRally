// The big screen's 3D world: an abandoned big-box store after closing time, with the race course
// on the floor and the robots on it. host.js tells it what to show; this file draws and animates.
import * as THREE from './lib/three.module.min.js';
import { EffectComposer } from './lib/effect-composer.js';
import { RenderPass } from './lib/render-pass.js';
import { UnrealBloomPass } from './lib/unreal-bloom-pass.js';
import { OutputPass } from './lib/output-pass.js';
import { DX, DY, turn, getCourse, beltInputs, beamPath, wallEdges } from './board.js';
import { makeRobot } from './bots3d.js';

const TAU = Math.PI * 2;
const BOT_SCALE = 1.18;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- textures drawn on canvases ----------

function canvasTex(w, h, draw, { repeat = false, color = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function grime(g, x, y, w, h, n = 6, alpha = 0.12) {
  for (let i = 0; i < n; i++) {
    const cx = x + Math.random() * w;
    const cy = y + Math.random() * h;
    const r = rand(0.05, 0.4) * Math.min(w, h);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(30,20,10,${alpha * rand(0.4, 1)})`);
    grad.addColorStop(1, 'rgba(30,20,10,0)');
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

function speckle(g, x, y, w, h, n, light = 0.06, dark = 0.1) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${rand(0, light)})` : `rgba(0,0,0,${rand(0, dark)})`;
    g.fillRect(x + Math.random() * w, y + Math.random() * h, rand(1, 3), rand(1, 3));
  }
}

function crack(g, x, y, len, width = 1.2) {
  g.strokeStyle = 'rgba(20,12,8,.55)';
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(x, y);
  let a = rand(0, TAU);
  for (let i = 0; i < 8; i++) {
    a += rand(-0.7, 0.7);
    x += Math.cos(a) * (len / 8);
    y += Math.sin(a) * (len / 8);
    g.lineTo(x, y);
  }
  g.stroke();
}

function hazard(g, x, y, w, h, size = 10) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = '#e8b923';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#151515';
  for (let i = -h; i < w + h; i += size * 2) {
    g.beginPath();
    g.moveTo(x + i, y + h);
    g.lineTo(x + i + size, y + h);
    g.lineTo(x + i + size + h, y);
    g.lineTo(x + i + h, y);
    g.fill();
  }
  g.restore();
}

function gearPath(g, cx, cy, r1, r2, teeth = 10) {
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * TAU;
    const a1 = ((i + 1) / (teeth * 2)) * TAU;
    const r = i % 2 ? r2 : r1;
    g.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    g.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
  }
  g.closePath();
}

const FONT = (px) => `${px}px Teko, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Impact, sans-serif`;
const GLYPH = { m1: '⬆', m2: '⬆⬆', m3: '⬆⬆⬆', bk: '⬇', rr: '↻', rl: '↺', ut: '⟲', pu: '⚡', ag: '⟳', sp: '⚠️', abort: '⏏️' };
const glyph = (t) => GLYPH[t] ?? (/^h\d\d$/.test(t) ? '⚡' : '?');
const CARD_COLOR = { m1: '#1d4f91', m2: '#1d4f91', m3: '#1d4f91', bk: '#3b3f6e', rr: '#146b66', rl: '#146b66', ut: '#5b2e7d', pu: '#8d6b00', ag: '#45474d', sp: '#b3121a' };

/** A playing card floating over a robot: its color, its picture. */
function cardSprite(types) {
  const c = document.createElement('canvas');
  const w = 112 * Math.max(1, types.length) + 16 * (types.length - 1);
  c.width = w;
  c.height = 150;
  const g = c.getContext('2d');
  types.forEach((t, i) => {
    const x = i * 128;
    const hay = /^h\d\d$/.test(t);
    g.fillStyle = hay ? '#1a1a1a' : CARD_COLOR[t] ?? '#444';
    g.strokeStyle = hay ? '#e8b923' : '#ffffff';
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(x + 6, 6, 100, 138, 14);
    g.fill();
    g.stroke();
    g.fillStyle = hay ? '#e8b923' : '#ffffff';
    const text = glyph(t);
    g.font = FONT(text.length > 2 ? 40 : 64);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x + 56, 80);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set(0.46 * (w / 150), 0.46 * (150 / 150) * 1.0, 1);
  sp.renderOrder = 12;
  return sp;
}

/** The course's floor: worn checkerboard, Docking Bay plating, pits, start spaces, tokens. */
function paintFloor(course, S) {
  return canvasTex(course.w * S, course.h * S, (g) => {
    g.clearRect(0, 0, course.w * S, course.h * S);
    for (let y = 0; y < course.h; y++) {
      for (let x = 0; x < course.w; x++) {
        const cell = course.cells[y * course.w + x];
        if (!cell) continue;
        const X = x * S;
        const Y = y * S;
        const dock = course.boards[cell.b]?.dock;
        if (dock) {
          g.fillStyle = '#3c4047';
          g.fillRect(X, Y, S, S);
          g.fillStyle = 'rgba(255,255,255,.07)';
          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
              g.save();
              g.translate(X + (i + 0.5) * (S / 4), Y + (j + 0.5) * (S / 4));
              g.rotate((i + j) % 2 ? 0.8 : -0.8);
              g.fillRect(-S * 0.08, -S * 0.02, S * 0.16, S * 0.04);
              g.restore();
            }
          }
          g.strokeStyle = 'rgba(0,0,0,.5)';
          g.lineWidth = 2;
          g.strokeRect(X + 1, Y + 1, S - 2, S - 2);
        } else {
          g.fillStyle = (x + y) % 2 ? '#cdbf9c' : '#97352a';
          g.fillRect(X, Y, S, S);
          speckle(g, X, Y, S, S, 90);
          grime(g, X, Y, S, S, 4, 0.22);
          if (Math.random() < 0.25) crack(g, X + rand(0, S), Y + rand(0, S), S * 0.6);
          if (Math.random() < 0.25) {
            g.fillStyle = 'rgba(0,0,0,.18)';
            g.beginPath();
            const cx = X + rand(0.1, 0.9) * S;
            const cy = Y + rand(0.1, 0.9) * S;
            for (let k = 0; k < 5; k++) g.lineTo(cx + rand(-6, 6), cy + rand(-6, 6));
            g.fill();
          }
          g.strokeStyle = 'rgba(40,25,15,.45)';
          g.lineWidth = 2;
          g.strokeRect(X + 1, Y + 1, S - 2, S - 2);
        }
        const cx = X + S / 2;
        const cy = Y + S / 2;
        if (cell.k === 'pit') {
          hazard(g, X, Y, S, S, S / 8);
          g.fillStyle = '#050505';
          g.beginPath();
          const m = S * 0.12;
          g.moveTo(X + m, Y + m);
          for (let i = 0; i <= 12; i++) g.lineTo(X + m + (i / 12) * (S - 2 * m), Y + m + rand(-3, 3));
          for (let i = 0; i <= 12; i++) g.lineTo(X + S - m + rand(-3, 3), Y + m + (i / 12) * (S - 2 * m));
          for (let i = 12; i >= 0; i--) g.lineTo(X + m + (i / 12) * (S - 2 * m), Y + S - m + rand(-3, 3));
          for (let i = 12; i >= 0; i--) g.lineTo(X + m + rand(-3, 3), Y + m + (i / 12) * (S - 2 * m));
          g.fill();
          const grad = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.4);
          grad.addColorStop(0, 'rgba(120,20,10,.35)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fillRect(X, Y, S, S);
        } else if (cell.k === 'belt' || cell.k === 'gear') {
          g.fillStyle = '#16171a';
          if (cell.k === 'gear') {
            g.beginPath();
            g.arc(cx, cy, S * 0.46, 0, TAU);
            g.fill();
          } else g.fillRect(X + 2, Y + 2, S - 4, S - 4);
        } else if (cell.k === 'battery') {
          g.fillStyle = '#1c2622';
          g.beginPath();
          g.arc(cx, cy, S * 0.42, 0, TAU);
          g.fill();
          g.strokeStyle = '#6dff72';
          g.lineWidth = S * 0.04;
          g.setLineDash([S * 0.08, S * 0.05]);
          g.beginPath();
          g.arc(cx, cy, S * 0.38, 0, TAU);
          g.stroke();
          g.setLineDash([]);
        } else if (cell.k === 'start') {
          g.strokeStyle = '#f2f2f2';
          g.lineWidth = S * 0.04;
          gearPath(g, cx, cy, S * 0.42, S * 0.34);
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,.08)';
          g.fill();
          g.fillStyle = '#f2f2f2';
          g.font = FONT(Math.round(S * 0.5));
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(cell.n), cx, cy + S * 0.05);
        }
      }
    }
    // laser scorch lines
    for (const L of course.lasers) {
      const path = beamPath(course, L.x, L.y, L.d);
      const a = path[0];
      const b = path[path.length - 1];
      g.strokeStyle = 'rgba(255,40,30,.35)';
      g.lineWidth = S * 0.05 * L.n;
      g.beginPath();
      g.moveTo((a.x + 0.5 - DX[L.d] * 0.45) * S, (a.y + 0.5 - DY[L.d] * 0.45) * S);
      g.lineTo((b.x + 0.5 + DX[L.d] * 0.45) * S, (b.y + 0.5 + DY[L.d] * 0.45) * S);
      g.stroke();
    }
    // reboot tokens
    for (const b of course.boards) {
      if (!b.reboot) continue;
      const cx = (b.reboot.x + 0.5) * S;
      const cy = (b.reboot.y + 0.5) * S;
      g.fillStyle = 'rgba(20,60,120,.6)';
      g.beginPath();
      g.arc(cx, cy, S * 0.42, 0, TAU);
      g.fill();
      g.strokeStyle = '#55b7ff';
      g.lineWidth = S * 0.06;
      g.beginPath();
      g.arc(cx, cy, S * 0.3, 0.4, TAU - 0.4);
      g.stroke();
      const d = b.reboot.d;
      g.fillStyle = '#55b7ff';
      g.beginPath();
      g.moveTo(cx + DX[d] * S * 0.5, cy + DY[d] * S * 0.5);
      g.lineTo(cx + DX[d] * S * 0.3 + DY[d] * S * 0.12, cy + DY[d] * S * 0.3 - DX[d] * S * 0.12);
      g.lineTo(cx + DX[d] * S * 0.3 - DY[d] * S * 0.12, cy + DY[d] * S * 0.3 + DX[d] * S * 0.12);
      g.fill();
      g.font = FONT(Math.round(S * 0.22));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('REBOOT', cx, cy + 2);
    }
  });
}

function storeFloorTex() {
  return canvasTex(1024, 1024, (g, w) => {
    const n = 8;
    const s = w / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? '#8b8270' : '#6e2a22';
        g.fillRect(x * s, y * s, s, s);
        speckle(g, x * s, y * s, s, s, 120, 0.05, 0.16);
        g.strokeStyle = 'rgba(20,10,5,.5)';
        g.lineWidth = 3;
        g.strokeRect(x * s + 1, y * s + 1, s - 2, s - 2);
      }
    }
    grime(g, 0, 0, w, w, 40, 0.35);
    for (let i = 0; i < 14; i++) crack(g, rand(0, w), rand(0, w), rand(60, 200), 2);
  }, { repeat: true });
}

function wallTex() {
  return canvasTex(256, 64, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#8d9792');
    grad.addColorStop(1, '#58625e');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    speckle(g, 0, 0, w, h, 400, 0.08, 0.15);
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fillRect(x, 0, 2, h);
      for (const y of [16, h - 8]) {
        g.fillStyle = 'rgba(0,0,0,.4)';
        g.beginPath();
        g.arc(x + 8, y, 2.5, 0, TAU);
        g.arc(x + 56, y, 2.5, 0, TAU);
        g.fill();
      }
    }
    for (let i = 0; i < 7; i++) {
      const x = rand(0, w);
      const grad2 = g.createLinearGradient(0, 12, 0, h);
      grad2.addColorStop(0, 'rgba(140,60,20,.55)');
      grad2.addColorStop(1, 'rgba(140,60,20,0)');
      g.fillStyle = grad2;
      g.fillRect(x, 12, rand(3, 10), rand(20, 50));
    }
    hazard(g, 0, 0, w, 11, 8);
  });
}

function beltTex(color, arrows) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#17181b';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = 'rgba(255,255,255,.05)';
      g.fillRect(0, y, w, 2);
    }
    g.fillStyle = color;
    for (let i = 0; i < arrows; i++) {
      const y = (i + 0.5) * (h / arrows) + 10;
      g.beginPath();
      g.moveTo(w / 2, y - 26);
      g.lineTo(w / 2 + 34, y + 8);
      g.lineTo(w / 2 + 20, y + 8);
      g.lineTo(w / 2, y - 12);
      g.lineTo(w / 2 - 20, y + 8);
      g.lineTo(w / 2 - 34, y + 8);
      g.closePath();
      g.fill();
    }
  }, { repeat: true });
}

/** A curved belt: comes in from the left (or right) side of the texture and leaves through the top. */
function curveTex(color, fromLeft) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#17181b';
    g.fillRect(0, 0, w, h);
    g.save();
    if (!fromLeft) {
      g.translate(w, 0);
      g.scale(-1, 1);
    }
    g.strokeStyle = color;
    g.lineWidth = 12;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(0, 0, w / 2, 0.05, Math.PI / 2 - 0.25);
    g.stroke();
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(w / 2, 4);
    g.lineTo(w / 2 + 22, 34);
    g.lineTo(w / 2 - 22, 34);
    g.closePath();
    g.fill();
    g.restore();
  });
}

function labelTex(text, { color = '#ffffff', bg = null, font = 64, pad = 18, stroke = '#000', w } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = FONT(font);
  const tw = Math.ceil(g.measureText(text).width);
  c.width = w ?? tw + pad * 2;
  c.height = Math.ceil(font * 1.15 + pad);
  g.font = FONT(font);
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (stroke) {
    g.lineWidth = font * 0.14;
    g.strokeStyle = stroke;
    g.strokeText(text, c.width / 2, c.height / 2 + font * 0.06);
  }
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2 + font * 0.06);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, aspect: c.width / c.height };
}

function sprite(text, opts = {}) {
  const { tex, aspect } = labelTex(text, opts);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: opts.depthTest ?? true }));
  const h = opts.height ?? 0.3;
  s.scale.set(h * aspect, h, 1);
  s.renderOrder = 10;
  return s;
}

// ---------- the arena ----------

export class Arena {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07080b);
    this.scene.fog = new THREE.FogExp2(0x0a0c11, 0.028);
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.useBloom = true;

    this.clock = new THREE.Clock();
    this.time = 0;
    this.board = new THREE.Group();
    this.scene.add(this.board);
    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);
    this.bots = new Map();
    this.effects = []; // { t0, dur, update(k, dt), end() }
    this.belts = [];
    this.gears = new Map();
    this.pushers = new Map();
    this.flags = [];
    this.course = null;
    this.camMode = 'race';
    this.focusOn = null;
    this.frameTimes = [];

    this.buildStore();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 450;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
  }

  // ----- the store around the course -----

  buildStore() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x8fa6c8, 0x2a1410, 0.9));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
    key.position.set(-6, 14, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    s.add(key, key.target);
    this.key = key;
    const rim = new THREE.DirectionalLight(0x6f8fff, 0.6);
    rim.position.set(8, 6, -12);
    s.add(rim);

    // the store's floor, far bigger than the course
    const floorTex = storeFloorTex();
    floorTex.repeat.set(16, 16);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(128, 128), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82, metalness: 0.05, color: 0x9a9a9a }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.42;
    floor.receiveShadow = true;
    s.add(floor);

    // ceiling with fluorescent fixtures (one of them flickers)
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(128, 128), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 11;
    s.add(ceiling);
    this.tubes = [];
    for (let i = 0; i < 18; i++) {
      const x = -24 + (i % 6) * 9.5;
      const z = -26 + Math.floor(i / 6) * 11;
      const on = Math.random() > 0.25;
      const mat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xe8f3ff, emissiveIntensity: on ? 1.6 : 0.05 });
      const tube = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.45), mat);
      tube.position.set(x, 10.7, z);
      s.add(tube);
      this.tubes.push({ mat, base: on ? 1.6 : 0.05, flicker: on && Math.random() < 0.2 });
    }
    for (const [x, z, c] of [[-7, -4, 0xcfe3ff], [7, 2, 0xffe2c0], [0, -14, 0xcfe3ff]]) {
      const p = new THREE.PointLight(c, 60, 26, 1.6);
      p.position.set(x, 8.5, z);
      s.add(p);
    }

    // back wall with the store sign
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 14), new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.95 }));
    wall.position.set(0, 6, -30);
    s.add(wall);
    this.backWall = wall;
    const signTex = canvasTex(1024, 192, (g, w, h) => {
      g.fillStyle = '#120b0a';
      g.fillRect(0, 0, w, h);
      g.font = FONT(170);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ff2a1a';
      g.fillText('ROBO-MART', w / 2, h / 2 + 12);
    });
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 3), new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.4 }));
    this.sign.position.set(4, 8.2, -29.8);
    s.add(this.sign);

    const crateTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#8a6a3f';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        g.fillStyle = `rgba(0,0,0,${rand(0.05, 0.2)})`;
        g.fillRect(0, y, w, 2);
      }
      g.strokeStyle = '#4a361e';
      g.lineWidth = 10;
      g.strokeRect(5, 5, w - 10, h - 10);
      g.beginPath();
      g.moveTo(5, 5);
      g.lineTo(w - 5, h - 5);
      g.stroke();
    });
    const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.9 });
    const boxTex = canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = '#b08a5a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,.15)';
      g.fillRect(w / 2 - 4, 0, 8, h);
    });
    const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.95 });
    this.props = [];
    const prop = (mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      s.add(mesh);
      this.props.push(mesh);
      return mesh;
    };
    for (let i = 0; i < 26; i++) {
      const big = Math.random() < 0.4;
      const size = big ? rand(0.8, 1.1) : rand(0.35, 0.6);
      const m = prop(new THREE.Mesh(new THREE.BoxGeometry(size, size * rand(0.7, 1), size), big ? crateMat : boxMat));
      m.userData.size = size;
      m.rotation.y = rand(0, TAU);
    }
    // shopping carts
    const cartMat = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.9, roughness: 0.35 });
    this.carts = [];
    for (let i = 0; i < 3; i++) {
      const cart = new THREE.Group();
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 1.0), new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.9, roughness: 0.35, wireframe: true }));
      basket.position.y = 0.75;
      cart.add(basket);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72), new THREE.MeshStandardMaterial({ color: 0xd23b2f }));
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, 1.05, 0.55);
      cart.add(handle);
      for (const [x, z] of [[-0.3, -0.42], [0.3, -0.42], [-0.3, 0.42], [0.3, 0.42]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55), cartMat);
        leg.position.set(x, 0.3, z);
        cart.add(leg);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.06, z);
        cart.add(wheel);
      }
      cart.traverse((o) => (o.castShadow = true));
      s.add(cart);
      this.carts.push(cart);
    }

    // drifting dust in the light
    const n = 500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-18, 18);
      pos[i * 3 + 1] = rand(0, 9);
      pos[i * 3 + 2] = rand(-20, 12);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xc9d6ff, size: 0.05, transparent: true, opacity: 0.35, depthWrite: false }));
    s.add(this.dust);
  }

  /** Shelving aisles, pillars, hanging department signs and the Blue Light Special, just past the course. */
  buildAisles(c) {
    if (this.aisles) {
      this.scene.remove(this.aisles);
      this.aisles.traverse((o) => {
        o.geometry?.dispose();
      });
    }
    const s = new THREE.Group();
    this.aisles = s;
    this.scene.add(s);
    const hw = c.w / 2;
    const hh = c.h / 2;
    this.backWall.position.z = -hh - 12;
    this.sign.position.set(hw * 0.3, 6.4, -hh - 11.9);

    const shelfMat = (this.shelfMat ??= new THREE.MeshStandardMaterial({ color: 0x5d646b, metalness: 0.6, roughness: 0.55 }));
    const productColors = [0xd94b3b, 0x3b7bd9, 0xe6c84a, 0x58b368, 0xe9e2d0, 0x8c5bd6, 0x2b2b2b, 0xf08c2e];
    const products = productColors.map(() => []); // one instanced mesh per color: hundreds of boxes, few draw calls
    const shelf = (len, x, z, rot, tipped = 0) => {
      const g = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(len, 2.6, 0.08), shelfMat);
      back.position.y = 1.3;
      back.castShadow = true;
      g.add(back);
      for (let i = 0; i < 4; i++) {
        const board = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.9), shelfMat);
        board.position.y = 0.2 + i * 0.75;
        board.castShadow = true;
        board.receiveShadow = true;
        g.add(board);
        for (let k = 0; k < len * 2.2; k++) {
          if (Math.random() < 0.45) continue; // looted
          const h = rand(0.2, 0.5);
          const p = new THREE.Object3D();
          p.scale.set(rand(0.15, 0.35), h, rand(0.2, 0.4));
          p.position.set(-len / 2 + 0.2 + k * 0.45 + rand(-0.05, 0.05), board.position.y + h / 2 + 0.03, rand(-0.25, 0.25));
          p.rotation.y = rand(-0.3, 0.3);
          g.add(p);
          products[Math.floor(Math.random() * products.length)].push(p);
        }
      }
      for (const sx of [-1, 1]) {
        const end = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.7, 0.95), shelfMat);
        end.position.set((sx * len) / 2, 1.35, 0);
        g.add(end);
      }
      g.position.set(x, -0.42, z);
      g.rotation.y = rot;
      if (tipped) {
        g.rotation.z = tipped;
        g.position.y += 0.25;
      }
      s.add(g);
    };
    // two rows of aisles behind the course, one down each side
    for (const [z, off] of [[-hh - 2.8, 0], [-hh - 6.6, 2.6]]) {
      for (let x = -hw - 8 + off; x < hw + 8; x += 7) shelf(5.4, x, z, 0, Math.random() < 0.08 ? 0.3 : 0);
    }
    for (const sx of [-1, 1]) {
      for (let z = -hh + 1; z < hh + 4; z += 6) shelf(5, sx * (hw + 2.9), z, Math.PI / 2, Math.random() < 0.15 ? sx * 0.35 : 0);
    }
    s.updateMatrixWorld(true);
    const unit = new THREE.BoxGeometry(1, 1, 1);
    products.forEach((list, i) => {
      const inst = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ color: productColors[i], roughness: 0.7 }), list.length);
      list.forEach((p, k) => inst.setMatrixAt(k, p.matrixWorld));
      inst.receiveShadow = true;
      s.add(inst);
    });

    // pillars with yellow safety bands
    const concrete = (this.concrete ??= new THREE.MeshStandardMaterial({ color: 0x6b6862, roughness: 0.95 }));
    const bandMat = (this.bandMat ??= new THREE.MeshStandardMaterial({ color: 0xc8b23a, roughness: 0.7 }));
    for (const [x, z] of [[-hw - 5.6, -hh - 4.7], [hw + 5.6, -hh - 4.7], [-hw - 5.6, hh + 2], [hw + 5.6, hh + 2], [0, -hh - 9.5]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 11.5, 0.9), concrete);
      p.position.set(x, 5.3, z);
      p.castShadow = true;
      s.add(p);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.95), bandMat);
      band.position.set(x, 0.0, z);
      s.add(band);
    }

    // hanging department signs over the back aisles
    const depts = [['HOUSEWARES', '#d23b2f'], ['ELECTRONICS', '#2f6fd2'], ['TOYS', '#d23b2f'], ['GARDEN CENTER', '#2f9e55'], ['APPAREL', '#d23b2f']];
    const span = c.w + 10;
    depts.forEach(([text, col], i) => {
      const x = -span / 2 + ((i + 0.5) * span) / depts.length;
      const tex = canvasTex(512, 128, (g, w, h) => {
        g.fillStyle = '#e9e4da';
        g.fillRect(0, 0, w, h);
        speckle(g, 0, 0, w, h, 500, 0.02, 0.2);
        g.fillStyle = col;
        g.font = FONT(96);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, w / 2, h / 2 + 8);
        grime(g, 0, 0, w, h, 6, 0.35);
      });
      const board = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 0.06), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
      board.position.set(x, 4.3 + (i % 2) * 0.5, -hh - 4.6 - (i % 2) * 1.5);
      board.rotation.z = rand(-0.08, 0.08);
      s.add(board);
      for (const sx of [-1.4, 1.4]) {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 7), new THREE.MeshBasicMaterial({ color: 0x111111 }));
        wire.position.set(x + sx, board.position.y + 3.9, board.position.z);
        s.add(wire);
      }
    });

    // BLUE LIGHT SPECIAL: a beacon on a pole that sweeps the floor with blue light
    const bx = -hw - 1.6;
    const bz = -hh - 1.3;
    const bls = sprite('BLUE LIGHT SPECIAL!', { color: '#a9ccff', stroke: '#06122e', font: 72, height: 0.62 });
    bls.position.set(bx + 0.4, 4.35, bz);
    s.add(bls);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.1), new THREE.MeshStandardMaterial({ color: 0x444a52, metalness: 0.8, roughness: 0.4 }));
    pole.position.set(bx, 1.6, bz);
    s.add(pole);
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.46, 20), new THREE.MeshStandardMaterial({ color: 0x0b1a44, emissive: 0x2f6bff, emissiveIntensity: 3.2, transparent: true, opacity: 0.9 }));
    this.beacon.position.set(bx, 3.8, bz);
    s.add(this.beacon);
    this.blueSpot = new THREE.SpotLight(0x3d7bff, 120, 30, 0.3, 0.6, 1.3);
    this.blueSpot.position.set(bx, 3.9, bz);
    s.add(this.blueSpot, this.blueSpot.target);
  }

  /** Put the props around the course, out of the way. */
  placeProps() {
    const c = this.course;
    const hw = c.w / 2 + 1.6;
    const hh = c.h / 2 + 1.6;
    for (const m of this.props) {
      let x;
      let z;
      for (let tries = 0; tries < 30; tries++) {
        x = rand(-hw - 1.2, hw + 1.2);
        z = rand(-hh - 1.4, hh + 3);
        if (Math.abs(x) > hw || Math.abs(z) > hh) break;
      }
      m.position.set(x, -0.42 + (m.geometry.parameters.height ?? 0.5) / 2, z);
    }
    this.carts.forEach((cart, i) => {
      cart.position.set((i - 1) * (c.w / 2 + 3.5) + rand(-1, 1), -0.42, -hh - rand(1, 4));
      cart.rotation.y = rand(-1, 1);
      if (i === 2) {
        cart.position.set(hw + 1.8, -0.2, rand(-2, 2));
        cart.rotation.set(0, rand(0, TAU), 1.4);
      }
    });
  }

  // ----- the course -----

  pos(x, y) {
    return new THREE.Vector3(x + 0.5 - this.course.w / 2, 0, y + 0.5 - this.course.h / 2);
  }

  setCourse(id) {
    if (this.course?.id === id) return;
    const c = getCourse(id);
    this.course = c;
    for (const obj of [...this.board.children]) this.board.remove(obj);
    this.belts = [];
    this.gears.clear();
    this.pushers.clear();
    this.flags = [];
    const S = 96;

    // raised boards, one slab per board piece
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.7, roughness: 0.45 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.4, roughness: 0.5 });
    for (const b of c.boards) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.4, b.h), slabMat);
      slab.position.set(b.x + b.w / 2 - c.w / 2, -0.21, b.y + b.h / 2 - c.h / 2);
      slab.receiveShadow = true;
      slab.castShadow = true;
      this.board.add(slab);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.04, 0.05, b.h + 0.04), edgeMat);
      lip.position.copy(slab.position);
      lip.position.y = -0.03;
      this.board.add(lip);
    }
    const floorTex = paintFloor(c, S);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), new THREE.MeshStandardMaterial({ map: floorTex, transparent: true, alphaTest: 0.5, roughness: 0.78, metalness: 0.08 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.002;
    top.receiveShadow = true;
    this.board.add(top);

    // pits: a dark well under the floor
    const pitMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 });
    // conveyor belts
    const mats = {};
    const beltMat = (fast) => {
      const k = fast ? 'b' : 'g';
      if (!mats[k]) {
        const t = beltTex(fast ? '#3aa0ff' : '#3ddc84', fast ? 2 : 1);
        mats[k] = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.85 });
        this.belts.push({ tex: t, speed: fast ? 1.1 : 0.55 });
      }
      return mats[k];
    };
    const curveMat = (fast, left) => {
      const k = `${fast}${left}`;
      if (!mats[k]) {
        const t = curveTex(fast ? '#3aa0ff' : '#3ddc84', left);
        mats[k] = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.85 });
      }
      return mats[k];
    };
    const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.85, roughness: 0.35 });
    const gearMats = { 1: new THREE.MeshStandardMaterial({ color: 0x2fae5a, metalness: 0.5, roughness: 0.4 }), [-1]: new THREE.MeshStandardMaterial({ color: 0xc8382c, metalness: 0.5, roughness: 0.4 }) };
    const batteryGlow = new THREE.MeshStandardMaterial({ color: 0x0a1a0a, emissive: 0x6dff72, emissiveIntensity: 2.2 });
    this.batteryMat = batteryGlow;

    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const cell = c.cells[y * c.w + x];
        if (!cell) continue;
        const p = this.pos(x, y);
        if (cell.k === 'pit') {
          const well = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.38, 0.76), pitMat);
          well.position.set(p.x, -0.2, p.z);
          this.board.add(well);
        } else if (cell.k === 'belt') {
          const ins = beltInputs(c, x, y);
          const back = turn(cell.d, 2);
          const side = ins.find((d) => d !== back);
          const curve = side != null && !ins.includes(back);
          const left = side === turn(cell.d, 3);
          const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), curve ? curveMat(cell.fast, left) : beltMat(cell.fast));
          plate.rotation.x = -Math.PI / 2;
          plate.rotation.z = -cell.d * (Math.PI / 2);
          plate.position.set(p.x, 0.012, p.z);
          plate.receiveShadow = true;
          this.board.add(plate);
          if (!curve) {
            // side rails along a straight belt, unless another belt joins from that side
            for (const s of [turn(cell.d, 1), turn(cell.d, 3)]) {
              if (ins.includes(s)) continue;
              const rail = new THREE.Mesh(new THREE.BoxGeometry(DX[s] ? 0.05 : 1, 0.07, DX[s] ? 1 : 0.05), railMat);
              rail.position.set(p.x + DX[s] * 0.47, 0.035, p.z + DY[s] * 0.47);
              rail.castShadow = true;
              this.board.add(rail);
            }
          }
        } else if (cell.k === 'gear') {
          const g = gearMesh(gearMats[cell.spin], cell.spin);
          g.position.set(p.x, 0.0, p.z);
          this.board.add(g);
          this.gears.set(`${x},${y}`, { mesh: g, spin: cell.spin, extra: 0 });
        } else if (cell.k === 'battery') {
          const g = new THREE.Group();
          const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.38, 20), new THREE.MeshStandardMaterial({ color: 0x23272b, metalness: 0.7, roughness: 0.35 }));
          shell.position.y = 0.21;
          shell.castShadow = true;
          g.add(shell);
          for (const by of [0.13, 0.22, 0.31]) {
            const band = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.04, 20), batteryGlow);
            band.position.y = by;
            g.add(band);
          }
          const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xc9c9c9, metalness: 0.9, roughness: 0.3 }));
          capTop.position.y = 0.43;
          g.add(capTop);
          g.position.set(p.x + 0.28, 0, p.z - 0.28);
          g.scale.setScalar(0.8);
          this.board.add(g);
        }
      }
    }

    // walls
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex(), roughness: 0.6, metalness: 0.5 });
    for (const w of wallEdges(c)) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.5, 0.09), wallMat);
      if (w.side === 0) m.position.set(w.x + 0.5 - c.w / 2, 0.25, w.y - c.h / 2);
      else {
        m.position.set(w.x - c.w / 2, 0.25, w.y + 0.5 - c.h / 2);
        m.rotation.y = Math.PI / 2;
      }
      m.castShadow = true;
      m.receiveShadow = true;
      this.board.add(m);
    }

    // wall lasers
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 3 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.4, roughness: 0.4 });
    this.emitters = [];
    for (const L of c.lasers) {
      const side = turn(L.d, 2);
      const p = this.pos(L.x, L.y);
      const g = new THREE.Group();
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.16), housingMat);
      housing.castShadow = true;
      g.add(housing);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.17), new THREE.MeshStandardMaterial({ color: 0xd8261c }));
      stripe.position.y = 0.08;
      g.add(stripe);
      for (let i = 0; i < L.n; i++) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set((i - (L.n - 1) / 2) * 0.12, -0.02, -0.09);
        g.add(lens);
      }
      g.position.set(p.x + DX[side] * 0.38, 0.3, p.z + DY[side] * 0.38);
      g.rotation.y = -L.d * (Math.PI / 2);
      this.board.add(g);
      this.emitters.push(L);
    }

    // push panels
    for (const q of c.pushers) {
      const p = this.pos(q.x, q.y);
      const g = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.36, 0.06), new THREE.MeshStandardMaterial({ map: canvasTex(128, 64, (gg, w, h) => {
        hazard(gg, 0, 0, w, h, 10);
        gg.fillStyle = '#111';
        gg.fillRect(w * 0.18, h * 0.22, w * 0.64, h * 0.56);
        gg.fillStyle = '#ffd43b';
        gg.font = FONT(44);
        gg.textAlign = 'center';
        gg.textBaseline = 'middle';
        gg.fillText(q.regs.join(' '), w / 2, h / 2 + 4);
      }), roughness: 0.6 }));
      g.add(back);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.06), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.85, roughness: 0.3 }));
      plate.position.z = 0.06;
      g.add(plate);
      // the panel sits on wall `side` and faces into the space
      const into = turn(q.side, 2);
      g.position.set(p.x + DX[q.side] * 0.42, 0.22, p.z + DY[q.side] * 0.42);
      g.rotation.y = Math.atan2(DX[into], DY[into]);
      g.traverse((o) => (o.castShadow = true));
      this.board.add(g);
      this.pushers.set(`${q.x},${q.y}`, { plate, out: 0 });
    }

    // checkpoint flags
    for (const cp of c.checkpoints) {
      const p = this.pos(cp.x, cp.y);
      const g = new THREE.Group();
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd43b, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.4 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.06, 32), baseMat);
      base.position.y = 0.03;
      g.add(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.25, 10), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.9, roughness: 0.25 }));
      pole.position.set(-0.24, 0.65, 0.18);
      pole.castShadow = true;
      g.add(pole);
      const flagTex = canvasTex(256, 160, (gg, w, h) => {
        const sq = 32;
        for (let yy = 0; yy < h; yy += sq) for (let xx = 0; xx < w; xx += sq) {
          gg.fillStyle = (xx / sq + yy / sq) % 2 ? '#111' : '#f4f4f4';
          gg.fillRect(xx, yy, sq, sq);
        }
        gg.fillStyle = '#ffd43b';
        gg.beginPath();
        gg.arc(w / 2, h / 2, h * 0.42, 0, TAU);
        gg.fill();
        gg.fillStyle = '#111';
        gg.font = FONT(130);
        gg.textAlign = 'center';
        gg.textBaseline = 'middle';
        gg.fillText(String(cp.n), w / 2, h / 2 + 12);
      });
      const flagGeo = new THREE.PlaneGeometry(0.56, 0.35, 10, 4);
      const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.7 }));
      flag.position.set(0.04, 1.08, 0.18);
      flag.castShadow = true;
      g.add(flag);
      const num = sprite(String(cp.n), { color: '#ffd43b', font: 90, height: 0.42 });
      num.position.set(0, 1.55, 0);
      g.add(num);
      g.position.set(p.x, 0, p.z);
      this.board.add(g);
      this.flags.push({ flag, geo: flagGeo, base: flagGeo.attributes.position.array.slice(), baseMat, n: cp.n });
    }

    // where the key light's shadows reach
    const r = Math.max(c.w, c.h) * 0.75;
    Object.assign(this.key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 50 });
    this.key.shadow.camera.updateProjectionMatrix();
    this.key.position.set(-c.w * 0.35, 14, c.h * 0.7);
    this.buildAisles(c);
    this.placeProps();
    this.fitCamera();
  }

  /** Back the camera off until the whole course fits, looking down at it from the front. */
  fitCamera() {
    if (!this.course) return;
    const c = this.course;
    const cam = this.camera;
    const elev = THREE.MathUtils.degToRad(c.w > c.h * 1.6 ? 44 : 48);
    const target = new THREE.Vector3(0, 0, -c.h * 0.06);
    const corners = [];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      corners.push(new THREE.Vector3((x * c.w) / 2, 0, (z * c.h) / 2), new THREE.Vector3((x * c.w) / 2, 0.9, (z * c.h) / 2));
    }
    let lo = 4;
    let hi = 120;
    for (let i = 0; i < 30; i++) {
      const dist = (lo + hi) / 2;
      cam.position.set(target.x, target.y + Math.sin(elev) * dist, target.z + Math.cos(elev) * dist);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      const fits = corners.every((p) => {
        const v = p.clone().project(cam);
        return Math.abs(v.x) < 0.95 && v.y < 0.66 && v.y > -0.95; // room at the top for the caption and the store
      });
      if (fits) hi = dist;
      else lo = dist;
    }
    this.camHome = { dist: hi, elev, target };
    this.scene.fog.density = 0.3 / hi; // light haze on the course, thicker toward the back of the store
    this.placeCamera(0);
  }

  placeCamera(t) {
    if (!this.camHome) return;
    const { dist, elev, target } = this.camHome;
    let az = Math.sin(t * 0.12) * 0.035;
    let d = dist;
    let tgt = target.clone();
    let el = elev;
    if (this.camMode === 'orbit') {
      az = Math.sin(t * 0.08) * 0.25;
      d = dist * 1.5;
    }
    if (this.focusOn) {
      const b = this.bots.get(this.focusOn);
      if (b) {
        tgt = tgt.lerp(b.group.position, 0.65);
        d = dist * 0.55;
        el = elev + 0.05;
      }
    }
    this.camCur ??= { az, d, tgt: tgt.clone(), el };
    const k = 0.04;
    this.camCur.az += (az - this.camCur.az) * k;
    this.camCur.d += (d - this.camCur.d) * k;
    this.camCur.el += (el - this.camCur.el) * k;
    this.camCur.tgt.lerp(tgt, k);
    const cc = this.camCur;
    // while the setup panel covers the left of the screen, show the course on the right
    const shift = this.camMode === 'orbit' ? 0.2 : 0;
    this.viewShift = (this.viewShift ?? 0) + (shift - (this.viewShift ?? 0)) * 0.06;
    const { width, height } = this.renderer.domElement;
    if (Math.abs(this.viewShift) > 0.002) this.camera.setViewOffset(width, height, -width * this.viewShift, 0, width, height);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();
    this.camera.position.set(cc.tgt.x + Math.sin(cc.az) * Math.cos(cc.el) * cc.d, cc.tgt.y + Math.sin(cc.el) * cc.d, cc.tgt.z + Math.cos(cc.az) * Math.cos(cc.el) * cc.d);
    this.camera.lookAt(cc.tgt);
  }

  // ----- robots -----

  /** Make sure every robot exists and stands where the view says (unless it's mid-animation). */
  syncRobots(list) {
    const seen = new Set();
    for (const r of list) {
      if (r.x == null) continue;
      seen.add(r.id);
      let b = this.bots.get(r.id);
      if (!b) {
        b = this.addBot(r);
        b.x = r.x;
        b.y = r.y;
        b.rot = -r.d * (Math.PI / 2);
        b.visible = r.on !== false;
      }
      b.target = r;
      if (b.color !== r.color) this.recolor(b, r);
      if (b.busyUntil > this.time) continue;
      if (r.on === false) {
        b.visible = false;
        continue;
      }
      if (!b.visible) {
        b.visible = true;
        b.x = r.x;
        b.y = r.y;
        b.rot = -r.d * (Math.PI / 2);
        b.pop = this.time;
      }
      if (b.x !== r.x || b.y !== r.y) this.tween(b, [[b.x, b.y], [r.x, r.y]], 0.35);
      const want = -r.d * (Math.PI / 2);
      const diff = wrapAngle(want - b.rot);
      if (Math.abs(diff) > 0.01) this.turnTo(b, b.rot + diff, 0.35);
    }
    for (const [id, b] of this.bots) {
      if (!seen.has(id)) {
        this.scene.remove(b.group);
        this.bots.delete(id);
      }
    }
  }

  addBot(r) {
    const model = makeRobot(r.seat ?? 0, r.color);
    const g = model.group;
    g.scale.setScalar(BOT_SCALE);
    const tag = sprite(r.name, { color: r.color, font: 64, height: 0.34, stroke: '#000' });
    tag.position.y = 1.08;
    g.add(tag);
    this.scene.add(g);
    const b = { id: r.id, model, group: g, tag, color: r.color, name: r.name, x: r.x, y: r.y, rot: 0, visible: true, busyUntil: 0, anims: [], pop: this.time, fallen: 0 };
    this.bots.set(r.id, b);
    return b;
  }

  recolor(b, r) {
    b.color = r.color;
    b.model.paint.color.set(r.color);
    b.model.glow.emissive.set(r.color);
  }

  tween(b, path, dur, delay = 0) {
    const t0 = this.time + delay;
    b.busyUntil = Math.max(b.busyUntil, t0 + dur);
    b.anims.push({ kind: 'move', t0, dur, path });
  }

  turnTo(b, to, dur, delay = 0) {
    const t0 = this.time + delay;
    b.busyUntil = Math.max(b.busyUntil, t0 + dur);
    b.anims.push({ kind: 'turn', t0, dur, from: null, to });
  }

  // ----- a beat of the Activation Phase -----

  playBeat(beat, robots) {
    const byId = new Map(robots.map((r) => [r.id, r]));
    const moveEnd = new Map();
    for (const f of beat.fx) {
      const b = this.bots.get(f.id ?? f.src);
      switch (f.k) {
        case 'move': {
          if (!b) break;
          const dur = Math.max(0.18, (f.path.length - 1) * 0.33);
          if (f.path.length < 2) {
            this.bump(b);
            break;
          }
          b.visible = true;
          b.x = f.path[0][0];
          b.y = f.path[0][1];
          this.tween(b, f.path, dur);
          moveEnd.set(b.id, dur);
          break;
        }
        case 'turn':
          if (b) this.turnTo(b, b.rot - f.by * (Math.PI / 2), 0.5, 0);
          break;
        case 'fall':
          if (b) this.fall(b, f, moveEnd.get(b.id) ?? 0);
          break;
        case 'reboot':
          if (b) {
            b.visible = true;
            b.x = f.x;
            b.y = f.y;
            b.rot = -(byId.get(b.id)?.d ?? 0) * (Math.PI / 2);
            b.pop = this.time;
            b.busyUntil = this.time + 0.6;
            this.ring(this.pos(f.x, f.y), 0x55b7ff, 0.9);
            this.float(this.pos(f.x, f.y), '↻', '#7cc7ff');
          }
          break;
        case 'beam':
          this.beam(f, b);
          break;
        case 'dmg':
          if (b) {
            const p = b.group.position.clone();
            p.y += 0.45;
            this.sparks(p, 0xffa040, 28);
            this.float(b.group.position, '⚠️'.repeat(Math.min(4, f.sp)) + (f.hw ? '⚡' : ''), f.hw ? '#ffd43b' : '#ff5a4a', 0.15);
            b.hurt = this.time;
          }
          break;
        case 'en':
          if (b) this.float(b.group.position, `+${f.n} ⚡`, '#7cff6b');
          break;
        case 'cp':
          if (b) {
            this.confetti(b.group.position, [0xffd43b, 0xffffff, new THREE.Color(b.color).getHex()], 90);
            this.float(b.group.position, `🏁${f.n}`, '#ffd43b', 0, 0.7);
            const flag = this.flags.find((x) => x.n === f.n);
            if (flag) flag.flash = this.time;
          }
          break;
        case 'say':
          if (b) this.float(b.group.position, f.text, '#ffffff');
          break;
        case 'play':
          if (b) this.showCard(b, f.cards);
          break;
        case 'replace':
          if (b) this.showCard(b, [f.from, f.to].filter(Boolean));
          break;
        case 'shield':
          if (b) this.ring(b.group.position, 0x55b7ff, 0.6);
          break;
        case 'emp':
          if (b) this.ring(b.group.position, 0x9ff7ff, 1.6);
          break;
        case 'gear': {
          const g = this.gears.get(`${f.x},${f.y}`);
          if (g) g.kick = { t0: this.time, from: g.extra, to: g.extra - f.spin * (Math.PI / 2) };
          break;
        }
        case 'pusher': {
          const p = this.pushers.get(`${f.x},${f.y}`);
          if (p) p.kick = this.time;
          break;
        }
        case 'win':
          if (b) {
            this.focusOn = b.id;
            for (let i = 0; i < 4; i++) setTimeout(() => this.confetti(b.group.position, [0xffd43b, 0xffffff, 0xff4d6d, 0x4dabf7, new THREE.Color(b.color).getHex()], 160), i * 500);
          }
          break;
      }
    }
  }

  /** The card a robot is playing, floating over its head for a moment. */
  showCard(b, types) {
    const sp = cardSprite(types);
    sp.visible = false;
    this.fxGroup.add(sp);
    this.effects.push({
      t0: this.time,
      dur: 1.3,
      update: (k) => {
        sp.visible = true;
        const p = b.group.position;
        sp.position.set(p.x, p.y + 1.55 + Math.min(k * 4, 1) * 0.15, p.z);
        sp.material.opacity = k < 0.8 ? Math.min(1, k * 6) : 1 - (k - 0.8) / 0.2;
      },
      end: () => {
        this.fxGroup.remove(sp);
        sp.material.map.dispose();
        sp.material.dispose();
      },
    });
  }

  bump(b) {
    b.anims.push({ kind: 'bump', t0: this.time, dur: 0.25 });
  }

  fall(b, f, delay) {
    const edge = f.edge;
    b.busyUntil = this.time + delay + 1.25;
    b.anims.push({ kind: 'fall', t0: this.time + delay, dur: 1.2, edge });
    setTimeout(() => this.sparks(this.pos(f.x, f.y).setY(0.1), edge ? 0x9aa3ad : 0xff6a30, 24), delay * 1000 + 300);
  }

  beam(f, shooter) {
    const c = this.course;
    let from;
    if (f.board) {
      const side = turn(f.d, 2);
      from = this.pos(f.x0, f.y0).add(new THREE.Vector3(DX[side] * 0.3, 0.3, DY[side] * 0.3));
    } else if (shooter) {
      shooter.model.muzzle.updateWorldMatrix(true, false);
      from = new THREE.Vector3().setFromMatrixPosition(shooter.model.muzzle.matrixWorld);
      shooter.recoil = this.time;
    } else from = this.pos(f.x0, f.y0).setY(0.35);
    const end = this.pos(f.x1, f.y1);
    const hit = f.hit?.length;
    if (!hit) end.add(new THREE.Vector3(DX[f.d] * 0.47, 0, DY[f.d] * 0.47));
    end.y = f.board ? 0.3 : from.y;
    if (hit && !f.board) end.y = 0.35;
    const color = f.board ? 0xff2a1a : new THREE.Color(this.bots.get(f.src)?.color ?? '#ff2a1a').getHex();
    const special = f.special;
    const beamColor = special === 'tractor-beam' || special === 'pressor-beam' ? 0x7cc7ff : special === 'scrambler' ? 0xd57bff : special === 'mini-howitzer' ? 0xffa040 : color;
    const len = from.distanceTo(end);
    const mid = from.clone().add(end).multiplyScalar(0.5);
    const dir = end.clone().sub(from).normalize();
    const group = new THREE.Group();
    const thick = 0.025 + 0.012 * (f.n ?? 1);
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(thick, thick, len, 10, 1, true), new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.35, thick * 0.35, len, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(outer, core);
    group.position.copy(mid);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.fxGroup.add(group);
    const t0 = this.time;
    this.effects.push({
      t0,
      dur: 0.85,
      update: (k) => {
        const flick = 0.75 + Math.random() * 0.25;
        outer.material.opacity = (1 - k) * 0.85 * flick;
        core.material.opacity = (1 - k) * flick;
        group.scale.set(1 - k * 0.5, 1, 1 - k * 0.5);
      },
      end: () => {
        this.fxGroup.remove(group);
        outer.geometry.dispose();
        core.geometry.dispose();
      },
    });
    if (hit) this.sparks(end, beamColor, 22);
  }

  float(at, text, color = '#fff', delay = 0, height = 0.44) {
    if (!text) return;
    const s = sprite(text, { color, font: 64, height, stroke: '#000', depthTest: false });
    const base = at.clone();
    base.y = Math.max(base.y, 0) + 0.95;
    s.position.copy(base);
    s.visible = false;
    this.fxGroup.add(s);
    this.effects.push({
      t0: this.time + delay,
      dur: 1.6,
      update: (k) => {
        s.visible = true;
        s.position.y = base.y + k * 0.7;
        s.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      },
      end: () => {
        this.fxGroup.remove(s);
        s.material.map.dispose();
        s.material.dispose();
      },
    });
  }

  ring(at, color, size) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 48), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = Math.PI / 2;
    m.position.copy(at).setY(0.15);
    this.fxGroup.add(m);
    this.effects.push({
      t0: this.time,
      dur: 0.9,
      update: (k) => {
        m.scale.setScalar(0.4 + k * size * 2);
        m.material.opacity = 1 - k;
      },
      end: () => {
        this.fxGroup.remove(m);
        m.geometry.dispose();
      },
    });
  }

  particles(at, colors, n, { speed = 2.2, up = 2.5, gravity = 6, size = 0.06, dur = 0.9 } = {}) {
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const vel = [];
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y, at.z], i * 3);
      tmp.set(colors[i % colors.length]);
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
      const a = rand(0, TAU);
      const sp = rand(0.3, 1) * speed;
      vel.push([Math.cos(a) * sp, rand(0.3, 1) * up, Math.sin(a) * sp]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fxGroup.add(pts);
    let last = this.time;
    this.effects.push({
      t0: this.time,
      dur,
      update: (k) => {
        const dt = this.time - last;
        last = this.time;
        for (let i = 0; i < n; i++) {
          vel[i][1] -= gravity * dt;
          pos[i * 3] += vel[i][0] * dt;
          pos[i * 3 + 1] = Math.max(0.02, pos[i * 3 + 1] + vel[i][1] * dt);
          pos[i * 3 + 2] += vel[i][2] * dt;
        }
        geo.attributes.position.needsUpdate = true;
        pts.material.opacity = 1 - k * k;
      },
      end: () => {
        this.fxGroup.remove(pts);
        geo.dispose();
      },
    });
  }

  sparks(at, color, n) {
    this.particles(at, [color, 0xffffff], n, { speed: 2.5, up: 2.2 });
  }

  confetti(at, colors, n) {
    const p = at.clone();
    p.y = 1;
    this.particles(p, colors, n, { speed: 2.4, up: 4.5, gravity: 4, size: 0.09, dur: 2.2 });
  }

  /** Big numbers over the start spaces (start phase). picks: { n: color } */
  showStarts(picks) {
    if (!this.course) return;
    const key = JSON.stringify(picks);
    if (this.startKey === key) return;
    this.startKey = key;
    for (const s of this.startTags ?? []) this.board.remove(s);
    this.startTags = [];
    if (!picks) return;
    for (const st of this.course.starts) {
      const color = picks[st.n];
      const s = sprite(String(st.n), { color: color ?? '#ffffff', font: 96, height: 0.55, stroke: '#000' });
      s.position.copy(this.pos(st.x, st.y)).setY(color ? 1.45 : 0.7);
      this.board.add(s);
      this.startTags.push(s);
    }
  }

  // ----- every frame -----

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    const t = this.time;
    this.adapt(dt);

    for (const belt of this.belts) belt.tex.offset.y = (belt.tex.offset.y - dt * belt.speed) % 1;
    for (const g of this.gears.values()) {
      if (g.kick) {
        const k = Math.min(1, (t - g.kick.t0) / 0.5);
        g.extra = g.kick.from + (g.kick.to - g.kick.from) * ease(k);
        if (k >= 1) g.kick = null;
      }
      g.mesh.rotation.y = g.extra - g.spin * t * 0.15;
    }
    for (const p of this.pushers.values()) {
      const k = p.kick ? (t - p.kick) / 0.5 : 1;
      p.plate.position.z = 0.06 + (k < 1 ? Math.sin(k * Math.PI) * 0.35 : 0);
    }
    for (const f of this.flags) {
      const arr = f.geo.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = f.base[i];
        arr[i + 2] = f.base[i + 2] + Math.sin(x * 9 + t * 4) * 0.04 * (x + 0.28);
      }
      f.geo.attributes.position.needsUpdate = true;
      const flash = f.flash ? Math.max(0, 1 - (t - f.flash) / 2) : 0;
      f.baseMat.emissiveIntensity = 0.5 + Math.sin(t * 2 + f.n) * 0.2 + flash * 3;
    }
    if (this.batteryMat) this.batteryMat.emissiveIntensity = 1.8 + Math.sin(t * 3) * 0.6;
    for (const tube of this.tubes) {
      if (tube.flicker) tube.mat.emissiveIntensity = Math.random() < 0.06 ? 0.05 : tube.base;
    }
    this.sign.material.emissiveIntensity = Math.random() < 0.015 ? 0.3 : 1.4;
    const a = t * 1.6;
    const c = this.course;
    if (this.beacon) this.beacon.rotation.y = a * 2;
    if (c && this.blueSpot) this.blueSpot.target.position.set(Math.cos(a * 0.35) * c.w * 0.35, 0, Math.sin(a * 0.35) * c.h * 0.4);
    this.dust.rotation.y = t * 0.01;

    // robots
    for (const b of this.bots.values()) this.animateBot(b, t);
    // effects
    this.effects = this.effects.filter((e) => {
      if (t < e.t0) return true;
      const k = Math.min(1, (t - e.t0) / e.dur);
      e.update(k);
      if (k >= 1) {
        e.end?.();
        return false;
      }
      return true;
    });

    this.placeCamera(t);
    if (this.useBloom) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  animateBot(b, t) {
    let px = b.x;
    let py = b.y;
    let rot = b.rot;
    let lift = 0;
    let tilt = 0;
    let scale = 1;
    let visible = b.visible;
    b.anims = b.anims.filter((an) => {
      if (t < an.t0) return true;
      const k = Math.min(1, (t - an.t0) / an.dur);
      if (an.kind === 'move') {
        const segs = an.path.length - 1;
        const pos = ease(k) * segs;
        const i = Math.min(segs - 1, Math.floor(pos));
        const f = pos - i;
        const [x0, y0] = an.path[i];
        const [x1, y1] = an.path[i + 1];
        px = x0 + (x1 - x0) * f;
        py = y0 + (y1 - y0) * f;
        lift = Math.sin(f * Math.PI) * 0.04;
        if (k >= 1) {
          b.x = an.path[segs][0];
          b.y = an.path[segs][1];
          px = b.x;
          py = b.y;
        }
      } else if (an.kind === 'turn') {
        an.from ??= b.rot;
        rot = an.from + (an.to - an.from) * ease(k);
        if (k >= 1) b.rot = an.to;
      } else if (an.kind === 'bump') {
        tilt = Math.sin(k * Math.PI) * 0.15;
      } else if (an.kind === 'fall') {
        visible = true;
        if (an.edge) {
          lift = -k * k * 3;
          tilt = k * 2.5;
        } else {
          lift = -k * k * 1.2;
          scale = 1 - k * 0.8;
          rot += k * 6;
        }
        if (k >= 1) {
          b.visible = false;
          visible = false;
        }
      }
      return k < 1;
    });
    const g = b.group;
    g.visible = visible;
    if (!visible) return;
    const p = this.pos(px, py);
    const hover = b.model.body.userData.hover ? 0.08 + Math.sin(t * 2.4 + b.id.length) * 0.03 : 0;
    g.position.set(p.x, lift + hover, p.z);
    g.rotation.set(0, rot, 0);
    b.model.body.rotation.x = -tilt;
    const pop = Math.min(1, (t - b.pop) / 0.4);
    g.scale.setScalar(BOT_SCALE * scale * (0.3 + 0.7 * ease(pop)));
    b.model.body.position.y = Math.sin(t * 3 + b.id.length) * 0.008;
    const recoil = b.recoil ? Math.max(0, 1 - (t - b.recoil) / 0.25) : 0;
    b.model.body.position.z = recoil * 0.06;
    for (const s of b.model.spin) s.rotation.y = t * 20;
    if (b.model.eye?.material) {
      const hurt = b.hurt ? Math.max(0, 1 - (t - b.hurt) / 0.6) : 0;
      b.model.eye.material.emissiveIntensity = 2.4 + Math.sin(t * 5) * 0.4 + hurt * 4;
    }
  }

  /** If the computer can't keep up, drop the glow effect and resolution. */
  adapt(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 120) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 1 / 28) {
      if (this.pixelRatio > 1) {
        this.pixelRatio = 1;
        this.renderer.setPixelRatio(1);
        this.resize();
      } else if (this.useBloom) this.useBloom = false;
      else if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false;
        this.scene.traverse((o) => o.material && (o.material.needsUpdate = true));
      }
    }
  }
}


function wrapAngle(a) {
  return ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

function gearMesh(mat, spin) {
  const shape = new THREE.Shape();
  const teeth = 10;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * TAU;
    const a1 = ((i + 1) / (teeth * 2)) * TAU;
    const r = i % 2 ? 0.36 : 0.44;
    const pt = (a) => [Math.cos(a) * r, Math.sin(a) * r];
    if (i === 0) shape.moveTo(...pt(a0));
    else shape.lineTo(...pt(a0));
    shape.lineTo(...pt(a1));
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.1, 0, TAU, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  // an arrow on top showing which way it turns
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 24, Math.PI * 1.3), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: spin > 0 ? 0x3ddc84 : 0xff4a3a, emissiveIntensity: 1.2 }));
  arc.rotation.x = -Math.PI / 2;
  arc.position.y = 0.1;
  g.add(arc);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 10), arc.material);
  const end = Math.PI * 1.3;
  tip.position.set(Math.cos(end) * 0.22, 0.1, -Math.sin(end) * 0.22);
  tip.rotation.set(0, 0, 0);
  tip.rotation.x = Math.PI / 2;
  tip.rotation.z = spin > 0 ? -end : end;
  g.add(tip);
  if (spin < 0) g.scale.x = -1;
  return g;
}
