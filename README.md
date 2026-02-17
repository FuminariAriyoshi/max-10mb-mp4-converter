# 動画 → MP4 10MB以下 変換

mov / mp4 動画をアップロードすると、mp4に変換し、それぞれ10MB以下になるように長さを切り、まとめてダウンロードできるWebアプリです。

## ローカル開発

### 必要な環境

- **Node.js** 18以上
- **ffmpeg** がインストールされていること

### ffmpeg のインストール

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg
```

**Windows:**  
[ffmpeg.org](https://ffmpeg.org/download.html) からダウンロードしてパスを通してください。

## セットアップ

```bash
npm install
```

### 起動

```bash
npm start
```

ブラウザで http://localhost:3001 を開いてください。ポート3000が使用中の場合は `PORT=3001 npm start` で起動できます。

## Vercelへのデプロイ

### GitHubからデプロイ（推奨）

1. **GitHubにリポジトリをプッシュ**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
   git push -u origin main
   ```

2. **Vercelに接続**
   - [Vercel](https://vercel.com) にアクセスしてログイン
   - 「Add New Project」をクリック
   - GitHubリポジトリを選択
   - プロジェクト設定：
     - **Framework Preset**: Other
     - **Root Directory**: `./` (そのまま)
     - **Build Command**: （空欄のまま）
     - **Output Directory**: （空欄のまま）
   - 「Deploy」をクリック

3. **自動デプロイ**
   - GitHubにプッシュするたびに自動的にデプロイされます
   - プルリクエストごとにプレビュー環境も作成されます

### CLIからデプロイ

1. **Vercel CLIをインストール**（まだの場合）
   ```bash
   npm i -g vercel
   ```

2. **Vercelにログイン**
   ```bash
   vercel login
   ```

3. **プロジェクトをデプロイ**
   ```bash
   vercel
   ```

4. **本番環境にデプロイ**
   ```bash
   vercel --prod
   ```

### 注意事項

- **実行時間制限**: Vercel Proプランでは最大300秒（5分）まで実行可能です。Hobbyプランでは60秒です。
- **ファイルサイズ**: アップロード可能なファイルサイズは500MBまでです。
- **ffmpeg**: Vercel環境では自動的に `@ffmpeg-installer/ffmpeg` と `@ffprobe-installer/ffprobe` が使用されます。

### 環境変数

特に必要な環境変数はありません。

## 使い方

1. 動画ファイル（mov, mp4）をドラッグ＆ドロップまたはクリックして選択
2. 複数ファイルをまとめて選択可能
3. 「変換する」ボタンをクリック
4. 変換が終わったら各ファイルの「ダウンロード」から保存

## 機能

- mov, mp4 形式に対応
- 20MB超えの動画は長さを切り、20MB以下に調整
- 複数ファイルの一括変換
- 変換後はmp4形式でダウンロード
- 音声は削除されます
