# Robo Rally as a party game: design review

A review by a separate agent (2026-11-10), asked for ways to make this a better game and a better party game.
It read the rules and both screens and simulated races headless; it did not open either screen. The tutorial and
the help were reworked separately at the same time (`docs/teaching/design.md`, section 0), so some of section 4
is already out of date. Of the suggestions, only number 2 (start pads) is built: see "What was built" under it.

## How it was checked

- **Read:** rules.js, engine.js, cards.js, board.js, chaos.js, host.js, the race and end parts of player.js and
  scene.js, replay.js, teach.js, and the framework's room.js. Line numbers are for commit f1c56b9.
- **Ran:** `npm test` (ALL PASSED), and headless simulations that drive engine.js directly, 150 to 600 seeded
  races per setting.
- **The bots:** three planners that see what the phone's light line sees (one robot alone, `previewProgram`,
  minimap.js:792) and ignore other robots.
  - Expert: searches every program.
  - Casual: greedy, one card of look-ahead.
  - Novice: greedy, forgets the floor moves, 25% random cards.
  - "Party mix" is 1 expert, 1 casual, 2 novices at four players; 1, 3 and 4 at eight.
  - Alone on Closing Time they finish in 3.5, 4.3 and 6.3 rounds.
- **Limits:** bots are not people. Thinking time and fun could not be measured, so minutes assume 60 to 120 s of
  programming per round. Activation seconds are the engine's own beat durations (engine.js:602), without narrator
  holds or prompt waits.

## 1. Summary

1. **Give the race an ending.** Today it is the winner's name and a home button. Add standings, a few wordless
   awards, a replay of the best moment and a one-tap rematch.
2. **Fix the starter course's start pads.** Pad 4 wins 51 to 75% of simulated races. Moving flag 1 (one line in
   board.js) and handing pads out automatically fixes it and doubles round-one collisions.
3. **Put a clock on the race.** Medium maps run about 14 to 31 minutes and long ones 28 to 62, with no way to end
   one and keep a result.
4. **Remove the dead air.** Count down when only stragglers are left, fold the shop into programming, and stop
   asking questions mid-race.
5. **Let more than eight people in.** A ninth phone currently stops the game from starting at all.

## What a race is like now (measured, party mix)

| Course | Rounds at 2 / 4 / 8 players | Activation per round | Est. minutes at 4 / 8 players |
|---|---|---|---|
| Closing Time (2 flags) | 4.4 / 3.9 / 3.8 | 22 / 38 / 68 s | 6–10 / 8–12 |
| Blue Light Special | 8.3 / 8.2 / 9.4 | 24 / 42 / 78 s | 14–22 / 22–31 |
| Inventory Day | 6.2 / 5.8 / 6.8 | 23 / 41 / 75 s | 10–16 / 15–22 |
| Aisle Nine | 8.2 / 7.5 / 8.5 | 23 / 42 / 76 s | 13–20 / 19–28 |
| Grand Re-Opening | 12.8 / 12.2 / 12.5 | 24 / 42 / 77 s | 21–33 / 29–41 |
| Everything Must Go (4 flags) | 17.7 / 15.8 / 18.5 | 25 / 45 / 81 s | 28–43 / 44–62 |

With upgrades on, add up to 60 s of shop per round plus prompt waits.

- **Interaction scales with the table.**

| Per round | 2 players | 4 players | 8 players |
|---|---|---|---|
| Shoves | 0.2 | 1.0 | 3.6 |
| Robot-laser hits | 0.6 | 2.8 | 8.7 |

- **Falls.** From 0.45 per robot per race (Closing Time, four players) to 3.6 (Everything Must Go, eight). 13 to
  38% are pushes by another robot.
- **Skill.** At four players the expert wins 50 to 74% and each novice 2 to 10%. At eight the expert wins 23 to
  53%.
- **The moment-to-moment show is already strong.** Shoves, wall hits, falls and helpful pushes get faces, slow
  motion and a camera punch-in (scene.js:3341-3358). The suggestions leave that alone.

## 2. Ranked suggestions

### 1. A closing ceremony (party, M)

**Problem.**
- The race stops the instant someone tags the last flag (engine.js:1387-1395).
- The big screen shows the winner's name, flags and a home button (host.js:677-685). Phones show the winner and
  their own flags (player.js:1778-1787). 90 s later everyone is in the lobby (rules.js:66).
