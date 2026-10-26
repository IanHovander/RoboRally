import { avatar, design, ROBOTS } from './avatar.js';
import { html, loadCss } from './ui.js';

/** Mount inside a dedicated lobby element. Pass the socket and self.you (or self).
 * Call update(self.you) after each self event, and destroy() before removing the root.
 * Styles load automatically. Room state owns persistence, including page reconnects.
 */
export function mountAvatarPicker(root, socket, currentSelf) {
  void loadCss(new URL('../css/avatar-picker.css', import.meta.url).href);
  let you, pending = false, dead = false, timer;
  root.innerHTML = html`<fieldset class="avatar-picker"><legend>Choose your robot</legend>
    <div class="avatar-picker-grid">${ROBOTS.map(({ id, name }) => html`
      <button type="button" class="avatar-picker-choice" data-avatar="${id}" aria-pressed="false">
        <span class="avatar-picker-picture"></span><span>${name}</span>
      </button>`)}</div><p class="avatar-picker-status" role="status" aria-live="polite"></p></fieldset>`;
  const status = root.querySelector('.avatar-picker-status');
  const buttons = [...root.querySelectorAll('[data-avatar]')];
  function update(self) {
    you = self?.you ?? self;
    for (const button of buttons) {
      const id = Number(button.dataset.avatar);
      button.disabled = !you?.id || pending;
      button.setAttribute('aria-pressed', String(!!you?.id && design(you) === id));
      button.querySelector('.avatar-picker-picture').innerHTML = avatar(you, { pose: id });
    }
  }
  function choose(event) {
    const button = event.target.closest('[data-avatar]');
    if (!button || !root.contains(button) || !you?.id || pending || button.disabled) return;
    pending = true;
    update(you);
    status.textContent = 'Saving your robot…';
    let finished = false;
    const finish = (res) => {
      if (dead || finished) return;
      finished = true;
      clearTimeout(timer);
      pending = false;
      status.textContent = res?.ok ? 'Robot selected!' : (res?.error ?? 'Could not save. Please try again.');
      update(res?.ok ? { ...you, avatar: res.avatar } : you);
    };
    timer = setTimeout(() => finish(null), 8000);
    try { socket.emit('avatar', { avatar: Number(button.dataset.avatar) }, finish); }
    catch { finish(null); }
  }
  root.addEventListener('click', choose);
  update(currentSelf);
  return { update, destroy() { dead = true; clearTimeout(timer); root.removeEventListener('click', choose); root.replaceChildren(); } };
}
