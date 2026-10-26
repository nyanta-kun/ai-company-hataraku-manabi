// 固定データ（単語表・車の一覧・現場）。ブラウザでは window.Manabi.data、Node では module.exports。
(function (root) {
  'use strict';

  // 国語の単語表（plan-katakana-english.md 2.3。ひらがな 31語・頭文字 26種）。speech は読み上げ用（すべてひらがな）。
  // pic は絵の種類: 'v1'..'v11' / 'hose' / 'flame' / 新しい絵の id（vehicles.js の pics）
  // cat は分類（偏り防止に使う）: road 道路の車 / rail 電車 / sky 空 / sea 水 / fire 消防・救助 / work その他の働く車
  // kata はカタカナで書く語のカタカナ表記（K4〜K6 で KATA_WORDS として使う）
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
  // カタカナの単語表（K4〜K6。plan 2.3）。WORDS の kata 付きの語から作る。表記はカタカナ、読み上げ・例語はひらがな。id は _k、script は 'kata'
  var KATA_WORDS = WORDS.filter(function (w) { return w.kata; }).map(function (w) {
    return { id: w.id + '_k', label: w.kata, speech: w.speech, head: w.kata.charAt(0), example: w.example, pic: w.pic, cat: w.cat, group: w.group, script: 'kata' };
  });
  var ALL_WORDS = WORDS.concat(KATA_WORDS);
  // 頭文字にならないが、まぎらわしい相手として出すカタカナ（plan 2.4）と、その例語
  var EXTRA_KATA = { 'ケ': 'けーき', 'プ': 'ぷりん', 'ボ': 'ぼーる', 'ベ': 'べんち', 'ド': 'どあ', 'ツ': 'つみき' };
  // カタカナ → ひらがな（同じ音かどうかの判定に使う）
  function toHira(s) {
    return String(s).replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  }
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

  // カタカナで形が似た文字の組（plan 2.4）。ソ–ン は語が無いので出題には使われない
  var CONFUSABLE_KATA = [['ク', 'ケ'], ['ダ', 'タ'], ['ブ', 'プ'], ['バ', 'パ'], ['ポ', 'ホ'], ['ポ', 'ボ'], ['ホ', 'ボ'],
    ['ヘ', 'ベ'], ['ト', 'ド'], ['シ', 'ツ'], ['ソ', 'ン'], ['ク', 'タ']];

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

  // カタカナの文字は、対応するひらがなと同じ行・行ファミリーにする。追加文字（ケ プ ボ ベ ド ツ）は下で足す
  Object.keys(ROW).forEach(function (h) {
    var k = String.fromCharCode(h.charCodeAt(0) + 0x60);
    ROW[k] = ROW[h]; FAMILY[k] = FAMILY[h];
  });
  ROW['ケ'] = 'ka'; ROW['プ'] = 'pa'; ROW['ボ'] = 'ba'; ROW['ベ'] = 'ba'; ROW['ド'] = 'da'; ROW['ツ'] = 'ta';
  FAMILY['ケ'] = 'ka'; FAMILY['プ'] = 'ha'; FAMILY['ボ'] = 'ha'; FAMILY['ベ'] = 'ha'; FAMILY['ド'] = 'ta'; FAMILY['ツ'] = 'ta';

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

  // 救助隊の車 4 種（S1・S2 で遊んだときだけごほうびに出る。design-elementary 3.12）。stage は vehicles.js の pics の id（文字列）、sound は audio.js の車の音の名前。
  // 読み上げ・表示の名前はひらがなのまま（CAR_YOMI に足さない）。実在メーカーのロゴは描かない
  var RESCUE_CARS = [
    { id: 'rescuework', stage: 'rescueWork', name: 'きゅうじょこうさくしゃ', sound: 'car4' },
    { id: 'rescuechem', stage: 'rescueChem', name: 'かがくしょうぼうしゃ',   sound: 'car9' },
    { id: 'rescuecmd',  stage: 'rescueCmd',  name: 'しきしゃ',               sound: 'car7' },
    { id: 'rescueheli', stage: 'rescueHeli', name: 'きゅうじょへり',         sound: 'car11' }
  ];
  var ALL_CARS = CARS.concat(RESCUE_CARS);
  // ごほうびに救助隊の車が出始めるステージの番号（0 = S0）
  var RESCUE_FROM = 1;

  // 読み上げ用の表記（漢字・カタカナまじり）。ひらがなだけだと端末の読み上げが語の切れ目やアクセントを決められず平坦になるため。
  // 「はしご車」「ごみ収集車」「郵便車」などは「くるま」と読まれるので、〜しゃ の語はひらがなのまま（無い語は speech / name を読む）。
  // 画面の文字・頭文字の判定には使わない。語の id（WORDS / CARS）→ 表記。無い語は、カタカナ表記があればそれを、無ければ speech / name を読む
  var YOMI = {
    mizu: 'みずタンクしゃ', hi: '火', airplane: '飛行機', train: '電車', shinkansen: '新幹線',
    ship: '船', steam: '機関車', water: '水', smoke: '煙', ring: '浮き輪', station: '駅'
  };
  var CAR_YOMI = {
    forklift: 'フォークリフト', shovel: 'ショベルカー', bulldozer: 'ブルドーザー', dump: 'ダンプカー',
    kyukyu: '救急車', shoubousha: '消防車', mizutank: 'みずタンクしゃ'
  };

  // 現場 3 種と、関連する車（ごほうび抽選で優先）
  var SCENES = ['kaji', 'takai', 'michi'];
  var SCENE_CARS = {
    kaji:  ['shoubousha', 'mizutank', 'hashigo', 'chodai'],
    takai: ['hashigo', 'chodai', 'shoubousha'],
    michi: ['shovel', 'bulldozer', 'dump', 'kyukyu']
  };
  // 救助隊の車と関連する現場（S1 以上のごほうび抽選でだけ使う。SCENE_CARS は変えない）
  var RESCUE_SCENE_CARS = {
    kaji:  ['rescuechem', 'rescuecmd'],
    takai: ['rescueheli', 'rescuecmd'],
    michi: ['rescuework', 'rescueheli']
  };

  // 数の読み（し ではなく よん）。index = 数 0..100（0 は ''）。11〜99 は十の位 + 一の位でつなぐ
  var NUM_KANA = (function () {
    var ones = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'], a = [''], n;
    for (n = 1; n <= 100; n++) {
      if (n === 100) { a.push('ひゃく'); continue; }
      var t = Math.floor(n / 10), o = n % 10;
      a.push((t === 0 ? '' : t === 1 ? 'じゅう' : ones[t] + 'じゅう') + ones[o]);
    }
    return a;
  })();

  // ---- レベルの階段（design-elementary 3.1）。ステージは LEVELS の上に重ねる「区切り」。STAGES を正として LEVELS を組み立てる ----
  // 呼び名（rank）は仮（U18）。letter/clock/english が空のステージは、一番近い下のステージの範囲で遊ぶ（stageRange）
  var STAGES = [
    { id: 'S0', rank: 'みならい しょうぼうし', short: 'みならい', grade: 'みしゅうがく',
      levels: { math: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'], letter: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'], clock: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'], english: ['E1', 'E2', 'E3'] } },
    { id: 'S1', rank: 'しょうぼうし', short: 'しょうぼうし', grade: '小学1年生くらい',
      levels: { math: ['M8', 'M9', 'M10'], letter: ['K7', 'K8'], clock: ['T7'], english: ['E4', 'E5'] } },
    // S2: えいごは追加なし（S1 の範囲で遊ぶ。stageRange）
    { id: 'S2', rank: 'たいいん', short: 'たいいん', grade: '小学2年生くらい',
      levels: { math: ['M11', 'M12', 'M13'], letter: ['K9'], clock: ['T8'], english: [] } }
  ];
  var GAMES = ['math', 'letter', 'clock', 'english'];
  var GATE_GAMES = ['math', 'letter', 'clock'];   // えいごは関門に入れない（U2）
  var LEVELS = {};
  GAMES.forEach(function (g) {
    LEVELS[g] = [];
    STAGES.forEach(function (s) { LEVELS[g] = LEVELS[g].concat(s.levels[g]); });
  });
  function stageIndex(id) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i; return -1; }
  function stageOf(levelId) {
    for (var i = 0; i < STAGES.length; i++) for (var j = 0; j < GAMES.length; j++) if (STAGES[i].levels[GAMES[j]].indexOf(levelId) >= 0) return STAGES[i].id;
    return null;
  }
  // そのステージで遊ぶレベル列。そのゲームのレベルが無いステージは、レベルを持つ一番近い下のステージの列
  function stageRange(stageId, game) {
    for (var i = stageIndex(stageId); i >= 0; i--) if (STAGES[i].levels[game] && STAGES[i].levels[game].length) return STAGES[i].levels[game].slice();
    return [];
  }
  // ステージの関門 = GATE_GAMES の各ゲームについて、そのステージの最後のレベル（レベルの無いゲームは含めない）。
  // 次のステージを開く条件になる。次のステージが無いうちは、記録（cleared）だけ付いて何も開かない
  function gateOf(stageId) {
    var i = stageIndex(stageId);
    if (i < 0) return null;
    var out = {};
    GATE_GAMES.forEach(function (g) { var l = STAGES[i].levels[g]; if (l && l.length) out[g] = l[l.length - 1]; });
    return out;
  }
  // 関門レベルの集合（cleared に残してよいキー）
  function gateLevels() {
    var out = [];
    STAGES.forEach(function (s) { var g = gateOf(s.id); if (g) GATE_GAMES.forEach(function (k) { if (g[k]) out.push(g[k]); }); });
    return out;
  }
  // ステージ stageId まで（それ以下）で遊べる、そのゲームの一番上のレベル
  function topLevelUpTo(stageId, game) {
    var out = LEVELS[game][0];
    for (var i = 0; i <= stageIndex(stageId); i++) { var l = STAGES[i].levels[game]; if (l && l.length) out = l[l.length - 1]; }
    return out;
  }

  // ---- K7（S1）: 小さい「ゃゅょ」のある語の最初の音。head は 2 文字（しょ）。label・speech はひらがなのみ ----
  // pic は絵の種類（乗り物の絵はすでにある）。同じ出動に同じ絵・同じ音を重ねない（problems.js）
  var YOUON_WORDS = [
    { id: 'kyukyu',   label: 'きゅうきゅうしゃ',   head: 'きゅ', pic: 'v7' },
    { id: 'shobo',    label: 'しょうぼうしゃ',     head: 'しょ', pic: 'v8' },
    { id: 'shoberu',  label: 'しょべるかー',       head: 'しょ', pic: 'v4' },
    { id: 'chodai',   label: 'ちょうだいはしごしゃ', head: 'ちょ', pic: 'v11' },
    { id: 'jouki',    label: 'じょうききかんしゃ', head: 'じょ', pic: 'steam' },
    { id: 'kyakusen', label: 'きゃくせん',         head: 'きゃ', pic: 'ship' },
    { id: 'ryokaku',  label: 'りょかくき',         head: 'りょ', pic: 'airplane' },
    { id: 'junkan',   label: 'じゅんかんばす',     head: 'じゅ', pic: 'bus' }
  ];
  // 拗音の組み立てに使う: 小さい字と大きい字の対応、頭の子音（誤答用）
  var YOUON_SMALL = { 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ' };
  var YOUON_CONS = ['き', 'し', 'ち', 'に', 'ひ', 'み', 'り', 'ぎ', 'じ', 'び'];

  // ---- K8（S1）: 絵と読み上げから漢字を選ぶ。小学1年の配当漢字（学年別漢字配当表）から 20 字。
  // 方針: 絵で意味が決まり、読みが 1 つに決まる名詞だけ。読み上げ文（speech）はひらがなだけ。読みが同じ字（日と火）は入れない。
  // sim = 形が似た字のグループ。同じ問題の選択肢に同じグループを 2 つ並べない
  var KANJI_WORDS = [
    { ch: '火', yomi: 'ひ',     pic: 'flame',    speech: 'ひ。もえる ひ' },
    { ch: '水', yomi: 'みず',   pic: 'water',    speech: 'みず。のむ みず', sim: 'w' },
    { ch: '木', yomi: 'き',     pic: 'tree',     speech: 'き。はっぱの ある き', sim: 'w' },
    { ch: '山', yomi: 'やま',   pic: 'mountain', speech: 'やま。たかい やま' },
    { ch: '川', yomi: 'かわ',   pic: 'river',    speech: 'かわ。ながれる かわ' },
    { ch: '雨', yomi: 'あめ',   pic: 'rain',     speech: 'あめ。ふってくる あめ' },
    { ch: '花', yomi: 'はな',   pic: 'flower',   speech: 'はな。さいた はな' },
    { ch: '石', yomi: 'いし',   pic: 'stone',    speech: 'いし。ごろごろの いし' },
    { ch: '犬', yomi: 'いぬ',   pic: 'dog',      speech: 'いぬ。わんわん いぬ' },
    { ch: '虫', yomi: 'むし',   pic: 'bug',      speech: 'むし。ちいさな むし' },
    { ch: '空', yomi: 'そら',   pic: 'sky',      speech: 'そら。あおい そら' },
    { ch: '車', yomi: 'くるま', pic: 'taxi',     speech: 'くるま。はしる くるま' },
    { ch: '口', yomi: 'くち',   pic: 'mouth',    speech: 'くち。ごはんを たべる くち', sim: 'b' },
    { ch: '目', yomi: 'め',     pic: 'eye',      speech: 'め。ものを みる め', sim: 'b' },
    { ch: '耳', yomi: 'みみ',   pic: 'ear',      speech: 'みみ。おとを きく みみ', sim: 'b' },
    { ch: '手', yomi: 'て',     pic: 'hand',     speech: 'て。ばいばいの て' },
    { ch: '足', yomi: 'あし',   pic: 'foot',     speech: 'あし。はしる あし' },
    { ch: '糸', yomi: 'いと',   pic: 'thread',   speech: 'いと。ほそい いと' },
    { ch: '森', yomi: 'もり',   pic: 'forest',   speech: 'もり。きが たくさんの もり', sim: 'w' },
    { ch: '竹', yomi: 'たけ',   pic: 'bamboo',   speech: 'たけ。ながい たけ', sim: 'w' }
  ];
  // ---- K9（S2）: 同じ形で、小学2年の配当漢字から 20 字（学年別漢字配当表）。乗り物・時間・天気・季節の名詞だけ。
  // 方針は K8 と同じ（絵で意味が決まり、読みが 1 つに決まる語。読み上げ文はひらがなだけ）。読みが揺れる字（光・家・分・時・行・長・後・前・午 など）は入れない。
  // 時・分・午・前・後 は 絵で意味が決まらないので入れず、時間のつながりは 朝・昼・夜・春夏秋冬 で持たせた（とけい T8 の午前・午後の場面と同じ絵）。
  // sim = 形が似た字のグループ（雨かんむりの 電・雲・雪 / 馬・鳥 / 海・池 / 夏・冬）。同じ問題の選択肢に同じグループを 2 つ並べない
  var KANJI_WORDS2 = [
    { ch: '電', yomi: 'でん',   pic: 'bolt',    speech: 'でん。でんきの でん', sim: 'r' },
    { ch: '船', yomi: 'ふね',   pic: 'ship',    speech: 'ふね。うみを いく ふね' },
    { ch: '道', yomi: 'みち',   pic: 'road',    speech: 'みち。くるまが とおる みち' },
    { ch: '線', yomi: 'せん',   pic: 'rail',    speech: 'せん。せんろの せん' },
    { ch: '門', yomi: 'もん',   pic: 'gate',    speech: 'もん。おおきな もん' },
    { ch: '海', yomi: 'うみ',   pic: 'sea',     speech: 'うみ。なみの ある うみ', sim: 'w' },
    { ch: '池', yomi: 'いけ',   pic: 'pond',    speech: 'いけ。みずの たまった いけ', sim: 'w' },
    { ch: '馬', yomi: 'うま',   pic: 'horse',   speech: 'うま。ぱかぱか うま', sim: 'b' },
    { ch: '鳥', yomi: 'とり',   pic: 'bird',    speech: 'とり。そらを とぶ とり', sim: 'b' },
    { ch: '朝', yomi: 'あさ',   pic: 'morning', speech: 'あさ。おひさまが のぼる あさ' },
    { ch: '昼', yomi: 'ひる',   pic: 'noon',    speech: 'ひる。おひさまが たかい ひる' },
    { ch: '夜', yomi: 'よる',   pic: 'night',   speech: 'よる。おつきさまの でる よる' },
    { ch: '雲', yomi: 'くも',   pic: 'cloud',   speech: 'くも。しろい くも', sim: 'r' },
    { ch: '雪', yomi: 'ゆき',   pic: 'snow',    speech: 'ゆき。ふってくる ゆき', sim: 'r' },
    { ch: '風', yomi: 'かぜ',   pic: 'wind',    speech: 'かぜ。ふいてくる かぜ' },
    { ch: '星', yomi: 'ほし',   pic: 'star',    speech: 'ほし。きらきら ほし' },
    { ch: '春', yomi: 'はる',   pic: 'spring',  speech: 'はる。さくらの さく はる' },
    { ch: '夏', yomi: 'なつ',   pic: 'summer',  speech: 'なつ。あつい なつ', sim: 's' },
    { ch: '秋', yomi: 'あき',   pic: 'autumn',  speech: 'あき。はっぱが あかくなる あき' },
    { ch: '冬', yomi: 'ふゆ',   pic: 'winter',  speech: 'ふゆ。さむい ふゆ', sim: 's' }
  ];
  // 子ども向け画面に出してよい漢字（教材で出した漢字だけ。U4）。S0 はひらがなのみ。ステージごとに足す字（allowedKanji が下のステージの字も合わせる）
  var KANJI = { S0: [], S1: KANJI_WORDS.map(function (w) { return w.ch; }), S2: KANJI_WORDS2.map(function (w) { return w.ch; }) };
  // ステージ stageId まで（それ以下）で使ってよい漢字
  function allowedKanji(stageId) {
    var out = [], i = stageIndex(stageId);
    for (var k = 0; k <= i; k++) out = out.concat(KANJI[STAGES[k].id] || []);
    return out;
  }

  // ---- ふりがな（design-elementary 3.7）。文言は '{漢字|よみ}' の書き方で 1 つ持ち、表示のとき allowed（使ってよい漢字）に合わせて変える ----
  // furigana(markup, allowed) → [{ t:'…' }（ひらがななど）, { t:'車', r:'くるま' }（漢字とふりがな）]。
  // {漢字|よみ} の漢字が全部 allowed に入っていれば { t, r }、1 字でも入っていなければ読みのひらがな { t: よみ } にする（S0 は allowed が空＝全部ひらがな）
  function furigana(markup, allowed) {
    var set = {};
    (typeof allowed === 'string' ? allowed.split('') : allowed || []).forEach(function (c) { set[c] = true; });
    var out = [];
    function push(seg) {
      var last = out[out.length - 1];
      if (!seg.r && last && !last.r) last.t += seg.t; else out.push(seg);
    }
    String(markup).split(/(\{[^{}|]+\|[^{}|]+\})/).forEach(function (part) {
      if (!part) return;
      var m = /^\{([^{}|]+)\|([^{}|]+)\}$/.exec(part);
      if (!m) { push({ t: part }); return; }
      var ok = m[1].split('').every(function (c) { return set[c]; });
      push(ok ? { t: m[1], r: m[2] } : { t: m[2] });
    });
    return out;
  }
  // 子ども向け画面の文言（ふりがな付きの書き方）。固定の表だけ。子どもの名前など外から来る文字は通さない
  var TEXT = {
    pickSub: 'ぼくらは {火|ひ}を けす {車|くるま}の なかま！',   // 出動えらび（S1 以降だけ出す）
    rewardNew: 'あたらしい {車|くるま}！',                      // ごほうび（S0 では今までと同じ「あたらしい くるま！」）
    pickSub2: '{朝|あさ}も {夜|よる}も、{火|ひ}を けす {車|くるま}の たいいん！'   // 出動えらびの一行（S2 だけ。S1 の画面は pickSub のまま）
  };
  // T8（S2）: 午前・午後。場面ごとの時刻（1〜12 時の h と分 m）。朝は午前、夕方・夜は午後と絵で決まる場面だけを使う（昼の空は午前にも午後にもなるので出さない）。
  // scene: morning（日の出）/ evening（夕焼け）/ night（月と星）。時刻はちょうど・はんだけ
  var AMPM_CASES = (function () {
    var out = [];
    function add(hs, ap, scene) { hs.forEach(function (h) { [0, 30].forEach(function (m) { out.push({ h: h, m: m, ap: ap, scene: scene }); }); }); }
    add([6, 7, 8, 9], 'am', 'morning');
    add([4, 5, 6], 'pm', 'evening');
    add([7, 8, 9, 10], 'pm', 'night');
    return out;
  })();
  var AMPM_LABEL = { am: 'ごぜん', pm: 'ごご' };

  // 「◯はこ」の読み（M13。ひとはこ・さんばこ・ろっぱこ・はっぱこ。数の読みに「はこ」を付けると いちはこ・さんはこ になるため別に持つ）。index = 1..9
  var HAKO_KANA = ['', 'ひとはこ', 'ふたはこ', 'さんばこ', 'よんはこ', 'ごはこ', 'ろっぱこ', 'ななはこ', 'はっぱこ', 'きゅうはこ'];

  // 時刻の読み（数の読みとは別。よじ・しちじ・くじ）。index = 時 1..12
  var TIME_KANA = ['', 'いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ', 'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ', 'じゅうにじ'];

  // 分の読み（1 いっぷん…59。60 は いちじかん）。index = 分、0 は ''。5 の倍数の読みは S0（T4〜T6）から変えない。
  // 一の位: いっぷん・にふん・さんぷん・よんぷん・ごふん・ろっぷん・ななふん・はっぷん・きゅうふん。十の位: じゅう・にじゅう…。ちょうど 10 の倍数は じゅっぷん
  var MIN_KANA = (function () {
    var onesP = ['', 'いっぷん', 'にふん', 'さんぷん', 'よんぷん', 'ごふん', 'ろっぷん', 'ななふん', 'はっぷん', 'きゅうふん'];
    var tens = ['', 'じゅう', 'にじゅう', 'さんじゅう', 'よんじゅう', 'ごじゅう'], a = [''], m;
    for (m = 1; m <= 59; m++) {
      var t = Math.floor(m / 10), o = m % 10;
      a.push(o === 0 ? tens[t].replace(/う$/, '') + 'っぷん' : tens[t] + onesP[o]);
    }
    a.push('いちじかん');
    return a;
  })();

  // えいご E1 の語彙（plan 3.2。14語）。en は読み上げ用（小文字の英字とスペースだけ）、ja は日本語の補助（ひらがな）。
  // group が同じ語は同じ問題の選択肢に並べない（truck / fire truck / dump truck など「〜 truck」は聞き分けにくいので重機と同じ group）
  var ENGLISH_WORDS = [
    { id: 'fire',      en: 'fire truck',    ja: 'しょうぼうしゃ',       pic: 'v8',       group: 'heavy' },
    { id: 'ambulance', en: 'ambulance',     ja: 'きゅうきゅうしゃ',     pic: 'v7',       group: 'rescue' },
    { id: 'police',    en: 'police car',    ja: 'ぱとかー',             pic: 'patrol',   group: 'rescue' },
    { id: 'dump',      en: 'dump truck',    ja: 'だんぷかー',           pic: 'v6',       group: 'heavy' },
    { id: 'bulldozer', en: 'bulldozer',     ja: 'ぶるどーざー',         pic: 'v5',       group: 'heavy' },
    { id: 'garbage',   en: 'garbage truck', ja: 'ごみしゅうしゅうしゃ', pic: 'v3',       group: 'heavy' },
    { id: 'forklift',  en: 'forklift',      ja: 'ふぉーくりふと',       pic: 'v2',       group: 'heavy' },
    { id: 'truck',     en: 'truck',         ja: 'とらっく',             pic: 'truck',    group: 'heavy' },
    { id: 'bus',       en: 'bus',           ja: 'ばす',                 pic: 'bus',      group: 'road' },
    { id: 'taxi',      en: 'taxi',          ja: 'たくしー',             pic: 'taxi',     group: 'road' },
    { id: 'airplane',  en: 'airplane',      ja: 'ひこうき',             pic: 'airplane', group: 'trip' },
    { id: 'helicopter', en: 'helicopter',   ja: 'へりこぷたー',         pic: 'heli',     group: 'trip' },
    { id: 'ship',      en: 'ship',          ja: 'ふね',                 pic: 'ship',     group: 'trip' },
    { id: 'train',     en: 'train',         ja: 'でんしゃ',             pic: 'train',    group: 'trip' }
  ];
  // E4（S1）: いろ。同じ車を色ちがいで並べて選ぶ。en は読み上げ用、ja は日本語の補助（ひらがな）、hex は車の色
  // clash = 並べると見分けにくい組（同じ選択肢に出さない）
  var COLORS = [
    { id: 'red',    en: 'red',    ja: 'あか',     hex: '#e53935' },
    { id: 'blue',   en: 'blue',   ja: 'あお',     hex: '#1e6fe0' },
    { id: 'yellow', en: 'yellow', ja: 'きいろ',   hex: '#f6c933' },
    { id: 'green',  en: 'green',  ja: 'みどり',   hex: '#3f9b3f' },
    { id: 'orange', en: 'orange', ja: 'おれんじ', hex: '#f08a24' },
    { id: 'purple', en: 'purple', ja: 'むらさき', hex: '#8e44ad' },
    { id: 'pink',   en: 'pink',   ja: 'ぴんく',   hex: '#ff8fb3' },
    { id: 'black',  en: 'black',  ja: 'くろ',     hex: '#34384a' }
  ];
  var COLOR_CLASH = [['red', 'orange'], ['red', 'pink'], ['orange', 'yellow'], ['orange', 'pink'], ['blue', 'purple'], ['purple', 'pink']];   // どの色が答えでも、似ていない 4 色が残るようにしておく（テストで確かめる）
  // E5（S1）: アルファベットの大文字。出す文字は 23 字（I・L・O は 1・l・0 に見えるので使わない）。形が似た組は同じ選択肢に出さない
  var ALPHA_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'.split('');
  var ALPHA_CLASH = [['B', 'D'], ['B', 'P'], ['B', 'R'], ['P', 'R'], ['D', 'P'], ['D', 'Q'], ['C', 'G'], ['G', 'Q'], ['E', 'F'], ['F', 'P'], ['E', 'B'],
    ['M', 'N'], ['M', 'W'], ['N', 'H'], ['N', 'Z'], ['U', 'V'], ['V', 'W'], ['V', 'Y'], ['K', 'X'], ['T', 'Y'], ['S', 'Z'], ['U', 'J'], ['H', 'M'], ['D', 'G'], ['C', 'Q'], ['R', 'K']];

  // 英語の数（index = 数 1..10）
  var NUM_EN = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

  var api = {
    ENGLISH_WORDS: ENGLISH_WORDS, NUM_EN: NUM_EN, TIME_KANA: TIME_KANA, MIN_KANA: MIN_KANA, HAKO_KANA: HAKO_KANA, WORDS: WORDS, KATA_WORDS: KATA_WORDS, ALL_WORDS: ALL_WORDS, EXTRA_KATA: EXTRA_KATA, CONFUSABLE_KATA: CONFUSABLE_KATA, toHira: toHira, CATS: CATS, SEEN_MAX: SEEN_MAX, cleanSeen: cleanSeen, addSeen: addSeen, CONFUSABLE: CONFUSABLE, ROW: ROW, FAMILY: FAMILY, CARS: CARS, RESCUE_CARS: RESCUE_CARS, ALL_CARS: ALL_CARS, RESCUE_FROM: RESCUE_FROM, RESCUE_SCENE_CARS: RESCUE_SCENE_CARS,
    SCENES: SCENES, SCENE_CARS: SCENE_CARS, NUM_KANA: NUM_KANA, YOMI: YOMI, CAR_YOMI: CAR_YOMI,
    COLORS: COLORS, COLOR_CLASH: COLOR_CLASH, ALPHA_LETTERS: ALPHA_LETTERS, ALPHA_CLASH: ALPHA_CLASH,
    STAGES: STAGES, GAMES: GAMES, YOUON_WORDS: YOUON_WORDS, YOUON_SMALL: YOUON_SMALL, YOUON_CONS: YOUON_CONS, KANJI_WORDS: KANJI_WORDS, KANJI_WORDS2: KANJI_WORDS2, AMPM_CASES: AMPM_CASES, AMPM_LABEL: AMPM_LABEL, KANJI: KANJI, allowedKanji: allowedKanji, furigana: furigana, TEXT: TEXT,
     GATE_GAMES: GATE_GAMES, LEVELS: LEVELS, stageIndex: stageIndex, stageOf: stageOf, stageRange: stageRange, gateOf: gateOf, gateLevels: gateLevels, topLevelUpTo: topLevelUpTo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Manabi = root.Manabi || {}; root.Manabi.data = api; }
})(typeof window !== 'undefined' ? window : globalThis);
