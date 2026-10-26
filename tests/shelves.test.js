// ごほうびの棚（design-rewards.md 2・3・8・10 章）。tests/rewards.test.js・tests/rescue.test.js は変えず、game なしの経路の回帰になる
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

const SHELF_OF = {};
D.SHELVES.forEach(sh => sh.ids.forEach(id => { SHELF_OF[id] = sh.id; }));
const shelf = id => D.SHELVES.find(sh => sh.id === id);
const GAMES5 = D.GAMES.concat(['trace']);
const OLD15 = D.ALL_CARS.map(c => c.id);
const OLD11 = D.CARS.map(c => c.id);
const poolIds = rank => D.SHELVES.filter(sh => sh.from === undefined || rank >= sh.from).flatMap(sh => sh.ids);
const apply = (owned, r) => (r.sticker ? owned : Object.assign({}, owned, { [r.id]: r.stars }));

test('データ: 42 種で id が重ならず、名前はひらがなだけ、新しい 27 種は読み上げ用の表に無い', () => {
  assert.equal(D.ALL_VEHICLES.length, 42);
  assert.equal(new Set(D.ALL_VEHICLES.map(c => c.id)).size, 42);
  D.ALL_VEHICLES.forEach(c => { assert.match(c.id, /^[a-z]+$/); assert.match(c.name, /^[ぁ-んー]+$/, c.id); });
  D.VEHICLES.forEach(c => assert.ok(!D.CAR_YOMI[c.id], c.id));
  assert.equal(D.VEHICLES.length, 27);
  assert.equal(D.CARS.length, 11); assert.equal(D.RESCUE_CARS.length, 4); assert.equal(D.ALL_CARS.length, 15);
  assert.equal(D.REWARD_NEW_RIDE, 'あたらしい のりもの！');
  assert.match(D.REWARD_NEW_RIDE, /^[ぁ-んー !！]+$/);
});

test('棚: 各乗り物がちょうど 1 つの棚に入り、棚の数は 11・8・7・6・6・4。顔はその棚の中', () => {
  assert.deepEqual(D.SHELVES.map(sh => sh.ids.length), [11, 8, 7, 6, 6, 4]);
  assert.deepEqual(D.SHELVES.map(sh => sh.id), ['hataraku', 'machi', 'densha', 'sora', 'umi', 'kyujo']);
  const all = D.SHELVES.flatMap(sh => sh.ids);
  assert.equal(all.length, 42);
  assert.deepEqual(new Set(all), new Set(D.ALL_VEHICLES.map(c => c.id)));
  D.SHELVES.forEach(sh => { assert.ok(sh.ids.includes(sh.face), sh.id); if (sh.id !== 'hataraku') assert.equal(sh.ids[0], sh.face, sh.id); });   // はたらくくるま は CARS の順のまま（顔 しょうぼうしゃ は 1 回目に出る）
  assert.deepEqual(shelf('hataraku').ids, OLD11);
  assert.deepEqual(shelf('kyujo').ids, D.RESCUE_CARS.map(c => c.id));
  assert.equal(shelf('kyujo').from, D.RESCUE_FROM);
});

test('ゲーム: GAMES と trace の全部に棚があり、棚は存在する', () => {
  GAMES5.forEach(g => assert.ok(shelf(D.GAME_SHELF[g]), g));
  assert.deepEqual(D.GAME_SHELF, { math: 'hataraku', letter: 'machi', clock: 'densha', english: 'sora', trace: 'umi' });
});

test('絵と音: 全部の乗り物に絵と音があり、音の名前は data と audio で一致する', () => {
  D.ALL_VEHICLES.forEach(c => {
    if (typeof c.stage === 'number') { assert.ok(V.draw[c.stage], c.id); assert.ok(A.names.includes(A.carSound(c.stage)), c.id); return; }
    assert.ok(V.hasPic(c.stage), c.id);
    assert.equal(A.carSound(c.stage), c.sound, c.id);
    assert.ok(A.names.includes(c.sound), c.sound);
  });
});

test('保存: CAR_IDS と ALL_VEHICLES の id の集合が同じ。42 種 ★3 がそのまま残り、知らない id・★4 以上・負の数は今と同じ扱い', () => {
  assert.deepEqual([...S.CAR_IDS].sort(), D.ALL_VEHICLES.map(c => c.id).sort());
  assert.deepEqual(S.CAR_IDS.slice(0, 15), OLD15);
  assert.deepEqual(S.CAR_IDS, D.ALL_VEHICLES.map(c => c.id));
  const all = {}; S.CAR_IDS.forEach(i => { all[i] = 3; });
  assert.deepEqual(S.normalizeProfile({ cards: all }).cards, all);
  assert.deepEqual(S.normalizeProfile({ cards: { train: 9, fireboat: -1, ufo: 1, yacht: 2 } }).cards, { train: 3, yacht: 2 });
  const old = { nekoguruma: 3, shoubousha: 2, rescueheli: 1 };   // 今の子のカード
  assert.deepEqual(S.normalizeProfile({ cards: old }).cards, old);
});

