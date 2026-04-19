#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="$(dirname "$PROJECT_ROOT")"

MEMFLIP_COMPOSE="$WORKSPACE_ROOT/MemFlip/docker-compose.yml"
MEMFLIP_ENV="$WORKSPACE_ROOT/MemFlip/.env.example"
MEMFLIP_README="$WORKSPACE_ROOT/MemFlip/README.md"
MEMFLIP_SERVER="$WORKSPACE_ROOT/MemFlip/backend/server.js"
MONITORED_APPS_FILE="$PROJECT_ROOT/ui-next/lib/monitored-apps.ts"
PROMETHEUS_FILE="$PROJECT_ROOT/prometheus/prometheus.yml"

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

pass() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
  echo -e "${GREEN}OK${NC}  $1"
}

fail() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
  echo -e "${RED}FAIL${NC} $1"
}

header() {
  echo -e "${PURPLE}$1${NC}"
}

info() {
  echo -e "${BLUE}INFO${NC} $1"
}

require_file() {
  local file="$1"
  if [ -f "$file" ]; then
    pass "Found file: $file"
  else
    fail "Missing file: $file"
  fi
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"

  if rg -Fq -- "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

header "MemFlip Integration Audit"
echo "========================"
echo

require_file "$MEMFLIP_COMPOSE"
require_file "$MEMFLIP_ENV"
require_file "$MEMFLIP_README"
require_file "$MEMFLIP_SERVER"
require_file "$MONITORED_APPS_FILE"
require_file "$PROMETHEUS_FILE"

echo
header "Compose And Inventory Alignment"

aliases=(
  "memflip-frontend"
  "memflip-backend"
)

for alias in "${aliases[@]}"; do
  assert_contains "$MEMFLIP_COMPOSE" "$alias" "MemFlip compose exposes observability alias: $alias"
  assert_contains "$MONITORED_APPS_FILE" "$alias" "Control plane inventory knows alias: $alias"
done

assert_contains "$MEMFLIP_COMPOSE" '${BACKEND_HOST_PORT:-3101}:3001' "MemFlip backend host port defaults to 3101"
assert_contains "$MEMFLIP_ENV" 'BACKEND_HOST_PORT=3101' "MemFlip env contract documents backend host port 3101"
assert_contains "$MEMFLIP_ENV" 'FRONTEND_HOST_PORT=8080' "MemFlip env contract documents frontend host port 8080"
assert_contains "$MONITORED_APPS_FILE" "http://localhost:8080" "MemFlip inventory browser URL uses localhost:8080"
assert_contains "$MONITORED_APPS_FILE" "curl -fsS http://localhost:8080/api/health" "MemFlip inventory health check uses the proxied frontend path"
assert_contains "$MONITORED_APPS_FILE" "cd MemFlip && docker compose up -d" "MemFlip inventory localStart points to repo compose startup"
assert_contains "$MEMFLIP_README" "curl http://localhost:8080/api/health" "MemFlip README uses the proxied local health path"

echo
header "Prometheus Scrape Contract"

blackbox_targets=(
  "http://memflip-frontend/api/health"
  "http://memflip-backend:3001/health"
)

for target in "${blackbox_targets[@]}"; do
  assert_contains "$PROMETHEUS_FILE" "$target" "Prometheus blackbox target present: $target"
done

assert_contains "$PROMETHEUS_FILE" "app: memflip" "Prometheus blackbox labels include app=memflip"

echo
header "Backend Surface Contract"

assert_contains "$MEMFLIP_SERVER" "app.get('/health'" "MemFlip backend exposes /health"
assert_contains "$MEMFLIP_SERVER" "app.get('/api/health'" "MemFlip backend exposes /api/health"
assert_contains "$MEMFLIP_SERVER" "app.get('/metrics'" "MemFlip backend exposes /metrics"
assert_contains "$MEMFLIP_SERVER" "app.set('trust proxy', 1);" "MemFlip backend trusts the frontend proxy hop"

echo
header "Audit Summary"
echo "=============="
info "Checks passed: $PASSED_CHECKS/$TOTAL_CHECKS"

if [ "$FAILED_CHECKS" -gt 0 ]; then
  fail "Failures: $FAILED_CHECKS"
  exit 1
fi

pass "MemFlip integration audit passed"
