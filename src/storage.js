// localStorage の読み書き（キー hataraku-manabi:v1）。使えない環境ではメモリだけで動く。
// ブラウザでは window.Manabi.storage、Node では module.exports（normalize はテスト対象）。
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.Manabi.data;
  var KEY = 'hataraku-manabi:v1';
  var MATH_LV = ['M1', 'M2', 'M3', 'M4', 'M5'], LETTER_LV = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'], CLOCK_LV = ['T1', 'T2', 'T3'];
  var CAR_IDS = ['nekoguruma', 'forklift', 'gomi', 'shovel', 'bulldozer', 'dump', 'kyukyu', 'shoubousha', 'mizutank', 'hashigo', 'chodai'];

  function defaults() {
    return {
      version: 1,
      sound: { sfx: true, voice: true },
      levels: { math: 'M1', letter: 'K1', clock: 'T1' },
      locked: { math: false, letter: false, clock: false },
      cards: {},
      stats: {
        sessions: 0,
        math: { sessions: 0, questions: 0, firstTry: 0 },
        letter: { sessions: 0, questions: 0, firstTry: 0 },
        clock: { sessions: 0, questions: 0, firstTry: 0 }
      },
      seen: { letter: [] },
      lastPlayed: ''
    };
  }
  function num(v) { return (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : 0; }
  function bool(v, d) { return typeof v === 'boolean' ? v : d; }

  // 壊れたデータ・欠損があってもデフォルトで埋めて返す
  function normalize(raw) {
    var d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    var s = raw.sound || {}, l = raw.levels || {}, k = raw.locked || {}, st = raw.stats || {};
    d.sound.sfx = bool(s.sfx, true); d.sound.voice = bool(s.voice, true);
    d.levels.math = MATH_LV.indexOf(l.math) >= 0 ? l.math : 'M1';
    d.levels.letter = LETTER_LV.indexOf(l.letter) >= 0 ? l.letter : 'K1';
    d.levels.clock = CLOCK_LV.indexOf(l.clock) >= 0 ? l.clock : 'T1';
    d.locked.clock = bool(k.clock, false);
    d.locked.math = bool(k.math, false); d.locked.letter = bool(k.letter, false);
    var c = raw.cards || {};
    CAR_IDS.forEach(function (id) { var n = Math.min(3, num(c[id])); if (n > 0) d.cards[id] = n; });
    d.stats.sessions = num(st.sessions);
    ['math', 'letter', 'clock'].forEach(function (g) {
      var x = st[g] || {};
      d.stats[g] = { sessions: num(x.sessions), questions: num(x.questions), firstTry: num(x.firstTry) };
    });
    d.seen.letter = D.cleanSeen(raw.seen && raw.seen.letter);
    d.lastPlayed = typeof raw.lastPlayed === 'string' ? raw.lastPlayed.slice(0, 10) : '';
    return d;
  }

  var persistent = true;
  function store() { try { return root.localStorage || null; } catch (e) { return null; } }
  function load() {
    var raw = null;
    try {
      var ls = store();
      if (!ls) throw new Error('no storage');
      var t = ls.getItem(KEY);
      raw = t ? JSON.parse(t) : null;
    } catch (e) { if (!store()) persistent = false; raw = null; }
    return normalize(raw);
  }
  function save(data) {
    try {
      var ls = store();
      if (!ls) throw new Error('no storage');
      ls.setItem(KEY, JSON.stringify(data));
      persistent = true;
    } catch (e) { persistent = false; }
  }
  function clear() { try { var ls = store(); if (ls) ls.removeItem(KEY); } catch (e) {} }
  function isPersistent() { return persistent; }

  var api = { KEY: KEY, defaults: defaults, normalize: normalize, load: load, save: save, clear: clear, isPersistent: isPersistent };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.storage = api; }
})(typeof window !== 'undefined' ? window : globalThis);
