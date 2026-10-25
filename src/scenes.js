// 現場・ごほうびカード・タイトルの Canvas 描画。DOM のイベントは持たない（hit() で位置→ものの番号を返すだけ）。
// 論理座標は幅 800 固定、高さは canvas の縦横比に合わせて決める（どの画面サイズでも崩れない）。
(function (root) {
  'use strict';
  var V = function () { return root.Manabi.vehicles; };
  var W = 800;
  var OUT = '#3a2b24';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fillRR(ctx, x, y, w, h, r, fill, stroke, lw) {
    rrect(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function linepx(ctx, x1, y1, x2, y2, w, col) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.lineCap = 'round'; ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
  }
  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function sparkle(ctx, x, y, r, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
    ctx.beginPath();
    for (var i = 0; i < 8; i++) { var ang = i * Math.PI / 4, rad = i % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad); }
    ctx.closePath(); ctx.fillStyle = '#fff2a0'; ctx.fill(); ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  // ---- ものの絵（現場ごと）: 中心 (x,y)・約 s px ----
  function drawCat(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineWidth = 0.05; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // しっぽ
    ctx.beginPath(); ctx.moveTo(0.3, 0.3); ctx.quadraticCurveTo(0.6 + Math.sin((t || 0) * 4) * 0.05, 0.2, 0.5, -0.1);
    ctx.lineWidth = 0.1; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 0.06; ctx.strokeStyle = '#f0a04a'; ctx.stroke();
    ctx.lineWidth = 0.05; ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.ellipse(0, 0.25, 0.32, 0.25, 0, 0, Math.PI * 2); ctx.fillStyle = '#f0a04a'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.3, -0.12); ctx.lineTo(-0.27, -0.46); ctx.lineTo(-0.07, -0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.3, -0.12); ctx.lineTo(0.27, -0.46); ctx.lineTo(0.07, -0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -0.08, 0.34, 0, Math.PI * 2); ctx.fillStyle = '#f6b25f'; ctx.fill(); ctx.stroke();
    circle(ctx, -0.12, -0.1, 0.045, OUT); circle(ctx, 0.12, -0.1, 0.045, OUT);
    ctx.beginPath(); ctx.moveTo(-0.04, 0.0); ctx.lineTo(0.04, 0.0); ctx.lineTo(0, 0.05); ctx.closePath(); ctx.fillStyle = '#e57373'; ctx.fill();
    ctx.lineWidth = 0.025; ctx.strokeStyle = OUT;
    [[-0.34, 0.0, -0.18, 0.02], [-0.34, 0.08, -0.18, 0.06], [0.34, 0.0, 0.18, 0.02], [0.34, 0.08, 0.18, 0.06]].forEach(function (l) {
      ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke();
    });
    ctx.restore();
  }
  function drawRock(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineJoin = 'round'; ctx.lineWidth = 0.06; ctx.strokeStyle = OUT;
    ctx.beginPath();
    ctx.moveTo(-0.42, 0.32); ctx.lineTo(-0.5, 0.0); ctx.lineTo(-0.25, -0.34); ctx.lineTo(0.18, -0.4);
    ctx.lineTo(0.48, -0.08); ctx.lineTo(0.42, 0.32); ctx.closePath();
    ctx.fillStyle = '#9a8f84'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.25, -0.34); ctx.lineTo(0.18, -0.4); ctx.lineTo(0.05, -0.05); ctx.lineTo(-0.3, -0.05); ctx.closePath();
    ctx.fillStyle = '#b9afa4'; ctx.fill();
    ctx.restore();
  }
  function drawItem(ctx, scene, x, y, s, t) {
    if (scene === 'takai') drawCat(ctx, x, y, s, t);
    else if (scene === 'michi') drawRock(ctx, x, y, s);
    else { ctx.save(); ctx.translate(x, y + s * 0.05); ctx.scale(s * 0.9, s * 0.9); V().drawFlame(ctx, t); ctx.restore(); }
  }

  // ふりがなつきの文字（design-elementary 3.7）。segments = furigana() の結果。中心 (x, y)・本文の大きさ size px。ふりがなは本文の 45% で上に
  function drawRuby(ctx, segments, x, y, size) {
    var rs = Math.max(8, Math.round(size * 0.45)), bs = Math.round(size), widths = [], total = 0;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = OUT;
    segments.forEach(function (sg) {
      ctx.font = 'bold ' + bs + 'px sans-serif'; var w = ctx.measureText(sg.t).width;
      if (sg.r) { ctx.font = 'bold ' + rs + 'px sans-serif'; w = Math.max(w, ctx.measureText(sg.r).width); }
      widths.push(w); total += w;
    });
    var cx = x - total / 2;
    segments.forEach(function (sg, i) {
      var mid = cx + widths[i] / 2;
      ctx.font = 'bold ' + bs + 'px sans-serif'; ctx.fillText(sg.t, mid, y);
      if (sg.r) { ctx.font = 'bold ' + rs + 'px sans-serif'; ctx.fillText(sg.r, mid, y - bs * 0.72); }
      cx += widths[i];
    });
    ctx.restore();
  }

  // ---- 配置 ----
  // rect の中に count 個を cols 列で並べた中心座標。cell は 1 マスの大きさ
  function grid(count, cols, rect, cap) {
    var rows = Math.ceil(count / cols);
    var cell = Math.min(rect.w / Math.max(cols, 2), rect.h / rows, cap);
    var out = [];
    for (var i = 0; i < count; i++) {
      var r = Math.floor(i / cols), c = i % cols;
      var inRow = Math.min(cols, count - r * cols);
      out.push({
        x: rect.x + rect.w / 2 + (c - (inRow - 1) / 2) * cell,
        y: rect.y + rect.h / 2 + (r - (rows - 1) / 2) * cell,
        s: cell * 0.82
      });
    }
    return out;
  }

  // 10 より多いものを「10 個入りの箱 + ばら」で並べる（S1。design-elementary 3.8 の M8・M10）。
  // tokens = [{ t:'box' }（10 個・5×2 の箱）, { t:'loose', n }（ばら。5 列）, { t:'plus' }]。横に並べるか縦に積むか、大きく置ける方を選ぶ。
  // → { groups:[[{x,y,s}…] …（box / loose ごと）], boxes:[rect…], plus:{x,y,s}|null }。グループの順 = tokens の順（plus は含まない）
  function boxLayout(tokens, rect, cap) {
    var PAD = 0.15, GAP = 0.5;
    var dims = tokens.map(function (t) {
      if (t.t === 'box') return { w: 5 + PAD * 2, h: 2 + PAD * 2 };
      if (t.t === 'plus') return { w: 1, h: 1 };
      return { w: Math.min(t.n, 5), h: Math.ceil(t.n / 5) };
    });
    function sum(k) { return dims.reduce(function (a, d) { return a + d[k]; }, 0) + GAP * (dims.length - 1); }
    function max(k) { return dims.reduce(function (a, d) { return Math.max(a, d[k]); }, 0); }
    var cellH = Math.min(rect.w / sum('w'), rect.h / max('h')), cellV = Math.min(rect.w / max('w'), rect.h / sum('h'));
    var horiz = cellH >= cellV, cell = Math.min(horiz ? cellH : cellV, cap);
    var totW = (horiz ? sum('w') : max('w')) * cell, totH = (horiz ? max('h') : sum('h')) * cell;
    var cx = rect.x + (rect.w - totW) / 2, cy = rect.y + (rect.h - totH) / 2, out = { groups: [], boxes: [], plus: null };
    tokens.forEach(function (t, i) {
      var d = dims[i], w = d.w * cell, h = d.h * cell;
      var x0 = horiz ? cx : cx + (totW - w) / 2, y0 = horiz ? cy + (totH - h) / 2 : cy;
      if (t.t === 'plus') out.plus = { x: x0 + w / 2, y: y0 + h / 2, s: cell * 0.9 };
      else {
        var ox = x0, oy = y0, n = t.t === 'box' ? 10 : t.n, g = [];
        if (t.t === 'box') { out.boxes.push({ x: x0, y: y0, w: w, h: h }); ox += PAD * cell; oy += PAD * cell; }
        for (var k = 0; k < n; k++) g.push({ x: ox + (k % 5 + 0.5) * cell, y: oy + (Math.floor(k / 5) + 0.5) * cell, s: cell * 0.82 });
        out.groups.push(g);
      }
      if (horiz) cx += w + GAP * cell; else cy += h + GAP * cell;
    });
    return out;
  }
  // 10 のまとまり（箱）+ ばら の tokens
  function tensTokens(n) {
    var t = [], i;
    for (i = 0; i < Math.floor(n / 10); i++) t.push({ t: 'box' });
    if (n % 10) t.push({ t: 'loose', n: n % 10 });
    return t;
  }
  function flat(groups) { return [].concat.apply([], groups); }

  // M11（S2）: 100 までの数を「10 の束 + ばら」で並べる。束（10 個入りの帯。値 10）は上に 5 列、ばらはその下に 5 列。
  // → { items:[{x,y,s,v,bundle,w,h}…（束 → ばらの順。数え聞かせもこの順）] }。束は 1 つで v = 10
  function tensLayout(n, rect, cap) {
    var t = Math.floor(n / 10), o = n % 10, items = [], both = t > 0 && o > 0;
    if (t > 0) {
      var bh0 = both ? rect.h * 0.58 : rect.h, cols = Math.min(t, 5), rows = Math.ceil(t / cols);
      var cw = Math.min(rect.w / cols, bh0 / rows * 2, cap * 2), bw = cw * 0.9, bh = bw / 2;   // 束は横長（2:1）
      var y0 = rect.y + bh0 / 2 - rows * cw / 4;
      for (var i = 0; i < t; i++) {
        var r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, t - r * cols);
        items.push({ x: rect.x + rect.w / 2 + (c - (inRow - 1) / 2) * cw, y: y0 + (r + 0.5) * cw / 2, s: bw * 0.6, v: 10, bundle: true, w: bw, h: bh });
      }
    }
    if (o > 0) {
      var ly = both ? rect.y + rect.h * 0.6 : rect.y, lh = both ? rect.h * 0.4 : rect.h;
      grid(o, Math.min(o, 5), { x: rect.x, y: ly, w: rect.w, h: lh }, cap).forEach(function (g) { items.push(g); });
    }
    return { items: items };
  }
  // M13（S2）: d こずつ入った箱が m ばこ。箱を並べて、中にものを d 個ずつ。
  // → { boxes:[rect…], minis:[{x,y,s}…]（中のもの）, items:[{x,y,s,v:d,ghost:true}…]（箱ごとの「手がかり」。数え聞かせ・タップはこれ）}
  function groupLayout(m, d, rect, cap) {
    var GW = d + 0.6, GH = 1.5, GAP = 0.4, best = null, c;
    for (c = 1; c <= Math.min(m, 5); c++) {
      var rows = Math.ceil(m / c), W0 = c * GW + (c - 1) * GAP, H0 = rows * GH + (rows - 1) * GAP, cell = Math.min(rect.w / W0, rect.h / H0, cap);
      if (!best || cell > best.cell + 1e-9) best = { cell: cell, cols: c, rows: rows, W: W0, H: H0 };
    }
    var cell = best.cell, oy = rect.y + (rect.h - best.H * cell) / 2, out = { boxes: [], minis: [], items: [] };
    for (var i = 0; i < m; i++) {
      var r = Math.floor(i / best.cols), cc = i % best.cols, inRow = Math.min(best.cols, m - r * best.cols);
      var rowW = inRow * GW + (inRow - 1) * GAP, rx = rect.x + (rect.w - rowW * cell) / 2;
      var x = rx + cc * (GW + GAP) * cell, y = oy + r * (GH + GAP) * cell, w = GW * cell, h = GH * cell;
      out.boxes.push({ x: x, y: y, w: w, h: h });
      for (var k = 0; k < d; k++) out.minis.push({ x: x + 0.3 * cell + (k + 0.5) * cell, y: y + h / 2, s: cell * 0.82 });
      out.items.push({ x: x + w / 2, y: y + h / 2, s: h * 1.1, v: d, ghost: true });
    }
    return out;
  }

  // 10 の束（M11）: 10 個入りの帯。中に 5×2 のものと、まん中に ひも
  function drawBundle(ctx, scene, b, sc, dy, now) {
    var w = b.w * sc, h = b.h * sc, x = b.x - w / 2, y = b.y - h / 2 + dy;
    fillRR(ctx, x, y, w, h, 8, 'rgba(226,185,120,0.55)', '#9a6a2e', 3);
    var cell = Math.min(w / 5.4, h / 2.3);
    linepx(ctx, x + w * 0.5, y + 2, x + w * 0.5, y + h - 2, Math.max(3, w * 0.025), 'rgba(154,106,46,0.8)');   // ひも（ものの うしろ）
    for (var k = 0; k < 10; k++) drawItem(ctx, scene, b.x + ((k % 5) - 2) * cell, b.y + dy + (Math.floor(k / 5) - 0.5) * cell, cell * 0.86, now);
  }

  // ======== 現場ステージ ========
  function Stage(canvas) {
    this.canvas = canvas;
    this.scene = 'kaji';
    this.shown = 0;          // 表示中の進み具合（0..4。アニメで target に近づく）
    this.target = 0;
    this.anim = null;        // { t0, dur, from, to, kind }
    this.prob = null;
    this.items = [];
    this.boxes = [];         // 10 個入りの箱（S1。うしろに描く）
    this.minis = [];         // M13: 箱の中のもの
    this.eq = '';            // M12・M13: 式の文字（盤に大きく出す）
    this.eqAns = '';         // 正解のあとに足す「＝ 答え」
    this.gone = [];          // ひきざん: いなくなる b 個（items には入れない）
    this.subT0 = null;       // ひきざん: 出題の時刻（描画で最初に決める）
    this.marks = [];
    this.bounceIdx = -1; this.bounceT0 = 0;
    this.picBounceT0 = -9;
    this.hintT0 = -9;        // とけい: 短針をふくらませ始めた時刻
    this.silent = false;
    this.resize();
  }
  Stage.prototype.resize = function () {
    var c = this.canvas, dpr = root.devicePixelRatio || 1;
    var cw = Math.max(1, c.clientWidth), ch = Math.max(1, c.clientHeight);
    c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
    this.k = c.width / W; this.H = ch / cw * W; this.cssScale = cw / W;
    this.layout();
  };
  Stage.prototype.setScene = function (s) { this.scene = s; };
  Stage.prototype.setProgress = function (n) { this.shown = this.target = n; this.anim = null; };
  Stage.prototype.setProblem = function (p) {
    this.prob = p; this.subT0 = null; this.marks = []; this.bounceIdx = -1; this.word = null; this.reveal = false;
    this.caption = '';
    if (p && p.kind === 'letter') {
      var ws = root.Manabi.data.ALL_WORDS;
      for (var i = 0; i < ws.length; i++) if (ws[i].id === p.wordId) this.word = ws[i];
      if (!this.word) this.word = { pic: p.pic };   // K7・K8 は単語表にない（問題が絵を持っている）
    }
    this.layout();
  };
  // えいご: 英語の字幕（つづり。いつも出す）。null で消す
  Stage.prototype.setCaption = function (text) { this.caption = text || ''; this.layout(); };
  Stage.prototype.board = function () {
    var H = this.H;
    return { x: W * 0.05, y: H * 0.03, w: W * 0.9, h: Math.min(H * 0.53, W * 0.62) };
  };
  Stage.prototype.layout = function () {
    var p = this.prob, b = this.board(), it = [], pad = 14;
    var inner = { x: b.x + pad, y: b.y + pad, w: b.w - pad * 2, h: b.h - pad * 2 };
    var gone = [], boxes = [], minis = [], eq = '', eqPos = null;
    this.plus = null; this.pic = null; this.clock = null; this.speaker = null;
    if (p && p.kind === 'count' && p.tens) {   // M11: 10 の束 + ばら
      it = tensLayout(p.n, inner, 90).items;
    } else if (p && p.kind === 'count' && p.n > 10) {
      var cl = boxLayout(tensTokens(p.n), inner, 110);
      it = flat(cl.groups); boxes = cl.boxes;
    } else if (p && p.kind === 'count') {
      it = grid(p.n, p.n <= 5 ? p.n : 5, inner, 150);
    } else if (p && p.mental) {   // M12: 暗算。ものは出さず、式を大きく出す
      eq = p.a + ' ' + (p.kind === 'add' ? '+' : '\u2212') + ' ' + p.b + ' = ';
      eqPos = { x: inner.x + inner.w / 2, y: inner.y + inner.h / 2, w: inner.w, h: inner.h * 0.6 };
    } else if (p && p.kind === 'mul') {   // M13: d こずつ入った箱が m ばこ
      var gl = groupLayout(p.b, p.a, { x: inner.x, y: inner.y, w: inner.w, h: inner.h * 0.78 }, 96);
      it = gl.items; boxes = gl.boxes; minis = gl.minis;
      eq = p.a + ' \u00d7 ' + p.b + ' = ';
      eqPos = { x: inner.x + inner.w / 2, y: inner.y + inner.h * 0.89, w: inner.w, h: inner.h * 0.2 };
    } else if (p && p.kind === 'add' && p.a > 10) {   // M8: 12+3 は「箱 + ばら」+ ばら
      var al = boxLayout(tensTokens(p.a).concat([{ t: 'plus' }, { t: 'loose', n: p.b }]), inner, 110);
      it = flat(al.groups); boxes = al.boxes; this.plus = al.plus;
    } else if (p && p.kind === 'add') {
      var colsFor = function (n) { return n <= 3 ? n : (n === 4 ? 2 : 3); };
      var half = inner.w * 0.42;
      var A = grid(p.a, colsFor(p.a), { x: inner.x, y: inner.y, w: half, h: inner.h }, 130);
      var B = grid(p.b, colsFor(p.b), { x: inner.x + inner.w - half, y: inner.y, w: half, h: inner.h }, 130);
      it = A.concat(B);
      this.plus = { x: inner.x + inner.w / 2, y: inner.y + inner.h / 2, s: Math.min(inner.w * 0.12, 70) };
    } else if (p && p.kind === 'sub' && p.a > 10) {   // M10: 13−5 は「箱 + ばら」のうしろの b 個がいなくなる
      var sl = boxLayout(tensTokens(p.a), inner, 110), sall = flat(sl.groups);
      it = sall.slice(0, p.a - p.b); gone = sall.slice(p.a - p.b); boxes = sl.boxes;
    } else if (p && p.kind === 'sub') {
      var all = grid(p.a, p.a <= 5 ? p.a : 5, inner, 150);
      it = all.slice(0, p.a - p.b); gone = all.slice(p.a - p.b);   // うしろの b 個がいなくなる
    } else if (p && p.kind === 'clock') {
      this.clock = { x: inner.x + inner.w / 2, y: inner.y + inner.h / 2, r: Math.min(inner.w, inner.h) / 2 * 0.97, x0: inner.x, y0: inner.y, w: inner.w, h: inner.h };
    } else if (p && p.kind === 'english') {
      var sp = Math.min(inner.w * 0.7, inner.h * (this.caption ? 0.66 : 0.95));   // 字幕（つづり）があるときは小さくして下に字幕の場所を空ける
      this.speaker = { x: inner.x + inner.w / 2, y: inner.y + (this.caption ? inner.h * 0.38 : inner.h * 0.5), s: sp };
      this.pic = { x: this.speaker.x, y: this.speaker.y, s: sp };
      if (p.form === 'number') it = grid(p.n, p.n <= 5 ? p.n : 5, this.caption ? { x: inner.x, y: inner.y, w: inner.w, h: inner.h * 0.8 } : inner, 150);   // 字幕（つづり）の場所を下に空ける
    } else if (p && p.kind === 'letter') {
      var s = Math.min(inner.w * 0.7, inner.h * 1.0);
      this.pic = { x: inner.x + inner.w / 2, y: inner.y + inner.h / 2, s: s };
    }
    this.items = it; this.gone = gone; this.boxes = boxes; this.minis = minis; this.eq = eq; this.eqPos = eqPos;
  };
  Stage.prototype.bounce = function (i, now) { this.bounceIdx = i; this.bounceT0 = now; };
  Stage.prototype.bouncePic = function (now) { this.picBounceT0 = now; };
  Stage.prototype.pulseHour = function (now) { this.hintT0 = now; };
  // 短針のふくらみ 0..1（0.9 秒周期で 2 回）
  Stage.prototype.pulseAt = function (now) {
    var bt = now - this.hintT0;
    return bt >= 0 && bt < 1.8 ? Math.abs(Math.sin(bt / 0.9 * Math.PI)) : 0;
  };
  // 位置(CSS px, canvas 左上基準) -> ものの番号。無ければ -1
  Stage.prototype.hit = function (px, py) {
    var x = px / this.cssScale, y = py / this.cssScale, best = -1, bd = 1e9;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i], d = Math.hypot(x - it.x, y - it.y);
      if (d < it.s * 0.75 && d < bd) { bd = d; best = i; }
    }
    return best;
  };
  // i 番目に印を付ける。返すのは「ここまでに数えた合計」（ふつうは 1, 2, 3…。束や箱は v 個ぶん進む: 10, 20, 30, 31…）
  Stage.prototype.mark = function (i) {
    if (i < 0 || this.marks[i]) return 0;
    var n = this.items[i].v || 1;
    for (var j = 0; j < this.items.length; j++) if (this.marks[j]) n += this.items[j].v || 1;
    this.marks[i] = n;
    return n;
  };
  Stage.prototype.clearMarks = function () { this.marks = []; };
  // 正解のあとの演出。solved = 正解数（1..4）。dur 秒かけて進み具合が動く
  Stage.prototype.advance = function (solved, now, dur) {
    this.anim = { t0: now, dur: dur || 1.6, from: this.shown, to: solved, kind: this.scene };
    this.target = solved;
  };
  Stage.prototype.animating = function (now) { return !!this.anim && now - this.anim.t0 < this.anim.dur; };

  Stage.prototype.draw = function (now) {
    var c = this.canvas, ctx = c.getContext('2d'), H = this.H;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var a = this.anim, fxT = -1;
    if (a) {
      var u = (now - a.t0) / a.dur;
      if (u >= 1) { this.shown = a.to; this.anim = null; }
      else { this.shown = lerp(a.from, a.to, ease((u - 0.25) / 0.75)); fxT = u; }
    }
    var pr = this.prob;
    var hide = !this.reveal && !!pr && ((pr.kind !== 'letter' && pr.kind !== 'clock') || (this.scene === 'kaji' && this.word && this.word.pic === 'flame'));
    drawBackground(ctx, this.scene, this.shown, fxT, now, H, hide);
    // ボード
    var b = this.board();
    fillRR(ctx, b.x, b.y, b.w, b.h, 28, 'rgba(255,255,255,0.84)', 'rgba(58,43,36,0.35)', 3);
    var i, p = this.prob;
    if (p && p.kind === 'letter' && this.pic) {
      var pb = this.pic, bt = now - this.picBounceT0, k = bt >= 0 && bt < 0.6 ? 1 + 0.18 * Math.sin(bt / 0.6 * Math.PI) : 1;
      var dy = bt >= 0 && bt < 0.6 ? -Math.sin(bt / 0.6 * Math.PI) * 18 : 0;
      if (p.script === 'kanji' && this.reveal) {   // K8・K9: 正解のあとは、絵を左に寄せて、漢字をふりがなつきで右に大きく出す
        var bd0 = this.board(), ks = Math.min(pb.s * 0.62, bd0.h * 0.4, bd0.w * 0.26), ps = Math.min(pb.s * 0.72, bd0.w * 0.4, bd0.h * 0.8);   // 縦長の画面でも ボードに収める
        V().drawPic(ctx, this.word.pic, bd0.x + bd0.w * 0.3, pb.y + dy, ps * k, now);
        drawRuby(ctx, [{ t: p.answer, r: p.yomi }], bd0.x + bd0.w * 0.7, pb.y + ks * 0.12, ks);
      } else V().drawPic(ctx, this.word.pic, pb.x, pb.y + dy, pb.s * k, now);
    } else if (p && p.kind === 'english' && this.speaker && !(this.reveal && p.form === 'number')) {
      var sk = this.speaker, ebt = now - this.picBounceT0, ek = ebt >= 0 && ebt < 0.6 ? 1 + 0.15 * Math.sin(ebt / 0.6 * Math.PI) : 1;
      if (this.reveal && p.form === 'color') V().drawColorCar(ctx, sk.x, sk.y, sk.s, p.hex);   // E4: 正解の色の車を大きく
      else if (this.reveal && p.form === 'alpha') {   // E5: 乗り物の絵を左に、大きな文字を右に
        V().drawPic(ctx, p.pic, sk.x - sk.s * 0.3, sk.y, sk.s * 0.75, now);
        ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold ' + Math.round(sk.s * 0.8) + 'px sans-serif';
        ctx.fillText(p.letter, sk.x + sk.s * 0.5, sk.y + sk.s * 0.04);
      } else if (this.reveal) V().drawPic(ctx, p.pic, sk.x, sk.y, sk.s, now);   // 正解のあと: 乗り物の絵を大きく
      else drawSpeaker(ctx, sk.x, sk.y, sk.s * ek, now);
    } else if (p && p.kind === 'clock' && this.clock) {
      var ck = this.clock;
      if (p.form === 'read') root.Manabi.clockface.drawClock(ctx, ck.x, ck.y, ck.r, p.h + ':00', { numbers: 12, pulse: this.pulseAt(now) });
      else if (p.form === 'ampm') {   // T8: 場面（朝・夕方・夜）の空の上に時計。正解のあとは「ごぜん／ごご」の札を出す
        drawAmPmSky(ctx, b, p.scene, now);
        var cr = ck.r * 0.8, cy2 = ck.y - ck.h * 0.07;   // 時計を少し上に。下の帯に、正解のあと「ごぜん／ごご」の札を出す
        root.Manabi.clockface.drawClock(ctx, ck.x, cy2, cr, p.h + ':' + (p.m < 10 ? '0' : '') + p.m, { numbers: 12 });
        if (this.reveal) {
          var lab = root.Manabi.data.AMPM_LABEL[p.ap], lw2 = Math.min(b.w * 0.4, 230), lh2 = Math.min(b.h * 0.15, 56), ly2 = b.y + b.h - 12 - lh2;
          fillRR(ctx, ck.x - lw2 / 2, ly2, lw2, lh2, lh2 / 2, '#fff8e1', OUT, 4);
          ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold ' + Math.round(lh2 * 0.62) + 'px sans-serif';
          ctx.fillText(lab, ck.x, ly2 + lh2 / 2 + 2);
        }
      }
      else if (p.form === 'readmin') {   // T7: 1 分刻みの大きな時計（外周に 5,10,…の数字）。ヒントは短針と長針を一緒にふくらませる
        var rp = this.pulseAt(now);
        root.Manabi.clockface.drawClock(ctx, ck.x, ck.y, ck.r, p.h + ':' + (p.m < 10 ? '0' : '') + p.m, { numbers: 12, ticks: 60, minuteNums: true, pulse: rp, pulseMin: rp });
      } else if (p.form === 'elapsed') {   // T6: 開始時刻を大きな時計で。経過は「+20」のふだ
        // ふだは時計の右に並べる（時計に重ねると外周の分の数字が隠れる）。横幅が足りなければ時計を小さくする
        var er = ck.r * 0.9, bs = er * 0.85, gap = er * 0.12;
        if (2 * er + gap + bs > ck.w * 0.96) { er = ck.w * 0.96 / (2 + 0.12 + 0.85); bs = er * 0.85; gap = er * 0.12; }
        var ecx = ck.x - (gap + bs) / 2, ecy = ck.y;
        root.Manabi.clockface.drawClock(ctx, ecx, ecy, er, p.h0 + ':' + (p.m0 < 10 ? '0' : '') + p.m0, { numbers: 12, ticks: 60, minuteNums: true });
        drawElapsedBadge(ctx, ecx + er + gap + bs / 2, ecy, bs, p.dm);
      } else drawSign(ctx, ck, p);
    } else {
      this.boxes.forEach(function (bx) { fillRR(ctx, bx.x, bx.y, bx.w, bx.h, 10, 'rgba(226,185,120,0.55)', '#9a6a2e', 3); });   // 10 個入りの箱
      for (i = 0; i < this.minis.length; i++) drawItem(ctx, this.scene, this.minis[i].x, this.minis[i].y, this.minis[i].s, now);   // M13: 箱の中
      for (i = 0; i < this.items.length; i++) {
        var it = this.items[i], sc = 1, dy2 = 0, bt2 = now - this.bounceT0;
        if (i === this.bounceIdx && bt2 >= 0 && bt2 < 0.55) { var q = Math.sin(bt2 / 0.55 * Math.PI); sc = 1 + 0.3 * q; dy2 = -q * 14; }
        if (it.bundle) drawBundle(ctx, this.scene, it, sc, dy2, now);   // M11: 10 の束
        else if (!it.ghost) drawItem(ctx, this.scene, it.x, it.y + dy2, it.s * sc, now);
        if (this.marks[i]) {
          circle(ctx, it.x + it.s * 0.36, it.y - it.s * 0.36, Math.max(14, it.s * 0.2), '#3a9d5d', '#fff', 3);
          ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(16, it.s * 0.24) + 'px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(this.marks[i]), it.x + it.s * 0.36, it.y - it.s * 0.36 + 1);
        }
      }
      if (p && p.kind === 'sub' && this.gone.length) {   // いなくなる b 個: 1 秒後にうすくなって×。そのあともうすく残す
        if (this.subT0 === null) this.subT0 = now;
        var gu = Math.max(0, Math.min(1, (now - this.subT0 - 1) / 0.6)), gt = now - this.subT0 - 1;
        for (i = 0; i < this.gone.length; i++) {
          var g = this.gone[i];
          ctx.save(); ctx.globalAlpha = 1 - 0.7 * gu;
          drawItem(ctx, this.scene, g.x, g.y, g.s, now);
          ctx.restore();
          if (gu > 0) {
            var xs = g.s * 0.34 * (0.5 + 0.5 * gu);
            ctx.save(); ctx.globalAlpha = gu; ctx.lineCap = 'round';
            ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(9, g.s * 0.11);
            ctx.beginPath(); ctx.moveTo(g.x - xs, g.y - xs); ctx.lineTo(g.x + xs, g.y + xs); ctx.moveTo(g.x + xs, g.y - xs); ctx.lineTo(g.x - xs, g.y + xs); ctx.stroke();
            ctx.strokeStyle = '#e53935'; ctx.lineWidth = Math.max(6, g.s * 0.07);
            ctx.beginPath(); ctx.moveTo(g.x - xs, g.y - xs); ctx.lineTo(g.x + xs, g.y + xs); ctx.moveTo(g.x + xs, g.y - xs); ctx.lineTo(g.x - xs, g.y + xs); ctx.stroke();
            ctx.restore();
          }
          if (this.scene === 'kaji' && gt >= 0 && gt < 0.7) {   // 水しぶき
            var sp = gt / 0.7;
            ctx.save(); ctx.globalAlpha = 1 - sp; ctx.fillStyle = '#4aa3e8';
            for (var d = 0; d < 5; d++) { var an = -Math.PI * (0.15 + 0.7 * d / 4); circle(ctx, g.x + Math.cos(an) * g.s * 0.5 * sp, g.y + Math.sin(an) * g.s * 0.6 * sp, g.s * 0.07 * (1 - sp * 0.4), '#4aa3e8', null, 0); }
            ctx.restore();
          }
        }
      }
      if (this.plus) { // ＋
        var pl = this.plus;
        linePlus(ctx, pl.x, pl.y, pl.s);
      }
      if (this.eq && this.eqPos) {   // M12・M13: 式。正解のあとは「= 答え」まで出す（まだのときは「= ？」）
        var ep = this.eqPos, et = this.eq + (this.reveal ? p.answer : '?');
        ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var efs = Math.round(Math.max(24, Math.min(ep.h * 0.9, ep.w / (et.length * 0.62), p.mental ? 150 : 64)));
        ctx.font = 'bold ' + efs + 'px sans-serif';
        ctx.fillText(et, ep.x, ep.y, ep.w * 0.96);
      }
    }
    // えいご: 聞いた英語のつづりを下に出す（正解のあとも出したまま）
    if (p && p.kind === 'english' && this.caption) {
      ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.round(Math.max(24, Math.min(48, b.h * 0.15))) + 'px sans-serif';
      ctx.fillText(this.caption, b.x + b.w / 2, b.y + b.h - Math.max(22, b.h * 0.1), b.w * 0.9);
    }
  };
  // T8: 場面の空（盤の中だけ）。morning = 日の出 / evening = 夕焼け / night = 月と星
  function drawAmPmSky(ctx, b, scene, now) {
    ctx.save(); rrect(ctx, b.x, b.y, b.w, b.h, 28); ctx.clip();
    var g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (scene === 'night') { g.addColorStop(0, '#1d2a55'); g.addColorStop(1, '#3d4d88'); }
    else if (scene === 'evening') { g.addColorStop(0, '#ff8f5a'); g.addColorStop(1, '#ffd9a0'); }
    else { g.addColorStop(0, '#ffd7a8'); g.addColorStop(1, '#fff3d6'); }
    ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
    var r = Math.min(b.h * 0.15, 70), sx = b.x + b.w * 0.13, gy = b.y + b.h * 0.88;
    if (scene === 'morning') {   // 日の出: 左の地平線から半分
      for (var i = 0; i < 9; i++) { var a = Math.PI + i * Math.PI / 8; linepx(ctx, sx + Math.cos(a) * r * 1.3, gy + Math.sin(a) * r * 1.3, sx + Math.cos(a) * r * 1.8, gy + Math.sin(a) * r * 1.8, 5, '#ffb733'); }
      ctx.beginPath(); ctx.arc(sx, gy, r, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#ff9f1c'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    } else if (scene === 'evening') {   // 夕日: 右の低い位置
      circle(ctx, b.x + b.w * 0.87, gy - r * 0.2, r * 1.1, '#e8501f', OUT, 3);
    } else {   // 月と星
      var mx = b.x + b.w * 0.13, my = b.y + b.h * 0.22;
      circle(ctx, mx, my, r * 0.8, '#ffe680', null); circle(ctx, mx + r * 0.38, my - r * 0.2, r * 0.72, '#243263', null);
      [[0.3, 0.14, 7], [0.78, 0.2, 9], [0.9, 0.55, 6], [0.2, 0.55, 6], [0.62, 0.08, 6]].forEach(function (st, k) { sparkle(ctx, b.x + b.w * st[0], b.y + b.h * st[1], st[2] + Math.sin(now * 3 + k) * 2, 0.9); });
    }
    ctx.fillStyle = scene === 'night' ? '#2c3f3a' : scene === 'evening' ? '#5a7a4a' : '#7bbf6a';
    ctx.fillRect(b.x, gy, b.w, b.y + b.h - gy);
    ctx.restore();
    rrect(ctx, b.x, b.y, b.w, b.h, 28); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(58,43,36,0.35)'; ctx.stroke();
  }

  // えいご: 大きなスピーカー（音が出ているように波がゆれる）
  function drawSpeaker(ctx, x, y, s, t) {
    var r = s * 0.5;
    circle(ctx, x, y, r, '#dff0ff', OUT, 5);
    ctx.save(); ctx.translate(x - r * 0.18, y); ctx.scale(r / 100, r / 100);
    ctx.fillStyle = OUT; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-42, -22); ctx.lineTo(-18, -22); ctx.lineTo(10, -52); ctx.lineTo(10, 52); ctx.lineTo(-18, 22); ctx.lineTo(-42, 22); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a7bd5'; ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var k = 1 + 0.06 * Math.sin(t * 5 - i), a = 0.85 - i * 0.1;
      ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(10, 0, (30 + i * 22) * k, -a, a); ctx.stroke();
    }
    ctx.restore();
  }
  // 出動ひょうの札（形式 B）。大きな数字。○じはん は数字の下に半月のマークと「はん」
  function drawSign(ctx, ck, p) {
    var w = Math.min(ck.w * 0.8, ck.h * 1.5), h = ck.h * 0.98, x = ck.x - w / 2, y = ck.y - h / 2;
    fillRR(ctx, x, y, w, h, 26, '#fffdf5', null);
    ctx.save(); rrect(ctx, x, y, w, h, 26); ctx.clip();
    ctx.fillStyle = '#e53935'; ctx.fillRect(x, y, w, h * 0.17);   // 上の赤い帯（札の角丸で切る）
    ctx.restore();
    fillRR(ctx, x, y, w, h, 26, null, OUT, 5);
    for (var i = 0; i < 3; i++) circle(ctx, x + w * (0.4 + i * 0.1), y + h * 0.085, h * 0.035, '#fff2a0', OUT, 2);
    var half = p.m === 30, body = h * 0.83, by = y + h * 0.17;
    ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var fine = p.m !== 0 && !half;   // T4・T5 の細かい分は「3:15」のように出す（時だけだと別の時刻に見える）
    var label = fine ? p.h + ':' + (p.m < 10 ? '0' : '') + p.m : String(p.h);
    ctx.font = 'bold ' + Math.round(body * (half ? 0.58 : fine ? 0.5 : 0.8)) + 'px sans-serif';
    ctx.fillText(label, ck.x, by + body * (half ? 0.38 : 0.52), w * 0.9);
    if (half) {
      var my = by + body * 0.84, mr = body * 0.1;
      // 半月: まる全体の外わく + 右半分だけ色
      ctx.beginPath(); ctx.arc(ck.x - body * 0.25, my, mr, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(ck.x - body * 0.25, my, mr, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fillStyle = '#f2a900'; ctx.fill();
      ctx.beginPath(); ctx.arc(ck.x - body * 0.25, my, mr, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = OUT; ctx.font = 'bold ' + Math.round(body * 0.2) + 'px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('はん', ck.x - body * 0.25 + mr * 1.6, my + 2);
    }
  }
  // T6 の経過ふだ: 「+20」「+1じかん」。数字だけで分かる大きな丸
  function drawElapsedBadge(ctx, x, y, s, dm) {
    var hour = dm === 60, rr = s * 0.5;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.12);
    circle(ctx, 0, 0, rr, '#ff9f1c', OUT, 5);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(rr * (hour ? 0.5 : 0.78)) + 'px sans-serif';
    ctx.lineWidth = Math.max(3, rr * 0.12);
    var t1 = '+' + (hour ? '1' : dm);
    ctx.strokeText(t1, 0, hour ? -rr * 0.18 : 0); ctx.fillText(t1, 0, hour ? -rr * 0.18 : 0);
    if (hour) {
      ctx.font = 'bold ' + Math.round(rr * 0.4) + 'px sans-serif';
      ctx.strokeText('じかん', 0, rr * 0.38, rr * 1.7); ctx.fillText('じかん', 0, rr * 0.38, rr * 1.7);
    }
    ctx.restore();
  }
  function linePlus(ctx, x, y, s) {
    linepx(ctx, x - s / 2, y, x + s / 2, y, s * 0.28, '#3a2b24');
    linepx(ctx, x, y - s / 2, x, y + s / 2, s * 0.28, '#3a2b24');
    linepx(ctx, x - s / 2, y, x + s / 2, y, s * 0.16, '#ff9f1c');
    linepx(ctx, x, y - s / 2, x, y + s / 2, s * 0.16, '#ff9f1c');
  }

  // ---- 背景（進み具合つき） ----
  var ROCKS = [[0, 0, 1], [-0.7, 0.2, 0.8], [0.7, 0.2, 0.8], [-0.3, -0.5, 0.8], [0.35, -0.55, 0.8], [-1.1, 0.4, 0.6], [1.1, 0.4, 0.6], [0, -1.0, 0.7], [-0.6, -1.0, 0.6], [0.6, -1.0, 0.6]];

  function drawBackground(ctx, scene, prog, fxT, now, H, hide) {
    var gy = H * 0.86;
    var sky = ctx.createLinearGradient(0, 0, 0, gy);
    if (scene === 'kaji') { sky.addColorStop(0, '#ffd7a8'); sky.addColorStop(1, '#fff0d6'); }
    else if (scene === 'takai') { sky.addColorStop(0, '#9fd8f5'); sky.addColorStop(1, '#e6f6ff'); }
    else { sky.addColorStop(0, '#c9e8ff'); sky.addColorStop(1, '#f5fbff'); }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // くも
    circle(ctx, W * 0.12 + Math.sin(now * 0.3) * 8, H * 0.1, 26, 'rgba(255,255,255,0.8)');
    circle(ctx, W * 0.12 + 28 + Math.sin(now * 0.3) * 8, H * 0.1 + 6, 20, 'rgba(255,255,255,0.8)');
    // 地面
    ctx.fillStyle = scene === 'michi' ? '#8b8f94' : '#7bbf6a';
    ctx.fillRect(0, gy, W, H - gy);
    if (scene === 'kaji' || scene === 'takai') { ctx.fillStyle = '#9a9ea3'; ctx.fillRect(0, gy + (H - gy) * 0.3, W, (H - gy) * 0.5); }
    else { for (var d = 0; d < 6; d++) fillRR(ctx, W * (0.05 + d * 0.17), gy + (H - gy) * 0.45, W * 0.09, 6, 3, '#f5f5f5'); }
    var vs = clamp(Math.min(H * 0.27, W * 0.26), 70, 210), vy = gy - vs * 0.39 + 4;
    var Vh = V();
    if (scene === 'kaji') drawKaji(ctx, prog, fxT, now, H, gy, vs, vy, Vh, hide);
    else if (scene === 'takai') drawTakai(ctx, prog, fxT, now, H, gy, vs, vy, Vh, hide);
    else drawMichi(ctx, prog, fxT, now, H, gy, vs, vy, Vh, hide);
    if (prog >= 3.99) { // クリアのきらめき
      for (var s = 0; s < 6; s++) sparkle(ctx, W * (0.15 + s * 0.14), H * (0.72 + 0.08 * Math.sin(now * 2 + s)), 14 + 4 * Math.sin(now * 3 + s), 0.5 + 0.4 * Math.sin(now * 2.5 + s * 1.7));
    }
  }

  function drawKaji(ctx, prog, fxT, now, H, gy, vs, vy, Vh, hide) {
    var bx = W * 0.68, bw = W * 0.28, by = Math.max(H * 0.28, gy - W * 0.62);
    fillRR(ctx, bx, by, bw, gy - by, 8, '#c9b6a0', OUT, 4);
    var wins = [[0.12, 0.08], [0.58, 0.08], [0.12, 0.38], [0.58, 0.38], [0.12, 0.68], [0.58, 0.68]];
    var wh = (gy - by) * 0.22, ww = bw * 0.3;
    wins.forEach(function (w) { fillRR(ctx, bx + bw * w[0], by + (gy - by) * w[1], ww, wh, 6, '#bfe6fb', OUT, 3); });
    var fl = hide ? 0 : clamp(1 - prog / 4, 0, 1);
    if (hide) {
      circle(ctx, bx + bw * 0.5, by - 10, 14, 'rgba(110,110,110,0.35)');
    } else if (fl > 0.02) {
      [[3, 0], [4, 1], [5, 2]].forEach(function (f, i) {
        var w = wins[f[0]], fx = bx + bw * w[0] + ww / 2, fy = by + (gy - by) * w[1] + wh * 0.9;
        ctx.save(); ctx.translate(fx, fy); var s = Math.min(wh * 1.6, ww * 1.5) * fl * (1 + 0.04 * Math.sin(now * 6 + i));
        ctx.scale(s, s); Vh.drawFlame(ctx, now + i); ctx.restore();
      });
      circle(ctx, bx + bw * 0.5, by - 10, 22 * fl + 6, 'rgba(110,110,110,0.45)');
      circle(ctx, bx + bw * 0.62, by - 34, 16 * fl + 6, 'rgba(110,110,110,0.35)');
    } else {
      circle(ctx, bx + bw * 0.5, by + 14, 9, 'rgba(255,255,255,0.0)');
    }
    var tx = W * 0.2;
    Vh.drawVehicle(ctx, 8, tx, vy, vs, -1);   // 現場に止めた車は、放水口・はしごなど付属物のある側(絵の向き)を保つ
    var nozX = tx + vs * 0.3, nozY = vy - vs * 0.28, tgtX = bx + bw * 0.5, tgtY = by + (gy - by) * 0.4;
    if (fxT >= 0 && fxT < 0.85) {
      for (var i = 0; i < 26; i++) {
        var u = ((now * 1.6 + i / 26) % 1);
        var x = lerp(nozX, tgtX, u), y = lerp(nozY, tgtY, u) - 4 * u * (1 - u) * H * 0.22;
        circle(ctx, x, y, 7 - 3 * u, 'rgba(70,160,255,0.85)');
      }
    }
  }

  function drawTakai(ctx, prog, fxT, now, H, gy, vs, vy, Vh, hide) {
    var trx = W * 0.84, cr = Math.min(W * 0.1, H * 0.11);
    var cs = clamp(H * 0.13, 46, 90);
    var boardBottom = H * 0.03 + Math.min(H * 0.53, W * 0.62);
    var crownY = gy - clamp(gy - boardBottom - cr * 1.6 - cs * 1.1, 70, W * 0.35);
    var cy = crownY - cr * 0.95;
    fillRR(ctx, trx - 22, crownY, 44, gy - crownY, 6, '#8d5a34', OUT, 4);
    circle(ctx, trx, crownY, cr, '#4aa04a', OUT, 4); circle(ctx, trx - cr * 0.6, crownY + cr * 0.4, cr * 0.65, '#55b155', OUT, 4);
    circle(ctx, trx + cr * 0.6, crownY + cr * 0.4, cr * 0.65, '#55b155', OUT, 4);
    var tx = W * 0.2;
    Vh.drawVehicle(ctx, 10, tx, vy, vs, -1);   // はしごの根もと(bx)が車の向きと合う側
    // はしご: 車のうしろの根もとから、ねこへ。長さが進み具合で伸びる
    var bx = tx - vs * 0.05, by = vy - vs * 0.25, ex = trx - cr * 0.3, ey = cy + cs * 0.4;
    var f = 0.3 + 0.7 * clamp(prog / 4, 0, 1);
    var lx = lerp(bx, ex, f), ly = lerp(by, ey, f);
    var nx = (ey - by), ny = -(ex - bx), nl = Math.hypot(nx, ny) || 1; nx = nx / nl * 9; ny = ny / nl * 9;
    lineExt(ctx, bx, by, lx, ly, nx, ny);
    if (prog >= 3.99) cy -= Math.abs(Math.sin(now * 5)) * 14;   // ねこがうれしくてぴょん
    if (!hide) drawCat(ctx, trx, cy, cs, now);
  }
  function lineExt(ctx, x1, y1, x2, y2, nx, ny) {
    linepx(ctx, x1 + nx, y1 + ny, x2 + nx, y2 + ny, 7, OUT); linepx(ctx, x1 - nx, y1 - ny, x2 - nx, y2 - ny, 7, OUT);
    linepx(ctx, x1 + nx, y1 + ny, x2 + nx, y2 + ny, 4, '#d9d9d9'); linepx(ctx, x1 - nx, y1 - ny, x2 - nx, y2 - ny, 4, '#d9d9d9');
    var n = Math.max(2, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 26));
    for (var i = 1; i <= n; i++) { var t = i / n; linepx(ctx, lerp(x1, x2, t) + nx, lerp(y1, y2, t) + ny, lerp(x1, x2, t) - nx, lerp(y1, y2, t) - ny, 4, '#b9b9b9'); }
  }

  function drawMichi(ctx, prog, fxT, now, H, gy, vs, vy, Vh, hide) {
    var hx = W * 0.72, hy = gy - 4;
    var cnt = hide ? 0 : Math.ceil(ROCKS.length * clamp(1 - prog / 4, 0, 1) - 0.001);
    var rs = clamp(H * 0.13, 36, 80);
    for (var i = 0; i < cnt; i++) {
      var r = ROCKS[i];
      drawRock(ctx, hx + r[0] * rs, hy - rs * 0.4 + r[1] * rs * 0.5 + (r[1] < -0.4 ? r[1] * rs * 0.2 : 0), rs * r[2]);
    }
    var sx = lerp(W * 0.18, W * 0.42, clamp(prog / 4, 0, 1)) + (fxT >= 0 ? Math.sin(now * 25) * 2 : 0);
    Vh.drawVehicle(ctx, 4, sx, vy, vs);
    if (fxT >= 0) { for (var d = 0; d < 5; d++) circle(ctx, sx + vs * 0.5 + d * 14, gy - 10 - ((now * 40 + d * 9) % 30), 6, 'rgba(160,140,120,' + (0.6 - d * 0.1) + ')'); }
    if (prog > 3) { // きゅうきゅうしゃ到着
      var q = ease(prog - 3);
      Vh.drawVehicle(ctx, 7, lerp(W * 1.15, W * 0.78, q), vy, vs, -1);   // 右から左へ走ってくるので左向き
    }
  }

  // ======== ごほうびカード ========
  // flip: 0..1（0 = うら、1 = おもて）
  function drawCard(ctx, cw, ch, car, stars, flip, now) {
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    var sx = Math.abs(Math.cos(flip * Math.PI));
    if (flip < 0.5) sx = Math.max(0.02, sx); else sx = Math.max(0.02, sx);
    ctx.scale(sx, 1);
    var w = cw * 0.86, h = ch * 0.94;
    fillRR(ctx, -w / 2, -h / 2, w, h, 28, flip < 0.5 ? '#3a7bd5' : '#fff8e1', OUT, 5);
    if (flip < 0.5) {
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold ' + (h * 0.5) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 0);
    } else if (car) {
      fillRR(ctx, -w / 2 + 14, -h / 2 + 14, w - 28, h * 0.62, 18, '#cfeeff', null);
      var t = now || 0;
      V().drawVehicle(ctx, car.stage, 0, -h * 0.12 + Math.sin(t * 3) * 3, Math.min(w * 0.85, h * 0.55));
      ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.min(h * 0.09, w * 0.1) + 'px sans-serif';
      ctx.fillText(car.name, 0, h * 0.28, w - 30);
      ctx.font = (h * 0.12) + 'px sans-serif';
      var s = '';
      for (var i = 1; i <= 3; i++) s += i <= stars ? '★' : '☆';
      ctx.fillStyle = '#f2a900'; ctx.fillText(s, 0, h * 0.4);
    }
    ctx.restore();
  }

  // ======== タイトル ========
  // rank = ステージの番号（0 = S0）。2（S2）のときだけ、消防署の屋根の帯が青くなり、壁に小さな階級章が付く（S0・S1 は今までと同じ）
  function drawTitle(ctx, cw, ch, now, lit, rank) {
    var gy = ch * 0.8;
    var sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#9fd8f5'); sky.addColorStop(1, '#fff3d6');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);
    circle(ctx, cw * 0.85, ch * 0.15, Math.min(cw, ch) * 0.07, '#ffd23f', '#f2a900', 3);
    ctx.fillStyle = '#7bbf6a'; ctx.fillRect(0, gy, cw, ch - gy);
    ctx.fillStyle = '#9a9ea3'; ctx.fillRect(0, gy + (ch - gy) * 0.2, cw, (ch - gy) * 0.55);
    // しょうぼうしょ
    var bw = Math.min(cw * 0.5, ch * 0.7), bh = ch * 0.42, bx = cw * 0.06, by = gy - bh;
    fillRR(ctx, bx, by, bw, bh, 8, '#e8d9c3', OUT, 4);
    fillRR(ctx, bx - 6, by - 14, bw + 12, 20, 6, rank >= 2 ? '#3a7bd5' : '#e53935', OUT, 4);
    if (rank >= 2) drawWappen(ctx, bx + bw * 0.86, by + bh * 0.8, Math.min(bw * 0.12, 40), 2, 0);
    for (var i = 0; i < 4; i++) {
      var on = i < (lit || 0);
      fillRR(ctx, bx + bw * (0.08 + i * 0.23), by + bh * 0.16, bw * 0.16, bh * 0.28, 5, on ? '#ffe680' : '#8fb4c9', OUT, 3);
    }
    fillRR(ctx, bx + bw * 0.28, by + bh * 0.55, bw * 0.44, bh * 0.45, 6, '#b7c2cc', OUT, 4);
    // はしるしょうぼうしゃ
    var sz = Math.min(ch * 0.4, cw * 0.4), x = ((now * 90) % (cw + sz * 2)) - sz;
    V().drawVehicle(ctx, 8, x, gy + (ch - gy) * 0.05 - sz * 0.25 + 6, sz);
  }

  // ======== 階級のワッペン（design-elementary 3.6）。idx = ステージの番号（0 = S0）。中心 (x,y)・幅 size ========
  var WAPPEN = [['#aeb8c4', '#6f7a87'], ['#e53935', '#f2b01e'], ['#3a7bd5', '#f2b01e']];
  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) { var ang = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); }
    ctx.closePath();
  }
  function drawWappen(ctx, x, y, size, idx, t) {
    var col = WAPPEN[Math.min(idx, WAPPEN.length - 1)];
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.5, -0.5); ctx.quadraticCurveTo(0, -0.62, 0.5, -0.5); ctx.lineTo(0.5, 0.08);
    ctx.quadraticCurveTo(0.5, 0.42, 0, 0.62); ctx.quadraticCurveTo(-0.5, 0.42, -0.5, 0.08); ctx.closePath();
    ctx.fillStyle = col[0]; ctx.fill(); ctx.lineWidth = 0.06; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 0.035; ctx.strokeStyle = col[1];
    ctx.beginPath(); ctx.moveTo(-0.4, -0.4); ctx.quadraticCurveTo(0, -0.5, 0.4, -0.4); ctx.lineTo(0.4, 0.07); ctx.quadraticCurveTo(0.4, 0.34, 0, 0.5); ctx.quadraticCurveTo(-0.4, 0.34, -0.4, 0.07); ctx.closePath(); ctx.stroke();
    var n = Math.max(1, idx), gap = 0.27, sx = -(n - 1) * gap / 2, sy = -0.02 + (t ? Math.sin(t * 3) * 0.01 : 0);
    for (var i = 0; i < n; i++) { star(ctx, sx + i * gap, sy, idx === 0 ? 0.12 : 0.2); ctx.fillStyle = idx === 0 ? '#fff' : col[1]; ctx.fill(); ctx.lineWidth = 0.03; ctx.strokeStyle = OUT; ctx.stroke(); }
    ctx.restore();
  }

  // 昇格の絵: 消防署の前で、大きなワッペンがはずんで光る。t = 経過秒
  function drawPromote(ctx, cw, ch, idx, t) {
    var gy = ch * 0.82;
    var sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#9fd8f5'); sky.addColorStop(1, '#fff3d6');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#7bbf6a'; ctx.fillRect(0, gy, cw, ch - gy);
    var bw = Math.min(cw * 0.8, ch * 1.2), bh = ch * 0.5, bx = (cw - bw) / 2, by = gy - bh;
    fillRR(ctx, bx, by, bw, bh, 8, '#e8d9c3', OUT, 4);
    fillRR(ctx, bx - 6, by - 14, bw + 12, 20, 6, idx >= 2 ? '#3a7bd5' : '#e53935', OUT, 4);
    for (var i = 0; i < 4; i++) fillRR(ctx, bx + bw * (0.08 + i * 0.23), by + bh * 0.14, bw * 0.16, bh * 0.22, 5, '#ffe680', OUT, 3);
    fillRR(ctx, bx + bw * 0.3, by + bh * 0.52, bw * 0.4, bh * 0.48, 6, '#b7c2cc', OUT, 4);
    var u = clamp(t / 0.9, 0, 1), pop = u < 1 ? ease(u) * 1.15 : 1 + 0.04 * Math.sin(t * 4);
    var size = Math.min(cw * 0.5, ch * 0.5) * pop, wy = ch * 0.42 - Math.abs(Math.sin(t * 2.2)) * ch * 0.02;
    for (var k = 0; k < 8; k++) { var a = t * 0.9 + k * Math.PI / 4, r = size * 0.85; sparkle(ctx, cw / 2 + Math.cos(a) * r, wy + Math.sin(a) * r * 0.8, 10 + 4 * Math.sin(t * 4 + k), u * (0.5 + 0.4 * Math.sin(t * 3 + k))); }
    drawWappen(ctx, cw / 2, wy, size, idx, t);
  }

  var api = {
    Stage: Stage, drawCard: drawCard, drawTitle: drawTitle, drawCat: drawCat, drawRock: drawRock,
    drawItem: drawItem, drawSpeaker: drawSpeaker, grid: grid, boxLayout: boxLayout, tensLayout: tensLayout, groupLayout: groupLayout, tensTokens: tensTokens, drawWappen: drawWappen, drawPromote: drawPromote, drawRuby: drawRuby, W: W
  };
  root.Manabi = root.Manabi || {};
  root.Manabi.scenes = api;
})(typeof window !== 'undefined' ? window : globalThis);
