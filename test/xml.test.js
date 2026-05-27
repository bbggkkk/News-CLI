import test from "node:test";
import assert from "node:assert/strict";
import { buildLatestUrl, buildSearchQuery, buildSearchUrl, selectFeeds } from "../src/feeds.js";
import { parseRss, stripHtml } from "../src/xml.js";
import { dedupeItems, normalizeItem } from "../src/news.js";
import { buildReleaseAssetUrl, buildSkillUrl, getAssetName, resolveSkillDirs } from "../src/upgrade.js";

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
  assert.equal(items[0].title, "경제 & 정치");
  assert.equal(items[0].link, "https://example.com/news/1");
  assert.equal(items[0].description, "본문 요약\n두번째 줄");
  assert.equal(items[0].category, "economy");
});

test("normalizeItem adds source metadata and stable id", () => {
  const item = normalizeItem({
    title: "테스트 뉴스",
    link: "https://example.com/news/1",
    guid: "news-1",
    pubDate: "Wed, 27 May 2026 10:00:00 +0900",
    description: "요약"
  }, {
    key: "example",
    category: "society",
    label: "Example feed",
    url: "https://example.com/rss"
  });

  assert.equal(item.source, "example");
  assert.equal(item.category, "society");
  assert.equal(item.id.length, 10);
  assert.equal(item.date, "2026-05-27T01:00:00.000Z");
});

test("stripHtml decodes entities and removes tags", () => {
  assert.equal(stripHtml("<p>A&amp;B<br>C</p>"), "A&B\nC");
});

test("dedupeItems combines categories and sources for the same story", () => {
  const items = [
    { id: "same", category: "search", source: "google-search", title: "뉴스" },
    { id: "same", category: "latest", source: "google-latest", title: "뉴스" },
    { id: "other", category: "latest", source: "google-latest", title: "다른 뉴스" }
  ];

  const deduped = dedupeItems(items);

  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].category, "search,latest");
  assert.deepEqual(deduped[0].categories, ["search", "latest"]);
  assert.equal(deduped[0].source, "google-search,google-latest");
});

test("buildLatestUrl returns Korean Google News RSS", () => {
  assert.equal(buildLatestUrl(), "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR%3Ako");
});

test("selectFeeds includes DART disclosure RSS", () => {
  const [feed] = selectFeeds("dart");

  assert.equal(feed.key, "dart");
  assert.equal(feed.category, "disclosure");
  assert.equal(feed.url, "https://dart.fss.or.kr/api/todayRSS.xml");
});

test("buildSearchQuery combines Google News advanced search operators", () => {
  assert.equal(
    buildSearchQuery({
      query: "반도체",
      site: "mk.co.kr",
      phrase: "실적 전망",
      exclude: ["루머", "-광고"]
    }),
    '반도체 site:mk.co.kr "실적 전망" -루머 -광고'
  );
});

test("buildSearchUrl returns Google News RSS search URL", () => {
  const url = buildSearchUrl({
    query: "반도체",
    site: "mk.co.kr",
    phrase: "실적 전망",
    exclude: "루머"
  });

  assert.equal(url, "https://news.google.com/rss/search?q=%EB%B0%98%EB%8F%84%EC%B2%B4%20site%3Amk.co.kr%20%22%EC%8B%A4%EC%A0%81%20%EC%A0%84%EB%A7%9D%22%20-%EB%A3%A8%EB%A8%B8&hl=ko&gl=KR&ceid=KR%3Ako");
});

test("upgrade helpers build release asset names and urls", () => {
  assert.equal(getAssetName("linux", "x64"), "news-cli-linux-x64");
  assert.equal(
    buildReleaseAssetUrl("news-cli-linux-x64", "v0.2.5"),
    "https://github.com/bbggkkk/News-CLI/releases/download/v0.2.5/news-cli-linux-x64"
  );
  assert.equal(
    buildSkillUrl("v0.2.5"),
    "https://raw.githubusercontent.com/bbggkkk/News-CLI/v0.2.5/skills/news-cli/SKILL.md"
  );
});

test("resolveSkillDirs installs Codex and Hermes skills", () => {
  assert.deepEqual(
    resolveSkillDirs({
      codexSkillDir: "/tmp/codex/news-cli",
      hermesSkillDir: "/tmp/hermes/news-cli"
    }),
    ["/tmp/codex/news-cli", "/tmp/hermes/news-cli"]
  );
});
