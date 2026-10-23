const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/problems.js');
const D = require('../src/data.js');
const { rngOf } = require('./helpers.js');

const N = 1000;
const CHOICES = { M1: 3, M2: 3, M3: 4, M4: 3, M5: 4, M6: 3, M7: 4, K1: 2, K2: 3, K3: 4, K4: 2, K5: 4, K6: 4 };
const MAXV = { M1: 3, M2: 5, M3: 10, M4: 5, M5: 10, M6: 5, M7: 10 };

function gen(level, rng, prev) {
  if (level === 'M1' || level === 'M2' || level === 'M3') return P.generateCounting(level, rng);
  if (level === 'M6' || level === 'M7') return P.generateSubtraction(level, rng);
  if (level === 'M4' || level === 'M5') return P.generateAddition(level, rng);
  return P.generateLetter(level, rng, prev);
}
const ALL = Object.keys(CHOICES);

test('性質1: choices に answer がちょうど1回含まれる', () => {
  for (const lv of ALL) {
    const r = rngOf(1);
    for (let i = 0; i < N; i++) {
      const p = gen(lv, r);
      assert.equal(p.choices.filter(c => c === p.answer).length, 1, lv);
    }
  }
});

test('性質2: choices に重複がなく、長さがレベルの選択肢数と一致', () => {
  for (const lv of ALL) {
    const r = rngOf(2);
    for (let i = 0; i < N; i++) {
      const p = gen(lv, r);
      assert.equal(new Set(p.choices).size, p.choices.length, lv);
      assert.equal(p.choices.length, CHOICES[lv], lv);
    }
  }
});

test('性質3: 数値の選択肢はレベルの範囲内で 0 や負数がない', () => {
  for (const lv of Object.keys(MAXV)) {
    const r = rngOf(3);
    for (let i = 0; i < N; i++) {
      const p = gen(lv, r);
      for (const c of p.choices) {
        assert.ok(Number.isInteger(c) && c >= 1 && c <= MAXV[lv], `${lv}: ${c}`);
      }
    }
  }
});

test('性質4: 誤答は正解の±1〜2を優先し、範囲外の分は別の数で補う', () => {
  for (const lv of Object.keys(MAXV)) {
    const r = rngOf(4);
    for (let i = 0; i < N; i++) {
      const p = gen(lv, r);
      const max = MAXV[lv];
      const nearAvail = [-2, -1, 1, 2].filter(d => p.answer + d >= 1 && p.answer + d <= max).length;
      const nearUsed = p.choices.filter(c => c !== p.answer && Math.abs(c - p.answer) <= 2).length;
      assert.equal(nearUsed, Math.min(nearAvail, CHOICES[lv] - 1), `${lv} answer=${p.answer}`);
    }
  }
  assert.deepEqual(P.generateCounting('M1', () => 0).choices, [1, 2, 3]);   // 正解1・範囲1〜3
});

test('性質5: たしざんの範囲、M4 の全組、M5 は和6以上が半分以上', () => {
  for (const lv of ['M4', 'M5']) {
    const r = rngOf(5);
    const seen = new Set();
    let big = 0;
    const lim = lv === 'M4' ? 5 : 10;
    for (let i = 0; i < N; i++) {
      const p = P.generateAddition(lv, r);
      assert.ok(p.a >= 1 && p.b >= 1 && p.a + p.b <= lim);
      assert.equal(p.answer, p.a + p.b);
      seen.add(p.a + '+' + p.b);
      if (p.a + p.b >= 6) big++;
    }
    if (lv === 'M4') {
      for (let a = 1; a <= 4; a++) for (let b = 1; a + b <= 5; b++) assert.ok(seen.has(a + '+' + b), a + '+' + b);
    } else {
      assert.ok(big >= N / 2, 'big=' + big);
    }
  }
});

