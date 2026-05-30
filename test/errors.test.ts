import { describe, expect, test } from "bun:test";
import { AppError, ErrorCode } from "../src/core/errors";

describe("AppError", () => {
	test("creates error with code and userMessage", () => {
		const err = new AppError(
			ErrorCode.AUTH_FAILED,
			"API 키가 유효하지 않습니다",
			{ statusCode: 401 },
		);
		expect(err.code).toBe(ErrorCode.AUTH_FAILED);
		expect(err.userMessage).toBe("API 키가 유효하지 않습니다");
		expect(err.statusCode).toBe(401);
		expect(err.isAuthError).toBe(true);
		expect(err.isRetryable).toBe(false);
	});

	test("rate limited error is retryable", () => {
		const err = new AppError(ErrorCode.RATE_LIMITED, "요청 한도 초과", {
			statusCode: 429,
			retryAfterMs: 1000,
		});
		expect(err.isRateLimited).toBe(true);
		expect(err.isRetryable).toBe(true);
		expect(err.retryAfterMs).toBe(1000);
	});

	test("server error is retryable", () => {
		const err = new AppError(ErrorCode.API_ERROR, "서버 오류", {
			statusCode: 500,
		});
		expect(err.isServerError).toBe(true);
		expect(err.isRetryable).toBe(true);
	});

	test("network error is not retryable by default", () => {
		const err = new AppError(ErrorCode.NETWORK_ERROR, "네트워크 오류");
		expect(err.isRetryable).toBe(false);
	});

	test("error name is set correctly", () => {
		const err = new AppError(ErrorCode.INVALID_INPUT, "잘못된 입력");
		expect(err.name).toBe("AppError");
	});

	test("cause is propagated when provided", () => {
		const cause = new Error("원인 오류");
		const err = new AppError(ErrorCode.UNKNOWN, "알 수 없는 오류", { cause });
		expect(err.cause).toBe(cause);
	});

	test("all error codes are distinct", () => {
		const codes = new Set(Object.values(ErrorCode));
		expect(codes.size).toBe(Object.keys(ErrorCode).length);
	});
});
