#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
UI_DIR="$PROJECT_ROOT/ui-next"
TSX_BIN="$UI_DIR/node_modules/.bin/tsx"
VALIDATOR="$UI_DIR/scripts/validate-monitored-apps.ts"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run the inventory audit."
  exit 1
fi

if [ ! -x "$TSX_BIN" ]; then
  echo "Missing tsx runtime at $TSX_BIN"
  echo "Run 'cd $UI_DIR && npm ci' first."
  exit 1
fi

if [ ! -f "$VALIDATOR" ]; then
  echo "Missing validator script at $VALIDATOR"
  exit 1
fi

"$TSX_BIN" "$VALIDATOR"