test('性質6: 国語の answer は頭文字、誤答は許される文字で answer と重複しない', () => {
  const heads = {};
  D.WORDS.forEach(w => { heads[w.id] = w.head; });
  const groupA = D.WORDS.filter(w => w.group === 'A').map(w => w.head);
  const all = D.WORDS.map(w => w.head);
  for (const lv of ['K1', 'K2', 'K3']) {
    const r = rngOf(6);
    let prev;
    let sawConf = false;
    for (let i = 0; i < N; i++) {
      const p = P.generateLetter(lv, r, prev);
      assert.notEqual(p.wordId, prev, '直前と同じ単語を出さない');
      prev = p.wordId;
      assert.equal(p.answer, heads[p.wordId]);
      const wrong = p.choices.filter(c => c !== p.answer);
      assert.equal(wrong.length, CHOICES[lv] - 1);
      const allowed = lv === 'K1' ? groupA : all;
      if (lv === 'K1') assert.ok(groupA.includes(p.answer));
      for (const c of wrong) {
        assert.ok(allowed.includes(c), lv + ' ' + c);
        assert.notEqual(c, heads[p.wordId]);
        if (lv !== 'K3') assert.notEqual(D.ROW[c], D.ROW[p.answer], '行が違う: ' + c + p.answer);
      }
      if (lv === 'K3' && p.answer === 'は' && wrong.includes('ほ')) sawConf = true;
    }
    if (lv === 'K3') assert.ok(sawConf, 'K3 でまぎらわしい文字が混ざりうる');
  }
});

test('性質6b: 単語表は31語で、拗音で始まらず、頭文字が単語の先頭と一致', () => {
  assert.equal(D.WORDS.length, 31);
  for (const w of D.WORDS) {
    assert.equal(w.label[0], w.head);
    assert.ok(!'ゃゅょ'.includes(w.head));
    assert.ok(!/[ァ-ヶ一-龠]/.test(w.speech), w.speech);   // 読み上げはひらがなのみ
  }
});

test('性質7: generateSession は4問で、全問が choices 性質を満たし、連続しない', () => {
  for (const lv of ALL) {
    const game = lv[0] === 'M' ? 'math' : 'letter';
    const r = rngOf(7);
    for (let i = 0; i < 300; i++) {
      const s = P.generateSession(game, lv, r);
      assert.equal(s.length, 4);
      s.forEach((p, k) => {
        assert.equal(p.choices.filter(c => c === p.answer).length, 1);
        assert.equal(new Set(p.choices).size, CHOICES[lv]);
        if (k > 0) {
          const q = s[k - 1];
          if (p.kind === 'count') assert.notEqual(p.n, q.n);
          if (p.kind === 'add') assert.ok(!(p.a === q.a && p.b === q.b));
        }
      });
      if (game === 'letter') assert.equal(new Set(s.map(p => p.wordId)).size, 4);
    }
  }
});

test('性質8: 同じシードなら同じ結果', () => {
  for (const lv of ALL) {
    const game = lv[0] === 'M' ? 'math' : 'letter';
    assert.deepEqual(P.generateSession(game, lv, rngOf(99)), P.generateSession(game, lv, rngOf(99)));
    assert.deepEqual(gen(lv, rngOf(5)), gen(lv, rngOf(5)));
  }
});

test('性質9: nextLevel（昇級・降級・同レベル・固定・上限下限）', () => {
  assert.equal(P.nextLevel('math', 'M1', 4, false), 'M2');
  assert.equal(P.nextLevel('math', 'M4', 4, false), 'M5');
  assert.equal(P.nextLevel('math', 'M5', 4, false), 'M6');
  assert.equal(P.nextLevel('math', 'M6', 4, false), 'M7');
  assert.equal(P.nextLevel('math', 'M7', 4, false), 'M7');
  assert.equal(P.nextLevel('math', 'M6', 0, false), 'M5');
  assert.equal(P.nextLevel('math', 'M7', 4, true), 'M7');
  assert.equal(P.nextLevel('letter', 'K2', 4, false), 'K3');
  assert.equal(P.nextLevel('letter', 'K3', 4, false), 'K4');
  assert.equal(P.nextLevel('letter', 'K5', 4, false), 'K6');
  assert.equal(P.nextLevel('letter', 'K6', 4, false), 'K6');
  assert.equal(P.nextLevel('letter', 'K6', 0, false), 'K5');
  assert.equal(P.nextLevel('letter', 'K4', 0, false), 'K3');
  assert.equal(P.nextLevel('letter', 'K3', 4, true), 'K3');
  assert.equal(P.nextLevel('math', 'M3', 3, false), 'M3');
  assert.equal(P.nextLevel('math', 'M3', 2, false), 'M3');
  assert.equal(P.nextLevel('math', 'M3', 1, false), 'M2');
  assert.equal(P.nextLevel('math', 'M3', 0, false), 'M2');
  assert.equal(P.nextLevel('math', 'M1', 0, false), 'M1');
  assert.equal(P.nextLevel('letter', 'K1', 1, false), 'K1');
  assert.equal(P.nextLevel('letter', 'K2', 0, false), 'K1');
  assert.equal(P.nextLevel('math', 'M2', 4, true), 'M2');
  assert.equal(P.nextLevel('math', 'M2', 0, true), 'M2');
  assert.equal(P.nextLevel('letter', 'K2', 4, true), 'K2');
});

