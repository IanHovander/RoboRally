// Tap Race: everyone mashes the button on their phone. First to the finish line wins.
// This is the simplest example game: read it first.

const GOAL = 50;
const COUNTDOWN_MS = 3000;

export default {
  name: 'Tap Race',
  description: 'Tap your phone as fast as you can. First to the finish line wins!',
  minPlayers: 1,
  maxPlayers: 32,

  // Runs when the game starts. Returns the starting state.
  setup(ctx) {
    ctx.timer('go', COUNTDOWN_MS, () => {
      ctx.state.phase = 'go';
    });
    return {
      phase: 'countdown', // countdown -> go -> done
      goAt: Date.now() + COUNTDOWN_MS,
      taps: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
      winnerId: null,
    };
  },

  // Someone joined mid-game: let them race too.
  onJoin(ctx, player) {
    ctx.state.taps[player.id] = 0;
  },

  // Phones call these with api.send('tap').
  actions: {
    tap(ctx, player) {
      const s = ctx.state;
      if (s.phase !== 'go') return;
      s.taps[player.id] = (s.taps[player.id] ?? 0) + 1;
      if (s.taps[player.id] >= GOAL) {
        s.phase = 'done';
        s.winnerId = player.id;
      }
    },
  },

  // What the big screen sees.
  hostView(ctx) {
    const s = ctx.state;
    return {
      phase: s.phase,
      goAt: s.goAt,
      goal: GOAL,
      winner: ctx.player(s.winnerId),
      lanes: ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color, taps: s.taps[p.id] ?? 0 })),
    };
  },

  // What one phone sees.
  playerView(ctx, player) {
    const s = ctx.state;
    const mine = s.taps[player.id] ?? 0;
    return {
      phase: s.phase,
      goAt: s.goAt,
      goal: GOAL,
      taps: mine,
      place: 1 + Object.values(s.taps).filter((n) => n > mine).length,
      won: s.winnerId === player.id,
      winnerName: ctx.player(s.winnerId)?.name ?? null,
    };
  },
};
