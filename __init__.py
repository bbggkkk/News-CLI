"""Hermes plugin wrapper for news-cli.

The plugin keeps news-fetching logic in the Bun CLI and exposes a small,
agent-friendly Hermes tool surface around it.
"""

from __future__ import annotations

import json
import os
import shlex
import shutil
import subprocess
from pathlib import Path
from typing import Any


PLUGIN_DIR = Path(__file__).resolve().parent
TOOLSET = "news"
TIMEOUT_SECONDS = 60
SLASH_READ_COMMANDS = {"latest", "search", "dart", "disclosure", "detail", "url", "categories", "help"}


def _limit(value: Any, default: int = 10) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, min(parsed, 100))


def _positive_number(value: Any) -> str:
    if value is None or value == "":
        return ""
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return ""
    if parsed <= 0:
        return ""
    return str(int(parsed)) if parsed.is_integer() else str(parsed)


def _string(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _list(value: Any) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return [_string(item) for item in value if _string(item)]
    return [_string(value)]


def _base_command() -> list[str] | None:
    configured = os.getenv("NEWS_CLI_BIN")
    if configured:
        return [configured]

    dist_binary = PLUGIN_DIR / "dist" / "news-cli"
    if dist_binary.exists() and os.access(dist_binary, os.X_OK):
        return [str(dist_binary)]

    bun = shutil.which("bun")
    source_entry = PLUGIN_DIR / "bin" / "news-cli.ts"
    if bun and source_entry.exists():
        return [bun, "run", str(source_entry)]

    installed = shutil.which("news-cli")
    if installed:
        return [installed]

    return None


def _check_news_cli() -> bool:
    return _base_command() is not None


def _run_news_cli(args: list[str]) -> str:
    command = _base_command()
    if command is None:
        return json.dumps(
            {
                "ok": False,
                "error": (
                    "news-cli is not available. Install the release binary, "
                    "set NEWS_CLI_BIN, or keep Bun available in the plugin checkout."
                ),
            },
            ensure_ascii=False,
        )

    completed = subprocess.run(
        [*command, *args],
        cwd=str(PLUGIN_DIR),
        text=True,
        capture_output=True,
        timeout=TIMEOUT_SECONDS,
        check=False,
    )

    result = {
        "ok": completed.returncode == 0,
        "command": [*command, *args],
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
        "exit_code": completed.returncode,
    }
    return json.dumps(result, ensure_ascii=False)


def _run_news_cli_text(args: list[str]) -> str:
    raw = json.loads(_run_news_cli(args))
    if not raw.get("ok"):
        message = raw.get("stderr") or raw.get("stdout") or raw.get("error") or "news-cli failed."
        return f"news-cli error: {message}"
    return raw.get("stdout") or "(no output)"


def _slash_help() -> str:
    return """news-cli slash command

Usage:
  /news
  /news latest [--limit <n>] [--since-hours <n>]
  /news search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>] [--since-hours <n>] [--limit <n>]
  /news dart [--limit <n>] [--since-hours <n>]
  /news detail <id-or-url>
  /news url search <query> [--site <domain>] [--phrase <text>] [--exclude <word>] [--after <date>] [--before <date>]

Short form:
  /news 삼성전자

The short form is treated as /news search 삼성전자."""


NEWS_LATEST_SCHEMA = {
    "name": "news_latest",
    "description": "Fetch the Korean Google News latest RSS feed. Returns news-cli text output as JSON stdout.",
    "parameters": {
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Maximum number of news items to return. Default 10, max 100.",
                "minimum": 1,
                "maximum": 100,
                "default": 10,
            },
            "since_hours": {
                "type": "number",
                "description": "Only return RSS items published in the last N hours.",
                "minimum": 0.01,
            },
        },
        "additionalProperties": False,
    },
}

NEWS_SEARCH_SCHEMA = {
    "name": "news_search",
    "description": (
        "Search Google News RSS. Supports query, site:domain restriction, exact phrase, "
        "excluded words, and date filters."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search terms for Google News RSS.",
            },
            "site": {
                "type": "string",
                "description": "Optional domain for site: restriction, such as mk.co.kr.",
            },
            "phrase": {
                "type": "string",
                "description": "Optional exact phrase to include in quotes.",
            },
            "exclude": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Words to exclude. Items may include or omit the leading dash.",
            },
            "after": {
                "type": "string",
                "description": "Optional start date as YYYY-MM-DD. Adds after:YYYY-MM-DD.",
            },
            "before": {
                "type": "string",
                "description": "Optional end date as YYYY-MM-DD. Adds before:YYYY-MM-DD.",
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of results to return. Default 10, max 100.",
                "minimum": 1,
                "maximum": 100,
                "default": 10,
            },
            "since_hours": {
                "type": "number",
                "description": "Only return RSS items published in the last N hours.",
                "minimum": 0.01,
            },
        },
        "required": ["query"],
        "additionalProperties": False,
    },
}

NEWS_DART_SCHEMA = {
    "name": "news_dart",
    "description": "Fetch today's DART disclosure RSS feed. Returns disclosure items from https://dart.fss.or.kr/api/todayRSS.xml.",
    "parameters": {
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Maximum number of disclosure items to return. Default 10, max 100.",
                "minimum": 1,
                "maximum": 100,
                "default": 10,
            },
            "since_hours": {
                "type": "number",
                "description": "Only return RSS items published in the last N hours.",
                "minimum": 0.01,
            },
        },
        "additionalProperties": False,
    },
}

