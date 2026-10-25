const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/data.js');
const P = require('../src/problems.js');
const S = require('../src/storage.js');
const L = require('../src/ladder.js');
require('../src/scenes.js');
const SC = globalThis.Manabi.scenes;

const TODAY = '2026-11-20';
function prof(over) { return Object.assign(S.defaultProfile('p_a', 'こども1', 'shoubousha', '2026-10-01'), over || {}); }
// S1 を解放して選んだ子
function s1() { return L.selectStage(L.unlockStage(prof(), 'S1', TODAY), 'S1'); }

test('R3 階段1: STAGES は S0・S1・S2。S2 は たいいん（小学2年生くらい）。かず M11〜M13。えいごは追加なし', () => {
  assert.deepEqual(D.STAGES.map((s) => s.id), ['S0', 'S1', 'S2']);
  assert.equal(D.STAGES[2].rank, 'たいいん');
  assert.equal(D.STAGES[2].grade, '小学2年生くらい');
  assert.deepEqual(D.STAGES[2].levels.math, ['M11', 'M12', 'M13']);
  assert.deepEqual(D.STAGES[2].levels.english, []);
  assert.deepEqual(D.stageRange('S2', 'english'), ['E4', 'E5'], 'えいごは S1 の範囲で遊ぶ');
  assert.equal(D.LEVELS.math[D.LEVELS.math.length - 1], 'M13');
  assert.equal(L.stageOf('M11'), 'S2');
  assert.equal(L.stageOf('M10'), 'S1');
});

test('R3 階段2: S1 の関門は M10・K8・T7（えいごは入らない）。S2 は最後のステージ', () => {
  assert.deepEqual(L.gateOf('S1'), Object.assign({ math: 'M10', letter: 'K8', clock: 'T7' }));
  assert.ok(D.gateLevels().includes('M10') && D.gateLevels().includes('K8') && D.gateLevels().includes('T7'));
});

function playGate(p, list, today) {
  let r = { profile: p, promotedTo: null };
  list.forEach(([g, lv, ok]) => {
    r.profile.levels[g] = lv;
    r = L.afterSession(r.profile, g, lv, ok === undefined ? 4 : ok, false, today || TODAY);
  });
  return r;
}

test('R3 階段3: S1 の M10・K8・T7 を各 1 回 4/4 で S2 が開く。2 つだけ・3/4 では開かない。開いても current は S1 のまま', () => {
  let p = s1();
  let r = playGate(p, [['math', 'M10'], ['letter', 'K8']]);
  assert.equal(r.promotedTo, null);
  assert.equal(r.profile.stage.unlocked, 'S1');
  r = playGate(r.profile, [['clock', 'T7', 3]]);
  assert.equal(r.promotedTo, null, 'T7 が 3/4 では開かない');
  r = playGate(r.profile, [['clock', 'T7', 4]], '2026-11-22');
  assert.equal(r.promotedTo, 'S2');
  assert.deepEqual(r.profile.stage, { unlocked: 'S2', current: 'S1' });
  assert.equal(r.profile.promoted.S2, '2026-11-22');
  assert.deepEqual(r.profile.cleared, { M10: TODAY, K8: TODAY, T7: '2026-11-22' });
  assert.equal(L.afterSession(r.profile, 'clock', 'T7', 4, false, '2026-12-01').promotedTo, null, '二重に返らない');
  assert.equal(L.afterSession(r.profile, 'clock', 'T7', 4, false, '2026-12-01').profile.promoted.S2, '2026-11-22');
});

test('R3 階段4: S2 では M11 から。M11 で 0/4 でも M11 のまま（S1 に落ちない）。4/4 で M12、M13 は上限。S1 の子の M10 は 4/4 でも M10 のまま', () => {
  const p0 = s1();
  assert.equal(L.afterSession(p0, 'math', 'M10', 4, false, TODAY).profile.levels.math, 'M10', 'S2 が閉じている間は S1 の上限で止まる');
  let p = L.selectStage(L.unlockStage(p0, 'S2', TODAY), 'S2');
  p.levels.math = 'M10';
  assert.deepEqual(L.playLevel(p, 'math'), { level: 'M11', review: false });
  assert.equal(L.afterSession(p, 'math', 'M11', 0, false, TODAY).profile.levels.math, 'M11');
  assert.equal(L.afterSession(p, 'math', 'M11', 4, false, TODAY).profile.levels.math, 'M12');
  p.levels.math = 'M13';
  assert.equal(L.afterSession(p, 'math', 'M13', 4, false, TODAY).profile.levels.math, 'M13');
  assert.equal(L.afterSession(p, 'math', 'M13', 4, false, TODAY).promotedTo, null, 'S2 の次は無い');
});

