import { buildSearchQuery, buildSearchUrl, createSearchFeed, feeds, getCategories } from "./feeds";
import { collectNews, type NewsItem } from "./news";
import { loadItems, saveItems } from "./cache";
import { selfUpgrade } from "./upgrade";

const helpText = `news-cli

Usage:
  news-cli [latest] [--limit <n>] [--since-hours <n>]
  news-cli dart [--limit <n>] [--since-hours <n>]
  news-cli search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>] [--since-hours <n>] [--limit <n>]
  news-cli url search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>]
  news-cli categories
  news-cli detail <id-or-url>
  news-cli upgrade [--version <tag>] [--install-dir <path>] [--skill-dir <path>] [--hermes-skill-dir <path>]
  news-cli help [topic]

Commands:
  latest        Fetch Korean Google News latest RSS. Default command.
  dart          Fetch DART today disclosure RSS.
  search        Fetch Google News RSS search results.
  url search    Print the generated Google News RSS search URL.
  categories    Show fixed feeds and supported modes.
  detail        Show cached RSS details for a listed item.
  upgrade       Upgrade the binary and install/update Codex and Hermes skills.
  help          Show general help or command-specific help.

Help topics:
  latest, dart, search, url, categories, detail, upgrade

Examples:
  news-cli
  news-cli latest --limit 20
  news-cli dart --limit 20
  news-cli latest --since-hours 3
  news-cli search 삼성전자 --limit 10
  news-cli search 삼성전자 --since-hours 6
  news-cli search 삼성전자 --after 2026-05-01 --before 2026-05-28
  news-cli search 선거 --site example.com --phrase "여론조사" --exclude 광고
  news-cli url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머
  news-cli detail 1a2b3c4d5e
  news-cli upgrade
  news-cli upgrade --version v0.2.8
  news-cli help search
  news-cli help upgrade

Google News RSS:
  Latest: https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko
  Search: https://news.google.com/rss/search?q=(검색어)&hl=ko&gl=KR&ceid=KR%3Ako
  Date search adds after:YYYY-MM-DD and before:YYYY-MM-DD to the Google News query.

DART RSS:
  Disclosures: https://dart.fss.or.kr/api/todayRSS.xml

Environment for upgrade:
  NEWS_CLI_BIN          Exact binary path to replace.
  NEWS_CLI_INSTALL_DIR  Default install directory when NEWS_CLI_BIN is unset.
  NEWS_CLI_SKILL_DIR         Backward-compatible default Codex skill directory.
  NEWS_CLI_CODEX_SKILL_DIR   Default Codex skill directory.
  NEWS_CLI_HERMES_SKILL_DIR  Default Hermes skill directory.
`;

