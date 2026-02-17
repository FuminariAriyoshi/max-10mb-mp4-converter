# 動画 → MP4 20MB以下 変換

mov / mp4 動画をアップロードすると、mp4に変換し、それぞれ10MB以下になるように長さを切り、まとめてダウンロードできるWebアプリです。

## 必要な環境

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
cd "20mb mp4"
npm install
```

## 起動

```bash
npm start
```

ブラウザで http://localhost:3000 を開いてください。ポート3000が使用中の場合は `PORT=3001 npm start` で起動できます。

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

# max-10mb-mp4-converter
