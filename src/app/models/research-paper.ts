export interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  year: number | null;
  documentType: string;
  doi: string;
  downloadUrl: string;
  isOpenAccess: boolean;
}

export interface YearBucket {
  year: number;
  count: number;
}

export interface CoreSearchResponse {
  totalHits: number;
  limit: number;
  offset: number;
  results: ResearchPaper[];
  yearDistribution: YearBucket[];
  chartSource: 'all-matches' | 'loaded-papers';
}
