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
  assert.deepEqual(T.normalizeTrace(undefined), { done: {}, help: {}, solo: {}, set: 'auto', width: 'auto' });
  assert.deepEqual(T.normalizeTrace(null), { done: {}, help: {}, solo: {}, set: 'auto', width: 'auto' });
  assert.deepEqual(T.normalizeTrace({}), { done: {}, help: {}, solo: {}, set: 'auto', width: 'auto' });
  const raw = { done: { あ: 3, い: -1, う: '2', え: 100, お: 250, か: 0, き: 2.7, X: 4, ゐ: 1, く: NaN, け: null }, set: 'zzz', width: 'huge' };
  const before = JSON.stringify(raw);
  const n = T.normalizeTrace(raw);
  assert.deepEqual(n.done, { あ: 3, え: 99, お: 99, き: 2 });
  assert.equal(n.set, 'auto');
  assert.equal(n.width, 'auto');
  assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(T.normalizeTrace({ done: 'x', set: 'hira', width: 'wide' }), { done: {}, help: {}, solo: {}, set: 'hira', width: 'wide' });
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

// ---- W5（design 11.8）----
const HIRA = [...SETS.hira], KATA = [...SETS.kata];
const whyOf = (r) => r.map(o => o.ch + ':' + o.why);

test('W5-1. kanaBase: 濁点 20・半濁点 5・ゔ・小さい字 12 をもとの字に。清音・その他はそのまま', () => {
  const dak = 'がぎぐげござじずぜぞだぢづでどばびぶべぼ', dakBase = 'かきくけこさしすせそたちつてとはひふへほ';
  [...dak].forEach((c, i) => assert.equal(T.kanaBase(c), dakBase[i]));
  [...'ぱぴぷぺぽ'].forEach((c, i) => assert.equal(T.kanaBase(c), 'はひふへほ'[i]));
  assert.equal(T.kanaBase('ゔ'), 'う');
  [...'ぁぃぅぇぉっゃゅょゎゕゖ'].forEach((c, i) => assert.equal(T.kanaBase(c), 'あいうえおつやゆよわかけ'[i]));
  [...SETS.hira, 'ー', 'x', ''].forEach(c => assert.equal(T.kanaBase(c), c));
  assert.equal(T.kanaBase(undefined), '');
  assert.equal(T.toKataChar('た'), 'タ'); assert.equal(T.toKataChar('ー'), 'ー'); assert.equal(T.toKataChar('タ'), 'タ');
  assert.equal(HIRA.map(T.toKataChar).sort().join(''), [...SETS.kata].sort().join(''));
});

test('W5-2. nameTraceChars: たろう・じゅん・こども・ゆーな・ななみ・カタカナ・不正', () => {
  const brief = (r) => r.map(o => o.ch + o.at + (o.exact ? 'e' : 'x'));
  assert.deepEqual(brief(T.nameTraceChars('たろう', HIRA)), ['ろ1e', 'う2e', 'た0e']);
  assert.deepEqual(brief(T.nameTraceChars('じゅん', HIRA)), ['し0x', 'ん2e', 'ゆ1x']);
  assert.deepEqual(T.nameTraceChars('こども1', HIRA), []);
  assert.deepEqual(T.nameTraceChars('こども4', HIRA), []);
  assert.deepEqual(T.nameTraceChars('こども', HIRA).map(o => o.ch).sort(), ['こ', 'と', 'も'].sort());
  assert.deepEqual(T.nameTraceChars('ゆーな', HIRA).map(o => o.ch).sort(), ['ゆ', 'な'].sort());
  assert.deepEqual(T.nameTraceChars('ななみ', HIRA).map(o => o.ch).filter(c => c === 'な'), ['な']);
  const both = T.nameTraceChars('たろう', HIRA.concat(KATA));
  assert.deepEqual(both.map(o => o.ch).sort(), ['う', 'タ', 'ウ', 'ロ', 'ろ', 'た'].sort());
  assert.ok(both.every(o => o.exact));
  assert.deepEqual(T.nameTraceChars('', HIRA), []); assert.deepEqual(T.nameTraceChars(null, HIRA), []); assert.deepEqual(T.nameTraceChars(5, HIRA), []);
  // 自動の名前の規則は storage.js の AUTO_NAME_RE と同じ（こども1〜4 だけ空。ほかは名前）
  const St = require('../src/storage.js');
  for (const nm of ['こども1', 'こども2', 'こども3', 'こども4', 'こども5', 'こども', 'こども12', 'たろう']) {
    const isAuto = St.isAutoName ? St.isAutoName(nm) : /^こども[1-4]$/.test(nm);
    assert.equal(T.nameTraceChars(nm, HIRA).length === 0, isAuto, nm);
  }
});

