# Robo Rally: what players will wonder, and when

Research for making the rules effortless to pick up. This is step one of the plan: every rule and every
interaction a player could have a question about, the question in the player's own words, when and where it
comes up, how likely and how blocking it is, the shortest true answer, and the ways it could be answered. It
does **not** choose the final design; a separate agent combines the channels into one seamless approach.

Owner's standing rule, applied throughout: anything that can be shown with an animation should be; every
word a player must read is a hindrance (a spoken narrator is not reading, so voice is fair game).

**Sources.** The 2023 rulebook (the whole text, including the upgrade and variant pages); the code at commit
`0220d81` (engine.js, rules.js, cards.js, board.js, player.js, host.js, scene.js, lobby.js, lessons.js, demo.js,
minimap.js, glyphs.js); screenshots of every phone screen and the big screen in each phase (taken with the
dev phone and a 3-bot race); and 100 simulated 4-robot games with "semi-smart" bots that choose the best of
300 programs by the phone's own preview (section 4). Some lobby/join files and the animation timing in
engine.js/scene.js were being changed by another agent while this was written; none of those changes touch
the rules.

**Contents**

1. [Top 25 questions](#1-the-top-25-questions)
2. [Biggest sources of confusion](#2-the-biggest-sources-of-confusion)
3. [Bugs, misleading UI, quiet deviations](#3-bugs-misleading-ui-and-quiet-deviations)
4. [When questions arise in a first game (simulation)](#4-when-questions-arise-in-a-first-game)
5. [Play-throughs by kind of player](#5-play-throughs-by-kind-of-player)
6. [The question catalog, by phase and topic](#6-the-question-catalog)
7. [All 40 upgrades](#7-all-40-upgrades)
8. [All 17 Haywire cards](#8-all-17-haywire-cards)
9. [Everything a player might point at ("?" targets)](#9-everything-a-player-might-point-at)
10. [What the current UI teaches well, wrongly, and where people get lost](#10-what-the-current-ui-teaches)
11. [Teaching channels: what each is good for](#11-teaching-channels)
12. [Answer-moment map and first-time triggers](#12-answer-moment-map-and-first-time-triggers)
13. [Appendix: rulebook coverage](#13-appendix-rulebook-coverage)

**Legend**

- **L** = likelihood (how many players will wonder): H most, M some, L few.
- **B** = blocking (how stuck or lost they feel without an answer): H can't act / wrong mental model, M acts but
  feels lost, L curiosity.
- **Tier**: **P1** answer before play or at first encounter for everyone; **P2** answer at first encounter or
  within one tap; **P3** on-demand reference; **P4** veterans and rare edge cases.
- **Channels** (candidates, not decisions):
  - **FILM**: the lobby's wordless lesson film on the big screen (before play).
  - **INTRO**: a narrated, skippable cyber-voice intro on the big screen at game start.
  - **MAN**: a phone manual (icon top right), every animation playing at once under mechanic headers.
  - **ASK**: a "?" tap-to-ask mode on the phone: tap the thing you are confused about, get its natural
    questions answered with animation.
  - **CUE-B / CUE-P**: an in-the-moment cue on the big screen / phone, typically the first time something happens.
  - **DO**: learn by doing (the ghost preview line, a safe first round, solo practice, replays).
  - **NONE**: no teaching needed.

---

## 1. The top 25 questions

Ranked by reach × blocking × how early it hits. "When" is the first moment most players hit it.

| # | ID | The player's words | When | Shortest true answer | Best channel → moment |
|---|----|----|----|----|----|
| 1 | GOAL-01 | "What am I even trying to do?" | lobby; first programming | Reach the numbered flags in order. First robot to finish a register on the last flag wins. | FILM + INTRO → before play; phone map keeps the next flag lit |
| 2 | PRG-01 | "What do I do with these cards?" | first programming screen | Put one card in each of the 5 slots. Slot 1 runs first, then 2, 3, 4, 5. | FILM scene 1 (already good) → before; CUE-P (bobbing card + light line, exists) → first encounter |
| 3 | MOV-02 | "Rotate *left*: my left or the robot's? Which way am I facing?" | every programming, worst when the robot faces the camera | The robot's own left. The little point shows its front. Trust the light line on your phone. | CUE-P (light line, exists) + ASK on the robot → first programming; FILM should show a robot facing the viewer |
| 4 | ACT-01 | "Which robot on the TV is mine?" | first activation | Your color and shape (shown top-left on your phone); your name is under it in the row at the bottom. | CUE-B: each robot lit with its name as the race starts → first register |
| 5 | CP-01 | "Which flag do I need next, and where is it?" | first programming; after each flag | The next flag glows bright on your phone map. On the TV the rings at a flag's foot show who has it. | CUE-P + ASK on a flag → round 1; INTRO |
| 6 | DMG-01 | "I got shot. How much health do I have? Am I dying?" | round ~2 (93% are damaged by round 2) | There is no health. Damage is junk cards: SPAM into your deck, or a Haywire stuck in a slot next round. | INTRO → before; CUE-B + CUE-P (show the card flying to that player's phone) → first damage |
| 7 | ACT-02 | "Why didn't I end up where my line said?" | first activation onward | Other robots move between your cards and can push or block you; the board moves you; damage can change a card. The line ignores other robots. | DO: a per-player "what just happened" replay; CUE-P at the first mismatch |
| 8 | BRD-01 | "Why did my robot move (or turn) by itself?" | round 1–3 | After everyone's card, the board acts: belts carry, push panels push, gears turn. | FILM scene 2 → before; "what just happened" + ASK on the element → first encounter |
| 9 | RBT-01 | "Where did my robot go? Am I out?" | first fall (20–80% of robots by round 4–5, course-dependent) | It fell. The rest of this round is lost, you take 2 damage, and it comes back at the blue reboot ring at the start of next round. | CUE-P immediately + CUE-B → first fall |
| 10 | DMG-03 | "What's this red '!' card in my hand? Should I play it?" | round 2–3 programming (62–100% by round 3) | SPAM: junk. Playing it throws it away for good, but that slot runs a random card from your deck instead. Unplayed, it stays in your hand. | CUE-P first time it's in hand + ASK on the card |
| 11 | DMG-08 | "Why did my card turn into a different card?" | when SPAM is played, Again in slot 1, or someone's Scrambler | That slot's card was swapped for the top card of your deck (SPAM, an Again in slot 1, a Scrambler hit, your Abort Switch). | CUE-B (the TV already shows card → card with a glitch) + phone "what happened" |
| 12 | PRG-10 | "Why can't I put a card in that slot? What's the violet card?" | round 3 programming (72–99% of robots by round 3) | A Haywire (damage) got stuck in that slot last round. It runs there this round; fill the other slots around it. | CUE-P first time + ASK on the slot |
| 13 | UPG-01 | "What is this shop? Do I have to buy something?" | the very first screen after picking a start pad | Optional. Energy (⚡) buys upgrades. Tap ✓ to skip. It comes back at the start of every round. | CUE-P first shop + INTRO; design option: skip the shop in round 1 |
| 14 | PRG-07 | "How do I submit? Can I change my mind?" | first programming | ✓ locks in once all 5 slots are full. Tap a slot to take its card back. The pencil unlocks until everyone is in. | FILM (finger taps ✓, exists) + CUE-P (✓ glows, exists) |
| 15 | TIME-01 | "What happens if the timer runs out?" | first programming with a timer (default: 2 minutes) | Every empty slot gets a random card from your hand. Cards you placed stay. | INTRO + CUE-P/CUE-B in the last 10 seconds |
| 16 | ORD-04 | "Who goes first? Why did they move before me?" | first activation | In every slot, the Priority holder goes first, then around in join order. Priority moves one seat each round. | CUE-B (make the order visible each register) + ASK on the roster |
| 17 | LAS-01 | "Who shot me? When do lasers fire?" | round 1–2 | After the cards, every register: wall lasers hit the first robot in their red dotted line, and every robot shoots straight ahead at the first robot in line. | FILM (add a robot shot) + CUE-B + ASK on the laser line |
| 18 | CP-02 | "I went over the flag. Why didn't it count?" | first near-miss | You must *end* a register on it, and take them in order. | CUE-P/CUE-B on the near-miss + ASK on the flag |
| 19 | CRD-06 | "What does the Again card (circle arrow) do?" | round 1 (68–93% of robots play one by round 2) | It repeats what your previous slot did. In slot 1 it becomes a random card. | ASK on the card + light line (already previews it) + MAN |
| 20 | SET-03 | (leader) "What do these round buttons and 1 2 3 do?" | setup | ⚡ = upgrades and energy on/off; wall = safe edges; ! = less SPAM; ∞/1/2/3 = minutes to program each round. | ASK on each toggle (demos exist) + MAN |
| 21 | WAIT-01 | "Is it my turn? Why are we waiting?" | every programming and decision | Everyone programs at once; then the race runs itself. Dim robots on the TV haven't locked in; a pulsing ring means that player is choosing something. | CUE-B (exists, faint) + INTRO |
| 22 | RBT-04 | "What are these four arrows on my map?" | programming after a fall | Choose which way your robot will face when it comes back. | CUE-P (the ghost robot turns as you tap) + ASK |
| 23 | MOV-05 | "Can I push robots? Can they push me off?" | round 2 (64–91% are pushed by round 2–3) | Yes. Driving into a robot shoves it (and any behind it), even into a pit or off the edge. Walls stop pushes. Belts never push. | FILM scene 3 (shows it) + MAN + ASK |
| 24 | SD-01 | "What's the power button? Should I press it?" | programming, any round | Shut down: sit out this round to throw away your damage. You can still be pushed, carried and shot. | existing sheet demo + ASK; CUE-P suggestion when damage piles up |
| 25 | DEC-05 | "How do I use my one-use upgrade during the race?" | first race after installing Boink/Zoop/etc. | Tap its bar on your phone during the race; at your next turn your phone asks before your card. | CUE-P after installing + MAN |

---

## 2. The biggest sources of confusion

1. **Facing and relative turns on an angled 3D board.** Every move card is relative to the robot. When a robot
   faces the camera or sideways, "left" on the card is the viewer's right or "up". The light line on the
   phone answers it, but only if the player looks at it and trusts it. The big screen shows facing with a
   small pointer that is hard to see from a sofa.
2. **Planning together, resolving in turns.** Everyone programs at once, but the race runs slot by slot,
   robot by robot in Priority order, with the board acting after each slot. Nothing explains the order, the
   Priority holder is a 5-pixel dot, and the phone's light line ignores other robots, so "my plan didn't work"
   is the most common feeling and has no answer on screen.
3. **The board acts after every card.** Belts, push panels, gears, board lasers, robot lasers, batteries and
   flags all happen in a fixed order at the end of each register. The film shows belts, a gear, a laser and a
   pit in one scene; blue belts, curves, push panels and the order itself are never shown.
4. **The damage model.** No health; damage is junk cards. SPAM goes into your deck and later clogs your hand;
   Haywire hides in the slot where you were hit and runs next round. Simulations show nearly everyone is
   damaged by round 2, has a Haywire locked in a slot by round 3, and SPAM in hand by round 3, yet the film
   never mentions damage and the big screen shows only colored shards. The phone's SPAM number counts deck +
   discard + hand, which reads as "in my hand".
5. **Round 1 opens in the shop.** The first screen after picking a start pad is the Upgrade Phase: energy,
   draw-vs-install, permanent-vs-one-use, one draw and one install per round, 3 + 3 slots, a 60-second timer,
   and words on every tile. Nobody has moved a robot yet, so none of it has meaning.
6. **Falling and rebooting.** The robot vanishes, the rest of your round is silently cancelled, two damage
   cards arrive, and next round four unexplained arrows appear on your map. Many will think they're out.
7. **Silent automation.** Empty slots get random cards when time runs out; a phone that sleeps or drops gets a
   random program as soon as everyone else locks in; decisions auto-answer after 12 seconds; Deflector Shield
   spends energy on its own. Each produces "my robot did something I didn't tell it to".
8. **Wordless icons that aren't self-explanatory.** The leader's toggles (⚡, a wall that looks like a cup, a
   warning triangle, ∞ 1 2 3), the Priority dot, flags drawn as dashes, the eye glyph meaning four different
   things (watch the TV / zoom / peek / look up), the Again glyph (reads as "refresh"), the power button next to
   ✓, and the undo glyph that clears all five slots.
9. **Upgrades are hard to use and easy to forget.** One-use movement upgrades must be "armed" during the race and
   the arming is spent once you answer; permanent upgrades are invisible during programming and the race, so
   Crab Legs' + badge, Power Slide prompts and Brakes prompts arrive as surprises.
10. **The film is short and fast.** Three scenes (~1¾–2 minutes per loop), no pauses on the key moment, nothing
    on damage, energy, Priority, walls, blue belts, push panels, Again, shutdown or the timer. Latecomers and
    "rules first" players have no other source until the race starts.

---

## 3. Bugs, misleading UI and quiet deviations

Outright errors first, then misleading UI, then behavior that differs from the rulebook without being listed
in the README.

**Errors**

- **E1. The Spiky demo teaches the wrong rule.** `demo.js:47`: robot b drives *next to* the Spiky robot (it
  stops one space short) and then takes damage. The rule (and the engine's `spiky()`) is that only a robot
  that moves or is pushed *into* the Spiky robot's space takes damage; the rulebook explicitly says moving
  adjacent does not trigger it.
- **E2. The phone shows every incoming Haywire as "Move 1, Rotate Right, Move 1".** `player.js:603` draws
  `card('h01', 'xs')` under any race-phase slot that has a face-down Haywire waiting. That is a real Haywire's
  face, so the player believes they got that card; next round the slot shows the actual one.
- **E3. The light line shows three Haywires as "stay put".** `player.js:131` (`previewType`) turns any Haywire
  with a non-move op into `['noop']`, drawn as an ordinary dot. Spin Out (random facing + Move 2), Double
  Program (the top two cards of your deck) and Swap (trade places with your laser's target) all move you; the
  preview should show "?" like SPAM.
- **E4. The light line shows Hover Unit owners falling into pits they will cross.** `minimap.js:426`
  (`previewProgram`'s `step`) marks a fall on entering any pit; with Hover Unit your own card carries you over.
- **E5. Several demos are blank or misleading** because `drawPop` (demo.js) drops every emoji it doesn't know
  (verified against its regex): **Re-Initialize** (`demo.js:61`, nothing happens at all), **Haywire "Install an
  Upgrade"** (`demo.js:112`, nothing), **Brakes** (`:25`, a Move 1 card appears and nothing else), **Memory
  Cards** (`:36`, two card backs and an arrow, then an arrow), **SPAM Filter** (`:46`, one card back), **Memory
  Swap** (`:57`, three card backs twice), **Rewire** (`:63`, a ⚡ then a card back: reads as "spend energy"),
  **upgrades rule demo** (`:71`, ⚡ → nothing), **Spin Out** (`:105`, the 🌀 is dropped so it looks like a
  plain right turn, not a random one), Modular Chassis (only ⇄ marks), and the flags demo's trophy.
- **E6. Power Surge's card picture shows one bolt** (`glyphs.js:129` maps `['en', n]` to a single `pu` glyph and
  ignores n), so "gain 3 energy, take 1 damage" looks like "Power Up, then damage".

**Misleading or confusing UI**

- **M1. Weapon-choice and upgrade-window prompts hide their one-line hints.** The engine sends `sub` text
  ("1 Energy: 2 damage + push", "Pull it 1 space closer", "Back up to 5", "Ride the conveyors") but
  `optionPicture` (`player.js:674–707`) shows only the name for weapons, Overclocked, Pressure Release and All
  Aboard. Mid-race, with 12 seconds, a name alone is not enough.
- **M2. The undo button clears all five slots** (`player.js:260`), not the last card. Tapping a filled slot is
  the real "take back".
- **M3. The setup toggles have no labels** on the phone or the TV: ⚡ (upgrades), a wall glyph that reads as a
  cup (safe edges), the SPAM triangle that reads as "warning" (less SPAM), and 1/2/3 with no unit on the phone
  (the TV shows a stopwatch). Their demos (`upgrades`, `safe-edges`, `less-spam`) exist but are not used.
- **M4. Priority is a 5-pixel dot** above a roster token (`style.css:83`). Nobody will notice it or know what it
  means, and Re-Initialize changes it invisibly.
- **M5. Flags are drawn as short dashes** on the phone's top bar and the TV roster; they do not read as flags.
- **M6. The SPAM number in the phone's top bar** counts SPAM in deck + discard + hand (`rules.js:327`). Players
  will read it as "SPAM in my hand" and be confused when it doesn't match.
- **M7. The eye glyph means four things**: "watch the TV" (setup wait, late joiner), "zoom the map", "SPAM Filter
  peek", and "look up" during the race.
- **M8. Robot names on the TV are hidden whenever a card floats over the robot** (scene.js, `tag.visible … &&
  !b.card`), which is most of each register: "which one is me" has to be answered from the roster.
- **M9. Shut-down robots look normal on the board**; only a power glyph on the roster tells the room. "Why is
  that robot just sitting there?"
- **M10. Permanent upgrades are invisible during programming and the race.** The programming screen shows only
  one-use upgrades usable now; the race screen only armable ones. You can't check what your robot can do.
- **M11. The start screen hides the course.** The phone shows the Docking Bay and two columns of floor, so you
  pick a pad without seeing the flags, lasers or pits (the TV shows them, but the decision is on the phone).
- **M12. Lesson 2's second round programs five Rotate Lefts** (`lessons.js:76`) while the robot simply reappears
  at the reboot ring. It suggests the cards brought it back.
- **M13. The power (shutdown) button sits next to ✓** with the same size and style as undo. Kids and hurried
  players will tap it. The confirm sheet saves most cases, but its ✓ is a power glyph and its "no" is a cross.
- **M14. Disconnected or sleeping phones are programmed randomly at once.** `rules.js:23` (`everyone`) moves on
  as soon as every *connected* player has locked in; the absent robot gets random cards (keeping any it had
  placed). Without a wake lock (plain-http Wi-Fi play) phones sleep. Not a bug, but a major "what did my robot
  do" trap.
- **M15. Deck and discard counts reach the phone** (`rules.js:325–326`) but are never shown; veterans plan
  around them.
- **M16. The phone never learns what happened to it.** `playerView`'s beat has no effects (`rules.js:283`), so
  a phone can't say "you took 2 SPAM" or "a Haywire landed in slot 3" (it only sees the face-down marker, E2).
  Any phone-side "what just happened" needs this data.

**Quiet deviations from the rulebook (not in the README)**

- **D1. Reboot onto an occupied spot:** the rulebook shoves the occupant one space along the token's arrow. The
  engine (`landOn`) tries the arrow, then right, left and back, then places the rebooting robot on the nearest
  free space. The shove uses a normal step, so chains and Spiky can trigger and the occupant can be shoved
  into a pit.
- **D2. Deflector Shield pays automatically** (`autoShield: true` at `engine.js:128`); the card says "you may
  pay". The switch is an "auto ✓" button hidden in the installed-upgrade sheet.
- **D3. Priority:** the first holder is random (rulebook: the youngest) and seat order is join order. Start pads
  are picked first-come (rulebook: youngest first, in order).
- **D4. Shutdown is chosen instead of programming** (the rulebook declares it after programming, before the
  reveal). Same effect.
- **D5. Again after a Haywire repeats the whole Haywire** (e.g. Move 1, Rotate Right, Move 1). The rulebook only
  covers "multiple programming cards" (Double Program, Crab Legs: the second card). Reasonable, but a veteran
  may expect otherwise.
- **D6. The timer is the "Act Fast" variant and is on by default** (2 minutes). The rulebook marks it "for
  experienced players".
- **D7. Final-flag ties go to Priority order** (the rulebook doesn't say).

---

## 4. When questions arise in a first game

100 simulated 4-robot games, upgrades on, bots that pick the best of 300 programs using the phone's own
preview (head for the next flag, avoid falls). Humans differ, but the *order* in which things first happen is
a good guide to when first-time cues fire. Percent = share of robots it happened to at least once; "round" =
the median round it first happened.

| First happens to a robot | First Light (starter, 40 games) | Current (beginner, 30) | Prism (intermediate, 30) |
|---|---|---|---|
| Plays Again | 68%, r1 | 93%, r2 | 92%, r2 |
| Carried by a green belt | 48%, r3 | 97%, r1 | 91%, r3 |
| Hit by a robot laser | 93%, r2 | 100%, r1 | 100%, r2 |
| Gets SPAM | 87%, r2 | 99%, r1 | 100%, r2 |
| Gets a Haywire | 83%, r2 | 99%, r2 | 100%, r2 |
| Gains energy | 69%, r2 | 96%, r2 | 96%, r2 |
| Pushed by another robot | 64%, r2 | 90%, r2 | 91%, r3 |
| Turned by a gear | 33%, r2 | 52%, r5 | 32%, r7 |
| Hit by a board laser | 32%, r2 | 96%, r2 | 92%, r2 |
| Reaches flag 1 | 79%, r2 | 99%, r3 | 93%, r3 |
| Haywire locked in a slot | 72%, r3 | 98%, r3 | 99%, r3 |
| Runs a Haywire | 69%, r3 | 98%, r3 | 99%, r3 |
| SPAM in hand while programming | 62%, r3 | 98%, r3 | 100%, r3 |
| Turned by a curved belt | 42%, r3 | 91%, r3 | 88%, r2 |
| Bumps a wall (or a blocked push) | 31%, r3 | 83%, r6 | 59%, r6 |
| Falls off an edge | 15%, r3 | 78%, r4 | 46%, r5 |
| Falls into a pit | 10%, r3 | 28%, r7 | 45%, r6 |
| Reboots (programs with the arrows) | 20%, r4 | 79%, r5 | 63%, r5 |
| Carried by a blue belt | (none on this course) | 83%, r5 | 89%, r3 |
| Plays SPAM (card replaced) | 8%, r5 | 76%, r7 | 58%, r7 |
| Pushed by a push panel | (none) | 55%, r7 | 7%, r10 |
| Median rounds to a winner | 4 | 16 | 10 |

What this means for teaching:

- **Round 1** is the shop (before anything moves), then programming, Again, and on belt-heavy courses the first
  belt ride.
- **Round 2** is when damage, SPAM, Haywire, pushes, energy and the first flag all arrive at once. Damage is not
  an advanced topic: it must be understood by round 2.
- **Round 3** is when the first Haywire locks a slot and SPAM sits in the hand while programming: nearly every
  player meets both.
- **Rounds 3–5** bring falls and reboot programming. Playing a SPAM card (and seeing a card replaced) comes later,
  round 5–7, because players avoid it until their hand is clogged.
- First Light ends in about 4 rounds, so a first game on it barely reaches rebooting or blue belts. Current
  takes four times as long and teaches everything.

---

## 5. Play-throughs by kind of player

Each walk-through lists what the screens show and what the player is thinking, with the catalog IDs (section 6).

### 5.1 The party first-timer (has never seen a rulebook)

- **Lobby.** Scans the QR code, types a name, sees a big robot on the phone ("tap it to change it" is only
  implied, LOB-03). The TV loops the film while people chat; she half-watches scene 1 and takes away "cards
  move the robot" (LOB-01). Nothing she sees mentions damage, energy or turns.
- **Setup.** Her phone shows only an eye (SET-01: "is it broken? am I supposed to do something?"). The leader is
  choosing a course.
- **Start pads.** Eight numbered pads on a narrow strip. "Does it matter which? Which way will I face? Where's the
  flag?" (STA-01, STA-02). She taps one.
- **Shop.** "⚡3", a "+ ⚡1" tile and three tiles with tiny animations and names. "Is this a store? Do I need to
  buy? What's ⚡?" (UPG-01, UPG-02). She taps a tile, sees an animation, one sentence and a "+ ⚡2" button.
  "Did I buy it already? What's the X?" (UPG-04). Taps ✓ to escape.
- **Programming.** Nine cards, five dashed slots, a small map. The first card bobs; she taps it; a line of light
  appears from her robot. Good. "Which one is me on this map? Which way is it pointing? Rotate right... right of
  what?" (PRG-02, MOV-02). The light line answers if she reads it. She fills five, ✓ glows, taps it, then "now
  what?" (WAIT-01).
- **First register.** Her phone dims to five cards and an eye. The TV shows a "1" and cards popping up over every
  robot; names disappear under the cards. "Which one is mine?" (ACT-01). Robots move one at a time ("why did
  they go first?", ORD-04). Her robot moves, then moves again on a belt ("I didn't do that", BRD-01). A beam, shards
  ("did I get shot? by whom? did I lose health?", LAS-01, DMG-01).
- **Round 2.** The shop again ("again?", UPG-12). Then a coral "!" card in her hand and a "1" next to a "!" at the
  top (DMG-03, DMG-06), and one slot holding a violet card she can't move (PRG-10). "Did my phone glitch?"
- **Later.** She drives off the edge. The robot is gone; her phone shows a reboot symbol and nothing else ("am I
  out?", RBT-01; "why didn't my other cards run?", RBT-02). Next round four arrows sit on her map (RBT-04). She
  reaches a flag; light rings. "Is that good? What next?" (CP-01).

### 5.2 A kid (8, reads little)

- Loves choosing the robot shape. Watches the film closely and gets "cards → robot moves".
- Relies entirely on pictures: upgrade names, the shop's text and the weapon prompt's words are lost; some
  upgrade demos show nothing (E5).
- Left/right breaks down whenever the robot faces down or left on the screen (MOV-02).
- Taps everything: the power button next to ✓ opens the shutdown sheet; tapping its big button shuts the robot
  down for a round (SD-01, M13). "Why isn't my robot doing anything?"
- The 2-minute timer is short for a kid: random cards fill the empty slots (TIME-01) and the robot "goes crazy".
- Gets shot a lot (being in line with others) and doesn't connect beam → damage → junk cards (DMG-01). Falls feel
  like dying ("my robot died!", RBT-01).

### 5.3 The board-game veteran (knows the 2023 rules)

Their questions are about this version's specifics:

- "Who has Priority right now?" every round (ORD-04; M4: a tiny dot).
- "Is the Act Fast timer on? What happens at zero?" (TIME-01; D6).
- "How do I use temporary upgrades? When can I play Abort Switch?" (DEC-05; the arm button).
- "When do I declare shutdown?" (SD-01; D4: it's instead of programming).
- "What's in the damage deck? These Haywires aren't in my box." (DMG-09; 23 SPAM + 17 Haywire, 12 original).
- "Where's my discard pile / how many cards left in my deck?" (PRG-25; M15).
- "What upgrades do the others have installed?" Installed upgrades are public in the rulebook; the TV roster
  shows only diamonds (UPG-13).
- "What happens if my reboot token is occupied?" (RBT-07; D1). "Does Deflector Shield ask me?" (D2). "Does Again
  after a Haywire repeat all of it?" (D5).
- "Are board elements under checkpoints dead?" (BRD-19: yes, none on these courses).

### 5.4 The "just let me try it" player

- Skips the film and taps fast. Learns from the light line and the TV. Doesn't want text.
- Needs a quick "why" only when surprised: why did I turn, why did my card change, why am I gone, why didn't the
  flag count, why couldn't I place a card (BRD-01, DMG-08, RBT-01, CP-02, PRG-10).
- Ideal answers: a one-glance animated cue at the moment, and a way to replay "what just happened to me".

### 5.5 The "tell me the rules first" player

- In the lobby, wants all the rules before starting. The film is wordless, short and loops; it can't be paused or
  rewound from a phone (the in-progress lobby change lets the big screen jump between scenes, but that is shared).
  The waiting screen offers nothing else (LOB-05).
- Wants the card list with counts, what Again does, what energy is for, how damage works, the board element order,
  and every upgrade's detail before the first shop.
- Will read a manual if it exists; will otherwise interrogate the leader.

### 5.6 The leader (first phone in, starts and sets up the game)

- Lobby: has the start button; "should I wait for everyone? can people join later?" (LOB-06, LOB-07).
- Setup: course carousel (difficulty dots, flag count, an evocative name) and four unlabeled controls (SET-02,
  SET-03, SET-04). "Should beginners play without upgrades?" (SET-05). Doesn't know the 2-minute default means
  random cards for slow players.
- During play: the room's helpdesk. Every question above lands on them. Also: what is the ⏩ button on the TV
  (Hurry: 15 seconds left), and where is restart (the ⋯ menu on their phone, in words).

### 5.7 Someone who joins late

- Joins during programming or later: their waiting screen shows an eye and nothing else. "Can I play? When?"
  (LOB-07). Answer: joining closes once start pads are being picked; they play the next race. They missed the
  film, which only runs in the lobby.
- Joining during setup or start-pad picking works: they get a robot and go straight into the shop (UPG-01) with
  no film at all.

### 5.8 Someone whose phone drops or sleeps

- While away: the TV dims their robot and shows "…" over it. If the others all lock in, the race starts and their
  robot gets a random program (M14). Decisions on their phone auto-answer with the safe default.
- On return (same phone or tab): they get their robot back, mid-race, with a program they didn't make. "What did
  my robot do? Why are these my cards?" (TIME-06).

---

## 6. The question catalog

Format for the important questions:

> **ID · "The question in the player's words"** · tier · L/B
> **When:** phase, what they're looking at, what just happened.
> **Answer:** the shortest true answer.
> **Ways:** candidate channels → the moment each helps most.

Lower-priority questions follow each section in a table.

### 6.0 The goal

**GOAL-01 · "What am I even trying to do?"** · P1 · H/H
- **When:** lobby (film), first programming, any time the plan feels pointless.
- **Answer:** Race to the numbered flags in order (1, then 2...). The first robot to end a register on the last
flag wins at once.
- **Ways:** FILM scene 3 (shows flags in order and a win; add a clear "1 → 2 → win" beat) → before; INTRO opening
line → before; phone map highlighting the next flag (exists) → always; MAN "Goal" → on demand.

**GOAL-02 · "Is this a race or a fight?"** · P2 · M/M
- **When:** first time they're shot or pushed.
- **Answer:** A race. Shoving and shooting are side effects that slow others down; damage never knocks you out.
- **Ways:** INTRO → before; MAN → on demand.

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| GOAL-03 | "How long is a game?" | setup | More flags and more dots = longer. In simulation, First Light took ~4 rounds; Prism ~10 and Current ~16 (people will be slower). | MAN, leader's course card (flag count, dots) |
| GOAL-04 | "Do the others keep playing after someone wins?" | win | No, the race ends immediately. | CUE-B at the win (exists: the winner's pillar) |

### 6.1 Before the game: lobby, joining, waiting

**LOB-01 · "What kind of game is this?"** · P1 · H/M
- **When:** in the lobby, glancing at the TV between conversations.
- **Answer:** You secretly plan five moves with cards, then everyone's robots run their plans at the same time,
bumping, shoving and shooting, on a factory floor that moves by itself.
- **Ways:** FILM (scenes 1–3) → before; INTRO → start of game.

**LOB-05 · "Can I read the rules on my phone while we wait?"** · P1 for rules-first players · M/M
- **When:** waiting screen (only their robot and its shape dots).
- **Answer:** Not today. (Candidate: the manual reachable from the waiting screen.)
- **Ways:** MAN (from the lobby, the in-game ? and the top-right icon); FILM replay on the phone.

**LOB-07 · "Can I still join? When can I play?"** · P2 · M/H (for that person)
- **When:** a late arrival opens the page during a race: waiting screen with an eye.
- **Answer:** New robots can join until start pads are picked. After that, watch the TV; you'll be in the next race.
- **Ways:** CUE-P on the late joiner's screen (show the race on the TV, "next race" glyph, the film); MAN.

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| LOB-02 | "How do I join?" | arriving | Scan the QR code (or type the address). | NONE (works) |
| LOB-03 | "Can I change my robot?" | waiting screen | Tap it to cycle its shape; your color is yours. | CUE-P (a tap hint) |
| LOB-04 | "Is the TV showing the game or a video?" | lobby | A rules film made from the real game. | FILM framing (a "how to play" title card) |
| LOB-06 | "Who starts it, and when?" | lobby | The first player's phone (the leader) has ▶; wait until everyone's in. | Exists (in-progress: shows whose robot starts) |
| LOB-08 | "How many can play?" | lobby | 1–8 (2–6 is best). | MAN |
| LOB-09 | "Can I practice alone?" | lobby | Yes, one player can start a race. | MAN |

### 6.2 Setup (the leader chooses)

**SET-01 · "My phone shows an eye. What am I waiting for?"** · P2 · H/L (everyone but the leader)
- **When:** game start, setup phase, non-leaders.
- **Answer:** The leader is choosing the course; look at the TV.
- **Ways:** CUE-P (show the leader's robot and the course being browsed); INTRO can start playing here.

**SET-02 · "Which course should we play?"** · P2 · H(leader)/M
- **When:** setup carousel: thumbnail, a one-word name, 1–4 dots, a flag and a number.
- **Answer:** Dots = difficulty (First Light is the starter), the number = how many flags (more = longer).
- **Ways:** ASK on the dots/flag; MAN "Courses" (each board's elements as tiny demos); FILM N/A.

**SET-03 · "What do these three round buttons do?"** · P1 for the leader · H/H
- **When:** setup: ⚡, a wall glyph (looks like a cup), the SPAM triangle; on phone and TV, no labels.
- **Answer:** ⚡ = upgrades and energy (off: no shop, batteries and Power Up do nothing). Wall = safe edges (the
outer edge acts as a wall; pits still swallow). Triangle = less SPAM (SPAM in your hand is thrown into your
discard pile after each programming instead of staying).
- **Ways:** ASK on each button (the `upgrades`, `safe-edges`, `less-spam` demos already exist); MAN "Options".

**SET-04 · "What are ∞ 1 2 3?"** · P1 for the leader · H/H
- **When:** setup timer row (2 is preselected).
- **Answer:** Minutes everyone gets to program each round. When time is up, empty slots get random cards. ∞ = no
timer on the phones (the TV shows one only in the last 30 seconds of a 5-minute cap).
- **Ways:** ASK; MAN; the phone needs the stopwatch glyph the TV has (M3).

**SET-05 · "Should first-timers play without upgrades?"** · P2 · M/M
- **When:** setup, a mixed group.
- **Answer:** The rulebook's "lighter game": no shop, no energy, batteries and Power Up do nothing. Simpler first
game; less to learn.
- **Ways:** MAN "Options"; a recommended-for-first-game marker (design decision).

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| SET-06 | "What's on this board?" | course thumbnail | Belts, gears, pits, lasers, batteries; tap to see each. | ASK on the thumbnail |
| SET-07 | "Can we change options later?" | after start | No; the leader can Start over from the ⋯ menu. | MAN (leader) |
| SET-08 | "What's the ⏩ button on the TV?" | any timed phase | Hurry: drops the timer to 15 seconds. | tooltip exists; ASK/MAN for the leader |
| SET-09 | "How do I restart or quit?" | mid-game | Leader's phone ⋯ menu (Start over / Back to lobby), or the TV's corner buttons. | MAN (leader) |

### 6.3 Picking a start pad

**STA-01 · "Which pad should I pick? Does it matter?"** · P2 · H/M
- **When:** start phase, phone shows the Docking Bay and two columns of floor, 40-second timer.
- **Answer:** It matters a little: pick one with an open path toward flag 1, and avoid sitting in a line behind
others (they'll shoot you in the back). Look at the TV to see the course.
- **Ways:** show the whole course with the next flag on the phone's start screen (M11); ASK on a pad; INTRO.

**STA-02 · "Which way will my robot face?"** · P2 · M/M
- **When:** start phase.
- **Answer:** Toward the board (to the right on the TV).
- **Ways:** show the robot's pointer on the picked pad (phone) → at pick.

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| STA-03 | "What if I don't pick?" | timer | You get a free pad when time runs out. | NONE |
| STA-04 | "What are the lightning circles in the dock?" | start screen | Batteries: end a register on one to gain energy. | ASK |
| STA-05 | "Someone took my pad!" | start | First tap wins; pick another. | toast exists |

### 6.4 The Upgrade Phase (the shop)

**UPG-01 · "What is this screen? Do I have to buy something?"** · P1 · H/H
- **When:** the first screen after the start pads, every new player, before any robot has moved; again at the start
of every round, 60-second timer.
- **Answer:** Optional. Energy (⚡) buys upgrades that give your robot powers. Tap ✓ to skip; you can save up.
- **Ways:** CUE-P on the first shop (show a robot on a battery gaining ⚡, ⚡ turning into an upgrade); INTRO; MAN
"Energy and upgrades". Design option: skip the shop in round 1 for first-timers, or a "lighter game" default.

**UPG-02 · "What is ⚡ and how do I get more?"** · P1 · H/M
- **When:** the shop's big number; the top bar while programming.
- **Answer:** Energy. You start with 3, max 10. +1 each time a register ends with your robot on a battery (every
register, not once), +1 for a Power Up card.
- **Ways:** CUE-B the first time anyone gains energy (exists: a bolt pops); ASK on ⚡; MAN.

**UPG-03 · "What's the + tile with ⚡1? Did I just buy an upgrade?"** · P2 · H/M
- **When:** the shop; after tapping "+", a new tile appears and energy drops by 1.
- **Answer:** "+" draws one random upgrade into your collection for 1 ⚡ (once a round). Installing it costs its own
price (the number on the tile). Only installed upgrades work.
- **Ways:** CUE-P on the first draw (the new card flips in, then shows the price to install); ASK; MAN.

**UPG-05 · "Why can't I install this one?"** · P2 · M/M
- **When:** the install button is disabled with no reason.
- **Answer:** Not enough ⚡, or you already installed one this round (one install per round).
- **Ways:** CUE-P (show the missing ⚡ or a "1 per round" mark on the button); ASK.

**UPG-06 · "What's the difference between ∞ and 1× (solid and dashed tiles)?"** · P2 · M/M
- **When:** shop tiles, upgrade sheets.
- **Answer:** ∞ = permanent: always on (up to 3). 1× = one use: spent when you use it (up to 3).
- **Ways:** ASK; MAN; a used-up animation the first time a one-use upgrade is spent.

**UPG-07 · "What does this upgrade do?"** · P2 · H/M
- **When:** shop tiles (name + tiny demo), the sheet (bigger demo + one sentence).
- **Answer:** See section 7 per upgrade.
- **Ways:** the existing demo per upgrade (fix the blank ones, E5); MAN "Upgrades" grid.

**UPG-11 · "Does it work by itself? How do I use it later?"** · P2 · H/M
- **When:** right after installing; again mid-race.
- **Answer:** Most permanent upgrades work by themselves; some ask you on your phone at the right moment (weapons,
Brakes, Power Slide...). One-use upgrades: movement ones are armed during the race; the others are played from
the programming screen or the shop.
- **Ways:** CUE-P right after installing (show where it will appear); MAN; section 7's "how it shows up" column.

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| UPG-04 | "My ⚡ went down but nothing happened" | after "+" | You drew a card into your collection; it isn't installed yet. | CUE-P |
| UPG-08 | "All three slots are full" | install sheet shows swap options | Pick one to replace; the old one is thrown away. | exists (swap glyph); ASK |
| UPG-09 | "Can I remove one? Do I get ⚡ back?" | installed sheet (−) | Yes, during the shop; no refund. | ASK |
| UPG-10 | "Should I save ⚡?" | shop | Some cost 4–5; saving is fine. | MAN (tips) |
| UPG-12 | "Why are we still in the shop?" | waiting | Someone hasn't tapped ✓ (TV shows a shopping bag over them); 60 s max. | CUE-B (exists) |
| UPG-13 | "What upgrades do the others have?" | any time | TV shows only counts (◆ permanent, ◇ one-use). | ASK on a roster token |
| UPG-14 | "Do I lose upgrades when I fall?" | after a fall | No. | MAN |
| UPG-15 | "I have 0 ⚡. Anything to do?" | shop | Just tap ✓. | design: auto-skip |

### 6.5 Programming

**PRG-01 · "What do I do here?"** · P1 · H/H
- **When:** first programming screen: five numbered dashed slots, a map, nine cards, undo / ✓ / power.
- **Answer:** Tap a card to put it in the next slot. Fill all five; slot 1 runs first.
- **Ways:** FILM scene 1 (a phone beside the board with a fingertip, exists, strong) → before; CUE-P (the first card
bobs, exists) → first encounter.

**PRG-02 · "Which robot is me on this map, and which way is it facing?"** · P1 · H/H
- **When:** programming, small map.
- **Answer:** The one with the white outline and glow; the small point marks its front. The map is the TV's view
seen from above (Docking Bay on the left).
- **Ways:** CUE-P (pulse your robot when the map first appears); ASK on the robot.

**PRG-03 · "What's the line of light with numbered dots?"** · P1 · H/M
- **When:** as soon as a card is placed.
- **Answer:** Where your cards would take you if no robot got in the way: dot n = after slot n, the big dot = the
end (its point = your final facing), ✕ = you'd fall, ? = can't know (SPAM, Again in slot 1).
- **Ways:** DO (it's the best teacher in the game); ASK on the line; MAN.

**PRG-05 · "How do I take a card back or change the order?"** · P2 · H/M
- **When:** a slot holds the wrong card.
- **Answer:** Tap the slot: it empties, and the next card you tap goes there. The undo button clears all five.
- **Ways:** CUE-P (wiggle filled slots once); fix the undo glyph's meaning (M2); ASK.

**PRG-07 · "How do I finish? Can I change my mind after?"** · P1 · H/H
- **When:** five slots full; ✓ glows.
- **Answer:** ✓ locks in. Until the race starts, the pencil unlocks it again.
- **Ways:** FILM (fingertip taps ✓, exists); CUE-P (✓ glows, exists).

**PRG-08 · "What happens to the cards I didn't use?"** · P3 · M/L
- **When:** after locking; next round's hand looks different.
- **Answer:** They go to your discard pile (SPAM stays in your hand). Your 20-card deck reshuffles when it runs out.
- **Ways:** MAN "Your deck".

**PRG-09 · "Why do I have so few good cards?"** · P2 · M/M (grows as damage piles up)
- **When:** later rounds, hand full of SPAM.
- **Answer:** SPAM stays in your hand and your hand only refills to 9, so each SPAM is one fewer fresh card. Play
SPAM or shut down to clear it.
- **Ways:** CUE-P when 3+ SPAM are in hand (suggest playing one or shutting down); ASK on the SPAM count.

**PRG-10 · "Why can't I put a card in that slot? What's the violet card?"** · P1 · H/H
- **When:** round 3 for most players; a violet card sits in a slot; tapping it does nothing.
- **Answer:** A Haywire (damage card) landed in that slot when you were hit last round. It runs there this round and
can't move. Fill the other slots around it.
- **Ways:** CUE-P the first time (replay: hit → card slides into that slot face down → "next round"); ASK on the slot;
MAN "Damage".

**PRG-11 · "What will the Haywire do?"** · P2 · H/M
- **When:** a locked Haywire; its face shows a little sequence of glyphs.
- **Answer:** Read its picture left to right (e.g. ↑ ↻ ↑ = Move 1, Rotate Right, Move 1); the light line includes it
(except Spin Out, Double Program and Swap, E3).
- **Ways:** ASK on the card (each Haywire has a demo); light line.

**PRG-12 · "What's the chip with arrows or upgrade names above my hand?"** · P2 · L/M
- **When:** a "Move 2 Sideways" or "Install an Upgrade" Haywire is in play.
- **Answer:** That Haywire's choice: which way to slide (default right) or which upgrade to install free for this
round.
- **Ways:** ASK; CUE-P (pulse the chip once).

**PRG-13 · "Should I play the red '!' card?"** · P2 · H/M
- **When:** SPAM in hand while programming (most players by round 3).
- **Answer:** Playing it removes it for good, but that slot runs a random card from your deck. Keeping it clogs your
hand. Good trick: put it where a random move can't hurt.
- **Ways:** ASK on the card (the `spam` demo exists); MAN.

**PRG-15 · "What's the number in the corner? What happens at zero?"** · P1 · H/H (see TIME-01)

**PRG-17 · "Do I have to plan around the other robots?"** · P2 · M/M
- **When:** after the first plan fails.
- **Answer:** Yes. They move between your cards (in Priority order) and can shove or block you. The light line
ignores them.
- **Ways:** CUE-P at the first mismatch; MAN; a ghost of others' likely positions is not possible (programs are secret).

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| PRG-04 | "Why does the line stop with a '?'" | SPAM / Again in slot 1 | That card becomes a random card; nobody can know. | ASK on "?" |
| PRG-06 | "Can I use fewer than 5?" | trying to lock early | No, all five (a Haywire slot counts as filled). | CUE-P (✓ stays dim; empty slots pulse) |
| PRG-14 | "What does the eye on the map do?" | map corner | Zooms between the whole course and near you. | change glyph (M7) |
| PRG-16 | "Can I see what others are programming?" | TV roster shows filling slots | No, only how many slots they've filled. | MAN |
| PRG-18 | "What's the power button?" | programming | Shutdown (SD-01). | ASK |
| PRG-19 | "What are the 4 arrows on my map?" | rebooting | Your facing when you come back (RBT-04). | CUE-P |
| PRG-20 | "Is the phone map the same way round as the TV?" | programming | Yes: Docking Bay on the left. | NONE |
| PRG-21 | "What's the card with an eye?" | SPAM Filter | The top card of your deck: your next draw. | ASK |
| PRG-22 | "What are the bookmarks on my cards?" | Memory Cards | Keep that card for next round. | ASK |
| PRG-23 | "Why must I pick 3 cards?" | after Memory Swap | Put 3 cards back on top of your deck (first = top). | CUE-P |
| PRG-24 | "Why won't ✓ work?" | lock dim | A slot is empty, a rewired Haywire isn't placed, or Memory Swap cards aren't returned. | CUE-P (shake what's missing) |
| PRG-25 | "What's left in my deck?" | veteran | 20 cards: Move 1 ×4, Move 2 ×3, Move 3 ×1, Rotate Right ×4, Rotate Left ×4, U-Turn, Move Back, Power Up, Again ×1 each, plus any SPAM. | MAN; show deck/discard counts (M15) |
| PRG-26 | "Why did it start before I was done?" | race starts | Everyone else locked in and your phone was away, or time ran out. | CUE-P on return (TIME-06) |

### 6.6 The programming cards

**CRD-02 · "Rotate left: whose left? Does it move me?"** · P1 · H/H
- **When:** every programming; worst when the robot faces down or left on screen.
- **Answer:** The robot's own left. It turns a quarter in place and doesn't move.
- **Ways:** light line (exists); ASK on the card shows the robot from its own view and from the TV's view; FILM should
include a robot facing the camera.

**CRD-04 · "Move Back: do I turn around?"** · P2 · M/M
- **Answer:** No. You back up one space still facing the same way.
- **Ways:** ASK on the card; the card glyph (down chevron with a dotted tail) is ambiguous.

**CRD-05 · "What does the ⚡ card do?"** · P2 · M/L
- **Answer:** Power Up: +1 energy. Your robot doesn't move. (Does nothing in a game without upgrades.)
- **Ways:** ASK; CUE-B (a bolt pops, exists).

**CRD-06 · "What does the circle-arrow card do?"** · P1 · H/M
- **When:** in hand from round 1 (one copy in every deck).
- **Answer:** Again: repeats whatever your previous slot did (a move, a turn, even a Haywire). In slot 1 there is no
previous slot, so it is thrown away and replaced by a random card from your deck.
- **Ways:** ASK on the card; the light line shows the repeat (exists) and a "?" in slot 1 (exists); MAN.

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| CRD-01 | "Move 3 into a robot?" | programming | You push it along; you only stop at walls. | ASK; FILM scene 3 |
| CRD-03 | "U-Turn?" | programming | Turn around in place. | ASK |
| CRD-07 | "Red '!' card?" | hand | SPAM (DMG-03). | ASK |
| CRD-08 | "Violet card?" | slot or hand | Haywire (DMG-09). | ASK |
| CRD-09 | "Why two of the same card?" | hand | Decks have several copies. | NONE |
| CRD-10 | "Which card is the best?" | programming | Whatever gets you to the flag; Move 3 and Again are rare. | NONE |

### 6.7 Activation: order, registers, Priority

**ACT-01 · "Which robot on the TV is mine?"** · P1 · H/H
- **When:** the first register; names hide under the floating cards (M8).
- **Answer:** Your color and shape (top-left of your phone). Your name and current card are in the row at the bottom.
- **Ways:** CUE-B (each robot lights up with its name as the race starts); CUE-P (your phone shows your robot
glowing in your color during the race, exists in the top bar).

**ACT-02 · "Why didn't I end up where my line said?"** · P1 · H/H
- **When:** after the first register that went differently.
- **Answer:** Another robot moved before you and pushed or blocked you, the board moved you, a laser's damage changed a
card, or your card was swapped (SPAM, Scrambler). The line only knows the board, not robots.
- **Ways:** DO: "what just happened to me" replay on the phone (needs M16's data); CUE-P at the first mismatch; MAN.

**ORD-01 · "Is it my turn? Do I do anything now?"** · P1 · H/M
- **When:** the race starts; the phone dims to five cards and an eye.
- **Answer:** No. Watch the TV; your robot runs your cards by itself. Your phone lights the slot that's running.
- **Ways:** FILM (the phone beside the board lights each slot, exists); CUE-P (the eye already says "look up").

**ORD-02 · "What are the 1–5 circles at the top of the TV?"** · P2 · M/L
- **Answer:** The five slots ("registers"). The lit one is running now for everyone.
- **Ways:** CUE-B (link the TV number to the lit slot on each phone); MAN.

**ORD-03 · "Why does everyone do slot 1 before my slot 2?"** · P1 · H/M
- **Answer:** Slots run one at a time for everyone: all robots do slot 1, the board acts, then all do slot 2.
- **Ways:** FILM scene 3 (three robots, but nothing marks the rhythm) → before; INTRO; CUE-B (register divider).

**ORD-04 · "Who goes first? Why did Bolt move before me?"** · P1 · H/M
- **When:** every register; matters most in pushing races.
- **Answer:** The Priority holder goes first in every slot, then the others in join order. Priority moves one player
along each round. (A tiny dot over the holder on the TV roster, M4.)
- **Ways:** CUE-B (show the order: a numbered or flowing light along the roster each register); ASK on the roster;
MAN; INTRO.

**ORD-05 · "When does the board move?"** · P2 · M/M (P4 for the exact order)
- **Answer:** After every robot has played its card for that slot. Order: blue belts, green belts, push panels,
gears, wall lasers, robot lasers, then batteries and flags.
- **Ways:** FILM scene 2 (partly); MAN (a looping strip of the seven steps); CUE-B (the board's steps are already
animated one by one; a small step indicator would make the order visible).

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| ORD-06 | "Why did I move twice in one slot?" | belt after card | Card, then the board. | "what happened" |
| ORD-07 | "What are the cards floating over robots?" | each reveal | Everyone's card for this slot, shown together. | NONE (clear) |
| ORD-08 | "Why is that robot pulsing / why the pause?" | prompt | That player is choosing something on their phone (12 s). | CUE-B (exists: pulse) |
| ORD-09 | "Can I change my plan now?" | race | No; programs are locked once the race starts. | MAN |
| ORD-10 | "What's my next card?" | race | Your phone: the lit slot is now, the faded ones are done. | NONE (exists) |

### 6.8 Moving: facing, walls, pits, edges, pushing

**MOV-01 · "Which way is my robot facing on the TV?"** · P1 · H/M
- **Answer:** The small light point in front of it (and the shape's nose).
- **Ways:** CUE-B (a brief arrow of light in front of each robot at reveal); ASK.

**MOV-02 · "Rotate Left: my left or the robot's?"** · P1 · H/H — see CRD-02.

**MOV-03 · "Why did my robot stop short?"** · P2 · M/M
- **When:** a Move 2/3 ends early; the TV shows a small bump.
- **Answer:** A wall (bright fins of light), or it pushed a robot that was against a wall: both stop, the rest of the
move is lost.
- **Ways:** CUE-B (the bump exists; flash the wall); ASK on a wall; MAN.

**MOV-05 · "Can I push other robots? Can they push me off?"** · P1 · H/H
- **When:** round 2 for most (64–91% get pushed by round 2–3).
- **Answer:** Yes. Moving into a robot shoves it (and any robots behind it) along with you, without turning them. You
can shove robots into pits or off the edge, and they can do it to you. Walls stop the whole line.
- **Ways:** FILM scene 3 (shows a shove off the edge, exists); MAN; CUE-B (the in-progress "shove" moment).

**MOV-09 · "What happens at the edge of the board?"** · P1 · M/H
- **Answer:** Driving or being pushed off the edge is like falling into a pit: you reboot (RBT-01). (Not with safe
edges.)
- **Ways:** FILM (scene 3 shows a fall off the edge); MAN; CUE-B the first time.

**MOV-10 · "What are the black squares?"** · P1 · M/H
- **Answer:** Pits. Enter one and you fall (RBT-01), even in the middle of a move.
- **Ways:** FILM scene 2 (exists); ASK; the light line's ✕ (exists).

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| MOV-04 | "Does hitting a wall hurt?" | bump | No (except the Move 5 Haywire). | MAN |
| MOV-06 | "Can I push someone into a pit?" | planning | Yes. | MAN |
| MOV-07 | "Why couldn't I push them?" | blocked | A wall behind them; you both stop. | ASK |
| MOV-08 | "I got pushed. Did I lose my move?" | race | No; your card still runs from wherever you are. | MAN |
| MOV-11 | "Can I jump a pit?" | planning | No (unless Hover Unit). | ASK |
| MOV-13 | "Do walls block lasers?" | planning | Yes. | ASK on wall |
| MOV-14 | "Can two robots share a square?" | always | Never; one gets pushed or stops. | MAN |
| MOV-15 | "What are the white bars/fins?" | board | Walls. | ASK |
| MOV-16 | "Can I cross from the dock onto the board?" | start | Yes; only drawn walls block. | NONE |
| MOV-17 | "Why did I go backwards?" | race | Move Back, a push, a Haywire, or a belt. | "what happened" |

### 6.9 Board elements

**BRD-01 · "Why did my robot move or turn by itself?"** · P1 · H/H
- **When:** right after the cards in a slot; the TV pulses the belts or kicks a gear.
- **Answer:** The board acts after every slot: belts carry you, push panels shove you, gears turn you.
- **Ways:** FILM scene 2 (a green belt and a gear, exists); "what just happened" on the phone; ASK on the element.

**BRD-03 · "Blue belt vs green belt?"** · P2 · H on belt courses / M
- **Answer:** Green carries you 1 space each slot; blue carries 2. Blue onto green rides both; green onto blue only 1.
- **Ways:** FILM (add a blue belt); ASK; MAN (the `belts` demo exists: blue then green).

**BRD-04 · "Why did the belt turn me?" / "Why didn't it turn me?"** · P2 · M/M
- **Answer:** A curved belt turns you only when the belt itself carries you round the curve. Driving onto a curve with
your own card doesn't turn you.
- **Ways:** ASK on a curve; MAN; CUE-B.

**BRD-06 · "Why didn't the belt carry me?"** · P3 · L/M
- **Answer:** A robot was in the way at the end (belts never push), or two robots tried to enter the same space (neither
moves), or you weren't on the belt when it ran.
- **Ways:** ASK; MAN.

**BRD-10 · "What's the grey plate with dots on the wall?"** · P2 · M on push-panel courses / M
- **Answer:** A push panel. It shoves the robot in front of it one space, but only in the slots whose dots are lit
(e.g. 2 and 4).
- **Ways:** ASK; MAN; CUE-B the first time it fires (exists: the plate kicks).

**BRD-12 · "What do the gear colors mean?"** · P2 · M/M
- **Answer:** Green gear turns you right (clockwise); pink/red turns you left. Once per slot, if you're on it.
- **Ways:** FILM scene 2 (one gear, exists); ASK.

**BRD-13 · "What's the red dotted line?"** · P1 · H/M
- **Answer:** A wall laser's beam. After each slot, it hits the first robot standing in it (1 damage per beam; two
lenses = 2).
- **Ways:** FILM scene 2 (exists); ASK; MAN.

**BRD-14 · "I drove through the laser and nothing happened"** · P3 · M/L
- **Answer:** It only hits robots standing in it when it fires, after the cards.
- **Ways:** MAN.

**BRD-16 · "What's the lightning circle?"** · P2 · H/M
- **Answer:** A battery. End a slot on it: +1 energy. Every slot you stay there, +1 again.
- **Ways:** CUE-B (bolt pops, exists); ASK; MAN.

**BRD-17 · "What's the blue ring with the curved arrow?"** · P2 · M/M
- **Answer:** The reboot spot: robots that fall on this board come back here next round. Its small pointer is the
way it shoves a robot that's standing on it.
- **Ways:** ASK; CUE-B at the first reboot (exists: a pillar of light).

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| BRD-02 | "Green belts?" | board | Carry 1 space per slot, along the arrows. | ASK |
| BRD-05 | "I drove onto the curve and didn't turn" | race | Only the belt's own carrying turns you. | ASK |
| BRD-07 | "Does a belt push robots?" | race | Never. | MAN |
| BRD-08 | "Blue then green?" | belt junctions | Blue onto green rides both that slot. | MAN |
| BRD-09 | "Can a belt drop me in a pit?" | planning | Yes, if it leads there. | ASK |
| BRD-11 | "The panel didn't push me this time" | race | Not one of its slots. | ASK on dots |
| BRD-15 | "Why did the laser hit him, not me?" | race | It stops at the first robot. | MAN |
| BRD-18 | "What are the columns of light?" | board | The flags, numbered; rings at the foot = who has it. | ASK |
| BRD-19 | "Do belts/gears under a flag work?" | veteran | No (none on these courses). | MAN |
| BRD-20 | "Is the Docking Bay safe?" | start | It has walls, edges and two batteries like any board. | ASK |
| BRD-21 | "In what order does the board move?" | veteran | Blue belts, green belts, push panels, gears, wall lasers, robot lasers, batteries, flags. | MAN |

### 6.10 Lasers and weapons

**LAS-01 · "Who shot me? When do lasers fire?"** · P1 · H/H
- **When:** round 1–2 (93–100% of robots are hit by a robot laser by round 2).
- **Answer:** After the cards, every slot. Wall lasers hit the first robot in their red line. Every robot fires
straight ahead and hits the first robot in line (walls block). The beam is the shooter's color.
- **Ways:** FILM (add a robot shooting another); CUE-B (exists: beam + shards; add who-hit-whom clarity); ASK; MAN.

**LAS-02 · "Do I have a laser? How do I aim?"** · P1 · H/M
- **Answer:** Yes, built in. It fires by itself straight ahead every slot; you aim by facing. You can't hold fire. You
only see it when it hits someone.
- **Ways:** INTRO; MAN; CUE-B the first time you hit someone.

**LAS-05 · "I got shot from behind!"** · P2 · M/M
- **Answer:** A robot behind you was facing your back. Lines of robots facing the same way shoot each other.
- **Ways:** "what just happened"; MAN.

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| LAS-03 | "Why did I shoot my friend?" | race | It's automatic. | MAN |
| LAS-04 | "Through robots or walls?" | race | No; first robot only (Rail Gun goes through). | MAN |
| LAS-06 | "What does a hit do?" | race | 1 damage card (DMG-02). | CUE-P |
| LAS-07 | "My phone asks 'main laser or Pressor Beam'" | race | A weapon upgrade's choice (DEC-03). | ASK |
| LAS-08 | "A shield flashed and my ⚡ dropped" | race | Deflector Shield paid 1 ⚡ to block it (automatic, D2). | CUE-P |

### 6.11 Damage: SPAM and Haywire

**DMG-01 · "How much health do I have? Can my robot die?"** · P1 · H/H
- **When:** the first hit (round 1–2 for nearly everyone).
- **Answer:** No health and no dying. Damage is junk cards that mess up your future programs.
- **Ways:** INTRO (essential: it overturns a default assumption from every other game); CUE-B/CUE-P at the first
damage (the junk card flies from the robot to that player's phone); MAN.

**DMG-02 · "What did I just get?"** · P1 · H/H
- **When:** after the shards (coral = SPAM, violet = Haywire; no count, no explanation).
- **Answer:** SPAM (coral) goes into your discard pile and will show up in a later hand. Haywire (violet) hides in
the slot you were in when hit, and runs there next round.
- **Ways:** CUE-P (needs damage data on the phone, M16); CUE-B; MAN "Damage".

**DMG-03 · "What's the red '!' card in my hand?"** · P1 · H/H
- **When:** programming, round 2–3.
- **Answer:** SPAM: junk from being hit. See PRG-13 for what playing it does.
- **Ways:** CUE-P first time; ASK on the card.

**DMG-04 · "What happens when SPAM runs?"** · P2 · H/M
- **When:** the TV shows a coral card over a robot, a glitch, then a different card.
- **Answer:** It's thrown away for good and the top card of your deck runs instead. If that's SPAM too, again.
- **Ways:** CUE-B (exists: SPAM → card with a glitch); the `spam` demo; ASK.

**DMG-05 · "Why didn't the SPAM go away with my other cards?"** · P2 · M/M
- **Answer:** SPAM stays in your hand until you play it or shut down (unless "less SPAM" is on).
- **Ways:** CUE-P at the end of programming the first time (unused cards fly to the discard, SPAM stays); MAN.

**DMG-06 · "What's the number next to the '!' at the top?"** · P2 · H/L
- **Answer (today):** how many SPAM you own in total (deck + discard + hand). Players will read it as "in hand" (M6).
- **Ways:** ASK; design: show hand vs total distinctly.

**DMG-07 · "How do I get rid of damage?"** · P2 · M/M
- **Answer:** Play SPAM (it leaves for good), shut down (clears damage in your hand, slots and discard pile), or
upgrades (Calibration Protocol, Self-Diagnostics, Rewire for Haywires). Rebooting clears your slots and hand but
adds 2 damage.
- **Ways:** MAN; ASK on SPAM.

**DMG-08 · "Why did my card change into a different one?"** · P1 · H/H
- **When:** reveal: the TV shows card A, a glitch, then card B over the robot.
- **Answer:** That slot's card was replaced by the top card of your deck: you played SPAM, an Again in slot 1, an
opponent's Scrambler hit you last slot, or your own Abort Switch / Lucky Booster.
- **Ways:** CUE-B (exists); "what just happened" with the cause; MAN.

**DMG-09 · "What is a Haywire? Where did this violet card come from?"** · P1 · H/H
- **When:** round 3 programming, a locked slot.
- **Answer:** The wild kind of damage. It landed face down in the slot you were in when you were hit and runs there
this round, then goes away. Others can't see what it is.
- **Ways:** CUE-P (replay the hit → slot); ASK; MAN.

**DMG-10 · "Can I move the Haywire?"** · P2 · M/M
- **Answer:** No (except with the Rewire upgrade). Plan the other slots around it.

**DMG-11 · "When does the Haywire go away?"** · P2 · M/L
- **Answer:** After it runs this round.

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| DMG-12 | "Hit twice, only one Haywire?" | race | Only one Haywire per slot; extra ones are thrown away (no damage). | MAN |
| DMG-13 | "Is a Haywire bad?" | programming | Wild; some are great (Move 5, Laser Storm). | ASK |
| DMG-14 | "I got hit but no damage" | race | Shield, or the damage pile ran out (rare). | MAN |
| DMG-15 | "Does being pushed hurt?" | race | No (unless Ramming Gear, Spiky, Piercing Drill). | MAN |
| DMG-16 | "Can others see my damage?" | always | No. The TV shows a face-down card in a Haywire slot. | MAN |
| DMG-17 | "Why am I hit more than others?" | mid-game | You're in their line of fire; turn or move out of rows. | MAN tips |
| DMG-18 | "Why does a Haywire appear where I fell?" | after a reboot | Reboot damage that is a Haywire sits in the slot where you fell. | CUE-P |

### 6.12 Falling and rebooting

**RBT-01 · "Where did my robot go? Am I out?"** · P1 · H/H
- **When:** the robot drops into a pit or off the edge; the phone shows only a reboot glyph.
- **Answer:** Not out. It comes back at the start of next round, on this board's blue reboot ring (the Docking Bay:
your start pad). Falling costs you the rest of this round and 2 damage.
- **Ways:** CUE-P at once (show where and when you'll return); CUE-B (exists: fall + later pillar); FILM scene 2
(exists).

**RBT-02 · "Why didn't the rest of my cards run?"** · P2 · H/M
- **Answer:** Falling cancels the rest of your program this round.
- **Ways:** CUE-P (the remaining slots crumble); MAN.

**RBT-03 · "Where and when will I come back?"** · P2 · H/M
- **Answer:** On the reboot ring of the board where you fell, in slot 1 of next round when your Priority turn
comes, then your slot-1 card runs.
- **Ways:** the phone map already starts the light line at the reboot spot; CUE-P; MAN.

**RBT-04 · "What are these four arrows on my map?"** · P1 · H/M
- **Answer:** Pick which way you'll face when you come back.
- **Ways:** CUE-P (the ghost robot turns with each tap; pulse the arrows once); ASK.

**RBT-05 · "Do I lose my flags, upgrades or energy?"** · P2 · M/M
- **Answer:** No. Only 2 damage (none for a pit with Firewall).

**RBT-07 · "Someone is standing on the reboot ring"** · P4 · L/L
- **Answer:** They're shoved one space along the ring's small pointer (another way if blocked; D1).

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| RBT-06 | "Why did falling give me damage?" | after fall | Rebooting costs 2 damage cards. | CUE-P |
| RBT-08 | "My phone only shows a reboot symbol" | rest of round | Wait; you program again next round. | CUE-P |
| RBT-09 | "Does falling off the dock count?" | dock edge | Yes; you come back on your start pad. | MAN |

### 6.13 Shutdown

**SD-01 · "What does the power button do?"** · P1 · H/M (accidental taps by kids)
- **When:** programming, bottom right, beside ✓.
- **Answer:** Shut down: your robot sits out this round and all the damage in your hand, slots and discard pile is
thrown away. Next round you're back to normal.
- **Ways:** the existing sheet demo; ASK; CUE-P suggestion when your hand is clogged (e.g. 3+ SPAM).

**SD-03 · "Am I safe while shut down?"** · P2 · M/M
- **Answer:** No. You can still be pushed, carried by belts, shot and fall. You don't fire, gain energy or take flags.
- **Ways:** the sheet demo (shows a laser hitting the dim robot, exists); MAN.

**SD-04 · "I shut down, why do I still have SPAM?"** · P3 · M/L
- **Answer:** SPAM already shuffled into your deck stays; only hand, slots and discard are cleared.

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| SD-02 | "When should I shut down?" | damage piles up | When your hand is mostly junk; best on a belt heading your way. | MAN tips |
| SD-05 | "Undo a shutdown?" | before the race | Tap the power-glyph lock to unlock. | ASK |
| SD-06 | "Why is that robot doing nothing?" | race | It's shut down (power icon on the roster; M9). | CUE-B |
| SD-07 | "How long?" | after | This round only. | MAN |

### 6.14 Energy

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| EN-01 | "What's energy for?" | shop | Buying and installing upgrades; some upgrades spend it. | INTRO, MAN |
| EN-02 | "How do I get it?" | shop | Batteries (every slot you end on one), Power Up, Recharge, Power Surge, Chaos Theory. | MAN |
| EN-03 | "Max?" | 10 | 10. | MAN |
| EN-04 | "Where's my energy?" | race | Phone top bar while programming; the shop; the TV roster. Not on the phone during the race. | MAN |
| EN-05 | "Why did my ⚡ drop in the race?" | race | Deflector Shield or Mini Howitzer paid for itself. | CUE-P |
| EN-06 | "The battery gave me nothing" | race | Upgrades off, shut down, or already at 10. | ASK |

### 6.15 Checkpoints and winning

**CP-01 · "Where do I go? Which flag is next?"** · P1 · H/H
- **Answer:** The flags are numbered columns of light; take them in order. Your phone map fills your next one.
- **Ways:** INTRO; CUE-P after each flag (the next one pulses); ASK.

**CP-02 · "I drove over the flag. Why didn't it count?"** · P1 · M/H
- **Answer:** You must be on it when a slot ends (after the board moves). Passing through doesn't count.
- **Ways:** CUE-B/CUE-P on the near-miss; ASK; MAN.

**CP-03 · "I'm on flag 2. Why nothing?"** · P2 · M/H
- **Answer:** You need flag 1 first.
- **Ways:** CUE-P; ASK.

**CP-07 · "We both reached the last flag in the same slot. Who wins?"** · P4 · L/M
- **Answer:** The one earlier in Priority order that round.

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| CP-04 | "Which flags do I have?" | always | Dashes on your phone's top bar and the TV roster; your color in a ring at the foot of each flag (M5). | ASK |
| CP-05 | "Pushed or carried onto the flag: does it count?" | race | Yes, if you're on it at the end of the slot. | MAN |
| CP-06 | "What happens when someone gets the last flag?" | win | The race ends at once. | CUE-B (exists) |
| CP-08 | "Do flags block me or lasers?" | planning | No. | MAN |
| CP-09 | "Shut down on a flag?" | race | Doesn't count while shut down. | MAN |

### 6.16 Decisions during the race

**DEC-01 · "My phone buzzed with buttons. What is this?"** · P2 · M/H
- **When:** an upgrade asks (Brakes, weapon choice, Power Slide, Drifting, Energy Conversion, Magnetic, Piercing
Drill, Modular Chassis, Self-Diagnostics, the upgrade window); 12-second timer; the TV pulses that robot.
- **Answer:** One of your upgrades is asking. Tap a choice; if you don't, the safe choice happens (main laser, run my
card, no).
- **Ways:** the sheet demo (exists for icon prompts); show `sub` hints (M1); MAN per upgrade.

**DEC-03 · "Main laser, Pressor Beam or Scrambler?"** · P2 · M/M
- **Answer:** Your weapon upgrades: you may use one of them instead of your normal laser on the robot in your sights.
Pressor shoves it away, Tractor pulls it in, Scrambler swaps its next card, Mini Howitzer (1 ⚡) deals 2 and shoves,
Displacing Blast (one use) sends it to its reboot ring.
- **Ways:** show the hints (M1); tiny demos per option; ASK.

**DEC-05 · "How do I use Boink/Zoop/Overclocked/Switch... in the race?"** · P1 for owners · M/H
- **When:** after installing a one-use movement upgrade.
- **Answer:** During the race, tap the bar with its name on your phone (it lights). At your next turn your phone asks
before your card: use it, "after my card…", or skip.
- **Ways:** CUE-P right after installing; CUE-P when the race starts; MAN.

**DEC-06 · "I armed it but it didn't ask me again"** · P3 · M/M
- **Answer:** Arming is spent once you answer (choosing "run my card" disarms it). Arm again for a later turn.
- **Ways:** keep the arm state visible; MAN.

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| DEC-02 | "What if I don't answer?" | prompt | The safe default happens after 12 s. | the timer number (exists) |
| DEC-04 | "Why is it asking about my Move 1 / to slide forward?" | Brakes / Power Slide / Drifting | Your permanent upgrade's choice. | CUE-P (M10) |
| DEC-07 | "Why is everyone looking at me?" | prompt | Your phone has a choice; the race waits up to 12 s. | CUE-P buzz (exists) |
| DEC-08 | "Who are we waiting for?" | others' prompt | The pulsing robot; phones show its robot with thinking dots. | exists |

### 6.17 Timers, waiting, connection

**TIME-01 · "What happens if the timer runs out?"** · P1 · H/H
- **When:** programming, default 2 minutes (seconds count on the phone; a shrinking line on the TV with ticks in the
last 5 seconds).
- **Answer:** Every empty slot gets a random card from your hand. Cards you placed stay.
- **Ways:** INTRO; CUE-P/CUE-B in the last 10 seconds (empty slots shimmer like dice); MAN.

**WAIT-01 · "Is it my turn? Why are we waiting?"** · P1 · H/M
- **Answer:** Everyone plans at once. On the TV, dim robots haven't locked in; a robot with a pulsing ring is choosing.
- **Ways:** CUE-B (exists but faint); INTRO.

**TIME-06 · "My phone slept. What happened to my robot?"** · P2 · M/H (for that person)
- **Answer:** If everyone else locked in, your robot got random cards (keeping any you'd placed); choices were made for
you. Reopen the same tab to get your robot back.
- **Ways:** CUE-P on reconnect ("while you were away" replay); keep-awake hint at join (M14).

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| TIME-02 | "Shop timer?" | shop | 60 s, then programming starts. | NONE |
| TIME-03 | "Start-pad timer?" | start | 40 s, then a free pad. | NONE |
| TIME-04 | "Choice timer?" | prompt | 12 s, then the safe default. | exists |
| TIME-05 | "Why did it start before I was done?" | race | Time ran out, or the others locked in while your phone was away. | CUE-P |
| TIME-07 | "The timer suddenly dropped to 15" | any | The leader pressed Hurry. | CUE-B |
| TIME-09 | "Can I leave and come back?" | any | Yes, same phone and tab. | MAN |

### 6.18 Options (variants)

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| OPT-01 | "No upgrades: what changes?" | setup | No shop, no energy; batteries and Power Up do nothing. | ASK (demo `upgrades`) |
| OPT-02 | "Safe edges?" | setup | The outer edge is a wall; pits still swallow. | ASK (demo `safe-edges`) |
| OPT-03 | "Less SPAM?" | setup | SPAM in your hand goes to your discard after each programming; you still draw it. | ASK (demo `less-spam`) |
| OPT-04 | "Which timer for beginners?" | setup | Longer (3) or ∞ means fewer random cards. | MAN |

### 6.19 After the race

| ID | Question | When | Answer | Ways |
|---|---|---|---|---|
| END-01 | "Who won? How close was I?" | over | The TV shows the winner; your phone shows your flags. | exists |
| END-02 | "Play again?" | over | The leader's ⌂ returns everyone to the lobby (or it does so after 90 s). | exists |
| END-03 | "Who pushed/shot the most?" | over | The engine tracks pushes, hits, falls and damage, but nothing shows them. | design option |

---

## 7. All 40 upgrades

"Shows up" = how this app surfaces it. "Demo" = the current animation's quality (✓ good, ~ weak, ✗ blank or
wrong). Questions are in the owner's words.

### Permanent (24)

| Upgrade (cost) | What it does | Shows up | Natural questions | Notes / demo |
|---|---|---|---|---|
| Brakes (2) | A revealed Move 1 may be Move 0. | Prompt every time your Move 1 runs. | "Why is my phone asking about Move 1?" "Does it stop an Again?" (no) | Demo ✗ (a card, then nothing: the 🛑 is dropped) |
| Chaos Theory (2) | SPAM revealed in slots 1–3: +1 ⚡. | Automatic. | "Why did I gain energy?" | ✓ |
| Crab Legs (5) | Stack a Move 1 on a Rotate in one slot: step sideways without turning. | A "+" badge on a slot holding a Rotate while programming. | "How do I use it?" "Where's the +?" | Hidden affordance; ✓ demo |
| Deflector Shield (2) | Pay 1 ⚡: no laser/weapon damage this slot. | Automatic by default (D2); "auto" switch in its sheet. | "Why did my ⚡ drop?" "Can I turn it off?" | ✓ |
| Double-Barrel Laser (2) | Your main laser deals +1. | Automatic. | "Does it work on the rear laser?" (no) | ✓ |
| Drifting (4) | After a Rotate Left card, may move 1 forward. | Prompt after the card. | "Why is it asking to slide?" | ✓ (doesn't show it's optional) |
| Energy Conversion (3) | After a wall laser hits you, may move 1 forward or back. | Prompt. | "Does it work on robot lasers?" (no) | ✓ |
| Firewall (1) | No reboot damage after a **pit**. | Automatic. | "Why did I still take damage off the edge?" | ✓ (shows "0 SPAM") |
| Flash Drive (4) | Hand of 10. | Automatic. | "Why do I have 10 cards?" | ~ |
| Hover Unit (1) | Your own cards carry you over pits; stop on one and you fall. | Automatic. | "Can I hover on a belt/push?" (no) | ✓ demo; the light line wrongly shows a fall (E4) |
| Laser Kata (1) | After a U-Turn, your main laser fires all 4 ways that slot. | Automatic. | "Does Zoop count?" (no) "Does the Haywire U-Turn?" (yes) | ✓ |
| Memory Cards (3) | Keep unused non-damage cards for next round. | Bookmark buttons on hand cards once 5 slots are full. | "What's the bookmark?" | Demo ~ |
| Mini Howitzer (3) | Instead of the main laser, pay 1 ⚡: 2 damage + shove 1. | Weapon prompt each slot with a target. | "Why does it ask every slot?" | ✓; prompt shows name only (M1) |
| Modular Chassis (1) | After your card pushes a robot, may give this and take one of their upgrades. | Prompt after a push. | "What did I just trade?" | Demo ~ |
| Power Slide (4) | After a Rotate Right card, may move 1 forward. | Prompt. | as Drifting | ✓ |
| Pressor Beam (3) | Instead of the main laser: shove the target 1 away. | Weapon prompt. | "Can I push them into a pit?" (yes) | ✓ |
| Rail Gun (2) | Main laser goes through walls and robots, hitting all in line. | Automatic. | "Did I just hit three people?" | ✓ |
| Ramming Gear (2) | When your card pushes (or tries to), the pushed robot takes 1. | Automatic. | "Why did they take damage when I bumped them?" | ✓ |
| Rear Laser (2) | Also fire backward (1 damage). | Automatic. | "Does it get Double-Barrel?" (no) | ✓ |
| Scrambler (4) | Instead of the main laser: replace the target's next card with the top of their deck. Not in slot 5. | Weapon prompt. | Victim: "Why did my card change?" (DMG-08) | ✓; victim gets no explanation |
| Self-Diagnostics (2) | At each new flag, may remove a card in your hand or discard pile from the game. | Prompt at the flag. | "Which card should I delete?" (SPAM) | ✓ |
| SPAM Filter (3) | See the top card of your deck after drawing. | An eye + card chip while programming. | "What's the card with the eye?" | Demo ~ (one card back) |
| Spiky (2) | A robot that moves or is pushed into your space takes 1. | Automatic. | "Why did they get hurt touching me?" | Demo ✗ teaches the wrong rule (E1) |
| Tractor Beam (3) | Instead of the main laser: pull the target 1 closer (not adjacent). | Weapon prompt. | "Why isn't it offered?" (target adjacent) | ✓ |

### One-use (16)

| Upgrade (cost) | What it does | Shows up | Natural questions | Notes / demo |
|---|---|---|---|---|
| Abort Switch (1) | Replace the card you just revealed with the top of your deck. | Arm in the race → before your card. | "How do I use it?" "Can I see the new card first?" | ~ (the ⏏ is dropped) |
| All Aboard (1) | Run every belt for your robot only (blue, then green). | Arm → before/after your card. | "What's 'All Aboard'?" (name only in the prompt) | ~ (🚂 dropped) |
| Boink (1) | Hop to an empty adjacent space without turning. | Arm → direction choices. | "Which way is 'hop left'?" | ✓ |
| Calibration Protocol (2) | Return the damage in your hand; draw that many. | Chip on the programming screen (or the shop). | "When should I use it?" | ✓ |
| Displacing Blast (2) | Instead of the main laser: send the target to its reboot ring. | Weapon prompt; one use. | "Did it get used up?" | ✓ |
| Lucky Booster (1) | Flip damage cards until a Haywire; may run it instead of your card. | Arm → before your card → second prompt. | "What did I find?" | ~ (🍀 dropped) |
| Magnetic (1) | When a robot next to you moves with a card, you may move with it. | Prompt when it happens. | "Why does it ask to follow Bolt?" | ✓ |
| Memory Swap (2) | Draw 3, then put 3 cards from your hand on top of your deck. | Chip on programming screen → pick-3 screen. | "Why must I choose 3? In what order?" | Demo ~ |
| Overclocked (2) | Move 2. | Arm → before/after your card. | "Forward 2 on top of my card?" (yes) | ~ (🚀 dropped) |
| Piercing Drill (1) | When your card pushes a robot: 1 damage, and turn it any way. | Prompt after the push. | "Which direction is 'Face north'?" | ✓ |
| Pressure Release (2) | Back up to 5, stopping before you'd push a robot (and at walls, pits). | Arm. | "Back where?" | ✓ |
| Re-Initialize (1) | Give the Priority token to anyone (or keep it). | Chip on programming screen → pick a robot. | "What's Priority?" "Did it work?" (the dot moves) | Demo ✗ blank (E5) |
| Recharge (0) | +3 ⚡. | Chip on programming screen or the shop. | "Free?" (yes) | ✓ |
| Rewire (1) | Shop only: take your face-down Haywires into your hand; program them all this round, any slot. | Play from its sheet in the shop. | "Where did they go?" "Why must I use them?" | Demo ✗ misleading (shows ⚡) |
| Switch (2) | Swap places with an adjacent robot, no turning. | Arm → pick a robot. | "Can I swap onto a flag?" (yes) | ✓ |
| Zoop (1) | Turn to face any direction. | Arm → face choices. | "Does a Zoop U-turn trigger Laser Kata?" (no) | ✓ |

Cross-cutting upgrade questions:

- **"What upgrades do I have right now?"** Only visible in the shop (M10).
- **"Is a one-use upgrade gone after I use it?"** Yes, back to the upgrade pile.
- **"Card vs maneuver"** (veterans): Power Slide/Drifting trigger on the Rotate *card* only, not Again or a
  Haywire's rotate; Laser Kata triggers on any U-Turn maneuver except "face any way". The engine follows this.
- **"Only one weapon instead of my laser"**: yes, one per slot.

---

## 8. All 17 Haywire cards

The card face is a little row of glyphs (`glyphs.js haywireParts`). Five come from the rulebook; twelve are
original. A Haywire is hidden from others, locked in the slot where you were hit, and runs next round.

| Card | What it does | Face | Natural questions | Light line / demo |
|---|---|---|---|---|
| H01 Move 1, Rotate Right, Move 1 | as named | ↑ ↻ ↑ | "Three moves on one card?" | ✓ / ✓ |
| H02 Move 2 Sideways | slide 2 left or right, facing unchanged | ⇆ + a left/right chip | "Which way? Do I turn?" | ✓ / always slides right |
| H03 Move 3, U-Turn | | ↑↑↑ ⟲ | "Does it trigger Laser Kata?" (yes) | ✓ / ✓ |
| H04 Move 5 | hitting a wall costs 1 damage | ↑ ×5 | "Why did I take damage?" | ✓ / ✓ |
| H05 Install an Upgrade | install a permanent upgrade from your collection free (even past 3) for this round | + and a chip of upgrade names | "Which one? Is it mine to keep?" (no) "I have none" (nothing happens) | dot / ✗ blank |
| H06 Move 1, Rotate Left, Move 1 | | ↑ ↺ ↑ | | ✓ / ✓ |
| H07 U-Turn, Move 2 | | ⟲ ↑↑ | | ✓ / ✓ |
| H08 Move Back 3 | | ↓ ×3 | "Do I turn?" (no) | ✓ / ✓ |
| H09 Laser Storm | main laser fires all 4 ways this slot | ✶ | "Who did I hit?" | dot / ✓ |
| H10 Double Program | the top 2 cards of your deck run here; Again repeats only the 2nd | ×2 | "Which cards?" | shows "stay put" (E3) / ✓ |
| H11 Spin Out | random facing, then Move 2 | ? ↑↑ | "Where will I go?" | shows "stay put" (E3) / looks like a right turn |
| H12 Swap | trade places with the robot your laser would hit | ⇄ | "Who?" "What if nobody?" (nothing) | shows "stay put" (E3) / ✓ |
| H13 Power Surge | +3 ⚡, then 1 damage | ⚡ ! (one bolt, E6) | "Why did I get damage?" | dot / ✓ |
| H14 EMP | every robot next to you takes 1 | ◎ | "Did I hurt my neighbors?" | dot / ~ (💥 dropped) |
| H15 Move 2, Rotate Left, Move 1 | | ↑↑ ↺ ↑ | | ✓ / ✓ |
| H16 Zigzag | Move 1, step right without turning, Move 1 | ↑ ⇥ ↑ | "Which way is ⇥?" | ✓ / ✓ |
| H17 Overcharge | main laser +2 damage this slot | +2 | | dot / ✓ |

General Haywire questions are DMG-09 to DMG-12 and PRG-10 to PRG-12.

---

## 9. Everything a player might point at

The natural questions per thing, for a "?" tap mode (IDs refer to section 6). "Phone" items are things on a
phone screen; "TV" items are things people point at on the big screen (and could tap on their phone's map).

**Phone: waiting screen.** My robot (LOB-03), the shape dots (LOB-03), the eye for late joiners (LOB-07).

**Phone: setup (leader).** Course arrows and thumbnail (SET-02, SET-06), difficulty dots and flag count (SET-02,
GOAL-03), ⚡ toggle (SET-03, OPT-01), wall toggle (SET-03, OPT-02), SPAM toggle (SET-03, OPT-03), ∞ 1 2 3
(SET-04), ▶ (begin). Others: the eye (SET-01).

**Phone: start pads.** A numbered pad (STA-01, STA-02), a taken pad (STA-05), the batteries (STA-04), the timer
(STA-03).

**Phone: shop.** ⚡ number (UPG-02), "+ ⚡1" (UPG-03, UPG-04), an upgrade tile (UPG-07, section 7), its price (UPG-05),
∞ / 1× (UPG-06), solid vs dashed border (UPG-06), the installed rows (UPG-11, UPG-08), "−" in a sheet (UPG-09), the
"auto" switch (Deflector, D2), ✓ (UPG-01, UPG-12), the flag dashes (CP-04), the SPAM number (DMG-06), the timer.

**Phone: programming.** Each card type (section 6.6, CRD-xx), SPAM (DMG-03, PRG-13), a locked Haywire slot
(PRG-10, PRG-11, DMG-09), an empty slot's number (PRG-01, ORD-03), the lit "next" slot, the map (PRG-02, PRG-20), my
robot (PRG-02, MOV-01), other robots (ACT-01), the light line, its dots, ✕ and ? (PRG-03, PRG-04), any board
element on the map (section 6.9), a flag (CP-01, CP-02), the reboot ring (BRD-17), the four reboot arrows (RBT-04),
the eye/zoom (PRG-14), Haywire chips (PRG-12), the peek chip (PRG-21), a usable one-use upgrade chip (UPG-11),
bookmarks (PRG-22), Crab Legs "+" (section 7), undo (PRG-05, M2), ✓ / pencil (PRG-07, PRG-24), power (SD-01), ⚡ in the
top bar (UPG-02, EN-04), the SPAM number (DMG-06), the timer (TIME-01), the flag dashes (CP-04).

**Phone: race.** My five slots, the lit one (ORD-01, ORD-10), the small violet card under a slot (DMG-02; E2), the
reboot glyph (RBT-01, RBT-08), the power glyph (SD-03), "someone is deciding" (DEC-08), the arm bar (DEC-05,
DEC-06), the eye ("look up", ORD-01).

**Phone: a decision sheet.** The heading picture (DEC-01), each option (DEC-03, section 7), the timer (DEC-02).

**TV: during programming.** Roster token: the five little slots (WAIT-01, PRG-16), the shopping bag (UPG-12), the ✓,
the power icon (SD-06), "…" (TIME-06), the dot (ORD-04), ⚡ number, ◆/◇ pips (UPG-13), flag dashes (CP-04). The
timer line (TIME-01), ⏩ (SET-08), the round-1 slot hint.

**TV: during the race.** The 1–5 circles (ORD-02), cards over robots (ORD-07), a card that glitches into another
(DMG-08), a robot's pointer (MOV-01), name tags (ACT-01), beams (LAS-01), shards (DMG-02), a robot dropping (RBT-01),
the pillar of light (RBT-03), a ring burst at a flag (CP-01), a bolt pop (BRD-16), a shield ring (LAS-08), a pulsing
robot (ORD-08), light trails (ACT-02), every board element (section 6.9), flag columns and the colored rings at
their foot (CP-04), a robot that sits still while shut down (SD-06).

---

## 10. What the current UI teaches

### Already teaches well

- **The lobby film's phone beside the board**: a fingertip taps five cards into five slots and ✓, then the slots
  light one by one as the robot runs them. This is the clearest lesson in the game.
- **The phone's light line** (ghost preview) through belts, gears, push panels, pits and edges, with numbered
  dots, ✕ for falls and "?" for the unknowable. It answers facing, relative turns, belts and pits *before* the
  player commits.
- **Cards revealed together over every robot** on the TV, and the current card on each roster token: everyone
  can see what everyone played.
- **The register strip (1–5)** on the TV and the lit slot on each phone.
- **Readiness**: robots glow when locked in, roster slots fill as cards are placed, a shopping bag while shopping.
- **Board dangers are drawn in advance**: laser paths as faint dotted lines, push panels with lit register dots,
  gear colors, belt arrows that curve, numbered flag columns with colored "taken" rings.
- **Event animations**: belts pulse with the robots they carry, gears kick, push panels slam, beams in the
  shooter's color, coral vs violet damage shards, card → card glitch for SPAM, fall into the pit, pillar at
  reboot, flag rings, the winner's pillar. Sounds back up each one.
- **Upgrade demos**: most of the 40 upgrades have a clear looping animation in the shop and in prompts.
- **The shutdown sheet**: the robot dims, the junk cards are crossed out, a laser still hits it, it powers back on.
- **First-round nudges**: the first card bobs on the phone; the TV shows five slots filling.

### Teaches wrongly or confusingly

- The Spiky demo (E1), the h01 placeholder for incoming Haywires (E2), the light line's "stay put" for three
  Haywires (E3) and the false fall with Hover Unit (E4), blank or misleading demos (E5), Power Surge's face (E6).
- Lesson 2's second round (M12): five Rotate Lefts while the robot reboots.
- Unlabeled setup toggles (M3), Priority as a dot (M4), flags as dashes (M5), the SPAM total (M6), the eye glyph
  for four things (M7), undo meaning "clear all" (M2), the power button beside ✓ (M13).
- Weapon and window prompts without their hints (M1).

### Where people will feel lost

- **Round 1's shop** (UPG-01): meaningless before anyone has moved.
- **The first register**: finding your robot (names hidden under cards), not knowing the order, not knowing the
  board moves after the cards.
- **The first damage**: shards with no explanation; nothing on the phone.
- **Round 3's locked slot and SPAM in hand**: both arrive for most players with no explanation.
- **The first fall**: the robot vanishes; the phone shows one glyph; next round brings unexplained arrows.
- **Any mismatch with the light line**: no way to see why.
- **The leader's setup screen**.
- **Late joiners and dropped phones**: an eye, or a robot that did things on its own.
- **The lobby for rules-first players**: nothing to read or browse on their own phone.

---

## 11. Teaching channels

| Channel | Reaches | Strengths | Limits | Best for |
|---|---|---|---|---|
| FILM (lobby lessons) | the room, before play | Real rules, players' own robots and colors, the phone mimic; no reading | Half-watched while people join; ~2-minute loop; shared; can't pause per person (the in-progress lobby change lets the big screen jump scenes); misses damage, energy, Priority, walls, blue belts, push panels, Again, shutdown, the timer | GOAL, PRG-01, ORD-03, BRD-01, MOV-05, RBT-01, CP-01 |
| INTRO (narrated, skippable) | the room, at game start | A voice can explain without reading; can name the counter-intuitive rules (no health, random fill, board moves after each card); sets the cyber tone | Skippable means some skip; must be short (~60–90 s) or chaptered; one pace for all | DMG-01, TIME-01, ORD-04, LAS-02, UPG-01, GOAL |
| MAN (phone manual) | one player, any time incl. lobby | Private; scannable; all demos at once; perfect for rules-first and veterans | Must be opened; headers are words; long lists | Reference for everything; section 7 and 8 |
| ASK ("?" tap) | one player, in context | Answers "what is this?" exactly where the player is looking; can show 2–3 natural questions per thing | Needs a target to point at; event questions ("why did my card change?") have no target unless there's a history | Section 9 targets; PRG, BRD, CRD, setup |
| CUE-B (big screen, first time) | the room at once | One explanation teaches everyone; fits "the TV is the show" | Can't be private (Haywire identity); must not slow the race | Lasers, damage, falls, reboots, Priority order, SPAM replacement, flags |
| CUE-P (phone, first time) | one player, at the moment | Private; can show your own damage, locked slot, arrows | Needs data the phone doesn't get today (M16); must not block | PRG-10, DMG-03, RBT-04, UPG-01, DEC-05, TIME-01 |
| DO (light line, replays, safe start) | one player | Learning by trying; the light line already does much of the teaching | A replay needs per-robot event history; a "safe first round" changes the rules | ACT-02, MOV-02, BRD-01, CP-02 |
| Voice during the race | the room | Can turn first-time events into narrated moments ("first fall of the night...") | Must stay rare | first fall, first SPAM swap, first Haywire, flags, the win |

Data that already exists for these channels: the engine writes a caption per beat (`beat.cap`, e.g. "Ada: SPAM →
Move 2", "Board lasers", "Robot lasers", "Ada reboots") and a log ("Ada fell into a pit", "Ada reached Checkpoint 1",
"Ada shut down to clear their damage"); the TV gets both but shows neither. They are ready-made narration or
replay lines.

---

## 12. Answer-moment map and first-time triggers

### When each kind of question is best answered

**Before play (lobby film, intro, manual):** the goal and flags in order (GOAL-01, CP-01); programming five slots
(PRG-01); slots run one at a time for everyone and the board moves after each (ORD-03, BRD-01); no health, damage is
junk cards (DMG-01); falling means coming back next round (RBT-01); the timer fills empty slots randomly (TIME-01);
pushing (MOV-05).

**At first encounter (cues):** the first shop (UPG-01); first programming (PRG-02, PRG-03, MOV-02); the first
register (ACT-01, ORD-04); the first board element that moves you (BRD-01); the first laser hit and damage (LAS-01,
DMG-02); the first SPAM in hand (DMG-03); the first locked Haywire (PRG-10); the first card swap (DMG-08); the first
fall and the reboot arrows (RBT-01, RBT-04); the first near-miss on a flag (CP-02); the first decision prompt (DEC-01);
the first armable upgrade (DEC-05); the last 10 seconds of the first timer (TIME-01); a reconnect (TIME-06).

**On demand (ask, manual):** everything else, especially every board element, card, upgrade and Haywire; the board
order; Priority; energy; shutdown; options.

### Triggers available in the data today

| Event | Where it can be detected | Who knows today |
|---|---|---|
| Carried by a belt / turned by a curve | beat `what.k === 'belt'` with move/turn fx | host only |
| Turned by a gear | `what.k === 'gear'` turn fx | host |
| Pushed by a panel | fx `pusher` + move | host |
| Pushed by a robot | move fx for a robot other than `what.id` during a card beat | host |
| Bumped a wall | move fx with a 1-point path (in-progress: `bonk`/`shove` fx) | host |
| Wall laser / robot laser hit | fx `beam` (`board` or `src`) with `hit` | host |
| Damage taken (SPAM count, Haywire count, source) | fx `dmg` { sp, hw, src } | host |
| Card swapped (SPAM, Again in slot 1, Abort) | fx `replace` { from, to } | host |
| Fell (pit or edge) / rebooted | fx `fall` { edge } / fx `reboot` | host |
| Flag reached / win | fx `cp` / fx `win` | host |
| Energy gained / shield | fx `en` / fx `shield` | host |
| SPAM in hand, locked Haywire, rebooting, peek, Memory Swap return | `me.hand`, `me.regs[i].locked`, `me.rb`, `me.peek`, `me.mustReturn` | phone |
| Waiting on someone's choice | `waiting` (phones), `prompt` (host) | both |
| Time running out | `deadline` | both |

The phone receives only `beat.n`, `beat.what` and `beat.reg` (M16), so phone-side "you took 2 SPAM", "a Haywire
landed in slot 3" or "what just happened to me" needs `fx` filtered to the player in `playerView`.

### Misconceptions worth pre-empting

- "Damage is health; I'm about to die." (DMG-01)
- "My robot does all five cards, then the next player goes." (ORD-03)
- "Rotate Left moves me left." / "Left means the TV's left." (CRD-02)
- "Move Back turns me around." (CRD-04)
- "Driving through a flag counts." / "I have to face the flag." (CP-02)
- "The light line is a promise." (ACT-02)
- "I fire my laser when I want." (LAS-02)
- "Falling knocks me out." (RBT-01)
- "I must buy something." / "Drawing an upgrade installs it." (UPG-01, UPG-03)
- "The power button means done." (SD-01)
- "If the timer runs out I just skip." (TIME-01)
- "Again means draw again." (CRD-06)
- "A Haywire means my phone is broken / I've been hacked." (DMG-09)
- "Batteries pay once." (BRD-16)
- "Belts push robots." (BRD-07)

---

## 13. Appendix: rulebook coverage

Every rule in the rulebook, with the questions that cover it.

| Rule (rulebook page) | Questions |
|---|---|
| Object: flags in order, first to the last wins (3, 10) | GOAL-01, CP-01..03, CP-06, CP-07 |
| Rounds: Upgrade, Programming, Activation (4) | UPG-01, PRG-01, ORD-01 |
| Draw 1 upgrade for 1 energy, once a round; install 1 a round; uninstall any; 3 + 3 slots; replace when full; never required (4–5) | UPG-03..09, UPG-15 |
| Start with 3 energy, max 10 (3, 8) | UPG-02, EN-01..03 |
| Draw to 9, reshuffle discard (5) | PRG-08, PRG-09, PRG-25 |
| Five face-down cards in order; no changes after the reveal (5–6) | PRG-01, PRG-07, ORD-09 |
| Discard unused cards, SPAM stays (6) | PRG-08, DMG-05 |
| Activation: register by register, Priority order, then board, weapons, end of register (7) | ORD-03..05 |
| Board order: blue belts (2), green belts, push panels by register, gears, board lasers (8, 12–14) | BRD-01..15, BRD-21 |
| Robot weapons fire forward, nearest robot, walls block; one replacement weapon per register (8, 16, 20) | LAS-01..05, DEC-03 |
| Batteries +1 per register (8, 14) | BRD-16, EN-02, EN-06 |
| Checkpoints in order, end of register (8, 15) | CP-01..05 |
| End of round: Priority passes, face-up damage to the damage pile, programming to discard, Haywire stays face down (10) | ORD-04, DMG-11 |
| Card index: 20 cards and counts; Again; Again in register 1 (11) | CRD-01..10, PRG-25 |
| Belts: blue 2 only blue-to-blue; tandem; junction conflict; blocked by robots; blue onto occupied green stops (12) | BRD-03, BRD-06, BRD-07 |
| Rotating belts only when conveyed, junction from the straight side doesn't rotate, leading side turns (13) | BRD-04, BRD-05 |
| Combination belts blue → green (14) | BRD-08 |
| Push panels push lines of robots, only on their registers (14) | BRD-10, BRD-11 |
| Gears: red left, green right (14) | BRD-12 |
| Board lasers: nearest robot only, walls, one damage per beam, one card at a time (14) | BRD-13..15 |
| Pits and edges cause a reboot; edges aren't pits; board borders aren't walls (15–16) | MOV-09, MOV-10, MOV-16, RBT-01, Firewall/Hover Unit |
| Checkpoints and reboot tokens don't block; elements under them inactive (15) | CP-08, BRD-19 |
| Walls stop movement and lasers; adjacency (15) | MOV-03, MOV-13, MOV-15 |
| Pushing: single push event, chains, no facing change, into pits/off edges, not through walls, belts don't push (16) | MOV-05..08, BRD-07 |
| Damage: draw one at a time, reshuffle, none if empty (17) | DMG-02, DMG-14 |
| SPAM: to discard, stays in hand, programmed SPAM is replaced by the top card (17) | DMG-03..05, PRG-13 |
| Haywire: face down under the current register, one per register, extras discarded, runs next round, can't be moved, card beats rules (18) | DMG-09..13, PRG-10..12, section 8 |
| Shutdown: when, clears damage in registers/hand/discard, subject to board and lasers, no energy or checkpoints (19) | SD-01..07 |
| Rebooting: program cancelled, discard registers and hand, 2 damage, Haywire to the current register, upgrades stay; re-enter in register 1 at the board's token (or start pad), choose facing, occupied token (19–20) | RBT-01..09, DMG-18, D1 |
| Upgrades: card vs maneuver, key terms, weapon wording (20) | section 7 |
| Each permanent and temporary upgrade (21–23) | section 7 |
| Courses, difficulty, length (24–29) | SET-02, GOAL-03 |
| Variants: lighter game, less deadly, less SPAM, Act Fast (32) | OPT-01..04, SET-03..05, D6 |
| Variants not implemented: dynamic archiving, competitive start, less foreshadowing (32) | (veteran questions; MAN could say "not in this version") |
