// Builds the website version into dist/: the pages (public/), the games, and games/index.json.
// GitHub Pages publishes dist/ (see .github/workflows/pages.yml).
//   node scripts/build-site.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
fs.writeFileSync(path.join(OUT, '.nojekyll'), ''); // tell GitHub Pages to serve the files exactly as they are

console.log(`Built dist/ with ${games.length} game(s): ${games.map((g) => g.id).join(', ')}`);
