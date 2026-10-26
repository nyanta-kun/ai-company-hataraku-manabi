// ごほうび抽選（純粋関数）。ブラウザでは window.Manabi.rewards、Node では module.exports。
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.Manabi.data;

  var MAX_STARS = 3;
  var FIRST_CAR = 'shoubousha';

  function defRng(rng) { return typeof rng === 'function' ? rng : Math.random; }
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

  // game を渡さない（または棚の無い）ときの抽選。1 文字も変えない（tests/rewards.test.js・tests/rescue.test.js が回帰の試験）
  // owned: { 車id: ★の数 }（未入手はキーなし）、scene: 'kaji'|'takai'|'michi'
  // rank: 遊んだレベルのステージの番号（0 = S0。省略は 0）。RESCUE_FROM（S1）以上のときだけ救助隊の車も候補に入る。S0 は今までと同じ 11 種
  // 戻り値: { id, stars（もらった後の★）, isNew } / 全車 ★3 のときは { sticker: true }
  function legacyPick(owned, scene, rng, rank) {
    owned = owned || {};
    var rescue = (rank | 0) >= D.RESCUE_FROM;
    var ids = (rescue ? D.ALL_CARS : D.CARS).map(function (c) { return c.id; });
    var have = ids.filter(function (id) { return owned[id] > 0; });
    if (have.length === 0) return { id: FIRST_CAR, stars: 1, isNew: true };   // 1 回目は必ずしょうぼうしゃ

    var unowned = ids.filter(function (id) { return !(owned[id] > 0); });
    if (unowned.length > 0) {
      var near = (D.SCENE_CARS[scene] || []).concat(rescue ? (D.RESCUE_SCENE_CARS[scene] || []) : []);
      var rel = near.filter(function (id) { return unowned.indexOf(id) >= 0; });
      var id = pick(rel.length ? rel : unowned, rng);
      return { id: id, stars: 1, isNew: true };
    }
    var open = ids.filter(function (id) { return owned[id] < MAX_STARS; });
    if (open.length === 0) return { sticker: true };
    var min = Math.min.apply(null, open.map(function (id) { return owned[id]; }));
    var lowest = open.filter(function (id) { return owned[id] === min; });
    var pid = pick(lowest, rng);
    return { id: pid, stars: owned[pid] + 1, isNew: false };
  }

  // ---- 棚ごとの抽選（design-rewards.md 3 章）。game が D.GAME_SHELF にあるときだけ ----
  function shelfById(id) { for (var i = 0; i < D.SHELVES.length; i++) if (D.SHELVES[i].id === id) return D.SHELVES[i]; return null; }
  function not(owned) { return function (id) { return !(owned[id] > 0); }; }
  // 棚 sh の未入手 H（rescue の rest は自分の棚に足す救助隊の id）から 1 つ決める。はたらくくるま は今と同じ「現場の車を優先」、
  // ほかは「その棚に 1 つも持っていなければ顔」、そうでなければ H から rng で 1 つ
  function chooseIn(sh, H, owned, scene, rng, rescue) {
    if (sh.id === 'hataraku') {
      var near = (D.SCENE_CARS[scene] || []).concat(rescue ? (D.RESCUE_SCENE_CARS[scene] || []) : []);
      var rel = near.filter(function (id) { return H.indexOf(id) >= 0; });
      return pick(rel.length ? rel : H, rng);
    }
    var none = sh.ids.every(not(owned));
    if (none && H.indexOf(sh.face) >= 0) return sh.face;   // 顔は rng を使わない
    return pick(H, rng);
  }
  function shelfPick(owned, scene, rng, rank, shelfId) {
    var rescue = (rank | 0) >= D.RESCUE_FROM;
    var shelves = D.SHELVES.filter(function (sh) { return sh.from === undefined || (rank | 0) >= sh.from; });
    var pool = [];
    shelves.forEach(function (sh) { pool = pool.concat(sh.ids); });
    if (pool.every(not(owned))) return { id: FIRST_CAR, stars: 1, isNew: true };   // 1 回目は必ずしょうぼうしゃ
    var own = shelfById(shelfId);
    var home = own.ids.slice();
    shelves.forEach(function (sh) { if (sh.from !== undefined) home = home.concat(sh.ids); });   // 自分の棚のあとに、出始めている きゅうじょたい
    var H = home.filter(not(owned));
    if (H.length > 0) return { id: chooseIn(own, H, owned, scene, rng, rescue), stars: 1, isNew: true };
    // 自分の棚がそろった: 未入手のある棚のうち、持っている割合がいちばん小さい棚（割り算を避け、掛け算で比べる。同じなら SHELVES の順で先）
    var best = null;
    shelves.forEach(function (sh) {
      var left = sh.ids.filter(not(owned));
      if (left.length === 0) return;
      var have = sh.ids.length - left.length;
      if (!best || have * best.size < best.have * sh.ids.length) best = { sh: sh, left: left, have: have, size: sh.ids.length };
    });
    if (best) return { id: chooseIn(best.sh, best.left, owned, scene, rng, rescue), stars: 1, isNew: true };
    // pool 全部を持った: ★を増やす（自分の棚を先に）
    var open = pool.filter(function (id) { return owned[id] < MAX_STARS; });
    if (open.length === 0) return { sticker: true };
    var mine = open.filter(function (id) { return home.indexOf(id) >= 0; });
    var base = mine.length ? mine : open;
    var min = Math.min.apply(null, base.map(function (id) { return owned[id]; }));
    var lowest = base.filter(function (id) { return owned[id] === min; });
    var pid = pick(lowest, rng);
    return { id: pid, stars: owned[pid] + 1, isNew: false };
  }

  // owned: { 乗り物id: ★の数 }（未入手はキーなし）、scene: 'kaji'|'takai'|'michi'、rank: 遊んだレベルのステージの番号（0 = S0。省略は 0）
  // game: 遊んだゲーム（math・letter・clock・english・trace）。自分の棚の乗り物を先に出す。省略・棚の無い名前は、今までの抽選（legacyPick）のまま
  // 戻り値: { id, stars（もらった後の★）, isNew } / 全部 ★3 のときは { sticker: true }
  function pickReward(owned, scene, rng, rank, game) {
    rng = defRng(rng);
    var shelfId = (typeof game === 'string' && Object.prototype.hasOwnProperty.call(D.GAME_SHELF, game)) ? D.GAME_SHELF[game] : null;
    if (!shelfId || !shelfById(shelfId)) return legacyPick(owned, scene, rng, rank);
    return shelfPick(owned || {}, scene, rng, rank, shelfId);
  }

  // 抽選して cards に反映する。cards は書き換えず、新しい cards を返す。
  // 戻り値: { r: pickReward の結果, cards: 反映後 }（ステッカーのときは cards は同じ中身のコピー）
  function applyReward(cards, scene, rng, rank, game) {
    var next = {};
    Object.keys(cards || {}).forEach(function (k) { next[k] = cards[k]; });
    var r = pickReward(next, scene, rng, rank, game);
    if (!r.sticker) next[r.id] = r.stars;
    return { r: r, cards: next };
  }

  var api = { MAX_STARS: MAX_STARS, FIRST_CAR: FIRST_CAR, pickReward: pickReward, applyReward: applyReward };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.rewards = api; }
})(typeof window !== 'undefined' ? window : globalThis);
