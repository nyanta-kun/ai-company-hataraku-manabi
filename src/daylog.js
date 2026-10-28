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

  // ---- 保護者画面の 1 週間（8.4） ----
  function sessionsOf(day, g) { return day && isObj(day[g]) ? num(day[g].sessions, CAP.sessions) : 0; }
  function unionStr(a, b) { var out = a; Array.from(b || '').forEach(function (c) { if (out.indexOf(c) < 0) out += c; }); return out; }
  // start = 月曜の鍵、today = 今日。profile は cleared・promoted（日付つき）を読む。days は表示に使う値（自分の端末＋ほかの端末）
  // → { start, end, rows: [{ key, kind: 'day'|'none'|'old'|'future', total, byGame, sec, day }], sum: { sessions, sec, playedDays, byGame }, got: {...}, any, hasPrev, hasNext }
  function weekSummary(days, start, today, profile) {
    days = isObj(days) ? days : {};
    profile = isObj(profile) ? profile : {};
    var keys = weekKeys(start), oldest = addDays(today, -(KEEP_DAYS - 1));
    var sum = { sessions: 0, sec: 0, playedDays: 0, byGame: {} };
    GAMES.forEach(function (g) { sum.byGame[g] = 0; });
    var got = { up: {}, gates: [], stages: [], newChars: '', newSolo: '', license: [], newCars: [] };
    var any = false;
    var rows = keys.map(function (k) {
      var day = has(days, k) ? days[k] : null, row = { key: k, kind: 'none', total: 0, byGame: {}, sec: 0, day: null };
      GAMES.forEach(function (g) { row.byGame[g] = 0; });
      if (k > today) { row.kind = 'future'; return row; }
      if (k < oldest) { row.kind = 'old'; return row; }
      if (!day) return row;
      row.kind = 'day'; row.day = day; row.sec = num(day.sec, CAP.sec);
      GAMES.forEach(function (g) { row.byGame[g] = sessionsOf(day, g); row.total += row.byGame[g]; sum.byGame[g] += row.byGame[g]; });
      sum.sessions += row.total; sum.sec += row.sec;
      if (row.total > 0) sum.playedDays++;
      any = true;
      if (isObj(day.up)) Q_GAMES.forEach(function (g) {
        if (has(day.up, g) && (!has(got.up, g) || levelIdx(g, day.up[g]) > levelIdx(g, got.up[g]))) got.up[g] = day.up[g];
      });
      got.newChars = unionStr(got.newChars, day.newChars); got.newSolo = unionStr(got.newSolo, day.newSolo);
      (day.license || []).forEach(function (x) { if (got.license.indexOf(x) < 0) got.license.push(x); });
      (day.newCars || []).forEach(function (x) { if (got.newCars.indexOf(x) < 0) got.newCars.push(x); });
      return row;
    });
    var inWeek = function (d) { return typeof d === 'string' && d >= start && d <= keys[6]; };
    if (isObj(profile.cleared)) Object.keys(profile.cleared).forEach(function (lv) {
      if (inWeek(profile.cleared[lv])) got.gates.push({ level: lv, date: profile.cleared[lv] });
    });
    if (isObj(profile.promoted)) Object.keys(profile.promoted).forEach(function (st) {
      if (inWeek(profile.promoted[st])) got.stages.push({ stage: st, date: profile.promoted[st] });
    });
    got.gates.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.level < b.level ? -1 : 1); });
    got.stages.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.stage < b.stage ? -1 : 1); });
    got.any = Object.keys(got.up).length > 0 || got.gates.length > 0 || got.stages.length > 0 || got.newChars !== '' || got.newSolo !== '' || got.license.length > 0 || got.newCars.length > 0;
    return {
      start: start, end: keys[6], rows: rows, sum: sum, got: got, any: any || got.gates.length > 0 || got.stages.length > 0,
      hasPrev: addDays(start, -1) >= oldest, hasNext: weekStart(today) > start
    };
  }

  // ---- 子ども向け「きょうの しゅつどう」（9.3。決定的。数字は画面に出さない） ----
  function kidSessions(day, g) { return g === 'trace' ? sessionsOf(day, 'trace') + sessionsOf(day, 'solo') : sessionsOf(day, g); }
  function kidPlayed(day, g) {
    if (!day) return false;
    if (g !== 'trace') return sessionsOf(day, g) >= 1;
    return kidSessions(day, 'trace') >= 1 || (typeof day.wrote === 'string' && day.wrote !== '');   // 書いた字があれば、終えていなくても遊んだ
  }
  // 「できるようになったこと」の数（王冠の 2 番目の決め手。昇格は関門と重なるので数えない）
  function kidGains(day, g, today, cleared) {
    if (!day) return 0;
    var n = 0;
    if (g === 'trace') return Array.from(day.newChars || '').length + Array.from(day.newSolo || '').length + (day.license || []).length;
    if (isObj(day.up) && has(day.up, g)) n++;
    if (isObj(cleared)) Object.keys(cleared).forEach(function (lv) { if (cleared[lv] === today && D.LEVELS[g].indexOf(lv) >= 0) n++; });
    return n;
  }
  // days = 表示に使う値。opts = { enOn（えいごの声が使えるか。省略は使える）, cleared（profile.cleared） }
  // → { played: { math, letter, clock, english, trace }, crown: 'trace' | '', invite: 'clock' | '', all, none }
  function kidToday(days, today, opts) {
    opts = isObj(opts) ? opts : {};
    var enOn = opts.enOn !== false, day = isObj(days) && has(days, today) ? days[today] : null;
    var played = {}, list = [];
    KID_GAMES.forEach(function (g) { played[g] = kidPlayed(day, g); if (played[g]) list.push(g); });
    var out = { played: played, crown: '', invite: '', all: false, none: list.length === 0 };
    if (!list.length) return out;
    var best = null;
    list.forEach(function (g) {
      var c = { g: g, s: kidSessions(day, g), n: kidGains(day, g, today, opts.cleared), l: (g === 'trace' ? (day.last === 'trace' || day.last === 'solo') : day.last === g) ? 1 : 0 };
      if (!best || c.s > best.s || (c.s === best.s && (c.n > best.n || (c.n === best.n && c.l > best.l)))) best = c;   // 同点は KID_GAMES の並びで先（上書きしない）
    });
    out.crown = best.g;
    var avail = KID_GAMES.filter(function (g) { return g !== 'english' || enOn; });
    out.all = avail.every(function (g) { return played[g]; });
    if (!out.all) {
      var lo = addDays(today, -6), pick = null;
      avail.forEach(function (g) {
        if (played[g]) return;
        var n = 0;
        for (var k = lo; k <= today; k = addDays(k, 1)) if (isObj(days) && has(days, k)) n += kidSessions(days[k], g);
        if (pick === null || n < pick.n) pick = { g: g, n: n };
      });
      out.invite = pick ? pick.g : '';
    }
    return out;
  }

  // ---- クラウドの形（10.3。1 日・1 端末で 1 文書）との行き来と、端末どうしの足し合わせ（10.5） ----
  // firestore.rules の isDay と同じ正規表現（tests/daylog.test.js が、ルールの文字列と一致していることを確かめる）
  var RE = {
    date: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    dev: /^d_[0-9a-z]{8}$/,
    n: /^([0-9]{1,3},[0-9]{1,4},[0-9]{1,4},){4}[0-9]{1,3},[0-9]{1,4},[0-9]{1,3},[0-9]{1,4},[0-9]{1,3},[0-9]{1,5}$/,
    up: /^(M[0-9]{1,2})?,(K[0-9]{1,2})?,(T[0-9]{1,2})?,(E[0-9]{1,2})?$/,
    license: /^((hira|kata|k1|k2)(,(hira|kata|k1|k2)){0,3})?$/,
    last: /^(math|letter|clock|english|trace|solo)?$/
  };
  var CLOUD_KEYS = ['v', 'date', 'dev', 'n', 'up', 'wrote', 'newChars', 'newSolo', 'license', 'newCars', 'last'];
  // 端末の 1 日 → クラウドの文書。day が無い・空なら 0 と空の文字列だけの文書
  function toCloudDay(day, date, dev) {
    var d = normalizeDay(day) || {}, n = [];
    Q_GAMES.forEach(function (g) { var x = d[g] || {}; n.push(x.sessions || 0, x.questions || 0, x.firstTry || 0); });
    C_GAMES.forEach(function (g) { var x = d[g] || {}; n.push(x.sessions || 0, x.chars || 0); });
    n.push(d.cards || 0, d.sec || 0);
    return {
      v: 1, date: date, dev: dev, n: n,
      up: Q_GAMES.map(function (g) { return d.up && d.up[g] ? d.up[g] : ''; }).join(','),
      wrote: d.wrote || '', newChars: d.newChars || '', newSolo: d.newSolo || '',
      license: (d.license || []).join(','), newCars: (d.newCars || []).join(','), last: d.last || ''
    };
  }
  // クラウドの文書 → { date, dev, day }。形が違えば null（ルールを通らない手作りの文書は捨てる）。day は normalizeDay と同じ規則で補正（空なら null）
  function fromCloudDay(doc) {
    if (!isObj(doc)) return null;
    var keys = Object.keys(doc);
    if (keys.length !== CLOUD_KEYS.length || !CLOUD_KEYS.every(function (k) { return has(doc, k); })) return null;
    if (doc.v !== 1 || typeof doc.date !== 'string' || !RE.date.test(doc.date) || !isDayKey(doc.date)) return null;
    if (typeof doc.dev !== 'string' || !RE.dev.test(doc.dev)) return null;
    if (!Array.isArray(doc.n) || doc.n.length !== 18 || !doc.n.every(function (x) { return typeof x === 'number'; }) || !RE.n.test(doc.n.join(','))) return null;
    if (typeof doc.up !== 'string' || !RE.up.test(doc.up) || typeof doc.license !== 'string' || !RE.license.test(doc.license)) return null;
    if (typeof doc.last !== 'string' || !RE.last.test(doc.last) || typeof doc.newCars !== 'string' || doc.newCars.length > 700) return null;
    if (typeof doc.wrote !== 'string' || typeof doc.newChars !== 'string' || typeof doc.newSolo !== 'string') return null;
    var n = doc.n, raw = {}, i = 0;
    Q_GAMES.forEach(function (g) { raw[g] = { sessions: n[i], questions: n[i + 1], firstTry: n[i + 2] }; i += 3; });
    C_GAMES.forEach(function (g) { raw[g] = { sessions: n[i], chars: n[i + 1] }; i += 2; });
    raw.cards = n[i]; raw.sec = n[i + 1];
    raw.up = {}; doc.up.split(',').forEach(function (lv, j) { if (lv) raw.up[Q_GAMES[j]] = lv; });
    raw.wrote = doc.wrote; raw.newChars = doc.newChars; raw.newSolo = doc.newSolo;
    raw.license = doc.license ? doc.license.split(',') : []; raw.newCars = doc.newCars ? doc.newCars.split(',') : [];
    raw.last = doc.last;
    return { date: doc.date, dev: doc.dev, day: normalizeDay(raw) };
  }
  // 自分の端末の分（mine）とほかの端末の分（other）を足す。→ 新しい days。sumDays(a, {}) は normalizeDays(a)
  function sumDays(mine, other) {
    mine = normalizeDays(mine); other = normalizeDays(other);
    var keys = {}; Object.keys(mine).forEach(function (k) { keys[k] = true; }); Object.keys(other).forEach(function (k) { keys[k] = true; });
    var out = {};
    Object.keys(keys).forEach(function (k) {
      var a = has(mine, k) ? mine[k] : null, b = has(other, k) ? other[k] : null, m = {};
      if (!a || !b) { out[k] = a || b; return; }
      Q_GAMES.concat(C_GAMES).forEach(function (g) {
        if (!a[g] && !b[g]) return;
        var x = a[g] || {}, y = b[g] || {}, z = { sessions: (x.sessions || 0) + (y.sessions || 0) };
        if (Q_GAMES.indexOf(g) >= 0) { z.questions = (x.questions || 0) + (y.questions || 0); z.firstTry = (x.firstTry || 0) + (y.firstTry || 0); }
        else z.chars = (x.chars || 0) + (y.chars || 0);
        m[g] = z;
      });
      if (a.up || b.up) {
        m.up = {};
        Q_GAMES.forEach(function (g) {
          var u = a.up && a.up[g], v = b.up && b.up[g];
          if (u && v) m.up[g] = levelIdx(g, u) >= levelIdx(g, v) ? u : v; else if (u || v) m.up[g] = u || v;
        });
      }
      m.wrote = unionStr(a.wrote || '', b.wrote || ''); m.newChars = unionStr(a.newChars || '', b.newChars || ''); m.newSolo = unionStr(a.newSolo || '', b.newSolo || '');
      m.license = (a.license || []).concat((b.license || []).filter(function (x) { return (a.license || []).indexOf(x) < 0; }));
      m.newCars = (a.newCars || []).concat((b.newCars || []).filter(function (x) { return (a.newCars || []).indexOf(x) < 0; }));
      m.cards = (a.cards || 0) + (b.cards || 0); m.sec = (a.sec || 0) + (b.sec || 0);
      m.last = a.last || b.last || '';
      out[k] = m;
    });
    return normalizeDays(out);
  }
  // ほかの端末の文書（fromCloudDay の結果の並び。端末の番号の順に並べてから）を 1 つの days に足し合わせる。何度読んでも同じ結果（置き換え用）
  function foldOthers(list) {
    var sorted = (list || []).filter(function (x) { return x && x.day && isDayKey(x.date); }).sort(function (p, q) { return p.dev < q.dev ? -1 : p.dev > q.dev ? 1 : (p.date < q.date ? -1 : p.date > q.date ? 1 : 0); });
    var acc = {};
    sorted.forEach(function (x) { var one = {}; one[x.date] = x.day; acc = sumDays(acc, one); });
    return acc;
  }

  var api = {
    KEEP_DAYS: KEEP_DAYS, MAX_KEYS: MAX_KEYS, SEC_CAP: SEC_CAP, GAMES: GAMES, KID_GAMES: KID_GAMES, CAP: CAP, LICENSES: LICENSES,
    isDayKey: isDayKey, addDays: addDays, dayOfWeek: dayOfWeek, weekStart: weekStart, weekKeys: weekKeys,
    normalizeDay: normalizeDay, normalizeDays: normalizeDays, prune: prune,
    weekSummary: weekSummary, kidToday: kidToday, RE: RE, toCloudDay: toCloudDay, fromCloudDay: fromCloudDay, sumDays: sumDays, foldOthers: foldOthers, recordSession: recordSession, recordChar: recordChar, addTime: addTime
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.daylog = api; }
})(typeof window !== 'undefined' ? window : globalThis);
