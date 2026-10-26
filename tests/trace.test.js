const test = require('node:test');
const assert = require('node:assert/strict');
const { rngOf } = require('./helpers.js');
const T = require('../src/trace.js');
const { STROKES, SETS } = require('../src/strokes.js');

const KANA = SETS.hira + SETS.kata;   // ひらがな 104 画 + カタカナ 108 画
const KANJI = SETS.k1 + SETS.k2;       // K8 112 画 + K9 18 字（13 画以上の 電・線 は外してある）
const poly = (ch, i) => T.strokePolyline(STROKES[ch].s[i]);
const TOL = T.tolerance(600, 'normal', 'kana');   // near .065 / off .15 / startR .10
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// 手本の線を法線方向に d ずらした点列
function offsetPath(p, d) {
  return p.map((q, i) => {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
    const L = dist(a, b) || 1;
    return [q[0] + d * (-(b[1] - a[1])) / L, q[1] + d * (b[0] - a[0]) / L];
  });
}
// 点列を 1 画として流す。begin から始め、points を moveStroke に渡し、最後に endStroke
function run(p, pts, tol, opt) {
  tol = tol || TOL;
  const b = T.beginStroke(p, pts[0], tol);
  if (b.result !== 'started') return { begin: b.result };
  let st = b.state, res = 'ok';
  const prog = [T.progressOf(p, st)];
  const every = (opt && opt.every) || 1;
  for (let i = 1; i < pts.length; i += every) {
    const m = T.moveStroke(p, st, [pts[i]], tol);
    st = m.state; res = m.result; prog.push(T.progressOf(p, st));
    if (res === 'off') break;
  }
  return { begin: 'started', move: res, end: T.endStroke(p, st, tol).result, prog, state: st };
}
const straight = T.strokePolyline([200, 545, 400, 545, 700, 545, 900, 545]);
const arc = T.strokePolyline([100, 600, 100, 100, 900, 100, 900, 600]);   // 大きく膨らむ弧
const dotP = T.strokePolyline([500, 500, 510, 500, 520, 500, 530, 500]);

test('strokePolyline: 始点・終点を含み、点の間隔はおよそ h', () => {
  for (const ch of SETS.hira) STROKES[ch].s.forEach(s => {
    const p = T.strokePolyline(s);
    assert.ok(dist(p[0], [s[0] / 1090, s[1] / 1090]) < 1e-9);
    assert.ok(dist(p[p.length - 1], [s[s.length - 2] / 1090, s[s.length - 1] / 1090]) < 1e-9);
    for (let i = 1; i < p.length; i++) assert.ok(dist(p[i - 1], p[i]) <= 0.0126, ch);
  });
  // ひらがな 1 画の長さは 0.3〜1.5 が目安（点は例外）
  assert.ok(T.polyLength(poly('の', 0)) > 0.5);
  assert.ok(T.isDot(dotP) && !T.isDot(straight));
});

test('1. 手本の点列そのもの → 進度が単調に増え done（ひらがな・カタカナ全画）', () => {
  for (const ch of KANA) STROKES[ch].s.forEach((s, i) => {
    const p = poly(ch, i);
    if (T.isDot(p)) return;
    const r = run(p, p, TOL, { every: 2 });
    assert.equal(r.end, 'done', ch + i);
    for (let k = 1; k < r.prog.length; k++) assert.ok(r.prog[k] >= r.prog[k - 1], ch + i);
  });
});

test('2. 法線方向に 0.9·near ずらした線は done、1.2·off ずらした線は off', () => {
  [['い', 0], ['こ', 1], ['く', 0]].forEach(([ch, i]) => {
    const p = poly(ch, i);
    const ok = run(p, [p[0]].concat(offsetPath(p, 0.9 * TOL.near).slice(1)), TOL);
    assert.equal(ok.move, 'ok', ch);
    assert.equal(ok.end, 'done', ch);
  });
  const p = poly('こ', 1);
  const bad = run(p, [p[0]].concat(offsetPath(p, 1.2 * TOL.off).slice(1)), TOL);
  assert.equal(bad.move, 'off');
});

