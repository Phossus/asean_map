// News: reads data/news.json (a static file, no database) and fills whichever news blocks the page has.
//   [data-news-latest]   homepage cards (data-limit="3" sets how many)
//   [data-news-list]     full list on news.html, with [data-news-filters] for category buttons
//   [data-news-article]  single article on news-article.html?id=...
const DATA_URL = 'data/news.json';
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const articleUrl = (a) => 'news-article.html?id=' + encodeURIComponent(a.id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function dateEl(a, className) {
  const time = el('time', className, dateFormat.format(new Date(a.date)));
  time.dateTime = a.date;
  return time;
}

function card(a) {
  const item = el('article', 'news-card');
  const meta = el('div', 'news-card__meta');
  meta.append(dateEl(a, 'news-card__date'), el('span', 'news-tag', a.category));
  const title = el('h3', 'news-card__title');
  const link = el('a', null, a.title);
  link.href = articleUrl(a);
  title.append(link);
  item.append(meta, title, el('p', 'news-card__summary', a.summary));
  return item;
}

async function load() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(DATA_URL + ' -> ' + res.status);
  const data = await res.json();
  return data.articles.slice().sort((x, y) => y.date.localeCompare(x.date)); // newest first
}

function showMessage(root, text) {
  root.replaceChildren(el('p', 'catalogue-message', text));
}

function renderList(root, filtersRoot, articles) {
  const draw = (category) => {
    const shown = category === 'All' ? articles : articles.filter((a) => a.category === category);
    root.replaceChildren(...shown.map(card));
  };
  if (filtersRoot) {
    const categories = ['All', ...new Set(articles.map((a) => a.category))];
    const buttons = categories.map((name) => {
      const btn = el('button', 'news-filter__btn', name);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', name === 'All' ? 'true' : 'false');
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        draw(name);
      });
      return btn;
    });
    filtersRoot.replaceChildren(...buttons);
  }
  draw('All');
}

function renderArticle(root, articles) {
  const id = new URLSearchParams(location.search).get('id');
  const a = articles.find((x) => x.id === id);
  const heading = document.querySelector('[data-news-title]');
  const dateline = document.querySelector('[data-news-dateline]');
  if (!a) {
    if (heading) heading.textContent = 'Article not found';
    showMessage(root, 'We could not find that article. It may have been moved.');
    return;
  }
  document.title = a.title + ' – ASEAN MAP';
  if (heading) heading.textContent = a.title;
  if (dateline) dateline.replaceChildren(dateEl(a), el('span', 'news-tag news-tag--light', a.category));

  const parts = [el('p', 'news-article__summary', a.summary)];
  if (a.points && a.points.length) {
    parts.push(el('h2', 'news-article__subhead', 'Key points'));
    const list = el('ul', 'about-list');
    a.points.forEach((p) => list.append(el('li', null, p)));
    parts.push(list);
  }
  if (Array.isArray(a.body)) a.body.forEach((p) => parts.push(el('p', null, p))); // optional full text you add yourself
  const note = el('p', 'news-article__source');
  note.append('Originally published by ' + a.source_name + (a.language === 'ms' ? ' in Malay as “' + a.original_title + '”. ' : '. '));
  const link = el('a', 'btn btn--accent', 'Read the full release on MyMAP');
  link.href = a.source_url; link.target = '_blank'; link.rel = 'noopener';
  parts.push(note, link);
  root.replaceChildren(...parts);
}

async function init() {
  const latest = document.querySelector('[data-news-latest]');
  const list = document.querySelector('[data-news-list]');
  const article = document.querySelector('[data-news-article]');
  if (!latest && !list && !article) return;
  try {
    const articles = await load();
    if (latest) latest.replaceChildren(...articles.slice(0, Number(latest.dataset.limit) || 3).map(card));
    if (list) renderList(list, document.querySelector('[data-news-filters]'), articles);
    if (article) renderArticle(article, articles);
  } catch (err) {
    console.error(err);
    [latest, list, article].filter(Boolean).forEach((root) => showMessage(root, 'News could not be loaded right now. Please try again later.'));
  }
}

init();