---
name: news-cli
description: Use this skill when the user wants to fetch, search, inspect, install, upgrade, build, release, or troubleshoot the news-cli Google News RSS CLI.
---

# news-cli

`news-cli` is a Bun-built command-line Google News RSS and DART disclosure RSS client.

RSS forms:

- Latest Korean Google News: `https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko`
- Search: `https://news.google.com/rss/search?q=(검색어)&hl=ko&gl=KR&ceid=KR%3Ako`
- Advanced search query: `(검색어) site:(사이트 주소) "(정확한 문구)" -(제외할 단어)`
- Date search operators: `after:YYYY-MM-DD`, `before:YYYY-MM-DD`
- DART today disclosures: `https://dart.fss.or.kr/api/todayRSS.xml`

## Command Reference

### `news-cli` / `news-cli latest`

Fetches Korean Google News latest RSS.

```sh
news-cli
news-cli latest --limit 20
```

Use `--limit <n>` to control the number of displayed items. Each item includes an ID used by `detail`.

### `news-cli dart` / `news-cli disclosure`

Fetches today's DART disclosure RSS.

```sh
news-cli dart --limit 20
news-cli disclosure --limit 20
```

Use this for Korean corporate disclosure items from DART. Each item includes an ID used by `detail`.

### `news-cli search`

Fetches Google News RSS search results.

```sh
news-cli search 삼성전자 --limit 10
news-cli search 삼성전자 --after 2026-05-01 --before 2026-05-28
news-cli search 선거 --site example.com --phrase "여론조사" --exclude 광고
```

Options:

- `--site <domain>` adds `site:<domain>`.
- `--phrase <text>` adds an exact quoted phrase.
- `--exclude <word>` adds `-word`; repeat it for multiple exclusions.
- `--after <YYYY-MM-DD>` / `--from <YYYY-MM-DD>` adds `after:YYYY-MM-DD`.
- `--before <YYYY-MM-DD>` / `--to <YYYY-MM-DD>` adds `before:YYYY-MM-DD`.
- `--limit <n>` controls output count.

### `news-cli url search`

Prints the generated query and RSS URL without fetching.

```sh
news-cli url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머
news-cli url search 삼성전자 --after 2026-05-01 --before 2026-05-28
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
news-cli help dart
news-cli help search
news-cli help url
news-cli help detail
news-cli help upgrade
```

Also works with `--help` on commands, such as `news-cli search --help`.

### `news-cli upgrade`

Downloads the latest GitHub Release binary for the current OS/architecture and installs this skill for Codex and Hermes.

```sh
news-cli upgrade
news-cli upgrade --version v0.2.7
news-cli upgrade --install-dir ~/.local/bin --skill-dir ~/.codex/skills/news-cli
news-cli upgrade --hermes-skill-dir ~/.hermes/skills/news-cli
```

Options:

- `--version <tag>` installs a specific release tag. Default: latest.
- `--install-dir <path>` writes `news-cli` into that directory.
- `--skill-dir <path>` writes `SKILL.md` into the backward-compatible Codex skill directory.
- `--codex-skill-dir <path>` writes `SKILL.md` into the Codex skill directory.
- `--hermes-skill-dir <path>` writes `SKILL.md` into the Hermes skill directory.

Environment:

- `NEWS_CLI_BIN` sets the exact binary path to replace.
- `NEWS_CLI_INSTALL_DIR` sets the default install directory.
- `NEWS_CLI_SKILL_DIR` sets the backward-compatible Codex skill install directory.
- `NEWS_CLI_CODEX_SKILL_DIR` sets the Codex skill install directory.
- `NEWS_CLI_HERMES_SKILL_DIR` sets the Hermes skill install directory.

What happens during upgrade:

1. Selects the release asset for the current OS/architecture.
2. Downloads the standalone binary with progress output.
3. Replaces the installed `news-cli` binary.
4. Downloads and installs `SKILL.md` for Codex and Hermes.

What `news-cli upgrade` does not do:

- It does not install the Hermes plugin.
- It does not update the Hermes plugin Git checkout.
- It does not enable the Hermes plugin.
- It does not enable the Hermes `news` toolset.
- It does not restart the Hermes gateway.

For `/news` slash command or Hermes tool changes, update the Hermes plugin separately.

### Hermes plugin

Install and enable the repository as a Hermes plugin:

First install:

```sh
hermes plugins install bbggkkk/News-CLI
hermes plugins enable news-cli
hermes tools enable news --platform cli
hermes gateway restart
```

Update an existing plugin install:

```sh
hermes plugins update news-cli
hermes gateway restart
```

Full update when both the binary/skills and Hermes plugin should be current:

```sh
news-cli upgrade
hermes plugins update news-cli
hermes gateway restart
```

Use `/news` inside a Hermes session:

```sh
/news
/news search 삼성전자 --limit 10
/news search 삼성전자 --after 2026-05-01 --before 2026-05-28
/news dart --limit 10
/news url search 삼성전자 --site mk.co.kr
```

The plugin registers:

- `news_latest`: fetch Korean Google News latest RSS.
- `news_search`: search Google News RSS with query, site, phrase, exclude, and date filters.
- `news_dart`: fetch today's DART disclosure RSS.
- `news_detail`: inspect a cached item by ID or URL.
- `news_search_url`: build a Google News RSS search URL without fetching.

## Development

Run from the repository:

```sh
bun run bin/news-cli.ts --help
bun test
bun run typecheck
bun run build
```

## Installation

One-line install for the latest released binary and this skill:

```sh
curl -fsSL https://raw.githubusercontent.com/bbggkkk/News-CLI/main/install.sh | bash
```

The installer places the binary at `~/.local/bin/news-cli` by default and installs skills at
`~/.codex/skills/news-cli/SKILL.md` and `~/.hermes/skills/news-cli/SKILL.md`.

## Release Notes

GitHub Actions publishes standalone binaries when a `v*` tag is pushed. The installer and
`upgrade` command expect release assets named:

- `news-cli-linux-x64`
- `news-cli-linux-arm64`
- `news-cli-darwin-x64`
- `news-cli-darwin-arm64`
