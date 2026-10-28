// 声の再生器（src/voice.js の create）。偽の AudioContext・fetch・script 読み込み。無音を測る関数。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../src/voice.js');

const PACK = { id: 'metan', label: 'めたん', credit: 'VOICEVOX:四国めたん', ext: 'aac', clips: { '出動！': ['aaa', 800], 'おしい！もう一回。': ['bbb', 1000], 'くじ': ['ccc', 300], 'ごふん。': ['ddd', 500] } };
const flush = () => new Promise(r => setImmediate(r));

function sound(rate, lead, body, tail) {   // 頭・おしりに無音がある波形
  const a = new Float32Array(lead + body + tail);
  for (let i = 0; i < body; i++) a[lead + i] = 0.3 * Math.sin(i / 5);
  return a;
}
function setup(o) {
  o = o || {};
  const timers = [], loads = [], fetched = [], starts = [], held = [], ctx = {
    decodes: 0,
    state: 'running', currentTime: 10, destination: {}, sources: [],
    createGain() { return { gain: { value: 1 }, connect() {} }; },
    createBufferSource() { const s = { connect() {}, start: (t, off, dur) => { s.args = [t, off, dur]; starts.push(s); }, stop() { s.stopped = true; } }; ctx.sources.push(s); return s; },
    decodeAudioData(ab, ok, ng) { this.decodes++; if (o.badDecode) return ng(new Error('bad')); ok({ sampleRate: 24000, getChannelData: () => sound(24000, 2400, 12000, 2400) }); }
  };
  const env = {
    context: () => (o.noCtx ? null : ctx), protocol: o.protocol || 'https:', setTimeout: (f, ms) => { timers.push({ f, ms }); },
    fetch: (u) => { fetched.push(u); return o.hang ? new Promise(r => held.push(() => r({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }))) : (o.fail ? Promise.reject(new Error('net')) : Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })); },
    loadScript: (src, cb) => { loads.push(src); setImmediate(() => { if (!o.noPack) (o.packs || [PACK]).forEach(pk => { if (src === 'voice/' + pk.id + '/index.js') vp.register(pk); }); cb(!o.noPack); }); },
    warm: () => []
  };
  const vp = V.create(env);
  return { vp, ctx, timers, loads, fetched, starts, o, held };
}

test('silenceRange: 頭とおしりの無音を測る（全部無音なら全体）', () => {
  const r = V.silenceRange(sound(24000, 2400, 12000, 2400), 24000);
  assert.ok(Math.abs(r.start - 0.1) < 0.001 && Math.abs(r.end - 0.6) < 0.001, JSON.stringify(r));
  assert.deepEqual(V.silenceRange(new Float32Array(2400), 24000), { start: 0, end: 0.1 });
  assert.deepEqual(V.silenceRange(new Float32Array(0), 24000), { start: 0, end: 0 });
});

test('選ぶ: 声のパックを読み、ready になる。声を選ばなければ何も読まない', async () => {
  const t = setup();
  assert.equal(t.vp.ready(), false);
  t.vp.select('');
  assert.equal(t.loads.length, 0); assert.equal(t.vp.state(), 'none');
  t.vp.select('metan');
  assert.equal(t.vp.state(), 'loading'); assert.deepEqual(t.loads, ['voice/metan/index.js']);
  await flush();
  assert.equal(t.vp.state(), 'ready'); assert.equal(t.vp.ready(), true);
  assert.deepEqual(t.vp.plan('おしい！もう一回。').map(p => p.f), ['bbb']);
  assert.equal(t.vp.plan('しらない。'), null);
});

test('file:// では読まず、ready にならない（端末の声）', async () => {
  const t = setup({ protocol: 'file:' });
  t.vp.select('metan'); await flush();
  assert.equal(t.loads.length, 0); assert.equal(t.vp.state(), 'file'); assert.equal(t.vp.ready(), false);
});

test('AudioContext が無い・止まっている間は ready にならない', async () => {
  const a = setup({ noCtx: true }); a.vp.select('metan'); await flush(); assert.equal(a.vp.ready(), false);
  const b = setup(); b.vp.select('metan'); await flush(); b.ctx.state = 'suspended'; assert.equal(b.vp.ready(), false);
});

