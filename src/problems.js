// 問題生成・レベル昇降級（純粋関数。DOM・音・時間に依存しない）。
// ブラウザでは window.Manabi.problems、Node では module.exports。
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.Manabi.data;

  var QUESTIONS_PER_SESSION = 4;   // 1 回の出動の問題数（調整可）
  var PROMOTE_AT = 4;              // 1 回目正解がこれ以上なら昇級
  var DEMOTE_AT = 1;               // 1 回目正解がこれ以下なら降級

  var LEVELS = { math: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'], letter: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'], clock: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'], english: ['E1', 'E2', 'E3'] };
  // 数のレベル: max = 選択肢の範囲の上限、choices = 選択肢の数
  var MATH = {
    M1: { kind: 'count', max: 3,  choices: 3 },
    M2: { kind: 'count', max: 5,  choices: 3 },
    M3: { kind: 'count', max: 10, choices: 4 },
    M4: { kind: 'add',   max: 5,  choices: 3 },
    M5: { kind: 'add',   max: 10, choices: 4 },
    M6: { kind: 'sub',   max: 5,  choices: 3 },
    M7: { kind: 'sub',   max: 10, choices: 4 }
  };
  // sim = 形が似た文字を 1 つ混ぜてよい。script = 出す文字種（K6 は問題ごとに語の表記で決まる）
  var LETTER = {
    K1: { choices: 2 }, K2: { choices: 3 }, K3: { choices: 4, sim: true },
    K4: { choices: 2, script: 'kata' }, K5: { choices: 4, script: 'kata', sim: true }, K6: { choices: 4, script: 'mixed', sim: true }
  };

  // とけい: form = read（時計を見て数字）/ pick（読み上げを聞いて時計を選ぶ）、half = ○じはんを出す
  var CLOCK = {
    T1: { form: 'read', half: false, choices: 2 },
    T2: { form: 'pick', half: false, choices: 4 },
    T3: { form: 'pick', half: true,  choices: 4 },
    // T4・T5: 細かい分（mins = 出す分）。ticks = 時計の目盛り（12 か 60）。T6: ◯時から△分たったら（経過時間）
    T4: { form: 'pick', mins: [0, 15, 30, 45], choices: 4, ticks: 12 },
    T5: { form: 'pick', mins: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], choices: 4, ticks: 60 },
    T6: { form: 'elapsed', starts: [0, 30], durations: [10, 20, 30, 40, 60], choices: 4, ticks: 60 }
  };

  // えいご: 問題の form = word（乗り物の英語を聞いて絵を選ぶ）/ number（英語の数を聞いて数を選ぶ）
  // E1 は乗り物だけ。E2・E3 は 1 回の出動に乗り物 words 問と数を混ぜる（数ばかりにならないように）
  var ENGLISH = {
    E1: { words: 4, wordChoices: 3 },
    E2: { words: 2, wordChoices: 3, max: 5,  choices: 3 },
    E3: { words: 2, wordChoices: 4, max: 10, choices: 4 }
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

  // ひきざん: a（引かれる数）を先に決め、b は 1〜a-1（答えは 1 以上）。M7 は a 6 以上を約 75% にする
  function generateSubtraction(level, rng) {
    rng = defRng(rng);
    var L = MATH[level];
    if (!L || L.kind !== 'sub') throw new RangeError('sub level: ' + level);
    var a;
    if (level === 'M7' && rng() < 0.75) a = randInt(rng, 6, L.max);   // はずれても 2〜max から選ぶので、a≥6 は全体で約9割
    else a = randInt(rng, 2, L.max);
    var b = randInt(rng, 1, a - 1), ans = a - b;
    // 選択肢は 1〜a（a は「引き忘れ」の誤答）。a より大きい数は答えになりえず消去法で当たるので出さない。a が小さく足りないときだけ広げる
    return { kind: 'sub', level: level, a: a, b: b, choices: numberChoices(ans, Math.max(a, L.choices), L.choices, rng), answer: ans };
  }

  function wordPool(level) {
    if (level === 'K4' || level === 'K5') return D.KATA_WORDS;
    if (level === 'K6') return D.ALL_WORDS;
    return D.WORDS.filter(function (w) { return level === 'K1' ? w.group === 'A' : true; });
  }
  function scriptOf(w) { return w.script === 'kata' ? 'kata' : 'hira'; }
  // 形が似た文字（複数ありうる。は → ほ・け）
  function confusablesOf(ch) {
    var out = [];
    D.CONFUSABLE.concat(D.CONFUSABLE_KATA).forEach(function (p) {
      if (p[0] === ch) out.push(p[1]);
      else if (p[1] === ch) out.push(p[0]);
    });
    return out;
  }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  // 指定の語で国語の問題を作る（選択肢を決める）。誤答は単語表の頭文字から選び、正解の頭文字は混ぜない
  function buildLetter(level, word, rng) {
    var L = LETTER[level];
    var script = scriptOf(word), ans = word.head;
    // 選択肢の文字種は問題の語の表記にそろえる（K6 でも だ と ダ を同時に出さない）
    var pool = wordPool(level).filter(function (w) { return scriptOf(w) === script; });
    var letters = uniq(pool.map(function (w) { return w.head; }));
    var need = L.choices - 1, out = [], sims = confusablesOf(ans);
    function clash(c) { return c === ans || sims.indexOf(c) >= 0 || out.some(function (o) { return confusablesOf(o).indexOf(c) >= 0; }); }
    if (L.sim) {
      // 形が似た文字を 1 つ混ぜてよい（半分の確率）。それ以外の誤答は、正解や互いに似た文字を避ける。カタカナは頭文字にならない追加文字も相手にできる
      var simIn = shuffle(sims.filter(function (c) { return letters.indexOf(c) >= 0 || (script === 'kata' && D.EXTRA_KATA[c]); }), rng);
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
    return { kind: 'letter', level: level, script: script, wordId: word.id, word: word.label, pic: word.pic,
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
      var mix = (level === 'K3' || level === 'K5' || level === 'K6') && pool.some(isFire) && pool.some(function (w) { return !isFire(w); });   // 候補ではなく出題元全体で決める（直近の除外で消防が候補から消えても、除外を解いて入れる）
      for (var tries = 0; tries < 300; tries++) {
        var chosen = [], fam = {}, cat = {}, ans = {}, pics = {};
        var needKata = level === 'K6';
        var order = shuffle(cands, rng);
        order.forEach(function (w) {
          if (chosen.length >= QUESTIONS_PER_SESSION || pics[w.pic]) return;
          var f = D.FAMILY[w.head], key = D.toHira(w.head);   // だ と ダ は同じ音なので同じ答え扱い
          if (stage < 3 && ans[key]) return;
          if (stage < 2 && (fam[f] || 0) >= 2) return;
          if (stage < 1 && (cat[w.cat] || 0) >= 3) return;
          chosen.push(w); pics[w.pic] = true; ans[key] = true; fam[f] = (fam[f] || 0) + 1; cat[w.cat] = (cat[w.cat] || 0) + 1;
        });
        if (chosen.length < QUESTIONS_PER_SESSION) continue;
        if (needKata && !(chosen.some(function (w) { return scriptOf(w) === 'kata'; }) && chosen.some(function (w) { return scriptOf(w) === 'hira'; }))) continue;
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
  function readMinutes(m) { return D.MIN_KANA[m] || ''; }
  function readTime(h, m) { return D.TIME_KANA[h] + (m === 0 ? '' : m === 30 ? 'はん' : readMinutes(m)); }
  function clockKey(h, m) { return h + ':' + (m < 10 ? '0' : '') + m; }
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

  // 選択肢を作る共通部分。prefs = 優先して入れる候補キー（順に試す）、restKeys = 最後に無作為な順で試す全候補
  function fillChoices(ans, prefs, restKeys, count, rng) {
    var choices = [ans];
    function tryAdd(key) {
      if (choices.length >= count || choices.indexOf(key) >= 0) return;
      if (choices.every(function (k) { return distinctFaces(k, key); })) choices.push(key);
    }
    prefs.forEach(tryAdd);
    shuffle(restKeys, rng).forEach(tryAdd);
    return shuffle(choices, rng);
  }
  function allKeys(mins) {
    var out = [];
    for (var i = 1; i <= 12; i++) mins.forEach(function (mm) { out.push(clockKey(i, mm)); });
    return out;
  }

  // T4・T5: 細かい分を聞いて時計を選ぶ。直前と同じ時刻は避ける
  function generateMinutes(level, rng, prevKey) {
    var L = CLOCK[level], prev = prevKey ? parseKey(prevKey) : null, cands = [], i;
    for (i = 1; i <= 12; i++) L.mins.forEach(function (mm) { if (!prev || prev.h !== i || prev.m !== mm) cands.push([i, mm]); });
    var c = cands[randInt(rng, 0, cands.length - 1)], h = c[0], m = c[1], ans = clockKey(h, m);
    // 優先: 隣の時（同じ分）→ 同じ時で長針ちがい → 長針と短針の取り違え → もう一方の隣 → 残り全部
    var adj = shuffle([clockKey(wrapH(h - 1), m), clockKey(wrapH(h + 1), m)], rng);
    var sameH = shuffle(L.mins.filter(function (mm) { return mm !== m; }), rng).map(function (mm) { return clockKey(h, mm); });
    var prefs = [adj[0], sameH[0]];
    if (m === 0 && h !== 12) prefs.push('swap:' + h);
    prefs.push(adj[1]);
    return { kind: 'clock', level: level, form: 'pick', h: h, m: m,
      choices: fillChoices(ans, prefs, allKeys(L.mins), L.choices, rng), answer: ans, ticks: L.ticks };
  }

  // T6: ◯時から△分たったら。開始は ちょうど・はん、答えは 12 時を越えたら 1 時に戻る。prevKey = 直前の答え（避ける）
  function addMinutes(h0, m0, dm) {
    var t = h0 * 60 + m0 + dm;
    return { h: wrapH(Math.floor(t / 60)), m: t % 60 };
  }
  function generateElapsed(level, rng, prevKey) {
    var L = CLOCK[level], cands = [], i;
    for (i = 1; i <= 12; i++) L.starts.forEach(function (m0) { L.durations.forEach(function (dm) {
      var a = addMinutes(i, m0, dm);
      if (!prevKey || clockKey(a.h, a.m) !== prevKey) cands.push([i, m0, dm, a]);
    }); });
    var c = cands[randInt(rng, 0, cands.length - 1)], h0 = c[0], m0 = c[1], dm = c[2], a = c[3], ans = clockKey(a.h, a.m);
    // 優先: 開始時刻そのもの（進めていない）→ 別の経過 → 答えの 1 時間ずれ → 残り全部
    var others = shuffle(L.durations.filter(function (d) { return d !== dm; }), rng).map(function (d) {
      var o = addMinutes(h0, m0, d); return clockKey(o.h, o.m);
    });
    var shift = shuffle([clockKey(wrapH(a.h - 1), a.m), clockKey(wrapH(a.h + 1), a.m)], rng);
    var prefs = [clockKey(h0, m0), others[0], shift[0], others[1], shift[1]];
    var mins = []; for (i = 0; i < 60; i += 5) mins.push(i);
    return { kind: 'clock', level: level, form: 'elapsed', h0: h0, m0: m0, dm: dm, h: a.h, m: a.m,
      choices: fillChoices(ans, prefs, allKeys(mins), L.choices, rng), answer: ans, ticks: L.ticks };
  }

  function generateClock(level, rng, prevKey) {
    rng = defRng(rng);
    var L = CLOCK[level];
    if (!L) throw new RangeError('clock level: ' + level);
    var prev = prevKey ? parseKey(prevKey) : null, hs = [], i;
    if (L.form === 'elapsed') return generateElapsed(level, rng, prevKey);
    if (L.mins) return generateMinutes(level, rng, prevKey);
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

  // ---- えいご ----
  // 指定の答え（語の id または数）で 1 問作る。語の誤答は、正解や互いに違う group の語から選ぶ
  function buildEnglish(level, answer, rng) {
    var L = ENGLISH[level];
    if (typeof answer === 'number') {
      return { kind: 'english', level: level, form: 'number', n: answer, en: D.NUM_EN[answer], ja: D.NUM_KANA[answer],
        choices: numberChoices(answer, L.max, L.choices, rng), answer: answer };
    }
    var word = D.ENGLISH_WORDS.filter(function (w) { return w.id === answer; })[0];
    var out = [], groups = {}; groups[word.group] = true;
    shuffle(D.ENGLISH_WORDS, rng).forEach(function (w) {
      if (out.length >= L.wordChoices - 1 || groups[w.group]) return;
      groups[w.group] = true; out.push(w.id);
    });
    out.push(word.id);
    return { kind: 'english', level: level, form: 'word', wordId: word.id, en: word.en, ja: word.ja, pic: word.pic,
      choices: shuffle(out, rng), answer: word.id };
  }
  function wordKeys() { return D.ENGLISH_WORDS.map(function (w) { return w.id; }); }
  function numberKeys(level) { var out = [], max = ENGLISH[level].max || 0; for (var i = 1; i <= max; i++) out.push(i); return out; }
  // 1 問だけ作る。prevKey（直前の語の id または数）は避ける
  function generateEnglish(level, rng, prevKey) {
    rng = defRng(rng);
    if (!ENGLISH[level]) throw new RangeError('english level: ' + level);
    var keys = wordKeys().concat(numberKeys(level)).filter(function (k) { return k !== prevKey; });
    return buildEnglish(level, keys[randInt(rng, 0, keys.length - 1)], rng);
  }
  // 1 回の出動の 4 問。乗り物 words 問＋残りは数。答えは重複させない。順番は無作為だが連続は起きない
  function generateEnglishSession(level, rng) {
    rng = defRng(rng);
    if (!ENGLISH[level]) throw new RangeError('english level: ' + level);
    var nw = ENGLISH[level].words;
    var keys = shuffle(wordKeys(), rng).slice(0, nw).concat(shuffle(numberKeys(level), rng).slice(0, QUESTIONS_PER_SESSION - nw));
    return shuffle(keys, rng).map(function (k) { return buildEnglish(level, k, rng); });
  }

  function sameProblem(p, q) {
    if (!p || !q || p.kind !== q.kind) return false;
    if (p.kind === 'count') return p.n === q.n;
    if (p.kind === 'add' || p.kind === 'sub') return p.a === q.a && p.b === q.b;
    if (p.kind === 'clock') {
      if (p.form === 'elapsed' || q.form === 'elapsed') {
        return p.form === q.form && ((p.h0 === q.h0 && p.m0 === q.m0 && p.dm === q.dm) || (p.h === q.h && p.m === q.m));
      }
      return p.h === q.h && p.m === q.m;
    }
    if (p.kind === 'english') return p.form === q.form && (p.form === 'number' ? p.n === q.n : p.wordId === q.wordId);
    return p.wordId === q.wordId;
  }

  // recentPics: 国語だけが使う。直近の出動で出した絵（古い順）。連続する出動で同じ絵が出にくくなる
  function generateSession(game, level, rng, recentPics) {
    rng = defRng(rng);
    if (game === 'letter') {
      if (!LETTER[level]) throw new RangeError('letter level: ' + level);
      return pickWords(level, rng, D.cleanSeen(recentPics)).map(function (w) { return buildLetter(level, w, rng); });
    }
    if (game === 'english') return generateEnglishSession(level, rng);
    var list = [], tries = 0;
    while (list.length < QUESTIONS_PER_SESSION) {
      var prev = list[list.length - 1], p;
      if (game === 'math') {
        p = MATH[level].kind === 'count' ? generateCounting(level, rng) : MATH[level].kind === 'sub' ? generateSubtraction(level, rng) : generateAddition(level, rng);
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
    LEVELS: LEVELS, MATH: MATH, LETTER: LETTER, CLOCK: CLOCK, ENGLISH: ENGLISH,
    generateEnglish: generateEnglish, buildEnglish: buildEnglish,
    generateCounting: generateCounting, generateAddition: generateAddition, generateSubtraction: generateSubtraction,
    generateLetter: generateLetter, buildLetter: buildLetter, generateClock: generateClock, handAngles: handAngles, readTime: readTime, readMinutes: readMinutes,
    clockKey: clockKey, sameProblem: sameProblem, generateSession: generateSession, nextLevel: nextLevel
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.problems = api; }
})(typeof window !== 'undefined' ? window : globalThis);
