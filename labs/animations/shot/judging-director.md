# Getting shot: the director's verdict

Judged as the animation director who has to ship one of these into Lumen's `scene.js`. For every entry I looked at
its contact sheet and at frames pulled from the video (10 fps strips across the whole moment, 30 fps around the
hits, the camera moves and the endings, and key frames shrunk to about the size they will be on the game's
10-13 space board).

This is the most frequent bad thing in the game: every register, for every robot in someone's line, often several
at once. That counts against anything that takes the camera, dims the whole room, needs a bystander or has to stay
rare. Every entry fits the 2.5 s budget (moments run 1.43-2.37 s; today's game takes 1.0 s).

Scores run from 1 to 10. Overall is my judgement, not an average.

| Entry | Delight | Surprise | Clarity | Lumen | Craft | Repeat | Overall | Note |
|---|---|---|---|---|---|---|---|---|
| 1a-pile-up | 8 | 8 | 6 | 8 | 8 | 7 | **8** | The best beat structure in the set: Theo rocks back, the head races in, the light folds into a bright curly heap taller than Maya, then a quick slurp, a big swell and a settle, all in 1.87 s with no camera move. The heap blooms a little hot, and the gulp could read as charging up rather than taking damage. |
| 1b-pile-up | 7 | 7 | 6 | 6 | 7 | 5 | 6 | The pile reads as a jagged heartbeat-monitor spike rather than a folded hose, and the acting (Maya's double look, Jun craning, Theo's tilt) is too fine to read at TV size. Her paint washes to lilac on the swell, and 2.33 s is long for every register. |
| 1c-pile-up | 7 | 7 | 7 | 7 | 6 | 2 | 4 | The zoom makes this the clearest of the three heaps. But two snap-zooms, then a whip home in about 0.2 s with Theo cropped out of frame, can't play on every register. |
| 2a-only-light | 5 | 7 | 4 | 5 | 6 | 3 | 4 | The blackout reads, but the smoked glass turns into a flat pale-blue tabletop, the robots lose their colour, and the torn shadow is a soft dark blob at the slab's edge that nobody will find. The lights come back cleanly and quickly (1.43 s). |
| 2b-only-light | 6 | 7 | 4 | 5 | 5 | 3 | 4 | The hard polygon shadows swing with the beam, but they look like rendering artefacts. The rip shows as a red sliver at the board's edge with a red glow in the void, and the robots go nearly black, so you can't tell who is who. |
| 2c-only-light | 6 | 7 | 3 | 6 | 6 | 2 | 4 | The most cinematic frame here, but a 0.15 s push-in crops the board, hides the name labels and turns Jun into a black silhouette. A whole-room blackout plus a camera move can't happen every register or with several shooters. |
| 3a-laser-pointer | 7 | 7 | 5 | 5 | 7 | 3 | 5 | A clear crouch, wiggle, pounce and cartoon hang with no camera move. But the beam is drawn at a diagonal until the hop, which contradicts "straight ahead", Jun turns orange to blush (so his colour no longer says who he is), and it only works when a bystander is nearby. |
| 3b-laser-pointer | 6 | 6 | 5 | 5 | 7 | 3 | 5 | The tidiest of the cat versions, but the pounce is small and Jun's guilty look over his shoulder is too fine to read at TV size. Maya's paint washes pale at the hit. |
| 3c-laser-pointer | 7 | 7 | 6 | 6 | 5 | 2 | 5 | The freeze frame makes the punchline unmissable, but it needs a camera creep, a tilted snap-in and a CSS filter on the game canvas. When Jun lands, his ghost lingers as a second solid cube, and the camera whips home in about 0.2 s. |
| 4a-edge-on | 6 | 7 | 7 | 9 | 7 | 8 | 7 | The purest Lumen take: a pale slide drawn in light that is the laser line seen edge-on. It hinges open, holds, and slips through a slot of light into her. At TV size the thin blue card and its tiny "SPAM" are hard to read, the tail snaps in within a single frame, and the closing ring is blue (the laser's colour), not hers. |
| 4b-edge-on | 7 | 7 | 9 | 6 | 7 | 7 | **7** | The phones' own coral SPAM card turns out of the laser line and is unmistakable at TV size, so the rule explains itself, and Maya reading it and shaking her head is charming. But the card is a flat opaque tile over a red robot (red on red), it shrinks into her instead of sliding in, and 2.23 s is long for every register. |
| 4c-edge-on | 7 | 7 | 8 | 8 | 6 | 3 | 5 | The card her eye projects onto the glass is a lovely Lumen image and very readable. But slow motion, a house-light dip and a camera push with a quick return make it a 2.3 s production number, too heavy for every register. |
| 5a-wiped-clean | 6 | 8 | 5 | 6 | 6 | 2 | 5 | The splat on the TV's glass works, but it lands small, between the robots. The squeegee has no visible thumb: the blob just whips off the top edge in about 0.15 s, so the wipe gag doesn't read. |
| 5b-wiped-clean | 5 | 7 | 5 | 4 | 6 | 2 | 4 | The smudge reads as a grey soap-bubble ring with dots, not as blue light. The robots looking up at us are too small to read, and the wipe leaves only a faint streak. |
| 5c-wiped-clean | 8 | 9 | 5 | 6 | 6 | 2 | 5 | The dark thumb sweeping across the screen is the biggest gasp-and-laugh in the set. But the splat is a hard-edged opaque disc for three frames before it pops soft, it lands right over Maya at the moment of the hit, and the rack focus blurs the whole board. It can only be a rare easter egg. |

## Winner: 1a-pile-up (heavy light)

**Why:** It turns the most ordinary thing on the board, the laser line, into slapstick made entirely of light, and
it does it locally: no camera move, no change to the room's light, no bystander needed. In 1.87 s it has real
anticipation (Theo rocks back), an impact, a held heap, a punchline gulp and a clean settle with no jump. The curly
heap is the brightest moving thing on screen, so it reads at TV size, and since it grows with range it stays varied
over a night.

**When porting:**
- Generalise the hard-coded east-west row to any direction, to wall lasers and to double lasers (`n: 2`).
- Make sure a point-blank shot gives a small curl.
- Stagger or cap the heaps when several robots fire at once.
- Add a damage cue at the gulp, such as the blink in SPAM coral or the HUD's SPAM tick timed to it, so swallowing
  light doesn't read as charging up.
- Cool the bloom halo around the heap.
- Keep Maya's swell clear of robots on neighbouring spaces.
- Aim for about 1.5 s.

## Runner-up: 4b-edge-on (dealt)

**Why:** It shows exactly what the rule does (one SPAM card into her deck) with the same card art as the phones,
and it is the easiest entry to read at TV size. The turn from line to card is a crisp reveal that people will learn
to wait for. It needs no camera move and works from any shooter direction, because the card's plane is computed
against the camera each frame.

**When porting:**
- Build the card as 4a's light-rimmed glass slide with `drawCard('sp')` as its face, so it is made of light rather
  than a flat sticker.
- Lift the card clear of Maya's silhouette so it isn't red on red.
- Replace the shrink-pop with 4a's slide through a slot of light.
- Trim Maya's reading and head-shake to keep it under about 1.8 s.
- For 2 SPAM cards, stack two slides.
