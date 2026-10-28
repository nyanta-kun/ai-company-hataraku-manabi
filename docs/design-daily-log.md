# 設計書「まいにちの きろく」（日ごとの学習実績）

作成: 設計部 / 日付: 2026-10-28 / 状態: 設計（実装前）。企画は `docs/plan-daily-log.md`（ユーザーの決定は企画 2 章）。

- 費用・外部依存: **増えない**。記録は今の localStorage の保存（`hataraku-manabi:v2`。`src/storage.js:8`）のプロフィールの中に足す。グラフは CSS、絵は今の Canvas。外部ライブラリ・通信なし。ビルドなし・classic script・`file://` で動く形のまま。新しい読み上げ文の音声は手元の VOICEVOX で作る（無料・今と同じ声とクレジット）。
- 承認: **要らない**。クラウド（R4）には送らない（10 章）。

---

## 0. 結論（先に）

| 項目 | 決めたこと（推奨） | 捨てた案 |
|---|---|---|
| 持ち方 | プロフィールの中に `days`（日付 → その日の合計）。新しい純粋関数の `src/daylog.js` | 出動ごとの行を貯める（大きく・時刻が要る）、別の localStorage のキー（プロフィールの削除と同期が二重になる） |
| 日付 | 端末の日付（今の `todayStr()` と同じ `YYYY-MM-DD`）。出動は終わった日に付ける | 朝 4 時で切り替え（今の `lastPlayed`・`cleared` と食い違う） |
| 期間 | 35 日（今週と前の 4 週）。週・月のまとめは作らない | 14 日（前の週しか見られない）、91 日（最小限の原則に対して長い。大きさは問題ない）、まとめ（規則と補正が倍になる） |
| 時間 | 出動の画面にいた時間を測り、1 回 600 秒で打ち切り、隠れている間は止める。合計の秒だけ持つ | 回数×2.5 分の換算（回数と同じ情報で意味が無い）、操作の間隔の合計（作りが大きい） |
| 保護者画面 | 月〜日の 7 行・CSS の横の積み上げ棒・週送り・タップで内訳・週の合計・できるようになったこと | canvas の縦の棒（文字が読めず、端末の倍率の扱いが要る） |
| 子ども向け | 「おしまい」の後の `s-today` 画面と、タイトルの小さな列。数字なし・スタンプ・王冠 1 つ | 出動えらびに印（薄い絵が押せない えいご と紛れる）、ごほうび画面に重ねる（ごほうびの主役を食う）、しゃこのタブ（遠い） |
| クラウド | 送らない。`toCloudProfile` で `seen` と一緒に外す | プロフィールの文書に入れる（ルールの式の上限を超える）、別の文書（費用と手間に見合わない） |

---

## 1. 現状（設計の前提）

- 出動を最後まで終えたときの記録は 2 か所: `finishSession`（`src/ui.js:759-771`。`stats.sessions++`・`st[game].questions += 4`・`firstTry`、`afterSession` で階段、`grantReward`、`lastPlayed = todayStr()`）と `finishTrace`（`src/ui.js:731-742`。かく・ひとりで かく の両方）。途中でやめる `quitSession`（`src/ui.js:773`）・`quitTrace`（`src/ui.js:744`）は数えない。
- かく の字は、途中でやめても書き終えた時点で数える: なぞり `onTraceCharDone`（`src/ui.js:577-586`。`recordTraceChar` の後に `stats.trace.chars++`）、ひとりで `soloDone` の合った枝（`src/ui.js:690-697`。`recordSolo` と `stats.trace.chars++`）。ひとりで かく で合わなかった字は なぞり に切り替わり、`onTraceCharDone` で数えられる。
- 初めて書く字の判定は今もある: `tboard.setChar(ch, !(data.trace.done[ch] > 0))`（`src/ui.js:571`）。めんきょ は `trun.license`（`src/ui.js:693`）で、日付は持っていない。
- 今の `stats` は合計だけ（`src/storage.js:29-36`）。なぞり と ひとりで は `stats.trace` に合わせて数えている。
- 関門と昇格は**日付つき**で既にある: `cleared[level] = today`（`src/ladder.js:41`）・`promoted[next] = today`（`src/ladder.js:46`）。保護者の手動の解放も `promoted` に今日を入れる（`src/ladder.js:65`）。再ロックは消す（`src/ladder.js:79-81`）。
- レベルの自動の上げ下げは `afterSession` の中の `P.nextLevel`（`src/ladder.js:38`、`src/problems.js:631`）。上がったかどうかは、呼ぶ前と後の `levels[game]` を比べれば分かる。
- ごほうびは `grantReward` → `R.applyReward`（`src/ui.js:753-757`）。戻り値の `r.isNew`・`r.id`・`r.sticker`（`src/rewards.js:84-92`）。
- 日付は端末の時計: `todayStr()`（`src/ui.js:12`）と `todayLocal()`（`src/storage.js:50`）が同じものを別々に持つ。純粋関数は `today` を引数で受ける流儀（`afterSession(..., today)`・`normalize(raw, id, today)`）。
- 保護者画面は「今えらんでいる子（`data`）」だけを出す作り（`fillParent`。`src/ui.js:1232-1263`、見出しの名札 `who-tag`。`index.html:169`）。カードの部品は `.card`・`.prow`（`css/style.css:200-211`）。`#parent-body` は幅 720px まで。
- 子ども向けの今の手がかり: タイトルの窓の灯り（`litWindows`。`src/ui.js:282`、合計の出動回数で 4 つまで）、もじの表のスタンプ（`stampURL`。`src/ui.js:973-990`、自分の車の丸いスタンプ・金の縁）。
- 画面の切り替えは `show(name)`（`src/ui.js:187-200`）。ごほうびの「おしまい」は `leaveReward('title')`（`src/ui.js:1453`）、昇格があれば先に昇格画面（`src/ui.js:841-844`）、昇格画面のボタンはどちらもタイトルへ（`src/ui.js:1458-1462`）。
- 画面が隠れたときの処理は、書きかけの線を捨てるだけ（`src/ui.js:1418`）。
- 保存は変わるたびに状態全体を `JSON.stringify` する（`src/storage.js:216-223`）。かく は 1 字ごとに保存している（`src/ui.js:583`）。
- R4 のルールはプロフィールの項目数を 15 に決め打ち（`firestore.rules:92`）。ルールの試験の `toCloudProfile` は `seen` を外してから送る（`tests-rules/rules.test.js:43-49`）。

