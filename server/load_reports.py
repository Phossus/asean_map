#!/usr/bin/env python3
"""Load a PDF report into MariaDB (LONGBLOB column motorcycles.report_pdf).

Usage:
  python server/load_reports.py reports/placeholder.pdf          # put this PDF on EVERY motorcycle
  python server/load_reports.py reports/z500.pdf 12              # put this PDF on motorcycle id 12 only
Safe to re-run: it replaces the stored PDF.
"""
import os
import sys
from pathlib import Path

import pymysql

ROOT = Path(__file__).resolve().parent.parent
env_file = ROOT / '.env'
if env_file.exists():
    for line in env_file.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

MAX_BYTES = 8 * 1024 * 1024  # keep well under the database's max_allowed_packet (usually 16 MB)

if len(sys.argv) < 2:
    sys.exit(__doc__)
path = Path(sys.argv[1])
moto_id = int(sys.argv[2]) if len(sys.argv) > 2 else None

data = path.read_bytes()
if not data.startswith(b'%PDF-'):
    sys.exit('%s is not a real PDF file.' % path.name)
if len(data) > MAX_BYTES:
    sys.exit('%s is %.1f MB; the limit is %d MB.' % (path.name, len(data) / 1048576, MAX_BYTES // 1048576))

conn = pymysql.connect(host=os.getenv('DB_HOST', 'localhost'), port=int(os.getenv('DB_PORT', 3306)),
                       user=os.getenv('DB_USER', 'asean_map'), password=os.getenv('DB_PASSWORD', ''),
                       database=os.getenv('DB_NAME', 'asean_map'), charset='utf8mb4',
                       connect_timeout=60, read_timeout=120, write_timeout=120)
with conn.cursor() as cur:
    if moto_id is None:
        cur.execute('UPDATE motorcycles SET report_pdf = %s', (data,))
    else:
        cur.execute('UPDATE motorcycles SET report_pdf = %s WHERE id = %s', (data, moto_id))
    changed = cur.rowcount
conn.commit()
print('%s (%d KB) loaded into %d motorcycle(s).' % (path.name, len(data) // 1024, changed))