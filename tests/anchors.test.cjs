const {test} = require('node:test');
const assert = require('node:assert/strict');
require('../extension/anchors.js');
const {findQuote, normalize} = globalThis.LHAnchors;
test('matches collapsed whitespace and preserves raw offsets', () => {
 const text='Before hello\n  world after';
 const found=findQuote(text,{exact:'hello world',prefix:'Before ',suffix:' after'});
 assert.equal(text.slice(found.start,found.end),'hello\n  world');
});
test('refuses ambiguous text without context', () => {
 assert.equal(findQuote('repeat then repeat',{exact:'repeat'}),null);
 assert.equal(findQuote('repeat then repeat',{exact:'repeat',prefix:'then '}).start,12);
});
test('does not guess missing quotations', () => assert.equal(findQuote('changed article',{exact:'old article'}),null));
test('handles NBSP and unicode', () => assert.equal(normalize('caffè\u00a0 ☕').text,'caffè ☕'));
