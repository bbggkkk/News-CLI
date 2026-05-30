import { describe, expect, test } from "bun:test";
import { getEnv } from "../src/providers/config";

describe("getEnv", () => {
	test("trims environmental variables", () => {
		process.env["TEST_KEY_TRIM"] = "  some-value-with-spaces  \n";
		expect(getEnv("TEST_KEY_TRIM")).toBe("some-value-with-spaces");
		delete process.env["TEST_KEY_TRIM"];
	});

	test("returns undefined for unset variables", () => {
		expect(getEnv("NONEXISTENT_ENV_VAR")).toBeUndefined();
	});
});
