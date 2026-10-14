// Phone for Tap Race: one giant button.
import { html } from '/js/ui.js';

export default function (root, api) {
  root.innerHTML = `
    <div class="tr-phone">
      <div class="tr-msg"></div>
      <button class="tr-tap off" type="button">TAP!</button>
      <div class="tr-progress"><div class="tr-progress-fill"></div></div>
      <div class="tr-mine"></div>
    </div>`;
  const msg = root.querySelector('.tr-msg');
  const button = root.querySelector('.tr-tap');
  const fill = root.querySelector('.tr-progress-fill');
  const mine = root.querySelector('.tr-mine');
  let live = false;

  // pointerdown fires the instant a finger lands, which is faster than 'click'.
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!live) return;
    api.send('tap');
    api.vibrate(8);
    button.classList.remove('bump');
    void button.offsetWidth; // restart the animation
    button.classList.add('bump');
  });

  return {
    update(view) {
      live = view.phase === 'go';
      button.classList.toggle('off', !live);
      fill.style.width = `${Math.min(100, (view.taps / view.goal) * 100)}%`;

      if (view.phase === 'countdown') {
        msg.innerHTML = html`Get ready… <span class="timer" data-deadline="${view.goAt}"></span>`;
        button.textContent = 'WAIT';
        mine.textContent = `First to ${view.goal} wins`;
      } else if (view.phase === 'go') {
        msg.textContent = 'GO GO GO!';
        button.textContent = 'TAP!';
        mine.textContent = `${view.taps} / ${view.goal}`;
      } else {
        msg.textContent = view.won ? '🏆 You win!' : `${view.winnerName} wins!`;
        button.textContent = view.won ? '🏆' : `#${view.place}`;
        mine.textContent = `You got ${view.taps} taps`;
      }
    },
  };
}
