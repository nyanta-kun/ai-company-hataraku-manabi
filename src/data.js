// 固定データ（単語表・車の一覧・現場）。ブラウザでは window.Manabi.data、Node では module.exports。
(function (root) {
  'use strict';

  // 国語の単語表（plan-katakana-english.md 2.3。ひらがな 31語・頭文字 26種）。speech は読み上げ用（すべてひらがな）。
  // pic は絵の種類: 'v1'..'v11' / 'hose' / 'flame' / 新しい絵の id（vehicles.js の pics）
  // cat は分類（偏り防止に使う）: road 道路の車 / rail 電車 / sky 空 / sea 水 / fire 消防・救助 / work その他の働く車
  // kata はカタカナで書く語のカタカナ表記（カタカナ段階 K4〜K6 で使う予定。今は出題に使わない）
  var WORDS = [
    { id: 'hashigo',    label: 'はしごしゃ',           speech: 'はしごしゃ',           head: 'は', example: 'はしご',       pic: 'v10',        cat: 'fire', group: 'A' },
    { id: 'neko',       label: 'ねこぐるま',           speech: 'ねこぐるま',           head: 'ね', example: 'ねこ',         pic: 'v1',         cat: 'work', group: 'A' },
    { id: 'gomi',       label: 'ごみしゅうしゅうしゃ', speech: 'ごみしゅうしゅうしゃ', head: 'ご', example: 'ごみ',         pic: 'v3',         cat: 'road', group: 'A' },
    { id: 'mizu',       label: 'みずたんくしゃ',       speech: 'みずたんくしゃ',       head: 'み', example: 'みず',         pic: 'v9',         cat: 'fire', group: 'A' },
    { id: 'dump',       label: 'だんぷかー',           speech: 'だんぷかー',           head: 'だ', example: 'だんぷ',       pic: 'v6',         cat: 'road', group: 'A', kata: 'ダンプカー' },
    { id: 'buru',       label: 'ぶるどーざー',         speech: 'ぶるどーざー',         head: 'ぶ', example: 'ぶるどーざー', pic: 'v5',         cat: 'work', group: 'B', kata: 'ブルドーザー' },
    { id: 'hose',       label: 'ほーす',               speech: 'ほーす',               head: 'ほ', example: 'ほーす',       pic: 'hose',       cat: 'fire', group: 'B', kata: 'ホース' },
    { id: 'hi',         label: 'ひ',                   speech: 'ひ',                   head: 'ひ', example: 'ひ',           pic: 'flame',      cat: 'fire', group: 'B' },
    { id: 'airplane',   label: 'ひこうき',             speech: 'ひこうき',             head: 'ひ', example: 'ひこうき',     pic: 'airplane',   cat: 'sky',  group: 'A' },
    { id: 'train',      label: 'でんしゃ',             speech: 'でんしゃ',             head: 'で', example: 'でんしゃ',     pic: 'train',      cat: 'rail', group: 'A' },
    { id: 'shinkansen', label: 'しんかんせん',         speech: 'しんかんせん',         head: 'し', example: 'しんかんせん', pic: 'shinkansen', cat: 'rail', group: 'A', kata: 'シンカンセン' },
    { id: 'ship',       label: 'ふね',                 speech: 'ふね',                 head: 'ふ', example: 'ふね',         pic: 'ship',       cat: 'sea',  group: 'A' },
    { id: 'steam',      label: 'きかんしゃ',           speech: 'きかんしゃ',           head: 'き', example: 'きかんしゃ',   pic: 'steam',      cat: 'rail', group: 'B' },
    { id: 'postcar',    label: 'ゆうびんしゃ',         speech: 'ゆうびんしゃ',         head: 'ゆ', example: 'ゆうびん',     pic: 'postcar',    cat: 'road', group: 'B' },
    { id: 'rocket',     label: 'ろけっと',             speech: 'ろけっと',             head: 'ろ', example: 'ろけっと',     pic: 'rocket',     cat: 'sky',  group: 'A', kata: 'ロケット' },
    { id: 'taxi',       label: 'たくしー',             speech: 'たくしー',             head: 'た', example: 'たくしー',     pic: 'taxi',       cat: 'road', group: 'B', kata: 'タクシー' },
    { id: 'water',      label: 'みず',                 speech: 'みず',                 head: 'み', example: 'みず',         pic: 'water',      cat: 'fire', group: 'B' },
    { id: 'smoke',      label: 'けむり',               speech: 'けむり',               head: 'け', example: 'けむり',       pic: 'smoke',      cat: 'fire', group: 'B' },
    { id: 'bucket',     label: 'ばけつ',               speech: 'ばけつ',               head: 'ば', example: 'ばけつ',       pic: 'bucket',     cat: 'fire', group: 'B', kata: 'バケツ' },
    { id: 'ring',       label: 'うきわ',               speech: 'うきわ',               head: 'う', example: 'うきわ',       pic: 'ring',       cat: 'fire', group: 'B' },
    { id: 'station',    label: 'えき',                 speech: 'えき',                 head: 'え', example: 'えき',         pic: 'station',    cat: 'rail', group: 'B' },
    { id: 'motorbike',  label: 'おーとばい',           speech: 'おーとばい',           head: 'お', example: 'おーとばい',   pic: 'motorbike',  cat: 'road', group: 'B', kata: 'オートバイ' },
    { id: 'siren',      label: 'さいれん',             speech: 'さいれん',             head: 'さ', example: 'さいれん',     pic: 'siren',      cat: 'fire', group: 'B', kata: 'サイレン' },
    { id: 'pump',       label: 'ぽんぷ',               speech: 'ぽんぷ',               head: 'ぽ', example: 'ぽんぷ',       pic: 'pump',       cat: 'fire', group: 'B', kata: 'ポンプ' },
    { id: 'helmet',     label: 'へるめっと',           speech: 'へるめっと',           head: 'へ', example: 'へるめっと',   pic: 'helmet',     cat: 'fire', group: 'B', kata: 'ヘルメット' },
    { id: 'crane',      label: 'くれーん',             speech: 'くれーん',             head: 'く', example: 'くれーん',     pic: 'crane',      cat: 'work', group: 'B', kata: 'クレーン' },
    { id: 'truck',      label: 'とらっく',             speech: 'とらっく',             head: 'と', example: 'とらっく',     pic: 'truck',      cat: 'road', group: 'A', kata: 'トラック' },
    { id: 'patrol',     label: 'ぱとかー',             speech: 'ぱとかー',             head: 'ぱ', example: 'ぱとかー',     pic: 'patrol',     cat: 'road', group: 'A', kata: 'パトカー' },
    { id: 'heli',       label: 'へりこぷたー',         speech: 'へりこぷたー',         head: 'へ', example: 'へりこぷたー', pic: 'heli',       cat: 'sky',  group: 'A', kata: 'ヘリコプター' },
    { id: 'bus',        label: 'ばす',                 speech: 'ばす',                 head: 'ば', example: 'ばす',         pic: 'bus',        cat: 'road', group: 'A', kata: 'バス' },
    { id: 'roller',     label: 'ろーどろーらー',       speech: 'ろーどろーらー',       head: 'ろ', example: 'ろーどろーらー', pic: 'roller',   cat: 'work', group: 'B', kata: 'ロードローラー' }
  ];
  var SEEN_MAX = 12;   // 国語で「直近に出した絵」を覚える数
  // 直近の絵の一覧（古い順・末尾が最新）を整える。配列でない値・文字列以外・未知の絵・重複は捨てて、最新 SEEN_MAX 個にする
  function cleanSeen(v) {
    if (!Array.isArray(v)) return [];
    var known = {};
    WORDS.forEach(function (w) { known[w.pic] = true; });
    var out = [];
    v.forEach(function (x) {
      if (typeof x !== 'string' || !known[x]) return;
      var i = out.indexOf(x); if (i >= 0) out.splice(i, 1);
      out.push(x);
    });
    return out.slice(-SEEN_MAX);
  }
  // 出した絵を末尾に足した新しい一覧を返す（元は変えない）
  function addSeen(list, pics) { return cleanSeen(cleanSeen(list).concat(pics)); }
  var CATS = ['road', 'rail', 'sky', 'sea', 'fire', 'work'];

  // 形が似た文字の組。誤答には単語表の頭文字だけを使うので、実際に混ざるのは両方が頭文字にある組。
  // 清音と濁音・半濁音の組（は–ば、は–ぱ、ほ–ぽ、ふ–ぶ、た–だ 等）は、頭文字に無い側の文字（が・ざ・び・ぴ…）も載せておく
  var CONFUSABLE = [['は', 'ほ'], ['ね', 'ぬ'], ['み', 'め'], ['ご', 'こ'], ['だ', 'た'], ['ぶ', 'ぷ'],
    ['ば', 'ぱ'], ['ぽ', 'ほ'], ['さ', 'き'], ['で', 'て'], ['ろ', 'る'], ['ふ', 'ぶ'], ['け', 'は'], ['く', 'へ'],
    ['は', 'ば'], ['は', 'ぱ'], ['ひ', 'び'], ['ひ', 'ぴ'], ['へ', 'べ'], ['へ', 'ぺ'], ['ほ', 'ぼ'], ['ふ', 'ぷ'],
    ['き', 'ぎ'], ['く', 'ぐ'], ['け', 'げ'], ['さ', 'ざ'], ['し', 'じ'], ['と', 'ど'], ['か', 'が']];

  // 文字の「行」。清音・濁音・半濁音は別（K1・K2 では同じ行の文字を同時に出さない）
  var ROW = {
    'あ': 'a', 'い': 'a', 'う': 'a', 'え': 'a', 'お': 'a',
    'き': 'ka', 'け': 'ka', 'く': 'ka', 'ご': 'ga', 'さ': 'sa', 'し': 'sa', 'た': 'ta', 'と': 'ta', 'だ': 'da', 'で': 'da',
    'ね': 'na', 'は': 'ha', 'ひ': 'ha', 'ふ': 'ha', 'へ': 'ha', 'ほ': 'ha', 'ぶ': 'ba', 'ば': 'ba', 'ぱ': 'pa', 'ぽ': 'pa',
    'み': 'ma', 'ゆ': 'ya', 'ろ': 'ra'
  };
  // 行ファミリー（清音・濁音・半濁音をまとめた行）。出題の偏り防止（は行は1回に1問まで）に使う
  var FAMILY = {
    'あ': 'a', 'い': 'a', 'う': 'a', 'え': 'a', 'お': 'a',
    'き': 'ka', 'け': 'ka', 'く': 'ka', 'ご': 'ka', 'さ': 'sa', 'し': 'sa', 'た': 'ta', 'と': 'ta', 'だ': 'ta', 'で': 'ta',
    'ね': 'na', 'は': 'ha', 'ひ': 'ha', 'ふ': 'ha', 'へ': 'ha', 'ほ': 'ha', 'ぶ': 'ha', 'ば': 'ha', 'ぱ': 'ha', 'ぽ': 'ha',
    'み': 'ma', 'ゆ': 'ya', 'ろ': 'ra'
  };

  // はたらく車 11 種（stage は hataraku-drop の段階 = vehicles.js の draw[stage]）
  var CARS = [
    { id: 'nekoguruma', stage: 1,  name: 'ねこぐるま' },
    { id: 'forklift',   stage: 2,  name: 'ふぉーくりふと' },
    { id: 'gomi',       stage: 3,  name: 'ごみしゅうしゅうしゃ' },
    { id: 'shovel',     stage: 4,  name: 'しょべるかー' },
    { id: 'bulldozer',  stage: 5,  name: 'ぶるどーざー' },
    { id: 'dump',       stage: 6,  name: 'だんぷかー' },
    { id: 'kyukyu',     stage: 7,  name: 'きゅうきゅうしゃ' },
    { id: 'shoubousha', stage: 8,  name: 'しょうぼうしゃ' },
    { id: 'mizutank',   stage: 9,  name: 'みずたんくしゃ' },
    { id: 'hashigo',    stage: 10, name: 'はしごしゃ' },
    { id: 'chodai',     stage: 11, name: 'ちょうだいはしごしゃ' }
  ];

  // 現場 3 種と、関連する車（ごほうび抽選で優先）
  var SCENES = ['kaji', 'takai', 'michi'];
  var SCENE_CARS = {
    kaji:  ['shoubousha', 'mizutank', 'hashigo', 'chodai'],
    takai: ['hashigo', 'chodai', 'shoubousha'],
    michi: ['shovel', 'bulldozer', 'dump', 'kyukyu']
  };

  // 数の読み（し ではなく よん）
  var NUM_KANA = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう', 'じゅう'];

  // 時刻の読み（数の読みとは別。よじ・しちじ・くじ）。index = 時 1..12
  var TIME_KANA = ['', 'いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ', 'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ', 'じゅうにじ'];

  var api = {
    TIME_KANA: TIME_KANA, WORDS: WORDS, CATS: CATS, SEEN_MAX: SEEN_MAX, cleanSeen: cleanSeen, addSeen: addSeen, CONFUSABLE: CONFUSABLE, ROW: ROW, FAMILY: FAMILY, CARS: CARS,
    SCENES: SCENES, SCENE_CARS: SCENE_CARS, NUM_KANA: NUM_KANA
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.data = api; }
})(typeof window !== 'undefined' ? window : globalThis);
