// One phone. update(view) runs every time playerView() returns something new for this player.
import { html } from '../../js/ui.js';

export default function (root, api) {
  return {
    update(view) {
      root.innerHTML = html`
        <div class="center fill">
          <p class="big">You pressed it ${view.presses} times</p>
          <button class="btn btn-xl me" data-action="press">Press me!</button>
        </div>`;
    },
  };
}
