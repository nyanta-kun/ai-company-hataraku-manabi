const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/storage.js');
const PR = require('../src/profiles.js');

const ID = 'p_aaa_0001', ID2 = 'p_aaa_0002', TODAY = '2026-10-25';

// localStorage を差し替えて実行する
function withStorage(init, fn) {
  const mem = Object.assign({}, init);
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } },
    configurable: true, writable: true
  });
  try { return fn(mem); } finally { if (orig) Object.defineProperty(globalThis, 'localStorage', orig); else delete globalThis.localStorage; }
}

// ---- normalizeProfile（旧 normalize の検査） ----
test('壊れたデータや欠損はデフォルトで埋まる', () => {
  assert.deepEqual(S.normalizeProfile(null), S.defaultProgress());
  assert.deepEqual(S.normalizeProfile('x'), S.defaultProgress());
  const d = S.normalizeProfile({ levels: { math: 'M99', letter: 'K2' }, cards: { shoubousha: 9, foo: 1, dump: -1 }, stats: { sessions: 'a' } });
  assert.equal(d.levels.math, 'M1');
  assert.equal(d.levels.letter, 'K2');
  assert.deepEqual(d.cards, { shoubousha: 3 });
  assert.equal(d.stats.sessions, 0);
});

test('旧データ（clock なし）は T1・固定なし・stats 0 で補完され、既存の項目は保たれる', () => {
  const old = { version: 1, levels: { math: 'M3', letter: 'K2' }, locked: { math: true, letter: false },
    cards: { dump: 2 }, stats: { sessions: 5, math: { sessions: 3, questions: 12, firstTry: 8 }, letter: { sessions: 2, questions: 8, firstTry: 5 } } };
  const d = S.normalizeProfile(old);
  assert.equal(d.levels.clock, 'T1');
  assert.equal(d.locked.clock, false);
  assert.deepEqual(d.stats.clock, { sessions: 0, questions: 0, firstTry: 0 });
  assert.equal(d.levels.math, 'M3'); assert.equal(d.locked.math, true); assert.equal(d.cards.dump, 2);
  assert.deepEqual(d.stats.math, { sessions: 3, questions: 12, firstTry: 8 });
  assert.equal(d.stats.sessions, 5);
});

test('clock の不正値（レベル・負数・文字列）は戻る', () => {
  const d = S.normalizeProfile({ levels: { clock: 'T9' }, locked: { clock: 'yes' }, stats: { clock: { sessions: -1, questions: 'a', firstTry: 2.7 } } });
  assert.equal(d.levels.clock, 'T1');
  assert.equal(d.locked.clock, false);
  assert.deepEqual(d.stats.clock, { sessions: 0, questions: 0, firstTry: 2 });
  assert.equal(S.normalizeProfile({ levels: { clock: 'T3' }, locked: { clock: true } }).levels.clock, 'T3');
  ['T4', 'T5', 'T6'].forEach(t => assert.equal(S.normalizeProfile({ levels: { clock: t } }).levels.clock, t));
  assert.equal(S.normalizeProfile({ levels: { clock: 'T7' } }).levels.clock, 'T1');
});

test('seen.letter: 旧データは空配列。配列でない値・文字列以外・未知の絵・重複・13個以上も正規化される', () => {
  assert.deepEqual(S.normalizeProfile({ levels: { math: 'M3' } }).seen, { letter: [] });
  assert.deepEqual(S.normalizeProfile(null).seen, { letter: [] });
  for (const bad of ['v6', 5, {}, null, true]) assert.deepEqual(S.normalizeProfile({ seen: { letter: bad } }).seen.letter, []);
  assert.deepEqual(S.normalizeProfile({ seen: 'x' }).seen, { letter: [] });
  assert.deepEqual(S.normalizeProfile({ seen: { letter: ['v6', 3, null, 'nope', 'airplane', 'v6', {}, 'bus'] } }).seen.letter, ['airplane', 'v6', 'bus']);
  const many = ['v1', 'v2', 'v3', 'v5', 'v6', 'v9', 'v10', 'hose', 'flame', 'airplane', 'train', 'ship', 'bus', 'truck'];
  assert.deepEqual(S.normalizeProfile({ seen: { letter: many } }).seen.letter, many.slice(-12));
  const d = S.normalizeProfile({ seen: { letter: ['v6', 'bus'] } });
  assert.deepEqual(S.normalizeProfile(JSON.parse(JSON.stringify(d))).seen.letter, ['v6', 'bus']);   // 保存して読み直しても同じ
});

