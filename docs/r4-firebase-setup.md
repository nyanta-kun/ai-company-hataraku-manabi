# R4 準備: Firebase の設定手順書（承認後に実行する）

作成: 設計部 / 日付: 2026-10-24 / 状態: **下書き。どの手順もまだ実行していない**

- この文書は、承認を得た後に人間（または承認を得た Claude）が行う手順をまとめたもの。R4-0 では Firebase コンソール・Google Cloud コンソール・ネットワーク上の設定を**一切していない**。
- 前提（決定済み）: 保存先は Firebase（Authentication の Google ログイン＋Cloud Firestore）。ログインは保護者の Google アカウントで、保護者画面からだけ。子どもはログインしない。1 アカウントに子どもプロフィール最大 4 人。テスト版は GitHub Pages（`https://nyanta-kun.github.io/ai-company-hataraku-manabi/`）。main にマージすると CI（`.github/workflows/ci.yml:35-38`）が `index.html`・`css`・`src` を公開する。リポジトリは public。ビルドなし・classic script。
- 方針の根拠: `docs/design-elementary.md` 7 章、`docs/plan-elementary.md` 0・4・5 章。保存する項目と説明文は `docs/r4-data-and-privacy.md`。
- 料金・仕様の事実は 11 章の公式文書で 2026-10-24 に確かめた。**実行する日に、もう一度 11 章の料金のページを見て、数字が変わっていないか確かめる**（Google は予告なく変えることがある）。

---

## 0. 承認が必要な操作（順番つき）

| # | 操作 | 承認 | 費用 | 戻せるか |
|---|---|---|---|---|
| 1 | ログインの方式とホスティングを決める（2 章。推奨は GitHub Pages のまま `signInWithPopup`。実機で動かなければ Firebase Hosting へ移す） | **要**（外部公開の形が変わりうる） | 0 円 | — |
| 2 | Firebase プロジェクトを作る（Spark プラン、請求先を登録しない、Google アナリティクスはオフ） | **要**（外部サービスの作成） | 0 円 | 削除できる（30 日は復元可。10 章） |
| 3 | Web アプリを登録し、設定値（`apiKey` など）を発行する | **要**（キーの発行） | 0 円 | アプリを削除できる |
| 4 | Authentication で Google ログインを有効にし、承認済みドメインに `nyanta-kun.github.io` を足す | **要**（ログインの設定） | 0 円 | 無効にできる |
| 5 | Firestore のデータベースを作る（場所 `asia-northeast1`。**作った後は変えられない**）。セキュリティルール（5 章）を公開する | **要**（外部サービスの作成。場所は変更不可） | 0 円 | データベースは削除できる。場所は変えられない |
| 6 | （任意）ブラウザ用 API キーに HTTP リファラーの制限を付ける（6.3） | **要**（Google Cloud の設定） | 0 円 | 外せる |
| 7 | 設定値を書いた `src/cloud.js` を含む PR を main にマージする（＝GitHub Pages に公開される） | **要**（Web 公開） | 0 円 | 戻す PR で消せる（公開された値は残る前提。6 章） |
| 8 | プライバシーポリシーと保護者向け説明を公開する（`docs/r4-data-and-privacy.md`） | **要**（Web 公開・個人情報） | 0 円 | 取り下げられる |

- App Check（7 章）は**入れない**のが推奨。入れる場合は reCAPTCHA の登録が増えるので、別に承認を取る。
- **やってはいけない操作**（承認なしに課金が起こりうる）: 請求先アカウント（Cloud Billing）の紐づけ、Blaze プランへの切替、Google Cloud の無料トライアルのクレジットの適用、同じプロジェクトで Cloud Run・Pub/Sub・Maps などの Google Cloud のサービスを使うこと。どれも**プロジェクトが自動で Blaze（従量課金）に上がる**（料金プランのページ）。Identity Platform へのアップグレードの案内が出ても押さない。

---

## 1. 前提の事実（2026-10-24 確認）

| 項目 | 事実 | 出典 |
|---|---|---|
| Spark プラン | 支払い情報なしで始められる。無料枠を超えると、その製品はプロジェクト全体で「その月の残り」止まる（課金はされない）。再開は翌月か Blaze へのアップグレード | 料金プラン |
| Blaze への自動切替 | 請求先アカウントを紐づけると自動で Blaze になる。Google Cloud のサービス（Pub/Sub・Cloud Run など）や Maps を同じプロジェクトで使っても上がる | 料金プラン |
| Firestore の無料枠 | 保存 1 GiB、読み取り 5 万／日、書き込み 2 万／日、削除 2 万／日、転送 10 GiB／月。日ごとの枠は太平洋時間の真夜中ごろに戻る。無料のデータベースはプロジェクトに 1 つ。TTL 削除・PITR・バックアップは無料枠に入らず請求先が要る | Firestore の料金・上限 |
| ルールの読み取り | ルールの中の `get()`・`exists()` は読み取りとして数える | Firestore の料金 |
| Authentication | Google ログインは Spark で無料（料金ページは Identity Platform 付きで 5 万 MAU と書き、上限のページは Identity Platform 付きの Spark で 1 日 3,000 人の利用者と書く。**どちらでも家族の利用には十分すぎる**）。新規作成は 1 IP あたり 100 アカウント／時。上限は予告なく変わることがある | 料金、Authentication の上限 |
| リダイレクトでのログイン | Safari 16.1 以降・Firefox 109 以降・Chrome 115 以降は第三者のストレージを遮断するので、`signInWithRedirect` は対応が要る。Firebase Hosting 以外に置く場合の選択肢は「ポップアップに変える」「`/__/auth/` をリバースプロキシする」「ログインの補助ファイルを自分のドメインに置く」「プロバイダの SDK で別にログインして渡す」 | リダイレクトの推奨 |
| Web の API キー | Firebase の API キーは秘密ではなく、コードや設定ファイルに入れてよい（守りはセキュリティルールと App Check で行う）。ただし Gemini など Firebase 以外の API を同じキーに許してはいけない | API キー |
| Firestore の場所 | `asia-northeast1`（東京）は選べる。作った後は変えられない | Firestore の場所 |
| ルールの上限 | 1 リクエストで評価する式は 1,000 まで、関数の呼び出しの深さ 20、`get()` などは 10 回まで。ルールはループも再帰もできない。文書の大きさは 1 MiB まで | Firestore の上限、ルールの言語 |
| Google の審査 | 機密でないスコープだけのアプリは OAuth の審査は必須ではない（同意画面に名前とロゴを出すには「ブランドの確認」が要る） | OAuth の審査 |

---

## 2. 先に決めること: GitHub Pages でのログインの方式（承認 #1）

GitHub Pages は Firebase Hosting ではないので、公式の推奨（`authDomain` をアプリのドメインにしてリダイレクトでログイン）がそのままは使えない。このアプリは `nyanta-kun.github.io` の**下の階層**（`/ai-company-hataraku-manabi/`）に置かれており、ドメインの直下（`/__/auth/…`）にファイルを置けない。

