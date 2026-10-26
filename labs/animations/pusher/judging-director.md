# Pusher: the director's verdict

Moment: a push panel on the north wall fires and shoves Maya one space south, toward us. She keeps facing east.
Budget 2 s. It happens now and then, on the courses that have push panels. Today the game plays a 0.7 s plate kick
and slide (`out/pusher/baseline`).

I judged each entry from its contact sheet and from frames pulled out of its video (10-30 fps strips around each
beat), not from its description. Scores run from 1 to 10.

| Entry | Delight | Surprise | Clarity | Lumen | Craft | Repeat | Overall | Note |
|---|---|---|---|---|---|---|---|---|
| 1a-splat | 7 | 8 | 5 | 3 | 5 | 3 | 4 | It would be the biggest laugh, but the smear is a cartoon blob of paint with drips, not light. The camera snaps home in about 0.17 s, and for a few frames she sits as a flat cut-out with no ring before she pops back. |
| 1b-face-on-the-glass | 7 | 8 | 5 | 4 | 5 | 3 | 5 | The pressed glossy oval with its eye-streak is the best splat picture, and Ava's double-take ends it well. The rush-in frames are an unreadable pink tongue that fills the screen, and the smear leaves through the bottom of the frame. |
| 1c-against-the-glass | 6 | 7 | 6 | 5 | 4 | 3 | 5 | The cleanest graphic of the three: her outline and ring stamped in light, with a smooth cross-fade home. The impact is a three-frame grey wash over the whole screen. Like the other two, it needs a huge camera dive and only works for panels that push south. |
| 2a-rewind | 7 | 7 | 8 | 7 | 7 | 6 | 7 | All of it plays from the home camera, so the overshoot, the teeter at the brink and the reel back up her trail read at TV size. The arm of glass sleeves is pure Lumen. The "she has already landed" pause (about 0.15 s) and the rewind (about 0.2 s) are too short to register. |
| 2b-rewind-take | 7 | 7 | 5 | 6 | 6 | 4 | 6 | The best acting of the rewinds, and the low Dutch angle is dramatic. But the camera leaves the board for over a second, both name tags disappear and pop back, Ava blooms into a white blob, and the whip home takes about 4 frames. |
| 2c-instant-replay | 6 | 6 | 5 | 5 | 4 | 4 | 5 | The white ring that marks her real space helps the room read the result. The scene goes murky, the low shot hard-cuts back to the board in one frame, and during the rewind the trail spooling back reads as a pink blob under her. |
| 3a-cuckoo | 6 | 7 | 5 | 7 | 6 | 6 | 6 | The warm three-stroke bird is the most Lumen of the cuckoos. The camera stays close for the whole act, so Ava is cropped to a glowing blob in the corner, and the bobs are too small to count from the couch. |
| 3b-cuckoo-heckler | 7 | 7 | 8 | 6 | 6 | 7 | 7 | The most readable cuckoo: the camera stays near home, the big bird of light sits on a stick with sound arcs for each call, Maya looks annoyed, and the peck and slide are clear. The bird pops in fully formed in one frame with no door opening first, and Maya's name tag blinks off and back on. |
| 3c-cuckoo-count | 6 | 6 | 6 | 5 | 5 | 6 | 5 | Showing the register as tally marks crossed by a slash is clever. But the bird blooms into a scribble nobody can read, the little house looks like a "home" icon from a UI, and the house and tally stay on the board for a few frames after the camera is home. |
| 4a-tablecloth-drawer | 6 | 7 | 8 | 8 | 7 | 8 | 7 | A lit tray of smoked glass with bright compartment edges is Lumen's own material, and it reads at a glance. The whip back (2 frames and a ring) lands cleanly, with her on the right space. The gag is quieter than its description: the jolt and the rocking barely show. |
| 4c-sleight-of-hand | 6 | 6 | 5 | 6 | 5 | 5 | 5 | A freeze frame is a good idea, but the long-exposure streak sits right where the tray was, so the freeze reads as "paused on the tray" instead of "hanging over nothing". The desaturation is a CSS filter laid over the whole picture. |
| 5a-door-ajar | 7 | 7 | 7 | 9 | 7 | 8 | 7 | Beautiful and calm, from the home camera. Light really comes through a crack, with her shadow cut out of it, so the dark lane points the way she drifts. The light reads as two headlight beams more than as one wedge, and the door fin covers part of Maya's name tag ("AYA"). |
| 5b-sunbeam | 7 | 7 | 7 | 7 | 6 | 7 | 6 | Maya basking like a cat in the sun is charming acting. But the crack is drawn as a hollow rectangle floating above the wall, her long shadow is a hard-edged dark strip, and Ava's highlight blows out. |
| 5c-the-other-room | 8 | 7 | 8 | 9 | 8 | 8 | 8 | The most finished entry. The room's light sinks, a slab of warm light stands up behind the panel, and a clean wedge with motes carries her one space. The door then closes to a line and goes out, leaving nothing behind. It is calm, readable from the couch, and works for any wall. |

