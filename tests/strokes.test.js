const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { STROKES, SETS } = require('../src/strokes.js');

// 画数の期待値。KanjiVG から作ったものではなく、小1 国語の筆順表にある字ごとの画数を人が打ったもの（design-tracing 2.4-1）
const HIRA_COUNTS = {
  あ: 3, い: 2, う: 2, え: 2, お: 3,
  か: 3, き: 4, く: 1, け: 3, こ: 2,
  さ: 3, し: 1, す: 2, せ: 3, そ: 1,
  た: 4, ち: 2, つ: 1, て: 1, と: 2,
  な: 4, に: 3, ぬ: 2, ね: 2, の: 1,
  は: 3, ひ: 1, ふ: 4, へ: 1, ほ: 4,
  ま: 3, み: 2, む: 3, め: 2, も: 3,
  や: 3, ゆ: 2, よ: 2, ら: 2, り: 2,
  る: 1, れ: 2, ろ: 1, わ: 2, を: 3,
  ん: 1
};
// カタカナの画数（小1 国語の筆順表にある字ごとの画数を人が打ったもの）
const KATA_COUNTS = {
  ア: 2, イ: 2, ウ: 3, エ: 3, オ: 3,
  カ: 2, キ: 3, ク: 2, ケ: 3, コ: 2,
  サ: 3, シ: 3, ス: 2, セ: 2, ソ: 2,
  タ: 3, チ: 3, ツ: 3, テ: 3, ト: 2,
  ナ: 2, ニ: 2, ヌ: 2, ネ: 4, ノ: 1,
  ハ: 2, ヒ: 2, フ: 1, ヘ: 1, ホ: 4,
  マ: 2, ミ: 3, ム: 2, メ: 2, モ: 3,
  ヤ: 2, ユ: 2, ヨ: 3, ラ: 2, リ: 2,
  ル: 2, レ: 1, ロ: 3, ワ: 2, ヲ: 3,
  ン: 2
};
const ALL = SETS.hira + SETS.kata;
const first = (ch, i) => { const s = STROKES[ch].s[i]; return [s[0], s[1]]; };
const last = (ch, i) => { const s = STROKES[ch].s[i]; return [s[s.length - 2], s[s.length - 1]]; };

test('SETS.hira は 46 字で重複なし（ゐ・ゑは無い）、すべて STROKES にある', () => {
  const hira = [...SETS.hira];
  assert.equal(hira.length, 46);
  assert.equal(new Set(hira).size, 46);
  assert.ok(!hira.includes('ゐ') && !hira.includes('ゑ'));
  hira.forEach(c => assert.ok(STROKES[c], c));
  assert.deepEqual(Object.keys(STROKES).sort(), [...ALL].sort());
});

test('SETS.kata は 46 字で重複なし（ヰ・ヱは無い）、順番は画数の少ない順（シ・ツ、ソ・ン は続く）', () => {
  const kata = [...SETS.kata];
  assert.equal(kata.length, 46);
  assert.equal(new Set(kata).size, 46);
  assert.ok(!kata.includes('ヰ') && !kata.includes('ヱ'));
  assert.deepEqual(Object.keys(KATA_COUNTS).sort(), kata.slice().sort());
  const counts = kata.map(c => KATA_COUNTS[c]);
  assert.deepEqual(counts, counts.slice().sort((a, b) => a - b), '画数の少ない順');
  assert.equal(kata.indexOf('ツ'), kata.indexOf('シ') + 1);
  assert.equal(kata.indexOf('ン'), kata.indexOf('ソ') + 1);
  // 企画 2.4 の分け方: 1画 ノフヘレ、4画 ネホ
  assert.equal(kata.slice(0, 4).join(''), 'ノフヘレ');
  assert.equal(kata.slice(-2).join(''), 'ネホ');
});

test('カタカナの画数が筆順表の期待値と字ごとに一致する（合計 108）', () => {
  let total = 0;
  for (const ch of SETS.kata) {
    assert.equal(STROKES[ch].s.length, KATA_COUNTS[ch], ch);
    total += STROKES[ch].s.length;
  }
  assert.equal(total, 108);
});

test('画数が筆順表の期待値と字ごとに一致する（合計 104）', () => {
  assert.deepEqual(Object.keys(HIRA_COUNTS).sort(), [...SETS.hira].sort());
  let total = 0;
  for (const ch of SETS.hira) {
    assert.equal(STROKES[ch].s.length, HIRA_COUNTS[ch], ch);
    total += STROKES[ch].s.length;
  }
  assert.equal(total, 104);
});

