import { GoogleGenerativeAI } from '@google/generative-ai';
import { Article, Persona } from '../types';
import * as dotenv from 'dotenv';
dotenv.config();

function getGemini() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
    return new GoogleGenerativeAI(key);
}

export async function scoreArticles(articles: Article[], persona: Persona): Promise<(Article & { summary: string })[]> {
    const genAI = getGemini();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `You are an AI assistant that curates news based on a specific persona.
Persona Interests:
${persona.interests.join('\n')}

Languages Read:
${persona.languages.join(', ')}

Here are several articles. Please score them from 1 to 10 based on how well they match the persona's interests. 
Also provide a 1-sentence summary for the top 10 articles.
Respond in pure JSON format without markdown blocks. Return an object with an "articles" key containing an array of objects. Each object should have 'url', 'score', and 'summary' properties.

Articles:
${articles.map(a => `Title: ${a.title}\nURL: ${a.url}\nSource: ${a.source}\n`).join('---\n')}
`;

    console.log("[AI] Calling Gemini API for scoring...");
    const result = await model.generateContent(prompt);
    let content = result.response.text();
    console.log(`[AI] Raw response length: ${content.length} chars`);

    // Strip markdown formatting if Gemini included it despite instructions
    content = content.replace(/^```json\s*\n?/, '').replace(/\n?\s*```$/, '');

    let scoredData: { url: string, score: number, summary: string }[] = [];
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

    return articles
        .map(a => {
            const scoring = scoredMap.get(a.url);
            return {
                ...a,
                score: scoring?.score || 0,
                summary: scoring?.summary || ''
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
}

export async function learnFromIssue(issueBody: string, currentPersona: Persona): Promise<Persona> {
    const genAI = getGemini();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `You are an AI that updates a user's reading interests (persona) based on what articles they checked as read.
Current Persona Interests:
${currentPersona.interests.join('\n')}

Here is the markdown checklist of yesterday's recommended articles.
Items marked with [x] were read by the user. Items marked with [ ] were ignored.
Analyze the patterns of what they read vs ignored, and output an updated JSON list of interests. Keep it concise (around 5 to 10 broad interests topics).

Return pure JSON without markdown blocks. Format: { "interests": ["topic1", "topic2"] }

Markdown content:
${issueBody}`;

    console.log("[AI] Calling Gemini API for persona learning...");
    const result = await model.generateContent(prompt);
    let content = result.response.text();
    console.log(`[AI] Raw response length: ${content.length} chars`);

    // Strip markdown formatting if Gemini included it
    content = content.replace(/^```json\s*\n?/, '').replace(/\n?\s*```$/, '');

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
