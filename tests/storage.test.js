const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/storage.js');

test('壊れたデータや欠損はデフォルトで埋まる', () => {
  assert.deepEqual(S.normalize(null), S.defaults());
  assert.deepEqual(S.normalize('x'), S.defaults());
  const d = S.normalize({ levels: { math: 'M9', letter: 'K2' }, cards: { shoubousha: 9, foo: 1, dump: -1 }, stats: { sessions: 'a' } });
  assert.equal(d.levels.math, 'M1');
  assert.equal(d.levels.letter, 'K2');
  assert.deepEqual(d.cards, { shoubousha: 3 });
  assert.equal(d.stats.sessions, 0);
});

test('localStorage が無くてもクラッシュしない', () => {
  assert.doesNotThrow(() => { S.load(); S.save(S.defaults()); S.clear(); });
  assert.equal(S.isPersistent(), false);
});
