// 読み上げ文の網羅テスト用の列挙（tests/lines.test.js・tests/voice-list.test.js が使う）。
// 全ゲーム × 全レベルを固定シードで出題し、ui.js が読み上げに渡す日本語の文を全部並べる。乱数を使うのはここだけ。
const D = require('../src/data.js');
const P = require('../src/problems.js');
const STR = require('../src/strokes.js');
const { rngOf } = require('./helpers.js');

const SESSIONS = 1000;
const NAME = 'たろう';   // 名前の文の確認用（名前は保護者が入れる）
const GAMES = ['math', 'letter', 'clock', 'english'];

// api = 文を作る関数の組（lines.js または旧 ui.js の写し）。戻り値: { texts: 名前を含まない全文の配列（重複あり）, names: 名前を含む文の配列 }
function enumerate(api) {
  const texts = [], names = [];
  let seed = 1;
  GAMES.forEach(game => P.LEVELS[game].forEach(level => {
    const rng = rngOf(seed++);
    for (let s = 0; s < SESSIONS; s++) {
      const qs = P.generateSession(game, level, rng);
      qs.forEach(q => {
        texts.push(api.prompt(q), api.correct(q), api.hint(q));
        (q.choices || []).forEach(v => { if (v !== q.answer) texts.push(api.wrong(q, v)); });
        if (['count', 'add', 'sub', 'mul'].includes(q.kind)) {
          const top = Math.max(+q.answer || 0, +q.n || 0, +q.a || 0, +q.b || 0);
          for (let n = 1; n <= top && n <= 100; n++) texts.push(api.number(n));
        }
      });
    }
  }));
  // かく・字の札: 130 字
  Object.keys(STR.SETS).forEach(k => STR.SETS[k].split('').forEach(ch => {
    texts.push(api.tracePrompt(ch, null), api.soloPrompt(ch), api.traceDone(ch, false), api.traceDone(ch, true), api.soloDone(ch), api.mojiSheet(ch));
    names.push(api.tracePrompt(ch, { why: 'name', exact: true, name: NAME }));
    texts.push(api.tracePrompt(ch, { why: 'name', exact: false, name: NAME }));   // 濁点・小さい字から来た字はいつもの声
  }));
  names.push(api.who(NAME).text);
  // ごほうび・昇格・しゃこ
  Object.keys(api.SET_LABEL).forEach(k => texts.push(api.license(k)));
  D.ALL_VEHICLES.forEach(car => texts.push(api.carGet(car), api.carYomi(car)));
  D.STAGES.slice(1).forEach(stg => texts.push(api.promote(stg)));
  D.SHELVES.forEach(sh => texts.push(sh.name));
  Object.keys(api.GAME_NAME).forEach(g => texts.push(api.shelfHow(g)));
  api.fixed.forEach(t => texts.push(t));
  return { texts, names };
}
module.exports = { enumerate, SESSIONS, NAME };
