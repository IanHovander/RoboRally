// Records Floor Control's lines (Robo Rally's narrator) with ElevenLabs, once, into games/robo-rally/voice/.
// The website only plays the files; it never calls ElevenLabs.
//   node scripts/render-voice.mjs            renders lines that have no clip yet (or whose words changed)
//   node scripts/render-voice.mjs --force    renders every line again
//   node scripts/render-voice.mjs --list     only lists the lines
// Needs elevenlabs.local.json in the project folder: { "apiKey": "sk_..." } (never committed or published).
// The lines are read from briefing.js and teach.js: every say('...') and fire(id, '...') with fixed words,
// plus the flag numbers. Change a line there, run this again, and commit the new clips.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.join(ROOT, 'games', 'robo-rally');
const OUT = path.join(GAME, 'voice');
const VOICE = 'RgYxcRndL6bNcW4Qez8g'; // "Scifi women announcement" (the owner's ElevenLabs voice)
const MODEL = 'eleven_v4';
const SETTINGS = { stability: 0.5, similarity_boost: 0.75, speed: 1.0 }; // as on the ElevenLabs website
const TEMPO = 1.15; // sped up afterwards, pitch kept (the model ignores its own speed setting)
const NUMBER = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function lines() {
  const found = new Set();
  const take = (src, re) => {
    for (const m of src.matchAll(re)) {
      const text = m[2].replace(/\\(['"])/g, '$1');
      if (!text.includes('${') && /[.?!]$/.test(text)) found.add(text); // a sentence, not an id or a key
    }
  };
  const quoted = String.raw`(['"\x60])((?:\\.|(?!\1).)*)\1`;
  const brief = fs.readFileSync(path.join(GAME, 'briefing.js'), 'utf8');
  const teach = fs.readFileSync(path.join(GAME, 'teach.js'), 'utf8');
  take(brief, new RegExp(String.raw`\bsay\(\s*` + quoted, 'g'));
  // a callout's words: every quoted sentence on its fire(...) line (some pick one of two)
  for (const line of teach.split('\n').filter((l) => l.includes("fire('"))) {
    take(line.slice(line.indexOf("fire('")).replace(/^fire\('[^']*',/, ''), new RegExp(quoted, 'g'));
  }
  // the roll of flags in the Briefing ("One.", "Two.") and the first-flag callout, for every course
  for (let n = 1; n <= 4; n++) {
    found.add(`${cap(NUMBER[n])}.`);
    if (n < 4) found.add(`Flag ${NUMBER[n]}. Next target: flag ${NUMBER[n + 1]}.`); // (courses have at most 4 flags)
  }
  return [...found];
}

const fileFor = (text) => `${crypto.createHash('sha1').update(`${VOICE}|${MODEL}|${JSON.stringify(SETTINGS)}|${TEMPO}|${text}`).digest('hex').slice(0, 12)}.mp3`;

async function main() {
  if (process.argv.includes('--list')) return console.log(lines().join('\n'));
  const force = process.argv.includes('--force');
  const keyFile = path.join(ROOT, 'elevenlabs.local.json');
  if (!fs.existsSync(keyFile)) throw new Error('elevenlabs.local.json is missing: { "apiKey": "sk_..." }');
  const { apiKey } = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  let made = 0;
  for (const text of lines()) {
    const file = fileFor(text);
    manifest[text] = file;
    const dest = path.join(OUT, file);
    if (!force && fs.existsSync(dest)) continue;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status} for "${text}": ${(await res.text()).slice(0, 200)}`);
    const raw = `${dest}.raw.mp3`;
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', `atempo=${TEMPO}`, '-b:a', '128k', dest]);
    fs.rmSync(raw);
    made++;
    console.log(`${file}  ${text}`);
  }
  // clips no line uses any more
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.mp3') && !Object.values(manifest).includes(f)) fs.rmSync(path.join(OUT, f));
  fs.writeFileSync(path.join(OUT, 'clips.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${Object.keys(manifest).length} lines, ${made} recorded now.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