test('3. off を少しだけ越える 1 点のとび（offRun より短い）はやり直しにならない', () => {
  const p = straight.slice();
  const pts = p.map(q => q.slice());
  // 真ん中の 1 点だけ off+0.01 離す。外にいる道のりは offRun (0.04) より十分短い
  const mid = Math.floor(pts.length / 2);
  pts[mid] = [pts[mid][0], pts[mid][1] + TOL.off + 0.01];
  const r = run(p, pts, TOL);
  assert.equal(r.move, 'ok');
  assert.equal(r.end, 'done');
});

test('4. 逆向きは reverse、始点から遠い所は miss', () => {
  const p = poly('い', 0);
  const rev = T.beginStroke(p, p[p.length - 1], TOL);
  assert.equal(rev.result, 'reverse');
  assert.equal(T.beginStroke(p, [p[0][0] + 0.5, p[0][1]], TOL).result, 'miss');
  assert.equal(T.beginStroke(p, p[0], TOL).result, 'started');
  assert.equal(T.beginStroke(p, [p[0][0] + TOL.startR * 0.95, p[0][1]], TOL).result, 'started');
  assert.equal(T.beginStroke(p, [p[0][0] + TOL.startR * 1.2, p[0][1]], TOL).result, 'miss');
});

test('5. 途中（進度 0.6）で離すと short、0.92 まで書くと done', () => {
  const p = poly('い', 0);
  const upTo = f => p.slice(0, Math.round(f * (p.length - 1)) + 1);
  assert.equal(run(p, upTo(0.6)).end, 'short');
  assert.equal(run(p, upTo(0.92)).end, 'done');
});

// 自己交差する画: 後ろの点 j が前の点 i の近く（かつ弧長で十分離れている）
function crossing(p) {
  let best = null, bd = 0.04;
  for (let i = 0; i < p.length; i++) for (let j = i + 25; j < p.length; j++) if (dist(p[i], p[j]) < bd) { bd = dist(p[i], p[j]); best = [i, j]; }
  return best;
}

// 近道の防止は W1 では「防げる範囲」だけ（設計 3.4）。窓（進度の前後だけを見る）で防げるのは、輪が大きく、幅が ふつう か助けが m<=1 のとき。
// る・て・そ・ん・え の小さい輪や、ひろめ＋助け(m>=2) の す・む などは防がない（正しくなぞる子を止めないことを優先する。下の 14）
test('6. 輪のある画: 正しくなぞれば単調に done。大きい輪を飛ばして交差点から終点へ近道すると done にならない（の・ぬ・あ・め・ね・お・ま・み・よ・な）', () => {
  const chars = [['の', 0], ['ぬ', 1], ['あ', 2], ['め', 1], ['ね', 1], ['お', 1], ['ま', 2], ['み', 0], ['よ', 1], ['な', 3]];
  let tried = 0;
  for (const [ch, i] of chars) {
    const p = T.strokePolyline(STROKES[ch].s[i]), len = T.polyLength(p);
    for (const width of ['normal', 'wide']) for (const B of [300, 350, 600]) for (let m = 0; m <= 1; m++) {
      const tol = T.helpTolerance(T.tolerance(B, width, 'kana'), m);
      const tag = [ch, i, width, B, 'm' + m].join(' ');
      const full = run(p, p, tol, { every: 2 });
      assert.equal(full.end, 'done', tag);
      for (let k = 1; k < full.prog.length; k++) assert.ok(full.prog[k] >= full.prog[k - 1], tag);
      for (let a = 0; a < p.length; a += 3) for (let b = a + 20; b < p.length; b += 2) {
        if (dist(p[a], p[b]) > 0.05) continue;                       // 交差している 2 点
        if ((b - a) * 0.01 <= 0.1 * len + 2 * tol.near) continue;    // 輪が小さい（許容の中）
        tried++;
        const r = run(p, p.slice(0, a + 1).concat(p.slice(b)), tol, { every: 2 });
        assert.notEqual(r.end, 'done', tag + ' ' + a + '→' + b + ' は近道で書けてはいけない');
      }
    }
  }
  assert.ok(tried > 100, '試した近道: ' + tried);
});

