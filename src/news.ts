import * as crypto from "node:crypto";
import { saveHistoryEntry } from "./cache";
import { getEnv } from "./env";
import { type Feed, selectFeeds } from "./feeds";
import { logWarn } from "./logger";
import { validateUrl } from "./url";
import { VERSION } from "./version";
import { parseRss, type RssItem } from "./xml";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1_000;

export type NewsItem = {
	id: string;
	guid: string;
	title: string;
	link: string;
	date: string;
	rawDate: string;
	description: string;
	category: string;
	source: string;
	sourceLabel: string;
	feedUrl: string;
	author: string;
	itemCategory: string;
	categories: string[];
	sources: string[];
};

export type CollectNewsOptions = {
	category?: string;
	feed?: Feed;
	timeoutMs?: number;
	sinceHours?: number;
	maxRetries?: number;
};

export class NewsApiError extends Error {
	constructor(
		message: string,
		public readonly statusCode: number,
		public readonly retryAfterMs?: number,
	) {
		super(message);
		this.name = "NewsApiError";
	}

	get isAuthError(): boolean {
		return this.statusCode === 401 || this.statusCode === 403;
	}

	get isRateLimited(): boolean {
		return this.statusCode === 429;
	}

	get isServerError(): boolean {
		return this.statusCode >= 500;
	}

	get isRetryable(): boolean {
		return this.isRateLimited || this.isServerError;
	}
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterHeader(response: Response): number | undefined {
	const retryAfter = response.headers.get("retry-after");
	if (!retryAfter) return undefined;

	const seconds = Number(retryAfter);
	if (Number.isFinite(seconds) && seconds > 0) {
		return seconds * 1000;
	}

	const date = new Date(retryAfter);
	if (!Number.isNaN(date.getTime())) {
		const delayMs = date.getTime() - Date.now();
		return delayMs > 0 ? delayMs : undefined;
	}

	return undefined;
}

export async function fetchFeed(
	feed: Feed,
	{
		timeoutMs = DEFAULT_TIMEOUT_MS,
		maxRetries = DEFAULT_MAX_RETRIES,
	}: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<NewsItem[]> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fetchFeedOnce(feed, { timeoutMs });
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (error instanceof NewsApiError) {
				if (error.isAuthError) {
					// Auth errors are not retryable — fail immediately with actionable message
					throw new Error(
						`인증 실패 (HTTP ${error.statusCode}): NEWS_API_KEY 환경 변수를 확인하세요. ` +
							`현재 키가 유효한지, 만료되지 않았는지 newsapi.org 대시보드에서 확인해주세요.`,
					);
				}

				if (!error.isRetryable) {
					throw error;
				}

				// Retryable: wait before next attempt
				if (attempt < maxRetries) {
					const baseDelay =
						error.retryAfterMs ?? RETRY_BASE_DELAY_MS * 2 ** attempt;
					const jitter = Math.random() * 500;
					const delayMs = Math.min(baseDelay + jitter, 30_000);

					const reason = error.isRateLimited
						? "요청 한도 초과 (429)"
						: `서버 오류 (${error.statusCode})`;
					logWarn(
						`${reason}, ${Math.round(delayMs / 1000)}초 후 재시도... (${attempt + 1}/${maxRetries})`,
					);
					await sleep(delayMs);
					continue;
				}
			}

			// Non-retryable errors or timeout errors: check if worth retrying
			if (attempt < maxRetries && isTimeoutError(error)) {
				const delayMs =
					RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * 500;
				logWarn(
					`요청 시간 초과, ${Math.round(delayMs / 1000)}초 후 재시도... (${attempt + 1}/${maxRetries})`,
				);
				await sleep(delayMs);
				continue;
			}

			if (attempt >= maxRetries) {
				break;
			}
		}
	}

	throw lastError ?? new Error("Unknown fetch error");
}

