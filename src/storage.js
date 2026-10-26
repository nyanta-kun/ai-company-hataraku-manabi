// localStorage の読み書き（キー hataraku-manabi:v2。端末共通 device ＋ プロフィール配列。v1 は初回だけ取り込む）。使えない環境ではメモリだけで動く。
// ブラウザでは window.Manabi.storage、Node では module.exports（純粋関数はテスト対象）。
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var D = node ? require('./data.js') : root.Manabi.data;
  var TR = node ? require('./trace.js') : root.Manabi.trace;   // なぞりがきの保存の補正（trace.normalizeTrace）
  var KEY = 'hataraku-manabi:v2', KEY_V1 = 'hataraku-manabi:v1', KEY_BROKEN = 'hataraku-manabi:v2:broken';
  var GAME_IDS = D.GAMES;
  var CAR_IDS = ['nekoguruma', 'forklift', 'gomi', 'shovel', 'bulldozer', 'dump', 'kyukyu', 'shoubousha', 'mizutank', 'hashigo', 'chodai',
    'rescuework', 'rescuechem', 'rescuecmd', 'rescueheli'];   // 末尾 4 つは救助隊の車（data.js の RESCUE_CARS。tests/rescue.test.js で一致を確かめる）

  var MAX_PROFILES = 4;
  // 新しいプロフィールの既定アイコンの順番（profiles.js も同じものを使う）
  var ICON_ORDER = ['shoubousha', 'kyukyu', 'hashigo', 'dump', 'shovel', 'chodai', 'mizutank', 'gomi', 'bulldozer', 'forklift', 'nekoguruma'];

  // プロフィール 1 人分の進み具合（v1 の既定から version・sound を抜いたもの）
  function defaultProgress() {
    return {
      levels: { math: 'M1', letter: 'K1', clock: 'T1', english: 'E1' },
      locked: { math: false, letter: false, clock: false, english: false },
      cards: {},
      stats: {
        sessions: 0,
        math: { sessions: 0, questions: 0, firstTry: 0 },
        letter: { sessions: 0, questions: 0, firstTry: 0 },
        clock: { sessions: 0, questions: 0, firstTry: 0 },
        english: { sessions: 0, questions: 0, firstTry: 0 },
        trace: { sessions: 0, chars: 0, clean: 0 }   // 5つめのゲーム「かく」（階段・関門には入れない。design-tracing 2.6）
      },
      trace: { done: {}, help: {}, solo: {}, set: 'auto', width: 'auto' },   // 字 → 書き終えた回数・たすけが要った回数（help ≤ done）・ひとりで書けた回数（solo ≤ done）。指の線は保存しない
      seen: { letter: [] },
      lastPlayed: '',
      stage: { unlocked: 'S0', current: 'S0' },   // 階段（design-elementary 3.2）: 解放済みの一番上のステージと、いま選んでいるステージ
      cleared: {},                                // 関門レベル → 初めて 4/4 した日
      promoted: {}                                // ステージ → 昇格した日
    };
  }
  function num(v) { return (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : 0; }
  function bool(v, d) { return typeof v === 'boolean' ? v : d; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function pad2(n) { return ('0' + n).slice(-2); }
  function todayLocal() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  // 端末をまたいでも重ならない id（R4 のマージの鍵）
  function newId(now, rng) {
    var r = Math.floor((rng ? rng() : Math.random()) * 1679616);   // 36^4
    return 'p_' + Math.floor(now).toString(36) + '_' + ('0000' + r.toString(36)).slice(-4);
  }
  var AUTO_NAME_RE = /^こども[1-4]$/;
  var ID_RE = /^p_[0-9a-z_]{1,24}$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  // 名前の検査（保護者が入力する。ひらがな 1〜6 文字。カタカナはひらがなに直す）
  // → { ok:true, name } | { ok:false, reason:'empty'|'chars'|'long' }
  function normalizeName(s) {
    var t = D.toHira(String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''));
    if (t === '') return { ok: false, reason: 'empty' };
    if (!/^[ぁ-ゖー]+$/.test(t)) return { ok: false, reason: 'chars' };
    if (t.length > 6) return { ok: false, reason: 'long' };
    return { ok: true, name: t };
  }
  // 'こども' + 使われていない最小の番号
  function nextName(profiles) {
    var used = {};
    profiles.forEach(function (p) { used[p.name] = true; });
    for (var n = 1; ; n++) if (!used['こども' + n]) return 'こども' + n;
  }
  function freeIconIn(profiles) {
    var used = {};
    profiles.forEach(function (p) { used[p.icon] = true; });
    for (var i = 0; i < ICON_ORDER.length; i++) if (!used[ICON_ORDER[i]]) return ICON_ORDER[i];
    return ICON_ORDER[0];
  }

  // プロフィールの進み具合を整える（id・name・icon・created は含まない）。壊れた値はデフォルトで埋める
  function normalizeProfile(raw) {
    var d = defaultProgress();
    if (!raw || typeof raw !== 'object') return d;
    var l = raw.levels || {}, k = raw.locked || {}, st = raw.stats || {};
    var sg = isObj(raw.stage) ? raw.stage : {}, ui = D.stageIndex(sg.unlocked), ci = D.stageIndex(sg.current);
    d.stage.unlocked = D.STAGES[ui < 0 ? 0 : ui].id;
    d.stage.current = D.STAGES[ci < 0 ? 0 : Math.min(ci, ui < 0 ? 0 : ui)].id;   // 解放済みより上は選べない
    GAME_IDS.forEach(function (g) {
      var lv = D.LEVELS[g], top = D.topLevelUpTo(d.stage.unlocked, g);
      d.levels[g] = lv.indexOf(l[g]) >= 0 ? l[g] : lv[0];
      if (lv.indexOf(d.levels[g]) > lv.indexOf(top)) d.levels[g] = top;   // 未解放のステージのレベルは、解放済みの一番上に丸める
    });
    d.locked.clock = bool(k.clock, false); d.locked.english = bool(k.english, false);
    d.locked.math = bool(k.math, false); d.locked.letter = bool(k.letter, false);
    var c = raw.cards || {};
    CAR_IDS.forEach(function (id) { var n = Math.min(3, num(c[id])); if (n > 0) d.cards[id] = n; });
    d.stats.sessions = num(st.sessions);
    ['math', 'letter', 'clock', 'english'].forEach(function (g) {
      var x = st[g] || {};
      d.stats[g] = { sessions: num(x.sessions), questions: num(x.questions), firstTry: num(x.firstTry) };
    });
    var tx = isObj(st.trace) ? st.trace : {};
    d.stats.trace = { sessions: num(tx.sessions), chars: num(tx.chars), clean: num(tx.clean) };
    d.trace = TR.normalizeTrace(raw.trace);
    d.seen.letter = D.cleanSeen(raw.seen && raw.seen.letter);
    d.lastPlayed = typeof raw.lastPlayed === 'string' ? raw.lastPlayed.slice(0, 10) : '';
    var cl = isObj(raw.cleared) ? raw.cleared : {}, pr = isObj(raw.promoted) ? raw.promoted : {};
    D.gateLevels().forEach(function (id) { if (isDate(cl[id])) d.cleared[id] = cl[id]; });
    D.STAGES.forEach(function (stg, i) { if (i > 0 && isDate(pr[stg.id])) d.promoted[stg.id] = pr[stg.id]; });
    return d;
  }
  function makeProfile(id, name, icon, created, progress) {
    var p = { id: id, name: name, icon: icon, created: created };
    Object.keys(progress).forEach(function (key) { p[key] = progress[key]; });
    return p;
  }
  function defaultProfile(id, name, icon, today) { return makeProfile(id, name, icon, today || '', defaultProgress()); }
  function normalizeSound(s) {
    s = isObj(s) ? s : {};
    return { sfx: bool(s.sfx, true), voice: bool(s.voice, true) };
  }

  // v2 の既定（こども1 が 1 人）。id・today は呼ぶ側が渡す
  function defaults(id, today) {
    id = (typeof id === 'string' && ID_RE.test(id)) ? id : newId(Date.now(), Math.random);
    today = (typeof today === 'string' && DATE_RE.test(today)) ? today : todayLocal();
    return {
      version: 2,
      device: { sound: { sfx: true, voice: true }, lastProfileId: id, migratedV1: '' },
      profiles: [defaultProfile(id, 'こども1', 'shoubousha', today)]
    };
  }

  // 壊れたデータ・欠損があってもデフォルトで埋めて返す（v2）
  function normalize(raw, id, today) {
    var d = defaults(id, today);
    if (!isObj(raw)) return d;
    var dev = isObj(raw.device) ? raw.device : {};
    var list = [], seen = Object.create(null);
    (Array.isArray(raw.profiles) ? raw.profiles : []).forEach(function (rp) {
      if (list.length >= MAX_PROFILES || !isObj(rp)) return;
      if (typeof rp.id !== 'string' || !ID_RE.test(rp.id) || seen[rp.id]) return;
      seen[rp.id] = true;
      var nm = AUTO_NAME_RE.test(rp.name) ? { ok: true, name: rp.name } : normalizeName(rp.name);   // 自動名「こども1〜4」は数字入りでもそのまま
      list.push(makeProfile(rp.id, nm.ok ? nm.name : '', ICON_ORDER.indexOf(rp.icon) >= 0 ? rp.icon : '',
        (typeof rp.created === 'string' && DATE_RE.test(rp.created)) ? rp.created : '', normalizeProfile(rp)));
    });
    if (!list.length) list = d.profiles;
    else list.forEach(function (p) {   // 名前・アイコンの補正は全員が揃ってから（重ならないように）
      if (!p.name) p.name = nextName(list);
    });
    list.forEach(function (p) {
      if (!p.icon) p.icon = freeIconIn(list.filter(function (q) { return q !== p && q.icon; }));
    });
    var last = typeof dev.lastProfileId === 'string' && seen[dev.lastProfileId] ? dev.lastProfileId : list[0].id;
    if (list === d.profiles) last = list[0].id;
    var out = {
      version: 2,
      device: {
        sound: normalizeSound(dev.sound),
        lastProfileId: last,
        migratedV1: (typeof dev.migratedV1 === 'string' && DATE_RE.test(dev.migratedV1)) ? dev.migratedV1 : ''
      },
      profiles: list
    };
    if (dev.restoredFromV1 === true) out.device.restoredFromV1 = true;
    return out;
  }

  // v1（1 人分の保存）を「こども1」として v2 に取り込む。レベル・カード・統計は変えない
  function migrateV1(raw, id, today) {
    var d = defaults(id, today);
    var src = isObj(raw) ? raw : {};
    var p = d.profiles[0];
    var prog = normalizeProfile(src);
    Object.keys(prog).forEach(function (key) { p[key] = prog[key]; });
    d.device.sound = normalizeSound(src.sound);
    d.device.migratedV1 = d.profiles[0].created;
    return d;
  }

  var persistent = true;
  function store() { try { return root.localStorage || null; } catch (e) { return null; } }
  function isId(v) { return typeof v === 'string' && ID_RE.test(v); }
  function isDate(v) { return typeof v === 'string' && DATE_RE.test(v); }
  // v2 として使えるか（有効な id のプロフィールが 1 人以上ある）
  function hasProfile(v) { return Array.isArray(v.profiles) && v.profiles.some(function (p) { return isObj(p) && isId(p.id); }); }
  function parseObj(text) {   // 壊れていたら undefined
    try { var v = JSON.parse(text); return isObj(v) ? v : undefined; } catch (e) { return undefined; }
  }
  function fresh() { return defaults(newId(Date.now(), Math.random), todayLocal()); }
  // 読み込みの順番: v2 → （壊れていれば退避して）v1 の取り込み → 既定。v2 があれば v1 は見ない
  function load() {
    var ls = store(), t2, t1, v2, v1, broken = false;
    if (!ls) { persistent = false; return fresh(); }
    try { t2 = ls.getItem(KEY); } catch (e) { persistent = false; return fresh(); }
    if (t2) {
      v2 = parseObj(t2);
      if (v2 && hasProfile(v2)) return normalize(v2, newId(Date.now(), Math.random), todayLocal());
      broken = true;
      try { ls.setItem(KEY_BROKEN, t2); } catch (e) {}
    }
    try { t1 = ls.getItem(KEY_V1); } catch (e) { t1 = null; }
    v1 = t1 ? parseObj(t1) : undefined;
    if (v1) {
      var st = migrateV1(v1, newId(Date.now(), Math.random), todayLocal());
      if (broken) st.device.restoredFromV1 = true;
      save(st);
      return st;
    }
    return fresh();
  }
  function save(state) {
    try {
      var ls = store();
      if (!ls) throw new Error('no storage');
      ls.setItem(KEY, JSON.stringify(state));
      persistent = true;
    } catch (e) { persistent = false; }
  }
  function clear() {
    try { var ls = store(); if (ls) { ls.removeItem(KEY); ls.removeItem(KEY_V1); ls.removeItem(KEY_BROKEN); } } catch (e) {}
  }
  function isPersistent() { return persistent; }

  var api = {
    KEY: KEY, KEY_V1: KEY_V1, KEY_BROKEN: KEY_BROKEN, MAX_PROFILES: MAX_PROFILES, ICON_ORDER: ICON_ORDER,
    defaultProgress: defaultProgress, normalizeProfile: normalizeProfile, defaultProfile: defaultProfile, defaults: defaults,
    normalize: normalize, migrateV1: migrateV1, normalizeName: normalizeName, isId: isId, isDate: isDate, nextName: nextName, freeIconIn: freeIconIn, newId: newId,
    load: load, save: save, clear: clear, fresh: fresh, isPersistent: isPersistent
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.storage = api; }
})(typeof window !== 'undefined' ? window : globalThis);
