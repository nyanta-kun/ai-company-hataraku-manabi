const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/storage.js');
const PR = require('../src/profiles.js');

const T = '2026-10-25';
const base = () => S.defaults('p_a_0001', T);
function four() {
  let st = base();
  for (let i = 2; i <= 4; i++) st = PR.addProfile(st, '', undefined, 'p_a_000' + i, T).state;
  return st;
}

test('addProfile を 4 回 → 4 人。5 回目は full で state が変わらない', () => {
  let st = base();
  for (let i = 2; i <= 4; i++) { const r = PR.addProfile(st, '', undefined, 'p_a_000' + i, T); assert.equal(r.ok, true); st = r.state; }
  assert.equal(st.profiles.length, 4);
  const before = JSON.stringify(st);
  const r = PR.addProfile(st, 'はな', undefined, 'p_a_0005', T);
  assert.equal(r.ok, false); assert.equal(r.reason, 'full');
  assert.equal(JSON.stringify(r.state), before);
  assert.deepEqual(st.profiles.map(p => p.name), ['こども1', 'こども2', 'こども3', 'こども4']);
});

test('addProfile: 名前は normalizeName を通す。不正なら追加しない。空は こども+最小の空き番号', () => {
  let st = base();
  st = PR.addProfile(st, 'タロウ', undefined, 'p_a_0002', T).state;
  assert.equal(st.profiles[1].name, 'たろう');
  const r = PR.addProfile(st, '太郎', undefined, 'p_a_0003', T);
  assert.equal(r.ok, false); assert.equal(r.reason, 'chars');
  assert.equal(PR.addProfile(st, 'ななななななな', undefined, 'p_a_0003', T).reason, 'long');
  // こども1 を消して番号が空いたら、次の空は 1
  const s2 = PR.renameProfile(st, 'p_a_0001', 'ゆうき').state;
  assert.equal(PR.addProfile(s2, '', undefined, 'p_a_0003', T).state.profiles[2].name, 'こども1');
  assert.equal(PR.addProfile(st, '', undefined, 'p_a_0001', T).ok, false, 'id 重複は追加しない');
});

test('既定アイコンが重ならない。setIcon で他人の車を指定しても変わらない', () => {
  const st = four();
  const icons = st.profiles.map(p => p.icon);
  assert.equal(new Set(icons).size, 4);
  assert.deepEqual(icons, PR.ICON_ORDER.slice(0, 4));
  assert.equal(PR.setIcon(st, 'p_a_0001', st.profiles[1].icon), st);
  assert.equal(PR.setIcon(st, 'p_a_0001', 'ufo'), st);
  const ok = PR.setIcon(st, 'p_a_0001', 'forklift');
  assert.equal(ok.profiles[0].icon, 'forklift'); assert.equal(st.profiles[0].icon, 'shoubousha');
  assert.equal(PR.setIcon(st, 'p_a_0001', 'shoubousha').profiles[0].icon, 'shoubousha');   // 自分の車は選べる
  assert.equal(PR.freeIcon(st), PR.ICON_ORDER[4]);
  // 指定アイコンが使用済みなら空きに替える
  assert.equal(PR.addProfile(base(), 'はな', 'shoubousha', 'p_a_0002', T).state.profiles[1].icon, 'kyukyu');
  assert.equal(PR.addProfile(base(), 'はな', 'dump', 'p_a_0002', T).state.profiles[1].icon, 'dump');
});

test('removeProfile: 最後の 1 人は消せない。lastProfileId の子を消すと先頭へ', () => {
  const one = base();
  const r = PR.removeProfile(one, 'p_a_0001');
  assert.equal(r.ok, false); assert.equal(r.reason, 'last'); assert.equal(r.state.profiles.length, 1);
  let st = PR.selectProfile(four(), 'p_a_0003');
  const r2 = PR.removeProfile(st, 'p_a_0003');
  assert.equal(r2.ok, true); assert.equal(r2.state.profiles.length, 3); assert.equal(r2.state.device.lastProfileId, 'p_a_0001');
  const r3 = PR.removeProfile(st, 'p_a_0002');
  assert.equal(r3.state.device.lastProfileId, 'p_a_0003');
  assert.equal(PR.removeProfile(st, 'p_none').reason, 'none');
});

