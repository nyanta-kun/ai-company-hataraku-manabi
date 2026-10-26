// Firestore ルールの試験（docs/r4-firebase-setup.md 5.3）。エミュレーターが要る:
//   firebase emulators:exec --only firestore --project demo-hataraku "npm --prefix tests-rules test"
'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, deleteDoc, getDocs, collection, serverTimestamp, writeBatch, collectionGroup, query } = require('firebase/firestore');

const ROOT = path.join(__dirname, '..');
const storage = require(path.join(ROOT, 'src/storage.js'));
const strokes = require(path.join(ROOT, 'src/strokes.js'));
const data = require(path.join(ROOT, 'src/data.js'));

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-hataraku',
    firestore: { rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8') }
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const google = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore();
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const famRef = (db, uid) => doc(db, 'families', uid);
const profRef = (db, uid, pid) => doc(db, 'families', uid, 'profiles', pid);
// 1 家族 = 親の文書（v・ids・deleted・updatedAt）＋ プロフィール 1 人 1 文書。d は { v, deleted, updatedAt, profiles: [...] }（ids は無ければ profiles の id から作る）
async function put(uid, d, db) {
  db = db || google(uid);
  const parent = { v: d.v, ids: d.ids !== undefined ? d.ids : d.profiles.map((p) => p.id), deleted: d.deleted, updatedAt: d.updatedAt === '__TS__' ? serverTimestamp() : d.updatedAt };
  Object.keys(d).forEach((k) => { if (!['v', 'ids', 'deleted', 'updatedAt', 'profiles'].includes(k)) parent[k] = d[k]; });
  Object.keys(parent).forEach((k) => { if (parent[k] === undefined) delete parent[k]; });   // 項目を欠く試験（delete d.xxx）
  await setDoc(famRef(db, uid), parent);
  for (const p of d.profiles) await setDoc(profRef(db, uid, p.id), p);
}

// ---- 端末の v2 → クラウドの形（cloud.js が作る形。4 章） ----
const NOW = 1793000000000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function toCloudProfile(p) {
  const o = JSON.parse(JSON.stringify(p));
  delete o.seen;
  if (!DATE_RE.test(o.lastPlayed)) o.lastPlayed = '';
  o.updatedAt = NOW; o.ladderAt = NOW;
  return o;
}
function toCloud(state, deleted) {
  return { v: 1, deleted: deleted || {}, updatedAt: '__TS__', profiles: state.profiles.map(toCloudProfile) };
}
const clone = (x) => JSON.parse(JSON.stringify(x));
// 正しい 2 人の文書（plain データ。updatedAt は呼ぶ側で serverTimestamp にする）
function basic() {
  const st = storage.normalize({
    profiles: [
      { id: 'p_abc_0001', name: 'たろう', icon: 'shoubousha', created: '2026-10-01', stats: { sessions: 3 } },
      { id: 'p_abc_0002', name: 'こども2', icon: 'kyukyu', created: '2026-10-02' }
    ]
  });
  return toCloud(st);
}
const withTs = (d) => clone(d);
const mutate = (fn) => { const d = basic(); fn(d); return withTs(d); };

test('1 ログインなしで読む・書く: 拒否', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(famRef(db, 'A')));
  await assertFails(put('A', basic(), db));
});
test('1b Google 以外のログイン（匿名）は自分の文書でも拒否', async () => {
  await assertFails(getDoc(famRef(anon('A'), 'A')));
  await assertFails(put('A', basic(), anon('A')));
});
test('2 uid A で families/B を読む・書く・消す: 拒否', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(famRef(ctx.firestore(), 'B'), { v: 1 }); });
  const a = google('A');
  await assertFails(getDoc(famRef(a, 'B')));
  await assertFails(put('B', basic(), a));
  await assertFails(setDoc(profRef(a, 'B', 'p_abc_0001'), basic().profiles[0]));
  await assertFails(getDoc(profRef(a, 'B', 'p_abc_0001')));
  await assertFails(getDocs(collection(a, 'families', 'B', 'profiles')));
  await assertFails(deleteDoc(famRef(a, 'B')));
});
test('3 uid A で families/A に 4 章の形（2 人）を書く・読む: 許可', async () => {
  await assertSucceeds(put('A', withTs(basic())));
  const s = await assertSucceeds(getDoc(famRef(google('A'), 'A')));
  assert.deepEqual(s.data().ids, ['p_abc_0001', 'p_abc_0002']);
  const l = await assertSucceeds(getDocs(collection(google('A'), 'families', 'A', 'profiles')));   // 自分の profiles の一覧は許可
  assert.equal(l.size, 2);
  await assertSucceeds(getDoc(profRef(google('A'), 'A', 'p_abc_0002')));
});
test('3b 上書き（update）も許可', async () => {
  await assertSucceeds(put('A', withTs(basic())));
  await assertSucceeds(put('A', mutate((d) => { d.profiles[0].stats.sessions = 9; })));
});
test('4 email などの項目を足す: 拒否（文書・プロフィール・各表）', async () => {
  await assertFails(put('A', mutate((d) => { d.email = 'a@example.com'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].email = 'a@example.com'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].stats.extra = 1; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].levels.extra = 'M1'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].trace.extra = 1; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].seen = { letter: [] }; })));
  await assertFails(put('A', mutate((d) => { d.device = {}; })));
});
test('4b 項目を欠く: 拒否', async () => {
  await assertFails(put('A', mutate((d) => { delete d.deleted; })));
  await assertFails(put('A', mutate((d) => { delete d.profiles[0].ladderAt; })));
  await assertFails(put('A', mutate((d) => { delete d.profiles[0].stage; })));
  await assertFails(put('A', mutate((d) => { delete d.profiles[0].levels.clock; })));
});
test('5 プロフィール 4 人は許可、5 人は拒否', async () => {
  const four = mutate((d) => { for (let i = 3; i <= 4; i++) { const p = clone(d.profiles[1]); p.id = 'p_abc_000' + i; p.name = 'こども' + i; d.profiles.push(p); } });
  assert.equal(four.profiles.length, 4);
  await assertSucceeds(put('A', four));
  const five = clone(four); const p = clone(five.profiles[3]); p.id = 'p_abc_0005'; five.profiles.push(p);
  await assertFails(put('A', five));
});
test('5b プロフィール 0 人は許可（空の ids）、4 人目の中身が壊れていれば拒否', async () => {
  await assertSucceeds(put('A', mutate((d) => { d.profiles = []; })));
  const bad = mutate((d) => { for (let i = 3; i <= 4; i++) { const p = clone(d.profiles[1]); p.id = 'p_abc_000' + i; p.name = 'こども' + i; d.profiles.push(p); } d.profiles[3].icon = 'ufo'; });
  await assertFails(put('A', bad));
});
test('6 name: 7 文字・漢字・英字・空は拒否。ひらがな 6 文字・長音・こども1〜4 は許可', async () => {
  for (const bad of ['あいうえおかき', '太郎', 'taro', '', 'こども5', 'こども0', 'こども12', 'タロウ', 'あ い'])
    await assertFails(put('A', mutate((d) => { d.profiles[0].name = bad; })), 'name=' + bad);
  for (const ok of ['あいうえおか', 'らーめん', 'こども1', 'こども4', 'あ'])
    await assertSucceeds(put('A', mutate((d) => { d.profiles[0].name = ok; })), 'name=' + ok);
});
test('6b id・icon・created・lastPlayed の形', async () => {
  await assertFails(put('A', mutate((d) => { d.profiles[0].id = 'x_abc'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].id = 'p_' + 'a'.repeat(25); })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].id = 'p_ABC'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].icon = 'ufo'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].created = '2026/10/01'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].lastPlayed = '2026-10-01T00:00'; })));
  await assertSucceeds(put('A', mutate((d) => { d.profiles[0].lastPlayed = '2026-10-25'; d.profiles[0].created = ''; })));
});
test('7 cards: 4 や \'3\'・0・知らない車は拒否。1〜3 は許可', async () => {
  for (const bad of [4, '3', 0, 1.5, true, null])
    await assertFails(put('A', mutate((d) => { d.profiles[0].cards.shoubousha = bad; })), 'cards=' + bad);
  await assertFails(put('A', mutate((d) => { d.profiles[0].cards.ufo = 1; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].cards = { 'gomi,dump': 1 }; })));   // 「,」を含むキー 1 つが 2 つに見える抜け
  await assertSucceeds(put('A', mutate((d) => { d.profiles[0].cards = { shoubousha: 3, rescueheli: 1 }; })));
  await assertSucceeds(put('A', mutate((d) => { d.profiles[0].cards = { train: 1, fireboat: 3, cargoship: 2 }; })));   // 棚の乗り物
  await assertFails(put('A', mutate((d) => { d.profiles[0].cards = { train: 1, 'fire,boat': 3 }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].cards = { train: 4 }; })));
  // 件数の上限は 47（48 個目の知らない id は拒否。47 種ぜんぶは許可）
  await assertSucceeds(put('A', mutate((d) => { d.profiles[0].cards = Object.fromEntries(storage.CAR_IDS.map((k) => [k, 1])); })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].cards = Object.assign(Object.fromEntries(storage.CAR_IDS.map((k) => [k, 1])), { ufo: 1 }); })));
});
test('7b levels・locked・stage の形', async () => {
  await assertFails(put('A', mutate((d) => { d.profiles[0].levels.math = 'K1'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].levels.math = 'M123'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].locked.math = 'yes'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].stage.current = 'S9'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].stage.current = 'S0 '; })));
  await assertSucceeds(put('A', mutate((d) => { d.profiles[0].locked.math = true; d.profiles[0].levels.math = 'M13'; d.profiles[0].stage = { unlocked: 'S3', current: 'S2' }; })));
});
test('8 stats: -1・1.5・文字・欠けは拒否', async () => {
  for (const bad of [-1, 1.5, null, true, 1e13])
    await assertFails(put('A', mutate((d) => { d.profiles[0].stats.math.questions = bad; })), 'q=' + bad);
  await assertFails(put('A', mutate((d) => { d.profiles[0].stats.sessions = -1; })));
  await assertFails(put('A', mutate((d) => { delete d.profiles[0].stats.math.firstTry; })));
  await assertFails(put('A', mutate((d) => { delete d.profiles[0].stats.letter; })));
});
test('8b-1 stats.trace の項目を欠く・負・小数は拒否', async () => {
  await assertFails(put('A', mutate((d) => { delete d.profiles[0].stats.trace; })));
  for (const k of ['sessions', 'chars', 'clean']) {
    await assertFails(put('A', mutate((d) => { delete d.profiles[0].stats.trace[k]; })), 'del ' + k);
    await assertFails(put('A', mutate((d) => { d.profiles[0].stats.trace[k] = -1; })), 'neg ' + k);
    await assertFails(put('A', mutate((d) => { d.profiles[0].stats.trace[k] = 0.5; })), 'frac ' + k);
  }
  await assertFails(put('A', mutate((d) => { d.profiles[0].stats.trace.extra = 1; })));
});
for (const key of ['done', 'help', 'solo']) {
  test(`8b-2 trace.${key}: 知らない字・0・100・小数・文字・複数字は拒否。1・99・漢字・カタカナは許可`, async () => {
    const m = (ch, v) => mutate((d) => { const t = d.profiles[0].trace; t.done = { し: 5, 山: 5, ノ: 5, ぬ: 5 }; t[key] = {}; t[key][ch] = v; });
    for (const [ch, v] of [['x', 1], ['A', 1], ['し', 0], ['し', 100], ['し', -1], ['し', 1.5], ['しつ', 1], ['鬱', 1], ['し,つ', 1], ['し;つ', 1]])
      await assertFails(put('A', m(ch, v)), `${key} ${ch}=${v}`);
    for (const [ch, v] of [['し', 1], ['山', 99], ['ノ', 5], ['ぬ', 5]]) {
      await assertSucceeds(put('A', m(ch, v)), `${key} ${ch}=${v}`);
    }
  });
}
test('8b-3 trace.help・trace.solo を欠く・知らない set/width は拒否', async () => {
  await assertFails(put('A', mutate((d) => { delete d.profiles[0].trace.help; })));
  await assertFails(put('A', mutate((d) => { delete d.profiles[0].trace.solo; })));
  await assertFails(put('A', mutate((d) => { delete d.profiles[0].trace.done; })));
  await assertFails(put('A', mutate((d) => { delete d.profiles[0].trace.set; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].trace.set = 'k3'; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].trace.width = 'huge'; })));
  for (const s of ['auto', 'hira', 'kata', 'k1', 'k2']) for (const w of ['auto', 'wide', 'normal'])
    await assertSucceeds(put('A', mutate((d) => { d.profiles[0].trace.set = s; d.profiles[0].trace.width = w; })), s + w);
});
test('8b-4 help・solo の字は done にある字だけ（help ≤ done の字の集まりの部分）', async () => {
  await assertFails(put('A', mutate((d) => { d.profiles[0].trace.done = { し: 2 }; d.profiles[0].trace.help = { ぬ: 1 }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].trace.done = { し: 2 }; d.profiles[0].trace.solo = { ぬ: 1 }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].trace.done = {}; d.profiles[0].trace.solo = { し: 1 }; })));
  await assertSucceeds(put('A', mutate((d) => { d.profiles[0].trace.done = { し: 2, ぬ: 3 }; d.profiles[0].trace.help = { ぬ: 2 }; d.profiles[0].trace.solo = { し: 1 }; })));
});
test('8b-5 help > done の回数は、ルールでは確かめない（端末の normalizeTrace が守る）ことの記録', async () => {
  const r = put('A', mutate((d) => { d.profiles[0].trace.done = { し: 1 }; d.profiles[0].trace.help = { し: 5 }; }));
  await assertSucceeds(r);   // 将来ルールで確かめるようにしたら assertFails に変える
});
test('8b-6 端末の normalizeTrace は help・solo を done まで下げ、done に無い字を捨てる（ルールに合う形になる）', async () => {
  const st = storage.normalize({ profiles: [{ id: 'p_x_1', trace: { done: { し: 1 }, help: { し: 5, ぬ: 2 }, solo: { し: 9, ぬ: 1 } } }] });
  const t = st.profiles[0].trace;
  assert.deepEqual(t.done, { し: 1 }); assert.deepEqual(t.help, { し: 1 }); assert.deepEqual(t.solo, { し: 1 });
  await assertSucceeds(put('A', toCloud(st)));
});
test('9 updatedAt を端末の時刻・固定値・欠けにする: 拒否', async () => {
  await assertFails(put('A', Object.assign(basic(), { updatedAt: new Date() })));
  await assertFails(put('A', Object.assign(basic(), { updatedAt: Date.now() })));
  await assertFails(put('A', Object.assign(basic(), { updatedAt: new Date('2000-01-01') })));
});
test('9b プロフィールの updatedAt・ladderAt は整数のミリ秒（負・小数・文字・2100 年超は拒否）', async () => {
  for (const f of ['updatedAt', 'ladderAt']) {
    for (const bad of [-1, 1.5, '1793000000000', 4102444800001, null])
      await assertFails(put('A', mutate((d) => { d.profiles[0][f] = bad; })), f + '=' + bad);
    await assertSucceeds(put('A', mutate((d) => { d.profiles[0][f] = 0; })));
    await assertSucceeds(put('A', mutate((d) => { d.profiles[0][f] = 4102444800000; })));
  }
});
test('9c v は 1 だけ', async () => {
  await assertFails(put('A', mutate((d) => { d.v = 2; })));
  await assertFails(put('A', mutate((d) => { d.v = '1'; })));
});
test('10 deleted: 16 件は許可、17 件・日付でない値・キーの形が違うものは拒否', async () => {
  const mk = (n) => { const o = {}; for (let i = 0; i < n; i++) o['p_del_' + i.toString(36).padStart(3, '0')] = '2026-10-0' + (1 + (i % 9)); return o; };
  await assertSucceeds(put('A', mutate((d) => { d.deleted = mk(16); })));
  await assertFails(put('A', mutate((d) => { d.deleted = mk(17); })));
  await assertFails(put('A', mutate((d) => { d.deleted = { p_abc: 'yesterday' }; })));
  await assertFails(put('A', mutate((d) => { d.deleted = { abc: '2026-10-01' }; })));
  await assertFails(put('A', mutate((d) => { d.deleted = { p_abc: 5 }; })));
  await assertFails(put('A', mutate((d) => { d.deleted = { 'p_abc,p_def': '2026-10-01' }; })));
  await assertFails(put('A', mutate((d) => { d.deleted = 'x'; })));
  await assertSucceeds(put('A', mutate((d) => { d.deleted = { p_abc_0003: '2026-10-01' }; })));
});
test('10b cleared・promoted のキーと値の形・件数', async () => {
  await assertSucceeds(put('A', mutate((d) => { d.profiles[0].cleared = { M7: '2026-10-01', K6: '2026-10-02' }; d.profiles[0].promoted = { S1: '2026-10-03' }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].cleared = { X7: '2026-10-01' }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].cleared = { M7: '' }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].cleared = { M7: 'x' }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].cleared = { 'M7,K6': '2026-10-01' }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].cleared = { 'M7;K6': '2026-10-01' }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].promoted = { S0: '2026-10-03' }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].promoted = { S1: 20261003 }; })));
  const many = {}; for (let i = 1; i <= 13; i++) many['M' + i] = '2026-10-01';
  await assertFails(put('A', mutate((d) => { d.profiles[0].cleared = many; })));
});
test('11 uid A で families/A を消す: 許可（文書が無くても。他人のは拒否は 2）', async () => {
  await put('A', withTs(basic()));
  await assertSucceeds(deleteDoc(famRef(google('A'), 'A')));
  const s = await getDoc(famRef(google('A'), 'A'));
  assert.equal(s.exists(), false);
});
test('11b ログインなし・匿名での削除は拒否', async () => {
  await put('A', withTs(basic()));
  await assertFails(deleteDoc(famRef(env.unauthenticatedContext().firestore(), 'A')));
  await assertFails(deleteDoc(famRef(anon('A'), 'A')));
});
test('12 一覧の問い合わせ（families 全体）: 拒否。自分の profiles の一覧は許可、ほかのコレクションは拒否', async () => {
  await put('A', withTs(basic()));
  await assertFails(getDocs(collection(google('A'), 'families')));
  await assertSucceeds(getDocs(collection(google('A'), 'families', 'A', 'profiles')));
  await assertFails(getDoc(doc(google('A'), 'other', 'A')));
  await assertFails(setDoc(doc(google('A'), 'other', 'A'), { a: 1 }));
  await assertFails(setDoc(doc(google('A'), 'families', 'A', 'sub', 'x'), { a: 1 }));
});
test('12b プロフィールの文書: id がパスと違う・id の形が違う・未ログインは拒否', async () => {
  const p = basic().profiles[0];
  await put('A', Object.assign(basic(), { profiles: [] }), undefined);   // 親だけ（ids は空）
  await setDoc(famRef(google('A'), 'A'), { v: 1, ids: [p.id], deleted: {}, updatedAt: serverTimestamp() });
  await assertFails(setDoc(profRef(google('A'), 'A', 'p_abc_9999'), p));
  await assertFails(setDoc(profRef(env.unauthenticatedContext().firestore(), 'A', p.id), p));
  await assertFails(setDoc(profRef(anon('A'), 'A', p.id), p));
  await assertSucceeds(setDoc(profRef(google('A'), 'A', p.id), p));
  await assertSucceeds(deleteDoc(profRef(google('A'), 'A', p.id)));
});
test('12d 一覧: collectionGroup（profiles）は拒否', async () => {
  await put('A', withTs(basic()));
  await assertFails(getDocs(collectionGroup(google('A'), 'profiles')));
  await assertFails(getDocs(query(collectionGroup(google('A'), 'profiles'))));
});
test('10c 値に「,」を入れて大きさの上限を抜けられない（cleared・promoted・deleted・done・help・solo）', async () => {
  const D = '2026-10-01';
  const many = Array(40).fill(D).join(',');
  await assertFails(put('A', mutate((d) => { d.profiles[0].cleared = { M7: D + ',' + D }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].cleared = { M7: many }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].cleared = { M7: many, K6: D }; })));
  await assertFails(put('A', mutate((d) => { d.profiles[0].promoted = { S1: many }; })));
  await assertFails(put('A', mutate((d) => { d.deleted = { p_abc_0003: many }; })));
  await assertFails(put('A', mutate((d) => { d.deleted = { p_abc_0003: D + ',' + D }; })));
  for (const key of ['done', 'help', 'solo']) {
    await assertFails(put('A', mutate((d) => { const t = d.profiles[0].trace; t.done = { し: 5 }; t[key] = { し: '1,2' }; })), key);
    await assertFails(put('A', mutate((d) => { const t = d.profiles[0].trace; t.done = { し: 5 }; t[key] = { し: Array(100).fill('9').join(',') }; })), key);
  }
});
test('12c 親の ids: 4 件は許可、5 件・形が違う・文字でないものは拒否', async () => {
  const idsOf = (n) => Array.from({ length: n }, (_, i) => 'p_abc_000' + i);
  await assertSucceeds(put('A', mutate((d) => { d.ids = idsOf(4); d.profiles = []; })));
  await assertSucceeds(put('A', mutate((d) => { d.ids = []; d.profiles = []; })));
  await assertFails(put('A', mutate((d) => { d.ids = idsOf(5); })));
  await assertFails(put('A', mutate((d) => { d.ids = ['x1']; })));
  await assertFails(put('A', mutate((d) => { d.ids = [1]; })));
  await assertFails(put('A', mutate((d) => { d.ids = 'p_abc_0001'; })));
  await assertFails(put('A', mutate((d) => { d.ids = ['p_abc_0001,p_abc_0002']; })));
  await assertFails(put('A', mutate((d) => { d.ids = ['p_abc_0001;p_abc_0002']; })));
  await assertFails(put('A', mutate((d) => { d.ids = ['']; })));
});

