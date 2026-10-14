// Settings for the website version, where the big screen's browser hosts the game and phones
// connect to it over WebRTC. (The laptop-server version doesn't use any of this.)
// This file is public. Never put the relay's username or password in it: see js/net/relay.js.
export default {
  // The free PeerJS "introduction" server: it helps a phone find the big screen. After that the
  // two talk to each other directly (or through the relay, below).
  peerServer: { host: '0.peerjs.com', port: 443, path: '/', secure: true },

  // Room codes are registered on that shared server as idPrefix + code, so ours don't clash with other apps.
  idPrefix: 'gamenight-q7v2-',

  // STUN: helps every device find a route. Metered's is on port 80, which strict networks usually allow.
  stunUrls: ['stun:stun.relay.metered.ca:80', 'stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],

  // The relay (TURN): carries the game when a phone can't reach the big screen directly, which is most
  // phones on mobile data. Only the big screen uses it, with a login kept on that computer (relay.js).
  // Port 443 over TLS gets the big screen through strict school and office networks.
  turnUrls: [
    'turn:global.relay.metered.ca:80',
    'turn:global.relay.metered.ca:80?transport=tcp',
    'turn:global.relay.metered.ca:443',
    'turns:global.relay.metered.ca:443?transport=tcp',
  ],
};