test('W5-3. isWeak', () => {
  assert.equal(T.isWeak({ done: { し: 1 }, help: { し: 1 } }, 'し'), true);
  assert.equal(T.isWeak({ done: { し: 2 }, help: { し: 1 } }, 'し'), false);
  assert.equal(T.isWeak({ done: { し: 3 }, help: { し: 2 } }, 'し'), true);
  assert.equal(T.isWeak({ done: {}, help: { し: 1 } }, 'し'), false);
  assert.equal(T.isWeak({}, 'し'), false);
});

test('W5-4. recordTraceChar: maxM 0・1 は help なし、2・5 は増える。99 で止まる。入力を書き換えない', () => {
  const t0 = { done: { し: 1 }, help: {}, set: 'auto', width: 'wide' };
  const snap = JSON.stringify(t0);
  const a = T.recordTraceChar(t0, 'し', { maxM: 1 });
  assert.deepEqual(a.done, { し: 2 }); assert.deepEqual(a.help, {}); assert.equal(a.width, 'wide');
  assert.deepEqual(T.recordTraceChar(t0, 'し', { maxM: 0, clean: true }).help, {});
  assert.deepEqual(T.recordTraceChar(t0, 'つ', { maxM: 2 }), { done: { し: 1, つ: 1 }, help: { つ: 1 }, set: 'auto', width: 'wide' });
  assert.deepEqual(T.recordTraceChar(t0, 'し', { maxM: 5 }).help, { し: 1 });
  assert.deepEqual(T.recordTraceChar({ done: { し: 99 }, help: { し: 99 } }, 'し', { maxM: 5 }), { done: { し: 99 }, help: { し: 99 } });
  assert.deepEqual(T.recordTraceChar({ done: {} }, 'し', {}).help, {});
  assert.equal(JSON.stringify(t0), snap);
});

test('W5-5. planTraceSession は名前・たすけ・prev が無いとき pickTraceChars と同じ字の並び（11 の場面すべて × 種 0〜19）', () => {
  const chars = [...SETS.hira];
  const all = {}; chars.forEach(c => { all[c] = 2; });
  all['し'] = 1; all['す'] = 1; all['せ'] = 1; all['そ'] = 1; all['た'] = 3;
  const nearly = {}; chars.slice(0, 45).forEach(c => { nearly[c] = 1; });
  const scenes = [{}, { し: 1, つ: 1, く: 1, へ: 1 }, { し: 3, つ: 1, く: 2, へ: 3 }, all, nearly, { し: 1, つ: 2, く: 1, お: 5 },
    { し: 1 }, { し: 1, つ: 1 }, Object.fromEntries(chars.slice(0, 44).map(c => [c, 1])), Object.fromEntries(chars.map(c => [c, 1]))];
  const sets = [chars, chars.concat([...SETS.kata]), [...SETS.k1]];
  sets.forEach(cs => scenes.forEach((done, si) => {
    for (let seed = 0; seed < 20; seed++) for (const n of [4, 3, 1, 7]) {
      const want = T.pickTraceChars(cs, done, n, rngOf(seed));
      const got = T.planTraceSession(cs, { done, help: {} }, { n, name: '', prev: [] }, rngOf(seed)).map(o => o.ch);
      assert.deepEqual(got, want, `scene ${si} seed ${seed} n ${n}`);
    }
  }));
  assert.deepEqual(T.planTraceSession(chars, { done: {} }, { n: 4 }, rngOf(1)).map(o => o.ch), ['し', 'つ', 'く', 'へ']);
  // help が空でも名前が「こども1」でも同じ
  assert.deepEqual(T.planTraceSession(chars, { done: {} }, { n: 4, name: 'こども1' }, rngOf(1)).map(o => o.ch), ['し', 'つ', 'く', 'へ']);
});

