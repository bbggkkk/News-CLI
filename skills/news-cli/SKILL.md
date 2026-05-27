---
name: news-cli
description: Use this skill when the user wants to fetch, search, inspect, install, build, release, or troubleshoot the news-cli Google News RSS CLI.
---

# news-cli

`news-cli` is a Bun-built command-line Google News RSS client.

It uses these RSS forms:

- Latest Korean Google News: `https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko`
- Search: `https://news.google.com/rss/search?q=(검색어)&hl=ko&gl=KR&ceid=KR%3Ako`
- Advanced search query: `(검색어) site:(사이트 주소) "(정확한 문구)" -(제외할 단어)`

## Common Commands

Run from the repository:

```sh
bun run bin/news-cli.js
bun run bin/news-cli.js latest --limit 20
bun run bin/news-cli.js search 삼성전자 --limit 10
bun run bin/news-cli.js search 선거 --site example.com --phrase "여론조사" --exclude 광고
bun run bin/news-cli.js url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머
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
