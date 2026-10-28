// 読み上げ文を作る純粋関数（ui.js から移した。文は 1 文字も変えない）。DOM・音に触らない。
// ブラウザでは window.Manabi.lines、Node では module.exports。作る音声の一覧（scripts/voice/list.js）と網羅テストもここを使う。
// 読み上げ文は、ひらがなだけだと平坦になるので漢字・カタカナまじり（文字の音そのものはひらがな）。揺れやすい漢字（時計・何時など）は使わない（tests/speech-text.test.js）。
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var D = node ? require('./data.js') : root.Manabi.data;
  var P = node ? require('./problems.js') : root.Manabi.problems;
  var NUMK = D.NUM_KANA;

  // 決まり文句（変わる所が無い文）。list.js はここから作る。値の順は固定（一覧の並びになる）
  var FIXED = {
    dispatch: '出動！',
    who: 'だれが遊ぶ？',
    pick: 'どれで出動する？',
    count: 'いくつあるかな？',
    english: 'どれかな？',
    clockRead: 'とけいを見てね。出動の時間は、なんじかな？',
    clockReadMin: 'とけいを見てね。出動の時間は、なんじ なんぷんかな？',
    oshii: 'おしい！もう一回。',
    hint: 'こっちかな？',
    hintHour: 'こっちかな？みじかい はりを見てね。',
    hintBoth: 'こっちかな？みじかい はりと、ながい はりを見てね。',
    so: 'そう！',
    roundStart: 'まるの ところから、もういちど。',
    together: 'いっしょに。',
    assisted: 'いっしょに かけたね。',
    traced: 'なぞって かけたね！',
    nameAlt: 'しゅつどうの じゅんび！',
    sticker: 'ごほうびステッカー！',
    bigger: 'もうすこし おおきく かいて みよう。',
    more: 'つづきも かいてね。',
    compare: 'おてほんと くらべて みよう。こんどは なぞって みよう。',
    inviteSolo: 'ぜんぶ なぞれたね！ ひとりで かいて みよう。',
    noEnglish: 'えいごの こえが、ないよ。',
    test: 'こんにちは。はたらくまなびです。',
    // 問題文の後ろの定型（前の部分だけが変わる）
    clockWhich: 'どのとけいかな？',
    clockAmpm: 'ごぜんかな、ごごかな？',
    clockElapsed: 'たったら、どのとけいかな？',
    askLetter: '最初の文字は、どれかな？',
    askYouon: '最初の音は、どれかな？',
    askKanji: 'どの かんじかな？',
    tryWrite: 'かいて みる？',
    traceTail: 'なぞってね。',
    soloTail: 'ひとりで かいて みよう。',
    // 「きょうの しゅつどう」（docs/design-daily-log.md 9.4）。王冠・誘いの文は todayCrown・todayInvite（ゲームごと）
    todayAll: 'ぜんぶ 出動できたね！',
    todayNone: '今日は どれで 出動する？'
  };
  // 時刻の前置き（「出動は、よじ。」の前の部分。resolve が部品に分けるとき使う）
  var TIME_PREFIX = ['出動は、', 'いまは、', 'ごぜん、', 'ごご、'];
  var SET_LABEL = { hira: 'ひらがな', kata: 'かたかな', k1: '1ねん', k2: '2ねん' };
  var GAME_NAME = { math: 'かず', letter: 'もじ', clock: 'とけい', english: 'えいご', trace: 'かく' };
  var TRACE_TAIL = FIXED.traceTail, SOLO_TAIL = FIXED.soloTail;

  // 数の読み（数え聞かせ・タップ）
  function number(n) { return NUMK[n]; }

  function wordOf(id) { for (var i = 0; i < D.ALL_WORDS.length; i++) if (D.ALL_WORDS[i].id === id) return D.ALL_WORDS[i]; return null; }
  // 語の読み上げ（漢字・カタカナまじりで自然に読ませる。data.js の YOMI）
  function yomiOf(w) { var id = w.id.replace(/_k$/, ''); return D.YOMI[id] || w.kata || (w.script === 'kata' ? w.label : w.speech); }
  function carYomi(car) { return D.CAR_YOMI[car.id] || car.name; }
  function isSpecialLetter(q) { return q.kind === 'letter' && (q.level === 'K7' || q.script === 'kanji'); }
  // 文字の例語（「ひこうきの ひ」）。同じ頭文字の語が複数ある文字は、文字そのものでない例語を優先する
  function exampleOf(ch) {
    var hit = null;
    for (var i = 0; i < D.ALL_WORDS.length; i++) {
      var w = D.ALL_WORDS[i];
      if (w.head !== ch) continue;
      if (w.example !== ch) return w.example;
      hit = hit || w.example;
    }
    return hit || D.EXTRA_KATA[ch] || ch;
  }
  // 正解のときの例語。その語自身の例語を使うが、例語が文字そのもの（ひ）なら、別の語の例語（ひこうき）にする
  function correctExample(q) { var w = wordOf(q.wordId); return w.example !== q.answer ? w.example : exampleOf(q.answer); }
  // 漢字の字の読み上げ: 読み上げには漢字を渡さない（声が読めない・読みが揺れる）。K8・K9 の読み上げ文（ひらがなだけ。例「ひ。もえる ひ」）を使う
  function kanjiWord(ch) {
    var all = D.KANJI_WORDS.concat(D.KANJI_WORDS2);
    for (var i = 0; i < all.length; i++) if (all[i].ch === ch) return all[i];
    return null;
  }

  // 問題文
  function prompt(p) {
    if (p.kind === 'count') return FIXED.count;
    if (p.kind === 'add') return NUMK[p.a] + 'たす' + NUMK[p.b] + 'は、いくつ？';   // 数字で渡すと「1たす4」などの読みが揺れるので、数の読み（よん・なな）で渡す
    if (p.kind === 'sub') return NUMK[p.a] + 'ひく' + NUMK[p.b] + 'は、いくつ？';
    if (p.kind === 'mul' && p.formula && !p.picShown) return NUMK[p.a] + 'かける' + NUMK[p.b] + 'は、いくつ？';   // 式だけのとき。絵を出したあとは下の文
    if (p.kind === 'mul') return 'ひとはこに、' + NUMK[p.a] + 'こずつ。' + D.HAKO_KANA[p.b] + 'で、ぜんぶでいくつ？';   // 数字で渡さず数の読みで。「かける」は式の絵に任せる
    if (p.kind === 'clock') {
      if (p.form === 'read') return FIXED.clockRead;
      if (p.form === 'readmin') return FIXED.clockReadMin;
      if (p.form === 'ampm') return '出動は、' + P.readTime(p.h, p.m) + '。' + FIXED.clockAmpm;   // 絵（朝・夕方・夜）と時計を見て選ぶ。午前・午後はひらがなで読む
      if (p.form === 'elapsed') return 'いまは、' + P.readTime(p.h0, p.m0) + '。' + P.readMinutes(p.dm) + FIXED.clockElapsed;
      return '出動は、' + P.readTime(p.h, p.m) + '。' + FIXED.clockWhich;
    }
    if (p.kind === 'english') return FIXED.english;   // 英語の意味は日本語で言わない（言うと英語を聞かなくても答えられる）
    if (p.level === 'K7') return p.word + '。' + FIXED.askYouon;   // 拗音（しょ）を選ぶ。ひらがなの語をそのまま読む
    if (p.script === 'kanji') return p.speech + '。' + FIXED.askKanji;          // K8・K9。読み上げ文はひらがなだけ（漢字を渡さない）
    return yomiOf(wordOf(p.wordId)) + '。' + FIXED.askLetter;
  }
  // 誤答（v = 選んだ答え）の日本語。えいごは日本語の部分だけ
  function wrong(q, v) {
    var said = FIXED.oshii;
    if (q.kind === 'letter' && !isSpecialLetter(q)) said = exampleOf(v) + 'の ' + D.toHira(v) + '。' + FIXED.oshii;
    else if (q.kind === 'clock' && (q.form === 'pick' || q.form === 'elapsed' || q.form === 'readmin') && v.indexOf('swap:') !== 0) { var tk = v.split(':'); said = P.readTime(+tk[0], +tk[1]) + '。' + FIXED.oshii; }
    return said;
  }
  // ヒント（正解を光らせるとき）
  function hint(q) {
    if (q.kind === 'clock') return q.form === 'read' ? FIXED.hintHour : q.form === 'readmin' ? FIXED.hintBoth : FIXED.hint;
    return FIXED.hint;
  }
  // 正解の日本語。えいごは日本語の部分（「そう！」）だけ
  function correct(q) {
    if (q.level === 'K7') return 'そう！' + q.answer + '！ ' + q.word + 'の ' + q.answer + '。';
    if (q.script === 'kanji') return 'そう！' + q.yomi + '！';
    if (q.kind === 'letter') return 'そう！' + D.toHira(q.answer) + '！ ' + correctExample(q) + 'の ' + D.toHira(q.answer) + '。';
    if (q.kind === 'clock' && q.form === 'ampm') return 'そう！' + D.AMPM_LABEL[q.ap] + '、' + P.readTime(q.h, q.m) + '！';
    if (q.kind === 'clock') return 'そう！' + P.readTime(q.h, q.m) + '！';
    if (q.kind === 'english') return FIXED.so;
    return 'そう！' + NUMK[q.answer] + '！';
  }

  // 名前の文（子どもの名前は前もって音声にできないので、名前を抜いた alt を持つ）。{ text, alt }
  function who(name) { return { text: name + 'さん、しゅつどうの じゅんび！', alt: FIXED.nameAlt }; }

  // かく。info = { why, name, exact }（W5）。名前の字そのもの（exact）のときだけ「たろうの ろ」。濁点・小さい字から来た字はいつもの声（例語）
  function tracePrompt(ch, info) {
    if (info && info.why === 'name' && info.exact && info.name) return info.name + 'の ' + ch + '。' + TRACE_TAIL;
    var kw = kanjiWord(ch);
    if (kw) return kw.speech + '。' + TRACE_TAIL;
    var ex = exampleOf(ch); return (ex !== ch ? ex + 'の ' : '') + ch + '。' + TRACE_TAIL;
  }
  function tracePromptAlt(ch, info) { return info && info.why === 'name' && info.exact && info.name ? tracePrompt(ch, null) : ''; }
  function soloPrompt(ch) { return tracePrompt(ch, null).replace(TRACE_TAIL, SOLO_TAIL); }
  function traceDoneWord(ch) { var kw = kanjiWord(ch); return kw ? kw.yomi : ch; }
  function traceDone(ch, nazori) { return nazori ? FIXED.traced : 'できた！ ' + traceDoneWord(ch) + '！'; }
  function soloDone(ch) { return 'ひとりで かけたね！ ' + traceDoneWord(ch) + '！'; }
  // 字の札（「かいて みる？」）
  function mojiSheet(ch) {
    var kw = kanjiWord(ch), ex = kw ? '' : exampleOf(ch);
    return (kw ? kw.speech + '。' : (ex !== ch ? ex + 'の ' : '') + ch + '。') + FIXED.tryWrite;
  }

  // ごほうび・昇格・しゃこ
  function license(set) { return SET_LABEL[set] + ' めんきょを、もらったよ！'; }
  function carGet(car) { return carYomi(car) + 'を、ゲット！'; }
  function promote(stg) { return stg.rank + 'に、しょうかく！'; }
  // きょうの しゅつどう: 「とくに がんばった」「あしたは これも」。ゲームは GAME_NAME の 5 つ（かく は ひとりで かく を含む）
  function todayCrown(game) { return '今日は ' + GAME_NAME[game] + 'を、とくに がんばったね！'; }
  function todayInvite(game) { return 'あしたは ' + GAME_NAME[game] + 'も、やってみる？'; }
  function shelfHow(game) { return GAME_NAME[game] + 'で あそぶと ふえるよ'; }

  // ---- 出動の始めに先読みする文（日本語だけ。英語は端末の声）。名前の文は含めない ----
  function uniq(list) { var seen = {}; return list.filter(function (t) { if (!t || seen[t]) return false; seen[t] = true; return true; }); }
  function questionTexts(q) {
    var out = [prompt(q), correct(q)];
    if (q.kind === 'mul') out.push(prompt(Object.assign({}, q, { formula: !q.formula, picShown: false })));   // 式だけ／絵つきの両方の文（タップで切り替わる）
    (q.choices || []).forEach(function (v) { if (v !== q.answer) out.push(wrong(q, v)); });
    out.push(hint(q));
    if (q.kind === 'count' || q.kind === 'add' || q.kind === 'sub' || q.kind === 'mul') {
      var top = Math.max(+q.answer || 0, +q.n || 0, +q.a || 0, +q.b || 0);
      for (var n = 1; n <= top && n <= 100; n++) out.push(number(n));
    }
    return out;
  }
  function sessionTexts(qs) {
    var out = [];
    (qs || []).forEach(function (q) { out = out.concat(questionTexts(q)); });
    return uniq(out);
  }
  // 「かく」の 1 出動ぶん。chars = 字の配列、infos = 字ごとの info（名前の枠。無くてよい）。名前の文は alt の方を入れる
  function traceTexts(chars, infos) {
    var out = [FIXED.dispatch, FIXED.roundStart, FIXED.together, FIXED.assisted, FIXED.traced];
    (chars || []).forEach(function (ch, i) {
      var info = infos && infos[i];
      out.push(tracePromptAlt(ch, info) || tracePrompt(ch, info), soloPrompt(ch), traceDone(ch, false), soloDone(ch));
    });
    return uniq(out);
  }

  var api = {
    FIXED: FIXED, TIME_PREFIX: TIME_PREFIX, SET_LABEL: SET_LABEL, GAME_NAME: GAME_NAME,
    number: number, wordOf: wordOf, yomiOf: yomiOf, carYomi: carYomi, isSpecialLetter: isSpecialLetter, exampleOf: exampleOf, correctExample: correctExample, kanjiWord: kanjiWord,
    prompt: prompt, wrong: wrong, hint: hint, correct: correct, who: who,
    tracePrompt: tracePrompt, tracePromptAlt: tracePromptAlt, soloPrompt: soloPrompt, traceDoneWord: traceDoneWord, traceDone: traceDone, soloDone: soloDone, mojiSheet: mojiSheet,
    license: license, carGet: carGet, promote: promote, shelfHow: shelfHow, todayCrown: todayCrown, todayInvite: todayInvite,
    questionTexts: questionTexts, sessionTexts: sessionTexts, traceTexts: traceTexts
  };
  if (node) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.lines = api; }
})(typeof window !== 'undefined' ? window : globalThis);
