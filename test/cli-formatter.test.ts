import { expect, test } from "bun:test";
import type { Feed } from "../src/core/feed";
import type { NewsItem } from "../src/core/news-item";
import {
	formatCategories,
	formatDetail,
	formatHistory,
	formatJson,
	formatListItem,
} from "../src/interfaces/cli/formatter";
import type { HistoryEntry } from "../src/providers/cache";

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
	return {
		id: "abc123",
		guid: "",
		title: "Title",
		link: "https://example.com",
		date: "2026-05-31T00:00:00Z",
		rawDate: "2026-05-31T00:00:00Z",
		description: "Desc",
		category: "latest",
		source: "test",
		sourceLabel: "Test",
		feedUrl: "",
		author: "",
		itemCategory: "",
		categories: [],
		sources: [],
		...overrides,
	};
}

test("formatListItem includes id, category, source, date, title", () => {
	const item = makeItem();
	const result = formatListItem(item);
	expect(result).toContain("abc123");
	expect(result).toContain("Title");
	expect(result).toContain("https://example.com");
});

test("formatDetail includes all fields", () => {
	const item = makeItem({
		author: "Reporter",
		description: "Long description",
	});
	const result = formatDetail(item);
	expect(result).toContain("Reporter");
	expect(result).toContain("Long description");
});

test("formatHistory formats entries", () => {
	const entries: HistoryEntry[] = [
		{
			timestamp: "2026-05-31T00:00:00Z",
			feedKey: "test",
			feedLabel: "Test",
			url: "https://example.com",
			status: "success",
			itemCount: 5,
		},
	];
	const result = formatHistory(entries);
	expect(result).toContain("success");
	expect(result).toContain("5 items");
});

test("formatCategories lists feeds", () => {
	const testFeeds: Feed[] = [
		{
			key: "test",
			category: "latest",
			label: "Test",
			url: "https://example.com",
			type: "newsapi",
		},
	];
	const result = formatCategories(testFeeds, ["latest"]);
	expect(result).toContain("test");
});

test("formatJson outputs structured JSON with ok=true", () => {
	const items = [makeItem()];
	const result = JSON.parse(formatJson(items, [], { total: 1, showing: 1 }));
	expect(result.ok).toBe(true);
	expect(result.items).toHaveLength(1);
});

test("formatJson includes errors when present", () => {
	const result = JSON.parse(
		formatJson([], ["Fetch failed"], { total: 0, showing: 0 }),
	);
	expect(result.ok).toBe(false);
	expect(result.errors).toContain("Fetch failed");
});

test("formatListItem truncates long descriptions", () => {
	const item = makeItem({ description: "x".repeat(200) });
	const result = formatListItem(item);
	expect(result).toContain(`${"x".repeat(157)}...`);
});
