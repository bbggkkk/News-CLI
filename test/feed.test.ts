import { describe, expect, test } from "bun:test";
import {
	buildLatestUrl,
	buildSearchQuery,
	buildSearchUrl,
	createSearchFeed,
	getCategories,
	selectFeeds,
} from "../src/core/feed";

describe("buildLatestUrl", () => {
	test("returns NewsAPI top-headlines URL", () => {
		expect(buildLatestUrl()).toBe(
			"https://newsapi.org/v2/top-headlines?country=kr",
		);
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
		).toBe(
			'반도체 site:mk.co.kr "실적 전망" -루머 -광고 after:2026-05-01 before:2026-05-28',
		);
	});

	test("validates date filters", () => {
		expect(() =>
			buildSearchQuery({ query: "삼성전자", after: "2026-02-30" }),
		).toThrow(/Invalid date filter/);
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
