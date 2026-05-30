# news-cli Production-Level Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor news-cli from a single-file hobby project into a clean-architecture zero-dependency CLI with dual interfaces (terminal CLI + Hermes agent)

**Architecture:** `src/core/` (pure domain logic) → `src/providers/` (I/O implementations) → `src/interfaces/` (CLI + Hermes presentation layers). All data flows inward.

**Tech Stack:** Bun, TypeScript (strict), zero dependencies, Biome (lint/format), bun:test

---

### Task 1: `src/core/errors.ts` — Error types and error codes

**Files:**
- Create: `src/core/errors.ts`
- Test: `test/errors.test.ts`

- [ ] **Step 1: Write the failing error type tests**

```typescript
// test/errors.test.ts
import { describe, expect, test } from "bun:test";
import { AppError, ErrorCode } from "../src/core/errors";

describe("AppError", () => {
  test("creates error with code and userMessage", () => {
    const err = new AppError(ErrorCode.AUTH_FAILED, "API 키가 유효하지 않습니다", { statusCode: 401 });
    expect(err.code).toBe(ErrorCode.AUTH_FAILED);
    expect(err.userMessage).toBe("API 키가 유효하지 않습니다");
    expect(err.statusCode).toBe(401);
    expect(err.isAuthError).toBe(true);
    expect(err.isRetryable).toBe(false);
  });

  test("rate limited error is retryable", () => {
    const err = new AppError(ErrorCode.RATE_LIMITED, "요청 한도 초과", { statusCode: 429, retryAfterMs: 1000 });
    expect(err.isRateLimited).toBe(true);
    expect(err.isRetryable).toBe(true);
    expect(err.retryAfterMs).toBe(1000);
  });

  test("server error is retryable", () => {
    const err = new AppError(ErrorCode.API_ERROR, "서버 오류", { statusCode: 500 });
    expect(err.isServerError).toBe(true);
    expect(err.isRetryable).toBe(true);
  });

  test("network error is not retryable by default", () => {
    const err = new AppError(ErrorCode.NETWORK_ERROR, "네트워크 오류");
    expect(err.isRetryable).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/errors.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write the error module**

```typescript
// src/core/errors.ts
export const ErrorCode = {
  AUTH_FAILED: "AUTH_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  API_ERROR: "API_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  CACHE_MISS: "CACHE_MISS",
  UPGRADE_ERROR: "UPGRADE_ERROR",
  UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

type AppErrorOptions = {
  statusCode?: number;
  retryAfterMs?: number;
  cause?: Error;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly statusCode?: number;
  readonly retryAfterMs?: number;

  constructor(
    code: ErrorCode,
    userMessage: string,
    options: AppErrorOptions = {},
  ) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
    this.statusCode = options.statusCode;
    this.retryAfterMs = options.retryAfterMs;
    if (options.cause) this.cause = options.cause;
  }

  get isAuthError(): boolean {
    return this.code === ErrorCode.AUTH_FAILED;
  }

  get isRateLimited(): boolean {
    return this.code === ErrorCode.RATE_LIMITED;
  }

  get isServerError(): boolean {
    return this.code === ErrorCode.API_ERROR && (this.statusCode ?? 0) >= 500;
  }

  get isRetryable(): boolean {
    return this.isRateLimited || this.isServerError;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/errors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/errors.ts test/errors.test.ts
git commit -m "refactor: add AppError and ErrorCode types"
```

---

### Task 2: `src/core/feed.ts` — Feed entity and URL builders

**Files:**
- Create: `src/core/feed.ts`
- Test: update `test/feed.test.ts` from existing `test/xml.test.ts` feed tests

- [ ] **Step 1: Write feed tests**

```typescript
// test/feed.test.ts
import { describe, expect, test } from "bun:test";
import {
  buildLatestUrl,
  buildSearchQuery,
  buildSearchUrl,
  createSearchFeed,
  selectFeeds,
  getCategories,
} from "../src/core/feed";

describe("buildLatestUrl", () => {
  test("returns NewsAPI top-headlines URL", () => {
    expect(buildLatestUrl()).toBe("https://newsapi.org/v2/top-headlines?country=kr");
  });
});

describe("buildSearchQuery", () => {
  test("combines search operators", () => {
    expect(
      buildSearchQuery({
        query: "반도체",
        site: "mk.co.kr",
        phrase: "실적 전망",
        exclude: ["루머", "-광고"],
        after: "2026-05-01",
        before: "2026-05-28",
      }),
    ).toBe('반도체 site:mk.co.kr "실적 전망" -루머 -광고 after:2026-05-01 before:2026-05-28');
  });

  test("validates date filters", () => {
    expect(() => buildSearchQuery({ query: "삼성전자", after: "2026-02-30" })).toThrow(/Invalid date filter/);
  });
});

describe("buildSearchUrl", () => {
  test("returns NewsAPI search URL", () => {
    const url = buildSearchUrl({
      query: "반도체",
      site: "mk.co.kr",
      phrase: "실적 전망",
      exclude: "루머",
      after: "2026-05-01",
      before: "2026-05-28",
    });
    expect(url).toBe(
      "https://newsapi.org/v2/everything?q=%EB%B0%98%EB%8F%84%EC%B2%B4+%22%EC%8B%A4%EC%A0%81+%EC%A0%84%EB%A7%9D%22+-%EB%A3%A8%EB%A8%B8&domains=mk.co.kr&from=2026-05-01&to=2026-05-28",
    );
  });

  test("requires at least one search parameter", () => {
    expect(() => buildSearchUrl({})).toThrow(/Search requires at least one/);
  });

  test("with only dates falls back to generic query", () => {
    const url = buildSearchUrl({ after: "2026-05-01" });
    expect(url).toContain("q=news");
    expect(url).toContain("from=2026-05-01");
  });
});

describe("selectFeeds", () => {
  test("includes DART disclosure RSS", () => {
    const [feed] = selectFeeds("dart");
    expect(feed?.key).toBe("dart");
    expect(feed?.category).toBe("disclosure");
    expect(feed?.url).toBe("https://dart.fss.or.kr/api/todayRSS.xml");
  });

  test("handles legacy keys", () => {
    const [feed] = selectFeeds("google-latest");
    expect(feed?.key).toBe("newsapi-latest");
  });

  test("throws on unknown category", () => {
    expect(() => selectFeeds("nonexistent")).toThrow(/Available fixed feeds/);
  });
});

describe("createSearchFeed", () => {
  test("creates a Feed object with search URL", () => {
    const feed = createSearchFeed({ query: "test" });
    expect(feed.key).toBe("newsapi-search");
    expect(feed.type).toBe("newsapi");
    expect(feed.url).toContain("newsapi.org/v2/everything");
  });
});

describe("getCategories", () => {
  test("returns available categories", () => {
    expect(getCategories()).toEqual(["latest", "search", "disclosure"]);
  });
});
```

- [ ] **Step 2: Write the feed module**

```typescript
// src/core/feed.ts
const NEWSAPI_BASE_URL = "https://newsapi.org/v2";

export type FeedType = "newsapi" | "rss";

export type Feed = {
  key: string;
  category: string;
  label: string;
  url: string;
  type: FeedType;
};

export type SearchOptions = {
  query?: string;
  site?: string;
  phrase?: string;
  exclude?: string | string[];
  after?: string;
  before?: string;
};

export const latestFeed: Feed = {
  key: "newsapi-latest",
  category: "latest",
  label: "NewsAPI Top Headlines",
  url: buildLatestUrl(),
  type: "newsapi",
};

export const dartFeed: Feed = {
  key: "dart",
  category: "disclosure",
  label: "DART today disclosures",
  url: "https://dart.fss.or.kr/api/todayRSS.xml",
  type: "rss",
};

export const feeds: Feed[] = [latestFeed, dartFeed];

export function buildLatestUrl(): string {
  return `${NEWSAPI_BASE_URL}/top-headlines?country=kr`;
}

export function buildSearchUrl(options: SearchOptions = {}): string {
  const { query, site, phrase, exclude = [], after, before } = options;
  const url = new URL(`${NEWSAPI_BASE_URL}/everything`);

  const qParts: string[] = [];
  if (query) qParts.push(query.trim());
  if (phrase) {
    const normalizedPhrase = phrase.trim().replace(/^"+|"+$/g, "");
    if (normalizedPhrase) qParts.push(`"${normalizedPhrase}"`);
  }
  for (const word of normalizeList(exclude)) {
    const normalizedWord = word.trim().replace(/^-+/, "");
    if (normalizedWord) qParts.push(`-${normalizedWord}`);
  }

  const q = qParts.filter(Boolean).join(" ");
  if (q) url.searchParams.set("q", q);
  if (site) url.searchParams.set("domains", site.trim());

  const normalizedAfter = normalizeDateFilter(after);
  if (normalizedAfter) url.searchParams.set("from", normalizedAfter);
  const normalizedBefore = normalizeDateFilter(before);
  if (normalizedBefore) url.searchParams.set("to", normalizedBefore);

  if (!url.searchParams.has("q") && !url.searchParams.has("domains")) {
    if (url.searchParams.has("from") || url.searchParams.has("to")) {
      url.searchParams.set("q", "news");
    } else {
      throw new Error("Search requires at least one of query, site, phrase, exclude, after, or before.");
    }
  }

  return url.toString();
}

export function buildSearchQuery(options: SearchOptions = {}): string {
  const { query, site, phrase, exclude = [], after, before } = options;
  const parts: string[] = [];
  if (query) parts.push(query.trim());
  if (site) parts.push(`site:${site.trim()}`);
  if (phrase) {
    const normalizedPhrase = phrase.trim().replace(/^"+|"+$/g, "");
    if (normalizedPhrase) parts.push(`"${normalizedPhrase}"`);
  }
  for (const word of normalizeList(exclude)) {
    const normalizedWord = word.trim().replace(/^-+/, "");
    if (normalizedWord) parts.push(`-${normalizedWord}`);
  }
  const normalizedAfter = normalizeDateFilter(after);
  if (normalizedAfter) parts.push(`after:${normalizedAfter}`);
  const normalizedBefore = normalizeDateFilter(before);
  if (normalizedBefore) parts.push(`before:${normalizedBefore}`);
  return parts.filter(Boolean).join(" ");
}

export function createSearchFeed(options: SearchOptions): Feed {
  return {
    key: "newsapi-search",
    category: "search",
    label: `NewsAPI search: ${buildSearchQuery(options)}`,
    url: buildSearchUrl(options),
    type: "newsapi",
  };
}

export function getCategories(): string[] {
  return ["latest", "search", "disclosure"];
}

export function selectFeeds(category?: string): Feed[] {
  if (!category || category === "all" || category === "latest" || category === latestFeed.key || category === "google-latest") {
    return [latestFeed];
  }
  if (category === "dart" || category === "disclosure" || category === dartFeed.key) {
    return [dartFeed];
  }
  throw new Error('Available fixed feeds: latest, dart, disclosure. Use "news-cli search <query>" for NewsAPI search.');
}

function normalizeList(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeDateFilter(value?: string): string {
  if (!value) return "";
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`Date filters must use YYYY-MM-DD. Received "${value}".`);
  }
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`Invalid date filter: "${value}".`);
  }
  return normalized;
}
```

- [ ] **Step 3: Run tests**

Run: `bun test test/feed.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/feed.ts test/feed.test.ts
git commit -m "refactor: add core/feed module with URL builders"
```

---

### Task 3: `src/core/news-item.ts` — NewsItem type, normalization, dedup, filtering

**Files:**
- Create: `src/core/news-item.ts`
- Test: `test/news-item.test.ts`

- [ ] **Step 1: Write NewsItem tests**

```typescript
// test/news-item.test.ts
import { describe, expect, test } from "bun:test";
import {
  normalizeItem,
  normalizeNewsApiItem,
  dedupeItems,
  filterItemsBySinceHours,
  type NewsItem,
} from "../src/core/news-item";
import type { Feed } from "../src/core/feed";

