# The coach: what a player is told, when, and in what words

Written 2026-11-11, after the owner asked for "a more intuitive way to display help info": help that is on by
default, walks a player through their first few turns, and warns when another robot may be in the way. It
replaces the wordless cues (a pulse and a picture chip under "?") that `design.md` 2.2 describes. The code is
`games/robo-rally/tips.js` (the words and when each is said) and `coach.js` (how a tip is shown).

## 1. What a player needs, and when

Sorted by when it first matters. "Figured out" means the screen makes it obvious, so nothing says it.

| When | What | Who says it |
|---|---|---|
| Before round 1 | That robot is mine | the draw (each robot comes down onto its pad, named); names over the robots in round 1; my phone's color and shape |
| Before round 1 | My phone programs my robot; everyone runs at once; the flags in order, first to the last one wins | the big screen's reel (`sizzle.md`) |
| First program | Tap a card: it goes in slot 1 | the coach, at the hand |
| First program | The line on my map is where I will go | the coach, at the map, once a card has drawn a line |
| First program | Fill all five; slot 1 runs first | the coach, at the next empty slot |
| First program | Lock in | the coach, at the lock, once five are in |
| Test drive, course 2 | Left and right are the robot's own | the coach, at the map |
| Test drive, course 3 | A belt carries you after every card | the coach, at the map |
| Round 1 runs | Look up: the robot runs the cards by itself | the coach, on the phone; the narrator on the big screen |
| Round 1 runs | Everyone moves at once, slot by slot; the floor moves; lasers fire | the big screen (it happens, and the narrator names each once) |
| Round 2's program | The line shows only me: other robots can shove me off it | the coach, at the map |
| Round 2's program | Tips can be turned off under "?" | the coach, at the "?" |
| From then on, while programming | A robot stands on my line, or is close to it; I'd stop in a laser | the task line names it, and the map frames the square |
| When it first happens | I fell: which way to face; a junk card in my hand; a jammed slot; ×2; ten seconds left; the shop; I was hit | the coach, at the thing |
| Never said (figured out) | What each card does (its picture, and the line); taking a card back; undo; zoom; the deck counter | |
| Only in Help | The order robots act in (the "1" mark); shutting down; upgrades; what each board square does | "?" |

## 2. How a tip behaves

- **One at a time**, on a slip of light beside the thing it is about, with an arrow to it.
- **It goes when you do what it says**, when you tap it, or (some) after a few seconds. Then the next one may come.
- **Once per phone.** A tip that was up for less than 0.7 s and wasn't acted on comes again.
- **No more than two on one screen**, not counting the four steps of a first program. What needs doing now
  (I fell, a jammed slot, ten seconds left) comes before what is merely new.
- **A phone that has raced before today skips the four steps and "look up".**
- **Tips are on until turned off:** Help has the switch ("Tips while you play"). Off also stops the advice below.
- A tip with more to say has a "?" on it, which opens that Help topic.
- The test drive has the same coach: the four steps are said there if the player drives it first, and not again
  in round 1.

## 3. Advice about the line

The line on the phone's map is one robot alone. From round 2 (once the coach has said so; from the start on a
phone that has raced), while I am still planning, `planRisks` reads my line against the board:

| Kind | When | The task line says |
|---|---|---|
| block | a robot stands now on a square one of my slots drives through | "Ada is in your way" |
| laser | one of my slots ends in a wall laser's beam | "You stop in a laser: 1 junk card" |
| near | in slot 1 or 2, I pass within two squares of a robot | "Ada is close. You may be shoved or shot" |

The worst is said (block, then laser, then near), and each square is framed on the map with a dashed line in
that robot's color (coral for a laser). It is advice, not a prediction: the other robot's cards are secret. It
only looks at slots 1 and 2 for "near" because by slot 3 every robot could be anywhere.

**Not done:** it does not know which way another robot's laser points after it moves, so "you may be shot" is
only said together with "close". Robots heading for the same flag later in the round are not warned about.

## 4. The words

Rules the tips and the Help topics now follow (all the hand-written Help sentences were rewritten on this day):

- Say what to do, or what happens to you. "Tap a card", not "Cards can be tapped".
- One idea a sentence. No brackets, no semicolons.
- One word for one thing, everywhere: **slot** (never register), **junk card** (SPAM is only the card's name),
  **jammed slot** (a Haywire), **fall** and **come back** (never reboot, except in the upgrade names), **square**,
  **used cards** (the discard pile), **the line**.
- A tip is at most 14 words; a Help sentence at most 25 (40 for three map features).
- Nothing a player can see for themselves gets a sentence.

`test/guide.mjs` checks the lengths, that every tip belongs to a screen, and the order of the first steps.

## 5. The narrator's lines (not changed: they need recording)

The big screen's voice is recorded (`scripts/render-voice.mjs`, on the owner's ElevenLabs credit), so its lines
were left as they are. If they are recorded again, these would match the words above:

| Now | Proposed |
|---|---|
| "Each round, your phone deals cards. Fill five slots." | "Your phone deals you cards. Put five in the slots." |
| "Lasers fire on their own, straight ahead. No health. Damage is junk cards, sent to your phone." | "Lasers fire by themselves. There is no health: a hit sends junk cards to your phone." |
| "Fallen robots sit out the round. Reboot next round, on the blue ring." | "A fallen robot sits out the round. It comes back next round, on the blue ring." |
| "Robot down. Back next round, on the blue ring." | (keep) |
| "Junk card. Swapped for a random card." | "A junk card. It runs a random card instead." |
| "Your turn. Drive your robot to the flag." | (keep; it still has no recording) |

## 6. Not verified

Checked in the dev pages (`dev-phone.html?to=program`, `?to=program&story=demo`, `?to=brief&stage=practice`)
and by `test/guide.mjs`. Not tried on a real phone or at a table: whether the slips cover something a thumb
needs, and whether two tips a screen is the right pace, are open.
