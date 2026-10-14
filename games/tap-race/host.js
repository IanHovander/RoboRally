// Big screen for Tap Race: one lane per player, runners move as people tap.
import { html } from '../../js/ui.js';
import { avatar } from '../../js/avatar.js';

export default function (root) {
  root.innerHTML = `
    <div class="tr-host">
      <div class="tr-banner"></div>
      <div class="tr-lanes"></div>
      <div class="tr-overlay"></div>
    </div>`;
  const banner = root.querySelector('.tr-banner');
  const lanesEl = root.querySelector('.tr-lanes');
  const overlay = root.querySelector('.tr-overlay');
  const lanes = new Map(); // player id -> lane elements, so runners glide instead of being redrawn
  let shownPhase = null;

  return {
    update(view) {
      if (view.phase !== shownPhase) {
        shownPhase = view.phase;
        banner.innerHTML = view.phase === 'countdown'
          ? html`Get Ready… <span class="tr-sub">First to ${view.goal} taps wins</span>`
          : view.phase === 'go'
            ? html`Tap Tap Tap! <span class="tr-sub">First to ${view.goal} taps wins</span>`
            : html`Race Over!`;
        overlay.innerHTML = view.phase === 'countdown'
          ? html`<div class="tr-countdown" data-deadline="${view.goAt}"></div>`
          : view.phase === 'done' && view.winner
            ? html`<div class="tr-winner" style="--c:${view.winner.color}">
                <div class="tr-trophy">${avatar(view.winner, { mood: 'happy' })}</div>
                <div class="tr-winner-name">${view.winner.name} Wins!</div>
              </div>`
            : '';
      }

      // More than 12 runners: two columns of lanes, so everyone still fits on one screen.
      const twoColumns = view.lanes.length > 12;
      lanesEl.classList.toggle('two-col', twoColumns);
      lanesEl.style.setProperty('--n', twoColumns ? Math.ceil(view.lanes.length / 2) : view.lanes.length);
      const present = new Set();
      for (const lane of view.lanes) {
        present.add(lane.id);
        let el = lanes.get(lane.id);
        if (!el) {
          const row = document.createElement('div');
          row.className = 'tr-lane';
          row.innerHTML = `
            <div class="tr-name"></div>
            <div class="tr-track"><div class="tr-fill"></div><div class="tr-runner"></div></div>
            <div class="tr-taps"></div>`;
          lanesEl.append(row);
          el = { row, name: row.querySelector('.tr-name'), runner: row.querySelector('.tr-runner'), taps: row.querySelector('.tr-taps') };
          el.runner.innerHTML = avatar(lane);
          lanes.set(lane.id, el);
        }
        el.row.style.setProperty('--c', lane.color);
        el.row.style.setProperty('--p', Math.min(1, lane.taps / view.goal));
        el.name.textContent = lane.name;
        el.taps.textContent = lane.taps;
      }
      for (const [id, el] of lanes) {
        if (!present.has(id)) {
          el.row.remove();
          lanes.delete(id);
        }
      }
    },
  };
}