| 案 | 内容 | iPad/iPhone の Safari | 増える作業・依存 | 判断 |
|---|---|---|---|---|
| **P1. `signInWithPopup`（推奨・まず試す）** | 今の GitHub Pages のまま。`authDomain` は既定の `<プロジェクト>.firebaseapp.com` | 公式の選択肢の 1 つ。ただし「ポップアップは端末によって塞がれることがある・モバイルでは使い勝手が落ちる」（公式）。**ホーム画面に追加したアプリ（standalone）ではポップアップのログインが失敗するという報告が複数ある**（公式の記載ではない） | なし | 追加の公開・リポジトリが要らない。実機で動けばこれで決める |
| P2. Firebase Hosting に移し、`signInWithRedirect` | アプリを `<プロジェクト>.web.app` に置き、`authDomain` をそのドメインにする（公式の Option 1） | 一番確実（公式の推奨） | 公開先が増える（Web 公開の承認）。Firebase CLI での配置。Hosting の無料枠（保存 10 GB、転送 360 MB／日）。記録（localStorage）は**オリジンが変わるので GitHub Pages 版から引き継がれない**（ログインして移す） | P1 が実機で動かないとき（特にホーム画面のアプリ）の代わり |
| P3. 補助ファイルを自分のドメインに置く（公式の Option 4） | `https://nyanta-kun.github.io/__/auth/handler` などを返す必要がある | リダイレクトが使える | ドメイン直下に置くには**ユーザーサイト用の公開リポジトリ `nyanta-kun.github.io` が別に要る**。補助ファイルを定期的に取り直す。OAuth のリダイレクト URI の設定 | 手間と保守が大きい。採らない |
| P4. リバースプロキシ（Option 3） | `/__/auth/` を `firebaseapp.com` へ中継 | — | GitHub Pages では中継できない | 不可 |
| P5. Google の SDK（GIS）でログインして `signInWithCredential`（Option 5） | GIS を別に読む | GIS もポップアップかリダイレクト | 外部スクリプトがもう 1 つ増え、作りが複雑 | 採らない |

**推奨: P1 で始め、R4-1 の最初に実機で確かめる。** 決め手は、公開先もリポジトリも増やさずに済むこと。ただし保護者画面ではすでに「ホーム画面に追加してから遊ぶ」を勧めている（`docs/design-elementary.md` 2.8、`docs/plan-elementary.md:315`）。ホーム画面のアプリと Safari は保存領域が別（2.8 の 2.）なので、「Safari でログインして、ホーム画面のアプリで遊ぶ」は効かない。**ホーム画面のアプリの中でポップアップのログインが動くか**が分かれ目になる。

R4-1 の最初の確認（ログインの試作だけ。承認 #2〜#5 の後）:
1. iPad の Safari（タブ）で、保護者画面からログイン → 再読み込みしてもログインしたまま。
2. 同じ iPad の**ホーム画面に追加したアプリ**で、同じ操作。
3. iPhone の Safari と、ホーム画面のアプリで同じ操作。
4. ログインのボタンを押してから SDK を読み込む作りで、ポップアップが塞がれないか（下の注意）。

2 か 3 のホーム画面のアプリで動かなければ、ユーザーに次のどちらかを選んでもらう: (a) ログインする家庭には「Safari で開いて使う（ホーム画面には追加しない）」と案内を変える、(b) P2（Firebase Hosting。公開先を増やす承認）へ移す。

**ポップアップとユーザー操作の注意（P1 の作り）**: ブラウザは「利用者がタップした、その処理の中で」開いたポップアップだけを通す。ボタンを押してから `await import(...)` で SDK を読み、その後に `signInWithPopup` を呼ぶと、間に待ちが入るので Safari が塞ぐおそれがある（未検証の懸念）。対策として、説明画面の「同意して次へ」で SDK を読み始め、読み終わってから出す「Google でログイン」ボタンの処理の中で、待たずに `signInWithPopup` を呼ぶ（`docs/design-elementary.md` 7.3 に追記した）。

**同じオリジンの注意**: GitHub Pages では、`nyanta-kun.github.io` の下にある**他の公開リポジトリのページも同じオリジン**になる。ログインの状態（Firebase は IndexedDB に保存）と端末内の記録は、同じオリジンの他のページのスクリプトから読める。今は nyanta-kun の Pages は自分のものだけだが、ほかの案件を同じアカウントで GitHub Pages に公開すると、その案件のスクリプトからもログインの情報に手が届く。承認済みドメインに `nyanta-kun.github.io` を入れると、そのドメインの他のページからもこのプロジェクトのログインが使える。→ ユーザーに確かめる（`docs/r4-data-and-privacy.md` 末尾の確認点）。P2 にすると専用のオリジンになり、この心配は無くなる。

---

## 3. 手順（承認 #2〜#6）

各手順の「確認」は、終わったときに承認者が目で確かめる点。画面の名前は 2026-10 時点の公式文書に合わせた。コンソールの見た目は変わることがある。

### 3.1 プロジェクトを作る（承認 #2）

1. https://console.firebase.google.com/ を、**運営者（保護者でなく、アプリの管理者）の Google アカウント**で開く。
2. 「プロジェクトを作成」。名前は例: `hataraku-manabi`。プロジェクト ID は後から変えられない（`<ID>.firebaseapp.com` として同意画面に出る）。
3. **Google アナリティクスは「有効にしない」**。AI アシスタント（Gemini in Firebase）などを有効にするか聞かれたら、オフにする（このアプリに要らない。データの送り先を増やさない）。
4. 作成後、左下の料金プランが **Spark（無料）**であることを確かめる。「アップグレード」は押さない。

確認: 「使用量と請求額」の画面で Spark と表示され、請求先アカウントが紐づいていない。

### 3.2 Web アプリを登録する（承認 #3）

1. プロジェクトの概要 →「アプリを追加」→ ウェブ（`</>`）。
2. ニックネーム: 例 `hataraku-manabi-web`。**「Firebase Hosting も設定する」にはチェックしない**（P1 の場合）。
3. 表示された設定値（`firebaseConfig`）を控える。項目は `apiKey`・`authDomain`・`projectId`・`storageBucket`・`messagingSenderId`・`appId`（`measurementId` はアナリティクスをオフにしたので出ない想定）。
4. 「npm を使う／`<script>` タグを使う」の選択は、どちらでもよい（このアプリは 7.3 のとおり gstatic から `import()` する）。

確認: 設定値が 6 項目そろっている。置き場所は 6 章。

### 3.3 Google ログインを有効にする（承認 #4）

1. 「セキュリティ」（または「構築」）→「Authentication」→「始める」。
2. 「Sign-in method」タブ →「Google」→ 有効にする。
3. 「プロジェクトの公開名」（Google の同意画面に出る名前）: 例「はたらくまなび」。「プロジェクトのサポートメール」: 運営者のメールアドレス（同意画面に出る。保護者からの問い合わせ先にもなりうるので、公開してよいアドレスにする）。
4. 保存。**他のログイン方法（メール・匿名・電話など）は有効にしない**。ルール（5 章）も Google 以外のログインを拒む。
5. 「Identity Platform にアップグレード」の案内が出ても押さない。

