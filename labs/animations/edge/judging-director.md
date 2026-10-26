# Edge: the animation director's verdict

Moment: Maya plays Move 3 and drives off the east edge. She is out until she reboots. Time budget 3.5 s. This happens
a few times a game, and the scenario calls it "big, funny, a little cruel". Today the game tips her over the rim and
she vanishes in about 2.2 s (`out/edge/baseline.sheet.jpg`).

I judged what is on screen in the final videos, not what the descriptions promise. I read every contact sheet, then
pulled frames at 10 fps and 30 fps around each key beat and full-resolution stills, and measured the frame-to-frame
change to find cuts and pops. All times below are video times; each `play` starts at 0.6 s.

| Entry | Delight | Surprise | Clarity | Lumen | Craft | Repeat | Overall | Note |
|---|---|---|---|---|---|---|---|---|
| 1c-bungee | 8 | 8 | 7 | 8 | 7 | 6 | **8** | Her own trail peels off the rim and catches her. The hold at rim level under the iris (2.1–2.6 s) is the best-acted beat of the set, and the snap and ghost land the "a little cruel". The 0.25 s whip-pan home buries the loose end's whip, and after the snap the strand still ties her ghost to her falling body. |
| 2c-off-the-tv | 9 | 9 | 7 | 5 | 8 | 5 | **7** | The biggest "wait, what?!" of the set: a giant, slowly tumbling Maya drops past the lens, with a nicely telegraphed glow at the top of the frame, and there are no pops or camera moves. Close up, though, she is mostly a slab of glossy pink plastic, and the light leaks are a film trope rather than Lumen. Her fall also passes through the bottom of the screen, where the game's HUD sits. |
| 3c-undo-denied | 5 | 6 | 5 | 6 | 4 | 4 | **5** | A hard snap-zoom cut at 1.9 s (by far the biggest frame jump of any entry) and a blue room tint. The pale "chronophotograph" ghosts read as a glowing slinky, not as her past poses. The replay is too quick for the "same tape again" laugh to land, and she fades out just under the rim rather than falling. |
| 4c-skipping-stone | 8 | 8 | 7 | 9 | 7 | 8 | **8** | The most beautiful entry, and the purest Lumen: a mirror-black lake, wide rings of light, hop arcs drawn in the air, and a quiet sink. At the end, the full set of ripples vanishes in a single frame (3.73 s) while the camera cranes home in a hurried 0.5 s. |
| 5c-raft | 5 | 7 | 4 | 8 | 5 | 7 | **5** | The damped bob of the glass slab is calm and lovely, and the strobed outlines are good Lumen line-work, if busy. But the key event is a glitch: Maya pops out of existence in two frames just below the rim (2.30 s), so the room never sees her go. |

## Winner: 1c-bungee (Bungee, held breath)

**Why.** It is made of the one thing a Lumen viewer already watches: her own red trail, which stretches, flares under
her weight and snaps, so the moment reads from the back of the room with no new vocabulary. The timing has real
acting. The drop and stretch are the anticipation, the yank back to the rim is the hope, the held beat under the iris
is the tension, and the snap, with a ghost left hanging, is the cruel punchline the scenario asks for. It works the
same for every robot form and every edge, and it fits the budget (3.07 s).

**Port notes.**
- **Calm the exit.** Replace the 0.25 s whip-pan with a slower ease home of about 0.6 s, or let the camera settle
  before the loose end whips back across the glass. Right now the whip, which should be the last laugh, happens
  during the pan and is lost. It ends as a small ring at (4,1).
- **Untether after the snap.** Remove the strand segment that still runs from the hanging ghost down to the falling
  Maya, so she drops free.
- **Frame for the real board.** Make the push-in relative to the exit rim on a 10–13-space board, cap the zoom, and
  keep the rim and the dangle in the upper 60% of the screen (the HUD covers the bottom 40%). For a north-edge exit
  the slab hides the drop, and a south-edge exit drops toward the HUD, so the camera wish needs an azimuth or
  elevation per edge.
- **Build the strand separately.** It should be its own tube or line, seeded from the trail's last points. On the
  snap, hand the remaining trail back so the game's normal trail fade does not draw it twice.
- **Overlays.** The iris becomes a vignette pass and the ghost a translucent clone of the model. Keep the snap bloom
  local, not a full-screen flash.
- **Engine.** Damage and the cancelled program should wait for the snap. The rebound height can vary a little so the
  third fall of the night is not identical.

## Runner-up: 4c-skipping-stone (Skipping stone, night lake)

**Why.** It turns the void into a still lake, which surprises without being a gag. Rings of light many times her
size on pure black, plus her reflection, are Lumen at its best and read clearly on a TV. Because it is graceful rather
than a joke, it is the entry most likely to still please on the fourth fall of the evening.

**Port notes.**
- **Fix the end pop.** Fade the ripples to zero before handing back, since they currently vanish in one frame at
  the end of the moment, and give the crane home about 0.8 s instead of 0.5 s.
- **Not just for Pebbles.** The conceit is Pebble-specific ("she skims"), and five of the six forms are not
  Pebbles. Decide what an Orb, Cube or Spire does: the same skip with more or fewer hops, or a heavier single plonk.
- **Keep the camera dive modest.** The dive to water level is a big move to repeat several times a game. Keep the
  lake action in the upper 60% of the screen, because the outer rings already reach the HUD zone.
- **Local slow motion.** The slowdown on the first touch must be local to this effect, not the engine's clock.
- **Ripple layering.** The ripples are planes just under the glass top. Check that they never draw over belts, pits
  or the slab's own light. The reflection is a mirrored clone of the model.
