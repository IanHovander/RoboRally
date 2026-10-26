// Which relay (TURN) login to use: one entered with the big screen's Relay button (kept in this browser
// only), otherwise the one built into config.js. Phones use the built-in one too, so a phone on a strict
// network can reach the relay itself over port 443.
import config from '../config.js';

const KEY = 'gamenight.relay';
const valid = (v) => v && typeof v.username === 'string' && v.username && typeof v.credential === 'string' && v.credential;

/** { username, credential, builtIn } or null if there's no relay login at all. */
export function getRelay() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (valid(saved)) return { username: saved.username, credential: saved.credential, builtIn: false };
  } catch {}
  const login = config.turnLogin;
  return valid(login) ? { username: login.username, credential: login.credential, builtIn: true } : null;
}

export function saveRelay(username, credential) {
  localStorage.setItem(KEY, JSON.stringify({ username: username.trim(), credential: credential.trim() }));
}

/** Back to the built-in login. */
export function forgetRelay() {
  localStorage.removeItem(KEY);
}
