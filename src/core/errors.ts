export const ErrorCode = {
	AUTH_FAILED: "AUTH_FAILED",
	RATE_LIMITED: "RATE_LIMITED",
	API_ERROR: "API_ERROR",
	NETWORK_ERROR: "NETWORK_ERROR",
	INVALID_INPUT: "INVALID_INPUT",
	CACHE_MISS: "CACHE_MISS",
	UPGRADE_ERROR: "UPGRADE_ERROR",
	UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

type AppErrorOptions = {
	statusCode?: number;
	retryAfterMs?: number;
	cause?: Error;
};

export class AppError extends Error {
	readonly code: ErrorCode;
	readonly userMessage: string;
	readonly statusCode?: number;
	readonly retryAfterMs?: number;

	constructor(
		code: ErrorCode,
		userMessage: string,
		options: AppErrorOptions = {},
	) {
		super(userMessage, { cause: options.cause });
		this.name = "AppError";
		this.code = code;
		this.userMessage = userMessage;
		this.statusCode = options.statusCode;
		this.retryAfterMs = options.retryAfterMs;
	}

	get isAuthError(): boolean {
		return this.code === ErrorCode.AUTH_FAILED;
	}

	get isRateLimited(): boolean {
		return this.code === ErrorCode.RATE_LIMITED;
	}

	get isServerError(): boolean {
		return this.code === ErrorCode.API_ERROR && (this.statusCode ?? 0) >= 500;
	}

	get isRetryable(): boolean {
		return this.isRateLimited || this.isServerError;
	}
}