---

## 2. データの形

### 2.1 置き場所の比較

| 案 | 内容 | 判断 |
|---|---|---|
| **A. プロフィールの中に `days`（採用）** | `profiles[i].days = { 'YYYY-MM-DD': 日 }` | プロフィールを消すと一緒に消える。「ぜんぶ けす」（`clear`）もそのまま効く。`normalizeProfile` の補正の流れに乗る。弱み: `afterSession` などの `clone`（`src/ladder.js:11`）で毎回複製されるが、35 日で数十 KB 以下なので問題ない |
| B. 別のキー（`hataraku-manabi:v2:days`） | 端末に `{ プロフィールid: { 日付: 日 } }` | 主の保存が小さいまま。ただし削除・壊れたときの退避・読み込みの順番を二重に作ることになり、プロフィールを消したのに日ごとの記録が残る抜けが出やすい。不採用 |

### 2.2 粒度の比較

| 案 | 内容 | 判断 |
|---|---|---|
| **日ごとの合計（採用）** | 1 日 1 つの小さな表 | 画面に要るのは日ごとの合計と「できたこと」だけ。時刻が要らない |
| 出動ごとの行 | 1 回ごとに `{ 時刻, ゲーム, レベル, 1 回目で正解 }` | 1 日に 20 回遊ぶと 20 行。時刻を持つことになり、R4 の「保存しないもの」（遊んだ時刻。`docs/r4-data-and-privacy.md:39`）と食い違う。不採用 |

### 2.3 1 日の形

```
days: {
  '2026-10-28': {
    math:    { sessions: 2, questions: 8, firstTry: 6 },   // かず・もじ・とけい・えいご は同じ形。遊ばなかったゲームは鍵ごと無い
    trace:   { sessions: 1, chars: 4 },                    // なぞり。sessions は最後まで終えた回数、chars は途中でやめても書き終えた字
    solo:    { sessions: 1, chars: 4 },                    // ひとりで かく（合わずに なぞりで書き終えた字も含む。合わなかった数は持たない）
    up:      { math: 'M5' },                               // その日に自動で上がった、いちばん上のレベル（ゲームごと）
    wrote:   'しつくへ',                                    // その日に書いた字（重ならない。書いた順）
    newChars:'へ',                                          // その日に初めて書き終えた字（wrote の中）
    newSolo: 'し',                                          // その日に初めて ひとりで書けた字（wrote の中）
    license: ['hira'],                                      // その日にもらった めんきょ（hira・kata・k1・k2）
    cards:   4,                                             // もらった ごほうびの数（★の追加・ステッカーも 1）
    newCars: ['bus'],                                       // その日に初めてもらった乗り物
    sec:     780,                                           // 出動の画面にいた秒（5 章）
    last:    'solo'                                         // その日に最後に終えた出動のゲーム（子ども向けの同点の決め方。9.3）
  }
}
```

- ゲームの名前は 6 つ: `math`・`letter`・`clock`・`english`・`trace`・`solo`。子ども向けでは `trace` と `solo` を「かく」にまとめる。
- 関門・昇格は持たない（`cleared`・`promoted` の日付から読む。1 章）。
- 鍵の名前は今の保存と同じく読める英語にする（短くしても 1 日 100 バイトほどしか減らない）。

### 2.4 大きさ

- ふつうの日（2〜3 ゲーム・5 回くらい）: JSON で約 150〜250 字。
- 多い日（6 ゲームすべて、書いた字 30 字、新しい乗り物 3 つ）: 約 400 字。
- 35 日 × 4 人をすべて多い日で埋めても約 56,000 字（UTF-16 で約 110 KB）。localStorage の上限の目安（5 MB 前後）から遠い。保存のたびの `JSON.stringify` も数ミリ秒以下。
- 件数の上限（6.2）で、壊れたデータや時計の狂いでも 40 日分を超えない。

