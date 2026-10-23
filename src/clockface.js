// アナログ時計の Canvas 描画（外部画像なし）。角度は problems.handAngles を使う。
// 短針は太く短く青、長針は細く長く赤。小さい時計でも針の違いが分かるよう、太さの下限を持つ。
(function (root) {
  'use strict';
  var OUT = '#3a2b24', HOUR_COL = '#1e5bd8', MIN_COL = '#e53935';

  // key: 'h:mm' または 'swap:N'。opts: { numbers: 12|4, pulse: 0..1（短針をふくらませる量）, pulseMin: 0..1（長針をふくらませる量）, ticks: 12|60（60 で分の目盛り）,
  //        minuteNums: true（外周に 5,10,…,55 の小さい数字。大きい時計だけ）, face: 文字盤の色 }
  function drawClock(ctx, cx, cy, r, key, opts) {
    opts = opts || {};
    var ang = root.Manabi.problems.handAngles(key);
    var nums = opts.numbers === 4 ? 4 : 12;
    var pulse = opts.pulse || 0, pulseMin = opts.pulseMin || 0, t60 = opts.ticks === 60, mnum = !!opts.minuteNums;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // ふち・文字盤
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#d9d2c3'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, 0, Math.PI * 2);
    ctx.fillStyle = opts.face || '#fffdf5'; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.05); ctx.strokeStyle = OUT; ctx.stroke();
    // 分の目盛り（60 か所。5 分ごとは下の 12 か所の目盛りで太く描く）。小さい時計でも潰れないよう細い短線にする
    if (t60) {
      for (var j = 0; j < 60; j++) {
        if (j % 5 === 0) continue;
        var aj = j * Math.PI / 30, q1 = r * 0.855, q2 = r * 0.89;
        ctx.beginPath();
        ctx.moveTo(cx + Math.sin(aj) * q1, cy - Math.cos(aj) * q1); ctx.lineTo(cx + Math.sin(aj) * q2, cy - Math.cos(aj) * q2);
        ctx.lineWidth = Math.max(1, r * 0.022); ctx.strokeStyle = OUT; ctx.stroke();
      }
    }
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
    hand(ang.minute, 0.8 * (1 + 0.06 * pulseMin), Math.max(2.5, r * 0.07) * (1 + 0.8 * pulseMin), MIN_COL);
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
    // 外周の分の数字（5,10,…,55）。大きな現場の時計だけ。12,3,6,9 の位置は時の数字とかぶらない外側に置く
    if (mnum) {
      ctx.font = 'bold ' + Math.max(10, Math.round(r * 0.085)) + 'px sans-serif';
      ctx.lineWidth = Math.max(2, r * 0.03);
      for (var mm = 5; mm < 60; mm += 5) {
        var am = mm * Math.PI / 30, rm = r * 0.975;
        var mx = cx + Math.sin(am) * rm, my = cy - Math.cos(am) * rm;
        ctx.strokeText(String(mm), mx, my); ctx.fillText(String(mm), mx, my);
      }
    }
    ctx.restore();
  }

  root.Manabi = root.Manabi || {};
  root.Manabi.clockface = { drawClock: drawClock };
})(typeof window !== 'undefined' ? window : globalThis);
