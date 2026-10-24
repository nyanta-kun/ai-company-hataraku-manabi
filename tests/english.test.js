// えいご（E1〜E3）: plan-katakana-english.md 3.6 の性質 1〜9 と、9章の保存まわり
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/problems.js');
const D = require('../src/data.js');
const S = require('../src/storage.js');
require('../src/vehicles.js');
const V = globalThis.Manabi.vehicles;
const { rngOf } = require('./helpers.js');

const N = 1000;
const LV = ['E1', 'E2', 'E3'];
const CH = { E1: 3, E2: 3, E3: 4 };   // 選択肢の数（語・数とも）
const MAX = { E2: 5, E3: 10 };
const wordOf = id => D.ENGLISH_WORDS.find(w => w.id === id);

test('英語性質1: choices に answer がちょうど1回、重複なし、長さ E1=3 E2=3 E3=4（語・数とも）', () => {
  for (const lv of LV) {
    const r = rngOf(31);
    for (let i = 0; i < N; i++) {
      const p = P.generateEnglish(lv, r);
      assert.equal(p.kind, 'english');
      assert.equal(p.choices.filter(c => c === p.answer).length, 1, lv);
      assert.equal(new Set(p.choices).size, p.choices.length);
      assert.equal(p.choices.length, CH[lv]);
    }
  }
});

test('英語性質2: 語の問題の選択肢はすべて ENGLISH_WORDS の id で、同じ group の語が同時に出ない。E1 は語だけ', () => {
  for (const lv of LV) {
    const r = rngOf(32);
    for (let i = 0; i < N; i++) {
      const p = P.generateEnglish(lv, r);
      if (lv === 'E1') assert.equal(p.form, 'word');
      if (p.form !== 'word') continue;
      p.choices.forEach(c => assert.ok(wordOf(c), c));
      assert.equal(new Set(p.choices.map(c => wordOf(c).group)).size, p.choices.length);
    }
  }
});

test('英語性質3: E2 は 1〜5、E3 は 1〜10（0・負数・範囲外なし）', () => {
  for (const lv of ['E2', 'E3']) {
    const r = rngOf(33), seen = new Set();
    for (let i = 0; i < N; i++) {
      const p = P.generateEnglish(lv, r);
      if (p.form !== 'number') continue;
      [p.n, ...p.choices].forEach(v => { assert.ok(Number.isInteger(v) && v >= 1 && v <= MAX[lv], lv + ' ' + v); });
      assert.equal(p.n, p.answer);
      seen.add(p.n);
    }
    assert.equal(seen.size, MAX[lv]);   // 範囲の数が全部出る
  }
});

test('英語性質4: 数の誤答は正解±1〜2を優先し、足りない分は範囲内の他の数で補う', () => {
  for (const lv of ['E2', 'E3']) {
    const r = rngOf(34);
    for (let i = 0; i < N; i++) {
      const p = P.generateEnglish(lv, r);
      if (p.form !== 'number') continue;
      const wrong = p.choices.filter(c => c !== p.answer);
      const near = [-2, -1, 1, 2].map(d => p.answer + d).filter(v => v >= 1 && v <= MAX[lv]);
      const nearWrong = wrong.filter(c => near.includes(c));
      assert.equal(nearWrong.length, Math.min(wrong.length, near.length), lv + ' ' + JSON.stringify(p));
      assert.deepEqual(p.choices, p.choices.slice().sort((a, b) => a - b));   // 昇順
    }
  }
});

test('英語性質5: en が ENGLISH_WORDS / NUM_EN と一致し、ja はひらがな', () => {
  const r = rngOf(35);
  for (const lv of LV) for (let i = 0; i < 300; i++) {
    const p = P.generateEnglish(lv, r);
    if (p.form === 'word') { assert.equal(p.en, wordOf(p.wordId).en); assert.equal(p.pic, wordOf(p.wordId).pic); }
    else assert.equal(p.en, D.NUM_EN[p.n]);
    assert.match(p.ja, /^[ぁ-ゖー]+$/);
  }
});

