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
    shortLen: 0.08,     // これより短い画は「点」
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
    h = h || DEFAULTS.h;
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
  function isDot(poly) { return polyLength(poly) < DEFAULTS.shortLen; }

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
    var k = width === 'wide' ? DEFAULTS.wide : 1;
    var g = script === 'kanji' ? DEFAULTS.kanjiG : 1;
    return {
      near: Math.max(DEFAULTS.nearBase * g, DEFAULTS.nearMinPx / B) * k,
      off: Math.max(DEFAULTS.offBase * g, DEFAULTS.offMinPx / B) * k,
      offRun: DEFAULTS.offRun,
      startR: Math.max(DEFAULTS.startBase, DEFAULTS.startMinPx / B) * k,
      endP: DEFAULTS.endP
    };
  }

  // ---- 3.6 助けの段階。m = その画のやり直しの回数（off と short の合計）----
  // m=2 で near・off ×1.25、m=3 で ×1.5、m=4 以上で off を見ない。m>=5 は autoComplete（手本が書き足して次の画へ）
  function helpTolerance(tol, m) {
    var f = m >= 3 ? 1.5 : m >= 2 ? 1.25 : 1;
    return {
      near: tol.near * f, off: m >= 4 ? Infinity : tol.off * f, offRun: tol.offRun,
      startR: tol.startR, endP: tol.endP
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
  function advance(poly, idx, p, near) {
    var hi = Math.min(poly.length - 1, idx + windowPts(poly)), best = idx;
    for (var j = idx; j <= hi; j++) if (dist(p, poly[j]) <= near) best = j;
    return best;
  }

  function beginStroke(poly, p, tol) {
    var first = poly[0], lastPt = poly[poly.length - 1];
    var base = { idx: 0, last: p, offLen: 0, off: false, dot: false };
    if (isDot(poly)) {
      // 点: 画のどこから押してもよい（off の中なら）
      if (distToRange(poly, p, 0, poly.length - 1) <= tol.off) {
        base.dot = true; base.inside = true;
        return { state: base, result: 'started' };
      }
      return { state: base, result: 'miss' };
    }
    if (dist(p, first) <= tol.startR) {
      base.idx = advance(poly, 0, p, tol.near);
      return { state: base, result: 'started' };
    }
    if (dist(p, lastPt) <= tol.startR) return { state: base, result: 'reverse' };
    return { state: base, result: 'miss' };
  }

  function moveStroke(poly, state, pts, tol) {
    var st = { idx: state.idx, last: state.last, offLen: state.offLen, off: state.off, dot: state.dot, inside: state.inside };
    if (st.off) return { state: st, result: 'off' };
    var W = windowPts(poly), step = tol.near / DEFAULTS.densifyDiv;
    for (var a = 0; a < pts.length; a++) {
      var seq = densify(st.last, pts[a], step);
      for (var b = 0; b < seq.length; b++) {
        var q = seq[b];
        if (st.dot) {
          st.inside = distToRange(poly, q, 0, poly.length - 1) <= tol.off;
        } else {
          st.idx = advance(poly, st.idx, q, tol.near);
          var d = distToRange(poly, q, st.idx - W, st.idx + W);
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
    if (state.off) return { result: 'short' };
    if (state.dot) return { result: state.inside ? 'done' : 'short' };
    return { result: state.idx >= tol.endP * (poly.length - 1) ? 'done' : 'short' };
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

  // 字を n 個選ぶ。まだ書いていない字を chars の順に最大 n-1（その集合を初めて書くときは n）、書いた字から回数の少ない 1 つ（同数は rng）。
  // 足りなければ回数の少ない順で埋める。並びは復習の字が先、新しい字が後。重複なし。入力は書き換えない
  function pickTraceChars(chars, done, n, rng) {
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

  // 「せんの はば」: auto は S0 がひろめ、S1 以降がふつう
  function traceWidth(trace, stageId) {
    var w = trace && trace.width;
    if (w === 'wide' || w === 'normal') return w;
    return stageId === 'S0' ? 'wide' : 'normal';
  }

  // 保存の補正。知らない字・数でない値・負の数は捨て、1〜99 に収める。知らない set / width は auto。入力は書き換えない
  function normalizeTrace(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var known = {};
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
    return {
      done: done,
      set: SET_NAMES.indexOf(src.set) >= 0 ? src.set : 'auto',
      width: WIDTH_NAMES.indexOf(src.width) >= 0 ? src.width : 'auto'
    };
  }

  var api = {
    DEFAULTS: DEFAULTS, strokePolyline: strokePolyline, polyLength: polyLength, isDot: isDot, densify: densify, tolerance: tolerance,
    helpTolerance: helpTolerance, helpFor: helpFor, beginStroke: beginStroke, moveStroke: moveStroke, endStroke: endStroke,
    progressOf: progressOf, traceSet: traceSet, pickTraceChars: pickTraceChars, traceWidth: traceWidth, normalizeTrace: normalizeTrace
  };
  if (node) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.trace = api; }
})(typeof window !== 'undefined' ? window : globalThis);
