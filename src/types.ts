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

export type TRun = {
    tier: string;
    year_month: Date;
    median_pace: number;
    p25: number;
    p75: number;
    run_count: number;
    avg_runs_per_athlete: number;
}

export type TTrajectory = {
  athlete:    string;
  run_number: number;
  pace:       number;
  pace_raw:   number;
  group:      "low" | "mid" | "high";
};

export type TIndividual = {
  athlete:        string;
  group:          "low" | "mid" | "high";
  percentile_raw: number;
  total_runs:     number;
  avg_pace:       number;
};