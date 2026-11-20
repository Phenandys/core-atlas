import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ResearchPaper, YearBucket } from './models/research-paper';
import { CoreApiService } from './services/core-api.service';
import { SavedPapersService } from './services/saved-papers.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly coreApi = inject(CoreApiService);
  private readonly library = inject(SavedPapersService);

  readonly query = signal('');
  readonly resultLimit = signal(20);
  readonly pageIndex = signal(0);
  readonly activeView = signal<'discover' | 'saved'>('discover');
  readonly papers = signal<ResearchPaper[]>([]);
  readonly savedPapers = signal<ResearchPaper[]>(this.library.getAll());
  readonly totalHits = signal(0);
  readonly yearDistribution = signal<YearBucket[]>([]);
  readonly chartSource = signal<'all-matches' | 'loaded-papers' | null>(null);
  readonly hasSearched = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly queryMessage = signal('');
  readonly filterTerm = signal('');
  readonly sortMode = signal<'relevance' | 'newest'>('relevance');
  readonly toastMessage = signal('');

  readonly exampleQueries = [
    { label: 'A field with drone delivery', query: '(drone AND (package OR delivery))' },
    { label: 'Climate adaptation', query: '(climate change AND adaptation)' },
    { label: 'AI in medicine', query: '(artificial intelligence AND healthcare)' },
  ];

  readonly refinedPapers = computed(() => {
    const term = this.filterTerm().trim().toLowerCase();
    const matches = this.activeView() === 'saved' ? this.savedPapers() : this.papers();
    const filtered = term
      ? matches.filter((paper) => `${paper.title} ${paper.abstract} ${paper.authors.join(' ')}`.toLowerCase().includes(term))
      : matches;
    return this.sortMode() === 'newest'
      ? [...filtered].sort((a, b) => (b.year || 0) - (a.year || 0))
      : filtered;
  });

  readonly chartBars = computed(() => {
    const recentYears = this.yearDistribution().slice(-10);
    const max = Math.max(1, ...recentYears.map((bucket) => bucket.count));
    return recentYears.map((bucket) => ({
      ...bucket,
      height: Math.max(5, Math.round((bucket.count / max) * 100)),
    }));
  });

  readonly pageNumber = computed(() => this.pageIndex() + 1);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalHits() / this.resultLimit())));
  readonly firstVisible = computed(() => this.totalHits() === 0 ? 0 : this.pageIndex() * this.resultLimit() + 1);
  readonly lastVisible = computed(() => Math.min((this.pageIndex() + 1) * this.resultLimit(), this.totalHits()));
  readonly canGoBack = computed(() => this.pageIndex() > 0);
  readonly canGoForward = computed(() => (this.pageIndex() + 1) * this.resultLimit() < this.totalHits());
  readonly chartTotal = computed(() => this.yearDistribution().reduce((sum, bucket) => sum + bucket.count, 0));

  async search(resetPage = true): Promise<void> {
    const cleanQuery = this.query().trim();
    this.queryMessage.set('');
    this.errorMessage.set('');
    this.filterTerm.set('');
    if (resetPage) this.activeView.set('discover');

    if (!cleanQuery) {
      this.resetResults();
      this.queryMessage.set('Enter a word or Boolean expression to start your search.');
      return;
    }
    if (!this.hasBalancedGroups(cleanQuery)) {
      this.resetResults();
      this.queryMessage.set('Check the parentheses in your query. Every opening bracket needs a closing bracket.');
      return;
    }

    if (resetPage) this.pageIndex.set(0);
    this.loading.set(true);
    this.hasSearched.set(true);
    const offset = this.pageIndex() * this.resultLimit();

    try {
      const response = await firstValueFrom(this.coreApi.search(cleanQuery, this.resultLimit(), offset));
      this.papers.set(response.results);
      this.totalHits.set(response.totalHits);
      this.yearDistribution.set(response.yearDistribution);
      this.chartSource.set(response.chartSource);
      this.pageIndex.set(Math.floor(response.offset / Math.max(1, response.limit)));
    } catch (error) {
      const message = error instanceof HttpErrorResponse
        ? error.error?.message
        : undefined;
      this.errorMessage.set(message || 'The CORE service could not complete this search. Please try again.');
      this.papers.set([]);
      this.yearDistribution.set([]);
      this.chartSource.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  chooseExample(value: string): void {
    this.query.set(value);
    this.activeView.set('discover');
    void this.search(true);
  }

  changeLimit(value: number | string): void {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return;
    this.resultLimit.set(parsed);
    if (this.hasSearched() && this.query().trim()) void this.search(true);
  }

  goToPreviousPage(): void {
    if (!this.canGoBack() || this.loading()) return;
    this.pageIndex.update((page) => page - 1);
    void this.search(false);
  }

  goToNextPage(): void {
    if (!this.canGoForward() || this.loading()) return;
    this.pageIndex.update((page) => page + 1);
    void this.search(false);
  }

  showDiscover(): void {
    this.activeView.set('discover');
    this.filterTerm.set('');
  }

  showSaved(): void {
    this.savedPapers.set(this.library.getAll());
    this.activeView.set('saved');
    this.filterTerm.set('');
  }

  toggleSaved(paper: ResearchPaper): void {
    this.savedPapers.set(this.library.toggle(paper));
    const wasSaved = this.savedPapers().some((item) => item.id === paper.id);
    this.toastMessage.set(wasSaved ? 'Added to your reading list' : 'Removed from your reading list');
    window.setTimeout(() => this.toastMessage.set(''), 2400);
  }

  isSaved(id: string): boolean {
    return this.savedPapers().some((paper) => paper.id === id);
  }

  clearSearch(): void {
    this.query.set('');
    this.papers.set([]);
    this.yearDistribution.set([]);
    this.totalHits.set(0);
    this.pageIndex.set(0);
    this.hasSearched.set(false);
    this.queryMessage.set('');
    this.errorMessage.set('');
    this.filterTerm.set('');
    this.chartSource.set(null);
    this.activeView.set('discover');
  }

  private resetResults(): void {
    this.papers.set([]);
    this.yearDistribution.set([]);
    this.totalHits.set(0);
    this.pageIndex.set(0);
    this.hasSearched.set(false);
    this.chartSource.set(null);
  }

  setSortMode(value: 'relevance' | 'newest'): void {
    this.sortMode.set(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  formatAuthors(paper: ResearchPaper): string {
    if (!paper.authors.length) return 'Author information not supplied';
    const visible = paper.authors.slice(0, 3).join(' · ');
    return paper.authors.length > 3 ? `${visible} · +${paper.authors.length - 3}` : visible;
  }

  private hasBalancedGroups(value: string): boolean {
    let depth = 0;
    let quoted = false;
    for (const character of value) {
      if (character === '"') quoted = !quoted;
      if (quoted) continue;
      if (character === '(') depth += 1;
      if (character === ')' && --depth < 0) return false;
    }
    return depth === 0 && !quoted;
  }
}
