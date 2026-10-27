// A newer version of the website was published while this page was open: reload into it, but only at a moment
// that's safe (between games), never in the middle of a race.
//   watchForUpdates(isSafe)   isSafe() -> true when reloading now wouldn't spoil anything
// The build writes version.json: { v, files } (the site's scripts, styles and pages). Before reloading, those are
// fetched fresh, so the browser's cache can't hand the page its old code again (which would reload it in a loop).
import { VERSION } from './version.js';

const CHECK_MS = 60_000;
const SITE = new URL('../', import.meta.url); // the site's root (this file is js/update.js)

export function watchForUpdates(isSafe) {
  if (VERSION === 'dev') return; // the laptop server: restart it instead
  let next = null; // the newer version's info, once seen
  let reloading = false;

  const check = async () => {
    if (next) return;
    try {
      const res = await fetch(new URL(`version.json?t=${Date.now()}`, SITE), { cache: 'no-store' });
      const info = await res.json();
      if (info?.v && info.v !== VERSION) next = info;
    } catch {}
  };

  const tryReload = async () => {
    if (!next || reloading || !isSafe()) return;
    // already reloaded for this version and still old (the cache won): wait for a later version, don't loop
    let tried = null;
    try {
      tried = sessionStorage.getItem('gamenight.updatedTo');
    } catch {}
    if (tried === next.v) return;
    reloading = true;
    try {
      sessionStorage.setItem('gamenight.updatedTo', next.v);
    } catch {}
    // fetch the new files fresh into the cache, then reload into them
    await Promise.allSettled((next.files ?? []).map((f) => fetch(new URL(f, SITE), { cache: 'reload' })));
    location.reload();
  };

  setTimeout(check, 20_000);
  setInterval(check, CHECK_MS);
  setInterval(tryReload, 2000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
}