test('letter レベル K4〜K6 を保存・読み込みでき、範囲外（K7）は K1 に戻る', () => {
  for (const lv of ['K4', 'K5', 'K6']) assert.equal(S.normalizeProfile({ levels: { letter: lv } }).levels.letter, lv);
  assert.equal(S.normalizeProfile({ levels: { letter: 'K7' } }).levels.letter, 'K1');
  assert.equal(S.normalizeProfile({ levels: { letter: 'K2' }, locked: { letter: true } }).locked.letter, true);
});

test('normalizeProfile: M6・M7 を受け入れ、列に無いレベルは M1 に戻す。未解放のステージのレベルは解放済みの一番上に丸める', () => {
  assert.equal(S.normalizeProfile({ levels: { math: 'M6' } }).levels.math, 'M6');
  assert.equal(S.normalizeProfile({ levels: { math: 'M7' } }).levels.math, 'M7');
  assert.equal(S.normalizeProfile({ levels: { math: 'M99' } }).levels.math, 'M1');
  assert.equal(S.normalizeProfile({ levels: { math: 'M8' } }).levels.math, 'M7');   // S1 は未解放
  assert.equal(S.normalizeProfile({ levels: { math: 'M8' }, stage: { unlocked: 'S1', current: 'S1' } }).levels.math, 'M8');
  assert.equal(S.normalizeProfile({ levels: { math: 'M10' }, stage: { unlocked: 'S1' } }).levels.math, 'M10');
});

// ---- normalize（v2） ----
test('normalize: null・文字列・数・配列は既定（こども1 が 1 人）', () => {
  for (const bad of [null, 'x', 5, [], undefined, true]) {
    const d = S.normalize(bad, ID, TODAY);
    assert.deepEqual(d, S.defaults(ID, TODAY));
    assert.equal(d.version, 2);
    assert.equal(d.profiles.length, 1);
    assert.equal(d.profiles[0].name, 'こども1');
    assert.equal(d.device.lastProfileId, ID);
    assert.deepEqual(d.device.sound, { sfx: true, voice: true });
  }
  // id・today を省略しても形は正しい
  const f = S.normalize(null);
  assert.match(f.profiles[0].id, /^p_[0-9a-z_]{1,24}$/);
  assert.match(f.profiles[0].created, /^\d{4}-\d{2}-\d{2}$/);
});

function prof(id, extra) { return Object.assign(S.defaultProfile(id, 'はな', 'kyukyu', TODAY), extra || {}); }

test('normalize: 5 人目以降は捨てる。id 重複は先のもの、id 不正は捨てる、0 人なら既定', () => {
  const five = [1, 2, 3, 4, 5].map(i => prof('p_x_000' + i, { name: 'こ' + i }));
  assert.equal(S.normalize({ profiles: five }, ID, TODAY).profiles.length, 4);
  const dup = S.normalize({ profiles: [prof('p_x_0001', { name: 'まえ' }), prof('p_x_0001', { name: 'あと' })] }, ID, TODAY);
  assert.equal(dup.profiles.length, 1); assert.equal(dup.profiles[0].name, 'まえ');
  const bad = S.normalize({ profiles: [prof('x1'), prof('p_'), prof('P_ABC'), prof(5), null, 'a'] }, ID, TODAY);
  assert.deepEqual(bad, S.defaults(ID, TODAY));   // 全部捨てて既定の 1 人
  assert.deepEqual(S.normalize({ profiles: 'x' }, ID, TODAY), S.defaults(ID, TODAY));
  assert.deepEqual(S.normalize({ profiles: [] }, ID, TODAY), S.defaults(ID, TODAY));
});

