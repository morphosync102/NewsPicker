# NewsPicker 📰

NewsPicker is a serverless, daily news curation system that runs entirely on GitHub Actions. It fetches tech news from various sources, scores them against your personal interests (persona) using the Gemini AI API, and creates a daily GitHub Issue with a reading checklist. 

Best of all, **it learns what you like**. When you check off articles you've read in the GitHub Issue, another workflow analyzes your reading habits and dynamically updates your interests profile!

## Features

- **Automated Fetching:** Scrapes trending articles from:
  - Hatena Bookmark (IT / Programming / AI)
  - Hacker News
  - Reddit (r/programming, r/technology, r/cybersecurity, r/opensource, r/webdev, etc.)
- **AI-Powered Curation:** Uses Google's **Gemini 1.5 Flash** to score articles based on your current persona and provide 1-sentence summaries.
- **GitHub Issue Delivery:** Creates a clean Markdown checklist in a new GitHub Issue every morning at 06:00 JST.
- **Persona Learning:** Checks your reading history (from checked `[x]` boxes in yesterday's issue) every morning at 05:00 JST and updates your `data/persona.json` to improve future recommendations.

## Setup Instructions

### 1. Repository Settings

Since the system runs via GitHub Actions, no local server or deployment is required. However, you need to configure a few repository settings:

1. Go to your repository's **Settings > Actions > General**.
2. Scroll down to **Workflow permissions** and select **Read and write permissions**.
3. Check the box that says **Allow GitHub Actions to create and approve pull requests** (this ensures the bot can commit updates to your `persona.json` file).
4. Click **Save**.

### 2. Environment Variables (Secrets)

To allow the AI to score articles and the system to create issues, you must add the Gemini API key to your GitHub repository secrets.

1. Go to your repository's **Settings > Secrets and variables > Actions**.
2. Click **New repository secret**.
3. Add the following secret:
   - Name: `GEMINI_API_KEY`
   - Secret: *(Your actual Gemini API key starting with AIza...)*

*(Note: The `GITHUB_TOKEN` is automatically provided by GitHub Actions, so you do not need to configure it manually).*

## How it Works

The project uses two primary GitHub Action workflows:

### 1. Daily News Delivery (`.github/workflows/daily-news.yml`)
- **Trigger:** Runs automatically every day at 21:00 UTC (06:00 JST).
- **Execution:** Runs `npm start create-issue`.
- **Action:** Fetches news, scores them using Gemini, and creates an Issue titled `📰 Daily NewsPicker: YYYY-MM-DD`.

### 2. Persona Learner (`.github/workflows/learn-persona.yml`)
- **Trigger:** Runs automatically every day at 20:00 UTC (05:00 JST), right before the new issue is created.
- **Execution:** Runs `npm start learn`.
- **Action:** Reads the previous day's Issue. Articles marked with `[x]` are logged as "read" and `[ ]` as "ignored". Gemini then analyzes this to output an updated list of interests, which is committed automatically to `data/persona.json`.

## Manual Execution (Local Environment)

If you want to test the scripts locally:

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory and add your API keys:
   ```env
   GITHUB_TOKEN=your_github_personal_access_token_with_repo_access
   GITHUB_REPOSITORY=your_username/NewsPicker
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. Run the scripts:
   - To create a test issue: `npm start create-issue`
   - To run the learning algorithm on recent issues: `npm start learn`

## Changing Your Persona Manually

If you want to reset or manually adjust what the AI recommends, you can easily edit the `data/persona.json` file in your repository. The AI will use this file as the baseline for the next run.
