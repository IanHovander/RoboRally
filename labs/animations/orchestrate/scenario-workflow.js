export const meta = {
  name: 'robo-rally-animation-scenario',
  description: 'One Robo Rally moment (Lumen look): 50 animation ideas, pick 5, then 3 independent animators each animate all 5 in their own lens',
  phases: [
    { title: 'Ideate', detail: '50 ideas for the moment, clichés banned' },
    { title: 'Curate', detail: 'a fresh reader picks the 5 most delightful' },
    { title: 'Animate', detail: '3 animators, each a different lens, each animates all 5' },
  ],
}

const S = args.scenario
const DIR = `labs/animations/${S}`

const CONTEXT = `Robo Rally in this repo (Game Night: phones are controllers, one big TV hosts) is a party game. Each round players secretly program 5 cards on their phones, then the registers play out on the TV beat by beat: robots move one at a time, board elements act (belts, push panels, gears), lasers fire, flags and batteries pay out. A room of friends watches the TV together: the animations are the show.

The team has chosen the look called **Lumen** (looks/three/: read the pick at the bottom of looks/three/concepts.md; the big screen is looks/three/games/robo-rally/scene.js). A slab of smoked glass floats in a dark room and every board element is drawn with light: belts are slow streams of light under the glass, pits are holes where the light is missing, walls are bright fins, lasers are lines of light, checkpoints are columns of light. Robots are polished forms (Pebble, Orb, Prism, Capsule, Cube, Spire) in their player's colour, each with a light (its eye) at the front, a ring of light on the glass and a pointer showing which way it faces; they leave a fading trail of light where they go. One material (smoked glass), one light (warm white) plus the players' own colours, thin type, soft glass-chime sounds; minimal, abstract and calm, with no neon grid, chrome or gimmicks. Animations must be made of Lumen's materials: light, glass, darkness, colour, reflection, refraction, trails, glow. A delightful idea may break the look on purpose for a beat, but it comes home to it.

The person running this said: "We're trying to delight with the animations. Obvious ideas are cliché, though a twist, or the way they're animated, could make them delightful. The ultimate goal is to delight and surprise, so breaking the rules isn't entirely bad as long as the game can somehow continue playing within the rules."

There is an animation lab for this: labs/animations/README.md explains it (the game's real arena on a tiny board, robots you can puppet, the camera, slow motion, a DOM overlay; prototypes are silent and use no image files). The moment you are working on is the "${S}" entry in labs/animations/scenarios.js: read it for what happens, the rule, how often it happens, the time budget and the before/after state. What the game shows today is in labs/animations/out/${S}/baseline.sheet.jpg (a contact sheet; look at it with the Read tool).`

const IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    banned: { type: 'array', items: { type: 'string' }, description: 'the obvious treatments you banned' },
    count: { type: 'integer', description: 'how many ideas you wrote to ideas.md' },
  },
  required: ['banned', 'count'],
}

const PICKS_SCHEMA = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          idea: { type: 'integer', description: 'its number in ideas.md' },
          title: { type: 'string' },
          description: { type: 'string' },
          twist: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['n', 'idea', 'title', 'description', 'twist', 'why'],
      },
    },
  },
  required: ['picks'],
}

const ANIM_SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          file: { type: 'string' },
          title: { type: 'string' },
          what: { type: 'string', description: '1-2 sentences: what the viewer sees' },
          delight: { type: 'string', description: 'why it delights' },
          moment_seconds: { type: 'number' },
          rendered: { type: 'boolean', description: 'final (non-preview) render done with zero warnings' },
          notes: { type: 'string' },
        },
        required: ['n', 'file', 'title', 'what', 'delight', 'moment_seconds', 'rendered'],
      },
    },
    lab_issues: { type: 'string', description: 'anything in the lab that got in your way' },
  },
  required: ['entries'],
}

const LENSES = [
  {
    key: 'a',
    name: 'Weight & physical comedy',
    brief: 'Everything has mass. Momentum, inertia, overshoot, wobble, recoil, things that topple, bounce, ricochet and settle; cause and effect you can feel. Exaggerated real physics with slapstick timing (Pixar shorts, Buster Keaton, Rube Goldberg machines). In Lumen the physics is of glass and light too: polished forms that clink, slide and spin on glass, glass that flexes, rings, ripples, cracks and heals, light that refracts, pools, spills and drips, trails that whip and snap like ribbons.',
  },
  {
    key: 'b',
    name: 'Character acting',
    brief: 'The robots are actors with feelings. Anticipation, double-takes, reactions, pride, embarrassment, indignation, smugness; the victim, the culprit AND the bystanders react. Body language through pitch, roll, squash and stretch, eye glow and timing. Think WALL-E, Aardman, Looney Tunes. Delight comes from personality, and from small details that reward watching again.',
  },
  {
    key: 'c',
    name: 'Cinematic & graphic staging',
    brief: 'How the moment is told is the show: camera moves and framing, slow motion and freeze frames, light and colour changes, graphic language drawn in light (long exposures, light painting, freeze-frames that leave a ghost, the darkness of the room opening and closing like an iris, the glass becoming a lens), the dark room itself reacting. Think long-exposure photography, light installations (Turrell, teamLab), the timing of Edgar Wright, sports replays. Scale the staging to how often the moment happens: frequent moments get small, crisp graphic touches; rare ones can take over the screen.',
  },
]

