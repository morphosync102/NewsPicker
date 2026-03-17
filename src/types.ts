export interface Article {
    title: string;
    url: string;
    source: 'Hatena' | 'HackerNews' | 'Reddit';
    score?: number;
    commentsUrl?: string;
}

export interface Persona {
    interests: string[];
    languages: string[];
}
