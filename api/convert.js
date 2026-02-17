const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// Vercel環境用: ffmpeg/ffprobeのパス設定
try {
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
} catch (err) {
  console.error('ffmpeg/ffprobe installer not found:', err.message);
}

const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Vercel環境では /tmp ディレクトリのみ書き込み可能
const TMP_DIR = '/tmp';

// Multer設定 - メモリストレージを使用（Vercel環境に最適化）
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.mov', '.mp4'].includes(ext)) cb(null, true);
    else cb(new Error('mov または mp4 のみ対応しています'));
  },
  limits: { fileSize: 500 * 1024 * 1024 },
});

// ffprobeで動画情報取得
function getVideoInfo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const format = metadata.format;
      const duration = parseFloat(format.duration) || 0;
      const fileSize = format.size || 0;
      const bitrate = format.bit_rate ? parseInt(format.bit_rate, 10) : Math.floor((fileSize * 8) / duration);
      resolve({ duration, fileSize, bitrate });
    });
  });
}

// 各動画を 20MB 以下にするため、トリムする長さを計算
function calcTrimDuration(duration, fileSize, bitrate) {
  if (fileSize <= MAX_SIZE_BYTES) return null;
  const ratio = (MAX_SIZE_BYTES / fileSize) * 0.95;
  return Math.max(1, duration * ratio);
}

// 動画を変換・トリム
function processVideo(inputPath, outputPath, trimDuration) {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath);
    if (trimDuration) cmd = cmd.duration(trimDuration);
    cmd
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-an',
        '-movflags +faststart',
        '-fs ' + MAX_SIZE_BYTES,
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

// Vercelサーバーレス関数
// Vercelサーバーレス関数（CommonJS形式）
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // MulterミドルウェアをPromiseでラップ
  const uploadMiddleware = upload.array('videos', 10);
  await new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'ファイルを選択してください' });
  }

  const results = [];

  for (const file of files) {
    const inputPath = path.join(TMP_DIR, `input-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`);
    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    const outputPath = path.join(TMP_DIR, `output-${Date.now()}-${Math.random().toString(36).slice(2)}-${baseName}-converted.mp4`);

    try {
      // メモリから一時ファイルに書き込み
      fs.writeFileSync(inputPath, file.buffer);

      const info = await getVideoInfo(inputPath);
      const trimDuration = calcTrimDuration(info.duration, info.fileSize, info.bitrate);

      await processVideo(inputPath, outputPath, trimDuration);

      const outputStat = fs.statSync(outputPath);
      const outputBuffer = fs.readFileSync(outputPath);

      results.push({
        original: file.originalname,
        output: `${baseName}-converted.mp4`,
        trimmed: !!trimDuration,
        fileSize: outputStat.size,
        data: outputBuffer.toString('base64'), // Base64エンコードして返す
      });

      // 一時ファイルを削除
      try { fs.unlinkSync(inputPath); } catch (_) {}
      try { fs.unlinkSync(outputPath); } catch (_) {}
    } catch (err) {
      results.push({
        original: file.originalname,
        error: err.message || '変換に失敗しました',
      });
      try { fs.unlinkSync(inputPath); } catch (_) {}
      try { fs.unlinkSync(outputPath); } catch (_) {}
    }
  }

  res.json({ results });
}
