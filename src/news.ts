import crypto from "node:crypto";
import { selectFeeds, type Feed } from "./feeds";
import { parseRss, type RssItem } from "./xml";

const DEFAULT_TIMEOUT_MS = 10_000;

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

export type CollectNewsOptions = {
  category?: string;
  feed?: Feed;
  timeoutMs?: number;
  sinceHours?: number;
};

export async function fetchFeed(feed: Feed, { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {}): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(feed.url, {
      headers: {
        "accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "user-agent": "news-cli/0.1.0"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    return parseRss(xml).map((item) => normalizeItem(item, feed));
  } finally {
    clearTimeout(timer);
  }
}

export async function collectNews({ category = "latest", feed, timeoutMs, sinceHours }: CollectNewsOptions = {}): Promise<{ items: NewsItem[]; errors: string[] }> {
  const selectedFeeds = feed ? [feed] : selectFeeds(category);
  const results = await Promise.allSettled(
    selectedFeeds.map(async (feed) => ({
      feed,
      items: await fetchFeed(feed, { timeoutMs })
    }))
  );

  const errors: string[] = [];
  const items: NewsItem[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      items.push(...result.value.items);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  const uniqueItems = filterItemsBySinceHours(dedupeItems(items), sinceHours);

  uniqueItems.sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;
    return bTime - aTime;
  });

  return { items: uniqueItems, errors };
}

export function normalizeItem(item: RssItem, feed: Feed): NewsItem {
  const date = normalizeDate(item.pubDate);
  const sourceId = item.guid || item.link || `${feed.key}:${item.title}:${item.pubDate}`;
  const id = crypto.createHash("sha1").update(sourceId).digest("hex").slice(0, 10);

  return {
    id,
    guid: item.guid,
    title: item.title || "(untitled)",
    link: item.link,
    date,
    rawDate: item.pubDate,
    description: item.description,
    category: feed.category,
    source: feed.key,
    sourceLabel: feed.label,
    feedUrl: feed.url,
    author: item.author,
    itemCategory: item.category,
    categories: [feed.category],
    sources: [feed.key]
  };
}

export function dedupeItems(items: NewsItem[]): NewsItem[] {
  const byId = new Map<string, NewsItem>();

  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, {
        ...item,
        categories: [item.category],
        sources: [item.source]
      });
      continue;
    }

    if (!existing.categories.includes(item.category)) {
      existing.categories.push(item.category);
    }
    if (!existing.sources.includes(item.source)) {
      existing.sources.push(item.source);
    }

    existing.category = existing.categories.join(",");
    existing.source = existing.sources.join(",");
  }

  return [...byId.values()];
}

export function filterItemsBySinceHours(items: NewsItem[], sinceHours?: number, now = Date.now()): NewsItem[] {
  if (!sinceHours) {
    return items;
  }

  const cutoff = now - sinceHours * 60 * 60 * 1000;
  return items.filter((item) => {
    const timestamp = item.date ? new Date(item.date).getTime() : 0;
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

export function normalizeDate(value?: string): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}