test('W5-6. 名前の枠: 11.4 の例（たろう）の 1〜3 回目と、3 回を超えたら外れる、kanji は名前なし', () => {
  const chars = [...SETS.hira], opts = { n: 4, name: 'たろう' };
  const r1 = T.planTraceSession(chars, { done: {} }, Object.assign({ prev: [] }, opts), rngOf(1));
  assert.deepEqual(whyOf(r1), ['し:new', 'つ:new', 'く:new', 'ろ:name']);
  const d2 = { し: 1, つ: 1, く: 1, ろ: 1 };
  const r2 = T.planTraceSession(chars, { done: d2 }, Object.assign({ prev: r1.map(o => o.ch) }, opts), rngOf(1));
  assert.deepEqual(whyOf(r2), ['へ:new', 'て:new', 'の:new', 'う:name']);
  const d3 = Object.assign({}, d2, { へ: 1, て: 1, の: 1, う: 1 });
  const r3 = T.planTraceSession(chars, { done: d3, help: { の: 1 } }, Object.assign({ prev: r2.map(o => o.ch) }, opts), rngOf(1));
  assert.deepEqual(r3.map(o => o.ch).slice(1), ['ひ', 'そ', 'た']);
  assert.ok(['し', 'つ', 'く', 'ろ'].includes(r3[0].ch) && r3[0].why === 'review');
  assert.equal(r3[3].why, 'name');
  assert.ok(!r3.some(o => o.ch === 'の'));
  const d4 = Object.assign({}, d3, { ひ: 1, そ: 1, た: 1 });
  const r4 = T.planTraceSession(chars, { done: d4, help: { の: 1 } }, Object.assign({ prev: r3.map(o => o.ch) }, opts), rngOf(1));
  assert.deepEqual(r4[r4.length - 1], { ch: 'の', why: 'weak' });
  // 名前の字がみな 3 回以上 → 名前の枠なし（pickTraceChars と同じ）
  const d5 = {}; chars.slice(0, 20).forEach(c => { d5[c] = 1; }); ['た', 'ろ', 'う'].forEach(c => { d5[c] = 3; });
  assert.deepEqual(T.planTraceSession(chars, { done: d5 }, { n: 4, name: 'たろう' }, rngOf(3)).map(o => o.ch), T.pickTraceChars(chars, d5, 4, rngOf(3)));
  // kanji は名前の枠なし
  const k = [...SETS.k1];
  assert.deepEqual(T.planTraceSession(k, { done: {} }, { n: 4, name: 'やま', kanji: true }, rngOf(1)).map(o => o.ch), k.slice(0, 4));
  // カタカナを書くとき（hira+kata）はタ・ロ・ウも名前の字
  const hk = chars.concat([...SETS.kata]);
  const allH = Object.fromEntries(chars.map(c => [c, 3]));
  const rk = T.planTraceSession(hk, { done: allH }, { n: 4, name: 'たろう' }, rngOf(1));
  assert.ok(rk.some(o => o.why === 'name' && ['タ', 'ロ', 'ウ'].includes(o.ch)), JSON.stringify(rk));
});

test('W5-7. 苦手: 復習の枠に入り並びは最後。cnt の少ない字から。prev の苦手は出ない。上限', () => {
  const chars = [...SETS.hira];
  const done = { し: 2, つ: 3, く: 4, へ: 5, て: 1 };
  const help = { し: 2, つ: 3, く: 4, へ: 1 };   // し・つ・く が苦手（help*2 > done）。へ は違う
  const r = T.planTraceSession(chars, { done, help }, { n: 4, name: '' }, rngOf(1));
  assert.deepEqual(whyOf(r).slice(-1), ['し:weak']);          // cnt の少ない苦手が先
  assert.deepEqual(r.slice(0, 3).map(o => o.why), ['new', 'new', 'new']);
  // prev の苦手は出ない
  const r2 = T.planTraceSession(chars, { done, help }, { n: 4, prev: ['し'] }, rngOf(1));
  assert.ok(!r2.some(o => o.ch === 'し')); assert.equal(r2[r2.length - 1].ch, 'つ');
  // 新しい字がある間の苦手は 1 字
  const many = Object.fromEntries(chars.slice(0, 10).map(c => [c, 2])), mh = Object.fromEntries(chars.slice(0, 10).map(c => [c, 2]));
  assert.equal(T.planTraceSession(chars, { done: many, help: mh }, { n: 4 }, rngOf(1)).filter(o => o.why === 'weak').length, 1);
  // 全部書いた後は 名前＋苦手 ≤ 2、漢字は苦手 1
  const full = Object.fromEntries(chars.map(c => [c, 4])), fh = Object.fromEntries(chars.map(c => [c, 4]));
  for (let seed = 0; seed < 10; seed++) {
    const a = T.planTraceSession(chars, { done: full, help: fh }, { n: 4, name: 'なぬね' }, rngOf(seed));
    assert.equal(a.length, 4);
    assert.ok(a.filter(o => o.why === 'weak' || o.why === 'name').length <= 2, JSON.stringify(a));
    assert.equal(new Set(a.map(o => o.ch)).size, 4);
  }
  const k = [...SETS.k1], kd = Object.fromEntries(k.map(c => [c, 4]));
  assert.equal(T.planTraceSession(k, { done: kd, help: kd }, { n: 4, kanji: true }, rngOf(2)).filter(o => o.why === 'weak').length, 1);
});

