// Builds the website version into dist/: the pages (public/), the games, and games/index.json.
// GitHub Pages publishes dist/ (see .github/workflows/pages.yml).
//   node scripts/build-site.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { findGames } from '../server/games.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const serverOnly = (file) => /(^|[\\/])([^\\/]+\.)?server\.js$/i.test(file);

const secret = (file) => /\.local\.json$/i.test(file); // settings that stay on this computer: never published

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true, filter: (src) => !secret(src) });

const games = findGames(path.join(ROOT, 'games'));
for (const game of games) {
  // A game with server-only files (server.js / *.server.js) needs the laptop server; skip those files.
  fs.cpSync(game.dir, path.join(OUT, 'games', game.id), { recursive: true, filter: (src) => !serverOnly(src) && !secret(src) });
}
fs.writeFileSync(path.join(OUT, 'games', 'index.json'), JSON.stringify(games.map(({ id, hasStyle }) => ({ id, hasStyle })), null, 2));

// Alternative looks (looks/<name>/public + looks/<name>/games) publish beside the main site, at looks/<name>/.
const LOOKS = path.join(ROOT, 'looks');
const looks = fs.existsSync(LOOKS) ? fs.readdirSync(LOOKS, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(LOOKS, e.name, 'public'))) : [];
for (const look of looks) {
  const src = path.join(LOOKS, look.name);
  const out = path.join(OUT, 'looks', look.name);
  fs.cpSync(path.join(src, 'public'), out, { recursive: true, filter: (f) => !secret(f) });
  const lookGames = findGames(path.join(src, 'games'));
  for (const game of lookGames) fs.cpSync(game.dir, path.join(out, 'games', game.id), { recursive: true, filter: (f) => !serverOnly(f) && !secret(f) });
  fs.writeFileSync(path.join(out, 'games', 'index.json'), JSON.stringify(lookGames.map(({ id, hasStyle }) => ({ id, hasStyle })), null, 2));
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), ''); // tell GitHub Pages to serve the files exactly as they are

// The version: pages that are open when a newer one is published reload into it between games (js/update.js).
// It's the commit being built (or the time, off git), stamped into js/version.js, with the list of the site's code
// for the pages to fetch fresh before reloading.
let version = process.env.GITHUB_SHA?.slice(0, 12);
if (!version) {
  try {
    version = execSync('git rev-parse --short=12 HEAD', { cwd: ROOT }).toString().trim();
    if (execSync('git status --porcelain', { cwd: ROOT }).toString().trim()) version += `-${Date.now().toString(36)}`;
  } catch {
    version = Date.now().toString(36);
  }
}
fs.writeFileSync(path.join(OUT, 'js', 'version.js'), `export const VERSION = ${JSON.stringify(version)};\n`);
const code = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'looks' && e.name !== 'lib') walk(f); // (the 3D library never changes; the looks aren't the game)
    } else if (/\.(js|css|html|json)$/.test(e.name) && e.name !== 'version.json') code.push(path.relative(OUT, f).split(path.sep).join('/'));
  }
};
walk(OUT);
fs.writeFileSync(path.join(OUT, 'version.json'), JSON.stringify({ v: version, files: code }));

console.log(`Built dist/ with ${games.length} game(s): ${games.map((g) => g.id).join(', ')}${looks.length ? `, plus looks: ${looks.map((l) => l.name).join(', ')}` : ''}`);
