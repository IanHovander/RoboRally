import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describeGame } from '../public/js/core/games.js';

/**
 * Every folder in games/ is a game (folders starting with _ are skipped, e.g. _template).
 * A game folder holds:
 *   rules.js    the rules (runs on the laptop's server, or in the big screen's browser on the website)
 *   host.js     what the big screen shows
 *   player.js   what each phone shows
 *   style.css   optional styles, loaded automatically
 */
export async function loadGames(gamesDir) {
  const games = new Map();
  for (const { id, dir, hasStyle } of findGames(gamesDir)) {
    try {
      const def = (await import(pathToFileURL(path.join(dir, 'rules.js')).href)).default;
      for (const file of ['host.js', 'player.js']) {
        if (!fs.existsSync(path.join(dir, file))) console.warn(`  games/${id} is missing ${file}`);
      }
      games.set(id, describeGame(id, def, hasStyle));
    } catch (err) {
      console.error(`\n  Could not load games/${id}/rules.js:\n`, err, '\n');
    }
  }
  return games;
}

/** The game folders, in order: [{ id, dir, hasStyle }]. Also what games/index.json lists. */
export function findGames(gamesDir) {
  const entries = fs.existsSync(gamesDir) ? fs.readdirSync(gamesDir, { withFileTypes: true }) : [];
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || /^[_.]/.test(entry.name)) continue;
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(entry.name)) {
      console.warn(`  Skipping games/${entry.name}: use only lowercase letters, numbers and dashes in game folder names.`);
      continue;
    }
    const dir = path.join(gamesDir, entry.name);
    if (!fs.existsSync(path.join(dir, 'rules.js'))) {
      console.warn(`  Skipping games/${entry.name}: it has no rules.js`);
      continue;
    }
    found.push({ id: entry.name, dir, hasStyle: fs.existsSync(path.join(dir, 'style.css')) });
  }
  return found;
}

const ASSET = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(js|mjs|css|json|png|jpe?g|gif|svg|webp|mp3|ogg|wav|m4a|woff2?)$/;

/**
 * Browsers may load a game's files (rules.js, host.js, player.js, style.css, images, sounds).
 * A file named server.js or *.server.js is never sent: on the laptop server a game can keep
 * secrets there. (On the website everything is public, so those games won't work there.)
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
