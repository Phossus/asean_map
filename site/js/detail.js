// Motorcycle detail page: loads /api/motorcycles/<id> and renders it.
import { initNavToggle } from './modules/nav-toggle.js';
import { initTextSize } from './modules/text-size.js';
import { initContrast } from './modules/contrast.js';

const root = document.querySelector('#detail');
const ICONS = {
  UN_REG: 'M6 3h9l4 4v14H6z M9 12h7 M9 16h7',
  COP: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M8.5 12l2.5 2.5 4.5-5',
  SAFETY_TECH: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 7v5l3 2',
  SUPPORT: 'M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6 M15 14c3 0 6 1.5 6 5'
};
const AVAILABILITY = { standard: 'Standard', optional: 'Optional', not_available: 'Not available' };

const get = async (path) => {
  const res = await fetch('/api' + path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(path + ' -> ' + res.status);
  return res.json();
};

function el(tag, className, text, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}
const link = (href, text, className) => el('a', className, text, { href });
const starText = (n) => '★'.repeat(n ?? 0) + '☆'.repeat(5 - (n ?? 0));

function icon(path) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  Object.entries({ width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
                   'stroke-width': 2, 'stroke-linecap': 'round', 'aria-hidden': 'true' })
    .forEach(([k, v]) => svg.setAttribute(k, v));
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

function breadcrumb(m) {
  const nav = el('nav', 'breadcrumb container', null, { 'aria-label': 'Breadcrumb' });
  const ol = el('ol');
  const items = [link('/', 'Home'), link('/#ratings', 'Ratings'), el('span', null, m.model, { 'aria-current': 'page' })];
  items.forEach((item) => { const li = el('li'); li.append(item); ol.append(li); });
  nav.append(ol);
  return nav;
}

function hero(m) {
  const wrap = el('section', 'container detail-hero', null, { 'aria-labelledby': 'detail-title' });
  const media = el('div', 'detail-hero__media');
  if (m.image_url) {
    const img = el('img', null, null, { src: m.image_url, alt: m.brand + ' ' + m.model });
    img.addEventListener('error', () => media.replaceChildren('[MOTORCYCLE IMAGE]'));
    media.append(img);
  } else {
    media.append('[MOTORCYCLE IMAGE]');
  }

  const info = el('div');
  const meta = [m.brand, m.model_year, m.engine_cc ? m.engine_cc + ' cc' : null, m.country].filter(Boolean).join(' · ');
  const title = el('h1', 'detail-hero__title', m.model, { id: 'detail-title' });
  if (m.is_new) title.append(el('span', 'tag', 'New'));

  const overall = el('div', 'overall');
  const rating = el('div');
  rating.append(el('span', 'overall__label', 'Overall star rating'));
  const stars = el('span', 'overall__stars', starText(m.stars), { 'aria-hidden': 'true' });
  rating.append(stars, el('span', 'overall__value', (m.stars ?? 0) + ' / 5', { 'aria-label': 'Rated ' + (m.stars ?? 0) + ' out of 5 stars' }));
  const total = el('div');
  total.append(el('span', 'overall__label', 'Total score'),
               el('span', 'overall__value', m.total_score == null ? '–' : m.total_score.toFixed(2)));
  overall.append(rating, total);

  info.append(el('p', 'detail-hero__meta', meta), title, overall);
  wrap.append(media, info);
  return wrap;
}

function results(m, pillars) {
  const section = el('section', 'container', null, { 'aria-labelledby': 'results-title' });
  section.append(el('h2', 'detail__heading', 'Assessment results', { id: 'results-title' }));
  const grid = el('div', 'grid');
  pillars.forEach((p) => {
    const value = m.scores[p.code];
    const card = el('div', 'pillar');
    const iconBox = el('div', 'pillar__icon');
    iconBox.append(icon(ICONS[p.code] || ICONS.UN_REG));
    card.append(iconBox, el('h3', 'pillar__title', p.name),
                el('span', 'pillar__score', value == null ? '–' : value.toFixed(2)));
    if (p.max_score && value != null) {
      card.append(el('p', 'pillar__text', 'out of ' + p.max_score.toFixed(2)));
      const bar = el('div', 'score__bar');
      bar.style.setProperty('--score', Math.min(100, (value / p.max_score) * 100) + '%');
      card.append(bar);
    }
    grid.append(card);
  });
  section.append(grid);
  return section;
}

function documents(m) {
  const section = el('section', 'container', null, { 'aria-labelledby': 'docs-title' });
  section.append(el('h2', 'detail__heading', 'Documents and reports', { id: 'docs-title' }));
  if (m.report_url) {
    const a = link(m.report_url, 'View the full test report', 'btn');
    a.target = '_blank'; a.rel = 'noopener';
    section.append(a);
  } else {
    section.append(el('p', 'section__lead', 'The full test report is not available yet.'));
  }
  return section;
}

function specs(m) {
  if (!m.specs.length) return null;
  const section = el('section', 'container', null, { 'aria-labelledby': 'specs-title' });
  section.append(el('h2', 'detail__heading', 'Specifications', { id: 'specs-title' }));
  const dl = el('dl', 'spec-list');
  m.specs.forEach((s) => {
    const row = el('div');
    row.append(el('dt', null, s.label), el('dd', null, s.value));
    dl.append(row);
  });
  section.append(dl);
  return section;
}

function features(m) {
  if (!m.features.length) return null;
  const section = el('section', 'container', null, { 'aria-labelledby': 'features-title' });
  section.append(el('h2', 'detail__heading', 'Safety equipment', { id: 'features-title' }));
  const groups = new Map();
  m.features.forEach((f) => groups.set(f.category, [...(groups.get(f.category) || []), f]));
  groups.forEach((rows, category) => {
    const scroll = el('div', 'table-scroll');
    const table = el('table', 'feature-table');
    table.append(el('caption', null, category));
    const head = el('thead'); const hr = el('tr');
    hr.append(el('th', null, 'Feature', { scope: 'col' }), el('th', null, 'Availability', { scope: 'col' }));
    head.append(hr);
    const body = el('tbody');
    rows.forEach((f) => {
      const tr = el('tr');
      const td = el('td');
      td.append(el('span', 'badge badge--' + f.availability, AVAILABILITY[f.availability] || f.availability));
      tr.append(el('th', null, f.feature, { scope: 'row' }), td);
      body.append(tr);
    });
    table.append(head, body);
    scroll.append(table);
    section.append(scroll);
  });
  return section;
}

function related(m) {
  if (!m.related.length) return null;
  const section = el('section', 'container', null, { 'aria-labelledby': 'related-title' });
  section.append(el('h2', 'detail__heading', 'More from ' + m.brand, { id: 'related-title' }));
  const grid = el('div', 'grid');
  m.related.forEach((r) => {
    const a = el('a', 'mini-card', null, { href: r.url });
    a.append(el('strong', null, r.model),
             el('span', null, [r.model_year, r.engine_cc ? r.engine_cc + ' cc' : null].filter(Boolean).join(' · ')),
             el('span', null, ' · Rated ' + (r.stars ?? 0) + ' out of 5'));
    grid.append(a);
  });
  section.append(grid);
  return section;
}

function actions() {
  const wrap = el('div', 'container detail__actions');
  wrap.append(link('/#ratings', 'Back to all ratings', 'btn btn--outline'));
  return wrap;
}

function notFound() {
  const wrap = el('div', 'container');
  wrap.append(el('h1', 'section__title', 'Motorcycle not found'),
              el('p', 'section__lead', 'We could not find that motorcycle. It may have been removed.'),
              link('/#ratings', 'Back to all ratings', 'btn'));
  return wrap;
}

async function init() {
  initNavToggle(); initTextSize(); initContrast();
  const id = (location.pathname.match(/\/motorcycles\/(\d+)/) || [])[1];
  try {
    const [m, pillars] = await Promise.all([id ? get('/motorcycles/' + id) : null, get('/pillars')]);
    if (!m) { document.title = 'Motorcycle not found – ASEAN MAP'; root.replaceChildren(notFound()); return; }
    document.title = m.brand + ' ' + m.model + ' – ASEAN MAP';
    root.replaceChildren(...[breadcrumb(m), hero(m), results(m, pillars.items), documents(m),
                             specs(m), features(m), related(m), actions()].filter(Boolean));
  } catch (err) {
    console.error(err);
    const wrap = el('div', 'container');
    wrap.append(el('p', 'section__lead', 'We could not load this motorcycle right now. Please try again later.'));
    root.replaceChildren(wrap);
  }
}
init();