NEWS_DETAIL_SCHEMA = {
    "name": "news_detail",
    "description": "Show cached RSS details for an item ID or URL from a previous latest, search, or DART run.",
    "parameters": {
        "type": "object",
        "properties": {
            "id_or_url": {
                "type": "string",
                "description": "Item ID, link, or GUID printed by a previous news-cli listing command.",
            },
        },
        "required": ["id_or_url"],
        "additionalProperties": False,
    },
}

NEWS_SEARCH_URL_SCHEMA = {
    "name": "news_search_url",
    "description": "Build a Google News RSS search query and URL without fetching results.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search terms."},
            "site": {"type": "string", "description": "Optional site: domain."},
            "phrase": {"type": "string", "description": "Optional exact phrase."},
            "exclude": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Words to exclude.",
            },
            "after": {
                "type": "string",
                "description": "Optional start date as YYYY-MM-DD. Adds after:YYYY-MM-DD.",
            },
            "before": {
                "type": "string",
                "description": "Optional end date as YYYY-MM-DD. Adds before:YYYY-MM-DD.",
            },
        },
        "required": ["query"],
        "additionalProperties": False,
    },
}


def _handle_latest(args, **_kwargs):
    cli_args = ["latest", "--limit", str(_limit(args.get("limit")))]
    since_hours = _positive_number(args.get("since_hours"))
    if since_hours:
        cli_args.extend(["--since-hours", since_hours])
    return _run_news_cli(cli_args)


def _handle_search(args, **_kwargs):
    cli_args = ["search", _string(args.get("query")), "--limit", str(_limit(args.get("limit")))]
    site = _string(args.get("site"))
    phrase = _string(args.get("phrase"))
    if site:
        cli_args.extend(["--site", site])
    if phrase:
        cli_args.extend(["--phrase", phrase])
    for excluded in _list(args.get("exclude")):
        cli_args.extend(["--exclude", excluded])
    after = _string(args.get("after"))
    before = _string(args.get("before"))
    if after:
        cli_args.extend(["--after", after])
    if before:
        cli_args.extend(["--before", before])
    since_hours = _positive_number(args.get("since_hours"))
    if since_hours:
        cli_args.extend(["--since-hours", since_hours])
    return _run_news_cli(cli_args)


def _handle_dart(args, **_kwargs):
    cli_args = ["dart", "--limit", str(_limit(args.get("limit")))]
    since_hours = _positive_number(args.get("since_hours"))
    if since_hours:
        cli_args.extend(["--since-hours", since_hours])
    return _run_news_cli(cli_args)


def _handle_detail(args, **_kwargs):
    return _run_news_cli(["detail", _string(args.get("id_or_url"))])


def _handle_search_url(args, **_kwargs):
    cli_args = ["url", "search", _string(args.get("query"))]
    site = _string(args.get("site"))
    phrase = _string(args.get("phrase"))
    if site:
        cli_args.extend(["--site", site])
    if phrase:
        cli_args.extend(["--phrase", phrase])
    for excluded in _list(args.get("exclude")):
        cli_args.extend(["--exclude", excluded])
    after = _string(args.get("after"))
    before = _string(args.get("before"))
    if after:
        cli_args.extend(["--after", after])
    if before:
        cli_args.extend(["--before", before])
    return _run_news_cli(cli_args)


def _handle_news_slash(raw_args: str) -> str:
    try:
        tokens = shlex.split(raw_args or "")
    except ValueError as exc:
        return f"Invalid /news arguments: {exc}"

    if not tokens:
        return _run_news_cli_text(["latest", "--limit", "10"])

    command = tokens[0].lower()
    if command in {"help", "-h", "--help"}:
        if len(tokens) == 1:
            return _slash_help()
        return _run_news_cli_text(["help", *tokens[1:]])

    if command == "upgrade":
        return "Use `news-cli upgrade` in a shell. The /news slash command only supports read-only news commands."

    if command in SLASH_READ_COMMANDS:
        return _run_news_cli_text(tokens)

    return _run_news_cli_text(["search", *tokens, "--limit", "10"])


def register(ctx) -> None:
    for name, schema, handler in (
        ("news_latest", NEWS_LATEST_SCHEMA, _handle_latest),
        ("news_search", NEWS_SEARCH_SCHEMA, _handle_search),
        ("news_dart", NEWS_DART_SCHEMA, _handle_dart),
        ("news_detail", NEWS_DETAIL_SCHEMA, _handle_detail),
        ("news_search_url", NEWS_SEARCH_URL_SCHEMA, _handle_search_url),
    ):
        ctx.register_tool(
            name=name,
            toolset=TOOLSET,
            schema=schema,
            handler=handler,
            check_fn=_check_news_cli,
        )

    ctx.register_command(
        name="news",
        handler=_handle_news_slash,
        description="Fetch Google News RSS and DART disclosures with news-cli.",
        args_hint="[latest|search|dart|detail|url|help] ...",
    )
