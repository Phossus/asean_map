# ASEAN MAP website (UI prototype)

Static HTML, CSS and vanilla JavaScript. No build step. Placeholders appear in `[SQUARE BRACKETS]`.

## Run locally
JavaScript modules need a web server (opening the file directly will not load them):

    python3 -m http.server 8000     # then open http://localhost:8000

## Structure
    index.html            page content (semantic HTML)
    css/main.css          entry point, imports everything in order
      base/               tokens (colours, fonts, spacing), reset, accessibility
      layout/             container, header, footer
      components/         button, form, hero, stats, card, subscribe
    js/main.js            entry point
      modules/            one file per behaviour (nav, text size, contrast)
    assets/               images, icons, fonts

## Conventions
- **CSS:** BEM names (`block__element--modifier`), kebab-case, one component per file, no IDs for styling.
- **Tokens first:** colours, fonts and spacing live only in `css/base/tokens.css`. Change the brand there.
- **Units:** `rem` for type and spacing, so the A- / A / A+ buttons scale the whole page.
- **JS:** ES modules, one behaviour per file, hooks via `data-*` attributes (never style classes).
- **Files:** lowercase kebab-case names; images go in `assets/images/`.

## Common tasks
- **New colour or font:** edit `css/base/tokens.css`.
- **New component:** add `css/components/<name>.css`, then add one `@import` line in `css/main.css`.
- **New page:** copy `index.html`, change `<title>`, description and `<main>`; keep header and footer.
- **New behaviour:** add `js/modules/<name>.js`, export an `init...()` function, call it in `js/main.js`.

## Before launch
- Replace all placeholders and add real images with meaningful `alt` text.
- Self-host fonts in `assets/fonts/` and bundle/minify CSS and JS (for example with Vite).
- Connect the forms to a real backend and add a privacy policy.
- Run Lighthouse and a screen-reader check; test keyboard-only use at 200% zoom.
- With 10+ pages or shared content, move to a static site generator (Eleventy or Astro) so header, footer and card lists are written once.
