import axios from 'axios';
import { Article } from '../types';

const SUBREDDITS = [
    'programming',
    'technology',
    'cybersecurity',
    'opensource',
    'ArtificialInteligence',
    'webdev'
];

export async function fetchReddit(): Promise<Article[]> {
    const articles: Article[] = [];

    for (const subreddit of SUBREDDITS) {
        try {
            const { data } = await axios.get(`https://www.reddit.com/r/${subreddit}/hot.json?limit=5`, {
                headers: { 'User-Agent': 'NewsPicker/1.0' }
            });

            const children = data?.data?.children || [];
            for (const child of children) {
                const post = child.data;
                if (post && post.title && !post.stickied) {
                    articles.push({
                        title: post.title,
                        url: post.url || `https://www.reddit.com${post.permalink}`,
                        source: 'Reddit',
                        score: post.ups,
                        commentsUrl: `https://www.reddit.com${post.permalink}`
                    });
                }
            }
        } catch (e) {
            console.error(`Error fetching Reddit /r/${subreddit}:`, e);
        }
    }

    return articles;
}
