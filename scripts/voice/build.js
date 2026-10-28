// VOICEVOX エンジンで読み上げの音声を作って voice/<id>/ に書き出す（Node の標準機能だけ。afconvert は macOS）。設計は docs/design-voice.md 10 章。
// 使い方: node scripts/voice/build.js --voice metan [--engine http://127.0.0.1:50021] [--all] [--dry-run] [--review <フォルダ>]
//   --all     全部作り直す（既定は、変わった文だけ）
//   --review  聞いて確かめるページ（index.html）と音声のコピーをそのフォルダに書く（リポジトリの外に置く）
// 文ごとの鍵 = sha256(エンジンの版 + スタイル + 合成に渡す最終の query)。query には漢字まじりの文・抑揚の直し・設定が全部入るので、
// どれを変えても、変わった文だけ作り直される。音声ファイル名は鍵の先頭 12 桁。
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const { units } = require('./list.js');
const YOMI = require('./yomi.json'), ACCENT = require('./accent.json'), VOICES = require('./voices.json');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const ID = opt('voice', 'metan'), ENGINE = opt('engine', 'http://127.0.0.1:50021'), ALL = !!opt('all', false), DRY = !!opt('dry-run', false), REVIEW = opt('review', '');
const V = VOICES[ID];
if (!V) { console.error('voices.json に無い声: ' + ID); process.exit(1); }
const OUT = path.join(ROOT, 'voice', ID);

async function api(method, p, body) {
  const res = await fetch(ENGINE + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(method + ' ' + p.slice(0, 80) + ' → ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res;
}

// ひらがなの文 → VOICEVOX に渡す漢字まじりの文
function toSpoken(u) {
  if (YOMI.sentences[u.text]) return YOMI.sentences[u.text];
  if (YOMI.wordsFor.indexOf(u.why) < 0) return u.text;
  let t = u.text;
  YOMI.words.forEach(w => { t = t.split(w[0]).join(w[1]); });
  return t;
}

const moraText = ap => ap.moras.map(m => m.text).join('');
// 文末の句から、不自然になりやすい形を点数にする（高いほど怪しい）。reasons は理由
function suspicion(text, phrases) {
  const reasons = []; let score = 0;
  const last = phrases[phrases.length - 1];
  if (!last) return { score, reasons };
  const kana = last.kana, n = last.n, mark = (text.match(/[。！？]$/) || [''])[0];
  if (n > 1 && last.accent === n) { score += 3; reasons.push('尾高（句の長さと同じ accent。文末が下がらない）'); }
  if (last.accent === 0 && n > 1 && mark !== '？') { score += 2; reasons.push('平板で言い切る'); }
  else if (last.accent === 0 && n > 2 && mark === '？') { score += 1; reasons.push('平板で終わる疑問'); }
  if (/(コオ|ヨオ)$/.test(kana)) { score += 2; reasons.push('「〜こう／〜よう」'); }
  if (/カナ$/.test(kana)) { score += 2; reasons.push('「〜かな」'); }
  if (/ダネ$|ネ$/.test(kana)) { score += 2; reasons.push('「〜ね」'); }
  if (/ソオ$|スゴイ$|ヤッタ|ヨク|ホメ|ガンバ|イイ$|ステキ|オメデトオ/.test(kana)) { score += 3; reasons.push('感動詞・ほめ言葉'); }
  if (/ネ$/.test(kana) && /[！]$/.test(text)) { score += 1; reasons.push('「〜ね！」'); }
  return { score, reasons };
}

function wavMs(buf) {
  let p = 12, rate = 24000, ch = 1, bits = 16;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4), size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') { ch = buf.readUInt16LE(p + 10); rate = buf.readUInt32LE(p + 12); bits = buf.readUInt16LE(p + 22); }
    if (id === 'data') return Math.round(size / (rate * ch * bits / 8) * 1000);
    p += 8 + size + (size & 1);
  }
  throw new Error('WAV の data が無い');
}

