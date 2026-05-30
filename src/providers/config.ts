import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { AppError, ErrorCode } from "../core/errors";

export type AppConfig = {
	defaultTimeoutMs: number;
	defaultLimit: number;
	newsApiKey: string | undefined;
};

export function getEnv(key: string): string | undefined {
	const value = process.env[key];
	return value !== undefined ? value.trim() : undefined;
}

export async function loadAppConfig(): Promise<AppConfig> {
	const config: AppConfig = {
		defaultTimeoutMs: 10_000,
		defaultLimit: 30,
		newsApiKey: getEnv("NEWS_API_KEY") || getEnv("NEWSAPI_KEY"),
	};

	const configPath = path.join(
		os.homedir(),
		".config",
		"news-cli",
		"config.json",
	);
	try {
		const raw = await fs.readFile(configPath, "utf8");
		const parsed = JSON.parse(raw);
		if (typeof parsed === "object" && parsed !== null) {
			if (typeof parsed.defaultTimeoutMs === "number")
				config.defaultTimeoutMs = parsed.defaultTimeoutMs;
			if (typeof parsed.defaultLimit === "number")
				config.defaultLimit = parsed.defaultLimit;
		}
	} catch {
		// Config file not found or invalid — use defaults
	}

	return config;
}

export function requireApiKey(config: AppConfig): string {
	if (!config.newsApiKey) {
		throw new AppError(
			ErrorCode.AUTH_FAILED,
			'NEWS_API_KEY 환경 변수가 설정되지 않았습니다. NewsAPI 키를 발급받은 후 export NEWS_API_KEY="your-key" 를 실행하세요. 발급: https://newsapi.org/register',
		);
	}
	return config.newsApiKey;
}
