import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';
dotenv.config();

function getOctokit() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is missing");
    return new Octokit({ auth: token });
}

export async function createIssue(title: string, body: string) {
    const octokit = getOctokit();
    const repo = process.env.GITHUB_REPOSITORY; // e.g., morphosync102/NewsPicker
    if (!repo) throw new Error("GITHUB_REPOSITORY is missing");

    const [owner, name] = repo.split('/');

    const response = await octokit.rest.issues.create({
        owner,
        repo: name,
        title,
        body
    });

    return response.data;
}

export async function fetchRecentIssues() {
    const octokit = getOctokit();
    const repo = process.env.GITHUB_REPOSITORY;
    if (!repo) throw new Error("GITHUB_REPOSITORY is missing");

    const [owner, name] = repo.split('/');

    const response = await octokit.rest.issues.listForRepo({
        owner,
        repo: name,
        state: 'all',
        per_page: 5,
        creator: owner // assuming created by the owner or bot
    });

    return response.data;
}
