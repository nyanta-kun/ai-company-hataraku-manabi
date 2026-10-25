// K7（拗音の最初の音）・K8（漢字を選ぶ）。design-elementary 3.8
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/data.js');
const P = require('../src/problems.js');
require('../src/vehicles.js');
const V = globalThis.Manabi.vehicles;
const { rngOf } = require('./helpers.js');

const N = 1000;
const HIRA = /^[ぁ-ゖー]+$/;
const KANJI_RE = /[一-鿿々]/;
// 学年別漢字配当表（小学1年・80 字）を手で書いた表。K8 の字がすべてここに入ること
const GRADE1 = '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六';

test('配当表の手書き（小1 は 80 字）', () => {
  assert.equal(new Set(GRADE1.split('')).size, 80);
});

test('K7 語表: 拗音始まり（plan U1 の 4 語を含む）。語はひらがなだけで、頭が head と一致し、絵がある', () => {
  const labels = D.YOUON_WORDS.map((w) => w.label);
  ['しょうぼうしゃ', 'きゅうきゅうしゃ', 'ちょうだいはしごしゃ', 'しょべるかー'].forEach((l) => assert.ok(labels.includes(l), l));
  assert.equal(new Set(D.YOUON_WORDS.map((w) => w.id)).size, D.YOUON_WORDS.length);
  D.YOUON_WORDS.forEach((w) => {
    assert.ok(HIRA.test(w.label), w.label);
    assert.ok(/^[きしちにひみりぎじび][ゃゅょ]$/.test(w.head), w.head);
    assert.ok(w.label.startsWith(w.head), w.label);
    assert.ok(V.hasPic(w.pic), w.pic);
  });
  assert.ok(new Set(D.YOUON_WORDS.map((w) => w.head)).size >= 6, '答えの音が 6 種類以上');
});

