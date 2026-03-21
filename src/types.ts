export interface Article {
    title: string;
    url: string;
    source: string;
    score?: number;
    commentsUrl?: string;
}

export interface ScoredArticle extends Article {
    interest: string;   // ★★★, ★★, ★
    category: string;   // AI, セキュリティ, 技術, etc.
    memo: string;       // Short memo about why it's relevant
    summary: string;    // 1-sentence summary
}

export interface Interest {
    topic: string;
    weight: number; // 0.0 to 1.0
}

export interface Persona {
    interests: Interest[];
    languages: string[];
}
