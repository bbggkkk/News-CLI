import { buildSearchQuery, buildSearchUrl, createSearchFeed, feeds, getCategories } from "./feeds.js";
import { collectNews } from "./news.js";
import { loadItems, saveItems } from "./cache.js";
import { selfUpgrade } from "./upgrade.js";

const helpText = `news-cli

Usage:
  news-cli [latest] [--limit <n>]
  news-cli dart [--limit <n>]
  news-cli search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--limit <n>]
  news-cli url search <query> [--site <domain>] [--phrase <text>] [--exclude <word>]
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
  news-cli search 삼성전자 --limit 10
  news-cli search 선거 --site example.com --phrase "여론조사" --exclude 광고
  news-cli url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머
  news-cli detail 1a2b3c4d5e
  news-cli upgrade
  news-cli upgrade --version v0.2.4
  news-cli help search
  news-cli help upgrade

Google News RSS:
  Latest: https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko
  Search: https://news.google.com/rss/search?q=(검색어)&hl=ko&gl=KR&ceid=KR%3Ako

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
  news-cli [latest] [--limit <n>]

Fetches the Korean Google News latest RSS feed.

Options:
  --limit, -l <n>  Number of items to print. Default: 30

Example:
  news-cli latest --limit 20`,

  dart: `news-cli dart

Usage:
  news-cli dart [--limit <n>]
  news-cli disclosure [--limit <n>]

Fetches today's DART disclosure RSS feed.

Options:
  --limit, -l <n>  Number of disclosure items to print. Default: 30

Example:
  news-cli dart --limit 20`,

  search: `news-cli search

Usage:
  news-cli search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--limit <n>]

Builds a Google News RSS search query and prints matching news.

Options:
  --site <domain>    Restrict results with site:<domain>.
  --phrase <text>    Add an exact phrase wrapped in quotes.
  --exclude <word>   Add an excluded word. Can be used multiple times.
  --limit, -l <n>    Number of items to print. Default: 30

Examples:
  news-cli search 삼성전자 --limit 10
  news-cli search 선거 --site example.com --phrase "여론조사" --exclude 광고`,

  url: `news-cli url

Usage:
  news-cli url search <query> [--site <domain>] [--phrase <text>] [--exclude <word>]

Prints the generated Google News RSS query and URL without fetching it.

Example:
  news-cli url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머`,

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
  news-cli upgrade --version v0.2.4`
};

export async function run(argv) {
  const { command, options, args, commandProvided } = parseArgs(argv);

  if (command === "help") {
    printHelp(args);
    return;
  }

  if (options.help) {
    if (!commandProvided) {
      printHelp([]);
    } else {
      printHelp(normalizeHelpCommand(command, args));
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

function parseArgs(argv) {
  const tokens = [...argv];
  let command = "latest";
  let commandProvided = false;
  const args = [];
  const options = {
    category: "latest",
    limit: 30,
    help: false,
    site: "",
    phrase: "",
    exclude: [],
    version: "latest",
    installDir: "",
    skillDir: "",
    codexSkillDir: "",
    hermesSkillDir: ""
  };

  if (tokens[0] && !tokens[0].startsWith("-")) {
    command = tokens.shift();
    commandProvided = true;
  }

  while (tokens.length > 0) {
    const token = tokens.shift();

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

function printHelp(topic) {
  const args = Array.isArray(topic) ? topic : [topic].filter(Boolean);
  if (args.length === 0) {
    console.log(helpText);
    return;
  }

  const key = normalizeHelpCommand(args[0], args.slice(1));
  const text = commandHelp[key];
  if (!text) {
    throw new Error(`Unknown help topic "${args.join(" ")}". Run "news-cli help".`);
  }

  console.log(text);
}

function normalizeHelpCommand(command) {
  if (command === "list") {
    return "latest";
  }
  if (command === "disclosure") {
    return "dart";
  }
  return command;
}

function requireValue(option, value) {
  if (!value || value.startsWith("-")) {
    throw new Error(`Option "${option}" requires a value.`);
  }
  return value;
}

function parseLimit(value) {
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`Limit must be a positive integer. Received "${value}".`);
  }
  return limit;
}

async function printList(options) {
  const { items, errors } = await collectNews({ category: options.category });
  await printItems(items, errors, options.limit);
}

async function printSearch(args, options) {
  const feed = createSearchFeed({
    query: args.join(" "),
    site: options.site,
    phrase: options.phrase,
    exclude: options.exclude
  });
  const { items, errors } = await collectNews({ feed });
  await printItems(items, errors, options.limit);
}

async function printItems(items, errors, limit) {
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

function printUrl(args, options) {
  const subcommand = args.shift();
  if (subcommand !== "search") {
    throw new Error('Only "news-cli url search ..." is supported.');
  }

  const query = args.join(" ");
  const searchOptions = {
    query,
    site: options.site,
    phrase: options.phrase,
    exclude: options.exclude
  };

  console.log(`Query: ${buildSearchQuery(searchOptions)}`);
  console.log(`URL: ${buildSearchUrl(searchOptions)}`);
}

async function runSelfUpgrade(options) {
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

function formatListItem(item) {
  const date = formatDate(item.date || item.rawDate);
  const meta = [item.id, item.category, item.source, date].filter(Boolean).join(" | ");
  const summary = item.description ? `\n  ${truncate(item.description, 160)}` : "";
  return `[${meta}]\n${item.title}${summary}\n${item.link ?? ""}\n`;
}

async function printDetail(idOrUrl) {
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

function printCategories() {
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

function formatDate(value) {
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

function truncate(value, maxLength) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1)}...`;
}
