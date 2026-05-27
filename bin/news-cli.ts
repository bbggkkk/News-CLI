#!/usr/bin/env bun

import { run } from "../src/cli";

run(process.argv.slice(2)).catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
