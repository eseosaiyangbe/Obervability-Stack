#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="$(dirname "$PROJECT_ROOT")"

SWIFTPAY_COMPOSE="$WORKSPACE_ROOT/SwiftPay/docker-compose.yml"
MONITORED_APPS_FILE="$PROJECT_ROOT/ui-next/lib/monitored-apps.ts"
PROMETHEUS_FILE="$PROJECT_ROOT/prometheus/prometheus.yml"
RECORDING_RULES_FILE="$PROJECT_ROOT/prometheus/recording_rules.yml"
BUSINESS_ROUTE_FILE="$PROJECT_ROOT/ui-next/app/api/apps/swiftpay/business/route.ts"
RUNBOOK_FILE="$WORKSPACE_ROOT/SwiftPay/docs/observability-runbook.md"

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

  if rg -Fq "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

header "SwiftPay Integration Audit"
echo "=========================="
echo

require_file "$SWIFTPAY_COMPOSE"
require_file "$MONITORED_APPS_FILE"
require_file "$PROMETHEUS_FILE"
require_file "$RECORDING_RULES_FILE"
require_file "$BUSINESS_ROUTE_FILE"
require_file "$RUNBOOK_FILE"

echo
header "Compose And Inventory Alignment"

aliases=(
  "swiftpay-frontend"
  "swiftpay-api-gateway"
  "swiftpay-auth-service"
  "swiftpay-wallet-service"
  "swiftpay-transaction-service"
  "swiftpay-notification-service"
)

for alias in "${aliases[@]}"; do
  assert_contains "$SWIFTPAY_COMPOSE" "$alias" "SwiftPay compose exposes observability alias: $alias"
  assert_contains "$MONITORED_APPS_FILE" "$alias" "Control plane inventory knows alias: $alias"
done

assert_contains "$MONITORED_APPS_FILE" "http://localhost:8081" "SwiftPay inventory browser URL uses localhost:8081"
assert_contains "$MONITORED_APPS_FILE" "http://localhost:3007/health" "SwiftPay inventory gateway health URL uses localhost:3007/health"
assert_contains "$MONITORED_APPS_FILE" "cd SwiftPay && docker compose up -d" "SwiftPay inventory localStart points to repo compose startup"

echo
header "Prometheus Scrape Contract"

blackbox_targets=(
  "http://swiftpay-frontend/"
  "http://swiftpay-api-gateway:3000/health"
  "http://swiftpay-auth-service:3004/health"
  "http://swiftpay-wallet-service:3001/health"
  "http://swiftpay-transaction-service:3002/health"
  "http://swiftpay-notification-service:3003/health"
)

for target in "${blackbox_targets[@]}"; do
  assert_contains "$PROMETHEUS_FILE" "$target" "Prometheus blackbox target present: $target"
done

metrics_jobs=(
  "job_name: 'swiftpay-api-gateway'"
  "job_name: 'swiftpay-auth-service'"
  "job_name: 'swiftpay-wallet-service'"
  "job_name: 'swiftpay-transaction-service'"
  "job_name: 'swiftpay-notification-service'"
)

for job in "${metrics_jobs[@]}"; do
  assert_contains "$PROMETHEUS_FILE" "$job" "Prometheus metrics scrape job present: $job"
done

echo
header "Business Metrics Contract"

business_rules=(
  "swiftpay:pending_transactions"
  "swiftpay:pending_amount"
  "swiftpay:transaction_queue_depth"
  "swiftpay:completed_transfers_total"
  "swiftpay:transaction_failure_rate_5m"
  "swiftpay:wallet_failed_transfer_rate_5m"
  "swiftpay:wallet_circuit_breaker_state"
)

for rule in "${business_rules[@]}"; do
  assert_contains "$RECORDING_RULES_FILE" "$rule" "Recording rule present: $rule"
  assert_contains "$BUSINESS_ROUTE_FILE" "$rule" "SwiftPay business API queries rule: $rule"
  assert_contains "$RUNBOOK_FILE" "$rule" "SwiftPay observability runbook documents rule: $rule"
done

assert_contains "$RECORDING_RULES_FILE" 'job="swiftpay-transaction-service"' "Recording rules scope transaction metrics to swiftpay-transaction-service"
assert_contains "$RECORDING_RULES_FILE" 'job="swiftpay-wallet-service"' "Recording rules scope wallet metrics to swiftpay-wallet-service"

echo
header "Audit Summary"
echo "=============="
info "Checks passed: $PASSED_CHECKS/$TOTAL_CHECKS"

if [ "$FAILED_CHECKS" -gt 0 ]; then
  fail "Failures: $FAILED_CHECKS"
  exit 1
fi

pass "SwiftPay integration audit passed"