確認: Sign-in method の一覧で Google だけが「有効」。

ロゴは登録しない（ロゴを出すには Google のブランドの確認が要る。スコープはメール・プロフィールだけなので、OAuth の審査は必須ではない）。

### 3.4 承認済みドメインを足す（承認 #4 の続き）

1. Authentication →「設定」→「承認済みドメイン」。
2. 最初から入っているもの（`localhost`、`<ID>.firebaseapp.com`、`<ID>.web.app`）を確かめる。
3. 「ドメインの追加」で **`nyanta-kun.github.io`** を足す（`github.io` だけを足してはいけない。全員の Pages が通ってしまう）。パス（`/ai-company-hataraku-manabi/`）は書けない・書かない。
4. `localhost` は開発の確認（ローカルサーバー）に使うので残す。一般公開するときは消すことを検討する（公式の FAQ は本番では消すよう勧めている）。

確認: 一覧に `nyanta-kun.github.io` がある。

### 3.5 Firestore を作る（承認 #5）

1. 「構築」→「Firestore Database」→「データベースを作成」。
2. エディション（聞かれたら）: **Standard**。データベース ID: `(default)` のまま（無料のデータベースはプロジェクトに 1 つ）。
3. 場所: **`asia-northeast1`（東京）**。**作った後は変えられない**。東京を選ぶ理由: 利用者が日本にいる・データを国内の設備に置ける。
4. 開始モード: **本番環境モード**（すべて拒否）。**テストモードは使わない**（誰でも読み書きできる期間ができる）。
5. 「ルール」タブに 5 章の全文を貼って「公開」。公開の前に「ルールのプレイグラウンド」で 5.3 の確認をする。
6. バックアップ・PITR（ポイントインタイムリカバリ）・TTL は**有効にしない**（無料枠に入らない。請求先が要る）。

確認: データベースの場所が `asia-northeast1`、ルールが 5 章のもの、バックアップなし。

### 3.6 （任意）API キーに制限を付ける（承認 #6）

6.3 のとおり。やらなくても、データはルールで守られる。

### 3.7 終わったときの確認（R4 完了条件 6）

- 「使用量と請求額」: Spark、請求先なし。
- Authentication: Google だけ有効。承認済みドメインに `nyanta-kun.github.io`。
- Firestore: `asia-northeast1`、ルールは 5 章、テストモードでない。
- Google Cloud コンソールの「お支払い」で、このプロジェクトに請求先アカウントが紐づいていない。

---

## 4. 保存の形（Firestore の文書）

ルール（5 章）はこの形だけを通す。項目の意味と保護者向けの説明は `docs/r4-data-and-privacy.md`。

**2026-10-26 の変更（エミュレーター試験の結果）**: 当初は「1 家族 1 文書（`families/{uid}` に全員）」だったが、ルールの式の上限（1 リクエスト 1,000）に収まらないことが実測で分かった（5.2）。そこで 4.1 が退避先としていた「1 人 1 文書」に移した。**R4-1 の `cloud.js` は、この形で読み書きを作る**（読み書きの回数が変わる点は 4.2）。

```
families/{uid}                    親の文書。uid = Firebase Authentication の利用者 ID（保護者 1 人に 1 つ）
{
  v: 1,                           文書の形の版
  ids: ['p_xxxxxxxx_xxxx', ...],  プロフィールの id の一覧。0〜4 件
  deleted: { 'p_xxxxxxxx_xxxx': 'YYYY-MM-DD' },   消したプロフィール。最大 16 件（古いものから捨てる）
  updatedAt: <サーバーの時刻>                      書くたびに serverTimestamp()
}

families/{uid}/profiles/{id}      プロフィール 1 人 1 文書。端末内の v2 のプロフィールから device と seen を除き、updatedAt・ladderAt を足したもの。文書 id = id
{
  id: 'p_xxxxxxxx_xxxx',          文書 id と同じでなければならない（ルールが確かめる）
  name: 'たろう',                  ひらがな 1〜6 文字、または「こども1〜4」
  icon: 'shoubousha',             車の種類（15 種。救助隊の 4 種を含む。src/storage.js の CAR_IDS）
  created: 'YYYY-MM-DD' | '',
  levels:  { math: 'M3', letter: 'K2', clock: 'T1', english: 'E1' },
  locked:  { math: false, letter: false, clock: false, english: false },
  cards:   { shoubousha: 2, ... }, 車 → ★ 1〜3
  stats:   { sessions: 12, math: { sessions, questions, firstTry }, letter: {...}, clock: {...}, english: {...},
           trace: { sessions, chars, clean } },   「かく」の回数・書いた字の数・やり直しなしの字の数
  trace:   { done: { 'し': 2, ... }, help: { 'ぬ': 2, ... }, solo: { 'し': 1, ... }, set: 'auto', width: 'auto' },   done: 字 → 書き終えた回数 1〜99、help: 字 → たすけが要った回数 1〜99（W5）、solo: 字 → ひとりで（線なしで）書けた回数 1〜99（W6）。help・solo の字は done にある字だけ（ルールが確かめる）。help ≤ done・solo ≤ done の回数の大小は端末の normalizeTrace が守る（ルールは確かめない）。指の線は保存しない
  lastPlayed: 'YYYY-MM-DD' | '',
  stage:   { unlocked: 'S1', current: 'S0' },
  cleared: { M7: 'YYYY-MM-DD', ... },   関門レベル → 初めて 4/4 した日
  promoted:{ S1: 'YYYY-MM-DD' },        ステージ → 昇格した日
  updatedAt: 1793000000000,             名前・絵・固定・「かく」の設定などを変えた時刻（ミリ秒。端末の時計）
  ladderAt:  1793000000000              stage を変えた時刻（ミリ秒）
}
```

- 大きさの見込み: 1 人 0.6〜0.8 KB、4 人で約 3 KB。「かく」の字が増える（ひらがな・カタカナ 92 字＋漢字 38 字）と、`done`・`help`・`solo` が全部埋まっても 1 人 約 5 KB（4 人で約 20 KB）。1 文書 1 MiB の上限から遠い。
- 端末内（`src/storage.js` の v2）との違い: `device`（音の設定・最後に選んだ子・移行日）は送らない（`docs/design-elementary.md` 6 章）。`seen`（もじで直近に出した絵）も送らない（7.5 に理由）。`updatedAt`・`ladderAt`・`deleted`・親の `ids` は R4 で足す（7.5）。
- 数値は整数で送る（Firebase の JS SDK は安全な範囲の整数を整数型で保存する）。`stats`・`trace` の回数は、ルールでは「0 以上の数字だけの文字列にできるもの」として確かめる（4.3）。
- **送る前にクラウドの形に直す**: `cloud.js` は `normalizeProfile`（`src/storage.js`）を通した値から 4 章の形を作る。ほとんどの項目は端末内で既にルールの通る形に整えられているが、`lastPlayed` だけは `slice(0, 10)` するだけで日付かを確かめていない。`cloud.js` で、日付の形でなければ `''` にしてから送る（試験でも `'きのう'` を `''` にしたものが通ることを確かめた）。1 項目でもルールに合わないと**そのプロフィールの書き込みが拒否され、同期がずっと失敗する**ので、ルールに拒否された書き込みは `#debug` と保護者画面の「最後に保存」の表示に出す（黙って失敗させない）。

