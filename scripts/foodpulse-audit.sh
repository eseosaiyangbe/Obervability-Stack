#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="$(dirname "$PROJECT_ROOT")"

FOODPULSE_COMPOSE="$WORKSPACE_ROOT/FoodPulse/docker-compose.yml"
FOODPULSE_ENV="$WORKSPACE_ROOT/FoodPulse/.env.example"
FOODPULSE_README="$WORKSPACE_ROOT/FoodPulse/README.md"
FOODPULSE_CLUSTER_STATUS="$WORKSPACE_ROOT/FoodPulse/scripts/cluster-status.sh"
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

header "FoodPulse Integration Audit"
echo "==========================="
echo

require_file "$FOODPULSE_COMPOSE"
require_file "$FOODPULSE_ENV"
require_file "$FOODPULSE_README"
require_file "$FOODPULSE_CLUSTER_STATUS"
require_file "$MONITORED_APPS_FILE"
require_file "$PROMETHEUS_FILE"

echo
header "Compose And Inventory Alignment"

assert_contains "$FOODPULSE_COMPOSE" "foodpulse-ui" "FoodPulse compose exposes the observability alias"
assert_contains "$FOODPULSE_COMPOSE" '127.0.0.1:${FOODPULSE_UI_HOST_PORT:-8090}:80' "FoodPulse UI host port defaults to 8090"
assert_contains "$MONITORED_APPS_FILE" "http://localhost:8090" "Control plane inventory uses the FoodPulse browser URL"
assert_contains "$MONITORED_APPS_FILE" "cp .env.example .env && ./scripts/start.sh" "Control plane inventory points at the FoodPulse startup path"
assert_contains "$MONITORED_APPS_FILE" "curl -I http://localhost:8090" "Control plane inventory uses the FoodPulse browser health check"
assert_contains "$FOODPULSE_README" "http://localhost:8090" "FoodPulse README documents the normalized browser URL"
assert_contains "$FOODPULSE_README" 'central `Obervability-Stack`' "FoodPulse README documents central observability ownership"

if rg -Fq -- "foodpulse-prometheus" "$FOODPULSE_COMPOSE"; then
  fail "FoodPulse compose should not include a local Prometheus service"
else
  pass "FoodPulse compose does not include a local Prometheus service"
fi

if rg -Fq -- "foodpulse-grafana" "$FOODPULSE_COMPOSE"; then
  fail "FoodPulse compose should not include a local Grafana service"
else
  pass "FoodPulse compose does not include a local Grafana service"
fi

if rg -Fq -- "foodpulse-alertmanager" "$FOODPULSE_COMPOSE"; then
  fail "FoodPulse compose should not include a local Alertmanager service"
else
  pass "FoodPulse compose does not include a local Alertmanager service"
fi

echo
header "Prometheus Scrape Contract"

assert_contains "$PROMETHEUS_FILE" "app: foodpulse" "Prometheus blackbox labels include app=foodpulse"
assert_contains "$PROMETHEUS_FILE" "http://foodpulse-ui/" "Prometheus blackbox target present for FoodPulse"

echo
header "Operator Contract"

assert_contains "$FOODPULSE_CLUSTER_STATUS" 'FOODPULSE_UI_HOST_PORT:-8090' "FoodPulse cluster status uses the normalized browser port"
assert_contains "$FOODPULSE_CLUSTER_STATUS" "foodpulse-pg-haproxy" "FoodPulse cluster status defaults to normalized Postgres HAProxy container names"
assert_contains "$FOODPULSE_ENV" "FOODPULSE_UI_HOST_PORT=8090" "FoodPulse env contract documents the browser port"

echo
header "Audit Summary"
echo "============="
info "Checks passed: $PASSED_CHECKS/$TOTAL_CHECKS"

if [ "$FAILED_CHECKS" -gt 0 ]; then
  fail "Failures: $FAILED_CHECKS"
  exit 1
fi

pass "FoodPulse integration audit passed"
