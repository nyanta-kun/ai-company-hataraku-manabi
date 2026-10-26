// T4: speech.js が音声ファイルの声を先に、駄目なら端末の声で読む（偽の Web Speech・偽の再生器）
const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../src/speech.js');

function fake(voices) {
  const timers = [];
  const synth = { voices, pending: [], listeners: {}, getVoices() { return this.voices; }, addEventListener(n, f) { this.listeners[n] = f; }, speak(u) { this.pending.push(u); }, cancel() { this.pending = []; } };
  function Utter(t) { this.text = t; }
  const run = () => { const t = timers.splice(0); t.forEach(x => x.f()); };
  return { synth, Utter, timers, run };
}
// 偽の再生器: plan は文の辞書で決まる。play は記録するだけ（hooks を test が呼ぶ）
function fakeClips(dict, opts) {
  const c = { on: true, played: [], stopped: 0, selected: [], prefetched: [], state() { return 'ready'; }, listeners: [],
    ready() { return this.on; }, plan(t) { return dict[t] ? [{ key: t, f: t, ms: dict[t], gap: 0 }] : null; }, total(p) { return p.reduce((a, x) => a + x.ms + x.gap, 0); },
    play(p, hooks) { this.played.push({ key: p[0].key, hooks }); }, stop() { this.stopped++; }, select(id) { this.selected.push(id); }, prefetch(t) { this.prefetched.push(t); }, onChange(f) { this.listeners.push(f); } };
  return Object.assign(c, opts);
}
function make(o) {
  o = o || {};
  const f = fake(o.voices === undefined ? [{ lang: 'ja-JP', localService: true }] : o.voices);
  const clips = o.noClips ? null : fakeClips(o.dict || { '出動！': 800, 'しゅつどうの じゅんび！': 1500, 'おしい！もう一回。': 1000, 'そう！': 500 });
  const sp = create({ speechSynthesis: f.synth, SpeechSynthesisUtterance: f.Utter, setTimeout: (fn, ms) => { f.timers.push({ f: fn, ms }); }, clips, voices: () => o.list || [] });
  sp.init(); f.run();
  return { f, clips, sp };
}

test('T4: 音声ファイルがある文は音声ファイルで鳴る（端末の声は鳴らない）', () => {
  const { f, clips, sp } = make();
  assert.equal(sp.speak('出動！'), true);
  assert.equal(clips.played.length, 1);
  assert.equal(clips.played[0].key, '出動！');
  assert.equal(f.synth.pending.filter(u => u.text === '出動！').length, 0);
});

test('T4: 音声ファイルが無い文（plan が null）は端末の声', () => {
  const { f, clips, sp } = make();
  assert.equal(sp.speak('しらない文。'), true);
  assert.equal(clips.played.length, 0);
  assert.equal(f.synth.pending.pop().text, 'しらない文。');
});

test('T4: 間に合わない・復号できない（onerror）と、同じ文を端末の声で読む。cancel 後は読まない', () => {
  const { f, clips, sp } = make();
  sp.speak('出動！');
  clips.played[0].hooks.onerror('late');
  assert.equal(f.synth.pending.pop().text, '出動！');
  sp.speak('出動！');
  sp.cancel();
  clips.played[1].hooks.onerror('late');   // 取り消したあとに来た失敗は無視（別の文を読ませない）
  assert.equal(f.synth.pending.length, 0);
});

test('T4: onend は音声ファイルの終わりで返る', () => {
  const { clips, sp } = make();
  let ended = 0;
  sp.speak('出動！', { onend: () => ended++ });
  clips.played[0].hooks.onend();
  assert.equal(ended, 1);
});

test('T4: 端末の声が無くても音声ファイルがあれば声なしモードにならない', () => {
  const a = make({ voices: [] });   // 日本語の声なし → 1.5 秒で novoice
  assert.equal(a.sp.isVoiceless(), false);
  assert.equal(a.sp.speak('出動！'), true);
  assert.equal(a.clips.played.length, 1);
  assert.equal(a.sp.speak('しらない文。'), false);   // 表に無い文は黙る
  const b = make({ voices: [], noClips: true });   // 今までと同じ
  assert.equal(b.sp.isVoiceless(), true);
  assert.equal(b.sp.speak('出動！'), false);
  const c = make({ voices: [] }); c.clips.on = false;   // 音声ファイルが使えない（file:// など）
  assert.equal(c.sp.isVoiceless(), true);
});

test('T4: forceVoiceless は音声ファイルも止める', () => {
  const { sp } = make();
  sp.forceVoiceless();
  assert.equal(sp.isVoiceless(), true);
  assert.equal(sp.speak('出動！'), false);
});

test('T4: 名前の文は端末の声があればそのまま（音声ファイルに無い）。端末の声が無ければ名前を抜いた alt を音声ファイルで', () => {
  const a = make();
  a.sp.speak('たろうさん、しゅつどうの じゅんび！', { alt: 'しゅつどうの じゅんび！' });
  assert.equal(a.f.synth.pending.pop().text, 'たろうさん、しゅつどうの じゅんび！');
  assert.equal(a.clips.played.length, 0);
  const b = make({ voices: [] });
  b.sp.speak('たろうさん、しゅつどうの じゅんび！', { alt: 'しゅつどうの じゅんび！' });
  assert.equal(b.clips.played[0].key, 'しゅつどうの じゅんび！');
  assert.equal(b.f.synth.pending.length, 0);
});

test('T4: 作り漏れ（音声ファイルに無い文）は onMiss で知らせる。alt のある名前の文は知らせない', () => {
  const { sp } = make();
  const miss = [];
  sp.onMiss(t => miss.push(t));
  sp.speak('しらない文。');
  sp.speak('たろうさん', { alt: 'しゅつどうの じゅんび！' });
  assert.deepEqual(miss, ['しらない文。']);
});

