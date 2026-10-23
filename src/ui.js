// 画面遷移・イベント・出動の流れ。純粋関数は problems.js / rewards.js、保存は storage.js。
(function (root) {
  'use strict';
  var M = root.Manabi, D = M.data, P = M.problems, R = M.rewards, S = M.storage;
  var A = M.audio, SP = M.speech, V = M.vehicles, SC = M.scenes, CF = M.clockface;
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

  // 現場ごとに出動する車の stage（scenes.js の drawKaji=8, drawTakai=10, drawMichi=4）
  var DISPATCH_STAGE = { kaji: 8, takai: 10, michi: 4 };

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
    if (name === 'pick') { updatePick(); later(300, function () { say('どれで出動する？'); }); }
    if (name === 'garage') buildGarage();
    if (name === 'parent') fillParent();
    if (name === 'play' && stage) { stage.resize(); stage.draw(now()); }
    if (name === 'reward') startRewardAnim();
  }
  // 出動えらびの「えいご」: 英語の声が使えないときは選べない（グレー＋スピーカー×）。開くたび・声の状態が変わるたびに見直す
  // 英語が聞こえない状態（声が無い／失敗した／保護者がよみあげをオフにした）。えいごは聞いて選ぶので、この間は成立しない
  function enOff() { return !SP.enAvailable() || !data.sound.voice; }
  function updatePick() {
    var b = $('btn-english'); if (!b) return;
    var off = enOff();
    b.classList.toggle('disabled', off); b.setAttribute('aria-disabled', off ? 'true' : 'false');
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
    SC.drawTitle(c.ctx, c.w, c.h, now() - titleStart + 1.2, litWindows());
  }

  // ---- 出動 ----
  function pickScene() {
    var list = D.SCENES.filter(function (s) { return s !== lastScene; });
    var s = list[Math.floor(Math.random() * list.length)];
    lastScene = s; return s;
  }
  var NUMK = D.NUM_KANA;

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
    var level = data.levels[game];
    var qs = P.generateSession(game, level, Math.random, game === 'letter' ? seenLetter() : undefined);
    if (game === 'letter') rememberLetter(qs);
    run = {
      game: game, level: level, scene: opts.scene || pickScene(), qs: qs,
      idx: 0, firstTry: 0, wrong: 0, off: [], busy: true, token: token
    };
    if (!stage) stage = new SC.Stage($('sceneCanvas'));
    show('play');
    stage.setScene(run.scene); stage.setProgress(0);
    updateLamps(0);
    stage.resize();
    sfx(A.carSound(DISPATCH_STAGE[run.scene]));   // 出動する車の音（現場ごと）
    say('出動！');
    stage.setProblem(null); stage.draw(now());
    later(opts.fast ? 0 : 1500, function () { presentQuestion(); });
  }
  function updateLamps(n) {
    [].forEach.call($('lamps').children, function (e, i) { e.classList.toggle('on', i < n); });
  }
  function promptText(p) {
    if (p.kind === 'count') return 'いくつあるかな？';
    if (p.kind === 'add') return NUMK[p.a] + 'たす' + NUMK[p.b] + 'は、いくつ？';   // 数字で渡すと「1たす4」などの読みが揺れるので、数の読み（よん・なな）で渡す
    if (p.kind === 'sub') return NUMK[p.a] + 'ひく' + NUMK[p.b] + 'は、いくつ？';
    if (p.kind === 'clock') {
      if (p.form === 'read') return '時計を見てね。出動の時間は、何時かな？';
      if (p.form === 'elapsed') return '今は、' + P.readTime(p.h0, p.m0) + '。' + P.readMinutes(p.dm) + 'たったら、どの時計かな？';
      return '出動は、' + P.readTime(p.h, p.m) + '。どの時計かな？';
    }
    if (p.kind === 'english') return 'どれかな？';   // 英語の意味は日本語で言わない（言うと英語を聞かなくても答えられる）
    return yomiOf(wordOf(p.wordId)) + '。最初の文字は、どれかな？';
  }
  // 語の読み上げ（漢字・カタカナまじりで自然に読ませる。data.js の YOMI）
  function yomiOf(w) { var id = w.id.replace(/_k$/, ''); return D.YOMI[id] || w.kata || (w.script === 'kata' ? w.label : w.speech); }
  function carYomi(car) { return D.CAR_YOMI[car.id] || car.name; }
  function wordOf(id) { for (var i = 0; i < D.ALL_WORDS.length; i++) if (D.ALL_WORDS[i].id === id) return D.ALL_WORDS[i]; return null; }
  // 文字の例語（「ひこうきの ひ」）。同じ頭文字の語が複数ある文字は、文字そのものでない例語を優先する
  function exampleOf(ch) {
    var hit = null;
    for (var i = 0; i < D.ALL_WORDS.length; i++) {
      var w = D.ALL_WORDS[i];
      if (w.head !== ch) continue;
      if (w.example !== ch) return w.example;
      hit = hit || w.example;
    }
    return hit || D.EXTRA_KATA[ch] || ch;
  }

  // 正解のときの例語。その語自身の例語を使うが、例語が文字そのもの（ひ）なら、別の語の例語（ひこうき）にする
  function correctExample(q) { var w = wordOf(q.wordId); return w.example !== q.answer ? w.example : exampleOf(q.answer); }

  // 問題の読み上げ。えいごは「英語」→（短い間）→「日本語の補助」。英語の声が無ければ日本語だけ
  function sayPrompt(q) {
    if (q.kind === 'english') return seq([{ text: q.en, lang: 'en' }, { text: promptText(q), lang: 'ja', gap: 350 }]);
    return say(promptText(q));
  }
  // 英語のつづりを字幕で出す。英語の声が途中で使えなくなったら、1回目の誤答で正解を光らせる（plan 3.4）
  function syncCaption() {
    if (!run || run.game !== 'english' || !stage) return;
    var q = run.qs[run.idx], want = q ? q.en : '';   // つづりはいつも出す（発音と一緒に確かめられるように）
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
    var pickClock = q.kind === 'clock' && (q.form === 'pick' || q.form === 'elapsed'), pickPic = q.kind === 'english' && q.form === 'word';
    box.className = pickClock || (pickPic && q.choices.length > 3) ? 'clocks' : '';   // 4択の絵は 1 列だと小さいので時計と同じ 2×2
    q.choices.forEach(function (c) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = pickClock ? 'ans clk' : pickPic ? 'ans pic' : 'ans'; b.setAttribute('data-v', String(c));
      if (pickClock || pickPic) b.innerHTML = '<canvas></canvas>';
      else if (q.kind === 'clock') b.innerHTML = '<span class="num">' + c + '</span>';
      else if (q.kind === 'letter') b.innerHTML = '<span class="kana">' + c + '</span>';
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
      var cv = b.querySelector('canvas'), c = sizeCanvas(cv), w = englishOf(b.getAttribute('data-v'));
      c.ctx.clearRect(0, 0, c.w, c.h);
      if (w) V.drawPic(c.ctx, w.pic, c.w / 2, c.h / 2, Math.min(c.w, c.h) * 0.8, 0);
    });
  }
  // 小さい時計の答えボタンを描く。pulseKey の時計だけ短針をふくらませる（ヒント）
  function drawAnswerClocks(pulse, pulseKey) {
    if (!CF) return;
    var cq = run && run.qs && run.qs[run.idx], tk = cq && cq.ticks === 60 ? 60 : 12;
    var both = !!cq && cq.kind === 'clock' && /^T[4-6]$/.test(cq.level);   // T4 以降は短針がほぼ同じ組が出るので、長針も一緒にふくらませる
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
    var v = (q.kind === 'letter' || (q.kind === 'clock' && (q.form === 'pick' || q.form === 'elapsed')) || (q.kind === 'english' && q.form === 'word')) ? raw : +raw;
    if (v === q.answer) return onCorrect(q, btn);
    run.wrong++;
    run.off.push(v);
    btn.classList.add('off', 'shake'); btn.classList.remove('glow');
    sfx('oshii');
    var said = 'おしい！もう一回。';
    if (q.kind === 'letter') said = exampleOf(v) + 'の ' + D.toHira(v) + '。おしい！もう一回。';
    else if (q.kind === 'clock' && (q.form === 'pick' || q.form === 'elapsed') && v.indexOf('swap:') !== 0) { var tk = v.split(':'); said = P.readTime(+tk[0], +tk[1]) + '。おしい！もう一回。'; }
    if (q.kind === 'english') seq([{ text: q.form === 'word' ? englishOf(v).en : D.NUM_EN[v], lang: 'en' }, { text: 'おしい！もう一回。', lang: 'ja', gap: 250 }]);
    else say(said);
    var left = answerButtons().filter(function (b) { return !b.classList.contains('off'); });
    var voiceless = SP.isVoiceless() || !data.sound.voice, enOff_ = enOff();
    if (run.wrong >= 2 || left.length <= 1 || ((q.kind === 'letter' || (q.kind === 'clock' && /^T[3-6]$/.test(q.level))) && voiceless) || (q.kind === 'english' && enOff_)) {
      later(900, function () {
        if (!run || run.busy) return;
        answerButtons().forEach(function (b) { if (b.getAttribute('data-v') === String(q.answer)) b.classList.add('glow'); });
        if (q.kind === 'clock') {
          say(q.form === 'read' ? 'こっちかな？短い針を見てね。' : 'こっちかな？');
          if (q.form === 'read') stage.pulseHour(now()); else run.pulse = { key: q.answer, t0: now() };
        } else if (q.kind === 'english') {
          seq([{ text: q.en + '?', lang: 'en' }, { text: 'こっちかな？', lang: 'ja', gap: 250 }]);
          stage.bouncePic(now());
        } else say('こっちかな？');
        if (q.kind === 'count' || q.kind === 'add' || q.kind === 'sub') countAloud(q);
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
    var done = run.idx + 1, my0 = run.token;
    run.countWait = false;
    if (q.kind === 'letter') say('そう！' + D.toHira(q.answer) + '！ ' + correctExample(q) + 'の ' + D.toHira(q.answer) + '。');
    else if (q.kind === 'clock') say('そう！' + P.readTime(q.h, q.m) + '！');
    else if (q.kind === 'english') {
      var ok = [{ text: 'そう！', lang: 'ja' }, { text: q.en + '!', lang: 'en' }];
      if (q.form === 'number') ok.push({ text: D.NUM_EN.slice(1, q.n + 1).join(', '), lang: 'en', gap: 300 });   // 数のものを 1 つずつ数える（1 回の読み上げ）
      if (q.form === 'number') { run.countWait = true; if (!seq(ok, { onend: function () { if (run && run.token === my0) run.countWait = false; } })) run.countWait = false; }
      else seq(ok);
    }
    else say('そう！' + NUMK[q.answer] + '！');
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
        say(carYomi(car) + 'を、ゲット！');
      } else {
        $('reward-text').textContent = 'ごほうびすてっかー！';
        say('ごほうびステッカー！');
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
      // button だと iOS Safari が中身の高さを枠に数えず、絵と名前が枠の外にはみ出すので div にする
      var el = doc.createElement('div');
      el.setAttribute('role', 'button'); el.tabIndex = 0; el.className = 'slot' + (n ? '' : ' none');
      el.setAttribute('aria-label', n ? car.name : 'まだ いない くるま');
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
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
        slot.drive = now(); sfx(A.carSound(car.stage)); say(carYomi(car)); kick();
      });
    });
    $('g-count').textContent = have + ' / 11';
    drawGarage();
  }
  function drawGarage() {
    var t = now(), busy = false;
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
      '<div class="prow"><span>とけい：いまのレベル</span><b>' + data.levels.clock + '（1かいめで せいかい ' + pct('clock') + '）</b></div>' +
      '<div class="prow"><span>えいご：いまのレベル</span><b>' + data.levels.english + '（1かいめで せいかい ' + pct('english') + '）</b></div>' +
      '<div class="prow"><span>あつめた くるま</span><b>' + have + ' / 11（★ ' + stars + '）</b></div>';
    $('p-sfx').checked = data.sound.sfx; $('p-voice').checked = data.sound.voice;
    ['math', 'letter', 'clock', 'english'].forEach(function (g) {
      var sel = $('p-lv-' + g);
      if (!sel.options.length) P.LEVELS[g].forEach(function (lv) { var o = doc.createElement('option'); o.value = lv; o.textContent = lv; sel.appendChild(o); });
      sel.value = data.levels[g]; $('p-lock-' + g).checked = data.locked[g];
    });
    voiceNote(); enNote();
    $('p-storage-note').hidden = S.isPersistent();
    clearStep = 0; $('p-clear').textContent = 'データをけす'; $('p-clear-note').textContent = '';
  }
  function voiceNote() {
    var n = $('p-voice-note');
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
    else if (screen === 'reward' && reward) { drawReward(); keep = true; }
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
      if (screen === 'reward' && reward) drawReward();
      if (screen === 'garage') drawGarage();
    });
    root.addEventListener('orientationchange', function () { root.setTimeout(function () { root.dispatchEvent(new root.Event('resize')); }, 200); });

    $('btn-go').addEventListener('click', function () { sfx('tap'); show('pick'); });
    $('btn-garage').addEventListener('click', function () { sfx('tap'); show('garage'); });
    $('btn-sound').addEventListener('click', function () {
      var on = !(data.sound.sfx || data.sound.voice);
      data.sound.sfx = data.sound.voice = on; applySound(); save(); updateVoiceMark(); updatePick();
      if (on) sfx('tap');
    });
    holdButton($('btn-gear'), 2000, function () { show('parent'); });
    $('btn-pick-back').addEventListener('click', function () { sfx('tap'); show('title'); });
    $('btn-math').addEventListener('click', function () { startSession('math'); });
    $('btn-letter').addEventListener('click', function () { startSession('letter'); });
    $('btn-clock').addEventListener('click', function () { startSession('clock'); });
    $('btn-english').addEventListener('click', function () {
      if (enOff()) {   // 英語の声が無い: 出動しない。おしい音と、日本語の声が使えれば説明を読む
        updatePick(); sfx('oshii'); say('英語の声が、ないよ。'); return;
      }
      startSession('english');
    });
    holdButton($('btn-quit'), 2000, quitSession);
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
      if (n) { stage.bounce(i, now()); sfx('pon', n); say(NUMK[n]); kick(); }
    });
    $('btn-r-garage').addEventListener('click', function () { sfx('tap'); show('garage'); });
    $('btn-r-again').addEventListener('click', function () { sfx('tap'); show('pick'); });
    $('btn-g-back').addEventListener('click', function () { sfx('tap'); show('title'); });
    $('btn-p-back').addEventListener('click', function () { show('title'); });

    // 保護者画面
    $('p-sfx').addEventListener('change', function () { data.sound.sfx = this.checked; applySound(); save(); updateVoiceMark(); sfx('correct'); });
    $('p-voice').addEventListener('change', function () { data.sound.voice = this.checked; applySound(); save(); updateVoiceMark(); updatePick(); });
    $('p-test').addEventListener('click', function () {
      unlockOnce();
      if (!say('こんにちは。はたらくまなびです。', { force: true })) $('p-voice-note').textContent = 'よみあげが つかえません（このたんまつは こえなしモードです）。';
    });
    $('p-test-en').addEventListener('click', function () {
      unlockOnce();
      if (!SP.speakSeq([{ text: 'Fire truck', lang: 'en' }], { force: true })) enNote();
    });
    ['math', 'letter', 'clock', 'english'].forEach(function (g) {
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