test('W5-8. 選んだ字: 1 字目。prev にあっても出る。chars に無くても出る。重複しない', () => {
  const chars = [...SETS.hira];
  assert.deepEqual(whyOf(T.planTraceSession(chars, { done: {} }, { n: 4, chosen: 'ぬ' }, rngOf(1))), ['ぬ:chosen', 'し:new', 'つ:new', 'く:new']);
  const done = { し: 1, つ: 1, く: 1, ぬ: 1 };
  const r = T.planTraceSession(chars, { done }, { n: 4, chosen: 'ぬ', prev: ['ぬ'] }, rngOf(1));
  assert.equal(r[0].ch, 'ぬ'); assert.equal(r.length, 4);
  const k = T.planTraceSession([...SETS.k1], { done: {} }, { n: 4, chosen: 'あ' }, rngOf(1));
  assert.deepEqual(k.map(o => o.ch), ['あ', '山', '川', '口']);
  const dup = T.planTraceSession(chars, { done: {} }, { n: 4, chosen: 'ろ', name: 'ろ' }, rngOf(1)).map(o => o.ch);
  assert.equal(new Set(dup).size, 4); assert.equal(dup[0], 'ろ');
  const w = T.planTraceSession(chars, { done: { ぬ: 1 }, help: { ぬ: 1 } }, { n: 4, chosen: 'ぬ' }, rngOf(1)).map(o => o.ch);
  assert.equal(new Set(w).size, 4); assert.equal(w[0], 'ぬ');
});

test('W5-9. 階段: new は fresh の先頭から飛ばさない。順を飛ばすのは name・chosen だけ（合わせて 2 字まで）', () => {
  const chars = [...SETS.hira];
  for (let seed = 0; seed < 10; seed++) {
    const done = {}; let prev = [];
    for (let t = 0; t < 12; t++) {
      const r = T.planTraceSession(chars, { done, help: {} }, { n: 4, name: 'なぬね', prev, chosen: t === 5 ? 'を' : '' }, rngOf(seed + t));
      const fresh = chars.filter(c => !(done[c] > 0));
      const news = r.filter(o => o.why === 'new').map(o => o.ch);
      const skip = r.filter(o => o.why === 'name' || o.why === 'chosen').length;
      assert.ok(skip <= 2);
      const pickedFresh = r.filter(o => !(done[o.ch] > 0)).map(o => o.ch);
      const front = fresh.filter(c => !pickedFresh.includes(c) || news.includes(c)).slice(0, news.length);
      assert.deepEqual(news, front);
      r.forEach(o => { done[o.ch] = (done[o.ch] || 0) + 1; });
      prev = r.map(o => o.ch);
    }
  }
});

test('W5-10. 決まった結果・重複なし・min(n, 字の数)・入力を書き換えない・n<=0 は []', () => {
  const chars = [...SETS.hira], trace = { done: { し: 2, つ: 1 }, help: { し: 2 } };
  const snap = JSON.stringify([chars, trace]), prev = ['つ'];
  const a = T.planTraceSession(chars, trace, { n: 4, name: 'たろう', prev }, rngOf(7)), b = T.planTraceSession(chars, trace, { n: 4, name: 'たろう', prev }, rngOf(7));
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify([chars, trace]), snap); assert.deepEqual(prev, ['つ']);
  assert.deepEqual(T.planTraceSession(chars, trace, { n: 0 }, rngOf(1)), []);
  assert.deepEqual(T.planTraceSession(chars, trace, { n: -1 }, rngOf(1)), []);
  assert.deepEqual(T.planTraceSession([], trace, { n: 4 }, rngOf(1)), []);
  assert.equal(T.planTraceSession(['し', 'つ', 'く'], { done: {} }, { n: 4 }, rngOf(1)).length, 3);
  // 字が少なく全部 prev でも n 字まで埋める
  assert.equal(T.planTraceSession(['し', 'つ', 'く'], { done: { し: 1, つ: 1, く: 1 } }, { n: 3, prev: ['し', 'つ', 'く'] }, rngOf(1)).length, 3);
});

