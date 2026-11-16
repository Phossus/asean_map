# ASEAN MAP – latest carousel and full motorcycle directory

## What this update does

- Homepage **Latest motorcycle ratings** shows the 6 most recently added motorcycle records in a manually controlled, horizontally scrollable carousel.
- Homepage **Motorcycle directory** preview shows the 8 most recently added records and a button to `motorcycle-directory.html`.
- `motorcycle-directory.html` lists the full catalogue with Country, Make, Model and Engine Size filters, sorting and 12-row pagination.
- Homepage search sends the selected filters to the separate directory page through URL parameters.
- The new `created_at` column represents when a record was inserted. `rating_date` continues to represent the official assessment/publication date.

## Files

- `index.html` – updated homepage
- `motorcycle-directory.html` – new complete directory page
- `css/motorcycle-catalogue.css` – carousel, card and directory styles
- `js/motorcycle-catalogue.js` – homepage and directory interactions
- `schema.sql` – updated fresh-install schema and safe migration
- `sql/migrate_created_at.sql` – run-once/idempotent migration for an existing database
- `sql/catalogue_queries.sql` – SQL for latest 6, homepage 8, filters and full directory

## 1. Apply the database migration

Back up your database first. For an existing `asean_map` database, run:

```sql
SOURCE /path/to/sql/migrate_created_at.sql;
```

Or open `sql/migrate_created_at.sql` in DBeaver and execute the whole script.

The migration backfills existing rows with their current `updated_at` timestamp only when `created_at` is NULL. This is an estimate for older records, because their original insert timestamps were not stored separately. New rows receive `CURRENT_TIMESTAMP` automatically. Do not run the migration on the live database before taking a backup.

For a fresh database, run the updated `schema.sql` instead.

## 2. Update your existing API

The uploaded project did not include the existing backend/API or `js/main.js`, so the UI code uses a small, explicit API contract instead of guessing the server framework. Keep your existing backend and make it return the fields shown below.

Configure the endpoint using the `meta[name="motorcycle-api"]` tag in both HTML files. The default is `/api/motorcycles`.

### Required routes

`GET /api/motorcycles?limit=6&sort=created_desc`

Returns the six newest records. The homepage also calls it with `limit=8` for the directory preview.

`GET /api/motorcycles/meta`

Returns filter options:

```json
{
  "countries": ["Indonesia", "Malaysia", "Thailand", "Vietnam"],
  "makes": ["Honda", "Kawasaki", "Kymco", "Modenas", "Suzuki", "Yamaha"]
}
```

`GET /api/motorcycles?page=1&pageSize=12&sort=created_desc&country=Malaysia&make=Honda&model=PCX&engineMin=0&engineMax=250`

Returns a paginated response:

```json
{
  "data": [
    {
      "id": 1,
      "brand": "Honda",
      "model": "PCX 160",
      "model_year": 2026,
      "country": "Indonesia",
      "engine_cc": 160,
      "stars": 5,
      "total_score": 4.68,
      "created_at": "2026-11-16 08:00:00",
      "rating_date": "2026-11-12",
      "image_url": null,
      "report_url": null
    }
  ],
  "total": 1
}
```

Use prepared statements for filter values. For sort, use a strict allowlist; never insert the raw `sort` request value into SQL. The supported orders are:

- `created_desc`: `ORDER BY created_at DESC, id DESC`
- `brand_asc`: `ORDER BY brand ASC, model ASC, id DESC`
- `stars_desc`: `ORDER BY stars DESC, created_at DESC, id DESC`

Use the SQL in `sql/catalogue_queries.sql` as the basis for the backend queries. Return `image_url` only if your backend has a real image-serving URL; `has_image` by itself is not a URL.

## 3. Copy into your website

Copy the files while preserving the folders:

- Replace your homepage with `index.html`.
- Add `motorcycle-directory.html` beside `index.html`.
- Copy `css/motorcycle-catalogue.css` into your existing `css/` folder.
- Copy `js/motorcycle-catalogue.js` into your existing `js/` folder.

Keep your existing `css/main.css`, `js/main.js`, `motorcycle.html`, detail script and assets. The new catalogue code is separate. It uses new element IDs and does not replace the detail page.

## 4. Test

1. Run the migration and confirm `SELECT id, brand, model, created_at FROM v_rating_cards ORDER BY created_at DESC, id DESC LIMIT 6;` returns six records.
2. Ensure the API endpoint and `/meta` route return the required JSON format.
3. Open `index.html`; verify the carousel has up to six cards and the directory preview has up to eight.
4. Click **View all motorcycles**; verify all rows, the four filters, sorting and pagination.
5. Test the homepage search; it should open the directory page with the same filter values selected.

If your existing API uses a different URL or JSON property names, change the API URL in the meta tag or map its response in `js/motorcycle-catalogue.js`.
