import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { NewsItem } from "./news";

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
  const payload = JSON.stringify({
    savedAt: new Date().toISOString(),
    items
  }, null, 2);

  try {
    await writeCache(PRIMARY_CACHE_DIR, payload);
  } catch (error) {
    if (!canFallback(error)) {
      throw error;
    }
    await writeCache(FALLBACK_CACHE_DIR, payload);
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

async function writeCache(cacheDir: string, payload: string): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, "items.json"), payload);
}

async function readCache(cacheDir: string): Promise<CachePayload | null> {
  try {
    const raw = await fs.readFile(path.join(cacheDir, "items.json"), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    const nodeError = error as NodeError;
    if (nodeError.code === "ENOENT" || canFallback(nodeError)) {
      return null;
    }
    throw error;
  }
}

function canFallback(error: unknown): boolean {
  return ["EACCES", "EPERM", "EROFS", "ENOENT"].includes((error as NodeError).code ?? "");
}
