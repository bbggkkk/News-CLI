import { getCategories, feeds } from "./feeds.js";
import { collectNews } from "./news.js";
import { loadItems, saveItems } from "./cache.js";

const helpText = `news-cli

Usage:
  news-cli [list] [--category <name>] [--limit <n>]
  news-cli categories
  news-cli detail <id-or-url>

Examples:
  news-cli
  news-cli list --category politics --limit 20
  news-cli list -c jtbc-economy
  news-cli detail 1a2b3c4d5e

Categories:
  all, ${getCategories().join(", ")}

Feed keys:
  ${feeds.map((feed) => feed.key).join(", ")}
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

  if (command !== "list") {
    throw new Error(`Unknown command "${command}". Run "news-cli --help".`);
  }

  await printList(options);
}

function parseArgs(argv) {
  const tokens = [...argv];
  let command = "list";
  const args = [];
  const options = {
    category: "all",
    limit: 30,
    help: false
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
  const visibleItems = items.slice(0, options.limit);

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

function formatListItem(item) {
  const date = formatDate(item.date || item.rawDate);
  const meta = [item.id, item.category, item.source, date].filter(Boolean).join(" | ");
  const summary = item.description ? `\n  ${truncate(item.description, 160)}` : "";
  return `[${meta}]\n${item.title}${summary}\n${item.link ?? ""}\n`;
}

async function printDetail(idOrUrl) {
  if (!idOrUrl) {
    throw new Error("detail requires an item id or URL. Run list first to populate the local cache.");
  }

  const cache = await loadItems();
  const item = cache.items.find((candidate) => (
    candidate.id === idOrUrl ||
    candidate.link === idOrUrl ||
    candidate.guid === idOrUrl
  ));

  if (!item) {
    throw new Error(`Could not find "${idOrUrl}" in the local cache. Run "news-cli list" first, then use an id from the output.`);
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
    item.link ? `Link: ${item.link}` : "",
    "",
    item.description || "(No description in feed.)"
  ].filter((line) => line !== "").join("\n"));
}

function printCategories() {
  console.log("Categories:");
  console.log(`  all`);
  for (const category of getCategories()) {
    console.log(`  ${category}`);
  }

  console.log("\nFeed keys:");
  for (const feed of feeds) {
    console.log(`  ${feed.key} (${feed.category}) - ${feed.label}`);
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
