// Floor Control: the big screen's narrator (the abandoned store's after-hours computer). Its lines are
// recorded clips (voice/, made with scripts/render-voice.mjs); a line without a clip (a player's name) is a chirp
// and its subtitle, so two voices never mix. If the clips can't load, the browser's own speech synthesis
// says everything instead. When it can't be heard (no speech,
// no voice, the big screen's sound locked or muted, an utterance failing, or captions switched on with C),
// its words show as subtitles instead: onCaption() tells the screen what to show, and lines that can't be
// heard last 400 ms plus 330 ms a word, so whatever waits on them waits for the reading.
// Only the big screen speaks; phones stay silent.
//   voice.say(text, { id, onStart, onWord, chirp }) -> Promise<{ spoken }>
//   voice.cancel(), voice.audible, voice.captions, voice.toggleCaptions(), voice.onCaption(fn)
import { state as soundState, setDuck } from './sound.js';

const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ----- the recorded lines: clips.json maps each line's words to its file -----
const CLIPS = new URL('./voice/', import.meta.url);
let clips = null; // { text: file }, once loaded
const decoded = new Map(); // file -> Promise<AudioBuffer | null>
// Clips are fetched and decoded as soon as the game screen opens, long before the Briefing: decoding needs no
// click (a silent offline context does it), so the first line never waits on the network.
const decoder = typeof OfflineAudioContext !== 'undefined' ? new OfflineAudioContext(1, 1, 44100) : null;
fetch(new URL('clips.json', CLIPS))
  .then((r) => (r.ok ? r.json() : null))
  .then((m) => {
    clips = m;
    preload();
  })
  .catch(() => {});
/** Fetch and decode every clip (under 2 MB), in the order they're first said. */
function preload() {
  if (clips && (decoder || audio)) for (const file of new Set(Object.values(clips))) bufferOf(file);
}
function bufferOf(file) {
  if (!decoded.has(file)) {
    const ac = decoder ?? audio;
    if (!ac) return Promise.resolve(null);
    decoded.set(
      file,
      fetch(new URL(file, CLIPS))
        .then((r) => r.arrayBuffer())
        .then((b) => ac.decodeAudioData(b))
        .catch(() => null),
    );
  }
  return decoded.get(file);
}

// Intelligible first: the robot feel comes from pitch, rate and the chirp, not from a novelty voice.
const RANKED = [
  (v) => v.name === 'Google UK English Male',
  (v) => navigator.onLine !== false && /Microsoft (Ryan|Thomas|Guy|Christopher|Eric|Andrew).*Online/.test(v.name),
  (v) => /^Daniel/.test(v.name),
  (v) => /Microsoft (George|David|Mark|James)/.test(v.name),
  (v) => /^(Alex|Aaron|Arthur)$/.test(v.name),
  (v) => v.localService,
  () => true,
];

let chosen = null;
function choose() {
  if (!synth) return;
  let all = [];
  try {
    all = synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
  } catch {}
  chosen = null;
  for (const test of RANKED) {
    const v = all.find(test);
    if (v) {
      chosen = v;
      break;
    }
  }
}
if (synth) {
  choose();
  synth.addEventListener?.('voiceschanged', choose);
  addEventListener('online', choose);
  addEventListener('offline', choose);
}

let captionsOn = false;
try {
  captionsOn = localStorage.getItem('rr.captions') === '1';
} catch {}
let failed = false; // an utterance failed: the voice can't be trusted, so subtitles from now on
let slowStarts = 0; // lines in a row that didn't start in time (two, and the voice counts as failed)
const captionFns = new Set();
let captionText = null;
function caption(text) {
  captionText = text;
  for (const fn of captionFns) {
    try {
      fn(text);
    } catch (err) {
      console.warn(err);
    }
  }
}

