#!/usr/bin/env bash
# Folio — start writing
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies…"
  npm install
fi

PORT="${PORT:-3000}"
URL="http://127.0.0.1:${PORT}"

echo "Opening Folio at ${URL}"
echo "Press Ctrl+C to stop."
echo ""

# Open browser once the server is ready (macOS)
(
  for _ in $(seq 1 40); do
    if curl -sf "${URL}" >/dev/null 2>&1; then
      open "${URL}" 2>/dev/null || true
      break
    fi
    sleep 0.25
  done
) &

npm run dev -- --hostname 127.0.0.1 --port "${PORT}"
