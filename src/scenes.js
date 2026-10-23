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

  // ======== 現場ステージ ========
  function Stage(canvas) {
    this.canvas = canvas;
    this.scene = 'kaji';
    this.shown = 0;          // 表示中の進み具合（0..4。アニメで target に近づく）
    this.target = 0;
    this.anim = null;        // { t0, dur, from, to, kind }
    this.prob = null;
    this.items = [];
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
    this.prob = p; this.marks = []; this.bounceIdx = -1; this.word = null; this.reveal = false;
    this.caption = '';
    if (p && p.kind === 'letter') {
      var ws = root.Manabi.data.ALL_WORDS;
      for (var i = 0; i < ws.length; i++) if (ws[i].id === p.wordId) this.word = ws[i];
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
    this.plus = null; this.pic = null; this.clock = null; this.speaker = null;
    if (p && p.kind === 'count') {
      it = grid(p.n, p.n <= 5 ? p.n : 5, inner, 150);
    } else if (p && p.kind === 'add') {
      var colsFor = function (n) { return n <= 3 ? n : (n === 4 ? 2 : 3); };
      var half = inner.w * 0.42;
      var A = grid(p.a, colsFor(p.a), { x: inner.x, y: inner.y, w: half, h: inner.h }, 130);
      var B = grid(p.b, colsFor(p.b), { x: inner.x + inner.w - half, y: inner.y, w: half, h: inner.h }, 130);
      it = A.concat(B);
      this.plus = { x: inner.x + inner.w / 2, y: inner.y + inner.h / 2, s: Math.min(inner.w * 0.12, 70) };
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
    this.items = it;
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
  Stage.prototype.mark = function (i) {
    if (i < 0 || this.marks[i]) return 0;
    var n = this.marks.filter(Boolean).length + 1;
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
      V().drawPic(ctx, this.word.pic, pb.x, pb.y + dy, pb.s * k, now);
    } else if (p && p.kind === 'english' && this.speaker && !(this.reveal && p.form === 'number')) {
      var sk = this.speaker, ebt = now - this.picBounceT0, ek = ebt >= 0 && ebt < 0.6 ? 1 + 0.15 * Math.sin(ebt / 0.6 * Math.PI) : 1;
      if (this.reveal) V().drawPic(ctx, p.pic, sk.x, sk.y, sk.s, now);   // 正解のあと: 乗り物の絵を大きく
      else drawSpeaker(ctx, sk.x, sk.y, sk.s * ek, now);
    } else if (p && p.kind === 'clock' && this.clock) {
      var ck = this.clock;
      if (p.form === 'read') root.Manabi.clockface.drawClock(ctx, ck.x, ck.y, ck.r, p.h + ':00', { numbers: 12, pulse: this.pulseAt(now) });
      else if (p.form === 'elapsed') {   // T6: 開始時刻を大きな時計で。経過は「+20」のふだ
        // ふだは時計の右に並べる（時計に重ねると外周の分の数字が隠れる）。横幅が足りなければ時計を小さくする
        var er = ck.r * 0.9, bs = er * 0.85, gap = er * 0.12;
        if (2 * er + gap + bs > ck.w * 0.96) { er = ck.w * 0.96 / (2 + 0.12 + 0.85); bs = er * 0.85; gap = er * 0.12; }
        var ecx = ck.x - (gap + bs) / 2, ecy = ck.y;
        root.Manabi.clockface.drawClock(ctx, ecx, ecy, er, p.h0 + ':' + (p.m0 < 10 ? '0' : '') + p.m0, { numbers: 12, ticks: 60, minuteNums: true });
        drawElapsedBadge(ctx, ecx + er + gap + bs / 2, ecy, bs, p.dm);
      } else drawSign(ctx, ck, p);
    } else {
      for (i = 0; i < this.items.length; i++) {
        var it = this.items[i], sc = 1, dy2 = 0, bt2 = now - this.bounceT0;
        if (i === this.bounceIdx && bt2 >= 0 && bt2 < 0.55) { var q = Math.sin(bt2 / 0.55 * Math.PI); sc = 1 + 0.3 * q; dy2 = -q * 14; }
        drawItem(ctx, this.scene, it.x, it.y + dy2, it.s * sc, now);
        if (this.marks[i]) {
          circle(ctx, it.x + it.s * 0.36, it.y - it.s * 0.36, Math.max(14, it.s * 0.2), '#3a9d5d', '#fff', 3);
          ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(16, it.s * 0.24) + 'px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(this.marks[i]), it.x + it.s * 0.36, it.y - it.s * 0.36 + 1);
        }
      }
      if (this.plus) { // ＋
        var pl = this.plus;
        linePlus(ctx, pl.x, pl.y, pl.s);
      }
    }
    // えいご: 聞いた英語のつづりを下に出す（正解のあとも出したまま）
    if (p && p.kind === 'english' && this.caption) {
      ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.round(Math.max(24, Math.min(48, b.h * 0.15))) + 'px sans-serif';
      ctx.fillText(this.caption, b.x + b.w / 2, b.y + b.h - Math.max(22, b.h * 0.1), b.w * 0.9);
    }
  };
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
  function drawTitle(ctx, cw, ch, now, lit) {
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
    fillRR(ctx, bx - 6, by - 14, bw + 12, 20, 6, '#e53935', OUT, 4);
    for (var i = 0; i < 4; i++) {
      var on = i < (lit || 0);
      fillRR(ctx, bx + bw * (0.08 + i * 0.23), by + bh * 0.16, bw * 0.16, bh * 0.28, 5, on ? '#ffe680' : '#8fb4c9', OUT, 3);
    }
    fillRR(ctx, bx + bw * 0.28, by + bh * 0.55, bw * 0.44, bh * 0.45, 6, '#b7c2cc', OUT, 4);
    // はしるしょうぼうしゃ
    var sz = Math.min(ch * 0.4, cw * 0.4), x = ((now * 90) % (cw + sz * 2)) - sz;
    V().drawVehicle(ctx, 8, x, gy + (ch - gy) * 0.05 - sz * 0.25 + 6, sz);
  }

  var api = {
    Stage: Stage, drawCard: drawCard, drawTitle: drawTitle, drawCat: drawCat, drawRock: drawRock,
    drawItem: drawItem, drawSpeaker: drawSpeaker, grid: grid, W: W
  };
  root.Manabi = root.Manabi || {};
  root.Manabi.scenes = api;
})(typeof window !== 'undefined' ? window : globalThis);
