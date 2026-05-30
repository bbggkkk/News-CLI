#!/usr/bin/env bun

import { run } from "../src/interfaces/cli/router";
import { Logger } from "../src/lib/logger";

run(process.argv.slice(2)).catch((error) => {
  const logger = new Logger({ json: process.argv.includes("--json") });
  logger.error(error.message);
  process.exitCode = 1;
});
