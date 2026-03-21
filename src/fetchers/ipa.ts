import axios from 'axios';
import * as cheerio from 'cheerio';
import { Article } from '../types';

export async function fetchIPA(): Promise<Article[]> {
    const articles: Article[] = [];
    try {
        const { data } = await axios.get('https://www.ipa.go.jp/security/');
        const $ = cheerio.load(data);

        // IPAセキュリティセンターからタイトルとURLを取得
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const title = $(el).text().trim();
            // URLが長めでタイトルがあるものを記事として取得
            if (href.includes('/') && href.endsWith('.html') && title.length > 10) {
                const articleUrl = href.startsWith('http') ? href : `https://www.ipa.go.jp${href.startsWith('/') ? '' : '/security/'}${href}`;
                articles.push({
                    title,
                    url: articleUrl,
                    source: 'IPA'
                });
            }
        });
    } catch (e) {
        console.error("Error fetching IPA:", e);
    }

    const seen = new Set<string>();
    return articles.filter(a => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
    }).slice(0, 10);
}
