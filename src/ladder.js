// レベルの階段（design-elementary 3.3〜3.6）。ステージの区切り・関門の判定・昇格・手動の解放と再ロック。
// 純粋関数のみ（元の profile は書き換えず、新しい profile を返す）。依存: data.js / problems.js
// ブラウザでは window.Manabi.ladder、Node では module.exports。
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var D = node ? require('./data.js') : root.Manabi.data;
  var P = node ? require('./problems.js') : root.Manabi.problems;
  var STAGES = D.STAGES;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function lastOf(a) { return a[a.length - 1]; }

  // 今遊ぶステージ（解放済みより上は使わない）
  function currentStage(profile) {
    var st = profile.stage || {}, ui = Math.max(0, D.stageIndex(st.unlocked)), ci = D.stageIndex(st.current);
    return STAGES[Math.min(ci < 0 ? 0 : ci, ui)].id;
  }

  // 出題するレベルと、復習かどうか（3.3 の表）
  //  lv が範囲の中 → lv / 範囲より下 → 範囲の最初 / 範囲より上（下のステージで遊ぶ＝復習）→ 範囲の最後。復習は進み具合を変えない
  function playLevel(profile, game) {
    var range = D.stageRange(currentStage(profile), game), lv = profile.levels[game];
    if (range.indexOf(lv) >= 0) return { level: lv, review: false };
    var all = D.LEVELS[game];
    if (all.indexOf(lv) < all.indexOf(range[0])) return { level: range[0], review: false };
    return { level: lastOf(range), review: true };
  }

  // 出動が終わった後の進み具合。level = 実際に遊んだレベル、review = playLevel が返した復習かどうか
  // → { profile, promotedTo }。levels の更新（復習なら更新しない）、cleared の記録、昇格判定
  function afterSession(profile, game, level, firstTry, review, today) {
    var p = clone(profile), s = currentStage(p);
    if (!review) p.levels[game] = P.nextLevel(game, level, firstTry, p.locked[game], D.stageRange(s, game));
    // 関門の記録は、どのステージで遊んでも付ける（すでにあれば日付を変えない）。解放を決めるのは下の判定
    if (firstTry >= P.QUESTIONS_PER_SESSION && D.gateLevels().indexOf(level) >= 0 && !p.cleared[level]) p.cleared[level] = today;
    var promotedTo = null, ui = D.stageIndex(p.stage.unlocked), gate = D.gateOf(p.stage.unlocked);
    if (gate && ui < STAGES.length - 1 && Object.keys(gate).every(function (g) { return !!p.cleared[gate[g]]; })) {
      var next = STAGES[ui + 1].id;
      p.stage.unlocked = next;
      if (!p.promoted[next]) p.promoted[next] = today;
      promotedTo = next;   // current は変えない（子どもが自分で「すすむ」を選ぶ）
    }
    return { profile: p, promotedTo: promotedTo };
  }

  // 関門の状態 { math: '2026-11-02' | '', ... }
  function gateStatus(profile, stageId) {
    var gate = D.gateOf(stageId);
    if (!gate) return null;
    var out = {};
    Object.keys(gate).forEach(function (g) { out[g] = profile.cleared[gate[g]] || ''; });
    return out;
  }

  // 手動の解放。unlocked を stageId まで上げ、promoted に今日（すでにあれば変えない）。current は変えない
  function unlockStage(profile, stageId, today) {
    var p = clone(profile), t = D.stageIndex(stageId), u = D.stageIndex(p.stage.unlocked);
    if (t <= u) return p;
    for (var i = u + 1; i <= t; i++) if (!p.promoted[STAGES[i].id]) p.promoted[STAGES[i].id] = today;
    p.stage.unlocked = stageId;
    return p;
  }

  // 手動の再ロック。unlocked を stageId の 1 つ下へ。stageId 以上を開く関門の記録（cleared）と promoted を消し、
  // current とレベルを新しい unlocked の範囲に丸める
  function relockStage(profile, stageId) {
    var p = clone(profile), t = D.stageIndex(stageId);
    if (t < 1 || t > D.stageIndex(p.stage.unlocked)) return p;
    var below = STAGES[t - 1].id;
    p.stage.unlocked = below;
    for (var i = t - 1; i < STAGES.length; i++) {
      var gate = D.gateOf(STAGES[i].id);
      if (gate) Object.keys(gate).forEach(function (g) { delete p.cleared[gate[g]]; });
    }
    for (var j = t; j < STAGES.length; j++) delete p.promoted[STAGES[j].id];
    if (D.stageIndex(p.stage.current) > t - 1) p.stage.current = below;
    D.GAMES.forEach(function (g) {
      var all = D.LEVELS[g], top = D.topLevelUpTo(below, g);
      if (all.indexOf(p.levels[g]) > all.indexOf(top)) p.levels[g] = top;
    });
    return p;
  }

  // 子どもが「すすむ」を選んだ・札をタップした。解放済みのステージだけ
  function selectStage(profile, stageId) {
    var p = clone(profile), i = D.stageIndex(stageId);
    if (i < 0 || i > D.stageIndex(p.stage.unlocked)) return p;
    p.stage.current = stageId;
    return p;
  }

  // 解放済みのステージの範囲にあるレベル（保護者画面のドロップダウン用）
  function selectableLevels(profile, game) {
    var top = D.topLevelUpTo(profile.stage.unlocked, game), all = D.LEVELS[game];
    return all.slice(0, all.indexOf(top) + 1);
  }

  // 保護者がレベル L を選んだとき: いまのステージの範囲に L が無ければ、L のステージに揃える（表示と出題の食い違いを防ぐ）
  function chooseLevel(profile, game, level) {
    var p = clone(profile);
    if (D.LEVELS[game].indexOf(level) < 0 || selectableLevels(p, game).indexOf(level) < 0) return p;
    p.levels[game] = level;
    if (D.stageRange(currentStage(p), game).indexOf(level) < 0) p.stage.current = D.stageOf(level);
    return p;
  }

  var api = {
    STAGES: STAGES, GATE_GAMES: D.GATE_GAMES, stageOf: D.stageOf, stageRange: D.stageRange, gateOf: D.gateOf,
    currentStage: currentStage, playLevel: playLevel, afterSession: afterSession, gateStatus: gateStatus,
    unlockStage: unlockStage, relockStage: relockStage, selectStage: selectStage, selectableLevels: selectableLevels, chooseLevel: chooseLevel
  };
  if (node) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.ladder = api; }
})(typeof window !== 'undefined' ? window : globalThis);
