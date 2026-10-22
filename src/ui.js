// 画面遷移・イベント・出動の流れ。純粋関数は problems.js / rewards.js、保存は storage.js。
(function (root) {
  'use strict';
  var M = root.Manabi, D = M.data, P = M.problems, R = M.rewards, S = M.storage;
  var A = M.audio, SP = M.speech, V = M.vehicles, SC = M.scenes;
  var doc = root.document;

  function $(id) { return doc.getElementById(id); }
  function now() { return root.performance.now() / 1000; }
  function carById(id) { for (var i = 0; i < D.CARS.length; i++) if (D.CARS[i].id === id) return D.CARS[i]; return null; }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  var data = S.load();
  var screen = 'title';
  var stage = null;          // 問題画面の Stage
  var run = null;            // 出動中の状態
  var lastScene = null;
  var timers = [];           // 画面をまたぐタイマー（やめたときに全部消す）
  var token = 0;             // 出動のやり直しで古い処理を無効にする
  var reward = null;         // ごほうび画面の状態
  var titleStart = now();
  var debugMode = false;

  function later(ms, fn) { var id = root.setTimeout(function () { fn(); }, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(root.clearTimeout); timers = []; }
  function save() { S.save(data); }

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
    if (kind === 'kazu') {   // ● ● ●
      [[.25, .35], [.5, .35], [.75, .35], [.37, .68], [.63, .68]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0] * w, p[1] * h, w * .1, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); });
      return;
    }
    if (kind === 'moji') {   // あ
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + h * .85 + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('あ', w / 2, h * .54);
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
    if (kind === 'back') { ln(.62, .2, .3, .5, .12); ln(.3, .5, .62, .8, .12); return; }
    if (kind === 'x') { ln(.25, .25, .75, .75, .12); ln(.75, .25, .25, .75, .12); }
  }
  function drawAllIcons() { [].forEach.call(doc.querySelectorAll('canvas[data-icon]'), function (cv) { drawIcon(cv, cv.getAttribute('data-icon')); }); }

  // ---- 画面切替 ----
  var lockUntil = 0;
  function show(name) {
    screen = name;
    if (name !== 'reward') clearTimers();   // ごほうびの「げっと」などを画面を離れたら止める
    lockUntil = now() + 0.4;                // 遷移直後の二度押しを無視
    if (name !== 'play' && name !== 'reward') SP.cancel();
    [].forEach.call(doc.querySelectorAll('.screen'), function (s) { s.classList.toggle('active', s.id === 's-' + name); });
    updateVoiceMark();
    if (name === 'title') { drawTitle(); kick(); }
    if (name === 'pick') later(300, function () { say('どっちで しゅつどう？'); });
    if (name === 'garage') buildGarage();
    if (name === 'parent') fillParent();
    if (name === 'play' && stage) { stage.resize(); stage.draw(now()); }
    if (name === 'reward') startRewardAnim();
  }
  function updateVoiceMark() {
    var x = data.sound.voice && SP.isVoiceless();
    [].forEach.call(doc.querySelectorAll('.voice-x'), function (e) { e.hidden = !x; });
    var sound = $('btn-sound').querySelector('canvas');
    sound.setAttribute('data-icon', data.sound.sfx || data.sound.voice ? 'speaker' : 'speakerx');
    drawIcon(sound, sound.getAttribute('data-icon'));
  }

  // ---- 音 ----
  function applySound() { A.setEnabled(data.sound.sfx); SP.setEnabled(data.sound.voice); }
  function sfx(name, arg) { A.play(name, arg); }
  function say(text, opts) { return SP.speak(text, opts); }
  var unlocked = false;
  function unlockOnce() {
    A.unlock();                       // タップのたびに resume を試みる（タッチは pointerup/click で許可されるため）
    if (unlocked) return; unlocked = true;
    SP.init();
  }

  // ---- 長押し（誤タップ防止） ----
  function holdButton(el, ms, cb) {
    var id = 0;
    function stop() { if (id) { root.clearTimeout(id); id = 0; } el.classList.remove('holding'); }
    el.addEventListener('pointerdown', function () {
      unlockOnce(); stop(); el.classList.add('holding');
      id = root.setTimeout(function () { id = 0; el.classList.remove('holding'); cb(); }, ms);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, stop); });
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
    SC.drawTitle(c.ctx, c.w, c.h, now() - titleStart + 1.2, litWindows());
  }

  // ---- 出動 ----
  function pickScene() {
    var list = D.SCENES.filter(function (s) { return s !== lastScene; });
    var s = list[Math.floor(Math.random() * list.length)];
    lastScene = s; return s;
  }
  var NUMK = D.NUM_KANA;

  function startSession(game, opts) {
    opts = opts || {};
    clearTimers(); token++;
    var level = data.levels[game];
    run = {
      game: game, level: level, scene: opts.scene || pickScene(), qs: P.generateSession(game, level, Math.random),
      idx: 0, firstTry: 0, wrong: 0, off: [], busy: true, token: token
    };
    if (!stage) stage = new SC.Stage($('sceneCanvas'));
    show('play');
    stage.setScene(run.scene); stage.setProgress(0);
    updateLamps(0);
    stage.resize();
    sfx('siren');
    say('しゅつどう！');
    stage.setProblem(null); stage.draw(now());
    later(opts.fast ? 0 : 1500, function () { presentQuestion(); });
  }
  function updateLamps(n) {
    [].forEach.call($('lamps').children, function (e, i) { e.classList.toggle('on', i < n); });
  }
  function promptText(p) {
    if (p.kind === 'count') return 'いくつ あるかな？';
    if (p.kind === 'add') return NUMK[p.a] + ' たす ' + NUMK[p.b] + ' は？';
    var w = wordOf(p.wordId);
    return w.speech + '。さいしょのもじは？';
  }
  function wordOf(id) { for (var i = 0; i < D.WORDS.length; i++) if (D.WORDS[i].id === id) return D.WORDS[i]; return null; }
  function exampleOf(ch) { for (var i = 0; i < D.WORDS.length; i++) if (D.WORDS[i].head === ch) return D.WORDS[i].example; return ch; }

  function presentQuestion() {
    var q = run.qs[run.idx];
    run.wrong = 0; run.off = []; run.busy = false; run.counting = false; run.t0 = now();
    stage.setProblem(q);
    renderAnswers(q);
    stage.draw(now());
    say(promptText(q));
    if (q.kind === 'letter') stage.bouncePic(now() + 0.3);
    kick();
  }
  function renderAnswers(q) {
    var box = $('answers'); box.innerHTML = '';
    q.choices.forEach(function (c) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'ans'; b.setAttribute('data-v', String(c));
      if (q.kind === 'letter') b.innerHTML = '<span class="kana">' + c + '</span>';
      else {
        var dots = '';
        for (var i = 0; i < c; i++) { dots += '<i></i>'; if (i === 4 && c > 5) dots += '<b></b>'; }
        b.innerHTML = '<span class="num">' + c + '</span><span class="dots">' + dots + '</span>';
      }
      box.appendChild(b);
    });
  }
  function answerButtons() { return [].slice.call($('answers').children); }

  function onAnswer(btn) {
    if (!run || run.busy || btn.classList.contains('off')) return;
    var q = run.qs[run.idx], raw = btn.getAttribute('data-v');
    var v = q.kind === 'letter' ? raw : +raw;
    if (v === q.answer) return onCorrect(q, btn);
    run.wrong++;
    run.off.push(v);
    btn.classList.add('off', 'shake'); btn.classList.remove('glow');
    sfx('oshii');
    say(q.kind === 'letter' ? exampleOf(v) + 'の ' + v + '。おしい！もういちど' : 'おしい！もういちど');
    var left = answerButtons().filter(function (b) { return !b.classList.contains('off'); });
    var voiceless = SP.isVoiceless() || !data.sound.voice;
    if (run.wrong >= 2 || left.length <= 1 || (q.kind === 'letter' && voiceless)) {
      later(900, function () {
        if (!run || run.busy) return;
        answerButtons().forEach(function (b) { if (b.getAttribute('data-v') === String(q.answer)) b.classList.add('glow'); });
        say('こっちかな？');
        if (q.kind === 'count' || q.kind === 'add') countAloud(q);
        else stage.bouncePic(now());
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
      sfx('pon', n); say(NUMK[n]); kick();
      later(800, function () { tick(i + 1); });
    };
    later(1200, function () { tick(0); });
  }

  function onCorrect(q, btn) {
    run.busy = true; run.counting = false; stage.reveal = true;
    var first = run.wrong === 0;
    if (first) run.firstTry++;
    answerButtons().forEach(function (b) { b.classList.remove('glow'); });
    sfx('correct');
    var done = run.idx + 1;
    if (q.kind === 'letter') say('そう！ ' + q.answer + '！ ' + exampleOf(q.answer) + 'の ' + q.answer);
    else say('そう！ ' + NUMK[q.answer] + '！');
    updateLamps(done);
    later(700, function () {
      sfx(run.scene === 'kaji' ? 'water' : run.scene === 'takai' ? 'ladder' : 'dig');
      sfx('horn');
    });
    stage.advance(done, now(), done === P.QUESTIONS_PER_SESSION ? 2.4 : 1.6);
    kick();
    var my = run.token;
    later(done === P.QUESTIONS_PER_SESSION ? 3300 : 2300, function () {
      if (!run || run.token !== my) return;
      run.idx++;
      if (run.idx >= P.QUESTIONS_PER_SESSION) finishSession(); else presentQuestion();
    });
  }

  // ごほうびを抽選して data.cards に反映する（通常の流れと確認パネルで共通）
  function grantReward(scene) {
    var a = R.applyReward(data.cards, scene, Math.random);
    data.cards = a.cards;
    return a.r;
  }

  function finishSession() {
    var game = run.game, st = data.stats;
    st.sessions++; st[game].sessions++;
    st[game].questions += P.QUESTIONS_PER_SESSION; st[game].firstTry += run.firstTry;
    data.levels[game] = P.nextLevel(game, run.level, run.firstTry, data.locked[game]);
    var r = grantReward(run.scene);
    data.lastPlayed = todayStr();
    save();
    reward = { r: r, t0: 0 };
    run = null;
    show('reward');
  }

  function quitSession() {
    clearTimers(); token++; run = null; SP.cancel();
    show('title');
  }

  // ---- ごほうび ----
  function rewardCar() { return reward && reward.r.id ? carById(reward.r.id) : null; }
  function startRewardAnim() {
    reward.t0 = now(); reward.sound = 0;
    var r = reward.r, car = rewardCar();
    $('reward-text').textContent = ''; $('reward-sub').textContent = '';
    drawReward();
    later(500, function () { sfx('card'); });
    later(1100, function () {
      sfx('fanfare');
      if (car) {
        $('reward-text').textContent = car.name + ' をげっと！';
        $('reward-sub').textContent = r.isNew ? 'あたらしい くるま！' : '★が ふえたよ！';
        say(car.name + 'を げっと！');
      } else {
        $('reward-text').textContent = 'ごほうびすてっかー！';
        say('ごほうびすてっかー！');
      }
    });
    kick();
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

  // ---- しゃこ ----
  var slots = [];
  function buildGarage() {
    var grid = $('garage-grid'); grid.innerHTML = ''; slots = [];
    var have = 0;
    D.CARS.forEach(function (car) {
      var n = data.cards[car.id] || 0; if (n) have++;
      var el = doc.createElement('button');
      el.type = 'button'; el.className = 'slot' + (n ? '' : ' none');
      var stars = ''; for (var i = 1; i <= 3; i++) stars += i <= n ? '★' : '☆';
      el.innerHTML = '<canvas></canvas><div class="nm"></div><div class="st"></div>';
      el.querySelector('.nm').textContent = n ? car.name : '？';
      el.querySelector('.st').textContent = n ? stars : '';
      grid.appendChild(el);
      var slot = { el: el, car: car, n: n, cv: el.querySelector('canvas'), drive: -1 };
      slots.push(slot);
      el.addEventListener('click', function () {
        unlockOnce();
        if (!slot.n) { sfx('tap'); return; }
        slot.drive = now(); sfx('pipoo'); say(car.name); kick();
      });
    });
    $('g-count').textContent = have + ' / 11';
    drawGarage();
  }
  function drawGarage() {
    var t = now(), busy = false;
    slots.forEach(function (s) {
      var c = sizeCanvas(s.cv), ctx = c.ctx, sz = Math.min(c.w * 0.9, c.h * 1.15);
      ctx.clearRect(0, 0, c.w, c.h);
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, c.h * 0.86, c.w, 4);
      if (!s.n) { V.drawSilhouette(ctx, s.car.stage, c.w / 2, c.h * 0.5, sz, '#4a4f5c'); return; }
      var x = c.w / 2;
      if (s.drive >= 0) {
        var u = (t - s.drive) / 1.5;
        if (u >= 1) s.drive = -1; else { x = -sz * 0.5 + (c.w + sz) * u; busy = true; }
      }
      V.drawVehicle(ctx, s.car.stage, x, c.h * 0.5, sz);
    });
    return busy;
  }

  // ---- おうちのひと ----
  var clearStep = 0;
  function fillParent() {
    var st = data.stats, have = 0, stars = 0;
    D.CARS.forEach(function (c) { var n = data.cards[c.id] || 0; if (n) have++; stars += n; });
    function pct(g) { var q = st[g].questions; return q ? Math.round(st[g].firstTry / q * 100) + '%' : '-'; }
    $('p-progress').innerHTML =
      '<div class="prow"><span>しゅつどうの かいすう</span><b>' + st.sessions + '</b></div>' +
      '<div class="prow"><span>かず：いまのレベル</span><b>' + data.levels.math + '（1かいめで せいかい ' + pct('math') + '）</b></div>' +
      '<div class="prow"><span>もじ：いまのレベル</span><b>' + data.levels.letter + '（1かいめで せいかい ' + pct('letter') + '）</b></div>' +
      '<div class="prow"><span>あつめた くるま</span><b>' + have + ' / 11（★ ' + stars + '）</b></div>';
    $('p-sfx').checked = data.sound.sfx; $('p-voice').checked = data.sound.voice;
    ['math', 'letter'].forEach(function (g) {
      var sel = $('p-lv-' + g);
      if (!sel.options.length) P.LEVELS[g].forEach(function (lv) { var o = doc.createElement('option'); o.value = lv; o.textContent = lv; sel.appendChild(o); });
      sel.value = data.levels[g]; $('p-lock-' + g).checked = data.locked[g];
    });
    voiceNote();
    $('p-storage-note').hidden = S.isPersistent();
    clearStep = 0; $('p-clear').textContent = 'データをけす'; $('p-clear-note').textContent = '';
  }
  function voiceNote() {
    var n = $('p-voice-note');
    if (SP.isVoiceless()) n.textContent = 'この たんまつでは にほんごの よみあげが つかえません。こうかおんと えだけで すすみますが、「もじ」の がくしゅうこうかは さがります。';
    else n.textContent = '「よみあげテスト」で にほんごが きこえるか たしかめてください。きこえない ときは、たんまつの おんりょうと にほんごの おんせいを かくにんしてください。';
  }

  // ---- 描画ループ ----
  var looping = false;
  function kick() { if (!looping) { looping = true; root.requestAnimationFrame(loop); } }
  function loop() {
    var t = now(), keep = false;
    if (screen === 'title') { drawTitle(); keep = true; }
    else if (screen === 'play' && stage) { stage.draw(t); keep = true; }
    else if (screen === 'reward' && reward) { drawReward(); keep = true; }
    else if (screen === 'garage') { keep = drawGarage(); }
    looping = false;
    if (keep) kick();
  }

  // ---- 初期化（イベントの結線） ----
  function init() {
    drawAllIcons();
    applySound();
    SP.onChange(function () { updateVoiceMark(); if (screen === 'parent') voiceNote(); });
    doc.addEventListener('pointerdown', unlockOnce, true);
    doc.addEventListener('click', function (e) {
      if (now() < lockUntil) { e.stopPropagation(); e.preventDefault(); return; }
      unlockOnce();
    }, true);
    root.addEventListener('resize', function () {
      if (screen === 'play' && stage) { stage.resize(); stage.draw(now()); }
      if (screen === 'title') drawTitle();
      if (screen === 'reward' && reward) drawReward();
      if (screen === 'garage') drawGarage();
    });
    root.addEventListener('orientationchange', function () { root.setTimeout(function () { root.dispatchEvent(new root.Event('resize')); }, 200); });

    $('btn-go').addEventListener('click', function () { sfx('tap'); show('pick'); });
    $('btn-garage').addEventListener('click', function () { sfx('tap'); show('garage'); });
    $('btn-sound').addEventListener('click', function () {
      var on = !(data.sound.sfx || data.sound.voice);
      data.sound.sfx = data.sound.voice = on; applySound(); save(); updateVoiceMark();
      if (on) sfx('tap');
    });
    holdButton($('btn-gear'), 2000, function () { show('parent'); });
    $('btn-pick-back').addEventListener('click', function () { sfx('tap'); show('title'); });
    $('btn-math').addEventListener('click', function () { startSession('math'); });
    $('btn-letter').addEventListener('click', function () { startSession('letter'); });
    holdButton($('btn-quit'), 2000, quitSession);
    $('answers').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.ans') : null;
      if (b) onAnswer(b);
    });
    $('btn-replay').addEventListener('click', function () {
      if (!run || run.busy) return;
      var q = run.qs[run.idx]; say(promptText(q));
      if (q.kind === 'letter') stage.bouncePic(now()); kick();
    });
    $('sceneCanvas').addEventListener('pointerdown', function (e) {
      if (!run || run.busy) return;
      var q = run.qs[run.idx]; if (!q) return;
      var r = this.getBoundingClientRect();
      if (q.kind === 'letter') { stage.bouncePic(now()); say(promptText(q)); kick(); return; }
      var i = stage.hit(e.clientX - r.left, e.clientY - r.top);
      var n = stage.mark(i);
      if (n) { stage.bounce(i, now()); sfx('pon', n); say(NUMK[n]); kick(); }
    });
    $('btn-r-garage').addEventListener('click', function () { sfx('tap'); show('garage'); });
    $('btn-r-again').addEventListener('click', function () { sfx('tap'); show('pick'); });
    $('btn-g-back').addEventListener('click', function () { sfx('tap'); show('title'); });
    $('btn-p-back').addEventListener('click', function () { show('title'); });

    // 保護者画面
    $('p-sfx').addEventListener('change', function () { data.sound.sfx = this.checked; applySound(); save(); updateVoiceMark(); sfx('correct'); });
    $('p-voice').addEventListener('change', function () { data.sound.voice = this.checked; applySound(); save(); updateVoiceMark(); });
    $('p-test').addEventListener('click', function () {
      unlockOnce();
      if (!say('こんにちは。はたらくまなびです', { force: true })) $('p-voice-note').textContent = 'よみあげが つかえません（このたんまつは こえなしモードです）。';
    });
    ['math', 'letter'].forEach(function (g) {
      $('p-lv-' + g).addEventListener('change', function () { data.levels[g] = this.value; save(); fillParent(); });
      $('p-lock-' + g).addEventListener('change', function () { data.locked[g] = this.checked; save(); });
    });
    $('p-clear').addEventListener('click', function () {
      clearStep++;
      if (clearStep === 1) { this.textContent = 'ほんとうに けしますか？（もういちど おす）'; $('p-clear-note').textContent = 'あつめた くるまと すすみぐあいが すべて きえます。'; }
      else {
        S.clear(); data = S.normalize(null); applySound(); save(); fillParent(); updateVoiceMark();
        $('p-clear-note').textContent = 'データを けしました。';
      }
    });
    show('title');
  }

  // main.js から使う / デバッグ用
  M.ui = {
    init: init, show: show, startSession: startSession, drawIcon: drawIcon,
    get data() { return data; },
    setData: function (d) { data = d; applySound(); save(); },
    gotoReward: function (scene) {
      var r = grantReward(scene || 'kaji');
      save();
      reward = { r: r, t0: 0 }; show('reward');
    },
    previewGarage: function () {
      show('garage');
    },
    current: function () { return run ? run.qs[run.idx] : null; },
    debugProgress: function (n) { if (stage) { stage.setProgress(n); updateLamps(n); stage.draw(now()); } },
    refresh: function () { updateVoiceMark(); if (screen === 'parent') fillParent(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
