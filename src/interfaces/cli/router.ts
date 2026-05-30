import {
	buildSearchQuery,
	buildSearchUrl,
	createSearchFeed,
	feeds,
	getCategories,
	selectFeeds,
} from "../../core/feed";
import type { NewsItem } from "../../core/news-item";
import { Logger } from "../../lib/logger";
import { VERSION } from "../../lib/version";
import {
	loadHistory,
	loadItems,
	saveHistoryEntry,
	saveItems,
} from "../../providers/cache";
import { fetchFeed } from "../../providers/http";
import { selfUpgrade } from "../../upgrade";
import {
	formatCategories,
	formatDetail,
	formatHistory,
	formatJson,
	formatListItem,
} from "./formatter";
import { getHelpText, HELP_TEXT } from "./help";
import { type CliOptions, parseArgs } from "./parser";

export async function run(argv: string[]): Promise<void> {
	const { command, options, args, commandProvided } = parseArgs(argv);
	const logger = new Logger({ json: options.json });

	if (options.showVersion) {
		logger.info(`news-cli ${VERSION}`);
		return;
	}

	if (command === "help") {
		logger.info(getHelpText(args));
		return;
	}

	if (options.help) {
		logger.info(commandProvided ? getHelpText([command]) : HELP_TEXT);
		return;
	}

	if (command === "categories") {
		logger.info(formatCategories(feeds, getCategories()));
		return;
	}

	if (command === "detail") {
		await printDetail(args[0], options, logger);
		return;
	}

	if (command === "history") {
		await printHistory(options, logger);
		return;
	}

	if (command === "upgrade") {
		await runSelfUpgrade(options, logger);
		return;
	}

	if (command === "url") {
		printUrl(args, options, logger);
		return;
	}

	if (command === "search") {
		await printSearch(args, options, logger);
		return;
	}

	if (command === "dart" || command === "disclosure") {
		await printList({ ...options, category: "disclosure" }, logger);
		return;
	}

	if (command !== "latest" && command !== "list") {
		throw new Error(`Unknown command "${command}". Run "news-cli --help".`);
	}

	await printList(options, logger);
}

async function printList(options: CliOptions, logger: Logger): Promise<void> {
	const selectedFeeds = selectFeeds(
		options.category === "disclosure" ? "dart" : options.category,
	);
	const errors: string[] = [];
	const allItems: NewsItem[] = [];

	for (const feed of selectedFeeds) {
		try {
			const items = await fetchFeed(
				feed,
				options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {},
			);
			allItems.push(...items);
			await saveHistoryEntry({
				timestamp: new Date().toISOString(),
				feedKey: feed.key,
				feedLabel: feed.label,
				url: feed.url,
				status: "success",
				itemCount: items.length,
			}).catch(() => {});
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error));
			await saveHistoryEntry({
				timestamp: new Date().toISOString(),
				feedKey: feed.key,
				feedLabel: feed.label,
				url: feed.url,
				status: "failure",
				itemCount: 0,
				errorMessage: error instanceof Error ? error.message : String(error),
			}).catch(() => {});
		}
	}

	allItems.sort((a, b) => {
		const aTime = a.date ? new Date(a.date).getTime() : 0;
		const bTime = b.date ? new Date(b.date).getTime() : 0;
		return bTime - aTime;
	});

	await printOutput(allItems, errors, options, logger);
}

async function printSearch(
	args: string[],
	options: CliOptions,
	logger: Logger,
): Promise<void> {
	const feed = createSearchFeed({
		query: args.join(" "),
		site: options.site,
		phrase: options.phrase,
		exclude: options.exclude,
		after: options.after,
		before: options.before,
	});

	const errors: string[] = [];
	let allItems: NewsItem[] = [];

	try {
		allItems = await fetchFeed(
			feed,
			options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {},
		);
		await saveHistoryEntry({
			timestamp: new Date().toISOString(),
			feedKey: feed.key,
			feedLabel: feed.label,
			url: feed.url,
			status: "success",
			itemCount: allItems.length,
		}).catch(() => {});
	} catch (error) {
		errors.push(error instanceof Error ? error.message : String(error));
		await saveHistoryEntry({
			timestamp: new Date().toISOString(),
			feedKey: feed.key,
			feedLabel: feed.label,
			url: feed.url,
			status: "failure",
			itemCount: 0,
			errorMessage: error instanceof Error ? error.message : String(error),
		}).catch(() => {});
	}

	await printOutput(allItems, errors, options, logger);
}

async function printOutput(
	items: NewsItem[],
	errors: string[],
	options: CliOptions,
	logger: Logger,
): Promise<void> {
	const visibleItems = items.slice(0, options.limit);

	if (!options.noCache) {
		await saveItems(items);
	}

	if (options.json) {
		logger.info(
			formatJson(items, errors, {
				total: items.length,
				showing: visibleItems.length,
			}),
		);
		return;
	}

	if (errors.length > 0) {
		logger.warn(`${errors.length} feed(s) failed: ${errors.join("; ")}`);
	}

	if (visibleItems.length === 0) {
		logger.info("No news items found.");
		return;
	}

	for (const item of visibleItems) {
		logger.info(formatListItem(item));
	}
}

function printUrl(args: string[], options: CliOptions, logger: Logger): void {
	const subcommand = args.shift();
	if (subcommand !== "search")
		throw new Error('Only "news-cli url search ..." is supported.');
	const query = args.join(" ");
	const searchOptions = {
		query,
		site: options.site,
		phrase: options.phrase,
		exclude: options.exclude,
		after: options.after,
		before: options.before,
	};
	logger.info(`Query: ${buildSearchQuery(searchOptions)}`);
	logger.info(`URL: ${buildSearchUrl(searchOptions)}`);
}

async function printDetail(
	idOrUrl: string | undefined,
	options: CliOptions,
	logger: Logger,
): Promise<void> {
	if (!idOrUrl)
		throw new Error(
			"detail requires an item id or URL. Run latest/search first to populate the local cache.",
		);
	const cache = await loadItems();
	const item = cache.items.find(
		(c) => c.id === idOrUrl || c.link === idOrUrl || c.guid === idOrUrl,
	);
	if (!item)
		throw new Error(
			`Could not find "${idOrUrl}" in the local cache. Run "news-cli latest" or "news-cli search <query>" first, then use an id from the output.`,
		);
	if (options.json) {
		logger.info(JSON.stringify(item, null, 2));
		return;
	}
	logger.info(formatDetail(item));
}

async function printHistory(
	options: CliOptions,
	logger: Logger,
): Promise<void> {
	const history = await loadHistory();
	const sorted = [...history].reverse().slice(0, options.limit);
	if (options.json) {
		logger.info(JSON.stringify(sorted, null, 2));
		return;
	}
	if (sorted.length === 0) {
		logger.info("No API call history found.");
		return;
	}
	logger.info(formatHistory(sorted));
}

async function runSelfUpgrade(
	options: CliOptions,
	logger: Logger,
): Promise<void> {
	const result = await selfUpgrade({
		version: options.version,
		installDir: options.installDir,
		skillDir: options.skillDir,
		codexSkillDir: options.codexSkillDir,
		hermesSkillDir: options.hermesSkillDir,
		onProgress: (message) => console.error(message),
	});
	logger.info(`Installed news-cli (${result.version}) to ${result.binaryPath}`);
	for (const skillPath of result.skillPaths) {
		logger.info(`Installed skill to ${skillPath}`);
	}
}
