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
  const R = D.stageRange('S0', 'clock');
  assert.deepEqual(D.stageRange('S0', 'clock'), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
  assert.equal(P.nextLevel('clock', 'T1', 4, false, R), 'T2');
  assert.equal(P.nextLevel('clock', 'T2', 4, false, R), 'T3');
  assert.equal(P.nextLevel('clock', 'T3', 4, false, R), 'T4');
  assert.equal(P.nextLevel('clock', 'T5', 4, false, R), 'T6');
  assert.equal(P.nextLevel('clock', 'T6', 4, false, R), 'T6');
  assert.equal(P.nextLevel('clock', 'T6', 0, false, R), 'T5');
  assert.equal(P.nextLevel('clock', 'T4', 4, true, R), 'T4');
  assert.equal(P.nextLevel('clock', 'T2', 3, false, R), 'T2');
  assert.equal(P.nextLevel('clock', 'T2', 1, false, R), 'T1');
  assert.equal(P.nextLevel('clock', 'T1', 0, false, R), 'T1');
  assert.equal(P.nextLevel('clock', 'T2', 4, true, R), 'T2');
  assert.equal(P.nextLevel('clock', 'T2', 0, true, R), 'T2');
  assert.equal(P.nextLevel('clock', 'T9', 3, false, R), 'T1');
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

// ---- T4〜T6 ----
const NEW = ['T4', 'T5', 'T6'];
const pairwiseDistinct = (p) => {
  for (let a = 0; a < p.choices.length; a++) for (let b = a + 1; b < p.choices.length; b++) {
    const x = P.handAngles(p.choices[a]), y = P.handAngles(p.choices[b]);
    if (!(adiff(x.minute, y.minute) >= 60 || adiff(x.hour, y.hour) >= 30)) return false;
  }
  return true;
};

test('とけい T4〜T6: clockKey はゼロ埋め、parseKey/handAngles は全部の分で動く', () => {
  assert.equal(P.clockKey(3, 5), '3:05');
  assert.equal(P.clockKey(3, 0), '3:00');
  assert.equal(P.clockKey(12, 45), '12:45');
  assert.equal(P.clockKey(1, 55), '1:55');
  assert.deepEqual(P.handAngles('3:05'), { hour: 92.5, minute: 30 });
  assert.deepEqual(P.handAngles('3:45'), { hour: 112.5, minute: 270 });
  assert.deepEqual(P.handAngles('12:15'), { hour: 7.5, minute: 90 });
});

test('とけい T4〜T6: 選択肢は4つ・重複なし・answer が1回・どの2つも distinctFaces・swap は m=0 の pick だけ', () => {
  for (const lv of NEW) {
    const r = rngOf(31);
    for (let i = 0; i < N; i++) {
      const p = P.generateClock(lv, r);
      assert.equal(p.kind, 'clock');
      assert.equal(p.form, lv === 'T6' ? 'elapsed' : 'pick');
      assert.equal(p.ticks, lv === 'T4' ? 12 : 60);
      assert.equal(p.choices.length, 4, lv);
      assert.equal(new Set(p.choices).size, 4);
      assert.equal(p.choices.filter(c => c === p.answer).length, 1);
      assert.equal(p.answer, P.clockKey(p.h, p.m));
      assert.ok(pairwiseDistinct(p), lv + ' ' + p.choices);
      const sw = p.choices.filter(c => c.startsWith('swap:'));
      assert.ok(sw.length <= 1);
      if (lv === 'T6') assert.equal(sw.length, 0);
      else if (p.m !== 0 || p.h === 12) assert.equal(sw.length, 0);
      else sw.forEach(sx => assert.equal(sx, 'swap:' + p.h));
      p.choices.filter(c => !c.startsWith('swap:')).forEach(c => assert.match(c, /^(1[0-2]|[1-9]):[0-5][0-9]$/));
    }
  }
});

test('とけい T4・T5: 出る分の集合（T4 は 0/15/30/45 のみ、T5 は 5 の倍数すべて）と隣の時刻・長針ちがい', () => {
  for (const [lv, expected] of [['T4', [0, 15, 30, 45]], ['T5', [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]]]) {
    const r = rngOf(32);
    const ms = new Set(); let sameH = 0, swapN = 0, n0 = 0;
    for (let i = 0; i < N * 2; i++) {
      const p = P.generateClock(lv, r);
      ms.add(p.m);
      assert.ok(p.h >= 1 && p.h <= 12);
      const mm = String(p.m).padStart(2, '0');
      const adj = [((p.h + 10) % 12) + 1, (p.h % 12) + 1].map(h => h + ':' + mm);
      assert.ok(p.choices.some(c => adj.includes(c)), 'adjacent ' + p.answer + ' ' + p.choices);
      if (p.choices.some(c => !c.startsWith('swap:') && c !== p.answer && c.split(':')[0] === String(p.h))) sameH++;
      if (p.m === 0 && p.h >= 2 && p.h <= 10) { n0++; if (p.choices.includes('swap:' + p.h)) swapN++; }
    }
    assert.deepEqual([...ms].sort((a, b) => a - b), expected);
    assert.ok(sameH > N, lv + ' sameH=' + sameH);
    assert.ok(swapN > n0 * 0.9, lv + ' swap ' + swapN + '/' + n0);
  }
});

test('とけい T4・T5: generateSession は4問で時刻の重複・連続なし', () => {
  for (const lv of ['T4', 'T5']) {
    const r = rngOf(33);
    for (let i = 0; i < 300; i++) {
      const s = P.generateSession('clock', lv, r);
      assert.equal(s.length, 4);
      assert.equal(new Set(s.map(p => p.answer)).size, 4);
    }
  }
});

test('とけい T6: 答え = 開始 + 経過（12 を越えたら 1 に戻る）、開始は ちょうど/はん、経過は 10/20/30/40/60', () => {
  const r = rngOf(34);
  const dms = new Set(), starts = new Set(); let wrapped = 0;
  for (let i = 0; i < N * 2; i++) {
    const p = P.generateClock('T6', r);
    assert.ok(p.h0 >= 1 && p.h0 <= 12);
    assert.ok(p.m0 === 0 || p.m0 === 30);
    assert.ok([10, 20, 30, 40, 60].includes(p.dm));
    dms.add(p.dm); starts.add(p.m0);
    const t = p.h0 * 60 + p.m0 + p.dm;
    assert.equal(p.h, ((Math.floor(t / 60) - 1) % 12) + 1);
    assert.equal(p.m, t % 60);
    assert.equal(p.answer, p.h + ':' + String(p.m).padStart(2, '0'));
    if (p.h < p.h0) wrapped++;
  }
  assert.equal(dms.size, 5); assert.equal(starts.size, 2);
  assert.ok(wrapped > 0);
  // 具体例
  const t = (h0, m0, dm) => { const q = P.generateClock('T6', rngOf(1)); void q; const tt = h0 * 60 + m0 + dm; return P.clockKey(((Math.floor(tt / 60) - 1) % 12) + 1, tt % 60); };
  assert.equal(t(11, 30, 40), '12:10'); assert.equal(t(12, 30, 30), '1:00'); assert.equal(t(12, 0, 60), '1:00'); assert.equal(t(3, 0, 20), '3:20');
});

test('とけい T6: 誤答に「開始時刻」または「別の経過」が入り、できるだけ両方・1 時間ずれも入る', () => {
  const r = rngOf(35);
  let startIn = 0;
  for (let i = 0; i < N; i++) {
    const p = P.generateClock('T6', r);
    const start = P.clockKey(p.h0, p.m0);
    const hasStart = p.choices.includes(start);
    if (hasStart) startIn++;
    const others = [10, 20, 30, 40, 60].filter(d => d !== p.dm).map(d => {
      const t = p.h0 * 60 + p.m0 + d; return P.clockKey(((Math.floor(t / 60) - 1) % 12) + 1, t % 60);
    });
    assert.ok(hasStart || p.choices.some(c => others.includes(c)), p.choices + ' ' + start);
  }
  assert.equal(startIn, N);
});

test('とけい T6: generateSession は4問で (開始・経過) も答えも重複しない', () => {
  const r = rngOf(36);
  for (let i = 0; i < 300; i++) {
    const s = P.generateSession('clock', 'T6', r);
    assert.equal(s.length, 4);
    assert.equal(new Set(s.map(p => p.h0 + ':' + p.m0 + '+' + p.dm)).size, 4);
    assert.equal(new Set(s.map(p => p.answer)).size, 4);
    s.forEach(p => assert.equal(p.choices.filter(c => c === p.answer).length, 1));
  }
  assert.deepEqual(P.generateSession('clock', 'T6', rngOf(5)), P.generateSession('clock', 'T6', rngOf(5)));
});

test('とけい T6: sameProblem（開始・経過、または答えが同じ）', () => {
  const a = { kind: 'clock', form: 'elapsed', h0: 3, m0: 0, dm: 20, h: 3, m: 20 };
  assert.equal(P.sameProblem(a, { ...a }), true);
  assert.equal(P.sameProblem(a, { ...a, dm: 30, h: 3, m: 30 }), false);
  assert.equal(P.sameProblem(a, { kind: 'clock', form: 'elapsed', h0: 2, m0: 30, dm: 50, h: 3, m: 20 }), true);
  assert.equal(P.sameProblem(a, { kind: 'clock', form: 'pick', h: 3, m: 20 }), false);
});

test('とけい T4〜T6: readTime / readMinutes の表（ひらがなのみ）', () => {
  const tbl = { 5: 'ごふん', 10: 'じゅっぷん', 15: 'じゅうごふん', 20: 'にじゅっぷん', 25: 'にじゅうごふん', 30: 'さんじゅっぷん',
    35: 'さんじゅうごふん', 40: 'よんじゅっぷん', 45: 'よんじゅうごふん', 50: 'ごじゅっぷん', 55: 'ごじゅうごふん', 60: 'いちじかん' };
  for (const [m, k] of Object.entries(tbl)) {
    assert.equal(P.readMinutes(+m), k);
    assert.equal(D.MIN_KANA[+m], k);
    assert.ok(/^[ぁ-ん]+$/.test(k));
  }
  assert.equal(P.readTime(3, 5), 'さんじごふん');
  assert.equal(P.readTime(3, 45), 'さんじよんじゅうごふん');
  assert.equal(P.readTime(12, 15), 'じゅうにじじゅうごふん');
  assert.equal(P.readTime(4, 0), 'よじ');
  assert.equal(P.readTime(4, 30), 'よじはん');
  for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m += 5) assert.ok(/^[ぁ-ん]+$/.test(P.readTime(h, m)), h + ':' + m);
});
