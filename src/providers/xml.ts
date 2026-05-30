const entityMap: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: "\u00a0",
};

export type RssItem = {
	title: string;
	link: string;
	guid: string;
	pubDate: string;
	description: string;
	category: string;
	author: string;
};

export function decodeXml(value = ""): string {
	const parts = value.split(/(<!\[CDATA\[[\s\S]*?\]\]>)/);
	return parts
		.map((part) => {
			if (part.startsWith("<![CDATA[")) {
				return part.slice(9, -3);
			}
			return part
				.replace(/&#(\d+);/g, (_: string, code: string) =>
					String.fromCodePoint(Number(code)),
				)
				.replace(/&#x([0-9a-fA-F]+);/g, (_: string, code: string) =>
					String.fromCodePoint(Number.parseInt(code, 16)),
				)
				.replace(
					/&([a-zA-Z][a-zA-Z0-9]+);/g,
					(match: string, name: string) => entityMap[name] ?? match,
				);
		})
		.join("");
}

export function stripHtml(value = ""): string {
	return decodeXml(value)
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<[^>]+>/g, "")
		.replace(/\r/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function extractTag(block: string, tagName: string): string {
	const pattern = new RegExp(
		`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
		"i",
	);
	const match = block.match(pattern);
	return match ? decodeXml(match[1]!).trim() : "";
}

export function parseRss(xml: string): RssItem[] {
	const itemMatches = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
	return itemMatches
		.map((item) => ({
			title: stripHtml(extractTag(item, "title")),
			link: stripHtml(extractTag(item, "link")),
			guid: stripHtml(extractTag(item, "guid")),
			pubDate: stripHtml(extractTag(item, "pubDate")),
			description: stripHtml(extractTag(item, "description")),
			category: stripHtml(extractTag(item, "category")),
			author: stripHtml(extractTag(item, "author")),
		}))
		.filter((item) => item.title || item.link || item.description);
}
