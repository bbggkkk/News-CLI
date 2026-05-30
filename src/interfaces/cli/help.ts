import { VERSION } from "../../lib/version";

export const HELP_TEXT = `news-cli

Usage:
  news-cli [latest] [--limit <n>] [--since-hours <n>] [--json] [--timeout <ms>]
  news-cli dart [--limit <n>] [--since-hours <n>] [--json] [--timeout <ms>]
  news-cli search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>] [--since-hours <n>] [--limit <n>] [--json] [--timeout <ms>]
  news-cli url search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>]
  news-cli categories
  news-cli detail <id-or-url> [--json]
  news-cli history [--limit <n>] [--json]
  news-cli upgrade [--version <tag>] [--install-dir <path>] [--skill-dir <path>] [--hermes-skill-dir <path>]
  news-cli help [topic]
  news-cli --version

Commands:
  latest        Fetch NewsAPI top headlines. Default command.
  dart          Fetch DART today disclosure RSS.
  search        Fetch NewsAPI search results.
  url search    Print the generated NewsAPI search URL.
  categories    Show fixed feeds and supported modes.
  detail        Show cached RSS details for a listed item.
  history       Show API call history log.
  upgrade       Upgrade the binary and install/update Codex and Hermes skills.
  help          Show general help or command-specific help.

Help topics:
  latest, dart, search, url, categories, detail, history, upgrade

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
  news-cli history
  news-cli upgrade
  news-cli upgrade --version v0.2.8
  news-cli help search
  news-cli help upgrade

NewsAPI:
  Top Headlines: https://newsapi.org/v2/top-headlines?country=kr
  Search (Everything): https://newsapi.org/v2/everything?q=(검색어)
  Requires NEWS_API_KEY environment variable.

DART RSS:
  Disclosures: https://dart.fss.or.kr/api/todayRSS.xml

Environment for upgrade:
  NEWS_CLI_BIN          Exact binary path to replace.
  NEWS_CLI_INSTALL_DIR  Default install directory when NEWS_CLI_BIN is unset.
  NEWS_CLI_SKILL_DIR         Backward-compatible default Codex skill directory.
  NEWS_CLI_CODEX_SKILL_DIR   Default Codex skill directory.
  NEWS_CLI_HERMES_SKILL_DIR  Default Hermes skill directory.
`;

