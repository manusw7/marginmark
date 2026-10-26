#!/usr/bin/env python3
"""Import a Web Highlights backup and verify record-for-record preservation."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'host'))
from store import DEFAULT_VAULT, Store
p = argparse.ArgumentParser()
p.add_argument('--vault', type=Path, default=DEFAULT_VAULT)
p.add_argument('--backup', default='webhighlights-backup.json')
a = p.parse_args()
if Path(a.backup).name != a.backup: p.error('--backup deve essere un nome file, senza cartelle.')
source = a.vault / a.backup
before = source.read_bytes(); raw = json.loads(before)
store = Store(a.vault)
result = store.import_backup(raw)
if result['errors']: raise SystemExit(json.dumps(result, ensure_ascii=False, indent=2))
original_marks = {m['_id']:m for m in raw['marks']}
found_marks = {}
found_pages = {}
contents = []
for path in store.data.glob('*.json'):
    doc = store.get(path.stem)['document']
    if not doc['id'].startswith('wh-'): continue
    found_pages[doc['source']['_id']] = doc['source']
    contents.extend(doc.get('pagecontents', []))
    for mark in doc['marks']:
        if 'source' in mark: found_marks[mark['source']['_id']] = mark['source']
assert all(found_pages.get(b['_id']) == b for b in raw['bookmarks']), 'Segnalibro originale non conservato.'
assert all(found_marks.get(id) == m for id,m in original_marks.items()), 'Passaggio originale non conservato.'
assert all(pc in contents for pc in raw.get('pagecontents', [])), 'Contenuto originale non conservato.'
assert json.loads(Path(result['archive']).read_bytes()) == raw, 'Archivio di importazione incompleto.'
assert source.read_bytes() == before, 'Export originale modificato.'
again = store.import_backup(raw)
assert again['created'] == 0 and not again['errors'], 'Importazione non idempotente.'
report = {'timestamp':int(time.time()), 'backup':a.backup, 'sourceSha256':hashlib.sha256(before).hexdigest(), 'bookmarks':len(raw['bookmarks']), 'marks':len(raw['marks']), 'pagecontents':len(raw.get('pagecontents', [])), 'created':result['created'], 'skipped':result['skipped'], 'secondImportCreated':again['created'], 'originalUnchanged':True, 'allSourceRecordsPreserved':True, 'archive':result['archive']}
store.atomic(store.state/'migration-report.json', (json.dumps(report, indent=2)+'\n').encode())
print(json.dumps(report, indent=2))
