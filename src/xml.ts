const entityMap = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " "
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
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_: string, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_: string, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (match: string, name: keyof typeof entityMap) => entityMap[name] ?? match);
}

export function stripHtml(value = ""): string {
  return decodeXml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractTag(block: string, tagName: string): string {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(pattern);
  return match ? decodeXml(match[1]).trim() : "";
}

export function parseRss(xml: string): RssItem[] {
  const itemMatches = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];

  return itemMatches.map((item) => {
    const title = stripHtml(extractTag(item, "title"));
    const link = stripHtml(extractTag(item, "link"));
    const guid = stripHtml(extractTag(item, "guid"));
    const pubDate = stripHtml(extractTag(item, "pubDate"));
    const description = stripHtml(extractTag(item, "description"));
    const category = stripHtml(extractTag(item, "category"));
    const author = stripHtml(extractTag(item, "author"));

    return {
      title,
      link,
      guid,
      pubDate,
      description,
      category,
      author
    };
  }).filter((item) => item.title || item.link || item.description);
}
