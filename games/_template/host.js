// The big screen. update(view) runs every time hostView() returns something new.
import { html } from '../../js/ui.js';

export default function (root, api) {
  return {
    update(view) {
      root.innerHTML = html`
        <div class="center fill">
          <h1 class="huge">Button Mash</h1>
          <div class="row">
            ${view.players.map((p) => html`<div class="card big"><span class="pc" style="--c:${p.color}">${p.name}</span> ${p.presses}</div>`)}
          </div>
        </div>`;
    },
  };
}
