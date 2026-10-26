// ひとりで かく（線なしの書き取り）の判定と字の選び方（design-tracing 13章。テストの番号は F1〜）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const FW = require('../src/freewrite.js');
const T = require('../src/trace.js');
const S = require('../src/strokes.js');
const { rngOf } = require('./helpers.js');

const SETS4 = ['hira', 'kata', 'k1', 'k2'];
const ALL = SETS4.flatMap((k) => S.SETS[k].split(''));
const KANA = ALL.filter((c) => S.SETS.hira.includes(c) || S.SETS.kata.includes(c));
const D = FW.DEFAULTS;
const polysOf = (ch) => S.STROKES[ch].s.map((s) => T.strokePolyline(s, 0.01));
const frameS = (ch) => FW.inkFrame(polysOf(ch)).s;
const seedOf = (ch, s) => s * 7919 + ch.codePointAt(0);

// F1 の場面。seed 0・1 は範囲の両端、それ以降は種ごとのくじ
const placed = (r, s) => {
  const size = s === 0 ? 0.3 : s === 1 ? 0.95 : 0.3 + r() * 0.65;
  const x = s === 0 ? 0 : s === 1 ? 1 : r(), y = s === 0 ? 1 : s === 1 ? 0 : r();
  return { size, cx: size / 2 + x * (1 - size), cy: size / 2 + y * (1 - size) };
};
function edgeOf(r, s, ch, f, extra) {
  const m = S.STROKES[ch].s.length, i = Math.floor(r() * m), sign = r() < 0.5 ? 1 : -1, which = r() < 0.5;
  return Object.assign({ edge: { i, start: which ? 0 : sign * f, end: which ? sign * f : 0 } }, extra);
}
const SCENES = {
  a: (r, s) => placed(r, s),
  b: (r, s) => ({ aspect: s === 0 ? 0.7 : s === 1 ? 1.4 : 0.7 + r() * 0.7 }),
  c: (r, s) => ({ rot: (s === 0 ? -1 : s === 1 ? 1 : r() * 2 - 1) * 8 * Math.PI / 180 }),
  d: () => ({ shift: 0.05, scaleJit: 0.2 }),
  e: () => ({ tremor: 0.012 }),
  f: (r, s) => (s % 2 === 0 ? { step: 0.04 } : { step: 0.002, dup: true }),
  g: () => ({ hook: 0.04 }),
  h: () => ({ tap: true }),
  j: () => ({ stray: true }),
  // 1 画の端の長さが手本と違う（始まり・終わりを 0.15 切る・伸ばす。0.2〜0.3 は下の F1b で割合を記録）。l: そのまま、m: ふるえ・ずれを重ねる
  l: (r, s, ch) => edgeOf(r, s, ch, 0.15, {}),
  m: (r, s, ch) => edgeOf(r, s, ch, 0.15, { tremor: 0.01, shift: 0.02 }),
  k: (r, s) => Object.assign(placed(r, s), {
    aspect: 0.7 + r() * 0.7, rot: (r() * 2 - 1) * 8 * Math.PI / 180, shift: 0.05 * r(), scaleJit: 0.2 * r(), tremor: 0.012 * r(),
    step: r() < 0.5 ? 0.04 : 0.01, hook: r() < 0.5 ? 0.04 : 0, tap: r() < 0.5, stray: r() < 0.3
  })
};

