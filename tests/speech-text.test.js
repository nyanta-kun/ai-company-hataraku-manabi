// 読み上げ文に、読みが揺れやすい漢字（時計・何時・何分 など）を使わない（「とけい」が「ときけい」になる）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const read = f => fs.readFileSync(require('path').join(__dirname, '../src', f), 'utf8');
const ui = read('ui.js'), lines = read('lines.js');
const src = ui + '\n' + lines;   // 読み上げ文は lines.js（ui.js から移した）にある。どちらも見る
const BAD = /時計|何時|何分|一日|上手|短い針|長い針|英語/;

test('読み上げ文: ui.js・lines.js 全体（コメントを除く）に、揺れやすい漢字が無い', () => {
  // 読み上げに渡る文は promptText・say・seq・said・tracePrompt・soloPrompt など ui.js の文字列に散らばるので、全体を見る（画面の文字は D.TEXT など data.js 側）
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const hit = code.split('\n').filter(l => BAD.test(l));
  assert.deepEqual(hit, []);
});

test('読み上げ文: とけいの問題文はひらがなの「とけい」「なんじ」「なんぷん」', () => {
  assert.match(src, /とけいを見てね。出動の時間は、なんじかな？/);
  assert.match(src, /なんじ なんぷんかな？/);
});
