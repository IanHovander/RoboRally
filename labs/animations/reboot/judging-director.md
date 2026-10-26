# Reboot: the animation director's verdict

What I judged: every entry's contact sheet, a 10 fps strip of each video, and closer crops and single frames
where a beat was in doubt. The moment has a 3 s budget and happens once per fall, so a few times a game. All ten
entries come in under 3 s (2.47 s to 2.90 s) and render with no warnings.

Scores run from 1 to 10. The overall score is my own judgement, not an average.

| Entry | Delight | Surprise | Clarity | Lumen | Craft | Repeat | Overall | Note |
|---|---|---|---|---|---|---|---|---|
| 4a-gone-fishing | 9 | 8 | 8 | 7 | 8 | 8 | **8** | The camera never moves, and the whole joke reads from the sofa: a bright slack rope arcs over the token, the bead bobs in the dark past the corner, Theo nearly gets yanked off his feet, Maya is hauled up the side of the slab and heaved onto the token, then two pale flops. The only blemishes are the mid-flop pose (a flat pale brick) and her name tag popping on at the end. |
| 4c-night-fishing | 8 | 8 | 8 | 9 | 7 | 7 | **8** | The prettiest version of the gag. The cast is a clean arc, the bead's glow pools on the black room floor, and rings spread when she bites, so the dark becomes a lake. The cost is a camera pan to the west edge and back. The line is thin for a 12-wide board, and her tag sinks into her body during the flops. |
| 1c-iris-drain | 7 | 7 | 9 | 8 | 7 | 6 | **7** | The whirlpool at 0.7-0.9 s is the most beautiful frame in the set, and the blackout makes the token impossible to miss. But the inflowing light looks like thick white hair or warp-speed streaks, not Lumen's fine seams. The camera lean plus a full second of black board is heavy for a beat that comes back several times a game. The two grey threads blanch her twice, cleanly, and the end has no jump. |
| 3b-shakes-it-off | 7 | 6 | 7 | 6 | 6 | 7 | **6** | The black silhouette on the token's glow is a strong picture, and the stunned hold before the shake is good timing. But the silhouette and its glow pool pop in on a single frame, black drops on dark glass barely read, and the two grey SPAM blinks and Theo's wet face will be invisible on a 12-wide board. |
| 5c-breath-on-the-lens | 7 | 8 | 7 | 5 | 7 | 4 | **6** | The better-made fog: a soft breath with the board's lights glowing through, clean wiped strokes, and a doodle that states her space and facing literally. It is still a milky grey patch that breaks Lumen's dark calm, the SPAM smears are vague, and the fourth-wall joke only surprises once. |
| 4b-theo-goes-fishing | 7 | 7 | 7 | 7 | 6 | 6 | **6** | The same gag with more acting, but the acting is too small to read at TV size: the double-take dips, her glare, his glance away. The flick goes out nearly straight, like a shot, before it sags. Her tag slides across her body during the flops, and Theo's lean snaps flat in one frame at release. |
| 2b-skipping-stone | 6 | 6 | 5 | 6 | 5 | 6 | **5** | The red-then-grey ripples count the damage nicely. But the skips are too low to read as skips, her path crosses right over Theo for half a second with the two name tags stacked, and the rings roll off the board edge. The proud pose, the dizziness and Theo's duck are too small to see. |
| 2c-strobe-skip | 6 | 6 | 5 | 7 | 5 | 4 | **5** | The glass ghosts and the long-exposure arc are very Lumen. But the camera drops to water level for two seconds, the red ghost hides behind Theo's tag, and the grey ghosts pile up on Maya, so the count turns into a cluster. That is too much camera for a moment that repeats. |
| 5a-fogged-screen | 6 | 8 | 6 | 3 | 5 | 4 | **5** | A big surprise the first time. But the fog is an opaque, speckled grey blob, the brightest thing on screen and more terrazzo than breath. The wiped arrow and the drips read as black marker, and 1.2 s of doodling will drag by the third reboot. |
| 3c-bullet-time-shake | 6 | 3 | 5 | 4 | 5 | 3 | **4** | A two-frame snap zoom, a bullet-time orbit through black glossy beads, then a pull-out with a roll in it. Spectacular once, but it is the Matrix cliché. It hides the board and the name tags for 1.5 s, and the macro shot turns Lumen's glass world into black caviar on plastic. |

## Winner: 4a-gone-fishing

**Why.** It is the only entry that is funny, readable from the back of the room and calm on camera all at once.
The slack, sagging line is Lumen's laser breaking its own rule, light that curves, and the haul up the side of the
slab and the heave onto the token have real weight. The joke is social: Theo's player gets the credit, Maya's
player gets teased, and the fisher changes from reboot to reboot, so it stays fresh across a night. It ends
exactly on the rules' state, with Theo eased back to rest and no jump.

**What to fix or watch when porting.**
- **Rope physics.** Step the Verlet rope on a fixed timestep (an accumulator at about 120 Hz). Its damping and
  4 substeps run once per rendered frame, so on a TV browser at 30-60 fps the rope would behave differently from
  the lab.
- **Which edge.** Drop the bead off a board edge that is on screen. In the lab it goes off the north-west corner,
  not the nearest edge. With a 10-13 wide board the room beyond the side edges is thin, and the south edge sits
  behind the HUD, so prefer the north or side edge nearest the token and keep the bead's bob in frame.
- **Who fishes.** Pick the nearest robot whichever way it faces, and test a cast from a robot facing away.
  Define a fallback for when no robot is on the board. Stagger, or use different fishers, when several robots
  reboot in the same round, and keep the total inside the budget.
- **It must not read as a shot.** Keep the line white, slack and beaded, never laser-coloured or straight. Keep
  the 2 SPAM on the two flops after the line has unhooked, so nobody thinks Theo did the damage.
- **Polish.** Soften the mid-flop pose: less squash, and keep her red with only the eye greying. Fade Maya's name
  tag in on landing instead of popping it on at release.
- **Steal from 4c.** Take its ripple rings on the dark where the bead bobs and where Maya comes up, without its
  camera move.

## Runner-up: 4c-night-fishing

**Why.** The same gag, staged as the most Lumen picture in the set. The cast is a clean arc of light, the bead's
glow pools on the black room floor, and rings spread on it when she bites, so the darkness under the slab becomes
a lake. Its timing (cast, hush, bite, reel, slap, two flops) is the clearest of the three fishing versions.

**What to fix or watch when porting.**
- **The camera pan.** Its beauty depends on panning out to see past the west edge. In the game the board fills
  the width and the HUD covers the bottom 40%, so cap that move or bring the ripples close to the slab where
  they are already on screen.
- **Line weight.** Thicken the line and the bead for a 12-wide board. Its dashed, taut line will thin to a hair
  at TV size.
- **Name tag.** Keep it above her during the flops; today it sinks into her body.
- **The rest.** The same notes as 4a: which edge, who fishes, several reboots at once, and not reading as a shot.
- **Best of both.** Ship 4a's static-camera rope with 4c's water ripples.
