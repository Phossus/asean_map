#!/usr/bin/env python3
"""ASEAN MAP local server: serves ../site and a JSON API over MariaDB.

Run from the project root with: python server/app.py
Then open: http://localhost:5000
"""
import os
from pathlib import Path
from flask import Flask, Response, abort, jsonify, request
from flask_cors import CORS

import pymysql
from flask import Flask, Response, abort, jsonify, request
from pymysql.cursors import DictCursor

ROOT = Path(__file__).resolve().parent.parent
env_file = ROOT / '.env'
if env_file.exists():
    for line in env_file.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip())

PROGRAMME_LAUNCHED = int(os.getenv('PROGRAMME_LAUNCHED', 2026))

app = Flask(__name__, static_folder=str(ROOT / 'site'), static_url_path='')
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "https://phossus.github.io",
                "http://localhost:5000",  # optional, for local testing
            ]
        }
    },
)
PILLAR_FIELDS = {
    'UN_REG': 'un_regulations',
    'COP': 'conformity_of_production',
    'SAFETY_TECH': 'safety_technology',
    'SUPPORT': 'support_programme',
}

# ORDER BY fragments are selected only from this fixed allow-list.
RATING_SORTS = {
    'created_desc': 'created_at DESC, id DESC',
    'brand_asc': 'brand ASC, model ASC, id DESC',
    'stars_desc': 'stars DESC, created_at DESC, id DESC',
    'year_desc': 'model_year DESC, created_at DESC, id DESC',
}


def query(sql, args=()):
    options = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 3306)),
        'user': os.getenv('DB_USER', 'asean_map'),
        'password': os.getenv('DB_PASSWORD', ''),
        'database': os.getenv('DB_NAME', 'asean_map'),
        'charset': 'utf8mb4',
        'cursorclass': DictCursor,
        'connect_timeout': 60,  # free Enzonic DB may be asleep
    }

    if os.getenv('DB_SSL', 'false').lower() in ('true', '1', 'yes'):
        options['ssl'] = {'ssl': {}}  # non-empty dict = TLS on

    conn = pymysql.connect(**options)
    try:
        with conn.cursor() as cur:
            cur.execute(sql, args)
            return cur.fetchall()
    finally:
        conn.close()


def num(value):
    return float(value) if value is not None else None


def iso_value(value):
    """Convert Python date/datetime values to stable ISO strings for JavaScript."""
    return value.isoformat() if value is not None and hasattr(value, 'isoformat') else value


def image_url(row):
    """Photo endpoint URL; updated_at changes the browser cache key after an image edit."""
    if not row.get('has_image'):
        return None
    updated = row.get('updated_at')
    version = int(updated.timestamp()) if hasattr(updated, 'timestamp') else 0
    return '/api/motorcycles/%d/image?v=%d' % (row['id'], version)


def card(row):
    """Return the common shape used by homepage cards and motorcycle detail pages."""
    return {
        'id': row['id'],
        'url': '/motorcycles/%d' % row['id'],
        'brand': row['brand'],
        'model': row['model'],
        'model_year': row['model_year'],
        'rating_date': iso_value(row.get('rating_date')),
        'created_at': iso_value(row.get('created_at')),
        'engine_cc': row['engine_cc'],
        'stars': row['stars'],
        'is_new': bool(row['is_new']),
        'image_url': image_url(row),
        'report_url': row['report_url'],
        'country': row['country'],
        'scores': {code: num(row.get(column)) for code, column in PILLAR_FIELDS.items()},
        'total_score': num(row.get('total_score')),
    }


def parse_engine_range(value):
    """Parse the website's cc format, for example '0-250', '251-500', or '1001-'."""
    if not value:
        return None, None
    low, separator, high = value.partition('-')
    if not separator:
        return None, None
    min_cc = int(low) if low.isdigit() else None
    max_cc = int(high) if high.isdigit() else None
    return min_cc, max_cc


def rating_filters():
    """Build a parameterised WHERE clause shared by results and count queries."""
    where = []
    args = []

    brand = (request.args.get('brand') or request.args.get('make') or '').strip()
    country = (request.args.get('country') or '').strip()
    model_query = (request.args.get('q') or request.args.get('model') or '').strip()
    cc_range = (request.args.get('cc') or '').strip()

    if brand:
        where.append('brand = %s')
        args.append(brand)
    if country:
        where.append('country = %s')
        args.append(country)
    if model_query:
        # Escape LIKE wildcards so the user's text is treated as a literal substring.
        escaped = model_query.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
        where.append('model LIKE %s')
        args.append('%' + escaped + '%')

    min_cc, max_cc = parse_engine_range(cc_range)
    # Also support the older min/max query parameter style if a caller sends it.
    if request.args.get('engineMin', '').isdigit():
        min_cc = int(request.args['engineMin'])
    if request.args.get('engineMax', '').isdigit():
        max_cc = int(request.args['engineMax'])
    if min_cc is not None:
        where.append('engine_cc >= %s')
        args.append(min_cc)
    if max_cc is not None:
        where.append('engine_cc <= %s')
        args.append(max_cc)

    return where, args


@app.get('/')
def home():
    return app.send_static_file('index.html')


@app.get('/motorcycles/<int:moto_id>')
def motorcycle_page(moto_id):
    # The detail page reads its data from /api/motorcycles/<id>.
    return app.send_static_file('motorcycle.html')