## Winner: 5c-the-other-room

**Why.** It is the one entry built entirely from Lumen's own language of light, glass and darkness, with no camera
stunt and no glitch. The wedge of light points the way she will go before she moves, so the room reads the push
without words. Taking away the plate and showing a brighter room behind the wall is a real surprise. It turns a
minor, occasional shove into a quiet moment of wonder that will still be lovely the fifth time it plays.

**Port it carefully:**
- **Pre-allocate the spot light.** Create the warm SpotLight in `scene.js` at load time with intensity 0. Adding a
  light at runtime makes three.js recompile every lit material, which causes a visible hitch the first time a panel
  fires.
- **Share one room dim.** When several panels fire in the same register, use one `arena.dim` dip for all of them and
  a door per panel. Dims must not stack. Restore the dim exactly.
- **Hold the camera.** Keep it home, or make the drift smaller than in the lab: the real board is 10-13 wide and the
  HUD covers the bottom 40% of the screen.
- **Keep the tag readable.** The door slab glows over Maya's name tag and all the tags dim. Keep the pushed robot's
  tag at full brightness and clear of the slab.
- **Test all four directions and inner walls.**
  - On an inner wall, the standing slab of light sits mid-board and can hide robots behind it from the camera.
  - A north push sends the wedge away from us.
  - Clip the wedge at walls and at the board edge.
  - When the panel pushes a line of robots, all of them must drift together.
- **Watch the timing.** It runs 1.77 s, within the 2 s budget. The door must be fully shut before the next move
  starts.

## Runner-up: 2a-rewind

**Why.** It is the comic version that never leaves the home camera, so the whole gag reads at TV size: the
overshoot, the teeter at the brink, and the rewind up her own trail. The telescoping arm of glass sleeves and light
belongs in Lumen. Going off the edge really does cost a reboot, so the room gasps, and then the board takes it back
and they laugh. This moment has room for that.

**Port it carefully:**
- **Plan the overshoot from the board.** When the panel fires, find up to 2 empty spaces ahead, stopping before
  robots and walls. End at the brink only when an edge or pit is in reach.
- **Make the fallback worth seeing.** With no room to overshoot, it plays just the guilty extra clack in place.
  Check that this still lands.
- **Don't trigger anything.** Never let the overshoot cross an element it could seem to trigger: a belt, a
  checkpoint or a battery.
- **Lengthen two beats.** Hold the "landed" pause to about 0.3 s and the rewind to about 0.35 s, and take the time
  from the arm's retraction. It already runs 1.97 s of the 2 s budget.
- **Use the real trail.** The rewind must reel in the game's own trail (`bot.trail`) and leave it exactly as a
  one-space push would.

If the team wants the safest possible ship, 4a-tablecloth-drawer is the fallback. It works in any direction, needs
no board queries, and is a small set of meshes.
