import assert from "node:assert/strict";
import test from "node:test";
import {
	buildLatestUrl,
	buildSearchQuery,
	buildSearchUrl,
	selectFeeds,
} from "../src/feeds";
import {
	dedupeItems,
	filterItemsBySinceHours,
	NewsApiError,
	normalizeItem,
	normalizeNewsApiItem,
} from "../src/news";
import {
	buildReleaseAssetUrl,
	buildSkillUrl,
	getAssetName,
	resolveSkillDirs,
} from "../src/upgrade";
import { parseRss, stripHtml } from "../src/xml";

// ─────────────────────────────────────────────
// RSS XML parsing
// ─────────────────────────────────────────────

test("parseRss extracts common RSS item fields", () => {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
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

	assert.equal(items.length, 1);
	const item = items[0]!;
	assert.equal(item.title, "경제 & 정치");
	assert.equal(item.link, "https://example.com/news/1");
	assert.equal(item.description, "본문 요약\n두번째 줄");
	assert.equal(item.category, "economy");
});

test("normalizeItem adds source metadata and stable id", () => {
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
		{
			key: "example",
			category: "society",
			label: "Example",
			url: "https://example.com/rss",
			type: "rss",
		},
	);

	assert.equal(item.source, "example");
	assert.equal(item.category, "society");
	assert.equal(item.id.length, 10);
	assert.equal(item.date, "2026-05-27T01:00:00.000Z");
});

test("stripHtml decodes entities and removes tags", () => {
	assert.equal(stripHtml("<p>A&amp;B<br>C</p>"), "A&B\nC");
});

// ─────────────────────────────────────────────
// Deduplication and filtering
// ─────────────────────────────────────────────

test("dedupeItems combines categories and sources for the same story", () => {
	const items = [
		makeNewsItem({
			id: "same",
			category: "search",
			source: "google-search",
			title: "뉴스",
		}),
		makeNewsItem({
			id: "same",
			category: "latest",
			source: "google-latest",
			title: "뉴스",
		}),
		makeNewsItem({
			id: "other",
			category: "latest",
			source: "google-latest",
			title: "다른 뉴스",
		}),
	];

	const deduped = dedupeItems(items);

	assert.equal(deduped.length, 2);
	const firstDeduped = deduped[0]!;
	assert.equal(firstDeduped.category, "search,latest");
	assert.deepEqual(firstDeduped.categories, ["search", "latest"]);
	assert.equal(firstDeduped.source, "google-search,google-latest");
});

test("filterItemsBySinceHours keeps only recent dated items", () => {
	const now = new Date("2026-05-29T12:00:00.000Z").getTime();
	const items = [
		makeNewsItem({ id: "recent", date: "2026-05-29T10:30:00.000Z" }),
		makeNewsItem({ id: "old", date: "2026-05-29T08:59:59.000Z" }),
		makeNewsItem({ id: "undated", date: "" }),
	];

	assert.deepEqual(
		filterItemsBySinceHours(items, 3, now).map((item) => item.id),
		["recent"],
	);
});

// ─────────────────────────────────────────────
// NewsAPI article normalization (defensive)
// ─────────────────────────────────────────────

test("normalizeNewsApiItem handles complete article", () => {
	const article = {
		source: { id: "bbc", name: "BBC News" },
		author: "Reporter",
		title: "Breaking News",
		description: "Something happened",
		url: "https://example.com/article/1",
		publishedAt: "2026-05-30T10:00:00Z",
	};
	const feed = {
		key: "newsapi-latest",
		category: "latest",
		label: "NewsAPI",
		url: "https://newsapi.org/v2/top-headlines",
		type: "newsapi" as const,
	};

	const item = normalizeNewsApiItem(article, feed);

	assert.equal(item.title, "Breaking News");
	assert.equal(item.link, "https://example.com/article/1");
	assert.equal(item.author, "Reporter");
	assert.equal(item.sourceLabel, "BBC News");
	assert.equal(item.date, "2026-05-30T10:00:00.000Z");
	assert.equal(item.id.length, 10);
});

test("normalizeNewsApiItem handles null/missing fields without crashing", () => {
	const article = {
		source: null,
		author: null,
		title: null,
		description: null,
		url: null,
		publishedAt: null,
	};
	const feed = {
		key: "newsapi-latest",
		category: "latest",
		label: "NewsAPI",
		url: "https://newsapi.org/v2/top-headlines",
		type: "newsapi" as const,
	};

	const item = normalizeNewsApiItem(article, feed);

	assert.equal(item.title, "(untitled)");
	assert.equal(item.link, "");
	assert.equal(item.author, "");
	assert.equal(item.sourceLabel, "NewsAPI");
	assert.equal(item.description, "");
});

test("normalizeNewsApiItem handles completely empty object", () => {
	const feed = {
		key: "newsapi-latest",
		category: "latest",
		label: "NewsAPI",
		url: "https://newsapi.org/v2/top-headlines",
		type: "newsapi" as const,
	};

	const item = normalizeNewsApiItem({}, feed);

	assert.equal(item.title, "(untitled)");
	assert.equal(item.link, "");
	assert.equal(item.id.length, 10);
});

test("normalizeNewsApiItem handles non-object input", () => {
	const feed = {
		key: "newsapi-latest",
		category: "latest",
		label: "NewsAPI",
		url: "https://newsapi.org/v2/top-headlines",
		type: "newsapi" as const,
	};

	// Should not throw even with garbage input
	const item1 = normalizeNewsApiItem(null, feed);
	assert.equal(item1.title, "(untitled)");

	const item2 = normalizeNewsApiItem(undefined, feed);
	assert.equal(item2.title, "(untitled)");

	const item3 = normalizeNewsApiItem("garbage string", feed);
	assert.equal(item3.title, "(untitled)");
});

