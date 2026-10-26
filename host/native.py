#!/usr/bin/python3
"""Firefox native messaging bridge. No TCP listener or background daemon."""
import base64
import json
import hashlib
import re
from pathlib import Path
import struct
import sys
from urllib.parse import unquote, urlsplit
from store import Store, DEFAULT_VAULT
MAX_INPUT = 32 * 1024 * 1024

def dispatch(store, request):
    op = request.get('op')
    if op == 'list': return store.list(**{k:request[k] for k in ('query', 'offset', 'limit', 'tag', 'collection', 'starred') if k in request})
    if op == 'get': return store.get(request['id']) if request.get('id') else store.find(request['url'])
    if op == 'save': return store.save(request['document'], request.get('revision'))
    if op == 'delete': return store.delete(request['id'], request.get('revision'))
    if op == 'import':
        if 'data' in request: return store.import_backup(request['data'])
        name = request.get('name', '')
        if not isinstance(name, str) or Path(name).name != name or not name.endswith('.json'): raise ValueError('Nome export non valido.')
        path = store.root / name
        if path.is_symlink() or path.stat().st_size > MAX_INPUT: raise ValueError('File non valido o troppo grande.')
        return store.import_backup(json.loads(path.read_bytes()))
    if op == 'pdf_chunk':
        id = request.get('id', '')
        if not re.fullmatch('[a-f0-9]{64}', id): raise ValueError('ID PDF non valido.')
        data = base64.b64decode(request.get('data', ''), validate=True)
        if len(data) > 512000: raise ValueError('Blocco PDF troppo grande.')
        folder = store.root / 'PDF'; folder.mkdir(exist_ok=True)
        if folder.is_symlink(): raise ValueError('Cartella PDF non valida.')
        target = folder / (id + '.pdf')
        temp = store.state / (id + '.upload')
        if target.is_symlink() or temp.is_symlink(): raise ValueError('File PDF non valido.')
        with store.locked():
            if target.exists(): return {'url': target.as_uri(), 'done': True}
            offset = request.get('offset', 0)
            if type(offset) is not int or offset != (temp.stat().st_size if temp.exists() else 0): raise ValueError('Ordine blocchi PDF non valido.')
            if offset + len(data) > 64 * 1024 * 1024: raise ValueError('PDF oltre 64 MB.')
            with temp.open('ab') as f: f.write(data)
            if request.get('last'):
                payload = temp.read_bytes()
                if not payload.startswith(b'%PDF-') or hashlib.sha256(payload).hexdigest() != id:
                    temp.unlink(); raise ValueError('PDF incompleto o checksum non valido.')
                store.atomic(target, payload); temp.unlink()
                return {'url': target.as_uri(), 'done': True}
            return {'offset': offset + len(data), 'done': False}
    if op == 'read_pdf':
        p = urlsplit(request['url'])
        if p.scheme != 'file' or p.netloc not in ('', 'localhost'): raise ValueError('Richiesto un PDF locale.')
        path = Path(unquote(p.path)).resolve()
        if path.suffix.lower() != '.pdf' or path.stat().st_size > 64 * 1024 * 1024: raise ValueError('PDF non valido o oltre 64 MB.')
        data = path.read_bytes()
        if not data.startswith(b'%PDF-'): raise ValueError('Il file non è un PDF.')
        return {'base64': base64.b64encode(data).decode()}
    if op == 'status': return {'root': str(store.root), 'version': '0.2.1'}
    raise ValueError('Operazione sconosciuta.')

def read_exact(stream, size):
    chunks = bytearray()
    while len(chunks) < size:
        part = stream.read(size - len(chunks))
        if not part: raise EOFError('Messaggio incompleto.')
        chunks.extend(part)
    return bytes(chunks)

def write_message(message):
    data = json.dumps(message, ensure_ascii=False).encode()
    sys.stdout.buffer.write(struct.pack('@I', len(data)) + data)
    sys.stdout.buffer.flush()

def main():
    config = Path(__file__).with_name('config.json')
    root = json.loads(config.read_text())['vault'] if config.exists() else DEFAULT_VAULT
    store = Store(root)
    while True:
        header = sys.stdin.buffer.read(4)
        if not header: return
        if len(header) != 4: raise EOFError('Header incompleto.')
        length = struct.unpack('@I', header)[0]
        if length > MAX_INPUT: raise ValueError('Richiesta oltre 32 MB.')
        request = json.loads(read_exact(sys.stdin.buffer, length))
        try: result = {'ok': True, 'result': dispatch(store, request)}
        except (ValueError, OSError, KeyError, TypeError) as exc: result = {'ok': False, 'error': str(exc)}
        data = json.dumps(result, ensure_ascii=False).encode()
        # Keep each reply below Firefox's 1 MB native messaging limit.
        chunks = [base64.b64encode(data[i:i+384000]).decode() for i in range(0, len(data), 384000)]
        for i, chunk in enumerate(chunks): write_message({'id': request.get('requestId'), 'chunk': chunk, 'last': i == len(chunks)-1})

if __name__ == '__main__':
    try: main()
    except Exception as exc:
        print(str(exc), file=sys.stderr); sys.exit(1)
