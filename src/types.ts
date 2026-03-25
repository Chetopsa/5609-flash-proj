export type TMovie = {
    num_votes: number;
    runtime_minutes:  number;
    genres: string[];
    year: number;
    average_rating: number;
    tconst: string;
    title_type: string;
    primary_title: string;
    original_title: string;
}

export type TMovie_A2 = {
    num_votes: number;
    runtime_minutes:  number;
    genres: string[];
    year: Date;
    average_rating: number;
    tconst: string;
    title_type: string;
    primary_title: string;
    original_title: string;
}