# NewsPicker 📰

NewsPickerは、GitHub Actions上で完全に完結するサーバーレスの日次ニュースキュレーションシステムです。
さまざまな情報源からテック系のニュースを取得し、Gemini AI APIを用いてあなたの興味（ペルソナ）に合わせてスコアリングを行い、毎日の読むべき記事のチェックリストをGitHub Issueとして作成します。

最大の特徴は、**システムの学習機能**です。GitHub Issue上であなたが読んだ記事にチェック（`[x]`）を入れると、別のアクションがその履歴を分析し、あなたの興味の変化に合わせて興味関心プロファイル（`persona.json`）を動的に更新します。

## 主な機能

- **自動情報収集:** 以下のソースからトレンド記事を取得します。
  - はてなブックマーク （IT / プログラミング / AI）
  - Hacker News
  - Reddit (r/programming, r/technology, r/cybersecurity, r/opensource, r/webdev など)
- **AIによるキュレーション:** Googleの **Gemini 1.5 Flash** を使用して、現在のペルソナに基づき記事をスコアリングし、1文の要約を生成します。
- **GitHub Issueでの配信:** 毎日 日本時間 06:00 に、クリーンなMarkdown形式のチェックリストを備えた新規Issueを作成します。
- **ペルソナの学習機能:** 日本時間 05:00 に、前日のIssueの既読状況（`[x]`）を確認し、AIがあなたの興味関心を再分析・学習し、次回以降の推薦精度を向上させます。

## セットアップ手順

### 1. リポジトリの設定

システムはGitHub Actions経由で動作するため、ローカルサーバーやインフラの準備は不要です。ただし、一部のリポジトリ設定が必要です。

1. リポジトリの **Settings > Actions > General** を開きます。
2. 下にスクロールして **Workflow permissions** のセクションを確認し、**Read and write permissions** を選択します。
3. **Allow GitHub Actions to create and approve pull requests** のチェックボックスをオンにします（これによりBotが`persona.json`を自発的に更新可能になります）。
4. **Save** をクリックします。

### 2. 環境変数 (Secrets) の設定

AIによるスコアリングとIssueの作成を実行するため、GitHubのSecretsにAPIキーを登録する必要があります。

1. リポジトリの **Settings > Secrets and variables > Actions** を開きます。
2. **New repository secret** をクリックします。
3. 以下の内容でSecretを追加します:
   - Name: `GEMINI_API_KEY`
   - Secret: *(AIzaから始まるGeminiのAPIキー)*

*(※ `GITHUB_TOKEN` はGitHub Actionsによって自動で発行・提供されるため、手動で設定する必要はありません。)*

## システムの動作の流れ

このプロジェクトには、主に2つのGitHub Actionワークフローが含まれています。

### 1. 日次ニュース配信 (`.github/workflows/daily-news.yml`)
- **トリガー:** 毎日 21:00 UTC (日本時間 06:00) に自動実行。
- **実行内容:** `npm start create-issue`
- **処理:** 各サイトからニュースを取得し、Geminiでスコアリングを行い、`📰 Daily NewsPicker: YYYY-MM-DD` という件名のIssueを作成します。

### 2. ペルソナ学習 (`.github/workflows/learn-persona.yml`)
- **トリガー:** 毎日 20:00 UTC (日本時間 05:00) に自動実行（新着Issueが作成される1時間前）。
- **実行内容:** `npm start learn`
- **処理:** 前日のIssueの本文を読み取ります。`[x]` がついた記事を「読んだ」、`[ ]` を「無視した」としてGeminiで解析させ、最新の興味分野のリストを抽出し、`data/persona.json` を自動でコミット＆プッシュします。

## ローカル環境でのテスト・手動実行

システムのスクリプトをローカルで試したい場合は、以下の手順を実行してください：

1. リポジトリをクローンし、依存パッケージをインストールします：
   ```bash
   npm install
   ```

2. ルートディレクトリに `.env` ファイルを作成し、APIキーを追加します：
   ```env
   GITHUB_TOKEN=your_github_personal_access_token_with_repo_access
   GITHUB_REPOSITORY=your_username/NewsPicker
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. スクリプトを実行します：
   - テストIssueを作成する場合: `npm start create-issue`
   - ペルソナ学習アルゴリズムを試す場合: `npm start learn`

## 手動でのペルソナ変更

AIが推薦してくる分野をリセットしたり、根本的に変えたい場合は、リポジトリ内の `data/persona.json` を直接編集してコミットしてください。次回の実行から、その内容がベースとして使用されます。