// ----- unlocking (Chrome wants a user gesture before speech) and the chirp -----
let unlocked = false;
let audio = null;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    if (synth) {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      synth.speak(u);
    }
  } catch {}
  makeAudio();
}
function makeAudio() {
  if (audio) return audio;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    audio = new AC();
  } catch {
    audio = null;
  }
  preload();
  return audio;
}
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });

/** Two square-wave blips before a line: 1400 Hz, then 2100 Hz, 35 ms each, 25 ms apart. */
function chirp() {
  const a = makeAudio();
  if (!a) return;
  if (a.state !== 'running') a.resume?.().catch(() => {});
  const t = a.currentTime + 0.02;
  [1400, 2100].forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'square';
    o.frequency.value = f;
    const s = t + i * 0.06;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.05, s + 0.004);
    g.gain.setValueAtTime(0.05, s + 0.031);
    g.gain.linearRampToValueAtTime(0, s + 0.035);
    o.connect(g).connect(a.destination);
    o.start(s);
    o.stop(s + 0.04);
  });
}

// ----- speaking -----
let current = null; // the line being said: { stop }
let lineText = null; // ...and its words
let undock = 0;
const words = (text) => text.split(/\s+/).filter(Boolean).length;
export const readMs = (text) => 400 + 330 * words(text);

