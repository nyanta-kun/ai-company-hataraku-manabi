// 国語（ひらがな）の単語表の拡充と、出題の偏り防止（plan-katakana-english.md 2.3・2.5 の性質 10〜14）
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/problems.js');
const D = require('../src/data.js');
require('../src/vehicles.js');
const V = globalThis.Manabi.vehicles;
const { rngOf } = require('./helpers.js');

const LV = ['K1', 'K2', 'K3'];
const pool = lv => D.WORDS.filter(w => lv !== 'K1' || w.group === 'A');
const wordOf = id => D.WORDS.find(w => w.id === id);

test('性質10: 単語表の整合（31語・頭文字26種・A群14語・絵が存在・分類が定義済み）', () => {
  assert.equal(D.WORDS.length, 31);
  assert.equal(new Set(D.WORDS.map(w => w.head)).size, 26);
  assert.equal(new Set(D.WORDS.map(w => w.id)).size, 31);
  assert.equal(D.WORDS.filter(w => w.group === 'A').length, 14);
  assert.equal(D.WORDS.filter(w => w.kata).length, 17);
  for (const w of D.WORDS) {
    assert.equal(w.label[0], w.head, w.id);
    assert.ok(!'ゃゅょぁぃぅぇぉっんー'.includes(w.head), w.id);
    assert.match(w.speech, /^[ぁ-ゖー]+$/, w.id);      // 読み上げはひらがな（長音符可）
    assert.match(w.example, /^[ぁ-ゖー]+$/, w.id);
    assert.ok(w.example[0] === w.head, w.id);          // 「{例語}の {もじ}」の例語は、その文字で始まる
    assert.ok(D.CATS.includes(w.cat), w.id);
    assert.ok(V.hasPic(w.pic), '絵が無い: ' + w.id + ' ' + w.pic);
    assert.ok(D.ROW[w.head] && D.FAMILY[w.head], '行が無い: ' + w.head);
  }
  assert.equal(D.WORDS.filter(w => w.cat === 'fire').length, 11);
});

test('性質10b: 選択肢の文字は全て ROW を持ち、読み上げの例語がある', () => {
  const heads = new Set(D.WORDS.map(w => w.head));
  for (const lv of LV) {
    const r = rngOf(10);
    for (let i = 0; i < 300; i++) for (const p of P.generateSession('letter', lv, r)) for (const c of p.choices) {
      assert.ok(heads.has(c) && D.ROW[c]);
      assert.ok(D.WORDS.some(w => w.head === c && w.example), c);
    }
  }
});

test('性質10c: K1/K2 は清音と濁音・半濁音（は–ば・は–ぱ 等）や は行の文字を同じ選択肢に並べない。K3 は似た文字を最大1つ', () => {
  const clash = (a, b) => D.CONFUSABLE.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
  for (const pair of [['は', 'ば'], ['は', 'ぱ'], ['ほ', 'ぽ'], ['ふ', 'ぶ'], ['た', 'だ'], ['ひ', 'び'], ['へ', 'べ'], ['か', 'が']]) {
    assert.ok(clash(pair[0], pair[1]), pair.join('–'));
  }
  for (const lv of LV) {
    const r = rngOf(15);
    for (let i = 0; i < 1500; i++) {
      const p = P.generateSession('letter', lv, r)[i % 4];
      assert.equal(p.choices.filter(c => c === p.answer).length, 1);
      assert.equal(new Set(p.choices).size, p.choices.length);
      const pairs = [];
      p.choices.forEach((a, x) => p.choices.forEach((b, y) => { if (x < y && clash(a, b)) pairs.push([a, b]); }));
      if (lv === 'K3') {
        assert.ok(pairs.length <= 1, lv + ' ' + p.choices);
        pairs.forEach(q => assert.ok(q.includes(p.answer), '似た組は正解との組だけ: ' + p.choices));
      } else {
        assert.equal(pairs.length, 0, lv + ' ' + p.choices);
        const fams = p.choices.map(c => D.FAMILY[c]);
        assert.equal(new Set(fams).size, fams.length, lv + ' 同じ行ファミリー ' + p.choices);
      }
    }
  }
});

