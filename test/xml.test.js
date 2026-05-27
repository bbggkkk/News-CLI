import test from "node:test";
import assert from "node:assert/strict";
import { parseRss, stripHtml } from "../src/xml.js";
import { dedupeItems, normalizeItem } from "../src/news.js";

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
    { id: "same", category: "issue", source: "jtbc-issue", title: "뉴스" },
    { id: "same", category: "society", source: "jtbc-society", title: "뉴스" },
    { id: "other", category: "economy", source: "jtbc-economy", title: "다른 뉴스" }
  ];

  const deduped = dedupeItems(items);

  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].category, "issue,society");
  assert.deepEqual(deduped[0].categories, ["issue", "society"]);
  assert.equal(deduped[0].source, "jtbc-issue,jtbc-society");
});
