const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/data.js');
require('../src/audio.js');
const A = globalThis.Manabi.audio;

test('全ての車に専用の音がある（stage ごとに別の名前）', () => {
  const names = D.CARS.map(c => A.carSound(c.stage));
  assert.equal(new Set(names).size, D.CARS.length);
  names.forEach(n => assert.ok(A.names.includes(n), n));
});

test('出動する車・救急車の音は存在する', () => {
  [4, 7, 8, 10].forEach(s => assert.ok(A.names.includes(A.carSound(s))));
});

test('乗り物の絵は drawVehicle の facing で左右を切り替える（既定=右向き=反転あり）', () => {
  require('../src/vehicles.js');
  const V = globalThis.Manabi.vehicles;
  const flips = (...args) => {
    let n = 0;
    const ctx = new Proxy({}, { get: (t, k) => (...a) => { if (k === 'scale' && a[0] === -1 && a[1] === 1) n++; }, set: () => true });
    V.drawVehicle(ctx, 1, 0, 0, 100, ...args);
    return n;
  };
  assert.equal(flips(), flips(1));
  assert.equal(flips() - flips(-1), 1);
});