test('6b. 3 点だけ（始点・中点・終点）の近道は小さい板・ひろめ・助け m=3 でも done にならない', () => {
  const p = poly('る', 0);
  const tol = T.helpTolerance(T.tolerance(300, 'wide', 'kana'), 3);
  const jump = [p[0], p[Math.floor(p.length / 2)], p[p.length - 1]];
  assert.notEqual(run(p, jump, tol).end, 'done');
});

test('6c. near と off の間を続けてなぞっても off にならない（進度は進まないだけ。設計 3.3）', () => {
  const mid = (TOL.near + TOL.off) / 2;
  [['い', 0], ['こ', 1], ['く', 0]].forEach(([ch, i]) => {
    const p = poly(ch, i);
    const r = run(p, [p[0]].concat(offsetPath(p, mid).slice(1)), TOL);
    assert.equal(r.move, 'ok', ch);
    assert.notEqual(r.end, 'off', ch);
  });
});

test('6d. endStroke: off のあとは off を返す（二重に数えない）', () => {
  const p = straight;
  const b = T.beginStroke(p, p[0], TOL);
  const m = T.moveStroke(p, b.state, [[p[0][0] + 0.3, p[0][1] + 0.5]], TOL);
  assert.equal(m.result, 'off');
  assert.equal(T.endStroke(p, m.state, TOL).result, 'off');
});

test('6e. recordAttempt: reverse・miss は 3 回目から m に数え、必ず m=5（手本の書き足し）に届く', () => {
  let rec = { m: 0, misses: 0 };
  const seq = [];
  for (let i = 0; i < 10 && !T.helpFor(rec.m).autoComplete; i++) { rec = T.recordAttempt(rec, i % 2 ? 'reverse' : 'miss'); seq.push(rec.m); }
  assert.deepEqual(seq, [0, 0, 1, 2, 3, 4, 5]);
  assert.ok(T.helpFor(rec.m).autoComplete);
  assert.deepEqual(T.recordAttempt({ m: 1, misses: 2 }, 'started'), { m: 1, misses: 0 });
  assert.deepEqual(T.recordAttempt({ m: 1, misses: 0 }, 'off'), { m: 2, misses: 0 });
  assert.deepEqual(T.recordAttempt({ m: 2, misses: 0 }, 'short'), { m: 3, misses: 0 });
  assert.deepEqual(T.recordAttempt({ m: 2, misses: 1 }, 'done'), { m: 0, misses: 0 });
  assert.deepEqual(T.recordAttempt(undefined, 'miss'), { m: 0, misses: 1 });
});

test('6f. 不正な引数: tolerance の B、strokePolyline の h、pickTraceChars の n', () => {
  const ref = T.tolerance(600, 'normal', 'kana');
  [0, -5, NaN, Infinity, undefined].forEach(B => assert.deepEqual(T.tolerance(B, 'normal', 'kana'), ref, String(B)));
  const s = STROKES['く'].s[0];
  [0, -1, NaN, undefined].forEach(h => assert.deepEqual(T.strokePolyline(s, h), T.strokePolyline(s, 0.01), String(h)));
  [0, -2, NaN].forEach(n => assert.deepEqual(T.pickTraceChars([...SETS.hira], {}, n, rngOf(1)), [], String(n)));
});

test('7. 速い入力: 直線は 3 点だけでも done。曲がった画を弦で近道すると off', () => {
  const r = run(straight, [straight[0], straight[Math.floor(straight.length / 2)], straight[straight.length - 1]], TOL);
  assert.equal(r.end, 'done');
  const c = run(arc, [arc[0], arc[arc.length - 1]], TOL);
  assert.equal(c.move, 'off');
  // 点列を間引いても、曲線の上にある限り done
  assert.equal(run(arc, arc, TOL, { every: 9 }).end, 'done');
});

test('densify: 直前の点との間を step ごとに補う', () => {
  const s = T.densify([0, 0], [1, 0], 0.1);
  assert.equal(s.length, 10);
  assert.deepEqual(s[s.length - 1], [1, 0]);
  assert.deepEqual(T.densify([0, 0], [0.05, 0], 0.1), [[0.05, 0]]);
});

