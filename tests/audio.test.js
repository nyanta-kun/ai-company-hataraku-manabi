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

function flips(V, stage, facing) {
  let n = 0;
  const ctx = new Proxy({}, { get: (t, k) => (...a) => { if (k === 'scale' && a[0] === -1 && a[1] === 1) n++; }, set: () => true });
  V.drawVehicle(ctx, stage, 0, 0, 100, facing);
  return n;
}

test('トラック(8)は既定=右向きで反転し、-1 なら反転しない', () => {
  require('../src/vehicles.js');
  const V = globalThis.Manabi.vehicles;
  assert.equal(flips(V, 8), 1);
  assert.equal(flips(V, 8, 1), 1);
  assert.equal(flips(V, 8, -1), 0);
});

test('全ての stage で「絵の前」と facing が一致して見える（前と違う向きのときだけ反転）', () => {
  require('../src/vehicles.js');
  const V = globalThis.Manabi.vehicles;
  D.CARS.forEach(c => {
    const front = V.frontOf(c.stage);
    [1, -1].forEach(f => assert.equal(flips(V, c.stage, f), front === f ? 0 : 1, 'stage ' + c.stage + ' facing ' + f));
  });
  [1, 2, 4].forEach(s => assert.equal(V.frontOf(s), 1));
  [3, 5, 6, 7, 8, 9, 10, 11].forEach(s => assert.equal(V.frontOf(s), -1));
});