test('ひきざん: a・b の範囲、答えは 1 以上、M6 は全組、M7 は a 6 以上が半分以上', () => {
  for (const lv of ['M6', 'M7']) {
    const r = rngOf(21);
    const max = lv === 'M6' ? 5 : 10;
    const seen = new Set();
    let big = 0;
    for (let i = 0; i < N; i++) {
      const p = P.generateSubtraction(lv, r);
      assert.equal(p.kind, 'sub');
      assert.equal(p.level, lv);
      assert.ok(Number.isInteger(p.a) && Number.isInteger(p.b));
      assert.ok(p.a >= 2 && p.a <= max && p.b >= 1 && p.a - p.b >= 1, `${p.a}-${p.b}`);
      assert.equal(p.answer, p.a - p.b);
      assert.ok(p.answer >= 1);
      seen.add(p.a + '-' + p.b);
      if (p.a >= 6) big++;
    }
    for (let a = 2; a <= max; a++) {
      if (lv === 'M6' || a >= 6) for (let b = 1; b < a; b++) assert.ok(seen.has(a + '-' + b), lv + ' ' + a + '-' + b);
    }
    if (lv === 'M7') assert.ok(big >= N / 2, 'big=' + big);
  }
});

test('ひきざん: 選択肢は昇順で、正解が 1 回だけ', () => {
  for (const lv of ['M6', 'M7']) {
    const r = rngOf(22);
    for (let i = 0; i < N; i++) {
      const p = P.generateSubtraction(lv, r);
      assert.deepEqual(p.choices, p.choices.slice().sort((x, y) => x - y));
    }
  }
});

test('ひきざん: 出動は 4 問・連続して同じ問題なし・固定シードで再現', () => {
  for (const lv of ['M6', 'M7']) {
    for (let s = 1; s <= 300; s++) {
      const list = P.generateSession('math', lv, rngOf(s));
      assert.equal(list.length, P.QUESTIONS_PER_SESSION);
      list.forEach((p, i) => {
        assert.equal(p.kind, 'sub');
        if (i > 0) assert.ok(!P.sameProblem(list[i - 1], p));
      });
    }
    assert.deepEqual(P.generateSession('math', lv, rngOf(7)), P.generateSession('math', lv, rngOf(7)));
  }
});

test('ひきざん: sameProblem は a・b で比べ、足し算とは別', () => {
  const mk = (a, b) => ({ kind: 'sub', a, b });
  assert.ok(P.sameProblem(mk(5, 2), { kind: 'sub', a: 5, b: 2, choices: [1] }));
  assert.ok(!P.sameProblem(mk(5, 2), mk(5, 3)));
  assert.ok(!P.sameProblem(mk(5, 2), { kind: 'add', a: 5, b: 2 }));
});

test('ひきざん: M1〜M5 の出力は従来のまま、LEVELS は M1〜M7', () => {
  assert.deepEqual(P.LEVELS.math, ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']);
  assert.throws(() => P.generateSubtraction('M5', rngOf(1)), RangeError);
  assert.throws(() => P.generateAddition('M6', rngOf(1)), RangeError);
});