test('8. 短い画（点）: ちょんと触れば done、遠くで触れば miss', () => {
  const b = T.beginStroke(dotP, dotP[1], TOL);
  assert.equal(b.result, 'started');
  assert.equal(T.endStroke(dotP, b.state, TOL).result, 'done');
  // 画の途中から押してもよい
  assert.equal(T.beginStroke(dotP, dotP[dotP.length - 1], TOL).result, 'started');
  assert.equal(T.beginStroke(dotP, [dotP[0][0], dotP[0][1] + TOL.off * 1.5], TOL).result, 'miss');
  // 押したあと遠くへ離すと short
  const m = T.moveStroke(dotP, b.state, [[dotP[0][0] + 0.5, dotP[0][1]]], TOL);
  assert.equal(T.endStroke(dotP, m.state, TOL).result, 'short');
  // ひらがな・カタカナには 0.08 未満の画は無い（ふ の点で 0.25、カタカナで最短の シ・ツ の点も 0.13 ほどある）ので、実物の画は点として扱われない
  for (const ch of KANA) STROKES[ch].s.forEach(s => assert.ok(!T.isDot(T.strokePolyline(s)), ch));
});

test('9. 助けの段階: m=2 で ×1.25、m=3 で ×1.5、m=4 で off が出ない', () => {
  const t2 = T.helpTolerance(TOL, 2), t3 = T.helpTolerance(TOL, 3), t4 = T.helpTolerance(TOL, 4);
  assert.equal(T.helpTolerance(TOL, 0).off, TOL.off);
  assert.equal(T.helpTolerance(TOL, 1).near, TOL.near);
  assert.ok(Math.abs(t2.near - TOL.near * 1.25) < 1e-12 && Math.abs(t2.off - TOL.off * 1.25) < 1e-12);
  assert.ok(Math.abs(t3.off - TOL.off * 1.5) < 1e-12);
  assert.equal(t4.off, Infinity);
  // 真ん中で横へとび出して戻る（高さ h）。m=0 は off、m=2 は広がった幅の中で ok、m=4 はどこまで出ても ok
  const spike = h => {
    const mid = Math.floor(straight.length / 2), pts = straight.map(q => q.slice());
    pts.splice(mid, 0, [straight[mid][0], straight[mid][1] + h]);
    return pts;
  };
  assert.equal(run(straight, spike(0.2), TOL).move, 'off');
  assert.equal(run(straight, spike(0.2), t2).move, 'ok');
  assert.equal(run(straight, spike(0.2), t2).end, 'done');
  assert.equal(run(straight, spike(0.5), t4).move, 'ok');
  assert.equal(run(straight, spike(0.5), t2).move, 'off');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(m => T.helpFor(m).autoComplete), [false, false, false, false, false, true]);
  assert.deepEqual([0, 1, 2, 3].map(m => [T.helpFor(m).glowStart, T.helpFor(m).animate, T.helpFor(m).escort]),
    [[false, false, false], [true, false, false], [true, true, false], [true, true, true]]);
});

test('10. tolerance: px の下限が効く／効かない境目、ひろめは ×1.3、漢字は g=0.85', () => {
  const small = T.tolerance(300, 'normal', 'kana'), big = T.tolerance(600, 'normal', 'kana');
  assert.ok(Math.abs(small.near - 22 / 300) < 1e-12);     // 0.0733 > 0.065 → 下限が効く
  assert.ok(Math.abs(big.near - 0.065) < 1e-12);          // 22/600 < 0.065 → 効かない
  assert.ok(Math.abs(small.off - 48 / 300) < 1e-12 && Math.abs(big.off - 0.15) < 1e-12);
  assert.ok(Math.abs(small.startR - 34 / 300) < 1e-12 && Math.abs(big.startR - 0.10) < 1e-12);
  // 境目: near は B = 22/0.065 ≈ 338.5、off は B = 48/0.15 = 320
  assert.ok(Math.abs(T.tolerance(340, 'normal', 'kana').near - 0.065) < 1e-12);
  assert.ok(T.tolerance(330, 'normal', 'kana').near > 0.065);
  assert.ok(T.tolerance(321, 'normal', 'kana').off === 0.15 && T.tolerance(319, 'normal', 'kana').off > 0.15);
  const wide = T.tolerance(600, 'wide', 'kana');
  assert.ok(Math.abs(wide.near - big.near * 1.3) < 1e-12 && Math.abs(wide.off - big.off * 1.3) < 1e-12 && Math.abs(wide.startR - big.startR * 1.3) < 1e-12);
  const k = T.tolerance(600, 'normal', 'kanji');
  assert.ok(Math.abs(k.near - 0.065 * 0.85) < 1e-12 && Math.abs(k.off - 0.15 * 0.85) < 1e-12);
  // iPhone でも判定が厳しくならない（下限の px が保たれる）
  assert.ok(T.tolerance(350, 'normal', 'kana').near * 350 >= 22 - 1e-9);
  assert.equal(big.endP, 0.9);
  assert.equal(big.offRun, 0.04);
});

