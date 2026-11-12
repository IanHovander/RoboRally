# The sizzle reel: 23.5 seconds before round 1

Written 2026-11-11 as a prototype, and made the film before round 1 the same day (section 3, A): when a
newcomer is racing and the leader hasn't asked for the full rules, the big screen plays it in phase `brief`.

- `games/robo-rally/sizzle.js`: the reel. `sizzlePlan()` is the whole reel as data; `startSizzle(o)` plays it on
  the host's arena, with the same options as `startBriefing`.
- `games/robo-rally/sizzle.css`: its black, its words, its title.
- `public/dev-sizzle.html`: watch it, pause it, go to any moment (section 4).

It does two jobs at once. It sells the game to a room that has never played: quick cuts on a shove into a pit,
a crossfire, a belt, a chain off the edge, a win. And it plants the three things a newcomer needs before
round 1, in this order, and nothing else:

- **(a)** your phone programs your robot: five cards, and they run in order;
- **(b)** every robot runs at once, so they collide: shoves, lasers, pits;
- **(c)** touch the flags in order; first to the last one wins.

Every robot on screen is run by the real rules (`lessons.js`'s `runLesson`, on tiny courses written in
`sizzle.js`), and wears a racer's colors. No names: they are not the players' own robots.

## 1. Storyboard

Times are seconds from the start. The cuts sit on a 250 ms grid; the sounds on them are the reel's beat.
"Heard" means the big screen's sound is on and the narrator's recordings loaded.

