// 日ごとの学習実績「まいにちの きろく」（docs/design-daily-log.md）。純粋関数のみ（入力は書き換えず、新しい表を返す）。
// 依存: data.js（LEVELS・ALL_VEHICLES）・strokes.js（SETS）
// ブラウザでは window.Manabi.daylog、Node では module.exports。
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var D = node ? require('./data.js') : root.Manabi.data;
  var ST = node ? require('./strokes.js') : root.Manabi.strokes;

  var KEEP_DAYS = 35, MAX_KEYS = 40, SEC_CAP = 600;
  var GAMES = ['math', 'letter', 'clock', 'english', 'trace', 'solo'];
  var KID_GAMES = ['math', 'letter', 'clock', 'english', 'trace'];
  var Q_GAMES = ['math', 'letter', 'clock', 'english'];   // 問題のあるゲーム（sessions・questions・firstTry）
  var C_GAMES = ['trace', 'solo'];                         // 字のあるゲーム（sessions・chars）
  var LICENSES = ['hira', 'kata', 'k1', 'k2'];
  var CAP = { sessions: 999, questions: 9999, chars: 9999, cards: 999, sec: 86400 };
  var WROTE_MAX = 130, CARS_MAX = 47;

  // 書ける字の全部（strokes.js の SETS）
  var TRACE_CHARS = Object.create(null);
  Object.keys(ST.SETS).forEach(function (k) { Array.from(ST.SETS[k]).forEach(function (c) { TRACE_CHARS[c] = true; }); });
  var CAR_SET = Object.create(null);
  D.ALL_VEHICLES.forEach(function (v) { CAR_SET[v.id] = true; });

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function num(v, cap) { return (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.min(cap, Math.floor(v)) : 0; }

  // ---- 日付（端末の日付 YYYY-MM-DD。Date.UTC で数えるので時差・夏時間に影響されない） ----
  var KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  function pad2(n) { return ('0' + n).slice(-2); }
  function fromUtc(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function toUtc(key) { return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)); }
  function isDayKey(s) {
    if (typeof s !== 'string' || !KEY_RE.test(s)) return false;
    return fromUtc(toUtc(s)) === s;   // 2026-02-30 は 2026-03-02 になるので落ちる
  }
  function addDays(key, n) { return fromUtc(toUtc(key) + n * 86400000); }
  // 0 = 日曜 … 6 = 土曜
  function dayOfWeek(key) { return new Date(toUtc(key)).getUTCDay(); }
  // 月曜はじまりの週の月曜
  function weekStart(key) { return addDays(key, -((dayOfWeek(key) + 6) % 7)); }
  function weekKeys(start) { var out = []; for (var i = 0; i < 7; i++) out.push(addDays(start, i)); return out; }

  // ---- 1 日の補正 ----
  function uniqStr(s, ok, max) {   // 文字列を 1 字ずつ見て、ok の字だけ・重なりなしで max 字まで
    var out = [], seen = Object.create(null);
    if (typeof s === 'string') Array.from(s).forEach(function (c) {
      if (out.length < max && ok(c) && !seen[c]) { seen[c] = true; out.push(c); }
    });
    return out.join('');
  }
  function uniqList(a, ok, max) {
    var out = [], seen = Object.create(null);
    if (Array.isArray(a)) a.forEach(function (x) {
      if (out.length < max && typeof x === 'string' && ok(x) && !seen[x]) { seen[x] = true; out.push(x); }
    });
    return out;
  }
  function inSet(set) { return function (c) { return set[c] === true; }; }
  var isTraceChar = inSet(TRACE_CHARS), isCar = inSet(CAR_SET);
  function isLicense(x) { return LICENSES.indexOf(x) >= 0; }

  // 1 日分の補正。何も残らなければ null
  function normalizeDay(raw) {
    if (!isObj(raw)) return null;
    var out = {}, any = false;
    Q_GAMES.forEach(function (g) {
      var x = has(raw, g) && isObj(raw[g]) ? raw[g] : null;
      if (!x) return;
      var s = num(x.sessions, CAP.sessions), q = num(x.questions, CAP.questions), f = Math.min(num(x.firstTry, CAP.questions), q);
      if (s || q || f) { out[g] = { sessions: s, questions: q, firstTry: f }; any = true; }
    });
    C_GAMES.forEach(function (g) {
      var x = has(raw, g) && isObj(raw[g]) ? raw[g] : null;
      if (!x) return;
      var s = num(x.sessions, CAP.sessions), c = num(x.chars, CAP.chars);
      if (s || c) { out[g] = { sessions: s, chars: c }; any = true; }
    });
    if (has(raw, 'up') && isObj(raw.up)) {
      var up = {}, nu = 0;
      Q_GAMES.forEach(function (g) {
        if (has(raw.up, g) && D.LEVELS[g].indexOf(raw.up[g]) >= 0) { up[g] = raw.up[g]; nu++; }
      });
      if (nu) { out.up = up; any = true; }
    }
    var wrote = uniqStr(raw.wrote, isTraceChar, WROTE_MAX);
    if (wrote) {
      var inWrote = function (c) { return wrote.indexOf(c) >= 0; };
      out.wrote = wrote; any = true;
      var nc = uniqStr(raw.newChars, inWrote, WROTE_MAX), ns = uniqStr(raw.newSolo, inWrote, WROTE_MAX);
      if (nc) out.newChars = nc;
      if (ns) out.newSolo = ns;
    }
    var lic = uniqList(raw.license, isLicense, 4);
    if (lic.length) { out.license = lic; any = true; }
    var cards = num(raw.cards, CAP.cards);
    if (cards) { out.cards = cards; any = true; }
    var cars = uniqList(raw.newCars, isCar, CARS_MAX);
    if (cars.length) { out.newCars = cars; any = true; }
    var sec = num(raw.sec, CAP.sec);
    if (sec) { out.sec = sec; any = true; }
    if (!any) return null;
    out.last = (typeof raw.last === 'string' && GAMES.indexOf(raw.last) >= 0) ? raw.last : '';
    return out;
  }

  // 保存の読み込みの補正（今日を使わない）。使える日・項目だけ残す。新しい順に 40 件まで
  function normalizeDays(raw) {
    var out = {};
    if (!isObj(raw)) return out;
    var keys = Object.keys(raw).filter(isDayKey).sort().reverse().slice(0, MAX_KEYS);
    keys.forEach(function (k) {
      var d = normalizeDay(raw[k]);
      if (d) out[k] = d;
    });
    return out;
  }

  // 記録するときの剪定（今日を含めて 35 日。今日より 2 日以上先は消す）
  function prune(days, today) {
    var out = {};
    if (!isObj(days)) return out;
    var lo = addDays(today, -(KEEP_DAYS - 1)), hi = addDays(today, 1);
    Object.keys(days).forEach(function (k) { if (k >= lo && k <= hi) out[k] = days[k]; });
    return out;
  }

  // ---- 記録（どれも新しい days を返す） ----
  function copyDays(days) { return normalizeDays(JSON.parse(JSON.stringify(isObj(days) ? days : {}))); }
  function finish(next, today, key, day) {
    var d = normalizeDay(day);
    if (d) next[key] = d; else delete next[key];
    return prune(next, today);
  }
  function dayOf(next, key) { return has(next, key) ? JSON.parse(JSON.stringify(next[key])) : {}; }
  function addToStr(s, c) { return (typeof s === 'string' && s.indexOf(c) >= 0) ? s : (s || '') + c; }
  function levelIdx(g, lv) { return D.LEVELS[g].indexOf(lv); }

  // ev = { game, questions, firstTry, up, reward, license }
  function recordSession(days, today, ev) {
    var next = copyDays(days);
    if (!isDayKey(today) || !isObj(ev) || GAMES.indexOf(ev.game) < 0) return next;
    var d = dayOf(next, today), g = ev.game;
    var x = isObj(d[g]) ? d[g] : (Q_GAMES.indexOf(g) >= 0 ? { sessions: 0, questions: 0, firstTry: 0 } : { sessions: 0, chars: 0 });
    x.sessions = num(x.sessions, CAP.sessions) + 1;
    if (Q_GAMES.indexOf(g) >= 0) {
      x.questions = num(x.questions, CAP.questions) + num(ev.questions, CAP.questions);
      x.firstTry = num(x.firstTry, CAP.questions) + num(ev.firstTry, CAP.questions);
    }
    d[g] = x;
    if (Q_GAMES.indexOf(g) >= 0 && typeof ev.up === 'string' && levelIdx(g, ev.up) >= 0) {
      d.up = isObj(d.up) ? d.up : {};
      if (!has(d.up, g) || levelIdx(g, ev.up) > levelIdx(g, d.up[g])) d.up[g] = ev.up;   // 上のレベルだけ残す（下がったことは記録しない）
    }
    if (isObj(ev.reward)) {
      d.cards = num(d.cards, CAP.cards) + 1;
      if (ev.reward.isNew === true && typeof ev.reward.id === 'string' && isCar(ev.reward.id)) {
        d.newCars = Array.isArray(d.newCars) ? d.newCars : [];
        if (d.newCars.indexOf(ev.reward.id) < 0) d.newCars.push(ev.reward.id);
      }
    }
    if (typeof ev.license === 'string' && isLicense(ev.license)) {
      d.license = Array.isArray(d.license) ? d.license : [];
      if (d.license.indexOf(ev.license) < 0) d.license.push(ev.license);
    }
    d.last = g;
    return finish(next, today, today, d);
  }

  // ev = { game('trace'|'solo'), ch, firstDone, firstSolo }
  function recordChar(days, today, ev) {
    var next = copyDays(days);
    if (!isDayKey(today) || !isObj(ev) || C_GAMES.indexOf(ev.game) < 0 || typeof ev.ch !== 'string' || !isTraceChar(ev.ch)) return next;
    var d = dayOf(next, today), g = ev.game;
    var x = isObj(d[g]) ? d[g] : { sessions: 0, chars: 0 };
    x.chars = num(x.chars, CAP.chars) + 1;
    d[g] = x;
    d.wrote = addToStr(uniqStr(d.wrote, isTraceChar, WROTE_MAX), ev.ch);
    if (ev.firstDone === true) d.newChars = addToStr(d.newChars, ev.ch);
    if (ev.firstSolo === true) d.newSolo = addToStr(d.newSolo, ev.ch);
    return finish(next, today, today, d);
  }

  // 出動の画面にいた秒を足す（1 回 SEC_CAP 秒まで。負・数でないは 0）
  function addTime(days, today, sec) {
    var next = copyDays(days);
    if (!isDayKey(today)) return next;
    var s = (typeof sec === 'number' && isFinite(sec) && sec > 0) ? Math.round(Math.min(sec, SEC_CAP)) : 0;
    if (!s) return prune(next, today);
    var d = dayOf(next, today);
    d.sec = num(d.sec, CAP.sec) + s;
    return finish(next, today, today, d);
  }

  var api = {
    KEEP_DAYS: KEEP_DAYS, MAX_KEYS: MAX_KEYS, SEC_CAP: SEC_CAP, GAMES: GAMES, KID_GAMES: KID_GAMES, CAP: CAP, LICENSES: LICENSES,
    isDayKey: isDayKey, addDays: addDays, dayOfWeek: dayOfWeek, weekStart: weekStart, weekKeys: weekKeys,
    normalizeDay: normalizeDay, normalizeDays: normalizeDays, prune: prune,
    recordSession: recordSession, recordChar: recordChar, addTime: addTime
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.daylog = api; }
})(typeof window !== 'undefined' ? window : globalThis);
