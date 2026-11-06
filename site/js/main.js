import { initNavToggle } from './modules/nav-toggle.js';
import { initTextSize } from './modules/text-size.js';
import { initContrast } from './modules/contrast.js';
import { initRatings } from './modules/ratings.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavToggle();
  initTextSize();
  initContrast();
  initRatings();
});
