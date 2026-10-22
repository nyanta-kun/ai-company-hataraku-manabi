// 読み上げ（Web Speech API）と声なしモード判定。
// 読み上げ文はすべてひらがな。最初のタップで init() を呼ぶ（iOS Safari 対策）。
// create(env) で作る（env: speechSynthesis / SpeechSynthesisUtterance / setTimeout）。Node のテストは偽の env を渡す。
(function (root) {
  'use strict';

  function create(env) {
    var synth = env.speechSynthesis || null;
    var Utter = env.SpeechSynthesisUtterance;
    var later = env.setTimeout;
    var enabled = true;        // 保護者設定（読み上げオン/オフ）
    var voice = null;
    var inited = false;
    var failed = false;        // 声なしモード（自動判定）
    var noStart = 0;           // 読み上げ開始イベントが来なかった回数（最後に出した発話だけ数える）
    var seq = 0;               // 発話の通し番号。cancel や次の発話で古いものは無効になる
    var reason = '';
    var listeners = [];

    function notify() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
    function setFailed(why) {
      if (failed) return;
      failed = true; reason = why; notify();
    }
    // 日本語の声を選ぶ。端末内の声（localService）を優先して、端末外への送信を避ける
    function pickVoice() {
      if (!synth) return false;
      var vs = (synth.getVoices && synth.getVoices()) || [];
      var ja = vs.filter(function (v) { return /^ja/i.test(v.lang) || /japan/i.test(v.lang); });
      var local = ja.filter(function (v) { return v.localService === true; });
      voice = local.length ? local[0] : (ja.length ? ja[0] : null);
      if (ja.length && failed && reason === 'novoice') { failed = false; reason = ''; noStart = 0; notify(); }   // 後から声が来たら復帰
      return ja.length > 0;
    }

    // 最初のユーザー操作の中で呼ぶ
    function init() {
      if (inited) return;
      inited = true;
      if (!synth || typeof Utter === 'undefined') { setFailed('nosynth'); return; }
      try {
        pickVoice();
        if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
        var u = new Utter(' ');   // ダミー（iOS で最初の操作内に speak しておく）
        u.volume = 0; u.lang = 'ja-JP';
        synth.speak(u);
      } catch (e) { setFailed('error'); return; }
      later(function () { if (!pickVoice()) setFailed('novoice'); }, 1500);
    }

    function available() { return !!synth && !failed; }
    function isVoiceless() { return !available(); }
    function cancel() { seq++; if (synth) { try { synth.cancel(); } catch (e) {} } }
    function setEnabled(v) { enabled = !!v; if (!enabled) cancel(); }
    function onChange(f) { listeners.push(f); }

    // text を読む。opts.force=true で保護者設定オフでも読む（テスト用）。戻り値: 読み上げを試みたか
    function speak(text, opts) {
      opts = opts || {};
      if ((!enabled && !opts.force) || !available() || !text) return false;
      try {
        cancel();                      // 自分の cancel で打ち切られる前の発話は seq が変わるので数えない
        var my = seq;
        var u = new Utter(text);
        u.lang = 'ja-JP'; u.rate = 0.85; u.pitch = 1.1;
        if (voice) u.voice = voice;
        var started = false;
        u.onstart = function () { started = true; noStart = 0; };
        u.onend = function () { if (opts.onend) opts.onend(); };
        later(function () {
          if (started || failed || my !== seq) return;   // 開始した／後続の発話で置き換わった
          noStart++;
          if (noStart >= 2) setFailed('nostart');
        }, 3000);
        synth.speak(u);
        return true;
      } catch (e) { setFailed('error'); return false; }
    }

    function forceVoiceless() { setFailed('forced'); }

    return {
      init: init, speak: speak, cancel: cancel, available: available, isVoiceless: isVoiceless,
      setEnabled: setEnabled, onChange: onChange, forceVoiceless: forceVoiceless,
      reason: function () { return reason; }, pickVoice: pickVoice
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { create: create };
  else {
    root.Manabi = root.Manabi || {};
    root.Manabi.speech = create({
      speechSynthesis: root.speechSynthesis, SpeechSynthesisUtterance: root.SpeechSynthesisUtterance,
      setTimeout: function (f, ms) { return root.setTimeout(f, ms); }
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