test('14 ids に無い pid のプロフィールは書けない（親が無いとき・ids に無いとき・5 人目）。親→子の順なら書ける', async () => {
  const a = google('A'), p = basic().profiles[0];
  await assertFails(setDoc(profRef(a, 'A', p.id), p));   // 親が無い
  await setDoc(famRef(a, 'A'), { v: 1, ids: [], deleted: {}, updatedAt: serverTimestamp() });
  await assertFails(setDoc(profRef(a, 'A', p.id), p));   // ids に無い
  await setDoc(famRef(a, 'A'), { v: 1, ids: [p.id], deleted: {}, updatedAt: serverTimestamp() });
  await assertSucceeds(setDoc(profRef(a, 'A', p.id), p));   // 親→子
  await assertSucceeds(setDoc(profRef(a, 'A', p.id), p));   // 更新
  const q = Object.assign(clone(p), { id: 'p_abc_0009' });
  await assertFails(setDoc(profRef(a, 'A', q.id), q));
  // 5 人目: ids は 4 件までなので、5 件目を ids に入れられず、プロフィールも書けない
  const ids = ['p_abc_0001', 'p_abc_0002', 'p_abc_0003', 'p_abc_0004'];
  await setDoc(famRef(a, 'A'), { v: 1, ids, deleted: {}, updatedAt: serverTimestamp() });
  await assertFails(setDoc(famRef(a, 'A'), { v: 1, ids: ids.concat('p_abc_0005'), deleted: {}, updatedAt: serverTimestamp() }));
  const five = Object.assign(clone(p), { id: 'p_abc_0005' });
  await assertFails(setDoc(profRef(a, 'A', five.id), five));
});
test('14b 親と子を同じ batch で書いても通る（getAfter）。ほかの人の親の ids は使えない', async () => {
  const a = google('A'), p = basic().profiles[0];
  const b = writeBatch(a);
  b.set(famRef(a, 'A'), { v: 1, ids: [p.id], deleted: {}, updatedAt: serverTimestamp() });
  b.set(profRef(a, 'A', p.id), p);
  await assertSucceeds(b.commit());
  await assertFails(setDoc(profRef(google('B'), 'B', p.id), p));   // B の親は無い
});