test('R3 階段5: S2 の子が S1 の札で遊ぶ（復習）と M10 が出て、levels は変わらない', () => {
  let p = L.unlockStage(prof(), 'S2', TODAY);
  p = L.selectStage(p, 'S1');
  p.levels.math = 'M12';
  const pl = L.playLevel(p, 'math');
  assert.deepEqual(pl, { level: 'M10', review: true });
  assert.equal(L.afterSession(p, 'math', 'M10', 4, true, TODAY).profile.levels.math, 'M12');
  p = L.selectStage(p, 'S2');
  assert.deepEqual(L.playLevel(p, 'math'), { level: 'M12', review: false });
});

test('R3 階段6: S2 での もじ・とけい・えいごは、追加レベルが入るまで S1 の範囲で遊ぶ（M だけ S2）', () => {
  const p = L.selectStage(L.unlockStage(prof(), 'S2', TODAY), 'S2');
  p.levels.english = 'E4';
  assert.deepEqual(L.playLevel(p, 'english'), { level: 'E4', review: false });
  assert.equal(L.afterSession(p, 'english', 'E5', 4, false, TODAY).profile.levels.english, 'E5');
  assert.equal(L.afterSession(p, 'english', 'E5', 4, false, TODAY).promotedTo, null);
});

test('R3 階段7: 再ロック。S2 を閉じると S1 の関門の記録（M10・K8・T7）と promoted.S2 を消し、current と M11 以降は S1 に丸める。S0 の記録は残る', () => {
  let r = playGate(L.selectStage(L.unlockStage(prof(), 'S1', TODAY), 'S1'), [['math', 'M10'], ['letter', 'K8'], ['clock', 'T7']]);
  let p = L.selectStage(r.profile, 'S2'); p.cleared.M7 = TODAY; p.levels.math = 'M12';
  const q = L.relockStage(p, 'S2');
  assert.deepEqual(q.stage, { unlocked: 'S1', current: 'S1' });
  assert.equal(q.levels.math, 'M10');
  assert.equal(q.cleared.M10, undefined); assert.equal(q.cleared.K8, undefined); assert.equal(q.cleared.T7, undefined);
  assert.equal(q.cleared.M7, TODAY, 'S0 の関門の記録は残す');
  assert.equal(q.promoted.S2, undefined);
  // 閉じたあと関門を通り直すまで開かない
  assert.equal(L.afterSession(q, 'math', 'M10', 4, false, TODAY).promotedTo, null);
});

test('R3 階段8: 保存の補正。S2 が未解放なら M11 以降のレベルは M10 に丸める。解放済みならそのまま。cleared に M13 などは残せない（S2 に次が無い）', () => {
  assert.equal(S.normalizeProfile({ levels: { math: 'M12' }, stage: { unlocked: 'S1', current: 'S1' } }).levels.math, 'M10');
  assert.equal(S.normalizeProfile({ levels: { math: 'M12' }, stage: { unlocked: 'S2', current: 'S2' } }).levels.math, 'M12');
  assert.equal(S.normalizeProfile({ levels: { math: 'M12' }, stage: { unlocked: 'S2', current: 'S5' } }).stage.current, 'S0');
  const n = S.normalizeProfile({ stage: { unlocked: 'S2', current: 'S2' }, promoted: { S2: '2026-11-22' }, cleared: { M10: '2026-11-20', M99: '2026-11-20' } });
  assert.equal(n.promoted.S2, '2026-11-22');
  assert.deepEqual(n.cleared, { M10: '2026-11-20' });
  assert.deepEqual(L.selectableLevels(L.unlockStage(prof(), 'S2', TODAY), 'math').slice(-3), ['M11', 'M12', 'M13']);
  assert.equal(L.selectableLevels(L.unlockStage(prof(), 'S1', TODAY), 'math').slice(-1)[0], 'M10');
});

test('R3 階段9: 保護者がレベルを選ぶ。S1 の子に M12 → S2 に揃う（解放済みなら）。未解放なら選べない', () => {
  const p0 = s1();
  assert.equal(L.chooseLevel(p0, 'math', 'M12').levels.math, p0.levels.math, '未解放は選べない');
  const p1 = L.selectStage(L.unlockStage(p0, 'S2', TODAY), 'S1');
  const p2 = L.chooseLevel(p1, 'math', 'M12');
  assert.equal(p2.levels.math, 'M12');
  assert.equal(p2.stage.current, 'S2');
  assert.deepEqual(L.playLevel(p2, 'math'), { level: 'M12', review: false });
});

