import { describe, expect, test } from "bun:test";
import { getEnv } from "../src/env.ts";
import { createSearchFeed } from "../src/feeds.ts";
import { collectNews } from "../src/news.ts";

describe("real API integration tests", () => {
	test("DART RSS fetch (no API key required)", async () => {
		console.log("Fetching real DART RSS feed...");
		const { items, errors } = await collectNews({ category: "dart" });

		if (errors.length > 0) {
			console.warn("DART fetch errors:", errors);
		}

		// DART RSS might be empty on weekends or non-business hours,
		// but the request should complete successfully with zero errors.
		expect(errors).toEqual([]);
		expect(Array.isArray(items)).toBe(true);
		console.log(`Successfully fetched DART RSS. Items count: ${items.length}`);
		if (items.length > 0) {
			const firstItem = items[0];
			console.log("Sample DART Item:", firstItem?.title);
			expect(firstItem?.title).toBeTruthy();
			expect(firstItem?.link).toBeTruthy();
		}
	});

	test("NewsAPI top headlines fetch (requires NEWS_API_KEY)", async () => {
		const apiKey = getEnv("NEWS_API_KEY") || getEnv("NEWSAPI_KEY");
		if (!apiKey) {
			console.log(
				"Skipping real NewsAPI top headlines test because NEWS_API_KEY is not set.",
			);
			return;
		}

		console.log("Fetching real NewsAPI top headlines...");
		const { items, errors } = await collectNews({ category: "latest" });

		// We check for request errors. Since Korean headlines database can sometimes be empty on NewsAPI,
		// we verify that the request succeeds (no errors) and return items.
		expect(errors).toEqual([]);
		expect(Array.isArray(items)).toBe(true);
		console.log(
			`Successfully fetched NewsAPI headlines. Items count: ${items.length}`,
		);
		if (items.length > 0) {
			const firstItem = items[0];
			console.log("Sample NewsAPI Headline Item:", firstItem?.title);
			expect(firstItem?.title).toBeTruthy();
			expect(firstItem?.link).toBeTruthy();
		}
	});

	test("NewsAPI search fetch (requires NEWS_API_KEY)", async () => {
		const apiKey = getEnv("NEWS_API_KEY") || getEnv("NEWSAPI_KEY");
		if (!apiKey) {
			console.log(
				"Skipping real NewsAPI search test because NEWS_API_KEY is not set.",
			);
			return;
		}

		console.log("Fetching real NewsAPI search results for 'news'...");
		const searchFeed = createSearchFeed({ query: "news" });
		const { items, errors } = await collectNews({ feed: searchFeed });

		expect(errors).toEqual([]);
		expect(Array.isArray(items)).toBe(true);
		expect(items.length).toBeGreaterThan(0);
		console.log(
			`Successfully fetched NewsAPI search. Items count: ${items.length}`,
		);
		const firstItem = items[0];
		console.log("Sample NewsAPI Search Item:", firstItem?.title);
		expect(firstItem?.title).toBeTruthy();
		expect(firstItem?.link).toBeTruthy();
	});
});
