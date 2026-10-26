// 同梱している声の一覧（保護者画面の並びと、おまかせの先頭）。scripts/voice/build.js が書く。今は声のパックが無いので空（端末の声で読む）
(function (root) {
  root.Manabi = root.Manabi || {};
  root.Manabi.voiceList = [];   // [{ id, label, credit }]
})(typeof window !== 'undefined' ? window : globalThis);
