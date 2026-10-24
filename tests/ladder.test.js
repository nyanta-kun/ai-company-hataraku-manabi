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

// ---- S1（R2-b） ----
function gateClear(p, today) {   // M7・K6・T6 を順に 4/4 する。最後の戻りを返す
  let r = { profile: p, promotedTo: null };
  [['math', 'M7'], ['letter', 'K6'], ['clock', 'T6']].forEach(([g, lv]) => {
    r.profile.levels[g] = lv;
    r = L.afterSession(r.profile, g, lv, 4, false, today || TODAY);
  });
  return r;
}

test('S1 階段1: STAGES は S0・S1。S1 の かず は M8〜M10、ほかのゲームは S0 の範囲で遊ぶ', () => {
  assert.deepEqual(D.STAGES.map((s) => s.id), ['S0', 'S1']);
  assert.deepEqual(D.stageRange('S1', 'math'), ['M8', 'M9', 'M10']);
  assert.deepEqual(D.stageRange('S1', 'letter'), D.stageRange('S0', 'letter'));
  assert.deepEqual(D.stageRange('S1', 'clock'), D.stageRange('S0', 'clock'));
  assert.deepEqual(D.stageRange('S1', 'english'), D.stageRange('S0', 'english'));
  assert.deepEqual(D.LEVELS.math, ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10']);
  assert.deepEqual(D.LEVELS.letter, D.stageRange('S0', 'letter'));
  assert.equal(L.stageOf('M8'), 'S1');
  assert.deepEqual(L.gateOf('S0'), { math: 'M7', letter: 'K6', clock: 'T6' });
  assert.deepEqual(L.gateOf('S1'), { math: 'M10' });   // もじ・とけいの S1 ができたら K8・T7 が加わる
});

test('S1 階段2: 3 つのうち 2 つだけでは開かない。3 つ目で開き promotedTo が返る。もう一度では二重に返らない。current は変わらない', () => {
  let p = prof();
  let r = L.afterSession(p, 'math', 'M7', 4, false, '2026-11-02'); p = r.profile;
  assert.equal(r.promotedTo, null);
  p.levels.letter = 'K6'; r = L.afterSession(p, 'letter', 'K6', 4, false, '2026-11-03'); p = r.profile;
  assert.equal(r.promotedTo, null);
  assert.equal(p.stage.unlocked, 'S0');
  p.levels.clock = 'T6'; r = L.afterSession(p, 'clock', 'T6', 4, false, '2026-11-05'); p = r.profile;
  assert.equal(r.promotedTo, 'S1');
  assert.deepEqual(p.stage, { unlocked: 'S1', current: 'S0' });
  assert.deepEqual(p.cleared, { M7: '2026-11-02', K6: '2026-11-03', T6: '2026-11-05' });
  assert.equal(p.promoted.S1, '2026-11-05');
  assert.equal(p.levels.math, 'M7', '解放しても levels は進めない');
  r = L.afterSession(p, 'clock', 'T6', 4, false, '2026-11-09');
  assert.equal(r.promotedTo, null);
  assert.equal(r.profile.promoted.S1, '2026-11-05');
  assert.equal(r.profile.cleared.T6, '2026-11-05');
});

test('S1 階段3: 3/4 では付かず開かない。えいごの 4/4 は関門に関係しない', () => {
  let p = prof({ levels: { math: 'M7', letter: 'K6', clock: 'T6', english: 'E3' } });
  p = L.afterSession(p, 'math', 'M7', 4, false, TODAY).profile;
  p = L.afterSession(p, 'letter', 'K6', 4, false, TODAY).profile;
  p = L.afterSession(p, 'clock', 'T6', 3, false, TODAY).profile;
  p = L.afterSession(p, 'english', 'E3', 4, false, TODAY).profile;
  assert.equal(p.stage.unlocked, 'S0');
  assert.equal(p.cleared.T6, undefined);
  assert.equal(L.afterSession(p, 'clock', 'T6', 4, false, TODAY).promotedTo, 'S1');
});

test('S1 階段4: S1 を選ぶと M8 から。M8 で 0/4 でも M8 のまま（S0 に落ちない）。4/4 で M9、M10 は上限', () => {
  let p = gateClear(prof()).profile;
  p = L.selectStage(p, 'S1');
  assert.equal(p.stage.current, 'S1');
  assert.deepEqual(L.playLevel(p, 'math'), { level: 'M8', review: false });
  assert.equal(L.afterSession(p, 'math', 'M8', 0, false, TODAY).profile.levels.math, 'M8');
  assert.equal(L.afterSession(p, 'math', 'M8', 4, false, TODAY).profile.levels.math, 'M9');
  assert.equal(L.afterSession(withLv({ math: 'M10' }, { stage: p.stage }), 'math', 'M10', 4, false, TODAY).profile.levels.math, 'M10');
  assert.equal(L.afterSession(withLv({ math: 'M10' }, { stage: p.stage }), 'math', 'M10', 4, false, TODAY).profile.cleared.M10, TODAY);
  const q = L.afterSession(Object.assign({}, p, { locked: { math: true, letter: false, clock: false, english: false } }), 'math', 'M8', 4, false, TODAY).profile;
  assert.equal(q.levels.math, 'M8', '固定');
});

test('S1 階段5: 復習（S1 の子が S0 で遊ぶ）は S0 の最後のレベルで、levels は変わらない。0/4 でも変わらない。cleared と stats 側は進められる', () => {
  let p = gateClear(prof()).profile;
  p.levels.math = 'M9'; p.levels.letter = 'K3';
  assert.equal(p.stage.current, 'S0');
  const pl = L.playLevel(p, 'math');
  assert.deepEqual(pl, { level: 'M7', review: true });
  assert.equal(L.afterSession(p, 'math', 'M7', 0, true, TODAY).profile.levels.math, 'M9');
  assert.equal(L.afterSession(p, 'math', 'M7', 4, true, TODAY).profile.levels.math, 'M9');
  assert.equal(L.afterSession(p, 'math', 'M7', 4, true, '2026-12-01').profile.cleared.M7, TODAY, '日付は変えない');
  assert.deepEqual(L.playLevel(p, 'letter'), { level: 'K3', review: false }, '範囲内ならふつうに遊ぶ');
});

test('S1 階段6: S1 でもじ・とけい・えいごを選んだとき: S0 の範囲でふつうに遊び、昇降級する（行き詰まらない）', () => {
  let p = L.selectStage(gateClear(prof()).profile, 'S1');
  p.levels.letter = 'K3'; p.levels.clock = 'T2'; p.levels.english = 'E1';
  assert.deepEqual(L.playLevel(p, 'letter'), { level: 'K3', review: false });
  assert.equal(L.afterSession(p, 'letter', 'K3', 4, false, TODAY).profile.levels.letter, 'K4');
  assert.equal(L.afterSession(p, 'clock', 'T2', 0, false, TODAY).profile.levels.clock, 'T1');
  assert.equal(L.afterSession(p, 'english', 'E1', 4, false, TODAY).profile.levels.english, 'E2');
  p.levels.letter = 'K6';
  assert.equal(L.afterSession(p, 'letter', 'K6', 4, false, TODAY).profile.levels.letter, 'K6', '範囲の上限で止まる');
});

test('S1 階段7: 保護者の手動解放。未解放なら S1 は選べない。解放しても current は変わらない。promoted は既にあれば変えない', () => {
  const p0 = prof();
  assert.equal(L.selectStage(p0, 'S1').stage.current, 'S0');
  const p1 = L.unlockStage(p0, 'S1', '2026-11-10');
  assert.deepEqual(p1.stage, { unlocked: 'S1', current: 'S0' });
  assert.equal(p1.promoted.S1, '2026-11-10');
  assert.equal(L.unlockStage(p1, 'S1', '2026-12-10').promoted.S1, '2026-11-10');
  assert.equal(L.selectStage(p1, 'S1').stage.current, 'S1');
  assert.equal(p0.stage.unlocked, 'S0', '元は書き換えない');
  assert.deepEqual(L.unlockStage(p0, 'S9', TODAY), p0);
});

test('S1 階段8: 再ロックは S1 を閉じ、S0 の関門の記録と promoted を消し、current とレベルを丸める。S0 は閉じられない', () => {
  let p = L.selectStage(gateClear(prof()).profile, 'S1');
  p.levels.math = 'M9'; p.cleared.M10 = TODAY;
  const q = L.relockStage(p, 'S1');
  assert.deepEqual(q.stage, { unlocked: 'S0', current: 'S0' });
  assert.deepEqual(q.cleared, {});
  assert.deepEqual(q.promoted, {});
  assert.equal(q.levels.math, 'M7');
  assert.equal(q.levels.letter, p.levels.letter);
  assert.deepEqual(L.relockStage(prof(), 'S1'), prof(), '未解放なら何も変わらない');
  assert.deepEqual(L.relockStage(p, 'S0'), p);
  // 閉じたあと関門を通り直すまで開かない
  assert.equal(L.afterSession(q, 'math', 'M7', 4, false, TODAY).promotedTo, null);
  assert.equal(gateClear(q).promotedTo, 'S1');
});

test('S1 階段9: ドロップダウンの範囲は解放済みのステージまで。保護者がレベルを選ぶと、ステージを揃える', () => {
  const p0 = prof();
  assert.deepEqual(L.selectableLevels(p0, 'math'), ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']);
  const p1 = L.unlockStage(p0, 'S1', TODAY);
  assert.deepEqual(L.selectableLevels(p1, 'math').slice(-3), ['M8', 'M9', 'M10']);
  assert.deepEqual(L.selectableLevels(p1, 'letter'), D.stageRange('S0', 'letter'));
  // 未解放のレベルは選べない
  assert.equal(L.chooseLevel(p0, 'math', 'M9').levels.math, 'M1');
  // S1 を選んでいる子に M5 → current は S0 に揃う（M8 が出てしまう食い違いを防ぐ）
  const p2 = L.selectStage(Object.assign({}, p1, { levels: Object.assign({}, p1.levels, { math: 'M9' }) }), 'S1');
  const p3 = L.chooseLevel(p2, 'math', 'M5');
  assert.equal(p3.levels.math, 'M5');
  assert.equal(p3.stage.current, 'S0');
  assert.deepEqual(L.playLevel(p3, 'math'), { level: 'M5', review: false });
  // S0 を選んでいる子に M9 → S1 に揃う
  const p4 = L.chooseLevel(p1, 'math', 'M9');
  assert.equal(p4.stage.current, 'S1');
  assert.deepEqual(L.playLevel(p4, 'math'), { level: 'M9', review: false });
  // S1 の子にもじのレベルを選んでも、current は S1 のまま（もじは S0 の範囲で遊ぶ）
  const p5 = L.chooseLevel(L.selectStage(p1, 'S1'), 'letter', 'K3');
  assert.equal(p5.stage.current, 'S1');
  assert.equal(p5.levels.letter, 'K3');
});

test('S1 階段10: gateStatus は関門ごとの日付（未達は空）。current が unlocked より上の壊れたデータは丸められる', () => {
  let p = L.afterSession(prof(), 'math', 'M7', 4, false, '2026-11-02').profile;
  assert.deepEqual(L.gateStatus(p, 'S0'), { math: '2026-11-02', letter: '', clock: '' });
  assert.deepEqual(S.normalizeProfile({ stage: { unlocked: 'S0', current: 'S1' } }).stage, { unlocked: 'S0', current: 'S0' });
  assert.deepEqual(S.normalizeProfile({ stage: { unlocked: 'S1', current: 'S1' }, cleared: { M7: '2026-11-02', M10: '2026-11-03' }, promoted: { S1: '2026-11-03' } }).stage, { unlocked: 'S1', current: 'S1' });
  // current が unlocked より上のまま来ても playLevel は S0 の範囲で動く
  const bad = prof(); bad.stage = { unlocked: 'S0', current: 'S1' };
  assert.equal(L.currentStage(bad), 'S0');
  assert.deepEqual(L.playLevel(bad, 'math'), { level: 'M1', review: false });
});

test('S1 階段11: 既存の S0 の子（M7・K6・T6 まで進んだ v2）は、読み込んでも playLevel・afterSession の結果が S0 のまま', () => {
  const old = S.normalizeProfile({ levels: { math: 'M7', letter: 'K6', clock: 'T6', english: 'E3' } });
  assert.deepEqual(L.playLevel(old, 'math'), { level: 'M7', review: false });
  const r = L.afterSession(old, 'math', 'M7', 4, false, TODAY);
  assert.equal(r.profile.levels.math, 'M7');
  assert.equal(r.promotedTo, null);
});