const commandHelp = {
  latest: `news-cli latest

Usage:
  news-cli [latest] [--limit <n>] [--since-hours <n>]

Fetches the Korean Google News latest RSS feed.

Options:
  --limit, -l <n>     Number of items to print. Default: 30
  --since-hours <n>   Only print RSS items published in the last N hours.

Example:
  news-cli latest --limit 20
  news-cli latest --since-hours 3`,

  dart: `news-cli dart

Usage:
  news-cli dart [--limit <n>] [--since-hours <n>]
  news-cli disclosure [--limit <n>] [--since-hours <n>]

Fetches today's DART disclosure RSS feed.

Options:
  --limit, -l <n>     Number of disclosure items to print. Default: 30
  --since-hours <n>   Only print RSS items published in the last N hours.

Example:
  news-cli dart --limit 20
  news-cli dart --since-hours 6`,

  search: `news-cli search

Usage:
  news-cli search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>] [--since-hours <n>] [--limit <n>]

Builds a Google News RSS search query and prints matching news.

Options:
  --site <domain>    Restrict results with site:<domain>.
  --phrase <text>    Add an exact phrase wrapped in quotes.
  --exclude <word>   Add an excluded word. Can be used multiple times.
  --after <date>     Add after:YYYY-MM-DD to the Google News query. Alias: --from
  --before <date>    Add before:YYYY-MM-DD to the Google News query. Alias: --to
  --since-hours <n>  Only print RSS items published in the last N hours.
  --limit, -l <n>    Number of items to print. Default: 30

Examples:
  news-cli search 삼성전자 --limit 10
  news-cli search 삼성전자 --since-hours 6
  news-cli search 삼성전자 --after 2026-05-01 --before 2026-05-28
  news-cli search 선거 --site example.com --phrase "여론조사" --exclude 광고`,

  url: `news-cli url

Usage:
  news-cli url search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>]

Prints the generated Google News RSS query and URL without fetching it.

Example:
  news-cli url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머
  news-cli url search 삼성전자 --after 2026-05-01 --before 2026-05-28`,

  categories: `news-cli categories

Usage:
  news-cli categories

Shows the fixed Google News feed and supported modes.`,

  detail: `news-cli detail

Usage:
  news-cli detail <id-or-url>

Shows the cached RSS details for an item from the last latest/search command.

Example:
  news-cli detail 1a2b3c4d5e`,

  upgrade: `news-cli upgrade

Usage:
  news-cli upgrade [--version <tag>] [--install-dir <path>] [--skill-dir <path>] [--hermes-skill-dir <path>]

Downloads the latest GitHub Release binary for this OS/architecture and installs the bundled Codex and Hermes skills.

Work performed:
  1. Selects the release asset for the current OS/architecture.
  2. Downloads the standalone binary with progress output.
  3. Replaces the installed news-cli binary.
  4. Downloads and installs the Codex and Hermes SKILL.md files.

Options:
  --version <tag>          Release tag to install. Default: latest
  --install-dir <path>     Install directory for news-cli. Default: current binary path, or ~/.local/bin
  --skill-dir <path>       Backward-compatible Codex skill directory. Default: ~/.codex/skills/news-cli
  --codex-skill-dir <path> Codex skill directory.
  --hermes-skill-dir <path> Hermes skill directory. Default: ~/.hermes/skills/news-cli

Environment:
  NEWS_CLI_BIN          Exact binary path to replace.
  NEWS_CLI_INSTALL_DIR  Default install directory when NEWS_CLI_BIN is unset.
  NEWS_CLI_SKILL_DIR          Backward-compatible default Codex skill directory.
  NEWS_CLI_CODEX_SKILL_DIR    Default Codex skill directory.
  NEWS_CLI_HERMES_SKILL_DIR   Default Hermes skill directory.

Example:
  news-cli upgrade
  news-cli upgrade --version v0.2.8`
};

type CliOptions = {
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
};

type ParsedArgs = {
  command: string;
  options: CliOptions;
  args: string[];
  commandProvided: boolean;
};

type HelpTopic = keyof typeof commandHelp;

export async function run(argv: string[]): Promise<void> {
  const { command, options, args, commandProvided } = parseArgs(argv);

  if (command === "help") {
    printHelp(args);
    return;
  }

  if (options.help) {
    if (!commandProvided) {
      printHelp([]);
    } else {
      printHelp(normalizeHelpCommand(command));
    }
    return;
  }

  if (command === "categories") {
    printCategories();
    return;
  }

  if (command === "detail") {
    await printDetail(args[0]);
    return;
  }

  if (command === "upgrade") {
    await runSelfUpgrade(options);
    return;
  }

  if (command === "url") {
    printUrl(args, options);
    return;
  }

  if (command === "search") {
    await printSearch(args, options);
    return;
  }

  if (command === "dart" || command === "disclosure") {
    await printList({ ...options, category: "dart" });
    return;
  }

  if (command !== "latest" && command !== "list") {
    throw new Error(`Unknown command "${command}". Run "news-cli --help".`);
  }

  await printList(options);
}

function parseArgs(argv: string[]): ParsedArgs {
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
    hermesSkillDir: ""
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
      options.sinceHours = parseSinceHours(token.slice("--since-hours=".length));
    } else if (token === "--version") {
      options.version = requireValue(token, tokens.shift());
    } else if (token.startsWith("--version=")) {
      options.version = token.slice("--version=".length);
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
    } else if (token.startsWith("-")) {
      throw new Error(`Unknown option "${token}". Run "news-cli --help".`);
    } else {
      args.push(token);
    }
  }

  return { command, options, args, commandProvided };
}

function printHelp(topic: string | string[]): void {
  const args = Array.isArray(topic) ? topic : [topic].filter(Boolean);
  if (args.length === 0) {
    console.log(helpText);
    return;
  }

  const key = normalizeHelpCommand(args[0]);
  const text = commandHelp[key];
  if (!text) {
    throw new Error(`Unknown help topic "${args.join(" ")}". Run "news-cli help".`);
  }

  console.log(text);
}

