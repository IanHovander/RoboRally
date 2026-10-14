// A tiny game to copy when making your own.
//   1. Copy this folder and rename it, e.g. games/my-game  (folders starting with _ are ignored)
//   2. Restart the server (or `npm run build` for the website). Your game shows up in the lobby.
//
// This file runs in one place (the laptop server, or the big screen's browser on the website), and
// that's the only place the real game state lives. Phones and the big screen's display never see the
// state directly, only the "views" you build below.

export default {
  name: 'Button Mash',
  description: 'Press the button. That is the whole game.',
  minPlayers: 1,
  maxPlayers: 8,

  // Called when the game starts. Return the starting state (plain data: objects, arrays, numbers, strings).
  setup(ctx) {
    return { presses: {} };
  },

  // Things phones can do. On the phone, api.send('press') (or a <button data-action="press">) runs this.
  actions: {
    press(ctx, player, payload) {
      ctx.state.presses[player.id] = (ctx.state.presses[player.id] ?? 0) + 1;
    },
  },

  // What the big screen gets.
  hostView(ctx) {
    return {
      players: ctx.players.map((p) => ({ name: p.name, color: p.color, presses: ctx.state.presses[p.id] ?? 0 })),
    };
  },

  // What one phone gets. Only include what this player is allowed to know.
  playerView(ctx, player) {
    return { presses: ctx.state.presses[player.id] ?? 0 };
  },
};