### 4.1 文書の分け方の比較

| 案 | 内容 | 判断 |
|---|---|---|
| 1 家族 1 文書（当初の案） | `families/{uid}` に全員を入れる | 起動時の読み取りが 1 回、マージもトランザクション 1 つで済む。**ただしルールが式の上限に収まらない**（5.2）。項目を削って通すと、型や形の検査が大きく弱くなる。不採用 |
| **1 人 1 文書（採用。上の形）** | 親 `families/{uid}` ＋ `families/{uid}/profiles/{id}` | 1 文書のルールは 1 人分だけなので、全項目を検査しても上限に収まる（4 人ぶんをすべて上限まで埋めても通る）。起動時の読み取りは最大 2 回（親 1・プロフィールの一覧 1 回で人数分）。「4 人まで」は親の `ids` が 4 件まで＋子の書き込みは `ids` にある id だけ、で守る（4.2） |

### 4.2 1 人 1 文書にしたことで変わる点（R4-1 の設計で決める。この手順書では決めない）

- **読み書きの回数**: 起動時は親 1 回の `get`＋`profiles` の `list`（人数分の読み取り）。保存は、変わったプロフィールごとに 1 書き込み＋親の更新（`ids`・`updatedAt`）。無料枠（8 章）の見込みは数え直す（見込みは 30 件／日ほどから 2〜3 倍になる程度で、5 万の上限からは遠い）。
- **マージ**: 「読む → `mergeProfiles` → 書く」を、1 文書ずつのトランザクション、または親を含めた 1 つのトランザクション（最大 5 文書）にする。2 台が同時に書いても片方の変更が消えない作りは、R4-1 で確かめる。
- **「4 人まで」の強制**: ルールは `profiles` の文書の数を数えられないが、プロフィールの作成・更新を「親の `ids` にその id があるときだけ」に絞っている（`getAfter`）。親の `ids` は 4 件までなので、5 人目は書けない。**書き込みごとに読み取り 1 回の課金対象**（家族の利用なら無料枠の中。8 章）。
- **cloud.js の約束（書く順番）**: ①**親を先に書く**（新しい子の id を `ids` に入れる）。②そのあとでプロフィールを書く。最初の保存（親がまだ無いとき）も同じ順番。親が無い・`ids` に無い id のプロフィールの書き込みは拒否される。同じ batch／トランザクションで親と子を一緒に書くのも通る（`getAfter` は同じ書き込みの後の状態を見る）。子を消すときは、親の `ids` から外す書き込みと子の削除を順番を問わず行える（削除はルールが `ids` を見ない）。
- **ids から外した子の文書は、cloud.js が必ず消す（強調）**: ルールは、`ids` に入っている id のプロフィールだけを書けるようにしている。ただし `ids` の中身は何度でも入れ替えられるので、入れ替えるたびに古い子の文書が残ると、4 件より多くの文書を作れてしまう（本人の領域の中だけで、他人には見えず、無料枠の中。リスクとして受け入れる。7 章）。そこで **cloud.js は、プロフィールを `ids` から外す（消す・入れ替える）ときは、その子の文書を同じ batch で消す**。起動時の `list` で `ids` にない子の文書を見つけたら、消す。
- **アカウントの削除**: 親と、`profiles` の下の各文書を、それぞれ消す（クライアントが `ids` と `list` で集めて消す）。（`docs/r4-data-and-privacy.md` の手順 3 と `docs/design-elementary.md` 7 章は、この形に合わせてある。）

### 4.3 回数の型の検査について（試験で分かったこと）

式の上限のため、`stats`・`trace` の回数（`sessions`・`questions`・`firstTry`・`chars`・`clean`、`done`・`help`・`solo` の値）は、「全部をまとめて `join(',')` して、0 以上の数字だけの並びに合うか」で確かめている。**数字だけの文字列（例 `'5'`）は通る**（整数型かどうかまでは確かめない。負の数・小数・数字以外・13 けた以上は拒否）。端末の `normalizeProfile` は整数しか作らないので正しいデータには影響せず、書けるのは本人だけで、大きさは件数と長さの両方で縛ってある（`stats` は 16 個の数の並びがちょうどその個数で、`done`・`help`・`solo` は 5.2 のとおり長さを縛る）。`cards` の値（1〜3）・`locked`・`updatedAt`・`ladderAt` は型まで確かめている。

---

## 5. セキュリティルール（全文）

ルールの正本は、リポジトリ直下の `firestore.rules`。下の 5.1 はその写し（**直すときは `firestore.rules` を直し、ここに貼り直す**。試験は `firestore.rules` を使う）。

### 5.1 全文

