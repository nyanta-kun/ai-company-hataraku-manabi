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

test('S2 数1: M11 は 10〜100 の数（10 の束 + ばら）。1000 問以上で性質を検査', () => {
  const r = rngOf(111), seen = new Set();
  let multiples = 0, total = 0;
  for (let i = 0; i < 400; i++) {
    const qs = P.generateSession('math', 'M11', r);
    assert.equal(qs.length, 4);
    qs.forEach((q, k) => {
      total++;
      assert.equal(q.kind, 'count'); assert.equal(q.level, 'M11'); assert.equal(q.tens, true);
      assert.equal(q.answer, q.n);
      assert.ok(q.n >= 10 && q.n <= 100);
      checkChoices(q, 10, 100, 4);
      seen.add(q.n); if (q.n % 10 === 0) multiples++;
      if (k > 0) assert.ok(!P.sameProblem(qs[k - 1], q), '連続して同じ問題にならない');
    });
  }
  assert.ok(total >= 1000);
  assert.ok(multiples / total > 0.1 && multiples / total < 0.35, 'ちょうど 10 の束だけの問題が 2 割ほど');
  for (let n = 10; n <= 100; n++) assert.ok(seen.has(n), n + ' が出る');
});

test('S2 数2: M11 の誤答に、十の位と一の位の取り違え（37 に対して 73）が必ず入る（入れ替えられる数のとき）', () => {
  const r = rngOf(112);
  let swaps = 0;
  for (let i = 0; i < 2000; i++) {
    const q = P.generateCounting('M11', r), t = Math.floor(q.n / 10), o = q.n % 10;
    if (o >= 1 && t >= 1 && t !== o) { swaps++; assert.ok(q.choices.includes(o * 10 + t), q.n + ' に ' + (o * 10 + t)); }
    // 10 の束・ばらのどちらかのまちがい（±10 か ±1）も入る
    assert.ok(q.choices.some((c) => Math.abs(c - q.n) === 10), q.n + ' に ±10');
  }
  assert.ok(swaps > 1000);
});

test('S2 数3: M12 は 1 回に たしざん 2 問・ひきざん 2 問。何十±何十 と 2けた±1けた（くり上がり・くり下がりなし）。答え 10〜99', () => {
  const r = rngOf(121);
  const forms = { tens: 0, ones: 0 };
  let total = 0;
  for (let i = 0; i < 400; i++) {
    const qs = P.generateSession('math', 'M12', r);
    assert.equal(qs.length, 4);
    assert.equal(qs.filter((q) => q.kind === 'add').length, 2);
    assert.equal(qs.filter((q) => q.kind === 'sub').length, 2);
    qs.forEach((q, k) => {
      total++;
      assert.equal(q.level, 'M12'); assert.equal(q.mental, true);
      assert.equal(q.answer, q.kind === 'add' ? q.a + q.b : q.a - q.b);
      assert.ok(q.answer >= 10 && q.answer <= 99);
      assert.ok(q.a <= 99 && q.a >= 10 && q.b >= 1);
      if (q.a % 10 === 0) {   // 何十 ± 何十
        assert.equal(q.b % 10, 0); forms.tens++;
        q.choices.forEach((c) => assert.equal(c % 10, 0, '何十の問題の選択肢は 10 きざみ'));
      } else {   // 2 けた ± 1 けた
        assert.ok(q.b >= 1 && q.b <= 9); forms.ones++;
        if (q.kind === 'add') assert.ok(q.a % 10 + q.b <= 9, 'くり上がりなし ' + q.a + '+' + q.b);
        else assert.ok(q.b <= q.a % 10, 'くり下がりなし ' + q.a + '-' + q.b);
      }
      checkChoices(q, 10, 99, 4);
      if (k > 0) assert.ok(!P.sameProblem(qs[k - 1], q), '連続して同じ問題にならない');
    });
  }
  assert.ok(total >= 1000);
  assert.ok(forms.tens > 300 && forms.ones > 300, JSON.stringify(forms));
});

