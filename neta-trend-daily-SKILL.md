---
name: neta-trend-daily
description: "トレンドネタ収集（NewsPicker連携）"
---

# トレンドネタ収集

データソースの人気記事を収集し、ユーザーのペルソナに基づいてスコアリングする。
結果は GitHub Issue として毎朝自動配信される。

## システム構成

- **実行環境**: GitHub Actions（毎日 21:00 UTC / JST 06:00）
- **AIモデル**: Gemini 2.5 Flash Lite（無料枠: 1000 RPD）
- **配信先**: GitHub Issue（チェックボックス付きリスト形式）
- **学習**: 毎日 20:00 UTC / JST 05:00 に前日のIssueを解析してペルソナ更新

## ユーザープロファイル

`data/persona.json` を読み込み、以下の興味領域を理解する：
- AI（開発とセキュリティへの応用）
- Webセキュリティ/ハッキング（OWASP、脆弱性、サプライチェーン攻撃）
- キャリア/人生哲学（経済的自由、外資転職、Build in Public）
- Web Security / Application Security (OWASP, Secure Coding, Vulnerability Research)
- Offensive Security (Penetration Testing, Exploit Development, Bug Bounty)
- Defensive Security (Incident Response, DFIR, Threat Intelligence, SOC)
- Cloud & Infrastructure Security (AWS/GCP/Azure Security, Kubernetes Security, DevSecOps)
- Identity & Access Management (IAM, Zero Trust, Authentication/Authorization)
- Governance, Risk, and Compliance (GRC, Security Policies, Privacy)
- Security News (Breaches, Advisories from JPCERT/CC, IPA, CISA)
- AI Security (LLM Security, Adversarial Machine Learning)
- Enterprise Security Solutions & Platforms (EDR, XDR, SIEM, CWPP, CrowdStrike, Splunk, Trend Micro Deep Security, Cybereason)

※上記は初期値。ペルソナ学習により動的に変化する。

## データソース

### 日本市場（はてブIT）
- https://b.hatena.ne.jp/hotentry/it
- https://b.hatena.ne.jp/hotentry/it/AI・機械学習
- https://b.hatena.ne.jp/hotentry/it/セキュリティ技術
- 各エントリーの**タイトル、元記事URL、ブックマーク数**を取得
- はてブのエントリーページURLではなく、リンク先の元記事URLを抽出

### グローバル（Hacker News）
- Algolia API: `https://hn.algolia.com/api/v1/search?tags=front_page`
- 各記事の**タイトル、HNコメントページURL、ポイント数**を取得
- **タイトルは日本語に翻訳して出力**

### Security News (国内)
- **Security-Next**: `https://www.security-next.com/`
- **JPCERT/CC**: `https://www.jpcert.or.jp/at/` (注意喚起)
- **ScanNetSecurity**: `https://scan.netsecurity.ne.jp/`
- **IPA**: `https://www.ipa.go.jp/security/` (セキュリティ関連情報)

## スコアリング

Gemini AIにより以下の観点で各記事をスコアリング：

**興味度の定義**:
- ★★★: 興味領域に直接関連（ペネトレーションテスト、インシデント事例、重要な脆弱性速報など）
- ★★: 間接的に関連（セキュリティガイドライン、法規制、一般的なITトレンド）
- ★: 一般的なIT/ニュース

**カテゴリ**: セキュリティ速報 / 脆弱性 / アプリケーションセキュリティ / クラウドセキュリティ / エンジニアリング / その他 等

## 出力フォーマット（GitHub Issue）

記事は**興味度別にグルーピング**して出力する（ソース別ではない）。
各記事のソースはインラインタグ（`HN`, `はてブ`, `SEC`, `JPCERT`, `SCAN`, `IPA`）で表示。

```markdown
> 読んだ記事にチェックを入れてください。ペルソナの学習に使われます。

## ★★★ 注目度: 高

- [ ] **[記事タイトル](URL)** `はてブ` / AI / メモ
- [ ] **[緊急アラート](URL)** `JPCERT` / セキュリティ速報 / メモ
- [ ] **[セキュリティニュース](URL)** `SCAN` / セキュリティ / メモ

## ★★ 注目度: 中

- [ ] **[技術記事](URL)** `はてブ` / エンジニアリング / メモ
- [ ] **[IPAガイドライン改訂](URL)** `IPA` / ガイドライン / メモ

## ★ 注目度: 低

- [ ] **[一般ニュース](URL)** `はてブ` / 社会 / メモ
```

## 注意事項

- **すべての記事にURLリンクを必ず含める**
- **はてブは元記事のURLを必ず取得**（はてブページURLではなく）
- **Hacker NewsはHNコメントページURL（`item?id=`形式）を使用**
- **英語タイトルは日本語に翻訳**
- ポイント数/ブックマーク数が高い記事は特に注目