- Pushes, laser hits, falls and damage are counted per robot (engine.js:137) and sent to the big screen at the end
  (rules.js:630), but no screen draws them.
- Simulated on the starter course, 35% (four players) to 49% (eight) of non-winners end with no flag. In 70 to
  77% of races a runner-up was on the last flag within 6 squares, unmentioned.

**Proposal.**
- Standings: roster tokens slide into finishing order (flags, then distance to the next flag), with 1, 2, 3 lit
  over the first three.
- Three or four awards, one at a time: an icon and a count over a token. Most robots shoved, most laser hits,
  most falls, most robots sent to their doom (chaos.js:108-117 already works out who pushed whom).
- Play of the game: keep the race's highest-scoring beat with the robots' poses and replay it in slow motion.
- Phones: my place as a big numeral, my award icons, and the robot that knocked me out most.
- Rematch: one button on the leader's phone and the big screen, back to setup with the same options. The
  framework's "Start over" exists but sits in a menu (public/host.html:43).

**Files.** rules.js, host.js, player.js, scene.js. briefing.js already stages robots and plays beats in a
borrowed arena.

**Risk.** Keep it under about 25 s and skippable. The stored beat adds a few KB to the host view (largest message
today is 4.2 KB, limit 16).

### 2. Re-lay the starter course and hand out the pads (game, S)

**Problem (verified by simulation).**
- Flag 1 is 5 squares straight ahead of pad 4 and 14 squares from pad 7 (board.js:33, 129).
- Pad 4 wins 61% among four equal casual bots, 75% among four experts and 51% at eight players. Fair shares are
  25%, 25% and 12.5%. Pad 7 wins 2 to 8%.
- Pads are first come, first served in a 40-second phase (rules.js:9, 430-438), so the fastest thumb or the one
  veteran gets it.
- Other maps are milder: Aisle Nine pad 2 wins 46% at four players; Blue Light Special and Grand Re-Opening pad 4
  win 41%.

**Proposal.**
- Move flag 1 to `[5, 8]` (coordinates as written in board.js).
- Optionally make it three flags, `[[5,8],[8,4],[2,2]]`.

| Layout | Best pad at 4 / 8 players | Rounds | Round-one shoves at 4 / 8 | Losers with no flag at 4 / 8 |
|---|---|---|---|---|
| Today | 61% / 51% | 3.8 / 3.5 | 0.5 / 1.9 | 28% / 46% |
| Flag 1 at [5,8] | 34–36% / 21% | 3.3 / 3.5 | 1.1 / 4.7 | 29% / 46% |
| Three flags | 37% / 20% | 5.4 / 6.1 | 1.3 / 5.4 | 9% / 21% |

- Drop the pad-pick phase. Robots drop onto pads on the big screen: random in a first race, reverse finishing
  order in a rematch. This saves up to 40 s before the first move and a choice newcomers cannot judge.

**Files.** board.js (one line), rules.js, player.js `renderStart`, host.js.

**Risk.** Veterans lose a small choice. The other five courses deserve the same check.

**What was built (2026-11-10).**
- Flag 1 of the starter course is at `[5, 8]`. Still two flags.
- The pad-pick phase is a 4-second draw (`rules.js`, `drawPads`): the racers get the pads nearest flag 1 by
  walking distance (`board.js`, `padsByFlag`; ties at random), handed out at random. This is narrower than the
  proposal's "any pad at random": with fewer than eight racers the far pads stay empty. The big screen shows the
  robots coming down onto their pads one at a time; each phone shows its own pad lit.
- Not built: reverse finishing order in a rematch (there is no rematch yet: suggestion 1).
- Re-measured with the real draw, 600 races a setting, equal casual bots, starter course:

| Players | Fair share | Best pad wins | Worst pad wins | Round-one shoves |
|---|---|---|---|---|
| 2 | 50% | 51% | 49% | 0.6 |
| 4 | 25% | 28% | 23% | 2.5 |
| 6 | 17% | 25% | 11% | 4.0 |
| 8 | 13% | 23% | 5% | 4.8 |

- Before, pad 4 won 63% at four players and 53% at eight in the same simulation.
- What it costs: flag 1 is now taken in round 1 of nearly every race, and there is a pit beside the way to it.
  Round-one falls at a mixed table of four went from about 0.2 to 0.7 a race (falls per robot per race, 0.45 to
  0.61). Races are a little shorter (3.9 to 3.4 rounds at four).
