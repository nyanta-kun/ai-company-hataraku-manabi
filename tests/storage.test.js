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

test('localStorage が無い／例外でもクラッシュせず isPersistent が false', () => {
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
    assert.doesNotThrow(() => { S.load(); S.save(S.defaults()); S.clear(); });
    assert.equal(S.isPersistent(), false);
    Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('denied'); }, configurable: true });
    assert.doesNotThrow(() => { S.load(); S.save(S.defaults()); });
    assert.equal(S.isPersistent(), false);
  } finally {
    if (orig) Object.defineProperty(globalThis, 'localStorage', orig); else delete globalThis.localStorage;
  }
});

test('localStorage が使えれば保存・読み込みでき isPersistent が true', () => {
  const mem = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } },
    configurable: true, writable: true
  });
  try {
    const d = S.defaults(); d.cards.dump = 2; S.save(d);
    assert.equal(S.isPersistent(), true);
    assert.equal(S.load().cards.dump, 2);
  } finally { delete globalThis.localStorage; }
});

test('旧データ（clock なし）は T1・固定なし・stats 0 で補完され、既存の項目は保たれる', () => {
  const old = { version: 1, levels: { math: 'M3', letter: 'K2' }, locked: { math: true, letter: false },
    cards: { dump: 2 }, stats: { sessions: 5, math: { sessions: 3, questions: 12, firstTry: 8 }, letter: { sessions: 2, questions: 8, firstTry: 5 } } };
  const d = S.normalize(old);
  assert.equal(d.levels.clock, 'T1');
  assert.equal(d.locked.clock, false);
  assert.deepEqual(d.stats.clock, { sessions: 0, questions: 0, firstTry: 0 });
  assert.equal(d.levels.math, 'M3'); assert.equal(d.locked.math, true); assert.equal(d.cards.dump, 2);
  assert.deepEqual(d.stats.math, { sessions: 3, questions: 12, firstTry: 8 });
  assert.equal(d.stats.sessions, 5);
});

test('clock の不正値（レベル・負数・文字列）は戻る', () => {
  const d = S.normalize({ levels: { clock: 'T9' }, locked: { clock: 'yes' }, stats: { clock: { sessions: -1, questions: 'a', firstTry: 2.7 } } });
  assert.equal(d.levels.clock, 'T1');
  assert.equal(d.locked.clock, false);
  assert.deepEqual(d.stats.clock, { sessions: 0, questions: 0, firstTry: 2 });
  assert.equal(S.normalize({ levels: { clock: 'T3' }, locked: { clock: true } }).levels.clock, 'T3');
  ['T4', 'T5', 'T6'].forEach(t => assert.equal(S.normalize({ levels: { clock: t } }).levels.clock, t));
  assert.equal(S.normalize({ levels: { clock: 'T7' } }).levels.clock, 'T1');
});

test('seen.letter: 旧データは空配列。配列でない値・文字列以外・未知の絵・重複・13個以上も正規化される', () => {
  assert.deepEqual(S.normalize({ levels: { math: 'M3' } }).seen, { letter: [] });
  assert.deepEqual(S.normalize(null).seen, { letter: [] });
  for (const bad of ['v6', 5, {}, null, true]) assert.deepEqual(S.normalize({ seen: { letter: bad } }).seen.letter, []);
  assert.deepEqual(S.normalize({ seen: 'x' }).seen, { letter: [] });
  assert.deepEqual(S.normalize({ seen: { letter: ['v6', 3, null, 'nope', 'airplane', 'v6', {}, 'bus'] } }).seen.letter, ['airplane', 'v6', 'bus']);
  const many = ['v1', 'v2', 'v3', 'v5', 'v6', 'v9', 'v10', 'hose', 'flame', 'airplane', 'train', 'ship', 'bus', 'truck'];
  assert.deepEqual(S.normalize({ seen: { letter: many } }).seen.letter, many.slice(-12));
  const d = S.normalize({ seen: { letter: ['v6', 'bus'] } });
  assert.deepEqual(S.normalize(JSON.parse(JSON.stringify(d))).seen.letter, ['v6', 'bus']);   // 保存して読み直しても同じ
});

test('letter レベル K4〜K6 を保存・読み込みでき、範囲外（K7）は K1 に戻る', () => {
  for (const lv of ['K4', 'K5', 'K6']) assert.equal(S.normalize({ levels: { letter: lv } }).levels.letter, lv);
  assert.equal(S.normalize({ levels: { letter: 'K7' } }).levels.letter, 'K1');
  assert.equal(S.normalize({ levels: { letter: 'K2' }, locked: { letter: true } }).locked.letter, true);
});