test('11. pickTraceChars: 初回は新しい字 4 つが順番どおり。2 回目から新 3＋復習 1。全部書いたら回数の少ない順。決定的で入力を壊さない', () => {
  const chars = [...SETS.hira];
  assert.deepEqual(T.pickTraceChars(chars, {}, 4, rngOf(1)), ['し', 'つ', 'く', 'へ']);
  const done = { し: 1, つ: 1, く: 1, へ: 1 };
  const second = T.pickTraceChars(chars, done, 4, rngOf(1));
  assert.equal(second.length, 4);
  assert.deepEqual(second.slice(1), ['て', 'の', 'ひ']);           // 復習が先、新しい字は順番どおり
  assert.ok(['し', 'つ', 'く', 'へ'].includes(second[0]));
  // 回数の少ない字から復習する
  const third = T.pickTraceChars(chars, { し: 3, つ: 1, く: 2, へ: 3 }, 4, rngOf(5));
  assert.equal(third[0], 'つ');
  // 全部書いた: 回数の少ない順
  const all = {};
  chars.forEach((c, i) => { all[c] = 2; });
  all['し'] = 1; all['す'] = 1; all['せ'] = 1; all['そ'] = 1; all['た'] = 3;
  const picked = T.pickTraceChars(chars, all, 4, rngOf(2));
  assert.deepEqual(picked.slice().sort(), ['し', 'す', 'せ', 'そ']);
  // 新しい字が足りないとき（残り 1 字）は復習で埋める
  const nearly = {}; chars.slice(0, 45).forEach(c => { nearly[c] = 1; });
  const e = T.pickTraceChars(chars, nearly, 4, rngOf(3));
  assert.equal(e.length, 4);
  assert.ok(e.includes('ほ'));
  assert.equal(new Set(e).size, 4);
  // 重複なし・決定的・入力を書き換えない
  const snapshot = JSON.stringify(done), cs = chars.slice();
  assert.deepEqual(T.pickTraceChars(chars, done, 4, rngOf(9)), T.pickTraceChars(chars, done, 4, rngOf(9)));
  assert.equal(JSON.stringify(done), snapshot);
  assert.deepEqual(chars, cs);
  assert.deepEqual(T.pickTraceChars(chars, {}, 0, rngOf(1)), []);
  assert.deepEqual(T.pickTraceChars(chars, {}, -3, rngOf(1)), []);
  assert.equal(chars.slice(0, 4).join(''), 'しつくへ');
  for (let seed = 0; seed < 20; seed++) {
    const r = T.pickTraceChars(chars, { し: 1, つ: 2, く: 1, お: 5 }, 4, rngOf(seed));
    assert.equal(new Set(r).size, r.length);
  }
});