test('W5-11. 負担の模擬: 名前「なぬね」・毎回すべて たすけ・30 回', () => {
  const chars = [...SETS.hira];
  for (let seed = 0; seed < 5; seed++) {
    let trace = { done: {}, help: {} }, prev = [];
    const seenAll = new Set(), nameCount = { な: 0, ぬ: 0, ね: 0 };
    for (let t = 0; t < 30; t++) {
      const r = T.planTraceSession(chars, trace, { n: 4, name: 'なぬね', prev }, rngOf(seed * 100 + t));
      assert.equal(r.length, 4);
      const fresh = chars.filter(c => !(trace.done[c] > 0));
      if (fresh.length) assert.ok(r.filter(o => o.why === 'new' || (o.why === 'name' && !(trace.done[o.ch] > 0))).length >= 2, `回 ${t}`);
      assert.ok(!r.some(o => prev.includes(o.ch)), `続けて出た 回 ${t}`);
      // 苦手（isWeak）で数える。苦手でない字が足りる回は、新しい字がある間は 1 字・そうでなければ 2 字まで
      const nonWeakAvail = chars.filter(c => !T.isWeak(trace, c) && !prev.includes(c)).length >= 4;
      if (nonWeakAvail) assert.ok(r.filter(o => T.isWeak(trace, o.ch)).length <= (fresh.length ? 1 : 2), `苦手 回 ${t}`);
      r.forEach(o => { seenAll.add(o.ch); if (o.ch in nameCount) nameCount[o.ch]++; trace = T.recordTraceChar(trace, o.ch, { maxM: 2 }); });
      prev = r.map(o => o.ch);
    }
    assert.equal(seenAll.size, 46);
    Object.keys(nameCount).forEach(c => assert.ok(nameCount[c] >= 3, c + nameCount[c]));
  }
});

test('W5-12. traceGrid: hira・kata は 46 字の集合と同じ、cols は rows の入れ替えで左右逆', () => {
  for (const id of ['hira', 'kata', 'k1', 'k2']) {
    for (const o of ['rows', 'cols']) {
      const g = T.traceGrid(id, o), flat = g.flat().filter(c => c);
      assert.deepEqual([...flat].sort(), [...SETS[id]].sort(), id + o);
      assert.equal(new Set(flat).size, flat.length);
      assert.ok(g.every(r => r.length === g[0].length));
    }
  }
  const r = T.traceGrid('hira', 'rows'), c = T.traceGrid('hira', 'cols');
  assert.equal(r.length, 11); assert.equal(r[0].length, 5); assert.equal(c.length, 5); assert.equal(c[0].length, 11);
  r.forEach((row, i) => row.forEach((ch, j) => assert.equal(c[j][10 - i], ch)));
  assert.deepEqual(r[0], ['あ', 'い', 'う', 'え', 'お']); assert.deepEqual(r[7], ['や', '', 'ゆ', '', 'よ']);
  assert.deepEqual(r[10], ['ん', '', '', '', '']);
  assert.deepEqual(c[0].slice(0, 2), ['ん', 'わ']); assert.equal(c[0][10], 'あ'); assert.equal(c[1][0], '');
  assert.deepEqual(T.traceGrid('kata', 'rows')[0], ['ア', 'イ', 'ウ', 'エ', 'オ']);
  assert.equal(T.traceGrid('k1', 'rows').length, 4); assert.equal(T.traceGrid('k1', 'cols').length, 2);
  assert.deepEqual(T.traceGrid('zzz', 'rows'), []);
});

test('W5-13. normalizeTrace の help（done・set・width は今のまま）', () => {
  assert.deepEqual(T.normalizeTrace(undefined), { done: {}, help: {}, solo: {}, set: 'auto', width: 'auto' });
  assert.deepEqual(T.normalizeTrace({ done: { し: 2 } }).help, {});
  assert.deepEqual(T.normalizeTrace({ done: { し: 2, つ: 1 }, help: { し: 5, つ: 1, く: 1, x: 1, へ: -2 }, set: 'kata', width: 'wide' }),
    { done: { し: 2, つ: 1 }, help: { し: 2, つ: 1 }, solo: {}, set: 'kata', width: 'wide' });
  assert.deepEqual(T.normalizeTrace({ done: { し: 2 }, help: 'abc' }).help, {});
  assert.deepEqual(T.normalizeTrace({ done: { し: 2 }, help: { し: '1' } }).help, {});
});

