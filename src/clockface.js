// アナログ時計の Canvas 描画（外部画像なし）。角度は problems.handAngles を使う。
// 短針は太く短く青、長針は細く長く赤。小さい時計でも針の違いが分かるよう、太さの下限を持つ。
(function (root) {
  'use strict';
  var OUT = '#3a2b24', HOUR_COL = '#1e5bd8', MIN_COL = '#e53935';

  // key: 'h:mm' または 'swap:N'。opts: { numbers: 12|4, pulse: 0..1（短針をふくらませる量）, face: 文字盤の色 }
  function drawClock(ctx, cx, cy, r, key, opts) {
    opts = opts || {};
    var ang = root.Manabi.problems.handAngles(key);
    var nums = opts.numbers === 4 ? 4 : 12;
    var pulse = opts.pulse || 0;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // ふち・文字盤
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#d9d2c3'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, 0, Math.PI * 2);
    ctx.fillStyle = opts.face || '#fffdf5'; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.05); ctx.strokeStyle = OUT; ctx.stroke();
    // 目盛り（12 か所。3・6・9・12 は長く太く）
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6, big = i % 3 === 0;
      var r1 = r * (big ? 0.78 : 0.83), r2 = r * 0.88;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); ctx.lineTo(cx + Math.sin(a) * r2, cy - Math.cos(a) * r2);
      ctx.lineWidth = Math.max(1.5, r * (big ? 0.06 : 0.035)); ctx.strokeStyle = OUT; ctx.stroke();
    }
    // 針: 長針（細く長い・赤）を先に、短針（太く短い・青）を上に
    function hand(deg, len, w, col) {
      var a = deg * Math.PI / 180, x = cx + Math.sin(a) * r * len, y = cy - Math.cos(a) * r * len;
      var tx = cx - Math.sin(a) * r * 0.1, ty = cy + Math.cos(a) * r * 0.1;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y);
      ctx.lineWidth = w + Math.max(2, r * 0.05); ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y);
      ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
    }
    hand(ang.minute, 0.8, Math.max(2.5, r * 0.07), MIN_COL);
    var hs = 1 + 0.35 * pulse;
    hand(ang.hour, 0.4 * (1 + 0.12 * pulse), Math.max(5, r * 0.15) * hs, HOUR_COL);
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, r * 0.09), 0, Math.PI * 2);
    ctx.fillStyle = OUT; ctx.fill();
    // 数字（針の上に白いふちつきで描き、長針で隠れないようにする）
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, r * 0.06); ctx.strokeStyle = '#fff';
    ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(r * (nums === 4 ? 0.3 : 0.22)) + 'px sans-serif';
    for (var n = 1; n <= 12; n++) {
      if (nums === 4 && n % 3 !== 0) continue;
      var an = n * Math.PI / 6, rn = r * (nums === 4 ? 0.56 : 0.66);
      var nx = cx + Math.sin(an) * rn, ny = cy - Math.cos(an) * rn + r * 0.01;
      ctx.strokeText(String(n), nx, ny); ctx.fillText(String(n), nx, ny);
    }
    ctx.restore();
  }

  root.Manabi = root.Manabi || {};
  root.Manabi.clockface = { drawClock: drawClock };
})(typeof window !== 'undefined' ? window : globalThis);