- Still uneven: a full room of eight (pad 6 wins about twice its share; the back corners, 1 and 7, a third of
  theirs), and Aisle Nine, where pad 2 wins 35 to 38% at four. Handing out the nearest pads helped the other
  five courses a little (best pad at six players: 19 to 28% across them, from 22 to 37% with any pads; 240 to
  400 races a setting, so a few points either way), but their flags were not moved.

### 3. Closing time: a race clock (both, M)

**Problem.**
- Only tagging every flag ends a race. The other exit is the framework's "Back to lobby", which discards it with
  no result (room.js:283-289).
- Setup shows a difficulty meter and a flag count (host.js:948). The `length` and `blurb` fields
  (board.js:126-172) reach no screen, so nothing warns that Everything Must Go is four to five times the starter.

**Proposal.**
- A second segmented control at setup for race length in rounds, preset per map, with ∞ kept. The map card shows
  expected minutes for the phones present.
- In the race: a row of ceiling lights on the big screen, one going dark per round. On the last round the floor
  dims so only robots and flags glow, with one recorded line.
- Then standings by flags, then distance, then who reached their last flag first.

**Simulated.** With an 8-round cap on medium maps, 23 to 53% of races end on the clock. In those, the leader is
exactly tied with second in 5 to 9% and a whole flag ahead in 23 to 31%.

**Files.** rules.js, engine.js (end of round), host.js, player.js, one voice clip.

**Risk.** Winning on position is less satisfying than tagging the flag. It needs the standings from suggestion 1.

### 4. A countdown when only stragglers remain (party, S)

**Problem.**
- Programming ends when every connected phone has locked in or the timer runs out (rules.js:47, 59). A first
  game's timer is 120 s (rules.js:330).
- A locked-in phone says "Waiting for the others" (player.js:1315).
- "Hurry up" exists (rules.js:528-535) but only as a big-screen button (host.js:44). No phone has it, and at a
  party nobody sits at the laptop.

**Proposal.** When all but one robot (all but two at six or more) have locked in and over 30 s remain, drop the
deadline to 30 s and turn the timer line coral. The big screen already raises the last one or two
(host.js:604-610). Exempt rounds 1 and 2 when someone is new.

**Files.** rules.js.

**Risk.** The slowest player is often the newcomer. The time saved is an inference; it could not be simulated.

### 5. The shop inside programming (both, S then M)

**Problem.** With upgrades on, every round from the second opens with a separate phase of up to 60 s
(rules.js:10). It ends only when every connected player taps the check mark, including players with nothing to
buy (rules.js:46).

**Proposal.**
- Quick: mark a robot done when it has no energy to draw and can afford nothing.
- Better: no shop phase. An energy chip on the programming screen opens the shop as a sheet, and buying is
  allowed until lock-in.

**Files.** rules.js, engine.js (allow buy and install while programming), player.js.

**Risk.** One more thing on the busiest phone screen.

### 6. No questions during the race (both, M to L)

**Problem.**
- 21 of the 40 upgrades can stop the race to ask their owner something. The ten `ask()` sites are engine.js:646,
  658, 675, 771, 1534, 1585, 1643, 1653, 1671 and 1679.
- Each holds the room for up to 12 s (engine.js:13).
- With bots that shop at random, from round 4 on: 1.1 to 1.5 questions per round at four players, 2.9 to 3.1 at
  eight, and 6 or more in one round in ten.

**Proposal.** Answer at programming time, where the light line can show the result.
- Brakes, Power Slide and Drifting become a toggle on the card in its slot.
- Weapons get a standing choice, like the existing auto-shield (rules.js:495-498).
- One-use moves are dropped before or after a card.
- Interim (S): a default "simple shelf" that leaves those 21 out of the deck, or halve the 12 s.

**Files.** engine.js, cards.js, player.js, minimap.js, tests.

**Risk.** The largest item here. Experts lose the chance to react to what just happened.

### 7. More than eight people, and latecomers (party, S to start, M for the audience)

**Problem (verified by running the room headless).**
- With nine phones the room refuses to start: "Robo Rally allows at most 8 players" (room.js:256, rules.js:366).
  The only sign is the hover title of a disabled start button (public/js/host.js:224-225).
- A phone that joins mid-race is turned away (rules.js:387) and shows an eye until the race ends.
- The game's own watcher screen (player.js:1343) cannot currently be reached.

