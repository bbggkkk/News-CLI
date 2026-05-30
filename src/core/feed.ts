const NEWSAPI_BASE_URL = "https://newsapi.org/v2";

export type FeedType = "newsapi" | "rss";

export type Feed = {
	key: string;
	category: string;
	label: string;
	url: string;
	type: FeedType;
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
	key: "newsapi-latest",
	category: "latest",
	label: "NewsAPI Top Headlines",
	url: buildLatestUrl(),
	type: "newsapi",
};

export const dartFeed: Feed = {
	key: "dart",
	category: "disclosure",
	label: "DART today disclosures",
	url: "https://dart.fss.or.kr/api/todayRSS.xml",
	type: "rss",
};

export const feeds: Feed[] = [latestFeed, dartFeed];

export function buildLatestUrl(): string {
	return `${NEWSAPI_BASE_URL}/top-headlines?country=kr`;
}

export function buildSearchUrl(options: SearchOptions = {}): string {
	const { query, site, phrase, exclude = [], after, before } = options;
	const url = new URL(`${NEWSAPI_BASE_URL}/everything`);

	const qParts: string[] = [];
	if (query) qParts.push(query.trim());
	if (phrase) {
		const normalizedPhrase = phrase.trim().replace(/^"+|"+$/g, "");
		if (normalizedPhrase) qParts.push(`"${normalizedPhrase}"`);
	}
	for (const word of normalizeList(exclude)) {
		const normalizedWord = word.trim().replace(/^-+/, "");
		if (normalizedWord) qParts.push(`-${normalizedWord}`);
	}

	const q = qParts.filter(Boolean).join(" ");
	if (q) url.searchParams.set("q", q);
	if (site) url.searchParams.set("domains", site.trim());

	const normalizedAfter = normalizeDateFilter(after);
	if (normalizedAfter) url.searchParams.set("from", normalizedAfter);
	const normalizedBefore = normalizeDateFilter(before);
	if (normalizedBefore) url.searchParams.set("to", normalizedBefore);

	if (!url.searchParams.has("q") && !url.searchParams.has("domains")) {
		if (url.searchParams.has("from") || url.searchParams.has("to")) {
			url.searchParams.set("q", "news");
		} else {
			throw new Error(
				"Search requires at least one of query, site, phrase, exclude, after, or before.",
			);
		}
	}

	return url.toString();
}

export function buildSearchQuery(options: SearchOptions = {}): string {
	const { query, site, phrase, exclude = [], after, before } = options;
	const parts: string[] = [];
	if (query) parts.push(query.trim());
	if (site) parts.push(`site:${site.trim()}`);
	if (phrase) {
		const normalizedPhrase = phrase.trim().replace(/^"+|"+$/g, "");
		if (normalizedPhrase) parts.push(`"${normalizedPhrase}"`);
	}
	for (const word of normalizeList(exclude)) {
		const normalizedWord = word.trim().replace(/^-+/, "");
		if (normalizedWord) parts.push(`-${normalizedWord}`);
	}
	const normalizedAfter = normalizeDateFilter(after);
	if (normalizedAfter) parts.push(`after:${normalizedAfter}`);
	const normalizedBefore = normalizeDateFilter(before);
	if (normalizedBefore) parts.push(`before:${normalizedBefore}`);
	return parts.filter(Boolean).join(" ");
}

export function createSearchFeed(options: SearchOptions): Feed {
	return {
		key: "newsapi-search",
		category: "search",
		label: `NewsAPI search: ${buildSearchQuery(options)}`,
		url: buildSearchUrl(options),
		type: "newsapi",
	};
}

export function getCategories(): string[] {
	return ["latest", "search", "disclosure"];
}

export function selectFeeds(category?: string): Feed[] {
	if (
		!category ||
		category === "all" ||
		category === "latest" ||
		category === latestFeed.key ||
		category === "google-latest"
	) {
		return [latestFeed];
	}
	if (
		category === "dart" ||
		category === "disclosure" ||
		category === dartFeed.key
	) {
		return [dartFeed];
	}
	throw new Error(
		'Available fixed feeds: latest, dart, disclosure. Use "news-cli search <query>" for NewsAPI search.',
	);
}

function normalizeList(value?: string | string[]): string[] {
	if (!value) return [];
	return Array.isArray(value) ? value : [value];
}

function normalizeDateFilter(value?: string): string {
	if (!value) return "";
	const normalized = String(value).trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		throw new Error(`Date filters must use YYYY-MM-DD. Received "${value}".`);
	}
	const date = new Date(`${normalized}T00:00:00.000Z`);
	if (
		Number.isNaN(date.getTime()) ||
		date.toISOString().slice(0, 10) !== normalized
	) {
		throw new Error(`Invalid date filter: "${value}".`);
	}
	return normalized;
}
