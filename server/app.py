#!/usr/bin/env python3
"""ASEAN MAP local server: serves the website (../site) and a small JSON API over MariaDB.

Run:  python server/app.py   then open http://localhost:5000
"""
import os
from pathlib import Path

import pymysql
from flask import Flask, jsonify, request
from pymysql.cursors import DictCursor

ROOT = Path(__file__).resolve().parent.parent
env_file = ROOT / '.env'
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

app = Flask(__name__, static_folder=str(ROOT / 'site'), static_url_path='')
PILLAR_FIELDS = {'UN_REG': 'un_regulations', 'COP': 'conformity_of_production',
                 'SAFETY_TECH': 'safety_technology', 'SUPPORT': 'support_programme'}


def query(sql, args=()):
    conn = pymysql.connect(host=os.getenv('DB_HOST', 'localhost'), port=int(os.getenv('DB_PORT', 3306)),
                           user=os.getenv('DB_USER', 'asean_map'), password=os.getenv('DB_PASSWORD', ''),
                           database=os.getenv('DB_NAME', 'asean_map'), charset='utf8mb4', cursorclass=DictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute(sql, args)
            return cur.fetchall()
    finally:
        conn.close()


def num(v):
    return float(v) if v is not None else None


def card(row):
    return {'id': row['id'], 'brand': row['brand'], 'model': row['model'], 'model_year': row['model_year'],
            'engine_cc': row['engine_cc'], 'stars': row['stars'], 'is_new': bool(row['is_new']),
            'image_url': row['image_url'], 'report_url': row['report_url'], 'country': row['country'],
            'scores': {code: num(row[col]) for code, col in PILLAR_FIELDS.items()},
            'total_score': num(row['total_score'])}


@app.get('/')
def home():
    return app.send_static_file('index.html')


@app.get('/api/health')
def health():
    query('SELECT 1')
    return jsonify(status='ok')


@app.get('/api/ratings')
def ratings():
    where, args = [], []
    if request.args.get('brand'):
        where.append('brand = %s'); args.append(request.args['brand'])
    if request.args.get('country'):
        where.append('country = %s'); args.append(request.args['country'])
    if request.args.get('q'):
        like = request.args['q'].replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
        where.append('model LIKE %s'); args.append('%' + like + '%')
    if request.args.get('cc'):                       # e.g. "0-250", "251-500", "1001-"
        lo, _, hi = request.args['cc'].partition('-')
        if lo.isdigit():
            where.append('engine_cc >= %s'); args.append(int(lo))
        if hi.isdigit():
            where.append('engine_cc <= %s'); args.append(int(hi))
    limit = min(max(request.args.get('limit', 200, type=int), 1), 200)
    sql = 'SELECT * FROM v_rating_cards' + (' WHERE ' + ' AND '.join(where) if where else '') + \
          ' ORDER BY model_year DESC, id DESC LIMIT %s'
    items = [card(r) for r in query(sql, (*args, limit))]
    return jsonify(count=len(items), items=items)


@app.get('/api/brands')
def brands():
    rows = query('SELECT DISTINCT brand FROM v_rating_cards ORDER BY brand')
    return jsonify(items=[r['brand'] for r in rows])


@app.get('/api/countries')
def countries():
    rows = query('SELECT DISTINCT country FROM v_rating_cards ORDER BY country')
    return jsonify(items=[r['country'] for r in rows])


@app.get('/api/pillars')
def pillars():
    rows = query('SELECT code, name, max_score, sort_order FROM pillars ORDER BY sort_order')
    return jsonify(items=[{**r, 'max_score': num(r['max_score'])} for r in rows])


@app.errorhandler(pymysql.MySQLError)
def db_error(err):
    app.logger.error('Database error: %s', err)
    return jsonify(error='database unavailable'), 503


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.getenv('PORT', 5000)), debug=False)
