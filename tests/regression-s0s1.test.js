// S0・S1 の出題が R3（S2 の追加）の前と同じであることの固定。M1〜M10・K1〜K8・T1〜T7・E1〜E5 を、固定シードで 3 回ずつ出した結果の SHA-256。
// （R3 の前の版と、同じスクリプトで比べて一致を確かめてから値を入れた。S0・S1 の問題を意図して変えるときだけ更新する）
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const P = require('../src/problems.js');
const { rngOf } = require('./helpers.js');

const LV = {
  math: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10'],
  letter: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'],
  clock: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  english: ['E1', 'E2', 'E3', 'E4', 'E5']
};
const EXPECT = '99984ce5c865f864b1582ad7a4e6792df7b55c8bc2935d07cf53cdbce91d2080';

test('S0・S1 の出題は R3 の前と同じ（固定シードの SHA-256）', () => {
  const h = crypto.createHash('sha256');
  Object.keys(LV).forEach((g) => LV[g].forEach((l) => {
    for (let s = 1; s <= 30; s++) {
      const r = rngOf(s * 7919), seq = [];
      for (let i = 0; i < 3; i++) seq.push(P.generateSession(g, l, r, []));
      h.update(g + l + ':' + s + JSON.stringify(seq));
    }
  }));
  assert.equal(h.digest('hex'), EXPECT);
});

// 国語の「直近の絵」（seen）が空でないときも同じ（K1〜K8 を、直近の絵 8 個つきで）。旧版（origin/main）と同じ値
const EXPECT_SEEN = '8a97a2e2eb8be0878618877d76e885c74fa177f280577fcb30fab73558a8ca4f';
test('S0・S1 の国語の出題は、直近の絵があっても R3 の前と同じ', () => {
  const seen = ['v8', 'hose', 'flame', 'bus', 'ship', 'train', 'airplane', 'taxi'];
  const h = crypto.createHash('sha256');
  LV.letter.forEach((l) => {
    for (let s = 1; s <= 30; s++) {
      const r = rngOf(s * 7919), seq = [];
      for (let i = 0; i < 3; i++) seq.push(P.generateSession('letter', l, r, seen));
      h.update(l + ':' + s + JSON.stringify(seq));
    }
  });
  assert.equal(h.digest('hex'), EXPECT_SEEN);
});
