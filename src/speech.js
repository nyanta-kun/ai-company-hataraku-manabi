// 読み上げ（Web Speech API）と声なしモード判定。
// 読み上げ文はすべてひらがな。最初のタップで init() を呼ぶ（iOS Safari 対策）。
(function (root) {
  'use strict';
  var synth = root.speechSynthesis || null;
  var enabled = true;        // 保護者設定（読み上げオン/オフ）
  var voice = null;
  var inited = false;
  var failed = false;        // 声なしモード（自動判定）
  var noStart = 0;           // 読み上げ開始イベントが来なかった回数
  var reason = '';
  var listeners = [];

  function setFailed(why) {
    if (failed) return;
    failed = true; reason = why;
    listeners.forEach(function (f) { try { f(); } catch (e) {} });
  }
  function pickVoice() {
    if (!synth) return;
    var vs = synth.getVoices() || [];
    var ja = vs.filter(function (v) { return /^ja/i.test(v.lang) || /japan/i.test(v.lang); });
    voice = ja.length ? ja[0] : null;
    return ja.length > 0;
  }

  // 最初のユーザー操作の中で呼ぶ
  function init() {
    if (inited) return;
    inited = true;
    if (!synth || typeof root.SpeechSynthesisUtterance === 'undefined') { setFailed('nosynth'); return; }
    try {
      pickVoice();
      if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
      var u = new root.SpeechSynthesisUtterance(' ');   // ダミー（iOS で最初の操作内に speak しておく）
      u.volume = 0; u.lang = 'ja-JP';
      synth.speak(u);
    } catch (e) { setFailed('error'); return; }
    // 声の読み込みを少し待って、日本語が無ければ声なしモード
    setTimeout(function () { if (!pickVoice()) setFailed('novoice'); }, 1500);
  }

  function available() { return !!synth && !failed; }
  function isVoiceless() { return !available(); }
  function setEnabled(v) { enabled = !!v; if (!enabled) cancel(); }
  function onChange(f) { listeners.push(f); }

  function cancel() { if (synth) { try { synth.cancel(); } catch (e) {} } }

  // text を読む。opts.force=true で保護者設定オフでも読む（テスト用）。戻り値: 読み上げを試みたか
  function speak(text, opts) {
    opts = opts || {};
    if ((!enabled && !opts.force) || !available() || !text) return false;
    try {
      cancel();
      var u = new root.SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; u.rate = 0.85; u.pitch = 1.1;
      if (voice) u.voice = voice;
      var started = false;
      u.onstart = function () { started = true; noStart = 0; };
      u.onend = function () { if (opts.onend) opts.onend(); };
      setTimeout(function () {
        if (!started && !failed) { noStart++; if (noStart >= 2) setFailed('nostart'); }
      }, 3000);
      synth.speak(u);
      return true;
    } catch (e) { setFailed('error'); return false; }
  }

  // 声なしモードにする（デバッグ用）
  function forceVoiceless() { setFailed('forced'); }

  root.Manabi = root.Manabi || {};
  root.Manabi.speech = {
    init: init, speak: speak, cancel: cancel, available: available, isVoiceless: isVoiceless,
    setEnabled: setEnabled, onChange: onChange, forceVoiceless: forceVoiceless,
    reason: function () { return reason; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