async function fetchFeedOnce(
	feed: Feed,
	{ timeoutMs }: { timeoutMs: number },
): Promise<NewsItem[]> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

	try {
		const headers: Record<string, string> = {
			"user-agent": `news-cli/${VERSION}`,
		};

		if (feed.type === "newsapi") {
			const apiKey = getEnv("NEWS_API_KEY") || getEnv("NEWSAPI_KEY");
			if (!apiKey) {
				throw new Error(
					"NEWS_API_KEY 환경 변수가 설정되지 않았습니다. " +
						'NewsAPI 키를 발급받은 후 export NEWS_API_KEY="your-key" 를 실행하세요. ' +
						"발급: https://newsapi.org/register",
				);
			}
			headers["X-Api-Key"] = apiKey;
			headers["accept"] = "application/json";
		} else {
			headers["accept"] =
				"application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8";
		}

		validateUrl(feed.url, ["newsapi.org", "dart.fss.or.kr"]);

		const response = await fetch(feed.url, {
			headers,
			signal: controller.signal,
		});

		if (!response.ok) {
			const retryAfterMs = parseRetryAfterHeader(response);
			const errorBody = await response.text().catch(() => "");

			// Try to extract a meaningful message from the JSON error body
			let message = `HTTP ${response.status} ${response.statusText}`;
			if (errorBody) {
				try {
					const parsed = JSON.parse(errorBody);
					if (parsed.message) {
						message = `${message}: ${parsed.message}`;
					}
				} catch {
					// Not JSON, truncate raw body for context
					if (errorBody.length > 200) {
						message = `${message}: ${errorBody.slice(0, 200)}...`;
					} else {
						message = `${message}: ${errorBody}`;
					}
				}
			}

			throw new NewsApiError(message, response.status, retryAfterMs);
		}

		let items: NewsItem[] = [];
		if (feed.type === "newsapi") {
			const text = await response.text();
			let json: any;
			try {
				json = JSON.parse(text);
			} catch {
				throw new Error(
					`NewsAPI 응답을 JSON으로 파싱할 수 없습니다. ` +
						`응답 앞 200자: ${text.slice(0, 200)}`,
				);
			}

			if (json.status !== "ok") {
				const code = json.code || "unknown";
				const msg = json.message || "알 수 없는 오류";
				throw new Error(`NewsAPI 오류 (${code}): ${msg}`);
			}

			const articles = json.articles;
			if (!Array.isArray(articles)) {
				throw new Error(
					`NewsAPI 응답의 articles 필드가 배열이 아닙니다. ` +
						`타입: ${typeof articles}, 값: ${JSON.stringify(articles).slice(0, 100)}`,
				);
			}

			items = articles.map((article: unknown) =>
				normalizeNewsApiItem(article, feed),
			);
		} else {
			const xml = await response.text();
			if (xml.trim()) {
				items = parseRss(xml).map((item) => normalizeItem(item, feed));
			}
		}

		await saveHistoryEntry({
			timestamp: new Date().toISOString(),
			feedKey: feed.key,
			feedLabel: feed.label,
			url: feed.url,
			status: "success",
			itemCount: items.length,
		}).catch(() => {});

		return items;
	} catch (error) {
		let finalError: Error;
		if (error instanceof NewsApiError) {
			finalError = error;
		} else if (isAbortError(error)) {
			const reason = controller.signal.reason;
			if (reason === "timeout") {
				finalError = new Error(
					`${feed.label} 요청이 ${timeoutMs / 1000}초 내에 응답하지 않아 시간 초과되었습니다. ` +
						`네트워크 상태를 확인하거나 --timeout 값을 늘려보세요.`,
				);
			} else {
				finalError = new Error(`${feed.label} 요청이 중단되었습니다.`);
			}
		} else {
			finalError = classifyNetworkError(error, feed);
		}

		await saveHistoryEntry({
			timestamp: new Date().toISOString(),
			feedKey: feed.key,
			feedLabel: feed.label,
			url: feed.url,
			status: "failure",
			itemCount: 0,
			errorMessage: finalError.message,
		}).catch(() => {});

		throw finalError;
	} finally {
		clearTimeout(timer);
	}
}