test('S2 数4: M12 の「何十 ± 何十」「2けた ± 1けた」は全組が出る（他は出ない）', () => {
  const want = new Set();
  for (let a = 10; a <= 80; a += 10) for (let b = 10; a + b <= 90; b += 10) want.add('+' + a + ',' + b);
  for (let a = 20; a <= 90; a += 10) for (let b = 10; b < a; b += 10) want.add('-' + a + ',' + b);
  for (let a = 11; a <= 98; a++) if (a % 10 !== 0 && a % 10 <= 8) for (let b = 1; b <= 9 - a % 10; b++) want.add('+' + a + ',' + b);
  for (let a = 11; a <= 99; a++) if (a % 10 !== 0) for (let b = 1; b <= a % 10; b++) want.add('-' + a + ',' + b);
  const got = new Set(), r = rngOf(122);
  for (let i = 0; i < 30000; i++) {
    ['add', 'sub'].forEach((k) => { const q = k === 'add' ? P.generateAddition('M12', r) : P.generateSubtraction('M12', r); got.add((k === 'add' ? '+' : '-') + q.a + ',' + q.b); });
  }
  // 何十どうしは a が 10 の倍数の組。2けた±1けたの a が 10 の倍数（20+5 など）は含めない設計
  want.forEach((k) => assert.ok(got.has(k), k + ' が出る'));
  got.forEach((k) => assert.ok(want.has(k), k + ' は想定外'));
});

test('S2 数5: M13 は 2・5・3・4 のだん × 1〜9 の全 36 問。答えは a×b、誤答は その段の近い数（答え±だん・±いくつぶん・±1,2）', () => {
  const want = new Set();
  [2, 3, 4, 5].forEach((d) => { for (let m = 1; m <= 9; m++) want.add(d + 'x' + m); });
  assert.equal(want.size, 36);
  const got = new Set(), r = rngOf(131);
  for (let i = 0; i < 4000; i++) {
    const q = P.generateMultiplication('M13', r);
    got.add(q.a + 'x' + q.b);
    assert.equal(q.kind, 'mul');
    assert.equal(q.answer, q.a * q.b);
    checkChoices(q, 1, 60, 4);
    q.choices.filter((c) => c !== q.answer).forEach((c) => {
      const diff = Math.abs(c - q.answer);
      assert.ok([q.a, q.b, 1, 2].includes(diff), q.a + 'x' + q.b + ' の誤答 ' + c);
    });
    // 設計 3.8: a×(b±1) または (a±1)×b の誤答が必ず 1 つ以上入る
    assert.ok(q.choices.some((c) => c !== q.answer && (Math.abs(c - q.answer) === q.a || Math.abs(c - q.answer) === q.b)), 'かけざんの取り違えの誤答');
  }
  assert.deepEqual([...got].sort(), [...want].sort());
});

test('S2 数6: M13 は全 36 問で、どの問題でも 4 つの選択肢が作れる（端の組を個別に検査）', () => {
  [2, 3, 4, 5].forEach((d) => {
    for (let m = 1; m <= 9; m++) {
      for (let s = 1; s <= 30; s++) {
        const rr = rngOf(d * 100 + m * 10 + s);
        // 全組が出るまで引く代わりに、生成を直接呼べないので 36 問のうち該当を探す
        let q; for (let t = 0; t < 2000; t++) { q = P.generateMultiplication('M13', rr); if (q.a === d && q.b === m) break; }
        assert.ok(q.a === d && q.b === m);
        checkChoices(q, 1, 60, 4);
      }
    }
  });
});

test('S2 数7: M11・M12・M13 の 1 回は 4 問。固定シードなら同じ結果。読み上げ用の数の読み（NUM_KANA）が全部引ける', () => {
  ['M11', 'M12', 'M13'].forEach((lv) => {
    const r = rngOf(9);
    for (let i = 0; i < 300; i++) {
      const qs = P.generateSession('math', lv, r);
      assert.equal(qs.length, 4);
      for (let k = 1; k < 4; k++) assert.ok(!P.sameProblem(qs[k - 1], qs[k]));
      qs.forEach((q) => [q.n, q.a, q.b, q.answer].concat(q.choices).filter((x) => x !== undefined).forEach((x) => assert.ok(D.NUM_KANA[x], 'NUM_KANA[' + x + ']')));
    }
    assert.deepEqual(P.generateSession('math', lv, rngOf(5)), P.generateSession('math', lv, rngOf(5)));
  });
});

test('S2 数8: 部品は別のレベルで呼ぶと RangeError。M12 の部品は M12 だけ', () => {
  assert.throws(() => P.generateMultiplication('M12', rngOf(1)), RangeError);
  assert.throws(() => P.generateSubtraction('M8', rngOf(1)), RangeError);
  assert.throws(() => P.generateAddition('M10', rngOf(1)), RangeError);
  assert.throws(() => P.generateSession('math', 'M14', rngOf(1)), RangeError);
});
