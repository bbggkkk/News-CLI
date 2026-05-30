export type CliOptions = {
	category: string;
	limit: number;
	help: boolean;
	site: string;
	phrase: string;
	exclude: string[];
	after: string;
	before: string;
	sinceHours: number | undefined;
	version: string;
	installDir: string;
	skillDir: string;
	codexSkillDir: string;
	hermesSkillDir: string;
	json: boolean;
	timeoutMs: number | undefined;
	noCache: boolean;
	showVersion: boolean;
};

export type ParsedArgs = {
	command: string;
	options: CliOptions;
	args: string[];
	commandProvided: boolean;
};

export function parseArgs(argv: string[]): ParsedArgs {
	const tokens = [...argv];
	let command = "latest";
	let commandProvided = false;
	const args: string[] = [];
	const options: CliOptions = {
		category: "latest",
		limit: 30,
		help: false,
		site: "",
		phrase: "",
		exclude: [],
		after: "",
		before: "",
		sinceHours: undefined,
		version: "latest",
		installDir: "",
		skillDir: "",
		codexSkillDir: "",
		hermesSkillDir: "",
		json: false,
		timeoutMs: undefined,
		noCache: false,
		showVersion: false,
	};

	if (tokens[0] && !tokens[0].startsWith("-")) {
		command = tokens.shift() as string;
		commandProvided = true;
	}

	while (tokens.length > 0) {
		const token = tokens.shift() as string;

		if (token === "--help" || token === "-h") {
			options.help = true;
		} else if (token === "--category" || token === "-c") {
			options.category = requireValue(token, tokens.shift());
		} else if (token.startsWith("--category=")) {
			options.category = token.slice("--category=".length);
		} else if (token === "--limit" || token === "-l") {
			options.limit = parseLimit(requireValue(token, tokens.shift()));
		} else if (token.startsWith("--limit=")) {
			options.limit = parseLimit(token.slice("--limit=".length));
		} else if (token === "--site") {
			options.site = requireValue(token, tokens.shift());
		} else if (token.startsWith("--site=")) {
			options.site = token.slice("--site=".length);
		} else if (token === "--phrase") {
			options.phrase = requireValue(token, tokens.shift());
		} else if (token.startsWith("--phrase=")) {
			options.phrase = token.slice("--phrase=".length);
		} else if (token === "--exclude") {
			options.exclude.push(requireValue(token, tokens.shift()));
		} else if (token.startsWith("--exclude=")) {
			options.exclude.push(token.slice("--exclude=".length));
		} else if (token === "--after" || token === "--from") {
			options.after = parseDateFilter(requireValue(token, tokens.shift()));
		} else if (token.startsWith("--after=")) {
			options.after = parseDateFilter(token.slice("--after=".length));
		} else if (token.startsWith("--from=")) {
			options.after = parseDateFilter(token.slice("--from=".length));
		} else if (token === "--before" || token === "--to") {
			options.before = parseDateFilter(requireValue(token, tokens.shift()));
		} else if (token.startsWith("--before=")) {
			options.before = parseDateFilter(token.slice("--before=".length));
		} else if (token.startsWith("--to=")) {
			options.before = parseDateFilter(token.slice("--to=".length));
		} else if (token === "--since-hours") {
			options.sinceHours = parseSinceHours(requireValue(token, tokens.shift()));
		} else if (token.startsWith("--since-hours=")) {
			options.sinceHours = parseSinceHours(
				token.slice("--since-hours=".length),
			);
		} else if (token === "--version") {
			if (command === "upgrade") {
				options.version = requireValue(token, tokens.shift());
			} else {
				options.showVersion = true;
			}
		} else if (token.startsWith("--version=")) {
			if (command === "upgrade") {
				options.version = token.slice("--version=".length);
			} else {
				options.showVersion = true;
			}
		} else if (token === "--install-dir") {
			options.installDir = requireValue(token, tokens.shift());
		} else if (token.startsWith("--install-dir=")) {
			options.installDir = token.slice("--install-dir=".length);
		} else if (token === "--skill-dir") {
			options.skillDir = requireValue(token, tokens.shift());
		} else if (token.startsWith("--skill-dir=")) {
			options.skillDir = token.slice("--skill-dir=".length);
		} else if (token === "--codex-skill-dir") {
			options.codexSkillDir = requireValue(token, tokens.shift());
		} else if (token.startsWith("--codex-skill-dir=")) {
			options.codexSkillDir = token.slice("--codex-skill-dir=".length);
		} else if (token === "--hermes-skill-dir") {
			options.hermesSkillDir = requireValue(token, tokens.shift());
		} else if (token.startsWith("--hermes-skill-dir=")) {
			options.hermesSkillDir = token.slice("--hermes-skill-dir=".length);
		} else if (token === "--json") {
			options.json = true;
		} else if (token === "--timeout") {
			options.timeoutMs = parseTimeout(requireValue(token, tokens.shift()));
		} else if (token.startsWith("--timeout=")) {
			options.timeoutMs = parseTimeout(token.slice("--timeout=".length));
		} else if (token === "--no-cache") {
			options.noCache = true;
		} else if (token === "-V") {
			options.showVersion = true;
		} else if (token.startsWith("-")) {
			throw new Error(`Unknown option "${token}". Run "news-cli --help".`);
		} else {
			args.push(token);
		}
	}

	return { command, options, args, commandProvided };
}

function requireValue(option: string, value: string | undefined): string {
	if (!value || value.startsWith("-")) {
		throw new Error(`Option "${option}" requires a value.`);
	}
	return value;
}

function parseLimit(value: string): number {
	const limit = Number.parseInt(value, 10);
	if (!Number.isInteger(limit) || limit <= 0) {
		throw new Error(`Limit must be a positive integer. Received "${value}".`);
	}
	return limit;
}

function parseDateFilter(value: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new Error(`Date filters must use YYYY-MM-DD. Received "${value}".`);
	}

	const date = new Date(`${value}T00:00:00.000Z`);
	if (
		Number.isNaN(date.getTime()) ||
		date.toISOString().slice(0, 10) !== value
	) {
		throw new Error(`Invalid date filter: "${value}".`);
	}

	return value;
}

function parseSinceHours(value: string): number {
	const hours = Number(value);
	if (!Number.isFinite(hours) || hours <= 0) {
		throw new Error(
			`Since-hours must be a positive number. Received "${value}".`,
		);
	}

	return hours;
}

function parseTimeout(value: string): number {
	const ms = Number.parseInt(value, 10);
	if (!Number.isInteger(ms) || ms <= 0) {
		throw new Error(
			`Timeout must be a positive integer (milliseconds). Received "${value}".`,
		);
	}
	return ms;
}
