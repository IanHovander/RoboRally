# Energy (charging up on a battery): the animation director's verdict

I judged this as the person who has to ship one of these into Lumen's `scene.js`. I looked at every contact sheet,
then at frames from every video: strips at 12-20 fps, every frame around each arrival and payoff, full frames at the key
moments, and frame-to-frame difference and brightness curves to find pops, flashes and snaps at the end. The baseline
is a sparkle you can barely see, so any of these is a step up. The question is which one survives several times a game
on a 10-13 space board with the HUD across the bottom 40% of the screen.

## Scores

| Entry | Delight | Surprise | Clarity | Lumen | Craft | Repeat | Overall | Note |
|---|---|---|---|---|---|---|---|---|
| 1a-thump | 6 | 5 | 6 | 6 | 6 | 6 | **6** | The lift and slam read well and end on a good amber gulp and ring, but the joke's setup (the beat of nothing, the stuttering arcs) is hidden under her body, so the room sees a hop and a power-up. The cough is a full-body amber bloom that pops for two frames. |
| 1c-dead-air | 5 | 6 | 5 | 5 | 3 | 3 | **4** | A snap-zoom in, a vignette that crushes Ezra and a snap back out is far too much camera for a moment that comes round several times a game. Her ring is clipped by a hard edge as she arrives, and the camera is still drifting home after the moment ends. |
| 2a-brownout | 7 | 8 | 6 | 8 | 7 | 7 | **7** | The dip is smooth (a two-frame sag, a half-recovery, a second sag), and Ezra wilting on the same circuit, then jolting back late, reads at TV size. But Maya never turns amber, so the payoff rests on a HUD number rather than on her. |
| 2c-brownout | 8 | 8 | 8 | 9 | 6 | 6 | **8** | The strongest picture on the list: for half a second she is the only lit thing in the room, her ring and pool going amber while the world drops near black, and then the power surges back. The drop is a one-frame cut, the board goes very deep (about a fifth of its light), her ring is clipped as she arrives, and the return overshoots into a bloom flare. |
| 3a-bankers-hand | 7 | 7 | 5 | 6 | 5 | 5 | **5** | A cube lobbed from our side is a real surprise, but on screen it strikes her nose, bounces behind her, skids off to her right and melts at the edge of her ring, leaving a stray ring behind. That is too many beats in 1.35 s for one clear path. |
| 3b-for-me | 8 | 7 | 6 | 5 | 5 | 4 | **6** | The best acting of the set (the double-take, Ezra's where's-mine), but the cube enters as a huge blooming block that floods the left of the frame with amber and then cuts through her silhouette. The double-take is too small to read at TV size and will wear thin by the fifth charge. |
| 3c-into-focus | 7 | 7 | 7 | 7 | 6 | 6 | **6** | The cleanest cube: one lob, a crisp landing ring, a slide in and an amber swirl. The defocused square reads as a glow over the board rather than something on our side of the glass, the 3D cube is small, and the camera push and the ring clip on arrival come from the lab, not the game. |
| 4a-squeezed-out | 6 | 6 | 5 | 7 | 7 | 7 | **6** | Tidy, glitch-free and charming up close, and the bolt is the board's own glyph. At real board size, though, the bolt and its shake are a speck, and the payoff is her body washing to peach. |
| 4b-sat-on | 6 | 6 | 5 | 6 | 6 | 6 | **5** | The extruded bolt reads as a bright white bean, not a bolt, until it is on her back. The amber burst is strong, but the acting (her double-take, Ezra copying the shake) disappears at TV size. |
| 4c-chronophotograph | 7 | 7 | 6 | 7 | 5 | 4 | **5** | The strobe fan is a striking image that echoes Lumen's light trails, but it reads as lightning climbing out of her into the HUD card rather than a hop onto her. It also needs a camera push on every charge, and her ring is clipped as she arrives. |
| 5a-the-well | 6 | 6 | 5 | 9 | 7 | 8 | **6** | The most Lumen of the set and the calmest (about a second, no glitches). But the dark well is mostly hidden under her body and the drop is a hairline, so at TV size it is an amber ring that comes and goes. |
| 5b-dont-look-down | 7 | 7 | 6 | 8 | 6 | 5 | **6** | The acting reads: she glows, the hole opens, she looks down and sinks, a drop plinks and she bobs back up. But it shows a pit where the battery is, a real misreading risk in a game where pits matter. Her red also goes to salmon, and it snaps back in about three frames at the end. |
| 5c-edgerton-drop | 7 | 7 | 5 | 8 | 5 | 3 | **5** | Gorgeous in stills, but a camera tilt into the sky, a hidden card and slow motion belong to a finale, not to a small reward that comes several times a game. The splash crown is too small to read, and her ring is clipped as she arrives. |

Two things I saw across several entries:

- **Ring clip on arrival (all the c entries).** For about 0.2 s as she arrives, a hard rectangular edge cuts away part of
  her ring and pointer. The a and b entries, which use the game's own move, don't have it.
- **Camera still moving after the moment ends (1c, 3c, 4c, 5c).** The camera is still easing home after the moment
  "ends", so the time it really costs is longer than it says.

## Winner: 2c-brownout

**Why.** It is the only entry that reads at real board size with no fine detail: for half a second the whole room goes
dark and Maya alone keeps her light, her ring and pool turning amber, so everyone sees who charged and that it was a
charge. It is pure Lumen (light and its absence, nothing new drawn on the board) and moves no robot, so it never gets
in the game's way. It also scales to the real case: when several robots charge on one register, every one of them
stays lit in the dark.

**Porting: what to fix and watch.**

- **The sag.** Ease the first sag over two or three frames instead of a one-frame cut (2a's start is right).
- **The depth.** Cap it at roughly 30-40% of normal light rather than near black.
- **The return.** Drop the bloom overshoot so it never reads as a flash.
- **The move and the camera.** Play it after the game's own move: the clip on her ring as she arrives comes from the
  lab's puppet move. Keep the camera still (drop the FOV breath).
- **In `scene.js`.** Run topMat, spill, motes, key/hemi and the other robots' glows through one dimming factor, and
  restore it in a `finally`.
- **The HUD.** It takes the same factor, but each charger's energy readout stays lit.
- **Several chargers.** Every robot that charges on the register keeps its light. Deepen the dip a little per
  charger, with a cap.
- **Over a whole game.** Consider making it shallower after the first few charges.

## Runner-up: 2a-brownout

**Why.** The same idea with better manners: a two-frame sag, a half-recovery and a second sag that feel like real
house lights, at a gentler depth that will last a whole game. Ezra wilting and jolting back a beat late reads at TV
size and makes every other robot part of the joke. It loses to 2c only because Maya herself never shows the amber; its
timing and Ezra's wilt belong in the port.

**Porting: what to fix and watch.**

- **The payoff.** Give Maya 2c's amber ring, pool and eye, so it is on her, not on a HUD number.
- **The wilt.** It must apply to every robot that is not charging, and hand each one back exactly at its rest pose and
  facing. Keep the lean small so nobody misreads which way a robot faces.
- **What it touches.** The same things as 2c (topMat, spill, background, a HUD factor), and it needs no camera move.
