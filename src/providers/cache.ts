import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { NewsItem } from "../core/news-item";

const PRIMARY_CACHE_DIR = path.join(os.homedir(), ".cache", "news-cli");
const FALLBACK_CACHE_DIR = path.join(process.cwd(), ".news-cli-cache");

type CachePayload = {
	savedAt: string;
	items: NewsItem[];
};

type NodeError = Error & {
	code?: string;
};

export async function saveItems(items: NewsItem[]): Promise<void> {
	const payload = JSON.stringify(
		{
			savedAt: new Date().toISOString(),
			items,
		},
		null,
		2,
	);

	try {
		await atomicWriteCache(PRIMARY_CACHE_DIR, payload);
	} catch (error) {
		if (!canFallback(error)) {
			throw error;
		}
		await atomicWriteCache(FALLBACK_CACHE_DIR, payload);
	}
}

export async function loadItems(): Promise<CachePayload> {
	const primary = await readCache(PRIMARY_CACHE_DIR);
	if (primary) {
		return primary;
	}

	const fallback = await readCache(FALLBACK_CACHE_DIR);
	if (fallback) {
		return fallback;
	}

	return { savedAt: "", items: [] };
}

async function atomicWriteCache(
	cacheDir: string,
	payload: string,
): Promise<void> {
	await fs.mkdir(cacheDir, { recursive: true });
	const target = path.join(cacheDir, "items.json");
	const tmp = path.join(cacheDir, `.items-${process.pid}.tmp`);

	try {
		await fs.writeFile(tmp, payload);
		await fs.rename(tmp, target);
	} catch (error) {
		await fs.rm(tmp, { force: true }).catch(() => {});
		throw error;
	}
}

async function readCache(cacheDir: string): Promise<CachePayload | null> {
	try {
		const raw = await fs.readFile(path.join(cacheDir, "items.json"), "utf8");
		return parseCachePayload(raw);
	} catch (error) {
		const nodeError = error as NodeError;
		if (nodeError.code === "ENOENT" || canFallback(nodeError)) {
			return null;
		}
		throw error;
	}
}

function parseCachePayload(raw: string): CachePayload | null {
	try {
		const parsed = JSON.parse(raw);

		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!Array.isArray(parsed.items)
		) {
			return null;
		}

		return parsed as CachePayload;
	} catch {
		return null;
	}
}

function canFallback(error: unknown): boolean {
	return ["EACCES", "EPERM", "EROFS", "ENOENT"].includes(
		(error as NodeError).code ?? "",
	);
}

export type HistoryEntry = {
	timestamp: string;
	feedKey: string;
	feedLabel: string;
	url: string;
	status: "success" | "failure";
	itemCount: number;
	errorMessage?: string;
};

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
	const historyFile = path.join(PRIMARY_CACHE_DIR, "history.json");
	const fallbackFile = path.join(FALLBACK_CACHE_DIR, "history.json");

	let history: HistoryEntry[] = [];
	let targetFile = historyFile;
	let targetDir = PRIMARY_CACHE_DIR;

	try {
		await fs.mkdir(PRIMARY_CACHE_DIR, { recursive: true });
	} catch (error) {
		if (canFallback(error)) {
			targetFile = fallbackFile;
			targetDir = FALLBACK_CACHE_DIR;
			await fs.mkdir(FALLBACK_CACHE_DIR, { recursive: true });
		} else {
			throw error;
		}
	}

	try {
		const raw = await fs.readFile(targetFile, "utf8");
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			history = parsed as HistoryEntry[];
		}
	} catch {}

	history.push(entry);
	if (history.length > 100) {
		history = history.slice(-100);
	}

	const tmp = path.join(targetDir, `.history-${process.pid}.tmp`);
	try {
		await fs.writeFile(tmp, JSON.stringify(history, null, 2));
		await fs.rename(tmp, targetFile);
	} catch (error) {
		await fs.rm(tmp, { force: true }).catch(() => {});
		throw error;
	}
}

export async function loadHistory(): Promise<HistoryEntry[]> {
	try {
		const raw = await fs.readFile(
			path.join(PRIMARY_CACHE_DIR, "history.json"),
			"utf8",
		);
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
	} catch {
		try {
			const raw = await fs.readFile(
				path.join(FALLBACK_CACHE_DIR, "history.json"),
				"utf8",
			);
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
		} catch {
			return [];
		}
	}
}
