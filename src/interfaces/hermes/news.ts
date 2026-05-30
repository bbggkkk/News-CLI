// src/interfaces/hermes/news.ts

import {
	buildSearchQuery,
	buildSearchUrl,
	createSearchFeed,
	selectFeeds,
} from "../../core/feed";
import type { NewsItem } from "../../core/news-item";
import { Logger } from "../../lib/logger";
import { loadItems, saveItems } from "../../providers/cache";
import { fetchFeed } from "../../providers/http";

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

export async function news_latest(
	options: { limit?: number; sinceHours?: number } = {},
): Promise<void> {
	try {
		const feed = selectFeeds("latest")[0]!;
		const items = await fetchFeed(feed);
		const sliced = items.slice(0, options.limit ?? 30);
		await saveItems(items);
		emitResult({
			ok: true,
			items: sliced,
			showing: sliced.length,
			total: items.length,
		});
	} catch (error) {
		emitResult({
			ok: false,
			items: [],
			showing: 0,
			total: 0,
			errors: [error instanceof Error ? error.message : String(error)],
		});
	}
}

export async function news_search(options: {
	query: string;
	site?: string;
	phrase?: string;
	exclude?: string[];
	after?: string;
	before?: string;
	sinceHours?: number;
	limit?: number;
}): Promise<void> {
	try {
		const feed = createSearchFeed({
			query: options.query,
			...(options.site !== undefined ? { site: options.site } : {}),
			...(options.phrase !== undefined ? { phrase: options.phrase } : {}),
			...(options.exclude !== undefined ? { exclude: options.exclude } : {}),
			...(options.after !== undefined ? { after: options.after } : {}),
			...(options.before !== undefined ? { before: options.before } : {}),
		});
		const items = await fetchFeed(feed);
		const sliced = items.slice(0, options.limit ?? 30);
		await saveItems(items);
		emitResult({
			ok: true,
			items: sliced,
			showing: sliced.length,
			total: items.length,
		});
	} catch (error) {
		emitResult({
			ok: false,
			items: [],
			showing: 0,
			total: 0,
			errors: [error instanceof Error ? error.message : String(error)],
		});
	}
}

export async function news_dart(
	options: { limit?: number; sinceHours?: number } = {},
): Promise<void> {
	try {
		const feed = selectFeeds("dart")[0]!;
		const items = await fetchFeed(feed);
		const sliced = items.slice(0, options.limit ?? 30);
		await saveItems(items);
		emitResult({
			ok: true,
			items: sliced,
			showing: sliced.length,
			total: items.length,
		});
	} catch (error) {
		emitResult({
			ok: false,
			items: [],
			showing: 0,
			total: 0,
			errors: [error instanceof Error ? error.message : String(error)],
		});
	}
}

export async function news_detail(options: { idOrUrl: string }): Promise<void> {
	try {
		const cache = await loadItems();
		const item = cache.items.find(
			(candidate) =>
				candidate.id === options.idOrUrl ||
				candidate.link === options.idOrUrl ||
				candidate.guid === options.idOrUrl,
		);
		if (!item) {
			emitResult({
				ok: false,
				items: [],
				showing: 0,
				total: 0,
				errors: [`Item "${options.idOrUrl}" not found in cache.`],
			});
			return;
		}
		emitResult({ ok: true, items: [item], showing: 1, total: 1 });
	} catch (error) {
		emitResult({
			ok: false,
			items: [],
			showing: 0,
			total: 0,
			errors: [error instanceof Error ? error.message : String(error)],
		});
	}
}

export function news_search_url(options: {
	query?: string;
	site?: string;
	phrase?: string;
	exclude?: string[];
	after?: string;
	before?: string;
}): void {
	try {
		const url = buildSearchUrl(options);
		const query = buildSearchQuery(options);
		logger.info(JSON.stringify({ ok: true, query, url }));
	} catch (error) {
		logger.info(
			JSON.stringify({
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			}),
		);
	}
}
