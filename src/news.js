import crypto from "node:crypto";
import { feeds, selectFeeds } from "./feeds.js";
import { parseRss } from "./xml.js";

const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchFeed(feed, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
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

export async function collectNews({ category = "all", timeoutMs } = {}) {
  const selectedFeeds = selectFeeds(category);
  const results = await Promise.allSettled(
    selectedFeeds.map(async (feed) => ({
      feed,
      items: await fetchFeed(feed, { timeoutMs })
    }))
  );

  const errors = [];
  const items = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      items.push(...result.value.items);
    } else {
      errors.push(result.reason.message);
    }
  }

  const uniqueItems = dedupeItems(items);

  uniqueItems.sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;
    return bTime - aTime;
  });

  return { items: uniqueItems, errors };
}

export function normalizeItem(item, feed) {
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
    itemCategory: item.category
  };
}

export function dedupeItems(items) {
  const byId = new Map();

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

export function normalizeDate(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

export function findFeed(key) {
  return feeds.find((feed) => feed.key === key);
}
