import { describe, expect, test } from "bun:test";
import type { Feed } from "../src/core/feed";
import {
	dedupeItems,
	filterItemsBySinceHours,
	type NewsItem,
	normalizeItem,
	normalizeNewsApiItem,
} from "../src/core/news-item";

function makeFeed(overrides: Partial<Feed> = {}): Feed {
	return {
		key: "test",
		category: "latest",
		label: "Test",
		url: "https://example.com/rss",
		type: "rss",
		...overrides,
	};
}

function makeNewsItem(overrides: Partial<NewsItem> = {}): NewsItem {
	return {
		id: "",
		guid: "",
		title: "",
		link: "",
		date: "",
		rawDate: "",
		description: "",
		category: "",
		source: "",
		sourceLabel: "",
		feedUrl: "",
		author: "",
		itemCategory: "",
		categories: [],
		sources: [],
		...overrides,
	};
}

describe("normalizeItem", () => {
	test("adds source metadata and stable id from RSS", () => {
		const item = normalizeItem(
			{
				title: "테스트 뉴스",
				link: "https://example.com/news/1",
				guid: "news-1",
				pubDate: "Wed, 27 May 2026 10:00:00 +0900",
				description: "요약",
				category: "",
				author: "",
			},
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
		const item = normalizeNewsApiItem(
			article,
			makeFeed({ key: "newsapi-latest", type: "newsapi" }),
		);
		expect(item.title).toBe("Breaking News");
		expect(item.link).toBe("https://example.com/article/1");
		expect(item.author).toBe("Reporter");
		expect(item.sourceLabel).toBe("BBC News");
		expect(item.date).toBe("2026-05-30T10:00:00.000Z");
		expect(item.id).toHaveLength(10);
	});

	test("handles null/missing fields without crashing", () => {
		const article = {
			source: null,
			author: null,
			title: null,
			description: null,
			url: null,
			publishedAt: null,
		};
		const item = normalizeNewsApiItem(
			article,
			makeFeed({ key: "newsapi-latest", type: "newsapi" }),
		);
		expect(item.title).toBe("(untitled)");
		expect(item.link).toBe("");
		expect(item.author).toBe("");
		expect(item.sourceLabel).toBe("Test");
	});

	test("handles non-object input", () => {
		const feed = makeFeed({ key: "newsapi-latest", type: "newsapi" });
		expect(normalizeNewsApiItem(null, feed).title).toBe("(untitled)");
		expect(normalizeNewsApiItem(undefined, feed).title).toBe("(untitled)");
		expect(normalizeNewsApiItem("garbage string", feed).title).toBe(
			"(untitled)",
		);
	});
});

describe("dedupeItems", () => {
	test("combines categories and sources for same id", () => {
		const items = [
			makeNewsItem({
				id: "same",
				category: "search",
				source: "google-search",
			}),
			makeNewsItem({
				id: "same",
				category: "latest",
				source: "google-latest",
			}),
			makeNewsItem({
				id: "other",
				category: "latest",
				source: "google-latest",
			}),
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
		expect(filterItemsBySinceHours(items, 3, now).map((i) => i.id)).toEqual([
			"recent",
		]);
	});
});
