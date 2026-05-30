import { describe, expect, test } from "bun:test";
import { decodeXml, parseRss, stripHtml } from "../src/providers/xml";

describe("decodeXml", () => {
	test("decodes HTML entities", () => {
		expect(decodeXml("A&amp;B &lt; C &gt; D&quot;E&apos;F")).toBe(
			"A&B < C > D\"E'F",
		);
	});

	test("handles CDATA sections", () => {
		expect(decodeXml("<![CDATA[Hello &amp; World]]>")).toBe(
			"Hello &amp; World",
		);
	});

	test("handles numeric entities", () => {
		expect(decodeXml("&#54620;&#44397;")).toBe("한국");
	});
});

describe("stripHtml", () => {
	test("strips tags and decodes entities", () => {
		expect(stripHtml("<p>A&amp;B<br>C</p>")).toBe("A&B\nC");
	});

	test("converts br and /p to newlines", () => {
		expect(stripHtml("<p>Line1</p><p>Line2</p><br/>")).toBe("Line1\n\nLine2");
	});
});

describe("parseRss", () => {
	test("extracts common RSS item fields", () => {
		const xml = `<?xml version="1.0"?>
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
		expect(items).toHaveLength(1);
		expect(items[0]!.title).toBe("경제 & 정치");
		expect(items[0]!.link).toBe("https://example.com/news/1");
		expect(items[0]!.description).toBe("본문 요약\n두번째 줄");
		expect(items[0]!.category).toBe("economy");
	});

	test("returns empty array for no items", () => {
		expect(parseRss("<rss><channel></channel></rss>")).toEqual([]);
	});
});
