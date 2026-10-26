#!/usr/bin/env node
// KanjiVG の SVG から、なぞりがき用の src/strokes.js を作る（開発者が一度だけ動かす。ビルド工程ではない。出力を commit する）。
//
// 取得元: https://github.com/KanjiVG/kanjivg の release r20260714（tag）の kanji/<5桁の16進>.svg
//   https://raw.githubusercontent.com/KanjiVG/kanjivg/r20260714/kanji/03042.svg など
// 版: r20260714（tag）= commit d95a97627fd9fe5b2c8d06ca81e38149609c0c1e
// ライセンス: KanjiVG は CC BY-SA 3.0（© Ulrich Apel, http://kanjivg.tagaini.net）。出力の src/strokes.js だけが CC BY-SA 3.0。このスクリプト自体は対象外。
//
// 使い方（外部ライブラリなし。Node 18 以上）:
//   node scripts/strokes/convert.js <SVG を置くフォルダ> [--fetch] [--out src/strokes.js]
//   --fetch をつけると、フォルダに無い SVG を上の URL から取ってくる（フォルダは空の新しい場所にすること）。
// path は M m C c S s L l だけ対応する。ほかの命令が出たら、その字を報告して止まる。
'use strict';
const fs = require('fs');
const path = require('path');

const VERSION = 'r20260714';
const COMMIT = 'd95a97627fd9fe5b2c8d06ca81e38149609c0c1e';
const BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/' + VERSION + '/kanji/';
const SETS = {
  // なぞる順番（易しい順。企画どおり）
  hira: 'しつくへてのひそろるんいこりうとちらえすよわれみめゆぬねけにかさせもやおあまはむをたなきふほ',
  // カタカナ（W3）: 1画 → 2画 → 3画 → 4画。形が似た シ・ツ と ソ・ン は、続けて並べて同じ出動に出やすくする（企画 2.4）
  kata: 'ノフヘレアイカクコスセソンナトニヌハヒマムメヤユラリルワウエオキケサシツタチテミモヨロヲネホ'
};
const SCALE = 10;   // 109 を 10 倍して整数に丸める

function fileOf(ch) { return ('00000' + ch.codePointAt(0).toString(16)).slice(-5) + '.svg'; }
const r = n => Math.round(n * SCALE);

// path の d を、絶対座標の 3 次ベジェ [x0,y0, c1x,c1y,c2x,c2y,x,y, ...]（丸める前の実数）に直す
function parsePath(d) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, cmd = null, x = 0, y = 0, lastC2 = null, out = null;
  const num = () => {
    const v = parseFloat(tokens[i++]);
    if (Number.isNaN(v)) throw new Error('数値が足りない: ' + d);
    return v;
  };
  const isNum = () => i < tokens.length && !/^[A-Za-z]$/.test(tokens[i]);
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++];
    else if (cmd === null) throw new Error('命令がない: ' + d);
    if (!'MmCcSsLl'.includes(cmd)) throw new Error('未対応の命令 ' + cmd);
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    if (up === 'M') {
      if (out) throw new Error('1 つの path に M が 2 回');
      x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num(); out = [x, y]; lastC2 = null;
      if (isNum()) throw new Error('M のあとに座標が続く');
      continue;
    }
    if (!out) throw new Error('M で始まらない');
    do {
      const ox = rel ? x : 0, oy = rel ? y : 0;
      let c1x, c1y, c2x, c2y, ex, ey;
      if (up === 'L') {
        ex = ox + num(); ey = oy + num();
        c1x = x + (ex - x) / 3; c1y = y + (ey - y) / 3; c2x = x + 2 * (ex - x) / 3; c2y = y + 2 * (ey - y) / 3;
        lastC2 = null;
      } else if (up === 'C') {
        c1x = ox + num(); c1y = oy + num(); c2x = ox + num(); c2y = oy + num(); ex = ox + num(); ey = oy + num();
        lastC2 = [c2x, c2y];
      } else { // S
        if (lastC2) { c1x = 2 * x - lastC2[0]; c1y = 2 * y - lastC2[1]; } else { c1x = x; c1y = y; }
        c2x = ox + num(); c2y = oy + num(); ex = ox + num(); ey = oy + num();
        lastC2 = [c2x, c2y];
      }
      out.push(c1x, c1y, c2x, c2y, ex, ey);
      x = ex; y = ey;
    } while (isNum());
  }
  return out;
}

function convertChar(ch, svg) {
  const strokes = [], types = [];
  const re = /<path\b[^>]*?\bid="kvg:[0-9a-f]+-s(\d+)"[^>]*>/g;
  let m;
  while ((m = re.exec(svg))) {
    const tag = m[0];
    const d = /\bd="([^"]*)"/.exec(tag);
    if (!d) throw new Error(ch + ': d が無い');
    const ty = /kvg:type="([^"]*)"/.exec(tag);
    let p;
    try { p = parsePath(d[1]); } catch (e) { throw new Error(ch + ' の ' + m[1] + ' 画目: ' + e.message); }
    if (+m[1] !== strokes.length + 1) throw new Error(ch + ': 画の番号が連続でない');
    strokes.push(p.map(r));
    types.push(ty ? ty[1] : '');
  }
  const notes = [];
  const tre = /<text\b[^>]*transform="matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)"[^>]*>(\d+)<\/text>/g;
  while ((m = tre.exec(svg))) notes[+m[3] - 1] = [r(+m[1]), r(+m[2])];
  if (!strokes.length) throw new Error(ch + ': 画が見つからない');
  if (notes.length !== strokes.length || notes.some(n => !n)) throw new Error(ch + ': 番号の位置が画の数と合わない');
  return { s: strokes, n: notes, t: types };
}

