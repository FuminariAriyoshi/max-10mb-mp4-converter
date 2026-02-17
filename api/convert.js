const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// Vercel環境用: ffmpeg/ffprobeのパス設定（関数内で実行）
let ffmpegInitialized = false;
function initializeFfmpeg() {
  if (ffmpegInitialized) return;
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    ffmpeg.setFfprobePath(ffprobeInstaller.path);
    console.log('ffmpeg path:', ffmpegInstaller.path);
    console.log('ffprobe path:', ffprobeInstaller.path);
    ffmpegInitialized = true;
  } catch (err) {
    console.error('ffmpeg/ffprobe installer error:', err.message);
    throw new Error(`ffmpeg/ffprobe setup failed: ${err.message}`);
  }
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

// Vercelサーバーレス関数（CommonJS形式）
module.exports = async function handler(req, res) {
  try {
    // ffmpeg/ffprobeを初期化
    initializeFfmpeg();

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Request received, setting up multer...');

    // MulterミドルウェアをPromiseでラップ
    const uploadMiddleware = upload.array('videos', 10);
    await new Promise((resolve, reject) => {
      uploadMiddleware(req, res, (err) => {
        if (err) {
          console.error('Multer error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'ファイルを選択してください' });
    }

    console.log(`Processing ${files.length} file(s)`);

    const results = [];

    for (const file of files) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2);
      const inputPath = path.join(TMP_DIR, `input-${timestamp}-${random}${path.extname(file.originalname)}`);
      const baseName = path.basename(file.originalname, path.extname(file.originalname));
      const outputPath = path.join(TMP_DIR, `output-${timestamp}-${random}-${baseName}-converted.mp4`);

      try {
        console.log(`Processing: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // メモリから一時ファイルに書き込み
        fs.writeFileSync(inputPath, file.buffer);
        console.log(`Input file written: ${inputPath}`);

        const info = await getVideoInfo(inputPath);
        console.log(`Video info: duration=${info.duration}s, size=${(info.fileSize / 1024 / 1024).toFixed(2)}MB`);
        
        const trimDuration = calcTrimDuration(info.duration, info.fileSize, info.bitrate);
        if (trimDuration) {
          console.log(`Trimming to ${trimDuration}s`);
        }

        await processVideo(inputPath, outputPath, trimDuration);
        console.log(`Video processed: ${outputPath}`);

        const outputStat = fs.statSync(outputPath);
        const outputBuffer = fs.readFileSync(outputPath);

        results.push({
          original: file.originalname,
          output: `${baseName}-converted.mp4`,
          trimmed: !!trimDuration,
          fileSize: outputStat.size,
          data: outputBuffer.toString('base64'),
        });

        // 一時ファイルを削除
        try { fs.unlinkSync(inputPath); } catch (_) {}
        try { fs.unlinkSync(outputPath); } catch (_) {}
      } catch (err) {
        console.error(`Error processing ${file.originalname}:`, err);
        results.push({
          original: file.originalname,
          error: err.message || '変換に失敗しました',
        });
        // 一時ファイルを削除
        try { fs.unlinkSync(inputPath); } catch (_) {}
        try { fs.unlinkSync(outputPath); } catch (_) {}
      }
    }

    return res.json({ results });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}
