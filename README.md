# ASEAN MAP – connect the new catalogue to the existing Flask API

This update is adapted to the backend you supplied. It uses the existing API route names and does **not** expect `/api/motorcycles/meta` or `/api/motorcycles` for the list.

## API routes used by the website

| Purpose | Request |
|---|---|
| Latest 6 on homepage | `GET /api/ratings?limit=6&sort=created_desc` |
| Homepage directory preview | `GET /api/ratings?limit=8&sort=created_desc` |
| Full directory | `GET /api/ratings?page=1&page_size=12&sort=created_desc` |
| Country filters | `GET /api/countries` |
| Make filters | `GET /api/brands` |

The directory sends its filters using the backend's existing parameter names:

- Country: `country=Malaysia`
- Make: `brand=Honda`
- Model search: `q=NMAX`
- Engine range: `cc=0-250`, `cc=251-500`, `cc=501-1000`, or `cc=1001-`

The directory also sends `page`, `page_size` and `sort`. The updated Flask route supports the three sort values already shown in the page: `created_desc`, `brand_asc`, and `stars_desc`.

## Files in this patch

- `server/app.py` – updated version of your supplied backend.
- `site/index.html` – homepage with latest-six carousel and eight-card directory preview; the API meta tag now points to `/api/ratings`.
- `site/motorcycle-directory.html` – separate full directory page with the same filters and pagination.
- `site/js/motorcycle-catalogue.js` – frontend connected to `/api/ratings`, `/api/brands` and `/api/countries`.
- `site/css/motorcycle-catalogue.css` – carousel and catalogue styling.
- `sql/migrate_created_at.sql` – adds `created_at` and rebuilds `v_rating_cards` to expose it.
- `sql/catalogue_queries.sql` – SQL examples for latest six, directory preview, filters and full directory.

The patch does not include or replace your existing `site/css/main.css`, `site/js/main.js`, `site/motorcycle.html`, or other static assets. Keep those files in place.

## Installation

1. Back up the `asean_map` database.
2. Open `sql/migrate_created_at.sql` in DBeaver and execute it against the `asean_map` database. This is required because the API sorts on `v_rating_cards.created_at`.
3. Replace your existing `server/app.py` with this patch's `server/app.py`.
4. Copy the patch's `site/index.html`, `site/motorcycle-directory.html`, `site/js/motorcycle-catalogue.js`, and `site/css/motorcycle-catalogue.css` into the corresponding folders in your existing project. Do not remove other files from `site`.
5. Restart Flask: `python server/app.py`.
6. Open `http://localhost:5000`.

## What the updated API returns

`GET /api/ratings?limit=6&sort=created_desc` returns JSON in this shape:

```json
{
  "count": 6,
  "total": 27,
  "items": [
    {
      "id": 39,
      "url": "/motorcycles/39",
      "brand": "Yamaha",
      "model": "EXCITER150",
      "created_at": "2026-11-13T12:26:55",
      "rating_date": null,
      "image_url": null
    }
  ]
}
```

The sample above illustrates the response shape only; the returned records come from MariaDB.

For the directory, the same endpoint returns `total`, `page`, `page_size`, `total_pages`, and the current page's `items` array. The `total` count is calculated after applying all selected filters, so the pagination count stays correct.

## Why a database migration is required

Your original Flask `/api/ratings` route already queried `v_rating_cards`, but its ordering was `model_year DESC, id DESC`. It also did not return `created_at`. This patch changes the route to use `created_at DESC, id DESC` by default and includes `created_at` in each API card. The migration adds the field to `motorcycles` and to `v_rating_cards`.

Existing records get `created_at = updated_at` as an initial estimate because the database did not previously record their original insertion times. New records automatically receive `CURRENT_TIMESTAMP` when inserted.

## Quick API checks

After starting Flask, open these URLs in a browser:

- `http://localhost:5000/api/health`
- `http://localhost:5000/api/brands`
- `http://localhost:5000/api/countries`
- `http://localhost:5000/api/ratings?limit=6&sort=created_desc`
- `http://localhost:5000/api/ratings?page=1&page_size=12&sort=created_desc`

The `created_at` values in the latest-six response should be in descending order.
