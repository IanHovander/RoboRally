// Which relay (TURN) login to use: only the one built into config.js. Phones and the big screen use the
// same one, so a phone on a strict network can reach the relay itself over port 443. (A custom relay that
// an older version let a browser save is ignored, and cleared.)
import config from '../config.js';

const valid = (v) => v && typeof v.username === 'string' && v.username && typeof v.credential === 'string' && v.credential;

try {
  localStorage.removeItem('gamenight.relay');
} catch {}

/** { username, credential, builtIn } or null if there's no relay login at all. */
export function getRelay() {
  const login = config.turnLogin;
  return valid(login) ? { username: login.username, credential: login.credential, builtIn: true } : null;
}