test('normalize: 名前・アイコン・日付の不正値は既定。lastProfileId が無い id なら先頭', () => {
  const d = S.normalize({
    device: { lastProfileId: 'p_nope_1' },
    profiles: [prof('p_x_0001', { name: '太郎', icon: 'ufo', created: 'きのう' }), prof('p_x_0002', { name: 'ななななななな', icon: 'shoubousha' }), prof('p_x_0003', { name: 5, icon: null })]
  }, ID, TODAY);
  assert.equal(d.device.lastProfileId, 'p_x_0001');
  assert.equal(d.profiles[0].name, 'こども1');
  assert.equal(d.profiles[1].name, 'こども2');
  assert.equal(d.profiles[2].name, 'こども3');
  assert.equal(d.profiles[0].created, '');
  const icons = d.profiles.map(p => p.icon);
  assert.equal(icons[1], 'shoubousha');
  assert.equal(new Set(icons).size, 3);   // 補った絵が他の子と重ならない
  assert.ok(icons.every(i => S.ICON_ORDER.includes(i)));
  assert.equal(S.normalize({ device: { lastProfileId: 'p_x_0002' }, profiles: [prof('p_x_0001'), prof('p_x_0002')] }, ID, TODAY).device.lastProfileId, 'p_x_0002');
});

test('normalize: device.sound は bool だけ採る。保存して読み直しても同じ', () => {
  const d = S.normalize({ device: { sound: { sfx: false, voice: 'x' } } }, ID, TODAY);
  assert.deepEqual(d.device.sound, { sfx: false, voice: true });
  const st = S.normalize({ device: { sound: { sfx: false, voice: false }, migratedV1: TODAY }, profiles: [prof(ID, { cards: { dump: 2 } })] }, ID, TODAY);
  assert.deepEqual(S.normalize(JSON.parse(JSON.stringify(st)), 'p_zz_1', '2000-01-01'), st);
});

test('newId: 形式を満たし、端末・時刻が違えば別の値', () => {
  const a = S.newId(1761350000000, () => 0.5), b = S.newId(1761350000001, () => 0.5), c = S.newId(1761350000000, () => 0.25);
  for (const v of [a, b, c]) assert.match(v, /^p_[0-9a-z_]{1,24}$/);
  assert.equal(new Set([a, b, c]).size, 3);
});

// ---- migrateV1 ----
const V1_SAMPLES = {
  '最初期（math・letter だけ）': { version: 1, sound: { sfx: true, voice: true }, levels: { math: 'M2', letter: 'K1' }, locked: { math: false, letter: false }, cards: { shoubousha: 1 },
    stats: { sessions: 2, math: { sessions: 1, questions: 5, firstTry: 3 }, letter: { sessions: 1, questions: 5, firstTry: 4 } }, lastPlayed: '2026-05-01' },
  'とけい追加後（clock あり・seen なし）': { version: 1, sound: { sfx: false, voice: true }, levels: { math: 'M3', letter: 'K2', clock: 'T2' }, locked: { math: true, letter: false, clock: true },
    cards: { dump: 2, kyukyu: 1 }, stats: { sessions: 5, math: { sessions: 3, questions: 12, firstTry: 8 }, letter: { sessions: 2, questions: 8, firstTry: 5 }, clock: { sessions: 1, questions: 4, firstTry: 2 } }, lastPlayed: '2026-08-10' },
  '現行（english・seen.letter・M7/T6/K6）': { version: 1, sound: { sfx: true, voice: false }, levels: { math: 'M7', letter: 'K6', clock: 'T6', english: 'E3' }, locked: { math: false, letter: false, clock: false, english: true },
    cards: { shoubousha: 3, hashigo: 2, nekoguruma: 1 }, stats: { sessions: 40, math: { sessions: 12, questions: 60, firstTry: 50 }, letter: { sessions: 10, questions: 50, firstTry: 41 }, clock: { sessions: 9, questions: 45, firstTry: 33 }, english: { sessions: 9, questions: 45, firstTry: 40 } },
    seen: { letter: ['v6', 'bus'] }, lastPlayed: '2026-10-24' },
  '全車★3・全 locked・音すべて off': { version: 1, sound: { sfx: false, voice: false }, levels: { math: 'M5', letter: 'K4', clock: 'T3', english: 'E2' }, locked: { math: true, letter: true, clock: true, english: true },
    cards: { nekoguruma: 3, forklift: 3, gomi: 3, shovel: 3, bulldozer: 3, dump: 3, kyukyu: 3, shoubousha: 3, mizutank: 3, hashigo: 3, chodai: 3 }, stats: { sessions: 99, math: { sessions: 30, questions: 150, firstTry: 140 } }, seen: { letter: [] }, lastPlayed: '2026-10-01' },
  '壊れた値まじり': { version: 1, sound: { sfx: 1, voice: 'x' }, levels: { math: 'M9', letter: 'K3' }, locked: { clock: 'yes' }, cards: { foo: 2, dump: 7, gomi: -1 },
    stats: { sessions: -4, math: { sessions: 'a', questions: 3.9, firstTry: 2 } }, seen: { letter: ['nope', 'bus', 'bus'] }, lastPlayed: 12345 }
};

