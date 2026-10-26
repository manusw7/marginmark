"""Local JSON records and conflict-checked Markdown projections. Standard library only."""
import contextlib
import copy
import fcntl
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import tempfile
import time
from urllib.parse import urlsplit, urlunsplit
import uuid

BEGIN = '<!-- local-highlights:generated:start -->\n'
END = '<!-- local-highlights:generated:end -->'
DEFAULT_VAULT = Path.home() / 'Documents' / 'Marginmark'

class Conflict(ValueError):
    pass

class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []; self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.hidden += 1
        if tag in ('p', 'div', 'br', 'li', 'h1', 'h2', 'h3'): self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.hidden = max(0, self.hidden - 1)
        if tag in ('p', 'div', 'li'): self.parts.append('\n')
    def handle_data(self, data):
        if not self.hidden: self.parts.append(data)

def plain(value):
    if not isinstance(value, str): return ''
    parser = PlainText(); parser.feed(value)
    return re.sub(r'\n{3,}', '\n\n', ''.join(parser.parts)).strip()

def canonical(url):
    p = urlsplit(url)
    if p.scheme not in ('https', 'http', 'file'):
        raise ValueError('Sono ammessi solo URL http, https o file.')
    if p.scheme in ('http', 'https') and (not p.hostname or p.username or p.password):
        raise ValueError('URL non valido o con credenziali.')
    if len(url) > 16000: raise ValueError('URL troppo lungo.')
    return urlunsplit((p.scheme, p.netloc, p.path, p.query, ''))

