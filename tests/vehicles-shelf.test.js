// 棚の乗り物の絵と音（design-rewards.md 6・7 章）
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/audio.js');
require('../src/vehicles.js');
const A = globalThis.Manabi.audio;
const V = globalThis.Manabi.vehicles;

const NEW17 = ['hayabusa', 'komachi', 'kagayaki', 'doctoryellow', 'linear', 'tram', 'monorail', 'freight', 'cablecar', 'balloon', 'airship', 'propplane', 'fishboat', 'yacht', 'tugboat', 'fireboat', 'cargoship'];

test('絵: 描き足した 17 種が偽の ctx で例外なく描け、ききゅう以外は前=左の横向き', () => {
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  NEW17.forEach(id => {
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

test('しゃこの動き: ロケットは絵の傾きに沿って斜め上へ飛んで戻り、枠から出ない', () => {
  assert.equal(V.motionKind('rocket'), 'rocket');
  const w = 200, h = 150, sz = 120;
  const a = V.motionAt('rocket', 0, w, h, sz), b = V.motionAt('rocket', 0.5, w, h, sz), c = V.motionAt('rocket', 1, w, h, sz);
  assert.ok(Math.abs(a.x) < 1e-9 && Math.abs(a.y) < 1e-9 && a.k === 1);
  assert.ok(Math.abs(c.y) < 1e-9 && Math.abs(c.x) < 1e-9);
  assert.ok(b.y < 0 && b.x > 0, '右上へ');
  assert.ok(Math.abs(Math.atan2(b.x, -b.y) - 0.55) < 1e-9, '傾きと同じ向き');
  assert.ok(b.k < 1);
});

test('しゃこの動き: 空・海の乗り物の種類と、走る乗り物の既定', () => {
  const kinds = { balloon: 'float', airship: 'drift', heli: 'hover', rescueHeli: 'hover', airplane: 'climb', propplane: 'climb', ship: 'sail', yacht: 'sail', taxi: 'run', train: 'run', 8: 'run' };
  Object.keys(kinds).forEach(k => assert.equal(V.motionKind(isNaN(k) ? k : +k), kinds[k], k));
  const w = 200, h = 150, sz = 120;
  [['taxi', 0], ['airplane', 0], ['ship', 0]].forEach(([id]) => {
    assert.ok(V.motionAt(id, 0, w, h, sz).x < -w / 2);
    assert.ok(V.motionAt(id, 1, w, h, sz).x > w / 2);
  });
  assert.equal(V.motionAt('taxi', 0.5, w, h, sz).y, 0);
  assert.ok(V.motionAt('airplane', 1, w, h, sz).y < 0);
  ['balloon', 'airship', 'heli'].forEach(id => {
    [0, 1].forEach(u => { const m = V.motionAt(id, u, w, h, sz); assert.ok(Math.abs(m.x) < 1e-9 && Math.abs(m.y) < 1e-9, id); });
    for (let u = 0; u <= 1; u += 0.05) { const m = V.motionAt(id, u, w, h, sz); assert.ok(Math.abs(m.x) < sz * 0.25 && Math.abs(m.y) < sz * 0.15, id); }
  });
});
