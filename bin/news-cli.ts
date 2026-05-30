#!/usr/bin/env bun

import { run } from "../src/cli";
import { logError } from "../src/logger";

run(process.argv.slice(2)).catch((error) => {
	logError(error.message);
	process.exitCode = 1;
});
