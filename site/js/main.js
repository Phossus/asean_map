import { initNavToggle } from './modules/nav-toggle.js';
import { initTextSize } from './modules/text-size.js';
import { initContrast } from './modules/contrast.js';
import { initRatings } from './modules/ratings.js';
import { initLogos } from './modules/logo.js';
import { initStats } from './modules/stats.js';
import { initHero } from './modules/hero.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavToggle();
  initTextSize();
  initContrast();
  initRatings();
  initLogos();
  initStats();
  initHero();
});