test('12. traceSet: S0 はひらがなが残っていれば hira、全部書いたら hira+kata。S1 は k1。未解放の集合は auto の扱い', () => {
  assert.equal(T.traceSet({ done: {}, set: 'auto' }, 'S0'), 'hira');
  const all = {}; [...SETS.hira].forEach(c => { all[c] = 1; });
  assert.equal(T.traceSet({ done: all, set: 'auto' }, 'S0'), 'hira+kata');
  const almost = Object.assign({}, all); delete almost['ほ'];
  assert.equal(T.traceSet({ done: almost, set: 'auto' }, 'S0'), 'hira');
  assert.equal(T.traceSet({ done: all, set: 'auto' }, 'S1'), 'k1');
  assert.equal(T.traceSet({ done: all, set: 'auto' }, 'S2'), 'k2');
  // 保護者の選択
  assert.equal(T.traceSet({ done: {}, set: 'kata' }, 'S0'), 'kata');
  assert.equal(T.traceSet({ done: {}, set: 'k1' }, 'S1'), 'k1');
  // 未解放: S0 で k2 を選んでいても auto と同じ
  assert.equal(T.traceSet({ done: {}, set: 'k2' }, 'S0'), 'hira');
  assert.equal(T.traceSet({ done: all, set: 'k1' }, 'S0'), 'hira+kata');
  assert.equal(T.traceSet(undefined, 'S0'), 'hira');
  // せんの はば: auto は S0 がひろめ、S1 以降がふつう
  assert.equal(T.traceWidth({ width: 'auto' }, 'S0'), 'wide');
  assert.equal(T.traceWidth({ width: 'auto' }, 'S1'), 'normal');
  assert.equal(T.traceWidth({ width: 'normal' }, 'S0'), 'normal');
  assert.equal(T.traceWidth({ width: 'wide' }, 'S2'), 'wide');
});

test('13. normalizeTrace: 知らない字・負・文字列・100 以上・知らない set/width を直す。旧データは既定値', () => {
  assert.deepEqual(T.normalizeTrace(undefined), { done: {}, set: 'auto', width: 'auto' });
  assert.deepEqual(T.normalizeTrace(null), { done: {}, set: 'auto', width: 'auto' });
  assert.deepEqual(T.normalizeTrace({}), { done: {}, set: 'auto', width: 'auto' });
  const raw = { done: { あ: 3, い: -1, う: '2', え: 100, お: 250, か: 0, き: 2.7, X: 4, ゐ: 1, く: NaN, け: null }, set: 'zzz', width: 'huge' };
  const before = JSON.stringify(raw);
  const n = T.normalizeTrace(raw);
  assert.deepEqual(n.done, { あ: 3, え: 99, お: 99, き: 2 });
  assert.equal(n.set, 'auto');
  assert.equal(n.width, 'auto');
  assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(T.normalizeTrace({ done: 'x', set: 'hira', width: 'wide' }), { done: {}, set: 'hira', width: 'wide' });
  assert.deepEqual(T.normalizeTrace({ done: [1, 2], set: 'k1', width: 'normal' }).done, {});
  // Object のもとからある名前は字として拾わない
  const proto = T.normalizeTrace({ done: { constructor: 3, toString: 2, __proto__: 5, hasOwnProperty: 1, し: 2 } });
  assert.deepEqual(Object.keys(proto.done), ['し']);
  // 正しいデータは変わらない（冪等）
  assert.deepEqual(T.normalizeTrace(n), n);
});

// 14. 正しくなぞる子を止めない（W1 の合格条件）。normal/wide × m=0〜4 のすべてで done（off・short にならない）
function expectDone(p, pts, tag, B, script) {
  for (const width of ['normal', 'wide']) for (let m = 0; m <= 4; m++) {
    const tol = T.helpTolerance(T.tolerance(B || 600, width, script || 'kana'), m);
    const r = run(p, pts, tol);
    assert.equal(r.begin, 'started', tag + ' ' + width + ' m' + m);
    assert.equal(r.move, 'ok', tag + ' ' + width + ' m' + m + ' ' + r.move);
    assert.equal(r.end, 'done', tag + ' ' + width + ' m' + m);
  }
}
const allStrokes = [];
for (const ch of KANA) STROKES[ch].s.forEach((s, i) => allStrokes.push([ch + i, T.strokePolyline(s), 'kana']));
for (const ch of KANJI) STROKES[ch].s.forEach((s, i) => allStrokes.push([ch + i, T.strokePolyline(s), 'kanji']));   // 漢字は許容幅 ×0.85（tolerance の script='kanji'）
const smooth = (p, w) => p.map((_, i) => {
  const lo = Math.max(0, i - w), hi = Math.min(p.length - 1, i + w);
  let x = 0, y = 0; for (let k = lo; k <= hi; k++) { x += p[k][0]; y += p[k][1]; }
  return [x / (hi - lo + 1), y / (hi - lo + 1)];
});
// 弧長 gap ごとの粗い点列（速い指）。始点と終点を含む
function sparse(p, gap) {
  const out = [p[0]]; let acc = 0;
  for (let i = 1; i < p.length; i++) { acc += dist(p[i - 1], p[i]); if (acc >= gap) { out.push(p[i]); acc = 0; } }
  if (out[out.length - 1] !== p[p.length - 1]) out.push(p[p.length - 1]);
  return out;
}

