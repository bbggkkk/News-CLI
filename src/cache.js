import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PRIMARY_CACHE_DIR = path.join(os.homedir(), ".cache", "news-cli");
const FALLBACK_CACHE_DIR = path.join(process.cwd(), ".news-cli-cache");

export async function saveItems(items) {
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

export async function loadItems() {
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

async function writeCache(cacheDir, payload) {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, "items.json"), payload);
}

async function readCache(cacheDir) {
  try {
    const raw = await fs.readFile(path.join(cacheDir, "items.json"), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT" || canFallback(error)) {
      return null;
    }
    throw error;
  }
}

function canFallback(error) {
  return ["EACCES", "EPERM", "EROFS", "ENOENT"].includes(error.code);
}