test('英語性質6: 1回の出動は4問で、答えは重複しない（連続もしない）', () => {
  for (const lv of LV) {
    const r = rngOf(36);
    for (let i = 0; i < N; i++) {
      const qs = P.generateSession('english', lv, r);
      assert.equal(qs.length, 4);
      assert.equal(new Set(qs.map(q => q.answer)).size, 4, lv);
      assert.equal(qs.filter(q => q.form === 'word').length, lv === 'E1' ? 4 : 2, lv);   // E2・E3 は乗り物2問＋数2問
      for (let k = 1; k < 4; k++) assert.ok(!P.sameProblem(qs[k - 1], qs[k]));
      qs.forEach(q => assert.equal(q.level, lv));
    }
  }
});

test('英語性質6b: sameProblem は english の語・数で比べる（数が undefined 同士で一致しない）', () => {
  const a = P.buildEnglish('E2', 3, rngOf(1)), b = P.buildEnglish('E2', 1, rngOf(2));
  assert.equal(P.sameProblem(a, b), false);
  assert.equal(P.sameProblem(a, a), true);
  const w1 = P.buildEnglish('E1', 'fire', rngOf(1)), w2 = P.buildEnglish('E1', 'bus', rngOf(1));
  assert.equal(P.sameProblem(w1, w2), false);
  assert.equal(P.sameProblem(w1, w1), true);
  assert.equal(P.generateEnglish('E1', rngOf(5), 'fire').wordId !== 'fire', true);
  assert.equal(P.sameProblem(P.buildEnglish('E2', 'bus', rngOf(1)), a), false);   // 語と数は別の問題
});

test('英語性質7: 同じシードなら同じ結果', () => {
  for (const lv of LV) assert.deepEqual(P.generateSession('english', lv, rngOf(77)), P.generateSession('english', lv, rngOf(77)));
});

test('英語性質8: nextLevel(english) は規則どおり（上限 E3・下限 E1・固定時は不変・範囲外は端）', () => {
  const R = D.stageRange('S0', 'english');
  assert.deepEqual(R, LV);
  assert.equal(P.nextLevel('english', 'E1', 4, false, R), 'E2');
  assert.equal(P.nextLevel('english', 'E3', 4, false, R), 'E3');
  assert.equal(P.nextLevel('english', 'E1', 0, false, R), 'E1');
  assert.equal(P.nextLevel('english', 'E3', 1, false, R), 'E2');
  assert.equal(P.nextLevel('english', 'E2', 2, false, R), 'E2');
  assert.equal(P.nextLevel('english', 'E2', 4, true, R), 'E2');
  assert.equal(P.nextLevel('english', 'E2', 0, true, R), 'E2');
  assert.equal(P.nextLevel('english', 'E9', 4, false, R), 'E2');   // 不明な値は先頭扱い
});

