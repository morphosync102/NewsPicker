import axios from 'axios';
import { Article } from '../types';

export async function fetchHackerNews(): Promise<Article[]> {
    const articles: Article[] = [];
    try {
        const { data } = await axios.get('https://hn.algolia.com/api/v1/search?tags=front_page');
        for (const hit of data.hits || []) {
            if (hit.title) {
                articles.push({
                    title: hit.title,
                    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
                    source: 'HackerNews',
                    score: hit.points,
                    commentsUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`
                });
            }
        }
    } catch (e) {
        console.error(`Error fetching HackerNews:`, e);
    }
    return articles;
}