// ---- 13 すべての表を上限まで埋めた 4 人 ----
function fullRaw(i) {
  const all = Object.keys(strokes.SETS).map((k) => [...strokes.SETS[k]]).flat();
  const mk = () => { const o = {}; all.forEach((c) => { o[c] = 99; }); return o; };
  const cards = {}; storage.CAR_IDS.forEach((c) => { cards[c] = 3; });   // 47 種すべて ★3
  const cleared = {}; data.gateLevels().forEach((l) => { cleared[l] = '2026-10-01'; });
  const g = { sessions: 999, questions: 9999, firstTry: 9999 };
  return {
    id: 'p_' + 'z'.repeat(22) + '_' + i, name: 'あいうえおか', icon: 'chodai', created: '2026-10-01',
    levels: { math: 'M13', letter: 'K9', clock: 'T8', english: 'E5' }, locked: { math: true, letter: true, clock: true, english: true },
    cards, stats: { sessions: 99999, math: g, letter: g, clock: g, english: g, trace: { sessions: 999, chars: 99999, clean: 99999 } },
    trace: { done: mk(), help: mk(), solo: mk(), set: 'kata', width: 'wide' },
    lastPlayed: '2026-10-25', stage: { unlocked: 'S2', current: 'S2' }, cleared, promoted: { S1: '2026-10-02', S2: '2026-10-03' }
  };
}
test('13 4 人分で、すべての表を上限まで埋めた文書: 許可（式の上限に当たらない）', async () => {
  const raw = { profiles: [1, 2, 3, 4].map(fullRaw) };
  const st = storage.normalize(raw);
  assert.equal(st.profiles.length, 4);
  const p = st.profiles[0];
  assert.equal(Object.keys(p.trace.done).length, 46 + 46 + 20 + 18);
  assert.equal(Object.keys(p.trace.solo).length, 130);
  assert.equal(Object.keys(p.cards).length, 47);
  const deleted = {}; for (let i = 0; i < 16; i++) deleted['p_' + 'y'.repeat(20) + '_' + i.toString(36).padStart(3, '0')] = '2026-10-01';
  await assertSucceeds(put('A', toCloud(st, deleted)));
});