---

## 3. 日付の決め方

- **鍵は端末の日付**（`todayStr()` と同じ `YYYY-MM-DD`）。今の `lastPlayed`・`cleared`・`promoted` と同じなので、「関門を通った日」と日ごとの行が必ず一致する。
- **日付が変わる時刻は 0 時**。朝 4 時などで切ると、`cleared` の日付とずれて「できるようになったこと」が別の日に出る。夜中に遊ぶ年齢ではないので 0 時で困らない。
- **日付をまたぐ出動**: 出動の回数・問題・ごほうび・時間は**終わった日**に付ける（`finishSession` が `todayStr()` を呼ぶ時点。`lastPlayed` と同じ）。かく の字は書き終えたその時の日付に付ける（今の `stats.trace.chars` と同じ時点）。23:59 に始めて 0:01 に終えた かく は、字が前の日・出動が次の日に分かれうるが、まれで実害が無いので受け入れる。
- **時差・時計の狂い**: 端末の日付をそのまま使う。記録するとき（6.1）に、今日より 2 日以上先の鍵は消す（時計を未来に合わせてから直したとき、その日の記録がずっと「いちばん新しい日」として残るのを防ぐ）。1 日先までは残す（西へ旅行して時差で日付が戻った場合）。
- **週**: 月曜はじまり（企画 U1）。曜日は鍵の文字列を `Date.UTC` で数に直して求める（端末の時差・夏時間の影響を受けない）。

---

## 4. 記録の起点（`src/ui.js` の結線。DL-2）

どれも純粋関数（7 章）に「今の `data.days`・今日・出来事」を渡し、返った新しい `days` を `data.days` に入れて、今と同じ `save()` で保存する。

| 時点 | 場所 | 呼ぶもの |
|---|---|---|
| 4 つのゲームの出動を終えた | `finishSession`（`src/ui.js:759`）。`afterSession` の**前**に `before = data.levels[game]`、後で `after` と比べ、`LEVELS[game]` の並びで上なら `up = after`。`grantReward` の戻り値 `r` | `DL.recordSession(days, today, { game, questions: 4, firstTry: run.firstTry, up, reward: r })` |
| かく の出動を終えた | `finishTrace`（`src/ui.js:731`）。`game = trun.solo ? 'solo' : 'trace'`、めんきょ `trun.license` | `DL.recordSession(days, today, { game, reward: r, license: trun.license })` |
| なぞりで 1 字書けた | `onTraceCharDone`（`src/ui.js:577`）。`recordTraceChar` の**前**に `first = !(data.trace.done[ch] > 0)` | `DL.recordChar(days, today, { game: trun.solo ? 'solo' : 'trace', ch, firstDone: first, firstSolo: false })` |
| ひとりで 1 字書けた | `soloDone` の合った枝（`src/ui.js:690`）。`recordSolo` の前に `first` と `firstSolo = !(data.trace.solo[ch] > 0)` | `DL.recordChar(days, today, { game: 'solo', ch, firstDone: first, firstSolo })` |
| 出動の画面を出た（終えた・やめた） | `finishSession`・`finishTrace`・`quitSession`・`quitTrace` | `DL.addTime(days, today, sec)`（5 章） |

- `today` は記録するその時点の `todayStr()`。
- 保護者の手動のレベル変更（`chooseLevel`）・ステージの解放と再ロックは記録しない（子どもがしたことではないため）。
- 確認パネルの「ごほうびだけ出す」など（`src/main.js` の `#debug`）は記録しない（`grantReward` を直接呼ぶ口は `recordSession` を通らない）。

---

## 5. 時間の測り方

| 案 | 内容 | 信頼性 | 判断 |
|---|---|---|---|
| A. 持たない | 回数だけ | — | 保護者の「どれくらい」に答えにくい |
| B. 換算 | 回数 × 2.5 分 | 回数と同じ情報 | 新しいことが分からないのに「分」と書くと実測に見える。不採用 |
| **C. 出動の画面にいた時間（採用）** | 出動を始めた時（`startSession`・`launchTrace`）の `performance.now()` から、終えた・やめた時まで。画面が隠れていた間を引き、1 回 600 秒で打ち切る | 開いたまま放っておいても 1 回 10 分まで。ごほうび・しゃこの時間は入らない | 採用 |
| D. 操作の間隔の合計 | タップの間隔を 60 秒で打ち切って足す | いちばん正確 | 全部の画面に手を入れることになる。不採用 |

- `performance.now()` を使う（端末の時計を合わせ直しても飛ばない）。
- 隠れている間: 今の `visibilitychange`（`src/ui.js:1418`）に、`run`・`trun` があれば隠れた時刻を覚え、戻ったときに差を `hidden` に足す処理を足す。
- 600 秒の理由: 1 回 4 問で約 2〜3 分（`docs/plan-elementary.md` 1 章）、かく は 4 字で 3〜5 分。考えこむ子でも 10 分を超える 1 回はほぼ無い。
- 表示は分に丸めて「やく ◯ふん」。1 分未満は「やく 1ぷん」。
- 持つのは日ごとの秒の合計だけ（何時に遊んだかは持たない）。