```
rules_version = '2';

// はたらくまなび（hataraku-manabi）の Firestore ルール。
// 家族ごとに「親の文書」と「プロフィールの文書（1 人 1 文書）」を持つ。どちらも Google でログインした本人（uid が同じ）だけが読み書きできる。それ以外はすべて拒否。
//   families/{uid}                   親: { v, ids（プロフィールの id の一覧。4 人まで）, deleted, updatedAt }
//   families/{uid}/profiles/{pid}    プロフィール 1 人分（docs/r4-firebase-setup.md 4 章）
// 式の上限（1 リクエスト 1,000）が厳しいので、リストのリテラルは短いものだけにし、正規表現と join で 1 度に確かめる。
// 項目の「欠け」は、値を読んだときのエラー（= 拒否）で弾き、「余分」は size() で弾く。
service cloud.firestore {
  match /databases/{database}/documents {

    // ---- 本人の確認 ----
    function isOwner(uid) {
      return request.auth != null
        && request.auth.uid == uid
        && request.auth.token.firebase.sign_in_provider == 'google.com';
    }

    // ---- 値の形 ----
    function isMs(n) {
      return n is int && n >= 0 && n <= 4102444800000;   // 2100-01-01 まで
    }
    // キーの一覧を「,」でつないだ文字列と「;」でつないだ文字列の両方が、1 つずつの形の並びに合うこと。
    // （「,」を含むキー 1 つが 2 つのキーに見える抜けを、「;」でつないだほうで防ぐ。空のキーは別に弾く）
    function isKeyList(keys, itemPattern) {
      return keys.join(',').matches('^' + itemPattern + '(,' + itemPattern + ')*$')
        && keys.join(';').matches('^' + itemPattern + '(;' + itemPattern + ')*$');
    }
    // 値がすべて日付の小さな表（キーの形と件数も確かめる。空の表も通る）
    function isDateMap(m, keyPattern, maxSize) {
      return m is map
        && m.size() <= maxSize
        && (m.size() == 0
            || (isKeyList(m.keys(), keyPattern)
                && m.values().join(',').matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}(,[0-9]{4}-[0-9]{2}-[0-9]{2})*$')
                && m.values().join(',').size() <= m.size() * 11 - 1));   // 日付 10 文字 ＋ 区切り 1。「,」入りの値で件数を数え違えさせない
    }
    // 書ける字（src/strokes.js の SETS の全部。ひらがな 46・カタカナ 46・漢字 38）の 1 字の正規表現。字を足したら、ここも足す（tests-rules が一致を確かめる）。
    // 字のリスト（リテラル）にすると 1 つ 1 つが式として数えられ、上限を超えるので、正規表現にしてある
    function traceCharPattern() {
      return '[しつくへてのひそろるんいこりうとちらえすよわれみめゆぬねけにかさせもやおあまはむをたなきふほノフヘレアイカクコスセソンナトニヌハヒマムメヤユラリルワウエオキケサシツタチテミモヨロヲネホ山川口火水木犬手石目虫耳糸竹花車足雨空森冬池門夜海昼風星春秋馬夏船鳥雪道朝雲]';
    }
    // 字 → 1〜99 の表（キーは書ける字 1 字ずつ、値は 1〜99 の数。件数は 130 まで。空の表も通る）
    function isCharCountMap(m) {
      return m is map
        && m.size() <= 130
        && (m.size() == 0
            || (isKeyList(m.keys(), traceCharPattern())
                && m.values().join(',').matches('^([1-9]|[1-9][0-9])(,([1-9]|[1-9][0-9]))*$')
                && m.values().join(',').size() <= m.size() * 3 - 1));   // 数は最大 2 けた ＋ 区切り 1。「,」入りの値で件数を数え違えさせない
    }

    // ---- プロフィールの中身 ----
    function isLevels(l) {
      return l.size() == 4
        && (l.math + ',' + l.letter + ',' + l.clock + ',' + l.english).matches('^M[0-9]{1,2},K[0-9]{1,2},T[0-9]{1,2},E[0-9]{1,2}$');
    }
    function isFlags(k) {
      return k.size() == 4
        && [k.math, k.letter, k.clock, k.english].hasOnly([true, false]);
    }
    function isCards(c) {
      return c is map
        && c.size() <= 15
        && (c.size() == 0 || isKeyList(c.keys(), '(nekoguruma|forklift|gomi|shovel|bulldozer|dump|kyukyu|shoubousha|mizutank|hashigo|chodai|rescuework|rescuechem|rescuecmd|rescueheli)'))
        && c.values().hasOnly([1, 2, 3]);
    }
    // 回数 16 個（sessions と、4 つのゲームの sessions・questions・firstTry と、trace の sessions・chars・clean）を、まとめて「0 以上の整数の文字列」で確かめる
    function isStats(s) {
      return s.size() == 6
        && s.math.size() == 3 && s.letter.size() == 3 && s.clock.size() == 3 && s.english.size() == 3 && s.trace.size() == 3
        && s.math.keys().hasOnly(['sessions', 'questions', 'firstTry']) && s.letter.keys().hasOnly(['sessions', 'questions', 'firstTry'])
        && s.clock.keys().hasOnly(['sessions', 'questions', 'firstTry']) && s.english.keys().hasOnly(['sessions', 'questions', 'firstTry'])
        && s.trace.keys().hasOnly(['sessions', 'chars', 'clean'])
        && (string(s.sessions) + ',' + s.math.values().join(',') + ',' + s.letter.values().join(',') + ',' + s.clock.values().join(',')
            + ',' + s.english.values().join(',') + ',' + s.trace.values().join(',')).matches('^[0-9]{1,12}(,[0-9]{1,12}){15}$');
    }
    // 「かく」: done・help・solo は 字 → 回数（1〜99）。set・width は決まった名前
    function isTrace(t) {
      return t.size() == 5
        && isCharCountMap(t.done) && isCharCountMap(t.help) && isCharCountMap(t.solo)
        // help・solo の字は done にある字だけ（help ≤ done の「字の集まり」の部分。回数の大小は字ごとに比べる必要があり式が増えるので、端末の normalizeTrace が守る）
        && t.help.keys().hasOnly(t.done.keys()) && t.solo.keys().hasOnly(t.done.keys())
        && (t.set + ',' + t.width).matches('^(auto|hira|kata|k1|k2),(auto|wide|normal)$');
    }
    function isStage(g) {
      return g.size() == 2
        && (g.unlocked + ',' + g.current).matches('^S[0-3],S[0-3]$');   // S2・S3 は先に入れておく（R3 でルールを直さずに済むように）
    }
    function isProfile(p, pid) {
      return p is map
        && p.size() == 15
        && p.id == pid
        && p.id.matches('^p_[0-9a-z_]{1,24}$')
        && p.name.matches('^([ぁ-ゖー]{1,6}|こども[1-4])$')
        && p.icon.matches('^(nekoguruma|forklift|gomi|shovel|bulldozer|dump|kyukyu|shoubousha|mizutank|hashigo|chodai|rescuework|rescuechem|rescuecmd|rescueheli)$')
        && p.created.matches('^([0-9]{4}-[0-9]{2}-[0-9]{2})?$')
        && p.lastPlayed.matches('^([0-9]{4}-[0-9]{2}-[0-9]{2})?$')
        && isLevels(p.levels)
        && isFlags(p.locked)
        && isCards(p.cards)
        && isStats(p.stats)
        && isTrace(p.trace)
        && isStage(p.stage)
        && isDateMap(p.cleared, '[MKTE][0-9]{1,2}', 12)
        && isDateMap(p.promoted, 'S[1-9]', 8)
        && isMs(p.updatedAt)
        && isMs(p.ladderAt);
    }

    // ---- 家族の親の文書 ----
    function isFamily(d) {
      return d.size() == 4
        && d.v == 1
        && d.updatedAt == request.time
        && d.ids is list
        && d.ids.size() <= 4
        && (d.ids.size() == 0 || isKeyList(d.ids, 'p_[0-9a-z_]{1,24}'))
        && isDateMap(d.deleted, 'p_[0-9a-z_]{1,24}', 16);
    }

    match /families/{uid} {
      allow get: if isOwner(uid);
      allow create, update: if isOwner(uid) && isFamily(request.resource.data);
      allow delete: if isOwner(uid);
      // families 全体の一覧（list）は許さない。自分の文書は get で読む

      match /profiles/{pid} {
        allow get, list: if isOwner(uid);   // list は自分の families/{uid}/profiles の中だけ
        // 親の ids に pid があるときだけ書ける（親を先に書く。同じ batch・トランザクションで親と一緒に書くのも通る）。親が無ければ拒否。
        // 親の ids は 4 件までなので、5 人目は書けない。読み取り 1 回分（getAfter）の課金対象
        allow create, update: if isOwner(uid) && isProfile(request.resource.data, pid)
          && pid in getAfter(/databases/$(database)/documents/families/$(uid)).data.ids;
        allow delete: if isOwner(uid);
      }
    }

    // ほかの場所はすべて拒否（書かなくても拒否だが、意図をはっきりさせる）
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 5.2 ルールの考え方

- **本人だけ**: `families/{uid}` とその下の `profiles/{pid}` は、`uid` とログインした利用者の `uid` が同じで、しかも Google でログインした場合だけ読み書きできる。コンソールで別のログイン方法を誤って有効にしても（匿名など）、ルールが通さない。`families` 全体の一覧は許さない（自分の `profiles` の一覧だけ許す）。
- **項目を決め打ち**: 余分な項目は `size()` で、足りない項目は「値を読むときのエラー（= 拒否）」で弾く。メールアドレスや本名などの項目を、誤って足しても書き込めない。
- **大きさ**: ルールには文書のバイト数を測る関数が無い。代わりに、**すべての値の形と件数を縛って**、文書が数 KB を超えないようにする（文字列は正規表現で長さを決め、表は件数の上限）。どの値も長い文字列や入れ子の表にできない。日付や回数の表（`cleared`・`promoted`・`deleted`・`done`・`help`・`solo`）は、値を `,` でつないだ文字列の長さも「件数 × 値の最大の長さ」までに縛っている（値に `,` を入れて、1 つの値に何個も詰め込む抜けを防ぐため。レビューの指摘）。回数の表は、1 けたの値に `,` を入れた場合に限り、件数の 1.5 倍までは詰め込める（最大でも 130 字 × 数 KB 以内で、問題にならない）。
- **時刻**: 親の `updatedAt` はサーバーの時刻（`request.time`）でなければ通さない。
- **削除**: 本人は自分の親の文書・プロフィールの文書を消せる。
- **式の数（実測）**: 1 リクエストの上限は 1,000（エミュレーターも同じ。超えると `maximum of 1000 expressions` で拒否され、正しいデータも通らない）。**当初の見込み（1 人あたり約 103、4 人で約 470）は実測の約 10 分の 1 だった**。実測では、当初の形（1 家族 1 文書、型を細かく検査）は **プロフィール 1 人で約 1,000 に達し、2 人以上が通らなかった**。原因は、リストのリテラルは要素 1 つずつが式として数えられること、関数に渡した値の読み出し（`p.stats.math` のような道筋）が使うたびに数え直されること、関数のなかで関数を呼ぶと重なること。これを受けて、(1) 1 人 1 文書に分け（4 章）、(2) 一覧のリテラルを正規表現と `join` に置き換え、(3) `size()` と値の読み出しで項目の過不足を確かめるようにした。結果、1 人分をすべて上限まで埋めた文書（4 人分の試験 13）が通る。最大の 1 人（すべての表を上限まで埋めたもの）は、`,` の抜けを塞いだ後で約 750〜800 式（余裕は約 2 割。`isTrace` をもう 1 回足すと通らない）。親の文書と 4 人を 1 つの batch で書く（5 書き込み）試験 13b もエミュレーターでは通るが、**本番が batch 全体で式を数えるのかは未確認**（5.3 の公開前の手順）。**R3 などで項目を足すときは、必ず 試験 13 を回し直す**。
- **`join` の抜け**: キーを `,` でつないで 1 つずつの形に合わせる方法は、「`,` を含むキー 1 つ」が 2 つに見える抜けがあった（試験で見つけた）。`;` でつないだものも合わせることで防いだ（`isKeyList`）。
- **R3 に向けて**: レベルは `M`・`K`・`T`・`E` ＋ 2 けたまでの形で通すので、新しいレベルを足してもルールは直さなくてよい。ステージは S3 まで入れてある。車の種類を増やすときは `firestore.rules` の車の 2 か所（`p.icon` と `cards`）を `src/storage.js` の `CAR_IDS` と合わせる。書ける字を増やすときは `traceCharPattern()`（`src/strokes.js` の `SETS`）。どちらも、ずれたら試験が失敗する（「ルールの一覧が端末側と一致する」）。

### 5.3 ルールの確かめ方（公開前）

**実行**（リポジトリ直下から。Java が要る。Firebase にログインしない・実在のプロジェクトを使わない。`demo-` で始まるプロジェクト名はエミュレーター専用）:

```
cd tests-rules && npm install && cd ..        # 初回だけ（@firebase/rules-unit-testing と firebase が入る。アプリには含まれない）
firebase emulators:exec --only firestore --project demo-hataraku "npm --prefix tests-rules test"
```

- `firebase.json` はエミュレーターの Firestore だけを設定している（デプロイ先の設定は入れていない）。初回はエミュレーターの jar がダウンロードされる（無料）。
- 試験は `tests-rules/rules.test.js`（46 件。2026-10-26 に全部通った）。既存の `bash scripts/test.sh` と CI には含まれない（別の `package.json`）。ルールを直したときと、`src/storage.js` の形・`src/strokes.js` の字を変えたときに回す。
- 端末の実際のプロフィール（`src/storage.js` の `normalize` が作る S0・S1・S2、「かく」の記録あり、v1 からの移行、壊れた入力を直した後）をクラウドの形に直したものが**拒否されない**ことも、同じ試験で確かめている（正しいデータの拒否が最も困るため）。

| # | 操作 | 期待 | 試験 |
|---|---|---|---|
| 1 | ログインなしで `families/A` を読む・書く（Google 以外のログインも） | 拒否 | 1・1b |
| 2 | uid A で `families/B`（とその `profiles`）を読む・書く・消す・一覧する | 拒否 | 2・最後の相互の試験 |
| 3 | uid A で `families/A` と `profiles` に 4 章の形（2 人）を書く・読む・一覧する | 許可 | 3・3b |
| 4 | 文書・プロフィール・各表に `email` などの項目を足す／項目を欠く | 拒否 | 4・4b |
| 5 | `ids` を 5 件にする（プロフィール 5 人）。4 人・0 人は許可。`ids` に無い id・親が無いときのプロフィールの書き込みも拒否（親→子の順なら許可） | 5 は拒否 | 5・5b・12c・14・14b |
| 6 | `name` を 7 文字・漢字・英字・空にする | 拒否（「こども1」「らーめん」は許可） | 6・6b |
| 7 | `cards.shoubousha` を 4 や `'3'` にする | 拒否 | 7・7b |
| 8 | `stats.math.questions` を -1 や 1.5 にする | 拒否 | 8 |
| 8b | `trace.done`・`trace.help`・`trace.solo` に知らない字・0・100・「,」を含むキーを入れる／`trace.help`・`trace.solo` を欠く／`stats.trace` の項目を欠く／help・solo に done にない字 | 拒否 | 8b-1〜8b-4 |
| 9 | 親の `updatedAt` を端末の時刻にする | 拒否 | 9・9b・9c |
| 10 | `deleted` を 17 件にする（日付でない値・形の違うキーも）。値に `,` を入れて詰め込む（`cleared`・`promoted`・`deleted`・`done`・`help`・`solo`） | 拒否 | 10・10c |
| 11 | uid A で `families/A` を消す | 許可（ほかの人・未ログインは拒否） | 11・11b |
| 12 | 一覧の問い合わせ（`families` 全体・`collectionGroup('profiles')`） | 拒否（自分の `profiles` の一覧は許可、プロフィールの id がパスと違うものは拒否） | 12・12b・12d |
| 13 | 4 人分で、すべての表を上限まで埋めた文書を書く（親＋4 人を 1 つの batch でも） | 許可（式の上限に当たらない） | 13・13b |

**公開前の手順（本番で batch を試す）**: 本番が batch 全体で式の数を数えるかは未確認。公開の前に、テスト用の Google アカウント（実在の家族のものではない）で、親の文書と上限まで埋めた 4 人（試験 13b と同じ）を 1 つの batch で書き、通ることを確かめて、すぐ消す。拒否されたら、cloud.js は親→子を別々の書き込みにする（4.2 の順番で、`getAfter` は前の書き込みを見るので通る）。

**公開前の手順（本番の式の上限の確認）**: 本番の式の上限（1,000）が、エミュレーターと同じかは未確認。公開前に、Firebase コンソールの「ルール プレイグラウンド」で、**最大の文書**（試験 13 と同じ、4 人分を上限まで埋めたもの。プロフィールは `tests-rules/rules.test.js` の `fullRaw`）を一度試し、許可されることを確かめる（ルールの公開前に試せる。データは書かれない）。拒否されたら公開しない。

**`values()`・`join()` などの確認結果（2026-10-26。以前は「公式の参照ページの本文が取れず未確認」だった）**: エミュレーターで次が**動く**ことを確かめた。`Map.keys()`・`Map.values()`・`Map.size()`・`List.join(',')`（文字列のリストも、整数・真偽値のリストも。整数は `'0,0,0'` のように文字列にされ、正規表現に合う）・`List.hasOnly()`・`List.hasAll()`・`String.matches()`・`string(整数)`・関数の中の `let`（ただし式の数は減らない）。**動かない・注意するもの**: リストどうしの `+`（`list + list`）は使えない（`Unsupported operation error. Received: list + list`）。長いリストのリテラル（字の一覧など）は動くが式の数が膨らみ、上限を超える（正規表現に置き換えた）。`join` は `,` を含む値を見分けられない（`isKeyList` で防いだ）。

**ルールが強くない点（意図して残したもの）**: (1) `help ≤ done`・`solo ≤ done` の回数の大小は確かめない（字ごとの比べは式が足りない。試験 8b-5 が「通る」ことを記録している。将来確かめるようにしたら、この試験を拒否に変える）。(2) 回数は数字だけの文字列も通る（4.3）。(3) 親の `ids` にない id のプロフィールは書けないが、`ids` から外した後に残った子の文書は自動では消えない（cloud.js が消す。4.2）。

---

## 6. Web の設定値（`apiKey` など）の性質と置き場所

### 6.1 性質

- Firebase の API キーは**秘密情報ではない**。Firebase のサービスに「どのプロジェクト・どのアプリか」を伝えるだけで、データを守るのはセキュリティルール（と App Check）（公式）。公開リポジトリに入れてよい。
- ほかの設定値（`authDomain`・`projectId`・`appId` など）も、ブラウザに渡る時点で誰でも見られるもので、秘密ではない。
- **このキーに Firebase 以外の API（Gemini・Maps など）を許してはいけない**（公式。許すと、公開されたキーで課金の API を呼ばれうる）。Firebase が作るキーは最初から Firebase 関連の API に制限されているので、その制限を外さない。
- キーが公開されて困るのは「他人がこのプロジェクトの無料枠を使い切る」こと。課金は起こらない（Spark）が、最悪その月はログイン・保存が止まり、端末内保存で遊ぶことになる。

### 6.2 置き場所

| 案 | 内容 | 判断 |
|---|---|---|
| **`src/cloud.js` の先頭に定数で書く（推奨）** | `var FIREBASE_CONFIG = { apiKey: '...', ... }`。CI がそのまま GitHub Pages に出す | ビルドなしの方針に合う。秘密でないので問題ない。値を変えるのは PR で |
| `src/firebase-config.js` を別に置く | 設定だけのファイル | 分ける利点が小さい。ファイルが増える |
| GitHub の Secrets に入れ、CI で埋め込む | — | 秘密でないものを隠す意味が無く、CI が複雑になる。採らない |

- 設定値を書いた PR を main にマージすると、その時点で Web に公開される（承認 #7）。
- `file://` で開いたときと、設定値が空のときは、ログインの項目を出さない（`docs/design-elementary.md` 7.1）。

