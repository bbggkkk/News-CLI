/**
 * Centralized logging utility to ensure consistent stdout/stderr separation.
 */

let isJsonMode = false;

export function setJsonMode(json: boolean): void {
	isJsonMode = json;
}

export function logInfo(message: string): void {
	// Direct stdout output (for user-facing lists, detail views, help text, etc.)
	console.log(message);
}

export function logWarn(message: string): void {
	// Stderr warning: only print if not in JSON mode to prevent cluttering output
	if (!isJsonMode) {
		console.error(`Warning: ${message}`);
	}
}

export function logError(message: string): void {
	// Stderr error: always print errors, even in JSON mode, but formatted cleanly
	console.error(`Error: ${message}`);
}
