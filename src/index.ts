import * as fs from 'fs';
import * as path from 'path';
import { fetchHatena } from './fetchers/hatena';
import { fetchHackerNews } from './fetchers/hackernews';
import { scoreArticles, learnFromIssue } from './ai/gemini';
import { createIssue, fetchRecentIssues } from './github/issue';
import { Persona, Article, ScoredArticle } from './types';

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

function buildIssueBody(hatenaArticles: ScoredArticle[], hnArticles: ScoredArticle[], persona: Persona): string {
    let md = '';

    // --- はてブIT セクション ---
    if (hatenaArticles.length > 0) {
        md += `## はてブIT（日本市場）\n\n`;
        md += `### 注目トピック\n\n`;
        md += `| タイトル | ブクマ数 | 興味度 | カテゴリ | メモ |\n`;
        md += `|---------|---------|--------|---------|------|\n`;
        for (const a of hatenaArticles) {
            const scoreStr = a.score ? `${a.score}` : '-';
            md += `| [${a.title}](${a.url}) | ${scoreStr} | ${a.interest} | ${a.category} | ${a.memo} |\n`;
        }
        md += `\n`;
    }

    // --- Hacker News セクション ---
    if (hnArticles.length > 0) {
        md += `## Hacker News（グローバル）\n\n`;
        md += `### 注目トピック\n\n`;
        md += `| タイトル | ポイント | 興味度 | カテゴリ | メモ |\n`;
        md += `|---------|---------|--------|---------|------|\n`;
        for (const a of hnArticles) {
            const scoreStr = a.score ? `${a.score}pt` : '-';
            md += `| [${a.title}](${a.commentsUrl || a.url}) | ${scoreStr} | ${a.interest} | ${a.category} | ${a.memo} |\n`;
        }
        md += `\n`;
    }

    // --- 既読チェック セクション ---
    const allArticles = [...hatenaArticles, ...hnArticles];
    md += `---\n\n`;
    md += `## 📖 既読チェック\n\n`;
    md += `読んだ記事にチェックを入れてください。ペルソナの学習に使われます。\n\n`;
    for (const a of allArticles) {
        md += `- [ ] ${a.title}\n`;
    }

    md += `\n---\n`;
    md += `\n*現在のペルソナ: ${persona.interests.join(', ')}*\n`;

    return md;
}

async function handleCreateIssue() {
    console.log("=== Starting NewsPicker Issue Creation ===");

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

    console.log("[1/4] Fetching articles from all sources...");

    let hatena: Article[] = [];
    let hn: Article[] = [];

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

    const allArticles = [...hatena, ...hn];
    console.log(`[2/4] Total articles fetched: ${allArticles.length}`);

    if (allArticles.length === 0) {
        throw new Error("No articles were fetched from any source.");
    }

    const persona = getPersona();

    // Shuffle and take a sample to avoid token limits
    const shuffled = allArticles.sort(() => 0.5 - Math.random());
    const toScore = shuffled.slice(0, 50);

    console.log(`[3/4] Scoring ${toScore.length} articles using Gemini AI...`);
    const scored = await scoreArticles(toScore, persona);
    console.log(`  - Scored results: ${scored.length} articles returned`);

    if (scored.length === 0) {
        throw new Error("AI scoring returned 0 articles.");
    }

    // Split by source
    const hatenaScored = scored.filter(a => a.source === 'Hatena');
    const hnScored = scored.filter(a => a.source === 'HackerNews');

    const dateStr = new Date().toISOString().split('T')[0];
    const markdown = buildIssueBody(hatenaScored, hnScored, persona);

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

main().catch(err => {
    console.error("❌ FATAL ERROR:", err);
    process.exit(1);
});