test('K7 性質: 1000 問。正解ちょうど 1・重複なし・4 択。正解は語の先頭 2 文字。誤答は 大きい字・同じ子音の別の拗音・別の行', () => {
  const r = rngOf(81);
  for (let i = 0; i < N; i++) {
    const p = P.generateLetter('K7', r);
    const w = D.YOUON_WORDS.filter((x) => x.id === p.wordId)[0];
    assert.equal(p.kind, 'letter'); assert.equal(p.level, 'K7');
    assert.equal(p.choices.length, 4);
    assert.equal(new Set(p.choices).size, 4);
    assert.equal(p.choices.filter((c) => c === p.answer).length, 1);
    assert.equal(p.answer, w.head);
    assert.ok(p.word.startsWith(p.answer));
    assert.equal(p.pic, w.pic);
    const cons = p.answer[0], small = p.answer[1], bigOf = { 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ' };
    const wrong = p.choices.filter((c) => c !== p.answer);
    assert.ok(wrong.includes(cons + bigOf[small]), '大きい字の誤答');
    assert.equal(wrong.filter((c) => c[0] === cons && 'ゃゅょ'.includes(c[1])).length, 1, '同じ子音の別の拗音が 1 つ');
    assert.equal(wrong.filter((c) => c[0] !== cons && c[1] === small).length, 1, '別の行の同じ拗音が 1 つ');
  }
});

test('K7 出動: 4 問で絵も答えも重複しない。同じシードなら同じ。S1 の範囲（K7・K8）', () => {
  const r = rngOf(82);
  for (let i = 0; i < N; i++) {
    const s = P.generateSession('letter', 'K7', r);
    assert.equal(s.length, 4);
    assert.equal(new Set(s.map((q) => q.pic)).size, 4);
    assert.equal(new Set(s.map((q) => q.answer)).size, 4);
    assert.equal(new Set(s.map((q) => q.wordId)).size, 4);
  }
  assert.deepEqual(P.generateSession('letter', 'K7', rngOf(7)), P.generateSession('letter', 'K7', rngOf(7)));
  assert.deepEqual(D.stageRange('S1', 'letter'), ['K7', 'K8']);
});

test('K8 字表: 20 字・小1 の配当・重複なし・読みはひらがな・読み上げ文に漢字なし・絵がある', () => {
  assert.equal(D.KANJI_WORDS.length, 20);
  const chars = D.KANJI_WORDS.map((w) => w.ch);
  assert.equal(new Set(chars).size, 20);
  assert.equal(new Set(D.KANJI_WORDS.map((w) => w.yomi)).size, 20, '読みが重複しない（日と火のような組を入れない）');
  assert.equal(new Set(D.KANJI_WORDS.map((w) => w.pic)).size, 20);
  D.KANJI_WORDS.forEach((w) => {
    assert.equal(w.ch.length, 1);
    assert.ok(GRADE1.includes(w.ch), w.ch + ' は小1 の配当ではない');
    assert.ok(HIRA.test(w.yomi), w.yomi);
    assert.ok(HIRA.test(w.speech.replace(/[。 ]/g, '')), w.speech);
    assert.ok(!KANJI_RE.test(w.speech), '読み上げ文に漢字を使わない: ' + w.speech);
    assert.ok(w.speech.startsWith(w.yomi), w.speech);
    assert.ok(V.hasPic(w.pic), w.pic);
  });
  assert.deepEqual(D.KANJI.S1, chars, 'KANJI.S1 は K8 の教材の字');
});

test('K8 性質: 1000 問。正解ちょうど 1・重複なし・4 択・全部 K8 の字・形が似た字（sim）を同じ選択肢に並べない', () => {
  const r = rngOf(83), set = new Set(D.KANJI.S1), sim = {};
  D.KANJI_WORDS.forEach((w) => { sim[w.ch] = w.sim; });
  const seen = new Set();
  for (let i = 0; i < N; i++) {
    const p = P.generateLetter('K8', r);
    const w = D.KANJI_WORDS.filter((x) => x.ch === p.answer)[0];
    assert.equal(p.kind, 'letter'); assert.equal(p.level, 'K8');
    assert.equal(p.choices.length, 4);
    assert.equal(new Set(p.choices).size, 4);
    assert.equal(p.choices.filter((c) => c === p.answer).length, 1);
    p.choices.forEach((c) => assert.ok(set.has(c), c));
    const groups = p.choices.map((c) => sim[c]).filter(Boolean);
    assert.equal(new Set(groups).size, groups.length, '似た字が並ぶ: ' + p.choices.join(''));
    assert.equal(p.pic, w.pic); assert.equal(p.yomi, w.yomi); assert.equal(p.speech, w.speech);
    seen.add(p.answer);
  }
  assert.equal(seen.size, 20, '20 字すべてが出る');
});

test('K8 出動: 4 問で字も絵も重複しない。同じシードなら同じ。誤答の字は答えにならない', () => {
  const r = rngOf(84);
  for (let i = 0; i < N; i++) {
    const s = P.generateSession('letter', 'K8', r);
    assert.equal(s.length, 4);
    assert.equal(new Set(s.map((q) => q.answer)).size, 4);
    assert.equal(new Set(s.map((q) => q.pic)).size, 4);
  }
  assert.deepEqual(P.generateSession('letter', 'K8', rngOf(9)), P.generateSession('letter', 'K8', rngOf(9)));
});

test('K7・K8: 前の語は避けられる（generateLetter の prevWordId）。範囲外のレベルは RangeError', () => {
  for (let i = 0; i < 100; i++) {
    const p = P.generateLetter('K7', rngOf(i), 'kyukyu');
    assert.notEqual(p.wordId, 'kyukyu');
    assert.notEqual(P.generateLetter('K8', rngOf(i), 'kanji_火').answer, '火');
  }
  assert.throws(() => P.generateLetter('K99', rngOf(1)), RangeError);
});

test('K7・K8: 昇降級は S1 の範囲（K7〜K8）で止まる', () => {
  const R = D.stageRange('S1', 'letter');
  assert.equal(P.nextLevel('letter', 'K7', 4, false, R), 'K8');
  assert.equal(P.nextLevel('letter', 'K8', 4, false, R), 'K8');
  assert.equal(P.nextLevel('letter', 'K7', 0, false, R), 'K7');
  assert.equal(P.nextLevel('letter', 'K8', 0, false, R), 'K7');
  assert.equal(P.nextLevel('letter', 'K8', 4, true, R), 'K8');
});

test('S0 の国語は変わらない: K1〜K6 の出題は 同じシードで K7・K8 を足す前と同じ性質（wordPool に K7・K8 が混ざらない）', () => {
  ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'].forEach((lv) => {
    const r = rngOf(85);
    for (let i = 0; i < 100; i++) P.generateSession('letter', lv, r, []).forEach((q) => {
      assert.ok(!/^kanji_/.test(q.wordId));
      assert.ok(!D.YOUON_WORDS.some((w) => w.id === q.wordId));
      assert.equal(q.answer.length, 1);
    });
  });
});
