import * as fs from 'fs';
import * as path from 'path';
import { fetchHatena } from './fetchers/hatena';
import { fetchHackerNews } from './fetchers/hackernews';
import { fetchReddit } from './fetchers/reddit';
import { scoreArticles, learnFromIssue } from './ai/gemini';
import { createIssue, fetchRecentIssues } from './github/issue';
import { Persona, Article } from './types';

const PERSONA_PATH = path.join(process.cwd(), 'data/persona.json');

function getPersona(): Persona {
    console.log(`[DEBUG] Reading persona from: ${PERSONA_PATH}`);
    if (!fs.existsSync(PERSONA_PATH)) {
        throw new Error(`persona.json not found at ${PERSONA_PATH}`);
    }
    const content = fs.readFileSync(PERSONA_PATH, 'utf-8');
    const persona = JSON.parse(content);
    console.log(`[DEBUG] Persona loaded: ${JSON.stringify(persona)}`);
    return persona;
}

function savePersona(persona: Persona) {
    fs.writeFileSync(PERSONA_PATH, JSON.stringify(persona, null, 2), 'utf-8');
}

async function handleCreateIssue() {
    console.log("=== Starting NewsPicker Issue Creation ===");

    // Check required env vars upfront
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set! Please add it to repository secrets.");
    }
    if (!process.env.GITHUB_TOKEN) {
        throw new Error("GITHUB_TOKEN is not set!");
    }
    if (!process.env.GITHUB_REPOSITORY) {
        throw new Error("GITHUB_REPOSITORY is not set!");
    }
    console.log(`[DEBUG] GITHUB_REPOSITORY = ${process.env.GITHUB_REPOSITORY}`);
    console.log(`[DEBUG] GEMINI_API_KEY is set (length: ${process.env.GEMINI_API_KEY.length})`);

    console.log("[1/4] Fetching articles from all sources...");

    let hatena: Article[] = [];
    let hn: Article[] = [];
    let reddit: Article[] = [];

    try {
        hatena = await fetchHatena();
        console.log(`  - Hatena: ${hatena.length} articles`);
    } catch (e) {
        console.error("  - Hatena fetch FAILED:", e);
    }

    try {
        hn = await fetchHackerNews();
        console.log(`  - HackerNews: ${hn.length} articles`);
    } catch (e) {
        console.error("  - HackerNews fetch FAILED:", e);
    }

    try {
        reddit = await fetchReddit();
        console.log(`  - Reddit: ${reddit.length} articles`);
    } catch (e) {
        console.error("  - Reddit fetch FAILED:", e);
    }

    const allArticles = [...hatena, ...hn, ...reddit];
    console.log(`[2/4] Total articles fetched: ${allArticles.length}`);

    if (allArticles.length === 0) {
        throw new Error("No articles were fetched from any source. All fetchers failed or returned empty.");
    }

    const persona = getPersona();

    // Take a random sample to score (max 50 to avoid token limits)
    const shuffled = allArticles.sort(() => 0.5 - Math.random());
    const toScore = shuffled.slice(0, 50);

    console.log(`[3/4] Scoring ${toScore.length} articles using Gemini AI...`);
    const scored = await scoreArticles(toScore, persona);
    console.log(`  - Scored results: ${scored.length} articles returned`);

    if (scored.length === 0) {
        throw new Error("AI scoring returned 0 articles. Check GEMINI_API_KEY and API response.");
    }

    const top10 = scored.slice(0, 10);

    const dateStr = new Date().toISOString().split('T')[0];
    let markdown = `Here are today's recommended news articles based on your current interests.\n\nPlease check off \`[x]\` the ones you read so that the system can learn your evolving persona.\n\n`;

    for (const article of top10 as (Article & { summary?: string })[]) {
        markdown += `- [ ] [${article.title}](${article.url}) (Source: ${article.source})\n`;
        if (article.summary) {
            markdown += `  - *${article.summary}*\n`;
        }
        if (article.commentsUrl && article.commentsUrl !== article.url) {
            markdown += `  - [Comments](${article.commentsUrl})\n`;
        }
    }

    markdown += `\n\n*(Current Persona: ${persona.interests.join(', ')})*`;

    console.log("[4/4] Creating GitHub Issue...");
    const issue = await createIssue(`📰 Daily NewsPicker: ${dateStr}`, markdown);
    console.log(`✅ Issue created successfully: ${issue.html_url}`);
}

async function handleLearn() {
    console.log("=== Starting Persona Learning ===");

    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set!");
    }
    if (!process.env.GITHUB_TOKEN) {
        throw new Error("GITHUB_TOKEN is not set!");
    }
    if (!process.env.GITHUB_REPOSITORY) {
        throw new Error("GITHUB_REPOSITORY is not set!");
    }

    console.log("[1/3] Fetching recent issues...");
    const issues = await fetchRecentIssues();
    console.log(`  - Found ${issues.length} recent issues`);

    const newsIssues = issues.filter((i: any) => i.title.startsWith('📰 Daily NewsPicker') && i.body);
    console.log(`  - NewsPicker issues with body: ${newsIssues.length}`);

    if (newsIssues.length === 0) {
        console.log("No recent NewsPicker issues found. Nothing to learn.");
        return;
    }

    const latestIssue = newsIssues[0];
    console.log(`[2/3] Analyzing Issue #${latestIssue.number}: ${latestIssue.title}`);

    if (!latestIssue.body || !latestIssue.body.includes('[x]')) {
        console.log("User didn't read any articles (no [x] found). Nothing to learn.");
        return;
    }

    const currentPersona = getPersona();
    console.log("[3/3] Updating persona with Gemini...");
    const newPersona = await learnFromIssue(latestIssue.body as string, currentPersona);

    savePersona(newPersona);
    console.log("✅ Persona successfully updated.");
    console.log(JSON.stringify(newPersona, null, 2));
}

async function main() {
    const command = process.argv[2];
    console.log(`[DEBUG] Command: ${command}`);
    console.log(`[DEBUG] process.argv: ${JSON.stringify(process.argv)}`);
    console.log(`[DEBUG] CWD: ${process.cwd()}`);

    if (command === 'create-issue') {
        await handleCreateIssue();
    } else if (command === 'learn') {
        await handleLearn();
    } else {
        console.error(`Unknown command: "${command}". Usage: node dist/index.js [create-issue|learn]`);
        process.exit(1);
    }
}

// IMPORTANT: Crash loudly on errors so GitHub Actions marks the run as failed
main().catch(err => {
    console.error("❌ FATAL ERROR:", err);
    process.exit(1);
});
