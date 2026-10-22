// 問題生成・レベル昇降級（純粋関数。DOM・音・時間に依存しない）。
// ブラウザでは window.Manabi.problems、Node では module.exports。
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.Manabi.data;

  var QUESTIONS_PER_SESSION = 4;   // 1 回の出動の問題数（調整可）
  var PROMOTE_AT = 4;              // 1 回目正解がこれ以上なら昇級
  var DEMOTE_AT = 1;               // 1 回目正解がこれ以下なら降級

  var LEVELS = { math: ['M1', 'M2', 'M3', 'M4', 'M5'], letter: ['K1', 'K2', 'K3'] };
  // 数のレベル: max = 選択肢の範囲の上限、choices = 選択肢の数
  var MATH = {
    M1: { kind: 'count', max: 3,  choices: 3 },
    M2: { kind: 'count', max: 5,  choices: 3 },
    M3: { kind: 'count', max: 10, choices: 4 },
    M4: { kind: 'add',   max: 5,  choices: 3 },
    M5: { kind: 'add',   max: 10, choices: 4 }
  };
  var LETTER = { K1: { choices: 2 }, K2: { choices: 3 }, K3: { choices: 4 } };

  function defRng(rng) { return typeof rng === 'function' ? rng : Math.random; }
  function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }   // lo..hi
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 数の選択肢: 正解 ±1〜2 を優先し、足りなければ範囲内の別の数で補う。昇順に並べる
  function numberChoices(answer, max, count, rng) {
    var near = [];
    [-1, 1, -2, 2].forEach(function (d) {
      var v = answer + d;
      if (v >= 1 && v <= max) near.push(v);
    });
    near = shuffle(near, rng);
    var out = near.slice(0, count - 1);
    if (out.length < count - 1) {
      var rest = [];
      for (var v = 1; v <= max; v++) if (v !== answer && out.indexOf(v) < 0) rest.push(v);
      rest = shuffle(rest, rng);
      out = out.concat(rest.slice(0, count - 1 - out.length));
    }
    out.push(answer);
    return out.sort(function (a, b) { return a - b; });
  }

  function generateCounting(level, rng) {
    rng = defRng(rng);
    var L = MATH[level];
    if (!L || L.kind !== 'count') throw new RangeError('count level: ' + level);
    var n = randInt(rng, 1, L.max);
    return { kind: 'count', level: level, n: n, choices: numberChoices(n, L.max, L.choices, rng), answer: n };
  }

  function generateAddition(level, rng) {
    rng = defRng(rng);
    var L = MATH[level];
    if (!L || L.kind !== 'add') throw new RangeError('add level: ' + level);
    // 和を先に決める。M5 は和 6 以上を約 75% にして「10 以内の大きめ」を多くする
    var sum;
    if (level === 'M5' && rng() < 0.75) sum = randInt(rng, 6, L.max);
    else sum = randInt(rng, 2, L.max);
    var a = randInt(rng, 1, sum - 1), b = sum - a;
    return { kind: 'add', level: level, a: a, b: b, choices: numberChoices(sum, L.max, L.choices, rng), answer: sum };
  }

  function wordPool(level) {
    return D.WORDS.filter(function (w) { return level === 'K1' ? w.group === 'A' : true; });
  }
  function confusableOf(ch) {
    for (var i = 0; i < D.CONFUSABLE.length; i++) {
      var p = D.CONFUSABLE[i];
      if (p[0] === ch) return p[1];
      if (p[1] === ch) return p[0];
    }
    return null;
  }

  function generateLetter(level, rng, prevWordId) {
    rng = defRng(rng);
    var L = LETTER[level];
    if (!L) throw new RangeError('letter level: ' + level);
    var pool = wordPool(level);
    var cands = pool.filter(function (w) { return w.id !== prevWordId; });
    var word = cands[randInt(rng, 0, cands.length - 1)];
    var ans = word.head;
    var letters = pool.map(function (w) { return w.head; });     // 誤答は単語表の文字から
    var need = L.choices - 1, out = [];
    if (level === 'K3') {
      // 形が似た文字を 1 つ混ぜてよい（単語表にある文字のみ）。半分の確率で混ぜる
      var sim = confusableOf(ans);
      if (sim && letters.indexOf(sim) >= 0 && rng() < 0.5) out.push(sim);
      var rest = shuffle(letters.filter(function (c) { return c !== ans && out.indexOf(c) < 0; }), rng);
      out = out.concat(rest.slice(0, need - out.length));
    } else {
      // K1/K2: 行が違う文字だけを選ぶ（互いの行も別）
      var rows = {}; rows[D.ROW[ans]] = true;
      shuffle(letters, rng).forEach(function (c) {
        if (out.length >= need || c === ans || rows[D.ROW[c]]) return;
        rows[D.ROW[c]] = true; out.push(c);
      });
    }
    out.push(ans);
    return { kind: 'letter', level: level, wordId: word.id, word: word.label, choices: shuffle(out, rng), answer: ans };
  }

  function sameProblem(p, q) {
    if (!p || !q || p.kind !== q.kind) return false;
    if (p.kind === 'count') return p.n === q.n;
    if (p.kind === 'add') return p.a === q.a && p.b === q.b;
    return p.wordId === q.wordId;
  }

  function generateSession(game, level, rng) {
    rng = defRng(rng);
    var list = [], tries = 0;
    while (list.length < QUESTIONS_PER_SESSION) {
      var prev = list[list.length - 1], p;
      if (game === 'letter') {
        p = generateLetter(level, rng, prev && prev.wordId);
        if (list.some(function (q) { return q.wordId === p.wordId; })) { if (++tries < 1000) continue; }
      } else if (game === 'math') {
        p = MATH[level].kind === 'count' ? generateCounting(level, rng) : generateAddition(level, rng);
        if (sameProblem(prev, p) && ++tries < 1000) continue;
      } else throw new RangeError('game: ' + game);
      list.push(p);
    }
    return list;
  }

  // レベルの昇降級（企画書 3.3）。locked なら変えない。範囲外の current も端に丸める
  function nextLevel(game, current, firstTryCorrectCount, locked) {
    var lv = LEVELS[game];
    if (!lv) throw new RangeError('game: ' + game);
    var i = lv.indexOf(current);
    if (i < 0) i = 0;
    if (locked) return lv[i];
    if (firstTryCorrectCount >= PROMOTE_AT) i = Math.min(lv.length - 1, i + 1);
    else if (firstTryCorrectCount <= DEMOTE_AT) i = Math.max(0, i - 1);
    return lv[i];
  }

  var api = {
    QUESTIONS_PER_SESSION: QUESTIONS_PER_SESSION, PROMOTE_AT: PROMOTE_AT, DEMOTE_AT: DEMOTE_AT,
    LEVELS: LEVELS, MATH: MATH, LETTER: LETTER,
    generateCounting: generateCounting, generateAddition: generateAddition,
    generateLetter: generateLetter, generateSession: generateSession, nextLevel: nextLevel
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.problems = api; }
})(typeof window !== 'undefined' ? window : globalThis);
