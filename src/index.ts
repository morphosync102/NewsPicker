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
    const content = fs.readFileSync(PERSONA_PATH, 'utf-8');
    return JSON.parse(content);
}

function savePersona(persona: Persona) {
    fs.writeFileSync(PERSONA_PATH, JSON.stringify(persona, null, 2), 'utf-8');
}

async function handleCreateIssue() {
    console.log("Fetching articles...");
    const [hatena, hn, reddit] = await Promise.all([
        fetchHatena(),
        fetchHackerNews(),
        fetchReddit()
    ]);

    const allArticles = [...hatena, ...hn, ...reddit];
    console.log(`Fetched ${allArticles.length} articles total.`);

    if (allArticles.length === 0) {
        console.log("No articles found, exiting.");
        return;
    }

    const persona = getPersona();

    // We should chunk articles if there are too many to avoid hitting token limits
    // For simplicity, take a random sample of 50 to score
    const shuffled = allArticles.sort(() => 0.5 - Math.random());
    let selected = shuffled.slice(0, 50);

    console.log(`Scoring ${selected.length} articles using AI...`);
    selected = await scoreArticles(selected, persona);

    const top10 = selected.slice(0, 10);

    if (top10.length === 0) {
        console.log("No valid articles returned from scoring, exiting.");
        return;
    }

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

    console.log("Creating GitHub Issue...");
    const issue = await createIssue(`📰 Daily NewsPicker: ${dateStr}`, markdown);
    console.log(`Issue created: ${issue.html_url}`);
}

async function handleLearn() {
    console.log("Fetching recent issues...");
    const issues = await fetchRecentIssues();

    // Filter out issues that don't match our title format or have no body
    const newsIssues = issues.filter((i: any) => i.title.startsWith('📰 Daily NewsPicker') && i.body);

    if (newsIssues.length === 0) {
        console.log("No recent NewsPicker issues found. Nothing to learn.");
        return;
    }

    // To avoid learning from today's issue that was *just* created, 
    // we pick the latest one but ideally we check timestamps or state
    // Let's just pick the most recent one.
    const latestIssue = newsIssues[0];

    if (!latestIssue.body || !latestIssue.body.includes('[x]')) {
        console.log("User didn't read any articles (no [x] found). Nothing to learn.");
        return;
    }

    console.log(`Learning from Issue #${latestIssue.number}: ${latestIssue.title}`);
    const currentPersona = getPersona();
    const newPersona = await learnFromIssue(latestIssue.body as string, currentPersona);

    savePersona(newPersona);
    console.log("Persona successfully updated.");
    console.log(JSON.stringify(newPersona, null, 2));
}

async function main() {
    const command = process.argv[2];
    if (command === 'create-issue') {
        await handleCreateIssue();
    } else if (command === 'learn') {
        await handleLearn();
    } else {
        console.error("Unknown command. Usage: npm start [create-issue|learn]");
        process.exit(1);
    }
}

main().catch(console.error);