test('パックが読めない（登録されない）と failed', async () => {
  const t = setup({ noPack: true });
  let n = 0; t.vp.onChange(() => n++);
  t.vp.select('metan'); await flush();
  assert.equal(t.vp.state(), 'failed'); assert.equal(t.vp.ready(), false); assert.ok(n >= 1);
});

test('鳴らす: 部品を前の終わり＋gap に予約してつなぎ、無音を切る。同じ AudioContext を使う', async () => {
  const t = setup(); t.vp.select('metan'); await flush();
  const plan = V.resolve('くじごふん。', { 'くじ': ['ccc', 300], 'ごふん。': ['ddd', 500] });
  const log = [];
  t.vp.play(plan, { onstart: () => log.push('start'), onend: () => log.push('end'), onerror: w => log.push('err ' + w) });
  await flush(); await flush();
  assert.deepEqual(log, ['start']);
  assert.equal(t.starts.length, 2);
  const [a, b] = t.starts.map(s => s.args);
  assert.ok(Math.abs(a[1] - 0.1) < 0.001 && Math.abs(a[2] - 0.5) < 0.001);          // 頭の無音 0.1 秒を飛ばし、音の長さ 0.5 秒
  assert.ok(Math.abs(b[0] - (a[0] + a[2] + V.GAP_PART / 1000)) < 0.001);              // 前の終わり＋gap（同じ文の中の部品の間）
  t.starts[1].onended();
  assert.deepEqual(log, ['start', 'end']);
  t.starts[1].onended();
  assert.deepEqual(log, ['start', 'end']);   // 1 回だけ
});

test('鳴らす: 0.8 秒で来なければ onerror(late)。あとで届いても鳴らさない', async () => {
  const t = setup({ hang: true }); t.vp.select('metan'); await flush();
  const log = [];
  t.vp.play(t.vp.plan('出動！'), { onstart: () => log.push('start'), onerror: w => log.push(w) });
  const late = t.timers.find(x => x.ms === V.CLIP_WAIT_MS);
  assert.ok(late);
  late.f();
  assert.deepEqual(log, ['late']);
  assert.equal(t.starts.length, 0);
  t.held.forEach(r => r());   // 本当にあとから届く
  await flush(); await flush(); await flush();
  assert.equal(t.starts.length, 0, 'あとで届いても鳴らさない');
  assert.deepEqual(log, ['late']);
  assert.equal(t.vp.state(), 'ready', 'late は失敗に数えない');
});

test('stop: 鳴っている音を止め、取り消したあとの late・end は来ない', async () => {
  const t = setup(); t.vp.select('metan'); await flush();
  const log = [];
  t.vp.play(t.vp.plan('出動！'), { onend: () => log.push('end'), onerror: w => log.push(w) });
  await flush(); await flush();
  t.vp.stop();
  assert.ok(t.ctx.sources.every(s => s.stopped));
  t.starts[0].onended && t.starts[0].onended();
  t.timers.forEach(x => x.f());
  assert.deepEqual(log, []);
});

test('失敗が 3 回続いたらその起動の間は端末の声だけ。成功すると数え直す', async () => {
  const t = setup({ fail: true }); t.vp.select('metan'); await flush();
  const errs = [];
  for (let i = 0; i < V.FAIL_MAX; i++) {
    assert.equal(t.vp.ready(), true, 'まだ使える ' + i);
    t.vp.play(t.vp.plan('出動！'), { onerror: w => errs.push(w) });
    await flush(); await flush();
  }
  assert.equal(errs.length, V.FAIL_MAX);
  assert.equal(t.vp.state(), 'failed'); assert.equal(t.vp.ready(), false);
  const u = setup({ badDecode: true }); u.vp.select('metan'); await flush();
  for (let i = 0; i < V.FAIL_MAX; i++) { u.vp.play(u.vp.plan('出動！'), {}); await flush(); await flush(); }
  assert.equal(u.vp.state(), 'failed');
  // 成功すると数え直す: 2 回失敗 → 成功 → 2 回失敗でも まだ使える
  const w = setup({ fail: true }); w.vp.select('metan'); await flush();
  const go = async () => { w.vp.play(w.vp.plan('出動！'), {}); await flush(); await flush(); await flush(); };
  await go(); await go(); assert.equal(w.vp.state(), 'ready');
  w.o.fail = false; await go(); assert.equal(w.starts.length, 1);
  w.o.fail = true; await go(); await go();   // 出動！は復号済みで成功する。別の文で失敗させる
  const bad = () => { w.vp.play(w.vp.plan('おしい！もう一回。'), {}); return flush().then(flush).then(flush); };
  await bad(); await bad(); assert.equal(w.vp.state(), 'ready', '成功のあと数え直したので 2 回では failed にならない');
  await bad(); assert.equal(w.vp.state(), 'failed');
});

