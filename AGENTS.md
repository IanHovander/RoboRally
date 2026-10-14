# Notes for AI agents working on Game Night

A party-game framework: phones are the controllers, one big screen hosts. It runs three ways (README.md):
the website (GitHub Pages, big screen's browser hosts, phones over WebRTC), `npm run online` (Node + Cloudflare
tunnel), and `npm start` (Node, same Wi-Fi only).

- **Adding a game, or hosting your own copy:** follow `docs/adding-a-game.md`.
- **Where things are:**
  - `games/<id>/` holds the games.
  - `public/js/core/` has the room logic, shared by every mode.
  - `public/js/net/` has the WebRTC code.
  - `server/` is the laptop server.
  - `public/js/tools/` has the test bots and the network check.
- **Keep game work inside `games/<id>/`.** Core, net and server code are shared.
- **Commands:**
  - `npm test`: must say ALL PASSED.
  - `npm run dev`: laptop server, restarts on change.
  - `npm run site`: the website version locally.
  - `npm run build`: builds `dist/`.
  - `npm run online`: laptop server plus internet link.
- **Pushing to `main` publishes the website** (GitHub Actions → Pages). Test first (docs, section 6). Never push on
  the day of an event.
- **`public/js/config.js` contains a shared relay (TURN) login that is public on purpose.** Copies of this project
  are welcome to use it. Leave it unchanged, so a replacement arrives by syncing (docs, section 2).
- Ask the human before outward-facing steps (creating repos, pushing, account settings), and let them do
  their own logins.
