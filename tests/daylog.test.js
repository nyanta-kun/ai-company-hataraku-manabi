const test = require('node:test');
const assert = require('node:assert/strict');
const DL = require('../src/daylog.js');
const S = require('../src/storage.js');
const D = require('../src/data.js');

const T = '2026-10-28';
const clone = x => JSON.parse(JSON.stringify(x));

// ---- 日付 ----
test('addDays・weekStart: 月末・年末・うるう年・月曜はじまり', () => {
  assert.equal(DL.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(DL.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(DL.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(DL.addDays('2028-02-29', 1), '2028-03-01');
  assert.equal(DL.addDays('2027-03-01', -1), '2027-02-28');
  assert.equal(DL.weekStart('2026-12-28'), '2026-12-28');   // 月曜は自分
  assert.equal(DL.weekStart('2027-01-03'), '2026-12-28');   // 日曜はその週の月曜に戻る
  assert.equal(DL.weekStart('2026-10-28'), '2026-10-26');   // 水曜
  assert.deepEqual(DL.weekKeys('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
});
test('isDayKey: 形と実在', () => {
  assert.equal(DL.isDayKey('2026-10-28'), true);
  ['2026-02-30', '2026-1-1', '2026-13-01', '', null, 5, '__proto__', '2026-10-28x'].forEach(k => assert.equal(DL.isDayKey(k), false, String(k)));
  assert.equal(DL.isDayKey('2028-02-29'), true);
  assert.equal(DL.isDayKey('2027-02-29'), false);
});

// ---- 記録 ----
test('recordSession: 同じ日は足され、別の日は別の鍵。入力は書き換えない', () => {
  const a = DL.recordSession({}, T, { game: 'math', questions: 4, firstTry: 3 });
  const before = clone(a);
  const b = DL.recordSession(a, T, { game: 'math', questions: 4, firstTry: 2 });
  assert.deepEqual(a, before);
  assert.deepEqual(b[T].math, { sessions: 2, questions: 8, firstTry: 5 });
  assert.equal(b[T].last, 'math');
  const c = DL.recordSession(b, '2026-10-29', { game: 'clock', questions: 4, firstTry: 4 });
  assert.deepEqual(Object.keys(c).sort(), [T, '2026-10-29']);
  assert.equal(c['2026-10-29'].clock.sessions, 1);
});
test('recordSession: up は上のレベルだけ残る（下がったことは記録しない）', () => {
  let d = DL.recordSession({}, T, { game: 'math', questions: 4, firstTry: 4, up: 'M4' });
  d = DL.recordSession(d, T, { game: 'math', questions: 4, firstTry: 4, up: 'M5' });
  d = DL.recordSession(d, T, { game: 'math', questions: 4, firstTry: 1, up: 'M4' });
  assert.deepEqual(d[T].up, { math: 'M5' });
  d = DL.recordSession(d, T, { game: 'math', questions: 4, firstTry: 1, up: 'Z9' });
  assert.deepEqual(d[T].up, { math: 'M5' });
  const e = DL.recordSession({}, T, { game: 'trace', up: 'M5' });
  assert.equal(e[T].up, undefined);
});
test('recordSession: ごほうび（isNew のときだけ newCars。ステッカーは cards だけ）・めんきょ', () => {
  let d = DL.recordSession({}, T, { game: 'letter', questions: 4, firstTry: 4, reward: { id: 'bus', stars: 1, isNew: true } });
  d = DL.recordSession(d, T, { game: 'letter', questions: 4, firstTry: 4, reward: { id: 'bus', stars: 2, isNew: false } });
  d = DL.recordSession(d, T, { game: 'letter', questions: 4, firstTry: 4, reward: { sticker: true } });
  d = DL.recordSession(d, T, { game: 'letter', questions: 4, firstTry: 4, reward: { id: 'nonexistent', isNew: true } });
  assert.equal(d[T].cards, 4);
  assert.deepEqual(d[T].newCars, ['bus']);
  d = DL.recordSession(d, T, { game: 'solo', license: 'hira' });
  d = DL.recordSession(d, T, { game: 'solo', license: 'hira' });
  d = DL.recordSession(d, T, { game: 'solo', license: 'bogus' });
  assert.deepEqual(d[T].license, ['hira']);
  assert.equal(d[T].solo.sessions, 3); assert.equal(d[T].last, 'solo');
});
test('recordChar: chars・wrote・firstDone・firstSolo。知らない字は数えない', () => {
  let d = DL.recordChar({}, T, { game: 'trace', ch: 'し', firstDone: true, firstSolo: false });
  d = DL.recordChar(d, T, { game: 'solo', ch: 'し', firstDone: false, firstSolo: true });
  d = DL.recordChar(d, T, { game: 'solo', ch: 'つ', firstDone: true, firstSolo: true });
  assert.equal(d[T].wrote, 'しつ');
  assert.equal(d[T].newChars, 'しつ'); assert.equal(d[T].newSolo, 'しつ');
  assert.deepEqual(d[T].trace, { sessions: 0, chars: 1 });
  assert.deepEqual(d[T].solo, { sessions: 0, chars: 2 });
  const same = DL.recordChar(d, T, { game: 'trace', ch: 'あ'.repeat(1) + 'Q', firstDone: true });
  assert.deepEqual(same, d);
  assert.deepEqual(DL.recordChar(d, T, { game: 'math', ch: 'し' }), d);
});
test('addTime: 1 回 600 秒まで・負や数でないは 0・合計 86400 まで', () => {
  assert.equal(DL.addTime({}, T, 125)[T].sec, 125);
  assert.equal(DL.addTime({}, T, 5000)[T].sec, 600);
  assert.deepEqual(DL.addTime({}, T, -5), {});
  assert.deepEqual(DL.addTime({}, T, NaN), {});
  assert.deepEqual(DL.addTime({}, T, '30'), {});
  let d = {};
  for (let i = 0; i < 200; i++) d = DL.addTime(d, T, 600);
  assert.equal(d[T].sec, 86400);
});
test('prune: 今日を含め 35 日。今日の 34 日前は残り 35 日前は消える。2 日以上先は消え 1 日先は残る', () => {
  const mk = k => ({ [k]: { math: { sessions: 1, questions: 4, firstTry: 4 } } });
  const all = Object.assign({}, mk(DL.addDays(T, -34)), mk(DL.addDays(T, -35)), mk(DL.addDays(T, 1)), mk(DL.addDays(T, 2)), mk(T));
  const p = DL.prune(all, T);
  assert.deepEqual(Object.keys(p).sort(), [DL.addDays(T, -34), T, DL.addDays(T, 1)].sort());
  const r = DL.recordSession(all, T, { game: 'math', questions: 4, firstTry: 4 });
  assert.equal(r[DL.addDays(T, -35)], undefined); assert.equal(r[DL.addDays(T, 2)], undefined);
});
test('365 日続けて毎日記録しても鍵は 35 個、上限の中', () => {
  let d = {}, day = '2026-01-01';
  for (let i = 0; i < 365; i++) {
    d = DL.recordSession(d, day, { game: 'math', questions: 4, firstTry: 4 });
    d = DL.recordChar(d, day, { game: 'trace', ch: 'し', firstDone: true });
    d = DL.addTime(d, day, 300);
    day = DL.addDays(day, 1);
  }
  assert.equal(Object.keys(d).length, 35);
  assert.deepEqual(DL.normalizeDays(d), d);
});
test('1 日に 1000 回・10000 字でも上限で止まる', () => {
  let d = {};
  for (let i = 0; i < 1100; i++) d = DL.recordSession(d, T, { game: 'math', questions: 4, firstTry: 4 });
  assert.equal(d[T].math.sessions, 999); assert.equal(d[T].math.questions, 4400);
  let e = {};
  const chars = Array.from(require('../src/strokes.js').SETS.hira);
  for (let i = 0; i < 150; i++) e = DL.recordChar(e, T, { game: 'trace', ch: chars[i % chars.length], firstDone: true });
  assert.equal(e[T].trace.chars, 150);
  const k1 = Array.from(require('../src/strokes.js').SETS.k1 + require('../src/strokes.js').SETS.k2 + require('../src/strokes.js').SETS.kata);
  for (const c of k1) e = DL.recordChar(e, T, { game: 'trace', ch: c, firstDone: true });
  assert.ok(Array.from(e[T].wrote).length <= 130);
  Array.from(e[T].newChars).forEach(c => assert.ok(e[T].wrote.includes(c)));
});

// ---- 補正 ----
test('normalizeDays: 壊れたデータは使える部分だけ残る', () => {
  [null, undefined, 'x', 5, [], true].forEach(v => assert.deepEqual(DL.normalizeDays(v), {}));
  const raw = {
    '2026-10-28': {
      math: { sessions: 2, questions: 8, firstTry: 99 },
      letter: { sessions: -1, questions: 1.9, firstTry: 'x' },
      bogus: { sessions: 3 },
      clock: { sessions: 0, questions: 0, firstTry: 0 },
      trace: { sessions: 1, chars: 4 },
      up: { math: 'M5', trace: 'M5', clock: 'Q' },
      wrote: 'しつQし', newChars: 'つあ', newSolo: 'ZZ', license: ['hira', 'hira', 'x'], newCars: ['bus', 'bus', 'nope'],
      cards: 5, sec: 1e9, last: 'nothing'
    },
    '2026-02-30': { math: { sessions: 1 } }, 'abc': {}, '2026-10-27': 'x', '2026-10-26': {}, '__proto__': { math: { sessions: 1 } }
  };
  const before = clone(raw);
  const out = DL.normalizeDays(raw);
  assert.deepEqual(raw, before);
  assert.deepEqual(Object.keys(out), ['2026-10-28']);
  const d = out['2026-10-28'];
  assert.deepEqual(d.math, { sessions: 2, questions: 8, firstTry: 8 });
  assert.deepEqual(d.letter, { sessions: 0, questions: 1, firstTry: 0 });
  assert.equal(d.bogus, undefined); assert.equal(d.clock, undefined);
  assert.deepEqual(d.up, { math: 'M5' });
  assert.equal(d.wrote, 'しつ'); assert.equal(d.newChars, 'つ'); assert.equal(d.newSolo, undefined);
  assert.deepEqual(d.license, ['hira']); assert.deepEqual(d.newCars, ['bus']);
  assert.equal(d.cards, 5); assert.equal(d.sec, 86400); assert.equal(d.last, '');
  assert.deepEqual(DL.normalizeDays(out), out);   // 2 回通しても同じ
  assert.equal(({}).math, undefined);             // 汚染されない
});
test('normalizeDays: 41 件以上は新しい 40 件', () => {
  const raw = {};
  let k = '2026-01-01';
  for (let i = 0; i < 60; i++) { raw[k] = { math: { sessions: 1, questions: 4, firstTry: 4 } }; k = DL.addDays(k, 1); }
  const out = DL.normalizeDays(raw);
  assert.equal(Object.keys(out).length, 40);
  assert.ok(out['2026-03-01'] && !out['2026-01-01']);
});

// ---- 保存との結合 ----
test('storage: days の無い・壊れたプロフィールは days: {} で、ほかは変わらない', () => {
  const p = S.normalizeProfile({ levels: { math: 'M3' } });
  assert.deepEqual(p.days, {}); assert.deepEqual(p.daysOther, {});
  assert.deepEqual(S.normalizeProfile({ days: 'x', daysOther: [1] }).days, {});
  assert.equal(p.levels.math, 'M3');
  const m = S.migrateV1({ levels: { math: 'M2' } }, 'p_a_0001', '2026-10-25');
  assert.deepEqual(m.profiles[0].days, {});
});
test('storage: days は補正を通って残り、読み直しても同じ。device の番号・送る日・消した日', () => {
  const days = DL.recordSession({}, T, { game: 'math', questions: 4, firstTry: 4 });
  const st = S.normalize({ profiles: [{ id: 'p_a_0001', days, daysOther: days }] }, 'p_a_0001', T);
  assert.deepEqual(st.profiles[0].days, days); assert.deepEqual(st.profiles[0].daysOther, days);
  assert.match(st.device.deviceId, /^d_[0-9a-z]{8}$/);
  assert.deepEqual(st.device.daysDirty, []); assert.equal(st.device.daysPrunedOn, '');
  const st2 = S.normalize(JSON.parse(JSON.stringify(st)), 'p_a_0009', T);
  assert.equal(st2.device.deviceId, st.device.deviceId);   // 一度作った番号は変わらない
  assert.deepEqual(st2.profiles[0].days, days);
  const odd = S.normalize({ device: { deviceId: 'D_X', daysDirty: [T, T, 'bad', '2026-10-27'], daysPrunedOn: 'x' }, profiles: [{ id: 'p_a_0001' }] }, 'p_a_0001', T);
  assert.match(odd.device.deviceId, /^d_[0-9a-z]{8}$/); assert.notEqual(odd.device.deviceId, 'D_X');
  assert.deepEqual(odd.device.daysDirty, [T, '2026-10-27']); assert.equal(odd.device.daysPrunedOn, '');
});
