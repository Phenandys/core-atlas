import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CoreSearchResponse, ResearchPaper } from '../models/research-paper';

interface CoreWorkRecord {
  id?: number | string;
  title?: string | null;
  authors?: Array<string | { name?: string }> | null;
  abstract?: string | null;
  yearPublished?: number | string | null;
  publishedDate?: string | null;
  documentType?: string | null;
  doi?: string | null;
  downloadUrl?: string | null;
  fullTextLink?: string | null;
  openAccess?: boolean | null;
}

interface CoreProxyPayload {
  totalHits: number;
  limit: number;
  offset: number;
  results: CoreWorkRecord[];
  yearDistribution: Array<{ year: number; count: number }>;
  chartSource: 'all-matches' | 'loaded-papers';
}

@Injectable({ providedIn: 'root' })
export class CoreApiService {
  private readonly http = inject(HttpClient);

  search(query: string, limit: number, offset: number): Observable<CoreSearchResponse> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', String(limit))
      .set('offset', String(offset));

    return this.http.get<CoreProxyPayload>('/api/core/search', { params }).pipe(
      map((payload) => ({
        totalHits: Number(payload.totalHits || 0),
        limit: Number(payload.limit || limit),
        offset: Number(payload.offset || offset),
        results: (payload.results || []).map((record) => this.normalize(record)),
        yearDistribution: (payload.yearDistribution || []).filter((item) => item.year && item.count > 0),
        chartSource: payload.chartSource || 'loaded-papers',
      })),
    );
  }

  private normalize(record: CoreWorkRecord): ResearchPaper {
    const parsedYear = Number(record.yearPublished || String(record.publishedDate || '').slice(0, 4));
    const authors = (record.authors || [])
      .map((author) => typeof author === 'string' ? author : author.name || '')
      .filter(Boolean);

    return {
      id: String(record.id ?? record.doi ?? crypto.randomUUID()),
      title: record.title?.trim() || 'Untitled research work',
      authors,
      abstract: this.decodeHtml(record.abstract || ''),
      year: Number.isInteger(parsedYear) && parsedYear > 0 ? parsedYear : null,
      documentType: record.documentType?.trim() || 'Research paper',
      doi: record.doi?.trim() || '',
      downloadUrl: this.safeHttpUrl(record.downloadUrl || record.fullTextLink || ''),
      isOpenAccess: Boolean(record.openAccess),
    };
  }

  private safeHttpUrl(value: string): string {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
    } catch {
      return '';
    }
  }

  private decodeHtml(value: string): string {
    if (typeof document === 'undefined') return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const parsedDocument = new DOMParser().parseFromString(value, 'text/html');
    return (parsedDocument.body.textContent || '').replace(/\s+/g, ' ').trim();
  }
}
