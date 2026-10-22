// 固定データ（単語表・車の一覧・現場）。ブラウザでは window.Manabi.data、Node では module.exports。
(function (root) {
  'use strict';

  // 国語の単語表（企画書 3.2）。speech は読み上げ用（すべてひらがな）。
  // pic は絵の種類: 'v1'..'v11' は vehicles.js の乗り物、'hose' / 'flame' は小物
  var WORDS = [
    { id: 'hashigo', label: 'はしごしゃ',           speech: 'はしごしゃ',           head: 'は', example: 'はしご',       pic: 'v10', group: 'A' },
    { id: 'neko',    label: 'ねこぐるま',           speech: 'ねこぐるま',           head: 'ね', example: 'ねこ',         pic: 'v1',  group: 'A' },
    { id: 'gomi',    label: 'ごみしゅうしゅうしゃ', speech: 'ごみしゅうしゅうしゃ', head: 'ご', example: 'ごみ',         pic: 'v3',  group: 'A' },
    { id: 'mizu',    label: 'みずタンクしゃ',       speech: 'みずたんくしゃ',       head: 'み', example: 'みず',         pic: 'v9',  group: 'A' },
    { id: 'dump',    label: 'だんぷかー',           speech: 'だんぷかー',           head: 'だ', example: 'だんぷ',       pic: 'v6',  group: 'A' },
    { id: 'buru',    label: 'ぶるどーざー',         speech: 'ぶるどーざー',         head: 'ぶ', example: 'ぶるどーざー', pic: 'v5',  group: 'B' },
    { id: 'hose',    label: 'ほーす',               speech: 'ほーす',               head: 'ほ', example: 'ほーす',       pic: 'hose', group: 'B' },
    { id: 'hi',      label: 'ひ',                   speech: 'ひ',                   head: 'ひ', example: 'ひ',           pic: 'flame', group: 'B' }
  ];

  // 形が似た文字の組（企画書 3.2）。単語表にある文字のみ誤答に使うので、実際に混ざるのは は–ほ だけ
  var CONFUSABLE = [['は', 'ほ'], ['ね', 'ぬ'], ['み', 'め'], ['ご', 'こ'], ['だ', 'た'], ['ぶ', 'ぷ']];

  // 文字の「行」。K2 では同じ行の文字を同時に出さない
  var ROW = { 'は': 'ha', 'ひ': 'ha', 'ほ': 'ha', 'ぶ': 'ba', 'ね': 'na', 'ご': 'ga', 'み': 'ma', 'だ': 'da' };

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

  var api = {
    WORDS: WORDS, CONFUSABLE: CONFUSABLE, ROW: ROW, CARS: CARS,
    SCENES: SCENES, SCENE_CARS: SCENE_CARS, NUM_KANA: NUM_KANA
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.data = api; }
})(typeof window !== 'undefined' ? window : globalThis);
