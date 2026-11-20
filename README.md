# CORE Atlas — Research Discovery

CORE Atlas is an Angular 20 research-discovery app for searching scholarly works in the CORE collection. It supports Lucene-style Boolean queries, adjustable result counts, per-page refinement, pagination, a publication-year chart from CORE's aggregate endpoint, and a browser-local reading list.

## Requirements

- Node.js 22 or later
- Corepack and pnpm 11.25.0 (the repository pins this with `packageManager`)
- A modern browser

## Run locally

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The development command builds the Angular app in watch mode and starts the Express server, which serves the app and provides the same-origin CORE API proxy. To create a production browser bundle, run `pnpm build`. To serve the production bundle locally, run `pnpm start` after building. The container listens on `PORT` (default `3000`) and exposes `/api/health` for readiness checks.

`pnpm test` runs the Angular unit-test target in Chrome Headless; a compatible Chrome/Chromium binary must be available in the environment.

## Search and CORE API

The proxy calls `GET https://api.core.ac.uk/v3/search/works` for papers and `POST https://api.core.ac.uk/v3/search/works/aggregate` for a query-wide `yearPublished` breakdown. The proxy keeps API requests server-side because CORE does not advertise browser-origin CORS access. The anonymous tier can be used without registration; the published CORE API documentation lists a quota of 100 tokens per day and a maximum of 10 requests per minute. Each uncached search asks for both works and year aggregation, so the chart uses a second API request.

For a larger registered quota, set `CORE_API_KEY` in the server environment. The key is sent only as an `Authorization: Bearer …` header from the server and is never included in browser code. Do not commit a real key.

Boolean examples:

```text
(drone AND (package OR delivery))
(title:"battery recycling" AND yearPublished>=2020)
(artificial intelligence AND healthcare)
```

See [CORE API v3 documentation](https://api.core.ac.uk/docs/v3) for the current query language, API access terms, and quota details.

## Added capabilities

- A reading list saved in this browser with no account required.
- Query-wide publication-year aggregation, with a clearly labelled current-page fallback if aggregation is unavailable.
- Local refinement within the returned page, relevance or newest-first sorting, and CORE result pagination.
- Example Boolean searches, bracket/quote validation, accessible loading and error states, a responsive layout, and a short-lived server response cache.

Saved reading-list data is browser-local and is not synchronized across devices. The CORE API quota is shared by requests made with the same API credential or anonymous tier.
