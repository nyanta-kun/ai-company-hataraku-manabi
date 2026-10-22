// ごほうび抽選（純粋関数）。ブラウザでは window.Manabi.rewards、Node では module.exports。
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.Manabi.data;

  var MAX_STARS = 3;
  var FIRST_CAR = 'shoubousha';

  function defRng(rng) { return typeof rng === 'function' ? rng : Math.random; }
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

  // owned: { 車id: ★の数 }（未入手はキーなし）、scene: 'kaji'|'takai'|'michi'
  // 戻り値: { id, stars（もらった後の★）, isNew } / 全車 ★3 のときは { sticker: true }
  function pickReward(owned, scene, rng) {
    rng = defRng(rng);
    owned = owned || {};
    var ids = D.CARS.map(function (c) { return c.id; });
    var have = ids.filter(function (id) { return owned[id] > 0; });
    if (have.length === 0) return { id: FIRST_CAR, stars: 1, isNew: true };   // 1 回目は必ずしょうぼうしゃ

    var unowned = ids.filter(function (id) { return !(owned[id] > 0); });
    if (unowned.length > 0) {
      var rel = (D.SCENE_CARS[scene] || []).filter(function (id) { return unowned.indexOf(id) >= 0; });
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

  // 抽選して cards に反映する。cards は書き換えず、新しい cards を返す。
  // 戻り値: { r: pickReward の結果, cards: 反映後 }（ステッカーのときは cards は同じ中身のコピー）
  function applyReward(cards, scene, rng) {
    var next = {};
    Object.keys(cards || {}).forEach(function (k) { next[k] = cards[k]; });
    var r = pickReward(next, scene, rng);
    if (!r.sticker) next[r.id] = r.stars;
    return { r: r, cards: next };
  }

  var api = { MAX_STARS: MAX_STARS, FIRST_CAR: FIRST_CAR, pickReward: pickReward, applyReward: applyReward };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.rewards = api; }
})(typeof window !== 'undefined' ? window : globalThis);
