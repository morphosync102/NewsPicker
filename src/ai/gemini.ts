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
    // We use gemini-1.5-flash as the fast and cost-effective default, 
    // but could use gemini-1.5-pro for more complex reasoning.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an AI assistant that curates news based on a specific persona.
Persona Interests:
${persona.interests.join('\n')}

Languages Read:
${persona.languages.join(', ')}

Here are several articles. Please score them from 1 to 10 based on how well they match the persona's interests. 
Also provide a 1-sentence summary for the top 10 articles.
Respond in pure JSON format without markdown blocks. Return an array of objects. Each object should have 'url', 'score', and 'summary' properties.

Articles:
${articles.map(a => `Title: ${a.title}\nURL: ${a.url}\nSource: ${a.source}\n`).join('---\n')}
`;

    try {
        const result = await model.generateContent(prompt);
        let content = result.response.text();
        // Strip markdown formatting if Gemini included it despite instructions
        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');

        let scoredData: { url: string, score: number, summary: string }[] = [];
        try {
            const raw = JSON.parse(content);
            scoredData = Array.isArray(raw) ? raw : (raw.articles || Object.values(raw)[0] || []);
        } catch (e) {
            console.error("Failed to parse JSON", e);
            console.log("Raw content was:", content);
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
    } catch (error) {
        console.error("Error calling Gemini API for scoring:", error);
        return [];
    }
}

export async function learnFromIssue(issueBody: string, currentPersona: Persona): Promise<Persona> {
    const genAI = getGemini();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an AI that updates a user's reading interests (persona) based on what articles they checked as read.
Current Persona Interests:
${currentPersona.interests.join('\n')}

Here is the markdown checklist of yesterday's recommended articles.
Items marked with [x] were read by the user. Items marked with [ ] were ignored.
Analyze the patterns of what they read vs ignored, and output an updated JSON list of interests. Keep it concise (around 5 to 10 broad interests topics).

Return pure JSON without markdown blocks. Format: { "interests": ["topic1", "topic2"] }

Markdown content:
${issueBody}`;

    try {
        const result = await model.generateContent(prompt);
        let content = result.response.text();
        // Strip markdown formatting if Gemini included it
        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');

        try {
            const raw = JSON.parse(content);
            if (raw.interests && Array.isArray(raw.interests)) {
                return {
                    ...currentPersona,
                    interests: raw.interests
                };
            }
        } catch (e) {
            console.error("Failed to parse JSON for persona updating", e);
            console.log("Raw content was:", content);
        }
    } catch (error) {
        console.error("Error calling Gemini API for learning:", error);
    }

    return currentPersona;
}
