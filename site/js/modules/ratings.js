// Loads motorcycle ratings from the ASEAN MAP API and renders them as cards.
const get = async (path) => {
  const res = await fetch('/api' + path);
  if (!res.ok) throw new Error(path + ' -> ' + res.status);
  return res.json();
};

export async function initRatings() {
  const grid = document.querySelector('#ratings-grid');
  const template = document.querySelector('#rating-card-template');
  if (!grid || !template) return;
  const form = document.querySelector('#search-form');
  const status = document.querySelector('#ratings-status');
  const viewAll = document.querySelector('#view-all');
  let pillars = [];

  const say = (text) => { if (status) status.textContent = text; };

  function renderCard(m) {
    const node = template.content.cloneNode(true);
    const $ = (selector) => node.querySelector(selector);
    $('.rating-card__badge').hidden = !m.is_new;

    const img = $('.rating-card__img');
    const placeholder = $('.rating-card__placeholder');
    img.alt = m.brand + ' ' + m.model;
    img.addEventListener('error', () => { img.hidden = true; placeholder.hidden = false; });
    if (m.image_url) img.src = m.image_url; else { img.hidden = true; placeholder.hidden = false; }

    $('.rating-card__brand').textContent = m.brand;
    $('.rating-card__year').textContent = [m.model_year, m.engine_cc ? m.engine_cc + ' cc' : null].filter(Boolean).join(' · ');
    $('.rating-card__title').textContent = m.model;

    const stars = m.stars ?? 0;
    $('.rating-card__rating').setAttribute('aria-label', 'Rated ' + stars + ' out of 5 stars');
    $('.rating-card__stars').textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    $('.rating-card__stars-text').textContent = stars + ' / 5';

    const list = $('.score-list');
    pillars.forEach((p) => {
      const value = m.scores[p.code];
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'score__row';
      const name = document.createElement('span'); name.textContent = p.name;
      const val = document.createElement('span'); val.textContent = value == null ? '–' : value.toFixed(2);
      row.append(name, val);
      li.append(row);
      if (p.max_score && value != null) {            // bar only when the pillar's maximum is known
        const bar = document.createElement('div');
        bar.className = 'score__bar';
        bar.style.setProperty('--score', Math.min(100, (value / p.max_score) * 100) + '%');
        li.append(bar);
      }
      list.append(li);
    });

    const link = $('.rating-card__action');
    if (m.report_url) link.href = m.report_url; else link.remove();
    return node;
  }

  async function load(params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    say('Loading ratings…');
    try {
      const data = await get('/ratings?' + qs);
      grid.replaceChildren(...data.items.map(renderCard));
      say(data.count ? data.count + (data.count === 1 ? ' motorcycle found.' : ' motorcycles found.')
                     : 'No motorcycles match your search. Try fewer filters.');
    } catch (err) {
      console.error(err);
      grid.replaceChildren();
      say('We could not load the ratings right now. Please try again later.');
    }
  }

  async function fillSelect(select, path) {
    const { items } = await get(path);
    items.forEach((value) => select.append(new Option(value, value)));
  }

  try {
    pillars = (await get('/pillars')).items;
    if (form) {
      await Promise.all([fillSelect(form.elements.make, '/brands'), fillSelect(form.elements.country, '/countries')]);
    }
  } catch (err) { console.error(err); }

  await load({ limit: 6 });

  viewAll?.addEventListener('click', (event) => { event.preventDefault(); load(); viewAll.hidden = true; });
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    load({ brand: form.elements.make.value, country: form.elements.country.value,
           q: form.elements.model.value.trim(), cc: form.elements.cc.value });
    if (viewAll) viewAll.hidden = true;
    document.querySelector('#ratings')?.scrollIntoView();
  });
}
