import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Every folder in games/ is a game (folders starting with _ are skipped, e.g. _template).
 * A game folder holds:
 *   server.js   the rules (runs on the laptop; never sent to browsers)
 *   host.js     what the big screen shows
 *   player.js   what each phone shows
 *   style.css   optional styles, loaded automatically
 */
export async function loadGames(gamesDir) {
  const games = new Map();
  const entries = fs.existsSync(gamesDir) ? fs.readdirSync(gamesDir, { withFileTypes: true }) : [];
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (!entry.isDirectory() || /^[_.]/.test(entry.name)) continue;
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(entry.name)) {
      console.warn(`  Skipping games/${entry.name}: use only letters, numbers and dashes in game folder names.`);
      continue;
    }
    const dir = path.join(gamesDir, entry.name);
    const serverFile = path.join(dir, 'server.js');
    if (!fs.existsSync(serverFile)) {
      console.warn(`  Skipping games/${entry.name}: it has no server.js`);
      continue;
    }
    try {
      const def = (await import(pathToFileURL(serverFile).href)).default;
      if (!def || typeof def !== 'object') throw new Error('server.js must `export default { ... }`');
      for (const file of ['host.js', 'player.js']) {
        if (!fs.existsSync(path.join(dir, file))) console.warn(`  games/${entry.name} is missing ${file}`);
      }
      games.set(entry.name, {
        id: entry.name,
        name: def.name || entry.name,
        description: def.description || '',
        minPlayers: def.minPlayers ?? 1,
        maxPlayers: def.maxPlayers ?? 24,
        hasStyle: fs.existsSync(path.join(dir, 'style.css')),
        def,
      });
    } catch (err) {
      console.error(`\n  Could not load games/${entry.name}/server.js:\n`, err, '\n');
    }
  }
  return games;
}

const ASSET = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(js|mjs|css|json|png|jpe?g|gif|svg|webp|mp3|ogg|wav|m4a|woff2?)$/;

/**
 * Browsers may load a game's host.js, player.js, style.css, images and sounds,
 * but never server.js or anything named *.server.js (that's where secrets live).
 */
export function isPublicGameFile(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath).toLowerCase();
  } catch {
    return false;
  }
  const parts = p.split(/[\\/]/).filter(Boolean);
  if (parts.length < 2) return false;
  if (!parts.every((s) => /^[a-z0-9_-][a-z0-9_.-]*$/.test(s))) return false;
  const file = parts.at(-1);
  return ASSET.test(file) && file !== 'server.js' && !file.endsWith('.server.js');
}
