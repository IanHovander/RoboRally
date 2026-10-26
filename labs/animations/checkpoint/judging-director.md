# Checkpoint: the director's verdict

I judged each entry by what is on screen: its contact sheet, then frames pulled from the mp4 at 12.5 and 30 fps.
The question was which one I would ship into Lumen's `scene.js`. The budget is 3 s. Every entry fits it in the lab,
but the game sends the claim as its own beat (beatTime 1.4 s) after the 0.86 s Move 2. Whichever entry ships needs
that beat's time raised, and must not start until the claim beat arrives.

| Entry | Delight | Surprise | Clarity | Lumen | Craft | Repeat | Overall | Note |
|---|---|---|---|---|---|---|---|---|
| 1a-eulers-disk | 7 | 7 | 8 | 9 | 8 | 9 | **8** | A red hoop hovers, drops and wobbles down faster and faster around Maya while she ducks and follows it with her nose, then clicks flat and becomes her taken ring. There's no camera move and no glitch, but at 10-13 spaces the wobble gets small and the sound has to carry the drumroll. |
| 1b-spellbound | 7 | 7 | 7 | 8 | 6 | 7 | **7** | The same hoop, with a push-in and Maya swaying as if hypnotised. The acting is too subtle to read from the sofa, the hoop falls through the card, and the click blooms into a hot white halo for a few frames. |
| 1c-long-exposure-disk | 9 | 8 | 9 | 10 | 8 | 7 | **9** | The room goes down and the wobble smears into a glowing bowl and a painted spiral of red light. Then a click snaps it sharp, the lights come back and it cinches into her ring: the most Lumen piece here, and the drumroll is huge on screen. It costs a 2 s camera lean and dim, and the card slides out the top of the frame as the lean starts. |
| 2a-tiddlywink | 7 | 8 | 6 | 7 | 7 | 7 | **6** | A clean, quick flip that ends on a lovely square ripple and seam sparks. But it is one thin tile turning in about 0.75 s, so on a full board the upside-down beat is a blink, and the column disappears while the tile is out. |
| 2b-token-flip | 6 | 7 | 4 | 5 | 5 | 6 | **5** | The tile is a nearly invisible box, and the played card hangs right over the flip and hides it. The upside-down beat reads as a red blob in a box. |
| 2c-replay-flip | 5 | 7 | 4 | 6 | 3 | 4 | **4** | Glitchy: the whole frame flashes grey as the freeze starts, Maya z-fights under the tile, and the restart whips the camera through a giant, doubled Maya. The board is lost for most of the moment. |
| 3a-whiplash-stare | 5 | 6 | 5 | 4 | 6 | 6 | **5** | Theo's whip-and-wobble and the leaning flag 2 column are fun but small. The joke happens away from Maya, the claim itself is just the old expanding ring, and nothing new is made of light. |
| 3b-caught-staring | 5 | 5 | 5 | 3 | 6 | 6 | **4** | Theo turns a quarter and snaps back, and Maya's look back is barely visible. It is tidy, but at TV size it hardly registers, and it says nothing about the flag. |
| 3c-crash-zoom-stare | 6 | 7 | 6 | 7 | 5 | 4 | **5** | Stares that turn into beams of light in each robot's colour are a strong Lumen image. But it is a crash zoom and two hard steps back to wide, with the card and name tags popping in on the second step, and the flag's column turns red. |
| 4a-elastic-leash | 7 | 8 | 6 | 7 | 7 | 6 | **7** | The best physical comedy here, and flag 2 brightening as she bolts teaches the next flag. The leash is a thin line tangled with her own move trail, though, and the claim itself (her ring) is underplayed. |
| 4b-leash | 7 | 7 | 7 | 7 | 7 | 6 | **6** | A brighter leash and a red ring dropping down the column make the claim clear. The bolt is shorter and softer than 4a's, and Theo's head-shake is invisible at TV size. |
| 4c-freeze-frame-detour | 8 | 7 | 8 | 8 | 6 | 5 | **7** | Flag 2 turning her colour, the white-hot elastic in the iris and the ring dropping down the column all read well. But the punch-in and snap-back are near cuts, and flag 2 leaves the frame during the freeze. Both columns tinted red could read as ownership on a busy board. |
| 5a-trick-candle | 7 | 8 | 5 | 7 | 6 | 5 | **6** | Charming beats (inhale, skid, sparks, whoomp), but the candle is tiny beside her nose and the dark flag is hidden under Maya. The relight blows out to white over the card while the camera snaps home. |
| 5b-make-a-wish | 5 | 7 | 4 | 6 | 5 | 5 | **4** | The flame is a speck and the puff particles drift out behind her. The dark beat barely registers, and the relight ring pops in on one frame. |
| 5c-lights-out-wish | 8 | 8 | 6 | 8 | 7 | 6 | **7** | The biggest atmosphere: a candlelit close-up, real darkness with a curl of light-smoke, and the column relighting from the glass. But the amber glow is off-palette, its reflection reads as a second flame floating off the flag, Maya stays brightly lit in the "dark", and the lights snap up. |

