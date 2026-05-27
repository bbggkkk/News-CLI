import { buildSearchQuery, buildSearchUrl, createSearchFeed, feeds, getCategories } from "./feeds.js";
import { collectNews } from "./news.js";
import { loadItems, saveItems } from "./cache.js";

const helpText = `news-cli

Usage:
  news-cli [latest] [--limit <n>]
  news-cli search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--limit <n>]
  news-cli url search <query> [--site <domain>] [--phrase <text>] [--exclude <word>]
  news-cli categories
  news-cli detail <id-or-url>

Examples:
  news-cli
  news-cli latest --limit 20
  news-cli search 삼성전자 --limit 10
  news-cli search 선거 --site example.com --phrase "여론조사" --exclude 광고
  news-cli url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머
  news-cli detail 1a2b3c4d5e

Google News RSS:
  Latest: https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko
  Search: https://news.google.com/rss/search?q=(검색어)&hl=ko&gl=KR&ceid=KR%3Ako
`;

export async function run(argv) {
  const { command, options, args } = parseArgs(argv);

  if (options.help || command === "help") {
    console.log(helpText);
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

  if (command === "url") {
    printUrl(args, options);
    return;
  }

  if (command === "search") {
    await printSearch(args, options);
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
  const args = [];
  const options = {
    category: "latest",
    limit: 30,
    help: false,
    site: "",
    phrase: "",
    exclude: []
  };

  if (tokens[0] && !tokens[0].startsWith("-")) {
    command = tokens.shift();
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
    } else if (token.startsWith("-")) {
      throw new Error(`Unknown option "${token}". Run "news-cli --help".`);
    } else {
      args.push(token);
    }
  }

  return { command, options, args };
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
