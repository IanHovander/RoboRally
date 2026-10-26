# Handoff: Robo Rally animation lab (Lumen)

Paused on 2026-10-26 to continue in another thread. Read `README.md` in this folder first (the lab and its API).

## The ask

From the person running this: the earlier animation ideas felt cliché. Delight and surprise are the goal, and an
animation may break the rules on screen as long as the game can carry on within them. For **each moment** of the
game:

1. An agent generates **50 ideas**.
2. **5** of them are picked.
3. Each of the 5 is animated **3 different ways by 3 completely different agents**.
4. Show all the options.
5. Once every moment is animated, pick a **winner and a runner-up for each moment** and post them where they're
   easy to watch.

The team chose the **Lumen** look (`looks/three/`), so everything is staged in Lumen's real arena.

## Where it stands

**Done:**

- The lab: `lab.js`, `scenarios.js`, `stage.html`, `render.mjs`, `serve.mjs`.
- 13 moments: push, edge (off the board), pit, shot, reboot, wall, belt, gear, pusher (push panel), energy
  (battery), checkpoint, win, drive (everyday moves).
- For every moment, `<moment>/ideas.md` holds the 50 ideas, the banned clichés and a section on the five picks.
  `<moment>/picks.json` holds the five picks.
- 106 of the 195 animations are finished: written, final-rendered, no warnings.

**Gallery:** https://claude.ai/artifact/GeoWfKHzMY2A4uywhpxHTT (version 3, all 106 finished videos). Update it by publishing
`gallery.mjs`'s output with that URL; see below.

**Animators** (one per lens, each animates all five picks; files are `<moment>/<pick n><lens>-<slug>.js`):

- **a**: weight and physical comedy
- **b**: character acting
- **c**: cinematic and light staging

Most **c** animators never started, because their moment's run hit a usage limit first.

| moment | finished | written, needs review + final render | not written yet |
| --- | --- | --- | --- |
| push | 10 | 2c 3c 4c 5a 5c | — |
| edge | 0 | 1a 1b 2a 2b 3a 3b 4a 4b 5a 5b | 1c 2c 3c 4c 5c |
| pit | 10 | — | 1c 2c 3c 4c 5c |
| shot | 10 | 1c 2c 3c 4c 5c | — |
| reboot | 5 | 1a 1b 2a 3a 5b | 1c 2c 3c 4c 5c |
| wall | 8 | 4b 5a | 1c 2c 3c 4c 5c |
| belt | 10 | — | 1c 2c 3c 4c 5c |
| gear | 8 | 1c 2c 3a 3c 4c 5a 5c | — |
| pusher | 9 | 4b | 1c 2c 3c 4c 5c |
| energy | 8 | 1b 2b | 1c 2c 3c 4c 5c |
| checkpoint | 10 | — | 1c 2c 3c 4c 5c |
| win | 9 | 1c 3a | 2c 3c 4c 5c |
| drive | 9 | 4a | 1c 2c 3c 4c 5c |

"Written, needs review" files were mid-iteration when work stopped: their animator may not have finished
polishing them. Each counts as an entry, but check it before a final render.

## Update: cinematic animators only

After the pause the person asked for just the **c** (cinematic and light staging) animator on every moment, and
no more **a** or **b** work beyond what is already finished. All 13 c animators were started on 2026-10-26 with
`args: { scenario, picks: 'file', lenses: ['c'] }`. Judge each moment on the entries that exist.

## What's left

1. **Finish the animations.** Run an animator for each lens with missing or unfinished entries, using
   `orchestrate/scenario-workflow.js`, the Workflow script these were made with.
   - Pass `args: { scenario, picks, lenses }`, where `picks` is that moment's `picks.json` array. With `picks`
     set, the script skips the ideas and curation steps; `lenses` (e.g. `['c']`) runs only those animators.
   - The animator brief tells an animator to finish its own earlier files rather than start over. Keep the
     three lenses as separate agents, and don't let an animator open another lens's files: independence is the
     point of the ask.
   - The Workflow tool runs at most `CPUs - 2` agents per workflow, so start one workflow per moment.
2. **Judge each moment** once all 15 entries render cleanly. The plan was two independent judges per moment,
   neither shown the animators' own claims:
   - **"The room":** six friends on a couch on game night. What makes them laugh, gasp or say "again"? What gets
     old by the 20th time? Does anyone miss what happened in the game?
   - **"The director":** must ship one of these into Lumen. Judge timing, staging, clarity of the game state,
     readability at TV scale, fit with Lumen, and whether it ports into `scene.js` cleanly within the time
     budget.
   - Each judge scores all 15 entries out of 10 on delight, surprise, clarity, Lumen fit, craft and how well it
     repeats, plus an overall score. Judges work from the final contact sheets (`out/<moment>/*.sheet.jpg`),
     pulling frames with ffmpeg where they need a closer look, and the scenario entry.
   - Each judge writes `<moment>/judging-<room|director>.md`. Add the two overall scores: the top entry wins and
     the second is the runner-up.
3. **Post the winners:** a separate page with each moment's winner and runner-up videos side by side and the
   judges' reasons. Link it from the gallery.
4. Rebuild and republish the gallery with every moment marked done:
   `node labs/animations/gallery.mjs <dir> --done push,edge,...`.

## Practical notes

- **Rendered files aren't in git.** `out/` (videos, contact sheets) is ignored. On a fresh machine, re-render the
  finished entries before judging, e.g. `node labs/animations/render.mjs push/1a-*.js ...`. Each finished entry
  takes about 30-60 s on 4 CPU cores.
- **Render queue:** renders queue for a machine-wide slot. Set `LAB_RENDER_SLOTS` to use more cores (about one slot
  per 1-1.5 cores). The queue was fixed this session: a slot is freed only when its owner exits, and a render
  whose caller gave up exits by itself.
- **Timeouts:** run renders with a long Bash timeout, or a timed-out command leaves work half done.
- **Software rendering:** renders use software WebGL (SwiftShader). On a machine with a GPU, dropping the
  `--use-angle=swiftshader` flags in `render.mjs` should be much faster.
- **Usage limit:** the first run hit the account's usage limit after the idea step. Each animator agent uses a
  lot (hundreds of thousands of tokens), so pace the runs.
- **Bug found in the store look:** the original look (`games/robo-rally/scene.js`) draws the floor in the transparent
  pass, so lasers and sparks on the far half of the board get painted over. Lumen's own floor is already opaque.