def digest(data): return hashlib.sha256(data).hexdigest()
def encoded(obj): return (json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode()
def tags(values):
    if not isinstance(values, list): return []
    return list(dict.fromkeys(str(x.get('name', x.get('title', ''))) if isinstance(x, dict) else str(x) for x in values))

def frontmatter(doc):
    fields = {"local_highlights_id": doc['id'], "title": doc['title'], "source": doc['url'], "tags": doc.get('tags', []), "collections": doc.get('collections', [])}
    return '---\n' + '\n'.join(k + ': ' + json.dumps(v, ensure_ascii=False) for k,v in fields.items()) + '\n---\n\n'

def markdown(doc):
    lines = ['# ' + doc['title'].replace('\n', ' '), '', '<' + doc['url'].replace('>', '%3E').replace('<', '%3C') + '>', '']
    if doc.get('notes'): lines += ['## Note sulla pagina', '', doc['notes'], '']
    for mark in doc.get('marks', []):
        lines += ['## ' + ('Nota' if mark.get('kind') == 'note' else 'Evidenziazione'), '', '> ' + mark.get('text', '').replace('\n', '\n> '), '']
        if mark.get('notes'): lines += [mark['notes'], '']
        if mark.get('tags'): lines += ['Tag: ' + ', '.join(mark['tags']), '']
        if mark.get('anchor', {}).get('page'): lines += ['Pagina PDF: ' + str(mark['anchor']['page']), '']
        lines += ['^lh-' + mark['id'], '']
    return '\n'.join(lines) + '\n'

def validate(doc):
    if not isinstance(doc, dict): raise ValueError('Documento non valido.')
    id = doc.get('id', '')
    if not isinstance(id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', id): raise ValueError('ID non valido.')
    canonical(doc.get('url', ''))
    for key in ('title', 'notes', 'reader'):
        if key in doc and not isinstance(doc[key], str): raise ValueError('Campo testo non valido: ' + key)
    if len(doc.get('title', '')) > 4000: raise ValueError('Titolo troppo lungo.')
    for key in ('tags', 'collections'):
        if not isinstance(doc.get(key, []), list) or any(not isinstance(x, str) or len(x) > 500 for x in doc.get(key, [])): raise ValueError('Tag o raccolte non validi.')
    if not isinstance(doc.get('marks', []), list) or len(doc.get('marks', [])) > 10000: raise ValueError('Evidenziazioni non valide.')
    seen = set()
    for mark in doc.get('marks', []):
        if not isinstance(mark, dict) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', str(mark.get('id', ''))): raise ValueError('ID evidenziazione non valido.')
        if mark['id'] in seen: raise ValueError('ID evidenziazione duplicato.')
        seen.add(mark['id'])
        for k in ('text', 'notes'):
            if not isinstance(mark.get(k, ''), str): raise ValueError('Testo evidenziazione non valido.')
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', mark.get('color', '#fdffb4')): raise ValueError('Colore non valido.')
        if not isinstance(mark.get('tags', []), list) or any(not isinstance(t, str) for t in mark.get('tags', [])): raise ValueError('Tag non validi.')
        anchor = mark.get('anchor', {})
        if not isinstance(anchor, dict): raise ValueError('Ancora non valida.')
        if 'page' in anchor and (type(anchor['page']) is not int or not 1 <= anchor['page'] <= 100000): raise ValueError('Pagina PDF non valida.')
    if len(encoded(doc)) > 24 * 1024 * 1024: raise ValueError('Documento troppo grande (24 MB).')

class Store:
    def __init__(self, root=DEFAULT_VAULT):
        self.root = Path(root).resolve()
        self.data = self.root / 'Highlights'
        self.state = self.root / '.local-highlights'
        self.data.mkdir(parents=True, exist_ok=True)
        self.state.mkdir(parents=True, exist_ok=True)
        if self.data.is_symlink() or self.state.is_symlink(): raise ValueError('Le cartelle dati non possono essere collegamenti simbolici.')

    @contextlib.contextmanager
    def locked(self):
        with (self.state / 'lock').open('a') as file:
            fcntl.flock(file, fcntl.LOCK_EX)
            yield

    def paths(self, id):
        if not isinstance(id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', id): raise ValueError('ID non valido.')
        paths = [self.data / (id + ext) for ext in ('.json', '.md')]
        if any(p.is_symlink() for p in paths): raise ValueError('I file dati non possono essere collegamenti simbolici.')
        return paths

    def get(self, id):
        jp, mp = self.paths(id)
        if not jp.exists():
            if mp.exists(): raise Conflict('File Markdown senza JSON: ripristina il JSON dalla cronologia.')
            return None
        raw = jp.read_bytes()
        try: doc = json.loads(raw)
        except (ValueError, UnicodeError) as exc: raise ValueError(f'JSON non valido in {jp.name}. File preservato.') from exc
        validate(doc)
        if doc['id'] != id: raise ValueError('ID diverso dal nome del file.')
        md = mp.read_bytes() if mp.exists() else b''
        return {'document': doc, 'revision': digest(raw + b'\0' + md), 'markdown': md.decode('utf-8')}

    def find(self, url):
        target = canonical(url)
        for path in sorted(self.data.glob('*.json')):
            got = self.get(path.stem)
            if got and canonical(got['document']['url']) == target: return got
        return None

    def list(self, query='', offset=0, limit=50, tag='', collection='', starred=False):
        offset = max(0, int(offset)); limit = max(1, min(100, int(limit)))
        items, errors = [], []
        for path in self.data.glob('*.json'):
            try: got = self.get(path.stem)
            except ValueError as exc:
                errors.append(str(exc)); continue
            if not got: continue
            doc = got['document']
            if query.casefold() not in json.dumps(doc, ensure_ascii=False).casefold(): continue
            if tag and tag not in doc.get('tags', []) and not any(tag in m.get('tags', []) for m in doc.get('marks', [])): continue
            if collection and collection not in doc.get('collections', []): continue
            if starred and not doc.get('starred'): continue
            items.append({k:doc.get(k) for k in ('id', 'title', 'url', 'tags', 'collections', 'starred', 'updatedAt')})
            items[-1]['count'] = len(doc.get('marks', []))
        items.sort(key=lambda x: x.get('updatedAt') or 0, reverse=True)
        return {'items': items[offset:offset+limit], 'total': len(items), 'errors': errors, 'root': str(self.root)}

    def atomic(self, path, data):
        if path.is_symlink(): raise ValueError('Collegamento simbolico non ammesso.')
        fd, name = tempfile.mkstemp(prefix='.lh-', dir=path.parent)
        try:
            with os.fdopen(fd, 'wb') as file:
                file.write(data); file.flush(); os.fsync(file.fileno())
            os.replace(name, path)
            dirfd = os.open(path.parent, os.O_DIRECTORY)
            try: os.fsync(dirfd)
            finally: os.close(dirfd)
        finally:
            if os.path.exists(name): os.unlink(name)

    def archive(self, id):
        folder = self.state / 'history' / (str(time.time_ns()) + '-' + uuid.uuid4().hex[:8])
        folder.mkdir(parents=True)
        for path in self.paths(id):
            if path.exists(): self.atomic(folder / path.name, path.read_bytes())

    def _save(self, doc, expected):
        validate(doc)
        old = self.get(doc['id'])
        if (old['revision'] if old else None) != expected:
            raise Conflict('Il file è cambiato. Ricarica prima di salvare. Le modifiche aperte sono ancora nel modulo.')
        jp, mp = self.paths(doc['id'])
        prefix, suffix = '', '\n\n## Note personali Obsidian\n\n'
        if old and old['markdown']:
            existing = old['markdown']
            if existing.count(BEGIN) != 1 or existing.count(END) != 1: raise Conflict('Marcatori Markdown modificati. Ripristinali dalla cronologia prima di salvare.')
            prefix, rest = existing.split(BEGIN, 1)
            generated, suffix = rest.split(END, 1)
            # shortcut: edited generated sections block writes; reconcile them manually before saving.
            if generated != markdown(old['document']) or prefix != frontmatter(old['document']):
                raise Conflict('La sezione generata del Markdown è stata modificata esternamente. File preservati. Confronta JSON e Markdown con la cronologia.')
        if old:
            self.archive(doc['id'])
            if self.get(doc['id'])['revision'] != expected: raise Conflict('Il file è cambiato durante il salvataggio. Ricarica prima di salvare.')
        doc = copy.deepcopy(doc)
        doc['schema'] = 1
        doc['updatedAt'] = int(time.time() * 1000)
        doc.setdefault('createdAt', doc['updatedAt'])
        rendered = frontmatter(doc) + BEGIN + markdown(doc) + END + suffix
        # A crash between replacements leaves both old files in history and blocks further writes.
        self.atomic(jp, encoded(doc))
        self.atomic(mp, rendered.encode())
        return self.get(doc['id'])

    def save(self, doc, expected):
        with self.locked(): return self._save(doc, expected)

    def delete(self, id, expected):
        with self.locked():
            old = self.get(id)
            if not old or old['revision'] != expected: raise Conflict('Il file è cambiato. Ricarica prima di eliminare.')
            self.archive(id)
            for path in self.paths(id): path.unlink(missing_ok=True)
        return {'deleted': id}

    def import_backup(self, raw):
        if not isinstance(raw, dict) or not isinstance(raw.get('bookmarks'), list) or not isinstance(raw.get('marks'), list): raise ValueError('Export Web Highlights non valido.')
        payload = encoded(raw); sha = digest(payload)
        with self.locked():
            folder = self.state / 'imports'; folder.mkdir(exist_ok=True)
            archive = folder / (sha + '.json')
            if not archive.exists(): self.atomic(archive, payload)
            bookmarks = {str(b['_id']): b for b in raw['bookmarks']}
            grouped = {key: [] for key in bookmarks}
            for mark in raw['marks']:
                key = str(mark.get('_bookmark', ''))
                if key not in bookmarks:
                    key = next((k for k,b in bookmarks.items() if b.get('url') == mark.get('url')), 'orphan-' + str(mark.get('_id', uuid.uuid4().hex)))
                    if key not in bookmarks: bookmarks[key] = {'_id': key, 'url': mark.get('url'), 'title': mark.get('title', mark.get('url', ''))}
                grouped.setdefault(key, []).append(mark)
            created, skipped, errors = 0, 0, []
            for key, b in bookmarks.items():
                id = 'wh-' + re.sub('[^A-Za-z0-9_-]', '_', key)[:100]
                try:
                    if self.get(id): skipped += 1; continue
                    pc = [x for x in raw.get('pagecontents', []) if x.get('url') == b.get('url')]
                    marks = []
                    order = b.get('marksSortIndexMap', {})
                    source_marks = sorted(grouped.get(key, []), key=lambda m: order.get(m.get('_id'), float('inf')))
                    for m in source_marks:
                        exact = m.get('text') or m.get('highlightSource', {}).get('text', '')
                        marks.append({'id': 'wh-' + str(m['_id']), 'text': plain(exact) if '<' in exact and m.get('mediaType') != 'blockquote' else exact, 'notes': plain(m.get('notes', '')), 'tags': tags(m.get('tags', [])), 'color': m.get('color', '#fdffb4'), 'anchor': {'exact': exact, 'legacy': m.get('highlightSource', {}), 'legacyReader': m.get('highlightSourceReader', {})}, 'source': m, 'createdAt': m.get('createdAt', 0)})
                    doc = {'id': id, 'url': b['url'], 'title': b.get('title') or b['url'], 'notes': '', 'marks': marks, 'tags': tags(b.get('tags', [])), 'collections': [], 'starred': b.get('isStarred', False), 'reader': plain(pc[0].get('content', '')) if pc else '', 'source': b, 'pagecontents': pc, 'createdAt': b.get('createdAt', 0)}
                    self._save(doc, None); created += 1
                except (ValueError, KeyError) as exc: errors.append({'id': id, 'error': str(exc)})
            return {'created': created, 'skipped': skipped, 'errors': errors, 'marks': len(raw['marks']), 'archive': str(archive)}
