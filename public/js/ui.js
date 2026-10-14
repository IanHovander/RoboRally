// Small helpers for drawing screens. Games can import these:
//   import { html } from '../../js/ui.js';   (from a game's host.js / player.js)

class SafeHtml {
  constructor(text) { this.text = text; }
  toString() { return this.text; }
}

/** Make text safe to put inside HTML (player names can contain anything). */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Build HTML with values escaped automatically:
 *   root.innerHTML = html`<b style="color:${p.color}">${p.name}</b>`;
 * Arrays are joined, and null / undefined / true / false print nothing,
 * so `${cond && html`...`}` and `${list.map(x => html`...`)}` both work.
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += toHtml(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** Insert a string as HTML without escaping. Only for HTML you wrote yourself. */
export function raw(text) {
  return new SafeHtml(String(text));
}

function toHtml(value) {
  if (value == null || value === false || value === true) return '';
  if (value instanceof SafeHtml) return value.text;
  if (Array.isArray(value)) return value.map(toHtml).join('');
  return esc(value);
}

/** Load a stylesheet once. Resolves when it has loaded (or failed). */
export function loadCss(href) {
  const url = new URL(href, location.href).href;
  const existing = [...document.querySelectorAll('link[data-game-css]')].find((l) => l.href === url);
  if (existing) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.gameCss = '';
    link.onload = link.onerror = () => resolve();
    document.head.append(link);
  });
}

/**
 * Clicking anything with data-action sends that action to the game:
 *   <button data-action="vote" data-payload="${id}">       -> api.send('vote', id)
 *   <button data-action="move" data-payload='{"x":1}'>     -> api.send('move', {x: 1})
 *   <form data-action="answer"><input name="text"></form>  -> api.send('answer', {text: '...'})
 */
export function wireActions(root, send) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'FORM' || !root.contains(el)) return;
    e.preventDefault();
    send(el.dataset.action, parsePayload(el.dataset.payload));
  });
  root.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-action]');
    if (!form) return;
    e.preventDefault();
    send(form.dataset.action, Object.fromEntries(new FormData(form)));
  });
}

function parsePayload(text) {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Any element with data-deadline="<server timestamp>" shows the seconds left. */
export function tickDeadlines(scope, now) {
  for (const el of scope.querySelectorAll('[data-deadline]')) {
    const left = Math.max(0, Math.ceil((Number(el.dataset.deadline) - now) / 1000));
    const text = String(left);
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('deadline-low', left <= 5);
  }
}
