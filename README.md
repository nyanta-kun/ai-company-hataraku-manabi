# hataraku-manabi

消防車など働く車が好きな未就学児向け、ひらがな・かずを学ぶWebアプリ

- 遊ぶ: `index.html` をブラウザで直接開く（ビルド・通信なし）。確認用は `index.html#debug`
- 企画書・設計書: `docs/`（`plan.md`、`design.md`）
- テスト: `scripts/test.sh`（CI も同じものを実行する）

## ライセンスと出典（なぞりがきの字形データ）

- `src/strokes.js`（なぞりがきの字形と書き順のデータ）だけは、**CC BY-SA 3.0** で配布する。出典は [KanjiVG](http://kanjivg.tagaini.net)（© Ulrich Apel、取得元 https://github.com/KanjiVG/kanjivg の tag r20260714 = commit d95a97627fd9fe5b2c8d06ca81e38149609c0c1e）。必要な字だけを選び、座標を整数に丸め、3 次ベジェに直した（変更内容はファイルの頭にも書いてある）。変換は `scripts/strokes/convert.js`（出力を commit する。ビルドでは動かさない）。
- このデータを読む `src/trace.js` などほかのコードは別ファイル。CC BY-SA の対象は `src/strokes.js` だけで、ほかのコードには及ばない。
- アプリの画面にも出典を表示する（保護者画面の「このアプリについて」。画面は W2 で入れる）。Web 公開するときも、公開先で見えること。
