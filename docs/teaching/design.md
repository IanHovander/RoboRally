# Robo Rally: how the game teaches itself

Step two of the teaching plan. `questions.md` lists what players will wonder and when. This document picks
the combination of teaching methods, specifies each piece closely enough to build, lists the existing
teaching that is wrong, and splits the work into three chunks that can be built in parallel.

The standing rules: show, don't tell. An animation beats words. Every word a player has to read costs
something, and words are only there to clarify a detail. A spoken voice isn't reading, so voice is allowed.
The big screen is the shared show; phones hold only what's private. Keep the screens uncluttered, put the
primary action at the bottom, and prefer a button going from disabled to enabled over explanatory text.

**Contents**

1. [The combination](#1-the-combination)
2. [The pieces, specified](#2-the-pieces-specified)
3. [The voice: Floor Control](#3-the-voice-floor-control)
4. [Fixes to existing teaching, and data the screens need](#4-fixes-to-existing-teaching-and-data-the-screens-need)
5. [Build plan](#5-build-plan)
6. [Decisions taken (and the one to confirm)](#6-decisions-taken)

---

## 1. The combination

### In one breath

**One voice, one button, one clip library.** Things explain themselves where they appear.

- **The big screen teaches the room.** The wordless lobby film gets one new scene (damage) and has two
  misleading ones fixed. When a newcomer is racing, a **70-second narrated Briefing** in the voice of
  *Floor Control* (the store's after-hours computer) plays between picking start pads and round 1. A
  majority vote on the phones skips it. During the first race the same voice calls out each first-time
  moment once (first laser hit, first damage, first fall...). The callouts are short and briefly hold
  the race. Some changes are permanent and need no voice: the turn order shows under the robots at
  every reveal, junk cards visibly fly from a hit robot to its owner's token, names stay readable in
  round 1, and shut-down robots look shut down.
- **The phone answers the individual.** One **"?" button** sits at the top right of every phone screen,
  the lobby's waiting screen included. Tapping it dims the screen and lets you **point at anything**:
  a card, a slot, a counter, or any square on the map. That thing's natural questions are then answered
  with looping clips. From there, **the Book** shows every clip at once under mechanics headers.
  - **New things are flagged.** The first time something appears on your phone (SPAM in your hand, a
    locked slot, the reboot arrows, the shop), it pulses once and the "?" briefly shows its picture.
    One tap goes straight to the answer. Ignoring it costs nothing.
  - **Passive things answer a plain tap.** These are things that do nothing when tapped today: a
    locked slot, the SPAM count, the flags.
  - **The race screen becomes "what happened to me".** Each finished slot collects small marks for
    what happened to you in it. Tapping a slot replays it on the real course, next to the path you
    planned.
- **One rules change:** round 1 skips the shop (section 6).

How each kind of player gets through it:

- **"Just let me try it".** Vote to skip the Briefing and play. The light line, the one-time callouts
  and the replays answer "why did that happen?" at the moment of surprise. Nothing blocks you and
  nothing has to be read.
- **"Tell me first".** Watch the film in the lobby, open the Book on your phone while waiting, watch the
  Briefing, and point "?" at anything during play. You can always get an answer, without asking the
  leader.

### Why this combination

- **One entry point on the phone.** The owner's manual idea and "?" idea are one need: "answer my
  question". They become two depths of the same button. Pointing comes first, because most questions
  are "what is this thing?". The Book is one tap deeper, for browsing. Two icons would split attention
  and screen space.
- **Voice only when the room is listening.** A voice looping in a chatty lobby grates, and latecomers
  interrupt it. The lobby film stays wordless. The voice speaks:
  - after pads are picked, when everyone has just been told to look at the TV;
  - at first-time moments, when everyone is already watching the thing that surprised them.
- **The Briefing covers what the film can't show.** Some rules overturn instincts from other games: no
  health (damage is junk cards), Haywire jams a slot, the board moves after every slot, turns are the
  robot's own, a flag counts only if you stop on it, and time running out fills slots at random. A
  wordless film can't overturn an assumption, but one spoken sentence over the right animation can.
- **Learn-by-doing was already the best teacher.** The phone's light line already answers facing,
  turns, belts and pits before you commit. The biggest gap was afterwards: "my plan didn't work and I
  can't see why" (ACT-02, the most common feeling). Per-slot marks plus a replay with the planned line
  overlaid answer it without words.
- **Cues are flags, not popups.** A popup blocks the "just try it" player and gets dismissed unread. A
  pulse on the new thing plus a "?" that shows its picture costs nothing to ignore and one tap to use.
- **Adaptive, so veterans aren't punished.** Phones remember whether they've finished a race. With no
  newcomer present, there is no Briefing and no callouts. Each callout fires once per big-screen session.
  Each phone cue fires once per phone, ever.
- **Coherence.** All of it shares:
  - one narrator;
  - one look (light on dark glass);
  - one clip vocabulary: lesson runs through the real engine on the TV, and `demo.js` loops on phones,
    rebuilt from the same storyboards;
  - one behaviour: things explain themselves where they appear.

### Rejected, and why

| Idea | Why not |
|---|---|
| Narrating the lobby film | Voice over a chatty lobby, looping every 2½ minutes, is grating; the room isn't listening yet. Kept wordless. |
| A separate manual icon *and* a "?" icon | Same need, two buttons; the top bar has no room for both at 360 px with the leader's ⋯. Merged. |
| A guided tutorial round / practice level / "safe first round" | A sixth system and a second set of rules; insults "just try it" players. The real game with callouts and the light line does the job. (One-player practice already works.) |
| Coach-mark popups ("This is your hand. Tap a card…") | Reading, blocking, dismissed unread. Replaced by pulses and the "?" chip. |
| Showing the engine's beat captions/log on the TV ("Ada: SPAM → Move 2") | Words on the shared screen every second. The first-time callouts and the phone replays cover the same need. |
| Pre-recorded narration audio | Better voice, but needs a TTS pipeline and re-recording on every script change. Speech synthesis first; `voice.js` can swap in recorded clips per line id later (section 3.6). |
| Voice on phones | Eight phones talking at once in a party room is noise. Phones stay silent; their answers are clips plus one fine-print sentence. |
| Long-press as *the* way to ask | Undiscoverable. Kept only as an accelerator on top of "?". |
| A per-player 3D replay on the TV | The TV is shared; "what happened to *me*" is private and would stall the race. It lives on the phone. |
| Labels under the setup toggles | Words on the leader's screen. Instead the toggle explains itself with a clip when tapped. |

### The top 25 questions: who answers each, and when

Film = lobby film (scene #), Brief = Briefing (shot #, section 3.2), Call = one-time callout (section
2.3), TV = permanent big-screen change, Point/Book = the phone Guide, Cue = the phone's first-time flag,
Story = the phone's race marks and replay.

| # | ID | Question | Before play | At first encounter | Any time after |
|---|---|---|---|---|---|
| 1 | GOAL-01 | What am I trying to do? | Film 1, 4; Brief 3 on the real course | Call `flag` (next flag pulses) | Phone map lights the next flag (exists); Point at a flag; Book "Goal" |
| 2 | PRG-01 | What do I do with these cards? | Film 1 (phone mimic); Brief 5 | First card bobs (exists); "?" pulses on round 1 | Point at a slot; Book "Program" |
| 3 | MOV-02 | Left: whose left? | Film 1 (robot faces the camera, turns to screen-right); Brief 6 | Light line (exists) | Point at a turn card: `turn-own-left` |
| 4 | ACT-01 | Which robot is mine? | Brief 2 (roll call: each robot lights as its name is spoken) | TV: names stay above the cards all of round 1 | Roster; your robot top-left on the phone; Point at a robot on the map |
| 5 | CP-01 | Which flag next? | Brief 3 | Call `flag` | Phone map (exists); Book "Goal" |
| 6 | DMG-01 | How much health do I have? | Brief 9 | Call `damage`; TV: the junk card flies to that player's token (always); phone: it lands on your phone (always) | Point at the SPAM chip; Book "Damage" |
| 7 | ACT-02 | Why didn't I end where my line said? | Brief 6 ("trust the line" plus a shove in Brief 11) | Story marks under the slot | Replay with the planned line overlaid; Book "Last round" |
| 8 | BRD-01 | Why did my robot move by itself? | Film 2; Brief 7 | Call `board` | Replay shows the cause; Point at the belt/gear/panel on the map |
| 9 | RBT-01 | Where did my robot go? Am I out? | Film 2; Brief 11–12 | Call `fall`; phone fallen state shows the comeback (always) | Point at the reboot ring; Book "Falling" |
| 10 | DMG-03 | What's the red "!" card? | Brief 10 | Cue `spam-hand` | Point at the card |
| 11 | DMG-08 | Why did my card change? | – | Call `spam` / `again`; TV glitch (exists) | Replay step "card swapped"; Point at SPAM / Again |
| 12 | PRG-10 | Why can't I use that slot? | Film 3 (damage scene); Brief 10 | Phone: the Haywire slides under that slot during the race (always); Cue `haywire-slot`; a plain tap on the locked slot | Book "Damage" |
| 13 | UPG-01 | What's this shop? | Brief 14 | Round 1 has no shop; Call `shop` in round 2; Cue `shop` | Point at ⚡ or a tile; Book "Energy & upgrades" |
| 14 | PRG-07 | How do I submit? | Film 1 (fingertip taps ✓) | ✓ goes from dim to lit (exists) | Point at ✓ |
| 15 | TIME-01 | What if the timer runs out? | Brief 13 | Call `clock`; empty slots shimmer like dice in the last 10 s (always); Cue `timer` | Point at the timer |
| 16 | ORD-04 | Who goes first? | Brief 7–8 | TV: order numerals under robots at every reveal; roster "1" badge (always); Call `order` | Point at the "1" badge / a robot; Book "Order" |
| 17 | LAS-01 | Who shot me? When? | Film 2, 3; Brief 9 | Call `shot`; replay draws the shooter | Point at a laser line on the map |
| 18 | CP-02 | I drove over the flag; why didn't it count? | Brief 4 | Call `nearmiss` | Point at a flag: `flag-stop` |
| 19 | CRD-06 | What does Again do? | – | Cue `again`; Call `again` (slot 1 case); light line (exists) | Point at the card |
| 20 | SET-03 | What do these toggles do? (leader) | – | Each toggle plays its clip above the row when tapped (always) | Point at a toggle |
| 21 | WAIT-01 | Is it my turn? | Brief 7 | TV ready glow (exists) | Point at the race screen's eye |
| 22 | RBT-04 | What are the four arrows? | – | Arrows pulse, ghost turns (exists, strengthened); Cue `reboot-dir` | Point at the arrows |
| 23 | MOV-05 | Can I push robots? | Film 4; Brief 11 | Call `shove` | Point at a robot; Book "Robots" |
| 24 | SD-01 | What's the power button? | – | Hold-to-confirm in its sheet; the sheet's demo (exists); Call `shutdown` | Point at it |
| 25 | DEC-05 | How do I use my one-use upgrade? | – | Cue `arm`: the arm bar pulses on your first race with one | Point at the arm bar |

Everything else in `questions.md` (sections 6–9) is answered on demand by Point and the Book. Every "?"
target in `questions.md` section 9 is assigned a topic in section 2.2.4.

---

## 2. The pieces, specified

### 2.1 The lobby film (big screen, wordless)

**What changes.** There are four scenes instead of three. Two are fixed, one is new, and the film gains a
little shared vocabulary that the Briefing reuses. It plays only while the big screen shows the lobby
(unchanged), and the dots stay clickable (unchanged; four dots now).

Scene order: 1 Program → 2 Board → 3 Damage (new) → 4 Race. Loop length is about 2 min 40 s.

**Shared additions to every scene:**

- **Register strip.** While a scene's cards run, the race's 1–5 strip (`.lm-regs` styling) shows above
  the board, so "slot 1 for everyone, then slot 2" reads the same as in the real race.
- **Order numerals.** At each reveal, a small numeral of light (1, 2, 3) appears on the floor under each
  robot in turn order, for 1.4 s. This is the same effect the race uses (2.3).

**Scene 1, Program (changed: the robot starts facing the camera).** Its left turn goes to the screen's
right, which is exactly the MOV-02 trap. The scene was verified through the engine.

- Grid 5×4, one flag at (3,0). The robot starts at (0,0) facing S, towards the camera.
  - If the camera in `scene.js` looks from the other side, mirror the whole scene so the robot starts
    facing the viewer.
- Cards: `m2, rl, m3, rl, m2`. The path is (0,0)→(0,2), turn to face E (screen right), →(3,2), turn N,
  →(3,0). The robot ends on the flag and wins.
- As the fingertip places each card, a dotted path of light grows on the glass (`arena.ghostPath`,
  2.4.2), the same line the phone draws. The robot then follows it.

**Scene 2, Board (fix M12).**

- Round 2's program becomes `m1, m1, rl, m1, m1` instead of five Rotate Lefts.
- Add `damage: ['sp','sp','sp']` to the scene (2.4.1), so the wall laser and the reboot each give SPAM and
  no unexplained Haywire appears.
- The rest is unchanged: belt, gear, wall laser, pit, then the reboot at the start of round 2. The scene
  stops after the reboot.

**Scene 3, Damage (new): "damage is cards".** Robot 0 is the mimic's robot (the first joined player's
colours).

- **Board:** grid 6×3, no elements. Robots: L0 at (2,1) facing E, L1 at (0,1) facing E (behind it).
- **Damage deck:** `damage: ['sp','h01']`.
- **Round 1:** L0 plays `m1, rl, rr, m1, m1`; L1 plays `m1, rr, rl, rr, m1`. Verified through the
  engine:
  - Register 1: L1's laser hits L0's back. L0 gets 1 SPAM.
  - Register 3: L1 hits L0 again. Haywire h01 goes face down into L0's slot 3.
- **Round 2:** L0 plays `bk, ut, —, rl, m1` (slot 3 is locked); L1 plays `rl ×5`. In register 3 the
  Haywire runs: Move 1, Rotate Right, Move 1.
- **On the mimic phone:**
  - The SPAM card rises from the robot, flies across the screen, and lands on a small deck stack in the
    mimic's lower left. It stays there as a coral card on top of the stack.
  - In register 3 a violet card flies from the robot into slot 3, turns face down and locks (violet glow).
  - In round 2 the hand is dealt and the fingertip fills slots 1, 2, 4 and 5 around the locked one. In
    register 3 the slot flips face up and the Haywire's card floats over the robot.

**Scene 4, Race (unchanged program).** It gains the order numerals and the register strip. This is the
finale (a winner).

### 2.2 The phone Guide: "?", Point, the entry sheet, and the Book

#### 2.2.1 Entry points

- **"?" button.**
  - **Where it appears:** at the far right of the phone's top bar (`.pl-top`) in every game phase: setup
    (leader and waiting), start, brief, upgrade, program, activate, over, and the late-joiner watch
    screen.
  - **The leader's top bar:** the framework's ⋯ (`.menu-dot`) stays at the absolute top right, and "?"
    sits just left of it.
    - `.pl-top`'s right padding is 3.2rem only when `api.you.isVip`. Otherwise it is 0.6rem, so "?"
      is flush right for everyone else.
  - **Size:** a 2.75rem (44 px) square tap target; the glyph is 1.5rem in `--dim`.
  - **The lobby's waiting screen** (framework shell; a tiny shell edit, 5.1): "?" is absolutely
    positioned at top right with the same size and glyph. It opens the Book directly, because there's
    nothing to point at there.
- **"?" chip (first-time flag).** When a phone cue fires (2.2.6), a tab hangs under the "?" button. It
  doesn't widen the bar, so the top bar never reflows.
  - **Shape:** right-aligned under the button, 2.4rem tall, a pill showing the thing's picture (a SPAM
    card, a violet card, the reboot glyph, the bolt...) and a small "?".
  - **Motion:** it breathes for up to 12 s, or until the phase changes, then folds back.
  - **Tap:** opens that topic's entry sheet directly.
  - **Queue:** only one chip at a time; the newest replaces the old one.
- **Plain tap on passive things.** These elements do nothing today, so a tap opens their entry straight
  away:
  - a locked Haywire slot;
  - the top bar's flags, ⚡ and SPAM chip;
  - the race screen's reboot and power states, and the "someone is deciding" robot;
  - a past slot on the race screen (opens its replay).
- **Long-press (450 ms)** on any element with `data-ask` opens its entry, with an 8 ms vibration. This is
  an accelerator only; nothing depends on it.

#### 2.2.2 Point mode

- **Opening it:** tap "?". The button fills (light background, ink glyph).
- **What the screen does:**
  - The current screen stays where it is but dims to 35% brightness. Everything with `data-ask` stays at
    full brightness with a 1 px outline in `--me` that breathes once (600 ms).
  - The map canvas gets one outline as a whole; its squares are hit-tested (2.2.4).
  - Taps in Point mode **never perform the element's action**. A capture layer over `.pl` handles them.
- **Which element a tap opens:** the hit element is `document.elementsFromPoint` filtered to the topmost
  `[data-ask]`. Inside the map, the square is computed from the `drawMap` transform (`tile`, `ox`, `oy`).
  If a tap lands on nothing askable, the nearest `[data-ask]` within 24 px wins; otherwise nothing
  happens.
- **Bottom tray** (replaces the bottom actions while pointing; safe-area aware, 4.5rem tall):
  - left: a 📖 pill (`book` glyph) that opens the Book;
  - right: ✕, which closes Point mode;
  - no words.
- **Prompts:** if a decision prompt is open, "?" skips Point and opens the entry for the prompt's
  upgrade directly. The prompt's 12 s timer keeps running; the entry sheet stacks over the prompt sheet,
  and closing it returns to the prompt.
- **Closing:** ✕, tapping "?" again, Android back (`popstate`, pushed on open), or a phase change.

#### 2.2.3 The entry sheet

A bottom sheet built from the existing `.pl-sheet` styling. Max height 85vh; the inside scrolls if needed.

| Part | What it shows |
|---|---|
| Header | The thing's picture (the actual card face, glyph, robot, or upgrade tile at 2.4rem) plus a name only if the thing has a proper name: SPAM, Haywire, an upgrade name, a course name. No other title. |
| "Also here" | Only for map taps that hit several things (a belt square in a laser line, say): small chips with each extra thing's picture. Tapping one switches the sheet. |
| Clips | 1–3 looping `demo.js` canvases, playing together, each answering one natural question. Each clip has a caption of at most 4 words, top-left, 0.78rem, `--dim` (the question, for example "Whose left?"). Layout: 1 clip at full width, 16:9. 2 clips stacked at full width, 16:10, max 30vh each. 3 clips: the first at full width, then two at half width side by side. |
| Fine print | One sentence, at most 25 words, 0.85rem, `--faint`: the shortest true answer, for readers. Kids and skimmers can ignore it. |
| Bottom row | Centered ✕ (primary, the familiar pill), with 📖 to its left. |

Closing: ✕ goes back to Point mode, if that's where it came from, otherwise to the screen. Swiping down
closes it too.

#### 2.2.4 Topics: the catalog (`topics.js`)

Each topic is `{ sec, pic, name?, clips: [[demoKey, caption]], fine }`. The 40 upgrade topics and 17
Haywire topics are **generated** from `cards.js`:

- picture: the upgrade tile or Haywire card;
- name: the existing name;
- clip: the existing demo with the same key;
- fine print: the existing `text`, plus "how it shows up" from `questions.md` section 7 where it adds
  something (for example Deflector Shield: "Pays automatically; switch it off in its sheet.").

Below, new clips are marked ★ and storyboarded in 2.2.8. Existing clips that need fixes are marked ✎
(section 4).

**Sections** (the Book's headers: an icon plus one word):

| Section | Icon | Label |
|---|---|---|
| goal | `flag` | Goal |
| program | `hand` | Program |
| cards | `m1` | Cards |
| order | ① text | Order |
| board | `belt`-chevrons (`m1` in green) | Board |
| robots | robot | Robots |
| damage | `sp` card | Damage |
| falling | `reboot` | Falling |
| shutdown | `power` | Shutdown |
| energy | `bolt` | Energy |
| options | `timer` | Options |
| upgrades | upgrade tile | Upgrades |
| haywire | violet card | Haywire |

**Topics:**

| id | Section | Picture | Clips (caption) | Fine print |
|---|---|---|---|---|
| goal | goal | flag | ★goal-flags (In order), ★flag-stop (Stop on it) | Reach the numbered flags in order. A flag counts only if you're on it when a slot ends. First to the last flag wins. |
| slots | program | 5 slots | ★program-fill (Fill five) | Tap cards to fill the five slots. Slot 1 runs first. Tap a filled slot to take its card back. |
| line | program | dotted line | ★line-preview (Where you'll go), ★line-bumped (Robots change it) | Where your cards take you if nothing gets in the way. ✕: you'd fall. ?: can't be known. |
| lock | program | ✓ | (none: the sheet header animates ✓ from dim to lit) | Lights up when all five slots are full. Until the race starts, tap it again to change your cards. |
| clear | program | undo | ★clear (All back) | Empties all five slots. |
| timer | program | timer | ★timeout (At zero) | At zero, empty slots get random cards from your hand. Cards you placed stay. |
| me | program | your robot | ★facing (Your front) | Yours has the white outline. The point is its front. The map is the big screen, seen from above. |
| robot | robots | that robot | ★push (Shove), ★robot-laser (Laser) | Other robots' cards are secret. Robots shove and shoot each other; damage never knocks anyone out. |
| reboot-dir | falling | four arrows | ★reboot-face (Pick a way) | Choose which way you'll face when you come back. |
| m1 / m2 / m3 | cards | card | ★card-move (Forward), ★push (Into a robot) | Move forward 1 (2, 3). You shove robots in the way; only walls stop you. |
| bk | cards | card | ★card-bk (No turn) | Move back one space, still facing the same way. |
| rr / rl | cards | card | ★turn-own-left (Whose left?), ★card-turn (Stays put) | A quarter turn to the robot's own right (left), on the spot. Trust the line. |
| ut | cards | card | ★card-ut | Turn around, on the spot. |
| pu | cards | card | ★card-pu | Gain 1 energy. You don't move. |
| ag | cards | card | ★again (Repeat), ★again-first (In slot 1) | Repeats what your previous slot did. In slot 1 there's nothing to repeat: it becomes a random card. |
| sp | damage | SPAM card | ★damage-spam (Where from), ✎spam-play (Play it?) | Junk from being hit. Played, it's gone for good, but that slot runs a random card from your deck. Unplayed, it stays in your hand. |
| haywire-slot | damage | violet card in a slot | ★damage-haywire (Jammed slot), plus that Haywire's own demo (What it does) | A Haywire landed in this slot when you were hit. It runs here this round and can't be moved. Fill the others. |
| spam-count | damage | SPAM stack | ★damage-spam (Junk cards) | All the SPAM you own: in your hand, deck and discard pile. |
| damage | damage | SPAM + violet | ★damage-cards (No health), ✎shutdown (Clear it) | There's no health. Damage is junk cards. Clear it by playing SPAM or shutting down. |
| registers | order | 1–5 strip | ★order-registers (Slot by slot) | Every robot plays slot 1, then the board moves, then everyone plays slot 2, and so on. |
| priority | order | ① badge | ★order-priority (Who's first) | The robot marked 1 goes first in every slot this round, then in seat order. The mark moves one seat each round. |
| look-up | order | eye | ★order-registers | Your robot runs your cards by itself. Watch the big screen; the lit slot is the one running now. |
| belt-green | board | green belt | ★belt-green (One a slot), ★belt-curve (Curves) | Carries you 1 space after every slot. A curve turns you only if the belt carries you round it. |
| belt-blue | board | blue belt | ★belt-blue (Two a slot) | Carries you 2 spaces after every slot. |
| gear | board | gear | ★gear | Green turns you right, red turns you left, after every slot you end on it. |
| pusher | board | push panel | ★pusher (Lit slots only) | Shoves you one space, but only in the slots whose dots are lit. |
| pit | board | pit | ✎reboot | Drive or get pushed in, and you fall (see Falling). |
| edge | board | edge | ★edge | Off the edge is a fall too (unless safe edges is on). |
| wall | board | wall | ★wall (Stops you), ★wall (Stops lasers) | Walls stop robots, pushes and lasers. Hitting one doesn't hurt. |
| board-laser | board | red dotted line | ★board-laser (First robot only) | After every slot, it hits the first robot in the line: 1 SPAM per beam. |
| battery | board | battery | ★battery (Every slot) | End a slot here: +1 energy. Stay, and get +1 again next slot. |
| reboot-ring | falling | blue ring | ✎reboot | Robots that fall on this board come back here next round. |
| flag | goal | numbered column | ★goal-flags, ★flag-stop | Flag n. Rings at its foot show who has it. |
| dock | board | dock | ★battery | Where everyone starts. It has walls, edges and batteries like any board. |
| fall | falling | reboot glyph | ✎reboot (Pit), ★edge (Edge) | You sit out the rest of the round, take 2 junk cards, and come back on the blue ring next round. Flags, energy and upgrades stay. |
| shutdown | shutdown | power | ✎shutdown | Sit out one round; every junk card in your hand, slots and discard pile is thrown away. You can still be pushed, carried and shot. |
| energy | energy | bolt | ✎upgrades (Earn, spend), ★battery | Energy (max 10) buys upgrades. Earn it on batteries and with Power Up. |
| shop | energy | shop | ✎upgrades | Optional. + draws an upgrade (⚡1, once a round); tap one to install it (its price, one a round). Only installed ones work. |
| draw | energy | + tile | ✎upgrades | Draws a random upgrade into your collection. It isn't installed yet. |
| kind | energy | ∞ / 1× | (none) | ∞ is permanent: always on, 3 slots. 1× is one use, then gone: 3 slots. |
| arm | energy | arm bar | ✎boink | Tap the bar during the race to arm it; at your next turn your phone asks before your card. |
| decide | robots | robot + dots | (none) | That player's upgrade is asking them something. The race waits up to 12 seconds. |
| watch | order | eye | ★order-registers | The leader is choosing the course; look at the big screen. (Late joiner: you'll be in the next race.) |
| start | options | ▶ | (none) | Starts the race. Nobody can join once start pads are being picked. |
| course | options | course thumbnail | (none) | Dots: difficulty. Flag number: how many flags (more is longer). |
| opt-upgrades | options | bolt | ✎upgrades | Off: no shop and no energy; batteries and Power Up do nothing. A lighter first game. |
| opt-safe | options | wall | ✎safe-edges | The outer edge acts as a wall. Pits still swallow. |
| opt-lessspam | options | SPAM | ✎less-spam | SPAM in your hand goes to your discard pile after programming instead of clogging your hand. |
| opt-timer | options | timer | ★timeout | Minutes to program each round. ∞: no timer on the phones. |
| pad | board | numbered pad | ★facing | Pick any free pad. You'll face the board. Avoid sitting in a line behind others. |
| deck | program | card backs | (none; shows the deck and discard counts as numbers) | Your 20 cards: Move 1 ×4, Move 2 ×3, Move 3, Turn Right ×4, Turn Left ×4, U-Turn, Back, Power Up, Again, plus SPAM. |
| your-upgrades | energy | upgrade tiles | each installed upgrade's demo | (each upgrade's own text) |

**Map hit-test (`topicAtCell`).** Given a square (x, y) and the tap's position inside it, return the
topics there in this priority order:

1. a robot (`me` or `robot`);
2. a light-line dot or marker (`line`);
3. within 22% of a square edge that has a wall: `wall`; with a push panel: `pusher`;
4. a flag (`flag`) or the reboot token (`reboot-ring`);
5. a square on a board laser's path (`board-laser`);
6. the square's kind: belt (blue or green), gear, pit, battery;
7. outside the board: `edge`;
8. a dock floor square: `dock`.

The first topic opens; the rest become "also here" chips.

**`data-ask` assignments, per phone screen** (every target in `questions.md` section 9):

- **Setup, leader:** course card and arrows → `course`; ⚡/wall/SPAM toggles → `opt-upgrades` /
  `opt-safe` / `opt-lessspam`; ∞ 1 2 3 → `opt-timer`; ▶ → `start`.
- **Setup, others / the watch screen:** the eye → `watch`.
- **Start:** pads → `pad`; course overview → `course`; map squares → hit-test.
- **Upgrade:** ⚡ → `energy`; + → `draw`; tiles → that upgrade; ∞/1× marks → `kind`; installed slots →
  that upgrade; ✓ → `shop`.
- **Program:**
  - hand cards → their type (SPAM `sp`, Haywire → that Haywire);
  - slots → `slots` (locked → `haywire-slot`);
  - map → hit-test; reboot arrows → `reboot-dir`;
  - chips: sideways/install → that Haywire; peek → `spam-filter`; usable upgrade → itself;
  - bookmarks → `memory-cards`; crab + → `crab-legs`;
  - undo → `clear`; ✓ → `lock`; power → `shutdown`;
  - top bar: my robot → `me`, flags → `goal`, ⚡ → `energy`, SPAM chip → `spam-count`, timer → `timer`.
- **Race:** future slots → `slots`; past and current slots → the replay (2.2.7); the card under a slot →
  `haywire-slot`; reboot state → `fall`; power state → `shutdown`; waiting robot → `decide`; arm bar →
  `arm`; eye → `look-up`.
- **Prompt sheet:** heading and each upgrade option → that upgrade.
- **Over:** the winner → `goal`.

#### 2.2.5 The Book

- **Layout:** full screen, over everything.
- **Header row (3rem):** a book glyph on the left and ✕ at top right, in the same spot as "?", so the same
  place opens and closes it.
- **Chip row under the header:** 2.5rem, scrolls sideways, sticky. One chip per section (icon plus
  label), and the chip for the section in view is lit.
- **Sections in order.** Contextual sections come first, and only when they apply:
  1. **Now** (always): the topics for the elements on the screen you came from. Programming, for example:
     slots, line, lock, timer if timed, each distinct card type in your hand, `haywire-slot` if one is
     locked, `reboot-dir` if rebooting, `your-upgrades` if any are installed, and `deck`. If a "?" chip is
     active, its topic comes first.
  2. **Last round:** during programming from round 2, and during the race. Five replay tiles (2.2.7), one
     per slot, each captioned with its slot number.
  3. **Film:** in the lobby and on watch screens. The lobby film's four scenes as 2D clips (`film-1` to
     `film-4`, 2.2.8).
  4. Then the mechanics sections: Goal, Program, Cards, Order, Board, Robots, Damage, Falling, Shutdown,
     Energy, Options, Upgrades (40: permanent first, then one-use, in cost order), Haywire (17).
- **Tiles:** a 2-column grid, 10 px gap, 16 px side gutters. Each tile is a 16:10 canvas plus a caption
  of at most 3 words (0.78rem): the topic's first clip caption, or the name for upgrades and Haywires.
  Tapping a tile opens the entry sheet over the Book. At 360 px a tile is 159×99 px.
- **Performance:** only canvases in view animate.
  - `mountDemo(..., { lazy: true })` registers each canvas with one shared IntersectionObserver
    (`rootMargin: 100px`).
  - Canvases out of view draw a single still frame (the midpoint) once, then stop.
  - At most 16 canvases animate at once; the closest to the viewport centre win.
- **Opens at:** the top. From a "?" chip or a topic link, it scrolls to that tile and pulses it.

#### 2.2.6 Phone first-time cues

Remembered per phone in `localStorage['rr.cued']` (a JSON array of cue ids, wrapped in try/catch). Each
cue fires once ever on that phone, when its trigger first holds. "Pulse" means a 2-cycle ring in `--me`
around the element.

| Cue id | Trigger (phone data) | Pulse | Chip picture | Opens |
|---|---|---|---|---|
| guide | first programming screen ever | "?" button (3 pulses) | – (no chip) | – |
| spam-hand | programming, `me.hand` has an `sp` card | that card | SPAM card | `sp` |
| again | programming, `me.hand` has `ag` | that card | Again card | `ag` |
| haywire-slot | programming, some `me.regs[i].locked` | that slot | violet card | `haywire-slot` |
| reboot-dir | programming, `me.rb` | the four arrows | reboot glyph | `reboot-dir` |
| timer | programming, ≤10 s left and an empty slot | the timer | timer | `timer` |
| shop | first upgrade phase | ⚡ number | bolt | `shop` |
| arm | race starts, `m.canArm` | arm bar | that upgrade's tile | `arm` |
| damage | race, the story gains a damage step | (the arrival animation, 2.2.7) | SPAM or violet card | `damage` |
| fallen | race, `!m.on` | (the fallen state, 2.2.7) | reboot glyph | `fall` |
| brief-end | the phase leaves `brief` | "?" button (3 pulses) | – | – |

- **`guide` and `brief-end`.** These advertise the button itself, and they fire regardless of `rr.cued`
  on a phone that has never opened the Guide (`rr.opened` unset).

**Always-on phone visuals** (not cues; they teach by doing, every time):

- **Timer dice.** In the last 10 s of a timed programming phase, each empty, unlocked slot flickers through
  random card faces at 40% opacity, every 120 ms.
- **Light line fixes.** Section 4 lists them (E3 and E4).
- **The race screen:** damage arrival, story marks and the fallen state (2.2.7).
- **Setup toggles.** When the leader changes an option, the option's clip plays in a 110 px strip above
  the toggle row for 4 s:
  - upgrades on: `upgrades`; off: the same clip with a cross drawn over the tile;
  - safe edges on: `safe-edges`; off: `edge`;
  - less SPAM on: `less-spam`;
  - a timer value: `timeout`, with that many minutes shown as a numeral.
- **Undo animation.** Undo animates all placed cards flying back into the hand (260 ms, staggered by
  40 ms).

#### 2.2.7 The race screen as "what happened to me"

**Layout** (360–430 px wide; replaces `renderRun`'s body):

```
┌ top bar ─────────────────────────────── ? ┐
│ [1][2][3][4][5]     your five slots       │  current slot lit, past ones faded (exists)
│  ·  ·· ·                                  │  marks: ≤3 tiny icons under each past slot
│                                           │
│               (eye: look up)              │  replaced by the fallen state when you're out
│                                           │
│ [deck n]                                  │  bottom left: your SPAM stack and count
│ [ arm bar / power state / waiting robot ] │  bottom (exists)
└───────────────────────────────────────────┘
```

- **Marks.** Icons are 16 px, from your story (5.4) for that register. At most three per slot, picked in
  this priority order:

  | Mark | Means |
  |---|---|
  | `cross` | you fell |
  | mini SPAM card / mini violet card | damage |
  | the pusher's robot svg at 14 px | you were pushed by a robot |
  | `flag` | flag reached |
  | `swap` | your card was replaced |
  | a 10 px beam line in the shooter's colour (board laser: red) | you were shot |
  | `m1` chevron (green or blue) | carried by a belt |
  | `rr` / `rl` | turned by a gear |
  | `wall` | pushed by a panel |
  | `bolt` | energy gained |
  | `dice` | this slot was filled at random (`me.auto`) |
  | `wall`, shown with a bump | you hit a wall |

  The marks appear when the register's last beat lands.
- **Damage arrival.** When a story step `d` lands for the current register:
  - SPAM: a coral card drops from the top of the screen into the deck stack, bottom left (280 ms), and the
    count ticks up.
  - Haywire: the card's **real face** (it's your own card; fixes E2) slides in under the current slot with
    a violet glow, and stays there for the rest of the round.
- **Fallen state.** While `!me.on`, the eye's area shows a 16:10 canvas of the real course around
  `me.rbAt`, drawn by `replay.js`. It loops: your robot's ghost drops onto the blue ring, two junk cards
  rise from it, and a "next round" sweep fills the ring. The slots after the fall crumble, with no
  marks. The `cross` mark sits under the slot where you fell.
- **Replay sheet** (tap any past or current slot, or a "Last round" tile):
  - **Header:** the slot number in a circle, plus the card(s) that ran (after replacement, with the
    replaced card shown greyed before it).
  - **Canvas:** full width, 16:10, the real course, cropped to the bounding box of every cell involved
    plus one cell of margin. Tile size fits that box (28–56 px); if it would be smaller than 28 px, the
    crop centres on your robot.
  - **What's drawn:**
    - your robot's start pose for that register;
    - faint and dashed: the light line you planned for that register. The phone keeps the ghost list it
      computed at lock time, `plannedGhosts[round]`, in memory;
    - each step in order, about 700 ms each:
      - a card's move, with a trail in your colour;
      - the pusher arriving and shoving you;
      - belts pulsing and carrying you;
      - a gear turning you;
      - a beam from the shooter (or the wall laser) with a burst;
      - junk cards rising;
      - a fall;
      - flag rings;
      - a bolt pop;
      - a card glitching into its replacement;
      - a bump against a wall.

    Other robots are drawn only if they acted on you. The replay loops with a 1 s pause.
  - **Under the canvas:** a "cause row": the same icons as the marks, larger (22 px), in order.
  - **Bottom:** ‹ and › step to the neighbouring registers; ✕ is centred.
  - **No words.** It answers ACT-02, BRD-01, DMG-08, LAS-05, MOV-17 and TIME-06.

#### 2.2.8 New and rewritten clips (`demo.js`)

**New `def` options:**

- `strip: [t, t, t, t, t]` draws a five-slot strip along the bottom 24% of the canvas. Each entry is a
  card type, `'hw'` (a face-down violet card) or `null` (an empty dashed slot).
- `hand: true` draws a small phone outline in the bottom-right corner, used as the destination of `fly`.
- `pushers: [[x, y, 'side', [regs]]]` adds push panels, drawn by the existing `drawCourse`.

**New steps** (the existing vocabulary is at `demo.js:15–20`):

| Step | Meaning |
|---|---|
| `['lit', i]` | slot i glows; earlier slots fade (like the phone's race slots) |
| `['slot', i, t]` | a card of type t flips into slot i |
| `['swapcard', i, t]` | slot i glitches (coral or violet flicker) into type t |
| `['lock', i]` | slot i's card turns face-down violet and locks (glow) |
| `['flipslot', i, t]` | the locked slot i flips face up to Haywire t |
| `['newround']` | every slot empties except locked ones (300 ms) |
| `['fly', t, from, to]` | a card of type t (`sp`, `hw`, a program type, `up` = upgrade tile) flies between `bot:<id>`, `slot:<i>`, `hand`, `deck` |
| `['dice', [i…], [t…]]` | the listed slots shimmer through faces for 900 ms, then settle on the given types |
| `['line', id, [t…]]` | a dotted light path with numbered dots for those cards from the robot's current pose, ignoring robots; it persists until `['unline']` |
| `['side', id, 'L'\|'R'\|'F']` | a short curved arrow of light on that side of the robot (its own left or right, or a pulse at its front point) |
| `['token', id]` | the priority badge "1" moves to that robot (slides if it already exists) |
| `['reg', n]` | a large faint numeral n in the top-left corner (the register) |
| `['flag', id]` | rings plus a "⚑ n ✓" pop, where n is the robot's next flag (counted) |
| `['win', id]` | three expanding rings in the robot's colour |
| `['panel', r]` | push panels active in register r shove the robot in front of them |
| `['belts', 'blue'\|'green'\|'only:<id>']` | the existing belts step, limited to fast or slow belts or to one robot; blue moves twice |
| `['spin', id]` | a 1.5-turn spin with a "?" pop, landing on the next facing in the step list |
| `['clock']` | a ring countdown in the top-right corner shrinks to nothing (1.2 s) |
| `['ring', id, color?]` | one expanding ring (EMP, shield-like moments) |

**`drawPop` additions** (fixes E5). These tokens get pictures instead of being dropped:

| Token | Drawn as |
|---|---|
| ✋ | `hand` glyph |
| 👁 | `eye` glyph |
| 🗂️ / 🔖 | `keep` glyph |
| ◆ | a small upgrade tile |
| 🛡️ | the shield ring |
| ⤒ | an up chevron over a card back (onto the deck) |
| ↘ | the `play` arrow rotated 45° |
| ? | text "?" |
| ⟳ | `ag` glyph |
| ⏏ | `abort` glyph |
| 🥇 | a "1" badge |

Also add `CARD_OF['⟳'] = 'ag'`.

**Storyboards.** "a" is you (your colour); bots are `[x, y, dir]`.

| Key | Board | Steps |
|---|---|---|
| goal-flags (replaces lobby-flags) | size [5,3]; flags [[1,2],[3,2],[3,0]]; a [0,2,E] | move a F1 · flag a · move a F2 · flag a · turn a −1 · move a F2 · win a |
| flag-stop | size [5,3]; flags [[2,1]]; a [0,1,E] | card a ↑↑↑ · move a F3 · pop a "⚑ ✖" · card a ⬇ · move a B1 · flag a |
| program-fill | size [5,3]; strip [null×5]; a [0,2,N] | slot 0 m1 · slot 1 rr · slot 2 m2 · slot 3 rl · slot 4 m1 · wait 300 · lit 0 · move a F1 · lit 1 · turn a 1 · lit 2 · move a F2 · lit 3 · turn a −1 · lit 4 · move a F1 |
| line-preview | size [5,4]; strip [m2,rr,m2,null,null]; a [0,3,N] | line a [m2,rr,m2] · wait 600 · lit 0 · move a F2 · lit 1 · turn a 1 · lit 2 · move a F2 · wait 400 · unline |
| line-bumped | size [4,3]; a [1,2,N]; b [0,2,E] | line a [m1] · wait 500 · [pop b "1", pop a "2"] · card b ↑ · move b F1 (shoves a east) · card a ↑ · move a F1 · wait 700 · unline (the ghost dot at (1,1) stays visible while a stands at (2,1)) |
| clear | size [5,3]; strip [m1,rr,m2,null,null]; hand true | [fly m1 slot:0 hand, fly rr slot:1 hand, fly m2 slot:2 hand] · newround |
| timeout | size [5,2]; strip [m1,rr,null,m2,null] | clock · dice [2,4] [rl,m1] · wait 500 |
| facing | size [3,3]; a [1,1,N] | side a F · turn a 1 · side a F · turn a 1 · side a F |
| turn-own-left | size [4,3]; a [1,2,N]; b [2,0,S] | [card a ↺, card b ↺] · [side a L, side b L] · [turn a −1, turn b −1] · [move a F1, move b F1] (a goes to screen-left, b to screen-right) |
| card-move | size [5,3]; a [0,1,E] | card a ↑ · move a F1 · card a ↑↑ · move a F2 |
| card-turn | size [3,3]; a [1,1,N] | card a ↻ · turn a 1 · card a ↺ · turn a −1 |
| card-bk | size [5,3]; a [2,1,E] | card a ⬇ · move a B1 |
| card-ut | size [3,3]; a [1,1,N] | card a ⟲ · turn a 2 |
| card-pu | size [3,3]; a [1,1,N] | card a ⚡ · pop a "⚡+1" |
| push | size [4,3]; a [0,1,E]; b [2,1,N] | card a ↑↑↑ · move a F3 (b is shoved off the edge and falls) · wait 300 |
| again | size [4,3]; strip [m1,rr,ag,null,null]; a [1,2,N] | lit 0 · move a F1 · lit 1 · turn a 1 · lit 2 · card a ⟳ · turn a 1 |
| again-first | size [4,3]; strip [ag,null,null,null,null]; a [1,2,N] | lit 0 · card a ⟳ · swapcard 0 m2 · card a ↑↑ · move a F2 |
| spam-play (replaces spam) | size [5,3]; strip [sp,null,null,null,null]; a [0,1,E] | lit 0 · card a ⚠️ · swapcard 0 m2 · card a ↑↑ · move a F2 |
| damage-spam | size [5,3]; hand true; b [0,1,E]; a [3,1,N] | shoot b · hit a · fly sp bot:a hand · wait 400 |
| damage-haywire | size [5,3]; strip [rr,rl,m1,rr,m1]; a [1,1,E]; b [4,1,W] | lit 0 · turn a 1 · lit 1 · turn a −1 · lit 2 · move a F1 · shoot b · hit a · fly hw bot:a slot:2 (it tucks under slot 3's card) · wait 500 · newround (slot 3 now holds the violet card, locked; the rest empty) · lit 2 · flipslot 2 h01 · move a F1 · turn a 1 · move a F1 |
| damage-cards | size [5,3]; hand true; b [0,1,E]; a [2,1,N] | shoot b · fly sp bot:a hand · move a F1 (a keeps going: no health) · wait 300 · turn a 1 · shoot b (misses; a is out of line) · wait 400 |
| order-registers | grid ['.. .. .. .. .. ..', 'g> g> g> .. .. ..', '.. .. .. .. .. ..']; a [0,2,N]; b [3,2,N]; c [5,2,N] | reg 1 · pop a "1" · move a F1 · pop b "2" · move b F1 · pop c "3" · move c F1 · belts (a is carried east) · reg 2 · move a F1 · move b F1 · move c F1 |
| order-priority | size [5,3]; a [0,2,N]; b [2,2,N]; c [4,2,N] | token a · move a F1 · move b F1 · move c F1 · token b · move b F1 · move c F1 · move a F1 |
| belt-green | grid ['.. .. .. .. ..', 'g> g> g> g> ..', '.. .. .. .. ..']; a [0,1,N] | reg 1 · belts green · reg 2 · belts green · reg 3 · belts green |
| belt-blue | grid ['.. .. .. .. ..', 'b> b> b> b> ..', '.. .. .. .. ..']; a [0,1,N] | reg 1 · belts blue · reg 2 · belts blue |
| belt-curve | grid ['.. .. .. ..', '.. g> gv ..', '.. .. gv ..', '.. .. .. ..']; a [1,1,N]; b [3,1,W] | belts (a turns at the curve) · belts · belts · card b ↑ · move b F1 (onto the curve: no turn) · wait 300 · belts (b carried south, still facing W) |
| gear | grid ['.. .. .. .. ..', '.. G+ .. G- ..', '.. .. .. .. ..']; a [1,1,N]; b [3,1,N] | gears · gears |
| pusher | size [5,3]; pushers [[2,0,'N',[2,4]]]; a [2,0,E] | reg 1 · panel 1 (nothing) · reg 2 · panel 2 (a shoved to (2,1)) |
| edge | size [4,3]; reboot [3,2,N]; a [1,1,W] | card a ↑↑ · move a F2 (off the edge: fall) · wait 500 · [tp a 3 2, pop a "⚠️⚠️"] |
| wall | size [5,3]; walls ['2,1:E']; lasers [[4,1,W,1]]; a [0,1,E] | card a ↑↑↑ · move a F3 (stops at the wall, bump) · zap 4 1 W (the beam stops at the wall; a is safe) |
| board-laser | size [5,3]; lasers [[4,1,W,1]]; a [2,1,N]; b [0,1,N] | zap 4 1 W (hits a, b is safe behind) · wait 400 |
| robot-laser | size [5,3]; a [0,1,E]; b [2,1,N]; c [4,1,N] | shoot a (hits b only) · wait 400 |
| battery | grid ['.. .. ..', '.. EE ..', '.. .. ..']; a [0,1,E] | reg 1 · move a F1 · pop a "⚡+1" · reg 2 · pop a "⚡+1" |
| reboot-face | size [3,3]; reboot [1,1,N]; a [1,1,N] | off a · face a E · wait 400 · face a S · wait 400 · on a · move a F1 |
| film-1 … film-4 | the lobby scenes as 2D clips | built by `lessonFrames(runLesson(def))`, a ~60-line adapter in `demo.js`: each lesson beat becomes a frame (robot poses from `st.robots`; `beam`, `dmg` → burst plus a SPAM/violet pop, `fall`, `reboot` → appear, `cp` → flag, `win` → win, reveal → card pops). `demo.js` imports `LESSONS` and `runLesson` from `lessons.js` (read-only use; it shows whatever scenes chunk B has landed). |

**Rewrites of existing demos** (fixes E1 and E5):

| Key | New steps |
|---|---|
| spiky | a [3,1,W] (has Spiky); b [1,1,E]: card b ↑ · move b F1 (stops next to a: nothing) · wait 500 · card b ↑ · move b F1 (pushes a) · hit b |
| brakes | a [1,1,E]: card a ↑ · pop a "✖" · wait 500 (robot stays) |
| re-initialize | a [1,1,N]; b [3,1,N]: token a · wait 500 · token b |
| h05 (Install) | strip none; pop a "+◆" |
| memory-cards | pop a "🂠🂠 → 🔖" · pop a "🔖 → ✋" |
| spam-filter | pop a "👁 🂠" |
| memory-swap | pop a "+🂠🂠🂠" · pop a "🂠🂠🂠 ⤒" |
| rewire | strip [null, null, hw, null, null]; hand true: fly hw slot:2 hand · newround · slot 0 h01 |
| upgrades | grid with EE at (1,1); a [0,1,E]: move a F1 · pop a "⚡+1" · pop a "⚡ → ◆" |
| h11 (Spin Out) | spin a · move a F2 (from the HAYWIRE compile: `spin` → `['spin','a']`) |
| h14 (EMP) | ring a · [hit b, hit c] |
| modular-chassis | move a F1 · [fly up bot:a bot:b, fly up bot:b bot:a] |
| abort-switch | card a ⬆⬆⬆ · pop a "⏏" · card a ↻ · turn a 1 |
| all-aboard | grid ['b> b> b> g> ..', 'b> b> b> g> ..', '.. .. .. .. ..']; a [0,1,N]; b [0,0,N]: pop a "◆" · belts only:a · belts only:a (b, on the same kind of belt, doesn't move) |
| overclocked | pop a "◆" · card a ↑↑ · move a F2 |
| lucky-booster | card a ⬆ · pop a "🂠🂠" · card a ⬆↻⬆ · move a F1 · turn a 1 · move a F1 |
| less-spam | pop a "✋⚠️⚠️" · pop a "⚠️ ↘ 🗑️" |

### 2.3 Big-screen first-time callouts (race)

- **Gate:** callouts are on when `view.teach` is true, meaning at least one racer's phone hasn't finished
  a race (5.4).
- **Frequency:** each callout fires **once per big-screen page session**. `teach.js` holds a module-level
  `Set` that survives races and resets on reload.
- **Queue:** one line plays at a time, with at most one queued; a newer trigger replaces the queued one.
- **Holding the race:** for lines with a hold, the host sends `hold { ms }` as the line starts. The rules
  then extend the current beat (never past 4 s).
- **Names:** `{name}` is the player's name, spoken as typed, with emoji stripped. An empty name becomes
  "Unit {seat+1}".

| id | Trigger (host view / beat) | Line | Hold | Visual |
|---|---|---|---|---|
| order | the first `reveal` beat of round 1, register 1 | "Slot one. Robots move one at a time. Number one first." | 2500 | order numerals (always on, 2.4.3) |
| board | the first beat with `what.k` in belt/push/gear where a robot moved or turned | "The floor moves after every slot." | 1800 | the element's pulse (exists) |
| shot | the first `beam` fx with `hit` | robot laser: "Lasers fire on their own. Straight ahead." Board laser: "Wall lasers fire after every slot." | 1800 | the beam lingers 0.6 s longer |
| damage | the first `dmg` fx whose `src` isn't `reboot` | "No health here. Damage is junk cards. {name}'s phone just got one." ("two" if 2) | 3000 | the junk-card flight (always on, 2.4.3), drawn at 1.5× the first time |
| shove | the first `contact` event (`chaos.readBeat`) | "Shove. Robots push robots." | 1500 | – |
| fall | the first `fall` fx | "{name} is down. Back next round, on the blue ring." | 2500 | a ring pulses on that board's reboot ring in the robot's colour |
| flag | the first `cp` fx that isn't a win | "{name}: flag one. Next target: flag two." | 1500 | the next flag column pulses |
| nearmiss | at the end of a register, a robot's `move` path that register crossed its next flag's square and no `cp` for it fired | "Close. Stop on the flag, or it doesn't count." | 1500 | the column flickers and a ✕ pops above it |
| spam | the first `replace` fx with `from: 'sp'` | "Junk card. Swapped for a random card." | 1500 | glitch (exists) |
| again | the first `replace` fx with `from: 'ag'` | "Again in slot one has nothing to repeat. Random card." | 1500 | glitch (exists) |
| haywire | the first card beat whose card is a Haywire | "Haywire. Jammed in by last round's damage." | 1500 | – |
| shutdown | the first `reveal` of a round with a robot whose `sd` is true | "{name} powered down. Sitting out a round to dump its damage." | 1500 | shut-down look (always on) |
| clock | the first timed programming phase with ≤10 s left and someone not ready | "Ten seconds. Empty slots fill at random." | – | – |
| shop | the first `upgrade` phase | "Shop open. Energy buys upgrades. Optional." | – | – |
| decide | the first `prompt` | "{name} is choosing. Stand by." | – | the pulse (exists) |
| win | every win, regardless of the gate | "Race complete. Winner: {name}." | – | – |

### 2.4 Big-screen changes that need no voice

#### 2.4.1 The lesson engine (`lessons.js`)

- `runLesson(def, seed)` reads a new `def.damage`: card types moved to the top of the damage deck in
  order. It's a property of the scene, so callers like `demo.js` need no new arguments. This is verified
  in scratch: it stacks `['sp','h01']` exactly.
- Rounds may contain `null` for a slot. Locked registers are then **kept**. The current code resets every
  register; instead, keep `r.locked` ones, so a Haywire stays and runs.
- `stopAt: { reg: n }` stops at the reveal of register n. `stopAfter` is kept.
- `playRun(arena, run, { pause, cast, mimic, onBeat })` is extracted from `lobby.js`'s `playLesson`, so
  the film and the Briefing share it.
- The Briefing's scenes live here in a separate export `BRIEF`, next to `LESSONS`. They're listed in 3.2.

#### 2.4.2 `scene.js` helpers (small public methods)

| Method | What it does |
|---|---|
| `screenPos(id)` / `cellScreenPos(x, y)` | `{ x, y }` in CSS px within the container |
| `ghostPath(points, color)` / `clearGhost()` | a dotted line of light on the glass with numbered dots |
| `orderMarks(ids)` | numerals 1..n on the floor under those robots, 1.4 s |
| `flashFlag(n, color)` | the column flash `checkpoint()` uses, without a robot |
| `spotlight(x, y, { hold })` | a gentle camera pull towards a cell (built on `punch`) plus a ring |
| `setShutdown(ids)` | those robots' emissive at 35%, with a small power glyph floating above |
| `namesAlways` | a flag: when true, name tags show above floating cards instead of hiding (M8) |

#### 2.4.3 `host.js`: always on, for everyone

- **Order numerals.** At every `reveal` beat, call
  `arena.orderMarks(priorityOrderFromView)` (rotate `view.robots` by the index of `view.prio`, skipping
  robots that are off or shut down).
- **Priority badge.** Replace the 5-px `.prio` dot with a "1" badge: a circle of light 1.3rem, ink
  numeral, above the holder's token. When Priority changes at round start, it slides to the next
  token (400 ms). (M4)
- **Junk-card flight.** On scene event `damage`, for each card, a 2.2rem `lm-card` (coral, or violet face
  down) starts at `screenPos(id)`. It flies along a curve to that player's roster token (700 ms,
  `cubic-bezier(.3,.7,.2,1)`), then the token flinches (exists). Shown every time.
- **Names in round 1.** `arena.namesAlways = view.round === 1`. (M8)
- **Shut-down robots.** `arena.setShutdown(robots with sd)` during activation. (M9)
- **Flags on the roster.** Small `flag` glyphs replace the dashes (M5): taken ones lit in the player's
  colour, the next one outlined.

### 2.5 The Briefing (big screen and phones)

#### 2.5.1 When it runs

- **When:** after every start pad is picked (or the start timer ends), before round 1's programming.
- **Condition:** only if a racer's phone hasn't finished a race (`s.fresh` non-empty, 5.4). Otherwise
  the race starts as today.
- **Length:** about 70 s with four players and every option on (3.4).
- **Safety cap:** a 150 s deadline in the rules ends it whatever happens.

#### 2.5.2 Ending it early

- **Majority vote.** Ends as soon as votes > half of the connected racers. Nobody skips for anyone else
  alone, except in a one- or two-player game: 1 of 1 skips, and 2 of 2 are needed.
- **The big screen's keyboard:** Esc, Space or Enter (whoever is at the laptop).
- **A small ⏭ button** in the big screen's top-right corner, next to the sound button, shown only during
  the Briefing.
- **→** on the big screen jumps to the next shot (local only).

#### 2.5.3 Big screen during the Briefing

- **Board:** the real course, with players' robots on their pads. Lesson boards fade in and out for the
  mechanics shots (`.lm-3d` opacity transition, 500 ms). Lesson robots wear the players' colours in seat
  order, like the film.
- **Roster:** visible at the bottom (unchanged) and used by shots 2 and 8.
- **The mimic phone:** the film's phone, extracted to `mimic.js`, at the left during shots 5, 6, 9, 10,
  13 and 15 (same CSS as the lobby: `left: 4.2vw`, vertically centred,
  `width: clamp(10.5rem, 14.5vw, 19rem)`). The arena frame shifts right
  (`setFrame({ left: 0.3, right: 0.04, top: 0.13, bottom: 0.4 })`) while it shows.
- **Voice line and subtitles:** section 3.5.
- **Skip tally:** top right, left of the corner buttons: the `skip` glyph, then a mini robot (1.4rem)
  for each voter, then an empty circle for each vote still needed. Hidden when nobody has voted.

#### 2.5.4 Phones during the Briefing (phase `brief`)

- **Top bar:** as always, so "?" works and the Book is available.
- **Body:** a large dim eye in the centre (look up).
- **Bottom:** the skip pill, the primary action (the existing `.pl-cta` pill style):
  - It shows the `skip` glyph and tally dots: filled for votes, empty for the votes still needed.
  - Tap: votes, and the pill fills in `--me`. Tap again: takes the vote back.
- **No words.**
- **Afterwards:** when the phase leaves `brief`, the `brief-end` cue pulses "?" three times.

---

## 3. The voice: Floor Control

### 3.1 Persona and style

*Floor Control* is the abandoned store's after-hours computer, running a robot race on the shop floor.

- **Delivery:** terse, declarative, systems-announcement cadence. Present tense, no contractions in
  commands, dry humour only in the boot and sign-off lines.
- **Line length:** at most 17 words.
- **Lines with live values:** numbers and names are spoken as separate utterances, so the screen can
  sync to them.

### 3.2 The Briefing script

Shots marked "lesson" run a scene from `lessons.js` (`BRIEF.*`, defined in the rightmost column, all
verified through the engine in scratch). Each shot lasts as long as the longer of its line and its
animation, plus a 0.5 s gap.

| # | Condition | Line (spoken) | On screen while it's spoken | Words | ≈ s |
|---|---|---|---|---|---|
| 1 | always | "Floor Control online. Store closed. Robot race: engaged." | The room fades up from black (`setDim` 1 → 0 over 2 s). The board's lines trace on and the camera orbits slowly. The voice line draws itself. | 8 | 4 |
| 2 | always | "Robots on the dock." then each name as its own utterance, in seat order, then "Find yours." | As each name starts (`onstart`), that robot lifts 0.15, its name tag shows and its roster token lights. Then all names stay visible. | 5 + n | 3 + 0.7n |
| 3 | always | "Objective: the flags, in order." then "One." "Two." … (one utterance per flag; 2–4), then "First to the last flag wins." | On each number, the camera spotlights that flag column and `flashFlag(n)` fires. A dotted path of light grows from the dock to 1 to 2 to 3. On "wins", the last column flares white. | 13 | 6.5 |
| 4 | always | "Stop on a flag, or it doesn't count." | Lesson `BRIEF.stop`: grid 5×3, flag (2,1), robot (0,1) facing E. Move 3 crosses the flag (the column flickers, ✕). Move Back lands on it (rings). | 8 | 4 |
| 5 | always | "Each round, your phone deals cards. Fill five slots. Slot one runs first." | Lesson `LESSONS.lesson-program` (the new facing-camera version) with the mimic: the fingertip taps five cards in (fast pace); on "Slot one", the mimic's slot 1 lights. | 13 | 5.5 |
| 6 | always | "Left and right are the robot's own. Trust the line on your phone." | Same lesson continues: the robot, facing the viewer, turns to screen-right on its Rotate Left. `ghostPath` shows the rest of the route, and the robot follows it to the flag. | 13 | 5.5 |
| 7 | always | "Everyone plays slot one, the robot marked one first. Then the floor moves. Then slot two." | Lesson `BRIEF.order` (below), with the register strip "1": cards turn over and order numerals 1 2 3 appear; robots act in turn; the belt carries one robot and the gear turns another; the strip lights "2"; cut. | 16 | 7 |
| 8 | always | "The mark passes each round." | Back to the real course. The roster's "1" badge pulses over the Priority holder, slides to the next token, and slides back. | 5 | 2.5 |
| 9 | always | "Lasers fire on their own, straight ahead. No health. Damage is junk cards, sent to your phone." | Lesson `LESSONS.lesson-damage` (round 1, registers 1–2) with the mimic: L1's beam hits L0's back; a coral card rises from L0 and flies into the mimic's deck stack. | 17 | 7.5 |
| 10 | always | "Junk clogs your hand. Haywire jams the slot you were hit in." | The same lesson's register 3: a violet card flies into the mimic's slot 3 and locks. Cut before round 2. | 12 | 5 |
| 11 | always | "Robots shove. Into pits. Off the edge." | Lesson `BRIEF.push`: L0's Move 2 shoves L1 into the pit. | 7 | 3.5 |
| 12 | always | "Fallen robots sit out the round. Reboot next round, on the blue ring." | The same lesson's round 2: L1 drops onto the blue ring (pillar of light). Two junk cards rise from it. | 13 | 5.5 |
| 13 | `opts.timer > 0` | "At zero, empty slots fill at random." | The mimic: three slots filled, two empty. A timer line across the top shrinks to nothing; the empty slots flicker through faces and settle. | 7 | 3.5 |
| 14 | `opts.upgrades` | "Batteries charge energy. From round two, energy buys upgrades." | The real course: each battery square rings amber in turn and a bolt pops over the dock's batteries. A shop glyph floats over each roster token, then fades. | 9 | 4.5 |
| 15 | always | "Questions? Tap the question mark on your phone. Floor Control out." | The mimic's top-right "?" glows and a fingertip taps it; a card in the mimic gets the Point outline. Fade to the real course; the robots' lights brighten; the voice line collapses to a dot and goes out. | 11 | 5 |

**Total:** 157 words plus names, about 69 s spoken with four players. With gaps and animation tails it
runs about 72–76 s with every option on, and about 65 s without timer and upgrades.

**`BRIEF` scenes** (engine-verified):

- **`BRIEF.stop`:** grid 5×3, flag (2,1), robot (0,1) facing E. Cards `m3, bk, rl, rl, rl`. The register 1
  Move 3 ends at (3,1) with no flag; the register 2 Move Back ends on the flag, a checkpoint and a win.
  Stop after the win (`calmWin`).
- **`BRIEF.order`:** grid `['.. .. .. .. .. ..', '.. .. .. .. .. ..', 'g> g> g> .. G+ ..', '.. .. .. .. .. ..']`.
  - Robots: L0 (0,3) N, L1 (3,3) N, L2 (4,3) N.
  - Cards: L0 `m1×5`; L1 `m2, rl, m1, m1, m1`; L2 `m1, rl, m1, m1, m1`.
  - Register 1: L0 moves onto the belt, L1 moves two, L2 moves onto the gear. Then the belt carries L0
    and the gear turns L2.
  - Stop at the reveal of register 2 (`stopAt: { reg: 2 }`).
- **`BRIEF.push`:** grid `['.. .. .. .. ..', '.. .. .. XX ..', '.. .. .. .. ..']`, reboot (4,2) W.
  - Robots: L0 (0,1) E, L1 (2,1) N.
  - Round 1: L0 `m2, rl, rl, rl, rl`; L1 `rl, rr, rl, rr, rl`. Register 1: L0 shoves L1 into the pit,
    and L1 takes 2 reboot damage.
  - Round 2: both `m1×5`.
  - Stop after the reboot.
- **`LESSONS.lesson-damage`:** as in 2.1, scene 3.

### 3.3 Callout lines

The callout lines are in 2.3. Same voice, same chirp, same voice line on screen. At most 11 words each.

### 3.4 Skipping

This repeats 2.5.2 for the voice's sake:

- **Phone votes:** the Briefing ends at a majority of connected racers.
- **The big screen:** Esc, Space or Enter, or its ⏭ button. → jumps to the next shot.
- **Ending:** a skip cancels the current utterance (`speechSynthesis.cancel()`) and fades the voice line
  out.
- **Callouts** can't be skipped individually, because they're short. Muting the big screen's sound
  silences the voice, and subtitles then show instead.

### 3.5 Voice line and subtitles (big screen, `teach.css`)

- **The voice line** is the narrator's only visual: a 2 px line of light, top centre, `top: 5.4rem`
  (below the register strip and the timer number), `width: clamp(18rem, 22vw, 26rem)`.
  - **While speaking:** its centre ripples. Amplitude is 6–10 px, bumped on each `onboundary` word event,
    or on a 330 ms timer when boundaries don't fire.
  - **During the Briefing:** the lit part of the line is the progress (shots done ÷ shots).
  - **During callouts:** the line is fully lit and fades out 600 ms after the line ends.
- **Subtitles.** Policy: shown **only when the voice isn't audible**. That means:
  - no speech synthesis;
  - no voice chosen;
  - the big screen's sound is locked or muted;
  - or an utterance fails (`onerror`);
  - or captions are switched on with **C** on the big screen (kept in `localStorage['rr.captions']`).

  Otherwise there are no words on the big screen.

  When shown:
  - **Position and type:** under the voice line, `top: 6.6rem`, `max-width: 60vw`, at most 2 lines,
    centred. Lumen weight 300, `font-size: clamp(1.3rem, 1.9vw, 2.3rem)`, colour `--light` with an ink
    text-shadow.
  - **Timing:** the same text as the spoken line. When the voice speaks, they follow the utterance. When
    it doesn't, they stay up for 400 ms plus 330 ms per word (and shots wait for that).
- **Phones never show subtitles.**

### 3.6 How it's voiced (`voice.js`)

- **Engine:** the browser's `speechSynthesis`. It works offline with local voices.
- **Unlocking:** on the host page's first `pointerdown` or `keydown`, speak an empty utterance at volume
  0. Chrome requires a user gesture before speech; the lobby's breathing sound button already asks for
  one.
- **Choosing a voice:** read `getVoices()` again on `voiceschanged`. Take the first English (`/^en[-_]/`)
  match from this ranked list:
  1. `Google UK English Male`
  2. `Microsoft (Ryan|Thomas|Guy|Christopher|Eric|Andrew).*Online` (skipped when `navigator.onLine` is false)
  3. `^Daniel` (Apple, en-GB)
  4. `Microsoft (George|David|Mark|James)` (Windows local)
  5. `^(Alex|Aaron|Arthur)$`
  6. any English voice with `localService`
  7. any English voice
  8. none: the subtitles fallback (3.5)

  These picks are intelligible first; the robot feel comes from pitch, rate and the chirp, not from a
  novelty voice like "Fred" or "Zarvox", which kids can't follow.
- **Settings:** `rate 0.92`, `pitch 0.6` (some voices ignore pitch; that's fine), `volume 1`.
  `utterance.lang = voice.lang`.
- **Chirp:** before each line, two square-wave blips (1400 Hz, then 2100 Hz, 35 ms each, 25 ms apart,
  gain 0.05), on `voice.js`'s own AudioContext, made at unlock. Only when audible.
- **Ducking:** while speaking, `sound.js` `setLevel(0.5)`; restore to 1 afterwards.
- **Robustness:**
  - `speechSynthesis.cancel()` before each new line.
  - A safety timeout of 3 s plus 600 ms per word resolves the line if `onend` never fires (a known Chrome
    bug).
  - Never queue more than one utterance.
- **API:** `voice.say(text, { id, onStart, onWord }) → Promise<{ spoken }>`, `voice.cancel()`,
  `voice.audible` (getter), `voice.onCaption(fn)`.
  - The `id` lets a recorded clip `audio/brief-<id>.mp3` be used later instead of speech, if present.
    That's not part of this build.

---

## 4. Fixes to existing teaching, and data the screens need

### 4.1 Wrong or misleading today (from `questions.md` section 3)

| Ref | Problem | Fix | Chunk |
|---|---|---|---|
| E1 | The Spiky demo (`demo.js:47`) damages a robot that only drives *next to* the Spiky robot | Rewrite (2.2.8): stopping adjacent does nothing; driving into it pushes, and the pusher takes the hit. | A |
| E2 | An incoming Haywire always shows as h01 (`player.js:603`) | Show the real card `r.next`; it's the player's own, and `privateRobot` already sends it. It slides in when it lands (2.2.7). | A |
| E3 | The light line treats Spin Out, Double Program and Swap as "stay put" (`player.js:131`) | `previewType` returns `['?']` for Haywires with `spin`, `double` or `swap` ops; the line stops with "?" like SPAM. Non-moving Haywires (Storm, Surge, EMP, Overcharge, Install) stay `noop`. | A |
| E4 | With Hover Unit, the light line shows a fall into pits the robot will cross (`minimap.js:426`) | `previewProgram(…, { hover })`: during a card's own movement, a pit square is a fall only if the move *ends* there; belts and pushes onto a pit still fall. `player.js` passes `hover: m.up.perm.includes('hover-unit')`. | A |
| E5 | Blank or misleading demos (Re-Initialize, Install Haywire, Brakes, Memory Cards, SPAM Filter, Memory Swap, Rewire, the upgrades rule, Spin Out, Modular Chassis, EMP, the flags trophy, Abort, All Aboard, Overclocked, Lucky Booster) | The `drawPop` tokens and rewrites in 2.2.8. | A |
| E6 | Power Surge's face shows one bolt (`glyphs.js:129`) | `haywireParts`: `en` → `['pu', '+3']` (with `+n` drawn as a mark); its `dmg` part stays "!". | A |
| M1 | Weapon and window prompts show only names | Each option shows its upgrade's tiny demo (`demo(key,'tiny')`) beside the name: Pressor, Tractor, Scrambler, Mini Howitzer, Displacing Blast, Overclocked, Pressure Release, All Aboard, Lucky Booster. No hint text. | A |
| M2 | Undo clears all five slots | Behaviour kept; the cards visibly fly back (2.2.6); `clear` topic. | A |
| M3 | Setup toggles are unlabelled | The toggle self-explains on change (2.2.6); the phone's timer row gets the `timer` glyph like the TV; topics. | A |
| M4 | Priority is a 5-px dot | The roster "1" badge and floor order numerals (2.4.3). | B |
| M5 | Flags drawn as dashes | Flag glyphs on the phone's top bar (A) and the TV roster (B). | A + B |
| M6 | The SPAM number reads as "in my hand" | The chip shows a small stack of two offset coral cards plus the total; tapping it opens `spam-count`. | A |
| M7 | The eye means four things | The map zoom uses a new `zoom` glyph (magnifier). The eye means only "look at the big screen". The SPAM Filter peek keeps eye plus card, which is a peek. | A |
| M8 | Names hidden under floating cards | `arena.namesAlways` during round 1. | B |
| M9 | Shut-down robots look normal | `setShutdown` (2.4.2). | B |
| M10 | Permanent upgrades invisible in programming and the race | The Book's "Now" section includes `your-upgrades`. | A |
| M11 | The start screen hides the course | Above the dock view, add a non-interactive overview of the whole course: the existing `thumb()` at 100% width and max 22vh, with flag numbers, the dock outlined and your pad lit. The dock view shrinks to fit; pads stay ≥ 40 px. | A |
| M12 | Lesson 2 programs five Rotate Lefts while rebooting | 2.1, scene 2. | B |
| M13 | The power button beside ✓ is easy to hit | In its sheet, the power option needs press-and-hold for 800 ms (a ring fills); a plain tap wiggles it. | A |
| M14 | Sleeping phones get random programs | `me.auto` plus the `dice` mark (2.2.7). | A (+C data) |
| M15 | Deck and discard counts never shown | The `deck` topic in "Now". | A |
| M16 | The phone never learns what happened to it (`rules.js:283`) | `me.story` (5.4). | C |
| D1–D7 + round-1 shop | Quiet deviations from the rulebook | A README section "Differences from the rulebook" (C). The relevant topics' fine print says so where it matters: Deflector "pays automatically"; shutdown "instead of programming"; the timer is on by default. | C (+A copy) |

### 4.2 Data contract (rules ↔ screens)

Everything below is built by chunk C. A and B code against it.

**Phone → rules (player actions):**

- `hello { raced: bool }`: sent by `player.js` once at mount. `raced` comes from
  `localStorage['rr.raced'] === '1'`. Phones set that key when they see `phase: 'over'`.
- `skip { on: bool }`: a Briefing vote (only in phase `brief`).

**Big screen → rules (host actions):**

- `briefDone`: the Briefing finished.
- `briefSkip`: the big screen's key or button.
- `hold { ms }`: extend the current activation beat to at least `ms` from now. Clamped to 4000. Ignored
  outside `activate` or while a prompt is open.

**Rules state and behaviour:**

- `s.fresh`: a Set of racer ids that haven't reported `raced: true`. A phone that never says hello counts
  as fresh.
- `s.teach = s.fresh.size > 0`, frozen when the start phase ends.
- **Start → round 1:**
  - when the start phase completes, `E.startRace`;
  - if the phase is then `upgrade` and the round is 1, call `E.startProgramming` (**the round-1 shop
    skip**);
  - if `s.teach`, then `s.brief = { next: s.phase, votes: [] }` and `s.phase = 'brief'`, with a 150 s
    deadline;
  - ending the Briefing (by `briefDone`, `briefSkip`, majority, or the deadline) sets
    `s.phase = s.brief.next` and `s.brief = null`, then `drive`.
- **Story:** in `pump`, after each `E.step` beat, `recordStory(s, beat)` (format below). `s.story` resets
  when activation begins and is kept through the next programming phase.
- **Auto-filled slots:** before `E.beginActivation`, for each robot that isn't done, record
  `s.auto[id]` = the indices of its unlocked slots with an empty draft. Kept until the next activation.
- **Hold bookkeeping:** `pump` records `s.beatDue = Date.now() + beat.dur`.

**`hostView` adds:**

- `teach: bool`
- `brief: { votes: [ids], need: n } | null`
- `robots[].auto: [i]`

**`playerView` adds:**

- `brief: { votes: n, need: n, mine: bool } | null`
- `me.story: { round, regs: [[step…] ×5] }`, this player's only
- `me.auto: [i]`

**Story step format** (compact arrays; paths are flat `[x, y, x, y…]`; ids are player ids; a `0` id means
a board element):

| Step | Meaning |
|---|---|
| `['s', x, y, d]` | pose at this register's reveal (first entry) |
| `['c', [types], path, turn]` | my card played (`turn` = net quarter turns) |
| `['x', from, to]` | my card was replaced (SPAM, Again in slot 1, Abort, Scrambler) |
| `['p', by, path, byPath]` | I was shoved by robot `by` (my path, its path) |
| `['b', fast, path, turn]` | a belt carried me |
| `['g', spin]` | a gear turned me |
| `['k', path]` | a push panel shoved me |
| `['l', src, x0, y0, d, n]` | I was hit by a laser (`src` = 0 for a board laser) |
| `['d', sp, hw, src]` | I took damage (`src`: laser, reboot, push…) |
| `['w']` | I bumped a wall or a blocked push (from `bonk`, or a 1-point path) |
| `['f', edge]` | I fell |
| `['r', x, y]` | I rebooted here |
| `['cp', n]` | flag reached |
| `['e', n]` | energy gained |
| `['h']` | my shield blocked a hit |

The story is capped at 40 steps per register and 2.5 KB serialized per player; longer paths keep only
their endpoints. A full eight-player `playerView` must stay **under 16 KB**: C's test checks the
busiest case.

---

## 5. Build plan

There are three chunks with **strictly separate files**. C is small and should land first, about a day.
A and B can start at the same time against the contract in 4.2, using fixture views. Nobody touches
`games/robo-rally/animation-lab-independent/`.

### Chunk A: the phone

**Owns:** `games/robo-rally/player.js`, `demo.js`, `minimap.js`, `glyphs.js`, `style.css`, and the new
files `guide.js`, `topics.js`, `replay.js`, `guide.css`, `test/guide.mjs`.

**Shell edits (tiny):**

- `public/index.html`: one `<button id="ask-btn" class="ask-btn" aria-label="Help" hidden>` in the
  `#wait` section.
- `public/js/play.js`: show it on the wait screen. On click,
  `import('../games/robo-rally/guide.js').then((m) => m.openBook({ context: 'lobby', color: you.color }))`.
- `public/css/phone.css`: three lines positioning `.ask-btn` at top right. It's styled inside
  `guide.css`.

**Builds:**

- **The Guide (2.2.1–2.2.5):**
  - `guide.js` exports `mountGuide(root, { getView, api })` for in-game use and `openBook({ context })`
    for the shell.
  - It loads its own stylesheet, via `new URL('./guide.css', import.meta.url)`, on first use.
- **The rest:**
  - the topic catalog and map hit-test (`topics.js`);
  - `data-ask` on every element listed in 2.2.4;
  - the phone cues (2.2.6);
  - the race screen's marks, damage arrival, fallen state and replay sheet (`replay.js`, 2.2.7);
  - the phone side of `brief` (2.5.4);
  - every new and rewritten clip, the `drawPop` additions and the lazy animation (2.2.8);
  - the new glyphs: `ask`, `book`, `skip`, `zoom`, `dice`, `deck`, plus a face-down `hw` card;
  - fixes E1–E6, M1–M3, M5 (phone), M6, M7, M10, M11, M13–M15.

**Acceptance criteria:**

1. `dev-phone.html` at 360×740 and 430×930, for every phase: "?" is visible and Point mode outlines every
   `data-ask` element. Tapping each opens an entry whose clips play. ✕, a second "?" tap and the back
   gesture close it. No horizontal scroll.
2. The leader's top bar at 360 px during timed programming, with ⚡, SPAM and the timer, fits without
   overlap. The "?" chip hangs below the bar and never reflows it.
3. Tapping map squares on every course opens the right topic for belts (blue and green), curves, gears,
   pits, edges, walls, push panels, laser lines, batteries, flags, the reboot ring, robots and the light
   line. Multi-topic squares show "also here" chips.
4. The Book opens from the lobby wait screen (shell) and in game, with "Now", "Last round" (round 2+) and
   "Film". All 13 mechanics sections and 57 generated tiles render. No more than 16 canvases animate at
   once (checked with a debug counter), and scrolling stays above 50 fps on a mid-range phone.
5. Each cue fires once per phone and never again after a reload (`rr.cued`). The chip opens the right
   entry.
6. With a story fixture, the race screen shows marks and damage arrival (the real Haywire face). Past
   slots open replays that draw the planned line, the pusher, belts, beams, falls, and a card swap. The
   fallen state shows the comeback on the real course.
7. E1–E6 are visibly fixed. Spiky: the adjacent stop does nothing and the push hurts. Every blank demo
   in E5 now shows its effect. The Spin Out / Double Program / Swap line ends in "?". Hover Unit crosses
   pits on the line. Power Surge shows ⚡+3.
8. `node test/guide.mjs` passes. Every topic's clips exist (`hasDemo`); every `data-ask` value in
   `player.js` resolves to a topic; every demo compiles; Spiky's compiled frames show no `burst` on b
   before b's second move.
9. Shutdown needs an 800 ms hold. Toggle clips play on change. The start screen shows the course
   overview.
10. Words added: section labels, ≤4-word clip captions, and one-sentence fine print. Nothing else (review
    the diff for strings).

### Chunk B: the big screen (film, Briefing, callouts)

**Owns:** `games/robo-rally/host.js`, `scene.js`, `lessons.js`, `lobby.js`, `lobby.css`, `sound.js`
(ducking only), and the new files `voice.js`, `briefing.js`, `teach.js`, `mimic.js` (the phone mimic
extracted from `lobby.js`), `teach.css`, `test/lessons.mjs`.

**Shell edits:** none. `teach.css` is loaded by `host.js` the same way as `guide.css`.

**Not `style.css`:** `style.css` belongs to chunk A. Every big-screen style change goes in `teach.css`,
loaded after `style.css`. That includes overriding `.lm-tok.prio` with the "1" badge, the roster's flag
glyphs, the junk-card flight, the voice line, the subtitles and the skip tally. The lobby film's
changes go in `lobby.css`.

**Builds:**

- the lobby film's four scenes with the register strip and order numerals (2.1);
- the `lessons.js` API additions and `BRIEF` scenes (2.4.1, 3.2);
- the `scene.js` helpers (2.4.2);
- the always-on host changes (2.4.3): order numerals, the "1" badge, the junk-card flight, round-1
  names, the shut-down look, roster flags;
- the Briefing (`briefing.js`, 2.5, 3.2): `host.js` runs it when `view.phase === 'brief'` and stops and
  restores the arena when the phase leaves it, then sends `briefDone`;
- the skip keys and button and the tally;
- the callouts (`teach.js`, 2.3), including `hold` requests and the near-miss detection;
- `voice.js` and the subtitles policy (3.5–3.6).

**Acceptance criteria:**

1. **The lobby film** shows four dots. Scene 1's robot starts facing the viewer and turns to the screen's
   right on Rotate Left. Scene 2's round 2 program is sensible and it shows no Haywire. Scene 3 shows the
   SPAM landing in the mimic's deck stack, then the Haywire locking slot 3 and running there next round.
   Clicking a dot still jumps.
2. `node test/lessons.mjs` runs every `LESSONS` and `BRIEF` scene through the engine and asserts:
   - `lesson-program` wins in register 5;
   - `lesson-damage` gives L0 `sp` in register 1, locks `h01` in slot 3, and runs it in round 2
     register 3;
   - `BRIEF.stop` has no `cp` in register 1 and a `cp` in register 2;
   - `BRIEF.push` has a fall in round 1 register 1 and a reboot in round 2;
   - `BRIEF.order` ends at the register 2 reveal, after a belt beat and a gear beat.
3. **The Briefing** plays all shots in order with voice in Chrome and Edge on Windows. With 4 players,
   upgrades and a timer it lasts 65–80 s; shots 13 and 14 drop out when their options are off. Names are
   spoken and synced to the roll call. The flag count matches the course (First Light: "One. Two.").
4. **Skipping:** a majority of phones ends it within 300 ms of the deciding vote; so do Esc, Space, Enter
   and ⏭. The arena returns to the real course with robots on their pads, and programming starts
   (verified on the website build and the laptop server).
5. **Muted, or with no voice:** subtitles appear with correct timing, and the Briefing waits for them.
   With voice and sound on, no subtitles. **C** toggles captions and the setting persists.
6. **Callouts** fire at their triggers once per page session, and not at all when `view.teach` is false
   (win excepted). Holds never exceed 4 s, and a two-race session repeats nothing.
7. **Always-on changes:** order numerals appear at every reveal in priority order; the "1" badge moves
   each round; junk cards fly to the right token; names show in round 1; shut-down robots are dimmed with
   a power glyph.
8. **One WebGL context** at a time: the Briefing reuses the host's arena. No console errors through a
   full race on every course.

### Chunk C: rules, data, tests, docs

**Owns:** `games/robo-rally/rules.js`, `test/robo-rally.mjs`, `README.md`.

**Shell edit:** `public/dev-phone.html` (the dev tool's test fixtures only).

**Builds:**

- everything in 4.2: the `hello`, `skip`, `briefDone`, `briefSkip` and `hold` actions; phase `brief`; the
  round-1 shop skip; `s.fresh` and `s.teach`; story recording; `auto`; the view additions;
- `dev-phone.html`: `?to=brief`, and `?to=race&story=demo` (runs a scripted round, so the phone shows a
  real story);
- the README: a short "How the game teaches" paragraph, and "Differences from the rulebook" (D1–D7, the
  round-1 shop skip, the Act Fast timer on by default).

`engine.js` is not changed.

**Acceptance criteria:**

1. `node test/robo-rally.mjs` passes with new cases:
   - the Briefing starts only when a fresh racer exists;
   - majority voting (1/1, 2/2, 2/3, 3/5) and unvoting work;
   - `briefDone`, `briefSkip` and the 150 s deadline each end it;
   - round 1 goes straight to `program` when upgrades are on, and round 2 opens the shop;
   - `hold` extends a beat and is capped at 4 s;
   - story steps for a scripted round match expectations (pushed by, belt, laser source, damage, fall,
     replace);
   - `auto` lists the timer-filled slots.
2. An 8-robot game on Meridian with upgrades runs for 10 rounds. The largest `JSON.stringify(playerView)`
   is under 16 KB, and every `me.story` is under 2.5 KB.
3. `npm test` says ALL PASSED. The phone views remain plain JSON (no Sets or Maps).
4. The README section exists and lists every deviation.

**Order and integration.** C first, then A and B in any order. The last of A and B to land runs a full
race through `npm run dev` with three phones (one fresh), checking the Briefing, a skip, the callouts and
the phone story together.

---

## 6. Decisions taken

All of these were decided here. The first is the only one that changes a rule, so the owner may want to
confirm it.

1. **Round 1 has no shop.** It was the first screen anyone saw and meant nothing before a robot had
   moved (UPG-01, P1). Energy carries over, so the only cost is one upgrade draw. It's listed in the
   README, and reverting it means deleting one line in `rules.js`.
2. **The Briefing's timing:** after start pads, before round 1. It plays only when a newcomer is racing,
   and a majority of phones skips it.
3. **The narrator:** "Floor Control", using browser speech synthesis with pitch 0.6 and rate 0.92.
   Recorded audio can replace it later, line by line.
4. **Callouts hold the race** for 1.5–3 s, once each per session, only when a newcomer is racing.
5. **One "?" button**, holding both the manual and point-at-anything. There is no separate manual icon.
6. **No words on the big screen**, except subtitles when the voice can't be heard.
