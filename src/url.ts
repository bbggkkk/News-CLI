/**
 * Security utility to validate URLs and prevent arbitrary protocol or SSRF vulnerabilities.
 */
export function validateUrl(urlStr: string, allowedDomains: string[]): void {
	let url: URL;
	try {
		url = new URL(urlStr);
	} catch {
		throw new Error(`Invalid URL format: "${urlStr}"`);
	}

	if (url.protocol !== "https:") {
		throw new Error(
			`Security error: Only secure HTTPS protocol is allowed. URL: "${urlStr}"`,
		);
	}

	const hostname = url.hostname.toLowerCase();
	const isAllowed = allowedDomains.some((domain) => {
		const d = domain.toLowerCase();
		return hostname === d || hostname.endsWith(`.${d}`);
	});

	if (!isAllowed) {
		throw new Error(
			`Security error: Domain "${url.hostname}" is not in the allowed whitelist.`,
		);
	}
}
