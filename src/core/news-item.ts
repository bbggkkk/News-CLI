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
	const sourceId =
		item.guid || item.link || `${feed.key}:${item.title}:${item.pubDate}`;
	const id = crypto
		.createHash("sha1")
		.update(sourceId)
		.digest("hex")
		.slice(0, 10);
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
	const a =
		typeof article === "object" && article !== null
			? (article as NewsApiArticle)
			: {};
	const title = safeString(a.title) || "(untitled)";
	const url = safeString(a.url);
	const publishedAt = safeString(a.publishedAt);
	const description = safeString(a.description);
	const author = safeString(a.author);
	let sourceName = "";
	if (
		typeof a.source === "object" &&
		a.source !== null &&
		!Array.isArray(a.source)
	) {
		sourceName = safeString((a.source as { name?: unknown }).name);
	}
	const date = normalizeDate(publishedAt);
	const sourceId = url || `${feed.key}:${title}:${publishedAt}`;
	const id = crypto
		.createHash("sha1")
		.update(sourceId)
		.digest("hex")
		.slice(0, 10);
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
		if (!existing.categories.includes(item.category))
			existing.categories.push(item.category);
		if (!existing.sources.includes(item.source))
			existing.sources.push(item.source);
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