test('13b 親＋上限まで埋めた 4 人を 1 つの batch で書く（5 書き込み）: 許可', async () => {
  const st = storage.normalize({ profiles: [1, 2, 3, 4].map(fullRaw) });
  const c = toCloud(st, { p_del_1: '2026-10-01' });
  const a = google('A');
  const b = writeBatch(a);
  b.set(famRef(a, 'A'), { v: 1, ids: c.profiles.map((p) => p.id), deleted: c.deleted, updatedAt: serverTimestamp() });
  c.profiles.forEach((p) => b.set(profRef(a, 'A', p.id), p));
  await assertSucceeds(b.commit());
  const l = await getDocs(collection(a, 'families', 'A', 'profiles'));
  assert.equal(l.size, 4);
});

// ---- 端末の実際のプロフィールが拒否されないこと ----
function rawProfile(id, name, icon, extra) {
  return Object.assign({ id, name, icon, created: '2026-10-01' }, extra || {});
}
const traceRec = { done: { し: 3, つ: 2, 山: 4, ノ: 1, 鳥: 2 }, help: { し: 1, 山: 9 }, solo: { し: 2, 山: 1, ノ: 7 }, set: 'k1', width: 'wide' };
const states = {
  'S0（新規・既定のまま）': storage.defaults('p_new_0001', '2026-10-25'),
  'S0（途中・かく の記録あり）': storage.normalize({
    version: 2, device: { sound: { sfx: false, voice: true }, lastProfileId: 'p_a_1', migratedV1: '2026-10-01' },
    profiles: [rawProfile('p_a_1', 'たろう', 'shoubousha', {
      levels: { math: 'M5', letter: 'K4', clock: 'T3', english: 'E2' }, locked: { clock: true },
      cards: { shoubousha: 2, dump: 3 }, stats: { sessions: 12, math: { sessions: 5, questions: 20, firstTry: 11 }, letter: { sessions: 2 }, trace: { sessions: 4, chars: 12, clean: 7 } },
      trace: traceRec, seen: { letter: ['あ', 'い'] }, lastPlayed: '2026-10-24', stage: { unlocked: 'S0', current: 'S0' } })]
  }),
  'S1（昇格済み・救助隊の車・2 人）': storage.normalize({
    profiles: [
      rawProfile('p_a_1', 'はなこ', 'kyukyu', {
        levels: { math: 'M9', letter: 'K7', clock: 'T7', english: 'E4' }, cards: { shoubousha: 3, rescuework: 1, rescuechem: 2 },
        stats: { sessions: 40, trace: { sessions: 9, chars: 30, clean: 20 } }, trace: traceRec, lastPlayed: '2026-10-20T10:00:00Z',
        stage: { unlocked: 'S1', current: 'S1' }, cleared: { M7: '2026-10-05', K6: '2026-10-06', T6: '2026-10-07', X9: '2026-10-07' }, promoted: { S1: '2026-10-08' } }),
      rawProfile('p_b_2', 'こども2', 'hashigo', { lastPlayed: 'きのう' })
    ]
  }),
  'S2（昇格済み・漢字の記録・4 人）': storage.normalize({
    profiles: [1, 2, 3, 4].map((i) => rawProfile('p_c_' + i, 'こども' + i, data.CARS[i].id, {
      levels: { math: 'M12', letter: 'K9', clock: 'T8', english: 'E5' }, cards: { chodai: 1, rescueheli: 3, rescuecmd: 2 },
      stats: { sessions: 100 + i, math: { sessions: 30, questions: 300, firstTry: 200 }, trace: { sessions: 20, chars: 90, clean: 60 } },
      trace: { done: { 春: 2, 夏: 3, 池: 1, ひ: 99 }, help: { 春: 2, ひ: 50 }, solo: { 夏: 3, ひ: 99 }, set: 'k2', width: 'normal' },
      stage: { unlocked: 'S2', current: 'S1' }, cleared: { M7: '2026-10-05', M10: '2026-10-09', K8: '2026-10-09' }, promoted: { S1: '2026-10-08', S2: '2026-10-10' } }))
  }),
  'v1 からの移行（かく の記録なし）': storage.migrateV1({ levels: { math: 'M2' }, cards: { gomi: 1 }, stats: { sessions: 2 }, lastPlayed: '2026-10-01' }, 'p_m_1', '2026-10-25'),
  '壊れた入力を normalize した後': storage.normalize({ profiles: [{ id: 'p_q_1', name: '漢字名', icon: 'ufo', levels: { math: 'Z' }, stats: { sessions: -5, trace: 'x' }, trace: { done: { ぬ: 'a', Z: 3, し: 1e9 }, set: 'zz' }, cards: { chodai: 99 } }, 7, null] })
};
for (const [label, st] of Object.entries(states)) {
  test(`実データ ${label}: クラウドの形に直したものは拒否されない`, async () => {
    const c = toCloud(st);
    await assertSucceeds(put('A', c));
    const a = google('A');
    const s = await getDoc(famRef(a, 'A'));
    const l = await getDocs(collection(a, 'families', 'A', 'profiles'));
    assert.equal(s.data().ids.length, st.profiles.length);
    assert.equal(l.size, st.profiles.length);
    // 2 回目（update）と、読んだものをそのまま（updatedAt だけ新しく）書き戻すのも通る
    const back = { v: s.data().v, deleted: s.data().deleted, updatedAt: '__TS__', profiles: l.docs.map((x) => x.data()) };
    await assertSucceeds(put('A', back));
  });
}
test('ルールの一覧（車・字・ステージ）が、端末側（src/storage.js・src/strokes.js・src/data.js）と一致する', async () => {
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const carsInRules = rules.match(/p\.icon\.matches\('\^\(([a-z|]+)\)\$'\)/)[1].split('|');
  const cardsInRules = rules.match(/isKeyList\(c\.keys\(\), '\(([a-z|]+)\)'\)/)[1].split('|');
  const src = fs.readFileSync(path.join(ROOT, 'src/storage.js'), 'utf8');
  const cardsInStorage = (src.match(/var CAR_IDS = \[([\s\S]*?)\];/)[1].match(/'([a-z]+)'/g) || []).map((x) => x.slice(1, -1));
  assert.deepEqual(cardsInRules, cardsInStorage);
  assert.deepEqual(cardsInStorage, storage.CAR_IDS);
  assert.equal(cardsInRules.length, 47);
  assert.deepEqual(cardsInRules, data.ALL_VEHICLES.map((c) => c.id));
  assert.deepEqual(carsInRules, data.ALL_CARS.map((c) => c.id));   // アイコンは今の 15 種のまま（棚の乗り物は使わない）
  assert.ok(storage.ICON_ORDER.every((i) => carsInRules.includes(i)));
  const charsInRules = [...rules.match(/function traceCharPattern\(\) \{\s*return '\[([^\]]+)\]'/)[1]];
  const charsInSets = Object.keys(strokes.SETS).map((k) => [...strokes.SETS[k]]).flat();
  assert.deepEqual([...charsInRules].sort(), [...charsInSets].sort());
  assert.equal(new Set(charsInSets).size, charsInSets.length);
  const stageClass = rules.match(/matches\('\^S\[0-(\d)\],S\[0-\d\]\$'\)/)[1];
  assert.ok(Number(stageClass) >= data.STAGES.length - 1);
});
test('自分以外の uid でも、別の uid の文書は読めない（相互）', async () => {
  await put('A', withTs(basic()));
  await assertFails(getDoc(famRef(google('B'), 'A')));
  await assertFails(put('A', basic(), google('B')));
  await assertFails(getDoc(profRef(google('B'), 'A', 'p_abc_0001')));
  await assertFails(getDocs(collection(google('B'), 'families', 'A', 'profiles')));
  await assertFails(deleteDoc(profRef(google('B'), 'A', 'p_abc_0001')));
  await assertFails(deleteDoc(famRef(google('B'), 'A')));
  await assertSucceeds(getDoc(famRef(google('A'), 'A')));
});