test('migrateV1: v1 のサンプルがレベル・カード・統計・直近の絵ごと「こども1」に入る', () => {
  for (const [name, v1] of Object.entries(V1_SAMPLES)) {
    const m = S.migrateV1(JSON.parse(JSON.stringify(v1)), ID, TODAY), p = m.profiles[0], exp = S.normalizeProfile(v1);
    assert.equal(m.version, 2, name);
    assert.equal(m.profiles.length, 1, name);
    for (const k of ['levels', 'locked', 'cards', 'stats', 'seen', 'lastPlayed']) assert.deepEqual(p[k], exp[k], name + ':' + k);
    assert.equal(p.name, 'こども1', name); assert.equal(p.id, ID, name); assert.equal(p.icon, 'shoubousha', name); assert.equal(p.created, TODAY, name);
    assert.deepEqual(m.device.sound, { sfx: typeof v1.sound.sfx === 'boolean' ? v1.sound.sfx : true, voice: typeof v1.sound.voice === 'boolean' ? v1.sound.voice : true }, name);
    assert.equal(m.device.migratedV1, TODAY, name); assert.equal(m.device.lastProfileId, ID, name);
    assert.deepEqual(S.normalize(m, 'p_zz', '2000-01-01'), m, name);   // v2 として正しい形
  }
  // 個別の確認
  const cur = S.migrateV1(V1_SAMPLES['現行（english・seen.letter・M7/T6/K6）'], ID, TODAY).profiles[0];
  assert.equal(cur.levels.math, 'M7'); assert.equal(cur.levels.clock, 'T6'); assert.equal(cur.levels.letter, 'K6'); assert.equal(cur.stats.sessions, 40);
  assert.deepEqual(cur.seen.letter, ['v6', 'bus']);
  const all = S.migrateV1(V1_SAMPLES['全車★3・全 locked・音すべて off'], ID, TODAY);
  assert.equal(Object.keys(all.profiles[0].cards).length, 11);
  assert.deepEqual(all.device.sound, { sfx: false, voice: false });
  assert.deepEqual(S.migrateV1(null, ID, TODAY).profiles[0].levels, S.defaultProgress().levels);
});

// ---- load / save ----
const V1_TEXT = JSON.stringify(V1_SAMPLES['現行（english・seen.letter・M7/T6/K6）']);
const V2_TEXT = () => JSON.stringify(S.normalize({ profiles: [prof('p_v2_0001', { name: 'たろう', cards: { dump: 1 } })] }, ID, TODAY));

test('load: v2 あり・v1 あり → v2 が使われ、v1 は消えない', () => {
  withStorage({ [S.KEY]: V2_TEXT(), [S.KEY_V1]: V1_TEXT }, mem => {
    const st = S.load();
    assert.equal(st.profiles.length, 1); assert.equal(st.profiles[0].name, 'たろう');
    assert.equal(mem[S.KEY_V1], V1_TEXT);
    assert.equal(S.isPersistent(), true);
  });
});

