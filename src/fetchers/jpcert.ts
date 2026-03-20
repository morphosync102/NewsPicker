import axios from 'axios';
import * as cheerio from 'cheerio';
import { Article } from '../types';

export async function fetchJPCert(): Promise<Article[]> {
    const articles: Article[] = [];
    try {
        const { data } = await axios.get('https://www.jpcert.or.jp/at/');
        const $ = cheerio.load(data);

        // JPCERT/CCの注意喚起ページからタイトルとURLを取得
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const title = $(el).text().trim();
            // .htmlで終わる注意喚起のリンクを取得
            if (href.endsWith('.html') && title.length > 5 && !title.includes('JPCERT/CC')) {
                const articleUrl = href.startsWith('http') ? href : `https://www.jpcert.or.jp/at/${href.replace(/^\.\//, '')}`;
                articles.push({
                    title,
                    url: articleUrl,
                    source: 'Hatena' // Placeholder source handling
                });
            }
        });
    } catch (e) {
        console.error("Error fetching JPCERT/CC:", e);
    }

    const seen = new Set<string>();
    return articles.filter(a => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
    }).slice(0, 10);
}
