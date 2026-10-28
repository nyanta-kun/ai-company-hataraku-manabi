// 画面遷移・イベント・出動の流れ。純粋関数は problems.js / rewards.js、保存は storage.js。
(function (root) {
  'use strict';
  var M = root.Manabi, D = M.data, P = M.problems, R = M.rewards, S = M.storage, PR = M.profiles, LD = M.ladder;
  var LN = M.lines, DL = M.daylog, A = M.audio, SP = M.speech, V = M.vehicles, SC = M.scenes, CF = M.clockface, TR = M.trace, STR = M.strokes, FW = M.freewrite;
  var doc = root.document;

  function $(id) { return doc.getElementById(id); }
  function now() { return root.performance.now() / 1000; }
  function carById(id) { for (var i = 0; i < D.ALL_VEHICLES.length; i++) if (D.ALL_VEHICLES[i].id === id) return D.ALL_VEHICLES[i]; return null; }
  function shelfOfCar(id) { for (var i = 0; i < D.SHELVES.length; i++) if (D.SHELVES[i].ids.indexOf(id) >= 0) return D.SHELVES[i]; return null; }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  var state = S.load();             // v2 全体（device ＋ プロフィール配列）
  var dev = state.device;           // 端末共通（音）
  var data = PR.currentProfile(state);   // 今のプロフィール（state.profiles の要素そのもの）
  var screen = 'title';
  var stage = null;          // 問題画面の Stage
  var run = null;            // 出動中の状態
  var trun = null;           // 「かく」の出動中の状態（run とは別。onAnswer の流れと混ぜない）
  var tstage = null;         // 「かく」の現場の帯の Stage
  var tboard = null;         // なぞりの板（traceboard.js）
  var lastScene = null;
  var timers = [];           // 画面をまたぐタイマー（やめたときに全部消す）
  var token = 0;             // 出動のやり直しで古い処理を無効にする
  var reward = null;         // ごほうび画面の状態
  var titleStart = now();
  var debugMode = false;

  // 現場ごとに出動する車の stage（scenes.js の drawKaji=8, drawTakai=10, drawMichi=4）
  // ---- 日ごとの記録（docs/design-daily-log.md 4・5 章）。記録は data.days に足して今と同じ save() で保存する ----
  var tm = null;   // 出動の画面にいた時間の計測 { t0, hid（隠れていた秒）, hiddenAt }。performance.now() の秒（端末の時計を合わせ直しても飛ばない）
  function timeStart() { tm = { t0: now(), hid: 0, hiddenAt: null }; }
  function timeTake() {   // 終えた・やめたときに 1 回だけ呼ぶ → 秒（隠れていた間を引く。1 回の上限は DL.addTime が決める）
    if (!tm) return 0;
    var t = now(), hid = tm.hid + (tm.hiddenAt === null ? 0 : t - tm.hiddenAt), sec = t - tm.t0 - hid;
    tm = null;
    return sec > 0 ? sec : 0;
  }
  function logTime() { var sec = timeTake(); if (sec > 0) data.days = DL.addTime(data.days, todayStr(), sec); }
  function logChar(game, ch, firstDone, firstSolo) { data.days = DL.recordChar(data.days, todayStr(), { game: game, ch: ch, firstDone: firstDone, firstSolo: firstSolo }); }

  var DISPATCH_STAGE = { kaji: 8, takai: 10, michi: 4 };

  function later(ms, fn) { var id = root.setTimeout(function () { fn(); }, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(root.clearTimeout); timers = []; }
  function save() { S.save(state); }
  // PR の関数は新しい state を返すので、呼んだ後は必ず付け直す（古いプロフィールに書かないため）
  function rebind() { dev = state.device; data = PR.currentProfile(state); }
  function useProfile(id) { state = PR.selectProfile(state, id); rebind(); relockAsk = ''; dlWeek = ''; dlOpen = ''; save(); }

  // ---- ふりがな（design-elementary 3.7）。S1 以降の子ども向け画面（出動えらび・現場・ごほうび・昇格）だけ。S0 は全部ひらがな ----
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // furigana() の結果 → <ruby> つきの HTML。文言は data.js の固定の表だけを通す（子どもの名前など外から来る文字は通さない）
  function rubyHtml(segs) {
    return segs.map(function (g) { return g.r ? '<ruby>' + esc(g.t) + '<rt>' + esc(g.r) + '</rt></ruby>' : esc(g.t); }).join('');
  }
  function kidText(markup) { return rubyHtml(D.furigana(markup, D.allowedKanji(LD.currentStage(data)))); }

  // ---- アイコン（Canvas で描く。画面の文字に頼らない） ----
  function drawIcon(cv, kind) {
    var ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    var dark = '#3a2b24', col = cv.parentNode && /big/.test(cv.parentNode.className) ? '#fff' : dark;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    function ln(x1, y1, x2, y2, lw, c) { ctx.beginPath(); ctx.moveTo(x1 * w, y1 * h); ctx.lineTo(x2 * w, y2 * h); ctx.lineWidth = lw * w; ctx.strokeStyle = c || col; ctx.stroke(); }
    if (kind === 'truck') { V.drawVehicle(ctx, 8, w / 2, h / 2 + h * 0.05, w * 0.95); return; }
    if (kind === 'garage') {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = w * 0.04;
      ctx.beginPath(); ctx.moveTo(w * .08, h * .45); ctx.lineTo(w * .5, h * .12); ctx.lineTo(w * .92, h * .45); ctx.lineTo(w * .92, h * .9); ctx.lineTo(w * .08, h * .9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9fb4c7'; ctx.fillRect(w * .22, h * .5, w * .56, h * .4); ctx.strokeRect(w * .22, h * .5, w * .56, h * .4);
      for (var i = 1; i < 4; i++) ln(.22, .5 + i * .1, .78, .5 + i * .1, .03, dark);
      return;
    }
    if (kind === 'station') {   // 消防署（タイトルの署を小さく）: ベージュの 2 階建て・窓が並ぶ・赤い屋根の帯。シャッターは描かない
      ctx.fillStyle = '#e8d9c3'; ctx.strokeStyle = dark; ctx.lineWidth = w * 0.045; ctx.lineJoin = 'round';
      ctx.fillRect(w * .12, h * .26, w * .76, h * .66); ctx.strokeRect(w * .12, h * .26, w * .76, h * .66);
      ctx.fillStyle = '#e53935'; ctx.fillRect(w * .05, h * .1, w * .9, h * .18); ctx.strokeRect(w * .05, h * .1, w * .9, h * .18);
      for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
        ctx.fillStyle = r === 0 ? '#ffe680' : '#8fb4c9';
        ctx.fillRect(w * (.2 + c * .22), h * (.38 + r * .26), w * .16, h * .17); ctx.strokeRect(w * (.2 + c * .22), h * (.38 + r * .26), w * .16, h * .17);
      }
      return;
    }
    if (kind === 'kazu') {   // ● ● ●
      [[.25, .35], [.5, .35], [.75, .35], [.37, .68], [.63, .68]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0] * w, p[1] * h, w * .1, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); });
      return;
    }
    if (kind === 'moji') {   // あ
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + h * .85 + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('あ', w / 2, h * .54);
      return;
    }
    if (kind === 'eigo') {   // 吹き出しに ABC（ことば／きく）
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.moveTo(w * .14, h * .2); ctx.lineTo(w * .86, h * .2); ctx.quadraticCurveTo(w * .94, h * .2, w * .94, h * .3); ctx.lineTo(w * .94, h * .56);
      ctx.quadraticCurveTo(w * .94, h * .66, w * .86, h * .66); ctx.lineTo(w * .46, h * .66); ctx.lineTo(w * .28, h * .86); ctx.lineTo(w * .3, h * .66);
      ctx.lineTo(w * .14, h * .66); ctx.quadraticCurveTo(w * .06, h * .66, w * .06, h * .56); ctx.lineTo(w * .06, h * .3); ctx.quadraticCurveTo(w * .06, h * .2, w * .14, h * .2);
      ctx.fill();
      ctx.fillStyle = '#8e44ad'; ctx.font = 'bold ' + h * .27 + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ABC', w / 2, h * .44);
      return;
    }
    if (kind === 'tokei') {  // 丸い時計（短針は太く短く、長針は細く長く）
      ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .42, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      ln(.5, .5, .5, .2, .06, '#e53935'); ln(.5, .5, .72, .6, .12, '#1e5bd8');
      ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .06, 0, 7); ctx.fillStyle = dark; ctx.fill();
      return;
    }
    if (kind === 'speaker' || kind === 'speakerx') {
      var c = /replay/.test(cv.parentNode.className) ? '#fff' : dark;
      ctx.fillStyle = c; ctx.beginPath();
      ctx.moveTo(w * .12, h * .38); ctx.lineTo(w * .3, h * .38); ctx.lineTo(w * .52, h * .18); ctx.lineTo(w * .52, h * .82); ctx.lineTo(w * .3, h * .62); ctx.lineTo(w * .12, h * .62); ctx.closePath(); ctx.fill();
      if (kind === 'speaker') {
        ctx.strokeStyle = c; ctx.lineWidth = w * .07;
        ctx.beginPath(); ctx.arc(w * .52, h * .5, w * .2, -0.9, 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(w * .52, h * .5, w * .35, -0.9, 0.9); ctx.stroke();
      } else { ln(.62, .32, .92, .68, .09, '#e53935'); ln(.92, .32, .62, .68, .09, '#e53935'); }
      return;
    }
    if (kind === 'gear') {
      ctx.fillStyle = dark;
      for (var k = 0; k < 8; k++) { ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(k * Math.PI / 4); ctx.fillRect(-w * .07, -h * .45, w * .14, h * .2); ctx.restore(); }
      ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .32, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .13, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      return;
    }
    if (kind === 'pencil') {   // えんぴつ（かく）
      ctx.save(); ctx.translate(w * .5, h * .5); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-w * .1, -h * .36, w * .2, h * .52);
      ctx.fillStyle = '#f2a6a6'; ctx.fillRect(-w * .1, -h * .46, w * .2, h * .1);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-w * .1, h * .16); ctx.lineTo(w * .1, h * .16); ctx.lineTo(0, h * .38); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-w * .03, h * .32); ctx.lineTo(w * .03, h * .32); ctx.lineTo(0, h * .38); ctx.closePath(); ctx.fill();
      ctx.restore();
      return;
    }
    if (kind === 'undo') {   // もどす（左にまわる矢印）
      ctx.strokeStyle = dark; ctx.lineWidth = w * .11;
      ctx.beginPath(); ctx.arc(w * .52, h * .55, w * .27, Math.PI * 1.15, Math.PI * 2.15); ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(w * .14, h * .3); ctx.lineTo(w * .42, h * .14); ctx.lineTo(w * .4, h * .46); ctx.closePath(); ctx.fill();
      return;
    }
    if (kind === 'check') { ln(.2, .54, .42, .76, .14, '#fff'); ln(.42, .76, .82, .26, .14, '#fff'); return; }
    if (kind === 'solo') {   // えんぴつと星（ひとりで かく）
      ctx.save(); ctx.translate(w * .42, h * .56); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-w * .09, -h * .3, w * .18, h * .42);
      ctx.fillStyle = '#f2a6a6'; ctx.fillRect(-w * .09, -h * .39, w * .18, h * .09);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-w * .09, h * .12); ctx.lineTo(w * .09, h * .12); ctx.lineTo(0, h * .32); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-w * .03, h * .26); ctx.lineTo(w * .03, h * .26); ctx.lineTo(0, h * .32); ctx.closePath(); ctx.fill();
      ctx.restore();
      var sx = w * .76, sy = h * .27, sr = w * .17;
      ctx.fillStyle = '#fff'; ctx.beginPath();
      for (var q = 0; q < 10; q++) { var rr = q % 2 ? sr * .45 : sr, an = -Math.PI / 2 + q * Math.PI / 5; ctx.lineTo(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr); }
      ctx.closePath(); ctx.fill();
      return;
    }
    if (kind === 'crown') {   // 金の王冠（きょうの しゅつどう。とくに がんばった 1 つだけ）
      ctx.beginPath(); ctx.moveTo(w * .1, h * .82); ctx.lineTo(w * .06, h * .26); ctx.lineTo(w * .3, h * .5); ctx.lineTo(w * .5, h * .14); ctx.lineTo(w * .7, h * .5); ctx.lineTo(w * .94, h * .26); ctx.lineTo(w * .9, h * .82); ctx.closePath();
      ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = w * .06; ctx.strokeStyle = '#b87a00'; ctx.stroke();
      ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(w * .5, h * .64, w * .07, 0, 7); ctx.fill();
      return;
    }
    if (kind === 'back') { ln(.62, .2, .3, .5, .12); ln(.3, .5, .62, .8, .12); return; }
    if (kind === 'x') { ln(.25, .25, .75, .75, .12); ln(.75, .25, .25, .75, .12); }
  }
  function drawAllIcons() { [].forEach.call(doc.querySelectorAll('canvas[data-icon]'), function (cv) { drawIcon(cv, cv.getAttribute('data-icon')); }); }

  // ---- プロフィールの絵・名札 ----
  // 車の絵を canvas に描く（枠は 4:3。css の大きさに合わせて解像度を決める）
  function drawCarIcon(cv, carId) {
    var car = carById(carId); if (!car) return;
    var dpr = root.devicePixelRatio || 1, w = cv.clientWidth || 44, h = Math.round(w * 0.75);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d'); ctx.setTransform(cv.width / w, 0, 0, cv.height / h, 0, 0);
    V.drawVehicle(ctx, car.stage, w / 2, h * 0.45, w * 0.85);
  }
  // 要素の中に「車の絵 + 名前」を作る（名前は textContent で入れる）
  function fillBadge(el, p) {
    el.textContent = '';
    var cv = doc.createElement('canvas'), sp = doc.createElement('span');
    sp.textContent = p.name;
    el.appendChild(cv); el.appendChild(sp);
    cv.setAttribute('data-car', p.icon);
    drawCarIcon(cv, p.icon);   // DOM に入れた後に描く（clientWidth を使うため）
  }
  function updateBadges() {
    fillBadge($('btn-who'), data);
    fillBadge($('pick-badge'), data);
    [].forEach.call(doc.querySelectorAll('.who-tag'), function (e) { fillBadge(e, data); });
  }
  function buildWho() {
    var box = $('who-list'); box.textContent = '';
    PR.orderForPicker(state).forEach(function (p) {
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'who-btn';
      var cv = doc.createElement('canvas'), sp = doc.createElement('span');
      sp.textContent = p.name; b.appendChild(cv); b.appendChild(sp); box.appendChild(b);
      b.addEventListener('click', function () {
        sfx('tap'); useProfile(p.id); show('title');
        say(LN.who(p.name).text, { alt: LN.who(p.name).alt });   // 名前は端末の声。声が無いときだけ、名前を抜いた文を音声ファイルで
      });
      drawCarIcon(cv, p.icon);
    });
  }

  // ---- 画面切替 ----
  var lockUntil = 0;
  function show(name) {
    screen = name;
    if (name !== 'reward') clearTimers();   // ごほうびの「げっと」などを画面を離れたら止める
    lockUntil = now() + 0.4;                // 遷移直後の二度押しを無視
    if (name !== 'play' && name !== 'reward') SP.cancel();
    [].forEach.call(doc.querySelectorAll('.screen'), function (s) { s.classList.toggle('active', s.id === 's-' + name); });
    updateVoiceMark();
    if (name === 'who') { buildWho(); later(300, function () { say(LN.FIXED.who); }); }
    if (name === 'title') { updateBadges(); drawTitle(); updateTodayStrip(); kick(); }
    if (name === 'today') startToday();
    if (name === 'pick') { updateBadges(); updatePick(); later(300, function () { say(LN.FIXED.pick); }); }
    if (name === 'garage') buildGarage();
    if (name === 'parent') { dlWeek = ''; dlOpen = ''; fillParent(); }
    if (name === 'play' && stage) { stage.resize(); stage.draw(now()); }
    if (name === 'reward') startRewardAnim();
    if (name === 'promote') startPromoteAnim();
  }
  // 出動えらびの「えいご」: 英語の声が使えないときは選べない（グレー＋スピーカー×）。開くたび・声の状態が変わるたびに見直す
  // 英語が聞こえない状態（声が無い／失敗した／保護者がよみあげをオフにした）。えいごは聞いて選ぶので、この間は成立しない
  function enOff() { return !SP.enAvailable() || !dev.sound.voice; }
  // ステージの札: 解放済みが 2 つ以上のときだけ出す（S0 だけの子は今までと同じ画面）。未解放は出さない
  function stageIdx() { return D.stageIndex(LD.currentStage(data)); }
  function buildStageTabs() {
    var box = $('stage-tabs'), top = D.stageIndex(data.stage.unlocked);
    box.textContent = ''; box.hidden = top < 1; box.classList.toggle('three', top >= 2);   // 3 つ並ぶとき（S2）は iPhone 縦で収まるよう札を少し詰める
    if (top < 1) return;
    var cur = stageIdx();
    D.STAGES.slice(0, top + 1).forEach(function (stg, i) {
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'stage-tab' + (i === cur ? ' sel' : '');
      b.setAttribute('aria-pressed', i === cur ? 'true' : 'false');
      var cv = doc.createElement('canvas'), sp = doc.createElement('span');
      sp.textContent = stg.short; b.appendChild(cv); b.appendChild(sp); box.appendChild(b);
      var dpr = root.devicePixelRatio || 1; cv.width = Math.round(34 * dpr); cv.height = Math.round(40 * dpr);
      var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); SC.drawWappen(ctx, 17, 19, 30, i, 0);
      b.addEventListener('click', function () {
        if (i === stageIdx()) return;
        sfx('tap'); replaceData(LD.selectStage(data, stg.id)); save(); buildStageTabs(); updatePickSub();
      });
    });
  }
  function replaceData(np) { Object.keys(np).forEach(function (k) { data[k] = np[k]; }); }   // data は state.profiles の要素そのものなので、中身を差し替える
  // 出動えらびの一行（S1 以降だけ。ふりがな付き）。S0 の子には今までと同じ画面。札で S0 に切り替えたときも消す
  function updatePickSub() {
    var sub = $('pick-sub'); sub.hidden = stageIdx() < 1; sub.classList.toggle('s2', stageIdx() >= 2);
    sub.innerHTML = sub.hidden ? '' : kidText(stageIdx() >= 2 ? D.TEXT.pickSub2 : D.TEXT.pickSub);   // S2 は K9 の字も使う別の一行。S1 は今までのまま
  }
  function updatePick() {
    buildStageTabs(); updatePickSub();
    var b = $('btn-english'); if (!b) return;
    var off = enOff();
    b.classList.toggle('disabled', off); b.setAttribute('aria-disabled', off ? 'true' : 'false');
  }
  function updateVoiceMark() {
    var x = dev.sound.voice && SP.isVoiceless();
    [].forEach.call(doc.querySelectorAll('.voice-x'), function (e) { e.hidden = !x; });
    var sound = $('btn-sound').querySelector('canvas');
    sound.setAttribute('data-icon', dev.sound.sfx || dev.sound.voice ? 'speaker' : 'speakerx');
    drawIcon(sound, sound.getAttribute('data-icon'));
  }

  // ---- 音 ----
  var appliedSpeaker = null;   // 声が変わったときだけ SP.setSpeaker（選び直しで鳴っている音を止めない）
  function applySound() {
    A.setEnabled(dev.sound.sfx); SP.setEnabled(dev.sound.voice);
    if (appliedSpeaker !== dev.sound.speaker) { appliedSpeaker = dev.sound.speaker; SP.setSpeaker(dev.sound.speaker); }
  }
  function sfx(name, arg) { A.play(name, arg); }
  function say(text, opts) { return SP.speak(text, opts); }
  function seq(items, opts) { return SP.speakSeq(items, opts); }
  var unlocked = false;
  function unlockOnce() {
    A.unlock();                       // タップのたびに resume を試みる（タッチは pointerup/click で許可されるため）
    if (unlocked) return; unlocked = true;
    SP.init();
  }

  // ---- 長押し（誤タップ防止） ----
  // 短く離したら「ながおし」の吹き出しを出す（タップしても何も起きないと、こわれていると思われるため）
  function holdButton(el, ms, cb) {
    var id = 0, hintId = 0;
    function stop() { if (id) { root.clearTimeout(id); id = 0; } el.classList.remove('holding'); }
    function hint() {
      el.classList.add('hint'); root.clearTimeout(hintId);
      hintId = root.setTimeout(function () { el.classList.remove('hint'); }, 2500);
    }
    el.addEventListener('pointerdown', function (e) {
      unlockOnce(); stop(); el.classList.remove('hint'); el.classList.add('holding');
      if (el.setPointerCapture && e.pointerId != null) { try { el.setPointerCapture(e.pointerId); } catch (er) {} }   // 指が少しずれても押したままにする
      id = root.setTimeout(function () { id = 0; el.classList.remove('holding'); cb(); }, ms);
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, function () { if (id) hint(); stop(); }); });   // 端末に取り消されたときも案内を出す
    el.addEventListener('pointerleave', stop);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // ---- タイトル ----
  function litWindows() { return Math.min(4, data.stats.sessions); }
  function sizeCanvas(cv) {
    var dpr = root.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var ctx = cv.getContext('2d'); ctx.setTransform(cv.width / w, 0, 0, cv.height / h, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }
  function drawTitle() {
    var c = sizeCanvas($('titleCanvas'));
    SC.drawTitle(c.ctx, c.w, c.h, now() - titleStart + 1.2, litWindows(), stageIdx());   // S2 だけ消防署の見た目が少し変わる
  }

  // ---- 出動 ----
  function pickScene() {
    var list = D.SCENES.filter(function (s) { return s !== lastScene; });
    var s = list[Math.floor(Math.random() * list.length)];
    lastScene = s; return s;
  }

  // 国語で直近に出した絵（古い順・最大 12 個）。出動が始まって問題が決まった時点で記録する（途中でやめても「見た」とみなす）
  function seenLetter() { return data.seen && Array.isArray(data.seen.letter) ? data.seen.letter : []; }
  function rememberLetter(qs) {
    data.seen = data.seen || { letter: [] };
    data.seen.letter = D.addSeen(seenLetter(), qs.map(function (q) { return q.pic; }));
    save();
  }
  function startSession(game, opts) {
    opts = opts || {};
    clearTimers(); token++;
    var pl = LD.playLevel(data, game), level = pl.level;   // 下のステージで遊ぶとき（復習）は進み具合を変えない
    var qs = P.generateSession(game, level, Math.random, game === 'letter' ? seenLetter() : undefined);
    if (game === 'letter' && !P.LETTER[level].form) rememberLetter(qs);   // K7・K8 の絵は「直近の絵」に入れない（K1〜K6 の出方を変えない）
    timeStart();
    run = {
      game: game, level: level, review: pl.review, scene: opts.scene || pickScene(), qs: qs,
      idx: 0, firstTry: 0, wrong: 0, off: [], busy: true, token: token
    };
    if (!stage) stage = new SC.Stage($('sceneCanvas'));
    SP.prefetch(LN.sessionTexts(qs));   // 4 問ぶんの音声を先に読んでおく（声が端末の声のときは何もしない）
    show('play');
    stage.setScene(run.scene); stage.setRank(stageIdx());   // 現場の救助隊の車は「いま選んでいるステージ」で決める（ごほうびの抽選は遊んだレベル）
     stage.setProgress(0);
    updateLamps(0);
    stage.resize();
    sfx(A.carSound(DISPATCH_STAGE[run.scene]));   // 出動する車の音（現場ごと）
    say(LN.FIXED.dispatch);
    stage.setProblem(null); stage.draw(now());
    later(opts.fast ? 0 : 1500, function () { presentQuestion(); });
  }
  function updateLamps(n) {
    [].forEach.call($('lamps').children, function (e, i) { e.classList.toggle('on', i < n); });
  }
  var promptText = LN.prompt, carYomi = LN.carYomi;   // 読み上げ文は src/lines.js

  // 問題の読み上げ。えいごは「英語」→（短い間）→「日本語の補助」。英語の声が無ければ日本語だけ
  function sayPrompt(q) {
    if (q.kind === 'english') return seq([{ text: q.en, lang: 'en' }, { text: promptText(q), lang: 'ja', gap: 350 }]);
    return say(promptText(q));
  }
  // 英語のつづりを字幕で出す。英語の声が途中で使えなくなったら、1回目の誤答で正解を光らせる（plan 3.4）
  function syncCaption() {
    if (!run || run.game !== 'english' || !stage) return;
    // つづりは出す（発音と一緒に確かめられるように）。ただし E4（いろ）・E5（大文字）は つづりが答え（red・B）なので、正解するまで出さない
    var q = run.qs[run.idx], hideUntilOk = !!q && (q.form === 'alpha' || q.form === 'color'), want = q && (!hideUntilOk || stage.reveal) ? q.en : '';
    if ((stage.caption || '') !== want) { stage.setCaption(want); kick(); }
    // 1回目の誤答のあとで英語の失敗が確定したときも、その問題の正解を光らせる
    if (enOff() && run.wrong >= 1 && !run.busy) answerButtons().forEach(function (b) { if (b.getAttribute('data-v') === String(q.answer)) b.classList.add('glow'); });
  }
  function presentQuestion() {
    var q = run.qs[run.idx];
    run.wrong = 0; run.off = []; run.busy = false; run.counting = false; run.t0 = now();
    stage.setProblem(q);
    renderAnswers(q);
    stage.resize();   // 答えボタンの高さで現場の領域が変わる（時計ボタンは高い）ので測り直す
    stage.draw(now());
    sayPrompt(q);
    if (q.kind === 'letter') stage.bouncePic(now() + 0.3);
    if (q.kind === 'english') { stage.bouncePic(now() + 0.3); syncCaption(); }
    kick();
  }
  function renderAnswers(q) {
    var box = $('answers'); box.innerHTML = '';
    var pickClock = q.kind === 'clock' && (q.form === 'pick' || q.form === 'elapsed'), pickPic = q.kind === 'english' && (q.form === 'word' || q.form === 'color');
    box.className = pickClock || (pickPic && q.choices.length > 3) ? 'clocks' : ((q.kind === 'clock' && q.form === 'readmin') || q.level === 'K7' ? 'twocol' : '');   // 4択の絵は 1 列だと小さいので時計と同じ 2×2。「11:34」・拗音（しょ）は幅が狭い画面だけ 2×2
    q.choices.forEach(function (c) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = pickClock ? 'ans clk' : pickPic ? 'ans pic' : 'ans'; b.setAttribute('data-v', String(c));
      if (pickClock || pickPic) b.innerHTML = '<canvas></canvas>';
      else if (q.kind === 'clock' && q.form === 'ampm') b.innerHTML = '<span class="ampm-l">' + D.AMPM_LABEL[c] + '<small>' + q.h + 'じ' + (q.m === 30 ? 'はん' : '') + '</small></span>';   // T8: 「ごぜん 7じ」「ごご 7じ」（ひらがな）
      else if (q.kind === 'clock') b.innerHTML = '<span class="num">' + c + '</span>';
      else if (q.kind === 'english' && q.form === 'alpha') b.innerHTML = '<span class="kana">' + c + '</span>';   // E5: 大文字
      else if (q.kind === 'letter') b.innerHTML = '<span class="kana' + (c.length > 1 ? ' two' : '') + '">' + c + '</span>';   // 拗音（しょ）は 2 文字なので少し小さく
      else if (q.kind === 'mul' || q.choices.some(function (v) { return v > 10; })) b.innerHTML = '<span class="num">' + c + '</span>';   // 11 以上は数字だけ（点は 10 まで。S1 の子は数字が読める）
      else {
        var dots = '';
        for (var i = 0; i < c; i++) { dots += '<i></i>'; if (i === 4 && c > 5) dots += '<b></b>'; }
        b.innerHTML = '<span class="num">' + c + '</span><span class="dots">' + dots + '</span>';
      }
      box.appendChild(b);
    });
    if (pickClock) drawAnswerClocks(0);
    if (pickPic) drawAnswerPics();
  }
  function englishOf(id) { for (var i = 0; i < D.ENGLISH_WORDS.length; i++) if (D.ENGLISH_WORDS[i].id === id) return D.ENGLISH_WORDS[i]; return null; }
  // えいご E1: 乗り物の絵の答えボタンを描く
  function drawAnswerPics() {
    [].forEach.call($('answers').querySelectorAll('.ans.pic'), function (b) {
      var cv = b.querySelector('canvas'), c = sizeCanvas(cv), key = b.getAttribute('data-v'), q = run && run.qs && run.qs[run.idx];
      c.ctx.clearRect(0, 0, c.w, c.h);
      if (q && q.form === 'color') { var col = P.colorOf(key); if (col) V.drawColorCar(c.ctx, c.w / 2, c.h / 2, Math.min(c.w, c.h) * 0.8, col.hex); return; }   // E4: 色ちがいの同じ車
      var w = englishOf(key);
      if (w) V.drawPic(c.ctx, w.pic, c.w / 2, c.h / 2, Math.min(c.w, c.h) * 0.8, 0);
    });
  }
  // 小さい時計の答えボタンを描く。pulseKey の時計だけ短針をふくらませる（ヒント）
  function drawAnswerClocks(pulse, pulseKey) {
    if (!CF) return;
    var cq = run && run.qs && run.qs[run.idx], tk = cq && cq.ticks === 60 ? 60 : 12;
    var both = !!cq && cq.kind === 'clock' && !!P.CLOCK[cq.level].hintBoth;   // T4 以降は短針がほぼ同じ組が出るので、長針も一緒にふくらませる
    [].forEach.call($('answers').querySelectorAll('.ans.clk'), function (b) {
      var cv = b.querySelector('canvas'), c = sizeCanvas(cv), key = b.getAttribute('data-v');
      c.ctx.clearRect(0, 0, c.w, c.h);
      CF.drawClock(c.ctx, c.w / 2, c.h / 2, Math.min(c.w, c.h) / 2 - 2, key, { numbers: 12, ticks: tk, pulse: key === pulseKey ? pulse : 0, pulseMin: both && key === pulseKey ? pulse : 0 });
    });
  }
  function answerButtons() { return [].slice.call($('answers').children); }

  function onAnswer(btn) {
    if (!run || run.busy || btn.classList.contains('off')) return;
    var q = run.qs[run.idx], raw = btn.getAttribute('data-v');
    var v = typeof q.answer === 'string' ? raw : +raw;   // 国語・時計の選ぶ形・時計の「3:17」・えいごの語は文字列、数は数
    if (v === q.answer) return onCorrect(q, btn);
    run.wrong++;
    run.off.push(v);
    btn.classList.add('off', 'shake'); btn.classList.remove('glow');
    sfx('oshii');
    if (q.kind === 'english') seq([{ text: q.form === 'word' ? englishOf(v).en : q.form === 'color' ? P.colorOf(v).en : q.form === 'alpha' ? v : D.NUM_EN[v], lang: 'en' }, { text: LN.FIXED.oshii, lang: 'ja', gap: 250 }]);
    else say(LN.wrong(q, v));
    var left = answerButtons().filter(function (b) { return !b.classList.contains('off'); });
    var voiceless = SP.isVoiceless() || !dev.sound.voice, enOff_ = enOff();
    if (run.wrong >= 2 || left.length <= 1 || ((q.kind === 'letter' || (q.kind === 'clock' && P.CLOCK[q.level].glowWhenVoiceless)) && voiceless) || (q.kind === 'english' && enOff_)) {
      later(900, function () {
        if (!run || run.busy) return;
        answerButtons().forEach(function (b) { if (b.getAttribute('data-v') === String(q.answer)) b.classList.add('glow'); });
        if (q.kind === 'clock') {
          say(LN.hint(q));
          if (q.form === 'read' || q.form === 'readmin') stage.pulseHour(now()); else run.pulse = { key: q.answer, t0: now() };
        } else if (q.kind === 'english') {
          seq([{ text: q.en + '?', lang: 'en' }, { text: LN.FIXED.hint, lang: 'ja', gap: 250 }]);
          stage.bouncePic(now());
        } else say(LN.hint(q));
        if (q.kind === 'count' || q.kind === 'add' || q.kind === 'sub' || q.kind === 'mul') countAloud(q);
        else if (q.kind === 'letter') stage.bouncePic(now());
        kick();
      });
    }
  }
  // 数えるものを 1 つずつ光らせて数え聞かせる
  function countAloud(q) {
    if (run.counting) return;               // 数え聞かせ中は二重に始めない
    run.counting = true;
    var my = run.token, total = stage.items.length;
    stage.clearMarks();
    var tick = function (i) {
      if (!run || run.token !== my) return;
      if (run.busy || i >= total) { run.counting = false; return; }
      var n = stage.mark(i);
      stage.bounce(i, now());
      sfx('pon', n); say(LN.number(n)); kick();
      later(800, function () { tick(i + 1); });
    };
    later(1200, function () { tick(0); });
  }

  function onCorrect(q, btn) {
    run.busy = true; run.counting = false; stage.reveal = true; syncCaption();
    var first = run.wrong === 0;
    if (first) run.firstTry++;
    answerButtons().forEach(function (b) { b.classList.remove('glow'); });
    sfx('correct');
    var done = run.idx + 1, my0 = run.token;
    run.countWait = false;
    if (q.kind !== 'english') say(LN.correct(q));
    else {
      var ok = [{ text: LN.FIXED.so, lang: 'ja' }, { text: q.en + '!', lang: 'en' }];
      if (q.form === 'number') ok.push({ text: D.NUM_EN.slice(1, q.n + 1).join(', '), lang: 'en', gap: 300 });   // 数のものを 1 つずつ数える（1 回の読み上げ）
      if (q.form === 'number') { run.countWait = true; if (!seq(ok, { onend: function () { if (run && run.token === my0) run.countWait = false; } })) run.countWait = false; }
      else seq(ok);
    }
    updateLamps(done);
    later(700, function () {
      sfx(run.scene === 'kaji' ? 'water' : run.scene === 'takai' ? 'ladder' : 'dig');
      sfx('horn');
      if (done === P.QUESTIONS_PER_SESSION && run.scene === 'michi') later(900, function () { if (run && run.token === my0) sfx(A.carSound(7)); });   // きゅうきゅうしゃ到着
    });
    stage.advance(done, now(), done === P.QUESTIONS_PER_SESSION ? 2.4 : 1.6);
    kick();
    var my = run.token;
    var t0 = now(), minMs = done === P.QUESTIONS_PER_SESSION ? 3300 : 2300;
    function advanceWhenReady() {   // えいごの数え上げ（one, two, ...）は最後まで聞かせる。終わらなくても 15 秒で進む
      if (!run || run.token !== my) return;
      if (run.countWait && now() - t0 < 15) { later(200, advanceWhenReady); return; }
      run.idx++;
      if (run.idx >= P.QUESTIONS_PER_SESSION) finishSession(); else presentQuestion();
    }
    later(minMs, advanceWhenReady);
  }

  // ---- かく（なぞりがき。design-tracing 4.6）。階段・関門には入れない。S0 は ひらがな → カタカナ（W3）----
  function updateTraceLamps(n) { [].forEach.call($('trace-lamps').children, function (e, i) { e.classList.toggle('on', i < n); }); }
  function layoutTrace() {
    if (!tboard) return;
    var a = $('trace-boardarea'), cs = root.getComputedStyle(a);   // 余白は CSS の padding（下は safe-area 込み）を引く
    var padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0), padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var B = Math.min(a.clientWidth - padX, a.clientHeight - padY, 640);
    tboard.layout(B);
    if (tstage) tstage.resize();
  }
  var tracePrompt = LN.tracePrompt;   // 読み上げ文は src/lines.js
  // 前の出動の字（プロフィールの id ごとに 1 回分。保存しない＝アプリを閉じれば消える。W5）
  var prevTrace = {};
  // 次の出動の組み方（startTrace と #debug:trace-plan で共通）。→ { plan, chars, names }
  function planTrace(opts, rng) {
    opts = opts || {};
    var chars = opts.chars || TR.charsOfSet(opts.set || TR.traceSet(data.trace, LD.currentStage(data)));
    var kanji = chars.length > 0 && chars.every(function (c) { return c >= '\u4e00'; });   // 漢字だけの集合では名前の枠を使わない
    var plan = TR.planTraceSession(chars, data.trace, { n: P.QUESTIONS_PER_SESSION, name: data.name, prev: prevTrace[data.id] || [], chosen: opts.chosen || '', kanji: kanji }, rng || Math.random);
    return { plan: plan, chars: chars, names: kanji ? [] : TR.nameTraceChars(data.name, chars) };
  }
  function traceInfoAt(i) {
    var pl = trun && trun.plan[i]; if (!pl) return null;
    var nm = null;
    trun.names.forEach(function (o) { if (o.ch === pl.ch) nm = o; });
    return { why: pl.why, name: data.name, exact: !!(nm && nm.exact), at: nm ? nm.at : -1 };
  }
  // 現場の帯の隅の名札（車の絵と名前。いまの字に当たる字だけ色を付ける）。名前の枠の字のときだけ出す
  function showNameTag(info) {
    var tag = $('trace-nametag'); if (!tag) return;
    tag.textContent = '';
    if (!info || info.why !== 'name') { tag.hidden = true; return; }
    tag.hidden = false;
    var cv = doc.createElement('canvas'), sp = doc.createElement('span');
    cv.setAttribute('data-car', data.icon);
    tag.appendChild(cv); tag.appendChild(sp);
    data.name.split('').forEach(function (c, i) {
      var e = doc.createElement('b'); e.textContent = c; if (i === info.at) e.className = 'on'; sp.appendChild(e);
    });
    drawCarIcon(cv, data.icon);
  }
  function startTrace(opts) {
    opts = opts || {};
    var pl = planTrace(opts);
    launchTrace(pl.plan, pl.names, opts, false);
  }
  // なぞり・ひとりで かく の出動の始まり（solo: 線なしで書く）
  function launchTrace(plan, names, opts, solo) {
    clearTimers(); token++; run = null;
    timeStart();
    var chars = plan.map(function (o) { return o.ch; });
    trun = { chars: chars, plan: plan, names: names, idx: 0, scene: opts.scene || pickScene(), token: token, helpSaid: false, wrote: [], pid: data.id, solo: !!solo, told: false, nazori: false, phase: 'write', auto: opts.auto || '' };
    if (!tboard) tboard = new M.TraceBoard($('trace-board'), {
      onStrokeDone: function (i, auto, last) { if (trun && !last) sfx('pon', i + 1); },
      onBad: function (result, m) {
        if (!trun) return;
        if (result === 'off' || result === 'short') sfx('oshii');
        if (m === 1 && !trun.helpSaid) { trun.helpSaid = true; say(LN.FIXED.roundStart); }
        else if (m === 3) say(LN.FIXED.together);
      },
      onAssist: function () { if (trun) say(LN.FIXED.assisted); },
      onCharDone: onTraceCharDone,
      onInk: updateSoloTools,
      onIdle: nudgeSoloCard
    });
    SP.prefetch(LN.traceTexts(chars));
    show('trace');
    $('s-trace').classList.toggle('solo', !!solo); $('s-trace').classList.remove('nazori');
    if (!tstage) tstage = new SC.Stage($('traceField'));
    tstage.noBoard = true; tstage.setScene(trun.scene); tstage.setRank(stageIdx()); tstage.setProgress(0); tstage.setProblem(null);
    updateTraceLamps(0); showNameTag(null);
    tboard.setWidth(TR.traceWidth(data.trace, LD.currentStage(data)));
    tboard.stop(); layoutTrace(); tstage.resize(); tstage.draw(now());
    sfx(A.carSound(DISPATCH_STAGE[trun.scene]));
    say(LN.FIXED.dispatch);
    later(opts.fast ? 0 : 1200, presentTraceChar);
    kick();
  }
  function presentTraceChar() {
    if (!trun) return;
    if (trun.solo) { presentSoloChar(); return; }
    var ch = trun.chars[trun.idx];
    trun.helpSaid = false;
    tboard.setChar(ch, !(data.trace.done[ch] > 0));   // 初めて書く字だけ、全部の画のお手本を流す（T8）
    var info = traceInfoAt(trun.idx);
    showNameTag(info);
    say(tracePrompt(ch, info), { alt: LN.tracePromptAlt(ch, info) });
    kick();
  }
  function onTraceCharDone(info) {
    if (!trun) return;
    var ch = info.ch;
    trun.wrote.push(ch);
    logChar(trun.solo ? 'solo' : 'trace', ch, !(data.trace.done[ch] > 0), false);   // recordTraceChar の前に「初めて」を見る
    data.trace = TR.recordTraceChar(data.trace, ch, info);   // 途中でやめても、書けた字は数える。maxM >= 2 なら たすけの回数も足す
    data.stats.trace.chars++; if (info.clean) data.stats.trace.clean++;
    save();
    // ひとりで かく で合わなかった字を なぞり終えたとき（done は 1 回の出動で 1 だけ増える）
    stepAfterChar(ch, LN.traceDone(ch, trun.nazori));
  }
  // 1 字書けたあと（なぞり・ひとりで・なぞって）の共通: ランプ・音・現場が 1 段すすむ・次の字
  function stepAfterChar(ch, word) {
    var done = trun.idx + 1, my = trun.token;
    updateTraceLamps(done);
    sfx('correct'); say(word);
    later(700, function () {
      sfx(trun && trun.scene === 'kaji' ? 'water' : trun && trun.scene === 'takai' ? 'ladder' : 'dig');
      sfx('horn');
    });
    tstage.advance(done, now(), done === P.QUESTIONS_PER_SESSION ? 2.4 : 1.6);
    kick();
    later(done === P.QUESTIONS_PER_SESSION ? 3300 : 2300, function () {
      if (!trun || trun.token !== my) return;
      trun.idx++;
      if (trun.idx >= P.QUESTIONS_PER_SESSION) finishTrace(); else presentTraceChar();
    });
  }

  // ---- ひとりで かく（線なしで書く。design-tracing 13.9）----
  var prevSolo = {};       // 前の ひとりで かく の字（プロフィールの id ごと。保存しない）
  var soloCard = { ch: '', t0: 0 };
  var soloInviteSaid = {};
  var soloDebugOn = false;
  function soloChars() { return FW.soloReady(TR.charsOfSet(TR.traceSet(data.trace, LD.currentStage(data))), data.trace); }
  function soloAvailable() { return soloChars().length >= P.QUESTIONS_PER_SESSION; }
  // 誘い: その集合の字をひととおり なぞった（1 回以上）が、まだ全部は ひとりで書けていない
  function soloInviteSet() {
    var sets = FW.DEFAULTS.SOLO_SETS;
    for (var i = 0; i < sets.length; i++) {
      var cs = STR.SETS[sets[i]] ? STR.SETS[sets[i]].split('') : [];
      if (cs.length && FW.soloInvite(cs, data.trace) && !FW.soloLicense(data.trace, sets[i])) return sets[i];
    }
    return '';
  }
  function startSolo(opts) {
    opts = opts || {};
    var plan = opts.chars ? opts.chars.map(function (c) { return { ch: c, why: 'new' }; })
      : FW.pickSoloChars(TR.charsOfSet(TR.traceSet(data.trace, LD.currentStage(data))), data.trace, { n: P.QUESTIONS_PER_SESSION, name: data.name, prev: prevSolo[data.id] || [], chosen: opts.chosen || '' }, Math.random);
    if (!opts.chars && plan.length < P.QUESTIONS_PER_SESSION) { startTrace(opts); return; }   // 出せる字が足りないときは なぞり（4 字そろわないと 1 回が組めない）
    if (!plan.length) { startTrace(opts); return; }
    launchTrace(plan, [], opts, true);
  }
  var soloPrompt = LN.soloPrompt;
  function presentSoloChar() {
    var ch = trun.chars[trun.idx];
    trun.helpSaid = false; trun.told = false; trun.nazori = false; trun.phase = 'write';
    $('s-trace').classList.add('solo'); $('s-trace').classList.remove('nazori');
    layoutTrace();
    tboard.setFree(ch); showNameTag(null);
    soloCard.ch = ch; soloCard.t0 = 0;
    updateSoloTools(0);
    say(soloPrompt(ch));
    if (trun.auto) later(900, soloAutoWrite);
    kick();
  }
  function updateSoloTools(n) {
    var b = $('btn-solo-done'); if (!b || !tboard) return;
    var cnt = typeof n === 'number' ? n : tboard.ink.length, ok = !!(trun && trun.solo && trun.phase === 'write') && cnt > 0;
    b.disabled = !ok;
    $('btn-solo-undo').disabled = !(trun && trun.solo && trun.phase === 'write') || cnt === 0;
    b.classList.remove('glow');
    if (ok && trun.chars[trun.idx]) {   // 手本の画の数以上を書いて 2 秒たったら、軽く光らせる（自動では判定しない）
      var my = trun.token, at = trun.idx, need = STR.STROKES[trun.chars[trun.idx]].s.length;
      if (cnt >= need) later(2000, function () { if (trun && trun.token === my && trun.idx === at && trun.phase === 'write' && tboard.ink.length >= need) b.classList.add('glow'); });
    }
  }
  function nudgeSoloCard() {
    var c = $('solo-card'); if (!c || !trun || !trun.solo) return;
    c.classList.remove('nudge'); void c.offsetWidth; c.classList.add('nudge');
  }
  function drawSoloCard(t) {
    if (!trun || !trun.solo || !soloCard.ch) return;
    var cv = $('solo-card'), c = sizeCanvas(cv);
    if (!c.w) return;
    var el = soloCard.t0 ? t - soloCard.t0 : null;
    var going = M.TraceBoard.drawCard(c.ctx, soloCard.ch, c.w, el);
    if (soloCard.t0 && !going) soloCard.t0 = 0;
  }
  // 札を押す・「おてほん」: 札の中で書き順のアニメーション。まだ何も書いていなければ、1 画目を板に 2 秒だけ薄く出す
  function soloShowHint() {
    if (!trun || !trun.solo || trun.phase !== 'write') return;
    soloCard.t0 = now();
    tboard.hintFirst();
    say(soloPrompt(trun.chars[trun.idx]));
    kick();
  }
  function soloDone() {
    if (!trun || !trun.solo || trun.phase !== 'write' || !tboard) return;
    var ch = trun.chars[trun.idx], ink = tboard.inkStrokes();
    if (!ink.length) return;
    var j = FW.judgeSolo(ch, ink, { told: trun.told });
    if (soloDebugOn) showSoloJudge(ch, j);
    if (!j || j.result === 'empty') return;
    if (!j.fit && j.result !== 'more') j = { result: 'more', reason: 'small' };   // 枠が作れないとき（重ねられない）は、続きを書かせる
    if (j.result === 'more') {   // 画が足りない・小さすぎる: 1 字に 1 回だけ、判定せずに続きを書かせる
      trun.told = true; sfx('tap');
      say(j.reason === 'small' ? LN.FIXED.bigger : LN.FIXED.more);
      return;
    }
    var my = trun.token;
    trun.phase = 'review'; updateSoloTools(0);
    tboard.showFit(j.fit, j.result, j.focus);
    if (j.result === 'ok') {
      trun.wrote.push(ch);
      var setId = setOfChar(ch), had = FW.soloLicense(data.trace, setId);
      logChar('solo', ch, !(data.trace.done[ch] > 0), !(data.trace.solo[ch] > 0));   // recordSolo の前に「初めて」を見る
      data.trace = FW.recordSolo(data.trace, ch);   // done と solo をどちらも +1
      if (!had && FW.soloLicense(data.trace, setId)) trun.license = setId;   // 集合を全部ひとりで書けた: めんきょ（ごほうびのあとに知らせる。ステージは変わらない）
      data.stats.trace.chars++; data.stats.trace.clean++;
      save();
      stepAfterChar(ch, LN.soloDone(ch));
    } else {   // 手本を重ねて見せ、いつものなぞりで書き終える（点数も、合わなかった回数の保存も無い）
      say(LN.FIXED.compare);
      later(2600, function () {
        if (!trun || trun.token !== my) return;
        trun.nazori = true; trun.phase = 'trace';
        $('s-trace').classList.add('nazori'); layoutTrace();
        tboard.setChar(ch, true);
        kick();
      });
    }
    kick();
  }
  // 確認用: 判定の中身（保存しない）
  function showSoloJudge(ch, j) {
    var box = doc.getElementById('debug'); if (!box) return;
    var pre = doc.getElementById('solojudge');
    if (!pre) { pre = doc.createElement('pre'); pre.id = 'solojudge'; pre.style.cssText = 'position:fixed;left:0;bottom:0;z-index:60;margin:0;padding:4px 8px;background:rgba(255,255,255,.9);font-size:11px;max-width:100%;overflow:auto;max-height:40%;pointer-events:none'; doc.body.appendChild(pre); }
    var D = FW.DEFAULTS;
    pre.textContent = 'solo-judge ' + ch + ' → ' + (j && j.result) + ' focus ' + (j && j.focus) + (j && j.reason ? ' (' + j.reason + ')' : '') + '\n' +
      ((j && j.detail) || []).map(function (d) {
        return ' 手本' + (d.m + 1) + (d.m1 - d.m > 1 ? '+' + d.m1 : '') + ' ← 子' + (d.c + 1) + (d.c1 - d.c > 1 ? '+' + d.c1 : '') + (d.kind ? ' ' + d.kind : '') + ' ' +
          (d.dot ? 'てん d=' + d.D.toFixed(2) + '/' + D.DOT_R : 'D=' + d.D.toFixed(2) + '/' + D.SHAPE_MEAN + ' max=' + d.Dmax.toFixed(2) + '/' + D.SHAPE_MAX + ' Dr=' + (d.Dr || 0).toFixed(2)) + (d.ok ? '' : ' x') + (d.reverse ? ' 逆' : '');
      }).join('\n');
  }
  // 確認用の自動の書き手（#debug:play-solo-auto = 手本どおり、-auto-bad = 逆向き・逆順）
  function soloAutoWrite() {
    if (!trun || !trun.solo || trun.phase !== 'write') return;
    var ch = trun.chars[trun.idx], r = Math.random;
    var ink = FW.synthInk(ch, { size: 0.55 + r() * 0.3, cx: 0.4 + r() * 0.2, cy: 0.4 + r() * 0.2, tremor: 0.006, shift: 0.02, aspect: 0.9 + r() * 0.2 }, r);
    if (trun.auto === 'bad') ink = ink.slice().reverse().map(function (st) { return st.slice().reverse(); });
    tboard.setInk(ink);
    later(700, soloDone);
  }

  function finishTrace() {
    var st = data.stats;
    st.sessions++; st.trace.sessions++;
    var r = grantReward(trun.scene, stageIdx(), 'trace');   // 階段（afterSession）は呼ばない。かく の棚は うみ
    data.lastPlayed = todayStr();
    data.days = DL.recordSession(data.days, todayStr(), { game: trun.solo ? 'solo' : 'trace', reward: r, license: trun.license || '' });
    logTime();
    save();
    reward = { r: r, t0: 0, game: 'trace', played: 'trace', solo: !!trun.solo, license: trun.license || '', wrote: trun.wrote.slice(), firstNew: (trun.plan.filter(function (o) { return o.why === 'new'; })[0] || {}).ch || '' };
    rememberTrace();
    trun = null; tboard.stop();
    show('reward');
  }
  // 前の出動の字（書き終えた字）を覚える。1 字も書いていなければ、前の記録のまま
  function rememberTrace() { if (trun && trun.wrote.length) (trun.solo ? prevSolo : prevTrace)[trun.pid] = trun.wrote.slice(); }
  function quitTrace() {
    rememberTrace();
    logTime(); save();
    clearTimers(); token++; trun = null; if (tboard) tboard.stop(); SP.cancel();
    show('title');
  }

  // ごほうびを抽選して data.cards に反映する（通常の流れと確認パネルで共通）
  // rank: 遊んだレベルのステージの番号。S1 以上のときだけ救助隊の車も出る（rewards.js）。省略は S0 と同じ
  // game: 遊んだゲーム（math・letter・clock・english・trace）。そのゲームの棚の乗り物が先に出る。省略は今までの出方（確認用）
  function grantReward(scene, rank, game) {
    var a = R.applyReward(data.cards, scene, Math.random, rank, game);
    data.cards = a.cards;
    return a.r;
  }

  function finishSession() {
    var game = run.game, st = data.stats;
    st.sessions++; st[game].sessions++;
    st[game].questions += P.QUESTIONS_PER_SESSION; st[game].firstTry += run.firstTry;
    var lvBefore = data.levels[game];
    var res = LD.afterSession(data, game, run.level, run.firstTry, run.review, todayStr());
    replaceData(res.profile);
    var r = grantReward(run.scene, D.stageIndex(D.stageOf(run.level)), game);
    data.lastPlayed = todayStr();
    var lvs = D.LEVELS[game];   // 自動で上がったときだけ記録する（下がったことは記録しない）
    data.days = DL.recordSession(data.days, todayStr(), { game: game, questions: P.QUESTIONS_PER_SESSION, firstTry: run.firstTry, up: lvs.indexOf(data.levels[game]) > lvs.indexOf(lvBefore) ? data.levels[game] : '', reward: r });
    logTime();
    save();
    reward = { r: r, t0: 0, played: game, promo: res.promotedTo };   // 昇格したら、ごほうびの次に しょうかく の画面を出す
    run = null;
    show('reward');
  }

  function quitSession() {
    logTime(); save();
    clearTimers(); token++; run = null; SP.cancel();
    show('title');
  }

  // ---- ごほうび ----
  // 「しゃこへ」で開く棚: もらった乗り物の棚。ステッカーのときは遊んだゲームの棚。どちらも無ければ前に開いていた棚
  function rewardShelf() {
    var sh = reward && reward.r.id ? shelfOfCar(reward.r.id) : null;
    if (!sh && reward && reward.played && D.GAME_SHELF[reward.played]) sh = D.SHELVES.filter(function (x) { return x.id === D.GAME_SHELF[reward.played]; })[0];
    return sh ? sh.id : garageOpen.shelf;
  }
  function rewardCar() { return reward && reward.r.id ? carById(reward.r.id) : null; }
  function startRewardAnim() {
    reward.t0 = now(); reward.sound = 0;
    var r = reward.r, car = rewardCar();
    $('reward-text').textContent = ''; $('reward-sub').textContent = '';
    SP.prefetch(car ? [LN.carGet(car)] : [LN.FIXED.sticker]);
    drawReward();
    updateRewardSolo();
    later(500, function () { sfx('card'); });
    if (reward.license) later(7500, function () {   // 誘いの声（4.3 秒）と重ならないようにずらす
      var nm = SET_LABEL[reward.license] + ' めんきょ';
      $('reward-sub').textContent = nm + ' を もらったよ！'; sfx('fanfare'); say(LN.license(reward.license));
    });
    later(1100, function () {
      sfx('fanfare');
      if (car) {
        $('reward-text').textContent = car.name + ' をげっと！';
        if (r.isNew) {   // はたらくくるま・まちの くるま・きゅうじょたい は「あたらしい くるま！」、でんしゃ・そら・うみ は「あたらしい のりもの！」（漢字なし）
          var sh = shelfOfCar(car.id);
          if (sh && ['densha', 'sora', 'umi'].indexOf(sh.id) >= 0) $('reward-sub').textContent = D.REWARD_NEW_RIDE; else $('reward-sub').innerHTML = kidText(D.TEXT.rewardNew);
        } else $('reward-sub').textContent = '★が ふえたよ！';
        say(LN.carGet(car));
      } else {
        $('reward-text').textContent = 'ごほうびすてっかー！';
        say(LN.FIXED.sticker);
      }
    });
    kick();
  }
  // ごほうびの「ひとりで かく」: かく の あと、出せる字が 4 字以上あるときだけ。集合の字をひととおり なぞったら光って誘う
  function updateRewardSolo() {
    var b = $('btn-r-solo'); if (!b) return;
    var show = !!(reward && reward.game === 'trace' && soloAvailable()), set = show ? soloInviteSet() : '';
    b.hidden = !show; b.classList.toggle('glow', !!set);
    if (set && !soloInviteSaid[data.id + set]) {
      soloInviteSaid[data.id + set] = true;   // その集合で 1 回だけ（開いている間だけ覚える）
      later(4300, function () { say(LN.FIXED.inviteSolo); });
    }
  }
  function drawReward() {
    var cv = $('cardCanvas'), c = sizeCanvas(cv), t = now() - reward.t0;
    c.ctx.clearRect(0, 0, c.w, c.h);
    var flip = Math.max(0, Math.min(1, (t - 0.6) / 0.8));
    var car = rewardCar();
    var stars = reward.r.stars || 3;
    if (!car) { car = { stage: 8, name: 'ごほうび' }; }
    SC.drawCard(c.ctx, c.w, c.h, car, stars, flip, t);
    if (flip >= 1) for (var i = 0; i < 7; i++) {
      var a = t * 1.5 + i * 0.9, r = Math.min(c.w, c.h) * (0.5 + 0.06 * i % 0.2);
      c.ctx.save(); c.ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i);
      c.ctx.fillStyle = '#ffd23f'; c.ctx.beginPath(); c.ctx.arc(c.w / 2 + Math.cos(a) * r * 0.9, c.h / 2 + Math.sin(a) * r * 0.9, 6, 0, 7); c.ctx.fill(); c.ctx.restore();
    }
  }

  // ごほうびの次: 昇格していたら しょうかく の画面（そのあとはタイトル）、なければ行き先へ
  var promo = null;   // { stage, t0 }
  function leaveReward(next) {
    if (reward && reward.promo) { promo = { stage: reward.promo, t0: 0, next: next === 'today' ? 'today' : 'title' }; reward.promo = null; show('promote'); }
    else show(next);
  }
  function startPromoteAnim() {
    promo.t0 = now();
    var stg = D.STAGES[D.stageIndex(promo.stage)];
    $('promote-text').textContent = stg.rank + ' に しょうかく！';
    $('promote-sub').textContent = 'すすんで みる？';
    drawPromote();
    later(300, function () { sfx('fanfare'); say(LN.promote(stg)); });
    kick();
  }
  function drawPromote() {
    if (!promo) return;
    var c = sizeCanvas($('promoteCanvas'));
    c.ctx.clearRect(0, 0, c.w, c.h);
    SC.drawPromote(c.ctx, c.w, c.h, D.stageIndex(promo.stage), now() - promo.t0);
  }

  // ---- しゃこ ----
  var slots = [];
  // しゃこの棚（design-rewards.md 4 章）。見える棚: 出始めるステージ（from）が無い棚と、解放済みのステージが from 以上、またはその棚の乗り物をもう持っている棚。
  // きゅうじょたい は S0 の子には棚ごと見せない（S1 から戻した子など、カードを持っていれば見せる）
  function visibleShelves() {
    var un = D.stageIndex(data.stage.unlocked);
    return D.SHELVES.filter(function (sh) { return sh.from === undefined || un >= sh.from || sh.ids.some(function (id) { return data.cards[id] > 0; }); });
  }
  // 見える棚の乗り物（保護者画面の数）
  function garageCars() {
    var out = [];
    visibleShelves().forEach(function (sh) { sh.ids.forEach(function (id) { out.push(carById(id)); }); });
    return out;
  }
  var SHELF_GAME = { hataraku: 'math', machi: 'letter', densha: 'clock', sora: 'english', umi: 'trace' };   // 棚 → そのゲーム（D.GAME_SHELF の逆）
  var GAME_NAME = LN.GAME_NAME;
  var GAME_ICON = { math: 'kazu', letter: 'moji', clock: 'tokei', english: 'eigo', trace: 'pencil' };
  function currentShelf() {
    var list = visibleShelves(), id = garageOpen.shelf;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    garageOpen.shelf = list[0].id;   // 見えない棚が選ばれていたら はたらくくるま に戻す
    return list[0];
  }
  function buildShelfTabs(cur) {
    var box = $('shelf-tabs'); box.textContent = '';
    visibleShelves().forEach(function (sh) {
      var b = el('button', 'stab' + (sh.id === cur.id ? ' sel' : '')); b.type = 'button';
      b.setAttribute('role', 'tab'); b.setAttribute('aria-label', sh.name); b.setAttribute('aria-selected', sh.id === cur.id ? 'true' : 'false'); b.dataset.shelf = sh.id;
      var cv = doc.createElement('canvas'); cv.width = 96; cv.height = 96; b.appendChild(cv); box.appendChild(b);
      V.drawVehicle(cv.getContext('2d'), carById(sh.face).stage, 48, 46, 84);
      b.addEventListener('click', function () {
        unlockOnce(); sfx('tap'); say(sh.name);
        garageOpen.shelf = sh.id; garageOpen.run = ''; buildGarage(); kick();
      });
    });
  }
  function buildGarage() {
    var grid = $('garage-grid'); grid.innerHTML = ''; slots = [];
    var have = 0;
    var sh = currentShelf(), cars = sh.ids.map(carById);
    buildShelfTabs(sh);
    cars.forEach(function (car) {
      var n = data.cards[car.id] || 0; if (n) have++;
      // button だと iOS Safari が中身の高さを枠に数えず、絵と名前が枠の外にはみ出すので div にする
      var el = doc.createElement('div');
      el.setAttribute('role', 'button'); el.tabIndex = 0; el.className = 'slot' + (n ? '' : ' none');
      el.setAttribute('aria-label', n ? car.name : 'まだ いない のりもの');
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
      var stars = ''; for (var i = 1; i <= 3; i++) stars += i <= n ? '★' : '☆';
      el.innerHTML = '<canvas></canvas><div class="nm"></div><div class="st"></div>';
      el.querySelector('.nm').textContent = n ? car.name : '？';
      el.querySelector('.st').textContent = n ? stars : '';
      grid.appendChild(el);
      var slot = { el: el, car: car, n: n, cv: el.querySelector('canvas'), drive: -1 };
      slots.push(slot);
      if (garageOpen.run === car.id && n) slot.drive = now();   // ごほうびから来たとき、もらった乗り物の枠が 1 回走る
      el.addEventListener('click', function () {
        unlockOnce();
        if (!slot.n) { sfx('tap'); return; }
        slot.drive = now(); sfx(A.carSound(car.stage)); say(carYomi(car)); kick();
      });
    });
    garageOpen.run = '';
    // 棚の見出し: 棚の名前・そのゲームの絵（持っていない乗り物が残る棚だけ。きゅうじょたい は出さない）・数
    $('sh-name').textContent = sh.name;
    $('g-count').textContent = have + ' / ' + cars.length;
    var game = SHELF_GAME[sh.id], how = $('sh-how');
    how.hidden = !game || sh.from !== undefined || have >= cars.length;
    if (!how.hidden) {
      how.setAttribute('aria-label', GAME_NAME[game] + 'で ふえるよ');
      how.querySelector('.gn').textContent = GAME_NAME[game] + 'で ふえるよ';
      drawIcon(how.querySelector('canvas'), GAME_ICON[game]);
      how.onclick = function () { unlockOnce(); sfx('tap'); say(LN.shelfHow(game)); };
    }
    showGarageTab();
    drawGarage();
  }
  function drawGarage() {
    var t = now(), busy = false;
    if (garageOpen.tab === 'moji') return false;
    slots.forEach(function (s) {
      var c = sizeCanvas(s.cv), ctx = c.ctx, sz = Math.min(c.w * 0.85, c.h * 1.1);   // 絵は単位座標で上 0.86・下 1.14 ほどまで出るので、枠に収まる大きさにする
      ctx.clearRect(0, 0, c.w, c.h);
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, c.h * 0.9, c.w, 4);
      if (!s.n) { V.drawSilhouette(ctx, s.car.stage, c.w / 2, c.h * 0.45, sz, '#4a4f5c'); return; }
      var x = c.w / 2;
      if (s.drive >= 0) {
        var u = (t - s.drive) / 1.5;
        if (u >= 1) s.drive = -1; else { x = -sz * 0.5 + (c.w + sz) * u; busy = true; }
      }
      V.drawVehicle(ctx, s.car.stage, x, c.h * 0.45, sz);   // 既定の向き=右(走る向きと同じ)
    });
    return busy;
  }


  // ---- しゃこの「もじ」: 五十音の表（design 11.5・11.6）。数字・割合・苦手は出さない。書いた字に車のスタンプ、3 回以上は金 ----
  var garageOpen = { tab: 'cars', set: '', stamp: [], shelf: 'hataraku', run: '' };   // しゃこを開くたびの状態。stamp: ごほうび画面から来たときに順に押す字。shelf: 開く棚（アプリを開いている間だけ覚える）。run: 開いたとき 1 回走る乗り物の id
  var mojiSheetCh = '';
  var SET_LABEL = LN.SET_LABEL;
  var SET_LABEL_PARENT = { hira: 'ひらがな', kata: 'カタカナ', k1: '1ねんの かんじ', k2: '2ねんの かんじ' };
  var MOJI_MAX = 96, MOJI_MIN = 44;
  function setOfChar(ch) { var hit = ''; ['hira', 'kata', 'k1', 'k2'].forEach(function (k) { if (!hit && STR.SETS[k] && STR.SETS[k].indexOf(ch) >= 0) hit = k; }); return hit; }
  // 見せる集合: 今のステージで書ける集合のうち、データがあるもの
  function mojiSets() { return TR.allowedSets(LD.currentStage(data)).filter(function (k) { return !!STR.SETS[k]; }); }
  function defaultMojiSet() {
    var sets = mojiSets(), cur = TR.traceSet(data.trace, LD.currentStage(data));
    var want = cur === 'hira+kata' ? 'kata' : cur;
    return sets.indexOf(want) >= 0 ? want : sets[0];
  }
  var stampCache = {};
  // 小さな canvas に一度だけ描いて data URL にし、全部のマスで使い回す（自分の車）
  function stampURL(kind, gold) {
    var car = carById(data.icon) || D.CARS[0], key = kind + (gold ? 'g' : '') + car.id;
    if (stampCache[key]) return stampCache[key];
    var W = 64, cv = doc.createElement('canvas'); cv.width = cv.height = W;
    var ctx = cv.getContext('2d');
    if (kind === 'hana') {   // 花丸（ひとりで 書けた字）
      ctx.translate(W / 2, W / 2);
      for (var k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.arc(0, -W * 0.27, W * 0.17, 0, 7); ctx.fillStyle = '#ff6f91'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#c2385e'; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, W * 0.19, 0, 7); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke();
    } else if (kind === 'stamp') {
      ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = gold ? 7 : 4; ctx.strokeStyle = gold ? '#f2a900' : '#7aa7d9'; ctx.stroke();
      V.drawVehicle(ctx, car.stage, W / 2, W * 0.5, W * 0.62);
    } else {
      V.drawVehicle(ctx, car.stage, W / 2, W * 0.45, W * 0.9);
    }
    stampCache[key] = cv.toDataURL();
    return stampCache[key];
  }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function mojiOrient() { return root.innerWidth > root.innerHeight ? 'cols' : 'rows'; }
  function showGarageTab() {
    var moji = garageOpen.tab === 'moji';
    $('garage-grid').hidden = moji; $('moji-view').hidden = !moji; $('shelf-tabs').hidden = moji; $('shelf-head').hidden = moji;
    $('gt-cars').classList.toggle('sel', !moji); $('gt-moji').classList.toggle('sel', moji);
    $('moji-sheet').hidden = true; mojiSheetCh = '';
    if (moji) buildMoji();
  }
  function buildMoji() {
    var sets = mojiSets(), box = $('moji-sets');
    if (sets.indexOf(garageOpen.set) < 0) garageOpen.set = defaultMojiSet();
    box.textContent = '';
    if (sets.length > 1) sets.forEach(function (k) {
      var b = el('button', k === garageOpen.set ? 'sel' : '', SET_LABEL[k]); b.type = 'button';
      b.addEventListener('click', function () { sfx('tap'); garageOpen.set = k; garageOpen.stamp = []; buildMoji(); });
      box.appendChild(b);
    });
    box.hidden = sets.length <= 1;
    buildMojiTop();
    layoutMoji();
  }
  // 表の上の段: もらった めんきょ と「ひとりで かく」（出せる字が 4 字以上のとき）
  function buildMojiTop() {
    var lic = $('moji-license'); lic.textContent = '';
    ['hira', 'kata', 'k1', 'k2'].forEach(function (k, i) {
      if (!STR.SETS[k] || !FW.soloLicense(data.trace, k)) return;
      var sp = el('span'), cv = doc.createElement('canvas'), dpr = root.devicePixelRatio || 1;
      cv.width = Math.round(48 * dpr); cv.height = Math.round(34 * dpr);
      var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); SC.drawLicense(ctx, 24, 17, 44, i);
      sp.appendChild(cv); sp.appendChild(doc.createTextNode(SET_LABEL[k] + ' めんきょ')); lic.appendChild(sp);
    });
    $('moji-solo-top').hidden = !soloAvailable();
  }
  function layoutMoji() {
    var grid = $('moji-grid'); if (!grid || $('moji-view').hidden) return;
    var g = TR.traceGrid(garageOpen.set, mojiOrient()), cols = g[0].length, rows = g.length;
    var landscape = mojiOrient() === 'cols';
    grid.textContent = '';
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    grid.style.maxWidth = (landscape ? MOJI_MAX * cols + 6 * cols + 24 : 520) + 'px';
    var availH = $('moji-view').clientHeight - $('moji-sets').offsetHeight - $('moji-top').offsetHeight - 4 - 14 - 6 * (rows - 1);
    var rowH = Math.max(MOJI_MIN, Math.min(MOJI_MAX, Math.floor(availH / rows)));
    grid.style.gridAutoRows = rowH + 'px';
    var colW = Math.max(30, ((grid.clientWidth || root.innerWidth) - 24 - 6 * (cols - 1)) / cols);
    var fs = Math.round(Math.min(rowH, colW) * 0.6);
    var names = TR.nameTraceChars(data.name, STR.SETS[garageOpen.set].split('')), isName = {};
    names.forEach(function (o) { isName[o.ch] = true; });
    var pending = garageOpen.stamp.slice(), delay = 0, scrolled = false, scrollTo1 = null;
    g.forEach(function (row) {
      row.forEach(function (ch) {
        var c = doc.createElement('button'); c.type = 'button';
        if (!ch) { c.className = 'mcell blank'; c.tabIndex = -1; c.setAttribute('aria-hidden', 'true'); grid.appendChild(c); return; }
        var n = data.trace.done[ch] > 0 ? data.trace.done[ch] : 0;
        c.className = 'mcell' + (n ? ' got' : '');
        c.style.fontSize = fs + 'px';
        c.setAttribute('aria-label', ch + (n ? ' かいた' : ' まだ'));
        c.appendChild(doc.createTextNode(ch));
        if (isName[ch]) { var nm = doc.createElement('img'); nm.className = 'nmark'; nm.alt = ''; nm.src = stampURL('icon'); c.appendChild(nm); }
        if (data.trace.solo && data.trace.solo[ch] > 0) { var hn = doc.createElement('img'); hn.className = 'hana'; hn.alt = ''; hn.src = stampURL('hana'); c.appendChild(hn); }
        if (n) {
          var st = doc.createElement('img'); st.className = 'stamp'; st.alt = ''; st.src = stampURL('stamp', n >= 3);
          var pi = pending.indexOf(ch);
          if (pi >= 0 && !reducedMotion()) {
            st.className += ' wait';
            (function (img, d) { later(400 + d, function () { img.className = 'stamp pop'; sfx('pon', 1); if (img.parentNode && img.parentNode.scrollIntoView) img.parentNode.scrollIntoView({ block: 'nearest' }); }); })(st, delay);
            delay += 300; pending.splice(pi, 1);
          }
          c.appendChild(st);
          if (pi >= 0 && !scrolled) { scrolled = true; scrollTo1 = c; }
        }
        c.addEventListener('click', function () { openMojiSheet(ch); });
        grid.appendChild(c);
      });
    });
    if (scrollTo1) scrollTo1.scrollIntoView({ block: 'nearest' });   // 押されるマスが画面の外なら、そこまで表を動かす
    garageOpen.stamp = [];
  }
  // 字の札（下から）: 字（手本の形）・例語の絵・声。「かく」で、この字が 1 字目の出動
  function openMojiSheet(ch) {
    sfx('tap'); mojiSheetCh = ch;
    $('moji-sheet').hidden = false;
    var c = sizeCanvas($('moji-canvas'));
    c.ctx.clearRect(0, 0, c.w, c.h);
    M.TraceBoard.drawSheet(c.ctx, ch, 8, 8, Math.min(c.w, c.h) - 16);
    $('moji-solo').hidden = !(soloAvailable() && data.trace.done[ch] > 0 && FW.DEFAULTS.SOLO_SETS.indexOf(setOfChar(ch)) >= 0);
    say(LN.mojiSheet(ch));
  }
  function closeMojiSheet() { $('moji-sheet').hidden = true; mojiSheetCh = ''; SP.cancel(); }

  // ---- おうちのひと ----
  var clearStep = 0;
  var kidEdit = null;          // { id, mode: 'name' | 'icon' | 'del', err } 開いている編集欄（1 つだけ）
  var restoredShown = false;   // 「もどしました」の表示は保護者画面を出ている間だけ（フラグは出した時点で消す）

  function kidBtn(label, cls, fn) {
    var b = doc.createElement('button'); b.type = 'button'; b.className = 'pbtn' + (cls ? ' ' + cls : ''); b.textContent = label;
    b.addEventListener('click', fn); return b;
  }
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  function submitName(p, input) {
    var r = PR.renameProfile(state, p.id, input.value);
    if (!r.ok) {
      kidEdit.err = r.reason === 'chars' ? 'ひらがなで いれてね' : r.reason === 'long' ? '6もじ までに してね' : 'なまえを いれてね';
      var er = $('p-kids').querySelector('.err'); if (er) er.textContent = kidEdit.err; else fillKids();   // 入力欄は作り直さず、文字を残す
      return;
    }
    state = r.state; rebind(); save(); kidEdit = null; fillParent();
  }

  function fillKids() {
    var box = $('p-kids'); box.textContent = '';
    var only = state.profiles.length <= 1;
    state.profiles.forEach(function (p) {
      var row = el('div', 'kid' + (p === data ? ' cur' : ''));
      var main = el('button', 'kid-main'); main.type = 'button';
      var badge = el('span', 'badge small'); fillBadge(badge, p);
      main.appendChild(badge);
      if (p === data) main.appendChild(el('span', 'cur-mark', '★ いま'));
      main.addEventListener('click', function () { if (p !== data) { useProfile(p.id); kidEdit = null; fillParent(); } });
      row.appendChild(main);
      var acts = el('div', 'kid-acts');
      acts.appendChild(kidBtn('なまえ', '', function () { kidEdit = { id: p.id, mode: 'name', err: '' }; fillKids(); }));
      acts.appendChild(kidBtn('えを かえる', '', function () { kidEdit = { id: p.id, mode: 'icon', err: '' }; fillKids(); }));
      if (!only) acts.appendChild(kidBtn('けす', 'danger', function () { kidEdit = { id: p.id, mode: 'del', err: '' }; fillKids(); }));
      row.appendChild(acts);
      if (kidEdit && kidEdit.id === p.id) row.appendChild(kidEditPanel(p));
      box.appendChild(row);
    });
    $('p-kid-add').disabled = state.profiles.length >= PR.MAX_PROFILES;
    $('p-kid-add').textContent = state.profiles.length >= PR.MAX_PROFILES ? '4にん いるので ふやせません' : 'こどもを ふやす';
    $('p-kid-note').textContent = only
      ? 'したの 「すすみぐあい」「レベル」は、いま えらんでいる こ（★）の ものです。さいごの 1にんは けせません。'
      : 'したの 「すすみぐあい」「レベル」は、いま えらんでいる こ（★）の ものです。ほかの こを おすと きりかわります。';
    [].forEach.call(box.querySelectorAll('canvas'), function (c) { var id = c.getAttribute('data-car'); if (id) drawCarIcon(c, id); });
    var inp = box.querySelector('input');
    if (inp) { inp.focus(); if (inp.scrollIntoView) inp.scrollIntoView({ block: 'center' }); }
  }

  function kidEditPanel(p) {
    var pan = el('div', 'kid-edit');
    if (kidEdit.mode === 'name') {
      var input = doc.createElement('input');
      input.type = 'text'; input.maxLength = 12; input.value = kidEdit.value || ''; input.placeholder = p.name;
      input.addEventListener('input', function () { kidEdit.value = input.value; });
      input.setAttribute('autocomplete', 'off'); input.setAttribute('autocapitalize', 'off'); input.setAttribute('spellcheck', 'false'); input.setAttribute('enterkeyhint', 'done');
      input.setAttribute('aria-label', 'なまえ');
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); submitName(p, input); } });
      pan.appendChild(input);
      pan.appendChild(el('p', 'err', kidEdit.err));
      pan.appendChild(el('p', 'note', 'ひらがなで 6もじ まで。ほんみょうでは なく、よびなを いれてください。'));
      var acts = el('div', 'kid-acts');
      acts.appendChild(kidBtn('きめる', '', function () { submitName(p, input); }));
      acts.appendChild(kidBtn('やめる', 'sub', function () { kidEdit = null; fillKids(); }));
      pan.appendChild(acts);
    } else if (kidEdit.mode === 'icon') {
      var g = el('div', 'icons');
      PR.ICON_ORDER.forEach(function (id) {
        var b = el('button', id === p.icon ? 'sel' : ''); b.type = 'button';
        var used = state.profiles.some(function (q) { return q.id !== p.id && q.icon === id; });
        b.disabled = used; b.setAttribute('aria-label', carById(id).name);
        var cv = doc.createElement('canvas'); b.appendChild(cv); g.appendChild(b);
        b.addEventListener('click', function () { state = PR.setIcon(state, p.id, id); rebind(); save(); kidEdit = null; fillParent(); });
        cv.setAttribute('data-car', id);   // 描くのは行を DOM に入れた後（fillKids の最後）
      });
      pan.appendChild(g);
      var a2 = el('div', 'kid-acts'); a2.appendChild(kidBtn('やめる', 'sub', function () { kidEdit = null; fillKids(); }));
      pan.appendChild(a2);
    } else {
      pan.appendChild(el('p', 'note warn', p.name + ' の きろくと あつめた くるまが きえます。もういちど おすと けします。' + (p === data ? 'いま えらんでいる こなので、★は ほかの こに うつります。' : '')));
      var a3 = el('div', 'kid-acts');
      a3.appendChild(kidBtn('ほんとうに けす', 'danger', function () {
        var r = PR.removeProfile(state, p.id);
        if (r.ok) { state = r.state; rebind(); save(); }
        kidEdit = null; fillParent();
      }));
      a3.appendChild(kidBtn('やめる', 'sub', function () { kidEdit = null; fillKids(); }));
      pan.appendChild(a3);
    }
    return pan;
  }

  var addLock = 0;
  function addKid() {
    if (state.profiles.length >= PR.MAX_PROFILES || now() < addLock) return;   // 連打しても 1 回ぶんだけ
    addLock = now() + 0.8;
    var r = PR.addProfile(state, '', '', S.newId(Date.now(), Math.random), todayStr());
    if (!r.ok) return;
    state = r.state; rebind(); save();
    kidEdit = { id: state.profiles[state.profiles.length - 1].id, mode: 'name', err: '' };
    fillKids();
  }

  function soloCount(set) { var cs = STR.SETS[set].split(''); return cs.filter(function (c) { return data.trace.solo && data.trace.solo[c] > 0; }).length; }
  function traceCount(set) { var cs = STR.SETS[set].split(''); return cs.filter(function (c) { return data.trace.done[c] > 0; }).length; }
  // 保護者画面の「かいた じ」: ひらがな N/46・カタカナ M/46（S1 から 1ねんの かんじ N/20、S2 から 2ねんの かんじ N/18。解放済みのステージの集合だけ）
  function traceProgressText() {
    var unl = D.stageIndex(data.stage.unlocked);
    return [['ひらがな', 'hira', 0], ['カタカナ', 'kata', 0], ['1ねんの かんじ', 'k1', 1], ['2ねんの かんじ', 'k2', 2]]
      .filter(function (a) { return unl >= a[2]; })
      .map(function (a) {
        var solo = FW.DEFAULTS.SOLO_SETS.indexOf(a[1]) >= 0 ? '　ひとりで かけた じ ' + soloCount(a[1]) : '';
        return a[0] + ' ' + traceCount(a[1]) + '/' + STR.SETS[a[1]].length + solo;
      }).join('<br>');   // 1 つの集合ごとに改行（狭い画面で折り返すため）
  }
  // 保護者の「かく の ひょう」: 字ごとに書いた回数と、たすけが要った回数（オレンジ）。割合は出さない
  var ptSet = '';
  function fillTraceTable() {
    var unl = D.stageIndex(data.stage.unlocked);
    var sets = ['hira', 'kata', 'k1', 'k2'].filter(function (k) { return STR.SETS[k] && unl >= (k === 'k1' ? 1 : k === 'k2' ? 2 : 0); });
    if (sets.indexOf(ptSet) < 0) ptSet = sets[0];
    var tabs = $('pt-sets'); tabs.textContent = '';
    sets.forEach(function (k) {
      var b = kidBtn(SET_LABEL_PARENT[k], 'sub' + (k === ptSet ? ' sel' : ''), function () { ptSet = k; fillTraceTable(); });
      tabs.appendChild(b);
    });
    var chars = STR.SETS[ptSet].split(''), got = chars.filter(function (c) { return data.trace.done[c] > 0; }).length;
    var weak = chars.filter(function (c) { return TR.isWeak(data.trace, c); });
    $('pt-sum').innerHTML = 'かいた じ ' + got + '/' + chars.length + '・まだ ' + (chars.length - got) + '<br>いま おおめに でる じ（たすけが いった じ）: ' + (weak.length ? esc(weak.join('・')) : 'なし');
    var names = TR.nameTraceChars(data.name, chars), isName = {};
    names.forEach(function (o) { isName[o.ch] = true; });
    var g = TR.traceGrid(ptSet, 'rows'), grid = $('pt-grid'); grid.textContent = '';
    grid.style.gridTemplateColumns = 'repeat(' + g[0].length + ', minmax(0, 1fr))';
    g.forEach(function (row) {
      row.forEach(function (ch) {
        var c = el('div', 'pcell');
        if (!ch) { c.className += ' blank'; grid.appendChild(c); return; }
        var n = data.trace.done[ch] > 0 ? data.trace.done[ch] : 0, h = data.trace.help[ch] > 0 ? data.trace.help[ch] : 0;
        if (n) c.className += ' got';
        c.appendChild(el('b', '', ch));
        var cnt = el('span', 'cnt', n ? String(n) : '');
        if (h) cnt.appendChild(el('em', '', String(h)));
        if (data.trace.solo && data.trace.solo[ch] > 0) cnt.appendChild(el('u', '', '✿'));
        c.appendChild(cnt);
        if (isName[ch]) c.appendChild(el('span', 'pn', '★'));
        grid.appendChild(c);
      });
    });
  }
  function fillParent() {
    relockAsk = '';   // 「とじる」の確認は、ほかの操作で描き直したら消える
    var st = data.stats, have = 0, stars = 0;
    var shelf = garageCars(), shelfRows = '';
    shelf.forEach(function (c) { var n = data.cards[c.id] || 0; if (n) have++; stars += n; });
    visibleShelves().forEach(function (sh) {   // 棚ごとの数だけ（割合・順位は出さない）
      var got = sh.ids.filter(function (id) { return data.cards[id] > 0; }).length;
      shelfRows += '<div class="prow"><span>' + sh.name + '</span><b>' + got + ' / ' + sh.ids.length + '</b></div>';
    });
    function pct(g) { var q = st[g].questions; return q ? Math.round(st[g].firstTry / q * 100) + '%' : '-'; }
    $('p-progress').innerHTML =
      '<div class="prow"><span>しゅつどうの かいすう</span><b>' + st.sessions + '</b></div>' +
      '<div class="prow"><span>かず：いまのレベル</span><b>' + data.levels.math + '（1かいめで せいかい ' + pct('math') + '）</b></div>' +
      '<div class="prow"><span>もじ：いまのレベル</span><b>' + data.levels.letter + '（1かいめで せいかい ' + pct('letter') + '）</b></div>' +
      '<div class="prow"><span>とけい：いまのレベル</span><b>' + data.levels.clock + '（1かいめで せいかい ' + pct('clock') + '）</b></div>' +
      '<div class="prow"><span>えいご：いまのレベル</span><b>' + data.levels.english + '（1かいめで せいかい ' + pct('english') + '）</b></div>' +
      '<div class="prow"><span>かく：かいた じ</span><b style="text-align:right">' + traceProgressText() + '<br>（' + st.trace.sessions + 'かい）</b></div>' +
      '<div class="prow"><span>あつめた のりもの</span><b>' + have + ' / ' + shelf.length + '（★ ' + stars + '）</b></div>' + shelfRows;
    $('p-sfx').checked = dev.sound.sfx; $('p-voice').checked = dev.sound.voice;
    ['math', 'letter', 'clock', 'english'].forEach(function (g) {
      var sel = $('p-lv-' + g);
      sel.textContent = '';
      LD.selectableLevels(data, g).forEach(function (lv) { var o = doc.createElement('option'); o.value = lv; o.textContent = lv; sel.appendChild(o); });   // 解放済みのステージの範囲だけ
      sel.value = data.levels[g]; $('p-lock-' + g).checked = data.locked[g];
    });
    fillSpeakers(); voiceNote(); enNote(); fillStages();
    if (dev.restoredFromV1) { restoredShown = true; delete dev.restoredFromV1; save(); }
    $('p-restored').hidden = !restoredShown;
    $('p-storage-note').hidden = S.isPersistent();
    clearStep = 0; $('p-clear').textContent = 'ぜんぶの こどもの きろくを けす'; $('p-clear-note').textContent = '';
    fillDays();
    updateBadges(); fillKids(); fillTraceTable();
  }
  // ---- 子ども向け: きょうの しゅつどう（docs/design-daily-log.md 9 章。数字は出さない。ひらがなだけ） ----
  var TODAY_GAMES = [['math', 'kazu', 'かず'], ['letter', 'moji', 'もじ'], ['clock', 'tokei', 'とけい'], ['english', 'eigo', 'えいご'], ['trace', 'pencil', 'かく']];
  function kidNow() { return DL.kidToday(viewDays(), todayStr(), { enOn: !enOff(), cleared: data.cleared }); }
  // 絵のあつまり（5 つ）。small = タイトルの列。まだのものは薄く（えいご の声が使えない端末では薄くしない）
  function buildTodayCells(box, k, small) {
    box.textContent = '';
    var cells = [];
    TODAY_GAMES.forEach(function (g) {
      var id = g[0], c = el(small ? 'span' : 'div', small ? 'tchip ' + id : 'big tcell ' + id);
      var cv = doc.createElement('canvas'); cv.className = 'ico'; cv.width = cv.height = small ? 72 : 96; cv.setAttribute('data-icon', g[1]); c.appendChild(cv); drawIcon(cv, g[1]);
      if (!small) c.appendChild(el('span', '', g[2]));
      var off = !k.played[id] && !(id === 'english' && enOff());
      if (off && !k.none) c.classList.add('later');
      var cell = { id: id, el: c, stamp: null, crown: null };
      if (k.played[id]) {
        var im = doc.createElement('img'); im.className = 'stamp'; im.alt = ''; im.src = stampURL('stamp', k.crown === id); c.appendChild(im); cell.stamp = im;
      }
      if (k.crown === id) {
        var cr = doc.createElement('canvas'); cr.className = 'crown'; cr.width = 96; cr.height = 72; c.appendChild(cr); drawIcon(cr, 'crown'); cell.crown = cr;
      }
      box.appendChild(c); cells.push(cell);
    });
    return cells;
  }
  function updateTodayStrip() {
    var s = $('today-strip'), k = kidNow();
    s.hidden = k.none;
    if (!k.none) buildTodayCells(s, k, true);
  }
  function startToday() {
    var k = kidNow(), cells = buildTodayCells($('today-row'), k, false), calm = reducedMotion();
    var crownLine = k.crown ? LN.todayCrown(k.crown) : '', msg = $('today-msg'), items = [];
    var names = {}; TODAY_GAMES.forEach(function (g) { names[g[0]] = g[2]; });
    if (k.none) { msg.textContent = 'きょうは どれで しゅつどう する？'; items.push({ text: LN.FIXED.todayNone, lang: 'ja' }); }
    else if (k.all) { msg.textContent = 'ぜんぶ しゅつどう できたね！'; items.push({ text: LN.FIXED.todayAll, lang: 'ja' }); }
    else {
      msg.innerHTML = esc('きょうは ' + names[k.crown] + ' を とくに がんばったね！') + (k.invite ? '<br>' + esc('あしたは ' + names[k.invite] + ' も やってみる？') : '');
      items.push({ text: crownLine, lang: 'ja' });
      if (k.invite) items.push({ text: LN.todayInvite(k.invite), lang: 'ja', gap: 500 });
    }
    SP.prefetch(items.map(function (i) { return i.text; }));
    // 動き: スタンプを左から順に 0.3 秒ずつ「ぽん」→ 王冠。動きを減らす設定のときは一度に出す
    var t = 300;
    cells.forEach(function (c) {
      [c.stamp, c.crown].forEach(function (n) { if (n && !calm) n.classList.add('wait'); });
    });
    if (!calm) {
      cells.forEach(function (c) {
        if (!c.stamp) return;
        later(t, function () { c.stamp.classList.remove('wait'); c.stamp.classList.add('pop'); sfx('pon'); });
        t += 300;
      });
      cells.forEach(function (c) { if (c.crown) later(t, function () { c.crown.classList.remove('wait'); c.crown.classList.add('pop'); sfx('card'); }); });
    }
    later(calm ? 300 : t + 700, function () { if (items.length) seq(items); });
    kick();
  }
  // 画面に使う日ごとの記録（今の子の分＋ほかの端末の分 daysOther。daysOther は R4 の cloud.js が読んで置き換える）
  function viewDays() { return DL.sumDays(data.days, data.daysOther); }

  // ---- 保護者画面: まいにちの きろく（docs/design-daily-log.md 8 章。今えらんでいる子だけ） ----
  var dlWeek = '', dlOpen = '';   // 見ている週の月曜・内訳を開いている日。保護者画面を開いたとき・子を切り替えたとき今の週に戻す
  var DL_NAME = { math: 'かず', letter: 'もじ', clock: 'とけい', english: 'えいご', trace: 'かく', solo: 'ひとりで かく' };
  var DL_WD = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'];
  function dlMin(sec) { return 'やく ' + Math.max(1, Math.round(sec / 60)) + 'ふん'; }
  function dlGameOfLevel(lv) { for (var i = 0; i < D.GAMES.length; i++) if (D.LEVELS[D.GAMES[i]].indexOf(lv) >= 0) return D.GAMES[i]; return ''; }
  function dlLines(box, lines) { lines.forEach(function (t) { box.appendChild(el('div', '', t)); }); }
  function dlDetail(row, w, today) {
    var d = row.day, box = el('div', 'dl-detail'), lines = [];
    ['math', 'letter', 'clock', 'english'].forEach(function (g) {
      var x = d[g]; if (!x) return;
      lines.push(DL_NAME[g] + '　' + x.sessions + 'かい（もんだい ' + x.questions + '・1かいめで せいかい ' + x.firstTry + '）');
    });
    ['trace', 'solo'].forEach(function (g) { var x = d[g]; if (x) lines.push(DL_NAME[g] + '　' + x.sessions + 'かい（' + x.chars + 'じ）'); });
    if (d.wrote) lines.push('かいた じ：' + Array.from(d.wrote).join('・'));
    var got = [];
    if (d.up) ['math', 'letter', 'clock', 'english'].forEach(function (g) { if (d.up[g]) got.push(DL_NAME[g] + ' ' + d.up[g] + ' まで'); });
    w.got.gates.forEach(function (x) { if (x.date === row.key) got.push((DL_NAME[dlGameOfLevel(x.level)] || '') + ' ' + x.level + ' の かんもん'); });
    w.got.stages.forEach(function (x) { if (x.date === row.key) { var i = D.stageIndex(x.stage); got.push('ステージ ' + (i >= 0 ? D.STAGES[i].rank : x.stage) + ' が ひらいた'); } });
    if (d.newChars) got.push('はじめて かいた じ ' + Array.from(d.newChars).join('・'));
    if (d.newSolo) got.push('ひとりで かけた じ ' + Array.from(d.newSolo).join('・'));
    (d.license || []).forEach(function (x) { got.push(SET_LABEL_PARENT[x] + 'の めんきょ'); });
    if (got.length) lines.push('できるように なったこと：' + got.join('・'));
    if (d.cards) {
      var names = (d.newCars || []).map(function (id) { var c = carById(id); return c ? c.name : ''; }).filter(Boolean);
      lines.push('ごほうび ' + d.cards + 'まい' + (names.length ? '（あたらしい のりもの：' + names.join('・') + '）' : ''));
    }
    if (d.sec) lines.push('あそんだ じかん：' + dlMin(d.sec));
    dlLines(box, lines);
    return box;
  }
  function fillDays() {
    var today = todayStr();
    if (!dlWeek) dlWeek = DL.weekStart(today);
    var w = DL.weekSummary(viewDays(), dlWeek, today, data);
    $('dl-range').textContent = mdOf(w.start) + '〜' + mdOf(w.end);
    $('dl-prev').disabled = !w.hasPrev; $('dl-next').disabled = !w.hasNext;
    $('dl-sum').textContent = w.any && (w.sum.sessions || w.sum.sec)
      ? 'この しゅうは しゅつどう ' + w.sum.sessions + 'かい・' + (w.sum.sec ? dlMin(w.sum.sec) + '・' : '') + 'あそんだ ひ ' + w.sum.playedDays + 'にち'
      : 'この しゅうは まだ きろくが ありません';
    var scale = 4;
    w.rows.forEach(function (r) { if (r.total > scale) scale = r.total; });   // 目盛りは max(4, その週のいちばん多い日)。満タンの線は描かない
    var rows = $('dl-rows'); rows.textContent = '';
    w.rows.forEach(function (r) {
      var tap = r.kind === 'day', row = el(tap ? 'button' : 'div', 'dl-row ' + r.kind + (tap && dlOpen === r.key ? ' open' : ''));
      if (tap) { row.type = 'button'; row.setAttribute('data-key', r.key); row.setAttribute('aria-expanded', dlOpen === r.key ? 'true' : 'false'); }
      var name = el('span', 'dl-day', DL_WD[DL.dayOfWeek(r.key)]);
      name.appendChild(el('small', '', mdOf(r.key)));
      if (r.key === today) name.appendChild(el('span', 'today', 'きょう'));
      var bar = el('span', 'dl-bar');
      if (r.kind === 'day') DL.GAMES.forEach(function (g) {
        if (!r.byGame[g]) return;
        var i = el('i', 'g-' + g); i.style.width = (r.byGame[g] / scale * 100) + '%'; bar.appendChild(i);
      });
      var val = el('span', 'dl-val');
      if (r.kind === 'day') { val.textContent = r.total + 'かい'; if (r.sec) val.appendChild(el('small', '', dlMin(r.sec))); }
      else if (r.kind === 'none') val.textContent = 'ー';
      else if (r.kind === 'old') { bar.textContent = 'きろく なし'; bar.style.cssText = 'font-size:13px;align-items:center'; }
      row.appendChild(name); row.appendChild(bar); row.appendChild(val);
      rows.appendChild(row);
      if (tap && dlOpen === r.key) rows.appendChild(dlDetail(r, w, today));
    });
    var lg = $('dl-legend'); lg.textContent = '';
    DL.GAMES.forEach(function (g) { var s = el('span'); s.appendChild(el('i', 'g-' + g)); s.appendChild(doc.createTextNode(DL_NAME[g])); lg.appendChild(s); });
    var gb = $('dl-got'); gb.textContent = '';
    if (w.got.any) {
      gb.appendChild(el('h4', '', 'この しゅうに できるように なったこと'));
      var g = w.got, lines = [];
      ['math', 'letter', 'clock', 'english'].forEach(function (k) { if (g.up[k]) lines.push(DL_NAME[k] + ' ' + g.up[k] + ' まで'); });
      g.gates.forEach(function (x) { lines.push((DL_NAME[dlGameOfLevel(x.level)] || '') + ' ' + x.level + ' の かんもんを とおった'); });
      g.stages.forEach(function (x) { var i = D.stageIndex(x.stage); lines.push('ステージ ' + (i >= 0 ? D.STAGES[i].rank : x.stage) + ' が ひらいた'); });
      if (g.newChars) lines.push('はじめて かいた じ：' + Array.from(g.newChars).join('・'));
      if (g.newSolo) lines.push('ひとりで かけた じ：' + Array.from(g.newSolo).join('・'));
      g.license.forEach(function (x) { lines.push(SET_LABEL_PARENT[x] + 'の めんきょ'); });
      if (g.newCars.length) lines.push('あたらしい のりもの：' + g.newCars.map(function (id) { var c = carById(id); return c ? c.name : ''; }).filter(Boolean).join('・'));
      dlLines(gb, lines);
    }
    $('dl-note').textContent = 'この たんまつで あそんだ ぶん だけ です。35にちより まえの きろくは きえます。じかんは しゅつどうの がめんに いた じかんの めやすです。かいすうより、たのしく つづける ことを たいせつに して ください。';
  }
  function dlMove(n) { dlWeek = DL.addDays(dlWeek || DL.weekStart(todayStr()), 7 * n); dlOpen = ''; fillDays(); }

  // 保護者画面: ステージ（手動の解放・再ロック。design-elementary 3.6）
  var relockAsk = ''; // 「とじる」を 1 回押したステージの id（2 段階の確認）
  var GATE_LABEL = { math: 'かず', letter: 'もじ', clock: 'とけい' };
  function mdOf(date) { var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date); return m ? (+m[1]) + '/' + (+m[2]) : date; }
  function fillStages() {
    var box = $('p-stages'); box.textContent = '';
    var unl = D.stageIndex(data.stage.unlocked), cur = stageIdx();
    D.STAGES.forEach(function (stg, i) {
      var open = i <= unl, row = el('div', 'stage-row' + (open ? ' open' : ''));
      var head = el('div', 'st-name'); head.appendChild(el('b', '', stg.rank));
      head.appendChild(doc.createTextNode('（' + stg.grade + '）'));
      head.appendChild(el('span', 'st-tag', (open ? 'ひらいている' : 'とじている') + (i === cur && unl > 0 ? '・いま あそんでいる' : '')));
      row.appendChild(head);
      var gate = i < D.STAGES.length - 1 ? LD.gateStatus(data, stg.id) : null;   // この かんもんを ぜんぶ とおると つぎの ステージが ひらく
      if (gate) {
        var g = el('div', 'gate'); g.appendChild(doc.createTextNode('つぎへの かんもん：'));
        Object.keys(gate).forEach(function (k) {
          g.appendChild(el('b', '', GATE_LABEL[k] + ' ' + D.gateOf(stg.id)[k] + ' ' + (gate[k] ? '◯ ' + mdOf(gate[k]) : 'ー')));
        });
        row.appendChild(g);
        row.appendChild(el('p', 'note', '「' + D.STAGES[i + 1].rank + '」に すすむ じょうけん：かんもんの 3つを、それぞれ 1かい 4もん ぜんぶ 1かいで せいかい（えいごは ふくみません）。'));
      }
      if (open) {
        var ps = [['hira', 'ひらがな'], ['kata', 'カタカナ'], ['k1', '1ねんの かんじ'], ['k2', '2ねんの かんじ']].filter(function (a) { return TR.allowedSets(stg.id).indexOf(a[0]) >= 0 && (i === 0 ? a[0] === 'hira' || a[0] === 'kata' : a[0] === (i === 1 ? 'k1' : 'k2')); });
        row.appendChild(el('div', 'gate', '（さんこう）かく：ひとりで かけた じ ' + ps.map(function (a) { return a[1] + ' ' + soloCount(a[0]) + '/' + STR.SETS[a[0]].length; }).join('・')));
        row.appendChild(el('p', 'note', 'かく は かんもんでは ありません。すすめるかどうかを きめる めやすの ひとつに どうぞ。'));
      }
      if (i > 0) {
        var acts = el('div', 'kid-acts');
        if (!open) acts.appendChild(kidBtn('ひらく', '', function () { replaceData(LD.unlockStage(data, stg.id, todayStr())); save(); relockAsk = ''; fillParent(); }));
        else if (relockAsk === stg.id) {
          row.appendChild(el('p', 'note warn', 'とじると ' + stg.rank + ' の すすみぐあいは ' + D.STAGES[i - 1].rank + ' に もどります（かんもんの きろくも きえます）。もういちど おすと とじます。'));
          acts.appendChild(kidBtn('ほんとうに とじる', 'danger', function () { replaceData(LD.relockStage(data, stg.id)); save(); relockAsk = ''; fillParent(); }));
          acts.appendChild(kidBtn('やめる', 'sub', function () { relockAsk = ''; fillStages(); }));
        } else acts.appendChild(kidBtn('とじる', 'danger', function () { relockAsk = stg.id; fillStages(); }));
        row.appendChild(acts);
      }
      box.appendChild(row);
    });
  }
  // 「こえ」: たんまつの こえ ＋ 同梱の声（voice/voices.js）。選ぶとその声でテストを読む
  function fillSpeakers() {
    var box = $('p-speakers'); if (!box) return;
    var list = (M.voiceList || []).map(function (v) { return { id: v.id, label: v.label + '（VOICEVOX）' }; });
    box.textContent = '';
    box.hidden = !list.length;
    if (!list.length) return;
    list.push({ id: 'device', label: 'たんまつの こえ' });
    list.forEach(function (v) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'pbtn' + (SP.speaker() === v.id ? ' sel' : ''); b.textContent = v.label;
      b.setAttribute('aria-pressed', SP.speaker() === v.id ? 'true' : 'false');
      b.addEventListener('click', function () {
        unlockOnce();
        dev.sound.speaker = v.id; applySound(); save(); fillSpeakers(); voiceNote();
        say(LN.FIXED.test, { force: true });
      });
      box.appendChild(b);
    });
  }
  function voiceNote() {
    var n = $('p-voice-note');
    var pre = (M.voiceList || []).length && SP.speaker() !== 'device' ? (root.location && root.location.protocol === 'file:' ? 'ファイルで ひらいているので、たんまつの こえに なります。' : SP.clipsState && SP.clipsState() === 'failed' ? 'こえの ファイルが よめないので、たんまつの こえで よみます。' : '') : '';
    if (pre) { n.textContent = pre; return; }
    if (SP.isVoiceless()) n.textContent = 'この たんまつでは にほんごの よみあげが つかえません。こうかおんと えだけで すすみますが、「もじ」と「とけい」（T3〜T6の「はん」や こまかい ぷん）の がくしゅうこうかは さがります。';
    else n.textContent = '「よみあげテスト」で にほんごが きこえるか たしかめてください。きこえない ときは、たんまつの おんりょうと にほんごの おんせいを かくにんしてください。';
  }

  function enNote() {
    var n = $('p-en-note'); if (!n) return;
    if (SP.enAvailable()) n.textContent = 'えいごの こえ：つかえます。「えいごテスト」で きこえるか たしかめてください。';
    else n.textContent = 'えいごの こえ：みつかりません。「えいご」は えらべません（ほかの あそびは ふつうに あそべます）。たんまつの せっていで えいごの おんせいを ついかすると つかえます。もじ・とけいは こえなしでも すすめますが、えいごは こえが ないと あそべません。';
  }

  // ---- 描画ループ ----
  var looping = false;
  function kick() { if (!looping) { looping = true; root.requestAnimationFrame(loop); } }
  function loop() {
    var t = now(), keep = false;
    if (screen === 'title') { drawTitle(); keep = true; }
    else if (screen === 'play' && stage) {
      stage.draw(t); keep = true;
      if (run && run.pulse) {   // 時計ボタンのヒント（短針ふくらまし）
        var bt = t - run.pulse.t0;
        if (bt < 1.8) drawAnswerClocks(Math.abs(Math.sin(bt / 0.9 * Math.PI)), run.pulse.key);
        else { drawAnswerClocks(0); run.pulse = null; }
      }
    }
    else if (screen === 'trace' && tboard) { tboard.draw(t); if (tstage) tstage.draw(t); drawSoloCard(t); keep = true; }
    else if (screen === 'reward' && reward) { drawReward(); keep = true; }
    else if (screen === 'promote' && promo) { drawPromote(); keep = true; }
    else if (screen === 'garage') { keep = drawGarage(); }
    looping = false;
    if (keep) kick();
  }

  // ---- 初期化（イベントの結線） ----
  function init() {
    drawAllIcons();
    applySound();
    SP.onChange(function () { updateVoiceMark(); updatePick(); syncCaption(); if (screen === 'parent') { voiceNote(); enNote(); } });
    doc.addEventListener('pointerdown', unlockOnce, true);
    doc.addEventListener('click', function (e) {
      if (now() < lockUntil) { e.stopPropagation(); e.preventDefault(); return; }
      unlockOnce();
    }, true);
    root.addEventListener('resize', function () {
      if (screen === 'play' && stage) { stage.resize(); stage.draw(now()); drawAnswerClocks(0); drawAnswerPics(); }
      if (screen === 'title') drawTitle();
      if (screen === 'trace') layoutTrace();
      if (screen === 'reward' && reward) drawReward();
      if (screen === 'promote') drawPromote();
      if (screen === 'garage') { if (garageOpen.tab === 'moji') layoutMoji(); else drawGarage(); }
    });
    root.addEventListener('orientationchange', function () { root.setTimeout(function () { root.dispatchEvent(new root.Event('resize')); }, 200); });

    $('btn-go').addEventListener('click', function () { sfx('tap'); show('pick'); });
    $('btn-garage').addEventListener('click', function () { sfx('tap'); garageOpen = { tab: 'cars', set: garageOpen.set, stamp: [], shelf: garageOpen.shelf, run: '' }; show('garage'); });
    $('gt-cars').addEventListener('click', function () { sfx('tap'); garageOpen.tab = 'cars'; garageOpen.stamp = []; showGarageTab(); drawGarage(); kick(); });
    $('gt-moji').addEventListener('click', function () { sfx('tap'); garageOpen.tab = 'moji'; showGarageTab(); });
    $('moji-close').addEventListener('click', function () { sfx('tap'); closeMojiSheet(); });
    $('moji-sheet').addEventListener('click', function (e) { if (e.target === this) closeMojiSheet(); });
    $('moji-solo').addEventListener('click', function () { var ch = mojiSheetCh; if (!ch) return; sfx('tap'); closeMojiSheet(); startSolo({ chosen: ch }); });
    $('moji-solo-top').addEventListener('click', function () { sfx('tap'); startSolo(); });
    $('moji-go').addEventListener('click', function () { var ch = mojiSheetCh; if (!ch) return; sfx('tap'); closeMojiSheet(); startTrace({ chosen: ch }); });
    $('btn-sound').addEventListener('click', function () {
      var on = !(dev.sound.sfx || dev.sound.voice);
      dev.sound.sfx = dev.sound.voice = on; applySound(); save(); updateVoiceMark(); updatePick();
      if (on) sfx('tap');
    });
    holdButton($('btn-gear'), 2000, function () { show('parent'); });
    $('btn-pick-back').addEventListener('click', function () { sfx('tap'); show('title'); });
    $('btn-math').addEventListener('click', function () { startSession('math'); });
    $('btn-letter').addEventListener('click', function () { startSession('letter'); });
    $('btn-clock').addEventListener('click', function () { startSession('clock'); });
    $('btn-english').addEventListener('click', function () {
      if (enOff()) {   // 英語の声が無い: 出動しない。おしい音と、日本語の声が使えれば説明を読む
        updatePick(); sfx('oshii'); say(LN.FIXED.noEnglish); return;
      }
      startSession('english');
    });
    $('btn-trace').addEventListener('click', function () { startTrace(); });
    holdButton($('btn-quit'), 2000, quitSession);
    holdButton($('btn-trace-quit'), 2000, quitTrace);
    $('btn-solo-done').addEventListener('click', function () { soloDone(); });
    $('btn-solo-undo').addEventListener('click', function () { if (trun && trun.solo && trun.phase === 'write' && tboard.undoInk()) sfx('tap'); });
    $('solo-card').addEventListener('click', soloShowHint);
    $('btn-r-solo').addEventListener('click', function () { sfx('tap'); startSolo(); });
    $('btn-trace-replay').addEventListener('click', function () {
      if (!trun || !tboard) return;
      if (trun.solo && trun.phase === 'write') { soloShowHint(); return; }   // 線なし: 札の書き順と、1 画目のヒント
      if (tboard.replay()) { var ti = traceInfoAt(trun.idx); say(tracePrompt(trun.chars[trun.idx], ti), { alt: LN.tracePromptAlt(trun.chars[trun.idx], ti) }); }   // 手本の書き足し中は効かない
      kick();
    });
    doc.addEventListener('visibilitychange', function () {
      if (tm) {   // 隠れていた間は出動の時間に数えない
        if (doc.hidden) { if (tm.hiddenAt === null) tm.hiddenAt = now(); }
        else if (tm.hiddenAt !== null) { tm.hid += now() - tm.hiddenAt; tm.hiddenAt = null; }
      }
      if (doc.hidden && tboard && tboard.active) tboard.cancelActive();
    });   // 画面が隠れたら書きかけの線を捨てる
    // 「かく」の間だけ: iOS の 2 本指の拡大・スクロールを止める（design-tracing 4.4）
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { doc.addEventListener(n, function (e) { if (screen === 'trace') e.preventDefault(); }, { passive: false }); });
    $('s-trace').addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    $('answers').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.ans') : null;
      if (b) onAnswer(b);
    });
    $('btn-replay').addEventListener('click', function () {
      if (!run || run.busy) return;
      var q = run.qs[run.idx]; sayPrompt(q);
      if (q.kind === 'letter' || q.kind === 'english') stage.bouncePic(now());
      if (q.kind === 'sub') stage.subT0 = null;   // ひきざん: 「いなくなる」ところをもう一度見せる
      kick();
    });
    $('sceneCanvas').addEventListener('pointerdown', function (e) {
      if (!run || run.busy) return;
      var q = run.qs[run.idx]; if (!q) return;
      var r = this.getBoundingClientRect();
      if (q.kind === 'letter') { stage.bouncePic(now()); say(promptText(q)); kick(); return; }
      if (q.kind === 'clock') { say(promptText(q)); kick(); return; }   // 時計をタップ: 問題をもう一度（答えは言わない）
      if (q.kind === 'english') { sayPrompt(q); stage.bouncePic(now()); kick(); return; }   // スピーカーをタップ: もう一度きく
      var i = stage.hit(e.clientX - r.left, e.clientY - r.top);
      var n = stage.mark(i);
      if (n) { stage.bounce(i, now()); sfx('pon', n); say(LN.number(n)); kick(); }
    });
    $('btn-r-garage').addEventListener('click', function () {
      sfx('tap');
      if (reward && reward.game === 'trace') {   // かく から来たときは「もじ」を開き、今日の字にスタンプが押される
        var w = reward.wrote || [];
        var firstNew = reward.firstNew || '';   // その出動の新しい字の集合を優先（なければ今の集合）
        garageOpen = { tab: 'moji', set: firstNew ? setOfChar(firstNew) : '', stamp: w.slice(), shelf: rewardShelf(), run: '' };   // 「のりもの」に切り替えると もらった乗り物の棚（うみ など）
      } else garageOpen = { tab: 'cars', set: garageOpen.set, stamp: [], shelf: rewardShelf(), run: reward && reward.r.id ? reward.r.id : '' };
      leaveReward('garage');
    });
    $('btn-r-end').addEventListener('click', function () { sfx('tap'); leaveReward('today'); });   // 昇格があれば先に昇格画面（そのあとタイトル）
    $('btn-r-again').addEventListener('click', function () {
      sfx('tap');
      if (reward && reward.game === 'trace') { if (reward.solo && soloAvailable()) startSolo(); else startTrace(); } else leaveReward('pick');   // かく から来たときは かく をもう一度（ひとりで かく のあとは ひとりで かく。出せる字が足りなければ なぞり）
    });
    $('btn-pr-go').addEventListener('click', function () {   // 「すすむ」: 新しいステージを選んでタイトルへ
      sfx('tap'); if (promo) { replaceData(LD.selectStage(data, promo.stage)); save(); }
      var nx = promo && promo.next || 'title'; promo = null; show(nx);
    });
    $('btn-pr-later').addEventListener('click', function () { sfx('tap'); var nx = promo && promo.next || 'title'; promo = null; show(nx); });
    $('btn-today-ok').addEventListener('click', function () { sfx('tap'); show('title'); });
    $('today-strip').addEventListener('click', function () { sfx('tap'); show('today'); });
    $('btn-g-back').addEventListener('click', function () { sfx('tap'); show('title'); });
    $('dl-prev').addEventListener('click', function () { dlMove(-1); });
    $('dl-next').addEventListener('click', function () { dlMove(1); });
    $('dl-rows').addEventListener('click', function (e) {   // 行をタップ → その日の内訳（もう一度で閉じる）
      var b = e.target.closest ? e.target.closest('button.dl-row') : null;
      if (!b) return;
      var k = b.getAttribute('data-key'); dlOpen = dlOpen === k ? '' : k; fillDays();
    });
    $('btn-p-back').addEventListener('click', function () { kidEdit = null; relockAsk = ''; restoredShown = false; show('title'); });
    $('btn-who').addEventListener('click', function () { sfx('tap'); if (state.profiles.length > 1) show('who'); });
    $('p-kid-add').addEventListener('click', addKid);

    // 保護者画面
    $('p-sfx').addEventListener('change', function () { dev.sound.sfx = this.checked; applySound(); save(); updateVoiceMark(); sfx('correct'); });
    $('p-voice').addEventListener('change', function () { dev.sound.voice = this.checked; applySound(); save(); updateVoiceMark(); updatePick(); });
    $('p-test').addEventListener('click', function () {
      unlockOnce();
      if (!say(LN.FIXED.test, { force: true })) $('p-voice-note').textContent = 'よみあげが つかえません（このたんまつは こえなしモードです）。';
    });
    $('p-test-en').addEventListener('click', function () {
      unlockOnce();
      if (!SP.speakSeq([{ text: 'Fire truck', lang: 'en' }], { force: true })) enNote();
    });
    ['math', 'letter', 'clock', 'english'].forEach(function (g) {
      $('p-lv-' + g).addEventListener('change', function () { replaceData(LD.chooseLevel(data, g, this.value)); save(); fillParent(); });
      $('p-lock-' + g).addEventListener('change', function () { data.locked[g] = this.checked; save(); });
    });
    $('p-clear').addEventListener('click', function () {
      clearStep++;
      if (clearStep === 1) { this.textContent = 'ほんとうに けしますか？（もういちど おす）'; $('p-clear-note').textContent = state.profiles.length + 'にん ぶんの きろくと あつめた くるまが すべて きえます。'; }
      else {
        S.clear(); state = S.fresh(); rebind(); kidEdit = null; restoredShown = false; applySound(); save(); fillParent(); updateVoiceMark();
        $('p-clear-note').textContent = 'データを けしました。';
      }
    });
    show(state.profiles.length > 1 ? 'who' : 'title');
  }

  // main.js から使う / デバッグ用
  M.ui = {
    init: init, show: show, startSession: startSession, startTrace: startTrace, startSolo: startSolo, drawIcon: drawIcon,
    soloDebug: function (on) { soloDebugOn = on !== false; },
    get traceBoard() { return tboard; },
    // 確認用: 次の出動の字と why を返す（くじを固定）。prev は今のプロフィールの前の出動
    tracePlan: function () {
      var seed = 12345, rng = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
      var r = planTrace({}, rng);
      return { plan: r.plan, prev: (prevTrace[data.id] || []).slice(), names: r.names.map(function (o) { return o.ch; }), name: data.name };
    },
    // 確認用: いまの字の たすけ（help）を 1 足す（help ≤ done を保つ）
    traceAddHelp: function () {
      var ch = trun && trun.chars[trun.idx]; if (!ch) return '';
      var t = data.trace, d = Math.max(1, t.done[ch] || 0), h = Math.min(99, d, (t.help[ch] || 0) + 1);
      t.done[ch] = d; t.help[ch] = h; save(); return ch + ' done ' + d + ' help ' + h;
    },
    traceAuto: function (on) { if (tboard) { tboard.auto = on !== false; kick(); } },
    get data() { return data; },
    setData: function (d) {   // 今のプロフィールを置き換える
      var i = state.profiles.indexOf(data);
      if (i >= 0) {
        var cur = state.profiles[i];
        ['id', 'name', 'icon', 'created'].forEach(function (k) { if (d[k] === undefined) d[k] = cur[k]; });
        state.profiles[i] = d;
      }
      data = d; applySound(); save();
    },
    useProfile: useProfile,
    gotoPromote: function (stageId) { promo = { stage: stageId || 'S1', t0: 0 }; show('promote'); },
    get state() { return state; },
    addDummyProfile: function () { addLock = 0; addKid(); kidEdit = null; },
    gotoReward: function (scene, rank, game) {   // 確認用。rank 省略は S0 と同じ。game 省略は今までの出方（棚なし）
      var r = grantReward(scene || 'kaji', rank, game);
      save();
      reward = { r: r, t0: 0, played: game || '' }; show('reward');
    },
    previewGarage: function () {
      garageOpen = { tab: 'cars', set: '', stamp: [], shelf: garageOpen.shelf, run: '' };
      show('garage');
    },
    // 確認用: 「もじ」の表を開く（setId 省略は今の集合）。stamp に字を渡すと、その字に順にスタンプが押される
    previewMoji: function (setId, stamp) {
      garageOpen = { tab: 'moji', set: setId || '', stamp: stamp || [], shelf: garageOpen.shelf, run: '' };
      show('garage');
    },
    current: function () { return run ? run.qs[run.idx] : null; },
    // 確認用: 日ごとの記録（今の子の days）。見本は 35 日分をつくり直す（保存する。確認用の端末だけで使う）
    debugDays: function () { return JSON.stringify(data.days || {}); },
    debugDaysSample: function () {
      var today = todayStr(), seed = 7, rnd = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
      var days = {}, chars = Array.from(STR.SETS.hira), ci = 0;
      for (var i = 34; i >= 0; i--) {
        var day = DL.addDays(today, -i), wd = DL.dayOfWeek(day);
        var play = i === 0 || rnd() < (wd === 0 || wd === 6 ? 0.8 : 0.6);   // 今日は必ず遊んだ日にする
        if (!play) continue;
        var kinds = [];
        DL.GAMES.forEach(function (g) { if (rnd() < 0.45) kinds.push(g); });
        if (i === 0 && !kinds.length) kinds.push('math');
        kinds.forEach(function (g) {
          var n = 1 + Math.floor(rnd() * 3);
          for (var k = 0; k < n; k++) {
            if (g === 'trace' || g === 'solo') {
              for (var c = 0; c < 4; c++) { var ch = chars[ci++ % chars.length]; days = DL.recordChar(days, day, { game: g, ch: ch, firstDone: ci <= chars.length, firstSolo: g === 'solo' && ci <= chars.length }); }
              days = DL.recordSession(days, day, { game: g, reward: { id: 'bus', isNew: false }, license: g === 'solo' && ci === 46 ? 'hira' : '' });
            } else {
              var lv = D.LEVELS[g];
              days = DL.recordSession(days, day, { game: g, questions: 4, firstTry: 2 + Math.floor(rnd() * 3), up: rnd() < 0.15 ? lv[Math.min(lv.length - 1, 1 + Math.floor(i / 8))] : '', reward: rnd() < 0.5 ? { id: 'taxi', isNew: rnd() < 0.3 } : { sticker: true } });
            }
            days = DL.addTime(days, day, 90 + Math.floor(rnd() * 150));
          }
        });
      }
      data.days = days;
      var gate = D.gateLevels()[0];
      if (gate && !data.cleared[gate]) data.cleared[gate] = DL.addDays(today, -2);   // 「できるように なったこと」の見本
      save();
      if (screen === 'parent') fillParent();
      return Object.keys(days).length;
    },
    debugProgress: function (n) { if (stage) { stage.setProgress(n); updateLamps(n); stage.draw(now()); } },
    refresh: function () { updateVoiceMark(); if (screen === 'parent') fillParent(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
