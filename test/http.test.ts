import { afterEach, expect, mock, test } from "bun:test";
import { AppError, ErrorCode } from "../src/core/errors";
import type { Feed } from "../src/core/feed";
import { fetchFeed } from "../src/providers/http";

const testFeed: Feed = {
	key: "test",
	category: "latest",
	label: "Test",
	url: "https://newsapi.org/v2/top-headlines?country=kr",
	type: "newsapi",
};
const originalFetch = global.fetch;

afterEach(() => {
	global.fetch = originalFetch;
	delete process.env["NEWS_API_KEY"];
	delete process.env["NEWSAPI_KEY"];
});

test("fetchFeed returns parsed NewsItem array on success", async () => {
	process.env["NEWS_API_KEY"] = "test-key";
	global.fetch = mock(() =>
		Promise.resolve(
			new Response(
				JSON.stringify({
					status: "ok",
					articles: [
						{
							title: "Test",
							url: "https://example.com",
							publishedAt: "2026-05-31T00:00:00Z",
						},
					],
				}),
				{ status: 200 },
			),
		),
	) as unknown as typeof fetch;
	const items = await fetchFeed(testFeed);
	expect(items).toHaveLength(1);
	expect(items[0]!.title).toBe("Test");
});

test("fetchFeed throws AppError with AUTH_FAILED on 401", async () => {
	process.env["NEWS_API_KEY"] = "bad-key";
	global.fetch = mock(() =>
		Promise.resolve(
			new Response(
				JSON.stringify({
					status: "error",
					code: "apiKeyInvalid",
					message: "Invalid",
				}),
				{ status: 401 },
			),
		),
	) as unknown as typeof fetch;
	try {
		await fetchFeed(testFeed);
		expect.unreachable();
	} catch (e) {
		expect(e).toBeInstanceOf(AppError);
		expect((e as AppError).code).toBe(ErrorCode.AUTH_FAILED);
	}
});

test("fetchFeed retries on 429 then throws", async () => {
	process.env["NEWS_API_KEY"] = "test-key";
	let calls = 0;
	global.fetch = mock(() => {
		calls++;
		return Promise.resolve(
			new Response(JSON.stringify({ status: "error", code: "rateLimited" }), {
				status: 429,
				headers: { "Retry-After": "0" },
			}),
		);
	}) as unknown as typeof fetch;
	try {
		await fetchFeed(testFeed, { maxRetries: 1 });
		expect.unreachable();
	} catch {
		expect(calls).toBe(2);
	}
});
