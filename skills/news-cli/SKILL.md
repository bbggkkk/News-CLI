---
name: news-cli
description: Use this skill when the user wants to fetch, browse, filter, inspect, install, build, release, or troubleshoot the news-cli RSS aggregation CLI for MBC, JTBC, and DART feeds.
---

# news-cli

`news-cli` is a Bun-built command-line RSS aggregator for these feeds:

- MBC narrative news
- JTBC flash, issue, politics, economy, society, and international RSS feeds
- DART today disclosure RSS

## Common Commands

Run from the repository:

```sh
bun run bin/news-cli.js
bun run bin/news-cli.js list --category politics --limit 20
bun run bin/news-cli.js categories
bun run bin/news-cli.js detail <id>
```

Build a standalone binary:

```sh
bun run build
```

Run tests:

```sh
bun test
```

## Installation

Install the latest released binary and this skill:

```sh
curl -fsSL https://raw.githubusercontent.com/bbggkkk/News-CLI/main/install.sh | bash
```

The installer places the binary at `~/.local/bin/news-cli` by default and the skill at
`~/.codex/skills/news-cli/SKILL.md`.

## Release Notes

GitHub Actions publishes standalone binaries when a `v*` tag is pushed. The installer expects
release assets named:

- `news-cli-linux-x64`
- `news-cli-linux-arm64`
- `news-cli-darwin-x64`
- `news-cli-darwin-arm64`
