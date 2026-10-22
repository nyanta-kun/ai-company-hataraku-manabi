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
