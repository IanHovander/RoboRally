// Build the gallery page: every moment, its 50 ideas, the 5 picks and the three animators' videos.
//   node labs/animations/gallery.mjs <out-dir> [--done push,pit,...]
// Writes <out-dir>/index.html (data inlined) plus v/<scenario>/<name>.mp4 and p/<scenario>/<name>.jpg posters.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCENARIOS } from './scenarios.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] ?? path.join(HERE, 'out', 'gallery'));
const doneArg = process.argv.indexOf('--done');
const DONE = new Set(doneArg > 0 ? process.argv[doneArg + 1].split(',') : []);
const SHORT = { push: 'Push', edge: 'Off the edge', pit: 'Pit', shot: 'Shot', reboot: 'Reboot', wall: 'Wall', belt: 'Belt', gear: 'Gear', pusher: 'Push panel', energy: 'Battery', checkpoint: 'Checkpoint', win: 'Win', drive: 'Driving' };

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
const json = (f) => {
  try {
    return JSON.parse(read(f));
  } catch {
    return null;
  }
};
const clean = (s) => s.replace(/\*\*/g, '').replace(/\*/g, '').trim();

/** ideas.md: a "Banned" list, then "N. **Title.** What you see. *Twist:* ...". */
function parseIdeas(md) {
  if (!md) return { banned: [], ideas: [] };
  const banned = [];
  const ideas = [];
  let section = '';
  for (const line of md.split('\n')) {
    const h = line.match(/^#+\s*(.*)/);
    if (h) {
      section = h[1].toLowerCase();
      continue;
    }
    if (/banned|obvious/.test(section)) {
      const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
      if (item) banned.push(clean(item[1]));
      continue;
    }
    if (/five to animate|picks/.test(section)) continue;
    const m = line.match(/^\s*(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (!m) continue;
    const [text, twist] = m[3].split(/\*?\s*\*?Twist:?\*?:?\s*/i);
    ideas.push({ n: Number(m[1]), title: clean(m[2]).replace(/\.$/, ''), text: clean(text ?? ''), twist: clean(twist ?? '') });
  }
  return { banned, ideas };
}

function poster(mp4, at, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(at), '-i', mp4, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '5', out]);
    return true;
  } catch {
    return false;
  }
}

function media(scenario, name) {
  const base = path.join(HERE, 'out', scenario, name);
  const info = json(`${base}.json`);
  if (!fs.existsSync(`${base}.mp4`) || !info || info.preview) return { info };
  const v = `v/${scenario}/${name}.mp4`;
  const p = `p/${scenario}/${name}.jpg`;
  fs.mkdirSync(path.join(OUT, 'v', scenario), { recursive: true });
  fs.copyFileSync(`${base}.mp4`, path.join(OUT, v));
  const at = Math.min(Math.max(0.1, info.seconds - 0.2), 0.6 + info.moment * 0.55);
  return { info, video: v, poster: poster(`${base}.mp4`, at, path.join(OUT, p)) ? p : null };
}

async function metaOf(file) {
  try {
    const mod = await import(pathToFileURL(file).href + `?t=${fs.statSync(file).mtimeMs}`);
    return mod.meta ?? {};
  } catch {
    const src = read(file) ?? '';
    return { title: src.match(/title:\s*['"`](.+?)['"`]/)?.[1], idea: src.match(/idea:\s*['"`](.+?)['"`]/)?.[1] };
  }
}

fs.mkdirSync(OUT, { recursive: true });
const moments = [];
for (const [id, sc] of Object.entries(SCENARIOS)) {
  const dir = path.join(HERE, id);
  const picks = json(path.join(dir, 'picks.json')) ?? [];
  const { banned, ideas } = parseIdeas(read(path.join(dir, 'ideas.md')));
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[1-5][abc]-.+\.js$/.test(f)) : [];
  const out = [];
  for (const p of picks) {
    const takes = [];
    for (const f of files.filter((f) => f.startsWith(String(p.n)))) {
      const name = f.replace(/\.js$/, '');
      const meta = await metaOf(path.join(dir, f));
      const m = media(id, name);
      takes.push({ lens: f[1], file: `labs/animations/${id}/${f}`, title: meta.title ?? name, what: meta.idea ?? '', moment: m.info?.moment ?? null, warnings: m.info?.warnings ?? [], video: m.video ?? null, poster: m.poster ?? null });
    }
    out.push({ ...p, takes });
  }
  const base = media(id, 'baseline');
  const ready = DONE.has(id);
  moments.push({ id, short: SHORT[id] ?? id, title: sc.title, what: sc.what, rule: sc.rule, often: sc.often, budget: sc.budget, status: ready ? 'ready' : 'working', baseline: { video: base.video ?? null, poster: base.poster ?? null }, banned, ideas, picks: out });
}
const html = read(path.join(HERE, 'gallery-template.html')).replace('__DATA__', JSON.stringify({ moments }).replace(/</g, '\\u003c'));
fs.writeFileSync(path.join(OUT, 'index.html'), html);
const n = moments.reduce((k, m) => k + m.picks.reduce((j, p) => j + p.takes.filter((t) => t.video).length, 0), 0);
console.log(`gallery: ${moments.filter((m) => m.status === 'ready').length} moments ready, ${n} animation videos → ${path.relative(process.cwd(), OUT)}/index.html`);
