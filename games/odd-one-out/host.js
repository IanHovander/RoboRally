// Big screen for Odd One Out.
import { html } from '../../js/ui.js';
import { avatar } from '../../js/avatar.js';

export default function (root) {
  let shown = null;

  return {
    update(v) {
      // Cards pop in when a phase starts, not every time someone votes.
      const fresh = shown !== `${v.round}:${v.phase}`;
      shown = `${v.round}:${v.phase}`;
      root.innerHTML = html`
        <div class="ooo-host ${fresh && 'fresh'} ${v.players.length > 12 && 'many'}">
          <header class="ooo-head">
            <span class="ooo-round">Round ${v.round}</span>
            <span class="ooo-cat">Category: <b>${v.category}</b></span>
            <span class="spacer"></span>
            ${v.deadline && html`<span class="timer timer-lg" data-deadline="${v.deadline}"></span>`}
            ${v.phase !== 'result' && html`<button class="btn btn-sm secondary" data-action="skip">Skip ▸</button>`}
          </header>
          <div class="ooo-body">${body(v)}</div>
        </div>`;
    },
  };
}

function body(v) {
  if (v.phase === 'reveal') {
    return html`
      <div class="ooo-title">
        <h1>Look at Your Phone, Secretly! 🤫</h1>
        <p>Everyone gets the same secret word, except one spy who doesn't know it.</p>
      </div>
      ${statusGrid(v.players, 'ready')}`;
  }
  if (v.phase === 'clue') {
    return html`
      <div class="ooo-title">
        <h1>Type a Clue on Your Phone</h1>
        <p>Prove you know the word without giving it away. Spy: bluff!</p>
      </div>
      ${statusGrid(v.players, 'sent')}`;
  }
  if (v.phase === 'vote') {
    return html`
      <div class="ooo-title">
        <h1>Who Is the Spy?</h1>
        <p>Read the clues, argue it out, then vote on your phone.</p>
      </div>
      <div class="ooo-clues">
        ${v.players.map(
          (p) => html`
            <div class="ooo-clue ${p.done && 'done'}" style="--c:${p.color}">
              <span class="ooo-clue-name">${avatar(p)}${p.name}</span>
              <span class="ooo-clue-text">${p.clue ?? '…'}</span>
              <span class="ooo-badge">${p.done ? 'voted' : ''}</span>
            </div>`,
        )}
      </div>`;
  }

  // result
  const { caught, word, spy } = v.result;
  const ranked = [...v.players].sort((a, b) => b.score - a.score);
  const TOP = 10; // with a big group, show the leaders; everyone sees their own score on their phone
  const more = ranked.length - TOP;
  return html`
    <div class="ooo-reveal">
      <div class="ooo-reveal-main">
        <div class="ooo-title">
          <h1>${caught ? 'Spy Caught! 🎉' : 'The Spy Got Away! 😈'}</h1>
          <p class="ooo-reveal-line">The spy was <b class="pc" style="--c:${spy?.color}">${spy?.name}</b>, and the word was <b>${word}</b>.</p>
        </div>
        <div class="ooo-clues">
          ${v.players.map(
            (p) => html`
              <div class="ooo-clue ${p.isSpy && 'spy'}" style="--c:${p.color}">
                <span class="ooo-clue-name">${avatar(p, { mood: p.isSpy && !caught ? 'happy' : undefined })}${p.name} ${p.isSpy && '🕵️'}</span>
                <span class="ooo-clue-text">${p.clue ?? '…'}</span>
                <span class="ooo-badge">${p.votes} vote${p.votes === 1 ? '' : 's'}</span>
              </div>`,
          )}
        </div>
      </div>
      <aside class="ooo-scores">
        <h2>Scores</h2>
        ${ranked.slice(0, TOP).map(
          (p) => html`
            <div class="ooo-score" style="--c:${p.color}">
              ${avatar(p)}
              <span class="pc">${p.name}</span>
              ${p.gained > 0 && html`<span class="ooo-gain">+${p.gained}</span>`}
              <b>${p.score}</b>
            </div>`,
        )}
        ${more > 0 && html`<div class="muted small">…and ${more} more</div>`}
        <button class="btn btn-xl block" data-action="next">Next Round ▸</button>
      </aside>
    </div>`;
}

function statusGrid(players, doneWord) {
  return html`
    <div class="ooo-status">
      ${players.map(
        (p) => html`
          <div class="ooo-player ${p.done && 'done'} ${!p.connected && 'away'}" style="--c:${p.color}">
            ${avatar(p, { mood: p.done ? 'happy' : undefined })}
            <span class="ooo-player-text">
              <span class="ooo-player-name">${p.name}</span>
              <span class="ooo-check">${p.done ? `✓ ${doneWord}` : p.connected ? '…' : 'away'}</span>
            </span>
          </div>`,
      )}
    </div>`;
}
