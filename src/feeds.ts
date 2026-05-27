const GOOGLE_NEWS_BASE_URL = "https://news.google.com/rss";
const DEFAULT_QUERY = "hl=ko&gl=KR&ceid=KR%3Ako";

export type Feed = {
  key: string;
  category: string;
  label: string;
  url: string;
};

export type SearchOptions = {
  query?: string;
  site?: string;
  phrase?: string;
  exclude?: string | string[];
  after?: string;
  before?: string;
};

export const latestFeed: Feed = {
  key: "google-latest",
  category: "latest",
  label: "Google News latest",
  url: buildLatestUrl()
};

export const dartFeed: Feed = {
  key: "dart",
  category: "disclosure",
  label: "DART today disclosures",
  url: "https://dart.fss.or.kr/api/todayRSS.xml"
};

export const feeds: Feed[] = [latestFeed, dartFeed];

export function buildLatestUrl(): string {
  return `${GOOGLE_NEWS_BASE_URL}?${DEFAULT_QUERY}`;
}

export function buildSearchUrl({ query, site, phrase, exclude = [], after, before }: SearchOptions = {}): string {
  const q = buildSearchQuery({ query, site, phrase, exclude, after, before });
  if (!q) {
    throw new Error("Search requires at least one of query, site, phrase, exclude, after, or before.");
  }

  return `${GOOGLE_NEWS_BASE_URL}/search?q=${encodeURIComponent(q)}&${DEFAULT_QUERY}`;
}

export function buildSearchQuery({ query, site, phrase, exclude = [], after, before }: SearchOptions = {}): string {
  const parts: string[] = [];

  if (query) {
    parts.push(query.trim());
  }

  if (site) {
    parts.push(`site:${site.trim()}`);
  }

  if (phrase) {
    const normalizedPhrase = phrase.trim().replace(/^"+|"+$/g, "");
    if (normalizedPhrase) {
      parts.push(`"${normalizedPhrase}"`);
    }
  }

  for (const word of normalizeList(exclude)) {
    const normalizedWord = word.trim().replace(/^-+/, "");
    if (normalizedWord) {
      parts.push(`-${normalizedWord}`);
    }
  }

  const normalizedAfter = normalizeDate(after);
  if (normalizedAfter) {
    parts.push(`after:${normalizedAfter}`);
  }

  const normalizedBefore = normalizeDate(before);
  if (normalizedBefore) {
    parts.push(`before:${normalizedBefore}`);
  }

  return parts.filter(Boolean).join(" ");
}

export function createSearchFeed(options: SearchOptions): Feed {
  const query = buildSearchQuery(options);
  return {
    key: "google-search",
    category: "search",
    label: `Google News search: ${query}`,
    url: buildSearchUrl(options)
  };
}

export function getCategories(): string[] {
  return ["latest", "search", "disclosure"];
}

export function selectFeeds(category?: string): Feed[] {
  if (!category || category === "all" || category === "latest" || category === latestFeed.key) {
    return [latestFeed];
  }

  if (category === "dart" || category === "disclosure" || category === dartFeed.key) {
    return [dartFeed];
  }

  throw new Error('Available fixed feeds: latest, dart, disclosure. Use "news-cli search <query>" for Google News search RSS.');
}

function normalizeList(value?: string | string[]): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizeDate(value?: string): string {
  if (!value) {
    return "";
  }

  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`Date filters must use YYYY-MM-DD. Received "${value}".`);
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`Invalid date filter: "${value}".`);
  }

  return normalized;
}
