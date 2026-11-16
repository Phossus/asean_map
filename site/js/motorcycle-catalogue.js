/* ASEAN MAP catalogue UI connected to the existing Flask API routes. */

const PAGE_SIZE = 12;
const API_BASE = document.querySelector('meta[name="motorcycle-api"]')?.content || '/api/ratings';
const API_BRANDS = '/api/brands';
const API_COUNTRIES = '/api/countries';
const $ = (selector, root = document) => root.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  // Flask receives ISO date/datetime strings from the updated app.py.
  const datePart = String(value).slice(0, 10);
  const date = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).format(date);
}

function engineLabel(value) {
  return value === null || value === undefined || value === ''
    ? 'Engine size unavailable'
    : `${Number(value)} cc`;
}

function starsLabel(value) {
  if (value === null || value === undefined || value === '') return 'Not rated';
  const count = Math.max(0, Math.min(5, Math.round(Number(value))));
  return `${'★'.repeat(count)}${'☆'.repeat(5 - count)}`;
}

function motorcycleCard(item, { showAddedDate = true } = {}) {
  const title = `${item.brand ?? ''} ${item.model ?? ''}`.trim() || 'Motorcycle';
  const imageUrl = item.image_url || '';
  const rating = item.stars === null || item.stars === undefined
    ? 'Not rated'
    : `${Number(item.stars).toFixed(0)} / 5 stars`;
  const score = item.total_score === null || item.total_score === undefined
    ? ''
    : `${Number(item.total_score).toFixed(2)} points`;
  const detailUrl = item.url || `/motorcycles/${encodeURIComponent(item.id ?? '')}`;
  const addedDate = item.created_at ? `Added ${formatDate(item.created_at)}` : '';

  return `
    <article class="rating-card">
      <div class="rating-card__media">
        ${item.is_new ? '<span class="rating-card__badge">New</span>' : ''}
        ${imageUrl
          ? `<img class="rating-card__img" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy">`
          : `<span>Motorcycle image unavailable</span>`}
      </div>
      <div class="rating-card__body">
        <div class="rating-card__meta">
          <span>${escapeHtml(item.country || 'Country unavailable')}</span>
          <span>${item.model_year ? escapeHtml(item.model_year) : 'Year unavailable'}</span>
        </div>
        <h3 class="rating-card__title"><a class="rating-card__link" href="${escapeHtml(detailUrl)}">${escapeHtml(title)}</a></h3>
        <p class="rating-card__meta">
          <span>${escapeHtml(engineLabel(item.engine_cc))}</span>
          ${addedDate ? `<span>${escapeHtml(addedDate)}</span>` : ''}
        </p>
        <div class="rating-card__rating">
          <div class="rating-card__stars" aria-label="${escapeHtml(rating)}">${escapeHtml(starsLabel(item.stars))}</div>
          <div class="rating-card__score">${escapeHtml(rating)}${score ? ` · ${escapeHtml(score)}` : ''}</div>
        </div>
      </div>
    </article>`;
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch (_) { /* The response may not contain JSON. */ }
    throw new Error(message);
  }
  return response.json();
}

function apiUrl(params = {}) {
  const url = new URL(API_BASE, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function normaliseList(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data) ? payload.data
      : Array.isArray(payload) ? payload : [];
  return {
    items,
    total: Number(payload?.total ?? payload?.count ?? items.length)
  };
}

async function fetchFilters() {
  const [brandPayload, countryPayload] = await Promise.all([
    getJson(API_BRANDS),
    getJson(API_COUNTRIES)
  ]);
  return {
    makes: Array.isArray(brandPayload?.items) ? brandPayload.items : [],
    countries: Array.isArray(countryPayload?.items) ? countryPayload.items : []
  };
}

function fillSelect(select, values, allLabel, selectedValue = '') {
  if (!select) return;
  select.replaceChildren(new Option(allLabel, ''));
  [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .forEach((value) => select.add(new Option(value, value)));
  select.value = selectedValue;
}

function getDirectoryFilters(form) {
  const data = new FormData(form);
  return {
    country: String(data.get('country') || '').trim(),
    make: String(data.get('make') || '').trim(),
    model: String(data.get('model') || '').trim(),
    cc: String(data.get('cc') || '').trim()
  };
}

function writeFiltersToUrl(filters, page = 1, sort = 'created_desc') {
  const url = new URL(window.location.href);
  for (const key of ['country', 'make', 'model', 'cc']) {
    if (filters[key]) url.searchParams.set(key, filters[key]);
    else url.searchParams.delete(key);
  }
  url.searchParams.set('page', String(page));
  url.searchParams.set('sort', sort);
  history.replaceState({}, '', url);
}

function readFiltersFromUrl() {
  const url = new URL(window.location.href);
  return {
    country: url.searchParams.get('country') || '',
    make: url.searchParams.get('make') || '',
    model: url.searchParams.get('model') || '',
    cc: url.searchParams.get('cc') || ''
  };
}

async function initHomepage() {
  const form = $('#home-filter-form');
  if (form) {
    try {
      const filters = await fetchFilters();
      fillSelect($('#country', form), filters.countries, 'All countries');
      fillSelect($('#make', form), filters.makes, 'All makes');
    } catch (error) {
      console.error('Unable to load homepage filter options.', error);
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = getDirectoryFilters(form);
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(values)) {
        if (value) params.set(key, value);
      }
      window.location.href = `/motorcycle-directory.html${params.size ? `?${params}` : ''}`;
    });
  }

  const latestTrack = $('[data-latest-track]');
  if (latestTrack) {
    const status = $('#latest-motorcycles-status');
    const carousel = $('[data-latest-carousel]');
    const previous = $('[data-carousel-prev]', carousel);
    const next = $('[data-carousel-next]', carousel);

    try {
      // The Flask endpoint orders this by motorcycles.created_at DESC, then id DESC.
      const payload = await getJson(apiUrl({ limit: 6, sort: 'created_desc' }));
      const result = normaliseList(payload);
      if (!result.items.length) {
        latestTrack.innerHTML = '<p class="catalogue-message">No motorcycles have been added yet.</p>';
        status.textContent = 'No motorcycle records found.';
      } else {
        latestTrack.innerHTML = result.items.slice(0, 6).map((item) => motorcycleCard(item)).join('');
        status.textContent = `Showing ${result.items.length} most recently added motorcycles.`;
      }

      const syncCarouselButtons = () => {
        const maxScroll = latestTrack.scrollWidth - latestTrack.clientWidth;
        previous.disabled = latestTrack.scrollLeft <= 4;
        next.disabled = latestTrack.scrollLeft >= maxScroll - 4;
      };
      const scrollOneCard = (direction) => {
        const firstCard = latestTrack.querySelector('.rating-card');
        const gap = 16;
        const cardWidth = firstCard ? firstCard.getBoundingClientRect().width + gap : latestTrack.clientWidth * 0.8;
        latestTrack.scrollBy({
          left: cardWidth * direction,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
      };
      previous.addEventListener('click', () => scrollOneCard(-1));
      next.addEventListener('click', () => scrollOneCard(1));
      latestTrack.addEventListener('scroll', syncCarouselButtons, { passive: true });
      window.addEventListener('resize', syncCarouselButtons);
      requestAnimationFrame(syncCarouselButtons);
    } catch (error) {
      console.error('Unable to load latest motorcycles.', error);
      latestTrack.innerHTML = '<p class="catalogue-message catalogue-message--error">Unable to load motorcycle ratings. Check the API connection.</p>';
      if (status) status.textContent = 'Could not load the latest motorcycles.';
    }
  }

  const homeGrid = $('#home-motorcycle-grid');
  if (homeGrid) {
    const count = $('#home-directory-count');
    try {
      const payload = await getJson(apiUrl({ limit: 8, sort: 'created_desc' }));
      const result = normaliseList(payload);
      homeGrid.innerHTML = result.items.slice(0, 8).map((item) => motorcycleCard(item)).join('')
        || '<p class="catalogue-message">No motorcycles found.</p>';
      if (count) count.textContent = `${result.total} motorcycles in the directory`;
    } catch (error) {
      console.error('Unable to load homepage directory preview.', error);
      homeGrid.innerHTML = '<p class="catalogue-message catalogue-message--error">Unable to load the motorcycle directory. Check the API connection.</p>';
      if (count) count.textContent = 'Directory unavailable';
    }
  }
}

async function initDirectory() {
  const form = $('#directory-filter-form');
  const grid = $('#directory-motorcycle-grid');
  if (!form || !grid) return;

  const country = $('#directory-country');
  const make = $('#directory-make');
  const model = $('#directory-model');
  const cc = $('#directory-cc');
  const sort = $('#directory-sort');
  const status = $('#directory-results-status');
  const pagination = $('#directory-pagination');
  const previous = $('#directory-prev');
  const next = $('#directory-next');
  const pageStatus = $('#directory-page-status');

  const initialFilters = readFiltersFromUrl();
  try {
    const filterOptions = await fetchFilters();
    fillSelect(country, filterOptions.countries, 'All countries', initialFilters.country);
    fillSelect(make, filterOptions.makes, 'All makes', initialFilters.make);
  } catch (error) {
    console.error('Unable to load directory filter options.', error);
    status.textContent = 'Filter options could not be loaded. You can still try searching.';
  }
  model.value = initialFilters.model;
  cc.value = initialFilters.cc;

  const currentUrl = new URL(window.location.href);
  let currentPage = Math.max(1, Number(currentUrl.searchParams.get('page') || 1));
  sort.value = currentUrl.searchParams.get('sort') || 'created_desc';

  async function loadPage() {
    const filters = getDirectoryFilters(form);
    const params = {
      page: currentPage,
      page_size: PAGE_SIZE,
      sort: sort.value,
      country: filters.country,
      brand: filters.make,
      q: filters.model,
      cc: filters.cc
    };

    status.textContent = 'Loading motorcycles…';
    grid.innerHTML = '<p class="catalogue-message">Loading motorcycles…</p>';
    writeFiltersToUrl(filters, currentPage, sort.value);

    try {
      const payload = await getJson(apiUrl(params));
      const result = normaliseList(payload);
      const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
      if (currentPage > totalPages) {
        currentPage = totalPages;
        return loadPage();
      }

      grid.innerHTML = result.items.map((item) => motorcycleCard(item)).join('')
        || '<p class="catalogue-message">No motorcycles match these filters. Try changing or clearing your filters.</p>';
      const start = result.total ? ((currentPage - 1) * PAGE_SIZE) + 1 : 0;
      const end = Math.min(currentPage * PAGE_SIZE, result.total);
      status.textContent = `Showing ${start}–${end} of ${result.total} motorcycles`;
      pagination.hidden = totalPages <= 1;
      previous.disabled = currentPage <= 1;
      next.disabled = currentPage >= totalPages;
      pageStatus.textContent = `Page ${currentPage} of ${totalPages}`;
    } catch (error) {
      console.error('Unable to load motorcycle directory.', error);
      grid.innerHTML = '<p class="catalogue-message catalogue-message--error">Unable to load the motorcycle directory. Check the API endpoint and database connection.</p>';
      status.textContent = 'Could not load motorcycles.';
      pagination.hidden = true;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    currentPage = 1;
    loadPage();
  });
  $('#clear-directory-filters')?.addEventListener('click', () => {
    requestAnimationFrame(() => { currentPage = 1; loadPage(); });
  });
  sort.addEventListener('change', () => { currentPage = 1; loadPage(); });
  previous.addEventListener('click', () => {
    if (currentPage > 1) { currentPage -= 1; loadPage(); }
  });
  next.addEventListener('click', () => { currentPage += 1; loadPage(); });
  await loadPage();
}

if ($('#directory-filter-form')) initDirectory();
else initHomepage();
