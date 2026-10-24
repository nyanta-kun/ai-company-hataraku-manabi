const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/problems.js');
const D = require('../src/data.js');
const { rngOf } = require('./helpers.js');

function checkChoices(q, lo, hi, n) {
  assert.equal(q.choices.length, n);
  assert.equal(new Set(q.choices).size, n, '重複なし');
  assert.equal(q.choices.filter((c) => c === q.answer).length, 1, '正解がちょうど 1 つ');
  q.choices.forEach((c) => { assert.ok(Number.isInteger(c) && c >= lo && c <= hi, 'range ' + c); });
  assert.deepEqual(q.choices, q.choices.slice().sort((a, b) => a - b));
}

test('S1 数1: M8 の 1 回は「数える 2 問 + くり上がりなしのたしざん 2 問」。性質を 1000 回分検査', () => {
  const r = rngOf(81);
  const seenN = new Set();
  for (let i = 0; i < 1000; i++) {
    const qs = P.generateSession('math', 'M8', r);
    assert.equal(qs.length, 4);
    assert.equal(qs.filter((q) => q.kind === 'count').length, 2);
    assert.equal(qs.filter((q) => q.kind === 'add').length, 2);
    qs.forEach((q, k) => {
      assert.equal(q.level, 'M8');
      if (q.kind === 'count') {
        assert.ok(q.n >= 11 && q.n <= 20); assert.equal(q.answer, q.n); seenN.add(q.n);
        checkChoices(q, 10, 20, 4);
      } else {
        assert.ok(q.a >= 11 && q.a <= 18 && q.b >= 1);
        assert.equal(q.answer, q.a + q.b);
        assert.ok(q.a % 10 + q.b <= 9, 'くり上がりなし: ' + q.a + '+' + q.b);
        assert.equal(Math.floor((q.a + q.b) / 10), Math.floor(q.a / 10), '十の位は変わらない');
        assert.ok(q.answer >= 12 && q.answer <= 19);
        checkChoices(q, 1, 20, 4);
      }
      if (k > 0) assert.ok(!P.sameProblem(qs[k - 1], q), '連続して同じ問題にならない');
    });
  }
  assert.deepEqual([...seenN].sort((a, b) => a - b), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
});

test('S1 数2: M8 のたしざんは、くり上がりなしの全組み合わせが出る（他は出ない）', () => {
  const want = new Set();
  for (let a = 11; a <= 18; a++) for (let b = 1; b <= 9 - a % 10; b++) want.add(a + '+' + b);
  const got = new Set(), r = rngOf(82);
  for (let i = 0; i < 4000; i++) { const q = P.generateAddition('M8', r); got.add(q.a + '+' + q.b); }
  assert.deepEqual([...got].sort(), [...want].sort());
});

test('S1 数3: M9 はくり上がりのある全 36 組（a,b は 2〜9、和 11〜18）。選択肢は 10〜20 の 4 つ', () => {
  const want = new Set();
  for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) if (a + b >= 11) want.add(a + '+' + b);
  assert.equal(want.size, 36);
  const got = new Set(), r = rngOf(91);
  for (let i = 0; i < 4000; i++) {
    const q = P.generateAddition('M9', r); got.add(q.a + '+' + q.b);
    assert.equal(q.answer, q.a + q.b);
    assert.ok(q.a % 10 + q.b % 10 >= 10, 'くり上がりが起きる');
    assert.ok(q.answer >= 11 && q.answer <= 18);
    checkChoices(q, 10, 20, 4);
  }
  assert.deepEqual([...got].sort(), [...want].sort());
});

test('S1 数4: M10 はくり下がりのある全組（a 11〜18、b 2〜9、一の位 < b、答え 2〜9）。選択肢は 1〜10 の 4 つ', () => {
  const want = new Set();
  for (let a = 11; a <= 18; a++) for (let b = 2; b <= 9; b++) if (a % 10 < b) want.add(a + '-' + b);
  const got = new Set(), r = rngOf(101);
  for (let i = 0; i < 4000; i++) {
    const q = P.generateSubtraction('M10', r); got.add(q.a + '-' + q.b);
    assert.equal(q.kind, 'sub');
    assert.equal(q.answer, q.a - q.b);
    assert.ok(q.a % 10 < q.b, 'くり下がりが起きる');
    assert.ok(q.answer >= 2 && q.answer <= 9);
    checkChoices(q, 1, 10, 4);
  }
  assert.deepEqual([...got].sort(), [...want].sort());
});

test('S1 数5: M9・M10 の 1 回は 4 問、連続して同じ問題にならない。固定シードなら同じ結果', () => {
  ['M9', 'M10'].forEach((lv) => {
    const r = rngOf(7);
    for (let i = 0; i < 1000; i++) {
      const qs = P.generateSession('math', lv, r);
      assert.equal(qs.length, 4);
      for (let k = 1; k < 4; k++) assert.ok(!P.sameProblem(qs[k - 1], qs[k]));
    }
    assert.deepEqual(P.generateSession('math', lv, rngOf(5)), P.generateSession('math', lv, rngOf(5)));
  });
  assert.deepEqual(P.generateSession('math', 'M8', rngOf(5)), P.generateSession('math', 'M8', rngOf(5)));
});

test('S1 数6: 数の読み上げ（NUM_KANA）が問題の全ての数・答え・選択肢で引ける', () => {
  const r = rngOf(3);
  ['M8', 'M9', 'M10'].forEach((lv) => {
    for (let i = 0; i < 300; i++) P.generateSession('math', lv, r).forEach((q) => {
      [q.n, q.a, q.b, q.answer].concat(q.choices).filter((x) => x !== undefined).forEach((x) => assert.ok(D.NUM_KANA[x], 'NUM_KANA[' + x + ']'));
    });
  });
});

test('S1 数7: 範囲外のレベルは RangeError。M8 の部品は M8 以外で呼ぶとたしざん／数えるの通常動作', () => {
  assert.throws(() => P.generateSession('math', 'M11', rngOf(1)), RangeError);
  assert.throws(() => P.generateCounting('M9', rngOf(1)), RangeError);
  assert.throws(() => P.generateSubtraction('M9', rngOf(1)), RangeError);
  assert.throws(() => P.generateAddition('M10', rngOf(1)), RangeError);
});