---

## 6. 保持・補正・壊れたデータ

### 6.1 記録するときの剪定（今日が分かる場面）

`recordSession`・`recordChar`・`addTime` は、書き込んだ後に `prune(days, today)` を通す:
- `today` から 34 日より前（`addDays(today, -34)` より小さい鍵）を消す → 今日を含めて 35 日。
- `today` の 2 日以上先の鍵を消す（3 章）。

### 6.2 読み込みの補正（`normalizeProfile` の中。今日を使わない）

`normalizeProfile`（`src/storage.js:82-112`）に `d.days = DL.normalizeDays(raw.days)` を足す。`defaultProgress()`（`src/storage.js:24-44`）に `days: {}` を足す。

`normalizeDays(raw)` の規則（壊れた値は捨てる。全体を捨てずに、使える日・項目だけ残す）:
- 表でなければ `{}`。鍵が `YYYY-MM-DD` の形で、実在する日付（`2026-02-30` は捨てる）だけ。
- 鍵を新しい順に並べ、**40 件まで**（今日が分からなくても大きさを縛る）。
- 回数は 0 以上の整数（今の `num()` と同じ。`src/storage.js:45`）に直し、上限で止める: `sessions` 999、`questions` 9,999、`firstTry` は `questions` まで、`chars` 9,999、`cards` 999、`sec` 86,400。
- 知らないゲームの鍵は捨てる。中身がすべて 0 のゲームは鍵ごと消す。
- `up[g]` は `D.LEVELS[g]` にあるレベルだけ（`trace`・`solo` には持たない）。
- `wrote` は書ける字（`src/strokes.js` の `SETS` の全部）だけ、重なりを除いて 130 字まで。`newChars`・`newSolo` は `wrote` にある字だけ。
- `license` は `hira`・`kata`・`k1`・`k2` だけ、重なりなし。`newCars` は乗り物の id（`D.ALL_VEHICLES`）だけ、重なりなし、47 件まで。
- `last` は 6 つのゲームの名前のどれか、でなければ `''`。
- 何も残らない日は消す。
- 入力は書き換えない。`normalizeDays(normalizeDays(x))` は `normalizeDays(x)` と同じ。

### 6.3 既存のデータ

- 日ごとの記録が無い今のデータ・v1 からの移行（`migrateV1`。`src/storage.js:174-183`）は `days: {}` になる。今までの画面・数は変わらない。
- 今までの合計（`stats`）から日ごとの記録は作らない（何日に遊んだかが分からないため）。保護者画面の最初の週は、出した日からの分だけ。
- 今のテストへの影響: `assert.deepEqual(S.normalizeProfile(null), S.defaultProgress())`（`tests/storage.test.js:21`）・`tests/english.test.js:150` は、両方に `days: {}` が入るので通る。プロフィール全体を決め打ちの形と比べている試験があれば `days: {}` を足す（DL-1 で `bash scripts/test.sh` を回して直す）。

---

## 7. 純粋関数（新しい `src/daylog.js`。DL-1）

- ブラウザでは `window.Manabi.daylog`、Node では `module.exports`（今の流儀）。依存は `src/data.js`（`LEVELS`・`ALL_VEHICLES`）と `src/strokes.js`（`SETS`）。
- `index.html` では `src/strokes.js`・`src/trace.js` の後、**`src/storage.js` の前**に読む（storage.js が使うため。今の trace.js と同じ扱い。`src/storage.js:7`）。
- 入力は書き換えず、新しい表を返す。

| 関数 | 中身 |
|---|---|
| `KEEP_DAYS = 35`・`MAX_KEYS = 40`・`SEC_CAP = 600`・`GAMES = ['math','letter','clock','english','trace','solo']`・`KID_GAMES = ['math','letter','clock','english','trace']` | 定数 |
| `isDayKey(s)`・`addDays(key, n)`・`weekStart(key)`・`weekKeys(start)` | 日付の計算（`Date.UTC`。月・年・うるう年をまたぐ） |
| `normalizeDays(raw)` | 6.2 |
| `prune(days, today)` | 6.1 |
| `recordSession(days, today, ev)` | `ev = { game, questions, firstTry, up, reward, license }`。`sessions` +1、`questions`・`firstTry` を足す、`up` はその日の値より上なら差し替え、`reward` があれば `cards` +1・`isNew` なら `newCars` に足す、`license` を足す、`last = game` |
| `recordChar(days, today, ev)` | `ev = { game, ch, firstDone, firstSolo }`。`chars` +1、`wrote` に足す、`firstDone` なら `newChars`、`firstSolo` なら `newSolo` |
| `addTime(days, today, sec)` | `min(sec, SEC_CAP)` を足す（負・数でないは 0） |
| `weekSummary(days, start, today, profile)` | 保護者画面の 1 週間（8.4） |
| `kidToday(days, today, opts)` | 子ども向け（9.3）。`opts = { enOn }` |

---

## 8. 保護者画面「まいにちの きろく」（DL-3）

### 8.1 置き場所と作り

`index.html` の「こども」のカード（`index.html:164-168`）と「すすみぐあい」（`index.html:169`）の間:

```
<div class="card" id="p-days"><h3>まいにちの きろく <span class="who-tag badge small"></span></h3>
  <div class="dl-nav">
    <button id="dl-prev" type="button" class="pbtn sub">‹ まえの しゅう</button>
    <b id="dl-range">10/26〜11/1</b>
    <button id="dl-next" type="button" class="pbtn sub">つぎの しゅう ›</button>
  </div>
  <div id="dl-sum"></div>          この しゅう: しゅつどう 14かい・やく 48ふん・あそんだ ひ 5にち
  <div id="dl-rows"></div>         7 行（8.2）。行をタップすると、その行の下に内訳（8.3）
  <div id="dl-legend"></div>       色の見本（かず・もじ・とけい・えいご・かく・ひとりで かく）
  <div id="dl-got"></div>          この しゅうに できるように なったこと（8.4）
  <p class="note">この たんまつで あそんだ ぶん だけ です。35にちより まえの きろくは きえます。かいすうより、たのしく つづける ことを たいせつに して ください。</p>
</div>
```

- 対象は今えらんでいる子（`data`）だけ。兄弟は並べない。子どもを切り替えたら（`useProfile`）今の週に戻す。
- `fillParent`（`src/ui.js:1232`）の最後で `fillDays()` を呼ぶ。見ている週 `dlWeek` は保護者画面を開いたときに今の週に戻す。

### 8.2 1 行（1 日）

```
[げつ 10/26] [■■■■■□□□□ 棒            ] [3かい]
                                          [やく12ふん]
```

- CSS の grid: `grid-template-columns: 4.6em 1fr 4.8em`。左は曜日（げつ・か・すい・もく・きん・ど・にち）と日付、右は回数と時間の 2 段（時間は小さい字）。
- 棒は `display:flex` の箱に、ゲームごとの `<i>` を `width: (回数 ÷ 目盛り × 100)%` で並べる。目盛りは `max(4, その週のいちばん多い日の回数)`（1 回でも棒が見え、満タンの線を描かない。目標に見せないため）。
- 色は出動えらびのボタンと同じ（`css/style.css:23-26`・`63`。かず `#2e9d5d`・もじ `#f08a24`・とけい `#3a7bd5`・えいご `#8e44ad`・かく `#16a085`）。ひとりで かく は かく の色に斜めの縞（`repeating-linear-gradient`）。色だけに頼らないよう、内訳では文字で出す。
- 遊んでいない日: 棒なし・右に灰色の「ー」。35 日より前の日: 灰色の「きろく なし」。今日より先の日: 空。今日の行は名前の横に「きょう」の小さな札。
- 行は `<button>`（タップで内訳を開く・閉じる）。遊んでいない日は押せない。

**寸法（iPhone SE 1 代の縦 320px）**: `#parent-body` の左右 14px・カードの枠 2px・内側 16px で、行の幅は約 256px。左 4.6em（15px の字で約 69px）・右 4.8em（約 72px）・棒は約 115px。`@media (max-width: 400px)` で行の字を 15px（ふだんは 17px。`.prow` と同じ）にする。iPad では幅 720px まで広がり、棒が長くなるだけ。

### 8.3 内訳（行をタップ）

```
かず　2かい（もんだい 8・1かいめで せいかい 6）
とけい　1かい（もんだい 4・1かいめで せいかい 2）
かく　1かい（4じ：し・つ・く・へ）
ひとりで かく　1かい（4じ）
できるように なったこと：かず M5 まで・はじめて かいた じ へ・ひとりで かけた じ し・ひらがなの めんきょ
ごほうび 4まい（あたらしい のりもの：ばす）
```

- 割合は出さない（4 問ずつなのでぶれが大きく、点数に見える）。累計の割合は今の「すすみぐあい」に残る（`src/ui.js:1241`）。
- 書いた字は、出動を終えなかった字も含む（今の `stats.trace.chars` と同じ）ので、`かく 0かい（2じ）` のような行もありうる。
- 乗り物の名前は `D.ALL_VEHICLES` の `name`。

### 8.4 週の合計と「できるように なったこと」

`weekSummary(days, start, today, profile)` が返すもの:
- `rows`: 7 日分の `{ key, kind: 'day'|'none'|'old'|'future', total, byGame, sec }`。
- `sum`: `{ sessions, sec, playedDays, byGame }`。「あそんだ ひ」は出動を 1 回以上終えた日。
- `got`: `up`（ゲームごとに、その週にいちばん上まで上がったレベル）、`gates`（`profile.cleared` のうち日付がその週の中のもの）、`stages`（`profile.promoted` のうちその週の中のもの。手動の解放も含むので「ステージ ◯ が ひらいた」と中立に書く）、`newChars`・`newSolo`・`license`・`newCars`（週の中の和集合）。
- `hasPrev`（前の週の日曜が 35 日の範囲に入るか）・`hasNext`（今の週でないか）。

何も無い週は「この しゅうは まだ きろくが ありません」。「できるように なったこと」が無い週は、その見出しごと出さない（「なし」と書かない）。

### 8.5 文字