// ---- 抽選 ----
test('game なし・知らない game・prototype の名前は今の経路と同じ（11 種 ★3 でステッカー）', () => {
  for (let s = 1; s <= 40; s++) {
    for (const g of [undefined, 'xyz', '', 'constructor', '__proto__', 'toString', null, 5]) {
      let owned = {}, a = rngOf(s), b = rngOf(s);
      for (let i = 0; i < 40; i++) {
        const x = R.pickReward(owned, 'kaji', a, 0, g), y = R.pickReward(owned, 'kaji', b, 0);
        assert.deepEqual(x, y);
        if (!x.sticker) assert.ok(OLD11.includes(x.id));
        owned = apply(owned, x);
      }
      assert.ok(OLD11.every(i => owned[i] === 3));
    }
  }
});

test('今と同じ: game=math は はたらくくるま（rank>=1 は救助隊も）がそろうまで、同じ乱数で同じ戻り値。そろった次は ほかの棚の未入手', () => {
  for (const rank of [0, 1, 2]) {
    const legacy = rank >= 1 ? OLD15 : OLD11;
    for (const sc of D.SCENES) {
      for (let s = 1; s <= 300; s++) {
        let owned = {}; const a = rngOf(s), b = rngOf(s);
        let guard = 0;
        while (!legacy.every(i => owned[i] > 0)) {
          assert.ok(guard++ < 40);
          const x = R.pickReward(owned, sc, a, rank, 'math'), y = R.pickReward(owned, sc, b, rank);
          assert.deepEqual(x, y, `seed ${s} ${sc} rank ${rank}`);
          owned = apply(owned, x);
        }
        const n = R.pickReward(owned, sc, a, rank, 'math'), o = R.pickReward(owned, sc, b, rank);
        assert.equal(n.isNew, true);
        assert.ok(!legacy.includes(n.id), n.id);
        assert.equal(o.isNew, false);   // 今は★を増やす
      }
    }
  }
});

test('ゲームごと: 1 回目は しょうぼうしゃ、2 回目は自分の棚の顔、そのあと自分の棚（rank>=1 は救助隊も）の未入手から', () => {
  for (const g of GAMES5) {
    const sh = shelf(D.GAME_SHELF[g]);
    for (const rank of [0, 1, 2]) {
      for (let s = 1; s <= 30; s++) {
        const rng = rngOf(s); let owned = {};
        const first = R.pickReward(owned, 'michi', rng, rank, g);
        assert.deepEqual(first, { id: 'shoubousha', stars: 1, isNew: true });
        owned = apply(owned, first);
        const home = sh.ids.concat(rank >= 1 ? shelf('kyujo').ids : []);
        const want = new Set(home.filter(i => i !== 'shoubousha'));
        if (sh.id !== 'hataraku') assert.equal(R.pickReward(owned, 'michi', rng, rank, g).id, sh.face);   // 顔
        while (want.size > 0) {
          const r = R.pickReward(owned, 'kaji', rng, rank, g);
          assert.ok(r.isNew && want.has(r.id), `${g} rank ${rank}: ${r.id}`);
          want.delete(r.id); owned = apply(owned, r);
        }
      }
    }
  }
});

test('rank 0 では どのゲームでも救助隊が出ない。rank 1・2 では どのゲームでも 4 種がいつかは出る', () => {
  const ky = shelf('kyujo').ids;
  for (const g of GAMES5) {
    for (let s = 1; s <= 20; s++) {
      const rng = rngOf(s); let o0 = {}, o1 = {};
      for (let i = 0; i < 126; i++) {
        const r0 = R.pickReward(o0, 'kaji', rng, 0, g); if (!r0.sticker) assert.ok(!ky.includes(r0.id)); o0 = apply(o0, r0);
        const r1 = R.pickReward(o1, 'kaji', rng, i % 2 ? 1 : 2, g); o1 = apply(o1, r1);
      }
      ky.forEach(k => assert.ok(o1[k] > 0, g + ' ' + k));
    }
  }
});

