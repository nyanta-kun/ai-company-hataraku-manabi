// 読み上げ（日本語は音声ファイルの声（voice.js）を先に、駄目なら Web Speech API）と声なしモード判定。日本語と英語は別々に声を選び、別々に失敗を数える。
// 英語・名前を呼ぶ文・音声ファイルが無い／間に合わない文は端末の声（Web Speech）。1 つの文の中で声を混ぜない。
// 日本語の読み上げ文は、ひらがなだけだと平坦になるので漢字・カタカナまじり（文字の音そのものはひらがな）。最初のタップで init() を呼ぶ（iOS Safari 対策）。
// create(env) で作る（env: speechSynthesis / SpeechSynthesisUtterance / setTimeout。足すもの: clips = 音声ファイルの再生器（voice.js の create の戻り値。無ければ今までと同じ）、voices = 同梱の声の一覧を返す関数）。Node のテストは偽の env を渡す。
(function (root) {
  'use strict';

  // macOS などに入っている、効果音のような声・機械的な古い声・Eloquence 系の声（ノベルティボイス）。英語の声として選ばない
  var NOVELTY = /(^|\s)(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Pipe Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)(\s|$)/i;
  var SEQ_START_MS = 3000;    // 連続読み上げで、発話が始まらない（開始失敗の判定と同じ 3 秒）ときに、次へ進むまでの保険
  var current = null;         // 再生中の発話（GC 回避用）
  var SEQ_MAX_MS = 15000;     // 始まったのに onend が来ないときの上限

  function isEn(v) { return /^en([-_]|$)/i.test(v.lang || ''); }
  // 英語の声を選ぶ。en-US かつ端末内 → en-* かつ端末内 → en-US の端末外 → en-*（端末外）。ノベルティボイスは除く
  function chooseEnglish(vs) {
    var en = vs.filter(function (v) { return isEn(v) && !NOVELTY.test(v.name || ''); });
    function us(v) { return /^en[-_]US$/i.test(v.lang || ''); }
    function local(v) { return v.localService === true; }
    var tiers = [
      en.filter(function (v) { return us(v) && local(v); }),
      en.filter(local),
      en.filter(us),
      en
    ];
    for (var i = 0; i < tiers.length; i++) if (tiers[i].length) return tiers[i][0];
    return null;
  }

  function create(env) {
    var synth = env.speechSynthesis || null;
    var Utter = env.SpeechSynthesisUtterance;
    var later = env.setTimeout;
    var clips = env.clips || null;   // 音声ファイルの再生器。無ければ Web Speech だけ
    var enabled = true;        // 保護者設定（読み上げオン/オフ）
    var inited = false;
    // 言語ごとの状態。ja = 日本語（従来どおり。失敗すると声なしモード）、en = 英語（失敗してもにほんごは止めない）
    var L = {
      ja: { voice: null, failed: false, reason: '', noStart: 0 },   // noStart = 読み上げ開始イベントが来なかった回数（最後に出した発話だけ数える）
      en: { voice: null, failed: false, reason: '', noStart: 0 }
    };
    var seq = 0;               // 発話の通し番号。cancel や次の発話で古いものは無効になる
    var epoch = 0, busy = 0;   // busy = 終わっていない発話の数（epoch が変わると数え直す）。前の発話の後ろに並んだ発話は開始失敗に数えない
    var listeners = [];
    var missers = [];          // 音声ファイルに無い文を知らせる先（確認用）
    var pref = '', eff = 'device';   // 保存された声の選択（''=おまかせ・'device'・id）と、実際に使う声（'device' か声の id）

    function notify() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
    function setFailed(lang, why) {
      var st = L[lang];
      if (st.failed) return;
      st.failed = true; st.reason = why; notify();
    }
    // 声を選ぶ。日本語は端末内の声（localService）を優先して、端末外への送信を避ける。戻り値は日本語の声が見つかったか
    function pickVoice() {
      if (!synth) return false;
      var enBefore = avail('en');
      var vs = (synth.getVoices && synth.getVoices()) || [];
      var ja = vs.filter(function (v) { return /^ja/i.test(v.lang) || /japan/i.test(v.lang); });
      var local = ja.filter(function (v) { return v.localService === true; });
      L.ja.voice = local.length ? local[0] : (ja.length ? ja[0] : null);
      L.en.voice = chooseEnglish(vs);
      var changed = false;
      if (ja.length && L.ja.failed && L.ja.reason === 'novoice') { L.ja.failed = false; L.ja.reason = ''; L.ja.noStart = 0; changed = true; }   // 後から声が来たら復帰
      if (L.en.voice && L.en.failed && L.en.reason === 'novoice') { L.en.failed = false; L.en.reason = ''; L.en.noStart = 0; changed = true; }
      if (avail('en') !== enBefore) changed = true;   // 声の一覧が後から埋まった（voiceschanged）・英語の声が消えた
      if (changed) notify();
      return ja.length > 0;
    }

    // 最初のユーザー操作の中で呼ぶ
    function init() {
      if (inited) return;
      inited = true;
      if (!synth || typeof Utter === 'undefined') { setFailed('ja', 'nosynth'); setFailed('en', 'nosynth'); return; }
      try {
        pickVoice();
        if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
        var u = new Utter(' ');   // ダミー（iOS で最初の操作内に speak しておく）
        u.volume = 0; u.lang = 'ja-JP';
        synth.speak(u);
      } catch (e) { setFailed('ja', 'error'); setFailed('en', 'error'); return; }
      later(function () {
        if (!pickVoice()) setFailed('ja', 'novoice');
        if (!L.en.voice) setFailed('en', 'novoice');
      }, 1500);
    }

    function avail(lang) { return !!synth && !L[lang].failed && (lang === 'ja' || !!L.en.voice); }
    function clipsReady() { return !!clips && clips.ready(); }
    // その言語で読めるか。日本語は「音声ファイルの声が使える」または「Web Speech が使える」（forceVoiceless は両方止める）
    function can(lang) { return lang === 'en' ? avail('en') : !(L.ja.failed && L.ja.reason === 'forced') && (clipsReady() || avail('ja')); }
    function available() { return can('ja'); }
    function isVoiceless() { return !available(); }
    function enAvailable() { return avail('en'); }
    // 出した発話を全部止める（seq は進めない）。連鎖の途中で止まった発話を捨てて次へ進むときに使う
    function flush() { epoch++; busy = 0; if (synth) { try { synth.cancel(); } catch (e) {} } if (clips) { try { clips.stop(); } catch (e) {} } }
    function cancel() { seq++; flush(); }
    function setEnabled(v) { enabled = !!v; if (!enabled) cancel(); }
    function onChange(f) { listeners.push(f); }
    if (clips && clips.onChange) clips.onChange(notify);   // 声の読み込みの成功・失敗を画面に知らせる

    // 声の選択（保存された値。''=おまかせ・'device'=端末の声・声の id）。一覧に無い id はおまかせとして扱う（保存は書き換えない）
    function listIds() { var v = (env.voices && env.voices()) || []; return v.map(function (x) { return x.id; }); }
    function setSpeaker(id) {
      pref = typeof id === 'string' ? id : '';
      var ids = listIds();
      eff = pref === 'device' ? 'device' : (pref && ids.indexOf(pref) >= 0) ? pref : (ids.length ? ids[0] : 'device');
      if (clips) { try { clips.select(eff === 'device' ? '' : eff); } catch (e) {} }
      notify();
    }
    function speaker() { return eff; }
    function prefetch(texts) { if (clips && eff !== 'device') { try { clips.prefetch(texts); } catch (e) {} } }
    function onMiss(f) { missers.push(f); }

    // 1 つの発話を出す（cancel しない・seq を進めない）。戻り値: 読み上げを試みたか
    function speakRaw(text, lang, onend, hooks) {
      var st = L[lang];
      if (!avail(lang) || !text) return false;
      try {
        var my = seq;
        var u = new Utter(text);
        current = u;   // 参照を持っておく（Chrome で GC されると onend が来ない不具合の回避）
        if (lang === 'en') { u.lang = (st.voice && st.voice.lang) || 'en-US'; u.rate = 0.8; u.pitch = 1.0; }
        else { u.lang = 'ja-JP'; u.rate = 0.9; u.pitch = 1.0; }   // 高い声・遅すぎる速度は抑揚が機械的になるので、ほぼ標準に
        if (st.voice) u.voice = st.voice;
        var started = false, behind = busy > 0, ep = epoch, fin = false;
        busy++;
        function done() { if (fin) return; fin = true; if (ep === epoch && busy > 0) busy--; }
        u.onstart = function () { started = true; st.noStart = 0; if (hooks && hooks.onstart) hooks.onstart(); };
        u.onend = function () { done(); if (onend) onend(); };
        u.onerror = function () { done(); if (hooks && hooks.onerror) hooks.onerror(); };
        later(function () {
          if (started || st.failed || my !== seq || behind || fin && ep !== epoch) return;   // 開始した／後続の発話で置き換わった／前の発話の後ろで待っていた
          st.noStart++;
          if (st.noStart >= 2) setFailed(lang, 'nostart');
        }, 3000);
        synth.speak(u);
        return true;
      } catch (e) { setFailed(lang, 'error'); return false; }
    }

    // text を読む。opts.lang='en' で英語、opts.force=true で保護者設定オフでも読む（テスト用）。戻り値: 読み上げを試みたか
    function speak(text, opts) {
      opts = opts || {};
      var lang = opts.lang === 'en' ? 'en' : 'ja';
      if ((!enabled && !opts.force) || !can(lang) || !text) return false;
      cancel();                      // 自分の cancel で打ち切られる前の発話は seq が変わるので数えない
      if (lang === 'en') return speakRaw(text, lang, opts.onend);
      return speakJa(text, opts.alt, opts.onend, null);
    }

    // 日本語の 1 文を読む（cancel しない）。順: 1) 音声ファイル 2) Web Speech 3) alt（名前を抜いた文）を音声ファイルで。1 つの文の中で声を混ぜない。
    // hooks（連続読み上げ用）: onstart(ms) / onerror（どれも鳴らせなかった）。戻り値: 読み上げを試みたか
    function speakJa(text, alt, onend, hooks) {
      var my = seq;
      function giveUp() { if (hooks && hooks.onerror) hooks.onerror(); }
      function viaClips(t, fallback) {
        var p = clipsReady() ? clips.plan(t) : null;
        if (!p) return false;
        clips.play(p, {
          onstart: function () { if (hooks && hooks.onstart) hooks.onstart(clips.total(p)); },
          onend: function () { if (my === seq && onend) onend(); },
          onerror: function () { if (my === seq) fallback(); }   // 間に合わない・復号できない → 次の手（端末の声）
        });
        return true;
      }
      function viaAlt() {
        if (alt && viaClips(alt, giveUp)) return true;
        return false;
      }
      function device() {
        if (avail('ja') && speakRaw(text, 'ja', onend, hooks)) return true;
        if (viaAlt()) return true;
        giveUp();
        return false;
      }
      if (viaClips(text, function () { if (!device()) { /* どれも無い: 黙る */ } })) return true;
      if (clipsReady() && !alt) missers.forEach(function (f) { try { f(text); } catch (e) {} });   // 作り漏れに気づくため
      return device();
    }

    // [{text, lang:'ja'|'en', gap:前の待ち(ms)}] を順に読む。cancel や次の発話で連鎖は止まる。
    // 使えない言語の項目は飛ばす（英語の声が無くても日本語は読む）。戻り値: 読む項目が 1 つでもあるか
    function speakSeq(items, opts) {
      opts = opts || {};
      if (!enabled && !opts.force) return false;
      var list = (items || []).filter(function (it) { return it && it.text; }).map(function (it) {
        return { text: it.text, lang: it.lang === 'en' ? 'en' : 'ja', gap: it.gap || 0, alt: it.alt || '' };
      });
      if (!list.some(function (it) { return can(it.lang); })) return false;
      cancel();
      var my = seq;
      function step(i) {
        if (my !== seq) return;
        while (i < list.length && !can(list[i].lang)) i++;
        if (i >= list.length) { if (opts.onend) opts.onend(); return; }
        var it = list[i];
        function go() {
          if (my !== seq) return;
          var moved = false;
          var started = false;
          function next() { if (moved || my !== seq) return; moved = true; step(i + 1); }
          function skip() { if (moved || my !== seq) return; flush(); next(); }   // 止まった発話を捨てて次へ（日本語がその後ろで待たされない）
          // 始まったら、文の長さから見積もった時間（音声ファイルなら音の長さ＋1 秒）で打ち切る（onend が来ない端末）
          var onstart = function (ms) { started = true; later(skip, ms ? ms + 1000 : 2000 + it.text.length * 200); };
          var tried = it.lang === 'en' ? speakRaw(it.text, it.lang, next, { onstart: onstart, onerror: next }) : speakJa(it.text, it.alt, next, { onstart: onstart, onerror: next });
          if (!tried) { next(); return; }
          if (it.lang === 'en') later(function () { if (!started) skip(); }, SEQ_START_MS);   // 英語が始まらない（日本語は起動の遅い端末で切らないよう対象外）
          later(skip, SEQ_MAX_MS);                                       // 最後の保険
        }
        if (it.gap) later(go, it.gap); else go();
      }
      step(0);
      return true;
    }

    function forceVoiceless() { setFailed('ja', 'forced'); }
    // 英語を使えなくする（確認用）。on===false で元に戻す
    function forceNoEnglish(on) {
      if (on === false) { if (L.en.failed) { L.en.failed = false; L.en.reason = ''; L.en.noStart = 0; notify(); } }
      else setFailed('en', 'forced');
    }

    return {
      init: init, speak: speak, speakSeq: speakSeq, cancel: cancel, available: available, isVoiceless: isVoiceless,
      enAvailable: enAvailable, setEnabled: setEnabled, onChange: onChange, forceVoiceless: forceVoiceless, forceNoEnglish: forceNoEnglish,
      reason: function () { return L.ja.reason; }, enReason: function () { return L.en.reason; }, pickVoice: pickVoice,
      setSpeaker: setSpeaker, speaker: speaker, prefetch: prefetch, onMiss: onMiss, clipsState: function () { return clips ? clips.state() : 'none'; }
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { create: create };
  else {
    root.Manabi = root.Manabi || {};
    var timer = function (f, ms) { return root.setTimeout(f, ms); };
    var A = root.Manabi.audio, V = root.Manabi.voice;
    // 音声ファイルの再生器。声のパック（voice/<id>/index.js）は Manabi.voicePack() で登録される。声の一覧（voice/voices.js）が空なら何も読まない
    var clips = V && V.create({
      context: function () { return A && A.context ? A.context() : null; },
      fetch: function (u) { return root.fetch(u); },
      loadScript: function (src, cb) {
        var el = root.document.createElement('script');
        el.src = src; el.onload = function () { cb(true); }; el.onerror = function () { cb(false); };
        root.document.head.appendChild(el);
      },
      setTimeout: timer,
      protocol: root.location && root.location.protocol
    });
    if (clips) root.Manabi.voicePack = clips.register;
    root.Manabi.speech = create({
      speechSynthesis: root.speechSynthesis, SpeechSynthesisUtterance: root.SpeechSynthesisUtterance,
      setTimeout: timer, clips: clips, voices: function () { return root.Manabi.voiceList || []; }
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
