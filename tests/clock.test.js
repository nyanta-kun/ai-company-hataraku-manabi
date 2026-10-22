const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/problems.js');
const D = require('../src/data.js');
const { rngOf } = require('./helpers.js');

const N = 1000;
const LV = ['T1', 'T2', 'T3'];
const CH = { T1: 2, T2: 4, T3: 4 };
const adiff = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
const hdist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 12 - d); };

test('とけい性質1: choices に answer がちょうど1回、重複なし、長さ T1=2 T2=4 T3=4', () => {
  for (const lv of LV) {
    const r = rngOf(11);
    for (let i = 0; i < N; i++) {
      const p = P.generateClock(lv, r);
      assert.equal(p.kind, 'clock');
      assert.equal(p.choices.filter(c => c === p.answer).length, 1, lv);
      assert.equal(new Set(p.choices).size, p.choices.length);
      assert.equal(p.choices.length, CH[lv]);
    }
  }
});

test('とけい性質2: 時刻の範囲（T1・T2 は m=0、T3 は 0 と 30 の両方）', () => {
  for (const lv of LV) {
    const r = rngOf(12);
    const ms = new Set();
    for (let i = 0; i < N; i++) {
      const p = P.generateClock(lv, r);
      assert.ok(Number.isInteger(p.h) && p.h >= 1 && p.h <= 12);
      assert.ok(p.m === 0 || p.m === 30);
      if (lv !== 'T3') assert.equal(p.m, 0);
      ms.add(p.m);
    }
    if (lv === 'T3') assert.equal(ms.size, 2);
  }
});

test('とけい性質3: T1 の誤答は 1〜12 で、正解と 3 以上はなれている', () => {
  const r = rngOf(13);
  for (let i = 0; i < N; i++) {
    const p = P.generateClock('T1', r);
    assert.equal(p.form, 'read');
    for (const c of p.choices) {
      assert.ok(Number.isInteger(c) && c >= 1 && c <= 12);
      if (c !== p.answer) assert.ok(hdist(c, p.answer) >= 3, `${c} vs ${p.answer}`);
    }
  }
});

test('とけい性質4: T2・T3 は選択肢のどの 2 つも「ほぼ同じ絵」でない', () => {
  for (const lv of ['T2', 'T3']) {
    const r = rngOf(14);
    for (let i = 0; i < N; i++) {
      const p = P.generateClock(lv, r);
      assert.equal(p.form, 'pick');
      for (let a = 0; a < p.choices.length; a++) for (let b = a + 1; b < p.choices.length; b++) {
        const x = P.handAngles(p.choices[a]), y = P.handAngles(p.choices[b]);
        assert.ok(adiff(x.minute, y.minute) >= 60 || adiff(x.hour, y.hour) >= 30, `${lv} ${p.choices}`);
      }
    }
  }
});

test('とけい性質5: 隣の時刻を含み、m=0 では取り違え絵 swap:h（h=2..10）を含む。T3 は同じ時の ○じ/はん違いも入りうる', () => {
  for (const lv of ['T2', 'T3']) {
    const r = rngOf(15);
    let sameH = 0;
    for (let i = 0; i < N; i++) {
      const p = P.generateClock(lv, r);
      const adj = [((p.h + 10) % 12) + 1, (p.h % 12) + 1].map(h => h + ':' + (p.m ? '30' : '00'));
      assert.ok(p.choices.some(c => adj.includes(c)), 'adjacent ' + p.answer + ' ' + p.choices);
      if (p.m === 0 && p.h >= 2 && p.h <= 10) assert.ok(p.choices.includes('swap:' + p.h), p.answer + ' ' + p.choices);
      if (lv === 'T3' && p.choices.includes(p.h + ':' + (p.m ? '00' : '30'))) sameH++;
    }
    if (lv === 'T3') assert.ok(sameH > N / 4, 'sameH=' + sameH);
  }
  // 12 の前後は循環する
  const r = rngOf(16);
  for (let i = 0; i < 200; i++) {
    const p = P.generateClock('T2', r);
    if (p.h === 12) assert.ok(p.choices.includes('1:00') || p.choices.includes('11:00'));
  }
});