### 6.3 （任意）API キーの制限

- Google Cloud コンソール →「API とサービス」→「認証情報」→ Firebase が作った「Browser key」→「アプリケーションの制限」で「ウェブサイト」を選び、`https://nyanta-kun.github.io/*` と `https://<ID>.firebaseapp.com/*`（ログインの補助ページがこのドメインで動く）、開発用に `http://localhost/*` を足す。
- 公式の API キーのページは、リファラーの制限の書き方までは書いていない（今回確かめた範囲）。**付けたら、ログインと保存が動くことを実機で確かめる**。動かなければ外す。
- 効果は「よそのサイトにキーを貼り付けて使う」ことを少し難しくするだけ（リファラーは偽れる）。必須ではない。

---

## 7. App Check の要否

| 案 | 内容 | 判断 |
|---|---|---|
| **入れない（推奨）** | ルールで本人の文書だけに限る | 他人のデータは読めない・書けない。悪用されても課金は無く（Spark）、無料枠が尽きるだけ。外部のスクリプトと登録を増やさない |
| reCAPTCHA Enterprise で入れる | 公式は新しく入れるならこちらを勧める。月 1 万回の判定まで無料 | Google Cloud 側で reCAPTCHA Enterprise を有効にする作業が増える。**Spark のままで使えるかは今回確かめられなかった**。毎回の起動で Google の reCAPTCHA のスクリプトを読み、端末の情報を Google に送る。子ども向けのアプリで、ログインしない家庭にまで通信が起きるのは方針（第 1 段階は通信ゼロ）に合わない |
| reCAPTCHA v3 で入れる | reCAPTCHA の管理画面でサイトキーと秘密鍵を取る | 公式は v3 から Enterprise へ移るよう勧めている。上と同じく通信と登録が増える |

