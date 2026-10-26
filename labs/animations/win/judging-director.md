# Win: director's verdict

Judged from the contact sheets and from frames pulled out of every video at 10-30 fps. I judged what is on
screen against shipping into Lumen's real `scene.js`: a 10-13 space board, the bottom 40% of the screen under
the HUD, and a dark room watching one TV. Budget: 6 s. Today's game: rings plus a zoom on Maya (`baseline`).

| Entry | Delight | Surprise | Clarity | Lumen | Craft | Repeat | Overall | Note |
|---|---|---|---|---|---|---|---|---|
| 1a-tape-measure | 9 | 8 | 8 | 8 | 8 | 9 | **9** | The whole game's trails whip back onto the glass in half a second and hang as one picture: Theo's loops make a coil spring, and Jun's line drops off the front edge. Then everything reels back into the robots, Maya last. Strong impact and follow-through, no flashes, done in 4.5 s; the wobbling ribbons are a little less calm than Lumen's straight trails. |
| 1b-long-exposure | 8 | 8 | 8 | 9 | 7 | 9 | **8** | A clean, calm long exposure in Lumen's own line style: repeated laps are drawn as a coil, and a last ember runs home into Maya. The trails pop in (about 0.3 s), the 2.6 s hold is long, and Theo's blush turns his whole body pink, which looks like a player-colour change at TV size. |
| 1c-photo-finish | 6 | 7 | 8 | 7 | 5 | 8 | **6** | Thin right-angled trails make a tidy metro-map photo. But the touch fires a full-frame grey flash (average brightness jumps from 40 to 83 in one frame) and then a softer second one, the crane move barely registers, and the thinner lines carry less light than 1a or 1b. |
| 2a-skipping-stone | 6 | 7 | 5 | 7 | 5 | 6 | **5** | The skid and the coin spin-down are well timed. But the skips stay within a space of the slab's edge, so the rings pile into a knot and the loop never reads as a lap. Her trail off the board lingers after the moment. |
| 2b-skipping-stone | 8 | 8 | 6 | 7 | 6 | 6 | **7** | The big arcing skips round the slab and the leap over a ducking Theo are a real gasp, then a cheer. But the coyote hang at the edge lasts about 1.5 s with a slow orbit, her look at the camera is too small to read, and at 5.9 s it nearly fills the budget. |
| 2c-skipping-stone | 8 | 8 | 6 | 9 | 7 | 6 | **7** | The most beautiful images in the set: a punch-in freeze over the void, then big rings of light on the water seen from water level. Hard cuts lose the board and the name labels for a second, and the idea only works when the last flag is near an edge. |
| 3b-house-lights | 6 | 8 | 7 | 4 | 4 | 5 | **5** | It reads instantly because the whole picture changes. But it hard-cuts from average brightness 35 to 137 and back, a flashbang in a dark room. The flat grey has no cheap-table detail, and Maya being the only thing still glowing is too faint to land. |
| 3c-house-lights | 8 | 9 | 6 | 4 | 6 | 5 | **6** | The folding table with legs and a power cable is the biggest laugh here, and the fluorescent stutter is well judged. But three hard cuts, a wide shot that shrinks everyone, a cartoon iris-out and a black screen take it far from Lumen and make it a joke that works once. |
| 4a-eyes-in-the-dark | 6 | 7 | 6 | 8 | 6 | 6 | **6** | The eyes open almost all at once around and below the slab, so they look like a field of white dashes rather than a crowd. The wave is hard to see, and the latecomer gets lost next to Jun. |
| 4b-eyes-in-the-dark | 7 | 8 | 7 | 9 | 7 | 6 | **7** | The best build of the three: one eye, Maya double-takes, two, then dozens. The crowd sits behind the slab, clear of the HUD, with rings in every player's colour. At TV size the wave and Maya's bows are small, and the eye wanders across the crowd instead of landing on her. |
| 4c-eyes-in-the-dark | 7 | 8 | 5 | 9 | 7 | 6 | **6** | The stadium of eyes and the halo that backlights Maya are lovely. But the camera pulls back until the board is a third of the frame, and most of the crowd sits in the bottom 40%, where the HUD goes. |
| 5a-domino-run | 5 | 6 | 4 | 6 | 5 | 5 | **4** | The panes are crammed into a tight zigzag between Maya and Theo and look like a pile of white sticks. The fallen run turns into grey slabs, and the double-boop gag can't be seen at this size. |
| 5b-domino-run | 8 | 6 | 8 | 8 | 7 | 7 | **7** | Clear and satisfying: a clean U of fins rises from Maya's square, a bright front topples round to Theo with each pane turning red, and the run sinks into a red line of light. Domino runs are a familiar trope, though, and the last pane's 1 s teeter is dead air from across the room. |
| 5c-domino-run | 7 | 6 | 5 | 8 | 6 | 6 | **6** | The overhead view, then a low ride along the falling front leaving arcs of light, is cinematic. But the run curls tightly round Maya, the low camera loses the board and the labels, and the camera whips home in 0.4 s. |

## Winner: 1a-tape-measure

It turns Lumen's own fading trail into a finale that replays the whole race: the room points and laughs at
Theo's coil and Jun's drop off the edge, and no two games draw the same picture. It is also the best-animated
entry: the ribbons whip in with real impact, hang, then reel back in with follow-through, ending on Maya with the
biggest clack. It reads across the whole board with no flashes or cuts, and it ends in 4.5 s with every robot
where the rules put it.

**Porting:**

- Have the engine log each robot's path every register: a break for a fall, a restart at the reboot token.
  Draw each log as one additive ribbon.
- On a 10-13 space board over a full game, the log turns to spaghetti. Draw repeated laps as offset coils (as
  1b does), dim or thin the oldest parts, and scale ribbon width and wobble to the board.
- Keep head speed set per robot, so all the heads land together in about 0.5 s.
- Move the drip to a side or back edge, or drop it: its ring on the floor falls in the HUD band.
- The engine waits only 3 s on the win beat (`beatTime`), and this runs about 3.3 s after the touch. Lengthen
  that wait, or hold the result screen until the reel-in lands.
- Robots only rock: they never change space or facing.
- Dispose the ribbon geometry afterwards.

## Runner-up: 1b-long-exposure

The same idea, staged more calmly. The clean lines match Lumen's real trails, repeated laps read as a coil, and
the hold is long enough for everyone to find their own robot's story. The last ember running home into Maya gives
a soft, clear ending on the winner.

**Porting:**

- Slow the trails' arrival to the intended 0.5 s with visible heads. Right now they pop in about 0.3 s.
- Trim the 2.6 s hold to about 1.8 s.
- Replace Theo's whole-body pink blush with a glow on his eye or rim, so no robot ever looks like it changed
  player colour.
- Choose who reacts from the log: the longest path blushes, whoever fell shudders.
- As with 1a, lengthen the engine's 3 s wait on the win beat.

**Also worth keeping:** 2c's water-level rings are the most beautiful frames in the set, and 4b's crowd of eyes
behind the slab is the most portable idea, since it doesn't depend on where the flag sits.
