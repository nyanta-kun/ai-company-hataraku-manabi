// 作る音声の一覧（正本）。units() が、声ごとに作るファイルの全部を決まった順で返す: [{ text, why }]。乱数を使わない。
// 決まり文句は src/lines.js、組み合わせは src/data.js・src/strokes.js の表から。同じ規則を src/voice.js の resolve が使う（網羅テストで確かめる）。
// 名前の文（{名前}さん、しゅつどうの じゅんび！ ほか）は作らない（端末の声。名前を抜いた alt は作る）。英語は作らない（端末の声）。
const path = require('path');
const src = f => require(path.join(__dirname, '..', '..', 'src', f));
const D = src('data.js'), P = src('problems.js'), L = src('lines.js'), V = src('voice.js'), STR = src('strokes.js');

function units() {
  const seen = new Set(), out = [];
  const add = (text, why) => { const k = V.normalize(text); if (k && !seen.has(k)) { seen.add(k); out.push({ text: k, why }); } };
  const addSentences = (text, why) => V.sentences(text).forEach(s => add(s, why));
  const N = D.NUM_KANA;

  // 決まり文句（丸ごと。2 文のものも 1 つの音声）
  Object.keys(L.FIXED).forEach(k => add(L.FIXED[k], 'fixed'));
  // 数（ふつうの読みと「{数}！」）。数え聞かせ・タップ・式の部品・「そう！{数}！」
  for (let n = 1; n <= 100; n++) add(N[n], 'number');
  for (let n = 1; n <= 100; n++) add(N[n] + '！', 'number');
  // 時刻: 前置き／時だけ／ちょうど・はん（記号付き）／分（記号付き）／{分}たったら
  L.TIME_PREFIX.forEach(t => add(t, 'time'));
  for (let h = 1; h <= 12; h++) add(D.TIME_KANA[h], 'time');
  for (let h = 1; h <= 12; h++) ['', 'はん'].forEach(t => ['。', '！'].forEach(mk => add(D.TIME_KANA[h] + t + mk, 'time')));
  for (let m = 1; m <= 59; m++) if (m !== 30) ['。', '！'].forEach(mk => add(D.MIN_KANA[m] + mk, 'time'));
  Object.keys(P.CLOCK).forEach(lv => { if (P.CLOCK[lv].form === 'elapsed') P.CLOCK[lv].durations.forEach(dm => add(P.readMinutes(dm) + L.FIXED.clockElapsed, 'time')); });
  // 式: 部品 3 つ、数がともに 10 以下のたしざん・ひきざんは丸ごと
  ['たす', 'ひく', 'は、いくつ？'].forEach(t => add(t, 'expr'));
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) add(L.prompt({ kind: 'add', a: a, b: b }), 'expr');
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= a; b++) add(L.prompt({ kind: 'sub', a: a, b: b }), 'expr');
  // かけざん（2 文を別々に）
  Object.keys(P.MATH).forEach(lv => {
    const M = P.MATH[lv];
    if (M.kind !== 'mul') return;
    M.dans.forEach(d => addSentences(L.prompt({ kind: 'mul', a: d, b: 1 }).split('。')[0] + '。', 'mul'));
    for (let m = 1; m <= M.maxMul; m++) addSentences(L.prompt({ kind: 'mul', a: M.dans[0], b: m }).split('。')[1], 'mul');
  });
  // もじ: 語の読み・例語・字
  D.ALL_WORDS.forEach(w => {
    const q = { kind: 'letter', level: 'K1', script: w.script === 'kata' ? 'kata' : 'hira', wordId: w.id, answer: w.head };
    addSentences(L.prompt(q), 'letter');
    addSentences(L.correct(q), 'letter');
  });
  const heads = new Set(D.ALL_WORDS.map(w => w.head).concat(Object.keys(D.EXTRA_KATA)));
  heads.forEach(ch => addSentences(L.wrong({ kind: 'letter', level: 'K1' }, ch), 'letter'));
  D.YOUON_WORDS.forEach(w => { const q = { kind: 'letter', level: 'K7', script: 'hira', word: w.label, answer: w.head }; addSentences(L.prompt(q), 'letter'); addSentences(L.correct(q), 'letter'); });
  D.KANJI_WORDS.concat(D.KANJI_WORDS2).forEach(w => {
    const q = { kind: 'letter', level: 'K8', script: 'kanji', word: w.ch, yomi: w.yomi, speech: w.speech, answer: w.ch };
    addSentences(L.prompt(q), 'letter'); addSentences(L.correct(q), 'letter');
  });
  // かく: 字ごとの文（なぞる・ひとりで・できた・字の札）。名前の字の文は alt（いつもの文）を作る
  Object.keys(STR.SETS).forEach(k => STR.SETS[k].split('').forEach(ch => {
    [L.tracePrompt(ch, null), L.soloPrompt(ch), L.traceDone(ch, false), L.soloDone(ch), L.mojiSheet(ch)].forEach(t => addSentences(t, 'trace'));
  }));
  // ごほうび・昇格・しゃこ
  Object.keys(L.SET_LABEL).forEach(k => add(L.license(k), 'reward'));
  D.ALL_VEHICLES.forEach(car => { add(L.carGet(car), 'car'); add(L.carYomi(car), 'car'); });
  D.STAGES.slice(1).forEach(stg => add(L.promote(stg), 'reward'));
  D.SHELVES.forEach(sh => add(sh.name, 'shelf'));
  Object.keys(L.GAME_NAME).forEach(g => add(L.shelfHow(g), 'shelf'));
  // きょうの しゅつどう（王冠・誘いの文。ぜんぶ・0 回の文は FIXED に入っている）
  Object.keys(L.GAME_NAME).forEach(g => { add(L.todayCrown(g), 'today'); add(L.todayInvite(g), 'today'); });
  return out;
}

module.exports = { units };
if (require.main === module) {
  const u = units(), by = {};
  u.forEach(x => { by[x.why] = (by[x.why] || 0) + 1; });
  console.log(u.length, JSON.stringify(by));
}