- 入れないことの弱み（ルールで防げない小さなリスク）: `ids` を入れ替えて、4 件より多くの子の文書を作れる（cloud.js が `ids` から外すときに文書を消す約束で抑える。4.2）。自分の領域の中だけで、他人には見えない。
- 入れないことの弱み: 公開されたキーを使って、Google でログインした誰かが自分の文書に大量に書き込むと、1 日の書き込みの枠（2 万）を使い切りうる。その場合も**他の家族のデータは壊れない**（本人の文書しか書けない）し、端末内保存が正なので遊びは止まらない。
- 見直す条件: Firebase コンソールの使用量で、家族の利用では説明できない読み書き（例: 1 日 1,000 回を超える）が続いたら、App Check を入れる（承認を取る）。

---

## 8. 無料枠と、超えたとき

| 項目 | 無料枠（Spark） | このアプリの見込み（1 家族・1 日） | 超えたとき |
|---|---|---|---|
| Firestore 読み取り | 5 万／日 | （1 人 1 文書に分けたあと）起動 5 回 × 最大 5（親 1 ＋ プロフィール 4 人）＋ 保存 20 回 ×（トランザクションの読み取り 1〜2 ＋ ルールが親を見る読み取り 1）＋ 保護者画面 2 回 ≒ 80〜110（R4-1 の作りで変わる） | その日（または月）の残りは読み書きが失敗する。アプリは端末内の記録で動き続け、次に送れたときに同期する |
| Firestore 書き込み | 2 万／日 | 出動 20 回 × 2（プロフィール 1 ＋ 親 1）＋ 保護者の操作数回 ≒ 45 | 同上 |
| Firestore 削除 | 2 万／日 | ほぼ 0 | 同上 |
| Firestore 保存 | 1 GiB | 約 3 KB | 書き込みが止まる |
| Firestore 転送 | 10 GiB／月 | 約 1 MB／月 | 同上 |
| Authentication（Google） | 家族の利用では上限に届かない（1 章） | 保護者 1〜2 人 | ログインできなくなる。ログイン済みの端末も、トークンの更新ができないと保存が止まる |

