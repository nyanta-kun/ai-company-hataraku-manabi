# VOICEVOX:四国めたん（voice/metan）

アプリの読み上げ（「たんまつの こえ」の代わり）に使う音声です。**自由に使える素材ではありません**（`voice/README.md`）。

- クレジット: VOICEVOX:四国めたん
- キャラクターの規約: https://zunko.jp/con_ongen_kiyaku.html（確認日 2026-10-27。書き出すたびに見直して日付を更新する）。クレジット必須・商用可
- VOICEVOX エンジン: 0.26.0（Docker `voicevox/voicevox_engine:cpu-arm64-0.26.0`、手元の Mac だけで動かした）
- スタイル: 四国めたん ノーマル（uuid 7ffcb7ce-00ec-4bdc-82cd-45a8889e43ff、id 2）
- 設定: {"speedScale":0.95,"pitchScale":0,"intonationScale":1.2,"volumeScale":1,"pauseLengthScale":0.6,"prePhonemeLength":0.05,"postPhonemeLength":0.05}
- 渡した文: 漢字まじり（画面の文字はひらがなのまま）。`scripts/voice/yomi.json`。抑揚の直し: `scripts/voice/accent.json`（直したあと /mora_pitch で高さを作り直した）
- 形式: AAC-LC 32kbps・24kHz・モノラル（ADTS の .aac。`afconvert -f adts -d aac -c 1 -b 32000`）
- 作った日: 2026-10-27、文の数 1076、音声の大きさ 合計 5.09 MB
- 作り方: `node scripts/voice/build.js --voice metan`（VOICEVOX エンジンを起動して。変わった文だけ作り直す。`--all` で全部）
