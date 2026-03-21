import axios from 'axios';
import * as cheerio from 'cheerio';
import { Article } from '../types';

export async function fetchSecurityNext(): Promise<Article[]> {
    const articles: Article[] = [];
    try {
        const { data } = await axios.get('https://www.security-next.com/');
        const $ = cheerio.load(data);

        // security-next.com のニュース一覧からタイトルとURLを取得
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const title = $(el).text().trim();
            // 記事URLのパターンに合致するものだけ取得（数字のパス）
            if (href.match(/security-next\.com\/\d+/) && title.length > 10) {
                const articleUrl = href.startsWith('http') ? href : `https://www.security-next.com${href}`;
                articles.push({
                    title,
                    url: articleUrl,
                    source: 'SecurityNext'
                });
            }
        });
    } catch (e) {
        console.error("Error fetching SecurityNext:", e);
    }
    // 重複を除去して最大10件
    const seen = new Set<string>();
    return articles.filter(a => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
    }).slice(0, 10);
}