| # | Shot | Start | Length | On screen | Words on the glass | Sound | It is there to |
|---|---|---|---|---|---|---|---|
| 1 | Cold open | 0.0 | 3.0 | Up from black (0.1 to 0.4). A 6 by 3 board, two robots, a pit. One charges three squares, its Move 3 card over it, and hits the other at 0.8. The camera goes in and the scene slows (the arena's own slow motion for a push to a fall). The other teeters on the rim (1.1), goes down (1.7); its ghost comes up out of the pit (2.1) and the first one looks pleased with itself. | none | one soft note as the picture comes up (0.26); the shove's knock (0.8); the fall's falling tone (1.1) | sell: robots shove each other into pits, and it is funny. It explains nothing, on purpose. |
| 2 | The phone | 3.0 | 6.0 | Cut. The phone (`mimic.js`'s drawing, larger) at the left; at the right a 5 by 4 board with one robot, in the phone's color, and one flag. Seven cards are dealt (3.8 to 4.4). Five of them drop into the five slots at 5.40, 5.57, 5.74, 5.91 and 6.08; with each, the line of light on the board grows one card further toward the flag. The lock lights (6.32). The robot runs the five cards (6.56, 6.98, 7.29, 7.86, 8.17): the lit slot on the phone and the 1-5 strip at the top walk along with it. It stops on the flag (8.6): rings of light. | heard: none. Not heard: YOUR PHONE (3.3 to 5.3) | narrator at 3.15: "Each round, your phone deals cards. Fill five slots." A low chord on the cut; five rising notes as the cards land; a note at the lock, four quick ones as it sets off; a tick for each slot; the flag's chime (8.6) | plant (a): the phone, five cards, in order |
| 3 | Crossfire | 9.0 | 1.25 | Cut. Three robots. Three cards turn over at once, numerals of light at their feet. Two turn to face the middle (9.24, 9.35); the third steps between them (9.46); both fire (9.78) and it spins. | ALL AT ONCE (9.1 to 10.2), always | a note on the cut; a tick every 250 ms starts here and runs to 14.75; the hit (9.84) | plant (b): everyone's card runs at the same time. Sell: lasers. |
| 4 | Shove | 10.25 | 1.25 | Cut. Four robots, four cards over them. Two drive clear (10.48, 10.59); the third (10.70) drives into the fourth and shoves it a square (10.91); the fourth drives on (11.35). | none | narrator at 10.4: "Robots shove." A note on the cut, a step higher; the knock (10.91) | plant (b): so they collide |
| 5 | Belt | 11.5 | 1.0 | Cut. One robot steps toward a flag (11.54), onto a belt. The belt carries it sideways (11.82) into a pit (12.02); its ghost (12.38). | none | narrator: "Into pits." (11.58). A note on the cut; the fall | sell: a belt takes someone the wrong way |
| 6 | Off the edge | 12.5 | 2.25 | Cut. Three robots in a row. The one at the back drives three (12.56); the two in front slide (12.8); slow motion (13.2); the front one goes over the edge (13.34), hangs, drops (14.0), lands far below (14.5). The one that drove looks pleased. This is the moment the reel holds. | none | narrator: "Off the edge." (12.51). The highest note on the cut; the knock (12.8); the fall (13.4) | sell: a chain of shoves, and the longest fall |
| 7 | Flags | 14.75 | 5.75 | Cut, then no cut to the end of the shot. An 8 by 3 board, three numbered flags in a row. A robot takes flag 1 (15.55: its light turns the robot's color, rings), then flag 2 (16.77). A rival that has been turning on the spot beside the lane steps into it (17.43) and is shoved past flag 3 (17.71). The robot stops on flag 3 (18.29): a pillar of light, rings, the camera leans in. Black comes up from 20.2. | heard: none. Not heard: FLAGS IN ORDER (15.05 to 17.05), LAST FLAG WINS (17.4 to 19.9) | narrator at 14.9: "Objective: the flags, in order." and at 17.3: "First to the last flag wins." A chime for each flag; the win's fanfare (18.3) | plant (c) |
| 8 | Title | 20.5 | 3.0 | Black. ROBO RALLY in the big screen's title type (thin, upper case, widely spaced, a soft glow) comes up from 20.65, its spacing easing closed, and goes at 23.0 to 23.4. | the title | a low chord (20.6), under the fanfare's tail | the name |

Total: **23.5 seconds.** Esc, Space or Enter skip it (section 3); `stop()` puts the arena back as it was found.

### The words

The owner's rule is that words on screen go toward zero, so the reel follows the game's rule for subtitles: a
line of the narrator's that can be heard is not also written. With the sound on, the only words on the glass
are ALL AT ONCE (no recorded line says it, and it is the rule the game turns on) and the title. With the sound
off or locked, three of the narrator's four lines are stood in for by two or three words each, one at a time,
at the bottom of the screen (at the top on a phone held upright). "Robots shove. Into pits. Off the edge." has
no words standing in for it: the three shots are what it says.

The four lines are ones Floor Control already has recordings of (`voice/clips.json`). Nothing new was
recorded. The cuts of shots 4 to 6 were placed on the pauses inside the third line, which were measured from
its file (the phrases start 0.0, 1.18 and 2.11 seconds into it).

### What is left out, so that it is quick

The rules decide where every robot goes. The telling is compressed:

- Turning the cards over takes 180 ms (a breath), not the race's second and a bit.
- A robot's card shows over it as it moves, not before.
- Robots that don't touch each other set off 110 ms apart, in the order the rules play them, instead of each
  waiting for the one before to finish. That is what makes it read as "all at once".
- In the flags shot the three volleys of robot lasers between the slots are not played (the robots are in each
  other's line once the rival steps in). In the phone shot the flag is a flag, not a win.
- No junk cards fly, nobody reboots, and the little boards have no reboot rings: a round arrow nobody has
  explained.

### The cast

Robot i of a scene wears the colors of racer i + a shift, different for each scene (`SHIFT` in `sizzle.js`).
With four racers: the first shoves the second into the pit; the third's phone drives it to a flag; the second
and third shoot the fourth; the fourth shoves the first; the belt takes the third; the first goes off the
edge; and the second, who went down the pit at the start, takes the last flag. With five or more, everyone
gets on screen. With fewer racers than a scene has robots, spare colors that no racer has fill in.

## 2. How it is built

One timeline. `sizzlePlan()` returns plain data: `shots` (name, start, end), `cues` in order (`cut`,
`reveal`, `beat`, `sync`, `line`, `unline`, `tempo`, `spot`, `snd`, `vo`, each at a fixed time), and three
tracks that are pure functions of the time (`words`, `phone`, `regs`). It needs no page, so `node` can print
it. `startSizzle()` plays the plan: its own clock T advances with real time, cues fire as T passes them, and
the layer (black, words, title) and the phone are redrawn from T on every frame. Nothing of the reel's own
runs on a CSS animation.

While the reel has the arena it replaces the arena's clock, so the scene's time is T's. `seek(ms)` finds the
shot under that moment, runs its cut (which builds its board and robots from nothing), and then runs the
arena forward to `ms` by hand in 20 ms frames, with nothing drawn and nothing emitted. A seek costs 2 to 12 ms
on the machine it was written on. The same moment reached by two routes has the robots in the same places
(checked at seventeen moments). Sparks and smoke use random numbers, so those differ.

To do this without touching `scene.js`, `sizzle.js` reaches into the arena: it swaps `arena.clock`, calls
`arena.frameLoop()` itself, and for the length of a seek or a cut covers `emit`, `adapt`, `checkPicture` and
the two `render` calls with empty ones. On a cut it also sets each robot's `pop` (so they are there, not
popping in), `dimCur`, and runs fourteen frozen frames so the camera is already where it will stay. `stop()`
undoes all of it. If `scene.js` ever grew `advance(seconds, { silent })` and `settle()`, the reel would use
those instead; nothing needs them today.

## 3. How to hook it in

Three ways, smallest first. **A is what the game does** (since 2026-11-11); B and C are not applied.

### A. The reel is the Briefing's short film

The leader's "Rules tutorial" keeps the narrated film (`briefing.js`); every other Briefing plays the reel.
`startSizzle` takes the object `maybeBrief` already builds and returns `stop()` and `next()`, so the rest of
`host.js` (the skip keys, the votes, `stopBriefing`, `briefDone`) works as it is. In `games/robo-rally/host.js`:

```js
import { startBriefing } from './briefing.js';
import { startSizzle } from './sizzle.js';            // add
```

and in `maybeBrief`:

```js
    host.classList.add('briefing');
    briefing = (v.opts.brief ? startBriefing : startSizzle)({     // was: briefing = startBriefing({
```

Leave `skip` out of the options there: `host.js`'s own keys already skip the Briefing. What the room loses
this way: the roll call (whose robot is whose), the flags lit on the real course, and the hand-over line. The
roster and the name tags in round 1 still say whose robot is whose.

### B. The reel, then the roll call

Keeps "that robot is mine". It needs one filter in `briefing.js`, in the line that collects the shots:

```js
  const shot = (name, run, when = true) => when && (!ctx.only || ctx.only.includes(name)) && shots.push({ name, run });
```

and in `maybeBrief` the options go in a variable, so the reel's `done` can start the Briefing's last shots:

```js
    const ctx = { arena, view: () => view, /* ...as now... */ done() { api.send('briefDone'); endBriefing(); } };
    briefing = v.opts.brief
      ? startBriefing(ctx)
      : startSizzle({ ...ctx, done: () => (briefing = startBriefing({ ...ctx, only: ['roll call', 'your turn', 'questions'] })) });
```

About 36 seconds in all. One thing to look at when trying it: the narrator's line of light is switched on by
the Briefing's first shot (`online`), which this leaves out, so the roll call would be spoken without it
unless `roll call` calls `line.show()` itself.

### C. The lobby's film

`lobby.js` has its own arena and phone, and the join column takes the right of the screen. In `start()`, in
place of `play(version)`:

```js
      reel = startSizzle({ arena, layer: ui, mimic, regs: showRegs, cast: players.filter((p) => p.connected !== false),
        loop: true, vo: false, words: 'never', frames: { wide: frame, phone: frame } });
```

with `reel?.stop()` before `arena.destroy()` in `release()`, the scene dots hidden, and the reel started again
when the roster changes (the cast is read once). It also needs two rules in `sizzle.css`, because the lobby's
layer is the whole screen and its phone has a fixed place: `.lesson-ui .lf-phone.sz-phone { scale: 1; }` and
`.lesson-ui .sz-title { right: 26vw; }` (the join column's width), with the title's size brought down to fit.
None of C has been run.

## 4. Looking at it

`npm run dev`, then `http://localhost:3000/dev-sizzle.html`. It builds the arena on a real course with the
racers on their pads, as the host has it when the Briefing would start, and shows a play button (a click is
what lets the browser play sound).

| In the address | |
|---|---|
| `?n=4` | racers, 1 to 8 |
| `&t=8000` | start paused at 8 s |
| `&auto=1` | start without the button (silent until the page is clicked) |
| `&loop=1` | play round and round |
| `&vo=0` | the narrator stays silent |
| `&words=always` or `never` | the words whatever is heard, or no words (`auto` is the default) |
| `&course=closing-time` | the course behind the play button |
| `&ui=1` | keep the control bar up (otherwise it shows while the mouse moves) |

In the console: `sizzle.seek(ms)`, `sizzle.play()`, `sizzle.pause()`, `sizzle.time` (a number; it can also be
called), `sizzle.duration`, `sizzle.shots`, `sizzle.shot()`, `sizzle.start(ms, paused)`, `sizzle.stop()`,
`sizzle.events()` (what the arena said happened, with times: shoves, falls, flags, the win) and
`sizzle.state()` (what the arena is like now, for checking the hand-back). Esc, Space or Enter skip.

Like `dev-host.html`, the page is copied into the website by `npm run build`.

## 5. Not done, not verified

- **Nobody has watched it move.** It was checked as frames at chosen times (every shot, at 1280 by 720 and at
  375 by 812), as the arena's own log of what happened and when, and as a log of every sound call. Whether
  the cuts feel right, whether 1.0 s is long enough for the belt, and whether the tick under shots 3 to 6
  helps or grates are for someone with eyes and ears.
- **Nobody has heard it.** The browser pane it was built in keeps sound locked. The sound calls were logged
  at the right times (section 1's times are from that log); their levels against each other and against the
  voice are unknown.
- **The narrator's real clips were never played in it.** The speaking path was run with a stand-in voice that
  says it is audible: the four lines were asked for at 3.15, 10.40, 14.92 and 17.32 s with the right ids, and
  only ALL AT ONCE and the title were on the glass. That the phrases land on the cuts is arithmetic from the
  files' lengths, not something heard. `voice.say` adds a chirp and up to 90 ms before the first line.
- **In `host.js`** (hook A) it was run in `dev-host.html?to=brief`: it played its eight shots at their times,
  then the phones' test drive began and the arena was the race's again; Esc in the middle, and a majority of
  phones voting to skip, both ended it cleanly; with "Rules tutorial" on, the narrated Briefing played instead.
  That was with the sound locked, so the narrator's lines were never asked for there.
- **The hand-back** was checked in the dev page after the reel played out and after Esc, Space and Enter in the
  middle: the course, the players' robots, `tempo`, `camMode`, `calmWin`, `tagsOnly`, `dim`, `focusOn`, the
  frame, the clock, the roster and the phone were as before. `host.js`'s `stopBriefing` then does its own
  reset on top.
- **Played through in real time** twice as it is now: 23.54 s with the sound locked (the four sets of words
  and the title came and went at the times in section 1) and 23.51 s with the stand-in voice. In the pane, a
  tab in the background did not run its frames until a screenshot woke it; that is the pane.
- **The win's rings** are scheduled by `scene.js` on a real timer, so after a seek they come late; played
  straight through they come when they should.
- **Casts other than four** were checked for colors only (no two robots of a scene alike, for 1, 2, 4 and 8
  racers), not looked at.
- **Upright** it was looked at standing still at 375 by 812. The arena's camera going in on a fall crops a
  wide board there, as it does in a race.
- **A slow computer:** a cut rebuilds a small board in the same frame. That was unnoticeable here; it was not
  tried anywhere else. `BLINK` in `sizzle.js` puts a few frames of black on each cut if it shows.
- **Reduced motion** is not considered.
- **Tests:** `test/lessons.mjs` checks the plan (the length, the shots without a gap, the cues in order), that
  each scene shows what it is for when run through the rules, and that the narrator has a recording of every
  line it says. Nothing tests the playing of it.
