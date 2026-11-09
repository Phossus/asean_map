// Crossfading background slideshow for the blue hero section.
// Drop images named hero-1.jpg, hero-2.jpg ... (up to hero-6, jpg/png/webp/svg) into assets/images/hero/.
// With no images it cycles three placeholder slides so you can see the effect.
import { firstImage } from './logo.js';

const MAX_SLIDES = 6;
const INTERVAL_MS = 6000;

export async function initHero() {
  const box = document.querySelector('[data-hero-slides]');
  const toggle = document.querySelector('[data-hero-toggle]');
  if (!box) return;

  const found = await Promise.all(
    Array.from({ length: MAX_SLIDES }, (_, i) => firstImage(['/assets/images/hero/hero-' + (i + 1)], true)));
  const urls = found.filter(Boolean);
  const slides = (urls.length ? urls : [null, null, null]).map((url, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero__slide';
    if (url) {
      slide.style.backgroundImage = 'url("' + url + '")';
    } else {
      slide.classList.add('hero__slide--placeholder');
      const label = document.createElement('span');
      label.className = 'hero__slide-label';
      label.textContent = '[MOTORCYCLE IMAGE ' + (i + 1) + ']';
      slide.append(label);
    }
    return slide;
  });
  box.replaceChildren(...slides);
  slides[0].classList.add('is-active');
  if (slides.length < 2) return;

  let current = 0;
  let timer = null;
  const show = (n) => {
    slides[current].classList.remove('is-active');
    current = n % slides.length;
    slides[current].classList.add('is-active');
  };
  const play = () => { timer = setInterval(() => show(current + 1), INTERVAL_MS); };
  const stop = () => { clearInterval(timer); timer = null; };
  const label = () => { toggle.textContent = timer ? 'Pause slideshow' : 'Play slideshow'; };

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) play();
  if (toggle) {
    toggle.hidden = false;
    label();
    toggle.addEventListener('click', () => { if (timer) stop(); else play(); label(); });
  }
}
