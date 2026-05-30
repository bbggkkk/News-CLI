# news-cli Production-Level Refactor Design

## Goal
Transform hobby-level news-cli into a production-level tool with clean architecture, while maintaining zero dependencies and dual-interface support (CLI + Hermes agent).

## Architecture

```
src/
  core/             ← Pure business logic (zero I/O dependencies)
    feed.ts         ← Feed entity, URL/query builder
    news-item.ts    ← NewsItem types, normalization, dedup, filtering
    errors.ts       ← AppError base class + ErrorCode enum

  providers/        ← I/O implementations
    http.ts         ← fetch + retry + timeout
    cache.ts        ← Atomic file cache save/load
    xml.ts          ← RSS XML parser
    config.ts       ← Env vars + config file loader

  interfaces/       ← Presentation layer (two surfaces)
    cli/            ← Terminal CLI UX
      parser.ts     ← arg parsing
      router.ts     ← command dispatch
      formatter.ts  ← human-friendly output
      help.ts       ← help text constants
    hermes/         ← Hermes agent JSON interface
      news.ts       ← news_latest, news_search, news_dart, news_detail, news_search_url

  lib/
    logger.ts       ← Logger with levels + JSON/human mode
    version.ts      ← VERSION constant

bin/
  news-cli.ts       ← Entry point: calls cli/router
```

## Data Flow

```
CLI: bin/news-cli.ts → interfaces/cli/router → core/* → providers/* (I/O) → interfaces/cli/formatter → stdout
Hermes: plugin.yaml → interfaces/hermes/news.ts → core/* → providers/* (I/O) → JSON stdout
```

## Core Module Detail

### `core/errors.ts`
- `ErrorCode` enum: `AUTH_FAILED`, `RATE_LIMITED`, `API_ERROR`, `NETWORK_ERROR`, `INVALID_INPUT`, `CACHE_MISS`, `UNKNOWN`
- `AppError` class: extends Error, carries `code: ErrorCode`, `statusCode?: number`, `retryAfterMs?: number`, `userMessage: string` (Korean)

### `core/feed.ts`
- `Feed`, `FeedType`, `SearchOptions` types (from current `feeds.ts`)
- `buildSearchUrl()`, `buildSearchQuery()`, `buildLatestUrl()`, `createSearchFeed()`, `selectFeeds()`
- Pre-defined `feeds` array, `getCategories()`

### `core/news-item.ts`
- `NewsItem` type (from current `news.ts`)
- `normalizeItem()`, `normalizeNewsApiItem()`, `dedupeItems()`, `filterItemsBySinceHours()`
- `safeString()`, `normalizeDate()` helpers

## Provider Module Detail

### `providers/http.ts`
- `fetchFeed(feed, options)`: fetch with retry, timeout, auth header injection
- `NewsApiError` class (moved from current `news.ts`)
- Retry logic: exponential backoff with jitter, max 2 retries, 30s cap
- Auth error: immediate failure with Korean user message
- Rate limit (429) and server errors (5xx): retryable

### `providers/cache.ts`
- Atomic write via tmp file + rename
- Dual-path: `~/.cache/news-cli/` (primary) → `.news-cli-cache/` (fallback)
- `saveItems()`, `loadItems()`, `saveHistoryEntry()`, `loadHistory()`

### `providers/xml.ts`
- `parseRss(xml)`, `stripHtml()`, `decodeXml()`, `extractTag()`

### `providers/config.ts`
- `getEnv(key)`: env var access + trim
- `loadAppConfig()`: load `~/.config/news-cli/config.json` if exists
- Future: `defaultTimeout`, `defaultLimit`, etc.

## CLI Interface

### `interfaces/cli/parser.ts`
- `parseArgs(argv)` → `{ command, options, args }`
- Full flag parsing: `--limit`, `--site`, `--phrase`, `--exclude`, `--after`/`--before`, `--since-hours`, `--json`, `--timeout`, `--no-cache`, `--version`, help flags

### `interfaces/cli/router.ts`
- `run(argv)`: parse → dispatch to command handler → format → print
- Handles: `latest`, `dart`/`disclosure`, `search`, `url`, `detail`, `history`, `categories`, `upgrade`, `help`, `--version`

### `interfaces/cli/formatter.ts`
- `formatListItem(item)`, `formatDetail(item)`, `formatHistory(entries)`, `formatCategories(feeds)`
- Human-friendly output with Korean locale date formatting
- JSON mode: `formatJson(items, errors, options)`

### `interfaces/cli/help.ts`
- `HELP_TEXT` constant, `COMMAND_HELP` map
- Extracted from current `cli.ts` template literals

## Hermes Interface

### `interfaces/hermes/news.ts`
Five exported functions matching `plugin.yaml` tool definitions:
- `news_latest({ limit?, sinceHours? })` → stderr progress, stdout JSON result
- `news_search({ query, site?, phrase?, exclude?, after?, before?, sinceHours?, limit? })`
- `news_dart({ limit?, sinceHours? })`
- `news_detail({ idOrUrl })`
- `news_search_url({ query, site?, phrase?, exclude?, after?, before? })`

Each function produces JSON output to stdout matching current Hermes expectations.

## Error Handling
- All I/O errors propagate as `AppError` with `ErrorCode`
- `cli/router.ts` catches errors globally and prints user-friendly message
- Debug mode (`--debug` flag) shows full stack trace
- Hermes interface converts errors to JSON `{ ok: false, error: { code, message } }`

## Testing
- All `core/*` modules: pure function tests (no mocks needed)
- `providers/*`: integration tests (real XML parsing, cache I/O)
- `interfaces/cli`: mock-based E2E tests (current approach, expand coverage)
- `interfaces/hermes`: mock-based tests for each tool
- Consistent framework: `bun:test` only (migrate remaining `node:test` usage)
- Add `--coverage` to CI

## Changes from Current Codebase
1. `cli.ts` (738 lines) → split into `parser.ts`, `router.ts`, `formatter.ts`, `help.ts`
2. `news.ts` (543 lines) → split into `core/news-item.ts` + `providers/http.ts`
3. `feeds.ts` → `core/feed.ts`
4. `cache.ts` → `providers/cache.ts`
5. `xml.ts` → `providers/xml.ts`
6. `env.ts` → `providers/config.ts`
7. `logger.ts` → `lib/logger.ts`
8. `version.ts` → `lib/version.ts`
9. `upgrade.ts` → stays as `src/upgrade.ts` (self-contained)
10. `url.ts` → `providers/http.ts` (URL validation logic merged)
