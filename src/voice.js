// 読み上げ文 → 音声の部品の並び（resolve。純粋関数）と、音声ファイルの読み込み・再生（create）。ブラウザでは window.Manabi.voice、Node では module.exports。
// 鍵は読み上げ文そのもの（normalize 済み）。声のパックは「鍵 → [ファイル名, 長さ ms]」の表。設計は docs/design-voice.md 4・5 章。
// create(env) で作る（env: context / fetch / loadScript / setTimeout / protocol）。Node のテストは偽の env を渡す（speech.js と同じやり方）。
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var D = node ? require('./data.js') : root.Manabi.data;
  var L = node ? require('./lines.js') : root.Manabi.lines;

  var GAP_PART = 40;    // 同じ文の中の部品の間（ms）。実機で調整
  var GAP_SENT = 200;   // 文と文の間（ms）

  // 前後の空白を落とし、「。」「！」「？」の直後の空白を落とし、続く空白を 1 つにする。表の鍵にも入力にも同じ正規化をかける
  function normalize(text) {
    return String(text == null ? '' : text).replace(/\s+/g, ' ').trim().replace(/([。！？]) +/g, '$1');
  }
  // 「。」「！」「？」の後ろで文に切る（記号は前の文に付く）。normalize 済みの文を渡す
  function sentences(text) {
    return normalize(text).match(/[^。！？]*[。！？]|[^。！？]+$/g) || [];
  }

  var HOURS = D.TIME_KANA.slice(1).sort(function (a, b) { return b.length - a.length; });   // 時の読み（長い方から。じゅうにじ・じゅういちじ・じゅうじ が割れない）
  var MINUTES = {};
  D.MIN_KANA.forEach(function (m, i) { if (m && i !== 30) MINUTES[m] = true; });

  // 表に無い 1 文を、型に当てはめて部品（鍵）に分ける。分けられなければ null
  function typeKeys(sent, table) {
    var has = function (k) { return !!table[k]; };
    var m, body, mark, i, h, tail, pre;
    // 時刻: [前置き]＋時刻＋記号。ちょうど・はんは丸ごと、それ以外は 時（くじ）＋分と記号
    m = /^(.*?)([^。！？、]+)([。！？])$/.exec(sent);
    if (m) {
      pre = m[1]; body = m[2]; mark = m[3];
      if (pre === '' || L.TIME_PREFIX.indexOf(pre) >= 0) {
        for (i = 0; i < HOURS.length; i++) {
          h = HOURS[i];
          if (body.indexOf(h) !== 0) continue;
          tail = body.slice(h.length);
          var keys = pre ? [pre] : [];
          if (tail === '' || tail === 'はん') keys.push(body + mark);
          else if (MINUTES[tail]) keys.push(h, tail + mark);
          else continue;
          if (keys.every(has)) return keys;
        }
      }
    }
    // 式: {数}たす・ひく{数}は、いくつ？（数はふつうの読み）
    m = /^(.+?)(たす|ひく)(.+)は、いくつ？$/.exec(sent);
    if (m) {
      var ks = [m[1], m[2], m[3], 'は、いくつ？'];
      if (ks.every(has)) return ks;
    }
    return null;
  }

  // resolve(text, table) → [{ key, f, ms, gap }]（鳴らす順。gap は前との間の ms）または null（端末の声で読む。混ぜない）
  function resolve(text, table) {
    var norm = normalize(text);
    if (!norm) return null;
    var out = [];
    function put(key, gap) { var c = table[key]; out.push({ key: key, f: c[0], ms: c[1], gap: out.length ? gap : 0 }); }
    if (table[norm]) { put(norm, 0); return out; }
    var ss = sentences(norm), i = 0;
    while (i < ss.length) {
      // 続く文をつないだものが表にあるか、長い方から探す（「おしい！もう一回。」は 2 文だが 1 つの音声）
      var hit = 0;
      for (var j = ss.length; j > i; j--) { if (table[ss.slice(i, j).join('')]) { hit = j; break; } }
      if (hit) { put(ss.slice(i, hit).join(''), GAP_SENT); i = hit; continue; }
      var keys = typeKeys(ss[i], table);
      if (!keys) return null;
      keys.forEach(function (k, n) { put(k, n === 0 ? GAP_SENT : GAP_PART); });
      i++;
    }
    return out;
  }

  // ---- 再生 ----
  var CLIP_WAIT_MS = 800;     // 音がまだ無いとき、鳴らすまで待つ上限。間に合わなければ onerror('late')（端末の声に切り替える）
  var DECODED_MAX = 80;       // 復号済みの音（AudioBuffer）を持つ数。新しい順（iOS は 48kHz で復号するので全部は持てない）
  var FAIL_MAX = 3;           // 読めない・復号できない・動かない、が続いたらその起動の間は端末の声だけ
  var SILENCE = 0.004;        // 頭とおしりの「これ未満が続く所」は切る（振幅）
  var VOLUME = 1;             // 声用の GainNode の音量

  // 先頭と末尾の無音を測る（AAC は頭に無音が入り、VOICEVOX も前後に無音を付けるため、つなぎの間をそろえる）。samples = 1 チャンネルの Float32Array 相当。
  // 戻り値: { start, end }（秒。end は音の終わり。全部無音なら全体を返す）
  function silenceRange(samples, rate, threshold) {
    var th = threshold == null ? SILENCE : threshold, n = samples.length, a = 0, b = n - 1;
    while (a < n && Math.abs(samples[a]) < th) a++;
    if (a >= n) return { start: 0, end: n / rate };
    while (b > a && Math.abs(samples[b]) < th) b--;
    return { start: a / rate, end: (b + 1) / rate };
  }

  function create(env) {
    env = env || {};
    var later = env.setTimeout || function (f, ms) { return setTimeout(f, ms); };
    var packs = {};            // id → { pack, table }
    var cur = null;            // 選んでいる声のパック { id, pack, table }（読み込めたもの）
    var want = '';             // 選んでいる声の id（'' = 無し）
    var status = 'none';       // none → loading → ready / failed / file（file:// では使わない）
    var fails = 0;
    var listeners = [];
    var raw = {};              // ファイル名 → Promise<ArrayBuffer>
    var decoded = {};          // ファイル名 → { buf, start, dur }（新しい順に DECODED_MAX 個）
    var order = [];
    var pending = {};          // ファイル名 → Promise<{buf,start,dur}>
    var playId = 0, live = [], gainNode = null, gainCtx = null;

    function notify() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
    function onChange(f) { listeners.push(f); }
    function web() { return env.protocol === 'http:' || env.protocol === 'https:'; }
    function ctx() { return env.context ? env.context() : null; }
    function fail() { fails++; if (fails >= FAIL_MAX && status !== 'failed') { status = 'failed'; notify(); } }
    function ok() { fails = 0; }

    // 声のパックの登録（voice/<id>/index.js が Manabi.voicePack({...}) で呼ぶ）
    function register(pack) {
      if (!pack || !/^[a-z0-9-]{1,20}$/.test(pack.id || '')) return;
      var table = {};
      Object.keys(pack.clips || {}).forEach(function (k) { table[normalize(k)] = pack.clips[k]; });
      packs[pack.id] = { id: pack.id, pack: pack, table: table };
      if (want === pack.id) { cur = packs[pack.id]; status = 'ready'; ok(); notify(); warm(); }
    }
    // 声を選ぶ。id が無ければ（端末の声）何も読まない。file:// では読まない
    function select(id) {
      want = id || '';
      cur = null; fails = 0;
      stop();
      if (!want) { status = 'none'; notify(); return; }
      if (!web()) { status = 'file'; notify(); return; }
      if (packs[want]) { cur = packs[want]; status = 'ready'; notify(); warm(); return; }
      status = 'loading'; notify();
      var id0 = want;
      env.loadScript('voice/' + id0 + '/index.js', function (okLoad) {
        if (want !== id0) return;
        if (!packs[id0]) { status = 'failed'; notify(); return; }   // 読めない・登録されなかった
        cur = packs[id0]; status = 'ready'; ok(); notify(); warm();
      });
    }
    function selected() { return want; }
    function stateName() { return status; }
    // 声が使える（パックがあり、http(s) で、AudioContext が動いている）
    function ready() {
      if (status !== 'ready' || !cur || !web()) return false;
      var c = ctx();
      return !!c && c.state === 'running';
    }
    function plan(text) { return cur ? resolve(text, cur.table) : null; }
    function total(p) { var t = 0; (p || []).forEach(function (x) { t += x.gap + x.ms; }); return t; }

    // ---- 読み込みと復号 ----
    function url(f) { return 'voice/' + cur.id + '/' + f + '.' + (cur.pack.ext || 'aac'); }
    function fetchRaw(f) {
      if (!raw[f]) {
        var u = url(f);
        raw[f] = Promise.resolve().then(function () { return env.fetch(u); }).then(function (r) {
          if (!r || r.ok === false) throw new Error('http');
          return r.arrayBuffer();
        });
        raw[f].catch(function () { delete raw[f]; });
      }
      return raw[f];
    }
    function decode(c, ab) {
      return new Promise(function (res, rej) {
        try { var p = c.decodeAudioData(ab.slice(0), res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
      });
    }
    function remember(f, d) {
      decoded[f] = d; order = order.filter(function (x) { return x !== f; }); order.push(f);
      while (order.length > DECODED_MAX) delete decoded[order.shift()];
    }
    // 復号済みの音を返す（無ければ読んで復号する）。失敗は数える
    function load(f) {
      if (decoded[f]) { var d = decoded[f]; order = order.filter(function (x) { return x !== f; }); order.push(f); return Promise.resolve(d); }
      if (pending[f]) return pending[f];
      var c = ctx();
      if (!c) return Promise.reject(new Error('noctx'));
      pending[f] = fetchRaw(f).then(function (ab) { return decode(c, ab); }).then(function (buf) {
        var r = silenceRange(buf.getChannelData(0), buf.sampleRate);
        var d = { buf: buf, start: r.start, dur: Math.max(0.02, r.end - r.start) };
        remember(f, d); delete pending[f]; ok(); return d;
      }, function (e) { delete pending[f]; fail(); throw e; });
      return pending[f];
    }
    // 文の音を先に読んで復号しておく（声が使えないときは読むだけ）
    function prefetch(texts) {
      if (!cur) return;
      var canDecode = ready(), seen = {};
      (texts || []).forEach(function (t) {
        var p = plan(t);
        (p || []).forEach(function (x) {
          if (seen[x.f]) return; seen[x.f] = 1;
          (canDecode ? load(x.f) : fetchRaw(x.f)).catch(function () {});
        });
      });
    }
    function warm() { prefetch(env.warm ? env.warm() : Object.keys(L.FIXED).map(function (k) { return L.FIXED[k]; })); }   // 決まり文句（出動！・そう！・おしい！もう一回。など）

    // ---- 再生 ----
    function voiceOut(c) {
      if (!gainNode || gainCtx !== c) { gainNode = c.createGain(); gainNode.gain.value = VOLUME; gainNode.connect(c.destination); gainCtx = c; }
      return gainNode;   // 効果音のコンプレッサーは通さない（効果音と声で音量を別に扱う）
    }
    function stop() {
      playId++;
      live.forEach(function (s) { s.onended = null; try { s.stop(); } catch (e) {} });
      live = [];
    }
    // plan を鳴らす。hooks: onstart / onend / onerror(why)。why: 'late' 'noctx' 'decode'
    function play(p, hooks) {
      hooks = hooks || {};
      stop();
      var my = playId, done = false, started = false;
      function err(why) { if (done) return; done = true; if (hooks.onerror) hooks.onerror(why); }
      if (!p || !p.length || !ready()) { err('noctx'); return; }
      later(function () { if (!started && !done && my === playId) { done = true; if (hooks.onerror) hooks.onerror('late'); } }, CLIP_WAIT_MS);
      Promise.all(p.map(function (x) { return load(x.f); })).then(function (ds) {
        if (done || my !== playId) return;
        started = true;
        var c = ctx();
        if (!c || c.state !== 'running') { done = true; fail(); if (hooks.onerror) hooks.onerror('noctx'); return; }
        var t = c.currentTime + 0.03, out = voiceOut(c), last = null;
        ds.forEach(function (d, i) {
          t += p[i].gap / 1000;
          var src = c.createBufferSource();
          src.buffer = d.buf; src.connect(out); src.start(t, d.start, d.dur);
          live.push(src); last = src; t += d.dur;
        });
        var endMs = Math.round((t - c.currentTime) * 1000) + 1000, ended = false;
        function end() { if (ended || my !== playId) return; ended = true; done = true; if (hooks.onend) hooks.onend(); }
        last.onended = end;
        later(end, endMs);   // onended が来ない端末に備え、予定の長さ＋1 秒で終わったことにする
        if (hooks.onstart) hooks.onstart();
      }, function () {
        if (done || my !== playId) return;
        done = true; if (hooks.onerror) hooks.onerror('decode');
      });
    }

    return { register: register, select: select, selected: selected, state: stateName, ready: ready, plan: plan, total: total, prefetch: prefetch, warm: warm, play: play, stop: stop, onChange: onChange };
  }

  var api = { GAP_PART: GAP_PART, GAP_SENT: GAP_SENT, normalize: normalize, sentences: sentences, resolve: resolve, silenceRange: silenceRange, create: create,
    CLIP_WAIT_MS: CLIP_WAIT_MS, DECODED_MAX: DECODED_MAX, FAIL_MAX: FAIL_MAX };
  if (node) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.voice = api; }
})(typeof window !== 'undefined' ? window : globalThis);