// args: { scenario, picks?, lenses? }. With picks (the moment's picks.json array, or 'file' to have the animators read
// it themselves) the ideas and the curation are skipped;
// lenses (e.g. ['c']) runs only those animators.
let ideas = null
let curated = args.picks ? { picks: Array.isArray(args.picks) ? args.picks : [] } : null
if (!curated) {
phase('Ideate')
ideas = await agent(
  `${CONTEXT}

Your job: generate 50 animation ideas for this one moment.

1. First list the ~10 most obvious treatments of this moment, the ones anyone would think of first (sparks, a POW, a generic spin, a camera shake, a generic glow burst...). They are banned as they are.
2. Then write 50 distinct ideas. Each: a short title, 1-2 sentences of what the room sees, and the twist: what makes it surprising or delightful. Spread them across very different sources of delight, for example: physical comedy; the robots' personalities; Lumen's own materials (light, glass, trails, the dark room, reflection, refraction, the columns of light, the streams under the glass); the board-game nature of it all; rhythm and music; camera and time; meta jokes (the TV, the players in the room, the game itself); absurd rule-bending that still resolves to the right game state; tiny details that reward repeat viewing; variation, if the moment happens often. A cliché may appear only if the twist genuinely transforms it.
3. Every idea must end with the game in the scenario's "after" state and fit its time budget; an idea that "breaks the rules" on screen must resolve back to them. Prefer ideas a single animator could build in the lab (3D primitives, the real robots, camera, overlays).

Write them to ${DIR}/ideas.md: a title line, a short "Banned (too obvious)" list, then the 50 numbered ideas, each formatted as: \`N. **Title.** What you see. *Twist:* the twist.\` Do not create any other files.`,
  { label: `ideas:${S}`, phase: 'Ideate', schema: IDEAS_SCHEMA },
)

phase('Curate')
curated = await agent(
  `${CONTEXT}

${DIR}/ideas.md has ${ideas?.count ?? 50} animation ideas for this moment, written by someone else. Pick the 5 to animate. Criteria, in order:
1. Delight and surprise for a room of friends watching a TV: would people laugh, gasp, or shout "again!"?
2. Not a cliché.
3. The 5 differ from each other: each one delights in a different way.
4. It holds up to repetition, given how often this moment happens in a game (see the scenario's "often").
5. Readable from across the room on a TV where a robot is small.
6. Buildable in the lab, ending in the correct game state within the time budget.
You may sharpen an idea's wording (keep its number). Write the picks to ${DIR}/picks.json as a JSON array of { "n": 1-5, "idea": its number in ideas.md, "title", "description", "twist", "why" }, and append a "## The five to animate" section to ${DIR}/ideas.md listing them with one line each on why. Touch no other files.`,
  { label: `curate:${S}`, phase: 'Curate', schema: PICKS_SCHEMA },
)
}
const picks = (curated?.picks ?? []).slice(0, 5)
if (args.picks !== 'file' && picks.length < 5) log(`${S}: only ${picks.length} picks came back`)
const pickText = args.picks === 'file'
  ? `Read them from ${DIR}/picks.json: for each pick, n, title, description and twist.`
  : picks.map((p) => `${p.n}. ${p.title} (idea ${p.idea}): ${p.description} Twist: ${p.twist}`).join('\n')

phase('Animate')
const ACTIVE = LENSES.filter((L) => !args.lenses || args.lenses.includes(L.key))
const animators = await parallel(
  ACTIVE.map((L) => () =>
    agent(
      `${CONTEXT}

You are animator "${L.key}" for this moment. Two other animators, working separately, animate the same five ideas their own way; whoever compares will watch the three versions side by side, so commit fully to YOUR lens:
**${L.name}.** ${L.brief}

Read first: labs/animations/README.md (the lab and its API; follow it), the "${S}" entry in labs/animations/scenarios.js, labs/animations/push/_example.js (a small worked example), and the baseline sheet labs/animations/out/${S}/baseline.sheet.jpg (today's animation: yours must be far more delightful). Skim games/robo-rally/scene.js (the Arena: playBeat, beam, fall, particles, the board's parts) and games/robo-rally/bots3d.js (the robot models' parts) as you need them.

The five ideas (also in ${DIR}/picks.json):
${pickText}

For each idea n, write ${DIR}/${'${n}'}${L.key}-<short-slug>.js (for example ${DIR}/1${L.key}-...js): your own interpretation of that idea through your lens, with a meta { title, idea, notes } as the README shows. Honour the idea's twist; you may reinterpret how it's shown. Process for each entry: write it, render a preview, Read the contact sheet, fix timing, staging and readability, and repeat (at least two look-and-fix rounds; use --every 0.0333 to study fast parts frame by frame), then do one final render without --preview. An entry is done when its final render has zero warnings. Renders queue for a machine-wide slot, so run them with a 10-minute Bash timeout.

Quality bar: this is about delight. Timing is everything: anticipation, impact, follow-through, holds, contrast between fast and slow. Robots should feel like characters even when the idea is physical. One clear focal point at a time, readable from across a room. Stay inside the time budget, and end exactly in the scenario's "after" state with the camera home.

An earlier attempt at this job was cut off by a usage limit. If any of your own files (${DIR}/<n>${L.key}-*.js) already exist, they are your earlier work: review them, keep what is good and finish them rather than starting over (render each one to check it). Be economical with tokens: grep or read only the parts of scene.js and bots3d.js you need, and prefer --preview renders until an entry is nearly done.

Rules: write only your five files (never edit lab.js, scenarios.js, render.mjs, the game, or anyone else's files); do not open other animators' entries in ${DIR}/ (your versions must be independent); no git commands that change anything. If the lab gets in your way, work around it inside your own file and say so in lab_issues.`,
      { label: `animate:${S}:${L.key}`, phase: 'Animate', schema: ANIM_SCHEMA },
    ),
  ),
)

return {
  scenario: S,
  banned: ideas?.banned ?? [],
  picks,
  animators: animators.map((r, i) => ({ lens: ACTIVE[i].key, name: ACTIVE[i].name, ...(r ?? { entries: [], failed: true }) })),
}
