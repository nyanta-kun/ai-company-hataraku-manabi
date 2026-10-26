// 読み上げ文を ui.js から src/lines.js へ移した。文が 1 文字も変わっていないこと（T2）と、先読みの文の一覧（sessionTexts）
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const D = require('../src/data.js');
const P = require('../src/problems.js');
const L = require('../src/lines.js');
const { enumerate, SESSIONS } = require('./lines-helpers.js');
const { rngOf } = require('./helpers.js');

const hash = a => crypto.createHash('sha256').update(a.join('\n')).digest('hex');
const uniqSorted = a => [...new Set(a)].sort();
// 移す前（main の adc7bdd）の ui.js の関数と式で作った文の一覧。全ゲーム × 全レベル × 固定シード 1,000 回の出題の、問題・正解・全誤答・ヒント・数え聞かせと、
// かく 130 字・字の札・ごほうび・昇格・しゃこ・決まり文句。この値が変わるのは、読み上げる文を変えたとき（意図して変えたなら更新する）
const BEFORE = { texts: 3825, textsHash: '196947405a7e02624e21b87370d72065aa7d612c67d0b183e3ade16c3c2bcf4e', names: 131, namesHash: '37fbe59587e6d6bd7b47ccf54f45f6257e3394e482146e5e2a9d11ce2ba7124b' };
// 旧 ui.js にあった決まり文句（新しく足した定型の部品は、問題文の中に現れるのでここに入れない）
const OLD_FIXED = ['dispatch', 'who', 'pick', 'roundStart', 'together', 'assisted', 'sticker', 'bigger', 'more', 'compare', 'inviteSolo', 'noEnglish', 'test'];

test('T2: 読み上げ文は ui.js から移す前と全部同じ（全レベル・全場面の出題）', () => {
  const api = Object.assign({}, L, { fixed: OLD_FIXED.map(k => L.FIXED[k]) });
  const r = enumerate(api);
  const texts = uniqSorted(r.texts), names = uniqSorted(r.names);
  assert.equal(texts.length, BEFORE.texts);
  assert.equal(hash(texts), BEFORE.textsHash);
  assert.equal(names.length, BEFORE.names);
  assert.equal(hash(names), BEFORE.namesHash);
});

test('T2: 見本の文（読みの揺れを避けた形）が変わっていない', () => {
  assert.equal(L.prompt({ kind: 'add', a: 4, b: 7 }), 'よんたすななは、いくつ？');
  assert.equal(L.prompt({ kind: 'clock', form: 'read' }), 'とけいを見てね。出動の時間は、なんじかな？');
  assert.equal(L.prompt({ kind: 'clock', form: 'readmin' }), 'とけいを見てね。出動の時間は、なんじ なんぷんかな？');
  assert.equal(L.prompt({ kind: 'clock', form: 'pick', h: 4, m: 30 }), '出動は、よじはん。どのとけいかな？');
  assert.equal(L.wrong({ kind: 'letter', level: 'K1' }, 'は'), 'はしごの は。おしい！もう一回。');
  assert.equal(L.correct({ kind: 'clock', form: 'ampm', ap: 'pm', h: 9, m: 0 }), 'そう！ごご、くじ！');
  assert.equal(L.tracePrompt('ろ', { why: 'name', exact: true, name: 'たろう' }), 'たろうの ろ。なぞってね。');
  assert.equal(L.soloPrompt('ひ'), L.tracePrompt('ひ', null).replace('なぞってね。', 'ひとりで かいて みよう。'));
  assert.equal(L.who('たろう').text, 'たろうさん、しゅつどうの じゅんび！');
  assert.equal(L.who('たろう').alt, 'しゅつどうの じゅんび！');
  assert.equal(L.tracePromptAlt('ろ', { why: 'name', exact: true, name: 'たろう' }), L.tracePrompt('ろ', null));
  assert.equal(L.tracePromptAlt('ろ', null), '');
});

test('sessionTexts: 出題から出る日本語の文（問題・正解・全誤答・ヒント・数え聞かせ）を重なりなく全部返す', () => {
  P.LEVELS.math.concat(P.LEVELS.letter, P.LEVELS.clock, P.LEVELS.english).forEach((level, i) => {
    const game = P.LEVELS.math.includes(level) ? 'math' : P.LEVELS.letter.includes(level) ? 'letter' : P.LEVELS.clock.includes(level) ? 'clock' : 'english';
    const qs = P.generateSession(game, level, rngOf(100 + i));
    const got = L.sessionTexts(qs);
    assert.equal(new Set(got).size, got.length, level);
    qs.forEach(q => {
      assert.ok(got.includes(L.prompt(q)) && got.includes(L.correct(q)) && got.includes(L.hint(q)), level);
      q.choices.forEach(v => { if (v !== q.answer) assert.ok(got.includes(L.wrong(q, v)), level + ' ' + v); });
    });
  });
});

test('traceTexts: 名前の字は alt（いつもの文）を返し、名前の文そのものは含めない', () => {
  const got = L.traceTexts(['ろ', 'ひ'], [{ why: 'name', exact: true, name: 'たろう' }, null]);
  assert.ok(!got.some(t => t.includes('たろう')));
  assert.ok(got.includes(L.tracePrompt('ろ', null)) && got.includes(L.soloPrompt('ひ')));
});