test("normalizeNewsApiItem handles numeric values in string fields", () => {
	const article = {
		title: 12345,
		author: 999,
		url: "https://example.com/numeric",
		publishedAt: "2026-05-30T10:00:00Z",
	};
	const feed = {
		key: "newsapi-latest",
		category: "latest",
		label: "NewsAPI",
		url: "https://newsapi.org/v2/top-headlines",
		type: "newsapi" as const,
	};

	const item = normalizeNewsApiItem(article, feed);

	assert.equal(item.title, "12345");
	assert.equal(item.author, "999");
});

// ─────────────────────────────────────────────
// NewsApiError
// ─────────────────────────────────────────────

test("NewsApiError classifies status codes correctly", () => {
	const authError = new NewsApiError("unauthorized", 401);
	assert.equal(authError.isAuthError, true);
	assert.equal(authError.isRetryable, false);

	const forbiddenError = new NewsApiError("forbidden", 403);
	assert.equal(forbiddenError.isAuthError, true);
	assert.equal(forbiddenError.isRetryable, false);

	const rateLimited = new NewsApiError("too many requests", 429);
	assert.equal(rateLimited.isRateLimited, true);
	assert.equal(rateLimited.isRetryable, true);

	const serverError = new NewsApiError("internal server error", 500);
	assert.equal(serverError.isServerError, true);
	assert.equal(serverError.isRetryable, true);

	const badRequest = new NewsApiError("bad request", 400);
	assert.equal(badRequest.isAuthError, false);
	assert.equal(badRequest.isRateLimited, false);
	assert.equal(badRequest.isServerError, false);
	assert.equal(badRequest.isRetryable, false);
});

// ─────────────────────────────────────────────
// Feed URL construction
// ─────────────────────────────────────────────

test("buildLatestUrl returns NewsAPI top-headlines URL", () => {
	assert.equal(
		buildLatestUrl(),
		"https://newsapi.org/v2/top-headlines?country=kr",
	);
});

test("selectFeeds includes DART disclosure RSS", () => {
	const [feed] = selectFeeds("dart");
	assert.ok(feed);
	assert.equal(feed!.key, "dart");
	assert.equal(feed!.category, "disclosure");
	assert.equal(feed!.url, "https://dart.fss.or.kr/api/todayRSS.xml");
});

test("selectFeeds handles legacy 'google-latest' key", () => {
	const [feed] = selectFeeds("google-latest");
	assert.ok(feed);
	assert.equal(feed!.key, "newsapi-latest");
});

test("selectFeeds throws on unknown category", () => {
	assert.throws(() => selectFeeds("nonexistent"), /Available fixed feeds/);
});

test("buildSearchQuery combines search operators", () => {
	assert.equal(
		buildSearchQuery({
			query: "반도체",
			site: "mk.co.kr",
			phrase: "실적 전망",
			exclude: ["루머", "-광고"],
			after: "2026-05-01",
			before: "2026-05-28",
		}),
		'반도체 site:mk.co.kr "실적 전망" -루머 -광고 after:2026-05-01 before:2026-05-28',
	);
});

test("buildSearchUrl returns NewsAPI search URL", () => {
	const url = buildSearchUrl({
		query: "반도체",
		site: "mk.co.kr",
		phrase: "실적 전망",
		exclude: "루머",
		after: "2026-05-01",
		before: "2026-05-28",
	});

	assert.equal(
		url,
		"https://newsapi.org/v2/everything?q=%EB%B0%98%EB%8F%84%EC%B2%B4+%22%EC%8B%A4%EC%A0%81+%EC%A0%84%EB%A7%9D%22+-%EB%A3%A8%EB%A8%B8&domains=mk.co.kr&from=2026-05-01&to=2026-05-28",
	);
});

test("buildSearchQuery validates date filters", () => {
	assert.throws(
		() => buildSearchQuery({ query: "삼성전자", after: "2026-02-30" }),
		/Invalid date filter/,
	);
});

test("buildSearchUrl requires at least one search parameter", () => {
	assert.throws(() => buildSearchUrl({}), /Search requires at least one/);
});

test("buildSearchUrl with only dates falls back to generic query", () => {
	const url = buildSearchUrl({ after: "2026-05-01" });
	assert.ok(url.includes("q=news"));
	assert.ok(url.includes("from=2026-05-01"));
});

// ─────────────────────────────────────────────
// Upgrade helpers
// ─────────────────────────────────────────────

test("upgrade helpers build release asset names and urls", () => {
	assert.equal(getAssetName("linux", "x64"), "news-cli-linux-x64");
	assert.equal(
		buildReleaseAssetUrl("news-cli-linux-x64", "v0.2.8"),
		"https://github.com/bbggkkk/News-CLI/releases/download/v0.2.8/news-cli-linux-x64",
	);
	assert.equal(
		buildSkillUrl("v0.2.8"),
		"https://raw.githubusercontent.com/bbggkkk/News-CLI/v0.2.8/skills/news-cli/SKILL.md",
	);
});

test("resolveSkillDirs installs Codex and Hermes skills", () => {
	assert.deepEqual(
		resolveSkillDirs({
			codexSkillDir: "/tmp/codex/news-cli",
			hermesSkillDir: "/tmp/hermes/news-cli",
		}),
		["/tmp/codex/news-cli", "/tmp/hermes/news-cli"],
	);
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeNewsItem(overrides = {}) {
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