function normalizeHelpCommand(command: string): HelpTopic {
  if (command === "list") {
    return "latest";
  }
  if (command === "disclosure") {
    return "dart";
  }
  return command as HelpTopic;
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
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date filter: "${value}".`);
  }

  return value;
}

function parseSinceHours(value: string): number {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error(`Since-hours must be a positive number. Received "${value}".`);
  }

  return hours;
}

async function printList(options: CliOptions): Promise<void> {
  const { items, errors } = await collectNews({ category: options.category, sinceHours: options.sinceHours });
  await printItems(items, errors, options.limit);
}

async function printSearch(args: string[], options: CliOptions): Promise<void> {
  const feed = createSearchFeed({
    query: args.join(" "),
    site: options.site,
    phrase: options.phrase,
    exclude: options.exclude,
    after: options.after,
    before: options.before
  });
  const { items, errors } = await collectNews({ feed, sinceHours: options.sinceHours });
  await printItems(items, errors, options.limit);
}

async function printItems(items: NewsItem[], errors: string[], limit: number): Promise<void> {
  const visibleItems = items.slice(0, limit);

  await saveItems(items);

  if (errors.length > 0) {
    console.error(`Warning: ${errors.length} feed(s) failed: ${errors.join("; ")}`);
  }

  if (visibleItems.length === 0) {
    console.log("No news items found.");
    return;
  }

  for (const item of visibleItems) {
    console.log(formatListItem(item));
  }
}

function printUrl(args: string[], options: CliOptions): void {
  const subcommand = args.shift();
  if (subcommand !== "search") {
    throw new Error('Only "news-cli url search ..." is supported.');
  }

  const query = args.join(" ");
  const searchOptions = {
    query,
    site: options.site,
    phrase: options.phrase,
    exclude: options.exclude,
    after: options.after,
    before: options.before
  };

  console.log(`Query: ${buildSearchQuery(searchOptions)}`);
  console.log(`URL: ${buildSearchUrl(searchOptions)}`);
}

async function runSelfUpgrade(options: CliOptions): Promise<void> {
  const result = await selfUpgrade({
    version: options.version,
    installDir: options.installDir,
    skillDir: options.skillDir,
    codexSkillDir: options.codexSkillDir,
    hermesSkillDir: options.hermesSkillDir,
    onProgress: (message) => console.error(message)
  });

  console.log(`Installed news-cli (${result.version}) to ${result.binaryPath}`);
  for (const skillPath of result.skillPaths) {
    console.log(`Installed skill to ${skillPath}`);
  }
}

function formatListItem(item: NewsItem): string {
  const date = formatDate(item.date || item.rawDate);
  const meta = [item.id, item.category, item.source, date].filter(Boolean).join(" | ");
  const summary = item.description ? `\n  ${truncate(item.description, 160)}` : "";
  return `[${meta}]\n${item.title}${summary}\n${item.link ?? ""}\n`;
}

async function printDetail(idOrUrl: string | undefined): Promise<void> {
  if (!idOrUrl) {
    throw new Error("detail requires an item id or URL. Run latest/search first to populate the local cache.");
  }

  const cache = await loadItems();
  const item = cache.items.find((candidate) => (
    candidate.id === idOrUrl ||
    candidate.link === idOrUrl ||
    candidate.guid === idOrUrl
  ));

  if (!item) {
    throw new Error(`Could not find "${idOrUrl}" in the local cache. Run "news-cli latest" or "news-cli search <query>" first, then use an id from the output.`);
  }

  console.log([
    item.title,
    "",
    `ID: ${item.id}`,
    `Source: ${item.sourceLabel} (${item.source})`,
    `Category: ${item.category}`,
    item.date || item.rawDate ? `Date: ${formatDate(item.date || item.rawDate)}` : "",
    item.author ? `Author: ${item.author}` : "",
    item.itemCategory ? `Item category: ${item.itemCategory}` : "",
    item.feedUrl ? `Feed: ${item.feedUrl}` : "",
    item.link ? `Link: ${item.link}` : "",
    "",
    item.description || "(No description in feed.)"
  ].filter((line) => line !== "").join("\n"));
}

function printCategories(): void {
  console.log("Feeds:");
  for (const feed of feeds) {
    console.log(`  ${feed.key} (${feed.category}) - ${feed.label}`);
    console.log(`    ${feed.url}`);
  }

  console.log("\nModes:");
  for (const category of getCategories()) {
    console.log(`  ${category}`);
  }
}

function formatDate(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

function truncate(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1)}...`;
}