(async () => {
  const version = (await (await api('GET', '/version')).json());
  const sp = (await (await api('GET', '/speakers')).json()).find(s => s.speaker_uuid === V.uuid);
  const style = sp && sp.styles.find(s => s.name === V.style);
  if (!style) throw new Error('スタイルが見つからない: ' + V.speaker + ' ' + V.style);
  const SID = style.id, q = o => Object.keys(o).map(k => k + '=' + encodeURIComponent(o[k])).join('&');
  fs.mkdirSync(OUT, { recursive: true });

  const oldMs = {};   // 前に作ったパックの長さ（鍵 → ms）
  try { new Function('Manabi', fs.readFileSync(path.join(OUT, 'index.js'), 'utf8'))({ voicePack: p => Object.values(p.clips).forEach(c => { oldMs[c[0]] = c[1]; }) }); } catch (e) {}
  const accentWords = ACCENT.words, list = units(), clips = {}, info = [];
  let made = 0, kept = 0, bytes = 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));
  for (const u of list) {
    const spoken = toSpoken(u);
    let query, fixed = '';
    const whole = ACCENT.sentences[u.text.replace(/[。！？]$/, '')] || ACCENT.sentences[u.text];
    if (whole) {
      query = await (await api('POST', '/audio_query?' + q({ text: spoken, speaker: SID }))).json();
      query.accent_phrases = await (await api('POST', '/accent_phrases?' + q({ text: whole, speaker: SID, is_kana: true }))).json();
      fixed = '文ごと ' + whole;
    } else {
      query = await (await api('POST', '/audio_query?' + q({ text: spoken, speaker: SID }))).json();
      const hit = [];
      query.accent_phrases.forEach(ap => { const k = moraText(ap); if (accentWords[k] !== undefined && ap.accent !== accentWords[k]) { ap.accent = accentWords[k]; hit.push(k + '→' + accentWords[k]); } });
      if (hit.length) fixed = '言葉ごと ' + hit.join(' ');
    }
    if (fixed) query.accent_phrases = await (await api('POST', '/mora_pitch?' + q({ speaker: SID }), query.accent_phrases)).json();   // 直した高さを作り直す
    Object.assign(query, V.params, { outputSamplingRate: 24000, outputStereo: false });
    const key = crypto.createHash('sha256').update(version + '\n' + V.uuid + ':' + SID + '\n' + JSON.stringify(query)).digest('hex').slice(0, 12);
    const file = path.join(OUT, key + '.aac');
    const phrases = query.accent_phrases.map(ap => ({ kana: moraText(ap), accent: ap.accent, n: ap.moras.length }));
    let ms;
    if (!ALL && fs.existsSync(file) && oldMs[key] !== undefined) { ms = oldMs[key]; kept++; }
    else if (DRY) { ms = 0; made++; }
    else {
      const wav = Buffer.from(await (await api('POST', '/synthesis?' + q({ speaker: SID }), query)).arrayBuffer());
      ms = wavMs(wav);
      const w = path.join(tmp, key + '.wav');
      fs.writeFileSync(w, wav);
      execFileSync('afconvert', ['-f', 'adts', '-d', 'aac', '-c', '1', '-b', '32000', w, file]);
      fs.unlinkSync(w);
      made++;
    }
    clips[u.text] = [key, ms];
    if (fs.existsSync(file)) bytes += fs.statSync(file).size;
    info.push(Object.assign({ text: u.text, why: u.why, spoken, phrases, fixed, file: key + '.aac', ms }, suspicion(u.text, phrases)));
    if ((made + kept) % 100 === 0) process.stdout.write((made + kept) + ' ');
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n作った ' + made + '・そのまま ' + kept + '・合計 ' + list.length + ' 文');

  if (!DRY) {
    // 一覧に無い音声を消す
    const used = new Set(Object.values(clips).map(c => c[0]));
    fs.readdirSync(OUT).forEach(f => { const k = /^()([0-9a-f]{12})(\.aac)$/.exec(f); if (k && !used.has(k[2])) fs.unlinkSync(path.join(OUT, f)); });
    const sorted = {}; Object.keys(clips).sort((a, b) => a < b ? -1 : a > b ? 1 : 0).forEach(k => { sorted[k] = clips[k]; });
    const pack = { id: ID, label: V.label, credit: V.credit, engine: version, style: { uuid: V.uuid, name: V.style, id: SID }, params: V.params, made: new Date().toLocaleDateString('sv'), ext: 'aac', clips: sorted };
    fs.writeFileSync(path.join(OUT, 'index.js'), '// ' + V.credit + '。scripts/voice/build.js が書く（手で直さない）。文 → [ファイル名, 長さ ms]\nManabi.voicePack(' + packText(pack) + ');\n');
    writeVoices();
    fs.writeFileSync(path.join(OUT, 'README.md'), readme(pack, Object.keys(clips).length, bytes));
        console.log('音声 ' + used.size + ' ファイル、合計 ' + (bytes / 1048576).toFixed(2) + ' MB（' + bytes + ' バイト）');
  }
  const sus = info.filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  console.log('怪しい文 ' + sus.length + ' 件。上位:');
  sus.slice(0, 8).forEach(x => console.log('  ' + x.score + ' ' + x.text + ' / ' + x.phrases.map(p => p.kana + '[' + p.accent + ']').join(' ') + ' / ' + x.reasons.join('・')));
  if (REVIEW && !DRY) writeReview(REVIEW, info);
})().catch(e => { console.error(e); process.exit(1); });

