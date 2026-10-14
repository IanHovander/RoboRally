// Odd One Out: everyone's phone shows the same secret word, except the spy's.
// Everyone types a clue, the clues appear on the big screen, then everyone votes on who the spy is.
//
// This example shows: secret per-player info (playerView), phases, timers,
// actions that reply with an error, and buttons on the big screen (hostActions).
import { CATEGORIES } from './words.js';

const CLUE_SECONDS = 60;
const VOTE_SECONDS = 45;

export default {
  name: 'Odd One Out',
  description: "Everyone gets the same secret word except the spy. Give a clue, then vote out the spy!",
  minPlayers: 3,
  maxPlayers: 24,

  setup(ctx) {
    ctx.state = { round: 0, scores: {}, usedWords: [], spyId: null };
    newRound(ctx);
  },

  // If someone drops out, don't make everybody wait for them.
  onDisconnect(ctx) {
    maybeAdvance(ctx);
  },

  actions: {
    ready(ctx, player) {
      if (ctx.state.phase !== 'reveal') return;
      ctx.state.ready[player.id] = true;
      maybeAdvance(ctx);
    },

    clue(ctx, player, payload) {
      const s = ctx.state;
      if (s.phase !== 'clue') return;
      const clue = String(payload?.clue ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
      if (!clue) return { error: 'Type a clue first!' };
      if (player.id !== s.spyId && givesItAway(clue, s.word)) {
        return { error: "That gives the word away! Try something sneakier." };
      }
      s.clues[player.id] = clue;
      maybeAdvance(ctx);
      return { ok: true };
    },

    vote(ctx, player, payload) {
      const s = ctx.state;
      const target = payload?.playerId;
      if (s.phase !== 'vote' || target === player.id || !ctx.player(target)) return;
      s.votes[player.id] = target; // you can change your mind until everyone has voted
      maybeAdvance(ctx);
    },

    next(ctx, player) {
      if (player.isVip && ctx.state.phase === 'result') newRound(ctx);
    },
  },

  // Buttons on the big screen.
  hostActions: {
    next(ctx) {
      if (ctx.state.phase === 'result') newRound(ctx);
    },
    skip(ctx) {
      advance(ctx);
    },
  },

  // The big screen must never see the word or the spy until the reveal.
  hostView(ctx) {
    const s = ctx.state;
    const reveal = s.phase === 'result';
    return {
      phase: s.phase,
      round: s.round,
      category: s.category,
      deadline: s.deadline,
      players: ctx.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        connected: p.connected,
        score: s.scores[p.id] ?? 0,
        done: hasActed(s, p.id),
        clue: s.phase === 'vote' || reveal ? s.clues[p.id] ?? null : null,
        votes: reveal ? s.result.tally[p.id] ?? 0 : null,
        gained: reveal ? s.result.gained[p.id] ?? 0 : null,
        isSpy: reveal ? p.id === s.spyId : null,
      })),
      result: reveal ? { caught: s.result.caught, word: s.word, spy: ctx.player(s.spyId) } : null,
    };
  },

  // Each phone learns only its own secret.
  playerView(ctx, me) {
    const s = ctx.state;
    const isSpy = me.id === s.spyId;
    const view = {
      phase: s.phase,
      round: s.round,
      category: s.category,
      deadline: s.deadline,
      isSpy,
      word: isSpy ? null : s.word,
      isVip: me.isVip,
      score: s.scores[me.id] ?? 0,
    };
    if (s.phase === 'reveal') view.ready = !!s.ready[me.id];
    if (s.phase === 'clue') view.myClue = s.clues[me.id] ?? null;
    if (s.phase === 'vote') {
      view.myVote = s.votes[me.id] ?? null;
      view.choices = ctx.players
        .filter((p) => p.id !== me.id)
        .map((p) => ({ id: p.id, name: p.name, color: p.color, clue: s.clues[p.id] ?? null }));
    }
    if (s.phase === 'result') {
      view.caught = s.result.caught;
      view.spyName = ctx.player(s.spyId)?.name ?? '?';
      view.secretWord = s.word;
      view.gained = s.result.gained[me.id] ?? 0;
    }
    return view;
  },
};

// ---------- the rules ----------

function newRound(ctx) {
  const s = ctx.state;
  const online = ctx.players.filter((p) => p.connected);
  const candidates = online.filter((p) => p.id !== s.spyId); // try not to pick the same spy twice in a row
  const category = ctx.pick(CATEGORIES);
  const fresh = category.words.filter((w) => !s.usedWords.includes(w));
  const word = ctx.pick(fresh.length ? fresh : category.words);
  s.usedWords.push(word);

  Object.assign(s, {
    round: s.round + 1,
    phase: 'reveal', // reveal -> clue -> vote -> result
    category: category.name,
    word,
    spyId: ctx.pick(candidates.length ? candidates : online.length ? online : ctx.players).id,
    ready: {},
    clues: {},
    votes: {},
    deadline: null,
    result: null,
  });
  for (const p of ctx.players) s.scores[p.id] ??= 0;
  ctx.cancelTimer('phase');
}

function startClues(ctx) {
  ctx.state.phase = 'clue';
  ctx.state.deadline = Date.now() + CLUE_SECONDS * 1000;
  ctx.timer('phase', CLUE_SECONDS * 1000, () => startVote(ctx));
}

function startVote(ctx) {
  ctx.state.phase = 'vote';
  ctx.state.deadline = Date.now() + VOTE_SECONDS * 1000;
  ctx.timer('phase', VOTE_SECONDS * 1000, () => showResult(ctx));
}

function showResult(ctx) {
  const s = ctx.state;
  ctx.cancelTimer('phase');
  const tally = {};
  for (const target of Object.values(s.votes)) tally[target] = (tally[target] ?? 0) + 1;

  // Caught = the spy got more votes than anyone else.
  const spyVotes = tally[s.spyId] ?? 0;
  const caught = spyVotes > 0 && Object.entries(tally).every(([id, n]) => id === s.spyId || n < spyVotes);

  // +1 for everyone who voted for the spy. +2 for the spy if they got away.
  const gained = {};
  for (const [voter, target] of Object.entries(s.votes)) if (target === s.spyId) gained[voter] = 1;
  if (!caught) gained[s.spyId] = 2;
  for (const [id, points] of Object.entries(gained)) s.scores[id] = (s.scores[id] ?? 0) + points;

  s.phase = 'result';
  s.deadline = null;
  s.result = { caught, tally, gained };
}

/** Move on to the next phase right now. */
function advance(ctx) {
  if (ctx.state.phase === 'reveal') startClues(ctx);
  else if (ctx.state.phase === 'clue') startVote(ctx);
  else if (ctx.state.phase === 'vote') showResult(ctx);
}

/** Move on once everyone who's still connected has done their bit. */
function maybeAdvance(ctx) {
  const online = ctx.players.filter((p) => p.connected);
  if (online.length && online.every((p) => hasActed(ctx.state, p.id))) advance(ctx);
}

function hasActed(s, id) {
  if (s.phase === 'reveal') return !!s.ready[id];
  if (s.phase === 'clue') return id in s.clues;
  if (s.phase === 'vote') return id in s.votes;
  return true;
}

function givesItAway(clue, word) {
  const words = (text) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const secret = words(word);
  const squash = (text) => words(text).join('');
  return squash(clue) === squash(word) || words(clue).some((w) => secret.includes(w) || secret.includes(w.replace(/e?s$/, '')));
}
