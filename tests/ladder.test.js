const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/data.js');
const P = require('../src/problems.js');
const S = require('../src/storage.js');
const L = require('../src/ladder.js');

const TODAY = '2026-11-05';
function prof(over) { return Object.assign(S.defaultProfile('p_a', 'こども1', 'shoubousha', '2026-10-01'), over || {}); }
function withLv(lv, extra) { const p = prof(extra); Object.assign(p.levels, lv); return p; }

test('階段1: LEVELS は STAGES のレベルを順につないだものと一致し、S0 は従来の列', () => {
  D.GAMES.forEach((g) => {
    const cat = [].concat(...D.STAGES.map((s) => s.levels[g]));
    assert.deepEqual(D.LEVELS[g], cat);
    assert.equal(new Set(cat).size, cat.length);
  });
  assert.deepEqual(D.STAGES[0].levels, {
    math: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'], letter: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'],
    clock: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'], english: ['E1', 'E2', 'E3']
  });
  assert.equal(P.LEVELS, D.LEVELS);
});

test('階段2: 関門は S0 = M7・K6・T6、えいごは関門に入らない', () => {
  assert.deepEqual(L.gateOf('S0'), { math: 'M7', letter: 'K6', clock: 'T6' });
  assert.deepEqual(D.GATE_GAMES, ['math', 'letter', 'clock']);
  assert.equal(L.gateOf('S9'), null);
  assert.equal(L.stageOf('M7'), 'S0');
  assert.equal(L.stageOf('M99'), null);
});