function runScenes(seeds, params) {
  const fails = [], worst = { mean: 0, max: 0, dotR: 0, dotLen: 0 };
  let n = 0;
  const P = params || {};
  const sm = P.SHAPE_MEAN || D.SHAPE_MEAN, sx = P.SHAPE_MAX || D.SHAPE_MAX, dr = P.DOT_R || D.DOT_R, dl = P.DOT_MAXLEN || D.DOT_MAXLEN;
  const judge = (name, ch, ink) => {
    n++;
    const j = FW.judgeSolo(ch, ink, { params: params });
    if (j.result !== 'ok') { fails.push(name + ' ' + ch + ' ' + j.result + ' ' + j.focus); return; }
    j.detail.forEach((d) => {
      if (d.dot) { worst.dotR = Math.max(worst.dotR, d.D / dr); worst.dotLen = Math.max(worst.dotLen, d.len / dl); }
      else { worst.mean = Math.max(worst.mean, d.D / sm); worst.max = Math.max(worst.max, d.Dmax / sx); }
    });
  };
  Object.keys(SCENES).filter((name) => !(params && /^[lm]$/.test(name))).forEach((name) => {   // 余裕の確かめ（0.8 倍）には端の場面を入れない（14章）
    ALL.forEach((ch) => {
      for (let s = 0; s < seeds; s++) {
        const r = rngOf(seedOf(ch, s));
        judge(name, ch, FW.synthInk(ch, SCENES[name](r, s, ch), r));
      }
    });
  });
  // i: 隣り合う 2 画を 1 画で（全部の組を 1 つずつ）／長い画（字の 0.5 以上）を途中で 2 つに分ける
  ALL.forEach((ch) => {
    const m = S.STROKES[ch].s.length, fs = frameS(ch);
    for (let i = 0; i + 1 < m; i++) {
      for (let s = 0; s < Math.min(seeds, 3); s++) {
        const r = rngOf(seedOf(ch, s) + i * 31);
        judge('i-join', ch, FW.synthInk(ch, { join: i, tremor: 0.006, shift: 0.02 }, r));
      }
    }
    for (let i = 0; i < m; i++) {
      if (T.polyLength(polysOf(ch)[i]) < 0.5 * fs) continue;
      for (let s = 0; s < Math.min(seeds, 2); s++) {
        const r = rngOf(seedOf(ch, s) + i * 17);
        judge('i-split', ch, FW.synthInk(ch, { split: i }, r));
      }
    }
  });
  return { n, fails, worst };
}

