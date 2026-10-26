// 読み上げ文 → 音声の部品の並び（resolve。純粋関数）。ブラウザでは window.Manabi.voice、Node では module.exports。
// 鍵は読み上げ文そのもの（normalize 済み）。声のパックは「鍵 → [ファイル名, 長さ ms]」の表。設計は docs/design-voice.md 4 章。
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

  var api = { GAP_PART: GAP_PART, GAP_SENT: GAP_SENT, normalize: normalize, sentences: sentences, resolve: resolve };
  if (node) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.voice = api; }
})(typeof window !== 'undefined' ? window : globalThis);
