// Build the winners page: for each moment, the two judges' scores added up, and the winner and runner-up side by side.
//   node labs/animations/winners.mjs <out-dir> [--gallery <url>]
// Reads <moment>/judging-room.json and judging-director.json; writes <out-dir>/index.html, v/ and p/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCENARIOS } from './scenarios.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] ?? path.join(HERE, 'out', 'winners'));
const gi = process.argv.indexOf('--gallery');
const GALLERY = gi > 0 ? process.argv[gi + 1] : '';
const SHORT = { push: 'Push', edge: 'Off the edge', pit: 'Pit', shot: 'Shot', reboot: 'Reboot', wall: 'Wall', belt: 'Belt', gear: 'Gear', pusher: 'Push panel', energy: 'Battery', checkpoint: 'Checkpoint', win: 'Win', drive: 'Driving' };
const LENS = { a: 'Weight & physical comedy', b: 'Character acting', c: 'Cinematic & light staging' };
const json = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};

async function metaOf(file) {
  try {
    return (await import(pathToFileURL(file).href)).meta ?? {};
  } catch {
    return {};
  }
}

function media(scenario, name) {
  const base = path.join(HERE, 'out', scenario, name);
  const info = json(`${base}.json`);
  if (!fs.existsSync(`${base}.mp4`)) return {};
  const v = `v/${scenario}/${name}.mp4`;
  const p = `p/${scenario}/${name}.jpg`;
  fs.mkdirSync(path.join(OUT, 'v', scenario), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'p', scenario), { recursive: true });
  fs.copyFileSync(`${base}.mp4`, path.join(OUT, v));
  const at = info ? Math.min(Math.max(0.1, info.seconds - 0.2), 0.6 + info.moment * 0.55) : 1;
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(at), '-i', `${base}.mp4`, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '5', path.join(OUT, p)]);
  } catch {}
  return { video: v, poster: p, moment: info?.moment ?? null };
}

fs.mkdirSync(OUT, { recursive: true });
const moments = [];
const missing = [];
for (const [id, sc] of Object.entries(SCENARIOS)) {
  const room = json(path.join(HERE, id, 'judging-room.json'));
  const director = json(path.join(HERE, id, 'judging-director.json'));
  if (!room || !director) {
    missing.push(id);
    continue;
  }
  // add the two overall scores; ties go to the higher combined delight
  const by = {};
  for (const [judge, v] of [['room', room], ['director', director]]) {
    for (const s of v.scores ?? []) {
      const e = (by[s.entry] ??= { entry: s.entry, total: 0, delight: 0, notes: {}, overall: {} });
      e.total += s.overall;
      e.delight += s.delight;
      e.overall[judge] = s.overall;
      e.notes[judge] = s.note;
    }
  }
  const ranked = Object.values(by).sort((a, b) => b.total - a.total || b.delight - a.delight);
  const pick = async (e, place) => {
    if (!e) return null;
    const meta = await metaOf(path.join(HERE, id, `${e.entry}.js`));
    // a judge who chose this entry as winner or runner-up wrote why and what to watch when porting
    const reasons = [];
    for (const [judge, v] of [['room', room], ['director', director]]) {
      for (const k of ['winner', 'runner_up']) if (v[k]?.entry === e.entry) reasons.push({ judge, as: k, why: v[k].why, port: v[k].port });
    }
    return { place, entry: e.entry, lens: e.entry[1], title: meta.title ?? e.entry, what: meta.idea ?? '', total: e.total, overall: e.overall, notes: e.notes, reasons, ...media(id, e.entry) };
  };
  moments.push({
    id,
    short: SHORT[id] ?? id,
    title: sc.title,
    what: sc.what,
    count: ranked.length,
    winner: await pick(ranked[0], 'Winner'),
    runner: await pick(ranked[1], 'Runner-up'),
    picks: { room: { winner: room.winner?.entry, runner_up: room.runner_up?.entry }, director: { winner: director.winner?.entry, runner_up: director.runner_up?.entry } },
  });
}
const html = fs.readFileSync(path.join(HERE, 'winners-template.html'), 'utf8').replace('__DATA__', JSON.stringify({ moments, gallery: GALLERY, lens: LENS }).replace(/</g, '\\u003c'));
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`winners: ${moments.length} moments${missing.length ? `, still waiting on judges for: ${missing.join(', ')}` : ''} → ${path.relative(process.cwd(), OUT)}/index.html`);