test('14a. の・ぬ・め・す を ±0.9·near ずらしてなぞっても done（normal/wide × m0〜4）', () => {
  [['の', 0], ['ぬ', 1], ['め', 1], ['す', 1]].forEach(([ch, i]) => {
    const p = poly(ch, i);
    for (const sign of [1, -1]) for (const width of ['normal', 'wide']) for (let m = 0; m <= 4; m++) {
      const tol = T.helpTolerance(T.tolerance(600, width, 'kana'), m);
      const near0 = T.tolerance(600, width, 'kana').near;
      const pts = [p[0]].concat(offsetPath(p, sign * 0.9 * near0).slice(1));
      const r = run(p, pts, tol);
      assert.equal(r.move, 'ok', [ch, sign, width, m].join(' '));
      assert.equal(r.end, 'done', [ch, sign, width, m].join(' '));
    }
  });
});

test('14b. ひらがな・カタカナ・漢字の全画（212 + K8 112 + K9 170 画）を内側・外側に 0.03/0.04/0.05 ずらしても done', () => {
  for (const [tag, p, sc] of allStrokes) for (const d of [0.03, 0.04, 0.05, -0.03, -0.04, -0.05]) {
    expectDone(p, [p[0]].concat(offsetPath(p, d).slice(1)), tag + ' ' + d, 600, sc);
  }
});

test('14c. 0.85 倍に縮めた かな と、0.9 倍に縮めた漢字をなぞっても done', () => {
  // 漢字は許容幅を ×0.85 に絞っているので、0.85 倍に縮めた字は ふつうの幅・m=0 で 13 画が short になる（虫6・耳1・糸5・糸6・花7・池6・春9・馬7・夏1・鳥8・雪1・雲1・雲12。
  // m=2 の助けで通る）。0.9 倍なら全画 done。設計 10章に記録（design-tracing）
  for (const [tag, p, sc] of allStrokes) {
    const k = sc === 'kanji' ? 0.9 : 0.85;
    expectDone(p, p.map(q => [0.5 + (q[0] - 0.5) * k, 0.5 + (q[1] - 0.5) * k]), tag + ' x' + k, 600, sc);
  }
});

test('14d. 角を丸めてなぞった そ（と ほかの字）も done', () => {
  for (const [tag, p] of allStrokes) {
    if (tag === 'そ0' || tag === 'る0' || tag === 'て0') for (const w of [4, 8, 12]) expectDone(p, smooth(p, w), tag + ' smooth' + w);
  }
});

test('14e. 点の間が 0.25 の速い指でも done', () => {
  for (const [tag, p, sc] of allStrokes) expectDone(p, sparse(p, 0.25), tag + ' fast', 600, sc);
});

test('14f. 外側へ 0.9·near ずれた の を wide・m=3 でなぞっても done', () => {
  const p = poly('の', 0);
  const base = T.tolerance(600, 'wide', 'kana'), tol = T.helpTolerance(base, 3);
  for (const sign of [1, -1]) {
    const r = run(p, [p[0]].concat(offsetPath(p, sign * 0.9 * base.near).slice(1)), tol);
    assert.equal(r.move, 'ok');
    assert.equal(r.end, 'done');
  }
});

