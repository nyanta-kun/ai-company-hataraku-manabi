// 救助隊の車とカード（design-elementary 3.12）
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/rewards.js');
const D = require('../src/data.js');
const S = require('../src/storage.js');
require('../src/audio.js');
require('../src/vehicles.js');
const A = globalThis.Manabi.audio;
const V = globalThis.Manabi.vehicles;
const { rngOf } = require('./helpers.js');

const OLD = D.CARS.map(c => c.id);
const NEW = D.RESCUE_CARS.map(c => c.id);

test('データ: 救助隊の車は 4 種で、今までの 11 種と id が重ならず、名前はひらがなだけ', () => {
  assert.equal(NEW.length, 4);
  assert.equal(new Set(OLD.concat(NEW)).size, 15);
  assert.equal(D.ALL_CARS.length, 15);
  D.RESCUE_CARS.forEach(c => { assert.match(c.name, /^[ぁ-んー]+$/, c.id); assert.ok(!D.CAR_YOMI[c.id], '読みは名前のまま'); });
  for (const sc of D.SCENES) D.RESCUE_SCENE_CARS[sc].forEach(i => assert.ok(NEW.includes(i)));
});

test('絵と音: 全部の救助隊の車に絵と音があり、向きは他の新しい絵と同じ（前=左）', () => {
  D.RESCUE_CARS.forEach(c => {
    assert.ok(V.hasPic(c.stage), c.id);
    assert.equal(A.carSound(c.stage), c.sound, c.id);
    assert.ok(A.names.includes(c.sound), c.sound);
    assert.equal(V.frontOf(c.stage), -1);
    // 実際に描ける（偽の ctx で例外が出ない）
    const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
    [0, 0.3].forEach(t => V.drawVehicle(ctx, c.stage, 0, 0, 100, 1, t));
  });
});

test('保存: storage の車 id の一覧と data.js の ALL_CARS が一致し、救助隊のカードも読み戻せる', () => {
  const d = S.normalizeProfile({ cards: { rescuework: 2, rescueheli: 9, rescuecmd: -1, rescuefoo: 1, dump: 1 } });
  assert.deepEqual(d.cards, { rescuework: 2, rescueheli: 3, dump: 1 });
  const all = {}; D.ALL_CARS.forEach(c => { all[c.id] = 1; });
  assert.deepEqual(S.normalizeProfile({ cards: all }).cards, all);
  // 今までのデータ（救助隊のカードなし）はそのまま
  const old = { nekoguruma: 3, shoubousha: 2 };
  assert.deepEqual(S.normalizeProfile({ cards: old }).cards, old);
});

test('S0（rank 0・省略）では救助隊の車が出ず、結果は今までと同じ', () => {
  for (let s = 1; s <= 300; s++) {
    for (const sc of D.SCENES) {
      let owned = {}, a = rngOf(s), b = rngOf(s);
      for (let i = 0; i < 40; i++) {
        const x = R.pickReward(owned, sc, a), y = R.pickReward(owned, sc, b, 0);
        assert.deepEqual(x, y);
        if (!x.sticker) { assert.ok(OLD.includes(x.id), x.id); owned = Object.assign({}, owned, { [x.id]: x.stars }); }
      }
      assert.ok(OLD.every(i => owned[i] === 3));
      assert.deepEqual(R.pickReward(owned, sc, a, 0), { sticker: true });   // 11 種 ★3 のあとはステッカー
    }
  }
});

test('S0 で全部そろえた子が S0 で遊んでも、救助隊のカードを持っていても落ちない', () => {
  const owned = {}; OLD.forEach(i => { owned[i] = 3; }); owned.rescuework = 1;
  assert.deepEqual(R.pickReward(owned, 'kaji', rngOf(1), 0), { sticker: true });
});

test('S1・S2 では救助隊の車が出る（全種いつかは出る）。1回目はしょうぼうしゃのまま', () => {
  for (const rank of [1, 2]) {
    assert.deepEqual(R.pickReward({}, 'michi', rngOf(5), rank), { id: 'shoubousha', stars: 1, isNew: true });
    const seen = new Set();
    for (let s = 1; s <= 400; s++) {
      const r = R.pickReward({ shoubousha: 1 }, D.SCENES[s % 3], rngOf(s), rank);
      assert.ok(r.isNew); seen.add(r.id);
    }
    NEW.forEach(i => assert.ok(seen.has(i), 'rank ' + rank + ' ' + i));
  }
});

test('S1 以上: 現場に関係する未入手が優先され（救助隊の車を含む）、重複して入手しない', () => {
  for (const sc of D.SCENES) {
    const near = D.SCENE_CARS[sc].concat(D.RESCUE_SCENE_CARS[sc]);
    for (let s = 1; s <= 100; s++) {
      const r = R.pickReward({ shoubousha: 1 }, sc, rngOf(s), 1);
      assert.ok(near.includes(r.id), sc + ' ' + r.id);
    }
  }
  const r = rngOf(9), owned = {};
  for (let n = 1; n <= 15; n++) {
    const got = R.pickReward(owned, D.SCENES[n % 3], r, 2);
    assert.equal(got.isNew, true, 'n=' + n); assert.equal(owned[got.id], undefined);
    owned[got.id] = got.stars;
  }
  assert.equal(Object.keys(owned).length, 15);
});

test('今までの11種を★3まで集めた子が S1 に上がると、救助隊の車が新しく出る。15種★3で終わる', () => {
  const owned = {}; OLD.forEach(i => { owned[i] = 3; });
  const g = R.pickReward(owned, 'kaji', rngOf(2), 1);
  assert.ok(g.isNew && NEW.includes(g.id) && g.stars === 1);
  let cards = owned;
  const rng = rngOf(3);
  for (let i = 0; i < 12; i++) { const a = R.applyReward(cards, 'takai', rng, 2); assert.ok(!a.r.sticker); cards = a.cards; }
  assert.ok(D.ALL_CARS.every(c => cards[c.id] === 3));
  assert.deepEqual(R.pickReward(cards, 'kaji', rng, 2), { sticker: true });
});

test('★は、全種入手後に★が少ない車から増える（S2・15種）', () => {
  const owned = {}; D.ALL_CARS.forEach(c => { owned[c.id] = 1; });
  const rng = rngOf(11);
  for (let step = 0; step < 30; step++) {
    const min = Math.min(...D.ALL_CARS.map(c => owned[c.id]));
    const got = R.pickReward(owned, 'michi', rng, 2);
    assert.equal(got.isNew, false); assert.equal(owned[got.id], min); owned[got.id] = got.stars;
  }
});
