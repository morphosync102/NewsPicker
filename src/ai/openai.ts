import OpenAI from 'openai';
import { Article, Persona } from '../types';
import * as dotenv from 'dotenv';
dotenv.config();

function getOpenAI() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is missing");
    return new OpenAI({ apiKey: key });
}

export async function scoreArticles(articles: Article[], persona: Persona): Promise<(Article & { summary: string })[]> {
    const openai = getOpenAI();

    const prompt = `You are an AI assistant that curates news based on a specific persona.
Persona Interests:
${persona.interests.join('\n')}

Languages Read:
${persona.languages.join(', ')}

Here are several articles. Please score them from 1 to 10 based on how well they match the persona's interests. 
Also provide a 1-sentence summary for the top 10 articles.
Respond in JSON format with an array of objects. Each object should have 'url', 'score', and 'summary' properties.

Articles:
${articles.map(a => `Title: ${a.title}\nURL: ${a.url}\nSource: ${a.source}\n`).join('---\n')}
`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: "You are a news curation API. You output raw JSON arrays containing 'url', 'score' and 'summary'." },
            { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || "{}";
    let scoredData: { url: string, score: number, summary: string }[] = [];
    try {
        const raw = JSON.parse(content);
        // Extract array depending on how model generated it
        scoredData = Array.isArray(raw) ? raw : (raw.articles || Object.values(raw)[0] || []);
    } catch (e) {
        console.error("Failed to parse JSON", e);
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
    const openai = getOpenAI();

    const prompt = `You are an AI that updates a user's reading interests (persona) based on what articles they checked as read.
Current Persona Interests:
${currentPersona.interests.join('\n')}

Here is the markdown checklist of yesterday's recommended articles.
Items marked with [x] were read by the user. Items marked with [ ] were ignored.
Analyze the patterns of what they read vs ignored, and output an updated JSON list of interests. Keep it concise (around 5 to 10 broad interests topics).

Markdown content:
${issueBody}`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: "You are a user profiling API. Output a JSON object with a single 'interests' array of strings." },
            { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || "{}";
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
    }

    return currentPersona;
}