test('R3 階段10: こてい中、S2 の子が M12 を固定していて S1 の札で遊ぶと、M12 を復習として出す（levels・関門の記録は変えない）', () => {
  let p = L.selectStage(L.unlockStage(prof(), 'S2', TODAY), 'S1');
  p.levels.math = 'M12'; p.locked.math = true;
  assert.deepEqual(L.playLevel(p, 'math'), { level: 'M12', review: true });
  const r = L.afterSession(p, 'math', 'M12', 4, true, TODAY);
  assert.equal(r.profile.levels.math, 'M12');
});

// ---- scenes の配置（純粋関数） ----
const RECT = { x: 40, y: 20, w: 692, h: 440 };
function inside(it, r) { return it.x >= r.x && it.x <= r.x + r.w && it.y >= r.y && it.y <= r.y + r.h; }

test('R3 配置1: tensLayout は n = 10〜100 のすべてで、束の数 × 10 + ばらの数 = n、全部が盤の中、重ならない', () => {
  for (let n = 10; n <= 100; n++) {
    const l = SC.tensLayout(n, RECT, 90), bundles = l.items.filter((i) => i.bundle), loose = l.items.filter((i) => !i.bundle);
    assert.equal(bundles.length, Math.floor(n / 10), n + ' の束');
    assert.equal(loose.length, n % 10, n + ' のばら');
    assert.equal(l.items.reduce((a, i) => a + (i.v || 1), 0), n);
    assert.deepEqual(l.items.map((i) => !!i.bundle), l.items.map((i, k) => k < bundles.length), '束 → ばら の順');
    l.items.forEach((i) => {
      assert.ok(inside(i, RECT), n + ' 盤の中');
      if (i.bundle) { assert.ok(i.x - i.w / 2 >= RECT.x - 1e-6 && i.x + i.w / 2 <= RECT.x + RECT.w + 1e-6 && i.y - i.h / 2 >= RECT.y - 1e-6 && i.y + i.h / 2 <= RECT.y + RECT.h + 1e-6, n + ' 束が盤に収まる'); assert.ok(i.w >= 60 && i.h >= 30, n + ' 束が小さすぎない'); }
      else assert.ok(i.s >= 25, n + ' ばらが小さすぎない ' + i.s);
    });
    for (let a = 0; a < bundles.length; a++) for (let b = a + 1; b < bundles.length; b++) {
      assert.ok(Math.abs(bundles[a].x - bundles[b].x) >= bundles[a].w - 1e-6 || Math.abs(bundles[a].y - bundles[b].y) >= bundles[a].h - 1e-6, n + ' 束が重ならない');
    }
  }
});

test('R3 配置2: groupLayout は d = 2〜5・m = 1〜9 の全部で、箱が m 個、中のものが d×m 個。盤の中に収まり、小さすぎない', () => {
  [2, 3, 4, 5].forEach((d) => {
    for (let m = 1; m <= 9; m++) {
      const l = SC.groupLayout(m, d, RECT, 96);
      assert.equal(l.boxes.length, m); assert.equal(l.items.length, m); assert.equal(l.minis.length, d * m);
      assert.equal(l.items.reduce((a, i) => a + i.v, 0), d * m);
      l.boxes.forEach((b) => assert.ok(b.x >= RECT.x - 1e-6 && b.y >= RECT.y - 1e-6 && b.x + b.w <= RECT.x + RECT.w + 1e-6 && b.y + b.h <= RECT.y + RECT.h + 1e-6, d + 'x' + m + ' 箱が盤に収まる'));
      l.minis.forEach((i) => assert.ok(i.s >= 25, d + 'x' + m + ' ものが小さすぎない ' + i.s));
      // 箱の中にものが収まる
      l.minis.forEach((i, k) => { const b = l.boxes[Math.floor(k / d)]; assert.ok(i.x - i.s / 2 >= b.x && i.x + i.s / 2 <= b.x + b.w && i.y - i.s / 2 >= b.y && i.y + i.s / 2 <= b.y + b.h, '箱の中'); });
    }
  });
});

test('R3 配置3: Stage.mark は 束や箱の値ぶん進んだ合計を返す（10, 20, 30, 31…）。ふつうのものは 1, 2, 3…', () => {
  const st = Object.create(SC.Stage.prototype);
  st.items = [{ v: 10 }, { v: 10 }, { v: 10 }, {}, {}]; st.marks = [];
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => st.mark(i)), [10, 20, 30, 31, 32]);
  assert.equal(st.mark(0), 0, '二度目は 0');
  st.items = [{}, {}, {}]; st.marks = [];
  assert.deepEqual([0, 1, 2].map((i) => st.mark(i)), [1, 2, 3]);
  st.items = [{ v: 4, ghost: true }, { v: 4, ghost: true }]; st.marks = [];
  assert.deepEqual([1, 0].map((i) => st.mark(i)), [4, 8]);
});