test('階段3: nextLevel の range（範囲の端で止まる・省略時は全体）', () => {
  const r = D.stageRange('S0', 'math');
  assert.deepEqual(r, ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']);
  assert.equal(P.nextLevel('math', 'M7', 4, false, r), 'M7');
  assert.equal(P.nextLevel('math', 'M1', 0, false, r), 'M1');
  assert.equal(P.nextLevel('math', 'M3', 4, false, r), 'M4');
  assert.equal(P.nextLevel('math', 'M3', 4, true, r), 'M3');
  assert.equal(P.nextLevel('math', 'M99', 4, false, r), 'M2');   // 範囲外は先頭扱い
  assert.equal(P.nextLevel('math', 'M3', 4, false), P.nextLevel('math', 'M3', 4, false, D.LEVELS.math));
});

test('階段4: S0 の M7 で 4/4 → levels は M7 のまま、cleared が付く、S1 が無い／関門未達なので何も起きない', () => {
  const p = withLv({ math: 'M7' });
  const pl = L.playLevel(p, 'math');
  assert.deepEqual(pl, { level: 'M7', review: false });
  const r = L.afterSession(p, 'math', 'M7', 4, false, TODAY);
  assert.equal(r.profile.levels.math, 'M7');
  assert.equal(r.profile.cleared.M7, TODAY);
  assert.equal(r.promotedTo, null);
  assert.equal(r.profile.stage.unlocked, 'S0');
  assert.equal(p.cleared.M7, undefined, '元の profile は書き換えない');
});

test('階段5: 3/4 では cleared が付かない。関門でないレベルの 4/4 でも付かない。日付は変えない', () => {
  const p = withLv({ math: 'M7' });
  assert.deepEqual(L.afterSession(p, 'math', 'M7', 3, false, TODAY).profile.cleared, {});
  assert.deepEqual(L.afterSession(withLv({ math: 'M5' }), 'math', 'M5', 4, false, TODAY).profile.cleared, {});
  const p2 = L.afterSession(p, 'math', 'M7', 4, false, '2026-11-01').profile;
  assert.equal(L.afterSession(p2, 'math', 'M7', 4, false, TODAY).profile.cleared.M7, '2026-11-01');
});

test('階段6: 通常の昇降級は今までどおり（固定も）', () => {
  const p = withLv({ math: 'M3' });
  assert.equal(L.afterSession(p, 'math', 'M3', 4, false, TODAY).profile.levels.math, 'M4');
  assert.equal(L.afterSession(p, 'math', 'M3', 0, false, TODAY).profile.levels.math, 'M2');
  p.locked.math = true;
  assert.equal(L.afterSession(p, 'math', 'M3', 4, false, TODAY).profile.levels.math, 'M3');
  assert.equal(L.afterSession(withLv({ clock: 'T6' }), 'clock', 'T6', 0, false, TODAY).profile.levels.clock, 'T5');
});

test('階段7: v2 の既存データ（stage などなし）を補う。levels・cards・stats・seen は変わらない', () => {
  const old = { levels: { math: 'M7', letter: 'K6', clock: 'T6', english: 'E3' }, locked: { math: true }, cards: { dump: 2, shoubousha: 3 },
    stats: { sessions: 9, math: { sessions: 4, questions: 16, firstTry: 12 } }, seen: { letter: ['v6', 'bus'] }, lastPlayed: '2026-10-20' };
  const n = S.normalizeProfile(old);
  assert.deepEqual(n.levels, { math: 'M7', letter: 'K6', clock: 'T6', english: 'E3' });
  assert.equal(n.locked.math, true);
  assert.deepEqual(n.cards, { dump: 2, shoubousha: 3 });
  assert.equal(n.stats.sessions, 9);
  assert.equal(n.stats.math.firstTry, 12);
  assert.deepEqual(n.seen.letter, ['v6', 'bus']);
  assert.equal(n.lastPlayed, '2026-10-20');
  assert.deepEqual(n.stage, { unlocked: 'S0', current: 'S0' });
  assert.deepEqual(n.cleared, {});
  assert.deepEqual(n.promoted, {});
  // 同じ入力 → 同じ出力（もう一度整えても変わらない）
  assert.deepEqual(S.normalizeProfile(n), n);
});

test('階段8: 壊れた stage/cleared/promoted は整える（unlocked より上の current は丸め、関門以外・日付でない値は捨てる）', () => {
  const n = S.normalizeProfile({ stage: { unlocked: 'S9', current: 'S1' }, cleared: { M7: '2026-11-02', M5: '2026-11-02', K6: 'あした', T6: 5 }, promoted: { S0: '2026-11-02', S7: '2026-11-02' } });
  assert.deepEqual(n.stage, { unlocked: 'S0', current: 'S0' });
  assert.deepEqual(n.cleared, { M7: '2026-11-02' });
  assert.deepEqual(n.promoted, {});
  assert.deepEqual(S.normalizeProfile({ stage: 'x', cleared: [], promoted: 3 }).stage, { unlocked: 'S0', current: 'S0' });
});

test('階段9: とけいのヒントは P.CLOCK の項目で決まる（T4〜T6 は両針、T3〜T6 は声なしで光らせる）', () => {
  ['T1', 'T2', 'T3'].forEach((k) => assert.ok(!P.CLOCK[k].hintBoth));
  ['T4', 'T5', 'T6'].forEach((k) => assert.equal(P.CLOCK[k].hintBoth, true));
  ['T1', 'T2'].forEach((k) => assert.ok(!P.CLOCK[k].glowWhenVoiceless));
  ['T3', 'T4', 'T5', 'T6'].forEach((k) => assert.equal(P.CLOCK[k].glowWhenVoiceless, true));
});

test('階段10: NUM_KANA は 100 まで（よん・なな・きゅう、じゅう・ひゃく）', () => {
  const N = D.NUM_KANA;
  assert.equal(N.length, 101);
  assert.deepEqual([1, 4, 7, 9, 10].map((i) => N[i]), ['いち', 'よん', 'なな', 'きゅう', 'じゅう']);
  assert.deepEqual([11, 14, 17, 19, 20, 21, 40, 74, 99, 100].map((i) => N[i]),
    ['じゅういち', 'じゅうよん', 'じゅうなな', 'じゅうきゅう', 'にじゅう', 'にじゅういち', 'よんじゅう', 'ななじゅうよん', 'きゅうじゅうきゅう', 'ひゃく']);
  for (let i = 1; i <= 100; i++) assert.match(N[i], /^[ぁ-ゖー]+$/);
});
