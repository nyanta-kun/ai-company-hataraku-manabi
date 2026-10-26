// なぞりがきの板（design-tracing 4章）。DOM と canvas と pointer events。判定は trace.js の純粋関数だけを使う。
// 手本の canvas（下。毎フレーム描き直す）と、指の canvas（上。線を足すだけ）の 2 枚。字形データは strokes.js（別ライセンス）。
// 依存: strokes.js, trace.js, vehicles.js（任意: 助けの「しょうぼうしゃ」）。window.Manabi.TraceBoard
(function (root) {
  'use strict';
  var M = root.Manabi, doc = root.document, S = M.strokes, T = M.trace, V = M.vehicles;
  var DATA = 1090;
  var PEN_QUIET = 0.6;     // ペンを離してから、指を無視する秒数（手のひら）
  var IDLE_ANIM = 8;       // 指を置いたまま進まないときにお手本を流すまでの秒数

  function now() { return root.performance.now() / 1000; }
  function reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function isKanji(ch) { var k = S.SETS; return !!((k.k1 && k.k1.indexOf(ch) >= 0) || (k.k2 && k.k2.indexOf(ch) >= 0)); }

  function TraceBoard(wrap, cbs) {
    this.wrap = wrap; this.cbs = cbs || {};
    this.base = doc.createElement('canvas'); this.fing = doc.createElement('canvas');
    [this.base, this.fing].forEach(function (c) { c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none'; wrap.appendChild(c); });
    this.bctx = this.base.getContext('2d'); this.fctx = this.fing.getContext('2d');
    this.B = 300; this.dpr = 1; this.width = 'wide'; this.script = 'hira'; this.tol = T.tolerance(300, 'wide', 'hira');
    this.ch = ''; this.polys = []; this.nums = []; this.cur = 0; this.doneS = []; this.recs = []; this.dirty = false; this.maxM = 0;
    this.phase = 'idle'; this.active = null; this.anim = null; this.glow = 0; this.lastAct = now(); this.penUntil = 0; this.penDown = false;
    this.celebrate = 0; this.idleShown = false; this.pendingB = 0; this.auto = false; this.autoBusy = false; this.timers = [];
    this.bind();
  }
  var P = TraceBoard.prototype;

  P.bind = function () {
    var self = this, w = this.wrap;
    w.style.touchAction = 'none';
    w.addEventListener('pointerdown', function (e) { self.onDown(e); });
    w.addEventListener('pointermove', function (e) { self.onMove(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) {
      w.addEventListener(n, function (e) { self.onUp(e, n !== 'pointerup'); });
    });
    w.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  // ---- 大きさ（指を離すまで測り直さない）----
  P.layout = function (B) {
    if (this.active) { this.pendingB = B; return; }
    B = Math.max(120, Math.floor(B)); this.pendingB = 0;
    var dpr = root.devicePixelRatio || 1;
    this.B = B; this.dpr = dpr;
    this.wrap.style.width = B + 'px'; this.wrap.style.height = B + 'px';
    [this.base, this.fing].forEach(function (c) { c.width = Math.round(B * dpr); c.height = Math.round(B * dpr); });
    this.bctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tol = T.tolerance(B, this.width, this.script);
  };
  P.setWidth = function (w) { this.width = w === 'normal' ? 'normal' : 'wide'; this.tol = T.tolerance(this.B, this.width, this.script); };

  // ---- 字 ----
  P.setChar = function (ch, intro) {
    this.clearTimers();
    var d = S.STROKES[ch];
    var sc = isKanji(ch) ? 'kanji' : 'hira';   // 漢字は許容幅を絞り（trace.tolerance）、お手本は 1.5 倍速（design 4.6）
    if (sc !== this.script) { this.script = sc; this.tol = T.tolerance(this.B, this.width, sc); }
    this.ch = ch; this.polys = d.s.map(function (s) { return T.strokePolyline(s, 0.01); });
    this.nums = d.n.map(function (p) { return [p[0] / DATA, p[1] / DATA]; });
    this.cur = 0; this.doneS = this.polys.map(function () { return false; });
    this.recs = this.polys.map(function () { return { m: 0, misses: 0 }; });
    this.dirty = false; this.maxM = 0; this.active = null; this.anim = null; this.glow = 0; this.celebrate = 0;
    this.phase = 'ready'; this.lastAct = now(); this.idleShown = false;
    this.fctx.clearRect(0, 0, this.B, this.B);
    if (this.pendingB) this.layout(this.pendingB);
    if (intro) this.startAnim(this.polys.map(function (_, i) { return i; }), null);
  };
  P.clearTimers = function () { this.timers.forEach(root.clearTimeout); this.timers = []; this.autoBusy = false; };
  P.later = function (ms, fn) { var self = this, id = root.setTimeout(function () { fn.call(self); }, ms); this.timers.push(id); return id; };
  P.stop = function () { this.clearTimers(); this.phase = 'idle'; this.active = null; this.anim = null; };
  P.tolFor = function () { return T.helpTolerance(this.tol, this.recs[this.cur].m); };

  // ---- お手本のアニメーション（番号が出て、筆の点が始点から終点へ橙で塗る）----
  P.startAnim = function (list, after) {
    var sp = this.script === 'kanji' ? 1.5 : 1;   // 漢字の 1 字ぶんは 1.5 倍速
    var durs = list.map(function (i) { return clamp(T.polyLength(this.polys[i]) * 1.6, 0.35, 1.2) / sp; }, this);
    var gap = 0.25 / sp, total = 0; durs.forEach(function (d) { total += d + gap; });
    this.anim = { list: list, durs: durs, gap: gap, t0: now(), total: total, after: after };
    this.phase = 'anim'; this.lastAct = now();
    this.fctx.clearRect(0, 0, this.B, this.B);
  };
  P.endAnim = function () {
    var a = this.anim; this.anim = null; this.phase = 'ready'; this.lastAct = now();
    if (a && a.after) a.after.call(this);
  };
  P.replay = function () {
    if (this.phase === 'done' || !this.ch) return false;
    if (this.anim && this.anim.after) return false;   // 手本の書き足し中は止めない
    if (this.active) this.cancelActive();
    this.startAnim(this.polys.map(function (_, i) { return i; }).filter(function (i) { return !this.doneS[i]; }, this), null);
    return true;
  };

  // ---- pointer events ----
  P.local = function (e) {
    var r = this.rect, s = r.width || this.B;
    return [(e.clientX - r.left) / s, (e.clientY - r.top) / s];
  };
  P.cancelActive = function () { this.active = null; this.fctx.clearRect(0, 0, this.B, this.B); };

  P.onDown = function (e) {
    e.preventDefault();
    if (this.phase === 'anim') {   // 流れている間のタップは最後まで飛ばし、そのまま書き始める。手本の書き足し（after あり）は飛ばさない
      if (!this.anim || this.anim.after) return;
      this.endAnim();
    }
    if (this.phase !== 'ready') return;
    var type = e.pointerType || 'mouse', t = now();
    if (type === 'touch' && (this.penDown || t < this.penUntil)) return;   // ペンの間・直後の手のひら
    if (this.active) {
      if (this.active.type === 'touch' && type === 'pen') this.cancelActive();   // 手のひらが先: 指の画は黙って取り消す
      else return;                                                                // 2 本目の指
    }
    if (type === 'pen') this.penDown = true;
    this.rect = this.wrap.getBoundingClientRect();
    if (this.wrap.setPointerCapture && e.pointerId != null) { try { this.wrap.setPointerCapture(e.pointerId); } catch (er) {} }
    this.begin(this.local(e), e.pointerId, type);
  };
  P.onMove = function (e) {
    var a = this.active;
    if (!a || e.pointerId !== a.id) return;
    if (a.type === 'pen' && e.buttons === 0) return;   // ホバー
    e.preventDefault();
    var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    if (!evs.length) evs = [e];
    var pts = evs.map(this.local, this);
    this.move(pts);
  };
  P.onUp = function (e, cancelled) {
    var a = this.active;
    if (e.pointerType === 'pen') { this.penDown = false; this.penUntil = now() + PEN_QUIET; }
    if (!a || (e.pointerId != null && e.pointerId !== a.id)) return;
    if (e.clientX != null && !cancelled && e.type === 'pointerup') this.move([this.local(e)]);
    this.up(cancelled);
  };

  // ---- 1 画の流れ（イベントから独立。自動プレイもここを通る）----
  P.begin = function (p, id, type) {
    var poly = this.polys[this.cur], rec = this.recs[this.cur];
    var r = T.beginStroke(poly, p, this.tolFor());
    this.lastAct = now();
    if (r.result === 'started') {
      this.recs[this.cur] = T.recordAttempt(rec, 'started');
      this.active = { id: id, type: type, state: r.state, pts: [p], off: false };
      this.fctx.clearRect(0, 0, this.B, this.B);
      this.drawFinger(true);
      return;
    }
    // reverse・miss: 線は描かず始点を光らせる。3 回続いたらお手本を流す（3 回目から m にも数える。recordAttempt）
    this.recs[this.cur] = T.recordAttempt(rec, r.result);
    var nr = this.recs[this.cur];
    if (nr.m > this.maxM) this.maxM = nr.m;   // 1 字の中の m の最大（たすけが要ったかを純粋関数側で決める。W5）
    if (nr.m > 0) this.dirty = true;
    this.glow = now() + 2;
    if (this.cbs.onBad) this.cbs.onBad(r.result, nr.m, this.cur);
    this.afterFail(nr, nr.misses >= 3);
  };
  P.move = function (pts) {
    var a = this.active; if (!a) return;
    var poly = this.polys[this.cur];
    var keep = [], last = a.pts[a.pts.length - 1], px = this.B;
    pts.forEach(function (p) {
      if (Math.abs(p[0] - last[0]) * px < 1 && Math.abs(p[1] - last[1]) * px < 1) return;   // 1px 未満は捨てる
      keep.push(p); last = p;
    });
    if (!keep.length) return;
    this.lastAct = now();
    var r = T.moveStroke(poly, a.state, keep, this.tolFor());
    a.state = r.state;
    keep.forEach(function (p) { a.pts.push(p); });
    if (r.result === 'off' && !a.off) { a.off = true; this.drawFinger(true); return; }   // 大きく外れた: 線を薄くする（数えるのは離したとき 1 回だけ）
    if (!a.off) this.drawFinger(false, keep.length);
  };
  P.up = function (cancelled) {
    var a = this.active; if (!a) return;
    this.active = null;
    var poly = this.polys[this.cur], r = T.endStroke(poly, a.state, this.tolFor());
    this.lastAct = now();
    if (cancelled && r.result === 'short') { this.fctx.clearRect(0, 0, this.B, this.B); if (this.pendingB) this.layout(this.pendingB); return; }   // 端末に取り消された: 子どものせいではない
    this.recs[this.cur] = T.recordAttempt(this.recs[this.cur], r.result);
    var nr = this.recs[this.cur];
    if (nr.m > this.maxM) this.maxM = nr.m;
    if (r.result === 'done') {
      this.fctx.clearRect(0, 0, this.B, this.B);
      this.completeStroke(false);
    } else {
      this.dirty = true;
      a.off = true; this.drawFinger(true, 0, a);   // active は先に null にしたので a を渡す
      var self = this;
      this.later(350, function () { if (!self.active) self.fctx.clearRect(0, 0, self.B, self.B); });
      if (this.cbs.onBad) this.cbs.onBad(r.result, nr.m, this.cur);
      this.afterFail(nr, true);
    }
    if (this.pendingB && !this.active) this.layout(this.pendingB);
  };
  // 助けの段階（3.6）: m>=5 手本が書き足す。m>=2 はお手本を流す
  P.afterFail = function (rec, animate) {
    var cur = this.cur;
    if (rec.m >= 5) {
      if (this.cbs.onAssist) this.cbs.onAssist(cur);
      this.startAnim([cur], function () { this.completeStroke(true); });
    } else if ((rec.m >= 2 && animate) || (rec.misses >= 3 && animate)) {
      this.later(400, function () { if (this.phase === 'ready' && !this.active && this.cur === cur) this.startAnim([cur], null); });
    }
  };
  P.completeStroke = function (auto) {
    var i = this.cur;
    this.doneS[i] = true; this.cur++; this.glow = 0; this.phase = 'ready'; this.lastAct = now(); this.idleShown = false;
    if (this.cur >= this.polys.length) {
      this.cur = this.polys.length - 1; this.phase = 'done'; this.celebrate = now();
      if (this.cbs.onStrokeDone) this.cbs.onStrokeDone(i, auto, true);
      if (this.cbs.onCharDone) this.cbs.onCharDone({ clean: !this.dirty, ch: this.ch, maxM: this.maxM });
      return;
    }
    if (auto) this.dirty = true;
    if (this.cbs.onStrokeDone) this.cbs.onStrokeDone(i, auto, false);
  };

  // ---- 描画 ----
  P.line = function (ctx, poly, upTo, w, color, dash) {
    var B = this.B, n = upTo == null ? poly.length : upTo;
    if (n < 2) return;
    ctx.beginPath(); ctx.moveTo(poly[0][0] * B, poly[0][1] * B);
    for (var i = 1; i < n; i++) ctx.lineTo(poly[i][0] * B, poly[i][1] * B);
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  };
  P.arrow = function (ctx, poly, at, color) {
    var B = this.B, i = clamp(at, 2, poly.length - 3); if (poly.length < 5) return;
    var p = poly[i], a = poly[i - 2], b = poly[i + 2], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 0.04 * B;
    ctx.beginPath();
    ctx.moveTo(p[0] * B - Math.cos(ang - 0.6) * L, p[1] * B - Math.sin(ang - 0.6) * L);
    ctx.lineTo(p[0] * B + Math.cos(ang) * 0.012 * B, p[1] * B + Math.sin(ang) * 0.012 * B);
    ctx.lineTo(p[0] * B - Math.cos(ang + 0.6) * L, p[1] * B - Math.sin(ang + 0.6) * L);
    ctx.lineWidth = 0.014 * B; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  };
  P.numDot = function (ctx, i, big, t) {
    var B = this.B, n = this.nums[i]; if (!n) return;
    var r = (big ? 0.05 + 0.006 * Math.sin(t * 4) : 0.036) * B;
    ctx.beginPath(); ctx.arc(n[0] * B, n[1] * B, r, 0, 7);
    ctx.fillStyle = big ? '#2e9d5d' : '#a79d8c'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(r * 1.25) + 'px "Hiragino Maru Gothic ProN", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), n[0] * B, n[1] * B + r * 0.05);
  };

  P.draw = function (t) {
    if (this.phase === 'idle' || !this.polys.length) { this.bctx.clearRect(0, 0, this.B, this.B); return; }
    var ctx = this.bctx, B = this.B, k = this.width === 'wide' ? 1.3 : 1, i;
    if (this.anim && t - this.anim.t0 >= this.anim.total) this.endAnim();
    if (this.phase === 'ready' && !this.active && !this.idleShown && t - this.lastAct > IDLE_ANIM) { this.idleShown = true; this.startAnim([this.cur], null); }   // 画ごとに 1 回だけ
    if (this.auto && !this.autoBusy && this.phase === 'ready' && !this.active) this.autoStroke();
    ctx.clearRect(0, 0, B, B);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, B, B);
    ctx.strokeStyle = '#e4d8c0'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(B / 2, 0); ctx.lineTo(B / 2, B); ctx.moveTo(0, B / 2); ctx.lineTo(B, B / 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#d9cdb4'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, B - 4, B - 4);
    var ph = this.phase, pw = 0.10 * k * B;
    // 道（まだの画）
    for (i = 0; i < this.polys.length; i++) {
      if (this.doneS[i]) continue;
      this.line(ctx, this.polys[i], null, pw, i === this.cur && ph !== 'done' ? '#d9c7a6' : '#ece2d0');
    }
    // 書けた画（手本の形で赤）
    for (i = 0; i < this.polys.length; i++) if (this.doneS[i]) this.line(ctx, this.polys[i], null, 0.06 * B, '#e53935');
    var a = this.anim;
    if (a) {
      var el = t - a.t0, acc = 0;
      for (var j = 0; j < a.list.length; j++) {
        var si = a.list[j], d = a.durs[j], u = clamp((el - acc) / d, 0, 1), poly = this.polys[si];
        if (el >= acc) {
          var n = Math.max(2, Math.round(u * (poly.length - 1)) + 1);
          this.line(ctx, poly, n, 0.06 * B, '#ff9f1c');
          this.numDot(ctx, si, true, t);
          if (u < 1) { var q = poly[n - 1]; ctx.beginPath(); ctx.arc(q[0] * B, q[1] * B, 0.04 * B, 0, 7); ctx.fillStyle = '#ff7a00'; ctx.fill(); }
        }
        acc += d + a.gap;
      }
    } else if (ph !== 'done') {
      var cp = this.polys[this.cur], rec = this.recs[this.cur];
      this.line(ctx, cp, null, 0.008 * B, '#a58b60', [0.012 * B, 0.018 * B]);
      this.arrow(ctx, cp, 12, '#2e9d5d');
      if (T.polyLength(cp) >= 0.5) this.arrow(ctx, cp, Math.floor(cp.length / 2), '#2e9d5d');
      var s0 = cp[0], glowing = t < this.glow || rec.m >= 1, pulse = glowing ? 0.5 + 0.5 * Math.sin(t * 7) : 0;
      ctx.beginPath(); ctx.arc(s0[0] * B, s0[1] * B, this.tol.startR * B, 0, 7);
      ctx.fillStyle = glowing ? 'rgba(255,159,28,' + (0.18 + 0.2 * pulse) + ')' : 'rgba(46,157,93,.14)'; ctx.fill();
      ctx.beginPath(); ctx.arc(s0[0] * B, s0[1] * B, (0.03 + 0.012 * pulse) * B, 0, 7); ctx.fillStyle = glowing ? '#ff9f1c' : '#2e9d5d'; ctx.fill();
      for (i = 0; i < this.polys.length; i++) if (!this.doneS[i] && i !== this.cur) this.numDot(ctx, i, false, t);
      this.numDot(ctx, this.cur, true, t);
      if (rec.m >= 3 && !this.active && V && V.drawVehicle) {   // しょうぼうしゃが道の先を走る
        var f = reduced() ? 0 : ((t * 0.5) % 1), qi = Math.min(cp.length - 1, Math.round(f * (cp.length - 1))), qp = cp[qi];
        V.drawVehicle(ctx, 8, qp[0] * B, qp[1] * B, 0.17 * B);
      }
    }
    if (ph === 'done') {
      for (i = 0; i < 9; i++) {
        var ang = t * 1.2 + i * 0.7, rr = B * (0.36 + 0.1 * ((i * 37) % 5) / 5);
        ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5 + i); ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.arc(B / 2 + Math.cos(ang) * rr, B / 2 + Math.sin(ang) * rr, 0.015 * B + 3, 0, 7); ctx.fill(); ctx.restore();
      }
    }
  };

  // 指の線（青。受け取った点をそのままつなぐ）。full: 全部描き直す（薄くする・始点だけ）
  P.drawFinger = function (full, last, aa) {
    var a = aa || this.active, ctx = this.fctx, B = this.B;
    if (!a) return;
    var pts = a.pts;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 0.05 * B;
    ctx.strokeStyle = a.off ? 'rgba(30,111,224,.25)' : '#1e6fe0'; ctx.fillStyle = ctx.strokeStyle;
    if (full) {
      ctx.clearRect(0, 0, B, B);
      if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0][0] * B, pts[0][1] * B, 0.025 * B, 0, 7); ctx.fill(); return; }
      ctx.beginPath(); ctx.moveTo(pts[0][0] * B, pts[0][1] * B);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * B, pts[i][1] * B);
      ctx.stroke(); return;
    }
    var from = Math.max(0, pts.length - last - 1);
    ctx.beginPath(); ctx.moveTo(pts[from][0] * B, pts[from][1] * B);
    for (var j = from + 1; j < pts.length; j++) ctx.lineTo(pts[j][0] * B, pts[j][1] * B);
    ctx.stroke();
  };

  // ---- 自動プレイ（確認用。手本の点列を指の代わりに流す）----
  P.autoStroke = function () {
    var self = this, poly = this.polys[this.cur], i = 0;
    this.autoBusy = true;
    this.rect = this.wrap.getBoundingClientRect();
    this.begin(poly[0], 1, 'mouse');
    if (!this.active) { this.autoBusy = false; return; }
    (function step() {
      if (!self.auto || !self.active) { self.autoBusy = false; return; }
      i = Math.min(poly.length - 1, i + 3);
      self.move([poly[i]]);
      if (i >= poly.length - 1) { self.up(false); self.later(250, function () { self.autoBusy = false; }); return; }
      self.later(14, step);
    })();
  };

  // ---- 照合用の一覧（#debug:trace-sheet）。番号・矢印・画ごとの色 ----
  TraceBoard.drawSheet = function (ctx, ch, x, y, size) {
    var d = S.STROKES[ch]; if (!d) return;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke(); ctx.setLineDash([]);
    d.s.forEach(function (s, i) {
      var poly = T.strokePolyline(s, 0.01), col = 'hsl(' + (i * 67 % 360) + ',70%,40%)', B = size;
      ctx.beginPath(); ctx.moveTo(poly[0][0] * B, poly[0][1] * B);
      for (var j = 1; j < poly.length; j++) ctx.lineTo(poly[j][0] * B, poly[j][1] * B);
      ctx.lineWidth = Math.max(2, size * 0.03); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      var e = poly[poly.length - 1], pr = poly[Math.max(0, poly.length - 4)], ang = Math.atan2(e[1] - pr[1], e[0] - pr[0]), L = size * 0.06;
      ctx.beginPath(); ctx.moveTo(e[0] * B - Math.cos(ang - 0.5) * L, e[1] * B - Math.sin(ang - 0.5) * L); ctx.lineTo(e[0] * B, e[1] * B);
      ctx.lineTo(e[0] * B - Math.cos(ang + 0.5) * L, e[1] * B - Math.sin(ang + 0.5) * L); ctx.stroke();
      ctx.beginPath(); ctx.arc(poly[0][0] * B, poly[0][1] * B, size * 0.018, 0, 7); ctx.fillStyle = col; ctx.fill();
      var n = d.n[i];
      if (n) {
        var nx = n[0] / DATA * B, ny = n[1] / DATA * B, r = size * 0.05;
        ctx.beginPath(); ctx.arc(nx, ny, r, 0, 7); ctx.fillStyle = col; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(r * 1.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), nx, ny + 1);
      }
    });
    ctx.restore();
  };

  M.TraceBoard = TraceBoard;
})(typeof window !== 'undefined' ? window : globalThis);