test('T4: speakSeq は英語を端末の声・日本語を音声ファイルで、gap を守る', () => {
  const { f, clips, sp } = make({ voices: [{ lang: 'ja-JP', localService: true }, { lang: 'en-US', localService: true, name: 'Samantha' }] });
  sp.speakSeq([{ text: 'Fire truck', lang: 'en' }, { text: 'おしい！もう一回。', lang: 'ja', gap: 250 }]);
  const u = f.synth.pending.pop();
  assert.equal(u.text, 'Fire truck');
  assert.equal(clips.played.length, 0);   // 英語の間は音声ファイルを鳴らさない
  u.onstart(); u.onend();                 // 英語が終わる → 250ms 待つ → 日本語を音声ファイルで
  assert.equal(clips.played.length, 0);
  f.timers.filter(t => t.ms === 250).forEach(t => t.f());
  assert.equal(clips.played.length, 1);
  assert.equal(clips.played[0].key, 'おしい！もう一回。');
  // 日本語が先のとき（正解の「そう！」→ 英語）
  const g = make({ voices: [{ lang: 'ja-JP', localService: true }, { lang: 'en-US', localService: true, name: 'Samantha' }] });
  g.sp.speakSeq([{ text: 'そう！', lang: 'ja' }, { text: 'fire truck!', lang: 'en' }]);
  assert.equal(g.clips.played.length, 1);
  g.clips.played[0].hooks.onstart(500); g.clips.played[0].hooks.onend();
  assert.equal(g.f.synth.pending.pop().text, 'fire truck!');
});

test('T4: speakSeq で音声ファイルが失敗した項目は端末の声で読み、続きも進む', () => {
  const { f, clips, sp } = make();
  let ended = 0;
  sp.speakSeq([{ text: 'そう！', lang: 'ja' }, { text: '出動！', lang: 'ja' }], { onend: () => ended++ });
  clips.played[0].hooks.onerror('late');
  const u = f.synth.pending.pop();
  assert.equal(u.text, 'そう！');
  u.onstart(); u.onend();                       // 端末の声が終わると、次の項目へ（次は音声ファイル）
  assert.equal(clips.played.length, 2);
  assert.equal(clips.played[1].key, '出動！');
  clips.played[1].hooks.onstart(800); clips.played[1].hooks.onend();
  assert.equal(ended, 1);
});

test('T4: speakSeq の打ち切りは音の長さ＋1 秒（音声ファイルで始まったとき）', () => {
  const { f, clips, sp } = make();
  sp.speakSeq([{ text: '出動！', lang: 'ja' }]);
  f.timers.length = 0;
  clips.played[0].hooks.onstart(800);
  assert.ok(f.timers.some(t => t.ms === 1800));
});

test('T4: cancel で再生器の stop が呼ばれ、続きが鳴らない。読み上げオフで鳴らない（force なら鳴る）', () => {
  const { f, clips, sp } = make();
  sp.speakSeq([{ text: 'そう！', lang: 'ja' }, { text: '出動！', lang: 'ja', gap: 100 }]);
  const n = clips.stopped;
  sp.cancel();
  assert.ok(clips.stopped > n);
  clips.played[0].hooks.onstart(); clips.played[0].hooks.onend();
  f.run();
  assert.equal(clips.played.length, 1);
  sp.setEnabled(false);
  assert.equal(sp.speak('出動！'), false);
  assert.equal(sp.speak('出動！', { force: true }), true);
  assert.equal(clips.played.length, 2);
});

test('T4: setSpeaker: おまかせは一覧の先頭、device は端末の声、一覧に無い id はおまかせ、一覧が空なら端末の声', () => {
  const list = [{ id: 'metan' }, { id: 'zundamon' }];
  const a = make({ list });
  a.sp.setSpeaker(''); assert.equal(a.sp.speaker(), 'metan'); assert.equal(a.clips.selected.pop(), 'metan');
  a.sp.setSpeaker('zundamon'); assert.equal(a.sp.speaker(), 'zundamon'); assert.equal(a.clips.selected.pop(), 'zundamon');
  a.sp.setSpeaker('device'); assert.equal(a.sp.speaker(), 'device'); assert.equal(a.clips.selected.pop(), '');
  a.sp.setSpeaker('gone'); assert.equal(a.sp.speaker(), 'metan');
  a.sp.setSpeaker(5); assert.equal(a.sp.speaker(), 'metan');
  const b = make({ list: [] });
  b.sp.setSpeaker(''); assert.equal(b.sp.speaker(), 'device'); assert.equal(b.clips.selected.pop(), '');
  const c = make({ noClips: true });
  c.sp.setSpeaker('metan'); assert.equal(c.sp.speaker(), 'device');   // 再生器が無ければ今までと同じ
  assert.equal(c.sp.speak('出動！'), true);
});

test('T4: prefetch は端末の声のとき何もしない。声を選んでいれば再生器へ', () => {
  const a = make({ list: [{ id: 'metan' }] });
  a.sp.setSpeaker('device'); a.sp.prefetch(['出動！']); assert.equal(a.clips.prefetched.length, 0);
  a.sp.setSpeaker(''); a.sp.prefetch(['出動！']); assert.deepEqual(a.clips.prefetched, [['出動！']]);
});

test('T4: 再生器の変化（読み込み・失敗）は onChange で画面に知らせる', () => {
  const { clips, sp } = make();
  let n = 0; sp.onChange(() => n++);
  clips.listeners.forEach(f => f());
  assert.equal(n, 1);
});
