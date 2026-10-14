// Phone for Odd One Out.
import { html } from '../../js/ui.js';
import { avatar } from '../../js/avatar.js';

export default function (root, api) {
  let view = null;
  let round = null;
  let peek = false; // is the secret card turned over?
  let draft = ''; // what's typed in the clue box, kept across redraws
  let error = '';

  root.addEventListener('click', (e) => {
    if (!e.target.closest('[data-peek]')) return;
    peek = !peek;
    draw();
  });
  root.addEventListener('input', (e) => {
    if (e.target.name === 'clue') draft = e.target.value;
  });
  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = e.target.querySelector('button');
    button.disabled = true;
    const res = await api.send('clue', { clue: draft });
    error = res?.error ?? '';
    if (error) draw();
    else button.disabled = false;
  });

  function draw() {
    const v = view;
    root.innerHTML = html`
      <div class="ooo-phone">
        <div class="ooo-top">
          <span>Round ${v.round}</span>
          <span>${v.category}</span>
          ${v.deadline && html`<span class="timer" data-deadline="${v.deadline}"></span>`}
        </div>
        ${phase(v)}
      </div>`;
    const input = root.querySelector('input[name=clue]');
    if (input && error) input.focus();
  }

  function phase(v) {
    if (v.phase === 'reveal') {
      return html`
        ${secretCard(v, true)}
        ${v.ready
          ? html`<p class="ooo-wait">Waiting for everyone else…</p>`
          : html`<button class="btn btn-xl block" data-action="ready">Got It!</button>`}`;
    }

    if (v.phase === 'clue') {
      if (v.myClue) {
        return html`
          ${secretCard(v)}
          <div class="card center">
            <span class="muted">Your clue</span>
            <span class="big">${v.myClue}</span>
            <span class="muted">Waiting for the others…</span>
          </div>`;
      }
      return html`
        ${secretCard(v)}
        <form class="ooo-form">
          <label for="clue">${v.isSpy ? 'Bluff! Give a clue that fits the category.' : 'Give a one-word clue about the word.'}</label>
          <input id="clue" name="clue" value="${draft}" maxlength="24" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send">
          <button class="btn btn-xl block">Send Clue</button>
          ${error && html`<p class="form-error">${error}</p>`}
        </form>`;
    }

    if (v.phase === 'vote') {
      return html`
        <h2 class="ooo-h">Who's the Spy?</h2>
        <div class="ooo-choices">
          ${v.choices.map(
            (c) => html`
              <button class="ooo-choice ${c.id === v.myVote && 'picked'}" style="--c:${c.color}"
                      data-action="vote" data-payload="${JSON.stringify({ playerId: c.id })}">
                <span class="ooo-choice-who">${avatar(c)}<span class="ooo-choice-name">${c.name}</span></span>
                <span class="ooo-choice-clue">${c.clue ?? '(no clue)'}</span>
              </button>`,
          )}
        </div>
        <p class="muted small center">${v.myVote ? 'Vote counted. You can change it until everyone has voted.' : 'Tap a player.'}</p>`;
    }

    // result
    const headline = v.isSpy
      ? v.caught ? 'You Got Caught! 😱' : 'You Got Away With It! 😎'
      : v.caught ? 'Spy Caught! 🎉' : 'The Spy Escaped! 😈';
    return html`
      <div class="ooo-result center">
        <h1>${headline}</h1>
        ${!v.isSpy && html`<p class="big">The spy was ${v.spyName}</p>`}
        <p>The word was <b>${v.secretWord}</b></p>
        <p class="ooo-points">${v.gained ? `+${v.gained} Point${v.gained === 1 ? '' : 's'}!` : 'No Points This Round'}</p>
        <p class="muted">Your score: <b>${v.score}</b></p>
      </div>
      ${v.isVip
        ? html`<button class="btn btn-xl block" data-action="next">Next Round</button>`
        : html`<p class="ooo-wait">Waiting for the next round…</p>`}`;
  }

  function secretCard(v, large = false) {
    if (!peek) {
      return html`
        <button type="button" class="ooo-secret ${large && 'large'} face-down" data-peek>
          <span class="ooo-secret-label">Tap to see your secret</span>
          <span class="muted small">Don't let anyone peek!</span>
        </button>`;
    }
    return v.isSpy
      ? html`
        <button type="button" class="ooo-secret ${large && 'large'} spy" data-peek>
          <span class="ooo-secret-label">You are the</span>
          <span class="ooo-secret-word">Spy 🕵️</span>
          <span class="small">You don't know the word. Blend in!</span>
        </button>`
      : html`
        <button type="button" class="ooo-secret ${large && 'large'}" data-peek>
          <span class="ooo-secret-label">The secret word is</span>
          <span class="ooo-secret-word">${v.word}</span>
          <span class="muted small">Tap to hide</span>
        </button>`;
  }

  return {
    update(next) {
      if (next.round !== round) {
        round = next.round; // new round: hide the card and clear the clue box
        peek = false;
        draft = '';
      }
      if (next.phase !== view?.phase) {
        error = '';
        peek = false; // turn the secret back over so nobody glimpses it while passing the phone around
      }
      view = next;
      draw();
    },
  };
}