export const COMMAND_HELP: Record<string, string> = {
  latest: [
    "news-cli latest",
    "",
    "Usage:",
    "  news-cli [latest] [--limit <n>] [--since-hours <n>]",
    "",
    "Fetches the NewsAPI top headlines.",
    "",
    "Options:",
    "  --limit, -l <n>     Number of items to print. Default: 30",
    "  --since-hours <n>   Only print RSS items published in the last N hours.",
    "",
    "Example:",
    "  news-cli latest --limit 20",
    "  news-cli latest --since-hours 3",
  ].join("\n"),

  dart: [
    "news-cli dart",
    "",
    "Usage:",
    "  news-cli dart [--limit <n>] [--since-hours <n>]",
    "  news-cli disclosure [--limit <n>] [--since-hours <n>]",
    "",
    "Fetches today's DART disclosure RSS feed.",
    "",
    "Options:",
    "  --limit, -l <n>     Number of disclosure items to print. Default: 30",
    "  --since-hours <n>   Only print RSS items published in the last N hours.",
    "",
    "Example:",
    "  news-cli dart --limit 20",
    "  news-cli dart --since-hours 6",
  ].join("\n"),

  search: [
    "news-cli search",
    "",
    "Usage:",
    "  news-cli search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>] [--since-hours <n>] [--limit <n>]",
    "",
    "Builds a NewsAPI search query and prints matching news.",
    "",
    "Options:",
    "  --site <domain>    Restrict results with site:<domain>.",
    "  --phrase <text>    Add an exact phrase wrapped in quotes.",
    "  --exclude <word>   Add an excluded word. Can be used multiple times.",
    "  --after <date>     Add from=YYYY-MM-DD to the NewsAPI query. Alias: --from",
    "  --before <date>    Add to=YYYY-MM-DD to the NewsAPI query. Alias: --to",
    "  --since-hours <n>  Only print RSS items published in the last N hours.",
    "  --limit, -l <n>    Number of items to print. Default: 30",
    "",
    "Examples:",
    "  news-cli search 삼성전자 --limit 10",
    "  news-cli search 삼성전자 --since-hours 6",
    "  news-cli search 삼성전자 --after 2026-05-01 --before 2026-05-28",
    "  news-cli search 선거 --site example.com --phrase \"여론조사\" --exclude 광고",
  ].join("\n"),

  url: [
    "news-cli url",
    "",
    "Usage:",
    "  news-cli url search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>]",
    "",
    "Prints the generated NewsAPI query and URL without fetching it.",
    "",
    "Example:",
    "  news-cli url search 반도체 --site mk.co.kr --phrase \"실적 전망\" --exclude 루머",
    "  news-cli url search 삼성전자 --after 2026-05-01 --before 2026-05-28",
  ].join("\n"),

  categories: [
    "news-cli categories",
    "",
    "Usage:",
    "  news-cli categories",
    "",
    "Shows the fixed NewsAPI feed and supported modes.",
  ].join("\n"),

  detail: [
    "news-cli detail",
    "",
    "Usage:",
    "  news-cli detail <id-or-url>",
    "",
    "Shows the cached RSS details for an item from the last latest/search command.",
    "",
    "Example:",
    "  news-cli detail 1a2b3c4d5e",
  ].join("\n"),

  history: [
    "news-cli history",
    "",
    "Usage:",
    "  news-cli history [--limit <n>] [--json]",
    "",
    "Shows the history of API requests made to NewsAPI and DART RSS.",
    "",
    "Options:",
    "  --limit, -l <n>     Number of history entries to print. Default: 20",
    "  --json              Output history in JSON format.",
    "",
    "Example:",
    "  news-cli history --limit 10",
  ].join("\n"),

  upgrade: [
    "news-cli upgrade",
    "",
    "Usage:",
    "  news-cli upgrade [--version <tag>] [--install-dir <path>] [--skill-dir <path>] [--hermes-skill-dir <path>]",
    "",
    "Downloads the latest GitHub Release binary for this OS/architecture and installs the bundled Codex and Hermes skills.",
    "",
    "Work performed:",
    "  1. Selects the release asset for the current OS/architecture.",
    "  2. Downloads the standalone binary with progress output.",
    "  3. Replaces the installed news-cli binary.",
    "  4. Downloads and installs the Codex and Hermes SKILL.md files.",
    "",
    "Options:",
    "  --version <tag>          Release tag to install. Default: latest",
    "  --install-dir <path>     Install directory for news-cli. Default: current binary path, or ~/.local/bin",
    "  --skill-dir <path>       Backward-compatible Codex skill directory. Default: ~/.codex/skills/news-cli",
    "  --codex-skill-dir <path> Codex skill directory.",
    "  --hermes-skill-dir <path> Hermes skill directory. Default: ~/.hermes/skills/news-cli",
    "",
    "Environment:",
    "  NEWS_CLI_BIN          Exact binary path to replace.",
    "  NEWS_CLI_INSTALL_DIR  Default install directory when NEWS_CLI_BIN is unset.",
    "  NEWS_CLI_SKILL_DIR          Backward-compatible default Codex skill directory.",
    "  NEWS_CLI_CODEX_SKILL_DIR    Default Codex skill directory.",
    "  NEWS_CLI_HERMES_SKILL_DIR   Default Hermes skill directory.",
    "",
    "Example:",
    "  news-cli upgrade",
    "  news-cli upgrade --version v0.2.8",
  ].join("\n"),
};

export function getHelpText(args: string[]): string {
  const firstArg = args[0];
  if (args.length === 0 || firstArg === undefined) return HELP_TEXT;
  const key = normalizeHelpCommand(firstArg);
  const text = COMMAND_HELP[key];
  if (!text) throw new Error(`Unknown help topic "${args.join(" ")}". Run "news-cli help".`);
  return text;
}

function normalizeHelpCommand(command: string): string {
  if (command === "list") return "latest";
  if (command === "disclosure") return "dart";
  return command;
}