test('失敗は 1 回の読み込み（1 文・1 回の prefetch）ごとに数える。部品がいくつあっても 1 回', async () => {
  const t = setup({ fail: true }); t.vp.select('metan'); await flush();
  const two = V.resolve('くじごふん。', { 'くじ': ['ccc', 300], 'ごふん。': ['ddd', 500] });
  for (let i = 0; i < 2; i++) { t.vp.play(two, {}); await flush(); await flush(); await flush(); }
  assert.equal(t.vp.state(), 'ready', '2 部品 × 2 回でも 2 回と数える');
  t.vp.prefetch(['出動！', 'おしい！もう一回。', 'くじ']); await flush(); await flush(); await flush();
  assert.equal(t.vp.state(), 'failed', '3 つ目（prefetch 1 回で 3 ファイルが失敗）');
});

test('読み終えたとき AudioContext が止まっていても失敗に数えない', async () => {
  const t = setup(); t.vp.select('metan'); await flush();
  for (let i = 0; i < V.FAIL_MAX + 1; i++) {
    const log = [];
    t.ctx.state = 'running';
    t.vp.play(t.vp.plan('出動！'), { onerror: w => log.push(w) });
    t.ctx.state = 'suspended';
    await flush(); await flush(); await flush();
    assert.deepEqual(log, ['noctx']);
  }
  t.ctx.state = 'running';
  assert.equal(t.vp.state(), 'ready'); assert.equal(t.vp.ready(), true);
});

test('声を切り替えても前の声の音が鳴らない（同じファイル名でも別の声は別に読む）', async () => {
  const P2 = { id: 'zunda', label: 'ずんだ', credit: 'VOICEVOX:ずんだもん', ext: 'aac', clips: { '出動！': ['aaa', 700] } };
  const t = setup({ packs: [PACK, P2] }); t.vp.select('metan'); await flush();
  t.vp.prefetch(['出動！']); await flush(); await flush(); await flush();
  assert.deepEqual(t.fetched, ['voice/metan/aaa.aac']);
  t.vp.select('zunda'); await flush();
  t.vp.play(t.vp.plan('出動！'), {}); await flush(); await flush(); await flush();
  assert.deepEqual(t.fetched, ['voice/metan/aaa.aac', 'voice/zunda/aaa.aac']);
  assert.equal(t.starts.length, 1);
});

test('DECODED_MAX: 復号済みは新しい順に DECODED_MAX 個まで。古いものは復号し直す', async () => {
  const clips = {}, texts = [];
  for (let i = 0; i < V.DECODED_MAX + 5; i++) { const k = '文' + i + '。'; clips[k] = ['f' + i, 500]; texts.push(k); }
  const t = setup({ packs: [Object.assign({}, PACK, { clips })] }); t.vp.select('metan'); await flush();
  t.vp.prefetch(texts); for (let i = 0; i < 6; i++) await flush();
  assert.equal(t.ctx.decodes, V.DECODED_MAX + 5);
  t.vp.prefetch([texts[V.DECODED_MAX + 4]]); await flush();
  assert.equal(t.ctx.decodes, V.DECODED_MAX + 5, '新しい方は持っている');
  t.vp.prefetch([texts[0]]); for (let i = 0; i < 4; i++) await flush();
  assert.equal(t.ctx.decodes, V.DECODED_MAX + 6, '一番古いものは捨てられていて、復号し直す');
  assert.equal(t.fetched.length, V.DECODED_MAX + 5, '生のファイルは持っているので読み直さない');
});

