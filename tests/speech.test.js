const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../src/speech.js');

// 偽の speechSynthesis。cancel() は保留中の発話を打ち切る（onstart は来ない）
function fake(voices) {
  const timers = [];
  const synth = {
    voices, listeners: {}, pending: [],
    getVoices() { return this.voices; },
    addEventListener(n, f) { this.listeners[n] = f; },
    speak(u) { this.pending.push(u); },
    cancel() { this.pending = []; }
  };
  function Utter(t) { this.text = t; }
  const env = { speechSynthesis: synth, SpeechSynthesisUtterance: Utter, setTimeout: (f, ms) => { timers.push({ f, ms }); } };
  const run = () => { const t = timers.splice(0); t.forEach(x => x.f()); };
  return { synth, env, run, timers };
}
const JA = { lang: 'ja-JP', localService: true };

test('連打して自分の cancel で打ち切っても声なしモードにならない', () => {
  const { env, run } = fake([JA]);
  const sp = create(env);
  sp.init(); run();
  for (let i = 0; i < 10; i++) sp.speak('おしい');   // 毎回前の発話を cancel する
  run();                                             // 3 秒タイマーが一斉に発火（最後の 1 つは未開始）
  assert.equal(sp.isVoiceless(), false);
});

test('最後の発話が 2 回続けて開始しなければ声なしモードになる', () => {
  const { env, run } = fake([JA]);
  const sp = create(env);
  sp.init(); run();
  sp.speak('a'); run();
  assert.equal(sp.isVoiceless(), false);
  sp.speak('b'); run();
  assert.equal(sp.isVoiceless(), true);
});

test('日本語の声が後から来たら novoice から復帰する', () => {
  const { synth, env, run } = fake([]);
  const sp = create(env);
  sp.init(); run();
  assert.equal(sp.reason(), 'novoice');
  assert.equal(sp.isVoiceless(), true);
  synth.voices = [JA];
  synth.listeners.voiceschanged();
  assert.equal(sp.isVoiceless(), false);
});

test('端末内の日本語の声を優先する', () => {
  const remote = { lang: 'ja-JP', localService: false, name: 'r' }, local = { lang: 'ja-JP', localService: true, name: 'l' };
  const { env, synth } = fake([remote, local]);
  const sp = create(env);
  sp.init();
  sp.speak('こんにちは');
  assert.equal(synth.pending[0].voice.name, 'l');
});

// ---- 英語 ----
const EN = { lang: 'en-US', localService: true, name: 'Samantha' };

test('英語の声が無くても日本語は使える（enAvailable だけ false）', () => {
  const { env, run } = fake([JA]);
  const sp = create(env);
  sp.init(); run();
  assert.equal(sp.isVoiceless(), false);
  assert.equal(sp.enAvailable(), false);
  assert.equal(sp.enReason(), 'novoice');
  assert.equal(sp.speak('Bus', { lang: 'en' }), false);
  assert.equal(sp.speak('こんにちは'), true);
});

test('日本語の声が無く英語の声だけでも、英語は使える', () => {
  const { env, run } = fake([EN]);
  const sp = create(env);
  sp.init(); run();
  assert.equal(sp.isVoiceless(), true);
  assert.equal(sp.enAvailable(), true);
});

test('英語の声の選択: en-US かつ端末内 → en-* かつ端末内 → 端末外。ノベルティボイスは選ばない', () => {
  const pick = voices => { const { env, synth } = fake(voices); const sp = create(env); sp.init(); sp.speak('Bus', { lang: 'en' }); return synth.pending[0] && synth.pending[0].voice; };
  const gbLocal = { lang: 'en-GB', localService: true, name: 'Daniel' }, usRemote = { lang: 'en-US', localService: false, name: 'Google US English' };
  const novelty = { lang: 'en-US', localService: true, name: 'Zarvox' }, bells = { lang: 'en-US', localService: true, name: 'Bells' };
  assert.equal(pick([usRemote, gbLocal, EN]).name, 'Samantha');
  assert.equal(pick([usRemote, gbLocal]).name, 'Daniel');
  assert.equal(pick([usRemote, { lang: 'en-AU', localService: false, name: 'x' }]).name, 'Google US English');
  assert.equal(pick([novelty, bells, gbLocal]).name, 'Daniel');
  assert.equal(pick([novelty, bells]), undefined);             // 通常の声が無ければ英語は読まない
  assert.equal(pick([{ lang: 'en_US', localService: true, name: 'Android' }]).name, 'Android');   // en_US 表記
  assert.equal(pick([{ lang: 'ja-JP', localService: true, name: 'Kyoko' }]), undefined);
});

