#!/usr/bin/env python3
"""Load motorcycle photos from a folder into MariaDB (LONGBLOB column).

Usage:  python server/load_images.py [folder]        (default folder: ./images)
Name each file after the model: z500.png, ninja-500-se.jpg, versys-1100.webp ...
Safe to re-run: it replaces the stored photo.
"""
import os
import re
import sys
from pathlib import Path

import pymysql

ROOT = Path(__file__).resolve().parent.parent
env_file = ROOT / '.env'
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

TYPES = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}
SIGNATURES = {'image/png': b'\x89PNG\r\n\x1a\n', 'image/jpeg': b'\xff\xd8\xff', 'image/webp': b'RIFF'}
MAX_BYTES = 5 * 1024 * 1024
slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

folder = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'images'
conn = pymysql.connect(host=os.getenv('DB_HOST', 'localhost'), port=int(os.getenv('DB_PORT', 3306)),
                       user=os.getenv('DB_USER', 'asean_map'), password=os.getenv('DB_PASSWORD', ''),
                       database=os.getenv('DB_NAME', 'asean_map'), charset='utf8mb4')
loaded, unmatched = 0, []
with conn.cursor() as cur:
    cur.execute('SELECT id, model FROM motorcycles')
    by_slug = {}
    for moto_id, model in cur.fetchall():
        by_slug.setdefault(slug(model), []).append(moto_id)

    for path in sorted(folder.iterdir()):
        mime = TYPES.get(path.suffix.lower())
        if not mime:
            continue
        data = path.read_bytes()
        if len(data) > MAX_BYTES or not data.startswith(SIGNATURES[mime]):
            print('skipped (too big or not a real %s): %s' % (mime, path.name))
            continue
        ids = by_slug.get(slug(path.stem))
        if not ids:
            unmatched.append(path.name)
            continue
        for moto_id in ids:
            cur.execute('UPDATE motorcycles SET image = %s, image_mime = %s WHERE id = %s', (data, mime, moto_id))
        loaded += 1
        print('loaded %-28s -> %s (%d KB)' % (path.name, path.stem, len(data) // 1024))
    cur.execute('SELECT model FROM motorcycles WHERE image IS NULL ORDER BY model')
    missing = [r[0] for r in cur.fetchall()]
conn.commit()
print('\n%d photos loaded.' % loaded)
if unmatched:
    print('No matching motorcycle for:', ', '.join(unmatched))
if missing:
    print('Still without a photo:', ', '.join(missing))
