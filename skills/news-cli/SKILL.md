---
name: news-cli
description: Use this skill when the user wants to fetch, search, inspect, install, upgrade, build, release, or troubleshoot the news-cli Google News RSS CLI.
---

# news-cli

`news-cli` is a Bun-built command-line Google News RSS client.

RSS forms:

- Latest Korean Google News: `https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko`
- Search: `https://news.google.com/rss/search?q=(검색어)&hl=ko&gl=KR&ceid=KR%3Ako`
- Advanced search query: `(검색어) site:(사이트 주소) "(정확한 문구)" -(제외할 단어)`

## Command Reference

### `news-cli` / `news-cli latest`

Fetches Korean Google News latest RSS.

```sh
news-cli
news-cli latest --limit 20
```

Use `--limit <n>` to control the number of displayed items. Each item includes an ID used by `detail`.

### `news-cli search`

Fetches Google News RSS search results.

```sh
news-cli search 삼성전자 --limit 10
news-cli search 선거 --site example.com --phrase "여론조사" --exclude 광고
```

Options:

- `--site <domain>` adds `site:<domain>`.
- `--phrase <text>` adds an exact quoted phrase.
- `--exclude <word>` adds `-word`; repeat it for multiple exclusions.
- `--limit <n>` controls output count.

### `news-cli url search`

Prints the generated query and RSS URL without fetching.

```sh
news-cli url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머
```

Use this when validating a Google News RSS expression before using it for polling or automation.

### `news-cli detail`

Shows details for an item from the last `latest` or `search` run. It reads the local cache.

```sh
news-cli detail <id-or-url>
```

Run a listing command first, then pass one of its printed IDs.

### `news-cli categories`

Shows fixed feeds and supported modes.

```sh
news-cli categories
```

Current fixed feed is `google-latest`; search feeds are created dynamically from CLI options.

### `news-cli help`

Shows general or command-specific help.

```sh
news-cli help
news-cli help latest
news-cli help search
news-cli help url
news-cli help detail
news-cli help self upgrade
```

Also works with `--help` on commands, such as `news-cli search --help`.

### `news-cli self upgrade`

Downloads the latest GitHub Release binary for the current OS/architecture and installs this skill.

```sh
news-cli self upgrade
news-cli self upgrade --version v0.2.1
news-cli self-upgrade --install-dir ~/.local/bin --skill-dir ~/.codex/skills/news-cli
```

Options:

- `--version <tag>` installs a specific release tag. Default: latest.
- `--install-dir <path>` writes `news-cli` into that directory.
- `--skill-dir <path>` writes `SKILL.md` into that skill directory.

Environment:

- `NEWS_CLI_BIN` sets the exact binary path to replace.
- `NEWS_CLI_INSTALL_DIR` sets the default install directory.
- `NEWS_CLI_SKILL_DIR` sets the skill install directory.

## Development

Run from the repository:

```sh
bun run bin/news-cli.js --help
bun test
bun run build
```

## Installation

One-line install for the latest released binary and this skill:

```sh
curl -fsSL https://raw.githubusercontent.com/bbggkkk/News-CLI/main/install.sh | bash
```

The installer places the binary at `~/.local/bin/news-cli` by default and the skill at
`~/.codex/skills/news-cli/SKILL.md`.

## Release Notes

GitHub Actions publishes standalone binaries when a `v*` tag is pushed. The installer and
`self upgrade` command expect release assets named:

- `news-cli-linux-x64`
- `news-cli-linux-arm64`
- `news-cli-darwin-x64`
- `news-cli-darwin-arm64`