test('英語の発話は en-US・遅めの速度で、日本語は ja-JP のまま', () => {
  const { env, synth, run } = fake([JA, EN]);
  const sp = create(env);
  sp.init(); run();
  sp.speak('Fire truck', { lang: 'en' });
  assert.equal(synth.pending[0].lang, 'en-US');
  assert.ok(synth.pending[0].rate < 0.9);
  sp.speak('おしい');
  assert.equal(synth.pending[0].lang, 'ja-JP');
  assert.equal(synth.pending[0].rate, 0.9);
});

test('英語だけ開始しない端末でも日本語は声なしにならない（失敗は言語ごとに数える）', () => {
  const { env, run } = fake([JA, EN]);
  const sp = create(env);
  sp.init(); run();
  sp.speak('a', { lang: 'en' }); run();
  sp.speak('b', { lang: 'en' }); run();
  assert.equal(sp.enAvailable(), false);
  assert.equal(sp.enReason(), 'nostart');
  assert.equal(sp.isVoiceless(), false);
  assert.equal(sp.speak('こんにちは'), true);
});

test('日本語の開始失敗は英語に影響しない', () => {
  const { env, run } = fake([JA, EN]);
  const sp = create(env);
  sp.init(); run();
  sp.speak('a'); run(); sp.speak('b'); run();
  assert.equal(sp.isVoiceless(), true);
  assert.equal(sp.enAvailable(), true);
});

test('英語の声が後から来たら復帰し、onChange で通知される。forceNoEnglish は日本語に影響しない', () => {
  const { synth, env, run } = fake([JA]);
  const sp = create(env);
  let n = 0; sp.onChange(() => n++);
  sp.init(); run();
  assert.equal(sp.enAvailable(), false);
  const before = n;
  synth.voices = [JA, EN];
  synth.listeners.voiceschanged();
  assert.equal(sp.enAvailable(), true);
  assert.ok(n > before);
  sp.forceNoEnglish();
  assert.equal(sp.enAvailable(), false);
  assert.equal(sp.isVoiceless(), false);
});

test('speakSeq: 英語→日本語の順に、onend でつないで読む', () => {
  const { env, synth, run } = fake([JA, EN]);
  const sp = create(env);
  sp.init(); run();
  let done = false;
  assert.equal(sp.speakSeq([{ text: 'Fire truck', lang: 'en' }, { text: 'しょうぼうしゃは どれ？', lang: 'ja' }], { onend: () => { done = true; } }), true);
  assert.deepEqual(synth.pending.map(u => u.text), ['Fire truck']);
  assert.equal(synth.pending[0].lang, 'en-US');
  const first = synth.pending[0]; synth.pending = [];
  first.onstart(); first.onend();
  assert.deepEqual(synth.pending.map(u => [u.text, u.lang]), [['しょうぼうしゃは どれ？', 'ja-JP']]);
  assert.equal(done, false);
  const second = synth.pending[0]; synth.pending = [];
  second.onstart(); second.onend();
  assert.equal(done, true);
  assert.equal(sp.isVoiceless(), false); assert.equal(sp.enAvailable(), true);
});

test('speakSeq: 途中で cancel や次の発話が来たら、古い連鎖は止まる', () => {
  const { env, synth, run } = fake([JA, EN]);
  const sp = create(env);
  sp.init(); run();
  sp.speakSeq([{ text: 'Bus', lang: 'en' }, { text: 'ばすは どれ？', lang: 'ja' }]);
  const first = synth.pending[0];
  sp.cancel();
  first.onend();                                   // 実機では cancel で onend/onerror が来る
  assert.deepEqual(synth.pending, []);
  sp.speakSeq([{ text: 'Bus', lang: 'en' }, { text: 'ばすは どれ？', lang: 'ja' }]);
  const old = synth.pending[0];
  sp.speakSeq([{ text: 'Train', lang: 'en' }, { text: 'でんしゃは どれ？', lang: 'ja' }]);   // 置き換え
  synth.pending = [];
  old.onend();
  assert.deepEqual(synth.pending, []);
});

test('speakSeq: 英語の声が無ければ日本語だけ読み、日本語の声が無ければ英語だけ読む。どちらも無ければ false', () => {
  let t = fake([JA]);
  let sp = create(t.env); sp.init(); t.run();
  assert.equal(sp.speakSeq([{ text: 'Bus', lang: 'en' }, { text: 'ばすは どれ？', lang: 'ja' }]), true);
  assert.deepEqual(t.synth.pending.map(u => u.text), ['ばすは どれ？']);
  t = fake([EN]);
  sp = create(t.env); sp.init(); t.run();
  assert.equal(sp.speakSeq([{ text: 'Bus', lang: 'en' }, { text: 'ばすは どれ？', lang: 'ja' }]), true);
  t.synth.pending[0].onend();
  assert.deepEqual(t.synth.pending.map(u => u.text), ['Bus']);
  t = fake([]);
  sp = create(t.env); sp.init(); t.run();
  assert.equal(sp.speakSeq([{ text: 'Bus', lang: 'en' }, { text: 'ばす', lang: 'ja' }]), false);
});

