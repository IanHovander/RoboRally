// Render animations to video, frame by frame (so it's smooth even on a slow machine without a GPU).
//   node labs/animations/render.mjs <scenario>/<file>.js [more.js ...] [--preview] [--every 0.125]
//   node labs/animations/render.mjs push/baseline          the game's current animation for a scenario
// Writes labs/animations/out/<scenario>/<name>.mp4 (not with --preview), <name>.sheet.jpg (frames every
// --every seconds, with timestamps) and <name>.json (length and warnings). Prints a summary line each.
// --preview: 640x360, sheet only, fast. Only a few renders run at once machine-wide (LAB_RENDER_SLOTS, default 3).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { serve } from './serve.mjs';

// Playwright is installed globally on this machine (require() finds it, ESM import doesn't)
const { chromium } = createRequire(import.meta.url)('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const FPS = 30;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const preview = flag('preview');
const every = Number(opt('every', preview ? 0.125 : 0.25));
const [W, H] = preview ? [640, 360] : [960, 540];
const targets = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] === '--every'));
if (!targets.length) {
  console.log('usage: node labs/animations/render.mjs <scenario>/<file>.js [...] [--preview] [--every sec]');
  process.exit(1);
}

// ----- a machine-wide limit on simultaneous renders (several agents share this computer) -----
const SLOTS = Number(process.env.LAB_RENDER_SLOTS ?? 3);
const SLOT_DIR = path.join(OUT, '.slots');
fs.mkdirSync(SLOT_DIR, { recursive: true });
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
let mySlot = null;
async function acquire() {
  for (let waited = 0; ; waited++) {
    for (let i = 0; i < SLOTS; i++) {
      const dir = path.join(SLOT_DIR, `slot-${i}`);
      try {
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, 'pid'), String(process.pid));
        mySlot = dir;
        return;
      } catch {
        let pid = 0;
        try {
          pid = Number(fs.readFileSync(path.join(dir, 'pid'), 'utf8'));
        } catch {}
        const age = Date.now() - (fs.statSync(dir, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
        if ((pid && !alive(pid)) || (!pid && age > 10000) || age > 10 * 60 * 1000) fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    if (waited === 0) console.log(`waiting for a render slot (${SLOTS} in use)...`);
    await new Promise((r) => setTimeout(r, 700));
  }
}
const release = () => mySlot && fs.rmSync(mySlot, { recursive: true, force: true });
process.on('exit', release);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

// ----- rendering -----
function resolveTarget(t) {
  let rel = t.replace(/\\/g, '/');
  if (rel.endsWith('/baseline') || rel.endsWith('/baseline.js')) {
    const scenario = rel.split('/').filter(Boolean).slice(-2, -1)[0];
    return { scenario, name: 'baseline', anim: 'baseline' };
  }
  const abs = path.resolve(fs.existsSync(path.resolve(t)) ? path.resolve(t) : path.join(HERE, t));
  if (!fs.existsSync(abs)) throw new Error(`can't find ${t}`);
  rel = path.relative(HERE, abs).replace(/\\/g, '/');
  const scenario = rel.split('/').slice(-2, -1)[0];
  return { scenario, name: path.basename(abs, '.js'), anim: `/labs/animations/${rel}` };
}

async function renderOne(browser, port, t) {
  const { scenario, name, anim } = resolveTarget(t);
  const dir = path.join(OUT, scenario);
  const tmp = path.join(OUT, '.frames', `${scenario}-${name}-${process.pid}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const url = `http://127.0.0.1:${port}/labs/animations/stage.html?capture=1&scenario=${scenario}&anim=${encodeURIComponent(anim)}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__lab?.ready || window.__lab?.error, null, { timeout: 60000 }).catch(() => {});
  const ready = await page.evaluate(() => !!window.__lab?.ready);
  if (!ready) {
    await page.close();
    const why = errors.join('\n') || 'the stage never became ready';
    console.log(`✗ ${scenario}/${name}: ${why}`);
    return { scenario, name, ok: false, errors };
  }
  const sampleEvery = Math.max(1, Math.round(every * FPS));
  const sheetFrames = [];
  let n = 0;
  const started = Date.now();
  for (;;) {
    const keep = !preview || n % sampleEvery === 0;
    const done = await page.evaluate((draw) => window.__lab.step(draw), keep);
    if (keep) {
      const file = path.join(tmp, `f${String(n).padStart(5, '0')}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: preview ? 80 : 90 });
      if (n % sampleEvery === 0) sheetFrames.push({ file, t: n / FPS });
    }
    n++;
    if (done || n > FPS * 40) break;
  }
  const info = await page.evaluate(() => ({ warnings: window.__lab.warnings, play: window.__lab.play, meta: window.__lab.meta, error: window.__lab.error }));
  await page.close();

  // contact sheet: the sampled frames in a grid with their timestamps
  const cols = preview ? 6 : 5;
  const tw = preview ? 320 : 384;
  const th = Math.round((tw * H) / W);
  const rel = (f) => `/labs/animations/${path.relative(HERE, f).replace(/\\/g, '/')}`;
  const cells = sheetFrames.map((f) => `<div class="c"><img src="${rel(f.file)}"><b>${f.t.toFixed(2)}s</b></div>`).join('');
  const sheetPage = await browser.newPage({ viewport: { width: cols * tw + (cols + 1) * 4, height: 200 }, deviceScaleFactor: 1 });
  await sheetPage.goto(`http://127.0.0.1:${port}/labs/animations/`);
  await sheetPage.setContent(`<style>body{margin:0;background:#000;font:bold 15px system-ui;color:#fff}.g{display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:4px;padding:4px}.c{position:relative}.c img{width:${tw}px;height:${th}px;display:block}.c b{position:absolute;left:4px;top:3px;background:#000a;padding:0 4px;border-radius:3px}h1{font-size:15px;margin:6px 8px 0}</style><h1>${scenario}/${name} · ${(info.meta?.title ?? '').replace(/</g, '&lt;')} · moment ${info.play.toFixed(2)}s${info.warnings.length ? ' · ⚠ ' + info.warnings.join(' · ').replace(/</g, '&lt;') : ''}</h1><div class="g">${cells}</div>`, { waitUntil: 'load' });
  const base = path.join(dir, name);
  await sheetPage.screenshot({ path: `${base}.sheet.jpg`, type: 'jpeg', quality: 85, fullPage: true });
  await sheetPage.close();

  if (!preview) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'medium', '-movflags', '+faststart', `${base}.mp4`]);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  const result = { scenario, name, title: info.meta?.title ?? null, seconds: +(n / FPS).toFixed(2), moment: +info.play.toFixed(2), budget: null, warnings: info.warnings, errors: [...errors, ...(info.error ? [info.error] : [])], renderedIn: +((Date.now() - started) / 1000).toFixed(1), preview };
  fs.writeFileSync(`${base}.json`, JSON.stringify(result, null, 2));
  const status = result.errors.length ? '✗' : result.warnings.length ? '⚠' : '✓';
  console.log(`${status} ${scenario}/${name}: moment ${result.moment}s, video ${result.seconds}s, rendered in ${result.renderedIn}s → ${path.relative(process.cwd(), base)}.${preview ? 'sheet.jpg' : 'mp4 + .sheet.jpg'}`);
  for (const w of result.warnings) console.log(`   ⚠ ${w}`);
  for (const e of result.errors) console.log(`   ✗ ${e.split('\n').slice(0, 4).join('\n     ')}`);
  return result;
}

await acquire();
const { server, port } = await serve(0);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
try {
  for (const t of targets) {
    try {
      const r = await renderOne(browser, port, t);
      if (!r.ok && r.ok !== undefined) failed++;
      if (r.errors?.length) failed++;
    } catch (e) {
      failed++;
      console.log(`✗ ${t}: ${e.message}`);
    }
  }
} finally {
  await browser.close();
  server.close();
  release();
}
process.exit(failed ? 1 : 0);