保護者画面は今と同じひらがな中心（レベルの ID・漢字の字そのものはそのまま）。

---

## 9. 子ども向け「きょうの しゅつどう」（DL-4。企画 2 章のユーザーの決定）

### 9.1 置き場所と流れ

| 案 | 判断 |
|---|---|
| **「おしまい」の後の画面 `s-today`（採用・主）** | 遊び終わりの区切りで、その日をふり返る。声で ほめる → 誘う |
| **タイトルの小さな列（採用・副）** | 次に開いたときに「きょうは もう これを した」が分かる。押すと `s-today` |
| 出動えらびの各ボタンに印 | 薄い絵が、声が無いときの えいご の「押せない」見た目（`updatePick`。`src/ui.js:232-237`）と紛れる。不採用 |
| ごほうび画面に重ねる | ごほうびのカードが主役の画面に情報が増える。不採用 |
| しゃこのタブ | 遊び終わりに自分から開かないと見えない。不採用 |

流れ:
- ごほうび画面の「おしまい」（`src/ui.js:1453`）: 昇格があれば今どおり昇格画面 → その後 `s-today` → 「おしまい」でタイトル。昇格画面のボタン（`src/ui.js:1458-1462`）の行き先は、「おしまい」から来たときだけ `s-today` にする（`promo.next = 'today'`）。
- 「もういちど」「しゃこへ」からは出さない（遊びの途中のため）。
- タイトルの列を押したとき: `s-today` のボタンは「もどる」でタイトルへ。

### 9.2 画面の作り

```
<section id="s-today" class="screen">
  <div class="today-box">
    <h2>きょうの しゅつどう</h2>
    <div id="today-row">   5 つ: [絵 kazu・moji・tokei・eigo・pencil（今の data-icon）] [名前] [スタンプ] [王冠]
    <p id="today-msg" class="kid-sub"></p>   「きょうは かく を とくに がんばったね！」「あしたは とけい も やってみる？」
    <button id="btn-today-ok" class="big end"><canvas data-icon="station"></canvas><span>おしまい</span></button>
  </div>
</section>
```

- 遊んだゲーム: 絵の右下に自分の車のスタンプ（`stampURL('stamp', false)`。`src/ui.js:973`）を 1 つ。何回遊んでも 1 つ（数を表さない）。
- とくに がんばった ゲーム: 金の縁のスタンプ（`stampURL('stamp', true)`）と、絵の上に金の王冠（新しい Canvas の絵 `crown` を `drawIcon` に足す。`src/ui.js:49`）。1 つだけ。
- まだのゲーム: 絵を `opacity: .4`（色は残す。灰色にしない）。スタンプなし。
- えいご の声が使えない端末（`enOff()`。`src/ui.js:205`）では、えいご が まだ でも薄くせず、誘いにも入れない。
- 動き: スタンプを左から順に 0.3 秒ずつ「ぽん」（今の `.stamp.pop`。`css/style.css:174`、効果音 `pon`）、最後に王冠（効果音 `card`）。`prefers-reduced-motion` のときは動かさず一度に出す（`reducedMotion()`。`src/ui.js:992`）。
- 寸法: 5 つを 1 列（iPad・iPhone の横）、iPhone SE の縦は 3＋2 の 2 段（出動えらびの `.pick-box .row` と同じ考え。`css/style.css:61`・`71`）。絵は 1 つ 72〜120px。
- 文字はひらがなだけ（`kidText` のふりがなは使わない。決まった短い文だけ）。

### 9.3 決め方（`kidToday(days, today, { enOn })`。決定的）

戻り値 `{ played: { math: true, ... }, crown: 'trace' | '', invite: 'clock' | '', all: true|false, none: true|false }`。`trace` と `solo` は `trace` にまとめる。

- **遊んだ**: その日に出動を 1 回以上終えた（`sessions >= 1`）。かく は書いた字があれば（終えていなくても）遊んだにする（書いた字は記録に残っているため）。
- **とくに がんばった（王冠）**: 遊んだゲームのうち、上から順に比べる:
  1. その日の `sessions`（かく は `trace` と `solo` の合計）が多い。
  2. 同じなら「できるようになったこと」の数が多い: `up` があれば 1、その日の日付の `cleared` のうちそのゲームのレベル 1 つにつき 1、かく は `newChars` と `newSolo` の字数と `license` の数。
  3. 同じなら `last`（その日に最後に終えたゲーム）。
  4. それでも決まらない（`last` が無い・候補に無い）ときは `KID_GAMES` の並びで先。
  
  遊んだゲームが 1 つなら、それに王冠。1 回目で正解した数は使わない（企画 2 章）。
- **誘い（invite）**: まだのゲーム（えいご は `enOn` のときだけ）のうち、**直近 7 日（今日を含む）の出動がいちばん少ない**もの。同じなら `KID_GAMES` の並びで先。まだのものが無ければ `''`。
- **1 つも遊んでいない（none）**: タイトルの列は出さない。`s-today` は遊んだ後にしか開かないが、もし開いたら（`#debug`）5 つともふつうの絵で「きょうは どれで しゅつどう する？」。
- **全部遊んだ（all）**: 誘いなし。文は「ぜんぶ しゅつどう できたね！」。

