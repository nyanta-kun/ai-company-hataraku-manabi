// 棚の乗り物の絵と音（design-rewards.md 6・7 章）
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/audio.js');
require('../src/vehicles.js');
const A = globalThis.Manabi.audio;
const V = globalThis.Manabi.vehicles;

const NEW12 = ['tram', 'monorail', 'freight', 'cablecar', 'balloon', 'airship', 'propplane', 'fishboat', 'yacht', 'tugboat', 'fireboat', 'cargoship'];

test('絵: 描き足した 12 種が偽の ctx で例外なく描け、ききゅう以外は前=左の横向き', () => {
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  NEW12.forEach(id => {
    assert.ok(V.hasPic(id), id);
    [0, 0.3, 1.7].forEach(t => V.drawVehicle(ctx, id, 0, 0, 100, 1, t));
    V.drawPic(ctx, id, 0, 0, 100, 0.2);
    assert.equal(V.frontOf(id), -1, id);
  });
});

test('音: car12〜car17 があり、名前は重なりの上限の対象（/^car\\d+$/）', () => {
  ['car12', 'car13', 'car14', 'car15', 'car16', 'car17'].forEach(n => { assert.ok(A.names.includes(n), n); assert.match(n, /^car\d+$/); });
});

test('音: 文字列の stage の対応表に、救助隊の 4 つが今までと同じ音で入っている', () => {
  assert.deepEqual(
    ['rescueWork', 'rescueChem', 'rescueCmd', 'rescueHeli'].map(A.carSound),
    ['car4', 'car9', 'car7', 'car11']
  );
  assert.equal(A.carSound('unknown'), 'car8');
  assert.equal(A.carSound(5), 'car5');
  Object.keys(A.PIC_SOUND).forEach(k => assert.ok(A.names.includes(A.PIC_SOUND[k]), k));
});
