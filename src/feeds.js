const GOOGLE_NEWS_BASE_URL = "https://news.google.com/rss";
const DEFAULT_QUERY = "hl=ko&gl=KR&ceid=KR%3Ako";

export const latestFeed = {
  key: "google-latest",
  category: "latest",
  label: "Google News latest",
  url: buildLatestUrl()
};

export const feeds = [latestFeed];

export function buildLatestUrl() {
  return `${GOOGLE_NEWS_BASE_URL}?${DEFAULT_QUERY}`;
}

export function buildSearchUrl({ query, site, phrase, exclude = [] } = {}) {
  const q = buildSearchQuery({ query, site, phrase, exclude });
  if (!q) {
    throw new Error("Search requires at least one of query, site, phrase, or exclude.");
  }

  return `${GOOGLE_NEWS_BASE_URL}/search?q=${encodeURIComponent(q)}&${DEFAULT_QUERY}`;
}

export function buildSearchQuery({ query, site, phrase, exclude = [] } = {}) {
  const parts = [];

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

  return parts.filter(Boolean).join(" ");
}

export function createSearchFeed(options) {
  const query = buildSearchQuery(options);
  return {
    key: "google-search",
    category: "search",
    label: `Google News search: ${query}`,
    url: buildSearchUrl(options)
  };
}

export function getCategories() {
  return ["latest", "search"];
}

export function selectFeeds(category) {
  if (!category || category === "all" || category === "latest" || category === latestFeed.key) {
    return [latestFeed];
  }

  throw new Error('Only "latest" is available as a fixed feed. Use "news-cli search <query>" for Google News search RSS.');
}

function normalizeList(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
