export interface Article {
    title: string;
    url: string;
    source: 'Hatena' | 'HackerNews' | 'Reddit';
    score?: number;
    commentsUrl?: string;
}

export interface ScoredArticle extends Article {
    interest: string;   // ★★★, ★★, ★
    category: string;   // AI, セキュリティ, 技術, etc.
    memo: string;       // Short memo about why it's relevant
    summary: string;    // 1-sentence summary
}

export interface Persona {
    interests: string[];
    languages: string[];
}
