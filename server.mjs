import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3000);
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.join(projectRoot, 'dist', 'core-atlas', 'browser');
const cache = new Map();
const cacheTtl = 90_000;
const maxCacheEntries = 48;

app.disable('x-powered-by');

app.get('/api/health', (_request, response) => {
  response.status(200).json({ status: 'ok', service: 'core-atlas' });
});

function coreHeaders(json = false) {
  const headers = { Accept: 'application/json' };
  if (json) headers['Content-Type'] = 'application/json';
  if (process.env.CORE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.CORE_API_KEY}`;
  }
  return headers;
}

function errorMessage(payload, status) {
  if (status === 429) return 'CORE rate limit reached. Please wait a little before searching again.';
  if (status === 401 || status === 403) return 'CORE did not authorize the request. Check the server-side CORE_API_KEY configuration.';
  return payload?.message || payload?.error || `CORE returned HTTP ${status}.`;
}

function normalizeYearDistribution(payload, papers) {
  const buckets = payload?.aggregations?.yearPublished ?? payload?.aggregations?.year_published;
  if (buckets && typeof buckets === 'object' && !Array.isArray(buckets)) {
    return {
      years: Object.entries(buckets)
        .map(([year, count]) => ({ year: Number(year), count: Number(count) }))
        .filter((item) => Number.isInteger(item.year) && item.count > 0)
        .sort((a, b) => a.year - b.year),
      source: 'all-matches',
    };
  }

  const localBuckets = new Map();
  for (const paper of papers) {
    const year = Number(paper.yearPublished || String(paper.publishedDate || '').slice(0, 4));
    if (Number.isInteger(year) && year > 0) localBuckets.set(year, (localBuckets.get(year) || 0) + 1);
  }
  return {
    years: [...localBuckets.entries()].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year),
    source: 'loaded-papers',
  };
}

app.get('/api/core/search', async (request, response) => {
  const query = String(request.query.q || '').trim();
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(request.query.limit || '20'), 10) || 20));
  const offset = Math.max(0, Number.parseInt(String(request.query.offset || '0'), 10) || 0);

  if (!query) return response.status(400).json({ message: 'Enter a search query first.' });
  if (query.length > 1000) return response.status(400).json({ message: 'Queries must be 1,000 characters or fewer.' });

  const cacheKey = JSON.stringify([query, limit, offset]);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return response.json(cached.value);
  if (cached) cache.delete(cacheKey);

  const worksUrl = new URL('https://api.core.ac.uk/v3/search/works');
  worksUrl.searchParams.set('q', query);
  worksUrl.searchParams.set('limit', String(limit));
  worksUrl.searchParams.set('offset', String(offset));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const [worksResponse, aggregateResponse] = await Promise.all([
      fetch(worksUrl, { headers: coreHeaders(), signal: controller.signal }),
      fetch('https://api.core.ac.uk/v3/search/works/aggregate', {
        method: 'POST',
        headers: coreHeaders(true),
        body: JSON.stringify({ q: query, aggregations: ['yearPublished'] }),
        signal: controller.signal,
      }).catch(() => null),
    ]);

    const worksPayload = await worksResponse.json().catch(() => ({}));
    if (!worksResponse.ok) {
      return response.status(worksResponse.status).json({ message: errorMessage(worksPayload, worksResponse.status) });
    }

    const papers = Array.isArray(worksPayload.results) ? worksPayload.results : [];
    const aggregatePayload = aggregateResponse?.ok ? await aggregateResponse.json().catch(() => ({})) : null;
    const distribution = normalizeYearDistribution(aggregatePayload, papers);
    const result = {
      totalHits: Number(worksPayload.totalHits ?? worksPayload.total_hits ?? papers.length),
      limit: Number(worksPayload.limit ?? limit),
      offset: Number(worksPayload.offset ?? offset),
      results: papers,
      yearDistribution: distribution.years,
      chartSource: distribution.source,
    };

    if (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { value: result, expiresAt: Date.now() + cacheTtl });
    return response.json(result);
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'CORE took too long to respond. Please try again.'
      : 'Could not reach the CORE API. Check your connection and try again.';
    return response.status(502).json({ message });
  } finally {
    clearTimeout(timeout);
  }
});

app.use(express.static(staticRoot, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.use((_request, response) => {
  response.sendFile(path.join(staticRoot, 'index.html'), (error) => {
    if (error && !response.headersSent) response.status(503).send('The Angular app is building. Refresh in a moment.');
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`CORE Atlas listening on 0.0.0.0:${port}`);
});
