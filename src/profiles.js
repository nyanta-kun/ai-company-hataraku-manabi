// プロフィールの操作（純粋関数のみ）。元の state は書き換えず、新しい state を返す。依存: storage.js / data.js
// ブラウザでは window.Manabi.profiles、Node では module.exports。
(function (root) {
  'use strict';
  var S = (typeof module !== 'undefined' && module.exports) ? require('./storage.js') : root.Manabi.storage;
  var ICON_ORDER = S.ICON_ORDER, MAX = S.MAX_PROFILES;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function indexOf(state, id) {
    for (var i = 0; i < state.profiles.length; i++) if (state.profiles[i].id === id) return i;
    return -1;
  }
  function fail(state, reason) { return { state: state, ok: false, reason: reason }; }

  function normalizeName(s) { return S.normalizeName(s); }

  // まだ誰も使っていない先頭のアイコン
  function freeIcon(state) { return S.freeIconIn(state.profiles); }

  function addProfile(state, name, icon, id, today) {
    if (state.profiles.length >= MAX) return fail(state, 'full');
    var nm = S.normalizeName(name), label;
    if (nm.ok) label = nm.name;
    else if (nm.reason === 'empty') label = S.nextName(state.profiles);
    else return fail(state, nm.reason);
    if (typeof id !== 'string' || indexOf(state, id) >= 0) return fail(state, 'id');
    var used = state.profiles.some(function (p) { return p.icon === icon; });
    var ic = (ICON_ORDER.indexOf(icon) >= 0 && !used) ? icon : freeIcon(state);
    var next = clone(state);
    next.profiles.push(S.defaultProfile(id, label, ic, today));
    return { state: next, ok: true, reason: '' };
  }

  function renameProfile(state, id, name) {
    var i = indexOf(state, id);
    if (i < 0) return fail(state, 'none');
    var nm = S.normalizeName(name);
    if (!nm.ok) return fail(state, nm.reason);
    var next = clone(state);
    next.profiles[i].name = nm.name;
    return { state: next, ok: true, reason: '' };
  }

  // 他の子が使っているアイコン・不正値は変えない
  function setIcon(state, id, icon) {
    var i = indexOf(state, id);
    if (i < 0 || ICON_ORDER.indexOf(icon) < 0) return state;
    if (state.profiles.some(function (p) { return p.id !== id && p.icon === icon; })) return state;
    var next = clone(state);
    next.profiles[i].icon = icon;
    return next;
  }

  // 最後の 1 人は消せない
  function removeProfile(state, id) {
    var i = indexOf(state, id);
    if (i < 0) return fail(state, 'none');
    if (state.profiles.length <= 1) return fail(state, 'last');
    var next = clone(state);
    next.profiles.splice(i, 1);
    if (next.device.lastProfileId === id) next.device.lastProfileId = next.profiles[0].id;
    return { state: next, ok: true, reason: '' };
  }

  function selectProfile(state, id) {
    if (indexOf(state, id) < 0) return state;
    var next = clone(state);
    next.device.lastProfileId = id;
    return next;
  }

  // lastProfileId の子（いなければ先頭）。state の中の要素そのものを返す
  function currentProfile(state) {
    var i = indexOf(state, state.device && state.device.lastProfileId);
    return state.profiles[i < 0 ? 0 : i];
  }

  // 直前に遊んだ子が先頭、残りは作った順
  function orderForPicker(state) {
    var cur = currentProfile(state);
    return [cur].concat(state.profiles.filter(function (p) { return p !== cur; }));
  }

  var api = {
    ICON_ORDER: ICON_ORDER, MAX_PROFILES: MAX, freeIcon: freeIcon, addProfile: addProfile, renameProfile: renameProfile,
    setIcon: setIcon, removeProfile: removeProfile, selectProfile: selectProfile, currentProfile: currentProfile,
    orderForPicker: orderForPicker, normalizeName: normalizeName
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.profiles = api; }
})(typeof window !== 'undefined' ? window : globalThis);
