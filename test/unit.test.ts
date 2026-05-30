import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	loadHistory,
	loadItems,
	saveHistoryEntry,
	saveItems,
} from "../src/cache.ts";
import { parseArgs } from "../src/cli.ts";
import { getEnv } from "../src/env.ts";
import {
	buildReleaseAssetUrl,
	buildSkillUrl,
	getAssetName,
	resolveBinaryPath,
	resolveSkillDirs,
} from "../src/upgrade.ts";
import { validateUrl } from "../src/url.ts";

describe("cache module", () => {
	const primaryCacheFile = path.join(
		os.homedir(),
		".cache",
		"news-cli",
		"items.json",
	);
	const fallbackCacheFile = path.join(
		process.cwd(),
		".news-cli-cache",
		"items.json",
	);

	// Keep backup of existing cache if any
	let primaryBackup: string | null = null;
	let fallbackBackup: string | null = null;

	beforeAll(async () => {
		try {
			primaryBackup = await fs.readFile(primaryCacheFile, "utf8");
		} catch {}
		try {
			fallbackBackup = await fs.readFile(fallbackCacheFile, "utf8");
		} catch {}
	});

	afterAll(async () => {
		// Restore backups
		if (primaryBackup) {
			await fs.mkdir(path.dirname(primaryCacheFile), { recursive: true });
			await fs.writeFile(primaryCacheFile, primaryBackup);
		} else {
			await fs.rm(primaryCacheFile, { force: true }).catch(() => {});
		}

		if (fallbackBackup) {
			await fs.mkdir(path.dirname(fallbackCacheFile), { recursive: true });
			await fs.writeFile(fallbackCacheFile, fallbackBackup);
		} else {
			await fs.rm(fallbackCacheFile, { force: true }).catch(() => {});
		}
	});

	test("can save and load items", async () => {
		const dummyItems = [
			{
				id: "abc",
				guid: "abc",
				title: "Test Item",
				link: "https://example.com/test",
				date: "2026-05-31T00:00:00Z",
				rawDate: "Sun, 31 May 2026 00:00:00 GMT",
				description: "Test description",
				category: "latest",
				source: "newsapi-latest",
				sourceLabel: "NewsAPI",
				feedUrl: "https://newsapi.org",
				author: "Author",
				itemCategory: "",
				categories: ["latest"],
				sources: ["newsapi-latest"],
			},
		];

		await saveItems(dummyItems);
		const loaded = await loadItems();
		expect(loaded.items).toHaveLength(1);
		const firstLoaded = loaded.items[0];
		expect(firstLoaded).toBeDefined();
		expect(firstLoaded!.id).toBe("abc");
		expect(firstLoaded!.title).toBe("Test Item");
	});

	test("handles corrupt cache gracefully by returning empty payload", async () => {
		// Corrupt the fallback cache file
		await fs.mkdir(path.dirname(fallbackCacheFile), { recursive: true });
		await fs.writeFile(fallbackCacheFile, "{ corrupt json ... }");

		// Also corrupt primary cache to make sure loadItems reaches fallback
		await fs.mkdir(path.dirname(primaryCacheFile), { recursive: true });
		await fs.writeFile(primaryCacheFile, "{ corrupt json ... }");

		const loaded = await loadItems();
		expect(loaded.items).toHaveLength(0);
	});
});

describe("env module", () => {
	test("trims environmental variables", () => {
		process.env["TEST_KEY_TRIM"] = "  some-value-with-spaces  \n";
		expect(getEnv("TEST_KEY_TRIM")).toBe("some-value-with-spaces");
		delete process.env["TEST_KEY_TRIM"];
	});

	test("returns undefined for unset variables", () => {
		expect(getEnv("NONEXISTENT_ENV_VAR")).toBeUndefined();
	});
});

