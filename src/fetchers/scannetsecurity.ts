import axios from 'axios';
import * as cheerio from 'cheerio';
import { Article } from '../types';

export async function fetchScanNetSecurity(): Promise<Article[]> {
    const articles: Article[] = [];
    try {
        const { data } = await axios.get('https://scan.netsecurity.ne.jp/');
        const $ = cheerio.load(data);

        // ScanNetSecurityのトップページからタイトルとURLを取得
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const title = $(el).text().trim();
            // /article/ を含む記事リンクを取得
            if (href.includes('/article/') && title.length > 10) {
                const articleUrl = href.startsWith('http') ? href : `https://scan.netsecurity.ne.jp${href}`;
                articles.push({
                    title,
                    url: articleUrl,
                    source: 'Hatena'
                });
            }
        });
    } catch (e) {
        console.error("Error fetching ScanNetSecurity:", e);
    }

    const seen = new Set<string>();
    return articles.filter(a => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
    }).slice(0, 10);
}