function packText(pack) {
  const c = pack.clips, head = Object.assign({}, pack); delete head.clips;
  return JSON.stringify(head).replace(/\}$/, ',\n"clips":{\n') + Object.keys(c).map(k => JSON.stringify(k) + ':' + JSON.stringify(c[k])).join(',\n') + '\n}}';
}

// voice/voices.js: 声のパックがある声を、voices.json の並びで
function writeVoices() {
  const ids = Object.keys(VOICES).filter(id => fs.existsSync(path.join(ROOT, 'voice', id, 'index.js')));
  const list = ids.map(id => ({ id, label: VOICES[id].label, credit: VOICES[id].credit }));
  fs.writeFileSync(path.join(ROOT, 'voice', 'voices.js'),
    '// 同梱している声の一覧（保護者画面の並びと、おまかせの先頭）。scripts/voice/build.js が書く\n(function (root) {\n  root.Manabi = root.Manabi || {};\n  root.Manabi.voiceList = ' + JSON.stringify(list) + ';   // [{ id, label, credit }]\n})(typeof window !== \'undefined\' ? window : globalThis);\n');
}

function readme(pack, n, bytes) {
  return '# ' + V.credit + '（voice/' + ID + '）\n\n' +
    'アプリの読み上げ（「たんまつの こえ」の代わり）に使う音声です。**自由に使える素材ではありません**（`voice/README.md`）。\n\n' +
    '- クレジット: ' + V.credit + '\n' +
    '- キャラクターの規約: ' + V.terms + '（確認日 2026-10-27。書き出すたびに見直して日付を更新する）。クレジット必須・商用可\n' +
    '- VOICEVOX エンジン: ' + pack.engine + '（Docker `voicevox/voicevox_engine:cpu-arm64-' + pack.engine + '`、手元の Mac だけで動かした）\n' +
    '- スタイル: ' + V.speaker + ' ' + V.style + '（uuid ' + V.uuid + '、id ' + pack.style.id + '）\n' +
    '- 設定: ' + JSON.stringify(V.params) + '\n' +
    '- 渡した文: 漢字まじり（画面の文字はひらがなのまま）。`scripts/voice/yomi.json`。抑揚の直し: `scripts/voice/accent.json`（直したあと /mora_pitch で高さを作り直した）\n' +
    '- 形式: AAC-LC 32kbps・24kHz・モノラル（ADTS の .aac。`afconvert -f adts -d aac -c 1 -b 32000`）\n' +
    '- 作った日: ' + pack.made + '、文の数 ' + n + '、音声の大きさ 合計 ' + (bytes / 1048576).toFixed(2) + ' MB\n' +
    '- 作り方: `node scripts/voice/build.js --voice ' + ID + '`（VOICEVOX エンジンを起動して。変わった文だけ作り直す。`--all` で全部）\n';
}

function writeReview(dir, info) {
  fs.mkdirSync(path.join(dir, 'voice'), { recursive: true });
  info.forEach(x => fs.copyFileSync(path.join(OUT, x.file), path.join(dir, 'voice', x.file)));
  const FREQ = { fixed: 1, reward: 1, car: 1, shelf: 1 };
  const isFreq = x => FREQ[x.why] || (x.why === 'trace' && x.text.length > 3);
  const freq = info.filter(isFreq), sus = info.filter(x => !isFreq(x) && x.score > 0).sort((a, b) => b.score - a.score), rest = info.filter(x => !isFreq(x) && x.score === 0);
  const rows = []
    .concat(freq.map(x => Object.assign({ grp: 'よく出る文' }, x)))
    .concat(sus.map(x => Object.assign({ grp: '怪しい文' }, x)))
    .concat(rest.map(x => Object.assign({ grp: 'そのほか' }, x)));
  const html = fs.readFileSync(path.join(__dirname, 'review.tmpl.html'), 'utf8').replace('/*ROWS*/[]', JSON.stringify(rows).replace(/</g, '\\u003c'));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log('確かめるページ: ' + path.join(dir, 'index.html') + '（' + rows.length + ' 文）');
}
