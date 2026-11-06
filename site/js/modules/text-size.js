import { store } from './storage.js';
const KEY = 'asean-map:text-size';
const MIN = 90, MAX = 140, STEP = 10;

export function initTextSize() {
  let size = Number(store.get(KEY, 100));
  const apply = () => { document.documentElement.style.fontSize = size + '%'; store.set(KEY, size); };
  apply();
  const change = (delta) => { size = delta === 0 ? 100 : Math.min(MAX, Math.max(MIN, size + delta)); apply(); };
  document.querySelector('[data-text-size="down"]')?.addEventListener('click', () => change(-STEP));
  document.querySelector('[data-text-size="reset"]')?.addEventListener('click', () => change(0));
  document.querySelector('[data-text-size="up"]')?.addEventListener('click', () => change(STEP));
}
