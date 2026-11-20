import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the research search and chart entry points', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Follow the question.');
    expect(compiled.querySelector('#research-query')).toBeTruthy();
    expect(compiled.textContent).toContain('Publication years');
  });

  it('clears stale results and returns to Discover when the query is invalid', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.activeView.set('saved');
    app.query.set('(drone AND delivery');
    app.papers.set([{
      id: 'paper-1',
      title: 'An earlier result',
      authors: [],
      abstract: '',
      year: 2024,
      documentType: 'Article',
      doi: '',
      downloadUrl: '',
      isOpenAccess: false,
    }]);
    app.totalHits.set(8);
    app.yearDistribution.set([{ year: 2024, count: 8 }]);
    app.chartSource.set('all-matches');
    app.hasSearched.set(true);
    app.pageIndex.set(3);

    await app.search();

    expect(app.activeView()).toBe('discover');
    expect(app.papers()).toEqual([]);
    expect(app.totalHits()).toBe(0);
    expect(app.yearDistribution()).toEqual([]);
    expect(app.chartSource()).toBeNull();
    expect(app.hasSearched()).toBeFalse();
    expect(app.pageIndex()).toBe(0);
    expect(app.queryMessage()).toContain('parentheses');
  });

  it('clears the result-page filter when search is cleared', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.filterTerm.set('old refinement');

    app.clearSearch();

    expect(app.filterTerm()).toBe('');
    expect(app.activeView()).toBe('discover');
  });
});
