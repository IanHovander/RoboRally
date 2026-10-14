// Network check (check.html): can this device, on this network, play the website version?
// On a phone it checks what phones need. On the big-screen computer (which has the relay login)
// it also checks each way of reaching the relay.
import config from '../config.js';
import { loadPeerJS, peerOptions } from '../net/common.js';
import { loadRelay } from '../net/relay.js';
import { html } from '../ui.js';

const $ = (id) => document.getElementById(id);
const relay = await loadRelay();
const turnUrl = (test) => config.turnUrls.find(test);

const CHECKS = [
  { id: 'intro', name: 'Introduction server', note: config.peerServer.host, run: introServer },
  { id: 'stun', name: 'Finding a route out', note: 'STUN, port 80', run: stun },
  ...(relay
    ? [
        { id: 'udp', name: 'Relay over UDP', note: 'port 80', run: () => checkRelay(turnUrl((u) => u.startsWith('turn:') && !u.includes('transport='))) },
        { id: 'tcp', name: 'Relay over TCP', note: 'port 80', run: () => checkRelay(turnUrl((u) => u.startsWith('turn:') && u.includes('transport=tcp'))) },
        { id: 'tls', name: 'Relay over TLS', note: 'port 443, gets through strict networks', run: () => checkRelay(turnUrl((u) => u.startsWith('turns:'))) },
      ]
    : []),
];

$('who').textContent = relay
  ? 'This is the big-screen computer (it has the relay login), so the relay is checked too.'
  : 'Checking what a phone needs to join.';
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
  let ok = false;
  let text;
  if (!r.intro.ok) text = 'This network blocks the service that connects phones to the big screen. Turn Wi-Fi off and use mobile data.';
  else if (!r.stun.ok) text = "This network blocks the connections the game needs. Turn Wi-Fi off and use mobile data.";
  else if (relay && !(r.udp.ok || r.tcp.ok || r.tls.ok)) text = "The relay isn't reachable from here (or the login is wrong). Phones on mobile data may not get in.";
  else {
    ok = true;
    text = relay ? '✅ Good to go: this computer can host, relay included.' : '✅ Good to go: this phone can join from this network.';
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
  const found = await gather({ iceServers: [{ urls: config.stunUrls }] }, 'srflx', 6000);
  if (!found) throw new Error('Blocked (this network may not allow it)');
  return 'Works';
}

async function checkRelay(url) {
  const found = await gather({ iceServers: [{ urls: [url], username: relay.username, credential: relay.credential }], iceTransportPolicy: 'relay' }, 'relay', 8000);
  if (!found) throw new Error('Blocked, or the login was refused');
  return 'Works';
}

/** Ask the browser for connection candidates; resolves true as soon as one of `type` shows up. */
async function gather(rtcConfig, type, ms) {
  const pc = new RTCPeerConnection(rtcConfig);
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