test('load: v2 なし・v1 あり → 取り込んで v2 を書く。v1 は元のまま。再度 load しても 2 人にならない', () => {
  withStorage({ [S.KEY_V1]: V1_TEXT }, mem => {
    const st = S.load();
    assert.equal(st.profiles.length, 1); assert.equal(st.profiles[0].name, 'こども1');
    assert.equal(st.profiles[0].levels.math, 'M7');
    assert.ok(mem[S.KEY], 'v2 が保存された');
    assert.equal(mem[S.KEY_V1], V1_TEXT);
    assert.ok(!(S.KEY_BROKEN in mem));
    assert.equal(st.device.restoredFromV1, undefined);
    const again = S.load();
    assert.equal(again.profiles.length, 1);
    assert.equal(again.profiles[0].id, st.profiles[0].id);
  });
});

test('load: v2 が壊れた文字列・v1 あり → 退避して v1 から取り込む（復旧の印つき）', () => {
  withStorage({ [S.KEY]: '{oops', [S.KEY_V1]: V1_TEXT }, mem => {
    const st = S.load();
    assert.equal(mem[S.KEY_BROKEN], '{oops');
    assert.equal(st.profiles[0].levels.math, 'M7');
    assert.equal(st.device.restoredFromV1, true);
    assert.equal(mem[S.KEY_V1], V1_TEXT);
    assert.equal(JSON.parse(mem[S.KEY]).profiles.length, 1);
  });
});

test('load: v2 も v1 も壊れている → 既定。例外なし。v2 が object でない JSON も壊れ扱い', () => {
  withStorage({ [S.KEY]: '{oops', [S.KEY_V1]: 'zzz' }, mem => {
    let st; assert.doesNotThrow(() => { st = S.load(); });
    assert.equal(st.profiles.length, 1); assert.equal(st.profiles[0].name, 'こども1');
    assert.equal(mem[S.KEY_BROKEN], '{oops');
  });
  withStorage({ [S.KEY]: 'null' }, () => { assert.equal(S.load().profiles.length, 1); });
  withStorage({}, mem => { assert.equal(S.load().profiles.length, 1); assert.ok(!(S.KEY in mem), '新規端末は最初の save まで書かない'); });
});

test('save → load で往復できる。clear は v1・v2・退避をすべて消し、次の load で v1 が戻らない', () => {
  withStorage({ [S.KEY_V1]: V1_TEXT, [S.KEY_BROKEN]: 'x' }, mem => {
    const st = S.load(); st.profiles[0].cards.dump = 3; S.save(st);
    assert.equal(S.load().profiles[0].cards.dump, 3);
    S.clear();
    assert.deepEqual(Object.keys(mem), []);
    const f = S.load();
    assert.equal(f.profiles[0].levels.math, 'M1'); assert.equal(f.device.migratedV1, '');
    const fr = S.fresh();
    assert.equal(fr.profiles.length, 1); assert.equal(fr.profiles[0].name, 'こども1');
  });
});

test('localStorage が無い／例外でもクラッシュせず isPersistent が false。操作はできる', () => {
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
    let st; assert.doesNotThrow(() => { st = S.load(); S.save(st); S.clear(); });
    assert.equal(S.isPersistent(), false);
    assert.equal(st.profiles.length, 1);
    Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('denied'); }, configurable: true });
    assert.doesNotThrow(() => { S.load(); S.save(S.fresh()); S.clear(); });
    assert.equal(S.isPersistent(), false);
    // setItem だけ失敗（容量・プライベートブラウズ）
    Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem() { throw new Error('quota'); }, removeItem() {} }, configurable: true, writable: true });
    assert.doesNotThrow(() => { S.save(S.load()); });
    assert.equal(S.isPersistent(), false);
  } finally {
    if (orig) Object.defineProperty(globalThis, 'localStorage', orig); else delete globalThis.localStorage;
  }
});

test('normalize: lastProfileId が constructor 等の継承名でも先頭になる', () => {
  for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty'])
    assert.equal(S.normalize({ device: { lastProfileId: k }, profiles: [prof('p_x_0001'), prof('p_x_0002')] }, ID, TODAY).device.lastProfileId, 'p_x_0001', k);
});

