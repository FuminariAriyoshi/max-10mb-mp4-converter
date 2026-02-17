# Vercelデプロイガイド

## GitHubからVercelにデプロイする方法

### 1. GitHubにコードをプッシュ

```bash
# リポジトリを初期化（まだの場合）
git init

# ファイルを追加
git add .

# コミット
git commit -m "Initial commit: Video converter app"

# GitHubにリモートリポジトリを追加（GitHubでリポジトリを作成済みの場合）
git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git

# プッシュ
git push -u origin main
```

### 2. Vercelでプロジェクトを作成

1. [Vercel](https://vercel.com) にアクセスしてログイン
2. 「Add New Project」をクリック
3. GitHubアカウントを連携（まだの場合）
4. リポジトリを選択
5. プロジェクト設定：
   - **Framework Preset**: `Other` を選択
   - **Root Directory**: `./` （そのまま）
   - **Build Command**: （空欄のまま - ビルド不要）
   - **Output Directory**: （空欄のまま）
   - **Install Command**: `npm install` （自動検出される）
6. 「Deploy」をクリック

### 3. デプロイ完了

- デプロイが完了すると、VercelからURLが発行されます
- 例: `https://your-project.vercel.app`
- このURLでWebアプリにアクセスできます

### 4. 今後の更新

GitHubにプッシュするだけで、自動的にデプロイされます：

```bash
git add .
git commit -m "Update: 変更内容"
git push
```

## 注意事項

### 実行時間制限

- **Hobbyプラン**: 最大60秒
- **Proプラン**: 最大300秒（5分）

大きな動画ファイルの変換には時間がかかる場合があります。

### ファイルサイズ制限

- アップロード: 最大500MB
- 出力: 各動画20MB以下

### ffmpegバイナリ

Vercel環境では自動的に `@ffmpeg-installer/ffmpeg` と `@ffprobe-installer/ffprobe` が使用されます。ローカル開発とは異なるバイナリが使われますが、動作は同じです。

## トラブルシューティング

### デプロイエラー

- `@ffmpeg-installer/ffmpeg` が見つからない場合：
  - `package.json` に依存関係が含まれているか確認
  - `npm install` が正常に実行されているか確認

### 実行時間超過

- 動画が大きすぎる場合、変換に時間がかかります
- Proプランにアップグレードするか、動画サイズを小さくしてください

### メモリ不足

- Vercelの無料プランでは512MBのメモリ制限があります
- 大きな動画を処理する場合は、Proプランが必要な場合があります
