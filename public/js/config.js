// Settings for the website version, where the big screen's browser hosts the game and phones
// connect to it over WebRTC. (The laptop-server version doesn't use any of this.)
export default {
  // The free PeerJS "introduction" server: it helps a phone find the big screen. After that the
  // two talk to each other directly (or through a relay, below).
  peerServer: { host: '0.peerjs.com', port: 443, path: '/', secure: true },

  // Room codes are registered on that shared server as idPrefix + code, so ours don't clash with other apps.
  idPrefix: 'gamenight-q7v2-',

  // Relay ("TURN") servers carry the game for phones that can't reach the big screen directly,
  // which is most phones on cellular data. Port 443 gets through strict school and office networks.
  // REQUIRED for cellular: there are no working free public relays any more.
  // Metered's free plan: copy the username and password ("credential") from your Metered dashboard.
  // These end up in the public website, so make new ones after the event.
  turn: {
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turns:global.relay.metered.ca:443?transport=tcp',
    ],
    username: '',
    credential: '',
  },
};