test('addProfile: 不正な id・today は追加しない', () => {
  const st = S.defaults(ID, TODAY);
  for (const bad of [undefined, '', 'x1', 'P_A', 5]) assert.equal(PR.addProfile(st, 'はな', undefined, bad, TODAY).reason, 'id');
  for (const bad of [undefined, '', '2026/10/25', 5]) assert.equal(PR.addProfile(st, 'はな', undefined, ID2, bad).reason, 'id');
  assert.equal(PR.addProfile(st, 'はな', undefined, S.newId(Date.now(), Math.random), TODAY).ok, true);
});

test('load: v2 が有効なプロフィール 0 人 → 退避して v1 から取り込む（v1 が無ければ既定）', () => {
  const empty = JSON.stringify({ version: 2, device: {}, profiles: [] });
  withStorage({ [S.KEY]: empty, [S.KEY_V1]: V1_TEXT }, mem => {
    const st = S.load();
    assert.equal(mem[S.KEY_BROKEN], empty); assert.equal(st.profiles[0].levels.math, 'M7'); assert.equal(st.device.restoredFromV1, true);
  });
  withStorage({ [S.KEY]: empty }, mem => {
    const st = S.load();
    assert.equal(mem[S.KEY_BROKEN], empty); assert.equal(st.profiles.length, 1); assert.equal(st.profiles[0].levels.math, 'M1');
  });
});

test('load は v2 を書き直さない（読むだけ）', () => {
  const t = V2_TEXT();
  withStorage({ [S.KEY]: t }, mem => { S.load(); assert.equal(mem[S.KEY], t); });
});

test('プロフィール操作 → save → load で往復できる', () => {
  withStorage({}, () => {
    let st = S.load();
    st = PR.addProfile(st, 'はな', undefined, S.newId(Date.now(), Math.random), TODAY).state;
    st = PR.selectProfile(st, st.profiles[1].id);
    PR.currentProfile(st).cards.dump = 2;
    st = PR.renameProfile(st, st.profiles[0].id, 'たろう').state;
    S.save(st);
    const back = S.load();
    assert.deepEqual(back, st);
    assert.equal(PR.currentProfile(back).name, 'はな'); assert.equal(PR.currentProfile(back).cards.dump, 2);
  });
});

test('v1 あり・setItem が例外 → 取り込んだデータを返し v1 は残り isPersistent は false。成功後は true に戻る', () => {
  const mem = { [S.KEY_V1]: V1_TEXT }; let fail = true;
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { if (fail) throw new Error('quota'); mem[k] = String(v); }, removeItem: k => { delete mem[k]; } }, configurable: true, writable: true });
  try {
    const st = S.load();
    assert.equal(st.profiles[0].levels.math, 'M7'); assert.equal(mem[S.KEY_V1], V1_TEXT);
    assert.equal(S.isPersistent(), false); assert.ok(!(S.KEY in mem));
    fail = false; S.save(st);
    assert.equal(S.isPersistent(), true); assert.ok(mem[S.KEY]);
  } finally { if (orig) Object.defineProperty(globalThis, 'localStorage', orig); else delete globalThis.localStorage; }
});

test('自動名「こども1〜4」は読み直しても変わらない（削除後・改名後も）', () => {
  let st = S.defaults('p_a_0001', '2026-10-24');
  st = PR.addProfile(st, '', '', 'p_a_0002', '2026-10-24').state;
  st = PR.addProfile(st, '', '', 'p_a_0003', '2026-10-24').state;
  assert.deepEqual(st.profiles.map(p => p.name), ['こども1', 'こども2', 'こども3']);
  st = PR.removeProfile(st, 'p_a_0002').state;
  let back = S.normalize(JSON.parse(JSON.stringify(st)), 'p_z_0000', '2026-10-24');
  assert.deepEqual(back.profiles.map(p => p.name), ['こども1', 'こども3']);
  st = PR.renameProfile(st, 'p_a_0001', 'たろう').state;
  back = S.normalize(JSON.parse(JSON.stringify(st)), 'p_z_0000', '2026-10-24');
  assert.deepEqual(back.profiles.map(p => p.name), ['たろう', 'こども3']);
});
