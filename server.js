const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');

// ffmpeg / ffprobe のパスを設定（Homebrew を優先）
function setupFfmpegPaths() {
  const candidates = ['/opt/homebrew/bin', '/usr/local/bin'];
  for (const dir of candidates) {
    const ffmpegPath = path.join(dir, 'ffmpeg');
    const ffprobePath = path.join(dir, 'ffprobe');
    if (fs.existsSync(ffprobePath)) {
      ffmpeg.setFfmpegPath(ffmpegPath);
      ffmpeg.setFfprobePath(ffprobePath);
      return;
    }
  }
  try {
    ffmpeg.setFfmpegPath(execSync('which ffmpeg', { encoding: 'utf8' }).trim());
    ffmpeg.setFfprobePath(execSync('which ffprobe', { encoding: 'utf8' }).trim());
  } catch (_) {
    throw new Error('ffmpeg / ffprobe が見つかりません。brew install ffmpeg でインストールしてください。');
  }
}
setupFfmpegPaths();

const app = express();
const PORT = process.env.PORT || 3001;
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// アップロード用ディレクトリ
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');

[UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer設定 - mov, mp4のみ受け付け
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.random().toString(36).slice(2);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.mov', '.mp4'].includes(ext)) cb(null, true);
    else cb(new Error('mov または mp4 のみ対応しています'));
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 最大500MBまでアップロード可
});

// ffprobeで動画情報取得
function getVideoInfo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const format = metadata.format;
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const duration = parseFloat(format.duration) || 0;
      const fileSize = format.size || 0;
      const bitrate = format.bit_rate ? parseInt(format.bit_rate, 10) : Math.floor((fileSize * 8) / duration);
      resolve({ duration, fileSize, bitrate, videoStream });
    });
  });
}

// 各動画を 20MB 以下にするため、トリムする長さを計算
function calcTrimDuration(duration, fileSize, bitrate) {
  if (fileSize <= MAX_SIZE_BYTES) return null; // 20MB以下ならトリム不要
  // ファイルサイズに比例してトリム（余裕を 95% に）
  const ratio = (MAX_SIZE_BYTES / fileSize) * 0.95;
  return Math.max(1, duration * ratio);
}

// 各動画を個別に 20MB 以下に変換・トリム
function processVideo(inputPath, outputPath, trimDuration) {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath);
    if (trimDuration) cmd = cmd.duration(trimDuration);
    cmd
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-an', // 音声を削除
        '-movflags +faststart',
        '-fs ' + MAX_SIZE_BYTES, // 各出力を 20MB で打ち切り
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/convert', upload.array('videos', 10), async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'ファイルを選択してください' });
  }

  const results = [];

  for (const file of files) {
    const inputPath = file.path;
    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    const outputPath = path.join(OUTPUT_DIR, `${baseName}-converted.mp4`);

    try {
      const info = await getVideoInfo(inputPath);
      // 各動画ごとに 20MB 以下になるようトリム長さを計算
      const trimDuration = calcTrimDuration(info.duration, info.fileSize, info.bitrate);

      await processVideo(inputPath, outputPath, trimDuration);

      const outputStat = fs.statSync(outputPath);
      results.push({
        original: file.originalname,
        output: path.basename(outputPath),
        trimmed: !!trimDuration,
        fileSize: outputStat.size,
        downloadUrl: `/output/${path.basename(outputPath)}`,
      });
    } catch (err) {
      results.push({
        original: file.originalname,
        error: err.message || '変換に失敗しました',
      });
    } finally {
      try { fs.unlinkSync(inputPath); } catch (_) {}
    }
  }

  res.json({ results });
});

app.use('/output', express.static(OUTPUT_DIR));

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT} で起動中`);
});