test('とけい性質6: swap は answer や h:mm と一致せず、m=0 の pick 問題にだけ現れ、h=12 では出ない', () => {
  for (const lv of LV) {
    const r = rngOf(17);
    for (let i = 0; i < N; i++) {
      const p = P.generateClock(lv, r);
      const sw = p.choices.filter(c => typeof c === 'string' && c.startsWith('swap:'));
      assert.ok(!String(p.answer).startsWith('swap:'));
      if (lv === 'T1') assert.equal(sw.length, 0);
      if (p.m !== 0) assert.equal(sw.length, 0);
      if (p.h === 12) assert.equal(sw.length, 0);
      assert.ok(sw.length <= 1);
      sw.forEach(s => assert.equal(s, 'swap:' + p.h));
    }
  }
});

test('とけい性質7: generateSession は4問、各問が性質を満たし、時刻の重複・連続なし', () => {
  for (const lv of LV) {
    const r = rngOf(18);
    for (let i = 0; i < 300; i++) {
      const s = P.generateSession('clock', lv, r);
      assert.equal(s.length, 4);
      assert.equal(new Set(s.map(p => p.h + ':' + p.m)).size, 4, lv);
      s.forEach(p => {
        assert.equal(p.choices.filter(c => c === p.answer).length, 1);
        assert.equal(p.choices.length, CH[lv]);
      });
    }
  }
});

test('とけい: sameProblem の clock 分岐', () => {
  const a = { kind: 'clock', h: 3, m: 0 };
  assert.equal(P.sameProblem(a, { kind: 'clock', h: 3, m: 0 }), true);
  assert.equal(P.sameProblem(a, { kind: 'clock', h: 3, m: 30 }), false);
  assert.equal(P.sameProblem(a, { kind: 'clock', h: 4, m: 0 }), false);
  assert.equal(P.sameProblem(a, { kind: 'letter', wordId: 'x' }), false);
});

test('とけい性質8: 同じシードなら同じ結果', () => {
  for (const lv of LV) {
    assert.deepEqual(P.generateSession('clock', lv, rngOf(99)), P.generateSession('clock', lv, rngOf(99)));
  }
});

test('とけい性質9: nextLevel（昇級・降級・固定・上限下限・範囲外）', () => {
  assert.deepEqual(P.LEVELS.clock, ['T1', 'T2', 'T3']);
  assert.equal(P.nextLevel('clock', 'T1', 4, false), 'T2');
  assert.equal(P.nextLevel('clock', 'T2', 4, false), 'T3');
  assert.equal(P.nextLevel('clock', 'T3', 4, false), 'T3');
  assert.equal(P.nextLevel('clock', 'T2', 3, false), 'T2');
  assert.equal(P.nextLevel('clock', 'T2', 1, false), 'T1');
  assert.equal(P.nextLevel('clock', 'T1', 0, false), 'T1');
  assert.equal(P.nextLevel('clock', 'T2', 4, true), 'T2');
  assert.equal(P.nextLevel('clock', 'T2', 0, true), 'T2');
  assert.equal(P.nextLevel('clock', 'T9', 3, false), 'T1');
});

test('とけい性質10・12: handAngles', () => {
  assert.deepEqual(P.handAngles('3:00'), { hour: 90, minute: 0 });
  assert.deepEqual(P.handAngles('6:30'), { hour: 195, minute: 180 });
  assert.deepEqual(P.handAngles('12:00'), { hour: 0, minute: 0 });
  assert.deepEqual(P.handAngles('12:30'), { hour: 15, minute: 180 });
  assert.deepEqual(P.handAngles('swap:3'), { hour: 0, minute: 90 });
  assert.deepEqual(P.handAngles('3:30'), { hour: 105, minute: 180 });
});

test('とけい性質11: readTime が読み表どおり（12通り＋はん12通り、ひらがなのみ）', () => {
  const kana = ['いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ', 'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ', 'じゅうにじ'];
  for (let h = 1; h <= 12; h++) {
    assert.equal(P.readTime(h, 0), kana[h - 1]);
    assert.equal(P.readTime(h, 30), kana[h - 1] + 'はん');
    assert.ok(/^[ぁ-ん]+$/.test(P.readTime(h, 30)));
  }
  assert.equal(P.readTime(4, 0), 'よじ'); assert.equal(P.readTime(7, 0), 'しちじ'); assert.equal(P.readTime(9, 30), 'くじはん');
  assert.equal(D.TIME_KANA.length, 13);
});