## Winner: 1c-long-exposure-disk

**Why.** It turns the Euler's-disk drumroll into light painting. The speeding wobble smears into a glowing bowl and a
tightening spiral in a darkened room, then one click snaps it sharp and it cinches into the game's own taken ring.
It is the most Lumen thing in the set, and the claimer's colour closing in on the claimer is unmistakable. The
lean-in makes the tension big enough to read from the sofa, and that cost is fair for the big progress moment that
happens a handful of times a game.

**Porting: what to fix and watch.**

- **Timing.** In the game the claim is its own beat after the 0.86 s Move 2, but the lab drops the hoop 0.2 s into
  the move.
  - Start the drop on the claim beat.
  - Cut the spin from 1.42 s to about 1.0 s, so the claim fits in about 2 s and the moment stays under 3 s.
  - Raise the claim beat's time in `beatTime` (engine.js) from 1.4 s to match.
- **Camera.** Scale the lean to the board size. Frame the claimer in the part of the screen above the HUD (the top
  60%), not the middle of the screen.
- **Several claims in one beat.** Skip the lean and dim, and play 1a's on-board version for each robot.
- **Card and name tags.** Fade them out before the lean starts (as 1a does). Don't let the card slide out the top of
  the frame.
- **Lights.** Keep the HUD out of `setDim`. Keep the 0.12 s held beat before the instant lights-on.
- **Ring height.** End the hoop at the stacked ring height (0.06 + 0.07 per ring already there), so it matches
  `setTaken` exactly.
- **Cleanup.** The spiral rebuilds a 2000-point buffer every frame: reuse it. Dispose of the hoop, its ghosts and the
  buffer if the beat is skipped or cut short.

## Runner-up: 1a-eulers-disk

**Why.** The same idea with no camera, no dimming and nothing borrowed from the lab. The hoop hovers, drops and spins
down faster and faster around Maya while she ducks and tracks it, then clicks flat and becomes her ring. It is the
cleanest and calmest entry, the one least likely to tire over a game, and it is also the right fallback inside the
winner when several robots claim at once.

**Porting: what to fix and watch.**

- **Timing.** The lab moves Maya itself in 0.62 s and drops the hoop during that move. In the game, leave the move to
  the engine and start at the claim beat.
  - The click then lands about 1.7 s after arrival and the cinch about 2.2 s after.
  - That runs just over the 3 s budget, so trim about 0.15 s from the hover and bounce.
- **Maya's acting.** Add her duck and nose-follow on top of the robot's resting pose only.
- **Size.** At 10-13 spaces the hoop is about 70% of its lab size. Thicken the tube or raise its glow a little so the
  wobble still reads.
- **Sound.** Drive the whirr's pitch from the same precession rate, because the sound carries the drumroll at TV
  size.
- **Card and stacking.** Keep the card fade while the hoop falls, and stack the hoop on rings already there.

Honourable mention: **4c** and **4a** are the only entries that teach "next: flag 2", and **5c** has the boldest use of
darkness. Each has a craft or palette problem, listed above, that keeps it behind the hoop.
