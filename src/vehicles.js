// 乗り物の絵（Canvas）。hataraku-drop の src/render.js から描画部分をコピーして流用した。
// コピー元との対応（行は hataraku-drop の src/render.js）:
//   OUT, LW, rr, poly, circ, line, wheel, win, light, tracks (L5-53) / draw[1..11] (L55-199) / fireCab, star (L134-209)
// 変更点: Matter・形モード(S.layout, G.info, C.SHAPE_BODIES)への依存を削除。
//   draw[11] の「金の輪」(円モード専用) を省いた。drawVehicle は新規（単位座標 -1..1 を size px に拡縮）。
// 新しい絵 N01〜N23（pics。plan-katakana-english.md 2.8）はコピー元なしの新規。横から見る乗り物は前を左に描く。
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

  // ---- 新しい絵（plan-katakana-english.md 2.8 の N01〜N23。id は 'v' で始めない） ----
  // 横から見る乗り物（DIRECTIONAL）は「前」を左に描く。drawPic が facing に合わせて反転する（FRONT 規約）。
  // 向きのない絵（ロケット・しずく・けむり・バケツ・うきわ・えき・サイレン・ポンプ・ヘルメット）は反転しない。
  // 実在のマーク・ロゴ・文字は描かない。
  var pics = {};
  function ell(ctx, x, y, rx, ry, fill) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
  }
  function stripe(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
  function headlamp(ctx, x, y) { circ(ctx, x, y, 0.05, '#fff3b0'); }

  pics.airplane = function (ctx) {   // N01 ひこうき
    poly(ctx, [[0.5, -0.18], [0.66, -0.56], [0.8, -0.56], [0.8, -0.18]], '#3a7bd5');          // 尾翼
    poly(ctx, [[0.52, 0.0], [0.84, -0.02], [0.84, 0.14], [0.6, 0.16]], '#c9ced3');            // 水平尾翼
    poly(ctx, [[-0.12, 0.0], [0.28, 0.0], [0.42, 0.46], [0.1, 0.46]], '#c9ced3');             // 主翼
    rr(ctx, -0.84, -0.22, 1.68, 0.4, 0.2, '#fafafa');                                         // 胴体
    stripe(ctx, -0.7, 0.03, 1.4, 0.07, '#3a7bd5'); rr(ctx, -0.84, -0.22, 1.68, 0.4, 0.2, null);
    for (var i = 0; i < 6; i++) circ(ctx, -0.42 + i * 0.16, -0.07, 0.045, '#bfe6fb');          // 窓
    rr(ctx, -0.72, -0.14, 0.12, 0.1, 0.03, '#bfe6fb');                                        // 操縦席の窓
    rr(ctx, 0.0, 0.14, 0.22, 0.14, 0.06, '#8a8f94');                                          // エンジン
  };

  function carBody(ctx, fill) {   // 乗用車の車体（パトカー・タクシー共通）。前が左
    poly(ctx, [[-0.42, -0.02], [-0.3, -0.36], [0.34, -0.36], [0.56, -0.02]], fill);
    rr(ctx, -0.8, -0.04, 1.6, 0.42, 0.12, fill);
    poly(ctx, [[-0.36, -0.06], [-0.27, -0.3], [-0.02, -0.3], [-0.02, -0.06]], '#bfe6fb');
    poly(ctx, [[0.05, -0.06], [0.05, -0.3], [0.32, -0.3], [0.47, -0.06]], '#bfe6fb');
    headlamp(ctx, -0.77, 0.08);
    wheel(ctx, -0.5, 0.38, 0.17); wheel(ctx, 0.48, 0.38, 0.17);
  }
  pics.patrol = function (ctx) {   // N20 パトカー
    carBody(ctx, '#fafafa');
    stripe(ctx, -0.74, 0.12, 1.48, 0.1, '#2b2b2b'); rr(ctx, -0.8, -0.04, 1.6, 0.42, 0.12, null);
    rr(ctx, -0.12, -0.48, 0.12, 0.12, 0.03, '#e53935'); rr(ctx, 0.0, -0.48, 0.12, 0.12, 0.03, '#3a7bd5');
  };
  pics.taxi = function (ctx) {   // N08 タクシー
    carBody(ctx, '#f6c933');
    for (var i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#fafafa' : '#2b2b2b'; ctx.fillRect(-0.7 + i * 0.17, 0.14, 0.085, 0.085); }
    rr(ctx, -0.8, -0.04, 1.6, 0.42, 0.12, null);
    rr(ctx, -0.12, -0.5, 0.3, 0.14, 0.04, '#fafafa');   // 行灯
  };

  pics.bus = function (ctx) {   // N22 バス
    rr(ctx, -0.82, -0.46, 1.64, 0.84, 0.14, '#f6c933');
    stripe(ctx, -0.78, 0.08, 1.56, 0.08, '#e8512f'); rr(ctx, -0.82, -0.46, 1.64, 0.84, 0.14, null);
    rr(ctx, -0.76, -0.38, 0.2, 0.4, 0.04, '#bfe6fb');                                         // 前の窓
    rr(ctx, -0.48, -0.38, 0.2, 0.7, 0.03, '#bfe6fb'); line(ctx, -0.38, -0.38, -0.38, 0.32, 0.03);   // ドア
    for (var i = 0; i < 4; i++) win(ctx, -0.16 + i * 0.24, -0.38, 0.19, 0.3);
    headlamp(ctx, -0.79, 0.26);
    wheel(ctx, -0.5, 0.4, 0.17); wheel(ctx, 0.5, 0.4, 0.17);
  };

  pics.truck = function (ctx) {   // N19 トラック
    rr(ctx, -0.8, -0.1, 0.5, 0.46, 0.08, '#f08a24');
    win(ctx, -0.74, -0.04, 0.34, 0.24);
    rr(ctx, -0.26, -0.5, 1.06, 0.82, 0.06, '#fafafa');
    stripe(ctx, -0.22, -0.12, 0.98, 0.08, '#f08a24'); rr(ctx, -0.26, -0.5, 1.06, 0.82, 0.06, null);
    rr(ctx, -0.8, 0.24, 1.6, 0.1, 0.03, '#34384a');
    headlamp(ctx, -0.78, 0.12);
    wheel(ctx, -0.54, 0.4, 0.16); wheel(ctx, 0.38, 0.4, 0.16); wheel(ctx, 0.66, 0.4, 0.16);
  };

  pics.postcar = function (ctx) {   // N06 ゆうびんしゃ（赤い箱＋封筒。実在の記号なし）
    rr(ctx, -0.8, -0.1, 0.46, 0.46, 0.08, '#d9342b');
    win(ctx, -0.74, -0.04, 0.32, 0.24);
    rr(ctx, -0.3, -0.5, 1.1, 0.82, 0.08, '#d9342b');
    rr(ctx, -0.12, -0.34, 0.74, 0.46, 0.03, '#fafafa');                                       // 封筒
    line(ctx, -0.12, -0.34, 0.25, -0.08, 0.035); line(ctx, 0.62, -0.34, 0.25, -0.08, 0.035);
    rr(ctx, -0.8, 0.24, 1.6, 0.1, 0.03, '#34384a');
    headlamp(ctx, -0.78, 0.12);
    wheel(ctx, -0.55, 0.4, 0.16); wheel(ctx, 0.45, 0.4, 0.16);
  };

  pics.crane = function (ctx) {   // N18 クレーンしゃ
    rr(ctx, -0.82, -0.1, 0.44, 0.46, 0.08, '#f6c933');
    win(ctx, -0.76, -0.04, 0.3, 0.24);
    rr(ctx, -0.4, -0.02, 1.2, 0.36, 0.05, '#f6c933');
    rr(ctx, 0.1, -0.3, 0.4, 0.3, 0.05, '#e5bf45');                                            // 旋回台
    line(ctx, 0.3, -0.2, -0.5, -0.58, 0.14, OUT); line(ctx, 0.3, -0.2, -0.5, -0.58, 0.09, '#f08a24');   // ブーム
    circ(ctx, 0.3, -0.2, 0.06, '#8a8f94');
    line(ctx, -0.5, -0.58, -0.5, -0.24, 0.025);                                               // ワイヤー
    rr(ctx, -0.56, -0.24, 0.12, 0.12, 0.03, '#8a8f94');                                       // フック
    rr(ctx, -0.8, 0.24, 1.6, 0.1, 0.03, '#34384a');
    wheel(ctx, -0.55, 0.4, 0.16); wheel(ctx, 0.3, 0.4, 0.16); wheel(ctx, 0.6, 0.4, 0.16);
  };

  pics.roller = function (ctx) {   // N23 ロードローラー
    rr(ctx, -0.5, -0.08, 0.5, 0.18, 0.04, '#8d8d8d');                                         // 前の枠
    rr(ctx, -0.1, -0.12, 0.84, 0.46, 0.08, '#f6c933');
    rr(ctx, 0.12, -0.56, 0.48, 0.46, 0.04, '#e5bf45');
    win(ctx, 0.18, -0.5, 0.36, 0.3);
    rr(ctx, 0.06, -0.64, 0.6, 0.09, 0.03, '#555');                                            // 屋根
    circ(ctx, -0.46, 0.2, 0.36, '#9aa0a6'); circ(ctx, -0.46, 0.2, 0.13, '#cfd3d6');          // ローラー
    circ(ctx, 0.52, 0.3, 0.26, '#2b2b2b'); circ(ctx, 0.52, 0.3, 0.11, '#cfd3d6');            // 後輪
  };

  pics.train = function (ctx) {   // N02 でんしゃ（2りょう）
    for (var c = 0; c < 2; c++) {
      var x0 = -0.86 + c * 0.86;
      rr(ctx, x0, -0.36, 0.84, 0.66, 0.1, '#fafafa');
      stripe(ctx, x0 + 0.03, 0.04, 0.78, 0.1, '#3e9a3e'); rr(ctx, x0, -0.36, 0.84, 0.66, 0.1, null);
      for (var i = 0; i < 3; i++) win(ctx, x0 + 0.1 + i * 0.25, -0.26, 0.18, 0.26);
      wheel(ctx, x0 + 0.17, 0.34, 0.09); wheel(ctx, x0 + 0.67, 0.34, 0.09);
    }
    line(ctx, -0.02, 0.18, 0.02, 0.18, 0.05);                                                 // 連結
    line(ctx, 0.5, -0.36, 0.5, -0.46, 0.035); line(ctx, 0.38, -0.46, 0.62, -0.46, 0.04);      // パンタグラフ
    headlamp(ctx, -0.83, 0.2);
  };

  pics.shinkansen = function (ctx) {   // N03 しんかんせん（とがった先頭と青い帯）
    var nose = [[-0.92, 0.28], [-0.88, 0.14], [-0.6, -0.14], [-0.34, -0.3], [0.0, -0.3], [0.0, 0.28]];
    poly(ctx, nose, '#fafafa');
    rr(ctx, 0.02, -0.3, 0.8, 0.58, 0.08, '#fafafa');
    ctx.save(); ctx.beginPath(); ctx.rect(-1, 0.0, 2, 0.1); ctx.clip();
    poly(ctx, nose, '#1e6fd0'); rr(ctx, 0.02, -0.3, 0.8, 0.58, 0.08, '#1e6fd0');
    ctx.restore();
    poly(ctx, nose, null); rr(ctx, 0.02, -0.3, 0.8, 0.58, 0.08, null);
    poly(ctx, [[-0.7, -0.08], [-0.52, -0.2], [-0.36, -0.22], [-0.36, -0.08]], '#bfe6fb');   // 運転席の窓
    for (var i = 0; i < 4; i++) win(ctx, -0.26 + i * 0.22, -0.2, 0.15, 0.14);
    for (var j = 0; j < 3; j++) win(ctx, 0.1 + j * 0.22, -0.2, 0.15, 0.14);
    wheel(ctx, -0.5, 0.33, 0.09); wheel(ctx, -0.1, 0.33, 0.09); wheel(ctx, 0.2, 0.33, 0.09); wheel(ctx, 0.66, 0.33, 0.09);
  };

  pics.steam = function (ctx) {   // N05 きかんしゃ（SL）
    rr(ctx, 0.46, -0.2, 0.36, 0.5, 0.05, '#2b2b2b');                                          // 炭水車
    ell(ctx, 0.64, -0.22, 0.14, 0.07, '#444');
    rr(ctx, -0.84, -0.2, 0.88, 0.42, 0.2, '#2b2b2b');                                         // ボイラー
    poly(ctx, [[-0.7, -0.2], [-0.66, -0.44], [-0.76, -0.52], [-0.34, -0.52], [-0.44, -0.44], [-0.4, -0.2]], '#444');   // えんとつ
    circ(ctx, -0.14, -0.28, 0.1, '#555');                                                     // ドーム
    rr(ctx, 0.0, -0.52, 0.5, 0.8, 0.05, '#c0392b');                                           // 運転台
    win(ctx, 0.08, -0.42, 0.3, 0.26);
    rr(ctx, -0.04, -0.6, 0.58, 0.1, 0.03, '#555');
    rr(ctx, -0.84, 0.16, 1.66, 0.1, 0.03, '#555');
    circ(ctx, -0.82, -0.02, 0.06, '#ffd23f');
    circ(ctx, -0.55, 0.38, 0.15, '#c0392b'); circ(ctx, -0.55, 0.38, 0.05, '#cfd3d6');
    circ(ctx, -0.12, 0.34, 0.2, '#c0392b'); circ(ctx, -0.12, 0.34, 0.07, '#cfd3d6');
    circ(ctx, 0.3, 0.34, 0.2, '#c0392b'); circ(ctx, 0.3, 0.34, 0.07, '#cfd3d6');
    line(ctx, -0.12, 0.34, 0.3, 0.34, 0.035, '#cfd3d6');
  };

  function wave(ctx, x0, x1, y) {
    ctx.beginPath(); ctx.moveTo(x0, y);
    var n = Math.round((x1 - x0) / 0.2);
    for (var i = 0; i < n; i++) ctx.quadraticCurveTo(x0 + (i + 0.5) * (x1 - x0) / n, y - 0.09, x0 + (i + 1) * (x1 - x0) / n, y);
    ctx.lineCap = 'round'; ctx.lineWidth = 0.045; ctx.strokeStyle = '#4aa3df'; ctx.stroke();
  }
  pics.ship = function (ctx) {   // N04 ふね
    rr(ctx, 0.12, -0.6, 0.2, 0.3, 0.03, '#e53935');                                           // えんとつ
    stripe(ctx, 0.14, -0.5, 0.16, 0.06, '#fafafa'); rr(ctx, 0.12, -0.6, 0.2, 0.3, 0.03, null);
    rr(ctx, -0.28, -0.46, 0.4, 0.22, 0.04, '#fafafa');                                        // 操舵室
    win(ctx, -0.22, -0.4, 0.28, 0.1);
    rr(ctx, -0.5, -0.26, 1.0, 0.28, 0.04, '#fafafa');                                         // 船室
    for (var i = 0; i < 5; i++) circ(ctx, -0.38 + i * 0.19, -0.12, 0.05, '#bfe6fb');
    poly(ctx, [[-0.88, -0.02], [0.84, -0.02], [0.66, 0.36], [-0.6, 0.36]], '#2f4f8f');        // 船体
    stripe(ctx, -0.8, 0.07, 1.6, 0.05, '#e53935');
    poly(ctx, [[-0.88, -0.02], [0.84, -0.02], [0.66, 0.36], [-0.6, 0.36]], null);
    wave(ctx, -0.9, 0.9, 0.46);
  };

  pics.heli = function (ctx, t) {   // N21 ヘリコプター（ローターは t で回る）
    var L = 0.75 * (0.35 + 0.65 * Math.abs(Math.cos((t || 0) * 14)));
    poly(ctx, [[0.2, -0.1], [0.8, -0.24], [0.8, -0.12], [0.2, 0.1]], '#d4202a');            // テール
    poly(ctx, [[0.66, -0.22], [0.78, -0.5], [0.86, -0.5], [0.8, -0.14]], '#d4202a');
    ell(ctx, -0.18, 0.0, 0.5, 0.32, '#d4202a');                                               // 胴体
    ell(ctx, -0.42, -0.04, 0.22, 0.2, '#bfe6fb');                                             // 風防
    rr(ctx, -0.24, -0.42, 0.1, 0.14, 0.02, '#555');                                           // マスト
    line(ctx, -0.19 - L, -0.46, -0.19 + L, -0.46, 0.08, OUT); line(ctx, -0.19 - L, -0.46, -0.19 + L, -0.46, 0.04, '#8a8f94');
    line(ctx, -0.5, 0.42, 0.1, 0.42, 0.06);                                                   // スキッド
    line(ctx, -0.36, 0.28, -0.4, 0.42, 0.045); line(ctx, -0.0, 0.3, 0.0, 0.42, 0.045);
    circ(ctx, 0.82, -0.2, 0.06, '#8a8f94');
  };

  pics.motorbike = function (ctx) {   // N14 オートバイ
    ctx.translate(0, -0.14);
    line(ctx, 0.2, 0.2, 0.5, 0.36, 0.08);                                                     // 後ろのアーム
    wheel(ctx, -0.56, 0.36, 0.22); wheel(ctx, 0.52, 0.36, 0.22);
    line(ctx, -0.56, 0.36, -0.42, -0.2, 0.08);                                                // フォーク
    rr(ctx, -0.66, -0.0, 0.2, 0.08, 0.03, '#e53935');                                         // 前フェンダー
    rr(ctx, -0.2, 0.06, 0.4, 0.3, 0.05, '#8a8f94');                                           // エンジン
    rr(ctx, -0.32, -0.2, 0.5, 0.26, 0.1, '#e53935');                                          // タンク
    rr(ctx, 0.08, -0.2, 0.34, 0.1, 0.05, '#2b2b2b');                                           // シート
    line(ctx, -0.46, -0.26, -0.28, -0.3, 0.06);                                               // ハンドル
    circ(ctx, -0.5, -0.12, 0.07, '#ffd23f');
    rr(ctx, 0.3, 0.14, 0.36, 0.07, 0.03, '#aaa');                                             // マフラー
  };

  pics.rocket = function (ctx, t) {   // N07 ロケット（ななめ）
    var k = Math.sin((t || 0) * 12) * 0.04;
    ctx.rotate(0.55); ctx.translate(0, -0.06); ctx.scale(0.82, 0.82);
    ctx.save(); ctx.translate(0, 0.5); ctx.rotate(Math.PI); ctx.scale(0.3 + k, 0.4 + k); drawFlame(ctx, t); ctx.restore();
    poly(ctx, [[-0.2, 0.2], [-0.4, 0.55], [-0.2, 0.4]], '#e53935');
    poly(ctx, [[0.2, 0.2], [0.4, 0.55], [0.2, 0.4]], '#e53935');
    rr(ctx, -0.1, 0.4, 0.2, 0.1, 0.03, '#555');
    rr(ctx, -0.22, -0.3, 0.44, 0.74, 0.1, '#fafafa');
    poly(ctx, [[-0.22, -0.28], [0.0, -0.74], [0.22, -0.28]], '#e53935');
    circ(ctx, 0, -0.06, 0.11, '#bfe6fb');
    stripe(ctx, -0.2, 0.2, 0.4, 0.07, '#e53935'); rr(ctx, -0.22, -0.3, 0.44, 0.74, 0.1, null);
  };

  pics.water = function (ctx, t) {   // N09 みず（しずく）
    var k = Math.sin((t || 0) * 4) * 0.02;
    function drop(sc, ox, oy) {
      ctx.beginPath();
      ctx.moveTo(ox, oy - 0.62 * sc);
      ctx.bezierCurveTo(ox + 0.12 * sc, oy - 0.3 * sc, ox + 0.5 * sc, oy - 0.05 * sc, ox + 0.5 * sc, oy + 0.2 * sc);
      ctx.bezierCurveTo(ox + 0.5 * sc, oy + 0.5 * sc, ox + 0.25 * sc, oy + 0.6 * sc, ox, oy + 0.6 * sc);
      ctx.bezierCurveTo(ox - 0.25 * sc, oy + 0.6 * sc, ox - 0.5 * sc, oy + 0.5 * sc, ox - 0.5 * sc, oy + 0.2 * sc);
      ctx.bezierCurveTo(ox - 0.5 * sc, oy - 0.05 * sc, ox - 0.12 * sc, oy - 0.3 * sc, ox, oy - 0.62 * sc);
      ctx.closePath(); ctx.fillStyle = '#3aa6e8'; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    }
    ctx.lineJoin = 'round';
    drop(0.28, -0.62, 0.3 + k); drop(0.22, 0.62, 0.34 - k);
    drop(0.92, 0, -0.04 + k);
    ctx.beginPath(); ctx.arc(0, 0.12, 0.3, Math.PI * 0.62, Math.PI * 0.95);
    ctx.lineCap = 'round'; ctx.lineWidth = 0.05; ctx.strokeStyle = '#d6f0ff'; ctx.stroke();
  };

  pics.smoke = function (ctx, t) {   // N10 けむり
    t = t || 0;
    var s = Math.sin(t * 3) * 0.03;
    ctx.lineJoin = 'round';
    circ(ctx, -0.32, 0.26, 0.3, '#8e949a');
    circ(ctx, 0.2, 0.22, 0.34, '#a3a9af');
    circ(ctx, -0.08, -0.08 + s, 0.34, '#b8bdc2');
    circ(ctx, 0.34, -0.22 - s, 0.25, '#c9ced3');
    circ(ctx, -0.1, -0.4 + s, 0.2, '#dde0e3');
  };

  pics.bucket = function (ctx) {   // N11 バケツ
    ctx.beginPath(); ctx.ellipse(0, -0.28, 0.46, 0.3, 0, Math.PI, 0);
    ctx.lineCap = 'round'; ctx.lineWidth = 0.1; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 0.05; ctx.strokeStyle = '#9aa0a6'; ctx.stroke();
    poly(ctx, [[-0.5, -0.28], [0.5, -0.28], [0.36, 0.52], [-0.36, 0.52]], '#e53935');
    stripe(ctx, -0.44, 0.04, 0.88, 0.14, '#fafafa');
    poly(ctx, [[-0.5, -0.28], [0.5, -0.28], [0.36, 0.52], [-0.36, 0.52]], null);
    ell(ctx, 0, -0.28, 0.5, 0.1, '#b71c1c');
    ell(ctx, 0, -0.27, 0.4, 0.06, '#3aa6e8');
  };

  pics.ring = function (ctx) {   // N12 うきわ
    var R = 0.6, r = 0.28, cols = ['#e53935', '#fafafa', '#e53935', '#fafafa'];
    for (var i = 0; i < 4; i++) {
      var a0 = -Math.PI / 4 + i * Math.PI / 2, a1 = a0 + Math.PI / 2;
      ctx.beginPath(); ctx.arc(0, 0, R, a0, a1); ctx.arc(0, 0, r, a1, a0, true); ctx.closePath();
      ctx.fillStyle = cols[i]; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    }
  };

  pics.station = function (ctx) {   // N13 えき（ホーム・駅名板（字なし）・線路つき）
    rr(ctx, -0.86, -0.2, 1.1, 0.42, 0.04, '#e9d8b4');                                        // 駅舎
    poly(ctx, [[-0.5, -0.28], [-0.31, -0.58], [-0.12, -0.28]], '#c0392b');
    rr(ctx, -0.92, -0.3, 1.22, 0.12, 0.03, '#c0392b');
    circ(ctx, -0.31, -0.4, 0.09, '#fafafa');                                                 // とけい
    line(ctx, -0.31, -0.4, -0.31, -0.46, 0.028); line(ctx, -0.31, -0.4, -0.26, -0.38, 0.028);
    win(ctx, -0.8, -0.1, 0.22, 0.2); win(ctx, -0.02, -0.1, 0.22, 0.2);
    rr(ctx, -0.42, -0.06, 0.22, 0.28, 0.03, '#7a5a3a');
    line(ctx, 0.48, -0.1, 0.48, 0.22, 0.05); line(ctx, 0.78, -0.1, 0.78, 0.22, 0.05);       // 駅名板の柱
    rr(ctx, 0.36, -0.36, 0.54, 0.28, 0.03, '#2f6fd0');                                       // 駅名板（字は書かない）
    rr(ctx, 0.41, -0.31, 0.44, 0.18, 0.02, '#fafafa');
    rr(ctx, -0.92, 0.22, 1.84, 0.14, 0.02, '#c9ced3');                                       // ホーム
    stripe(ctx, -0.9, 0.24, 1.8, 0.03, '#f6c933');
    stripe(ctx, -0.92, 0.38, 1.84, 0.17, '#8b6b4a');                                         // 線路
    for (var i = 0; i < 9; i++) rr(ctx, -0.86 + i * 0.2, 0.43, 0.09, 0.1, 0.01, '#5a4630');
    line(ctx, -0.92, 0.41, 0.92, 0.41, 0.045, '#9aa0a6');
    line(ctx, -0.92, 0.53, 0.92, 0.53, 0.045, '#9aa0a6');
  };

  pics.siren = function (ctx, t) {   // N15 サイレン（回転灯）
    var on = Math.floor((t || 0) * 4) % 2 === 0;
    for (var k = 0; k < 7; k++) {
      var a = Math.PI + k * Math.PI / 6;
      line(ctx, Math.cos(a) * 0.44, 0.12 + Math.sin(a) * 0.44, Math.cos(a) * 0.62, 0.12 + Math.sin(a) * 0.62, 0.06, (k % 2 === (on ? 0 : 1)) ? '#ffb733' : '#ffd23f');
    }
    ctx.beginPath(); ctx.moveTo(-0.32, 0.12); ctx.arc(0, 0.12, 0.32, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = '#e53935'; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0.12, 0.2, Math.PI * 1.1, Math.PI * 1.45);
    ctx.lineCap = 'round'; ctx.lineWidth = 0.05; ctx.strokeStyle = '#ff9d9a'; ctx.stroke();
    rr(ctx, -0.42, 0.12, 0.84, 0.2, 0.05, '#555');
  };

  pics.pump = function (ctx) {   // N16 ポンプ（持ち運びの消防ポンプ。車ではなく、枠にのったポンプ本体＋ホースのつなぎ口）
    rr(ctx, -0.74, 0.3, 1.48, 0.12, 0.04, '#555');                                           // 土台
    line(ctx, -0.6, 0.42, -0.6, 0.52, 0.05); line(ctx, 0.6, 0.42, 0.6, 0.52, 0.05);
    line(ctx, -0.64, 0.3, -0.64, -0.2, 0.06); line(ctx, 0.64, 0.3, 0.64, -0.2, 0.06);        // 枠
    line(ctx, -0.64, -0.2, 0.64, -0.2, 0.06);
    rr(ctx, -0.4, -0.1, 0.8, 0.42, 0.08, '#e53935');                                         // ポンプ本体
    circ(ctx, -0.04, 0.1, 0.24, '#c9302c');                                                  // うず巻き室
    circ(ctx, -0.04, 0.1, 0.11, '#b0b5ba');
    line(ctx, 0.28, -0.26, 0.28, -0.1, 0.05);
    circ(ctx, 0.28, -0.4, 0.14, '#fafafa'); line(ctx, 0.28, -0.4, 0.34, -0.48, 0.03);        // 圧力計
    rr(ctx, 0.4, 0.04, 0.34, 0.14, 0.03, '#b0b5ba');                                         // ホースのつなぎ口
    rr(ctx, 0.7, 0.0, 0.12, 0.22, 0.03, '#8a8f94');
    for (var i = 0; i < 2; i++) {                                                            // つないだホース
      ctx.beginPath(); ctx.moveTo(0.82, 0.11); ctx.bezierCurveTo(0.95, 0.3, 0.8, 0.5, 0.55, 0.5);
      ctx.lineCap = 'round'; ctx.lineWidth = i ? 0.06 : 0.1; ctx.strokeStyle = i ? '#f3d054' : OUT; ctx.stroke();
    }
    rr(ctx, -0.74, -0.08, 0.3, 0.16, 0.04, '#b0b5ba');                                       // 吸水口
  };

  pics.helmet = function (ctx) {   // N17 ヘルメット（マークなし）
    ctx.translate(0, -0.04);
    poly(ctx, [[-0.76, 0.2], [-0.62, 0.1], [0.62, 0.1], [0.8, 0.34], [-0.7, 0.34]], '#c4302b');   // つば
    ctx.beginPath(); ctx.moveTo(-0.6, 0.12); ctx.arc(0, 0.12, 0.6, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = '#e53935'; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    rr(ctx, -0.07, -0.6, 0.14, 0.7, 0.05, '#f6c933');                                         // 山
    poly(ctx, [[-0.24, -0.2], [0.24, -0.2], [0.3, 0.1], [0, 0.18], [-0.3, 0.1]], '#f6c933');   // 前の板（マークなし）
  };

  // ---- S1 の漢字の教材（K8）の絵。名前・文字は描かない。向きのない絵なので反転しない ----
  pics.tree = function (ctx) {   // 木
    rr(ctx, -0.13, 0.05, 0.26, 0.68, 0.05, '#8d5a34');
    line(ctx, 0, 0.3, 0.22, 0.12, 0.06); line(ctx, 0, 0.42, -0.2, 0.26, 0.06);
    circ(ctx, -0.32, 0.0, 0.3, '#4aa04a'); circ(ctx, 0.32, 0.0, 0.3, '#4aa04a');
    circ(ctx, 0, -0.3, 0.38, '#55b155'); circ(ctx, 0, 0.0, 0.3, '#55b155');
  };
  pics.mountain = function (ctx) {   // 山
    poly(ctx, [[-0.9, 0.55], [-0.2, -0.55], [0.5, 0.55]], '#7f9a6a');
    poly(ctx, [[0.0, 0.55], [0.5, -0.2], [0.95, 0.55]], '#6a8a5a');
    poly(ctx, [[-0.2, -0.55], [-0.38, -0.26], [-0.28, -0.3], [-0.2, -0.2], [-0.12, -0.3], [-0.02, -0.26]], '#fafafa');
    line(ctx, -0.95, 0.58, 1.0, 0.58, 0.07, '#7bbf6a');
  };
  pics.river = function (ctx) {   // 川（草のあいだを流れる）
    rr(ctx, -0.8, -0.65, 1.6, 1.3, 0.12, '#7bbf6a');
    ctx.save(); ctx.beginPath(); ctx.rect(-0.8, -0.65, 1.6, 1.3); ctx.clip();
    ctx.beginPath(); ctx.moveTo(-0.35, -0.8); ctx.bezierCurveTo(0.6, -0.3, -0.6, 0.2, 0.3, 0.8);
    ctx.lineCap = 'round'; ctx.lineWidth = 0.5; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 0.4; ctx.strokeStyle = '#3aa6e8'; ctx.stroke();
    ctx.lineWidth = 0.05; ctx.strokeStyle = '#d6f0ff'; ctx.beginPath(); ctx.moveTo(-0.15, -0.5); ctx.bezierCurveTo(0.4, -0.2, -0.3, 0.1, 0.35, 0.5); ctx.stroke();
    ctx.restore();
    rr(ctx, -0.8, -0.65, 1.6, 1.3, 0.12, null);
  };
  pics.rain = function (ctx, t) {   // 雨
    t = t || 0;
    circ(ctx, -0.34, -0.12, 0.26, '#9aa6b3'); circ(ctx, 0.36, -0.12, 0.26, '#9aa6b3');
    circ(ctx, -0.05, -0.3, 0.36, '#aab5c1'); rr(ctx, -0.55, -0.14, 1.1, 0.24, 0.1, '#aab5c1');
    for (var i = 0; i < 4; i++) {
      var u = ((t * 0.8 + i * 0.25) % 1), x = -0.42 + i * 0.28, y = 0.2 + u * 0.4;
      line(ctx, x, y, x - 0.07, y + 0.2, 0.07, '#3aa6e8');
    }
  };
  pics.flower = function (ctx) {   // 花
    line(ctx, 0, 0.05, 0, 0.75, 0.09, '#3f9b3f');
    ell(ctx, -0.2, 0.5, 0.2, 0.09, '#55b155'); ell(ctx, 0.2, 0.36, 0.2, 0.09, '#55b155');
    for (var i = 0; i < 5; i++) { var a = i * Math.PI * 2 / 5 - Math.PI / 2; circ(ctx, Math.cos(a) * 0.3, -0.22 + Math.sin(a) * 0.3, 0.2, '#ff8fb3'); }
    circ(ctx, 0, -0.22, 0.16, '#ffd23f');
  };
  pics.stone = function (ctx) {   // 石
    poly(ctx, [[-0.62, 0.38], [-0.7, 0.02], [-0.36, -0.4], [0.2, -0.5], [0.66, -0.1], [0.58, 0.38]], '#9a8f84');
    poly(ctx, [[-0.36, -0.4], [0.2, -0.5], [0.04, -0.06], [-0.44, -0.06]], '#b9afa4');
    line(ctx, -0.2, 0.2, 0.1, 0.12, 0.04, '#7d746b');
  };
  pics.dog = function (ctx) {   // 犬
    ell(ctx, -0.5, -0.1, 0.17, 0.34, '#8d5a34'); ell(ctx, 0.5, -0.1, 0.17, 0.34, '#8d5a34');
    circ(ctx, 0, 0, 0.5, '#d9a066');
    ell(ctx, 0, 0.18, 0.25, 0.19, '#f3d9b5');
    circ(ctx, -0.18, -0.1, 0.06, OUT); circ(ctx, 0.18, -0.1, 0.06, OUT);
    ell(ctx, 0, 0.1, 0.09, 0.06, OUT);
    ctx.beginPath(); ctx.moveTo(0, 0.16); ctx.lineTo(0, 0.24); ctx.arc(-0.08, 0.24, 0.08, 0, Math.PI * 0.6); ctx.moveTo(0, 0.24); ctx.arc(0.08, 0.24, 0.08, Math.PI, Math.PI * 0.4, true);
    ctx.lineWidth = 0.035; ctx.strokeStyle = OUT; ctx.stroke();
  };
  pics.bug = function (ctx) {   // 虫（てんとうむし）
    line(ctx, -0.12, -0.5, -0.26, -0.75, 0.04); line(ctx, 0.12, -0.5, 0.26, -0.75, 0.04);
    [[-0.5, -0.1], [-0.55, 0.15], [-0.45, 0.4]].forEach(function (p) { line(ctx, p[0] * 0.5, p[1], p[0], p[1] + 0.05, 0.05); line(ctx, -p[0] * 0.5, p[1], -p[0], p[1] + 0.05, 0.05); });
    circ(ctx, 0, -0.42, 0.2, OUT);
    ctx.beginPath(); ctx.ellipse(0, 0.1, 0.5, 0.55, 0, 0, Math.PI * 2); ctx.fillStyle = '#e53935'; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    line(ctx, 0, -0.44, 0, 0.64, 0.045);
    [[-0.25, -0.05], [0.25, -0.05], [-0.26, 0.3], [0.26, 0.3]].forEach(function (p) { circ(ctx, p[0], p[1], 0.09, OUT); });
  };
  pics.sky = function (ctx, t) {   // 空
    t = t || 0;
    rr(ctx, -0.8, -0.62, 1.6, 1.24, 0.12, '#8fd0f5');
    var d = Math.sin(t * 0.8) * 0.04;
    circ(ctx, 0.42, -0.3, 0.2, '#ffd23f');
    circ(ctx, -0.4 + d, 0.12, 0.2, '#fff'); circ(ctx, -0.1 + d, 0.06, 0.26, '#fff'); circ(ctx, 0.2 + d, 0.14, 0.2, '#fff'); rr(ctx, -0.55 + d, 0.12, 0.9, 0.2, 0.1, '#fff');
  };
  pics.mouth = function (ctx) {   // 口
    ell(ctx, 0, 0, 0.62, 0.4, '#e5566b');
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0.02, 0.46, 0.27, 0, 0, Math.PI * 2); ctx.fillStyle = '#7a2a35'; ctx.fill(); ctx.clip();
    ell(ctx, 0, 0.26, 0.28, 0.16, '#ff8fa0'); ctx.restore();
    rr(ctx, -0.3, -0.25, 0.6, 0.12, 0.04, '#fff');
    ctx.beginPath(); ctx.ellipse(0, 0.02, 0.46, 0.27, 0, 0, Math.PI * 2); ctx.lineWidth = 0.04; ctx.strokeStyle = OUT; ctx.stroke();
  };
  pics.eye = function (ctx) {   // 目
    ctx.beginPath(); ctx.moveTo(-0.7, 0); ctx.quadraticCurveTo(0, -0.7, 0.7, 0); ctx.quadraticCurveTo(0, 0.7, -0.7, 0); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    circ(ctx, 0, 0, 0.28, '#3a7bd5'); circ(ctx, 0, 0, 0.13, OUT); circ(ctx, -0.07, -0.08, 0.05, '#fff');
    ctx.beginPath(); ctx.moveTo(-0.6, -0.34); ctx.quadraticCurveTo(0, -0.8, 0.6, -0.34); ctx.lineWidth = 0.07; ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.stroke();
  };
  pics.ear = function (ctx) {   // 耳
    ell(ctx, 0, 0, 0.4, 0.58, '#f2c9a0');
    ctx.beginPath(); ctx.ellipse(0.04, -0.04, 0.2, 0.36, 0, 0, Math.PI * 2); ctx.fillStyle = '#e8a97e'; ctx.fill(); ctx.lineWidth = 0.04; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.arc(0.04, 0.08, 0.1, Math.PI * 1.1, Math.PI * 0.2); ctx.stroke();
    circ(ctx, 0.0, 0.5, 0.12, '#f2c9a0');
  };
  pics.hand = function (ctx) {   // 手
    rr(ctx, -0.32, -0.02, 0.64, 0.62, 0.16, '#f2c9a0');
    [[-0.32, -0.62], [-0.11, -0.74], [0.1, -0.7], [0.3 - 0.0, -0.52]].forEach(function (f, i) { rr(ctx, f[0] - (i === 3 ? 0.08 : 0), f[1], 0.2, 0.7, 0.1, '#f2c9a0'); });
    ctx.save(); ctx.translate(-0.34, 0.28); ctx.rotate(-0.9); rr(ctx, -0.1, -0.5, 0.2, 0.52, 0.1, '#f2c9a0'); ctx.restore();
    rr(ctx, -0.32, -0.02, 0.64, 0.62, 0.16, '#f2c9a0');
  };
  pics.foot = function (ctx) {   // 足（はだし）
    ctx.beginPath(); ctx.moveTo(-0.28, -0.1); ctx.bezierCurveTo(-0.34, 0.4, -0.2, 0.7, 0.05, 0.7); ctx.bezierCurveTo(0.3, 0.7, 0.36, 0.45, 0.32, 0.1); ctx.bezierCurveTo(0.3, -0.2, 0.2, -0.3, 0, -0.3); ctx.closePath();
    ctx.fillStyle = '#f2c9a0'; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    [[-0.22, -0.42, 0.12], [-0.04, -0.5, 0.1], [0.12, -0.46, 0.09], [0.25, -0.38, 0.085], [0.34, -0.26, 0.075]].forEach(function (c) { circ(ctx, c[0], c[1], c[2], '#f2c9a0'); });
  };
  pics.thread = function (ctx) {   // 糸（糸巻き）
    ctx.beginPath(); ctx.moveTo(0.18, 0.28); ctx.bezierCurveTo(0.7, 0.3, 0.5, 0.7, 0.8, 0.6); ctx.lineCap = 'round'; ctx.lineWidth = 0.05; ctx.strokeStyle = '#d33a3a'; ctx.stroke();
    rr(ctx, -0.42, -0.62, 0.84, 0.14, 0.04, '#d9a066'); rr(ctx, -0.42, 0.48, 0.84, 0.14, 0.04, '#d9a066');
    rr(ctx, -0.34, -0.48, 0.68, 0.96, 0.05, '#e5566b');
    for (var i = 0; i < 7; i++) line(ctx, -0.34, -0.38 + i * 0.14, 0.34, -0.3 + i * 0.14, 0.03, '#b83a50');
    rr(ctx, -0.34, -0.48, 0.68, 0.96, 0.05, null);
  };
  pics.forest = function (ctx) {   // 森（木が 3 本）
    [[-0.45, 0.1, 0.7], [0.45, 0.1, 0.7], [0, -0.05, 0.9]].forEach(function (t) {
      rr(ctx, t[0] - 0.07 * t[2], t[1] + 0.2 * t[2], 0.14 * t[2], 0.5 * t[2], 0.03, '#8d5a34');
      circ(ctx, t[0], t[1] - 0.05 * t[2], 0.36 * t[2], '#4aa04a'); circ(ctx, t[0], t[1] - 0.2 * t[2], 0.26 * t[2], '#55b155');
    });
  };
  pics.bamboo = function (ctx) {   // 竹
    [[-0.7, -0.2], [-0.2, 0.3], [0.3, 0.75]].forEach(function (s) { rr(ctx, -0.13, s[0], 0.26, s[1] - s[0] + 0.05, 0.05, '#6fb04a'); });
    [-0.2, 0.3].forEach(function (y) { line(ctx, -0.17, y, 0.17, y, 0.06, '#3f7a2a'); });
    poly(ctx, [[0.1, -0.3], [0.6, -0.5], [0.3, -0.2]], '#55b155'); poly(ctx, [[-0.1, 0.2], [-0.6, 0.0], [-0.3, 0.3]], '#55b155'); poly(ctx, [[0.1, 0.25], [0.55, 0.15], [0.3, 0.42]], '#55b155');
  };

  // ---- S2 の漢字の教材（K9）の絵。名前・文字は描かない。向きのない絵なので反転しない ----
  function panel(ctx, fill) { rr(ctx, -0.8, -0.65, 1.6, 1.3, 0.12, fill); }   // 絵の台紙。clip して中を塗り、最後にふちを描き直す
  function clipPanel(ctx) { ctx.save(); ctx.beginPath(); ctx.rect(-0.8, -0.65, 1.6, 1.3); ctx.clip(); }
  function rays(ctx, x, y, r0, r1, n, w, col, rot) {
    for (var i = 0; i < n; i++) { var a = (rot || 0) + i * Math.PI * 2 / n; line(ctx, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, w, col); }
  }
  pics.bolt = function (ctx) {   // 電（いなずま）
    panel(ctx, '#5a6b8f');
    circ(ctx, -0.4, -0.38, 0.22, '#aab5c1'); circ(ctx, 0.4, -0.4, 0.24, '#aab5c1'); circ(ctx, 0, -0.5, 0.3, '#c3ccd6'); rr(ctx, -0.6, -0.42, 1.2, 0.2, 0.08, '#c3ccd6');
    poly(ctx, [[0.12, -0.34], [-0.34, 0.12], [-0.04, 0.12], [-0.2, 0.56], [0.36, -0.06], [0.06, -0.06], [0.26, -0.34]], '#ffd23f');
  };
  pics.road = function (ctx) {   // 道（まっすぐな道）
    panel(ctx, '#7bbf6a'); clipPanel(ctx);
    poly(ctx, [[-0.12, -0.7], [0.12, -0.7], [0.75, 0.7], [-0.75, 0.7]], '#8b8f94');
    [[-0.5, -0.4], [-0.3, -0.12], [-0.05, 0.22], [0.2, 0.62]].forEach(function (d, i) { var k = 0.012 + i * 0.016; poly(ctx, [[-k, d[0]], [k, d[0]], [k * 1.9, d[1] + 0.1], [-k * 1.9, d[1] + 0.1]], '#fafafa'); });
    ctx.restore(); panel(ctx, null);
  };
  pics.rail = function (ctx) {   // 線（線路）
    panel(ctx, '#c9b79c'); clipPanel(ctx);
    [-0.5, -0.28, -0.04, 0.24, 0.58].forEach(function (y, i) { var w = 0.2 + (y + 0.7) * 0.5; line(ctx, -w, y, w, y, 0.07 + i * 0.012, '#8d5a34'); });
    line(ctx, -0.1, -0.75, -0.62, 0.75, 0.06, '#7d838a'); line(ctx, 0.1, -0.75, 0.62, 0.75, 0.06, '#7d838a');
    ctx.restore(); panel(ctx, null);
  };
  pics.gate = function (ctx) {   // 門（とびらを開けた門）
    rr(ctx, -0.82, -0.5, 0.24, 1.2, 0.03, '#b7c2cc'); rr(ctx, 0.58, -0.5, 0.24, 1.2, 0.03, '#b7c2cc');
    rr(ctx, -0.9, -0.62, 0.4, 0.16, 0.04, '#8d5a34'); rr(ctx, 0.5, -0.62, 0.4, 0.16, 0.04, '#8d5a34');
    poly(ctx, [[-0.58, -0.4], [-0.58, 0.7], [-0.1, 0.6], [-0.1, -0.3]], '#e53935');
    poly(ctx, [[0.58, -0.4], [0.58, 0.7], [0.1, 0.6], [0.1, -0.3]], '#e53935');
    [-0.38, -0.22].forEach(function (x) { line(ctx, x, -0.33, x, 0.62, 0.035, '#fafafa'); });
    [0.38, 0.22].forEach(function (x) { line(ctx, x, -0.33, x, 0.62, 0.035, '#fafafa'); });
  };
  pics.sea = function (ctx, t) {   // 海
    t = t || 0;
    panel(ctx, '#bfe6fb'); clipPanel(ctx);
    circ(ctx, 0.45, -0.38, 0.17, '#ffd23f');
    ctx.fillStyle = '#2f9be0'; ctx.fillRect(-0.8, -0.1, 1.6, 0.8);
    for (var r = 0; r < 3; r++) wave(ctx, -0.85 + ((t * 0.1 + r * 0.3) % 0.2), 0.85, 0.08 + r * 0.22);
    ctx.restore(); panel(ctx, null);
  };
  pics.pond = function (ctx) {   // 池
    panel(ctx, '#7bbf6a');
    ell(ctx, 0, 0.05, 0.68, 0.42, '#5bb8ee');
    ctx.beginPath(); ctx.ellipse(0, 0.05, 0.5, 0.28, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.lineCap = 'round'; ctx.lineWidth = 0.04; ctx.strokeStyle = '#d6f0ff'; ctx.stroke();
    circ(ctx, -0.25, 0.12, 0.13, '#55b155'); circ(ctx, 0.22, -0.02, 0.1, '#55b155'); circ(ctx, 0.28, 0.2, 0.08, '#55b155');
    line(ctx, 0.58, -0.4, 0.62, 0.0, 0.04, '#3f7a2a'); line(ctx, 0.66, -0.36, 0.66, 0.05, 0.04, '#3f7a2a'); circ(ctx, 0.58, -0.42, 0.04, '#8d5a34'); circ(ctx, 0.66, -0.38, 0.04, '#8d5a34');
  };
  pics.horse = function (ctx) {   // 馬（横向きの頭と首）
    poly(ctx, [[-0.5, 0.75], [-0.4, -0.2], [-0.12, -0.62], [0.1, -0.8], [0.22, -0.66], [0.66, 0.02], [0.72, 0.22], [0.5, 0.3], [0.3, 0.12], [0.14, 0.15], [0.14, 0.75]], '#a9672f');
    poly(ctx, [[-0.12, -0.62], [-0.45, -0.3], [-0.55, 0.3], [-0.48, 0.75], [-0.5, 0.2], [-0.32, -0.2]], '#4a2e1a');         // たてがみ
    poly(ctx, [[0.04, -0.72], [0.0, -0.9], [0.2, -0.76]], '#a9672f');                                                      // 耳
    circ(ctx, 0.28, -0.4, 0.05, OUT); circ(ctx, 0.58, 0.16, 0.025, OUT);
  };
  pics.bird = function (ctx) {   // 鳥（小鳥）
    line(ctx, -0.12, 0.42, -0.14, 0.7, 0.04); line(ctx, 0.1, 0.42, 0.12, 0.7, 0.04);
    poly(ctx, [[-0.5, 0.1], [-0.9, 0.0], [-0.84, 0.3], [-0.46, 0.28]], '#2f6fb5');   // 尾
    ell(ctx, -0.05, 0.14, 0.5, 0.36, '#3a8fe0');
    ell(ctx, 0.02, 0.22, 0.3, 0.18, '#cfe9ff');
    ell(ctx, -0.2, 0.08, 0.22, 0.16, '#2f6fb5');   // 羽
    circ(ctx, 0.4, -0.18, 0.26, '#3a8fe0');
    poly(ctx, [[0.62, -0.2], [0.86, -0.12], [0.62, -0.06]], '#ffb733');
    circ(ctx, 0.44, -0.24, 0.05, OUT);
  };
  pics.morning = function (ctx) {   // 朝（日の出）
    panel(ctx, '#ffe3b0'); clipPanel(ctx);
    rays(ctx, 0, 0.3, 0.45, 0.72, 9, 0.05, '#ffb733', Math.PI);
    ctx.beginPath(); ctx.arc(0, 0.3, 0.38, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#ff9f1c'; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#7bbf6a'; ctx.fillRect(-0.85, 0.3, 1.7, 0.5); line(ctx, -0.85, 0.3, 0.85, 0.3, 0.05);
    ctx.restore(); panel(ctx, null);
  };
  pics.noon = function (ctx) {   // 昼（空の高い太陽）
    panel(ctx, '#8fd0f5'); clipPanel(ctx);
    rays(ctx, 0, -0.1, 0.32, 0.5, 10, 0.06, '#ffd23f', 0.15);
    circ(ctx, 0, -0.1, 0.27, '#ffd23f');
    circ(ctx, -0.5, 0.35, 0.14, '#fff'); circ(ctx, -0.3, 0.32, 0.17, '#fff'); circ(ctx, -0.12, 0.38, 0.12, '#fff'); rr(ctx, -0.62, 0.38, 0.62, 0.14, 0.07, '#fff');
    ctx.restore(); panel(ctx, null);
  };
  pics.night = function (ctx) {   // 夜（月と星）
    panel(ctx, '#2b3a67'); clipPanel(ctx);
    ctx.beginPath(); ctx.arc(-0.1, -0.05, 0.42, 0, Math.PI * 2); ctx.fillStyle = '#ffe680'; ctx.fill();
    ctx.beginPath(); ctx.arc(0.06, -0.14, 0.36, 0, Math.PI * 2); ctx.fillStyle = '#2b3a67'; ctx.fill();
    [[0.45, -0.4, 0.07], [0.55, 0.1, 0.05], [-0.55, -0.45, 0.05], [0.25, 0.4, 0.06], [-0.5, 0.35, 0.05]].forEach(function (st) { starShape(ctx, st[0], st[1], st[2], '#fff2a0'); });
    ctx.restore(); panel(ctx, null);
  };
  function starShape(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = LW * 0.7; ctx.strokeStyle = OUT; ctx.stroke();
  }
  pics.cloud = function (ctx, t) {   // 雲（大きなふわふわの雲）
    var d = Math.sin((t || 0) * 0.8) * 0.03;
    panel(ctx, '#6fb8ea');
    circ(ctx, -0.38 + d, 0.08, 0.28, '#fff'); circ(ctx, 0.4 + d, 0.1, 0.26, '#fff'); circ(ctx, -0.06 + d, -0.16, 0.4, '#fff'); circ(ctx, 0.22 + d, -0.02, 0.3, '#fff');
    rr(ctx, -0.64 + d, 0.06, 1.3, 0.34, 0.16, '#fff');
  };
  pics.snow = function (ctx) {   // 雪（雪の結晶）
    panel(ctx, '#bfe0f7');
    for (var i = 0; i < 3; i++) { var a = i * Math.PI / 3, c = Math.cos(a) * 0.6, s2 = Math.sin(a) * 0.6; line(ctx, -c, -s2, c, s2, 0.1, OUT); }
    for (i = 0; i < 3; i++) { a = i * Math.PI / 3; c = Math.cos(a) * 0.6; s2 = Math.sin(a) * 0.6; line(ctx, -c, -s2, c, s2, 0.055, '#fff'); }
    for (i = 0; i < 6; i++) {
      a = i * Math.PI / 3;
      [0.32, 0.46].forEach(function (rr0) { var bx = Math.cos(a) * rr0, by = Math.sin(a) * rr0, k = 0.12; line(ctx, bx, by, bx + Math.cos(a + 0.9) * k, by + Math.sin(a + 0.9) * k, 0.045, '#fff'); line(ctx, bx, by, bx + Math.cos(a - 0.9) * k, by + Math.sin(a - 0.9) * k, 0.045, '#fff'); });
    }
    circ(ctx, 0, 0, 0.07, '#fff');
  };
  pics.wind = function (ctx, t) {   // 風（ふく風と、とんでいく葉）
    var d = Math.sin((t || 0) * 3) * 0.03;
    panel(ctx, '#e6f6ff');
    function sw(y, len, col) {
      ctx.beginPath(); ctx.moveTo(-0.7, y); ctx.lineTo(len, y); ctx.arc(len, y - 0.12, 0.12, Math.PI / 2, -Math.PI * 0.9, true);
      ctx.lineCap = 'round'; ctx.lineWidth = 0.07; ctx.strokeStyle = col; ctx.stroke();
    }
    sw(-0.28 + d, 0.2, '#6bb6e8'); sw(0.0 - d, 0.46, '#6bb6e8'); sw(0.3 + d, 0.1, '#6bb6e8');
    ctx.save(); ctx.translate(0.55, -0.4 + d); ctx.rotate(0.6);
    ell(ctx, 0, 0, 0.14, 0.08, '#55b155'); line(ctx, -0.14, 0, 0.14, 0, 0.025, '#2f6f2f');
    ctx.restore();
  };
  pics.star = function (ctx, t) {   // 星
    panel(ctx, '#2b3a67');
    starShape(ctx, 0, 0.03, 0.55 + Math.sin((t || 0) * 3) * 0.02, '#ffd23f');
    starShape(ctx, -0.55, -0.4, 0.09, '#fff2a0'); starShape(ctx, 0.58, -0.32, 0.07, '#fff2a0'); starShape(ctx, 0.5, 0.45, 0.08, '#fff2a0');
  };
  pics.spring = function (ctx) {   // 春（桜）
    panel(ctx, '#e8f6ff');
    line(ctx, -0.7, 0.6, -0.1, 0.1, 0.1); line(ctx, -0.7, 0.6, -0.1, 0.1, 0.06, '#8d5a34'); line(ctx, -0.1, 0.1, 0.5, -0.1, 0.07); line(ctx, -0.1, 0.1, 0.5, -0.1, 0.04, '#8d5a34');
    function bl(x, y, r) { for (var i = 0; i < 5; i++) { var a = i * Math.PI * 2 / 5 - Math.PI / 2; circ(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.45, '#ffc1d6'); } circ(ctx, x, y, r * 0.3, '#ffe680'); }
    bl(-0.15, -0.2, 0.3); bl(0.36, -0.36, 0.26); bl(0.5, 0.2, 0.24); bl(-0.5, 0.05, 0.2);
  };
  pics.summer = function (ctx) {   // 夏（すいか）
    panel(ctx, '#bfe6fb');
    ctx.beginPath(); ctx.arc(0, -0.15, 0.62, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#3f9b3f'; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -0.15, 0.52, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#fafafa'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, -0.15, 0.46, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#e5384f'; ctx.fill();
    [[-0.25, 0.1], [0.0, 0.22], [0.25, 0.1], [-0.12, 0.34], [0.14, 0.36]].forEach(function (sd) { ell(ctx, sd[0], sd[1], 0.04, 0.07, OUT); });
    line(ctx, -0.62, -0.15, 0.62, -0.15, 0.04);
    circ(ctx, 0.55, -0.45, 0.13, '#ffd23f');
  };
  pics.autumn = function (ctx) {   // 秋（もみじ）
    panel(ctx, '#fff1d6');
    ctx.save(); ctx.translate(0, 0.02); ctx.rotate(0.15);
    ctx.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 0.26 : 0.62; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    ctx.closePath(); ctx.fillStyle = '#e8501f'; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
    for (i = 0; i < 5; i++) { a = -Math.PI / 2 + i * Math.PI * 2 / 5; line(ctx, 0, 0, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.03, '#a8350f'); }
    line(ctx, 0, 0.2, 0.02, 0.82, 0.07);
    line(ctx, 0, 0.2, 0.02, 0.82, 0.04, '#8d5a34');
    ctx.restore();
  };
  pics.winter = function (ctx) {   // 冬（雪だるま）
    panel(ctx, '#bfe0f7');
    ctx.fillStyle = '#fafafa'; ctx.fillRect(-0.8, 0.5, 1.6, 0.15);
    circ(ctx, 0, 0.3, 0.34, '#fafafa'); circ(ctx, 0, -0.22, 0.25, '#fafafa');
    rr(ctx, -0.17, -0.72, 0.34, 0.26, 0.05, '#3a7bd5'); rr(ctx, -0.27, -0.5, 0.54, 0.07, 0.03, '#3a7bd5');
    circ(ctx, -0.09, -0.26, 0.03, OUT); circ(ctx, 0.09, -0.26, 0.03, OUT);
    poly(ctx, [[0, -0.2], [0.26, -0.15], [0, -0.1]], '#ff9f1c');
    line(ctx, -0.22, -0.0, 0.22, -0.0, 0.1); line(ctx, -0.22, 0.0, 0.22, 0.0, 0.06, '#e53935');
    circ(ctx, 0, 0.22, 0.03, OUT); circ(ctx, 0, 0.4, 0.03, OUT);
    line(ctx, -0.32, 0.2, -0.62, 0.0, 0.04); line(ctx, 0.32, 0.2, 0.62, 0.0, 0.04);
  };

  // E4（いろ）: 色を変えられる車（バスの形）。col = 車体の色。向きは bus と同じ（前が左）
  function colorCar(ctx, col) {
    rr(ctx, -0.82, -0.46, 1.64, 0.84, 0.14, col);
    ctx.fillStyle = '#fafafa'; ctx.fillRect(-0.78, 0.08, 1.56, 0.08); rr(ctx, -0.82, -0.46, 1.64, 0.84, 0.14, null);
    rr(ctx, -0.76, -0.38, 0.2, 0.4, 0.04, '#bfe6fb');
    rr(ctx, -0.48, -0.38, 0.2, 0.7, 0.03, '#bfe6fb'); line(ctx, -0.38, -0.38, -0.38, 0.32, 0.03);
    for (var i = 0; i < 4; i++) win(ctx, -0.16 + i * 0.24, -0.38, 0.19, 0.3);
    headlamp(ctx, -0.79, 0.26);
    wheel(ctx, -0.5, 0.4, 0.17); wheel(ctx, 0.5, 0.4, 0.17);
  }
  function drawColorCar(ctx, x, y, size, col) {
    var s = size / 1.8;
    ctx.save(); ctx.translate(x - 0.05 * s, y + 0.14 * s); ctx.scale(s, s); ctx.lineJoin = 'round';
    colorCar(ctx, col);
    ctx.restore();
  }

  var DIRECTIONAL = { airplane: 1, train: 1, shinkansen: 1, ship: 1, steam: 1, postcar: 1, taxi: 1, motorbike: 1, crane: 1,
    truck: 1, patrol: 1, heli: 1, bus: 1, roller: 1 };
  // 絵の id 一覧（出題に使える絵）
  var PICS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'hose', 'flame'].concat(Object.keys(pics));
  function hasPic(id) { return typeof id === 'string' && PICS.indexOf(id) >= 0; }

  // ---- 公開 API ----
  // 絵そのものの「前（運転席・先頭）」の向き。1=右、-1=左。ねこぐるま(1)・フォークリフト(2)・しょべるかー(4)は右向きに描いてある。
  // 新しい乗り物は左向き(-1)に描く（FRONT に載せなければ -1 とみなす）。
  var FRONT = { 1: 1, 2: 1, 4: 1 };
  function frontOf(stage) { return FRONT[stage] === 1 ? 1 : -1; }   // 新しい絵（pics）は全部左向き＝既定の -1
  // 乗り物 stage(1..11) を、中心 (x, y)・おおよそ size px 四方に収めて描く。
  // facing: 前を向ける向き。1(既定)=右、-1=左。絵の前の向きと違うときだけ左右反転する。
  //   反転は絵の中だけ（呼び出し側の座標・文字は反転しない）。車体に文字を描くときは反転の外で描くこと。
  function drawVehicle(ctx, stage, x, y, size, facing, t) {
    var fn = typeof stage === 'string' ? pics[stage] : draw[stage];
    var s = size / 1.8, f = facing === -1 ? -1 : 1, flip = frontOf(stage) !== f;
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.translate(-0.05 * s, 0.14 * s);
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    fn(ctx, t);
    ctx.restore();
  }
  // 絵の種類('v1'..'v11' / 'hose' / 'flame' / 新しい絵の id)から描く
  function drawPic(ctx, pic, x, y, size, t, facing) {
    if (pic.charAt(0) === 'v') return drawVehicle(ctx, +pic.slice(1), x, y, size, facing);
    if (DIRECTIONAL[pic]) return drawVehicle(ctx, pic, x, y, size, facing, t);
    ctx.save();
    ctx.translate(x, y); ctx.scale(size / 1.8, size / 1.8);
    ctx.lineJoin = 'round';
    if (pics[pic]) pics[pic](ctx, t);
    else if (pic === 'hose') drawHose(ctx); else drawFlame(ctx, t);
    ctx.restore();
  }
  // 未入手の黒いシルエット
  var tmp = null;
  function drawSilhouette(ctx, stage, x, y, size, color, facing) {
    if (typeof document === 'undefined') return;
    if (!tmp) tmp = document.createElement('canvas');
    var w = Math.ceil(size * 1.3);
    var dpr = ctx.getTransform ? Math.max(1, ctx.getTransform().a) : 1;
    tmp.width = Math.ceil(w * dpr); tmp.height = Math.ceil(w * dpr);
    var c = tmp.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, w);
    drawVehicle(c, stage, w / 2, w / 2, size, facing);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color || '#3b3f4a';
    c.fillRect(0, 0, w, w);
    c.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x - w / 2, y - w / 2, w, w);
  }

  var api = {
    draw: draw, pics: pics, PICS: PICS, hasPic: hasPic, drawVehicle: drawVehicle, frontOf: frontOf, drawPic: drawPic, drawColorCar: drawColorCar, drawSilhouette: drawSilhouette,
    drawFlame: drawFlame, drawHose: drawHose, star: star, rr: rr, circ: circ, poly: poly, line: line,
    OUT: OUT
  };
  root.Manabi = root.Manabi || {};
  root.Manabi.vehicles = api;
})(typeof window !== 'undefined' ? window : globalThis);