test('F1. 正しく書いた子を落とさない（全字 × 種 0〜19 × 場面 a〜k・i・j。最優先）', () => {
  assert.equal(ALL.length, 46 + 46 + 20 + 18);
  const t0 = Date.now();
  const r = runScenes(20);
  console.log('F1: ' + r.n + ' 件 ' + (Date.now() - t0) + 'ms, しきい値に対する最大の比 ' + JSON.stringify(r.worst, (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
  assert.deepEqual(r.fails.slice(0, 20), []);
});

test('F1b. 画の端の長さが手本と違う（1 画の始まり・終わりを 0.10〜0.30 切る・伸ばす。ふるえ・ずれ重ねも）: 落ちる割合を記録し、上限を守る', () => {
  const limits = { 0.1: 0, 0.15: 0.001, 0.2: 0.01, 0.25: 0.02, 0.3: 0.03 };
  const out = [];
  Object.keys(limits).forEach((f) => {
    let n = 0, bad = 0;
    [{}, { tremor: 0.012, shift: 0.02 }].forEach((extra) => ALL.forEach((ch) => {
      const m = S.STROKES[ch].s.length;
      for (let i = 0; i < m; i++) for (const [a, b] of [[0, +f], [+f, 0], [0, -f], [-f, 0]]) {
        n++;
        const r = rngOf(i * 13 + ch.codePointAt(0));
        const ink = FW.synthInk(ch, Object.assign({ size: 0.7, tremor: 0.006, edge: { i, start: a, end: b } }, extra), r);
        if (FW.judgeSolo(ch, ink).result !== 'ok') bad++;
      }
    }));
    out.push(f + ': ' + bad + '/' + n);
    assert.ok(bad / n <= limits[f] + 1e-9, '端 ' + f + ' で落ちた ' + bad + '/' + n);
  });
  console.log('F1b: ' + out.join('  '));
});

test('F1. 余裕: しきい値を 0.8 倍にしても全部通る（最大の値がしきい値の 0.8 倍以下 = 余裕 1.25 倍）', () => {
  const r = runScenes(8, { SHAPE_MEAN: D.SHAPE_MEAN * 0.8, SHAPE_MAX: D.SHAPE_MAX * 0.8, DOT_R: D.DOT_R * 0.8, DOT_MAXLEN: D.DOT_MAXLEN * 0.8, LOOSE: D.LOOSE });
  assert.deepEqual(r.fails.slice(0, 20), []);
});

test('F2. 向きで分かれる字: シ↔ツ・ソ↔ン は手本どおりに書いても別の字の手本では ok にならない', () => {
  [['シ', 'ツ'], ['ツ', 'シ'], ['ソ', 'ン'], ['ン', 'ソ']].forEach(([target, drawn]) => {
    for (let s = 0; s < 20; s++) {
      const r = rngOf(100 + s);
      const ink = FW.synthInk(drawn, { size: 0.4 + r() * 0.5, tremor: 0.006, shift: 0.02, rot: (r() * 2 - 1) * 0.1 }, r);
      assert.notEqual(FW.judgeSolo(target, ink).result, 'ok', drawn + ' を ' + target + ' の手本で seed ' + s);
      assert.equal(FW.judgeSolo(drawn, ink).result, 'ok');
    }
  });
});

test('F3. 鏡文字: 左右を反転した手本が、もとの手本と SHAPE_MEAN の 2 倍以上違う字を反転して書くと ok にならない', () => {
  let tested = 0;
  ALL.forEach((ch) => {
    const polys = polysOf(ch), fr = FW.inkFrame(polys);
    // 反転との違い: 画ごとの 24 点の平均距離の最大（字の大きさに対する比）
    const mirror = (p) => p.map(([x, y]) => [2 * fr.cx - x, y]);
    const diff = Math.max.apply(null, polys.map((p) => {
      const a = FW.resample(p, 24), b = FW.resample(mirror(p), 24);
      return a.reduce((t, q, i) => t + Math.hypot(q[0] - b[i][0], q[1] - b[i][1]), 0) / 24 / fr.s;
    }));
    if (diff < 2 * D.SHAPE_MEAN) return;
    tested++;
    for (let s = 0; s < 3; s++) {
      const r = rngOf(seedOf(ch, s));
      const ink = FW.synthInk(ch, { mirror: true, tremor: 0.006, size: 0.5 + r() * 0.4 }, r);
      assert.notEqual(FW.judgeSolo(ch, ink).result, 'ok', ch + ' の鏡文字 seed ' + s);
    }
  });
  assert.ok(tested > 80, '鏡文字を確かめた字の数 ' + tested);
});

test('F4. 逆向き: 長さが字の 0.3 以上の画を 1 つ逆向きに → reverse（focus はその画）。かなは全部、漢字は読み替え（結合・分割）の例外だけ', () => {
  const KNOWN_OK = new Set(['森6', '夏6']);   // 漢字で、隣の画との結合・分割と読み替えられて ok になる（F7 と同じ扱い。設計 14章に記録）
  let n = 0;
  const bad = [];
  ALL.forEach((ch) => {
    const polys = polysOf(ch), fs = frameS(ch), ink = FW.synthInk(ch, {}, rngOf(1));
    polys.forEach((p, i) => {
      if (T.polyLength(p) < 0.3 * fs) return;
      n++;
      const rev = ink.map((s, k) => (k === i ? s.slice().reverse() : s));
      const j = FW.judgeSolo(ch, rev);
      if (j.result === 'reverse' && j.focus === i) return;
      if (j.result === 'ok' && KNOWN_OK.has(ch + i)) return;
      bad.push(ch + i + ':' + j.result + j.focus);
    });
  });
  assert.ok(n > 380, '確かめた画の数 ' + n);
  assert.deepEqual(bad, []);
});

test('F5. 書き順: 離れた 2 画を入れ替える → order（focus は順番どおりでない最初の画）', () => {
  let n = 0;
  const bad = [];
  ALL.forEach((ch) => {
    const polys = polysOf(ch), ink = FW.synthInk(ch, {}, rngOf(1));
    const end = (p) => p[p.length - 1], start = (p) => p[0], dd = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]);
    for (let a = 0; a + 1 < polys.length; a++) {
      const A = polys[a], B = polys[a + 1];
      if (dd(end(A), start(B)) <= 0.3 || dd(end(B), start(A)) <= 0.3 || T.polyLength(A) < 0.2 || T.polyLength(B) < 0.2) continue;
      n++;
      const sw = ink.slice(); [sw[a], sw[a + 1]] = [sw[a + 1], sw[a]];
      const j = FW.judgeSolo(ch, sw);
      if (!(j.result === 'order' && j.focus === a)) bad.push(ch + a + ':' + j.result + j.focus);
      break;   // 1 字に 1 組
    }
  });
  assert.ok(n > 60, '確かめた字の数 ' + n);
  assert.deepEqual(bad.filter((b) => !/^(秋2|夏3|朝5)/.test(b)), []);   // 漢字の 3 つは、結合・分割と読み替えられて ok（記録）
});

test('F6. 明らかに違う: 別の字の手本・乱数の線・1 本線は ok にならない。何もなければ empty', () => {
  const rr = rngOf(5), pass = [];
  let n = 0;
  ALL.forEach((ch) => {
    for (let t = 0; t < 6; t++) {
      const o = ALL[Math.floor(rr() * ALL.length)];
      if (o === ch) continue;
      n++;
      if (FW.judgeSolo(ch, FW.synthInk(o, { tremor: 0.006 }, rr)).result === 'ok') pass.push(o + '→' + ch);
    }
  });
  // 形のとても近い組は通ることがある（受け入れる。F7）。割合で見る
  assert.ok(pass.length / n < 0.02, '別の字が ok になった割合 ' + pass.length + '/' + n + ' ' + pass.join(' '));
  let rnd = 0;
  ALL.forEach((ch) => {
    for (let t = 0; t < 3; t++) {
      const ink = [], k = 1 + Math.floor(rr() * 6);
      for (let i = 0; i < k; i++) { const st = []; let x = rr(), y = rr(); for (let j = 0; j < 20; j++) { x += (rr() - 0.5) * 0.15; y += (rr() - 0.5) * 0.15; st.push([x, y]); } ink.push(st); }
      if (FW.judgeSolo(ch, ink).result === 'ok') rnd++;
    }
  });
  assert.equal(rnd, 0);
  const lines = [[[0.2, 0.5], [0.8, 0.5]], [[0.5, 0.1], [0.5, 0.9]], [[0.2, 0.2], [0.8, 0.8]], [[0.2, 0.8], [0.8, 0.2]]];
  const lineOk = [];
  ALL.filter((c) => S.STROKES[c].s.length >= 2).forEach((ch) => lines.forEach((l, li) => { if (FW.judgeSolo(ch, [l]).result === 'ok') lineOk.push(ch + li); }));
  assert.deepEqual(lineOk, []);
  assert.equal(FW.judgeSolo('し', []).result, 'empty');
  assert.equal(FW.judgeSolo('し', [[]]).result, 'empty');
});

test('F7. 記録だけ: 似た字の組を書き違えたとき ok になるか（しきい値を決めるときの参考。通る・通らないは決めない）', () => {
  const pairs = [['る', 'ろ'], ['ろ', 'る'], ['ぬ', 'め'], ['め', 'ぬ'], ['ね', 'れ'], ['れ', 'わ'], ['わ', 'ね'], ['は', 'ほ'], ['ほ', 'は'], ['き', 'さ'], ['さ', 'き'], ['ら', 'ち'], ['ち', 'ら'], ['あ', 'お'], ['お', 'あ'],
    ['ク', 'ケ'], ['ケ', 'タ'], ['タ', 'ク'], ['コ', 'ロ'], ['ロ', 'コ'], ['エ', '工'], ['カ', '力'], ['ニ', '二'], ['シ', 'ツ'], ['ソ', 'ン']];
  const lines = pairs.filter(([a, b]) => S.STROKES[a] && S.STROKES[b]).map(([target, drawn]) => {
    let ok = 0;
    for (let s = 0; s < 10; s++) { const r = rngOf(s); if (FW.judgeSolo(target, FW.synthInk(drawn, { tremor: 0.006, size: 0.5 + r() * 0.4 }, r)).result === 'ok') ok++; }
    return drawn + '→' + target + ' ' + ok + '/10';
  });
  console.log('F7: ' + lines.join('  '));
  assert.ok(lines.length >= 20);
  const ts = lines.filter((l) => /^(ツ→シ|シ→ツ|ン→ソ|ソ→ン)/.test(l));
  ts.forEach((l) => assert.match(l, / 0\/10$/));
});

test('F8. more: 最後の 1 画（点を含む）を書かないと more（told 済みなら shape）。小さすぎる字も more', () => {
  const bad = [];
  let n = 0;
  ALL.filter((c) => S.STROKES[c].s.length >= 2).forEach((ch) => {
    const ink = FW.synthInk(ch, {}, rngOf(1)), cut = ink.slice(0, -1);
    n++;
    const a = FW.judgeSolo(ch, cut), b = FW.judgeSolo(ch, cut, { told: true });
    if (a.result !== 'more' || b.result === 'more' || b.result === 'ok') bad.push(ch + ':' + a.result + '/' + b.result);
  });
  assert.ok(n > 100);
  assert.deepEqual(bad.filter((b) => !/^(船|雲):ok\/ok$/.test(b)), []);   // 漢字の 2 字は最後の画の欠けを結合・分割と読み替えて ok（記録。設計 14章）
  const small = FW.judgeSolo('あ', FW.synthInk('あ', { size: 0.05 }, rngOf(1)));
  assert.equal(small.result, 'more'); assert.equal(small.reason, 'small');
  // 全部書いた字は more にならない（told に関係なく ok）
  assert.equal(FW.judgeSolo('あ', FW.synthInk('あ', {}, rngOf(1)), { told: true }).result, 'ok');
});

test('F9. 重ね: fit で手本を戻すと、書いた位置に 0.01 以内で重なる（回転・ふるえなし）', () => {
  let worst = 0;
  ['あ', 'し', 'ね', 'シ', 'ハ', '雨', '森', '道', 'ー'].filter((c) => S.STROKES[c]).forEach((ch) => {
    for (let s = 0; s < 6; s++) {
      const r = rngOf(seedOf(ch, s));
      const ink = FW.synthInk(ch, Object.assign(placed(r, s), { aspect: 0.8 + r() * 0.4, step: 0.004 }), r);
      const j = FW.judgeSolo(ch, ink);
      assert.equal(j.result, 'ok');
      const dense = ink.map((st) => FW.resample(st, 400));
      polysOf(ch).forEach((p) => p.forEach((q) => {
        const pt = FW.fitPoint(j.fit, q);
        let best = Infinity;
        dense.forEach((st) => st.forEach((z) => { best = Math.min(best, Math.hypot(z[0] - pt[0], z[1] - pt[1])); }));
        worst = Math.max(worst, best);
      }));
    }
  });
  assert.ok(worst <= 0.01, '最大のずれ ' + worst);
});

test('F10. 決まった結果・入力: 同じ入力で同じ結果、入力を書き換えない、数でない点・1 点だけの画・知らない字', () => {
  const ink = FW.synthInk('ぬ', { tremor: 0.01, aspect: 1.2 }, rngOf(3));
  const copy = JSON.parse(JSON.stringify(ink));
  const a = FW.judgeSolo('ぬ', ink), b = FW.judgeSolo('ぬ', ink);
  assert.deepEqual(a, b);
  assert.deepEqual(ink, copy);
  assert.equal(FW.judgeSolo('x', ink), null);
  assert.equal(FW.judgeSolo('', ink), null);
  const dirty = ink.map((st) => st.slice());
  dirty[0].splice(3, 0, [NaN, 0.5], ['a', 1], null, [Infinity, 0], [0.5]);
  dirty.push([]); dirty.push([[0.4, 0.4]]); dirty.push('x'); dirty.push(null);
  assert.doesNotThrow(() => FW.judgeSolo('ぬ', dirty));
  assert.equal(FW.judgeSolo('ぬ', dirty).result, 'ok');
  assert.equal(FW.judgeSolo('ぬ', null).result, 'empty');
  assert.equal(FW.judgeSolo('ぬ', [[[0.5, 0.5]]]).result, 'more');   // 点が 1 つだけ（小さすぎる）
  // 小さな点 1 つで「できた」を 2 回（told 済み）: 枠が作れなくても落ちず、fit も null のまま more（UI は続きを書かせる）
  [[[[0.5, 0.5]]], [[[0.5, 0.5], [0.5, 0.5]]], [[[0.5, 0.5]], [[0.52, 0.5]]]].forEach((ink) => {
    [false, true].forEach((told) => { const j = FW.judgeSolo('ぬ', ink, { told }); assert.ok(j && ['more', 'shape'].includes(j.result)); if (!j.fit) assert.equal(j.result, 'more'); });
  });
  // 重なった点だけの線
  assert.doesNotThrow(() => FW.judgeSolo('あ', [[[0.5, 0.5], [0.5, 0.5], [0.5, 0.5]]]));
  // 何画書いても落ちない
  const many = []; const r = rngOf(9);
  for (let i = 0; i < 40; i++) many.push([[r(), r()], [r(), r()], [r(), r()]]);
  assert.doesNotThrow(() => FW.judgeSolo('森', many));
  assert.notEqual(FW.judgeSolo('森', many).result, 'ok');
});

test('F10b. 部品: resample・dtw・inkFrame・fitPoint', () => {
  assert.deepEqual(FW.resample([[0, 0], [1, 0]], 3), [[0, 0], [0.5, 0], [1, 0]]);
  assert.equal(FW.resample([[0.2, 0.2], [0.2, 0.2]], 4).length, 4);
  assert.deepEqual(FW.resample([], 4), []);
  const a = FW.resample([[0, 0], [1, 0]], 24), b = FW.resample([[0, 0.1], [1, 0.1]], 24);
  assert.ok(Math.abs(FW.dtw(a, b, 4).mean - 0.1) < 1e-9);
  assert.ok(FW.dtw(a, a.slice().reverse(), 4).mean > 0.2);
  const f0 = FW.inkFrame([[[0.2, 0.3], [0.6, 0.3]], [[0.4, 0.3], [0.4, 0.9]]], 0);
  assert.ok(Math.abs(f0.w - 0.4) < 1e-9 && Math.abs(f0.h - 0.6) < 1e-9 && Math.abs(f0.s - 0.6) < 1e-9 && Math.abs(f0.cx - 0.4) < 1e-9);
  const f = FW.inkFrame([[[0.2, 0.3], [0.6, 0.3]], [[0.4, 0.3], [0.4, 0.9]]]);   // 上下 1% を除く
  assert.ok(f.w <= 0.4 && f.w > 0.37 && f.h <= 0.6 && f.h > 0.57);
  assert.ok(FW.inkFrame([[[0.3, 0.5], [0.7, 0.5], [0.71, 0.52]]]).w <= FW.inkFrame([[[0.3, 0.5], [0.7, 0.5], [0.71, 0.52]]], 0).w);
  const fit = { cc: [0.5, 0.5], cm: [0.25, 0.75], k: 2, a: 1 };
  assert.deepEqual(FW.fitPoint(fit, [0.25, 0.75]), [0.5, 0.5]);
  assert.deepEqual(FW.fitPoint(fit, [0.75, 0.75]), [0.75, 0.5]);
});

// ---- 字の選び方・記録 ----
const HIRA = S.SETS.hira.split('');
const traceOf = (done, solo, help) => ({ done: done || {}, help: help || {}, solo: solo || {} });

test('F11. pickSoloChars / soloReady / soloInvite', () => {
  assert.deepEqual(D.SOLO_SETS, ['hira', 'kata', 'k1', 'k2']);   // W6-c: カタカナ・漢字も出す
  const saved = D.SOLO_SETS.slice(); D.SOLO_SETS.length = 0; D.SOLO_SETS.push('hira');   // この中は ひらがな だけで確かめる（W6-b の出し方）
  try { f11(); } finally { D.SOLO_SETS.length = 0; saved.forEach((k) => D.SOLO_SETS.push(k)); }
  // 全部の集合: カタカナ・漢字も出せる字になる
  assert.deepEqual(FW.soloReady(S.SETS.kata.split(''), traceOf({ ノ: 5 })), ['ノ']);
  assert.deepEqual(FW.soloReady(S.SETS.k1.split(''), traceOf({ 山: 3 })), ['山']);
  assert.deepEqual(FW.soloReady(S.SETS.k2.split(''), traceOf({ 雲: 2 })), []);
});

function f11() {
  const done = {}; HIRA.forEach((c) => { done[c] = 3; });
  const t = traceOf(done);
  assert.deepEqual(FW.soloReady(HIRA, t), HIRA);
  // done < 3 と苦手は出さない。SOLO_SETS の外（カタカナ）も出さない
  const t2 = traceOf(Object.assign({}, done, { し: 2, つ: 4 }), {}, { つ: 3 });
  assert.ok(!FW.soloReady(HIRA, t2).includes('し') && !FW.soloReady(HIRA, t2).includes('つ'));
  assert.deepEqual(FW.soloReady(S.SETS.kata.split(''), traceOf({ ノ: 5 })), []);
  // 初めて: まだの字 4（易しい順）
  assert.deepEqual(FW.pickSoloChars(HIRA, t, {}, rngOf(1)).map((o) => o.ch), HIRA.slice(0, 4));
  // なじみ 1 + まだの字 3
  const t3 = traceOf(done, { し: 1, つ: 2 });
  const p3 = FW.pickSoloChars(HIRA, t3, {}, rngOf(1));
  assert.deepEqual(p3.map((o) => o.why), ['review', 'new', 'new', 'new']);
  assert.equal(p3[0].ch, 'し');   // 回数の少ない方
  assert.deepEqual(p3.slice(1).map((o) => o.ch), ['く', 'へ', 'て']);
  // 名前の字は 1 字まで（まだの字の枠を使う。chars の順に並ぶ）
  const p4 = FW.pickSoloChars(HIRA, t, { name: 'ぬねの' }, rngOf(1));
  assert.equal(p4.filter((o) => o.why === 'name').length, 1);
  assert.equal(p4.length, 4);
  assert.equal(new Set(p4.map((o) => o.ch)).size, 4);
  // 前の回の字は続かない
  const prev = HIRA.slice(0, 4);
  assert.ok(FW.pickSoloChars(HIRA, t, { prev }, rngOf(1)).every((o) => !prev.includes(o.ch)));
  // 選んだ字は 1 字目（資格がなくても）
  const p5 = FW.pickSoloChars(HIRA, t3, { chosen: 'を' }, rngOf(1));
  assert.equal(p5[0].ch, 'を'); assert.equal(p5[0].why, 'chosen');
  assert.equal(new Set(p5.map((o) => o.ch)).size, p5.length);
  assert.equal(FW.pickSoloChars(HIRA, traceOf({}), { chosen: 'を' }, rngOf(1)).map((o) => o.ch).join(''), 'を');
  // 同じ種で同じ結果・入力を書き換えない
  const snap = JSON.stringify(t3);
  assert.deepEqual(FW.pickSoloChars(HIRA, t3, { name: 'ぬ' }, rngOf(7)), FW.pickSoloChars(HIRA, t3, { name: 'ぬ' }, rngOf(7)));
  assert.equal(JSON.stringify(t3), snap);
  // 全部ひとりで書けたら、少ない順に埋める（重複なし）
  const solo = {}; HIRA.forEach((c) => { solo[c] = 1; });
  const p6 = FW.pickSoloChars(HIRA, traceOf(done, solo), {}, rngOf(1));
  assert.equal(p6.length, 4); assert.equal(new Set(p6.map((o) => o.ch)).size, 4);
  // soloInvite
  assert.equal(FW.soloInvite(HIRA, t), true);
  assert.equal(FW.soloInvite(HIRA, traceOf({ あ: 1 })), false);
  assert.equal(FW.soloInvite([], t), false);
  // 候補が少ないと n 字そろわない（UI は 4 字未満なら なぞりにする）
  assert.ok(FW.pickSoloChars(HIRA, traceOf({ し: 3 }), {}, rngOf(1)).length < 4);
}

test('F12. recordSolo / soloLicense', () => {
  const t0 = { done: { し: 2 }, help: { し: 1 }, solo: {}, set: 'auto', width: 'auto' };
  const snap = JSON.stringify(t0);
  const t1 = FW.recordSolo(t0, 'し');
  assert.equal(JSON.stringify(t0), snap);
  assert.deepEqual(t1.done, { し: 3 }); assert.deepEqual(t1.solo, { し: 1 }); assert.deepEqual(t1.help, { し: 1 });
  assert.equal(t1.set, 'auto');
  const t2 = FW.recordSolo(FW.recordSolo(t1, 'し'), 'つ');
  assert.deepEqual(t2.done, { し: 4, つ: 1 }); assert.deepEqual(t2.solo, { し: 2, つ: 1 });
  let t = { done: { し: 98 }, help: {}, solo: { し: 98 } };
  t = FW.recordSolo(FW.recordSolo(FW.recordSolo(t, 'し'), 'し'), 'し');
  assert.equal(t.done['し'], 99); assert.equal(t.solo['し'], 99);
  assert.deepEqual(FW.recordSolo(undefined, 'あ').solo, { あ: 1 });
  // めんきょ
  const solo = {}; HIRA.forEach((c) => { solo[c] = 1; });
  assert.equal(FW.soloLicense({ solo }, 'hira'), true);
  delete solo['を'];
  assert.equal(FW.soloLicense({ solo }, 'hira'), false);
  assert.equal(FW.soloLicense({ solo: {} }, 'kata'), false);
  assert.equal(FW.soloLicense({ solo: {} }, 'zzz'), false);
});

test('F14. index.html は freewrite.js を trace.js の後・traceboard.js の前に読む。判定の部品は DOM を知らない', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const at = (n) => html.indexOf('src/' + n + '"');
  assert.ok(at('trace.js') > 0 && at('trace.js') < at('freewrite.js') && at('freewrite.js') < at('traceboard.js'));
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'freewrite.js'), 'utf8');
  assert.ok(!/document|window\.|getElementById|setTimeout|Date\.now|performance/.test(src.replace(/typeof window[^;]*;/g, '').replace(/\/\/.*$/gm, '')));
});