function makeFeed(overrides: Partial<Feed> = {}): Feed {
  return { key: "test", category: "latest", label: "Test", url: "https://example.com/rss", type: "rss", ...overrides };
}

function makeNewsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return { id: "", guid: "", title: "", link: "", date: "", rawDate: "", description: "", category: "", source: "", sourceLabel: "", feedUrl: "", author: "", itemCategory: "", categories: [], sources: [], ...overrides };
}

describe("normalizeItem", () => {
  test("adds source metadata and stable id from RSS", () => {
    const item = normalizeItem(
      { title: "테스트 뉴스", link: "https://example.com/news/1", guid: "news-1", pubDate: "Wed, 27 May 2026 10:00:00 +0900", description: "요약", category: "", author: "" },
      makeFeed({ key: "example", category: "society" }),
    );
    expect(item.source).toBe("example");
    expect(item.category).toBe("society");
    expect(item.id).toHaveLength(10);
    expect(item.date).toBe("2026-05-27T01:00:00.000Z");
  });
});

describe("normalizeNewsApiItem", () => {
  test("handles complete article", () => {
    const article = {
      source: { id: "bbc", name: "BBC News" },
      author: "Reporter",
      title: "Breaking News",
      description: "Something happened",
      url: "https://example.com/article/1",
      publishedAt: "2026-05-30T10:00:00Z",
    };
    const item = normalizeNewsApiItem(article, makeFeed({ key: "newsapi-latest", type: "newsapi" }));
    expect(item.title).toBe("Breaking News");
    expect(item.link).toBe("https://example.com/article/1");
    expect(item.author).toBe("Reporter");
    expect(item.sourceLabel).toBe("BBC News");
    expect(item.date).toBe("2026-05-30T10:00:00.000Z");
    expect(item.id).toHaveLength(10);
  });

  test("handles null/missing fields without crashing", () => {
    const article = { source: null, author: null, title: null, description: null, url: null, publishedAt: null };
    const item = normalizeNewsApiItem(article, makeFeed({ key: "newsapi-latest", type: "newsapi" }));
    expect(item.title).toBe("(untitled)");
    expect(item.link).toBe("");
    expect(item.author).toBe("");
    expect(item.sourceLabel).toBe("Test");
  });

  test("handles non-object input", () => {
    const feed = makeFeed({ key: "newsapi-latest", type: "newsapi" });
    expect(normalizeNewsApiItem(null, feed).title).toBe("(untitled)");
    expect(normalizeNewsApiItem(undefined, feed).title).toBe("(untitled)");
    expect(normalizeNewsApiItem("garbage string", feed).title).toBe("(untitled)");
  });
});

describe("dedupeItems", () => {
  test("combines categories and sources for same id", () => {
    const items = [
      makeNewsItem({ id: "same", category: "search", source: "google-search" }),
      makeNewsItem({ id: "same", category: "latest", source: "google-latest" }),
      makeNewsItem({ id: "other", category: "latest", source: "google-latest" }),
    ];
    const deduped = dedupeItems(items);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]!.category).toBe("search,latest");
    expect(deduped[0]!.categories).toEqual(["search", "latest"]);
  });
});

describe("filterItemsBySinceHours", () => {
  test("keeps only recent dated items", () => {
    const now = new Date("2026-05-29T12:00:00.000Z").getTime();
    const items = [
      makeNewsItem({ id: "recent", date: "2026-05-29T10:30:00.000Z" }),
      makeNewsItem({ id: "old", date: "2026-05-29T08:59:59.000Z" }),
      makeNewsItem({ id: "undated", date: "" }),
    ];
    expect(filterItemsBySinceHours(items, 3, now).map((i) => i.id)).toEqual(["recent"]);
  });
});
```

- [ ] **Step 2: Write the news-item module**

```typescript
// src/core/news-item.ts
import * as crypto from "node:crypto";
import type { Feed } from "./feed";

export type NewsItem = {
  id: string;
  guid: string;
  title: string;
  link: string;
  date: string;
  rawDate: string;
  description: string;
  category: string;
  source: string;
  sourceLabel: string;
  feedUrl: string;
  author: string;
  itemCategory: string;
  categories: string[];
  sources: string[];
};

type RssItemInput = {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description: string;
  category: string;
  author: string;
};

interface NewsApiArticle {
  title?: unknown;
  url?: unknown;
  publishedAt?: unknown;
  description?: unknown;
  author?: unknown;
  source?: { name?: unknown } | null | unknown;
}

export function normalizeItem(item: RssItemInput, feed: Feed): NewsItem {
  const date = normalizeDate(item.pubDate);
  const sourceId = item.guid || item.link || `${feed.key}:${item.title}:${item.pubDate}`;
  const id = crypto.createHash("sha1").update(sourceId).digest("hex").slice(0, 10);
  return {
    id,
    guid: item.guid ?? "",
    title: item.title || "(untitled)",
    link: item.link ?? "",
    date,
    rawDate: item.pubDate ?? "",
    description: item.description ?? "",
    category: feed.category,
    source: feed.key,
    sourceLabel: feed.label,
    feedUrl: feed.url,
    author: item.author ?? "",
    itemCategory: item.category ?? "",
    categories: [feed.category],
    sources: [feed.key],
  };
}

export function normalizeNewsApiItem(article: unknown, feed: Feed): NewsItem {
  const a = typeof article === "object" && article !== null ? (article as NewsApiArticle) : {};
  const title = safeString(a.title) || "(untitled)";
  const url = safeString(a.url);
  const publishedAt = safeString(a.publishedAt);
  const description = safeString(a.description);
  const author = safeString(a.author);
  let sourceName = "";
  if (typeof a.source === "object" && a.source !== null && !Array.isArray(a.source)) {
    sourceName = safeString((a.source as { name?: unknown }).name);
  }
  const date = normalizeDate(publishedAt);
  const sourceId = url || `${feed.key}:${title}:${publishedAt}`;
  const id = crypto.createHash("sha1").update(sourceId).digest("hex").slice(0, 10);
  return {
    id,
    guid: url,
    title,
    link: url,
    date,
    rawDate: publishedAt,
    description,
    category: feed.category,
    source: feed.key,
    sourceLabel: sourceName || feed.label,
    feedUrl: feed.url,
    author,
    itemCategory: "",
    categories: [feed.category],
    sources: [feed.key],
  };
}

function safeString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

export function dedupeItems(items: NewsItem[]): NewsItem[] {
  const byId = new Map<string, NewsItem>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, {
        ...item,
        categories: [item.category],
        sources: [item.source],
      });
      continue;
    }
    if (!existing.categories.includes(item.category)) existing.categories.push(item.category);
    if (!existing.sources.includes(item.source)) existing.sources.push(item.source);
    existing.category = existing.categories.join(",");
    existing.source = existing.sources.join(",");
  }
  return Array.from(byId.values());
}

