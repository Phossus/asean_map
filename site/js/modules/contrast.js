import { store } from './storage.js';
const KEY = 'asean-map:contrast';

export function initContrast() {
  const button = document.querySelector('[data-contrast-toggle]');
  const set = (on) => {
    document.documentElement.dataset.theme = on ? 'high-contrast' : '';
    button?.setAttribute('aria-pressed', String(on));
    store.set(KEY, on ? 'on' : 'off');
  };
  set(store.get(KEY) === 'on');
  button?.addEventListener('click', () => set(button.getAttribute('aria-pressed') !== 'true'));
}
