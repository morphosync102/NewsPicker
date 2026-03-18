---
name: url-digest
description: "URL要約（NewsPicker連携）"
---

# URL要約

複数のURLを読み取り、コアメッセージがわかるように要約する。
NewsPicker の GitHub Issue に掲載された記事を深掘りする際に使用する。

## 入力形式

ユーザーからURLが1つ以上渡される。URLは改行区切りまたはスペース区切りで提供される。

## URL種別判定

渡されたURLを以下のカテゴリに分類して取得方法を変える：

**通常記事**: 直接 WebFetch で取得

**Hacker News** (`news.ycombinator.com/item?id=XXX`):
- Algolia API: `https://hn.algolia.com/api/v1/items/{item_id}`
- 元記事とコメントの両方を分析

**X (Twitter)** (`x.com/*` または `twitter.com/*`):
- JavaScriptが必要なためブラウザ自動化ツールを使用

## 要約生成

各URLについて以下を生成：

**タイトル**: 元タイトル（英語の場合は日本語に翻訳）

**要約**:
- コアメッセージを3-5行で要約
- 何が重要なのか、なぜ注目に値するのかを明確に
- HNの場合はコミュニティの反応（賛否、議論のポイント）も含める

**URL**: 入力されたURLをそのまま

## 出力フォーマット

**まず「要約完了。」というメッセージを返してから、結果をファイルに保存。**

`ideas/daily/YYYYMMDD-digest.md` に保存（YYYYMMDDは実行日）。

```markdown
# URL Digest: YYYY-MM-DD

---

## [記事タイトル]

要約本文。コアメッセージを3-5行で記述。
HNの場合はコミュニティの反応やインサイトも含める。

URL

---
```

## 注意事項

- **すべての記事にURLを必ず含める**
- **英語タイトルは日本語に翻訳**
- **HNは元記事とコメントの両方を確認**
- **X.comはブラウザ自動化ツールを使用**（WebFetchではJSレンダリング不可）
- 要約は簡潔に、核心を突く内容で
