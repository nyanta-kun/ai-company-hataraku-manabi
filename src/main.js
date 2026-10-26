// 起動。#debug（または #debug:画面名）で確認用パネルを出す。
(function (root) {
  'use strict';
  var M = root.Manabi, doc = root.document, ui = M.ui, D = M.data, P = M.problems;

  function parseHash() {
    var h = (root.location.hash || '').replace(/^#/, '');
    var m = /^debug(?::(.+))?$/.exec(h);
    var go = m && m[1] || '';
    try { go = decodeURIComponent(go); } catch (e) {}   // #debug:play-trace-k1-雨 のように字を入れると、ブラウザが %E9… に直す
    return m ? { on: true, goto: go } : { on: false };
  }

  // 単語表の全部の絵を名前つきで一覧にする（確認用）。もう一度押すと閉じる
  function togglePicGrid() {
    var old = doc.getElementById('picgrid');
    if (old) { old.remove(); return; }
    var V = M.vehicles, words = D.WORDS, cols = 6, cw = 200, ch = 190, rows = Math.ceil(words.length / cols);
    var wrap = doc.createElement('div'); wrap.id = 'picgrid';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:50;background:#fff;overflow:auto';
    var cv = doc.createElement('canvas'); cv.width = cols * cw; cv.height = rows * ch;
    cv.style.cssText = 'display:block;width:' + cols * cw + 'px;height:' + rows * ch + 'px';
    wrap.appendChild(cv); doc.body.appendChild(wrap);
    wrap.addEventListener('click', function () { wrap.remove(); });
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    words.forEach(function (w, i) {
      var x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      ctx.fillStyle = i % 2 ? '#f6f1e6' : '#fbf8ef'; ctx.fillRect(x + 4, y + 4, cw - 8, ch - 8);
      ctx.strokeStyle = '#d8d0bd'; ctx.strokeRect(x + 4.5, y + 4.5, cw - 9, ch - 9);
      V.drawPic(ctx, w.pic, x + cw / 2, y + 92, 150, 0.3);
      ctx.fillStyle = '#3a2b24'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(w.label, x + cw / 2, y + ch - 14);
    });
  }

  // 書き順の照合用の一覧（ひらがな 46 字を番号・矢印・画ごとの色つきで並べる）。もう一度押すと閉じる
  // 今のプロフィールで次の出動の字と why を確認パネルに出す（くじを固定）
  function showTracePlan() {
    var box = doc.getElementById('debug'), pre = doc.getElementById('traceplan');
    if (!pre) { pre = doc.createElement('pre'); pre.id = 'traceplan'; box.appendChild(pre); }
    var r = ui.tracePlan();
    pre.textContent = 'trace-plan ' + r.name + ' 名前の字[' + r.names.join('') + '] 前[' + r.prev.join('') + ']: ' + r.plan.map(function (o) { return o.ch + '(' + o.why + ')'; }).join(' ');
  }

  function toggleTraceSheet(setName) {
    var old = doc.getElementById('tracesheet');
    if (old) { old.remove(); return; }
    var sets = typeof setName === 'string' && M.strokes.SETS[setName] ? [setName] : Object.keys(M.strokes.SETS);   // 省略は全部（#debug:trace-sheet-kata のように 1 つだけも）
    var chars = sets.map(function (k) { return M.strokes.SETS[k]; }).join('').split(''), cols = 6, cw = 200, ch = 240, rows = Math.ceil(chars.length / cols);
    var wrap = doc.createElement('div'); wrap.id = 'tracesheet';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:50;background:#fff;overflow:auto';
    var cv = doc.createElement('canvas'); cv.width = cols * cw; cv.height = rows * ch;
    cv.style.cssText = 'display:block;width:' + cols * cw + 'px;height:' + rows * ch + 'px';
    wrap.appendChild(cv); doc.body.appendChild(wrap);
    wrap.addEventListener('click', function () { wrap.remove(); });
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    chars.forEach(function (c, i) {
      var x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      M.TraceBoard.drawSheet(ctx, c, x + 10, y + 10, cw - 20);
      ctx.fillStyle = '#222'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText((i + 1) + ' ' + c + '  ' + M.strokes.STROKES[c].s.length + '画', x + cw / 2, y + ch - 14);
    });
  }

  function debugPanel(goto) {
    var box = doc.getElementById('debug'); box.hidden = false;
    var err = doc.createElement('pre'); err.id = 'errlog'; err.textContent = '';
    function log(s) { err.textContent += s + '\n'; }
    root.addEventListener('error', function (e) { log('ERROR: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
    root.addEventListener('unhandledrejection', function (e) { log('REJECT: ' + e.reason); });
    function btn(label, fn) { var b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); box.appendChild(b); }
    D.GAMES.forEach(function (game) {
      D.LEVELS[game].forEach(function (lv) {
        btn(lv, function () {
          ui.data.levels[game] = lv; ui.data.locked[game] = true;
          ui.data.stage.unlocked = D.STAGES[Math.max(D.stageIndex(ui.data.stage.unlocked), D.stageIndex(D.stageOf(lv)))].id;   // 確認用: そのレベルのステージを解放して選ぶ
          ui.data.stage.current = D.stageOf(lv);
          ui.setData(ui.data); ui.startSession(game, { fast: true });
        });
      });
    });
    btn('えいご声なし', function (e) {   // 切り替え（もう一度押すと戻る）
      var off = M.speech.enAvailable(); M.speech.forceNoEnglish(off ? undefined : false);
      e.target.textContent = off ? 'えいご声あり' : 'えいご声なし';
    });
    btn('ごほうび', function () { ui.gotoReward('kaji'); });
    btn('ごほうびS2', function () { ui.gotoReward('kaji', 2); });
    btn('全車★3', function () { D.ALL_CARS.forEach(function (c) { ui.data.cards[c.id] = 3; }); ui.setData(ui.data); });
    btn('全車なし', function () { ui.data.cards = {}; ui.setData(ui.data); });
    btn('しゃこ', function () { ui.show('garage'); });
    btn('もじの ひょう', function () { ui.previewMoji(); });
    btn('おうちのひと', function () { ui.show('parent'); });
    btn('こども+', function () { ui.addDummyProfile(); });
    btn('だれ', function () { ui.show('who'); });
    btn('タイトル', function () { ui.show('title'); });
    btn('えいちらん', togglePicGrid);
    btn('かく', function () { ui.startTrace({ fast: true }); });
    btn('かく: じどうで かく', function () { ui.startTrace({ fast: true }); ui.traceAuto(true); });
    btn('書き順一覧', function () { toggleTraceSheet(); });
    btn('かく: たすけ を つける', function () { log('たすけ: ' + ui.traceAddHelp()); });
    btn('かく: つぎの 4じ', function () { showTracePlan(); });
    btn('声なし', function () { M.speech.forceVoiceless(); });
    box.appendChild(err);

    // 画面指定でのジャンプ（スクショ用）
    var g = goto.split('-');
    if (g[0] === 'play') {
      if (g[1] === 'trace') {
        // #debug:play-trace-kata / -k1 / -k2（-の のように 1 字目も指定できる）。k1 は S1、k2 は S2 の札にしてから始める
        var tset = M.strokes.SETS[g[2]] ? g[2] : '', topts = { fast: true };
        if (tset) {
          var tsid = tset === 'k1' ? 'S1' : tset === 'k2' ? 'S2' : 'S0';
          if (D.stageIndex(tsid) > D.stageIndex(ui.data.stage.unlocked)) ui.data.stage.unlocked = tsid;
          ui.data.stage.current = tsid;
          topts.chars = M.trace.charsOfSet(tset);
          if (g[3] && topts.chars.indexOf(g[3]) >= 0) topts.chars = [g[3]].concat(topts.chars.filter(function (c) { return c !== g[3]; }));
        }
        ui.startTrace(topts); if (g[4] === 'auto') ui.traceAuto(true);
        return log;
      }
      var game = g[1] === 'letter' ? 'letter' : g[1] === 'clock' ? 'clock' : g[1] === 'english' ? 'english' : 'math';
      if (g[2]) {
        ui.data.levels[game] = g[2];
        var sid = D.stageOf(g[2]);
        if (sid) { if (D.stageIndex(sid) > D.stageIndex(ui.data.stage.unlocked)) ui.data.stage.unlocked = sid; ui.data.stage.current = sid; }
      }
      ui.startSession(game, { fast: true, scene: g[3] || undefined });
      if (g[4]) root.setTimeout(function () { ui.debugProgress(+g[4]); }, 50);
    } else if (g[0] === 'trace' && g[1] === 'sheet') toggleTraceSheet(g[2]);
    else if (g[0] === 'trace' && g[1] === 'plan') showTracePlan();
    else if (g[0] === 'trace' && g[1] === 'table') ui.previewMoji(g[2]);   // #debug:trace-table（-kata など集合も指定できる）
    else if (g[0] === 'trace') { ui.startTrace({ fast: true }); if (g[1] === 'auto') ui.traceAuto(true); }
    else if (g[0] === 'pics') togglePicGrid();
    else if (g[0] === 'pick') ui.show('pick');
    else if (g[0] === 'reward') ui.gotoReward(g[1] || 'kaji', +g[2] || 0);
    else if (g[0] === 'garage') ui.previewGarage();
    else if (g[0] === 'parent') ui.show('parent');
    else if (g[0] === 'who') ui.show('who');
    return log;
  }

  function start() {
    ui.init();
    var h = parseHash();
    if (h.on) debugPanel(h.goto);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(window);
