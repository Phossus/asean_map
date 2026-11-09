// Fills the four stat boxes and the member-country cards from /api/stats.
import { firstImage } from './logo.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function countryCard(c) {
  const li = document.createElement('li');
  const card = document.createElement('a');
  card.className = 'country'; card.href = '#ratings';
  const flag = document.createElement('span');
  flag.className = 'country__flag'; flag.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  const name = document.createElement('b'); name.textContent = c.name;
  text.append(name, document.createElement('br'),
              c.models + (c.models === 1 ? ' motorcycle rated' : ' motorcycles rated'));
  card.append(flag, text);
  li.append(card);

  firstImage(['/assets/images/flags/' + slug(c.name)]).then((url) => {
    if (!url) return;
    const img = document.createElement('img');
    img.className = 'country__flag country__flag--image'; img.src = url; img.alt = '';
    flag.replaceWith(img);
  });
  card.addEventListener('click', (event) => {          // filter the ratings by this country
    const form = document.querySelector('#search-form');
    if (!form) return;
    event.preventDefault();
    form.elements.country.value = c.name;
    form.requestSubmit();
  });
  return li;
}

export async function initStats() {
  const boxes = document.querySelectorAll('[data-stat]');
  const list = document.querySelector('#country-grid');
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('/api/stats -> ' + res.status);
    const stats = await res.json();
    boxes.forEach((box) => { if (stats[box.dataset.stat] != null) box.textContent = stats[box.dataset.stat]; });
    if (list) list.replaceChildren(...stats.member_countries.map(countryCard));
  } catch (err) {
    console.error(err);
  }
}
