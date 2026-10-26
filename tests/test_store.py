import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'host'))
from store import Store, Conflict

class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = Store(self.root)
        self.addCleanup(self.temp.cleanup)

    def create(self):
        return self.store.save({'id': 'test', 'url': 'https://example.org/a', 'title': 'Title', 'marks': [], 'notes': '', 'tags': [], 'collections': []}, None)

    def test_crud_reopen_and_stale_update(self):
        first = self.create()
        doc = copy.deepcopy(first['document'])
        doc['marks'] = [{'id': 'mark', 'text': 'hello', 'notes': 'note', 'tags': ['tag'], 'color': '#ffee99', 'anchor': {'exact': 'hello'}}]
        saved = self.store.save(doc, first['revision'])
        reopened = Store(self.root).get('test')
        self.assertEqual(reopened['document']['marks'][0]['text'], 'hello')
        with self.assertRaises(Conflict): self.store.save(doc, first['revision'])
        self.store.delete('test', saved['revision'])
        self.assertIsNone(self.store.get('test'))
        self.assertTrue(list((self.root / '.local-highlights/history').rglob('*.json')))

    def test_markdown_external_changes_never_overwritten(self):
        first = self.create()
        self.assertTrue(first['markdown'].startswith('---\n'))
        md = self.root / 'Highlights/test.md'
        md.write_text(md.read_text() + '\nMy Obsidian note\n')
        with self.assertRaises(Conflict): self.store.save(first['document'], first['revision'])
        fresh = self.store.get('test')
        fresh['document']['title'] = 'Changed'
        self.store.save(fresh['document'], fresh['revision'])
        self.assertIn('My Obsidian note', md.read_text())
        md.write_text(md.read_text().replace('Changed', 'Edited externally'))
        fresh = self.store.get('test')
        with self.assertRaises(Conflict): self.store.save(fresh['document'], fresh['revision'])
        self.assertIn('Edited externally', md.read_text())

    def test_external_json_is_reloaded_and_invalid_json_is_preserved(self):
        first = self.create()
        path = self.root / 'Highlights/test.json'
        doc = json.loads(path.read_text()); doc['notes'] = 'External'
        path.write_text(json.dumps(doc))
        self.assertEqual(self.store.get('test')['document']['notes'], 'External')
        with self.assertRaises(Conflict): self.store.save(first['document'], first['revision'])
        path.write_text('{broken')
        with self.assertRaises(ValueError): self.store.get('test')
        self.assertEqual(path.read_text(), '{broken')

    def test_import_preserves_relations_unknown_fields_and_is_idempotent(self):
        raw = {'bookmarks': [{'_id': 'page', 'url': 'https://example.org', 'title': 'A', 'meta': {'x': 1}}], 'marks': [{'_id': 'm', '_bookmark': 'page', 'text': 'quote', 'notes': '<p>Note</p>', 'highlightSource': {'text': 'quote'}, 'tags': ['tag']}], 'pagecontents': [{'_id': 'pc', 'url': 'https://example.org', 'content': '<p>Full article</p>'}], 'chromeSettings': {'defaultHighlightColor': '#aaaaaa'}}
        result = self.store.import_backup(raw)
        self.assertEqual(result['created'], 1)
        self.assertEqual(self.store.import_backup(raw)['skipped'], 1)
        doc = self.store.get('wh-page')['document']
        self.assertEqual(doc['marks'][0]['notes'], 'Note')
        self.assertEqual(doc['marks'][0]['source']['_bookmark'], 'page')
        self.assertEqual(doc['source']['meta']['x'], 1)
        self.assertEqual(doc['reader'], 'Full article')
        doc['notes'] = 'New local note'
        got = self.store.get(doc['id']); self.store.save(doc, got['revision'])
        self.store.import_backup(raw)
        self.assertEqual(self.store.get(doc['id'])['document']['notes'], 'New local note')

    def test_import_applies_source_order(self):
        raw = {'bookmarks': [{'_id':'p', 'url':'https://example.org', 'title':'A', 'marksSortIndexMap':{'b':0,'a':1}}], 'marks':[{'_id':'a','_bookmark':'p','text':'A'}, {'_id':'b','_bookmark':'p','text':'B'}]}
        self.store.import_backup(raw)
        self.assertEqual([m['text'] for m in self.store.get('wh-p')['document']['marks']], ['B','A'])

    def test_paths_and_unsafe_urls_rejected(self):
        for id in ['../bad', '/tmp/bad', 'a/b', '.hidden']:
            with self.assertRaises(ValueError): self.store.get(id)
        doc = self.create()['document']; doc['url'] = 'javascript:alert(1)'
        with self.assertRaises(ValueError): self.store.save(doc, None)

    def test_large_library_paginated_and_searches_notes(self):
        doc = self.create()['document']; got = self.store.get('test')
        doc['notes'] = 'needle'; self.store.save(doc, got['revision'])
        self.assertEqual(len(self.store.list(query='needle')['items']), 1)
        self.assertEqual(self.store.list(query='absent')['total'], 0)

if __name__ == '__main__': unittest.main()
