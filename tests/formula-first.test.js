// しきから: たしざん・ひきざん・かけざんは、そのレベルで 2 回（絵つきで）出動したら 3 回目から式だけで始める
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/data.js');
const P = require('../src/problems.js');
const S = require('../src/storage.js');
const L = require('../src/ladder.js');
const LN = require('../src/lines.js');
const { rngOf } = require('./helpers.js');

const TODAY = '2026-11-05';
function prof(lv) { const p = S.defaultProfile('p_a', 'こども1', 'shoubousha', '2026-10-01'); if (lv) { p.levels.math = lv; p.stage.unlocked = D.stageOf(lv); p.stage.current = D.stageOf(lv); } return p; }
function session(level, seed) { return P.generateSession('math', level, rngOf(seed || 1)); }
function finish(p, level, ft) { return L.afterSession(p, 'math', level, ft, false, TODAY).profile; }

test('最初の 2 回の出動は絵つき、3 回目から式だけ（たしざん M4・ひきざん M6・かけざん M13）', () => {
  ['M4', 'M5', 'M6', 'M7', 'M9', 'M10', 'M13'].forEach((lv) => {
    let p = prof(lv); p.locked.math = true;   // こてい: 同じレベルを続ける
    for (let n = 0; n < 5; n++) {
      const qs = P.applyFormula(session(lv, n), p.practice, lv);
      qs.forEach((q) => assert.equal(!!q.formula, n >= 2, lv + ' ' + n + '回目'));
      p = finish(p, lv, 4);
    }
    assert.equal(p.practice[lv], 5);
  });
});

test('級が上がって新しいレベルに入ると、また最初の 2 回は絵つき（回数はレベルごと）', () => {
  let p = prof('M4');
  p = finish(p, 'M4', 4); p = finish(p, 'M4', 4);   // 2 回とも 4/4 → M5 へ
  assert.equal(p.levels.math, 'M5');
  assert.equal(P.formulaReady(p.practice, 'M4'), true);
  assert.equal(P.formulaReady(p.practice, 'M5'), false);
  session('M5').forEach((q) => assert.ok(!P.applyFormula([q], p.practice, 'M5')[0].formula));
});

test('数える問題（M1・M2・M3・M11）、M8 の数える問題、M12（もともと式だけ）には formula を付けない。M8 のたしざんには付く', () => {
  const ready = (lv) => { const pr = {}; pr[lv] = 9; return pr; };
  ['M1', 'M2', 'M3', 'M11', 'M12'].forEach((lv) => {
    P.applyFormula(session(lv, 3), ready(lv), lv).forEach((q) => assert.ok(!q.formula, lv));
  });
  const m8 = P.applyFormula(session('M8', 3), ready('M8'), 'M8');
  assert.ok(m8.some((q) => q.kind === 'count') && m8.some((q) => q.kind === 'add'));
  m8.forEach((q) => assert.equal(!!q.formula, q.kind === 'add'));
});

test('出動の数は 99 まで。review でも遊んだレベルに数える。かず以外のゲームは数えない', () => {
  let p = prof('M4'); p.practice.M4 = 99;
  p = finish(p, 'M4', 3);
  assert.equal(p.practice.M4, 99);
  const r = L.afterSession(prof('M7'), 'math', 'M5', 4, true, TODAY).profile;
  assert.equal(r.practice.M5, 1);
  const k = L.afterSession(prof('M4'), 'letter', 'K1', 4, false, TODAY).profile;
  assert.deepEqual(k.practice, {});
});

test('絵を見た問題は 1 回目正解に数えない: 昇級も降級も firstTry で決まる（毎回「えで みる」を押す子は下がる）', () => {
  const r = D.stageRange('S0', 'math');
  assert.equal(P.nextLevel('math', 'M5', 3, false, r), 'M5');   // 1 問は絵を見た → 昇級しない
  assert.equal(P.nextLevel('math', 'M5', 4, false, r), 'M6');
  assert.equal(P.nextLevel('math', 'M5', 1, false, r), 'M4');
  assert.equal(P.nextLevel('math', 'M5', 0, false, r), 'M4');   // 毎回絵を見たら下がる
  let p = prof('M7');
  assert.ok(!finish(p, 'M7', 3).cleared.M7);
  assert.equal(finish(p, 'M7', 4).cleared.M7, TODAY);
});

test('既存の子（practice が無い）: 下のレベルは式から、いまのレベルは かずを 10 回以上遊んでいれば式から、そうでなければ絵つき 2 回から', () => {
  const mk = (lv, sessions) => { const p = prof(lv); delete p.practice; p.stats.math.sessions = sessions; return S.normalizeProfile(p); };
  const a = mk('M6', 3);
  assert.deepEqual(a.practice, { M1: 2, M2: 2, M3: 2, M4: 2, M5: 2 });
  assert.ok(P.formulaReady(a.practice, 'M5') && !P.formulaReady(a.practice, 'M6'));
  const b = mk('M6', 10);
  assert.ok(P.formulaReady(b.practice, 'M6') && !P.formulaReady(b.practice, 'M7'));
  assert.deepEqual(mk('M1', 50).practice, { M1: 2 });
  assert.deepEqual(mk('M1', 0).practice, {});
});

test('practice の正規化: 既知のレベルだけ・0〜99 の整数・壊れた値は捨てる。保存して読み直しても同じ', () => {
  const p = prof('M5');
  p.practice = { M4: 3, M5: 250, M6: -1, M7: 'x', Z9: 4, __proto__: 1, constructor: 2 };
  const n = S.normalizeProfile(p);
  assert.deepEqual(n.practice, { M4: 3, M5: 99 });
  assert.deepEqual(S.normalizeProfile(JSON.parse(JSON.stringify(n))).practice, n.practice);
  assert.equal(P.practiceOf(n.practice, 'constructor'), 0);
  assert.equal(P.formulaReady({}, 'M4'), false);
});

test('読み上げ: たしざん・ひきざんは式の文のまま。かけざんは 式だけのとき「{数}かける{数}は、いくつ？」、絵を出したあとは今の文', () => {
  assert.equal(LN.prompt({ kind: 'add', a: 3, b: 2, formula: true }), LN.prompt({ kind: 'add', a: 3, b: 2 }));
  assert.equal(LN.prompt({ kind: 'mul', a: 2, b: 3, formula: true }), 'にかけるさんは、いくつ？');
  const shown = { kind: 'mul', a: 2, b: 3, formula: true, picShown: true };
  assert.equal(LN.prompt(shown), LN.prompt({ kind: 'mul', a: 2, b: 3 }));
  const qs = P.applyFormula(session('M13', 4), { M13: 2 }, 'M13');
  const texts = LN.sessionTexts(qs);
  qs.forEach((q) => { assert.ok(texts.indexOf(LN.prompt(q)) >= 0); assert.ok(texts.indexOf(LN.prompt(Object.assign({}, q, { picShown: true }))) >= 0); });
});
