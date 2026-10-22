// Web Audio の効果音（外部ファイルなし）。hataraku-drop の src/audio.js の部品(tone/noise/wail/bell/fanfare)を参考にした。
// 最初のユーザー操作の前には鳴らさない（unlock() が呼ばれるまで ctx を作らない）。
(function (root) {
  'use strict';
  var ctx = null, enabled = true, bus = null, noiseBuf = null;

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state !== 'running') {
      try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    return ctx;
  }
  function unlock() { ensure(); }
  function setEnabled(v) { enabled = !!v; }
  function isEnabled() { return enabled; }

  function getBus(c) {
    if (bus && bus.ctx === c) return bus.input;
    var master = c.createGain();
    master.gain.value = 0.55;
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 20; comp.ratio.value = 8;
    comp.attack.value = 0.003; comp.release.value = 0.15;
    master.connect(comp); comp.connect(c.destination);
    bus = { ctx: c, input: master };
    noiseBuf = null;
    return master;
  }
  function envGain(c, out, t0, dur, peak, atk) {
    var g = c.createGain();
    atk = atk || 0.01;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.setValueAtTime(peak, Math.max(t0 + atk, t0 + dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(out);
    return g;
  }
  // freqs: [[時刻オフセット, 周波数], ...]。opt.decay なら鐘のように減衰
  function tone(c, out, type, t0, dur, peak, freqs, opt) {
    opt = opt || {};
    var o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freqs[0][1], t0 + freqs[0][0]);
    for (var i = 1; i < freqs.length; i++) o.frequency.linearRampToValueAtTime(freqs[i][1], t0 + freqs[i][0]);
    var dest;
    if (opt.decay) {
      dest = c.createGain();
      dest.gain.setValueAtTime(peak, t0);
      dest.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      dest.connect(out);
    } else dest = envGain(c, out, t0, dur, peak, opt.atk);
    var node = o;
    if (opt.lp) {
      var f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = opt.lp;
      o.connect(f); node = f;
    }
    node.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.03);
    return o;
  }
  function noise(c, out, t0, dur, peak, ftype, f0, f1, q) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = c.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    var f = c.createBiquadFilter();
    f.type = ftype; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.linearRampToValueAtTime(f1, t0 + dur);
    src.connect(f); f.connect(envGain(c, out, t0, dur, peak, Math.min(0.03, dur / 3)));
    src.start(t0); src.stop(t0 + dur + 0.03);
  }
  function wail(c, out, type, t0, dur, peak, lo, hi, period, lp) {
    var pts = [[0, lo]], t = 0, up = true;
    while (t < dur) { t = Math.min(dur, t + period / 2); pts.push([t, up ? hi : lo]); up = !up; }
    return tone(c, out, type, t0, dur, peak, pts, { lp: lp, atk: 0.04 });
  }
  function bell(c, out, t0, f, peak) {
    tone(c, out, 'sine', t0, 0.16, peak, [[0, f]], { decay: true });
    tone(c, out, 'sine', t0, 0.1, peak * 0.5, [[0, f * 2.76]], { decay: true });
  }

  var NOTE = [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319, 1568];   // ド〜: 数を数える「ぽん」の音程
  var SOUNDS = {
    tap: function (c, o, t) { tone(c, o, 'sine', t, 0.09, 0.2, [[0, 700], [0.09, 900]]); },
    pon: function (c, o, t, i) { var f = NOTE[Math.max(0, Math.min(NOTE.length - 1, (i | 0) - 1))]; tone(c, o, 'sine', t, 0.22, 0.28, [[0, f]], { decay: true }); },
    // 正解: ピンポン（上昇）
    correct: function (c, o, t) { bell(c, o, t, 880, 0.25); bell(c, o, t + 0.14, 1175, 0.25); bell(c, o, t + 0.28, 1568, 0.22); },
    // おしい: やさしい低め 2 音
    oshii: function (c, o, t) { tone(c, o, 'sine', t, 0.2, 0.22, [[0, 392]], { decay: true }); tone(c, o, 'sine', t + 0.18, 0.28, 0.22, [[0, 330]], { decay: true }); },
    // サイレン（ウー）
    siren: function (c, o, t) { wail(c, o, 'triangle', t, 1.4, 0.13, 620, 900, 0.7, 1800); },
    // 放水（シュー）
    water: function (c, o, t) {
      noise(c, o, t, 0.9, 0.22, 'bandpass', 3500, 1800, 0.8);
      noise(c, o, t, 0.9, 0.1, 'highpass', 6000, 6000, 0.5);
    },
    // はしごが伸びる / がれきを片づける
    ladder: function (c, o, t) { for (var i = 0; i < 8; i++) noise(c, o, t + i * 0.09, 0.03, 0.2, 'bandpass', 2500, 2500, 3); },
    dig: function (c, o, t) {
      noise(c, o, t, 0.45, 0.25, 'highpass', 2500, 5000, 0.7);
      tone(c, o, 'triangle', t, 0.2, 0.3, [[0, 110], [0.2, 65]]);
    },
    horn: function (c, o, t) { [349, 440].forEach(function (f) { tone(c, o, 'square', t, 0.3, 0.07, [[0, f]], { lp: 1500 }); }); },
    card: function (c, o, t) { noise(c, o, t, 0.18, 0.2, 'bandpass', 1500, 4000, 2); tone(c, o, 'sine', t + 0.15, 0.3, 0.2, [[0, 1000], [0.3, 1700]], { decay: true }); },
    fanfare: function (c, o, t) {
      [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(c, o, 'square', t + i * 0.14, i === 5 ? 0.5 : 0.2, 0.08, [[0, f]], { lp: 2200 }); });
      bell(c, o, t + 0.9, 2000, 0.1);
    },
    // ピーポー（きゅうきゅうしゃ）
    pipoo: function (c, o, t) { for (var i = 0; i < 4; i++) tone(c, o, 'triangle', t + i * 0.2, 0.2, 0.2, [[0, i % 2 ? 770 : 960]], { atk: 0.015 }); }
  };

  function play(name, arg) {
    if (!enabled) return;
    var c = ensure();
    if (!c || c.state !== 'running') return;
    var fn = SOUNDS[name];
    if (!fn) return;
    try { fn(c, getBus(c), c.currentTime + 0.01, arg); } catch (e) {}
  }

  root.Manabi = root.Manabi || {};
  root.Manabi.audio = { unlock: unlock, setEnabled: setEnabled, isEnabled: isEnabled, play: play, names: Object.keys(SOUNDS) };
})(typeof window !== 'undefined' ? window : globalThis);
