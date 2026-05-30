/**
 * Safe, robust access to environment variables, ensuring values are trimmed.
 */
export function getEnv(key: string): string | undefined {
	const value = process.env[key];
	return value !== undefined ? value.trim() : undefined;
}
