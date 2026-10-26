// Loading games. Each game folder has rules.js (the rules: setup, actions, views), host.js
// (big screen), player.js (phone) and optionally style.css.

/** Turn a game's rules module into the info the room needs. */
export function describeGame(id, def, hasStyle) {
  if (!def || typeof def !== 'object') throw new Error('rules.js must `export default { ... }`');
  return {
    id,
    name: def.name || id,
    description: def.description || '',
    minPlayers: def.minPlayers ?? 1,
    maxPlayers: def.maxPlayers ?? 32,
    hasStyle: !!hasStyle,
    def,
  };
}

/** In the browser: read games/index.json (the list of games) and load each game's rules.js. */
export async function loadGames(baseUrl = document.baseURI) {
  const res = await fetch(new URL('games/index.json', baseUrl), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`games/index.json: ${res.status}`);
  const games = new Map();
  for (const { id, hasStyle } of await res.json()) {
    try {
      const mod = await import(new URL(`games/${encodeURIComponent(id)}/rules.js`, baseUrl).href);
      games.set(id, describeGame(id, mod.default, hasStyle));
    } catch (err) {
      console.error(`Could not load games/${id}/rules.js:`, err);
    }
  }
  return games;
}
