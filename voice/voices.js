// 同梱している声の一覧（保護者画面の並びと、おまかせの先頭）。scripts/voice/build.js が書く
(function (root) {
  root.Manabi = root.Manabi || {};
  root.Manabi.voiceList = [{"id":"metan","label":"めたん","credit":"VOICEVOX:四国めたん"}];   // [{ id, label, credit }]
})(typeof window !== 'undefined' ? window : globalThis);