function classifyNetworkError(error: unknown, feed: Feed): Error {
	const err = error as {
		code?: string;
		message?: string;
		cause?: { code?: string };
	};
	const code = err.code || err.cause?.code;
	const message = err.message || "";

	if (code === "ENOTFOUND" || message.includes("ENOTFOUND")) {
		return new Error(
			`네트워크 연결 오류: ${feed.label}의 도메인 주소를 찾을 수 없습니다. ` +
				`인터넷 연결 상태를 확인하고 다시 시도하세요.`,
		);
	}
	if (code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
		return new Error(
			`연결 거부 오류: ${feed.label} 서버가 응답하지 않습니다. ` +
				`서버가 점검 중이거나 다운되었을 수 있습니다.`,
		);
	}
	if (code === "ETIMEDOUT" || message.includes("ETIMEDOUT")) {
		return new Error(
			`연결 시간 초과: ${feed.label} 서버와의 연결 시간이 초과되었습니다.`,
		);
	}
	if (code === "EAI_AGAIN" || message.includes("EAI_AGAIN")) {
		return new Error(
			`DNS 조회 오류: 임시적인 DNS 장애가 발생했습니다. ` +
				`인터넷 설정 또는 DNS 설정을 확인하세요.`,
		);
	}

	return err instanceof Error ? err : new Error(String(error));
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

function isTimeoutError(error: unknown): boolean {
	if (error instanceof Error) {
		return (
			error.message.includes("시간 초과") || error.message.includes("timeout")
		);
	}
	return false;
}

export async function collectNews({
	category = "latest",
	feed,
	timeoutMs,
	sinceHours,
	maxRetries,
}: CollectNewsOptions = {}): Promise<{ items: NewsItem[]; errors: string[] }> {
	const selectedFeeds = feed ? [feed] : selectFeeds(category);
	const results = await Promise.allSettled(
		selectedFeeds.map(async (f) => {
			const fetchOpts: { timeoutMs?: number; maxRetries?: number } = {};
			if (timeoutMs !== undefined) fetchOpts.timeoutMs = timeoutMs;
			if (maxRetries !== undefined) fetchOpts.maxRetries = maxRetries;
			return {
				feed: f,
				items: await fetchFeed(f, fetchOpts),
			};
		}),
	);

	const errors: string[] = [];
	const items: NewsItem[] = [];

	for (const result of results) {
		if (result.status === "fulfilled") {
			items.push(...result.value.items);
		} else {
			errors.push(
				result.reason instanceof Error
					? result.reason.message
					: String(result.reason),
			);
		}
	}

	const uniqueItems = filterItemsBySinceHours(dedupeItems(items), sinceHours);

	uniqueItems.sort((a, b) => {
		const aTime = a.date ? new Date(a.date).getTime() : 0;
		const bTime = b.date ? new Date(b.date).getTime() : 0;
		return bTime - aTime;
	});

	return { items: uniqueItems, errors };
}

export function normalizeItem(item: RssItem, feed: Feed): NewsItem {
	const date = normalizeDate(item.pubDate);
	const sourceId =
		item.guid || item.link || `${feed.key}:${item.title}:${item.pubDate}`;
	const id = crypto
		.createHash("sha1")
		.update(sourceId)
		.digest("hex")
		.slice(0, 10);

	return {
		id,
		guid: item.guid ?? "",
		title: item.title || "(untitled)",
		link: item.link ?? "",
		date,
		rawDate: item.pubDate ?? "",
		description: item.description ?? "",
		category: feed.category,
		source: feed.key,
		sourceLabel: feed.label,
		feedUrl: feed.url,
		author: item.author ?? "",
		itemCategory: item.category ?? "",
		categories: [feed.category],
		sources: [feed.key],
	};
}

interface NewsApiArticle {
	title?: unknown;
	url?: unknown;
	publishedAt?: unknown;
	description?: unknown;
	author?: unknown;
	source?:
		| {
				name?: unknown;
		  }
		| null
		| unknown;
}

export function normalizeNewsApiItem(article: unknown, feed: Feed): NewsItem {
	const a =
		typeof article === "object" && article !== null
			? (article as NewsApiArticle)
			: {};

	const title = safeString(a.title) || "(untitled)";
	const url = safeString(a.url);
	const publishedAt = safeString(a.publishedAt);
	const description = safeString(a.description);
	const author = safeString(a.author);
	let sourceName = "";
	if (
		typeof a.source === "object" &&
		a.source !== null &&
		!Array.isArray(a.source)
	) {
		const srcObj = a.source as { name?: unknown };
		sourceName = safeString(srcObj.name);
	}

	const date = normalizeDate(publishedAt);
	const sourceId = url || `${feed.key}:${title}:${publishedAt}`;
	const id = crypto
		.createHash("sha1")
		.update(sourceId)
		.digest("hex")
		.slice(0, 10);

	return {
		id,
		guid: url,
		title,
		link: url,
		date,
		rawDate: publishedAt,
		description,
		category: feed.category,
		source: feed.key,
		sourceLabel: sourceName || feed.label,
		feedUrl: feed.url,
		author,
		itemCategory: "",
		categories: [feed.category],
		sources: [feed.key],
	};
}

function safeString(value: unknown): string {
	if (typeof value === "string") return value;
	if (value === null || value === undefined) return "";
	return String(value);
}

export function dedupeItems(items: NewsItem[]): NewsItem[] {
	const byId = new Map<string, NewsItem>();

	for (const item of items) {
		const existing = byId.get(item.id);
		if (!existing) {
			byId.set(item.id, {
				...item,
				categories: [item.category],
				sources: [item.source],
			});
			continue;
		}

		if (!existing.categories.includes(item.category)) {
			existing.categories.push(item.category);
		}
		if (!existing.sources.includes(item.source)) {
			existing.sources.push(item.source);
		}

		existing.category = existing.categories.join(",");
		existing.source = existing.sources.join(",");
	}

	return Array.from(byId.values());
}

export function filterItemsBySinceHours(
	items: NewsItem[],
	sinceHours?: number,
	now = Date.now(),
): NewsItem[] {
	if (!sinceHours) {
		return items;
	}

	const cutoff = now - sinceHours * 60 * 60 * 1000;
	return items.filter((item) => {
		const timestamp = item.date ? new Date(item.date).getTime() : 0;
		return Number.isFinite(timestamp) && timestamp >= cutoff;
	});
}

export function normalizeDate(value?: string): string {
	if (!value) {
		return "";
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toISOString();
}
