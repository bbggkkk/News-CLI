import { describe, expect, test } from "bun:test";
import { createSearchFeed, selectFeeds } from "../src/core/feed";
import { getEnv } from "../src/providers/config";
import { fetchFeed } from "../src/providers/http";

describe("real API integration tests", () => {
	test("DART RSS fetch (no API key required)", async () => {
		const feed = selectFeeds("dart")[0]!;
		const items = await fetchFeed(feed);
		expect(Array.isArray(items)).toBe(true);
	});

	test("NewsAPI top headlines fetch (requires NEWS_API_KEY)", async () => {
		const apiKey = getEnv("NEWS_API_KEY") || getEnv("NEWSAPI_KEY");
		if (!apiKey) return;
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
