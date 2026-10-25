const test = require('node:test');
const assert = require('node:assert/strict');
const { rngOf } = require('./helpers.js');
const T = require('../src/trace.js');
const { STROKES, SETS } = require('../src/strokes.js');

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

test('1. 手本の点列そのもの → 進度が単調に増え done（ひらがな全画）', () => {
  for (const ch of SETS.hira) STROKES[ch].s.forEach((s, i) => {
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

test('6. 輪のある画: 正しくなぞれば単調に done、輪を飛ばして交差点から終点へ近道すると done にならない', () => {
  [['の', 0], ['ぬ', 1], ['あ', 2], ['め', 1]].forEach(([ch, i]) => {
    const p = poly(ch, i);
    const x = crossing(p);
    assert.ok(x, ch + ' に交差がある');
    const full = run(p, p, TOL, { every: 2 });
    assert.equal(full.end, 'done', ch);
    for (let k = 1; k < full.prog.length; k++) assert.ok(full.prog[k] >= full.prog[k - 1], ch);
    const cheat = p.slice(0, x[0] + 1).concat(p.slice(x[1]));
    const r = run(p, cheat, TOL, { every: 2 });
    assert.notEqual(r.end === 'done' && r.move === 'ok', true, ch + ' は近道で書けてはいけない');
    assert.ok(r.move === 'off' || r.end === 'short', ch);
  });
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
  // ひらがなには 0.08 未満の画は無い（ふ の点も 0.25 ほどある）ので、実物の画は点として扱われない
  for (const ch of SETS.hira) STROKES[ch].s.forEach(s => assert.ok(!T.isDot(T.strokePolyline(s)), ch));
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
  assert.deepEqual(T.pickTraceChars(chars, {}, 4, rngOf(1)), ['あ', 'い', 'う', 'え']);
  const done = { あ: 1, い: 1, う: 1, え: 1 };
  const second = T.pickTraceChars(chars, done, 4, rngOf(1));
  assert.equal(second.length, 4);
  assert.deepEqual(second.slice(1), ['お', 'か', 'き']);           // 復習が先、新しい字は順番どおり
  assert.ok(['あ', 'い', 'う', 'え'].includes(second[0]));
  // 回数の少ない字から復習する
  const third = T.pickTraceChars(chars, { あ: 3, い: 1, う: 2, え: 3 }, 4, rngOf(5));
  assert.equal(third[0], 'い');
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
  assert.ok(e.includes('ん'));
  assert.equal(new Set(e).size, 4);
  // 重複なし・決定的・入力を書き換えない
  const snapshot = JSON.stringify(done), cs = chars.slice();
  assert.deepEqual(T.pickTraceChars(chars, done, 4, rngOf(9)), T.pickTraceChars(chars, done, 4, rngOf(9)));
  assert.equal(JSON.stringify(done), snapshot);
  assert.deepEqual(chars, cs);
  for (let seed = 0; seed < 20; seed++) {
    const r = T.pickTraceChars(chars, { あ: 1, い: 2, う: 1, お: 5 }, 4, rngOf(seed));
    assert.equal(new Set(r).size, r.length);
  }
});

test('12. traceSet: S0 はひらがなが残っていれば hira、全部書いたら hira+kata。S1 は k1。未解放の集合は auto の扱い', () => {
  assert.equal(T.traceSet({ done: {}, set: 'auto' }, 'S0'), 'hira');
  const all = {}; [...SETS.hira].forEach(c => { all[c] = 1; });
  assert.equal(T.traceSet({ done: all, set: 'auto' }, 'S0'), 'hira+kata');
  const almost = Object.assign({}, all); delete almost['ん'];
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
  // 正しいデータは変わらない（冪等）
  assert.deepEqual(T.normalizeTrace(n), n);
});
