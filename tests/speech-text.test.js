// 読み上げ文に、読みが揺れやすい漢字（時計・何時・何分 など）を使わない（「とけい」が「ときけい」になる）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '../src/ui.js'), 'utf8');
const BAD = /時計|何時|何分|一日|上手|短い針|長い針|英語/;

test('読み上げ文: promptText の中と、say(...) に直接渡す文に、揺れやすい漢字が無い', () => {
  const a = src.indexOf('function promptText(p)'), b = src.indexOf("if (p.kind === 'english') return 'どれかな？'", a);
  assert.ok(a > 0 && b > a);
  assert.doesNotMatch(src.slice(a, b).split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n'), BAD);
  const says = src.split('\n').filter(l => /\bsay\(/.test(l) && !/^\s*\/\//.test(l)).map(l => l.replace(/\/\/.*$/, ''));
  says.forEach(l => assert.doesNotMatch(l, BAD, l));
});

test('読み上げ文: とけいの問題文はひらがなの「とけい」「なんじ」「なんぷん」', () => {
  assert.match(src, /とけいを見てね。出動の時間は、なんじかな？/);
  assert.match(src, /なんじ なんぷんかな？/);
});
