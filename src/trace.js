// なぞりがきの判定と字の選び方（design-tracing 3章）。純粋関数のみ（DOM・px・時刻を知らない。板の一辺 B だけ tolerance が受け取る）。
// 字形データは strokes.js（別ファイル・別ライセンス）から読むだけ。依存: strokes.js
// ブラウザでは window.Manabi.trace、Node では module.exports。
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var S = node ? require('./strokes.js') : root.Manabi.strokes;

  var DATA_SIZE = 1090;   // strokes.js の座標の最大（109 の 10 倍）
  // 3.3 の推奨値（実機で調整する）。板の一辺を 1 とした長さ。px の下限は tolerance だけが持つ
  var DEFAULTS = {
    h: 0.01,            // 手本の点の間隔
    nearBase: 0.065, nearMinPx: 22,
    offBase: 0.15, offMinPx: 48,
    offRun: 0.04,
    startBase: 0.10, startMinPx: 34,
    endP: 0.90,
    kanjiG: 0.85,       // 漢字は形が細かいので許容幅を絞る
    wide: 1.3,          // 「ひろめ」
    window: 0.12,       // 進度の前後だけを見る窓の長さ
    shortLen: 0.08,     // これより短い画は「点」（かな）
    kanjiShortLen: 0.2, // 漢字は 0.2 未満の画を「点」にする（火・雨・犬 の点など。design 10章）
    densifyDiv: 3       // 直前の点との間を near / 3 ごとに補う
  };

  var SET_NAMES = ['auto', 'hira', 'kata', 'k1', 'k2'];
  var WIDTH_NAMES = ['auto', 'wide', 'normal'];
  // ステージごとに選べる集合（未解放の集合は auto の扱い）
  var SETS_OF_STAGE = { S0: ['hira', 'kata'], S1: ['hira', 'kata', 'k1'], S2: ['hira', 'kata', 'k1', 'k2'] };

  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }

  // ---- 3.2 手本の点列 ----
  // 1 画（strokes.js の形）→ 弧長で等間隔 h の点列 [[x,y],…]（正規化座標）。始点と終点は必ず含める
  function strokePolyline(stroke, h) {
    if (typeof h !== 'number' || !(h > 0) || !isFinite(h)) h = DEFAULTS.h;
    var fine = [[stroke[0] / DATA_SIZE, stroke[1] / DATA_SIZE]];
    for (var i = 2; i + 5 < stroke.length; i += 6) {
      var p0 = fine[fine.length - 1];
      var x1 = stroke[i] / DATA_SIZE, y1 = stroke[i + 1] / DATA_SIZE, x2 = stroke[i + 2] / DATA_SIZE, y2 = stroke[i + 3] / DATA_SIZE;
      var x3 = stroke[i + 4] / DATA_SIZE, y3 = stroke[i + 5] / DATA_SIZE;
      var N = 48;
      for (var k = 1; k <= N; k++) {
        var t = k / N, u = 1 - t;
        fine.push([
          u * u * u * p0[0] + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * p0[1] + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
        ]);
      }
    }
    // 弧長で打ち直す
    var out = [fine[0]], acc = 0, next = h;
    for (var j = 1; j < fine.length; j++) {
      var a = fine[j - 1], b = fine[j], seg = dist(a, b);
      while (seg > 0 && acc + seg >= next - 1e-12) {
        var f = (next - acc) / seg;
        out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        next += h;
      }
      acc += seg;
    }
    var last = fine[fine.length - 1], tail = out[out.length - 1];
    if (dist(last, tail) > h * 0.25) out.push(last); else out[out.length - 1] = last;
    return out;
  }

  function polyLength(poly) {
    var l = 0;
    for (var i = 1; i < poly.length; i++) l += dist(poly[i - 1], poly[i]);
    return l;
  }
  function isDot(poly, len) { return polyLength(poly) < (typeof len === 'number' ? len : DEFAULTS.shortLen); }

  // 点 p から線分 a-b までの距離
  function distSeg(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(Math.pow(p[0] - (a[0] + t * dx), 2) + Math.pow(p[1] - (a[1] + t * dy), 2));
  }
  // 点列の [lo, hi] の範囲の線分との最短距離
  function distToRange(poly, p, lo, hi) {
    lo = Math.max(0, lo); hi = Math.min(poly.length - 1, hi);
    if (lo >= hi) return dist(p, poly[Math.min(lo, poly.length - 1)]);
    var d = Infinity;
    for (var i = lo; i < hi; i++) d = Math.min(d, distSeg(p, poly[i], poly[i + 1]));
    return d;
  }

  // ---- 3.3 許容幅 ----
  // B: 板の一辺（CSS px）, width: 'wide' | 'normal'（'auto' は呼ぶ側が traceWidth で決める）, script: 'kanji' なら g = 0.85
  function tolerance(B, width, script) {
    if (typeof B !== 'number' || !(B > 0) || !isFinite(B)) B = 600;   // 板の大きさが測れないときは iPad 縦の大きさ
    var k = width === 'wide' ? DEFAULTS.wide : 1;
    var g = script === 'kanji' ? DEFAULTS.kanjiG : 1;
    return {
      near: Math.max(DEFAULTS.nearBase * g, DEFAULTS.nearMinPx / B) * k,
      off: Math.max(DEFAULTS.offBase * g, DEFAULTS.offMinPx / B) * k,
      offRun: DEFAULTS.offRun,
      startR: Math.max(DEFAULTS.startBase, DEFAULTS.startMinPx / B) * k,
      endP: DEFAULTS.endP,
      dotLen: script === 'kanji' ? DEFAULTS.kanjiShortLen : DEFAULTS.shortLen   // これより短い画は「点」
    };
  }

  // ---- 3.6 助けの段階。m = その画のやり直しの回数（off と short の合計。reverse・miss は 3 回目から。recordAttempt）----
  // m=2 で near・off ×1.25、m=3 で ×1.5、m=4 以上で off を見ない。m>=5 は autoComplete（手本が書き足して次の画へ）
  function helpTolerance(tol, m) {
    var f = m >= 3 ? 1.5 : m >= 2 ? 1.25 : 1;
    return {
      near: tol.near * f, off: m >= 4 ? Infinity : tol.off * f, offRun: tol.offRun,
      startR: tol.startR, endP: tol.endP, dotLen: tol.dotLen
    };
  }
  function helpFor(m) {
    return {
      glowStart: m >= 1,        // 始点の丸が光る（声は字の中で最初の 1 回だけ。UI 側）
      animate: m >= 2,          // その画のアニメーション
      escort: m >= 3,           // しょうぼうしゃが道の先を走る
      autoComplete: m >= 5      // 手本がその画を書き足して次の画へ
    };
  }

  // ---- 3.5 補間 ----
  // a から b まで、step ごとの点（a は含まず b は含む）
  function densify(a, b, step) {
    var d = dist(a, b);
    if (d <= step) return [b];
    var n = Math.ceil(d / step), out = [];
    for (var i = 1; i <= n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
    return out;
  }

  // ---- 3.4 1 画の判定 ----
  function windowPts(poly) { return Math.max(1, Math.round(DEFAULTS.window / DEFAULTS.h)); }

  // 進度つき最近傍: idx から先の窓の中で p から near 以内の一番先の点
  // 窓は idx と ref（near〜off で追った位置）の先まで。near に戻ってきたら idx が追いつく。
  // 進度の窓は 2W（0.24）: 速い指が折り返しの先端を飛ばして戻り側に乗っても止めないため（正しくなぞる子を止めないことを、近道の防止より優先）
  function advance(poly, idx, ref, p, near) {
    var hi = Math.min(poly.length - 1, Math.max(idx, ref) + 2 * windowPts(poly)), best = idx;
    for (var j = idx; j <= hi; j++) {
      if (dist(p, poly[j]) > near) continue;
      best = j;
    }
    return best;
  }

  // near〜off の間をなぞっているときの位置 ref（進度 idx とは別。「外」の判定の窓の中心にだけ使う）。
  // ref から先の窓の中で p に一番近い点が off 以内なら、そこまで進める
  function softRef(poly, ref, p, off) {
    var hi = Math.min(poly.length - 1, ref + windowPts(poly)), best = ref, bd = Infinity;
    for (var j = ref; j <= hi; j++) { var d = dist(p, poly[j]); if (d < bd) { bd = d; best = j; } }
    return bd <= off ? best : ref;
  }

  function beginStroke(poly, p, tol) {
    var first = poly[0], lastPt = poly[poly.length - 1];
    var base = { idx: 0, ref: 0, last: p, offLen: 0, off: false, dot: false, travel: 0 };
    if (isDot(poly, tol.dotLen)) {
      // 点: 画のどこから押してもよい（off の中なら）
      if (distToRange(poly, p, 0, poly.length - 1) <= tol.off) {
        base.dot = true; base.inside = true;
        return { state: base, result: 'started' };
      }
      return { state: base, result: 'miss' };
    }
    if (dist(p, first) <= tol.startR) {
      base.idx = advance(poly, 0, 0, p, tol.near);
      base.ref = softRef(poly, 0, p, tol.off);
      return { state: base, result: 'started' };
    }
    if (dist(p, lastPt) <= tol.startR) return { state: base, result: 'reverse' };
    return { state: base, result: 'miss' };
  }

  function moveStroke(poly, state, pts, tol) {
    var st = { idx: state.idx, ref: state.ref, last: state.last, offLen: state.offLen, off: state.off, dot: state.dot, inside: state.inside, travel: state.travel };
    if (st.off) return { state: st, result: 'off' };
    var W = windowPts(poly), step = tol.near / DEFAULTS.densifyDiv;
    for (var a = 0; a < pts.length; a++) {
      var seq = densify(st.last, pts[a], step);
      for (var b = 0; b < seq.length; b++) {
        var q = seq[b];
        if (st.dot) {
          st.inside = distToRange(poly, q, 0, poly.length - 1) <= tol.off;
        } else {
          st.travel += dist(st.last, q);
          st.idx = advance(poly, st.idx, st.ref, q, tol.near);
          st.ref = Math.max(st.ref, st.idx);
          st.ref = softRef(poly, st.ref, q, tol.off);
          var d = distToRange(poly, q, st.ref - W, st.ref + W);
          if (d > tol.off) {
            st.offLen += dist(st.last, q);
            if (st.offLen > tol.offRun) { st.off = true; st.last = pts[a]; return { state: st, result: 'off' }; }
          } else st.offLen = 0;
        }
        st.last = q;
      }
      st.last = pts[a];
    }
    return { state: st, result: 'ok' };
  }

  function endStroke(poly, state, tol) {
    if (state.off) return { result: 'off' };   // 大きく外れたときも、数えるのはここ（離したとき）の 1 回だけ。moveStroke の off は数えない（design 3.6）
    if (state.dot) return { result: state.inside ? 'done' : 'short' };
    if (state.idx < tol.endP * (poly.length - 1)) return { result: 'short' };
    return { result: 'done' };
  }

  // やり直しの数え方（3.6）。rec = { m, misses }。off・short は m を足す。reverse・miss は 3 回目から m を足す
  // （始点を光らせても押せない子も、必ず m=5 の手本の書き足しに届く）。started で miss の連続は 0 に戻る。done で m も戻す（次の画）
  function recordAttempt(rec, result) {
    var m = rec && rec.m > 0 ? rec.m : 0, misses = rec && rec.misses > 0 ? rec.misses : 0;
    if (result === 'off' || result === 'short') m++;
    else if (result === 'reverse' || result === 'miss') { misses++; if (misses >= 3) m++; }
    else if (result === 'started') misses = 0;
    else if (result === 'done') { m = 0; misses = 0; }
    return { m: m, misses: misses };
  }

  // 進度 0〜1（描画・テスト用）
  function progressOf(poly, state) { return poly.length > 1 ? state.idx / (poly.length - 1) : 1; }

  // ---- 3.7 字の選び方 ----
  function allowedSets(stageId) { return SETS_OF_STAGE[stageId] || SETS_OF_STAGE.S0; }
  function doneCount(trace, ch) {
    var n = trace && trace.done && trace.done[ch];
    return typeof n === 'number' && n > 0 ? n : 0;
  }
  // 「なぞる じ」。auto（または未解放の集合）: S0 はひらがなが残っていれば hira、全部書いたら hira+kata。S1 は k1、S2 は k2
  function traceSet(trace, stageId) {
    var set = trace && trace.set;
    if (set && set !== 'auto' && allowedSets(stageId).indexOf(set) >= 0) return set;
    if (stageId === 'S2') return 'k2';
    if (stageId === 'S1') return 'k1';
    var hira = S.SETS.hira.split('');
    for (var i = 0; i < hira.length; i++) if (doneCount(trace, hira[i]) === 0) return 'hira';
    return 'hira+kata';
  }

  // 集合の名前 → 字の配列。'hira+kata' は ひらがな → カタカナの順につないだもの（書いていない字が先に出るので、新しい字はカタカナ・復習はひらがなとカタカナ）。
  // 知らない名前・データが無い集合だけのときは ひらがな+カタカナ にする（落ちないための保険）
  function charsOfSet(name) {
    var parts = String(name || '').split('+'), out = [];
    parts.forEach(function (k) { if (S.SETS[k]) out = out.concat(S.SETS[k].split('')); });
    return out.length ? out : (S.SETS.hira + (S.SETS.kata || '')).split('');
  }

  // 字を n 個選ぶ。まだ書いていない字を chars の順に最大 n-1（その集合を初めて書くときは n）、書いた字から回数の少ない 1 つ（同数は rng）。
  // 足りなければ回数の少ない順で埋める。並びは復習の字が先、新しい字が後。重複なし。入力は書き換えない
  function pickTraceChars(chars, done, n, rng) {
    if (typeof n !== 'number' || !(n > 0)) return [];
    var cnt = function (c) { var v = done && done[c]; return typeof v === 'number' && v > 0 ? v : 0; };
    var list = [], seen = {};
    chars.forEach(function (c) { if (!seen[c]) { seen[c] = 1; list.push(c); } });
    var fresh = list.filter(function (c) { return cnt(c) === 0; });
    var old = list.filter(function (c) { return cnt(c) > 0; });
    var keyed = old.map(function (c) { return { c: c, n: cnt(c), k: rng() }; })
      .sort(function (a, b) { return a.n - b.n || a.k - b.k; });
    var firstTime = old.length === 0;
    var picksNew = fresh.slice(0, Math.min(fresh.length, firstTime ? n : n - 1));
    var need = n - picksNew.length;
    var review = keyed.slice(0, need).map(function (o) { return o.c; });
    var rest = fresh.slice(picksNew.length), extra = [];
    if (review.length < need) extra = rest.slice(0, need - review.length);
    // 復習の字（なじみの字）を先に
    return review.concat(picksNew, extra);
  }

  // ---- W5（design 11章）: 名前の字・苦手・組み方・表 ----
  // 定数。NAME_GOAL: 名前の枠で出すのは done がこれ未満の字。SPECIAL_MAX: 名前＋苦手の上限。
  var PLAN = { N: 4, NAME_GOAL: 3, SPECIAL_MAX: 2, WEAK_MAX_WHILE_NEW: 1, WEAK_MAX_KANJI: 1, HELP_M: 2 };
  var AUTO_NAME_RE = /^こども[1-4]$/;   // storage.js の自動の名前と同じ規則（テストで一致を確かめる）

  // 濁点・半濁点・小さい字 → もとの字（対応表。String.prototype.normalize は使わない）
  var KANA_BASE = (function () {
    var t = Object.create(null);
    function put(from, to) { for (var i = 0; i < from.length; i++) t[from.charAt(i)] = to.charAt(i); }
    put('がぎぐげござじずぜぞだぢづでどばびぶべぼ', 'かきくけこさしすせそたちつてとはひふへほ');
    put('ぱぴぷぺぽ', 'はひふへほ');
    put('ゔ', 'う');
    put('ぁぃぅぇぉっゃゅょゎゕゖ', 'あいうえおつやゆよわかけ');
    return t;
  })();
  function kanaBase(c) { c = String(c == null ? '' : c); return KANA_BASE[c] || c; }
  // ひらがな → カタカナ（+0x60。data.js の toHira の逆）。ひらがな以外はそのまま
  function toKataChar(c) {
    c = String(c == null ? '' : c);
    var n = c.length === 1 ? c.charCodeAt(0) : 0;
    return n >= 0x3041 && n <= 0x3096 ? String.fromCharCode(n + 0x60) : c;
  }

  function countOf(m, c) { var v = m && m[c]; return typeof v === 'number' && v > 0 ? v : 0; }
  // 苦手: 書いたことがあり、たすけが要った回数が書いた回数の半分より多い
  function isWeak(trace, c) {
    var d = countOf(trace && trace.done, c);
    return d >= 1 && countOf(trace && trace.help, c) * 2 > d;
  }

  // 名前の字。name の各字を kanaBase でもとの字にし、その字とカタカナにした字のうち chars にあるもの。
  // 重複は最初の 1 つ。at: 名前の中の位置、exact: 名前にそのままの字がある（濁点・小さい字から来たものは false）。並びは chars の順
  function nameTraceChars(name, chars) {
    if (typeof name !== 'string' || !name || AUTO_NAME_RE.test(name) || !Array.isArray(chars)) return [];
    var idx = Object.create(null);
    chars.forEach(function (c, i) { if (!(c in idx)) idx[c] = i; });
    var out = [], seen = Object.create(null);
    name.split('').forEach(function (c, at) {
      var base = kanaBase(c);
      [base, toKataChar(base)].forEach(function (ch) {
        if (!(ch in idx) || seen[ch]) return;
        seen[ch] = true;
        out.push({ ch: ch, at: at, exact: c === base });
      });
    });
    return out.sort(function (a, b) { return idx[a.ch] - idx[b.ch]; });
  }

  // 1 字を書き終えたときの記録。info = { maxM }。done は必ず +1、maxM >= 2 なら help も +1（どちらも 99 で止める）。入力は書き換えない
  function recordTraceChar(trace, ch, info) {
    var src = trace && typeof trace === 'object' ? trace : {};
    var done = {}, help = {};
    Object.keys(src.done || {}).forEach(function (k) { done[k] = src.done[k]; });
    Object.keys(src.help || {}).forEach(function (k) { help[k] = src.help[k]; });
    done[ch] = Math.min(99, countOf(done, ch) + 1);
    if (info && info.maxM >= PLAN.HELP_M) help[ch] = Math.min(99, countOf(help, ch) + 1);
    var out = {};
    Object.keys(src).forEach(function (k) { out[k] = src[k]; });
    out.done = done; out.help = help;
    return out;
  }

  // 1 回の出動の字の組み方（design 11.4）。→ [{ ch, why }]。why: chosen・review・weak・name・new
  // opts = { n, name, prev, chosen, kanji }。rng は同じ回数の字のくじだけ（pickTraceChars と同じ引き方）。名前・たすけ・prev が無ければ pickTraceChars と同じ字の並び
  function planTraceSession(chars, trace, opts, rng) {
    opts = opts || {};
    var n = typeof opts.n === 'number' ? Math.floor(opts.n) : PLAN.N;
    var done = trace && trace.done;
    var cnt = function (c) { return countOf(done, c); };
    var list = [], seen = Object.create(null), order = Object.create(null);
    (chars || []).forEach(function (c) { if (!seen[c]) { seen[c] = 1; order[c] = list.length; list.push(c); } });
    var chosen = typeof opts.chosen === 'string' && opts.chosen ? opts.chosen : '';
    if (!(n > 0) || (!list.length && !chosen)) return [];
    var avoidMap = Object.create(null);
    (opts.prev || []).forEach(function (c) { avoidMap[c] = true; });
    var avoid = function (c) { return !!avoidMap[c]; };
    var fresh = list.filter(function (c) { return cnt(c) === 0; });
    var old = list.filter(function (c) { return cnt(c) > 0; });
    var key = Object.create(null);
    old.forEach(function (c) { key[c] = rng(); });   // くじの鍵は 1 回だけ引く
    var byCnt = function (a, b) { return cnt(a) - cnt(b) || key[a] - key[b]; };
    var byCntOrder = function (a, b) { return cnt(a) - cnt(b) || order[a] - order[b]; };

    var picks = [], taken = Object.create(null);
    function put(ch, why) { if (taken[ch] || picks.length >= n) return false; taken[ch] = true; picks.push({ ch: ch, why: why }); return true; }
    var weakN = function () { return picks.filter(function (p) { return p.why === 'weak'; }).length; };
    var nameN = function () { return picks.filter(function (p) { return p.why === 'name'; }).length; };

    if (chosen) put(chosen, 'chosen');
    // 復習の枠（1 つ）: 苦手 → 少ない字。全部 prev なら空
    if (old.length) {
      var cand = old.filter(function (c) { return !taken[c] && !avoid(c); });
      var weak = cand.filter(function (c) { return isWeak(trace, c); }).sort(byCntOrder);
      if (weak.length) put(weak[0], 'weak');
      else if (cand.length) put(cand.slice().sort(byCnt)[0], 'review');
    }
    // 名前の枠（0〜1）
    if (!opts.kanji && weakN() + 1 <= PLAN.SPECIAL_MAX) {
      var names = nameTraceChars(opts.name, list).filter(function (o) { return cnt(o.ch) < PLAN.NAME_GOAL && !avoid(o.ch) && !taken[o.ch]; })
        .map(function (o) { return o.ch; }).sort(byCntOrder);
      if (names.length) put(names[0], 'name');
    }
    // 新しい字: chars の順に
    fresh.forEach(function (c) { if (!taken[c]) put(c, 'new'); });
    // 足りないとき: 苦手（上限まで）→ 苦手でない字 → 最後の手段で prev の字
    if (picks.length < n) {
      var capWeak = opts.kanji ? PLAN.WEAK_MAX_KANJI : PLAN.SPECIAL_MAX - nameN();
      var rest = old.filter(function (c) { return !taken[c]; });
      var fine = rest.filter(function (c) { return !avoid(c); });
      var weakFine = fine.filter(function (c) { return isWeak(trace, c); }).sort(byCnt);
      var skipped = weakFine.slice(Math.max(0, capWeak - weakN()));
      weakFine = weakFine.slice(0, Math.max(0, capWeak - weakN()));
      var plain = fine.filter(function (c) { return !isWeak(trace, c); }).sort(byCnt);
      weakFine.forEach(function (c) { put(c, 'weak'); });
      plain.forEach(function (c) { put(c, 'review'); });
      skipped.forEach(function (c) { put(c, 'review'); });   // 上限で飛ばした苦手は、苦手でない字の後ろに回す
      rest.filter(avoid).sort(byCnt).forEach(function (c) { put(c, isWeak(trace, c) ? 'weak' : 'review'); });
    }
    // 出す順: chosen → なじみ → 新しい → 苦手
    var rank = function (p) {
      if (p.why === 'chosen') return 0;
      if (cnt(p.ch) === 0) return 2;
      return isWeak(trace, p.ch) ? 3 : 1;
    };
    return picks.map(function (p, i) { return { p: p, i: i, r: rank(p) }; })
      .sort(function (a, b) { return a.r - b.r || (a.r === 2 ? (order[a.p.ch] - order[b.p.ch]) : 0) || a.i - b.i; })
      .map(function (o) { return o.p; });
  }

  // 五十音の表の並び（design 11.5）。setId: hira・kata・k1・k2。orient: 'rows'（5 列）／'cols'（横の画面。ひらがな・カタカナは 11 列 × 5 段で右から あ行、漢字は 10 列）。空きは ''
  var GOJUON = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'や　ゆ　よ', 'らりるれろ', 'わ　　　を', 'ん　　　　'];
  function traceGrid(setId, orient) {
    var cols = orient === 'cols';
    var kata = setId === 'kata';
    if (setId === 'hira' || kata) {
      var rows = GOJUON.map(function (r) { return r.split('').map(function (c) { return c === '　' ? '' : (kata ? toKataChar(c) : c); }); });
      if (!cols) return rows;
      var out = [];
      for (var i = 0; i < 5; i++) { var line = []; for (var j = rows.length - 1; j >= 0; j--) line.push(rows[j][i]); out.push(line); }
      return out;
    }
    var cs = S.SETS[setId] ? S.SETS[setId].split('') : [], w = cols ? 10 : 5, res = [];
    for (var k = 0; k < cs.length; k += w) { var row = cs.slice(k, k + w); while (row.length < w) row.push(''); res.push(row); }
    return res;
  }

  // 「せんの はば」: auto は S0 がひろめ、S1 以降がふつう
  function traceWidth(trace, stageId) {
    var w = trace && trace.width;
    if (w === 'wide' || w === 'normal') return w;
    return stageId === 'S0' ? 'wide' : 'normal';
  }

  // 保存の補正。知らない字・数でない値・負の数は捨て、1〜99 に収める。知らない set / width は auto。入力は書き換えない
  function normalizeTrace(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var known = Object.create(null);
    Object.keys(S.SETS).forEach(function (k) { S.SETS[k].split('').forEach(function (c) { known[c] = true; }); });
    var done = {};
    var d = src.done && typeof src.done === 'object' ? src.done : {};
    Object.keys(d).forEach(function (c) {
      var v = d[c];
      if (!known[c] || typeof v !== 'number' || !isFinite(v)) return;
      v = Math.floor(v);
      if (v < 1) return;
      done[c] = Math.min(99, v);
    });
    var help = {};
    var h = src.help && typeof src.help === 'object' ? src.help : {};
    Object.keys(h).forEach(function (c) {
      var v = h[c];
      if (!known[c] || !(c in done) || typeof v !== 'number' || !isFinite(v)) return;   // done に無い字の help は捨てる
      v = Math.floor(v);
      if (v < 1) return;
      help[c] = Math.min(99, v, done[c]);
    });
    return {
      done: done,
      help: help,
      set: SET_NAMES.indexOf(src.set) >= 0 ? src.set : 'auto',
      width: WIDTH_NAMES.indexOf(src.width) >= 0 ? src.width : 'auto'
    };
  }

  var api = {
    DEFAULTS: DEFAULTS, strokePolyline: strokePolyline, polyLength: polyLength, isDot: isDot, densify: densify, tolerance: tolerance,
    helpTolerance: helpTolerance, helpFor: helpFor, beginStroke: beginStroke, moveStroke: moveStroke, endStroke: endStroke,
    progressOf: progressOf, recordAttempt: recordAttempt, traceSet: traceSet, charsOfSet: charsOfSet, pickTraceChars: pickTraceChars, traceWidth: traceWidth, normalizeTrace: normalizeTrace,
    PLAN: PLAN, allowedSets: allowedSets, kanaBase: kanaBase, toKataChar: toKataChar, isWeak: isWeak, nameTraceChars: nameTraceChars, recordTraceChar: recordTraceChar,
    planTraceSession: planTraceSession, traceGrid: traceGrid
  };
  if (node) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.trace = api; }
})(typeof window !== 'undefined' ? window : globalThis);
