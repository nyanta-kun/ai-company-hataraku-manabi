const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { STROKES, SETS } = require('../src/strokes.js');
const D = require('../src/data.js');

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
// 漢字の画数（学年別漢字配当表の画数を人が打ったもの。K8 = 小1、K9 = 小2）。電(13)・線(15) は上限 12 画を超えるので なぞりからは外す（design-tracing 10章）
const K1_COUNTS = { 山: 3, 川: 3, 口: 3, 火: 4, 水: 4, 木: 4, 犬: 4, 手: 4, 石: 5, 目: 5, 虫: 6, 耳: 6, 糸: 6, 竹: 6, 花: 7, 車: 7, 足: 7, 雨: 8, 空: 8, 森: 12 };
const K2_COUNTS = { 冬: 5, 池: 6, 門: 8, 夜: 8, 海: 9, 昼: 9, 風: 9, 星: 9, 春: 9, 秋: 9, 馬: 10, 夏: 10, 船: 11, 鳥: 11, 雪: 11, 道: 12, 朝: 12, 雲: 12 };
const EXCLUDED = { 電: 13, 線: 15 };
const ALL = SETS.hira + SETS.kata + SETS.k1 + SETS.k2;
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

test('SETS.k1 は K8 の 20 字（KANJI_WORDS と同じ集合）、SETS.k2 は K9 の 20 字から 13 画以上の 電・線 を除いた 18 字', () => {
  const k1 = [...SETS.k1], k2 = [...SETS.k2];
  assert.equal(k1.length, 20 - 0);
  assert.deepEqual(k1.slice().sort(), D.KANJI_WORDS.map(w => w.ch).sort());
  assert.equal(new Set(k1).size, 20);
  assert.deepEqual(k2.slice().sort(), D.KANJI_WORDS2.map(w => w.ch).filter(c => !(c in EXCLUDED)).sort());
  assert.equal(k2.length, 18);
  assert.equal(new Set(k2).size, 18);
  // 外した字は STROKES に無い
  Object.keys(EXCLUDED).forEach(c => assert.ok(!STROKES[c], c + ' は持たない'));
  // 重ならない
  assert.equal(new Set([...SETS.hira, ...SETS.kata, ...k1, ...k2]).size, 46 + 46 + 20 + 18);
  assert.deepEqual(Object.keys(STROKES).sort(), [...ALL].sort());
  // 順番は画数の少ない順
  [[k1, K1_COUNTS], [k2, K2_COUNTS]].forEach(([cs, tbl]) => {
    const n = cs.map(c => tbl[c]);
    assert.deepEqual(n, n.slice().sort((a, b) => a - b));
  });
  // 外した理由: 12 画（設計 2.4 の上限の推奨）を超える
  Object.keys(EXCLUDED).forEach(c => assert.ok(EXCLUDED[c] > 12));
  [...SETS.k1, ...SETS.k2].forEach(c => assert.ok((K1_COUNTS[c] || K2_COUNTS[c]) <= 12, c));
});

test('漢字の画数が学年別漢字配当表の期待値と字ごとに一致する（K8 は 112 画、K9 の 18 字は 170 画）', () => {
  let t1 = 0, t2 = 0;
  for (const c of SETS.k1) { assert.equal(STROKES[c].s.length, K1_COUNTS[c], c); t1 += STROKES[c].s.length; }
  for (const c of SETS.k2) { assert.equal(STROKES[c].s.length, K2_COUNTS[c], c); t2 += STROKES[c].s.length; }
  assert.equal(t1, 112);
  assert.equal(t2, 170);
});

test('漢字の第 1 画の種類（kvg:type）: 照合表に書いた字で一致する', () => {
  const T1 = { 耳: '㇐', 花: '㇐', 木: '㇐', 犬: '㇐', 車: '㇐', 森: '㇐', 春: '㇐', 夏: '㇐', 朝: '㇐',
    山: '㇑a', 口: '㇑', 虫: '㇑', 足: '㇑', 空: '㇑a', 川: '㇒', 手: '㇒', 竹: '㇒', 火: '㇔', 雨: '㇐', 水: '㇚', 糸: '㇜', 目: '㇑', 石: '㇐' };
  for (const [c, t] of Object.entries(T1)) assert.ok(STROKES[c].t[0].startsWith(t.replace(/[a-z]$/, '')), c + ' ' + STROKES[c].t[0]);
  // 点（火・雨の点）や、書き順の迷いがある 風・道 の順: 風 は ノ（㇒）から、道 は 点（㇔）から。辶は最後（道 の最後の画は ㇏）
  assert.ok(STROKES['風'].t[0].startsWith('㇒') && STROKES['道'].t[0].startsWith('㇔'));
  assert.ok(STROKES['道'].t[11].startsWith('㇏'), '道 の辶は最後');
  // 雨 の点は 5〜8 画目（4 つ。左の列が先）。火 は 左の点 → 右の点（右上から左下）→ 中央のはらい → 右のはらい（3 画目の始点は 1・2 画目の間の上）
  assert.deepEqual(STROKES['雨'].t.slice(4), ['㇔', '㇔', '㇔', '㇔']);
  assert.ok(first('雨', 4)[0] < first('雨', 6)[0] && first('雨', 5)[0] < first('雨', 7)[0] && first('雨', 4)[1] < first('雨', 5)[1], '雨 の点');
  assert.ok(first('火', 0)[0] < first('火', 2)[0] && first('火', 2)[0] < first('火', 1)[0], '火 1 → 3 → 2 の x 位置');
  assert.ok(last('火', 1)[0] < first('火', 1)[0] && last('火', 1)[1] > first('火', 1)[1], '火 2 画目は右上から左下');
});