test('座標はすべて 0〜1090 の整数、どの画も長さが 0 でなく、形が正しい', () => {
  for (const ch of ALL) {
    const o = STROKES[ch];
    assert.equal(o.n.length, o.s.length, ch + ' 番号の位置');
    assert.equal(o.t.length, o.s.length, ch + ' 種類');
    o.n.forEach(p => { assert.equal(p.length, 2); p.forEach(v => assert.ok(Number.isInteger(v) && v >= 0 && v <= 1090, ch)); });
    o.s.forEach((s, i) => {
      assert.ok(s.length >= 8 && (s.length - 2) % 6 === 0, ch + ' ' + i + ' 配列の長さ');
      s.forEach(v => assert.ok(Number.isInteger(v) && v >= 0 && v <= 1090, ch + ' ' + v));
      let len = 0;
      for (let k = 2; k + 5 < s.length; k += 6) len += Math.hypot(s[k + 4] - s[k - 2], s[k + 5] - s[k - 1]);
      assert.ok(len > 0, ch + ' ' + i + ' 長さ');
    });
  }
});

test('向きの検査: 形が似ていて向きで決まる画は、始点と終点の位置関係が書き順どおり', () => {
  // 上から下へ
  ['く', 'し', 'ん', 'そ'].forEach(c => assert.ok(last(c, 0)[1] > first(c, 0)[1], c));
  assert.ok(last('り', 1)[1] > first('り', 1)[1], 'り 2画目は上から下');
  assert.ok(last('い', 0)[1] > first('い', 0)[1], 'い 1画目は上から下');
  // 左から右へ
  assert.ok(last('へ', 0)[0] > first('へ', 0)[0], 'へ');
  assert.ok(last('つ', 0)[0] > first('つ', 0)[0], 'つ');
  assert.ok(last('し', 0)[0] > first('し', 0)[0], 'し は右へ抜ける');
  assert.ok(last('こ', 0)[0] > first('こ', 0)[0] && last('こ', 1)[0] > first('こ', 1)[0], 'こ');
  assert.ok(last('さ', 0)[0] > first('さ', 0)[0], 'さ 1画目は横');
  // 画の順番: こ は上が先、い は左が先、ふ の点は左が先
  assert.ok(first('こ', 0)[1] < first('こ', 1)[1], 'こ');
  assert.ok(first('い', 0)[0] < first('い', 1)[0], 'い');
  assert.ok(first('ふ', 2)[0] < first('ふ', 3)[0], 'ふ 3画目は左の点、4画目は右の点');
  // り は2画、続けない（1画目の終点と2画目の始点は離れている）
  const d = Math.hypot(last('り', 0)[0] - first('り', 1)[0], last('り', 0)[1] - first('り', 1)[1]);
  assert.ok(d > 200, 'り');
});

test('向きの検査（カタカナ）: シ・ツ と ソ・ン は、向きで区別する画の始点と終点が書き順どおり', () => {
  const dx = (c, i) => last(c, i)[0] - first(c, i)[0], dy = (c, i) => last(c, i)[1] - first(c, i)[1];
  assert.ok(dy('シ', 2) < -200 && dx('シ', 2) > 200, 'シ 3画目は左下から右上');
  assert.ok(dy('ツ', 2) > 200 && dx('ツ', 2) < -200, 'ツ 3画目は右上から左下');
  assert.ok(dy('ソ', 1) > 200 && dx('ソ', 1) < -200, 'ソ 2画目は右上から左下');
  assert.ok(dy('ン', 1) < -200 && dx('ン', 1) > 200, 'ン 2画目は左下から右上');
  // 点が先（短い画が 1 画目）。ツ の点は左が先
  assert.ok(first('ツ', 0)[0] < first('ツ', 1)[0], 'ツ 点は左が先');
  assert.ok(first('シ', 0)[1] < first('シ', 1)[1], 'シ 点は上が先');
  assert.ok(first('ソ', 0)[0] < first('ソ', 1)[0] && first('ン', 0)[0] < first('ン', 1)[0], 'ソ・ン は点が先');
  // 横が先: ニ・ヲ・ヨ は上から下へ
  assert.ok(first('ニ', 0)[1] < first('ニ', 1)[1], 'ニ 上の横が先');
  assert.ok(first('ヲ', 0)[1] < first('ヲ', 1)[1], 'ヲ 上の横が先');
  assert.ok(dx('ヲ', 0) > 200 && dx('ヲ', 1) > 200 && dy('ヲ', 2) > 200, 'ヲ 横 横 縦');
  assert.ok(first('ヨ', 0)[1] < first('ヨ', 1)[1] && first('ヨ', 1)[1] < first('ヨ', 2)[1], 'ヨ 上から下へ');
  assert.ok(dx('ヒ', 0) > 200, 'ヒ 1画目は横');
});

test('ファイルの頭にライセンスと出典の表示がある', () => {
  const head = fs.readFileSync(path.join(__dirname, '..', 'src', 'strokes.js'), 'utf8').split('\n').slice(0, 20).join('\n');
  assert.ok(head.includes('KanjiVG'));
  assert.ok(head.includes('CC BY-SA 3.0'));
  assert.ok(head.includes('kanjivg.tagaini.net'));
  assert.ok(head.includes('Ulrich Apel'));
  assert.ok(/r\d{8}/.test(head), '版');
});