**Proposal.**
- Let the room start. Eight seats race and seats rotate each race, with those who sat out going first.
- Watchers tap a robot to back it; their avatars gather behind its token.
- Once a round, the watchers' majority pick gets one junk card thrown at it, using the existing junk flight
  (teach.js:198).
- A latecomer may take over a robot whose phone has gone.

**Files.** rules.js, player.js, host.js.

**Risk.** The crowd will mostly hit the leader, which is probably welcome. Cap it at one card per round.

### 8. Ghost trophies and a face for your nemesis (party, S to M)

**Problem.** The big screen already knows who pushed whom to their doom and shows it for a second with slow
motion and a smug face (scene.js:3350-3358, 3677-3681). Then it is gone. The victim's phone records "pushed by"
in a slot mark (replay.js:36, 69) but does nothing at the moment.

**Proposal.**
- Each robot you send into a pit or off the edge leaves a small ghost, in the victim's colour, on your roster
  token for the rest of the race.
- The victim's phone shows the culprit's robot full screen for a second.
- The ghosts feed the awards in suggestion 1.

**Files.** rules.js (tally in `pump`), host.js, player.js.

**Risk.** Some players will hunt instead of race.

### 9. Buddy teams (both, M)

**Problem.** In the mixed-table simulations each novice wins 2 to 10% at four players and 1 to 6% at eight, and
ends with about a third of the flags. The game already knows which phones have never finished a race
(rules.js:19, 406-409).

**Proposal.**
- One toggle at setup: pairs. Each newcomer is paired with a veteran.
- Partners share a ring colour and linked tokens.
- The pair wins when either partner tags the last flag. Shoves and lasers still hit partners.

**Expected effect.** Derived from the measured win shares, and assuming play does not change, a newcomer's chance
of being on the winning side rises to roughly 20 to 45% at eight players.

**Files.** rules.js, engine.js (win check), host.js, scene.js, player.js.

**Risk.** Odd player counts.

### 10. A jinx once you have locked in (party, M)

**Problem.** After locking in, a phone has nothing to do. During activation, phones only watch
(player.js:1685-1758).

**Proposal.**
- A locked-in phone shows the other robots. Tap one to jinx it; your small ghost sits on its token for all to
  see.
- If it falls this round, the ghost pops and you keep it (with upgrades on, plus 1 energy).
- It is only available once locked, which rewards locking in.

**Simulated.** There are about 0.5 falls per round at four players and 1.5 to 2.3 at eight, so jinxes land a few
times a race.

**Files.** rules.js, host.js, player.js.

**Risk.** Piling on one player.

### 11. Less SPAM by default at new or large tables (game, S)

**Problem.**
- The default keeps unplayed SPAM in the hand (engine.js:485). That is the 2023 rulebook's standard rule; its
  beginner variant discards it. A first game uses the harsh one (rules.js:330).
- Simulated: a newcomer who never plays the red card unless forced.

| From round 5 on | SPAM stays in hand | Less SPAM |
|---|---|---|
| SPAM held in a 9-card hand | 2.1–3.0 | 1.3–1.8 |
| Rounds with 5+ SPAM (cannot fill five slots without junk) | 8–21% | 0–3% |

- At eight players each robot takes about 15 damage cards per medium race (11 at four), and the 40-card damage
  pile runs dry in 4 to 9% of races (engine.js:1134).

**Proposal.** Switch Less SPAM on automatically when anyone is new or six or more robots race.

**Files.** rules.js `autoOpts`.

### 12. Crown the leader and signal match point (party, S)

**Problem.** The leader is marked only by its next flag breathing brighter (host.js:440-445). The race ends
without warning mid-round.

**Proposal.**
- A thin crown of light on the leading robot and its token.
- When a robot starts a round within reach of the last flag, that flag takes its colour and pulses through
  programming with a rising tone, so the table knows whom to stop.

**Files.** host.js, scene.js, sound.js.

**Risk.** Harder on leaders. That it sparks table talk is an inference.

### 13. A shorter card pause with six or more robots (party, S)

**Problem (measured).**
- Each robot's card is two beats: 700 ms showing the card (engine.js:622, 734), then the move.
- At eight players, card beats are 72 to 75% of a 66 to 76 s activation. The 40 pauses alone are 28 s a round.
- The cards were already turned over together at the reveal (host.js:484).

