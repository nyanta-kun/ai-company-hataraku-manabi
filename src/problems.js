// 問題生成・レベル昇降級（純粋関数。DOM・音・時間に依存しない）。
// ブラウザでは window.Manabi.problems、Node では module.exports。
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.Manabi.data;

  var QUESTIONS_PER_SESSION = 4;   // 1 回の出動の問題数（調整可）
  var PROMOTE_AT = 4;              // 1 回目正解がこれ以上なら昇級
  var DEMOTE_AT = 1;               // 1 回目正解がこれ以下なら降級

  var LEVELS = { math: ['M1', 'M2', 'M3', 'M4', 'M5'], letter: ['K1', 'K2', 'K3'], clock: ['T1', 'T2', 'T3'] };
  // 数のレベル: max = 選択肢の範囲の上限、choices = 選択肢の数
  var MATH = {
    M1: { kind: 'count', max: 3,  choices: 3 },
    M2: { kind: 'count', max: 5,  choices: 3 },
    M3: { kind: 'count', max: 10, choices: 4 },
    M4: { kind: 'add',   max: 5,  choices: 3 },
    M5: { kind: 'add',   max: 10, choices: 4 }
  };
  var LETTER = { K1: { choices: 2 }, K2: { choices: 3 }, K3: { choices: 4 } };

  // とけい: form = read（時計を見て数字）/ pick（読み上げを聞いて時計を選ぶ）、half = ○じはんを出す
  var CLOCK = {
    T1: { form: 'read', half: false, choices: 2 },
    T2: { form: 'pick', half: false, choices: 4 },
    T3: { form: 'pick', half: true,  choices: 4 }
  };

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
  // 形が似た文字（複数ありうる。は → ほ・け）
  function confusablesOf(ch) {
    var out = [];
    D.CONFUSABLE.forEach(function (p) {
      if (p[0] === ch) out.push(p[1]);
      else if (p[1] === ch) out.push(p[0]);
    });
    return out;
  }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  // 指定の語で国語の問題を作る（選択肢を決める）。誤答は単語表の頭文字から選び、正解の頭文字は混ぜない
  function buildLetter(level, word, rng) {
    var L = LETTER[level];
    var pool = wordPool(level), ans = word.head;
    var letters = uniq(pool.map(function (w) { return w.head; }));
    var need = L.choices - 1, out = [], sims = confusablesOf(ans);
    function clash(c) { return c === ans || sims.indexOf(c) >= 0 || out.some(function (o) { return confusablesOf(o).indexOf(c) >= 0; }); }
    if (level === 'K3') {
      // 形が似た文字を 1 つ混ぜてよい（半分の確率）。それ以外の誤答は、正解や互いに似た文字を避ける
      var simIn = shuffle(sims.filter(function (c) { return letters.indexOf(c) >= 0; }), rng);
      if (simIn.length && rng() < 0.5) out.push(simIn[0]);
      shuffle(letters, rng).forEach(function (c) {
        if (out.length >= need || out.indexOf(c) >= 0 || (c === ans || sims.indexOf(c) >= 0)) return;
        if (out.some(function (o) { return confusablesOf(o).indexOf(c) >= 0; })) return;
        out.push(c);
      });
    } else {
      // K1/K2: 行ファミリー（は行は清音・濁音・半濁音をまとめる）が違う文字だけを選ぶ。正解や互いに似た文字も避ける
      var fams = {}; fams[D.FAMILY[ans]] = true;
      shuffle(letters, rng).forEach(function (c) {
        if (out.length >= need || fams[D.FAMILY[c]] || clash(c)) return;
        fams[D.FAMILY[c]] = true; out.push(c);
      });
    }
    out.push(ans);
    return { kind: 'letter', level: level, script: 'hira', wordId: word.id, word: word.label, pic: word.pic,
      choices: shuffle(out, rng), answer: ans };
  }

  // 1 問だけ作る。prevWordId と avoid（{ wordIds, pics, answers } の配列。省略可）に当たる語は選ばない（候補が無ければ prevWordId だけ避ける）
  function generateLetter(level, rng, prevWordId, avoid) {
    rng = defRng(rng);
    if (!LETTER[level]) throw new RangeError('letter level: ' + level);
    avoid = avoid || {};
    var pool = wordPool(level);
    var cands = pool.filter(function (w) {
      return w.id !== prevWordId && !(avoid.wordIds && avoid.wordIds.indexOf(w.id) >= 0) &&
        !(avoid.pics && avoid.pics.indexOf(w.pic) >= 0) && !(avoid.answers && avoid.answers.indexOf(w.head) >= 0);
    });
    if (!cands.length) cands = pool.filter(function (w) { return w.id !== prevWordId; });
    return buildLetter(level, cands[randInt(rng, 0, cands.length - 1)], rng);
  }

  // ---- 国語の出題の偏り防止（plan-katakana-english.md 2.9） ----
  function isFire(w) { return w.cat === 'fire'; }

  // 4 語を選ぶ。stage 0=全部の規則、1=分類の規則を外す、2=行ファミリーも外す、3=答えの文字の重複も許す（同じ語・同じ絵は常に禁止）。
  // 直近の絵の除外は、planned 個（plan 2.9-B1）から始め、候補が 4 未満になるか、規則を満たせないときは古い順に解く。
  // ただし規則（stage 0）を満たすための解禁は直前の出動の 4 枚（4 個）までで、それ以降は規則のほうを緩める
  function pickWords(level, rng, recent) {
    var pool = wordPool(level);
    var n = Math.max(4, Math.min(D.SEEN_MAX, Math.floor(uniq(pool.map(function (w) { return w.pic; })).length / 2)));
    function candsFor(k) {
      var ex = k > 0 ? recent.slice(-k) : [];
      return pool.filter(function (w) { return ex.indexOf(w.pic) < 0; });
    }
    for (; n > 0 && candsFor(n).length < QUESTIONS_PER_SESSION; n--);
    function attempt(cands, stage) {
      var mix = level === 'K3' && cands.some(isFire) && cands.some(function (w) { return !isFire(w); });
      for (var tries = 0; tries < 300; tries++) {
        var chosen = [], fam = {}, cat = {}, ans = {}, pics = {};
        var order = shuffle(cands, rng);
        order.forEach(function (w) {
          if (chosen.length >= QUESTIONS_PER_SESSION || pics[w.pic]) return;
          var f = D.FAMILY[w.head];
          if (stage < 3 && ans[w.head]) return;
          if (stage < 2 && (fam[f] || 0) >= 2) return;
          if (stage < 1 && (cat[w.cat] || 0) >= 3) return;
          chosen.push(w); pics[w.pic] = true; ans[w.head] = true; fam[f] = (fam[f] || 0) + 1; cat[w.cat] = (cat[w.cat] || 0) + 1;
        });
        if (chosen.length < QUESTIONS_PER_SESSION) continue;
        if (stage < 1 && mix && !(chosen.some(isFire) && chosen.some(function (w) { return !isFire(w); }))) continue;
        return chosen;
      }
      return null;
    }
    var r, k;
    for (k = n; k >= Math.min(n, QUESTIONS_PER_SESSION); k--) { r = attempt(candsFor(k), 0); if (r) return r; }
    for (var stage = 1; stage <= 3; stage++) { r = attempt(candsFor(n), stage); if (r) return r; }
    // 語が 4 つに満たない表（通常は起きない）。空の出動にしないため、足りない分は表から重複なしで足し、それでも足りなければ繰り返す
    var out = shuffle(pool, rng).slice(0, QUESTIONS_PER_SESSION);
    while (out.length < QUESTIONS_PER_SESSION) out.push(pool[out.length % pool.length]);
    return out;
  }

  // ---- とけい ----
  function readTime(h, m) { return D.TIME_KANA[h] + (m === 30 ? 'はん' : ''); }
  function clockKey(h, m) { return h + ':' + (m === 30 ? '30' : '00'); }
  function parseKey(key) { var a = key.split(':'); return { h: +a[0], m: +a[1] }; }
  // 'h:mm' または 'swap:N' -> 短針・長針の角度（12時方向が 0 度、時計回り）
  function handAngles(key) {
    if (key.indexOf('swap:') === 0) return { hour: 0, minute: (+key.slice(5)) * 30 };
    var t = parseKey(key);
    return { hour: (t.h % 12) * 30 + t.m / 2, minute: t.m * 6 };
  }
  function angDiff(a, b) { var d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); }
  // 2 つの絵が「ほぼ同じ」でない（長針 60 度以上、または短針 30 度以上ちがう）
  function distinctFaces(k1, k2) {
    var a = handAngles(k1), b = handAngles(k2);
    return angDiff(a.minute, b.minute) >= 60 || angDiff(a.hour, b.hour) >= 30;
  }
  function wrapH(h) { return ((h - 1 + 12) % 12) + 1; }
  function hourDist(a, b) { var d = Math.abs(a - b); return Math.min(d, 12 - d); }

  function generateClock(level, rng, prevKey) {
    rng = defRng(rng);
    var L = CLOCK[level];
    if (!L) throw new RangeError('clock level: ' + level);
    var prev = prevKey ? parseKey(prevKey) : null, hs = [], i;
    for (i = 1; i <= 12; i++) if (!prev || prev.h !== i) hs.push(i);
    var h, m;
    if (L.half) {
      var cands = [];
      for (i = 1; i <= 12; i++) [0, 30].forEach(function (mm) { if (!prev || prev.h !== i || prev.m !== mm) cands.push([i, mm]); });
      var c = cands[randInt(rng, 0, cands.length - 1)]; h = c[0]; m = c[1];
    } else { h = hs[randInt(rng, 0, hs.length - 1)]; m = 0; }

    if (L.form === 'read') {
      // 誤答: 12 を一周する数え方で 3 以上はなれた数字
      var far = [];
      for (i = 1; i <= 12; i++) if (hourDist(i, h) >= 3) far.push(i);
      var w = far[randInt(rng, 0, far.length - 1)];
      return { kind: 'clock', level: level, form: 'read', h: h, m: 0, choices: shuffle([h, w], rng), answer: h };
    }

    var ans = clockKey(h, m), choices = [ans];
    function tryAdd(key) {
      if (choices.length >= L.choices || choices.indexOf(key) >= 0) return;
      if (choices.every(function (k) { return distinctFaces(k, key); })) choices.push(key);
    }
    // 優先: 隣の時刻 → 長針と短針の取り違え → 同じ時で ○じ/はん ちがい → もう一方の隣 → 残り全部
    var adj = shuffle([clockKey(wrapH(h - 1), m), clockKey(wrapH(h + 1), m)], rng);
    tryAdd(adj[0]);
    if (m === 0 && h !== 12) tryAdd('swap:' + h);
    if (L.half) tryAdd(clockKey(h, m === 0 ? 30 : 0));
    tryAdd(adj[1]);
    var rest = [];
    for (i = 1; i <= 12; i++) { rest.push(clockKey(i, 0)); if (L.half) rest.push(clockKey(i, 30)); }
    shuffle(rest, rng).forEach(tryAdd);
    return { kind: 'clock', level: level, form: 'pick', h: h, m: m, choices: shuffle(choices, rng), answer: ans };
  }

  function sameProblem(p, q) {
    if (!p || !q || p.kind !== q.kind) return false;
    if (p.kind === 'count') return p.n === q.n;
    if (p.kind === 'add') return p.a === q.a && p.b === q.b;
    if (p.kind === 'clock') return p.h === q.h && p.m === q.m;
    return p.wordId === q.wordId;
  }

  // recentPics: 国語だけが使う。直近の出動で出した絵（古い順）。連続する出動で同じ絵が出にくくなる
  function generateSession(game, level, rng, recentPics) {
    rng = defRng(rng);
    if (game === 'letter') {
      if (!LETTER[level]) throw new RangeError('letter level: ' + level);
      return pickWords(level, rng, D.cleanSeen(recentPics)).map(function (w) { return buildLetter(level, w, rng); });
    }
    var list = [], tries = 0;
    while (list.length < QUESTIONS_PER_SESSION) {
      var prev = list[list.length - 1], p;
      if (game === 'math') {
        p = MATH[level].kind === 'count' ? generateCounting(level, rng) : generateAddition(level, rng);
        if (sameProblem(prev, p) && ++tries < 1000) continue;
      } else if (game === 'clock') {
        p = generateClock(level, rng, prev && clockKey(prev.h, prev.m));
        if (list.some(function (q) { return sameProblem(q, p); }) && ++tries < 1000) continue;
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
    LEVELS: LEVELS, MATH: MATH, LETTER: LETTER, CLOCK: CLOCK,
    generateCounting: generateCounting, generateAddition: generateAddition,
    generateLetter: generateLetter, buildLetter: buildLetter, generateClock: generateClock, handAngles: handAngles, readTime: readTime,
    clockKey: clockKey, sameProblem: sameProblem, generateSession: generateSession, nextLevel: nextLevel
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.problems = api; }
})(typeof window !== 'undefined' ? window : globalThis);
