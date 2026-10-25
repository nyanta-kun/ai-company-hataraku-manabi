// ふりがな（design-elementary 3.7）。S0 では漢字が一切出ない・S1 の漢字は KANJI.S1 だけで読みつき・読みはひらがなのみ
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/data.js');

const KANJI_RE = /[一-鿿々]/;
const HIRA = /^[ぁ-ゖー]+$/;
const MARK = /\{([^{}|]+)\|([^{}|]+)\}/g;

test('furigana: 書き方 {漢字|よみ} を、allowed に入る字はふりがなつき、入らない字は読みのひらがなにする', () => {
  assert.deepEqual(D.furigana('あたらしい {車|くるま}！', ['車']), [{ t: 'あたらしい ' }, { t: '車', r: 'くるま' }, { t: '！' }]);
  assert.deepEqual(D.furigana('あたらしい {車|くるま}！', []), [{ t: 'あたらしい くるま！' }]);
  assert.deepEqual(D.furigana('{火|ひ}と{水|みず}', '火'), [{ t: '火', r: 'ひ' }, { t: 'とみず' }]);
  assert.deepEqual(D.furigana('{出動|しゅつどう}', ['出']), [{ t: 'しゅつどう' }], '熟語は 1 字でも許されていなければ全部ひらがな');
  assert.deepEqual(D.furigana('{出動|しゅつどう}', ['出', '動']), [{ t: '出動', r: 'しゅつどう' }]);
  assert.deepEqual(D.furigana('', ['車']), []);
  assert.deepEqual(D.furigana('ひらがなだけ', ['車']), [{ t: 'ひらがなだけ' }]);
});

test('furigana: 文言の表（TEXT）は { } の外に漢字が無く、読みはひらがなだけ', () => {
  Object.keys(D.TEXT).forEach((k) => {
    const m = D.TEXT[k];
    assert.ok(!KANJI_RE.test(m.replace(MARK, '')), k + ': { } の外に漢字');
    let n = 0;
    m.replace(MARK, (_, kj, yomi) => { n++; assert.ok(HIRA.test(yomi), k + ': 読み ' + yomi); assert.ok(KANJI_RE.test(kj)); return ''; });
    assert.ok(n >= 1, k + ' に漢字がある');
  });
});

test('furigana: S0（allowed が空）では TEXT の全文言に漢字が一切出ない。ひらがな・かなの記号だけ', () => {
  const S0 = D.allowedKanji('S0');
  assert.deepEqual(S0, []);
  Object.keys(D.TEXT).forEach((k) => {
    const segs = D.furigana(D.TEXT[k], S0);
    segs.forEach((g) => { assert.equal(g.r, undefined); assert.ok(!KANJI_RE.test(g.t), k + ': ' + g.t); });
  });
  // 今までの S0 の文言と同じ文字列になる（S0 の子の画面は変わらない）
  assert.equal(D.furigana(D.TEXT.rewardNew, S0).map((g) => g.t).join(''), 'あたらしい くるま！');
});

test('furigana: S1 では漢字は KANJI.S1 の字だけで、すべて読みがつく', () => {
  const S1 = D.allowedKanji('S1');
  assert.deepEqual(S1, D.KANJI.S1);
  Object.keys(D.TEXT).forEach((k) => {
    D.furigana(D.TEXT[k], S1).forEach((g) => {
      if (KANJI_RE.test(g.t)) {
        assert.ok(g.t.split('').every((c) => D.KANJI.S1.includes(c)), k + ': ' + g.t + ' は K8 の字ではない');
        assert.ok(g.r && HIRA.test(g.r), k + ': ' + g.t + ' に読みが無い');
      } else assert.equal(g.r, undefined);
    });
  });
});

test('furigana: 読みを付けた文字列からひらがなを復元すると、S0 の文字列と一致する（読みの取りちがいがない）', () => {
  Object.keys(D.TEXT).forEach((k) => {
    const s0 = D.furigana(D.TEXT[k], []).map((g) => g.t).join('');
    const s1 = D.furigana(D.TEXT[k], D.KANJI.S1).map((g) => g.r || g.t).join('');
    assert.equal(s1, s0, k);
  });
});

test('furigana: KANJI の定義（S0 は空、S1 は K8 の 20 字、S2 は K9 の 20 字、未知のステージは落ちない）', () => {
  assert.deepEqual(D.KANJI.S0, []);
  assert.equal(D.KANJI.S1.length, 20);
  assert.equal(D.KANJI.S2.length, 20);
  assert.equal(new Set(D.KANJI.S1.concat(D.KANJI.S2)).size, 40, 'K8 と K9 の字は重ならない');
  assert.deepEqual(D.allowedKanji('S9'), []);
});

test('furigana S2: S2 では漢字は K8 + K9 の字だけで、すべて読みがつく。K9 の字は S2 でだけ読みつきで出る（S0 は全部ひらがな、S1 は K8 の字だけ）', () => {
  const S2 = D.allowedKanji('S2'), S1 = D.allowedKanji('S1'), S0 = D.allowedKanji('S0');
  assert.deepEqual(S2, D.KANJI.S1.concat(D.KANJI.S2));
  const k9used = new Set();
  Object.keys(D.TEXT).forEach((k) => {
    D.furigana(D.TEXT[k], S2).forEach((g) => {
      if (KANJI_RE.test(g.t)) {
        assert.ok(g.t.split('').every((c) => S2.includes(c)), k + ': ' + g.t + ' は K8・K9 の字ではない');
        assert.ok(g.r && HIRA.test(g.r), k + ': ' + g.t + ' に読みが無い');
        g.t.split('').forEach((c) => { if (D.KANJI.S2.includes(c)) k9used.add(c); });
      } else assert.equal(g.r, undefined);
    });
    // S1 では K9 の字は出ない（読みのひらがなになる）
    D.furigana(D.TEXT[k], S1).forEach((g) => g.t.split('').forEach((c) => assert.ok(!D.KANJI.S2.includes(c), k + ': S1 に K9 の字 ' + c)));
    // S0 は全部ひらがな
    D.furigana(D.TEXT[k], S0).forEach((g) => { assert.equal(g.r, undefined); assert.ok(!KANJI_RE.test(g.t)); });
    // 読みを復元すると S0 の文字列と一致
    assert.equal(D.furigana(D.TEXT[k], S2).map((g) => g.r || g.t).join(''), D.furigana(D.TEXT[k], []).map((g) => g.t).join(''), k);
  });
  assert.ok(k9used.size >= 2, 'S2 の画面で K9 の字が読みつきで出る（出動えらびの一行）: ' + [...k9used].join(''));
  // S1 の文言（pickSub・rewardNew）は S1 でそのまま（K8 の字だけ）。S2 用の一行は別
  assert.equal(D.furigana(D.TEXT.pickSub, S1).filter((g) => g.r).map((g) => g.t).join(''), '火車');
  assert.ok(D.furigana(D.TEXT.pickSub2, S2).filter((g) => g.r).map((g) => g.t).join('').includes('朝'));
});
