// 起動。#debug（または #debug:画面名）で確認用パネルを出す。
(function (root) {
  'use strict';
  var M = root.Manabi, doc = root.document, ui = M.ui, D = M.data, P = M.problems;

  function parseHash() {
    var h = (root.location.hash || '').replace(/^#/, '');
    var m = /^debug(?::(.+))?$/.exec(h);
    return m ? { on: true, goto: m[1] || '' } : { on: false };
  }

  function debugPanel(goto) {
    var box = doc.getElementById('debug'); box.hidden = false;
    var err = doc.createElement('pre'); err.id = 'errlog'; err.textContent = '';
    function log(s) { err.textContent += s + '\n'; }
    root.addEventListener('error', function (e) { log('ERROR: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
    root.addEventListener('unhandledrejection', function (e) { log('REJECT: ' + e.reason); });
    function btn(label, fn) { var b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); box.appendChild(b); }
    ['M1', 'M2', 'M3', 'M4', 'M5'].forEach(function (lv) { btn(lv, function () { ui.data.levels.math = lv; ui.data.locked.math = true; ui.setData(ui.data); ui.startSession('math', { fast: true }); }); });
    ['K1', 'K2', 'K3'].forEach(function (lv) { btn(lv, function () { ui.data.levels.letter = lv; ui.data.locked.letter = true; ui.setData(ui.data); ui.startSession('letter', { fast: true }); }); });
    ['T1', 'T2', 'T3'].forEach(function (lv) { btn(lv, function () { ui.data.levels.clock = lv; ui.data.locked.clock = true; ui.setData(ui.data); ui.startSession('clock', { fast: true }); }); });
    btn('ごほうび', function () { ui.gotoReward('kaji'); });
    btn('全車★3', function () { D.CARS.forEach(function (c) { ui.data.cards[c.id] = 3; }); ui.setData(ui.data); });
    btn('全車なし', function () { ui.data.cards = {}; ui.setData(ui.data); });
    btn('しゃこ', function () { ui.show('garage'); });
    btn('おうちのひと', function () { ui.show('parent'); });
    btn('タイトル', function () { ui.show('title'); });
    btn('声なし', function () { M.speech.forceVoiceless(); });
    box.appendChild(err);

    // 画面指定でのジャンプ（スクショ用）
    var g = goto.split('-');
    if (g[0] === 'play') {
      var game = g[1] === 'letter' ? 'letter' : g[1] === 'clock' ? 'clock' : 'math';
      if (g[2]) ui.data.levels[game] = g[2];
      ui.startSession(game, { fast: true, scene: g[3] || undefined });
      if (g[4]) root.setTimeout(function () { ui.debugProgress(+g[4]); }, 50);
    } else if (g[0] === 'pick') ui.show('pick');
    else if (g[0] === 'reward') ui.gotoReward(g[1] || 'kaji');
    else if (g[0] === 'garage') ui.previewGarage();
    else if (g[0] === 'parent') ui.show('parent');
    return log;
  }

  function start() {
    ui.init();
    var h = parseHash();
    if (h.on) debugPanel(h.goto);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(window);