### 9.4 読み上げ文と声

`src/lines.js` に決まった文を足す（画面の文字はひらがな、声は今の流儀の漢字まじり）:

| 場面 | 画面の文字 | 読み上げ |
|---|---|---|
| 王冠 | きょうは {かず} を とくに がんばったね！ | 今日は {かず}を、とくに がんばったね！（5 通り） |
| 全部 | ぜんぶ しゅつどう できたね！ | ぜんぶ 出動できたね！ |
| 誘い | あしたは {とけい} も やってみる？ | あしたは {とけい}も、やってみる？（5 通り） |
| 0 回 | きょうは どれで しゅつどう する？ | 今日は どれで 出動する？ |

- ゲームの名前は今の `GAME_NAME`（`src/lines.js:51`）。文は 12 本で、`scripts/voice/list.js` の一覧に入り、`tests/lines.test.js` の網羅テストの対象になる。音声ファイルは手元の VOICEVOX で作る（四国めたん。今と同じクレジット）。まだ無いときは端末の声で読む（`docs/design-voice.md` 4 章）。
- 王冠の文 → 間 → 誘いの文 の順（`speakSeq`）。

### 9.5 タイトルの列

- `#today-strip`（ボタン 1 つ）を `.title-box` の 2 つの大きいボタンの下に置く。5 つの小さな絵（32px）とスタンプ・王冠。まだのものは薄く。
- その日 1 回以上遊んだときだけ出す（`show('title')` のたびに `kidToday` で決める。0 時を越えて開いたままでも、次にタイトルに戻ったときに消える）。
- 窓の灯り（`litWindows`）は今のまま。

---

## 10. R4（クラウド）との関係

### 10.1 推奨: 送らない

- `cloud.js`（R4-1。未作成）がプロフィールをクラウドの形に直すとき、`seen` と同じく `days` を外す。ルールは項目数を 15 に決め打ちしている（`firestore.rules:92`）ので、外し忘れると**そのプロフィールの書き込みが拒否される**（黙って増えることはない。気づける失敗になる）。
- 試験: `tests-rules/rules.test.js:43-49` の `toCloudProfile` に `delete o.days;` を足す（DL-1。足さないと、`days` を持つ端末のデータの試験が落ちる）。
- マージ（`docs/design-elementary.md` 7.5 の `mergeProfiles`）: `days` は**端末ごとに持ち、マージしない**（クラウドから来たプロフィールで端末のプロフィールを置き換えるときも、端末の `days` を残す）。7.5 の表に `seen` と並べて 1 行足す。
- 端末を変えたとき、レベル・カード・合計の回数は引き継がれるが、日ごとの記録は引き継がれない。保護者画面の注意の文（8.1）に「この たんまつで あそんだ ぶん だけ」と書いてある。

### 10.2 送る場合（ユーザーが送ると決めたときの見積もり。今回は作らない）

- **プロフィールの文書に足す案は使えない**: 1 人の文書で約 750〜800 式・余裕 約 2 割で、`isTrace` をもう 1 回足すと上限に当たる（`docs/r4-firebase-setup.md` 5.2）。35 日分の入れ子の表を 1 項目ずつ検査すれば、少なくとも `isTrace` 数回分の式になり、上限を超える。
- **別の文書なら入る**: `families/{uid}/profiles/{pid}/days/{YYYY-MM-DD}` を 1 日 1 文書。式の上限は書き込みごとに数えるので、プロフィールの文書の検査と足し合わされない（ただし batch 全体で数えるかは本番で未確認。`docs/r4-firebase-setup.md` 5.3。同じ batch に入れない）。
- 増える費用と手間: 出動のたびに 1 書き込み（家族の利用なら無料枠の中）、2 台で同じ日に遊んだときに二重に数えないため端末ごとに分けて持つ（`{ 端末の番号: 日 }`）か、大きい方を取る規則、35 日より古い文書の削除、アカウント削除の手順の追加、保護者向けの説明とプライバシーポリシーの書き直し（「遊んだ日ごとの回数と時間」を保存するものに入れる）。Firebase はまだ作っていないので、新しい承認項目は増えない。

### 10.3 R4 の文書への追記（DL-1 で入れる文案）

`docs/r4-data-and-privacy.md` (a)「保存しないもの」（`docs/r4-data-and-privacy.md:35-44`）に 1 行:

| 保存しないもの | 補足 |
|---|---|
| 日ごとの きろく（その日に遊んだゲームの回数・書いた字・おおよその時間） | この端末の中だけに 35 日分を残し、保護者画面の「まいにちの きろく」と、子どもの「きょうの しゅつどう」に使う。クラウドには送らないので、別の端末には引き継がれない |

`docs/design-elementary.md` 7.5 の表に 1 行: 「`days` | クラウドに送らない。端末ごとに持ち、マージしない（`docs/design-daily-log.md` 10 章）」。

---

## 11. PR の切り方

