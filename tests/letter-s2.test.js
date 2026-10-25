// K9（小2 の漢字を選ぶ）・T8（午前・午後）。design-elementary 3.8・3.11
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
// 学年別漢字配当表（小学2年・160 字／小学1年・80 字）を手で書いた表。K9 の字がすべて小2 に入り、小1 には入らないこと
const GRADE2 = '引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話';
const GRADE1 = '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六';

test('配当表の手書き（小2 は 160 字、小1 は 80 字）', () => {
  assert.equal(GRADE2.length, 160); assert.equal(new Set(GRADE2.split('')).size, 160);
  assert.equal(GRADE1.length, 80); assert.equal(new Set(GRADE1.split('')).size, 80);
});

test('K9 字表: 20 字・すべて小2 の配当（小1 ではない）・重複なし・読みはひらがな・読み上げ文に漢字なし・絵がある', () => {
  assert.equal(D.KANJI_WORDS2.length, 20);
  const chars = D.KANJI_WORDS2.map((w) => w.ch);
  assert.equal(new Set(chars).size, 20);
  assert.equal(new Set(D.KANJI_WORDS2.map((w) => w.yomi)).size, 20, '読みが重複しない');
  D.KANJI_WORDS2.forEach((w) => {
    assert.equal(w.ch.length, 1);
    assert.ok(GRADE2.includes(w.ch), w.ch + ' は小2 の配当ではない');
    assert.ok(!GRADE1.includes(w.ch), w.ch + ' は小1 の字（K8 側）');
    assert.ok(HIRA.test(w.yomi), w.yomi);
    assert.ok(HIRA.test(w.speech.replace(/[。 ]/g, '')), w.speech);
    assert.ok(!KANJI_RE.test(w.speech), '読み上げ文に漢字を使わない: ' + w.speech);
    assert.ok(w.speech.startsWith(w.yomi), w.speech);
    assert.ok(V.hasPic(w.pic), w.pic);
  });
  // 絵は 船 だけが K7 と同じ ship。ほかは K9 専用で重複しない
  assert.equal(new Set(D.KANJI_WORDS2.map((w) => w.pic)).size, 20);
  D.KANJI_WORDS2.forEach((w) => assert.ok(!D.KANJI_WORDS.some((k) => k.ch === w.ch), 'K8 と字が重ならない'));
  // 読みが揺れる字（光・家・分・時・行・長・後・前・午）は入れない
  '光家分時行長後前午'.split('').forEach((c) => assert.ok(!chars.includes(c), c));
  assert.deepEqual(D.KANJI.S2, chars, 'KANJI.S2 は K9 の教材の字');
  assert.deepEqual(D.allowedKanji('S2'), D.KANJI.S1.concat(chars), 'S2 のふりがなは K8 + K9');
  assert.deepEqual(D.allowedKanji('S1'), D.KANJI.S1, 'S1 は K8 のまま');
  assert.deepEqual(D.allowedKanji('S0'), [], 'S0 はひらがなのみ');
});

test('K9 性質: 1000 問。正解ちょうど 1・重複なし・4 択・全部 K9 の字・形が似た字（sim）を同じ選択肢に並べない。K8 の字は出ない', () => {
  const r = rngOf(91), set = new Set(D.KANJI.S2), sim = {};
  D.KANJI_WORDS2.forEach((w) => { sim[w.ch] = w.sim; });
  const seen = new Set();
  for (let i = 0; i < N; i++) {
    const p = P.generateLetter('K9', r);
    const w = D.KANJI_WORDS2.filter((x) => x.ch === p.answer)[0];
    assert.equal(p.kind, 'letter'); assert.equal(p.level, 'K9'); assert.equal(p.script, 'kanji');
    assert.equal(p.choices.length, 4);
    assert.equal(new Set(p.choices).size, 4);
    assert.equal(p.choices.filter((c) => c === p.answer).length, 1);
    p.choices.forEach((c) => { assert.ok(set.has(c), c); assert.ok(GRADE2.includes(c)); });
    const groups = p.choices.map((c) => sim[c]).filter(Boolean);
    assert.equal(new Set(groups).size, groups.length, '似た字が並ぶ: ' + p.choices.join(''));
    assert.equal(p.pic, w.pic); assert.equal(p.yomi, w.yomi); assert.equal(p.speech, w.speech);
    seen.add(p.answer);
  }
  assert.equal(seen.size, 20, '20 字すべてが出る');
});

test('K9 出動: 4 問で字も絵も重複しない。同じシードなら同じ。前の語は避けられる。昇降級は S2 の範囲（K9 だけ）で止まる', () => {
  const r = rngOf(92);
  for (let i = 0; i < N; i++) {
    const s = P.generateSession('letter', 'K9', r);
    assert.equal(s.length, 4);
    assert.equal(new Set(s.map((q) => q.answer)).size, 4);
    assert.equal(new Set(s.map((q) => q.pic)).size, 4);
  }
  assert.deepEqual(P.generateSession('letter', 'K9', rngOf(9)), P.generateSession('letter', 'K9', rngOf(9)));
  for (let i = 0; i < 100; i++) assert.notEqual(P.generateLetter('K9', rngOf(i), 'kanji_朝').answer, '朝');
  const R = D.stageRange('S2', 'letter');
  assert.deepEqual(R, ['K9']);
  assert.equal(P.nextLevel('letter', 'K9', 4, false, R), 'K9');
  assert.equal(P.nextLevel('letter', 'K9', 0, false, R), 'K9');
});

