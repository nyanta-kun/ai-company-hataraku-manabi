# 設計メモ（MVP 実装）

企画書 `plan.md` に沿った実装の決定事項。数値の調整点は各ファイル先頭の定数（`QUESTIONS_PER_SESSION` など）。

## 構成（classic script。`file://` で index.html を直接開いて動く）
ブラウザは `window.Manabi.<名前>`、Node は `module.exports`（純粋関数のみ）。読み込み順は index.html のとおり。

| ファイル | 役割 | テスト |
|---|---|---|
| `src/data.js` | 単語表8語・車11種・現場と関連車・数の読み | tests |
| `src/problems.js` | 問題生成・`generateSession`・`nextLevel`（純粋関数） | `tests/problems.test.js`（性質1〜9） |
| `src/rewards.js` | `pickReward`（純粋関数） | `tests/rewards.test.js`（性質10） |
| `src/storage.js` | localStorage（`hataraku-manabi:v1`）。`normalize` で壊れたデータを補正、使えなければメモリのみ | `tests/storage.test.js` |
| `src/vehicles.js` | 乗り物の絵。hataraku-drop `src/render.js` の `draw[1..11]` と部品をコピー（対応は冒頭コメント） | 目視 |
| `src/audio.js` | Web Audio の効果音（外部ファイルなし） | 目視 |
| `src/speech.js` | 読み上げ・声なしモード判定 | 目視 |
| `src/scenes.js` | 現場・カード・タイトルの Canvas 描画 | 目視 |
| `src/ui.js` / `src/main.js` | 画面遷移・出動の流れ・保護者画面・`#debug` | 目視 |

## 決めたこと
- 国語の誤答: 単語表の8文字のみ。K1 は A グループ内、K2/K3 は8文字全体。K1・K2 は「行」が違う文字だけ出す。K3 は形が似た文字を混ぜてよいが、表の文字で組になるのは は–ほ だけ（他の組は相手の文字が単語表に無いので混ざらない）。
- 数の選択肢は昇順に並べる。たしざん M5 は和6以上を約75%（性質5は半分以上）。
- 出動の現場は3種を持ち回り（直前と同じ現場は避ける）。UI の経過は「4つのランプ」と現場の変化（火が小さく／はしごが伸びる／がれきが減り救急車が来る）。
- 声なしモード: `speechSynthesis` が無い、日本語音声が1.5秒以内に見つからない、読み上げ開始が2回連続で来ない、のいずれかで切り替え。声なし（または読み上げオフ）の国語は1回目の誤答で正解ボタンを光らせる。算数は数えるものが1つずつ跳ねて「ぽん」の音程が上がる。
- 描画は論理幅 800 固定・高さは canvas の縦横比に合わせる（スマホ縦横・PC で同じコード）。
- 長押し2秒: タイトルの歯車（保護者画面）、問題画面の×（タイトルへ）。
- 「もういちどきく」ボタンは、スマホ縦の幅360px でも答えボタン 72px を確保するため、企画書の左下ではなく上部右に置いた。
- 全車★3 の後の「ごほうびステッカー」は、カード画面で文言だけ出す（U5: 未実装）。

## 確認方法
- `scripts/test.sh`（`node --test tests/*.test.js`）。
- `index.html#debug` で確認パネル（レベル切替・全車★3・声なしモード・エラー表示 `#errlog`）。`#debug:play-math-M3-kaji-2`（画面-ゲーム-レベル-現場-進み）、`#debug:play-letter-K3-takai`、`#debug:reward-kaji`、`#debug:garage`、`#debug:parent`、`#debug:pick` で画面へ直接移動。
- 注意: 確認パネルの「ごほうび」（`#debug:reward-*`）は通常の出動と同じく、本物のごほうびとして保存する。子どもが使うブラウザでは開かず、確認は別のプロファイルで。`#debug:garage` は保存データをそのまま表示する（中身を見たいときは先に「全車★3」）。