const HEADER = [
  '// なぞりがきの字形と書き順のデータ（ひらがな 46 字・カタカナ 46 字）。画ごとの中心線を 3 次ベジェで持つ。',
  '//',
  '// このファイルだけ、次のライセンスで配布する（アプリのほかのコードは別。読むだけの別ファイルに分けてある）:',
  '//   Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)  https://creativecommons.org/licenses/by-sa/3.0/',
  '//',
  '// 出典: KanjiVG  http://kanjivg.tagaini.net  Copyright (C) 2009-2011 Ulrich Apel.',
  '//   取得元: https://github.com/KanjiVG/kanjivg  版: ' + VERSION + '（tag）= commit ' + COMMIT + '（kanji/<コード>.svg）',
  '// 変更内容: 必要な字だけを選び、座標を 10 倍して整数に丸め、M/m/C/c/S/s/L/l を絶対座標の 3 次ベジェの配列に直した。',
  '//   番号の位置（<text>）と画の種類（kvg:type）も取り出した（ひらがな・カタカナの SVG には kvg:type がほとんど無く、無い字の t は空文字（マ だけある）。漢字にはある）。画の順番の入れ替えはまだ無い。',
  '// 作り方: node scripts/strokes/convert.js <SVG のフォルダ> --fetch （手で書き換えず、変換し直す。順番の入れ替えを足すときは上の「変更内容」に書く）',
  '//',
  '// 形: STROKES[字] = { s: 画の配列, n: 番号の位置, t: 画の種類 }。',
  '//   1 画は [x0,y0, (c1x,c1y,c2x,c2y,x,y) × 区間の数]。座標は KanjiVG の 109×109 を 10 倍した整数（0〜1090）。',
  '// SETS: なぞる順番（字の並び）。'
].join('\n');

async function main() {
  const args = process.argv.slice(2);
  const fetchFlag = args.includes('--fetch');
  const oi = args.indexOf('--out');
  const outFile = oi >= 0 ? args[oi + 1] : path.join(__dirname, '..', '..', 'src', 'strokes.js');
  const dir = args.find((a, k) => !a.startsWith('--') && args[k - 1] !== '--out');
  if (!dir) { console.error('使い方: node scripts/strokes/convert.js <SVG のフォルダ> [--fetch] [--out ファイル]'); process.exit(2); }
  fs.mkdirSync(dir, { recursive: true });
  const chars = [...new Set([].concat(...Object.values(SETS).map(s => [...s])))];
  const data = {};
  const failed = [];
  for (const ch of chars) {
    const f = path.join(dir, fileOf(ch));
    if (!fs.existsSync(f)) {
      if (!fetchFlag) { failed.push(ch + ': ' + f + ' が無い（--fetch で取得）'); continue; }
      const res = await fetch(BASE + fileOf(ch));
      if (!res.ok) { failed.push(ch + ': 取得失敗 ' + res.status); continue; }
      fs.writeFileSync(f, await res.text());
    }
    try { data[ch] = convertChar(ch, fs.readFileSync(f, 'utf8')); } catch (e) { failed.push(e.message); }
  }
  if (failed.length) { console.error('変換できなかった字:\n' + failed.join('\n')); process.exit(1); }

  const lines = [];
  lines.push(HEADER, '(function (root) {', "  'use strict';", '  var STROKES = {');
  chars.forEach((ch, k) => {
    const o = data[ch];
    lines.push('    ' + JSON.stringify(ch) + ': { s: ' + JSON.stringify(o.s) + ', n: ' + JSON.stringify(o.n) + ', t: ' + JSON.stringify(o.t) + ' }' + (k < chars.length - 1 ? ',' : ''));
  });
  lines.push('  };');
  lines.push('  var SETS = ' + JSON.stringify(SETS) + ';');
  lines.push('  var api = { STROKES: STROKES, SETS: SETS };');
  lines.push("  if (typeof module !== 'undefined' && module.exports) module.exports = api;");
  lines.push('  else { root.Manabi = root.Manabi || {}; root.Manabi.strokes = api; }');
  lines.push("})(typeof window !== 'undefined' ? window : globalThis);", '');
  fs.writeFileSync(outFile, lines.join('\n'));
  console.log(chars.length + ' 字を ' + outFile + ' に書いた（' + chars.reduce((a, c) => a + data[c].s.length, 0) + ' 画）');
}
main().catch(e => { console.error(e); process.exit(1); });