test('溢れ: 自分の棚（と救助隊）がそろったら、持っている割合がいちばん小さい棚の未入手から出る', () => {
  for (const g of GAMES5) {
    for (const rank of [0, 1]) {
      const own = shelf(D.GAME_SHELF[g]);
      for (let s = 1; s <= 60; s++) {
        const r0 = rngOf(s * 7);
        let owned = {};
        own.ids.concat(rank >= 1 ? shelf('kyujo').ids : []).forEach(i => { owned[i] = 1 + Math.floor(r0() * 3); });
        owned.shoubousha = owned.shoubousha || 1;
        D.SHELVES.forEach(sh => { if (sh.id !== own.id && sh.id !== 'kyujo') sh.ids.forEach(i => { if (r0() < 0.5) owned[i] = 1; }); });
        const ratio = sh => sh.ids.filter(i => owned[i] > 0).length / sh.ids.length;
        const open = D.SHELVES.filter(sh => (sh.from === undefined || rank >= sh.from) && sh.ids.some(i => !(owned[i] > 0)));
        if (open.length === 0) continue;
        const r = R.pickReward(owned, 'kaji', rngOf(s), rank, g);
        assert.ok(r.isNew, g);
        assert.ok(!(owned[r.id] > 0));
        const picked = shelf(SHELF_OF[r.id]);
        assert.ok(open.includes(picked));
        open.forEach(sh => assert.ok(ratio(picked) <= ratio(sh) + 1e-9, `${g}: ${picked.id} ${ratio(picked)} > ${sh.id} ${ratio(sh)}`));
      }
    }
  }
});

test('★: pool の全部を持つまで★は増えない。そろったら自分の棚の★の少ないものから、自分の棚が ★3 ならほかの棚から', () => {
  for (const g of GAMES5) {
    const home = shelf(D.GAME_SHELF[g]).ids.concat(shelf('kyujo').ids);
    for (let s = 1; s <= 20; s++) {
      const rng = rngOf(s); let owned = {};
      for (let i = 0; i < 42; i++) { const r = R.pickReward(owned, 'kaji', rng, 2, g); assert.ok(r.isNew, `${g} ${i}`); owned = apply(owned, r); }
      assert.equal(Object.keys(owned).length, 42);
      // ★ ここから: 自分の棚が全部 ★3 になるまで、自分の棚だけ★が増え、いつも最小の★から
      for (let i = 0; i < home.length * 2; i++) {
        const min = Math.min(...home.map(h => owned[h]));
        const r = R.pickReward(owned, 'kaji', rng, 2, g);
        assert.equal(r.isNew, false);
        assert.ok(home.includes(r.id)); assert.equal(owned[r.id], min); assert.equal(r.stars, min + 1);
        owned = apply(owned, r);
      }
      assert.ok(home.every(h => owned[h] === 3));
      const others = Object.keys(owned).filter(k => !home.includes(k));
      const min = Math.min(...others.map(k => owned[k]));
      const r = R.pickReward(owned, 'kaji', rng, 2, g);
      assert.ok(others.includes(r.id)); assert.equal(owned[r.id], min);
    }
  }
});

test('ステッカー: rank 0 は 38 種 ★3 で、rank>=1 は 42 種 ★3 でだけ。rank 0 では救助隊のカードがあっても 38 種で出る', () => {
  const all = ids => { const o = {}; ids.forEach(i => { o[i] = 3; }); return o; };
  for (const g of GAMES5) {
    assert.deepEqual(R.pickReward(all(poolIds(0)), 'kaji', rngOf(1), 0, g), { sticker: true });
    assert.deepEqual(R.pickReward(Object.assign(all(poolIds(0)), { rescuework: 1 }), 'kaji', rngOf(1), 0, g), { sticker: true });
    [1, 2].forEach(rk => {
      const o = all(poolIds(0));
      assert.equal(R.pickReward(o, 'kaji', rngOf(1), rk, g).isNew, true);
      assert.deepEqual(R.pickReward(all(poolIds(1)), 'kaji', rngOf(1), rk, g), { sticker: true });
    });
  }
});

test('長さ: ゲームを回しながら {} から重ねると、rank 0 は 38 回すべて新しく 115 回目がステッカー、rank 2 は 42 回・127 回目', () => {
  for (const [rank, n] of [[0, 38], [2, 42]]) {
    for (let s = 1; s <= 20; s++) {
      const rng = rngOf(s); let owned = {};
      for (let i = 1; i <= n * 3 + 1; i++) {
        const g = GAMES5[Math.floor(rng() * GAMES5.length)];
        const r = R.pickReward(owned, D.SCENES[i % 3], rng, rank, g);
        if (i <= n) assert.equal(r.isNew, true, `rank ${rank} #${i}`);
        else if (i <= n * 3) assert.ok(!r.sticker && r.isNew === false, `rank ${rank} #${i}`);
        else assert.deepEqual(r, { sticker: true });
        owned = apply(owned, r);
      }
    }
  }
});

test('applyReward: game を渡しても元の cards を書き換えず、結果と反映後が一致する', () => {
  for (const g of GAMES5) {
    const cards = { shoubousha: 1, train: 2 }, copy = JSON.stringify(cards);
    const { r, cards: next } = R.applyReward(cards, 'kaji', rngOf(5), 1, g);
    assert.equal(JSON.stringify(cards), copy);
    assert.equal(next[r.id], r.stars);
  }
  const x = R.applyReward({ shoubousha: 1 }, 'kaji', rngOf(5), 0), y = R.applyReward({ shoubousha: 1 }, 'kaji', rngOf(5), 0, 'math');
  assert.deepEqual(x, y);
});
