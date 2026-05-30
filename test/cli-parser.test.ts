import { describe, expect, test } from "bun:test";
import { parseArgs } from "../src/interfaces/cli/parser";

describe("parseArgs", () => {
	test("parses basic command without options", () => {
		const { command, options, args } = parseArgs(["latest"]);
		expect(command).toBe("latest");
		expect(options.limit).toBe(30);
		expect(args).toEqual([]);
	});

	test("default command is latest", () => {
		const { command } = parseArgs([]);
		expect(command).toBe("latest");
	});

	test("parses limit option", () => {
		const { options } = parseArgs(["latest", "--limit", "15"]);
		expect(options.limit).toBe(15);
	});

	test("throws on non-integer limit", () => {
		expect(() => parseArgs(["latest", "--limit", "abc"])).toThrow();
	});

	test("parses search query and options", () => {
		const { command, args, options } = parseArgs([
			"search",
			"삼성전자",
			"--site",
			"mk.co.kr",
			"--limit",
			"10",
		]);
		expect(command).toBe("search");
		expect(args).toEqual(["삼성전자"]);
		expect(options.site).toBe("mk.co.kr");
		expect(options.limit).toBe(10);
	});

	test("parses exclude multiple times", () => {
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

	test("parses --after and --before", () => {
		const { options } = parseArgs([
			"search",
			"test",
			"--after",
			"2026-05-01",
			"--before",
			"2026-05-28",
		]);
		expect(options.after).toBe("2026-05-01");
		expect(options.before).toBe("2026-05-28");
	});

	test("throws on unknown flag", () => {
		expect(() => parseArgs(["latest", "--foo-bar"])).toThrow();
	});

	test("parses --json, --timeout, --no-cache", () => {
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

	test("parses global --version vs upgrade --version", () => {
		expect(parseArgs(["--version"]).options.showVersion).toBeTrue();
		expect(parseArgs(["-V"]).options.showVersion).toBeTrue();
		const upgradeRes = parseArgs(["upgrade", "--version", "v0.3.0"]);
		expect(upgradeRes.command).toBe("upgrade");
		expect(upgradeRes.options.version).toBe("v0.3.0");
		expect(upgradeRes.options.showVersion).toBeFalse();
	});

	test("parses --since-hours", () => {
		const { options } = parseArgs(["latest", "--since-hours", "6"]);
		expect(options.sinceHours).toBe(6);
	});

	test("parses --phrase", () => {
		const { options } = parseArgs(["search", "test", "--phrase", "exact phrase"]);
		expect(options.phrase).toBe("exact phrase");
	});
});
