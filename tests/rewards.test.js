const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/rewards.js');
const D = require('../src/data.js');
const { rngOf } = require('./helpers.js');

const IDS = D.CARS.map(c => c.id);

test('性質10: 1回目の出動は現場に関係なく必ずしょうぼうしゃ', () => {
  for (const scene of D.SCENES) {
    for (let s = 1; s <= 50; s++) {
      const r = R.pickReward({}, scene, rngOf(s));
      assert.deepEqual(r, { id: 'shoubousha', stars: 1, isNew: true });
    }
  }
});

test('2回目以降は未入手から選ばれ、現場に関係する車が優先される', () => {
  for (const scene of D.SCENES) {
    for (let s = 1; s <= 100; s++) {
      const r = R.pickReward({ shoubousha: 1 }, scene, rngOf(s));
      assert.ok(r.isNew && r.stars === 1 && r.id !== 'shoubousha');
      assert.ok(D.SCENE_CARS[scene].includes(r.id), scene + ' ' + r.id);
    }
  }
});

test('関係する車が尽きたら未入手全体から選ぶ', () => {
  const owned = { shoubousha: 1, mizutank: 1, hashigo: 1, chodai: 2 };
  const seen = new Set();
  for (let s = 1; s <= 300; s++) {
    const r = R.pickReward(owned, 'kaji', rngOf(s));
    assert.ok(r.isNew && !owned[r.id]);
    seen.add(r.id);
  }
  assert.deepEqual([...seen].sort(), IDS.filter(i => !owned[i]).sort());
});

test('未入手が尽きるまで★は増えず、全種そろうまで11回かかる', () => {
  const r = rngOf(42);
  const owned = {};
  for (let n = 1; n <= 11; n++) {
    const got = R.pickReward(owned, D.SCENES[n % 3], r);
    assert.equal(got.isNew, true, 'n=' + n);
    assert.equal(owned[got.id], undefined, '重複して入手しない');
    owned[got.id] = got.stars;
  }
  assert.equal(Object.keys(owned).length, 11);
});

test('全種入手後は★が最も少ない車から選ばれ、33ステップで終わる', () => {
  const r = rngOf(7);
  const owned = {};
  IDS.forEach(i => { owned[i] = 1; });
  for (let step = 0; step < 22; step++) {
    const min = Math.min(...IDS.map(i => owned[i]));
    const got = R.pickReward(owned, 'michi', r);
    assert.equal(got.isNew, false);
    assert.equal(owned[got.id], min, '★最小の車');
    assert.equal(got.stars, min + 1);
    owned[got.id] = got.stars;
  }
  assert.ok(IDS.every(i => owned[i] === 3));
  assert.deepEqual(R.pickReward(owned, 'kaji', r), { sticker: true });
});

test('同じシードなら同じ結果', () => {
  assert.deepEqual(R.pickReward({ shoubousha: 1 }, 'kaji', rngOf(3)), R.pickReward({ shoubousha: 1 }, 'kaji', rngOf(3)));
});

test('データ: 車は11種で id が重複しない、現場の関連車は実在する', () => {
  assert.equal(D.CARS.length, 11);
  assert.equal(new Set(IDS).size, 11);
  assert.deepEqual(D.CARS.map(c => c.stage), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  for (const s of D.SCENES) D.SCENE_CARS[s].forEach(i => assert.ok(IDS.includes(i)));
});
