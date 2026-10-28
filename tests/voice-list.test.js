// 作る音声の一覧（scripts/voice/list.js）と、文 → 部品の分け方（src/voice.js の resolve）。T1 網羅・T3 resolve
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/data.js');
const P = require('../src/problems.js');
const L = require('../src/lines.js');
const V = require('../src/voice.js');
const { units } = require('../scripts/voice/list.js');
const { enumerate, NAME } = require('./lines-helpers.js');

const U = units();
const table = {};
U.forEach(u => { table[u.text] = [u.text, 1000]; });
const keysOf = (text) => { const r = V.resolve(text, table); return r && r.map(p => p.key); };

test('一覧: 重なりがなく、鍵は正規化済み、並びは毎回同じ。声 1 人あたりのファイル数は 1,500 以下', () => {
  assert.equal(new Set(U.map(u => u.text)).size, U.length);
  U.forEach(u => assert.equal(V.normalize(u.text), u.text));
  assert.deepEqual(units(), U);
  assert.ok(U.length > 800 && U.length <= 1500, String(U.length));
  U.forEach(u => assert.ok(u.why && !/[A-Za-z]/.test(u.text), u.text));   // 英語は作らない
});

test('T1: 全ゲーム × 全レベル × 固定シード 1,000 回の出題から出る日本語の文が、一覧だけで全部言える（名前の文を除く）', () => {
  const api = Object.assign({}, L, { fixed: Object.values(L.FIXED) });
  const r = enumerate(api);
  const miss = [...new Set(r.texts)].filter(t => !V.resolve(t, table));
  assert.deepEqual(miss, []);
  // 部品をつなぐと元の文（正規化したもの）に戻る = 1 文字も足りない・余らない
  [...new Set(r.texts)].forEach(t => assert.equal(keysOf(t).join(''), V.normalize(t), t));
});

test('T1: 名前の文は一覧では言えない。名前を抜いた alt は言える', () => {
  const who = L.who(NAME);
  assert.equal(V.resolve(who.text, table), null);
  assert.ok(V.resolve(who.alt, table));
  const info = { why: 'name', exact: true, name: NAME };
  ['ろ', 'た', 'う'].forEach(ch => {
    assert.equal(V.resolve(L.tracePrompt(ch, info), table), null);
    assert.ok(V.resolve(L.tracePromptAlt(ch, info), table), ch);
  });
});

test('T1: sessionTexts（出動の始めの先読み）の文は全部一覧で言える', () => {
  ['math', 'letter', 'clock', 'english'].forEach(g => P.LEVELS[g].forEach(lv => {
    L.sessionTexts(P.generateSession(g, lv, Math.random)).forEach(t => assert.ok(V.resolve(t, table), lv + ' ' + t));
  }));
});

test('T3: resolve は全文一致・続く 2 文を 1 つの音声に・つなぎの間', () => {
  assert.deepEqual(keysOf('出動！'), ['出動！']);
  assert.deepEqual(keysOf('はしごの は。おしい！もう一回。'), ['はしごの は。', 'おしい！もう一回。']);
  const r = V.resolve('はしごの は。おしい！もう一回。', table);
  assert.deepEqual(r.map(p => p.gap), [0, V.GAP_SENT]);
  assert.deepEqual(keysOf('おしい！もう一回。'), ['おしい！もう一回。']);   // 2 文だが 1 つの音声
});

test('T3: 空白のゆれ（記号の直後の空白の有無・前後・連続）は同じ鍵になる', () => {
  assert.equal(V.normalize('  ぜんぶ なぞれたね！  ひとりで かいて みよう。 '), 'ぜんぶ なぞれたね！ひとりで かいて みよう。');
  assert.equal(V.normalize('そう！ひ！ ひこうきの ひ。'), 'そう！ひ！ひこうきの ひ。');
  assert.deepEqual(keysOf('ぜんぶ なぞれたね！ ひとりで かいて みよう。'), ['ぜんぶ なぞれたね！ひとりで かいて みよう。']);
  assert.deepEqual(keysOf('そう！ひ！ひこうきの ひ。'), keysOf('そう！ ひ！ ひこうきの ひ。'));
});

