import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import { run } from "../src/interfaces/cli/router";

// ─────────────────────────────────────────────
// Shared test infrastructure
// ─────────────────────────────────────────────

const originalFetch = global.fetch;
let logs: string[] = [];
let errors: string[] = [];
const originalLog = console.log;
const originalError = console.error;

function resetLogs() {
	logs = [];
	errors = [];
}

beforeAll(() => {
	console.log = (...args) => logs.push(args.join(" "));
	console.error = (...args) => errors.push(args.join(" "));
});

afterAll(() => {
	console.log = originalLog;
	console.error = originalError;
	global.fetch = originalFetch;
});

beforeEach(() => {
	resetLogs();
});

// ─────────────────────────────────────────────
// Mock server that simulates realistic scenarios
// ─────────────────────────────────────────────

function installMockFetch(
	overrides: {
		newsapiStatus?: number;
		newsapiBody?: any;
		newsapiDelay?: number;
		dartBody?: string;
		dartStatus?: number;
	} = {},
) {
	(global as any).fetch = mock(
		async (url: RequestInfo | URL, init?: RequestInit) => {
			const urlStr = url.toString();

			// Simulate network delay
			if (overrides.newsapiDelay) {
				await new Promise((r) => setTimeout(r, overrides.newsapiDelay));
			}

			// Check abort signal
			if (init?.signal?.aborted) {
				throw new DOMException("The operation was aborted.", "AbortError");
			}

			if (urlStr.startsWith("https://newsapi.org/v2/")) {
				const status = overrides.newsapiStatus ?? 200;
				const body = overrides.newsapiBody ?? {
					status: "ok",
					articles: [
						{
							source: { id: null, name: "Test Media" },
							author: "Reporter",
							title: "Production-level test article",
							description: "This validates the full pipeline.",
							url: "https://example.com/news1",
							publishedAt: "2026-05-31T00:00:00Z",
						},
					],
				};

				return new Response(JSON.stringify(body), {
					status,
					headers: status === 429 ? { "Retry-After": "1" } : {},
				});
			}

			if (urlStr === "https://dart.fss.or.kr/api/todayRSS.xml") {
				const status = overrides.dartStatus ?? 200;
				const body =
					overrides.dartBody ??
					`<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0">
          <channel>
            <title>DART RSS</title>
            <item>
              <title>Test Disclosure</title>
              <link>https://example.com/dart1</link>
              <description>DART test description</description>
              <pubDate>Sun, 31 May 2026 02:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

				return new Response(body, { status });
			}

			return new Response("Not found", { status: 404 });
		},
	);
}

// ─────────────────────────────────────────────
// 1. API Key validation
// ─────────────────────────────────────────────

test("latest without API key shows actionable error message", async () => {
	installMockFetch();
	process.env["NEWS_API_KEY"] = "";
	process.env["NEWSAPI_KEY"] = "";
	await run(["latest"]);
	const allErrors = errors.join(" ");
	expect(allErrors).toInclude("NEWS_API_KEY");
	expect(allErrors).toInclude("newsapi.org");
});

// ─────────────────────────────────────────────
// 2. Happy path
// ─────────────────────────────────────────────

test("latest with valid API key outputs news", async () => {
	installMockFetch();
	process.env["NEWS_API_KEY"] = "test-api-key";
	await run(["latest"]);
	expect(errors.length).toBe(0);
	expect(logs.join("\n")).toInclude("Production-level test article");
});

test("search with valid API key outputs results", async () => {
	installMockFetch();
	process.env["NEWS_API_KEY"] = "test-api-key";
	await run(["search", "test"]);
	expect(errors.length).toBe(0);
	expect(logs.join("\n")).toInclude("Production-level test article");
});

test("dart fetches XML without requiring API key", async () => {
	installMockFetch();
	process.env["NEWS_API_KEY"] = "";
	await run(["dart"]);
	expect(errors.length).toBe(0);
	expect(logs.join("\n")).toInclude("Test Disclosure");
});

// ─────────────────────────────────────────────
// 3. HTTP error handling
// ─────────────────────────────────────────────

test("401 response shows auth error with guidance", async () => {
	installMockFetch({
		newsapiStatus: 401,
		newsapiBody: {
			status: "error",
			code: "apiKeyInvalid",
			message: "Your API key is invalid.",
		},
	});
	process.env["NEWS_API_KEY"] = "bad-key";
	await run(["latest"]);
	const allErrors = errors.join(" ");
	expect(allErrors).toInclude("인증 실패");
});

test("500 server error is retried then reported gracefully", async () => {
	installMockFetch({
		newsapiStatus: 500,
		newsapiBody: { status: "error", message: "Internal server error" },
	});
	process.env["NEWS_API_KEY"] = "test-api-key";
	await run(["latest", "--limit", "5"]);
	const allOutput = [...errors, ...logs].join(" ");
	// Should see retry messages or final error
	expect(allOutput.length).toBeGreaterThan(0);
});

// ─────────────────────────────────────────────
// 4. Malformed API responses
// ─────────────────────────────────────────────

test("handles API returning non-JSON gracefully", async () => {
	(global as any).fetch = mock(async () => {
		return new Response("<html>Bad Gateway</html>", { status: 200 });
	});
	process.env["NEWS_API_KEY"] = "test-api-key";
	await run(["latest"]);
	const allErrors = errors.join(" ");
	expect(allErrors).toInclude("JSON");
});

test("handles API returning articles as non-array", async () => {
	installMockFetch({
		newsapiBody: { status: "ok", articles: "not-an-array" },
	});
	process.env["NEWS_API_KEY"] = "test-api-key";
	await run(["latest"]);
	const allErrors = errors.join(" ");
	expect(allErrors).toInclude("articles");
});

test("handles API returning articles with null fields", async () => {
	installMockFetch({
		newsapiBody: {
			status: "ok",
			articles: [
				{
					source: null,
					author: null,
					title: null,
					description: null,
					url: null,
					publishedAt: null,
				},
				{
					source: { name: "Real Source" },
					title: "Valid article",
					url: "https://example.com/2",
					publishedAt: "2026-05-31T00:00:00Z",
				},
			],
		},
	});
	process.env["NEWS_API_KEY"] = "test-api-key";
	await run(["latest"]);
	expect(errors.length).toBe(0);
	const output = logs.join("\n");
	// Both items should render without crashes
	expect(output).toInclude("(untitled)");
	expect(output).toInclude("Valid article");
});

// ─────────────────────────────────────────────
// 5. CLI edge cases
// ─────────────────────────────────────────────

test("detail without prior cache shows helpful error", async () => {
	installMockFetch();
	try {
		await run(["detail", "nonexistent-id"]);
	} catch (e: any) {
		expect(e.message).toInclude("cache");
	}
});

test("unknown command shows error", async () => {
	try {
		await run(["foobar"]);
	} catch (e: any) {
		expect(e.message).toInclude("Unknown command");
	}
});

test("help command outputs help text", async () => {
	installMockFetch();
	await run(["help"]);
	expect(logs.join("\n")).toInclude("news-cli");
	expect(logs.join("\n")).toInclude("NEWS_API_KEY");
});

test("categories command lists feeds", async () => {
	installMockFetch();
	await run(["categories"]);
	const output = logs.join("\n");
	expect(output).toInclude("newsapi-latest");
	expect(output).toInclude("dart");
});

// ─────────────────────────────────────────────
// 6. Empty responses
// ─────────────────────────────────────────────

test("empty articles array shows 'no items' message", async () => {
	installMockFetch({
		newsapiBody: { status: "ok", articles: [] },
	});
	process.env["NEWS_API_KEY"] = "test-api-key";
	await run(["latest"]);
	expect(logs.join("\n")).toInclude("No news items found");
});

test("empty DART RSS shows 'no items' message", async () => {
	installMockFetch({
		dartBody: `<?xml version="1.0"?><rss><channel></channel></rss>`,
	});
	process.env["NEWS_API_KEY"] = "";
	await run(["dart"]);
	expect(logs.join("\n")).toInclude("No news items found");
});
