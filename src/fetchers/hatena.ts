import axios from 'axios';
import * as cheerio from 'cheerio';
import { Article } from '../types';

const HATENA_URLS = [
    'https://b.hatena.ne.jp/hotentry/it',
    'https://b.hatena.ne.jp/hotentry/it/%E3%82%BB%E3%82%AD%E3%83%A5%E3%83%AA%E3%83%86%E3%82%A3%E6%8A%80%E8%A1%93',
    'https://b.hatena.ne.jp/hotentry/it/AI%E3%83%BB%E6%A9%9F%E6%A2%B0%E5%AD%A6%E7%BF%92'
];

export async function fetchHatena(): Promise<Article[]> {
    const articles: Article[] = [];
    const seenUrls = new Set<string>();

    for (const url of HATENA_URLS) {
        try {
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);

            $('.entrylist-contents-title > a').each((i, el) => {
                const title = $(el).attr('title') || $(el).text();
                const articleUrl = $(el).attr('href');

                if (title && articleUrl && !seenUrls.has(articleUrl)) {
                    seenUrls.add(articleUrl);
                    articles.push({
                        title: title.trim(),
                        url: articleUrl,
                        source: 'Hatena'
                    });
                }
            });
        } catch (e) {
            console.error(`Error fetching Hatena ${url}:`, e);
        }
    }

    return articles;
}
