// 乗り物の絵（Canvas）。hataraku-drop の src/render.js から描画部分をコピーして流用した。
// コピー元との対応（行は hataraku-drop の src/render.js）:
//   OUT, LW, rr, poly, circ, line, wheel, win, light, tracks (L5-53) / draw[1..11] (L55-199) / fireCab, star (L134-209)
// 変更点: Matter・形モード(S.layout, G.info, C.SHAPE_BODIES)への依存を削除。
//   draw[11] の「金の輪」(円モード専用) を省いた。drawVehicle は新規（単位座標 -1..1 を size px に拡縮）。
// ブラウザでは window.Manabi.vehicles に登録する。
(function (root) {
  'use strict';
    var OUT = '#3a2b24';
    var LW = 0.055;
  
    // ---- 部品 ----
    function rr(ctx, x, y, w, h, rad, fill) {
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    }
    function poly(ctx, pts, fill) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    }
    function circ(ctx, x, y, r, fill) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    }
    function line(ctx, x1, y1, x2, y2, w, col) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineCap = 'round'; ctx.lineWidth = w; ctx.strokeStyle = col || OUT; ctx.stroke();
    }
    function wheel(ctx, x, y, r) {
      circ(ctx, x, y, r, '#2b2b2b');
      circ(ctx, x, y, r * 0.45, '#cfd3d6');
    }
    function win(ctx, x, y, w, h) { rr(ctx, x, y, w, h, 0.04, '#bfe6fb'); }
    // 回転灯
    function light(ctx, x, y, col) {
      rr(ctx, x - 0.08, y - 0.08, 0.16, 0.1, 0.04, col);
      line(ctx, x - 0.14, y - 0.14, x - 0.2, y - 0.2, 0.04, col);
      line(ctx, x + 0.14, y - 0.14, x + 0.2, y - 0.2, 0.04, col);
    }
    function tracks(ctx, x, y, w, h) {
      rr(ctx, x, y, w, h, h / 2, '#444');
      circ(ctx, x + h / 2, y + h / 2, h * 0.28, '#9aa');
      circ(ctx, x + w - h / 2, y + h / 2, h * 0.28, '#9aa');
      circ(ctx, x + w / 2, y + h / 2, h * 0.22, '#9aa');
    }
  
    // ---- 乗り物 (stage 1..11) ----
    var draw = {};
  
    draw[1] = function (ctx) { // ねこぐるま（工事の一輪の手押し車）
      line(ctx, -0.25, 0.05, -0.72, -0.28, 0.09);           // 持ち手
      line(ctx, -0.25, 0.05, -0.32, 0.56, 0.07);            // 後ろの足（地面まで届く）
      line(ctx, 0.05, 0.12, 0.42, 0.4, 0.07);               // 車輪の支え
      poly(ctx, [[-0.5, -0.32], [0.6, -0.32], [0.42, 0.12], [-0.3, 0.12]], '#7f8a94'); // 荷台
      poly(ctx, [[-0.42, -0.32], [0.52, -0.32], [0.3, -0.48], [-0.1, -0.5]], '#d9a95b'); // 砂
      rr(ctx, -0.56, -0.38, 1.22, 0.1, 0.05, '#a3adb6');    // 縁
      wheel(ctx, 0.42, 0.4, 0.2);
    };
  
    draw[2] = function (ctx) { // フォークリフト
      rr(ctx, -0.65, -0.05, 0.85, 0.4, 0.08, '#f6c933');
      rr(ctx, -0.5, -0.5, 0.5, 0.45, 0.06, null);
      line(ctx, -0.5, -0.5, 0.0, -0.5, 0.06);
      rr(ctx, -0.42, -0.4, 0.34, 0.3, 0.04, '#bfe6fb');
      rr(ctx, 0.24, -0.62, 0.1, 1.0, 0.03, '#666');
      rr(ctx, 0.34, 0.24, 0.32, 0.07, 0.02, '#aaa');
      rr(ctx, 0.34, 0.1, 0.32, 0.07, 0.02, '#aaa');
      rr(ctx, 0.5, -0.05, 0.14, 0.2, 0.03, '#c28a2c');
      wheel(ctx, -0.42, 0.4, 0.17); wheel(ctx, 0.05, 0.4, 0.14);
    };
  
    draw[3] = function (ctx) { // ごみしゅうしゅうしゃ
      rr(ctx, -0.7, -0.15, 0.45, 0.5, 0.08, '#3e9a3e');
      win(ctx, -0.64, -0.08, 0.28, 0.22);
      rr(ctx, -0.22, -0.5, 0.92, 0.85, 0.1, '#5cb85c');
      circ(ctx, 0.5, -0.12, 0.17, '#2e7d2e');
      line(ctx, -0.05, -0.38, 0.7, -0.38, 0.04, '#2e7d2e');
      // リサイクルっぽい矢印 (三つの点)
      circ(ctx, 0.05, -0.08, 0.05, '#e8f5e8'); circ(ctx, 0.2, 0.05, 0.05, '#e8f5e8'); circ(ctx, -0.05, 0.12, 0.05, '#e8f5e8');
      wheel(ctx, -0.48, 0.4, 0.15); wheel(ctx, 0.42, 0.4, 0.15);
    };
  
    draw[4] = function (ctx) { // ショベルカー
      tracks(ctx, -0.6, 0.2, 1.0, 0.3);
      rr(ctx, -0.55, -0.2, 0.9, 0.4, 0.08, '#f08a24');
      rr(ctx, -0.5, -0.58, 0.45, 0.4, 0.07, '#f4a94f');
      win(ctx, -0.45, -0.52, 0.3, 0.26);
      // アーム
      line(ctx, 0.15, -0.1, 0.5, -0.55, 0.14, OUT); line(ctx, 0.15, -0.1, 0.5, -0.55, 0.09, '#f08a24');
      line(ctx, 0.5, -0.55, 0.75, -0.05, 0.12, OUT); line(ctx, 0.5, -0.55, 0.75, -0.05, 0.07, '#f08a24');
      poly(ctx, [[0.68, -0.05], [0.9, -0.05], [0.85, 0.2], [0.65, 0.12]], '#777');
    };
  
    draw[5] = function (ctx) { // ブルドーザー
      tracks(ctx, -0.55, 0.15, 1.1, 0.35);
      rr(ctx, -0.4, -0.15, 0.8, 0.35, 0.08, '#d6a91f');
      rr(ctx, -0.05, -0.55, 0.42, 0.42, 0.06, '#e5bf45');
      win(ctx, 0.0, -0.49, 0.3, 0.28);
      rr(ctx, -0.3, -0.5, 0.07, 0.36, 0.03, '#555');
      // ブレード
      rr(ctx, -0.78, -0.3, 0.16, 0.8, 0.05, '#8d8d8d');
      line(ctx, -0.62, 0.0, -0.4, 0.05, 0.07, '#666');
    };
  
    draw[6] = function (ctx) { // ダンプカー
      poly(ctx, [[-0.1, 0.1], [0.78, -0.15], [0.7, -0.55], [-0.15, -0.25]], '#2f66b8');
      poly(ctx, [[-0.1, 0.1], [0.78, -0.15], [0.78, -0.05], [-0.1, 0.2]], '#8a8f94');
      rr(ctx, -0.75, -0.12, 0.5, 0.45, 0.08, '#3f7fd8');
      win(ctx, -0.7, -0.05, 0.3, 0.22);
      rr(ctx, -0.75, 0.2, 1.5, 0.12, 0.03, '#34384a');
      wheel(ctx, -0.5, 0.4, 0.17); wheel(ctx, 0.3, 0.4, 0.17); wheel(ctx, 0.58, 0.4, 0.17);
    };
  
    draw[7] = function (ctx) { // きゅうきゅうしゃ (赤い帯)
      rr(ctx, -0.75, -0.42, 1.5, 0.78, 0.12, '#fafafa');
      rr(ctx, -0.75, -0.02, 1.5, 0.14, 0.0, '#e53935');
      rr(ctx, -0.75, -0.42, 1.5, 0.78, 0.12, null);
      rr(ctx, -0.65, -0.34, 0.35, 0.28, 0.05, '#bfe6fb');
      rr(ctx, -0.18, -0.34, 0.3, 0.2, 0.04, '#bfe6fb');
      rr(ctx, 0.28, -0.34, 0.3, 0.2, 0.04, '#bfe6fb');
      rr(ctx, -0.12, -0.6, 0.24, 0.16, 0.06, '#e53935');
      rr(ctx, -0.5, -0.56, 0.2, 0.14, 0.05, '#3a7bd5');
      wheel(ctx, -0.45, 0.4, 0.16); wheel(ctx, 0.45, 0.4, 0.16);
    };
  
    function fireCab(ctx, body) {
      rr(ctx, -0.78, -0.12, 0.5, 0.48, 0.08, body);
      win(ctx, -0.72, -0.06, 0.34, 0.24);
    }
  
    draw[8] = function (ctx) { // しょうぼうしゃ (ポンプしゃ)
      fireCab(ctx, '#e53935');
      rr(ctx, -0.3, -0.25, 1.05, 0.6, 0.08, '#e53935');
      rr(ctx, -0.3, 0.02, 1.05, 0.1, 0, '#fafafa');
      // はしご
      line(ctx, -0.25, -0.38, 0.7, -0.38, 0.04); line(ctx, -0.25, -0.5, 0.7, -0.5, 0.04);
      for (var i = 0; i < 6; i++) line(ctx, -0.2 + i * 0.17, -0.5, -0.2 + i * 0.17, -0.38, 0.03);
      light(ctx, -0.55, -0.12, '#ffd23f');
      rr(ctx, 0.2, -0.18, 0.4, 0.14, 0.04, '#b0b5ba');
      wheel(ctx, -0.5, 0.4, 0.16); wheel(ctx, 0.2, 0.4, 0.16); wheel(ctx, 0.55, 0.4, 0.16);
    };
  
    draw[9] = function (ctx) { // みずタンクしゃ
      fireCab(ctx, '#b71c1c');
      rr(ctx, -0.28, -0.1, 1.05, 0.46, 0.06, '#8e1414');
      rr(ctx, -0.22, -0.52, 0.92, 0.5, 0.25, '#c9ced3');
      line(ctx, -0.1, -0.4, 0.55, -0.4, 0.05, '#fff');
      rr(ctx, -0.22, -0.34, 0.92, 0.06, 0, '#b71c1c');
      circ(ctx, 0.62, -0.02, 0.1, '#ffd23f');
      light(ctx, -0.55, -0.12, '#ffd23f');
      wheel(ctx, -0.5, 0.4, 0.16); wheel(ctx, 0.15, 0.4, 0.16); wheel(ctx, 0.5, 0.4, 0.16);
    };
  
    draw[10] = function (ctx) { // はしごしゃ
      fireCab(ctx, '#e8512f');
      rr(ctx, -0.3, -0.05, 1.05, 0.4, 0.06, '#e8512f');
      rr(ctx, -0.3, 0.12, 1.05, 0.08, 0, '#ffd23f');
      // 斜めのはしご
      ctx.save(); ctx.translate(-0.2, -0.1); ctx.rotate(-0.38);
      rr(ctx, 0, -0.14, 1.2, 0.2, 0.02, null);
      line(ctx, 0, -0.14, 1.2, -0.14, 0.045); line(ctx, 0, 0.06, 1.2, 0.06, 0.045);
      for (var i = 1; i < 8; i++) line(ctx, i * 0.15, -0.14, i * 0.15, 0.06, 0.03);
      ctx.restore();
      rr(ctx, -0.12, -0.18, 0.3, 0.14, 0.04, '#ffd23f');
      light(ctx, -0.55, -0.12, '#ffd23f');
      wheel(ctx, -0.5, 0.4, 0.16); wheel(ctx, 0.2, 0.4, 0.16); wheel(ctx, 0.55, 0.4, 0.16);
    };
  
    draw[11] = function (ctx) { // ちょうだいはしごしゃ
      fireCab(ctx, '#d4202a');
      rr(ctx, -0.3, -0.05, 1.0, 0.4, 0.06, '#d4202a');
      rr(ctx, -0.3, 0.12, 1.0, 0.08, 0, '#f2c230');
      // 二段のはしご
      ctx.save(); ctx.translate(-0.25, -0.1); ctx.rotate(-0.55);
      rr(ctx, 0, -0.12, 0.9, 0.18, 0.02, null);
      line(ctx, 0, -0.12, 0.9, -0.12, 0.045); line(ctx, 0, 0.06, 0.9, 0.06, 0.045);
      for (var i = 1; i < 6; i++) line(ctx, i * 0.15, -0.12, i * 0.15, 0.06, 0.03);
      line(ctx, 0.9, -0.03, 1.28, -0.03, 0.12, OUT); line(ctx, 0.9, -0.03, 1.28, -0.03, 0.07, '#f2c230');
      ctx.restore();
      // きょうりょくな回転灯
      light(ctx, -0.55, -0.12, '#ffd23f');
      rr(ctx, -0.1, -0.16, 0.26, 0.12, 0.04, '#f2c230');
      // ほし
      star(ctx, 0.55, -0.4, 0.12, '#fff3b0');
      wheel(ctx, -0.5, 0.4, 0.16); wheel(ctx, 0.15, 0.4, 0.16); wheel(ctx, 0.5, 0.4, 0.16);
    };
    function star(ctx, x, y, r, fill) {
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r;
        ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      }
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 0.03; ctx.strokeStyle = '#c9a227'; ctx.stroke();
    }

  // ---- 小物（単語表用） ----
  function drawHose(ctx) {   // ホース（まるめたホースとノズル）
    ctx.lineJoin = 'round';
    for (var i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(-0.1, 0.1, 0.55 - i * 0.14, 0, Math.PI * 2);
      ctx.lineWidth = 0.1; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 0.065; ctx.strokeStyle = i % 2 ? '#e0b73a' : '#f3d054'; ctx.stroke();
    }
    line(ctx, 0.4, -0.3, 0.8, -0.45, 0.2, OUT); line(ctx, 0.4, -0.3, 0.8, -0.45, 0.14, '#8a8f94');
    rr(ctx, 0.78, -0.58, 0.14, 0.26, 0.04, '#e53935');
  }
  function drawFlame(ctx, t) {   // ほのお（しずくの形。t は秒でゆらぎ）
    t = t || 0;
    var k = Math.sin(t * 5) * 0.04;
    function body(sc, fill, ox, oy) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + 0.55 * sc);
      ctx.bezierCurveTo(ox - 0.6 * sc, oy + 0.5 * sc, ox - 0.5 * sc, oy - 0.1 * sc, ox - 0.1 * sc + k, oy - 0.45 * sc);
      ctx.bezierCurveTo(ox - 0.05 * sc, oy - 0.2 * sc, ox + 0.1 * sc, oy - 0.2 * sc, ox + 0.15 * sc, oy - 0.7 * sc - k);
      ctx.bezierCurveTo(ox + 0.55 * sc, oy - 0.3 * sc, ox + 0.65 * sc, oy + 0.5 * sc, ox, oy + 0.55 * sc);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      if (sc === 1) { ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke(); }
    }
    ctx.lineJoin = 'round';
    body(1, '#ff6b2c', 0, 0);
    body(0.65, '#ffb733', 0.02, 0.15);
    body(0.35, '#fff1a8', 0.03, 0.3);
  }

  // ---- 公開 API ----
  // 乗り物 stage(1..11) を、中心 (x, y)・おおよそ size px 四方に収めて描く
  function drawVehicle(ctx, stage, x, y, size) {
    var s = size / 1.8;
    ctx.save();
    ctx.translate(x - 0.05 * s, y + 0.14 * s);
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    draw[stage](ctx);
    ctx.restore();
  }
  // 絵の種類('v1'..'v11' / 'hose' / 'flame')から描く
  function drawPic(ctx, pic, x, y, size, t) {
    if (pic.charAt(0) === 'v') return drawVehicle(ctx, +pic.slice(1), x, y, size);
    ctx.save();
    ctx.translate(x, y); ctx.scale(size / 1.8, size / 1.8);
    if (pic === 'hose') drawHose(ctx); else drawFlame(ctx, t);
    ctx.restore();
  }
  // 未入手の黒いシルエット
  var tmp = null;
  function drawSilhouette(ctx, stage, x, y, size, color) {
    if (typeof document === 'undefined') return;
    if (!tmp) tmp = document.createElement('canvas');
    var w = Math.ceil(size * 1.3);
    var dpr = ctx.getTransform ? Math.max(1, ctx.getTransform().a) : 1;
    tmp.width = Math.ceil(w * dpr); tmp.height = Math.ceil(w * dpr);
    var c = tmp.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, w);
    drawVehicle(c, stage, w / 2, w / 2, size);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color || '#3b3f4a';
    c.fillRect(0, 0, w, w);
    c.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x - w / 2, y - w / 2, w, w);
  }

  var api = {
    draw: draw, drawVehicle: drawVehicle, drawPic: drawPic, drawSilhouette: drawSilhouette,
    drawFlame: drawFlame, drawHose: drawHose, star: star, rr: rr, circ: circ, poly: poly, line: line,
    OUT: OUT
  };
  root.Manabi = root.Manabi || {};
  root.Manabi.vehicles = api;
})(typeof window !== 'undefined' ? window : globalThis);
