// The relay (TURN) login. It's a secret, so it is never in the code, on GitHub, or sent to phones:
// - On the website, it's typed in once on the big-screen computer (the Relay button) and kept in that
//   browser's storage.
// - When testing on this computer, `npm run site` also offers relay.local.json from the project folder
//   (git ignores that file, and no other server sends it).
// Only the big screen uses the relay: it reserves a relay address, and phones reach it through that,
// so phones never need the login.

const KEY = 'gamenight.relay';
const valid = (v) => v && typeof v.username === 'string' && v.username && typeof v.credential === 'string' && v.credential;

/** { username, credential } or null if this computer has no relay login. */
export async function loadRelay() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (valid(saved)) return { username: saved.username, credential: saved.credential };
  } catch {}
  try {
    const res = await fetch(new URL('../relay.local.json', import.meta.url), { cache: 'no-store' });
    if (res.ok) {
      const local = await res.json();
      if (valid(local)) return { username: local.username, credential: local.credential, local: true };
    }
  } catch {}
  return null;
}

export function saveRelay(username, credential) {
  localStorage.setItem(KEY, JSON.stringify({ username: username.trim(), credential: credential.trim() }));
}

export function forgetRelay() {
  localStorage.removeItem(KEY);
}
