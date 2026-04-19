#!/usr/bin/env bash

set -euo pipefail

if [ -f "$HOME/.zprofile" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.zprofile" >/dev/null 2>&1 || true
fi

export PATH="$HOME/.local/bin:$HOME/.docker/cli-plugins:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_header() {
  echo -e "${PURPLE}$1${NC}"
}

print_info() {
  echo -e "${BLUE}INFO${NC} $1"
}

print_ok() {
  echo -e "${GREEN}OK${NC}  $1"
}

print_warn() {
  echo -e "${YELLOW}WARN${NC} $1"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo -e "${RED}FAIL${NC} Required command not found: $command_name"
    exit 1
  fi
}

require_command docker
require_command curl
require_command jq

print_header "Operator First Check"
echo "===================="
echo

print_header "Step 1: Control Plane Smoke Check"
"$SCRIPT_DIR/health-check.sh"
echo

print_header "Step 2: Inventory Contract Check"
"$SCRIPT_DIR/inventory-audit.sh"
echo

print_header "Step 3: Workspace App Snapshot"
apps_payload="$(curl -fsS http://localhost:4000/api/apps/health)"

summary_line="$(jq -r '"Apps: \(.summary.totalApps) total | \(.summary.healthyApps) healthy | \(.summary.degradedApps) degraded | \(.summary.downApps) down | \(.summary.unknownApps) unknown"' <<<"$apps_payload")"
print_ok "$summary_line"

jq -r '.apps[] | "- \(.name): \(.status) | primary=\(.primaryEndpoint.name // "n/a") | latency=\((.primaryEndpoint.latencySeconds * 1000 | floor | tostring) // "n/a")ms | browser=\(.primaryEndpoint.browserUrl // "n/a")"' <<<"$apps_payload"
echo

down_count="$(jq -r '.summary.downApps' <<<"$apps_payload")"
degraded_count="$(jq -r '.summary.degradedApps' <<<"$apps_payload")"

if [ "$down_count" -gt 0 ]; then
  print_warn "One or more apps are down. Start with the app-specific dashboard guidance and live audit."
elif [ "$degraded_count" -gt 0 ]; then
  print_warn "One or more apps are degraded. Compare control-plane health, logs, and the app-specific operator guide."
else
  print_ok "All monitored apps are currently healthy."
fi
echo

print_info "Next operator paths:"
echo "  ./scripts/devops-monitor.sh swiftpay-live"
echo "  ./scripts/devops-monitor.sh opensis-live"
echo "  ./scripts/devops-monitor.sh foodpulse-live"
echo "  ./scripts/devops-monitor.sh memflip-live"
