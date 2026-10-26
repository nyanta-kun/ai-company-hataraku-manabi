// 「かく」の保存（design-tracing 2.6）。プロフィールの trace / stats.trace と、既存データを守ること
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../src/storage.js');

test('既定の進み具合に trace と stats.trace が入る', () => {
  const d = S.defaultProgress();
  assert.deepEqual(d.trace, { done: {}, set: 'auto', width: 'auto' });
  assert.deepEqual(d.stats.trace, { sessions: 0, chars: 0, clean: 0 });
});

test('旧データ（trace なし）は既定で補われ、ほかの項目は変わらない', () => {
  const old = { levels: { math: 'M3', letter: 'K2', clock: 'T1', english: 'E1' }, cards: { dump: 2 }, stats: { sessions: 5, math: { sessions: 2, questions: 8, firstTry: 6 } }, lastPlayed: '2026-10-01' };
  const d = S.normalizeProfile(old);
  assert.equal(d.levels.math, 'M3'); assert.equal(d.cards.dump, 2); assert.equal(d.stats.sessions, 5); assert.equal(d.stats.math.firstTry, 6);
  assert.deepEqual(d.trace, { done: {}, set: 'auto', width: 'auto' });
  assert.deepEqual(d.stats.trace, { sessions: 0, chars: 0, clean: 0 });
});

test('trace の壊れた値は直る（知らない字・負・文字列・100 以上・知らない set）', () => {
  const d = S.normalizeProfile({ trace: { done: { し: 2, x: 3, つ: -1, く: '4', へ: 250 }, set: 'zzz', width: 7 }, stats: { trace: { sessions: 'a', chars: 3.7, clean: -2 } } });
  assert.deepEqual(d.trace.done, { し: 2, へ: 99 });
  assert.equal(d.trace.set, 'auto'); assert.equal(d.trace.width, 'auto');
  assert.deepEqual(d.stats.trace, { sessions: 0, chars: 3, clean: 0 });
});

test('trace は保存して読み戻しても同じ。指の線は保存しない（点列の項目が無い）', () => {
  const st = S.defaults('p_aaa_0001', '2026-10-26');
  st.profiles[0].trace.done['し'] = 3; st.profiles[0].stats.trace.chars = 4;
  const back = S.normalize(JSON.parse(JSON.stringify(st)), 'p_aaa_0001', '2026-10-26');
  assert.deepEqual(back.profiles[0].trace, { done: { し: 3 }, set: 'auto', width: 'auto' });
  assert.equal(back.profiles[0].stats.trace.chars, 4);
  assert.deepEqual(Object.keys(back.profiles[0].trace).sort(), ['done', 'set', 'width']);
});

test('index.html は strokes.js・trace.js を storage.js より前に、traceboard.js を ui.js より前に読む', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const at = (n) => html.indexOf('src/' + n + '"');
  assert.ok(at('strokes.js') > 0 && at('strokes.js') < at('trace.js') && at('trace.js') < at('storage.js'));
  assert.ok(at('traceboard.js') > 0 && at('traceboard.js') < at('ui.js'));
  assert.ok(html.includes('KanjiVG') && html.includes('CC BY-SA 3.0'));
});