test('W6-b: index.html に ひとりで かく の札・ボタン・ごほうびの入口があり、子ども向けの文言はひらがなだけ（テスト・しけんの語を出さない）', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ['solo-card', 'solo-tools', 'btn-solo-undo', 'btn-solo-done', 'btn-r-solo'].forEach((id) => assert.ok(html.includes('id="' + id + '"'), id));
  const kid = [html.match(/id="solo-tools"[\s\S]*?<\/div>/)[0], html.match(/id="btn-r-solo"[^>]*>[\s\S]*?<\/button>/)[0]].join('');
  assert.ok(!/テスト|しけん|試験|点数/.test(kid));
  const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8');
  const say = [...ui.matchAll(/say\('([^']*)'/g)].map((m) => m[1]).filter((t) => /ひとりで|おてほん|つづき/.test(t));
  assert.ok(say.length >= 2);
  say.forEach((t) => assert.ok(!/テスト|しけん|ごうかく|まちがい|ちがう/.test(t), t));
});

test('手のひらのふれ: 字から離れた小さな点 2〜3 個・0.03 の短いこすれ 1 本があっても ok（小さい画は触れただけの点として無視する）', () => {
  let n = 0;
  ALL.forEach((ch) => {
    for (let s = 0; s < 3; s++) {
      const r = rngOf(seedOf(ch, s));
      const ink = FW.synthInk(ch, { size: 0.6, cx: 0.55, cy: 0.5, tremor: 0.005 }, r);
      const extra = [[[0.04, 0.95]], [[0.07, 0.93]], [[0.05, 0.05], [0.07, 0.07]]].slice(0, 1 + (s % 2));
      const rub = [[0.95, 0.9], [0.97, 0.92]];   // 長さ 約 0.03
      n++;
      assert.equal(FW.judgeSolo(ch, extra.concat([rub], ink)).result, 'ok', ch + ' ' + s);
      assert.equal(FW.judgeSolo(ch, ink.concat(extra, [rub])).result, 'ok', ch + ' ' + s + ' (後)');
    }
  });
  assert.ok(n > 300);
});