test('K8 は変わらない: K8 の問題は K8 の 20 字だけで、K9 の字は混ざらない', () => {
  const k8 = new Set(D.KANJI.S1), r = rngOf(93);
  for (let i = 0; i < 300; i++) P.generateSession('letter', 'K8', r).forEach((q) => q.choices.forEach((c) => assert.ok(k8.has(c))));
});

// ---- T8: 午前・午後 ----
test('T8 場面の表: 朝は午前、夕方・夜は午後。昼の空（午前にも午後にもなる絵）は出さない。時刻はちょうど・はん', () => {
  const C = D.AMPM_CASES;
  assert.ok(C.length >= 20);
  C.forEach((c) => {
    assert.ok(['am', 'pm'].includes(c.ap));
    assert.ok([0, 30].includes(c.m));
    if (c.scene === 'morning') { assert.equal(c.ap, 'am'); assert.ok(c.h >= 6 && c.h <= 9); }
    else if (c.scene === 'evening') { assert.equal(c.ap, 'pm'); assert.ok(c.h >= 4 && c.h <= 6); }
    else if (c.scene === 'night') { assert.equal(c.ap, 'pm'); assert.ok(c.h >= 7 && c.h <= 10); }
    else assert.fail('場面 ' + c.scene);
  });
  assert.deepEqual(D.AMPM_LABEL, { am: 'ごぜん', pm: 'ごご' });
  assert.equal(new Set(C.map((c) => c.h + ':' + c.m + c.ap)).size, C.length);
});

test('T8 性質: 1000 問。選択肢は ごぜん・ごご の 2 つで正解がちょうど 1 つ。答えは場面と一致。午前・午後が両方出る', () => {
  const r = rngOf(81), ap = { am: 0, pm: 0 };
  for (let i = 0; i < N; i++) {
    const p = P.generateClock('T8', r);
    assert.equal(p.kind, 'clock'); assert.equal(p.form, 'ampm'); assert.equal(p.level, 'T8');
    assert.deepEqual(p.choices, ['am', 'pm']);
    assert.equal(p.choices.filter((c) => c === p.answer).length, 1);
    const c = D.AMPM_CASES.filter((x) => x.h === p.h && x.m === p.m && x.scene === p.scene)[0];
    assert.ok(c, '場面の表にある時刻');
    assert.equal(p.answer, c.ap, '正解は場面と一致'); assert.equal(p.ap, c.ap);
    ap[p.ap]++;
  }
  assert.ok(ap.am > 300 && ap.pm > 300, JSON.stringify(ap));
});

test('T8 出動: 4 問は 午前 2・午後 2。同じ問題・同じ時刻が続かない。同じシードなら同じ。昇降級は S2 の範囲（T8 だけ）で止まる', () => {
  const r = rngOf(82);
  for (let i = 0; i < N; i++) {
    const s = P.generateSession('clock', 'T8', r);
    assert.equal(s.length, 4);
    assert.equal(s.filter((q) => q.ap === 'am').length, 2);
    assert.equal(s.filter((q) => q.ap === 'pm').length, 2);
    for (let k = 0; k < 4; k++) for (let j = k + 1; j < 4; j++) assert.ok(!P.sameProblem(s[k], s[j]));
    for (let k = 1; k < 4; k++) assert.ok(s[k - 1].h !== s[k].h || s[k - 1].m !== s[k].m, '同じ時刻が続かない');
  }
  assert.deepEqual(P.generateSession('clock', 'T8', rngOf(5)), P.generateSession('clock', 'T8', rngOf(5)));
  const R = D.stageRange('S2', 'clock');
  assert.deepEqual(R, ['T8']);
  assert.equal(P.nextLevel('clock', 'T8', 4, false, R), 'T8');
  assert.equal(P.nextLevel('clock', 'T8', 0, false, R), 'T8');
});

test('T8: 午前の同じ時刻と午後の同じ時刻は別の問題。読み上げ用の時刻の読み（readTime）が引ける', () => {
  const a = { kind: 'clock', form: 'ampm', h: 7, m: 0, ap: 'am' }, b = { kind: 'clock', form: 'ampm', h: 7, m: 0, ap: 'pm' };
  assert.equal(P.sameProblem(a, b), false);
  assert.equal(P.sameProblem(a, Object.assign({}, a)), true);
  D.AMPM_CASES.forEach((c) => assert.match(P.readTime(c.h, c.m), /^[ぁ-ゖー]+$/));
});
