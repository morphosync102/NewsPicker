import { GoogleGenerativeAI } from '@google/generative-ai';
import { Article, ScoredArticle, Persona } from '../types';
import * as dotenv from 'dotenv';
dotenv.config();

function getGemini() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
    return new GoogleGenerativeAI(key);
}

export async function scoreArticles(articles: Article[], persona: Persona): Promise<ScoredArticle[]> {
    const genAI = getGemini();
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `あなたは優秀なITエンジニア向けニュースキュレーターです。
以下のユーザーの興味領域（ペルソナ）と重み（Weight: 0.0〜1.0）に基づいて、提供された記事リストから読むべき記事をスコアリング抽出してください。Weightが高い（0.7以上）トピックに特に関連するものを高く評価してください。

【現在の興味領域と重み】
${persona.interests.map(i => `- ${i.topic} (Weight: ${i.weight})`).join('\n')}

【対応言語】
${persona.languages.join(', ')}

以下の記事リストを分析し、ユーザーの興味に合うものを最大30件（少なくとも15件程度）選んで抽出してください。
各記事について以下の情報を付与してください：

- interest: 興味度を★で表現
  - ★★★: 興味領域に直接関連（AI×セキュリティ、OSS、個人開発、キャリアなど）
  - ★★: 間接的に関連（技術トレンド全般、エンジニアリング文化）
  - ★: 一般的なIT/技術ニュース
- category: カテゴリ（AI / セキュリティ / JavaScript / 技術 / OSS / キャリア / デザイン / 社会 など）
- memo: 発信に活用できるポイントや、なぜ注目に値するかを短く日本語で（15文字程度）
- summary: 1文の要約（日本語）

英語タイトルは日本語に翻訳してください。

指定したJSONスキーマに厳格に従って出力してください。
フォーマット: { "articles": [{ "url": "...", "title_ja": "...", "score": 9, "interest": "★★★", "category": "AI", "memo": "...", "summary": "..." }] }

【記事リスト】
${articles.map(a => `Title: ${a.title}\nURL: ${a.url}\nSource: ${a.source}\nScore: ${a.score || 'N/A'}\n`).join('---\n')}
`;

    console.log("[AI] Calling Gemini API for scoring...");
    const result = await model.generateContent(prompt);
    let content = result.response.text();
    console.log(`[AI] Raw response length: ${content.length} chars`);

    let scoredData: { url: string, title_ja?: string, score: number, interest: string, category: string, memo: string, summary: string }[] = [];
    try {
        const raw = JSON.parse(content);
        scoredData = Array.isArray(raw) ? raw : (raw.articles || Object.values(raw)[0] || []);
        console.log(`[AI] Parsed ${scoredData.length} scored articles`);
    } catch (e) {
        console.error("[AI] Failed to parse JSON response:", e);
        console.error("[AI] Raw content was:", content.substring(0, 500));
        throw new Error("Failed to parse Gemini AI response as JSON");
    }

    const scoredMap = new Map(scoredData.map(d => [d.url, d]));

    const results: ScoredArticle[] = articles
        .map(a => {
            const scoring = scoredMap.get(a.url);
            if (!scoring) return null;
            return {
                ...a,
                title: scoring.title_ja || a.title,
                score: scoring.score || 0,
                interest: scoring.interest || '★',
                category: scoring.category || '技術',
                memo: scoring.memo || '',
                summary: scoring.summary || ''
            } as ScoredArticle;
        })
        .filter((a): a is ScoredArticle => a !== null);

    return results
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 30);
}

export async function learnFromIssue(issueBody: string, currentPersona: Persona): Promise<Persona> {
    const genAI = getGemini();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `あなたはユーザーの読書傾向を分析し、興味関心プロファイルを長期的に微調整するAIです。

【現在の興味領域と重み】
${currentPersona.interests.map(i => `- ${i.topic}: ${i.weight}`).join('\n')}

以下は昨日のおすすめ記事のチェックリストです。
[x] がついた記事はユーザーが読んだもの、[ ] は無視したものです。
読んだもの・無視したものの傾向を分析し、既存トピックの重み（0.0〜1.0）を調整して更新されたリストをJSON形式で出力してください。

【調整ルール】
1. 読んだ記事に関連するトピックは、重みを +0.01 加算する
2. 読まなかった記事に関連するトピックは、重みを -0.01 減算する
3. 計算後の重みが 0.1 を下回ったトピックはリストから削除する
4. 新しい傾向が明確に見られる場合、新規トピックとして 重み 0.5 で追加してよい

指定したJSONスキーマに厳格に従って出力してください。
フォーマット: { "interests": [ { "topic": "topic_name", "weight": 0.81 } ] }

【チェックリスト】
${issueBody}`;

    console.log("[AI] Calling Gemini API for persona learning...");
    const result = await model.generateContent(prompt);
    let content = result.response.text();
    console.log(`[AI] Raw response length: ${content.length} chars`);

    try {
        const raw = JSON.parse(content);
        if (raw.interests && Array.isArray(raw.interests)) {
            return {
                ...currentPersona,
                interests: raw.interests
            };
        }
        throw new Error("Response missing 'interests' array");
    } catch (e) {
        console.error("[AI] Failed to parse JSON for persona updating:", e);
        console.error("[AI] Raw content was:", content.substring(0, 500));
        throw new Error("Failed to parse Gemini AI response for persona update");
    }
}