| PR | 内容 | 見た目 | テスト |
|---|---|---|---|
| DL-1 | `src/daylog.js`（7 章）、`storage.js` の `defaultProgress`・`normalizeProfile` に `days`、`index.html` の読み順、`tests/daylog.test.js`、既存の試験の手直し、`tests-rules` の `toCloudProfile`、10.3 の文書の追記 | 変わらない | 12 章の 1〜4 |
| DL-2 | `ui.js` の結線（4 章）と時間（5 章）。`#debug:days-sample` で見本の 5 週分を今の子に入れる口（`src/main.js` の確認パネルに足す。保存するので確認用の端末だけで使う） | 変わらない（記録が貯まり始める） | 結線は目視（`#debug` パネルに今日の `days` を出す） |
| DL-3 | 保護者画面のカード（8 章）、`css/style.css`、`weekSummary` のテスト | 保護者画面 | 12 章の 5、iPad・iPhone SE で目視 |
| DL-4 | `s-today`・タイトルの列（9 章）、王冠の絵、`lines.js` の文、声の一覧、`kidToday` のテスト、音声ファイル | 子ども向け | 12 章の 6、目視 |

- DL-1 は R1-a と同じく「見た目が変わらない」ことでレビューしやすくする。
- DL-2 を先に出すと、DL-3・DL-4 を出したときに数日分の本物の記録で確かめられる。
- DL-4 の音声は別の PR に分けてもよい（ファイルが多いとき。声 PR2・PR3 の前例）。

---

## 12. テスト観点

1. **日付の境目**（`tests/daylog.test.js`）
   - `today` を `2026-10-28` と `2026-10-29` にして記録すると別の鍵になる。同じ日の 2 回は足される。
   - `addDays`・`weekStart`: 月末（10/31→11/1）、年末（2026-12-28 の週は 2027-01-03 まで）、うるう年（2028-02-28→02-29→03-01）、日曜（その週の月曜に戻る）、月曜（自分）。
   - 2 日以上先の鍵は記録のときに消え、1 日先は残る。
2. **長く使ったとき**
   - 365 日続けて毎日記録しても、鍵は 35 個、どの日も上限の中。
   - 1 日に 1,000 回の出動・10,000 字でも上限で止まる。`sec` は 1 回 600 秒まで、合計 86,400 まで。
   - 35 日目と 36 日目の境（今日 − 34 日は残り、− 35 日は消える）。
3. **既存のデータと壊れたデータ**
   - `days` の無いプロフィール・v1 の移行 → `{}`。今までの `normalize` の結果は `days: {}` が増えるだけ。
   - 配列・文字列・`null`、日付でない鍵、`2026-02-30`、負の数・小数・`NaN`・文字列の数、知らないゲーム、`firstTry > questions`、知らない字・知らない乗り物・重なり、`newChars` が `wrote` に無い、41 件以上 → 使える部分だけ残る。
   - `normalizeDays` を 2 回通しても同じ。入力を書き換えない。
4. **記録の中身**
   - `up` は上のレベルだけ残る（M4 の後に M5、その後 M4 に下がった記録を渡しても M5 のまま。下がったことは記録しない）。
   - `newCars` は `isNew` のときだけ。ステッカー（`{ sticker: true }`）は `cards` だけ +1。
   - `recordChar` の `firstDone`・`firstSolo`。
5. **週の表（`weekSummary`）**
   - 7 行の合計が `sum` と一致。`playedDays` は出動を終えた日だけ。
   - `cleared`・`promoted` の日付がその週の中のものだけ `got` に入る。
   - 範囲の前の日は `old`、今日より先は `future`。`hasPrev`・`hasNext` の境。
6. **子ども向け（`kidToday`）**
   - 遊んだゲームが 1 つ → それに王冠。2 つで回数が違う → 多い方。同じ回数 → できたことが多い方。それも同じ → `last`。`last` が無い → 並びで先。
   - `trace` と `solo` がまとめて数えられる。書いた字だけ（終えていない）の かく は遊んだ。
   - 誘いは直近 7 日でいちばん少ないもの・同じなら並びで先。`enOn: false` なら えいご を誘わない。全部遊んだ → 誘いなし・`all`。何も無い → `none`。
   - 同じ入力なら何度呼んでも同じ結果（乱数を使わない）。
7. **目視（iPad・iPhone の Safari）**: 保護者画面の 7 行が iPhone SE の縦で 1 行に収まる、週送り、内訳の開閉、子どもを切り替えると表が変わる、`s-today` の 5 つの並び（SE の縦は 2 段）、スタンプの動き、声。

---

## 13. ユーザーに確かめる点（実装前。企画 9 章と同じ）

1. 週の始まり（推奨: 月曜）。
2. 持つ期間（推奨: 35 日）。
3. おおよその時間を出すか（推奨: 出す。1 回 10 分で打ち切り、「やく」と書く）。
4. 日ごとの記録をクラウドに送るか（推奨: 送らない）。
5. 「とくに がんばった」の決め方（推奨: 回数 → できたこと → 最後に遊んだ）。
6. 保護者画面の注意の文に「かいすうより たのしく つづける ことを たいせつに」を入れるか（推奨: 入れる）。
7. 子ども向けの置き場所（推奨: 「おしまい」の後とタイトルの列。出動えらびには出さない）。