- 家族で使う範囲では、どの枠も 1% に届かない。1 家族 45 回／日の書き込みなら、400 家族ほどまで書き込みの枠に収まる計算（1 人 1 文書に分けた後の見込み）。
- 超えたときの止まり方: 料金プランのページは「その製品は、その月の残りは止まる」と書き、Firestore の料金のページは「日ごとの枠は太平洋時間の真夜中ごろに戻る」と書く。どちらが当てはまるかは今回確かめられなかったので、**最悪はその月の残りが止まる**と見込んで説明する。どちらでも**課金はされない**。
- 承認者が確かめること（R4 完了条件 6）: 月に 1 回、Firebase コンソールの「使用量と請求額」で、Spark のままであること・使用量が枠から遠いことを見る。

---

## 9. 費用の見込み

- **0 円**。Spark プランで請求先を登録しないので、仕組みとして課金が起こらない。GitHub Pages は公開リポジトリなので無料（`docs/design-elementary.md` 7.1）。
- 費用が発生しうるのは、0 章の「やってはいけない操作」をしたときだけ。

---

## 10. 後片付け（削除）の手順（承認が要る）

R4 を取りやめる、または試験のプロジェクトを消すとき。保護者 1 人分の削除は `docs/r4-data-and-privacy.md` (d)。

1. （承認）アプリからログインの項目を外す PR を main にマージする（`src/cloud.js` を読まないようにする）。公開された設定値はリポジトリの履歴に残るが、秘密ではないので問題ない。プロジェクトを消せば使えなくなる。
2. 利用者がいる場合は、先に保護者へ知らせる（端末内の記録は残る。クラウドの記録は消える）。
3. Firebase コンソール → プロジェクトの設定 →「全般」→ 一番下の「プロジェクトを削除」。
   - 削除すると、すべてのサービスとデータ（Authentication の利用者・Firestore の文書）が使えなくなる。**30 日の間はプロジェクトの所有者が Google Cloud コンソールから復元できる**。30 日を過ぎると完全に削除され、プロジェクト ID は再利用できない（Firebase のヘルプ）。
   - Google Cloud 上のデータは、削除の依頼から**最長で約 6 か月（180 日）**でバックアップからも消える（Google Cloud の「データの削除」）。
4. 部分的に片付けるとき:
   - Firestore だけ: Firestore Database → データベースの「…」→ 削除。
   - Web アプリだけ: プロジェクトの設定 → 「マイアプリ」→ アプリを削除（30 日後に完全に削除。その後は戻せない）。
   - Google ログインだけ止める: Authentication → Sign-in method → Google を無効。
5. 承認済みドメイン・API キーの制限は、プロジェクトを消せば一緒に消える。
6. `ops/project-links.tsv` やドキュメントの URL を直す（必要なら）。

---

## 11. 出典（2026-10-24 に確認）

- Firebase の料金プラン（Spark は支払い情報不要、超過時はその月停止、請求先の紐づけ・Google Cloud のサービスで Blaze へ自動切替）: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Firebase の料金（Spark の Authentication・Firestore・Hosting・App Check の枠）: https://firebase.google.com/pricing
- Cloud Firestore の料金（無料枠、真夜中の太平洋時間で戻る、ルールの `get()` も読み取り）: https://firebase.google.com/docs/firestore/pricing
- Cloud Firestore の上限（文書 1 MiB、ルールの式 1,000・深さ 20・`get()` 10 回、TTL・PITR・バックアップは無料枠外）: https://firebase.google.com/docs/firestore/quotas
- Cloud Firestore の場所（`asia-northeast1`、作成後は変更不可）: https://firebase.google.com/docs/firestore/locations
- Firebase Authentication の上限（Identity Platform 付き Spark で 1 日 3,000 人、作成は 1 IP 100／時）: https://firebase.google.com/docs/auth/limits
- `signInWithRedirect` の推奨（Option 1〜5、ポップアップの欠点）: https://firebase.google.com/docs/auth/web/redirect-best-practices
- Google ログイン（Web）: https://firebase.google.com/docs/auth/web/google-signin
- Firebase Authentication の FAQ（承認済みドメイン、localhost は最初から入る・本番では消すことを勧める）: https://firebase.google.com/docs/auth/faq-and-troubleshooting
- Firebase の API キー（秘密ではない、Gemini を同じキーに許さない）: https://firebase.google.com/docs/projects/api-keys
- Firebase の CDN での読み込み（gstatic の ES モジュール、npm 推奨）: https://firebase.google.com/docs/web/alt-setup
- App Check（reCAPTCHA v3、Enterprise を推奨、Enterprise は月 1 万回まで無料）: https://firebase.google.com/docs/app-check/web/recaptcha-provider
- ルールでの項目の制限（`hasOnly`・`hasAll`・`diff`・型の検査）: https://firebase.google.com/docs/firestore/security/rules-fields
- ルールの言語（ループ・再帰なし、深さ 20）: https://firebase.google.com/docs/rules/rules-language
- ルールの `Map`・`List` の参照（`values()`・`join()`。本文は取れず、仕様の写し https://pub.dev/documentation/firebase_rules/latest/firebase/RulesList-class.html で確認。5.3 で要確認）: https://firebase.google.com/docs/reference/rules/rules.Map 、 https://firebase.google.com/docs/reference/rules/rules.List
- Firebase のプライバシーとセキュリティ（Authentication が扱う情報と保存期間）: https://firebase.google.com/support/privacy
- Google Cloud のデータの削除（最長約 180 日）: https://docs.cloud.google.com/docs/security/deletion
- Firebase のプロジェクトの削除（30 日は復元可）: https://support.google.com/firebase/answer/9137886
- OAuth の審査（機密でないスコープだけなら必須ではない、ブランドの確認）: https://support.google.com/cloud/answer/13463073
- ホーム画面のアプリでのポップアップのログイン失敗の報告（公式ではない。2.の判断材料）: https://developer.apple.com/forums/thread/737188 、 https://developer.apple.com/forums/thread/649699
