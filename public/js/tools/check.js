// Network check (check.html): can this phone, on this network, play the website version?
import config from '../config.js';
import { hasRelay, loadPeerJS, peerOptions } from '../net/common.js';
import { html } from '../ui.js';

const $ = (id) => document.getElementById(id);
const turnUrl = (test) => config.turn.urls.find(test);

const CHECKS = [
  { id: 'intro', name: 'Introduction server', note: config.peerServer.host, run: introServer },
  { id: 'stun', name: 'Finding a direct route', note: 'STUN', run: stun },
  { id: 'udp', name: 'Relay over UDP', note: 'port 80', run: () => relay(turnUrl((u) => u.startsWith('turn:') && !u.includes('transport='))) },
  { id: 'tcp', name: 'Relay over TCP', note: 'port 80', run: () => relay(turnUrl((u) => u.startsWith('turn:') && u.includes('transport=tcp'))) },
  { id: 'tls', name: 'Relay over TLS', note: 'port 443, gets through strict networks', run: () => relay(turnUrl((u) => u.startsWith('turns:'))) },
];

$('again').addEventListener('click', runAll);
runAll();

async function runAll() {
  $('again').hidden = true;
  $('verdict').className = 'verdict';
  $('verdict').textContent = 'Checking…';
  const results = {};
  draw(results);
  await Promise.all(
    CHECKS.map(async (check) => {
      try {
        results[check.id] = { ok: true, text: await check.run() };
      } catch (err) {
        results[check.id] = { ok: false, text: err.message };
      }
      draw(results);
    }),
  );
  verdict(results);
  $('again').hidden = false;
}

function draw(results) {
  $('checks').innerHTML = html`${CHECKS.map((c) => {
    const r = results[c.id];
    return html`
      <div class="check ${r && (r.ok ? 'ok' : 'bad')}">
        <span class="mark">${r ? (r.ok ? '✅' : '❌') : '⏳'}</span>
        <b>${c.name} <span class="muted small">(${c.note})</span></b>
        <span class="muted">${r?.text ?? 'testing…'}</span>
      </div>`;
  })}`;
}

function verdict(r) {
  const anyRelay = r.udp.ok || r.tcp.ok || r.tls.ok;
  let ok = false;
  let text;
  if (!r.intro.ok) text = "This network blocks the service that connects phones to the big screen. Turn Wi-Fi off and use mobile data.";
  else if (!hasRelay()) text = "The website has no relay server set up, so phones that can't connect directly won't get in. (Fix: js/config.js.)";
  else if (!anyRelay) text = 'This network blocks the relay server. Direct connections might still work, but mobile data is safer.';
  else {
    ok = true;
    text = '✅ Good to go: this phone can join from this network.';
  }
  $('verdict').className = `verdict ${ok ? 'ok' : 'bad'}`;
  $('verdict').textContent = text;
}

async function introServer() {
  const Peer = await loadPeerJS();
  const peer = new Peer(peerOptions());
  try {
    await new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error("Couldn't reach it within 8 seconds")), 8000);
      peer.on('open', resolve);
      peer.on('error', (err) => reject(new Error(`Error: ${err.type}`)));
    });
    return 'Reachable';
  } finally {
    peer.destroy();
  }
}

async function stun() {
  const found = await gather({ iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }] }, 'srflx', 5000);
  if (!found) throw new Error('No route found (this network may block it)');
  return 'Works';
}

async function relay(url) {
  if (!hasRelay() || !url) throw new Error('Not set up on this website');
  const found = await gather(
    { iceServers: [{ urls: [url], username: config.turn.username, credential: config.turn.credential }], iceTransportPolicy: 'relay' },
    'relay',
    8000,
  );
  if (!found) throw new Error('Blocked or not answering');
  return 'Works';
}

/** Ask the browser for connection candidates; resolves true as soon as one of `type` shows up. */
async function gather(config, type, ms) {
  const pc = new RTCPeerConnection(config);
  try {
    return await new Promise((resolve) => {
      setTimeout(() => resolve(false), ms);
      pc.onicecandidate = (e) => e.candidate?.type === type && resolve(true);
      pc.createDataChannel('check');
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));
    });
  } finally {
    pc.close();
  }
}
