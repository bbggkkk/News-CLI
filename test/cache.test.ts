import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { saveItems, loadItems, saveHistoryEntry, loadHistory } from "../src/providers/cache";
import type { NewsItem } from "../src/core/news-item";

const primaryCacheFile = path.join(os.homedir(), ".cache", "news-cli", "items.json");
const fallbackCacheFile = path.join(process.cwd(), ".news-cli-cache", "items.json");

let primaryBackup: string | null = null;
let fallbackBackup: string | null = null;

beforeAll(async () => {
  try { primaryBackup = await fs.readFile(primaryCacheFile, "utf8"); } catch {}
  try { fallbackBackup = await fs.readFile(fallbackCacheFile, "utf8"); } catch {}
});

afterAll(async () => {
  if (primaryBackup) {
    await fs.mkdir(path.dirname(primaryCacheFile), { recursive: true });
    await fs.writeFile(primaryCacheFile, primaryBackup);
  } else { await fs.rm(primaryCacheFile, { force: true }).catch(() => {}); }
  if (fallbackBackup) {
    await fs.mkdir(path.dirname(fallbackCacheFile), { recursive: true });
    await fs.writeFile(fallbackCacheFile, fallbackBackup);
  } else { await fs.rm(fallbackCacheFile, { force: true }).catch(() => {}); }
});

describe("cache", () => {
  test("can save and load items", async () => {
    const dummyItems: NewsItem[] = [{
      id: "abc", guid: "abc", title: "Test Item", link: "https://example.com", date: "2026-05-31T00:00:00Z", rawDate: "Sun, 31 May 2026 00:00:00 GMT", description: "Test", category: "latest", source: "newsapi-latest", sourceLabel: "NewsAPI", feedUrl: "https://newsapi.org", author: "", itemCategory: "", categories: ["latest"], sources: ["newsapi-latest"],
    }];
    await saveItems(dummyItems);
    const loaded = await loadItems();
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0]!.id).toBe("abc");
  });

  test("handles corrupt cache gracefully", async () => {
    await fs.mkdir(path.dirname(fallbackCacheFile), { recursive: true });
    await fs.writeFile(fallbackCacheFile, "{ corrupt json ... }");
    await fs.mkdir(path.dirname(primaryCacheFile), { recursive: true });
    await fs.writeFile(primaryCacheFile, "{ corrupt json ... }");
    const loaded = await loadItems();
    expect(loaded.items).toHaveLength(0);
  });

  test("can save and load history entries", async () => {
    await saveHistoryEntry({ timestamp: "2026-05-31T00:00:00Z", feedKey: "test", feedLabel: "Test", url: "https://example.com", status: "success", itemCount: 5 });
    const history = await loadHistory();
    const found = history.find((e) => e.feedKey === "test");
    expect(found).toBeDefined();
    expect(found!.itemCount).toBe(5);
  });
});