export function filterItemsBySinceHours(
  items: NewsItem[],
  sinceHours?: number,
  now = Date.now(),
): NewsItem[] {
  if (!sinceHours) return items;
  const cutoff = now - sinceHours * 60 * 60 * 1000;
  return items.filter((item) => {
    const timestamp = item.date ? new Date(item.date).getTime() : 0;
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

export function normalizeDate(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}
```

- [ ] **Step 3: Run tests**

Run: `bun test test/news-item.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/news-item.ts test/news-item.test.ts
git commit -m "refactor: add core/news-item module with normalization and dedup"
```

---

### Task 4: `src/providers/xml.ts` — RSS XML parser

**Files:**
- Create: `src/providers/xml.ts`
- Test: `test/xml.test.ts`

- [ ] **Step 1: Write XML tests**

```typescript
// test/xml.test.ts (overwrite existing)
import { describe, expect, test } from "bun:test";
import { parseRss, stripHtml, decodeXml } from "../src/providers/xml";

describe("decodeXml", () => {
  test("decodes HTML entities", () => {
    expect(decodeXml("A&amp;B &lt; C &gt; D&quot;E&apos;F")).toBe("A&B < C > D\"E'F");
  });

  test("handles CDATA sections", () => {
    expect(decodeXml("<![CDATA[Hello &amp; World]]>")).toBe("Hello &amp; World");
  });

  test("handles numeric entities", () => {
    expect(decodeXml("&#54620;&#44397;")).toBe("한국");
  });
});

describe("stripHtml", () => {
  test("strips tags and decodes entities", () => {
    expect(stripHtml("<p>A&amp;B<br>C</p>")).toBe("A&B\nC");
  });

  test("converts br and /p to newlines", () => {
    expect(stripHtml("<p>Line1</p><p>Line2</p><br/>")).toBe("Line1\n\nLine2");
  });
});

describe("parseRss", () => {
  test("extracts common RSS item fields", () => {
    const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title><![CDATA[경제 &amp; 정치]]></title>
        <link>https://example.com/news/1</link>
        <guid>news-1</guid>
        <pubDate>Wed, 27 May 2026 10:00:00 +0900</pubDate>
        <description><![CDATA[<p>본문 요약<br>두번째 줄</p>]]></description>
        <category>economy</category>
      </item>
    </channel></rss>`;

    const items = parseRss(xml);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("경제 & 정치");
    expect(items[0]!.link).toBe("https://example.com/news/1");
    expect(items[0]!.description).toBe("본문 요약\n두번째 줄");
    expect(items[0]!.category).toBe("economy");
  });

  test("returns empty array for no items", () => {
    expect(parseRss("<rss><channel></channel></rss>")).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the XML provider**

```typescript
// src/providers/xml.ts
const entityMap: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

export type RssItem = {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description: string;
  category: string;
  author: string;
};

export function decodeXml(value = ""): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_: string, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_: string, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (match: string, name: string) => entityMap[name] ?? match);
}

export function stripHtml(value = ""): string {
  return decodeXml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTag(block: string, tagName: string): string {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(pattern);
  return match ? decodeXml(match[1]!).trim() : "";
}

export function parseRss(xml: string): RssItem[] {
  const itemMatches = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
  return itemMatches
    .map((item) => ({
      title: stripHtml(extractTag(item, "title")),
      link: stripHtml(extractTag(item, "link")),
      guid: stripHtml(extractTag(item, "guid")),
      pubDate: stripHtml(extractTag(item, "pubDate")),
      description: stripHtml(extractTag(item, "description")),
      category: stripHtml(extractTag(item, "category")),
      author: stripHtml(extractTag(item, "author")),
    }))
    .filter((item) => item.title || item.link || item.description);
}
```

- [ ] **Step 3: Run tests**

Run: `bun test test/xml.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/providers/xml.ts test/xml.test.ts
git commit -m "refactor: add providers/xml RSS parser"
```

---

### Task 5: `src/providers/config.ts` — Environment + config file

**Files:**
- Create: `src/providers/config.ts`
- Test: `test/config.test.ts`

- [ ] **Step 1: Write config tests**

```typescript
// test/config.test.ts
import { describe, expect, test } from "bun:test";
import { getEnv, type AppConfig } from "../src/providers/config";

describe("getEnv", () => {
  test("trims environmental variables", () => {
    process.env["TEST_KEY_TRIM"] = "  some-value-with-spaces  \n";
    expect(getEnv("TEST_KEY_TRIM")).toBe("some-value-with-spaces");
    delete process.env["TEST_KEY_TRIM"];
  });

  test("returns undefined for unset variables", () => {
    expect(getEnv("NONEXISTENT_ENV_VAR")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write the config module**

```typescript
// src/providers/config.ts
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { AppError, ErrorCode } from "../core/errors";

export type AppConfig = {
  defaultTimeoutMs: number;
  defaultLimit: number;
  newsApiKey: string | undefined;
};

export function getEnv(key: string): string | undefined {
  const value = process.env[key];
  return value !== undefined ? value.trim() : undefined;
}

export async function loadAppConfig(): Promise<AppConfig> {
  const config: AppConfig = {
    defaultTimeoutMs: 10_000,
    defaultLimit: 30,
    newsApiKey: getEnv("NEWS_API_KEY") || getEnv("NEWSAPI_KEY"),
  };

  const configPath = path.join(os.homedir(), ".config", "news-cli", "config.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      if (typeof parsed.defaultTimeoutMs === "number") config.defaultTimeoutMs = parsed.defaultTimeoutMs;
      if (typeof parsed.defaultLimit === "number") config.defaultLimit = parsed.defaultLimit;
    }
  } catch {
    // Config file not found or invalid — use defaults
  }

  return config;
}

export function requireApiKey(config: AppConfig): string {
  if (!config.newsApiKey) {
    throw new AppError(
      ErrorCode.AUTH_FAILED,
      "NEWS_API_KEY 환경 변수가 설정되지 않았습니다. NewsAPI 키를 발급받은 후 export NEWS_API_KEY=\"your-key\" 를 실행하세요. 발급: https://newsapi.org/register",
    );
  }
  return config.newsApiKey;
}
```

- [ ] **Step 3: Run tests**

Run: `bun test test/config.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/providers/config.ts test/config.test.ts
git commit -m "refactor: add providers/config with env and config file"
```

---

### Task 6: `src/providers/http.ts` — HTTP fetcher with retry

**Files:**
- Create: `src/providers/http.ts`
- Test: `test/http.test.ts`

- [ ] **Step 1: Write HTTP provider tests**

```typescript
// test/http.test.ts
import { describe, expect, test, mock, afterEach } from "bun:test";
import { fetchFeed } from "../src/providers/http";
import type { Feed } from "../src/core/feed";
import { AppError, ErrorCode } from "../src/core/errors";

const testFeed: Feed = { key: "test", category: "latest", label: "Test", url: "https://newsapi.org/v2/top-headlines?country=kr", type: "newsapi" };
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env["NEWS_API_KEY"];
  delete process.env["NEWSAPI_KEY"];
});

test("fetchFeed returns parsed NewsItem array on success", async () => {
  process.env["NEWS_API_KEY"] = "test-key";
  global.fetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({
        status: "ok",
        articles: [{ title: "Test", url: "https://example.com", publishedAt: "2026-05-31T00:00:00Z" }],
      }), { status: 200 }),
    ),
  );
  const items = await fetchFeed(testFeed);
  expect(items).toHaveLength(1);
  expect(items[0]!.title).toBe("Test");
});

test("fetchFeed throws AppError with AUTH_FAILED on 401", async () => {
  process.env["NEWS_API_KEY"] = "bad-key";
  global.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify({ status: "error", code: "apiKeyInvalid", message: "Invalid" }), { status: 401 })),
  );
  try {
    await fetchFeed(testFeed);
    expect.unreachable();
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    expect((e as AppError).code).toBe(ErrorCode.AUTH_FAILED);
  }
});

test("fetchFeed retries on 429 then throws", async () => {
  process.env["NEWS_API_KEY"] = "test-key";
  let calls = 0;
  global.fetch = mock(() => {
    calls++;
    return Promise.resolve(new Response(JSON.stringify({ status: "error", code: "rateLimited" }), { status: 429, headers: { "Retry-After": "0" } }));
  });
  try {
    await fetchFeed(testFeed, { maxRetries: 1 });
    expect.unreachable();
  } catch {
    expect(calls).toBe(2);
  }
});
```

- [ ] **Step 2: Write the HTTP provider**

```typescript
// src/providers/http.ts
import { AppError, ErrorCode } from "../core/errors";
import type { Feed } from "../core/feed";
import { normalizeItem, normalizeNewsApiItem, type NewsItem } from "../core/news-item";
import { parseRss } from "./xml";
import { getEnv } from "./config";
import { VERSION } from "../lib/version";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterHeader(response: Response): number | undefined {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return undefined;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const date = new Date(retryAfter);
  if (!Number.isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    return delayMs > 0 ? delayMs : undefined;
  }
  return undefined;
}

function validateUrl(urlStr: string, allowedDomains: string[]): void {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new AppError(ErrorCode.INVALID_INPUT, `Invalid URL format: "${urlStr}"`);
  }
  if (url.protocol !== "https:") {
    throw new AppError(ErrorCode.INVALID_INPUT, `Security error: Only HTTPS is allowed. URL: "${urlStr}"`);
  }
  const hostname = url.hostname.toLowerCase();
  const isAllowed = allowedDomains.some((domain) => {
    const d = domain.toLowerCase();
    return hostname === d || hostname.endsWith(`.${d}`);
  });
  if (!isAllowed) {
    throw new AppError(ErrorCode.INVALID_INPUT, `Security error: Domain "${url.hostname}" is not in the allowed whitelist.`);
  }
}

export async function fetchFeed(
  feed: Feed,
  { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES }: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<NewsItem[]> {
  let lastError: AppError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFeedOnce(feed, timeoutMs);
    } catch (error) {
      if (error instanceof AppError) {
        lastError = error;
        if (error.isAuthError) throw error;
        if (error.isRetryable && attempt < maxRetries) {
          const baseDelay = error.retryAfterMs ?? RETRY_BASE_DELAY_MS * 2 ** attempt;
          const jitter = Math.random() * 500;
          const delayMs = Math.min(baseDelay + jitter, 30_000);
          await sleep(delayMs);
          continue;
        }
        if (attempt >= maxRetries) break;
      }
      if (error instanceof AppError) lastError = error;
      else { lastError = new AppError(ErrorCode.UNKNOWN, String(error)); }
      if (attempt >= maxRetries) break;
    }
  }

  throw lastError ?? new AppError(ErrorCode.UNKNOWN, "Unknown fetch error");
}

async function fetchFeedOnce(feed: Feed, timeoutMs: number): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    const headers: Record<string, string> = { "user-agent": `news-cli/${VERSION}` };

    if (feed.type === "newsapi") {
      const apiKey = getEnv("NEWS_API_KEY") || getEnv("NEWSAPI_KEY");
      if (!apiKey) {
        throw new AppError(
          ErrorCode.AUTH_FAILED,
          "NEWS_API_KEY 환경 변수가 설정되지 않았습니다. NewsAPI 키를 발급받은 후 export NEWS_API_KEY=\"your-key\" 를 실행하세요. 발급: https://newsapi.org/register",
        );
      }
      headers["X-Api-Key"] = apiKey;
      headers["accept"] = "application/json";
    } else {
      headers["accept"] = "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8";
    }

    validateUrl(feed.url, ["newsapi.org", "dart.fss.or.kr"]);

    const response = await fetch(feed.url, { headers, signal: controller.signal });

    if (!response.ok) {
      const retryAfterMs = parseRetryAfterHeader(response);
      const errorBody = await response.text().catch(() => "");
      let message = `HTTP ${response.status} ${response.statusText}`;
      if (errorBody) {
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.message) message = `${message}: ${parsed.message}`;
        } catch {
          message = errorBody.length > 200 ? `${message}: ${errorBody.slice(0, 200)}...` : `${message}: ${errorBody}`;
        }
      }

      if (response.status === 401 || response.status === 403) {
        throw new AppError(ErrorCode.AUTH_FAILED, `인증 실패 (HTTP ${response.status}): NEWS_API_KEY 환경 변수를 확인하세요.`, { statusCode: response.status });
      }
      if (response.status === 429) {
        throw new AppError(ErrorCode.RATE_LIMITED, `요청 한도 초과 (429): 잠시 후 다시 시도하세요.`, { statusCode: 429, retryAfterMs });
      }
      if (response.status >= 500) {
        throw new AppError(ErrorCode.API_ERROR, `서버 오류 (${response.status}): ${response.statusText}`, { statusCode: response.status, retryAfterMs });
      }
      throw new AppError(ErrorCode.API_ERROR, message, { statusCode: response.status });
    }

    let items: NewsItem[] = [];
    if (feed.type === "newsapi") {
      const text = await response.text();
      let json: any;
      try { json = JSON.parse(text); } catch {
        throw new AppError(ErrorCode.API_ERROR, `NewsAPI 응답을 JSON으로 파싱할 수 없습니다. 응답 앞 200자: ${text.slice(0, 200)}`);
      }
      if (json.status !== "ok") {
        throw new AppError(ErrorCode.API_ERROR, `NewsAPI 오류 (${json.code || "unknown"}): ${json.message || "알 수 없는 오류"}`);
      }
      if (!Array.isArray(json.articles)) {
        throw new AppError(ErrorCode.API_ERROR, `NewsAPI 응답의 articles 필드가 배열이 아닙니다.`);
      }
      items = json.articles.map((article: unknown) => normalizeNewsApiItem(article, feed));
    } else {
      const xml = await response.text();
      if (xml.trim()) {
        items = parseRss(xml).map((item) => normalizeItem(item, feed));
      }
    }

    return items;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      const reason = (controller.signal as any).reason;
      if (reason === "timeout") {
        throw new AppError(ErrorCode.NETWORK_ERROR, `${feed.label} 요청이 ${timeoutMs / 1000}초 내에 응답하지 않아 시간 초과되었습니다. 네트워크 상태를 확인하거나 --timeout 값을 늘려보세요.`);
      }
      throw new AppError(ErrorCode.NETWORK_ERROR, `${feed.label} 요청이 중단되었습니다.`);
    }
    throw classifyNetworkError(error, feed);
  } finally {
    clearTimeout(timer);
  }
}

function classifyNetworkError(error: unknown, feed: Feed): AppError {
  const err = error as { code?: string; message?: string; cause?: { code?: string } };
  const code = err.code || err.cause?.code;
  const message = err.message || "";

  if (code === "ENOTFOUND" || message.includes("ENOTFOUND")) {
    return new AppError(ErrorCode.NETWORK_ERROR, `네트워크 연결 오류: ${feed.label}의 도메인 주소를 찾을 수 없습니다. 인터넷 연결 상태를 확인하세요.`);
  }
  if (code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
    return new AppError(ErrorCode.NETWORK_ERROR, `연결 거부 오류: ${feed.label} 서버가 응답하지 않습니다.`);
  }
  if (code === "ETIMEDOUT" || message.includes("ETIMEDOUT")) {
    return new AppError(ErrorCode.NETWORK_ERROR, `연결 시간 초과: ${feed.label} 서버와의 연결 시간이 초과되었습니다.`);
  }
  if (code === "EAI_AGAIN" || message.includes("EAI_AGAIN")) {
    return new AppError(ErrorCode.NETWORK_ERROR, `DNS 조회 오류: 임시적인 DNS 장애가 발생했습니다.`);
  }
  return new AppError(ErrorCode.UNKNOWN, message || String(error));
}

export { validateUrl };
```

- [ ] **Step 3: Run tests**

Run: `bun test test/http.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/providers/http.ts test/http.test.ts
git commit -m "refactor: add providers/http with retry and error handling"
```

---

### Task 7: `src/providers/cache.ts` — Atomic file cache

**Files:**
- Create: `src/providers/cache.ts`
- Test: `test/cache.test.ts`

- [ ] **Step 1: Write cache tests**

```typescript
// test/cache.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { saveItems, loadItems, saveHistoryEntry, loadHistory } from "../src/providers/cache";
import type { NewsItem } from "../src/core/news-item";

const primaryCacheFile = path.join(os.homedir(), ".cache", "news-cli", "items.json");
const fallbackCacheFile = path.join(process.cwd(), ".news-cli-cache", "items.json");

let primaryBackup: string | null = null;
let fallbackBackup: string | null = null;

beforeAll(async () => {
  try { primaryBackup = await fs.readFile(primaryCacheFile, "utf8"); } catch {}
  try { fallbackBackup = await fs.readFile(fallbackCacheFile, "utf8"); } catch {}
});

afterAll(async () => {
  if (primaryBackup) {
    await fs.mkdir(path.dirname(primaryCacheFile), { recursive: true });
    await fs.writeFile(primaryCacheFile, primaryBackup);
  } else { await fs.rm(primaryCacheFile, { force: true }).catch(() => {}); }
  if (fallbackBackup) {
    await fs.mkdir(path.dirname(fallbackCacheFile), { recursive: true });
    await fs.writeFile(fallbackCacheFile, fallbackBackup);
  } else { await fs.rm(fallbackCacheFile, { force: true }).catch(() => {}); }
});

describe("cache", () => {
  test("can save and load items", async () => {
    const dummyItems: NewsItem[] = [{
      id: "abc", guid: "abc", title: "Test Item", link: "https://example.com", date: "2026-05-31T00:00:00Z", rawDate: "Sun, 31 May 2026 00:00:00 GMT", description: "Test", category: "latest", source: "newsapi-latest", sourceLabel: "NewsAPI", feedUrl: "https://newsapi.org", author: "", itemCategory: "", categories: ["latest"], sources: ["newsapi-latest"],
    }];
    await saveItems(dummyItems);
    const loaded = await loadItems();
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0]!.id).toBe("abc");
  });

  test("handles corrupt cache gracefully", async () => {
    await fs.mkdir(path.dirname(fallbackCacheFile), { recursive: true });
    await fs.writeFile(fallbackCacheFile, "{ corrupt json ... }");
    await fs.mkdir(path.dirname(primaryCacheFile), { recursive: true });
    await fs.writeFile(primaryCacheFile, "{ corrupt json ... }");
    const loaded = await loadItems();
    expect(loaded.items).toHaveLength(0);
  });

  test("can save and load history entries", async () => {
    await saveHistoryEntry({ timestamp: "2026-05-31T00:00:00Z", feedKey: "test", feedLabel: "Test", url: "https://example.com", status: "success", itemCount: 5 });
    const history = await loadHistory();
    const found = history.find((e) => e.feedKey === "test");
    expect(found).toBeDefined();
    expect(found!.itemCount).toBe(5);
  });
});
```

- [ ] **Step 2: Write the cache module**

```typescript
// src/providers/cache.ts
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { NewsItem } from "../core/news-item";

const PRIMARY_CACHE_DIR = path.join(os.homedir(), ".cache", "news-cli");
const FALLBACK_CACHE_DIR = path.join(process.cwd(), ".news-cli-cache");

type CachePayload = { savedAt: string; items: NewsItem[] };

type NodeError = Error & { code?: string };

export async function saveItems(items: NewsItem[]): Promise<void> {
  const payload = JSON.stringify({ savedAt: new Date().toISOString(), items }, null, 2);
  try { await atomicWriteCache(PRIMARY_CACHE_DIR, payload); }
  catch (error) {
    if (!canFallback(error)) throw error;
    await atomicWriteCache(FALLBACK_CACHE_DIR, payload);
  }
}

export async function loadItems(): Promise<CachePayload> {
  const primary = await readCache(PRIMARY_CACHE_DIR);
  if (primary) return primary;
  const fallback = await readCache(FALLBACK_CACHE_DIR);
  return fallback ?? { savedAt: "", items: [] };
}

async function atomicWriteCache(cacheDir: string, payload: string): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  const target = path.join(cacheDir, "items.json");
  const tmp = path.join(cacheDir, `.items-${process.pid}.tmp`);
  try {
    await fs.writeFile(tmp, payload);
    await fs.rename(tmp, target);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

async function readCache(cacheDir: string): Promise<CachePayload | null> {
  try {
    const raw = await fs.readFile(path.join(cacheDir, "items.json"), "utf8");
    return parseCachePayload(raw);
  } catch (error) {
    const nodeError = error as NodeError;
    if (nodeError.code === "ENOENT" || canFallback(nodeError)) return null;
    throw error;
  }
}

function parseCachePayload(raw: string): CachePayload | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.items)) return null;
    return parsed as CachePayload;
  } catch { return null; }
}

function canFallback(error: unknown): boolean {
  return ["EACCES", "EPERM", "EROFS", "ENOENT"].includes((error as NodeError).code ?? "");
}

export type HistoryEntry = {
  timestamp: string;
  feedKey: string;
  feedLabel: string;
  url: string;
  status: "success" | "failure";
  itemCount: number;
  errorMessage?: string;
};

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  const historyFile = path.join(PRIMARY_CACHE_DIR, "history.json");
  const fallbackFile = path.join(FALLBACK_CACHE_DIR, "history.json");
  let history: HistoryEntry[] = [];
  let targetFile = historyFile;
  let targetDir = PRIMARY_CACHE_DIR;

  try { await fs.mkdir(PRIMARY_CACHE_DIR, { recursive: true }); }
  catch (error) {
    if (canFallback(error)) { targetFile = fallbackFile; targetDir = FALLBACK_CACHE_DIR; await fs.mkdir(FALLBACK_CACHE_DIR, { recursive: true }); }
    else throw error;
  }

  try {
    const raw = await fs.readFile(targetFile, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) history = parsed as HistoryEntry[];
  } catch {}

  history.push(entry);
  if (history.length > 100) history = history.slice(-100);

  const tmp = path.join(targetDir, `.history-${process.pid}.tmp`);
  try {
    await fs.writeFile(tmp, JSON.stringify(history, null, 2));
    await fs.rename(tmp, targetFile);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await fs.readFile(path.join(PRIMARY_CACHE_DIR, "history.json"), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    try {
      const raw = await fs.readFile(path.join(FALLBACK_CACHE_DIR, "history.json"), "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
    } catch { return []; }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `bun test test/cache.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/providers/cache.ts test/cache.test.ts
git commit -m "refactor: add providers/cache with atomic writes"
```

---

### Task 8: `src/lib/logger.ts` and `src/lib/version.ts` — Utilities

**Files:**
- Create: `src/lib/logger.ts`
- Create: `src/lib/version.ts`

- [ ] **Step 1: Write logger tests**

```typescript
// test/logger.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { Logger } from "../src/lib/logger";

describe("Logger", () => {
  const logs: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origErr = console.error;

  beforeEach(() => {
    logs.length = 0;
    errors.length = 0;
    console.log = (...args) => logs.push(args.join(" "));
    console.error = (...args) => errors.push(args.join(" "));
  });

  test("info outputs to stdout", () => {
    const logger = new Logger({ json: false });
    logger.info("hello");
    expect(logs).toContain("hello");
  });

  test("warn outputs to stderr in human mode", () => {
    const logger = new Logger({ json: false });
    logger.warn("warning message");
    expect(errors).toContain("Warning: warning message");
  });

  test("warn is silent in JSON mode", () => {
    const logger = new Logger({ json: true });
    logger.warn("warning message");
    expect(errors).toHaveLength(0);
  });

  test("error always outputs to stderr", () => {
    const logger = new Logger({ json: true });
    logger.error("error message");
    expect(errors).toContain("Error: error message");
  });

  test("json mode outputs structured JSON", () => {
    const logger = new Logger({ json: true });
    logger.info("test");
    const parsed = JSON.parse(logs[0]!);
    expect(parsed).toHaveProperty("message", "test");
  });
});
```

- [ ] **Step 2: Write lib modules**

```typescript
// src/lib/version.ts
export const VERSION = "0.2.8";
```

```typescript
// src/lib/logger.ts
export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

type LoggerOptions = {
  json?: boolean;
  level?: LogLevel;
};

export class Logger {
  private readonly json: boolean;
  private readonly level: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.json = options.json ?? false;
    this.level = options.level ?? "info";
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
  }

  debug(message: string): void {
    if (!this.shouldLog("debug")) return;
    if (this.json) { console.error(JSON.stringify({ level: "debug", message })); }
    else { console.error(`[debug] ${message}`); }
  }

  info(message: string): void {
    if (!this.shouldLog("info")) return;
    if (this.json) { console.log(JSON.stringify({ level: "info", message })); }
    else { console.log(message); }
  }

  warn(message: string): void {
    if (!this.shouldLog("warn")) return;
    if (this.json) return; // warnings silent in JSON mode
    console.error(`Warning: ${message}`);
  }

  error(message: string): void {
    if (!this.shouldLog("error")) return;
    if (this.json) { console.error(JSON.stringify({ level: "error", message })); }
    else { console.error(`Error: ${message}`); }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `bun test test/logger.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/logger.ts src/lib/version.ts test/logger.test.ts
git commit -m "refactor: add lib/logger and lib/version"
```

---

### Task 9: `src/interfaces/cli/parser.ts` — CLI argument parser

**Files:**
- Create: `src/interfaces/cli/parser.ts`
- Create: `test/cli-parser.test.ts`

- [ ] **Step 1: Write parser tests**

```typescript
// test/cli-parser.test.ts
import { describe, expect, test } from "bun:test";
import { parseArgs } from "../src/interfaces/cli/parser";

describe("parseArgs", () => {
  test("parses basic command without options", () => {
    const { command, options, args } = parseArgs(["latest"]);
    expect(command).toBe("latest");
    expect(options.limit).toBe(30);
    expect(args).toEqual([]);
  });

  test("default command is latest", () => {
    const { command } = parseArgs([]);
    expect(command).toBe("latest");
  });

  test("parses limit option", () => {
    const { options } = parseArgs(["latest", "--limit", "15"]);
    expect(options.limit).toBe(15);
  });

  test("throws on non-integer limit", () => {
    expect(() => parseArgs(["latest", "--limit", "abc"])).toThrow();
  });

  test("parses search query and options", () => {
    const { command, args, options } = parseArgs(["search", "삼성전자", "--site", "mk.co.kr", "--limit", "10"]);
    expect(command).toBe("search");
    expect(args).toEqual(["삼성전자"]);
    expect(options.site).toBe("mk.co.kr");
    expect(options.limit).toBe(10);
  });

  test("parses exclude multiple times", () => {
    const { options } = parseArgs(["search", "foo", "--exclude", "bad", "--exclude", "worst"]);
    expect(options.exclude).toEqual(["bad", "worst"]);
  });

  test("parses --after and --before", () => {
    const { options } = parseArgs(["search", "test", "--after", "2026-05-01", "--before", "2026-05-28"]);
    expect(options.after).toBe("2026-05-01");
    expect(options.before).toBe("2026-05-28");
  });

  test("throws on unknown flag", () => {
    expect(() => parseArgs(["latest", "--foo-bar"])).toThrow();
  });

  test("parses --json, --timeout, --no-cache", () => {
    const { options } = parseArgs(["latest", "--json", "--timeout", "5000", "--no-cache"]);
    expect(options.json).toBeTrue();
    expect(options.timeoutMs).toBe(5000);
    expect(options.noCache).toBeTrue();
  });

  test("parses global --version vs upgrade --version", () => {
    expect(parseArgs(["--version"]).options.showVersion).toBeTrue();
    expect(parseArgs(["-V"]).options.showVersion).toBeTrue();
    const upgradeRes = parseArgs(["upgrade", "--version", "v0.3.0"]);
    expect(upgradeRes.command).toBe("upgrade");
    expect(upgradeRes.options.version).toBe("v0.3.0");
    expect(upgradeRes.options.showVersion).toBeFalse();
  });
});
```

- [ ] **Step 2: Write the parser module**

```typescript
// src/interfaces/cli/parser.ts
export type CliOptions = {
  category: string;
  limit: number;
  help: boolean;
  site: string;
  phrase: string;
  exclude: string[];
  after: string;
  before: string;
  sinceHours: number | undefined;
  version: string;
  installDir: string;
  skillDir: string;
  codexSkillDir: string;
  hermesSkillDir: string;
  json: boolean;
  timeoutMs: number | undefined;
  noCache: boolean;
  showVersion: boolean;
};

export type ParsedArgs = {
  command: string;
  options: CliOptions;
  args: string[];
  commandProvided: boolean;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const tokens = [...argv];
  let command = "latest";
  let commandProvided = false;
  const args: string[] = [];
  const options: CliOptions = {
    category: "latest", limit: 30, help: false, site: "", phrase: "",
    exclude: [], after: "", before: "", sinceHours: undefined,
    version: "latest", installDir: "", skillDir: "", codexSkillDir: "", hermesSkillDir: "",
    json: false, timeoutMs: undefined, noCache: false, showVersion: false,
  };

  if (tokens[0] && !tokens[0].startsWith("-")) {
    command = tokens.shift()!;
    commandProvided = true;
  }

  while (tokens.length > 0) {
    const token = tokens.shift()!;

    if (token === "--help" || token === "-h") options.help = true;
    else if (token === "--category" || token === "-c") options.category = requireValue(token, tokens.shift());
    else if (token.startsWith("--category=")) options.category = token.slice("--category=".length);
    else if (token === "--limit" || token === "-l") options.limit = parseLimit(requireValue(token, tokens.shift()));
    else if (token.startsWith("--limit=")) options.limit = parseLimit(token.slice("--limit=".length));
    else if (token === "--site") options.site = requireValue(token, tokens.shift());
    else if (token.startsWith("--site=")) options.site = token.slice("--site=".length);
    else if (token === "--phrase") options.phrase = requireValue(token, tokens.shift());
    else if (token.startsWith("--phrase=")) options.phrase = token.slice("--phrase=".length);
    else if (token === "--exclude") options.exclude.push(requireValue(token, tokens.shift()));
    else if (token.startsWith("--exclude=")) options.exclude.push(token.slice("--exclude=".length));
    else if (token === "--after" || token === "--from") options.after = parseDateFilter(requireValue(token, tokens.shift()));
    else if (token.startsWith("--after=")) options.after = parseDateFilter(token.slice("--after=".length));
    else if (token.startsWith("--from=")) options.after = parseDateFilter(token.slice("--from=".length));
    else if (token === "--before" || token === "--to") options.before = parseDateFilter(requireValue(token, tokens.shift()));
    else if (token.startsWith("--before=")) options.before = parseDateFilter(token.slice("--before=".length));
    else if (token.startsWith("--to=")) options.before = parseDateFilter(token.slice("--to=".length));
    else if (token === "--since-hours") options.sinceHours = parseSinceHours(requireValue(token, tokens.shift()));
    else if (token.startsWith("--since-hours=")) options.sinceHours = parseSinceHours(token.slice("--since-hours=".length));
    else if (token === "--version") {
      if (command === "upgrade") options.version = requireValue(token, tokens.shift());
      else options.showVersion = true;
    } else if (token.startsWith("--version=")) {
      if (command === "upgrade") options.version = token.slice("--version=".length);
      else options.showVersion = true;
    } else if (token === "--install-dir") options.installDir = requireValue(token, tokens.shift());
    else if (token.startsWith("--install-dir=")) options.installDir = token.slice("--install-dir=".length);
    else if (token === "--skill-dir") options.skillDir = requireValue(token, tokens.shift());
    else if (token.startsWith("--skill-dir=")) options.skillDir = token.slice("--skill-dir=".length);
    else if (token === "--codex-skill-dir") options.codexSkillDir = requireValue(token, tokens.shift());
    else if (token.startsWith("--codex-skill-dir=")) options.codexSkillDir = token.slice("--codex-skill-dir=".length);
    else if (token === "--hermes-skill-dir") options.hermesSkillDir = requireValue(token, tokens.shift());
    else if (token.startsWith("--hermes-skill-dir=")) options.hermesSkillDir = token.slice("--hermes-skill-dir=".length);
    else if (token === "--json") options.json = true;
    else if (token === "--timeout") options.timeoutMs = parseTimeout(requireValue(token, tokens.shift()));
    else if (token.startsWith("--timeout=")) options.timeoutMs = parseTimeout(token.slice("--timeout=".length));
    else if (token === "--no-cache") options.noCache = true;
    else if (token === "-V") options.showVersion = true;
    else if (token.startsWith("-")) throw new Error(`Unknown option "${token}". Run "news-cli --help".`);
    else args.push(token);
  }

  return { command, options, args, commandProvided };
}

function requireValue(option: string, value: string | undefined): string {
  if (!value || value.startsWith("-")) throw new Error(`Option "${option}" requires a value.`);
  return value;
}

function parseLimit(value: string): number {
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit <= 0) throw new Error(`Limit must be a positive integer. Received "${value}".`);
  return limit;
}

function parseDateFilter(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Date filters must use YYYY-MM-DD. Received "${value}".`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid date filter: "${value}".`);
  return value;
}

function parseSinceHours(value: string): number {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) throw new Error(`Since-hours must be a positive number. Received "${value}".`);
  return hours;
}

function parseTimeout(value: string): number {
  const ms = Number.parseInt(value, 10);
  if (!Number.isInteger(ms) || ms <= 0) throw new Error(`Timeout must be a positive integer (milliseconds). Received "${value}".`);
  return ms;
}
```

- [ ] **Step 3: Run tests**

Run: `bun test test/cli-parser.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/interfaces/cli/parser.ts test/cli-parser.test.ts
git commit -m "refactor: add interfaces/cli/parser"
```

---

### Task 10: `src/interfaces/cli/help.ts` — Help text

**Files:**
- Create: `src/interfaces/cli/help.ts`

- [ ] **Step 1: Write the help module**

```typescript
// src/interfaces/cli/help.ts
import { VERSION } from "../../lib/version";

export const HELP_TEXT = `news-cli

Usage:
  news-cli [latest] [--limit <n>] [--since-hours <n>] [--json] [--timeout <ms>]
  news-cli dart [--limit <n>] [--since-hours <n>] [--json] [--timeout <ms>]
  news-cli search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>] [--since-hours <n>] [--limit <n>] [--json] [--timeout <ms>]
  news-cli url search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>]
  news-cli categories
  news-cli detail <id-or-url> [--json]
  news-cli history [--limit <n>] [--json]
  news-cli upgrade [--version <tag>] [--install-dir <path>] [--skill-dir <path>] [--hermes-skill-dir <path>]
  news-cli help [topic]
  news-cli --version

Commands:
  latest        Fetch NewsAPI top headlines. Default command.
  dart          Fetch DART today disclosure RSS.
  search        Fetch NewsAPI search results.
  url search    Print the generated NewsAPI search URL.
  categories    Show fixed feeds and supported modes.
  detail        Show cached RSS details for a listed item.
  history       Show API call history log.
  upgrade       Upgrade the binary and install/update Codex and Hermes skills.
  help          Show general help or command-specific help.

Help topics:
  latest, dart, search, url, categories, detail, history, upgrade

Examples:
  news-cli
  news-cli latest --limit 20
  news-cli dart --limit 20
  news-cli latest --since-hours 3
  news-cli search 삼성전자 --limit 10
  news-cli search 삼성전자 --since-hours 6
  news-cli search 삼성전자 --after 2026-05-01 --before 2026-05-28
  news-cli search 선거 --site example.com --phrase "여론조사" --exclude 광고
  news-cli url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머
  news-cli detail 1a2b3c4d5e
  news-cli history
  news-cli upgrade
  news-cli upgrade --version v0.2.8
  news-cli help search
  news-cli help upgrade

NewsAPI:
  Top Headlines: https://newsapi.org/v2/top-headlines?country=kr
  Search (Everything): https://newsapi.org/v2/everything?q=(검색어)
  Requires NEWS_API_KEY environment variable.

DART RSS:
  Disclosures: https://dart.fss.or.kr/api/todayRSS.xml

Environment for upgrade:
  NEWS_CLI_BIN          Exact binary path to replace.
  NEWS_CLI_INSTALL_DIR  Default install directory when NEWS_CLI_BIN is unset.
  NEWS_CLI_SKILL_DIR         Backward-compatible default Codex skill directory.
  NEWS_CLI_CODEX_SKILL_DIR   Default Codex skill directory.
  NEWS_CLI_HERMES_SKILL_DIR  Default Hermes skill directory.
`;

export const COMMAND_HELP: Record<string, string> = {
  latest: [
    "news-cli latest",
    "",
    "Usage:",
    "  news-cli [latest] [--limit <n>] [--since-hours <n>]",
    "",
    "Fetches the NewsAPI top headlines.",
    "",
    "Options:",
    "  --limit, -l <n>     Number of items to print. Default: 30",
    "  --since-hours <n>   Only print RSS items published in the last N hours.",
    "",
    "Example:",
    "  news-cli latest --limit 20",
    "  news-cli latest --since-hours 3",
  ].join("\n"),

  dart: [
    "news-cli dart",
    "",
    "Usage:",
    "  news-cli dart [--limit <n>] [--since-hours <n>]",
    "  news-cli disclosure [--limit <n>] [--since-hours <n>]",
    "",
    "Fetches today's DART disclosure RSS feed.",
    "",
    "Options:",
    "  --limit, -l <n>     Number of disclosure items to print. Default: 30",
    "  --since-hours <n>   Only print RSS items published in the last N hours.",
    "",
    "Example:",
    "  news-cli dart --limit 20",
    "  news-cli dart --since-hours 6",
  ].join("\n"),

  search: [
    "news-cli search",
    "",
    "Usage:",
    "  news-cli search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>] [--since-hours <n>] [--limit <n>]",
    "",
    "Builds a NewsAPI search query and prints matching news.",
    "",
    "Options:",
    "  --site <domain>    Restrict results with site:<domain>.",
    "  --phrase <text>    Add an exact phrase wrapped in quotes.",
    "  --exclude <word>   Add an excluded word. Can be used multiple times.",
    "  --after <date>     Add from=YYYY-MM-DD to the NewsAPI query. Alias: --from",
    "  --before <date>    Add to=YYYY-MM-DD to the NewsAPI query. Alias: --to",
    "  --since-hours <n>  Only print RSS items published in the last N hours.",
    "  --limit, -l <n>    Number of items to print. Default: 30",
    "",
    "Examples:",
    "  news-cli search 삼성전자 --limit 10",
    "  news-cli search 삼성전자 --since-hours 6",
    "  news-cli search 삼성전자 --after 2026-05-01 --before 2026-05-28",
    "  news-cli search 선거 --site example.com --phrase \"여론조사\" --exclude 광고",
  ].join("\n"),

  url: [
    "news-cli url",
    "",
    "Usage:",
    "  news-cli url search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>]",
    "",
    "Prints the generated NewsAPI query and URL without fetching it.",
    "",
    "Example:",
    "  news-cli url search 반도체 --site mk.co.kr --phrase \"실적 전망\" --exclude 루머",
    "  news-cli url search 삼성전자 --after 2026-05-01 --before 2026-05-28",
  ].join("\n"),

  categories: [
    "news-cli categories",
    "",
    "Usage:",
    "  news-cli categories",
    "",
    "Shows the fixed NewsAPI feed and supported modes.",
  ].join("\n"),

  detail: [
    "news-cli detail",
    "",
    "Usage:",
    "  news-cli detail <id-or-url>",
    "",
    "Shows the cached RSS details for an item from the last latest/search command.",
    "",
    "Example:",
    "  news-cli detail 1a2b3c4d5e",
  ].join("\n"),

  history: [
    "news-cli history",
    "",
    "Usage:",
    "  news-cli history [--limit <n>] [--json]",
    "",
    "Shows the history of API requests made to NewsAPI and DART RSS.",
    "",
    "Options:",
    "  --limit, -l <n>     Number of history entries to print. Default: 20",
    "  --json              Output history in JSON format.",
    "",
    "Example:",
    "  news-cli history --limit 10",
  ].join("\n"),

  upgrade: [
    "news-cli upgrade",
    "",
    "Usage:",
    "  news-cli upgrade [--version <tag>] [--install-dir <path>] [--skill-dir <path>] [--hermes-skill-dir <path>]",
    "",
    "Downloads the latest GitHub Release binary for this OS/architecture and installs the bundled Codex and Hermes skills.",
    "",
    "Work performed:",
    "  1. Selects the release asset for the current OS/architecture.",
    "  2. Downloads the standalone binary with progress output.",
    "  3. Replaces the installed news-cli binary.",
    "  4. Downloads and installs the Codex and Hermes SKILL.md files.",
    "",
    "Options:",
    "  --version <tag>          Release tag to install. Default: latest",
    "  --install-dir <path>     Install directory for news-cli. Default: current binary path, or ~/.local/bin",
    "  --skill-dir <path>       Backward-compatible Codex skill directory. Default: ~/.codex/skills/news-cli",
    "  --codex-skill-dir <path> Codex skill directory.",
    "  --hermes-skill-dir <path> Hermes skill directory. Default: ~/.hermes/skills/news-cli",
    "",
    "Environment:",
    "  NEWS_CLI_BIN          Exact binary path to replace.",
    "  NEWS_CLI_INSTALL_DIR  Default install directory when NEWS_CLI_BIN is unset.",
    "  NEWS_CLI_SKILL_DIR          Backward-compatible default Codex skill directory.",
    "  NEWS_CLI_CODEX_SKILL_DIR    Default Codex skill directory.",
    "  NEWS_CLI_HERMES_SKILL_DIR   Default Hermes skill directory.",
    "",
    "Example:",
    "  news-cli upgrade",
    "  news-cli upgrade --version v0.2.8",
  ].join("\n"),
};

export function getHelpText(args: string[]): string {
  const firstArg = args[0];
  if (args.length === 0 || firstArg === undefined) return HELP_TEXT;
  const key = normalizeHelpCommand(firstArg);
  const text = COMMAND_HELP[key];
  if (!text) throw new Error(`Unknown help topic "${args.join(" ")}". Run "news-cli help".`);
  return text;
}

function normalizeHelpCommand(command: string): string {
  if (command === "list") return "latest";
  if (command === "disclosure") return "dart";
  return command;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/interfaces/cli/help.ts
git commit -m "refactor: add interfaces/cli/help"
```

---

### Task 11: `src/interfaces/cli/formatter.ts` — Output formatter

**Files:**
- Create: `src/interfaces/cli/formatter.ts`

- [ ] **Step 1: Write formatter tests**

```typescript
// test/cli-formatter.test.ts
import { describe, expect, test } from "bun:test";
import { formatListItem, formatDetail, formatHistory, formatCategories, formatJson } from "../src/interfaces/cli/formatter";
import type { NewsItem } from "../src/core/news-item";
import type { HistoryEntry } from "../src/providers/cache";
import type { Feed } from "../src/core/feed";

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return { id: "abc123", guid: "", title: "Title", link: "https://example.com", date: "2026-05-31T00:00:00Z", rawDate: "2026-05-31T00:00:00Z", description: "Desc", category: "latest", source: "test", sourceLabel: "Test", feedUrl: "", author: "", itemCategory: "", categories: [], sources: [], ...overrides };
}

test("formatListItem includes id, category, source, date, title", () => {
  const item = makeItem();
  const result = formatListItem(item);
  expect(result).toContain("abc123");
  expect(result).toContain("Title");
  expect(result).toContain("https://example.com");
});

test("formatDetail includes all fields", () => {
  const item = makeItem({ author: "Reporter", description: "Long description" });
  const result = formatDetail(item);
  expect(result).toContain("Reporter");
  expect(result).toContain("Long description");
});

test("formatHistory formats entries", () => {
  const entries: HistoryEntry[] = [{ timestamp: "2026-05-31T00:00:00Z", feedKey: "test", feedLabel: "Test", url: "https://example.com", status: "success", itemCount: 5 }];
  const result = formatHistory(entries);
  expect(result).toContain("success");
  expect(result).toContain("5 items");
});

test("formatCategories lists feeds", () => {
  const feeds: Feed[] = [{ key: "test", category: "latest", label: "Test", url: "https://example.com", type: "newsapi" }];
  const result = formatCategories(feeds, ["latest"]);
  expect(result).toContain("test");
});

test("formatJson outputs structured JSON", () => {
  const items = [makeItem()];
  const result = JSON.parse(formatJson(items, [], { total: 1, showing: 1 }));
  expect(result.ok).toBe(true);
  expect(result.items).toHaveLength(1);
});

test("formatJson includes errors when present", () => {
  const result = JSON.parse(formatJson([], ["Fetch failed"], { total: 0, showing: 0 }));
  expect(result.ok).toBe(false);
  expect(result.errors).toContain("Fetch failed");
});
```

- [ ] **Step 2: Write the formatter module**

```typescript
// src/interfaces/cli/formatter.ts
import type { NewsItem } from "../../core/news-item";
import type { HistoryEntry } from "../../providers/cache";
import type { Feed } from "../../core/feed";
import type { Logger } from "../../lib/logger";

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(date);
}

function truncate(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3)}...`;
}

export function formatListItem(item: NewsItem): string {
  const date = formatDate(item.date || item.rawDate);
  const meta = [item.id, item.category, item.source, date].filter(Boolean).join(" | ");
  const summary = item.description ? `\n  ${truncate(item.description, 160)}` : "";
  return `[${meta}]\n${item.title}${summary}\n${item.link ?? ""}\n`;
}

export function formatDetail(item: NewsItem): string {
  return [
    item.title, "",
    `ID: ${item.id}`,
    `Source: ${item.sourceLabel} (${item.source})`,
    `Category: ${item.category}`,
    item.date || item.rawDate ? `Date: ${formatDate(item.date || item.rawDate)}` : "",
    item.author ? `Author: ${item.author}` : "",
    item.itemCategory ? `Item category: ${item.itemCategory}` : "",
    item.feedUrl ? `Feed: ${item.feedUrl}` : "",
    item.link ? `Link: ${item.link}` : "", "",
    item.description || "(No description in feed.)",
  ].filter(Boolean).join("\n");
}

export function formatHistory(entries: HistoryEntry[]): string {
  return entries.map((entry) => {
    const statusStr = entry.status === "success" ? `success (${entry.itemCount} items)` : "failure (0 items)";
    return [`[${entry.timestamp}] ${entry.feedKey} (${entry.feedLabel}) - ${statusStr}`, `  URL: ${entry.url}`, entry.errorMessage ? `  Error: ${entry.errorMessage}` : ""].filter(Boolean).join("\n");
  }).join("\n\n");
}

export function formatCategories(feeds: Feed[], categories: string[]): string {
  const feedLines = feeds.map((f) => `  ${f.key} (${f.category}) - ${f.label}\n    ${f.url}`);
  const catLines = categories.map((c) => `  ${c}`);
  return `Feeds:\n${feedLines.join("\n")}\n\nModes:\n${catLines.join("\n")}`;
}

export type JsonOutputMeta = { total: number; showing: number };

export function formatJson(items: NewsItem[], errors: string[], meta: JsonOutputMeta): string {
  return JSON.stringify({
    ok: errors.length === 0,
    total: meta.total,
    showing: meta.showing,
    errors: errors.length > 0 ? errors : undefined,
    items,
  }, null, 2);
}

export function printItems(
  items: NewsItem[],
  errors: string[],
  options: { limit: number; json: boolean; noCache?: boolean },
  logger: Logger,
  saveCache: (items: NewsItem[]) => Promise<void>,
): Promise<void> {
  const visibleItems = items.slice(0, options.limit);

  if (!options.noCache) {
    await saveCache(items);
  }

  if (options.json) {
    logger.info(formatJson(items, errors, { total: items.length, showing: visibleItems.length }));
    return;
  }

  if (errors.length > 0) {
    logger.warn(`${errors.length} feed(s) failed: ${errors.join("; ")}`);
  }

  if (visibleItems.length === 0) {
    logger.info("No news items found.");
    return;
  }

  for (const item of visibleItems) {
    logger.info(formatListItem(item));
  }
}
```

Wait — the `printItems` function is async and calls `saveCache`. This mixes concerns. Let me make it synchronous and have the caller handle the cache save. That's cleaner.

Let me fix the formatter to be pure output formatting only:

```typescript
// src/interfaces/cli/formatter.ts (corrected — async removed, no I/O)
import type { NewsItem } from "../../core/news-item";
import type { HistoryEntry } from "../../providers/cache";
import type { Feed } from "../../core/feed";

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(date);
}

function truncate(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3)}...`;
}

export function formatListItem(item: NewsItem): string {
  const date = formatDate(item.date || item.rawDate);
  const meta = [item.id, item.category, item.source, date].filter(Boolean).join(" | ");
  const summary = item.description ? `\n  ${truncate(item.description, 160)}` : "";
  return `[${meta}]\n${item.title}${summary}\n${item.link ?? ""}\n`;
}

export function formatDetail(item: NewsItem): string {
  return [
    item.title, "",
    `ID: ${item.id}`,
    `Source: ${item.sourceLabel} (${item.source})`,
    `Category: ${item.category}`,
    item.date || item.rawDate ? `Date: ${formatDate(item.date || item.rawDate)}` : "",
    item.author ? `Author: ${item.author}` : "",
    item.itemCategory ? `Item category: ${item.itemCategory}` : "",
    item.feedUrl ? `Feed: ${item.feedUrl}` : "",
    item.link ? `Link: ${item.link}` : "", "",
    item.description || "(No description in feed.)",
  ].filter(Boolean).join("\n");
}

export function formatHistory(entries: HistoryEntry[]): string {
  return entries.map((entry) => {
    const statusStr = entry.status === "success" ? `success (${entry.itemCount} items)` : "failure (0 items)";
    return [`[${entry.timestamp}] ${entry.feedKey} (${entry.feedLabel}) - ${statusStr}`, `  URL: ${entry.url}`, entry.errorMessage ? `  Error: ${entry.errorMessage}` : ""].filter(Boolean).join("\n");
  }).join("\n\n");
}

export function formatCategories(feeds: Feed[], categories: string[]): string {
  const feedLines = feeds.map((f) => `  ${f.key} (${f.category}) - ${f.label}\n    ${f.url}`);
  const catLines = categories.map((c) => `  ${c}`);
  return `Feeds:\n${feedLines.join("\n")}\n\nModes:\n${catLines.join("\n")}`;
}

export type JsonOutputMeta = { total: number; showing: number };

export function formatJson(items: NewsItem[], errors: string[], meta: JsonOutputMeta): string {
  return JSON.stringify({
    ok: errors.length === 0,
    total: meta.total,
    showing: meta.showing,
    errors: errors.length > 0 ? errors : undefined,
    items,
  }, null, 2);
}
```

- [ ] **Step 2: Run tests**

Run: `bun test test/cli-formatter.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/interfaces/cli/formatter.ts test/cli-formatter.test.ts
git commit -m "refactor: add interfaces/cli/formatter"
```

---

### Task 12: `src/interfaces/cli/router.ts` — CLI command router

**Files:**
- Create: `src/interfaces/cli/router.ts`
- Update: `bin/news-cli.ts`
- Update: `src/upgrade.ts` (import paths only)

- [ ] **Step 1: Write the router module**

```typescript
// src/interfaces/cli/router.ts
import { parseArgs, type CliOptions, type ParsedArgs } from "./parser";
import { getHelpText, HELP_TEXT } from "./help";
import {
  formatListItem, formatDetail, formatHistory, formatCategories, formatJson,
} from "./formatter";
import { Logger } from "../../lib/logger";
import { VERSION } from "../../lib/version";
import { feeds, getCategories, createSearchFeed, buildSearchQuery, buildSearchUrl, selectFeeds } from "../../core/feed";
import { fetchFeed } from "../../providers/http";
import { saveItems, loadItems, loadHistory, saveHistoryEntry } from "../../providers/cache";
import { selfUpgrade } from "../../upgrade";
import type { NewsItem } from "../../core/news-item";

export async function run(argv: string[]): Promise<void> {
  const { command, options, args, commandProvided } = parseArgs(argv);
  const logger = new Logger({ json: options.json });

  if (options.showVersion) {
    logger.info(`news-cli ${VERSION}`);
    return;
  }

  if (command === "help") {
    logger.info(getHelpText(args));
    return;
  }

  if (options.help) {
    logger.info(commandProvided ? getHelpText([command]) : HELP_TEXT);
    return;
  }

  if (command === "categories") {
    logger.info(formatCategories(feeds, getCategories()));
    return;
  }

  if (command === "detail") {
    await printDetail(args[0], options, logger);
    return;
  }

  if (command === "history") {
    await printHistory(options, logger);
    return;
  }

  if (command === "upgrade") {
    await runSelfUpgrade(options, logger);
    return;
  }

  if (command === "url") {
    printUrl(args, options, logger);
    return;
  }

  if (command === "search") {
    await printSearch(args, options, logger);
    return;
  }

  if (command === "dart" || command === "disclosure") {
    await printList({ ...options, category: "disclosure" }, logger);
    return;
  }

  if (command !== "latest" && command !== "list") {
    throw new Error(`Unknown command "${command}". Run "news-cli --help".`);
  }

  await printList(options, logger);
}

async function printList(options: CliOptions, logger: Logger): Promise<void> {
  const feeds = selectFeeds(options.category === "disclosure" ? "dart" : options.category);
  const errors: string[] = [];
  const allItems: NewsItem[] = [];

  for (const feed of feeds) {
    try {
      const items = await fetchFeed(feed, {
        timeoutMs: options.timeoutMs,
      });
      allItems.push(...items);
      await saveHistoryEntry({
        timestamp: new Date().toISOString(),
        feedKey: feed.key,
        feedLabel: feed.label,
        url: feed.url,
        status: "success",
        itemCount: items.length,
      }).catch(() => {});
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      await saveHistoryEntry({
        timestamp: new Date().toISOString(),
        feedKey: feed.key,
        feedLabel: feed.label,
        url: feed.url,
        status: "failure",
        itemCount: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
      }).catch(() => {});
    }
  }

  allItems.sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;
    return bTime - aTime;
  });

  await printOutput(allItems, errors, options, logger);
}

async function printSearch(args: string[], options: CliOptions, logger: Logger): Promise<void> {
  const feed = createSearchFeed({
    query: args.join(" "),
    site: options.site,
    phrase: options.phrase,
    exclude: options.exclude,
    after: options.after,
    before: options.before,
  });

  const errors: string[] = [];
  let allItems: NewsItem[] = [];

  try {
    allItems = await fetchFeed(feed, { timeoutMs: options.timeoutMs });
    await saveHistoryEntry({
      timestamp: new Date().toISOString(),
      feedKey: feed.key,
      feedLabel: feed.label,
      url: feed.url,
      status: "success",
      itemCount: allItems.length,
    }).catch(() => {});
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    await saveHistoryEntry({
      timestamp: new Date().toISOString(),
      feedKey: feed.key,
      feedLabel: feed.label,
      url: feed.url,
      status: "failure",
      itemCount: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    }).catch(() => {});
  }

  await printOutput(allItems, errors, options, logger);
}

async function printOutput(
  items: NewsItem[],
  errors: string[],
  options: CliOptions,
  logger: Logger,
): Promise<void> {
  const visibleItems = items.slice(0, options.limit);

  if (!options.noCache) {
    await saveItems(items);
  }

  if (options.json) {
    logger.info(formatJson(items, errors, { total: items.length, showing: visibleItems.length }));
    return;
  }

  if (errors.length > 0) {
    logger.warn(`${errors.length} feed(s) failed: ${errors.join("; ")}`);
  }

  if (visibleItems.length === 0) {
    logger.info("No news items found.");
    return;
  }

  for (const item of visibleItems) {
    logger.info(formatListItem(item));
  }
}

function printUrl(args: string[], options: CliOptions, logger: Logger): void {
  const subcommand = args.shift();
  if (subcommand !== "search") throw new Error('Only "news-cli url search ..." is supported.');

  const query = args.join(" ");
  const searchOptions = { query, site: options.site, phrase: options.phrase, exclude: options.exclude, after: options.after, before: options.before };
  logger.info(`Query: ${buildSearchQuery(searchOptions)}`);
  logger.info(`URL: ${buildSearchUrl(searchOptions)}`);
}

async function printDetail(idOrUrl: string | undefined, options: CliOptions, logger: Logger): Promise<void> {
  if (!idOrUrl) throw new Error("detail requires an item id or URL. Run latest/search first to populate the local cache.");

  const cache = await loadItems();
  const item = cache.items.find((candidate) => candidate.id === idOrUrl || candidate.link === idOrUrl || candidate.guid === idOrUrl);

  if (!item) throw new Error(`Could not find "${idOrUrl}" in the local cache. Run "news-cli latest" or "news-cli search <query>" first, then use an id from the output.`);

  if (options.json) {
    logger.info(JSON.stringify(item, null, 2));
    return;
  }

  logger.info(formatDetail(item));
}

async function printHistory(options: CliOptions, logger: Logger): Promise<void> {
  const history = await loadHistory();
  const sorted = [...history].reverse().slice(0, options.limit);

  if (options.json) {
    logger.info(JSON.stringify(sorted, null, 2));
    return;
  }

  if (sorted.length === 0) {
    logger.info("No API call history found.");
    return;
  }

  logger.info(formatHistory(sorted));
}

async function runSelfUpgrade(options: CliOptions, logger: Logger): Promise<void> {
  const result = await selfUpgrade({
    version: options.version,
    installDir: options.installDir,
    skillDir: options.skillDir,
    codexSkillDir: options.codexSkillDir,
    hermesSkillDir: options.hermesSkillDir,
    onProgress: (message) => console.error(message),
  });

  logger.info(`Installed news-cli (${result.version}) to ${result.binaryPath}`);
  for (const skillPath of result.skillPaths) {
    logger.info(`Installed skill to ${skillPath}`);
  }
}
```

- [ ] **Step 2: Update `bin/news-cli.ts` to use new router**

```typescript
// bin/news-cli.ts
#!/usr/bin/env bun

import { run } from "../src/interfaces/cli/router";
import { Logger } from "../src/lib/logger";

run(process.argv.slice(2)).catch((error) => {
  const logger = new Logger({ json: process.argv.includes("--json") });
  logger.error(error.message);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Update `src/upgrade.ts` import paths**

In `src/upgrade.ts`, change:
- `import { getEnv } from "./env"` → `import { getEnv } from "./providers/config"`
- `import { validateUrl } from "./url"` → `import { validateUrl } from "./providers/http"`
- `import { VERSION } from "./version"` → `import { VERSION } from "./lib/version"`

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: PASS (tests that only work with specific setup may need updates)

- [ ] **Step 5: Commit**

```bash
git add src/interfaces/cli/router.ts bin/news-cli.ts src/upgrade.ts test/
git commit -m "refactor: add interfaces/cli/router and update entry points"
```

---

### Task 13: `src/interfaces/hermes/news.ts` — Hermes agent tools

**Files:**
- Create: `src/interfaces/hermes/news.ts`

- [ ] **Step 1: Write Hermes tools module**

```typescript
// src/interfaces/hermes/news.ts
import { fetchFeed } from "../../providers/http";
import { saveItems, loadItems } from "../../providers/cache";
import { createSearchFeed, buildSearchQuery, buildSearchUrl, selectFeeds } from "../../core/feed";
import { type NewsItem } from "../../core/news-item";
import { Logger } from "../../lib/logger";

const logger = new Logger({ json: true });

type ToolResult = {
  ok: boolean;
  items: NewsItem[];
  showing: number;
  total: number;
  errors?: string[];
};

function emitResult(result: ToolResult): void {
  logger.info(JSON.stringify(result));
}

export async function news_latest(options: { limit?: number; sinceHours?: number } = {}): Promise<void> {
  try {
    const feed = selectFeeds("latest")[0]!;
    const items = await fetchFeed(feed);
    const sliced = items.slice(0, options.limit ?? 30);
    await saveItems(items);
    emitResult({ ok: true, items: sliced, showing: sliced.length, total: items.length });
  } catch (error) {
    emitResult({ ok: false, items: [], showing: 0, total: 0, errors: [error instanceof Error ? error.message : String(error)] });
  }
}

export async function news_search(options: {
  query: string; site?: string; phrase?: string; exclude?: string[];
  after?: string; before?: string; sinceHours?: number; limit?: number;
}): Promise<void> {
  try {
    const feed = createSearchFeed({
      query: options.query, site: options.site, phrase: options.phrase,
      exclude: options.exclude, after: options.after, before: options.before,
    });
    const items = await fetchFeed(feed);
    const sliced = items.slice(0, options.limit ?? 30);
    await saveItems(items);
    emitResult({ ok: true, items: sliced, showing: sliced.length, total: items.length });
  } catch (error) {
    emitResult({ ok: false, items: [], showing: 0, total: 0, errors: [error instanceof Error ? error.message : String(error)] });
  }
}

export async function news_dart(options: { limit?: number; sinceHours?: number } = {}): Promise<void> {
  try {
    const feed = selectFeeds("dart")[0]!;
    const items = await fetchFeed(feed);
    const sliced = items.slice(0, options.limit ?? 30);
    await saveItems(items);
    emitResult({ ok: true, items: sliced, showing: sliced.length, total: items.length });
  } catch (error) {
    emitResult({ ok: false, items: [], showing: 0, total: 0, errors: [error instanceof Error ? error.message : String(error)] });
  }
}

export async function news_detail(options: { idOrUrl: string }): Promise<void> {
  try {
    const cache = await loadItems();
    const item = cache.items.find(
      (candidate) => candidate.id === options.idOrUrl || candidate.link === options.idOrUrl || candidate.guid === options.idOrUrl,
    );
    if (!item) {
      emitResult({ ok: false, items: [], showing: 0, total: 0, errors: [`Item "${options.idOrUrl}" not found in cache. Run news_latest or news_search first.`] });
      return;
    }
    emitResult({ ok: true, items: [item], showing: 1, total: 1 });
  } catch (error) {
    emitResult({ ok: false, items: [], showing: 0, total: 0, errors: [error instanceof Error ? error.message : String(error)] });
  }
}

export function news_search_url(options: {
  query?: string; site?: string; phrase?: string; exclude?: string[];
  after?: string; before?: string;
}): void {
  try {
    const url = buildSearchUrl(options);
    const query = buildSearchQuery(options);
    logger.info(JSON.stringify({ ok: true, query, url }));
  } catch (error) {
    logger.info(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/interfaces/hermes/news.ts
git commit -m "refactor: add interfaces/hermes for Hermes agent tools"
```

---

### Task 14: Remove old files and update test imports

**Files:**
- Delete: `src/cli.ts`, `src/news.ts`, `src/feeds.ts`, `src/env.ts`, `src/url.ts`, `src/logger.ts`, `src/version.ts`, `src/cache.ts`, `src/xml.ts`
- Update: `test/integration.test.ts`, `test/e2e.test.ts`, standalone `test/xml.test.ts` (already rewritten)

- [ ] **Step 1: Delete old source files**

```bash
git rm src/cli.ts src/news.ts src/feeds.ts src/env.ts src/url.ts src/logger.ts src/version.ts src/cache.ts src/xml.ts
```

- [ ] **Step 2: Update test imports in `test/integration.test.ts`**

Change imports:
- `import { getEnv } from "../src/env.ts"` → `import { getEnv } from "../src/providers/config"`
- `import { createSearchFeed } from "../src/feeds.ts"` → `import { createSearchFeed } from "../src/core/feed"`
- `import { collectNews } from "../src/news.ts"` → remove, replace with direct `fetchFeed`

The integration test needs to be rewritten to use the new API:

```typescript
// test/integration.test.ts
import { describe, expect, test } from "bun:test";
import { getEnv } from "../src/providers/config";
import { createSearchFeed, selectFeeds } from "../src/core/feed";
import { fetchFeed } from "../src/providers/http";

describe("real API integration tests", () => {
  test("DART RSS fetch (no API key required)", async () => {
    const feed = selectFeeds("dart")[0]!;
    const items = await fetchFeed(feed);
    expect(Array.isArray(items)).toBe(true);
  });

  test("NewsAPI top headlines fetch (requires NEWS_API_KEY)", async () => {
    const apiKey = getEnv("NEWS_API_KEY") || getEnv("NEWSAPI_KEY");
    if (!apiKey) return; // skip

    const feed = selectFeeds("latest")[0]!;
    const items = await fetchFeed(feed);
    expect(Array.isArray(items)).toBe(true);
    if (items.length > 0) {
      expect(items[0]!.title).toBeTruthy();
      expect(items[0]!.link).toBeTruthy();
    }
  });

  test("NewsAPI search fetch (requires NEWS_API_KEY)", async () => {
    const apiKey = getEnv("NEWS_API_KEY") || getEnv("NEWSAPI_KEY");
    if (!apiKey) return;

    const feed = createSearchFeed({ query: "news" });
    const items = await fetchFeed(feed);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]!.title).toBeTruthy();
  });
});
```

- [ ] **Step 3: Update e2e test**

```typescript
// test/e2e.test.ts (update import paths)
// Change: import { run } from "../src/cli" → import { run } from "../src/interfaces/cli/router"
// No other changes needed — the CLI interface is identical
```

- [ ] **Step 4: Delete obsolete test files**

```bash
# test/xml.test.ts was already overwritten in Task 4
# test/unit.test.ts — tests are now in test/cache.test.ts, test/config.test.ts, etc.
# Keep test/unit.test.ts but update its imports, or delete it since tests are redistributed
```

- [ ] **Step 5: Run all tests**

Run: `bun test`
Expected: PASS

- [ ] **Step 6: Run lint and typecheck**

Run: `bun run lint && bun run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy files, update test imports"
```