test('renameProfile: 空は empty、漢字は chars', () => {
  const st = base();
  assert.equal(PR.renameProfile(st, 'p_a_0001', '  ').reason, 'empty');
  assert.equal(PR.renameProfile(st, 'p_a_0001', '太郎').reason, 'chars');
  assert.equal(PR.renameProfile(st, 'p_a_0001', 'はな').state.profiles[0].name, 'はな');
  assert.equal(PR.renameProfile(st, 'p_zz', 'はな').reason, 'none');
});

test('1 人の記録が他に漏れない（中身は新しいコピー）', () => {
  let st = PR.addProfile(base(), 'はな', undefined, 'p_a_0002', T).state;
  const [a, b] = st.profiles;
  assert.deepEqual(b.levels, S.defaultProgress().levels);
  assert.notEqual(a.levels, b.levels); assert.notEqual(a.cards, b.cards); assert.notEqual(a.stats, b.stats); assert.notEqual(a.seen, b.seen);
  a.levels.math = 'M5'; a.cards.dump = 3; a.stats.math.sessions = 9; a.seen.letter.push('bus');
  assert.equal(b.levels.math, 'M1'); assert.deepEqual(b.cards, {}); assert.equal(b.stats.math.sessions, 0); assert.deepEqual(b.seen.letter, []);
  // 追加・選択のあと、元の state の子も共有されない
  const st2 = PR.selectProfile(st, 'p_a_0002');
  st2.profiles[0].cards.dump = 1;
  assert.equal(st.profiles[0].cards.dump, 3);
  // defaultProgress は毎回新しい
  assert.notEqual(S.defaultProgress().cards, S.defaultProgress().cards);
});

test('元の state を書き換えない', () => {
  const st = four();
  const before = JSON.stringify(st);
  PR.addProfile(base(), 'はな', 'dump', 'p_b_0002', T); PR.renameProfile(st, 'p_a_0001', 'あ'); PR.setIcon(st, 'p_a_0001', 'forklift');
  PR.removeProfile(st, 'p_a_0002'); PR.selectProfile(st, 'p_a_0004'); PR.orderForPicker(st); PR.freeIcon(st);
  assert.equal(JSON.stringify(st), before);
});

test('selectProfile / currentProfile / orderForPicker', () => {
  let st = four();
  assert.equal(PR.currentProfile(st).id, 'p_a_0001');
  st = PR.selectProfile(st, 'p_a_0003');
  assert.equal(PR.currentProfile(st).id, 'p_a_0003');
  assert.equal(PR.currentProfile(st), st.profiles[2], 'state の要素そのもの');
  assert.deepEqual(PR.orderForPicker(st).map(p => p.id), ['p_a_0003', 'p_a_0001', 'p_a_0002', 'p_a_0004']);
  assert.equal(PR.selectProfile(st, 'p_none'), st);
  const odd = JSON.parse(JSON.stringify(st)); odd.device.lastProfileId = 'p_none';
  assert.equal(PR.currentProfile(odd).id, 'p_a_0001');
});

test('normalizeName', () => {
  const n = PR.normalizeName;
  assert.deepEqual(n('たろう'), { ok: true, name: 'たろう' });
  assert.deepEqual(n('タロウ'), { ok: true, name: 'たろう' });
  assert.deepEqual(n(' はな '), { ok: true, name: 'はな' });
  assert.deepEqual(n('ゆーき'), { ok: true, name: 'ゆーき' });
  assert.deepEqual(n('きょう'), { ok: true, name: 'きょう' });
  assert.deepEqual(n('ろくもじです'), { ok: true, name: 'ろくもじです' });
  for (const bad of ['太郎', 'taro', 'たろう1', 'た ろう']) assert.deepEqual(n(bad), { ok: false, reason: 'chars' }, bad);
  assert.deepEqual(n('ななななななな'), { ok: false, reason: 'long' });
  assert.deepEqual(n(''), { ok: false, reason: 'empty' });
  assert.deepEqual(n('   '), { ok: false, reason: 'empty' });
  assert.deepEqual(n(null), { ok: false, reason: 'empty' });
});
