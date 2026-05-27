#!/usr/bin/env bash
set -euo pipefail

REPO="${NEWS_CLI_REPO:-bbggkkk/News-CLI}"
VERSION="${NEWS_CLI_VERSION:-latest}"
INSTALL_DIR="${NEWS_CLI_INSTALL_DIR:-$HOME/.local/bin}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
SKILL_DIR="${NEWS_CLI_SKILL_DIR:-$CODEX_HOME/skills/news-cli}"

case "$(uname -s)" in
  Linux) platform="linux" ;;
  Darwin) platform="darwin" ;;
  *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

asset="news-cli-${platform}-${arch}"
if [ "$VERSION" = "latest" ]; then
  base_url="https://github.com/${REPO}/releases/latest/download"
  skill_url="https://raw.githubusercontent.com/${REPO}/main/skills/news-cli/SKILL.md"
else
  base_url="https://github.com/${REPO}/releases/download/${VERSION}"
  skill_url="https://raw.githubusercontent.com/${REPO}/${VERSION}/skills/news-cli/SKILL.md"
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$INSTALL_DIR" "$SKILL_DIR"

curl -fsSL "${base_url}/${asset}" -o "$tmp_dir/news-cli"
chmod +x "$tmp_dir/news-cli"
mv "$tmp_dir/news-cli" "$INSTALL_DIR/news-cli"

curl -fsSL "$skill_url" -o "$SKILL_DIR/SKILL.md"

echo "Installed news-cli to $INSTALL_DIR/news-cli"
echo "Installed Codex skill to $SKILL_DIR/SKILL.md"
if ! command -v news-cli >/dev/null 2>&1; then
  echo "Add $INSTALL_DIR to PATH to run news-cli from any shell."
fi