test('prefetch: 声が使えるときは復号まで、使えないときは読むだけ。同じファイルは 1 回', async () => {
  const t = setup(); t.vp.select('metan'); await flush();
  t.vp.prefetch(['出動！', 'おしい！もう一回。', '出動！']); await flush(); await flush();
  assert.deepEqual(t.fetched.sort(), ['voice/metan/aaa.aac', 'voice/metan/bbb.aac']);
  t.vp.prefetch(['出動！']); await flush();
  assert.equal(t.fetched.length, 2);   // 復号済み。もう読まない
  const u = setup({ noCtx: true }); u.vp.select('metan'); await flush();
  u.vp.prefetch(['出動！']); await flush();
  assert.equal(u.fetched.length, 1);   // AudioContext が無い間は、ファイルだけ読んでおく
});

test('T7 声のフォルダ: voices.js は空の一覧で、README がある。voice/ は 40MB 以下・1 ファイル 300KB 以下。パックのファイルが全部あり余りが無い', () => {
  const dir = path.join(__dirname, '..', 'voice');
  assert.ok(fs.existsSync(path.join(dir, 'README.md')));
  const root = { Manabi: {} };
  new Function('window', 'globalThis', fs.readFileSync(path.join(dir, 'voices.js'), 'utf8')).call(root, root, root);
  const list = root.Manabi.voiceList;
  assert.ok(Array.isArray(list));
  let total = 0;
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    const n = fs.statSync(p).size; total += n; assert.ok(n <= 300 * 1024, p + ' が 300KB を超える');
  });
  walk(dir);
  assert.ok(total <= 40 * 1024 * 1024, 'voice/ が 40MB を超える');
  list.forEach(v => {
    assert.match(v.id, /^[a-z0-9-]{1,20}$/);
    const pack = { clips: null };
    new Function('Manabi', fs.readFileSync(path.join(dir, v.id, 'index.js'), 'utf8'))({ voicePack: p => { pack.clips = p.clips; pack.ext = p.ext; } });
    const files = Object.values(pack.clips).map(c => c[0] + '.' + (pack.ext || 'aac'));
    files.forEach(f => assert.ok(fs.existsSync(path.join(dir, v.id, f)), f));
    const extra = fs.readdirSync(path.join(dir, v.id)).filter(f => /\.(aac|m4a)$/.test(f) && !files.includes(f));
    assert.deepEqual(extra, []);
  });
});

test('index.html の読み込み順（lines.js は problems.js の後、voice.js は lines.js と audio.js の後で speech.js の前）と、CI が voice を公開する', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const at = n => html.indexOf('src="' + n + '"');
  assert.ok(at('src/problems.js') > 0 && at('src/problems.js') < at('src/lines.js') && at('src/lines.js') < at('src/ui.js'));
  assert.ok(at('voice/voices.js') > 0 && at('src/audio.js') < at('src/voice.js') && at('src/lines.js') < at('src/voice.js') && at('src/voice.js') < at('src/speech.js'));
  const ci = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.match(ci, /cp -R index\.html css src voice _site\//);
});

test('T8 クレジット: voices.js の全 credit が index.html にあり、各声の README に規約の URL と確認日がある。パックは list.js の全文を持つ', () => {
  const dir = path.join(__dirname, '..', 'voice');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const root = { Manabi: {} };
  new Function('window', 'globalThis', fs.readFileSync(path.join(dir, 'voices.js'), 'utf8')).call(root, root, root);
  const { units } = require('../scripts/voice/list.js');
  root.Manabi.voiceList.forEach(v => {
    assert.ok(html.includes(v.credit), v.credit + ' が index.html に無い');
    const readme = fs.readFileSync(path.join(dir, v.id, 'README.md'), 'utf8');
    assert.match(readme, /https:\/\/\S+/);
    assert.match(readme, /確認日 \d{4}-\d{2}-\d{2}/);
    let clips = null;
    new Function('Manabi', fs.readFileSync(path.join(dir, v.id, 'index.js'), 'utf8'))({ voicePack: p => { clips = p.clips; } });
    units().forEach(u => assert.ok(clips[u.text], v.id + ' に無い文: ' + u.text));
  });
});
