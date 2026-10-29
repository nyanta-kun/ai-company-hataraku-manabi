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
  assert.ok(b.y < 0 && b.x < 0, 'しゃこでは絵が左右反転して先端が左上なので、左上へ');
  assert.ok(Math.abs(Math.atan2(-b.x, -b.y) - 0.55) < 1e-9, '先端の向きと同じ');
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

// 描画命令を記録するだけの ctx（画素の代わりに、描く順番と中身が同じかを比べる）
function recorder() {
  const log = [], st = {};
  const ctx = new Proxy({}, {
    get(_, k) { if (k in st) return st[k]; return (...a) => { log.push(k + JSON.stringify(a)); }; },
    set(_, k, v) { st[k] = v; log.push('set ' + k + '=' + v); return true; }
  });
  return { ctx, log };
}

test('しゃこの動き: 線路・桁・壁は車両と分けて描け、続けて描くと今までと同じ絵になる', () => {
  ['tram', 'monorail', 'linear', 'cablecar'].forEach(id => {
    assert.ok(V.hasTrack(id), id);
    const all = recorder(), parts = recorder();
    V.drawVehicle(all.ctx, id, 50, 60, 100, 1);
    ['under', 'body', 'over'].forEach(p => V.drawVehicle(parts.ctx, id, 50, 60, 100, 1, undefined, p));
    const strip = l => l.filter(x => !/^(save|restore|translate|scale|set lineJoin)/.test(x));
    assert.deepEqual(strip(parts.log), strip(all.log), id);
    const under = recorder(), body = recorder();
    V.drawVehicle(under.ctx, id, 50, 60, 100, 1, undefined, 'under');
    V.drawVehicle(body.ctx, id, 50, 60, 100, 1, undefined, 'body');
    assert.ok(under.log.length > 8 && body.log.length > 8, id);
  });
  assert.ok(!V.hasTrack('taxi') && !V.hasTrack('train') && !V.hasTrack(3));
  // 軌道のない乗り物は、今までどおり 1 回で描く
  const a = recorder(), b = recorder();
  V.drawVehicle(a.ctx, 'train', 10, 10, 80, 1); V.drawVehicle(b.ctx, 'train', 10, 10, 80, 1, undefined, 'all');
  assert.deepEqual(a.log, b.log);
});

test('しゃこの動き: 軌道の乗り物は軌道の上を行き来して元に戻る（走り抜けない・傾かない）', () => {
  const w = 200, h = 150, sz = 120, sc = sz / 1.8;
  ['tram', 'monorail', 'linear', 'cablecar'].forEach(id => {
    assert.equal(V.motionKind(id), 'rail', id);
    const R = V.RAIL[id], a = V.motionAt(id, 0, w, h, sz), z = V.motionAt(id, 1, w, h, sz);
    [a, z].forEach(m => assert.ok(Math.abs(m.x) < 1e-9 && Math.abs(m.y) < 1e-9 && m.k === 1 && m.rot === 0, id));
    let moved = 0;
    for (let u = 0; u <= 1; u += 0.02) {
      const m = V.motionAt(id, u, w, h, sz);
      assert.ok(Math.abs(m.x) <= R.r * sc + 1e-9, id);
      assert.equal(m.rot, 0, id);
            // 縮んでも軌道に乗る高さは変わらない（坂のぶんだけ x に比例してずれる）
      assert.equal(m.k, 1, id + ' は縮めない');
      const dy = m.y - m.x * R.slope;   // 軌道に乗ったまま。浮くのはりにあだけで、上にだけ
      if (R.lift) assert.ok(dy <= 1e-9 && dy >= -(R.lift + 0.02) * sc - 1e-9, id); else assert.ok(Math.abs(dy) < 1e-9, id);
      moved = Math.max(moved, Math.abs(m.x));
    }
    assert.ok(moved > sc * 0.1, id + ' が動く');
  });
  const c = V.motionAt('cablecar', 0.2, w, h, sz);
  assert.ok(c.x > 0 && c.y > 0, 'ケーブルカーは坂に沿って右下へ');
  assert.equal(V.motionAt('tram', 0.2, w, h, sz).y, 0);
  assert.ok(V.motionAt('linear', 0.5, w, h, sz).y < 0, 'りにあは浮く');
});