describe("cli parseArgs edge cases", () => {
	test("parses basic command without options", () => {
		const { command, options, args } = parseArgs(["latest"]);
		expect(command).toBe("latest");
		expect(options.limit).toBe(30);
		expect(args).toEqual([]);
	});

	test("parses limit option correctly", () => {
		const { options } = parseArgs(["latest", "--limit", "15"]);
		expect(options.limit).toBe(15);
	});

	test("throws error on non-integer limit", () => {
		expect(() => parseArgs(["latest", "--limit", "abc"])).toThrow();
	});

	test("throws error on negative limit", () => {
		expect(() => parseArgs(["latest", "--limit", "-5"])).toThrow();
	});

	test("parses search query correctly", () => {
		const { command, args, options } = parseArgs([
			"search",
			"foo",
			"bar",
			"--site",
			"example.com",
		]);
		expect(command).toBe("search");
		expect(args).toEqual(["foo", "bar"]);
		expect(options.site).toBe("example.com");
	});

	test("parses exclude and other parameters correctly", () => {
		const { options } = parseArgs([
			"search",
			"foo",
			"--exclude",
			"bad",
			"--exclude",
			"worst",
		]);
		expect(options.exclude).toEqual(["bad", "worst"]);
	});

	test("throws error on unknown flag", () => {
		expect(() => parseArgs(["latest", "--foo-bar-flag"])).toThrow();
	});

	test("parses timeout and json flags correctly", () => {
		const { options } = parseArgs([
			"latest",
			"--json",
			"--timeout",
			"5000",
			"--no-cache",
		]);
		expect(options.json).toBeTrue();
		expect(options.timeoutMs).toBe(5000);
		expect(options.noCache).toBeTrue();
	});

	test("parses global --version vs upgrade --version correctly", () => {
		const globalRes = parseArgs(["--version"]);
		expect(globalRes.options.showVersion).toBeTrue();

		const globalResV = parseArgs(["-V"]);
		expect(globalResV.options.showVersion).toBeTrue();

		const upgradeRes = parseArgs(["upgrade", "--version", "v0.3.0"]);
		expect(upgradeRes.command).toBe("upgrade");
		expect(upgradeRes.options.version).toBe("v0.3.0");
		expect(upgradeRes.options.showVersion).toBeFalse();
	});
});

describe("upgrade helpers", () => {
	test("getAssetName maps platforms and architectures correctly", () => {
		expect(getAssetName("linux", "x64")).toBe("news-cli-linux-x64");
		expect(getAssetName("darwin", "arm64")).toBe("news-cli-darwin-arm64");
		expect(() => getAssetName("win32", "x64")).toThrow();
	});

	test("buildReleaseAssetUrl formats URL", () => {
		expect(buildReleaseAssetUrl("asset-name", "v1.0.0")).toContain(
			"/download/v1.0.0/asset-name",
		);
		expect(buildReleaseAssetUrl("asset-name", "latest")).toContain(
			"/latest/download/asset-name",
		);
	});

	test("buildSkillUrl formats URL", () => {
		expect(buildSkillUrl("v1.0.0")).toContain(
			"/v1.0.0/skills/news-cli/SKILL.md",
		);
		expect(buildSkillUrl("latest")).toContain("/main/skills/news-cli/SKILL.md");
	});

	test("resolveBinaryPath honors option and environment variables", () => {
		process.env["NEWS_CLI_BIN"] = "/custom/bin/news-cli";
		expect(resolveBinaryPath()).toBe("/custom/bin/news-cli");
		delete process.env["NEWS_CLI_BIN"];

		expect(resolveBinaryPath("/some/dir")).toBe(
			path.join("/some/dir", "news-cli"),
		);
	});

	test("resolveSkillDirs resolves skill paths correctly", () => {
		const dirs = resolveSkillDirs({
			skillDir: "/custom/skill",
			codexSkillDir: "/custom/codex",
			hermesSkillDir: "/custom/hermes",
		});
		expect(dirs).toContain(path.resolve("/custom/codex"));
		expect(dirs).toContain(path.resolve("/custom/hermes"));
	});
});

describe("url validation", () => {
	test("allows correct whitelist domains with HTTPS", () => {
		expect(() =>
			validateUrl("https://newsapi.org/v2/everything", [
				"newsapi.org",
				"dart.fss.or.kr",
			]),
		).not.toThrow();
		expect(() =>
			validateUrl("https://subdomain.dart.fss.or.kr/rss", [
				"newsapi.org",
				"dart.fss.or.kr",
			]),
		).not.toThrow();
	});

	test("throws error on non-HTTPS protocols", () => {
		expect(() =>
			validateUrl("http://newsapi.org/v2/everything", [
				"newsapi.org",
				"dart.fss.or.kr",
			]),
		).toThrow(/HTTPS/);
	});

	test("throws error on non-whitelisted domains", () => {
		expect(() =>
			validateUrl("https://malicious.com/everything", [
				"newsapi.org",
				"dart.fss.or.kr",
			]),
		).toThrow(/allowed whitelist/);
	});

	test("throws error on invalid URLs", () => {
		expect(() =>
			validateUrl("not-a-valid-url", ["newsapi.org", "dart.fss.or.kr"]),
		).toThrow(/Invalid URL format/);
	});
});

describe("history log", () => {
	test("can save and load history entries", async () => {
		const dummyEntry = {
			timestamp: new Date().toISOString(),
			feedKey: "test-feed",
			feedLabel: "Test Feed",
			url: "https://newsapi.org/v2/test",
			status: "success" as const,
			itemCount: 5,
		};

		await saveHistoryEntry(dummyEntry);
		const history = await loadHistory();
		expect(history.length).toBeGreaterThanOrEqual(1);

		const found = history.find((e) => e.feedKey === "test-feed");
		expect(found).toBeDefined();
		expect(found!.feedLabel).toBe("Test Feed");
		expect(found!.itemCount).toBe(5);
		expect(found!.status).toBe("success");
	});
});