test('speakSeq: onend が来なくても保険のタイマーで次へ進む。読み上げオフなら読まない', () => {
  const { env, synth, run } = fake([JA, EN]);
  const sp = create(env);
  sp.init(); run();
  sp.speakSeq([{ text: 'Bus', lang: 'en' }, { text: 'ばすは どれ？', lang: 'ja' }]);
  synth.pending[0].onstart();
  run();                                           // 保険のタイマー（onend なし）
  assert.deepEqual(synth.pending.map(u => u.text), ['ばすは どれ？']);   // 止まった発話は捨てて次へ
  sp.setEnabled(false);
  assert.equal(sp.speakSeq([{ text: 'Bus', lang: 'en' }]), false);
});

test('speakSeq: gap の待ちの間に cancel されたら読まない', () => {
  const { env, synth, run } = fake([JA, EN]);
  const sp = create(env);
  sp.init(); run();
  sp.speakSeq([{ text: 'ばす', lang: 'ja', gap: 400 }]);
  assert.deepEqual(synth.pending, []);
  sp.cancel(); run();
  assert.deepEqual(synth.pending, []);
});

test('声の一覧が init の後（1.5秒より前）に埋まっても、英語が使えるようになり onChange で通知される', () => {
  const { synth, env } = fake([]);
  const sp = create(env);
  let n = 0; sp.onChange(() => n++);
  sp.init();                                       // タイマー（1.5秒）はまだ。この時点では声が無いが失敗とはしていない
  assert.equal(sp.enAvailable(), false);
  synth.voices = [JA, EN];
  synth.listeners.voiceschanged();
  assert.equal(sp.enAvailable(), true);
  assert.equal(sp.isVoiceless(), false);
  assert.ok(n >= 1);
  synth.voices = [JA];                             // 英語の声が消えたら、それも通知する
  const before = n;
  synth.listeners.voiceschanged();
  assert.equal(sp.enAvailable(), false);
  assert.ok(n > before);
});

test('英語の発話が固まっても（開始・終了・エラーが来ない）日本語は声なしにならない', () => {
  const { env, synth, run } = fake([JA, EN]);
  const sp = create(env);
  sp.init(); run();
  for (let k = 0; k < 2; k++) {
    sp.speakSeq([{ text: 'Bus', lang: 'en' }, { text: 'ばすは どれ？', lang: 'ja' }]);
    run();                                          // 3 秒の判定と保険のタイマー。英語は一度も始まらない
    assert.deepEqual(synth.pending.map(u => u.text), ['ばすは どれ？']);   // 固まった英語を捨てて日本語が出る
    synth.pending[0].onstart();                     // 日本語は普通に始まる
    synth.pending[0].onend();
  }
  assert.equal(sp.isVoiceless(), false);
  assert.equal(sp.reason(), '');
  assert.equal(sp.enAvailable(), false);            // 英語だけ失敗扱い
  assert.equal(sp.enReason(), 'nostart');
});

test('英語がすぐ onerror になっても日本語は問題なく読まれる', () => {
  const { env, synth, run } = fake([JA, EN]);
  const sp = create(env);
  sp.init(); run();
  for (let k = 0; k < 3; k++) {
    sp.speakSeq([{ text: 'Bus', lang: 'en' }, { text: 'ばすは どれ？', lang: 'ja' }]);
    synth.pending[0].onerror();
    const ja = synth.pending[synth.pending.length - 1];   // エラーの後すぐ日本語（英語が失敗扱いになった後は日本語だけ）
    assert.equal(ja.text, 'ばすは どれ？');
    synth.pending = [];
    ja.onstart(); ja.onend(); run();
  }
  assert.equal(sp.isVoiceless(), false);
  assert.equal(sp.reason(), '');
});

test('ノベルティ・機械的な声・Eloquence 系の声は英語の声に選ばない', () => {
  const names = ['Fred', 'Junior', 'Ralph', 'Kathy', 'Eddy (English (US))', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley', 'Bad News', 'Zarvox'];
  const { env, synth } = fake([JA, ...names.map(name => ({ lang: 'en-US', localService: true, name })), { lang: 'en-GB', localService: false, name: 'Daniel' }]);
  const sp = create(env);
  sp.init();
  sp.speak('Bus', { lang: 'en' });
  assert.equal(synth.pending[0].voice.name, 'Daniel');   // 端末外でも通常の声を選ぶ
});

test('forceNoEnglish(false) で英語の確認用の無効化を戻せる', () => {
  const { env, run } = fake([JA, EN]);
  const sp = create(env);
  sp.init(); run();
  sp.forceNoEnglish(); assert.equal(sp.enAvailable(), false);
  sp.forceNoEnglish(false); assert.equal(sp.enAvailable(), true);
});