@app.get('/api/health')
def health():
    query('SELECT 1')
    return jsonify(status='ok')


@app.get('/api/ratings')
def ratings():
    """List ratings for the homepage and directory.

    Homepage examples:
      /api/ratings?limit=6&sort=created_desc
      /api/ratings?limit=8&sort=created_desc

    Directory example:
      /api/ratings?page=1&page_size=12&country=Malaysia&brand=Honda&q=NMAX&cc=0-250
    """
    where, args = rating_filters()
    where_sql = ' WHERE ' + ' AND '.join(where) if where else ''

    sort_key = request.args.get('sort', 'created_desc')
    order_sql = RATING_SORTS.get(sort_key, RATING_SORTS['created_desc'])

    # Total is the number of rows matching the filters, not just the current page.
    total_rows = query('SELECT COUNT(*) AS total FROM v_rating_cards' + where_sql, tuple(args))
    total = int(total_rows[0]['total']) if total_rows else 0

    page_value = request.args.get('page')
    page_size_value = request.args.get('page_size') or request.args.get('pageSize')
    is_paginated = page_value is not None or page_size_value is not None

    if is_paginated:
        page = max(1, min(request.args.get('page', 1, type=int) or 1, 1000000))
        try:
            requested_page_size = int(page_size_value or 12)
        except (TypeError, ValueError):
            requested_page_size = 12
        page_size = max(1, min(requested_page_size, 60))
        offset = (page - 1) * page_size
        sql = (
            'SELECT * FROM v_rating_cards' + where_sql +
            ' ORDER BY ' + order_sql + ' LIMIT %s OFFSET %s'
        )
        rows = query(sql, (*args, page_size, offset))
        return jsonify(
            count=len(rows),
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, (total + page_size - 1) // page_size),
            items=[card(row) for row in rows],
        )

    # Homepage calls use limit=6 and limit=8. Keep a safe cap for general callers.
    limit = request.args.get('limit', default=200, type=int)
    limit = max(1, min(limit or 200, 200))
    sql = 'SELECT * FROM v_rating_cards' + where_sql + ' ORDER BY ' + order_sql + ' LIMIT %s'
    rows = query(sql, (*args, limit))
    return jsonify(count=len(rows), total=total, items=[card(row) for row in rows])


@app.get('/api/motorcycles/<int:moto_id>')
def motorcycle_detail(moto_id):
    rows = query('SELECT * FROM v_rating_cards WHERE id = %s', (moto_id,))
    if not rows:
        abort(404)
    item = card(rows[0])
    item['specs'] = query(
        'SELECT label, value FROM motorcycle_specs WHERE motorcycle_id = %s ORDER BY sort_order, id',
        (moto_id,),
    )
    item['features'] = query(
        'SELECT category, feature, availability FROM motorcycle_features '
        'WHERE motorcycle_id = %s ORDER BY sort_order, id',
        (moto_id,),
    )
    related = query(
        'SELECT * FROM v_rating_cards WHERE brand = %s AND id <> %s '
        'ORDER BY model_year DESC, id DESC LIMIT 3',
        (rows[0]['brand'], moto_id),
    )
    item['related'] = [card(row) for row in related]
    return jsonify(item)


@app.get('/api/motorcycles/<int:moto_id>/image')
def motorcycle_image(moto_id):
    rows = query(
        'SELECT image, image_mime FROM motorcycles WHERE id = %s AND image IS NOT NULL',
        (moto_id,),
    )
    if not rows:
        abort(404)
    response = Response(rows[0]['image'], mimetype=rows[0]['image_mime'] or 'application/octet-stream')
    response.headers['Cache-Control'] = 'public, max-age=86400'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@app.get('/api/stats')
def stats():
    row = query(
        'SELECT (SELECT COUNT(*) FROM motorcycles) AS models, '
        '(SELECT COUNT(DISTINCT brand_id) FROM motorcycles) AS brands, '
        '(SELECT COUNT(*) FROM countries) AS countries'
    )[0]
    members = query(
        'SELECT c.name, c.iso_code, COUNT(m.id) AS models FROM countries c '
        'LEFT JOIN motorcycles m ON m.country_id = c.id '
        'GROUP BY c.id, c.name, c.iso_code ORDER BY c.name'
    )
    return jsonify(
        models=row['models'],
        brands=row['brands'],
        countries=row['countries'],
        launched=PROGRAMME_LAUNCHED,
        member_countries=members,
    )


@app.get('/api/brands')
def brands():
    rows = query('SELECT DISTINCT brand FROM v_rating_cards WHERE brand IS NOT NULL ORDER BY brand')
    return jsonify(items=[row['brand'] for row in rows])


@app.get('/api/countries')
def countries():
    rows = query('SELECT DISTINCT country FROM v_rating_cards WHERE country IS NOT NULL ORDER BY country')
    return jsonify(items=[row['country'] for row in rows])


@app.get('/api/pillars')
def pillars():
    rows = query('SELECT code, name, max_score, sort_order FROM pillars ORDER BY sort_order')
    return jsonify(items=[{**row, 'max_score': num(row['max_score'])} for row in rows])


@app.errorhandler(pymysql.MySQLError)
def db_error(err):
    app.logger.error('Database error: %s', err)
    return jsonify(error='database unavailable'), 503


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.getenv('PORT', 5000)), debug=False)
