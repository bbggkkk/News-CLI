import { beforeEach, describe, expect, test } from "bun:test";
import { Logger } from "../src/lib/logger";

describe("Logger", () => {
	const logs: string[] = [];
	const errors: string[] = [];
	const _origLog = console.log;
	const _origErr = console.error;

	beforeEach(() => {
		logs.length = 0;
		errors.length = 0;
		console.log = (...args) => logs.push(args.join(" "));
		console.error = (...args) => errors.push(args.join(" "));
	});

	test("info outputs to stdout", () => {
		const logger = new Logger({ json: false });
		logger.info("hello");
		expect(logs).toContain("hello");
	});

	test("warn outputs to stderr in human mode", () => {
		const logger = new Logger({ json: false });
		logger.warn("warning message");
		expect(errors).toContain("Warning: warning message");
	});

	test("warn is silent in JSON mode", () => {
		const logger = new Logger({ json: true });
		logger.warn("warning message");
		expect(errors).toHaveLength(0);
	});

	test("error always outputs to stderr", () => {
		const logger = new Logger({ json: true });
		logger.error("error message");
		const parsed = JSON.parse(errors[0]!);
		expect(parsed).toHaveProperty("level", "error");
		expect(parsed).toHaveProperty("message", "error message");
	});

	test("json mode outputs structured JSON for info", () => {
		const logger = new Logger({ json: true });
		logger.info("test");
		const parsed = JSON.parse(logs[0]!);
		expect(parsed).toHaveProperty("message", "test");
	});

	test("debug does not output at default info level", () => {
		const logger = new Logger({ json: false });
		logger.debug("debug message");
		expect(errors).toHaveLength(0);
	});

	test("debug outputs at debug level", () => {
		const logger = new Logger({ json: false, level: "debug" });
		logger.debug("debug message");
		expect(errors).toContain("[debug] debug message");
	});
});
