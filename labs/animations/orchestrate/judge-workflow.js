export const meta = {
  name: 'robo-rally-animation-judging',
  description: 'Two independent judges score one Robo Rally moment\'s finished animations; their combined scores pick a winner and a runner-up',
  phases: [{ title: 'Judge', detail: 'the room and the director, each on their own' }],
}

// args: { scenario, entries: ['1a-name', ...] } — the moment's finished entries (final render, no warnings)
const S = args.scenario
const ENTRIES = args.entries
const DIR = `labs/animations/${S}`

const CONTEXT = `Robo Rally in this repo is a party game: phones are the controllers and one big TV shows the race, which a room of friends watches together. The team chose the look called Lumen (looks/three/concepts.md, the pick at the bottom): a slab of smoked glass in a dark room, every board element drawn with light, polished robot forms that leave fading trails of light. The person running this asked for animations that delight and surprise rather than cliché ones; breaking the rules on screen is fine as long as the game can carry on within them.

You are judging the moment "${S}": read its entry in labs/animations/scenarios.js (what happens, the rule, how often it happens in a game, the time budget). Its five picked ideas are in ${DIR}/picks.json. Each idea was animated by up to three animators with different styles (a: weight and physical comedy, b: character acting, c: cinematic and light staging). The finished entries are:
${ENTRIES.map((e) => `- ${e}`).join('\n')}
For each entry: the code is ${DIR}/<entry>.js (its meta has the animator's title and description), the final video is labs/animations/out/${S}/<entry>.mp4, its contact sheet (a frame every 0.25 s, timestamped) is labs/animations/out/${S}/<entry>.sheet.jpg, and <entry>.json has its length. What the game does today is labs/animations/out/${S}/baseline.sheet.jpg.`

const SCORE = {
  type: 'object',
  properties: {
    entry: { type: 'string' },
    delight: { type: 'integer', minimum: 1, maximum: 10 },
    surprise: { type: 'integer', minimum: 1, maximum: 10 },
    clarity: { type: 'integer', minimum: 1, maximum: 10 },
    lumen: { type: 'integer', minimum: 1, maximum: 10 },
    craft: { type: 'integer', minimum: 1, maximum: 10 },
    repeat: { type: 'integer', minimum: 1, maximum: 10 },
    overall: { type: 'integer', minimum: 1, maximum: 10 },
    note: { type: 'string', description: 'one or two sentences' },
  },
  required: ['entry', 'delight', 'surprise', 'clarity', 'lumen', 'craft', 'repeat', 'overall', 'note'],
}
const PICK = {
  type: 'object',
  properties: { entry: { type: 'string' }, why: { type: 'string' }, port: { type: 'string', description: 'what to fix or watch when porting it into the game' } },
  required: ['entry', 'why', 'port'],
}
const VERDICT = {
  type: 'object',
  properties: { scores: { type: 'array', items: SCORE }, winner: PICK, runner_up: PICK },
  required: ['scores', 'winner', 'runner_up'],
}

const JUDGES = [
  {
    key: 'room',
    brief: 'Judge as the room: six friends on a couch at game night, watching the TV between turns. What makes them laugh out loud, gasp, point at the screen or shout "again!"? What would get old by the 20th time tonight (check how often this moment happens)? Does anyone miss what actually happened in the game: who did what to whom, and where the robot ended up?',
  },
  {
    key: 'director',
    brief: 'Judge as the animation director who has to ship one of these into Lumen\'s real scene.js. Judge craft: timing (anticipation, impact, follow-through, holds), staging with one clear focal point, readability at TV size (in the game the board is 10-13 spaces wide and the bottom 40% of the screen is HUD), fit with Lumen (light, glass, darkness, calm), glitches (flashes, pops, snaps, things leaving the frame, a jump at the end), the time budget and game state, and how cleanly it ports (what it leans on that only the lab provides).',
  },
]

phase('Judge')
const verdicts = await parallel(
  JUDGES.map((J) => () =>
    agent(
      `${CONTEXT}

${J.brief}

How to judge: look at every entry's contact sheet with the Read tool. For every contender, look closer at the video itself: pull frames with ffmpeg into your own scratch folder, for example \`ffmpeg -loglevel error -i labs/animations/out/${S}/<entry>.mp4 -vf "fps=10,scale=480:-1,tile=6x5" <scratch>/<entry>-strip.jpg\`, or single frames with \`-ss <seconds> -frames:v 1\`. Judge what is on screen, not what the code or its description promises. Work on your own: do not open ${DIR}/judging-*.* (another judge's verdict).

Score every entry from 1 to 10 on: delight, surprise (not a cliché), clarity (the game state reads), lumen (made of Lumen's light and glass), craft (timing and polish, no glitches), repeat (holds up as often as this moment happens), and overall (your judgement, not an average). Then name your winner and runner-up: they may be two versions of the same idea if that's what you believe. For each, say why in two or three sentences, and note what to fix or watch when porting it into the game.

Write your verdict to ${DIR}/judging-${J.key}.md (a table of scores, then the winner and runner-up with your reasons) and the same data as JSON to ${DIR}/judging-${J.key}.json, shaped like your structured answer. Touch no other files.`,
      { label: `judge:${S}:${J.key}`, phase: 'Judge', schema: VERDICT },
    ),
  ),
)

// combined: the two overall scores added; ties go to the higher combined delight
const by = {}
for (const [i, v] of verdicts.entries()) {
  for (const s of v?.scores ?? []) {
    by[s.entry] ??= { entry: s.entry, total: 0, delight: 0, scores: {} }
    by[s.entry].total += s.overall
    by[s.entry].delight += s.delight
    by[s.entry].scores[JUDGES[i].key] = s.overall
  }
}
const ranked = Object.values(by).sort((a, b) => b.total - a.total || b.delight - a.delight)
return {
  scenario: S,
  winner: ranked[0] ?? null,
  runner_up: ranked[1] ?? null,
  ranked,
  judges: verdicts.map((v, i) => ({ judge: JUDGES[i].key, winner: v?.winner ?? null, runner_up: v?.runner_up ?? null, failed: !v })),
}