**Proposal.** Scale the pause with robot count, as the reveal already does (engine.js:616): 700 ms up to three
robots, 450 for four or five, 250 for six or more. That saves about 18 s a round at eight.

**Risk.** Turn order is a little harder to follow.

### 14. House drones for one to three players (game, M)

**Problem.** At two players there are 0.2 shoves and 0.6 laser hits per round, and the first robot to flag 1 wins
62 to 81%.

**Simulated.** Two leader-chasing drones that never take flags:
- raise interaction to four-player levels (1.0 shoves, 3.0 hits per round);
- do not change who wins;
- double human falls;
- lengthen races by 10 to 60%.

**Proposal.** A toggle, on by default under four players, with drones that look visibly different from players.

**Files.** rules.js (seats without phones), host.js, scene.js.

**Risk.** Longer races, so pair it with suggestion 3. It is not a catch-up tool.

### 15. Emotes during activation (party, S to M)

**Proposal.** The scene already has eight faces (scene.js:3405). Put three face buttons under the phone's slots; a
tap pops that face over my robot on the big screen. One per register.

**Risk.** Noise. That people will use it for gloating is an inference.

### 16. The phone flinches with the robot (party, S)

**Problem.** In the race, the phone vibrates only for a prompt (player.js:1796) and for phase changes
(player.js:1892), never when my robot is shot, shoved or falls.

**Proposal.** A buzz and a full-screen flash in the culprit's colour, and a glow in mine on a flag. The flash
matters because iPhones do not vibrate from a web page.

**Files.** player.js `renderRun`.

### 17. A scoreboard for the night (party, S to M)

**Problem.** The lobby shows only the last race's winner (public/js/host.js:226-230).

**Proposal.** A small flag per win beside each robot on the game's setup screen and roster. Phones can carry the
tally the way they already carry settings (rules.js:406-418), which keeps the change inside the game folder.

### 18. "Everybody out": co-op against the clock (both, M, after 3)

**Proposal.** The table wins together. The score is how many robots get out before the lights go off. The game
already celebrates helpful pushes with a heart (chaos.js:125-136).

**Simulated, for tuning.** If finished robots leave the board, on the starter at four players the second finishes
at round 5.3, the third at 7.1 and the last at 9.8.

**Risk.** Needs a target per map. That it suits mixed ages is an inference.

### 19. First to lock in moves first (game, S to M, as an option)

**Problem.** Priority rotates one seat a round (engine.js:541), for no reason a player can see.

**Proposal.** Lock-in order becomes turn order; numerals appear on tokens as phones lock.

**Risk.** It rushes newcomers and favours fast phones. Untested, so try it as a toggle.

## 3. Considered and rejected

- **Extra cards for trailing robots.** Simulated four versions; none changed who wins or the losers' flags beyond
  noise.
- **Racing on for second and third place.** Second place needs 1.5 more rounds on the starter but 3 to 5 on
  medium maps, and the last robot 10 to 50. Rank at the moment of the win instead.
- **Perimeter wall by default.** It cuts falls 60 to 95% in simulation and barely changes who wins, but falls are
  the show.
- **Speeding up or parallelising the whole activation.** It is the fun part; only the per-card pause is worth
  cutting.
- **Three-card rounds.** Good for short attention, but five slots are wired through the engine, phone and
  teaching, and long programs going wrong is the game's signature.
- **Hidden roles or a saboteur.** Needs a shared goal; every robot is already everyone's saboteur.
- **The same hand for everyone.** Stays symmetric only until the first junk card or reshuffle. Untested.
- **Typed chat or reactions.** That is reading.

## 4. In passing: tutorial and help

- **First-time callouts are remembered per big-screen session** (teach.js:217). A newcomer who joins for the
  third race gets the Briefing but not the callouts already spoken that evening.
- **A silent big screen means reading.** If nobody clicks or presses a key on the big screen, sound stays locked
  and the narrator falls back to subtitles (voice.js header; public/js/host.js:17-22).
- **Time to the first move was about 3 to 4.5 minutes in a first game** when this was written: pads (up to
  40 s), the Briefing (about 70 s, capped at 150), then programming (up to 120 s). Suggestion 2 removes the pad
  wait.
- **The shop is the wordiest screen.** It has 40 named upgrades with rules text (cards.js:65-108). The "simple
  shelf" in suggestion 6 would also cut reading.