export const voice = {
  /** Can the room hear it right now? */
  get audible() {
    return soundState() === 'on' && (!!clips || (!!synth && !!chosen && !failed));
  },
  /** Are subtitles showing (the voice can't be heard, or captions are switched on)? */
  get captions() {
    return captionsOn || !this.audible;
  },
  get voiceName() {
    return clips ? 'Floor Control (recorded)' : chosen?.name ?? null;
  },
  /** Is a line being said (or read) right now? */
  get busy() {
    return !!current;
  },
  /** For test scripts: every line asked for, with when and how. */
  log: [],

  /**
   * Say a line. Resolves when it's over: spoken (onend), or read (subtitles' time), or cancelled.
   * onStart: as it starts. onWord: on each word (boundary events, or every 330 ms without them).
   * chirp: false for a line that continues the one before (a name in the roll call).
   */
  say(text, { id = null, onStart = null, onWord = null, chirp: blip = true } = {}) {
    this.cancel();
    const audible = this.audible;
    const show = captionsOn || !audible;
    const entry = { id, text, at: Math.round(performance.now()), audible, captions: show, spoken: false };
    this.log.push(entry);
    if (this.log.length > 200) this.log.shift();
    clearTimeout(undock);
    return new Promise((resolve) => {
      let done = false;
      let started = false;
      let boundaries = 0;
      let wordTimer = 0;
      let safety = 0;
      let watchdog = 0;
      let shown = false;
      const finish = (spoken) => {
        if (done) return;
        done = true;
        entry.spoken = spoken;
        entry.ms = Math.round(performance.now()) - entry.at;
        clearInterval(wordTimer);
        clearTimeout(safety);
        clearTimeout(watchdog);
        if (current === me) {
          current = null;
          lineText = null;
        }
        if (shown || captionText !== null) caption(null);
        undock = setTimeout(() => current || setDuck(1), 250);
        resolve({ spoken });
      };
      const begin = (withCaption) => {
        if (!started) {
          started = true;
          entry.startMs = Math.round(performance.now()) - entry.at; // how long it took to start (for test scripts)
          try {
            onStart?.();
          } catch (err) {
            console.warn(err);
          }
          wordTimer = setInterval(() => boundaries || onWord?.(), 330);
        }
        if (withCaption && !shown) {
          shown = true;
          caption(text);
        }
      };
      /** The voice can't be heard after all: the rest of this line is read instead. */
      const readInstead = () => {
        failed = true;
        entry.audible = false;
        entry.captions = true;
        begin(true);
        clearTimeout(safety);
        safety = setTimeout(() => finish(false), readMs(text));
      };
      const me = {
        stop: () => {
          if (!done && audible) {
            try {
              synth.cancel();
            } catch {}
          }
          finish(false);
        },
      };
      current = me;
      lineText = text;
      if (!audible) {
        begin(true);
        safety = setTimeout(() => finish(false), readMs(text));
        return;
      }
      if (clips) {
        const file = clips[text];
        if (!file) {
          // no recording (a player's name): a chirp, and the words on screen
          entry.captions = true;
          chirp();
          begin(true);
          safety = setTimeout(() => finish(false), readMs(text));
          return;
        }
        let source = null;
        me.stop = () => {
          try {
            source?.stop();
          } catch {}
          finish(false);
        };
        makeAudio();
        if (blip) chirp();
        // a clip that isn't ready in time: its words show while it loads, and it's still heard when it arrives
        watchdog = setTimeout(() => {
          if (done || source) return;
          entry.captions = true;
          begin(true);
          safety = setTimeout(() => !source && finish(false), readMs(text) + 3000);
        }, 1500);
        Promise.all([bufferOf(file), sleep(blip ? 90 : 0)]).then(([buf]) => {
          if (done) return;
          if (!buf || !audio) return started ? undefined : readInstead();
          clearTimeout(watchdog);
          clearTimeout(safety);
          if (audio.state !== 'running') audio.resume?.().catch(() => {});
          source = audio.createBufferSource();
          source.buffer = buf;
          source.connect(audio.destination);
          source.onended = () => finish(true);
          source.start();
          setDuck(0.5);
          begin(show);
          safety = setTimeout(() => finish(true), buf.duration * 1000 + 1500);
        });
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.voice = chosen;
      u.lang = chosen.lang;
      u.rate = 0.92;
      u.pitch = 0.6;
      u.volume = 1;
      let late = false;
      u.onstart = () => {
        if (done) return;
        clearTimeout(watchdog);
        if (late) {
          // it started after all: the line ends when it's said
          clearTimeout(safety);
          safety = setTimeout(() => finish(true), 3000 + 600 * words(text));
        } else slowStarts = 0;
        setDuck(0.5);
        begin(show);
      };
      u.onboundary = (e) => {
        if (done || (e.name && e.name !== 'word')) return;
        boundaries++;
        onWord?.();
      };
      u.onend = () => finish(true);
      u.onerror = (e) => {
        if (done) return;
        if (e.error === 'interrupted' || e.error === 'canceled') return finish(false);
        readInstead();
      };
      // Chrome sometimes never fires onend: the line ends anyway
      safety = setTimeout(() => finish(true), 3000 + 600 * words(text));
      // ...and sometimes doesn't start (no gesture yet, a stuck queue, a slow network voice): then it's read
      // instead, and if it starts late, it's heard too
      watchdog = setTimeout(() => {
        if (started || done) return;
        late = true;
        if (++slowStarts >= 2) failed = true;
        entry.captions = true;
        begin(true);
        clearTimeout(safety);
        safety = setTimeout(() => finish(false), readMs(text));
      }, 1500);
      if (blip) chirp();
      setTimeout(() => {
        if (done) return;
        try {
          synth.speak(u);
        } catch {
          readInstead();
        }
      }, 30); // (the chirp plays while the speech engine warms up)
    });
  },

  /** Stop talking now (a skip). */
  cancel() {
    const c = current;
    current = null;
    lineText = null;
    c?.stop();
    if (synth?.speaking || synth?.pending) {
      try {
        synth.cancel();
      } catch {}
    }
  },

  /** Captions on or off (C on the big screen); remembered on this computer. */
  toggleCaptions(on = !captionsOn) {
    captionsOn = !!on;
    try {
      localStorage.setItem('rr.captions', captionsOn ? '1' : '');
    } catch {}
    if (lineText) caption(this.captions ? lineText : null);
    return captionsOn;
  },

  /** fn(text | null): what the subtitles should show. Returns an unsubscribe function. */
  onCaption(fn) {
    captionFns.add(fn);
    return () => captionFns.delete(fn);
  },
};

export { sleep };
