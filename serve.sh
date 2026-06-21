#!/bin/zsh
# GREYMARKET — local dev server
cd "$(dirname "$0")"
PORT="${1:-8848}"
echo "GREYMARKET 墨市 → http://localhost:$PORT"
if command -v uv >/dev/null 2>&1; then uv run python3 -m http.server "$PORT"; else python3 -m http.server "$PORT"; fi
