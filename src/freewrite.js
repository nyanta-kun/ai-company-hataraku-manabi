// ひとりで かく（線なしの書き取り）の判定と字の選び方（design-tracing 13章）。純粋関数のみ（DOM・px・時刻を知らない）。
// 手書きの認識はしない。出題した 1 字が「手本と同じ形・画の数・書き順・向き」で書けたかだけを見る。迷うときは ok の側に倒す。
// 依存: strokes.js, trace.js。ブラウザでは window.Manabi.freewrite、Node では module.exports。
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var S = node ? require('./strokes.js') : root.Manabi.strokes;
  var T = node ? require('./trace.js') : root.Manabi.trace;

  // 13.4 の定数。長さは「手本の字の大きさ s」に対する比（TINY・MIN_SIZE だけ板の一辺に対する比）
  var DEFAULTS = {
    N: 24, BAND: 4, TINY: 0.012, MIN_SIZE: 0.08, FLOOR: 0.35, ASPECT: 1.6,
    DOT_LEN: 0.25, DOT_R: 0.22, DOT_MAXLEN: 0.55,
    SHAPE_MEAN: 0.15, SHAPE_MAX: 0.35, DIR_MARGIN: 0.04, SPLIT_GAP: 0.25,
    MAX_JOIN_KANA: 2, MAX_JOIN_KANJI: 3, MAX_SKIP: 1, JOIN_PEN: 0.02, JOIN_END: 0.12,
    TRIM: 0.01, FRAME_PTS: 80, LOOSE: 2.5,
    SOLO_READY: 3, SOLO_SETS: ['hira', 'kata', 'k1', 'k2']
  };
  var FAIL = 1000, EXTRA = 1002;   // 合わない画 1 つぶんの重み（距離の合計より十分大きくして、合わない画の数を先に比べる）

  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function polyLen(p) { var l = 0; for (var i = 1; i < p.length; i++) l += dist(p[i - 1], p[i]); return l; }
  function isKanjiChar(ch) { var k = S.SETS; return !!((k.k1 && k.k1.indexOf(ch) >= 0) || (k.k2 && k.k2.indexOf(ch) >= 0)); }
  function paramsOf(o) { if (!o) return DEFAULTS; var P = {}; Object.keys(DEFAULTS).forEach(function (k) { P[k] = DEFAULTS[k]; }); Object.keys(o).forEach(function (k) { P[k] = o[k]; }); return P; }

  // ---- 部品 ----
  // 弧長で n 点に打ち直す（始点と終点を含む）。長さ 0 の点列は同じ点を n 個
  function resample(poly, n) {
    var out = [], m = poly.length, i;
    if (!m || !(n > 0)) return out;
    var cum = [0];
    for (i = 1; i < m; i++) cum.push(cum[i - 1] + dist(poly[i - 1], poly[i]));
    var L = cum[m - 1];
    if (!(L > 0) || n === 1) { for (i = 0; i < n; i++) out.push([poly[0][0], poly[0][1]]); return out; }
    var j = 1;
    for (i = 0; i < n; i++) {
      var t = L * i / (n - 1);
      while (j < m - 1 && cum[j] < t) j++;
      var seg = cum[j] - cum[j - 1], f = seg > 0 ? (t - cum[j - 1]) / seg : 0;
      f = clamp(f, 0, 1);
      out.push([poly[j - 1][0] + (poly[j][0] - poly[j - 1][0]) * f, poly[j - 1][1] + (poly[j][1] - poly[j - 1][1]) * f]);
    }
    return out;
  }
  // 弧長 step ごとの点（始点・終点を含む）
  function resampleStep(poly, step) {
    var L = polyLen(poly);
    if (!(L > 0) || !(step > 0)) return poly.length ? [poly[0]] : [];
    return resample(poly, Math.max(2, Math.ceil(L / step) + 1));
  }
  function centroid(pts) {
    var x = 0, y = 0, n = pts.length;
    for (var i = 0; i < n; i++) { x += pts[i][0]; y += pts[i][1]; }
    return [x / n, y / n];
  }
  // DTW（ずれは前後 band 点まで）。→ { mean, max }（対応点の距離の平均・最大。経路は合計が最小のもの）
  function dtw(a, b, band) {
    var n = a.length, m = b.length, INF = 1e18, i, j;
    var cost = new Float64Array(n * m).fill(INF), cnt = new Int32Array(n * m), mx = new Float64Array(n * m);
    for (i = 0; i < n; i++) {
      var lo = Math.max(0, i - band), hi = Math.min(m - 1, i + band);
      for (j = lo; j <= hi; j++) {
        var d = dist(a[i], b[j]), k = i * m + j, bc = INF, bk = -1;
        if (i === 0 && j === 0) { cost[k] = d; cnt[k] = 1; mx[k] = d; continue; }
        if (i > 0 && j > 0 && cost[k - m - 1] < bc) { bc = cost[k - m - 1]; bk = k - m - 1; }
        if (i > 0 && cost[k - m] < bc) { bc = cost[k - m]; bk = k - m; }
        if (j > 0 && cost[k - 1] < bc) { bc = cost[k - 1]; bk = k - 1; }
        if (bk < 0) continue;
        cost[k] = bc + d; cnt[k] = cnt[bk] + 1; mx[k] = Math.max(mx[bk], d);
      }
    }
    var e = n * m - 1;
    if (cost[e] >= INF) return { mean: Infinity, max: Infinity };
    return { mean: cost[e] / cnt[e], max: mx[e] };
  }

  // 字の外枠。polys: 画の点列の配列。上下 trim（既定 1%）を除いた最小・最大（はねの付けすぎで枠が広がりにくいように）
  function inkFrame(polys, trim, P, extra) {
    P = P || DEFAULTS;
    if (typeof trim !== 'number') trim = P.TRIM;
    var list = polys.filter(function (p) { return p && p.length; }), i;
    if (!list.length) {
      if (!extra || !extra.length) return { cx: 0.5, cy: 0.5, w: 0, h: 0, s: 0 };
      var ex = extra.map(function (q) { return q[0]; }), ey = extra.map(function (q) { return q[1]; });
      var ew = Math.max.apply(null, ex) - Math.min.apply(null, ex), eh = Math.max.apply(null, ey) - Math.min.apply(null, ey);
      return { cx: (Math.max.apply(null, ex) + Math.min.apply(null, ex)) / 2, cy: (Math.max.apply(null, ey) + Math.min.apply(null, ey)) / 2, w: ew, h: eh, s: Math.max(ew, eh) };
    }
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    list.forEach(function (p) { p.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }); });
    var raw = Math.max(x1 - x0, y1 - y0);
    if (!(raw > 0)) return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: 0, h: 0, s: 0 };
    var xs = [], ys = [], step = raw / P.FRAME_PTS;
    list.forEach(function (p) { resampleStep(p, step).forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); });
    xs.sort(function (a, b) { return a - b; }); ys.sort(function (a, b) { return a - b; });
    var n = xs.length, t = Math.floor(n * trim);
    var ax = xs[t], bx = xs[n - 1 - t], ay = ys[t], by = ys[n - 1 - t];
    (extra || []).forEach(function (q) { ax = Math.min(ax, q[0]); bx = Math.max(bx, q[0]); ay = Math.min(ay, q[1]); by = Math.max(by, q[1]); });   // 小点は 1 点なので、削らずに枠に入れる
    var w = bx - ax, h = by - ay;
    return { cx: (ax + bx) / 2, cy: (ay + by) / 2, w: w, h: h, s: Math.max(w, h) };
  }

  // 子の字の枠 cf → 手本の枠 mf。横・縦それぞれの比（幅・高さには字の大きさの FLOOR 倍の下限）から、大きさ k と縦横の比 a を出す。
  // x の拡大 = k·a、y の拡大 = k/a。a は ASPECT（1.6 倍）までに止める（設計 13.3-2 の k = s手/s子 だと、縦横の比が変わった字で大きさが a 倍ずれるため、
  // 横と縦の比の幾何平均を k にした。14章）
  function makeFit(cf, mf, P) {
    var kx = Math.max(mf.w, P.FLOOR * mf.s) / Math.max(cf.w, P.FLOOR * cf.s);
    var ky = Math.max(mf.h, P.FLOOR * mf.s) / Math.max(cf.h, P.FLOOR * cf.s);
    var lim = Math.sqrt(P.ASPECT);
    var a = clamp(Math.sqrt(kx / ky), 1 / lim, lim), k = Math.sqrt(kx * ky);
    return { cc: [cf.cx, cf.cy], cm: [mf.cx, mf.cy], k: k, a: a };
  }
  function toModel(fit, p) { return [fit.cm[0] + (p[0] - fit.cc[0]) * fit.k * fit.a, fit.cm[1] + (p[1] - fit.cc[1]) * fit.k / fit.a]; }
  // 手本の点 → 板の上の子どもの字の位置（13.3-6）
  function fitPoint(fit, p) { return [fit.cc[0] + (p[0] - fit.cm[0]) / (fit.k * fit.a), fit.cc[1] + (p[1] - fit.cm[1]) * fit.a / fit.k]; }

  // ---- 1 画の比べ方（13.3-4）。c・m は同じ座標系の点列、o.s は手本の字の大きさ ----
  function compareStroke(c, m, isDot, o) {
    var P = (o && o.P) || DEFAULTS, s = (o && o.s) || 1;
    if (isDot) {
      var d0 = dist(centroid(resample(c, P.N)), centroid(resample(m, P.N))) / s, cl = polyLen(c) / s;
      return { ok: d0 <= P.DOT_R && cl <= P.DOT_MAXLEN, reverse: false, dot: true, D: d0, Dr: d0, Dmax: d0, len: cl };
    }
    var ca = resample(c, P.N), ma = resample(m, P.N);
    var f = dtw(ca, ma, P.BAND), r = dtw(ca, ma.slice().reverse(), P.BAND);
    var D = f.mean / s, Dmax = f.max / s, Dr = r.mean / s, Drmax = r.max / s;
    var shapeOk = D <= P.SHAPE_MEAN && Dmax <= P.SHAPE_MAX;
    var revShape = Dr <= P.SHAPE_MEAN && Drmax <= P.SHAPE_MAX;
    var rev = revShape && Dr < D - P.DIR_MARGIN;
    var ends = Math.max(dist(ca[0], ma[0]), dist(ca[ca.length - 1], ma[ma.length - 1])) / s;   // 始点・終点のずれ（結合・分割のときだけ見る）
    return { ok: shapeOk && !rev, reverse: rev, dot: false, D: D, Dmax: Dmax, Dr: Dr, Drmax: Drmax, ends: ends };
  }

  // ---- 画の対応（13.3-3）。C: 子の画 [{pts, tiny}]、M: 手本の画 [{pts, len}]（同じ座標系）。o = { s, P, maxJoin }
  // 遷移: 1 対 1・結合（手本 2 画）・分割（子 2 画）・小点の無視。足りない画・余った画は FAIL を足して対応させる（診断のため）
  function alignStrokes(C, M, o) {
    var P = o.P, s = o.s, p = C.length, q = M.length, U = o.maxJoin, V = P.MAX_SKIP;
    var cache = Object.create(null);
    function concat(a, b) { return a.concat(b); }
    function cmp(c0, c1, m0, m1) {
      var key = c0 + ',' + c1 + ',' + m0 + ',' + m1;
      if (cache[key]) return cache[key];
      var cp = c1 - c0 === 1 ? C[c0].pts : concat(C[c0].pts, C[c0 + 1].pts);
      var mp = m1 - m0 === 1 ? M[m0].pts : concat(M[m0].pts, M[m0 + 1].pts);
      var mlen = m1 - m0 === 1 ? M[m0].len : M[m0].len + M[m0 + 1].len;
      var dot = m1 - m0 === 1 && mlen / s < P.DOT_LEN;   // 結合した 2 画は点の画にしない（つなぎの線が長いため）
      var r;
      if (C[c0].tiny && !dot) r = { ok: false, reverse: false, D: 1, Dmax: 1, Dr: 1, dot: false };
      else r = compareStroke(cp, mp, dot, { s: s, P: P });
      // 結合・分割は始点と終点がずれていないときだけ（最後の短い画を書かずに、手前の画に読み替えられないように）
      if ((m1 - m0 === 2 || c1 - c0 === 2) && r.ends > P.JOIN_END) r.ok = false;
      return (cache[key] = r);
    }
    var UV = (U + 1) * (V + 1), QS = (q + 1) * UV;
    function ix(i, j, u, v) { return i * QS + j * UV + u * (V + 1) + v; }
    var size = (p + 1) * QS, cost = new Float64Array(size).fill(Infinity), back = new Array(size);
    cost[0] = 0;
    function relax(from, ni, nj, nu, nv, add, info) {
      var to = ix(ni, nj, nu, nv), c = cost[from] + add;
      if (c < cost[to] - 1e-12) { cost[to] = c; back[to] = { from: from, info: info }; }
    }
    var i, j, u, v;
    for (i = 0; i <= p; i++) for (j = 0; j <= q; j++) for (u = 0; u <= U; u++) for (v = 0; v <= V; v++) {
      var cur = ix(i, j, u, v);
      if (!(cost[cur] < Infinity)) continue;
      var r;
      if (i < p && j < q) {
        r = cmp(i, i + 1, j, j + 1);
        relax(cur, i + 1, j + 1, u, v, (r.ok ? 0 : FAIL) + (r.reverse ? 0 : Math.min(r.D, 1.5)), { t: 'pair', c0: i, c1: i + 1, m0: j, m1: j + 1, r: r });
      }
      if (i < p && j + 1 < q && u < U && !C[i].tiny) {
        r = cmp(i, i + 1, j, j + 2);
        relax(cur, i + 1, j + 2, u + 1, v, P.JOIN_PEN + (r.ok ? 0 : FAIL) + (r.reverse ? 0 : Math.min(r.D, 1.5)), { t: 'pair', c0: i, c1: i + 1, m0: j, m1: j + 2, r: r, kind: 'join' });
      }
      if (i + 1 < p && j < q && u < U && !C[i].tiny && !C[i + 1].tiny) {
        var a = C[i].pts, b = C[i + 1].pts;
        if (dist(a[a.length - 1], b[0]) <= P.SPLIT_GAP * s) {
          r = cmp(i, i + 2, j, j + 1);
          relax(cur, i + 2, j + 1, u + 1, v, P.JOIN_PEN + (r.ok ? 0 : FAIL) + (r.reverse ? 0 : Math.min(r.D, 1.5)), { t: 'pair', c0: i, c1: i + 2, m0: j, m1: j + 1, r: r, kind: 'split' });
        }
      }
      if (i < p && C[i].tiny && v < V) relax(cur, i + 1, j, u, v + 1, P.JOIN_PEN, { t: 'skip', c0: i });
      if (i < p) relax(cur, i + 1, j, u, v, EXTRA, { t: 'extraC', c0: i });
      if (j < q) relax(cur, i, j + 1, u, v, EXTRA, { t: 'extraM', m0: j });
    }
    var best = -1;
    for (u = 0; u <= U; u++) for (v = 0; v <= V; v++) { var e = ix(p, q, u, v); if (best < 0 || cost[e] < cost[best]) best = e; }
    var pairs = [], at = best, fails = 0;
    while (at !== 0 && back[at]) { var bk = back[at]; pairs.push(bk.info); at = bk.from; }
    pairs.reverse();
    pairs.forEach(function (x) { if (x.t === 'pair' ? !x.r.ok : (x.t === 'extraC' || x.t === 'extraM')) fails++; });
    return { fails: fails, cost: cost[best], pairs: pairs, ok: fails === 0 };
  }

  // ---- 手本・子の字の用意 ----
  var MODELS = Object.create(null);
  function modelOf(ch) {
    if (MODELS[ch]) return MODELS[ch];
    var d = S.STROKES[ch];
    if (!d) return null;
    var polys = d.s.map(function (s) { return T.strokePolyline(s, 0.01); });
    return (MODELS[ch] = { polys: polys, strokes: polys.map(function (p) { return { pts: p, len: polyLen(p), cen: centroid(resample(p, 24)) }; }), frames: [] });
  }
  function modelFrame(m, n, P) {
    if (P === DEFAULTS && m.frames[n]) return m.frames[n];
    var f = inkFrame(m.polys.slice(0, n), P.TRIM, P);
    if (P === DEFAULTS) m.frames[n] = f;
    return f;
  }

  function cleanInk(ink, P) {
    var out = [];
    if (!Array.isArray(ink)) return out;
    ink.forEach(function (st) {
      if (!Array.isArray(st)) return;
      var pts = [];
      st.forEach(function (pt) {
        if (!Array.isArray(pt) || typeof pt[0] !== 'number' || typeof pt[1] !== 'number' || !isFinite(pt[0]) || !isFinite(pt[1])) return;
        var q = [pt[0], pt[1]];
        if (pts.length && dist(pts[pts.length - 1], q) < 1e-9) return;
        pts.push(q);
      });
      if (!pts.length) return;
      var len = polyLen(pts);
      if (len < P.TINY) { var c = centroid(pts); out.push({ pts: [c], len: 0, tiny: true }); }
      else out.push({ pts: pts, len: len, tiny: false });
    });
    return out;
  }

  // 変換 fit で子の字を手本の座標へ移して、手本の n 画までと対応させる
  function alignWith(cs, fit, mf, model, n, P, maxJoin) {
    var C = cs.map(function (c) {
      var pts = c.pts.map(function (q) { return toModel(fit, q); });
      return { pts: pts, tiny: c.tiny, len: polyLen(pts) };
    });
    var M = model.strokes.slice(0, n);
    var al = alignStrokes(C, M, { s: mf.s, P: P, maxJoin: maxJoin });
    al.fit = fit; al.C = C; al.mf = mf; al.n = n;
    return al;
  }
  // 最初の対応で「だいたい合っている」画から、位置と大きさの合わせ方を最小二乗で直す（枠だけだと、1 画ごとのずれや点の画のせいで
  // 枠そのものが少し狂うため）。直すのは x・y それぞれの拡大と平行移動だけ（回転・反転はしない）。大きさの比の限度は ASPECT のまま
  function refineFit(al, model, P) {
    var wsum = 0, sx = 0, sy = 0, sxm = 0, sym = 0, sxx = 0, syy = 0, sxy = 0, syx = 0, used = 0;
    function add(c, m, w) {
      wsum += w; sx += w * c[0]; sy += w * c[1]; sxm += w * m[0]; sym += w * m[1];
      sxx += w * c[0] * c[0]; syy += w * c[1] * c[1]; sxy += w * c[0] * m[0]; syx += w * c[1] * m[1];
    }
    al.pairs.forEach(function (x) {
      if (x.t !== 'pair' || x.kind || x.r.reverse) return;
      var cp = al.C[x.c0].pts, mp = model.strokes[x.m0].pts;
      if (!x.r.ok) return;   // al は ゆるいしきい値（LOOSE）で対応させたもの
      if (x.r.dot) { add(centroid(resample(cp, P.N)), centroid(resample(mp, P.N)), 6); used++; return; }
      var ca = resample(cp, P.N), ma = resample(mp, P.N);
      for (var i = 0; i < ca.length; i++) add(ca[i], ma[i], 1);
      used++;
    });
    if (used < 2 || wsum <= 0) return null;
    // 今の変換（子 → 手本）に、さらに x' = px·x + qx、y' = py·y + qy を掛ける
    var vx = sxx / wsum - Math.pow(sx / wsum, 2), vy = syy / wsum - Math.pow(sy / wsum, 2);
    if (!(vx > 1e-9) || !(vy > 1e-9)) return null;
    var px = clamp((sxy / wsum - (sx / wsum) * (sxm / wsum)) / vx, 0.6, 1.6);
    var py = clamp((syx / wsum - (sy / wsum) * (sym / wsum)) / vy, 0.6, 1.6);
    var lim = Math.sqrt(P.ASPECT), f = al.fit;
    var ax0 = f.k * f.a, ay0 = f.k / f.a, ax = ax0 * px, ay = ay0 * py;
    var a = clamp(Math.sqrt(ax / ay), 1 / lim, lim), k = Math.sqrt(ax * ay);
    ax = k * a; ay = k / a;
    px = ax / ax0; py = ay / ay0;
    var qx = sxm / wsum - px * (sx / wsum), qy = sym / wsum - py * (sy / wsum);
    // 新しい変換: 手本の x = cm.x + (x − cc.x)·ax0 を px 倍して qx を足したもの → cc を取り直す
    var ccx = f.cc[0] - (px * (f.cm[0] - 0) + qx - f.cm[0]) / ax + 0, ccy;
    // x'' = px·(cm.x + (x − cc.x)·ax0) + qx = (px·ax0)·x + (px·cm.x − px·ax0·cc.x + qx)。これを cm.x + (x − cc'.x)·ax と書く
    ccx = (f.cm[0] - (px * f.cm[0] - px * ax0 * f.cc[0] + qx)) / ax;
    ccy = (f.cm[1] - (py * f.cm[1] - py * ay0 * f.cc[1] + qy)) / ay;
    return { cc: [ccx, ccy], cm: f.cm, k: k, a: a };
  }
  // 子の字の外枠の候補。触れただけの点（小点）は、枠に入れない場合（離れた所のふれ）と入れる場合（字の点をちょんと触った）の両方がありうるので、
  // 小点を入れない枠 → 近い順に 1 つずつ足した枠 → 全部入れた枠、を順に試す
  function frameCandidates(cs, P) {
    var solid = cs.filter(function (c) { return !c.tiny; }).map(function (c) { return c.pts; });
    var tinies = cs.filter(function (c) { return c.tiny; }).map(function (c) { return c.pts; });
    var out = [inkFrame(solid, P.TRIM, P)];
    if (!tinies.length || !solid.length) return out;
    var base = out[0];
    tinies = tinies.slice().sort(function (a, b) { return dist(a[0], [base.cx, base.cy]) - dist(b[0], [base.cx, base.cy]); });
    var pt = function (a) { return a[0]; };
    for (var k = 1; k <= Math.min(tinies.length, 5); k++) out.push(inkFrame(solid, P.TRIM, P, tinies.slice(0, k).map(pt)));
    if (tinies.length > 5) out.push(inkFrame(solid, P.TRIM, P, tinies.map(pt)));
    return out;
  }
  function looseOf(P) {
    var L = paramsOf(P);
    L.SHAPE_MEAN = P.SHAPE_MEAN * P.LOOSE; L.SHAPE_MAX = P.SHAPE_MAX * P.LOOSE; L.DOT_R = P.DOT_R * P.LOOSE; L.DOT_MAXLEN = P.DOT_MAXLEN * P.LOOSE;
    return L;
  }
  // 枠の候補を順に試し（合わなければ位置と大きさを直して 2 回まで試し直す）、合う（fails = 0）最初のもの、なければ一番ましなもの
  function alignBest(cs, frames, model, n, P, maxJoin) {
    var best = null, mf = modelFrame(model, n, P);
    for (var i = 0; i < frames.length; i++) {
      if (!(frames[i].s > 0)) continue;
      var al = alignWith(cs, makeFit(frames[i], mf, P), mf, model, n, P, maxJoin);
      for (var r = 0; r < 2 && !al.ok; r++) {
        var loose = alignWith(cs, al.fit, mf, model, n, looseOf(P), maxJoin);
        var fit = refineFit(loose, model, P);
        if (!fit) break;
        var al2 = alignWith(cs, fit, mf, model, n, P, maxJoin);
        if (al2.cost < al.cost - 1e-9) al = al2; else break;
      }
      if (al.ok) return al;
      if (!best || al.cost < best.cost) best = al;
    }
    return best;
  }

  // 順を問わず、子の画と手本の画が 1 対 1 で全部合うか。合えば「順番どおりでない最初の手本の画」、合わなければ -1
  function orderFocus(cs, fit, mf, model, P) {
    var q = model.strokes.length, okm = [], a, b;
    var C = cs.map(function (c) { return { pts: c.pts.map(function (z) { return toModel(fit, z); }), tiny: c.tiny }; });
    for (a = 0; a < q; a++) {
      okm.push([]);
      for (b = 0; b < q; b++) {
        var dot = model.strokes[b].len / mf.s < P.DOT_LEN;
        okm[a].push(!(C[a].tiny && !dot) && compareStroke(C[a].pts, model.strokes[b].pts, dot, { s: mf.s, P: P }).ok);
      }
    }
    var matchOf = [];
    var tryK = function (x, seen) {
      for (var y = 0; y < q; y++) if (okm[x][y] && !seen[y]) { seen[y] = true; if (matchOf[y] == null || tryK(matchOf[y], seen)) { matchOf[y] = x; return true; } }
      return false;
    };
    for (a = 0; a < q; a++) if (!tryK(a, [])) return -1;
    var f = 0;
    while (f < q && okm[f][f]) f++;
    return Math.min(f, q - 1);
  }

  function maxOf(al) {   // 診断用: 画ごとの値
    return al.pairs.filter(function (x) { return x.t === 'pair'; }).map(function (x) {
      return { m: x.m0, m1: x.m1, c: x.c0, c1: x.c1, kind: x.kind || '', ok: x.r.ok, reverse: x.r.reverse, dot: x.r.dot, ends: x.r.ends, D: x.r.D, Dmax: x.r.Dmax, Dr: x.r.Dr, len: x.r.len };
    });
  }

  // 13.3。→ { result: 'ok'|'more'|'order'|'reverse'|'shape'|'empty', focus, fit, detail, reason } 知らない字は null
  function judgeSolo(ch, ink, opts) {
    var model = modelOf(ch);
    if (!model) return null;
    opts = opts || {};
    var P = paramsOf(opts.params), told = !!opts.told;
    var kanji = opts.script ? opts.script === 'kanji' : isKanjiChar(ch);
    var maxJoin = kanji ? P.MAX_JOIN_KANJI : P.MAX_JOIN_KANA;
    var cs = cleanInk(ink, P);
    if (!cs.length) return { result: 'empty', focus: -1, fit: null, detail: [] };
    var frames = frameCandidates(cs, P);
    if (!(frames[0].s >= P.MIN_SIZE) && !told) return { result: 'more', reason: 'small', focus: -1, fit: null, detail: [] };
    if (!(frames[0].s > 0)) frames = [inkFrame([], P.TRIM, P, cs.map(function (c) { return c.pts[0]; }))];
    if (!(frames[0].s > 0)) return { result: 'shape', focus: 0, fit: null, detail: [] };
    var q = model.polys.length;
    var al = alignBest(cs, frames, model, q, P, maxJoin);
    var detail = maxOf(al);
    if (al.ok) return { result: 'ok', focus: -1, fit: al.fit, detail: detail };
    if (!told && cs.length < q) {   // 画が足りないだけ（画の数が手本より少ないときだけ）: 手本の前の方の画だけと合っている
      for (var j = 1; j < q; j++) {
        if (alignBest(cs, frames, model, j, P, maxJoin).ok) return { result: 'more', reason: 'short', focus: -1, fit: al.fit, detail: detail };
      }
    }
    var firstBad = function (pred) {
      for (var i = 0; i < al.pairs.length; i++) { var x = al.pairs[i]; if (pred(x)) return x.t === 'pair' ? x.m0 : x.t === 'extraM' ? x.m0 : Math.min(q - 1, Math.max(0, x.c0)); }
      return -1;
    };
    var isFail = function (x) { return x.t === 'pair' ? !x.r.ok : (x.t === 'extraC' || x.t === 'extraM'); };
    // order: 画の数が同じで、順を問わない対応がある（どの枠の合わせ方でもよい）
    if (cs.length === q) {
      var fits = [al.fit].concat(frames.filter(function (fr) { return fr.s > 0; }).map(function (fr) { return makeFit(fr, al.mf, P); }));
      for (var fi = 0; fi < fits.length; fi++) {
        var fo = orderFocus(cs, fits[fi], al.mf, model, P);
        if (fo >= 0) return { result: 'order', focus: fo, fit: al.fit, detail: detail };
      }
    }
    var fails = al.pairs.filter(isFail);
    if (fails.length && fails.every(function (x) { return x.t === 'pair' && x.r.reverse; })) {
      return { result: 'reverse', focus: firstBad(function (x) { return x.t === 'pair' && x.r.reverse; }), fit: al.fit, detail: detail };
    }
    return { result: 'shape', focus: firstBad(isFail), fit: al.fit, detail: detail };
  }

  // ---- 手本から「崩した正しい字」を作る（テストの F1 と #debug の自動の書き手）----
  // prm: size・cx・cy（字の大きさと中心。板の座標）、aspect（横/縦）、rot（ラジアン）、shift（画ごとのずれ。字の大きさ比）、scaleJit（画ごとの大きさ ±）、
  //      tremor（手のふるえ。板の座標）、step（点の間隔）、dup（同じ点を重ねる）、hook（終点の曲がりの長さ）、tap（点の画を触るだけに）、
  //      join（隣り合う 2 画を 1 画に: 前の画の番号）、split（途中で 2 つに分ける画の番号）、stray（離れた所に小点）、mirror（左右反転）
  function synthInk(ch, prm, rng) {
    var m = modelOf(ch);
    if (!m) return [];
    prm = prm || {}; rng = rng || Math.random;
    var R = function (a, b) { return a + (b - a) * rng(); };
    var size = prm.size != null ? prm.size : 0.8, cx = prm.cx != null ? prm.cx : 0.5, cy = prm.cy != null ? prm.cy : 0.5;
    var asp = prm.aspect || 1, rot = prm.rot || 0, sh = prm.shift || 0, sj = prm.scaleJit || 0;
    var tremor = prm.tremor || 0, step = prm.step || 0.01, hook = prm.hook || 0;
    var all = [];
    m.polys.forEach(function (p) { p.forEach(function (q) { all.push(q); }); });
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    all.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    var mc = [(x0 + x1) / 2, (y0 + y1) / 2], ms = Math.max(x1 - x0, y1 - y0);
    // 画ごとの単位座標（字の大きさ 1）
    var units = m.polys.map(function (p, i) {
      var u = p.map(function (q) { return [(q[0] - mc[0]) / ms * (prm.mirror ? -1 : 1), (q[1] - mc[1]) / ms]; });
      var g = centroid(u), f = 1 + R(-sj, sj), dx = R(-sh, sh), dy = R(-sh, sh);
      var len = m.strokes[i].len / ms;
      var out = u.map(function (q) { return [g[0] + (q[0] - g[0]) * f + dx, g[1] + (q[1] - g[1]) * f + dy]; });
      return { pts: out, tap: !!prm.tap && len < 0.2 };
    });
    // 結合・分割
    var list = [];
    for (var i = 0; i < units.length; i++) {
      if (prm.join === i && i + 1 < units.length) { list.push({ pts: units[i].pts.concat(units[i + 1].pts), tap: false }); i++; }
      else list.push(units[i]);
    }
    var sx = Math.sqrt(asp), sy = 1 / Math.sqrt(asp), ca = Math.cos(rot), sa = Math.sin(rot);
    var place = function (q) {
      var x = q[0] * sx, y = q[1] * sy;
      return [cx + size * (x * ca - y * sa), cy + size * (x * sa + y * ca)];
    };
    var ink = [];
    list.forEach(function (st, k) {
      var pts = st.pts.map(place);
      if (st.tap) { var c = centroid(pts); ink.push([c, [c[0], c[1]]]); return; }
      var pieces = [pts];
      if (prm.split === k) {
        var L = polyLen(pts), cut = resampleStep(pts, 0.005), acc = 0, a = [], b = [];
        cut.forEach(function (q, j) {
          if (j) acc += dist(cut[j - 1], q);
          if (acc < L / 2 - 0.025) a.push(q); else if (acc > L / 2 + 0.025) b.push(q);
        });
        if (a.length > 1 && b.length > 1) pieces = [a, b];
      }
      pieces.forEach(function (pc, pi) {
        var pp = resampleStep(pc, step), w1 = R(0, 7), w2 = R(0, 7), f1 = 2 * Math.PI / R(0.10, 0.25), f2 = 2 * Math.PI / R(0.10, 0.25), arc = 0;
        pp = pp.map(function (q, j) {
          if (j) arc += dist(pp[j - 1], q);
          return tremor ? [q[0] + tremor * Math.sin(f1 * arc + w1), q[1] + tremor * Math.sin(f2 * arc + w2)] : [q[0], q[1]];
        });
        if (hook > 0 && pi === pieces.length - 1 && pp.length > 1) {   // 終点に曲がりを付け足す
          var e = pp[pp.length - 1], b0 = pp[Math.max(0, pp.length - 4)], ang = Math.atan2(e[1] - b0[1], e[0] - b0[0]) + 1.1;
          pp.push([e[0] + Math.cos(ang) * hook * 0.5, e[1] + Math.sin(ang) * hook * 0.5], [e[0] + Math.cos(ang) * hook, e[1] + Math.sin(ang) * hook]);
        }
        if (prm.dup) { var d2 = []; pp.forEach(function (q) { d2.push(q, [q[0], q[1]]); }); pp = d2; }
        ink.push(pp);
      });
    });
    if (prm.stray) {
      var sp = [rng() < 0.5 ? 0.03 : 0.97, rng() < 0.5 ? 0.03 : 0.97];
      if (rng() < 0.5) ink.unshift([sp]); else ink.push([sp]);
    }
    return ink;
  }

  // ---- 字の選び方・記録（13.5〜13.6）----
  function countOf(m, c) { var v = m && m[c]; return typeof v === 'number' && v > 0 ? v : 0; }
  function inSoloSets(c) {
    var sets = DEFAULTS.SOLO_SETS;
    for (var i = 0; i < sets.length; i++) if (S.SETS[sets[i]] && S.SETS[sets[i]].indexOf(c) >= 0) return true;
    return false;
  }
  // 出せる字: なぞりで書いた回数が SOLO_READY 以上で、苦手でない字（SOLO_SETS の字だけ）
  function soloReady(chars, trace) {
    var seen = Object.create(null), out = [];
    (chars || []).forEach(function (c) {
      if (seen[c]) return; seen[c] = true;
      if (inSoloSets(c) && countOf(trace && trace.done, c) >= DEFAULTS.SOLO_READY && !T.isWeak(trace, c)) out.push(c);
    });
    return out;
  }
  // 誘いの合図: 集合の字が全部 1 回以上なぞってある
  function soloInvite(chars, trace) {
    var list = chars || [];
    return list.length > 0 && list.every(function (c) { return countOf(trace && trace.done, c) >= 1; });
  }
  // → [{ ch, why }] why: chosen・review・name・new。入力は書き換えない
  function pickSoloChars(chars, trace, opts, rng) {
    opts = opts || {};
    var n = typeof opts.n === 'number' ? Math.floor(opts.n) : 4;
    var list = [], seen = Object.create(null), order = Object.create(null);
    (chars || []).forEach(function (c) { if (!seen[c]) { seen[c] = 1; order[c] = list.length; list.push(c); } });
    var chosen = typeof opts.chosen === 'string' && opts.chosen ? opts.chosen : '';
    if (!(n > 0)) return [];
    var key = Object.create(null);
    list.forEach(function (c) { key[c] = rng ? rng() : 0; });   // くじの鍵は字ごとに chars の順で 1 回だけ
    var solo = function (c) { return countOf(trace && trace.solo, c); };
    var cand = soloReady(list, trace);
    var avoidMap = Object.create(null);
    (opts.prev || []).forEach(function (c) { avoidMap[c] = true; });
    var avoid = function (c) { return !!avoidMap[c]; };
    var bySolo = function (a, b) { return solo(a) - solo(b) || key[a] - key[b]; };
    var picks = [], taken = Object.create(null);
    function put(c, why) { if (taken[c] || picks.length >= n) return false; taken[c] = true; picks.push({ ch: c, why: why }); return true; }
    if (chosen) put(chosen, 'chosen');
    var review = cand.filter(function (c) { return solo(c) >= 1 && !avoid(c) && !taken[c]; }).sort(bySolo);
    if (review.length) put(review[0], 'review');
    var rest = [];   // 名前・まだの字（chars の順で並べ直す）
    var names = T.nameTraceChars(opts.name, list).map(function (o) { return o.ch; })
      .filter(function (c) { return cand.indexOf(c) >= 0 && solo(c) === 0 && !avoid(c) && !taken[c]; });
    if (names.length && picks.length < n) { rest.push({ ch: names[0], why: 'name' }); taken[names[0]] = true; }
    cand.forEach(function (c) {
      if (solo(c) === 0 && !avoid(c) && !taken[c] && picks.length + rest.length < n) { rest.push({ ch: c, why: 'new' }); taken[c] = true; }
    });
    rest.sort(function (a, b) { return order[a.ch] - order[b.ch]; });
    rest.forEach(function (o) { picks.push(o); });
    // 足りないとき: 書けた字を少ない順 → 前の回の字 → 候補の残り
    if (picks.length < n) {
      cand.filter(function (c) { return !taken[c] && !avoid(c); }).sort(bySolo).forEach(function (c) { put(c, 'review'); });
      cand.filter(function (c) { return !taken[c]; }).sort(bySolo).forEach(function (c) { put(c, 'review'); });
    }
    return picks;
  }
  // ひとりで書けた記録: done と solo をどちらも +1（99 で止める）。help は変えない。入力は書き換えない
  function recordSolo(trace, ch) {
    var src = trace && typeof trace === 'object' ? trace : {};
    var out = {};
    Object.keys(src).forEach(function (k) { out[k] = src[k]; });
    var done = {}, solo = {};
    Object.keys(src.done || {}).forEach(function (k) { done[k] = src.done[k]; });
    Object.keys(src.solo || {}).forEach(function (k) { solo[k] = src.solo[k]; });
    done[ch] = Math.min(99, countOf(done, ch) + 1);
    solo[ch] = Math.min(99, countOf(solo, ch) + 1);
    out.done = done; out.solo = solo;
    if (!out.help) out.help = {};
    return out;
  }
  // めんきょ: 集合の字が全部 ひとりで書けた
  function soloLicense(trace, setId) {
    var cs = S.SETS[setId];
    if (!cs) return false;
    return cs.split('').every(function (c) { return countOf(trace && trace.solo, c) >= 1; });
  }

  var api = {
    DEFAULTS: DEFAULTS, judgeSolo: judgeSolo, inkFrame: inkFrame, resample: resample, dtw: dtw, compareStroke: compareStroke,
    alignStrokes: alignStrokes, fitPoint: fitPoint, synthInk: synthInk, soloReady: soloReady, soloInvite: soloInvite,
    pickSoloChars: pickSoloChars, recordSolo: recordSolo, soloLicense: soloLicense
  };
  if (node) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.freewrite = api; }
})(typeof window !== 'undefined' ? window : globalThis);
