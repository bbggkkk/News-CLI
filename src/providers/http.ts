import { AppError, ErrorCode } from "../core/errors";
import type { Feed } from "../core/feed";
import {
	type NewsItem,
	normalizeItem,
	normalizeNewsApiItem,
} from "../core/news-item";
import { VERSION } from "../lib/version";
import { getEnv } from "./config";
import { parseRss } from "./xml";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1_000;

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterHeader(response: Response): number | undefined {
	const retryAfter = response.headers.get("retry-after");
	if (!retryAfter) return undefined;
	const seconds = Number(retryAfter);
	if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
	const date = new Date(retryAfter);
	if (!Number.isNaN(date.getTime())) {
		const delayMs = date.getTime() - Date.now();
		return delayMs > 0 ? delayMs : undefined;
	}
	return undefined;
}

function validateUrl(urlStr: string, allowedDomains: string[]): void {
	let url: URL;
	try {
		url = new URL(urlStr);
	} catch {
		throw new AppError(
			ErrorCode.INVALID_INPUT,
			`Invalid URL format: "${urlStr}"`,
		);
	}
	if (url.protocol !== "https:") {
		throw new AppError(
			ErrorCode.INVALID_INPUT,
			`Security error: Only HTTPS is allowed. URL: "${urlStr}"`,
		);
	}
	const hostname = url.hostname.toLowerCase();
	const isAllowed = allowedDomains.some((domain) => {
		const d = domain.toLowerCase();
		return hostname === d || hostname.endsWith(`.${d}`);
	});
	if (!isAllowed) {
		throw new AppError(
			ErrorCode.INVALID_INPUT,
			`Security error: Domain "${url.hostname}" is not in the allowed whitelist.`,
		);
	}
}

export async function fetchFeed(
	feed: Feed,
	{
		timeoutMs = DEFAULT_TIMEOUT_MS,
		maxRetries = DEFAULT_MAX_RETRIES,
	}: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<NewsItem[]> {
	let lastError: AppError | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fetchFeedOnce(feed, timeoutMs);
		} catch (error) {
			if (error instanceof AppError) {
				lastError = error;
				if (error.isAuthError) throw error;
				if (error.isRetryable && attempt < maxRetries) {
					const baseDelay =
						error.retryAfterMs ?? RETRY_BASE_DELAY_MS * 2 ** attempt;
					const jitter = Math.random() * 500;
					const delayMs = Math.min(baseDelay + jitter, 30_000);
					await sleep(delayMs);
					continue;
				}
				if (attempt >= maxRetries) break;
			}
			if (error instanceof AppError) lastError = error;
			else {
				lastError = new AppError(ErrorCode.UNKNOWN, String(error));
			}
			if (attempt >= maxRetries) break;
		}
	}

	throw lastError ?? new AppError(ErrorCode.UNKNOWN, "Unknown fetch error");
}