test('T3: 時刻（ちょうど・はん・それ以外・前置き付き）', () => {
  assert.deepEqual(keysOf('出動は、よじはん。どのとけいかな？'), ['出動は、', 'よじはん。', 'どのとけいかな？']);
  assert.deepEqual(keysOf('出動は、くじ。ごぜんかな、ごごかな？'), ['出動は、', 'くじ。', 'ごぜんかな、ごごかな？']);
  assert.deepEqual(keysOf('出動は、くじよんじゅうきゅうふん。どのとけいかな？'), ['出動は、', 'くじ', 'よんじゅうきゅうふん。', 'どのとけいかな？']);
  assert.deepEqual(keysOf('そう！ごご、しちじにじゅっぷん！'), ['そう！', 'ごご、', 'しちじ', 'にじゅっぷん！']);
  assert.deepEqual(keysOf('そう！ごぜん、しちじはん！'), ['そう！', 'ごぜん、', 'しちじはん！']);
  assert.deepEqual(keysOf('いまは、じゅうにじ。じゅっぷんたったら、どのとけいかな？'), ['いまは、', 'じゅうにじ。', 'じゅっぷんたったら、どのとけいかな？']);
  assert.deepEqual(keysOf('じゅういちじごふん。おしい！もう一回。'), ['じゅういちじ', 'ごふん。', 'おしい！もう一回。']);
});

test('T3: 時の読みは最長一致（じゅうにじ・じゅういちじ・じゅうじ が割れない）', () => {
  assert.deepEqual(keysOf('そう！じゅうにじごふん！'), ['そう！', 'じゅうにじ', 'ごふん！']);
  assert.deepEqual(keysOf('そう！じゅういちじごふん！'), ['そう！', 'じゅういちじ', 'ごふん！']);
  assert.deepEqual(keysOf('そう！じゅうじごふん！'), ['そう！', 'じゅうじ', 'ごふん！']);
  for (let h = 1; h <= 12; h++) for (const m of [0, 30, 1, 5, 17, 45, 59]) {
    const t = 'そう！' + P.readTime(h, m) + '！', k = keysOf(t);
    assert.equal(k.join(''), t);
    assert.equal(k[1], m === 0 || m === 30 ? P.readTime(h, m) + '！' : D.TIME_KANA[h]);
  }
});

test('T3: 式（数がともに 10 以下は丸ごと、11 以上を含むと部品）と数', () => {
  assert.deepEqual(keysOf('よんたすななは、いくつ？'), ['よんたすななは、いくつ？']);
  assert.deepEqual(keysOf('じゅうたすにじゅうは、いくつ？'), ['じゅう', 'たす', 'にじゅう', 'は、いくつ？']);
  assert.deepEqual(keysOf('よんじゅうひくじゅうごは、いくつ？'), ['よんじゅう', 'ひく', 'じゅうご', 'は、いくつ？']);
  assert.deepEqual(keysOf('そう！にじゅうご！'), ['そう！', 'にじゅうご！']);
  assert.deepEqual(keysOf('にじゅうご'), ['にじゅうご']);
  assert.deepEqual(keysOf('ごじゅう'), ['ごじゅう']);   // 数が時刻に取り違えられない
  assert.deepEqual(keysOf('ひとはこに、さんこずつ。ごはこで、ぜんぶでいくつ？'), ['ひとはこに、さんこずつ。', 'ごはこで、ぜんぶでいくつ？']);
});

test('T3: 1 つでも解けなければ null（声を混ぜない）', () => {
  assert.equal(V.resolve('そう！くじごじゅうろくふん！', table), null);   // 56 分の読みは「ごじゅうろっぷん」。それ以外の読みは作らない
  assert.equal(V.resolve('出動！ しらないぶんしょう。', table), null);   // 前半が言えても後半が無ければ全体を端末の声に
  assert.equal(V.resolve('', table), null);
  assert.equal(V.resolve('Fire truck', table), null);   // 英語は作らない
  assert.equal(V.resolve('出動！', {}), null);           // 声のパックが空
});

test('きょうの しゅつどう: 12 本の文（王冠 5・誘い 5・ぜんぶ・0 回）が一覧に入り、一覧だけで言える', () => {
  const texts = [];
  Object.keys(L.GAME_NAME).forEach(g => texts.push(L.todayCrown(g), L.todayInvite(g)));
  texts.push(L.FIXED.todayAll, L.FIXED.todayNone);
  assert.equal(new Set(texts).size, 12);
  const have = new Set(U.map(u => u.text));
  texts.forEach(t => { assert.ok(have.has(V.normalize(t)), t); assert.ok(V.resolve(t, table), t); });
  assert.equal(U.filter(u => u.why === 'today').length, 10);
  assert.equal(L.todayCrown('trace'), '今日は かくを、とくに がんばったね！');
  assert.equal(L.todayInvite('clock'), 'あしたは とけいも、やってみる？');
});