test('15. charsOfSet: hira+kata は ひらがな → カタカナの順。ひらがなを書き終えた子には、新しい字としてカタカナが先頭から出る', () => {
  assert.deepEqual(T.charsOfSet('hira'), [...SETS.hira]);
  assert.deepEqual(T.charsOfSet('kata'), [...SETS.kata]);
  assert.deepEqual(T.charsOfSet('hira+kata'), [...SETS.hira, ...SETS.kata]);
  const done = {}; [...SETS.hira].forEach(c => { done[c] = 1; });
  const trace = { done, set: 'auto' };
  assert.equal(T.traceSet(trace, 'S0'), 'hira+kata');
  const pick = T.pickTraceChars(T.charsOfSet(T.traceSet(trace, 'S0')), done, 4, rngOf(3));
  assert.equal(pick.length, 4);
  // 復習 1（ひらがな）が先、新しい字 3 つ（カタカナ ノ・フ・ヘ）が後
  assert.ok(SETS.hira.includes(pick[0]));
  assert.deepEqual(pick.slice(1), ['ノ', 'フ', 'ヘ']);
  // カタカナを 1 つ書いたあとは続きから
  done['ノ'] = 1;
  assert.deepEqual(T.pickTraceChars(T.charsOfSet('hira+kata'), done, 4, rngOf(3)).slice(1), ['フ', 'ヘ', 'レ']);
  // 知らない集合の名前は ひらがな+カタカナ（落ちない）
  assert.deepEqual(T.charsOfSet('zzz'), [...SETS.hira, ...SETS.kata]);
});

test('16. 点: 漢字は長さ 0.2 未満の画を点として扱う（火1・雨5〜8・犬4・雲5〜8 など 50 画）。かなは 0.08 のまま', () => {
  const kanjiTol = T.tolerance(600, 'normal', 'kanji'), kanaTol = T.tolerance(600, 'normal', 'kana');
  assert.equal(kanjiTol.dotLen, 0.2);
  assert.equal(kanaTol.dotLen, 0.08);
  assert.equal(T.helpTolerance(kanjiTol, 3).dotLen, 0.2);
  const dots = [], notDots = [];
  for (const ch of KANJI) STROKES[ch].s.forEach((s, i) => {
    const p = T.strokePolyline(s), tag = ch + (i + 1);
    (T.polyLength(p) < 0.2 ? dots : notDots).push([tag, p]);
  });
  const tags = dots.map(d => d[0]);
  ['火1', '犬4', '雨5', '雨6', '雨7', '雨8', '雲5', '雲6', '雲7', '雲8', '船4'].forEach(t => assert.ok(tags.includes(t), t));
  assert.equal(dots.length, 50);
  // 火2（0.237）は点にならない短いノ
  assert.ok(notDots.some(d => d[0] === '火2'));
  for (const width of ['normal', 'wide']) for (let m = 0; m <= 4; m++) {
    const tol = T.helpTolerance(T.tolerance(600, width, 'kanji'), m);
    for (const [tag, p] of dots) {
      // 画のどこを触っても started、動かさず離せば done
      [0, Math.floor(p.length / 2), p.length - 1].forEach(j => {
        const b = T.beginStroke(p, p[j], tol);
        assert.equal(b.result, 'started', tag);
        assert.equal(T.endStroke(p, b.state, tol).result, 'done', tag);
      });
      // 触って少し動かしても done（点の中で）。始点から終点へなぞっても done
      const b2 = T.beginStroke(p, p[0], tol);
      const mv = T.moveStroke(p, b2.state, [p[Math.floor(p.length / 2)]], tol);
      assert.equal(T.endStroke(p, mv.state, tol).result, 'done', tag + ' 少し動かす');
      const r = run(p, p, tol);
      assert.equal(r.end, 'done', tag + ' なぞる');
      if (m <= 3) assert.equal(T.beginStroke(p, [p[0][0] + T.polyLength(p) + tol.off * 1.5, p[0][1] + T.polyLength(p) + tol.off * 1.5], tol).result, 'miss', tag + ' 遠く');   // m=4 は off を見ない
    }
  }
  // かなは今のまま: シ・ツ の点（0.13）は点でなく、触るだけでは short
  const shi = T.strokePolyline(STROKES['シ'].s[0]);
  const b = T.beginStroke(shi, shi[0], kanaTol);
  assert.equal(T.endStroke(shi, b.state, kanaTol).result, 'short');
});
