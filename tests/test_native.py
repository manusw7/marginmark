import base64
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'host'))
from native import dispatch, read_exact
from store import Store

class NativeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.store = Store(self.temp.name)

    def test_pdf_upload_checksum_order_and_reopen(self):
        data = b'%PDF-1.7\n' + b'x' * 1000000
        id = hashlib.sha256(data).hexdigest()
        first = {'op': 'pdf_chunk', 'id': id, 'offset': 0, 'data': base64.b64encode(data[:384000]).decode()}
        self.assertFalse(dispatch(self.store, first)['done'])
        with self.assertRaises(ValueError): dispatch(self.store, first)
        for offset in range(384000, len(data), 384000):
            result = dispatch(self.store, {'op': 'pdf_chunk', 'id': id, 'offset': offset, 'data': base64.b64encode(data[offset:offset+384000]).decode(), 'last': offset+384000 >= len(data)})
        self.assertTrue(result['done'])
        reopened = dispatch(self.store, {'op': 'read_pdf', 'url': result['url']})
        self.assertEqual(base64.b64decode(reopened['base64']), data)
        with self.assertRaises(ValueError): dispatch(self.store, {'op':'pdf_chunk', 'id':'../../escape', 'data':''})
        bad = {'op':'pdf_chunk', 'id':'a'*64, 'data':base64.b64encode(b'%PDF-wrong').decode(), 'last':True}
        with self.assertRaises(ValueError): dispatch(self.store, bad)
        self.assertFalse((self.store.root/'PDF'/('a'*64+'.pdf')).exists())

    def test_import_traversal_and_non_pdf_reads_rejected(self):
        for name in ['../backup.json', '/tmp/backup.json', 'backup.txt']:
            with self.assertRaises(ValueError): dispatch(self.store, {'op':'import', 'name':name})
        file = self.store.root / 'fake.pdf'; file.write_text('secret text')
        with self.assertRaises(ValueError): dispatch(self.store, {'op':'read_pdf', 'url':file.as_uri()})

    def test_truncated_native_message_detected(self):
        self.assertEqual(read_exact(io.BytesIO(b'abc'),3),b'abc')
        with self.assertRaises(EOFError): read_exact(io.BytesIO(b'ab'),3)

if __name__ == '__main__': unittest.main()