async function fetchFeedOnce(
	feed: Feed,
	timeoutMs: number,
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
				throw new AppError(
					ErrorCode.AUTH_FAILED,
					'NEWS_API_KEY 환경 변수가 설정되지 않았습니다. NewsAPI 키를 발급받은 후 export NEWS_API_KEY="your-key" 를 실행하세요. 발급: https://newsapi.org/register',
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
			let message = `HTTP ${response.status} ${response.statusText}`;
			if (errorBody) {
				try {
					const parsed = JSON.parse(errorBody);
					if (parsed.message) message = `${message}: ${parsed.message}`;
				} catch {
					message =
						errorBody.length > 200
							? `${message}: ${errorBody.slice(0, 200)}...`
							: `${message}: ${errorBody}`;
				}
			}

			if (response.status === 401 || response.status === 403) {
				throw new AppError(
					ErrorCode.AUTH_FAILED,
					`인증 실패 (HTTP ${response.status}): NEWS_API_KEY 환경 변수를 확인하세요.`,
					{ statusCode: response.status },
				);
			}
			if (response.status === 429) {
				throw new AppError(
					ErrorCode.RATE_LIMITED,
					`요청 한도 초과 (429): 잠시 후 다시 시도하세요.`,
					{
						statusCode: 429,
						...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
					},
				);
			}
			if (response.status >= 500) {
				throw new AppError(
					ErrorCode.API_ERROR,
					`서버 오류 (${response.status}): ${response.statusText}`,
					{
						statusCode: response.status,
						...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
					},
				);
			}
			throw new AppError(ErrorCode.API_ERROR, message, {
				statusCode: response.status,
			});
		}

		let items: NewsItem[] = [];
		if (feed.type === "newsapi") {
			const text = await response.text();
			let json: any;
			try {
				json = JSON.parse(text);
			} catch {
				throw new AppError(
					ErrorCode.API_ERROR,
					`NewsAPI 응답을 JSON으로 파싱할 수 없습니다. 응답 앞 200자: ${text.slice(0, 200)}`,
				);
			}
			if (json.status !== "ok") {
				throw new AppError(
					ErrorCode.API_ERROR,
					`NewsAPI 오류 (${json.code || "unknown"}): ${json.message || "알 수 없는 오류"}`,
				);
			}
			if (!Array.isArray(json.articles)) {
				throw new AppError(
					ErrorCode.API_ERROR,
					`NewsAPI 응답의 articles 필드가 배열이 아닙니다.`,
				);
			}
			items = json.articles.map((article: unknown) =>
				normalizeNewsApiItem(article, feed),
			);
		} else {
			const xml = await response.text();
			if (xml.trim()) {
				items = parseRss(xml).map((item) => normalizeItem(item, feed));
			}
		}

		return items;
	} catch (error) {
		if (error instanceof AppError) throw error;
		if (error instanceof DOMException && error.name === "AbortError") {
			const reason = (controller.signal as any).reason;
			if (reason === "timeout") {
				throw new AppError(
					ErrorCode.NETWORK_ERROR,
					`${feed.label} 요청이 ${timeoutMs / 1000}초 내에 응답하지 않아 시간 초과되었습니다. 네트워크 상태를 확인하거나 --timeout 값을 늘려보세요.`,
				);
			}
			throw new AppError(
				ErrorCode.NETWORK_ERROR,
				`${feed.label} 요청이 중단되었습니다.`,
			);
		}
		throw classifyNetworkError(error, feed);
	} finally {
		clearTimeout(timer);
	}
}

function classifyNetworkError(error: unknown, feed: Feed): AppError {
	const err = error as {
		code?: string;
		message?: string;
		cause?: { code?: string };
	};
	const code = err.code || err.cause?.code;
	const message = err.message || "";

	if (code === "ENOTFOUND" || message.includes("ENOTFOUND")) {
		return new AppError(
			ErrorCode.NETWORK_ERROR,
			`네트워크 연결 오류: ${feed.label}의 도메인 주소를 찾을 수 없습니다. 인터넷 연결 상태를 확인하세요.`,
		);
	}
	if (code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
		return new AppError(
			ErrorCode.NETWORK_ERROR,
			`연결 거부 오류: ${feed.label} 서버가 응답하지 않습니다.`,
		);
	}
	if (code === "ETIMEDOUT" || message.includes("ETIMEDOUT")) {
		return new AppError(
			ErrorCode.NETWORK_ERROR,
			`연결 시간 초과: ${feed.label} 서버와의 연결 시간이 초과되었습니다.`,
		);
	}
	if (code === "EAI_AGAIN" || message.includes("EAI_AGAIN")) {
		return new AppError(
			ErrorCode.NETWORK_ERROR,
			`DNS 조회 오류: 임시적인 DNS 장애가 발생했습니다.`,
		);
	}
	return new AppError(ErrorCode.UNKNOWN, message || String(error));
}

export { validateUrl };