test('W5-14. 名前の字が苦手なら苦手の枠を使ったものとして数える（新しい字がある間は苦手 1 字まで）', () => {
  const chars = [...SETS.hira];
  const weakN = (r, tr) => r.filter(o => o.why !== 'chosen' && T.isWeak(tr, o.ch)).length;
  // 名前「なぬね」: ぬ・ね が苦手、な は苦手でない → な を選ぶ。苦手な字（復習の枠）は 1 字
  const tr1 = { done: { し: 1, つ: 1, ぬ: 1, ね: 1, な: 1 }, help: { し: 1, ぬ: 1, ね: 1 } };
  const r1 = T.planTraceSession(chars, tr1, { n: 4, name: 'なぬね', prev: [] }, rngOf(1));
  assert.ok(weakN(r1, tr1) <= 1, JSON.stringify(r1));
  assert.ok(r1.some(o => o.ch === 'な' && o.why === 'name'), JSON.stringify(r1));
  // 名前の字が全部苦手で、復習の枠も苦手 → 名前の枠を見送る
  const tr2 = { done: { し: 1, ぬ: 1, ね: 1, な: 1 }, help: { し: 1, ぬ: 1, ね: 1, な: 1 } };
  const r2 = T.planTraceSession(chars, tr2, { n: 4, name: 'なぬね', prev: [] }, rngOf(1));
  assert.ok(weakN(r2, tr2) <= 1 && !r2.some(o => o.why === 'name'), JSON.stringify(r2));
  // 復習の枠に苦手がなければ、苦手な名前の字は 1 字入れてよい
  const tr3 = { done: { つ: 1, ぬ: 1 }, help: { ぬ: 1 } };
  const r3 = T.planTraceSession(chars, tr3, { n: 4, name: 'ぬ', prev: ['ぬ'] }, rngOf(1));
  assert.ok(weakN(r3, tr3) <= 1);
  const tr3b = { done: { つ: 1, ぬ: 1 }, help: { ぬ: 1 } };
  assert.ok(weakN(T.planTraceSession(chars, tr3b, { n: 4, name: 'ぬ', prev: [] }, rngOf(1)), tr3b) <= 1);
  // 全部書いた後は 名前＋苦手 ≤ 2（名前の字が苦手でも）
  const all = Object.fromEntries(chars.map(c => [c, 2])), hp = Object.fromEntries(chars.filter((c, i) => i % 3 === 0 || 'なぬね'.includes(c)).map(c => [c, 2]));
  for (let seed = 0; seed < 20; seed++) {
    const r = T.planTraceSession(chars, { done: all, help: hp }, { n: 4, name: 'なぬね', prev: [] }, rngOf(seed));
    assert.ok(weakN(r, { done: all, help: hp }) <= 2, JSON.stringify(r));
    assert.ok(r.filter(o => o.why === 'name' || T.isWeak({ done: all, help: hp }, o.ch)).length <= 4);
  }
});

test('W5-15. 出動の始めに新しい字があったなら、足りない分を埋めるときも苦手は 1 字まで', () => {
  const chars = [...SETS.hira].slice(0, 9);
  // 新しい字は 1 つだけ（9 字目）。8 字は書いた: 前半 4 字が苦手、後半 4 字は苦手でない
  const done = {}, help = {};
  chars.slice(0, 8).forEach((c, i) => { done[c] = 2; if (i < 4) help[c] = 2; });
  for (let seed = 0; seed < 20; seed++) {
    const r = T.planTraceSession(chars, { done, help }, { n: 4, prev: [] }, rngOf(seed));
    assert.equal(r.length, 4);
    assert.ok(r.filter(o => T.isWeak({ done, help }, o.ch)).length <= 1, JSON.stringify(r));
    assert.ok(r.some(o => o.why === 'new'));
  }
});

test('W5-16. 選んだ字があるとき、新しい字は 1 字に減ってよい（選んだ 1＋復習 1＋名前 1＋新しい 1）', () => {
  const chars = [...SETS.hira];
  const trace = { done: { し: 1, つ: 1 } };
  const r = T.planTraceSession(chars, trace, { n: 4, name: 'ろ', chosen: 'ぬ', prev: [] }, rngOf(1));
  assert.equal(r.length, 4);
  assert.deepEqual(r.map(o => o.why).sort(), ['chosen', 'name', 'new', 'review']);
});