test('英語性質9: 語彙表の整合（en は小文字の英字とスペース、絵が存在、group あり、14語・id 重複なし）', () => {
  assert.equal(D.ENGLISH_WORDS.length, 14);
  assert.equal(new Set(D.ENGLISH_WORDS.map(w => w.id)).size, 14);
  assert.ok(new Set(D.ENGLISH_WORDS.map(w => w.group)).size >= 3);   // E1 は3択なので group が3種以上
  for (const w of D.ENGLISH_WORDS) {
    assert.match(w.en, /^[a-z]+( [a-z]+)*$/, w.id);
    assert.match(w.ja, /^[ぁ-ゖー]+$/, w.id);
    assert.ok(V.hasPic(w.pic), '絵が無い: ' + w.id);
  }
  assert.deepEqual(D.NUM_EN.slice(1), ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']);
  D.NUM_EN.slice(1).forEach(e => assert.match(e, /^[a-z]+$/));
});

test('保存: english が無い旧データでは E1・未固定・stats 0。不正値は E1 に戻り、stats の負数・文字列は0', () => {
  const old = S.normalizeProfile({ version: 1, levels: { math: 'M3', letter: 'K2', clock: 'T2' }, locked: { clock: true }, stats: { sessions: 5, clock: { sessions: 2, questions: 8, firstTry: 5 } } });
  assert.equal(old.levels.english, 'E1');
  assert.equal(old.locked.english, false);
  assert.deepEqual(old.stats.english, { sessions: 0, questions: 0, firstTry: 0 });
  assert.equal(old.levels.clock, 'T2'); assert.equal(old.locked.clock, true);   // とけいと衝突しない
  assert.equal(S.normalizeProfile({ levels: { english: 'E9' } }).levels.english, 'E1');
  assert.equal(S.normalizeProfile({ levels: { english: 'K1' } }).levels.english, 'E1');
  const bad = S.normalizeProfile({ stats: { english: { sessions: -3, questions: 'x', firstTry: 2.7 } }, locked: { english: 'yes' } });
  assert.deepEqual(bad.stats.english, { sessions: 0, questions: 0, firstTry: 2 });
  assert.equal(bad.locked.english, false);
  for (const lv of LV) assert.equal(S.normalizeProfile({ levels: { english: lv }, locked: { english: true } }).levels.english, lv);
  assert.equal(S.normalizeProfile({ locked: { english: true } }).locked.english, true);
  assert.deepEqual(S.normalizeProfile(S.defaultProgress()), S.defaultProgress());
});

test('E1: 聞き分けにくい「〜 truck」同士（truck・fire truck・dump truck・garbage truck）を同じ問題に並べない', () => {
  const trucks = ['truck', 'fire', 'dump', 'garbage'];
  const r = rngOf(41);
  for (let i = 0; i < N; i++) {
    const p = P.generateEnglish('E1', r);
    assert.ok(p.choices.filter(c => trucks.includes(c)).length <= 1, JSON.stringify(p.choices));
  }
});

test('読み上げ用の表記 YOMI / CAR_YOMI は実在する語・車だけを指し、空でない', () => {
  for (const [id, y] of Object.entries(D.YOMI)) { assert.ok(D.WORDS.find(w => w.id === id), id); assert.ok(y.length > 0); }
  for (const [id, y] of Object.entries(D.CAR_YOMI)) { assert.ok(D.CARS.find(c => c.id === id), id); assert.ok(y.length > 0); }
  // 「はしご車」「ごみ収集車」などは端末の読み上げで「くるま」になる。しゃ と読まれることを確かめた語（救急車・消防車・電車・機関車）だけ漢字の「車」を使う
  for (const y of [...Object.values(D.YOMI), ...Object.values(D.CAR_YOMI)]) assert.ok(!/車/.test(y.replace(/救急車|消防車|電車|機関車/g, '')), y);
});

// ---- E4（いろ）・E5（アルファベットの大文字）。S1。design-elementary 3.8 ----
const clashed = (clash, a, b) => clash.some(p => (p[0] === a && p[1] === b) || (p[1] === a && p[0] === b));
const ENDS = (s) => s.map(q => q.answer);

test('E4 性質: 1000 問。選択肢は 4 つ・重複なし・正解ちょうど 1 つ・全部 COLORS の id・見分けにくい組が並ばない・どの色も答えになる', () => {
  const r = rngOf(91), seen = new Set(), ids = D.COLORS.map(c => c.id);
  for (let i = 0; i < N; i++) {
    const p = P.generateEnglish('E4', r);
    assert.equal(p.kind, 'english'); assert.equal(p.form, 'color'); assert.equal(p.level, 'E4');
    assert.equal(p.choices.length, 4);
    assert.equal(new Set(p.choices).size, 4);
    assert.equal(p.choices.filter(c => c === p.answer).length, 1);
    p.choices.forEach(c => assert.ok(ids.includes(c), c));
    for (const a of p.choices) for (const b of p.choices) assert.ok(a === b || !clashed(D.COLOR_CLASH, a, b), a + ' と ' + b);
    const col = D.COLORS.find(c => c.id === p.answer);
    assert.equal(p.en, col.en); assert.equal(p.hex, col.hex); assert.equal(p.colorId, p.answer);
    seen.add(p.answer);
  }
  assert.equal(seen.size, D.COLORS.length);
});

test('E4 データ: 色の id・英語・色コード（重複なし）。どの色が答えでも、並べてよい 4 色が残る', () => {
  assert.equal(new Set(D.COLORS.map(c => c.id)).size, D.COLORS.length);
  assert.equal(new Set(D.COLORS.map(c => c.hex)).size, D.COLORS.length);
  D.COLORS.forEach(c => { assert.ok(/^[a-z]+$/.test(c.en)); assert.ok(/^#[0-9a-f]{6}$/.test(c.hex)); assert.ok(/^[ぁ-ん]+$/.test(c.ja)); });
  for (const ans of D.COLORS) {
    const p = P.buildEnglish('E4', ans.id, rngOf(1));
    assert.equal(p.choices.length, 4, ans.id);
  }
});

test('E4 出動: 4 問で答えの色が重複しない。同じシードなら同じ', () => {
  const r = rngOf(92);
  for (let i = 0; i < N; i++) { const s = P.generateSession('english', 'E4', r); assert.equal(s.length, 4); assert.equal(new Set(ENDS(s)).size, 4); }
  assert.deepEqual(P.generateSession('english', 'E4', rngOf(3)), P.generateSession('english', 'E4', rngOf(3)));
});

test('E5 性質: 1000 問。選択肢は 4 つの大文字・重複なし・正解ちょうど 1 つ・正解は語の頭文字・似た形が並ばない・I L O を使わない', () => {
  const r = rngOf(93), seen = new Set();
  for (let i = 0; i < N; i++) {
    const p = P.generateEnglish('E5', r);
    const w = wordOf(p.wordId);
    assert.equal(p.kind, 'english'); assert.equal(p.form, 'alpha'); assert.equal(p.level, 'E5');
    assert.equal(p.choices.length, 4);
    assert.equal(new Set(p.choices).size, 4);
    assert.equal(p.choices.filter(c => c === p.answer).length, 1);
    assert.equal(p.answer, w.en[0].toUpperCase());
    assert.equal(p.letter, p.answer);
    assert.equal(p.en, p.answer + ', ' + w.en);
    assert.equal(p.pic, w.pic);
    p.choices.forEach(c => { assert.ok(/^[A-Z]$/.test(c)); assert.ok(!'ILO'.includes(c)); });
    for (const a of p.choices) for (const b of p.choices) assert.ok(a === b || !clashed(D.ALPHA_CLASH, a, b), a + ' と ' + b);
    seen.add(p.answer);
  }
  assert.equal(seen.size, new Set(D.ENGLISH_WORDS.map(w => w.en[0].toUpperCase())).size, '語彙の頭文字がすべて出る');
});

test('E5 出動: 4 問で頭文字が重複しない（F・A・P・D・B・G・T・H・S から）。同じシードなら同じ', () => {
  const r = rngOf(94);
  for (let i = 0; i < N; i++) {
    const s = P.generateSession('english', 'E5', r);
    assert.equal(s.length, 4);
    assert.equal(new Set(ENDS(s)).size, 4);
    assert.equal(new Set(s.map(q => q.wordId)).size, 4);
  }
  assert.deepEqual(P.generateSession('english', 'E5', rngOf(4)), P.generateSession('english', 'E5', rngOf(4)));
});

test('E4・E5: 英語の読み上げ文は英字・スペース・カンマだけ。E1〜E3 の出題は変わらない', () => {
  [['E4', 95], ['E5', 96]].forEach(([lv, seed]) => {
    const r = rngOf(seed);
    for (let i = 0; i < 100; i++) P.generateSession('english', lv, r).forEach(q => assert.ok(/^[A-Za-z, ]+$/.test(q.en), q.en));
  });
  for (const lv of ['E1', 'E2', 'E3']) P.generateSession('english', lv, rngOf(5)).forEach(q => assert.ok(q.form === 'word' || q.form === 'number'));
});

test('E4・E5: 昇降級は S1 の範囲（E4〜E5）で止まる。えいごは関門に入らない', () => {
  const R = D.stageRange('S1', 'english');
  assert.deepEqual(R, ['E4', 'E5']);
  assert.equal(P.nextLevel('english', 'E4', 4, false, R), 'E5');
  assert.equal(P.nextLevel('english', 'E5', 4, false, R), 'E5');
  assert.equal(P.nextLevel('english', 'E4', 0, false, R), 'E4');
  assert.equal(P.nextLevel('english', 'E5', 0, false, R), 'E4');
  assert.equal(D.gateOf('S1').english, undefined);
});

test('E4: 色ちがいの車の絵を描ける（同じ車・色だけ変わる）', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : (...a) => { calls.push(k); }), set: (_, k, v) => { if (k === 'fillStyle') calls.push('fill:' + v); return true; } });
  V.drawColorCar(ctx, 10, 10, 100, '#e53935');
  assert.ok(calls.includes('fill:#e53935'));
  assert.ok(calls.length > 20);
});