test('性質11: 同一出動で wordId・pic・答えが重複せず、同じ行ファミリー（は行を含む）は2問まで（緩和なし）', () => {
  for (const lv of LV) {
    const r = rngOf(11);
    for (let i = 0; i < 1500; i++) {
      const s = P.generateSession('letter', lv, r);
      assert.equal(s.length, 4);
      assert.equal(new Set(s.map(p => p.wordId)).size, 4, lv);
      assert.equal(new Set(s.map(p => p.pic)).size, 4, lv);
      assert.equal(new Set(s.map(p => p.answer)).size, 4, lv);
      const fam = {};
      s.forEach(p => { const f = D.FAMILY[p.answer]; fam[f] = (fam[f] || 0) + 1; });
      Object.keys(fam).forEach(f => assert.ok(fam[f] <= 2, lv + ' ' + f));
    }
  }
});

test('性質12: recentPics の直近の絵は出ない。足りなければ古い順に解禁し、壊れた入力でも落ちない', () => {
  for (const lv of LV) {
    const r = rngOf(12);
    const ps = pool(lv).map(w => w.pic);
    const n = Math.max(4, Math.min(12, Math.floor(ps.length / 2)));
    for (let i = 0; i < 500; i++) {
      const recent = ps.slice().sort(() => r() - 0.5).slice(0, n);
      const s = P.generateSession('letter', lv, r, recent);
      assert.equal(s.length, 4);
      // 直前の出動の4枚（recent の末尾4つ）は必ず除外される。それより古い分は、規則を満たすためだけに解禁されうる
      for (const p of s) assert.ok(!recent.slice(-4).includes(p.pic), lv + ' ' + p.pic);
    }
    // 除外が多すぎる（全部）でも、空にならず4問出る
    const s = P.generateSession('letter', lv, rngOf(1), ps.concat(ps));
    assert.equal(s.length, 4);
    assert.equal(new Set(s.map(p => p.wordId)).size, 4);
    // 一番新しい絵（末尾）は、除外を緩めても最後まで除外される
    const last = ps[0];
    for (let i = 0; i < 200; i++) assert.ok(!P.generateSession('letter', lv, r, ps.slice(1).concat(last)).some(p => p.pic === last));
  }
  for (const bad of [undefined, null, 'x', 5, {}, [1, null, 'nope', {}, 'v6', 'v6', undefined], new Array(50).fill('v1')]) {
    for (const lv of LV) assert.equal(P.generateSession('letter', lv, rngOf(3), bad).length, 4);
  }
});

test('性質13: 連続200出動で全語が出て偏りが小さく、連続する出動で同じ絵が出ない', () => {
  for (const lv of LV) {
    const r = rngOf(13);
    let recent = [], prevPics = null;
    const count = {};
    pool(lv).forEach(w => { count[w.id] = 0; });
    for (let i = 0; i < 200; i++) {
      const s = P.generateSession('letter', lv, r, recent);
      s.forEach(p => { count[p.wordId]++; });
      const pics = s.map(p => p.pic);
      if (prevPics) pics.forEach(x => assert.ok(!prevPics.includes(x), lv + ' 連続 ' + x));
      prevPics = pics;
      recent = recent.concat(pics).slice(-D.SEEN_MAX);
    }
    const vals = Object.values(count);
    assert.ok(Math.min(...vals) > 0, lv + ' 出ない語がある');
    assert.ok(Math.max(...vals) / Math.min(...vals) <= 4, lv + ' 偏り ' + Math.max(...vals) + '/' + Math.min(...vals));
  }
});

test('性質14: 同じ分類は3問まで。K3 は消防と乗り物が1問ずつ以上', () => {
  for (const lv of LV) {
    const r = rngOf(14);
    let recent = [];
    for (let i = 0; i < 1500; i++) {
      const s = P.generateSession('letter', lv, r, i % 2 ? recent : []);
      const cats = {};
      s.forEach(p => { const c = wordOf(p.wordId).cat; cats[c] = (cats[c] || 0) + 1; });
      Object.values(cats).forEach(n => assert.ok(n <= 3, lv));
      if (lv === 'K3') {
        assert.ok(s.some(p => wordOf(p.wordId).cat === 'fire'), 'K3 消防');
        assert.ok(s.some(p => wordOf(p.wordId).cat !== 'fire'), 'K3 乗り物');
      }
      recent = recent.concat(s.map(p => p.pic)).slice(-D.SEEN_MAX);
    }
  }
});

test('出題は同じシード・同じ recentPics なら同じ結果で、recentPics を書き換えない', () => {
  const recent = ['v10', 'airplane', 'bus'], copy = recent.slice();
  assert.deepEqual(P.generateSession('letter', 'K3', rngOf(9), recent), P.generateSession('letter', 'K3', rngOf(9), recent));
  assert.deepEqual(recent, copy);
});
