#!/usr/bin/env bash

set -euo pipefail

if [ -f "$HOME/.zprofile" ]; then
  # The workstation bootstrap installs Docker and friends in user-space locations.
  # Source the user profile so non-interactive shells inherit that path too.
  # shellcheck source=/dev/null
  source "$HOME/.zprofile" >/dev/null 2>&1 || true
fi

export PATH="$HOME/.local/bin:$HOME/.docker/cli-plugins:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="$(dirname "$PROJECT_ROOT")"

SWIFTPAY_COMPOSE="$WORKSPACE_ROOT/SwiftPay/docker-compose.yml"
CONTROL_PLANE_HEALTH_URL="http://localhost:4000/api/apps/health"
SWIFTPAY_BUSINESS_URL="http://localhost:4000/api/apps/swiftpay/business"
SWIFTPAY_GATEWAY_HEALTH_URL="http://localhost:3007/health"
SWIFTPAY_FRONTEND_URL="http://localhost:8081"
PROMETHEUS_QUERY_URL="http://localhost:9090/api/v1/query"

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

info() {
  echo -e "${BLUE}INFO${NC} $1"
}

header() {
  echo -e "${PURPLE}$1${NC}"
}

require_command() {
  local command_name="$1"
  if command -v "$command_name" >/dev/null 2>&1; then
    pass "Found command: $command_name"
  else
    fail "Missing command: $command_name"
    exit 1
  fi
}

http_get_json() {
  local url="$1"
  curl -fsS "$url"
}

http_post_json() {
  local url="$1"
  local body="$2"
  local auth_header="${3:-}"

  if [ -n "$auth_header" ]; then
    curl -fsS -X POST "$url" \
      -H 'Content-Type: application/json' \
      -H "$auth_header" \
      -d "$body"
  else
    curl -fsS -X POST "$url" \
      -H 'Content-Type: application/json' \
      -d "$body"
  fi
}

http_head() {
  local url="$1"
  curl -fsSI "$url"
}

prom_query() {
  local query="$1"
  curl -fsS --get "$PROMETHEUS_QUERY_URL" --data-urlencode "query=$query"
}

assert_json() {
  local json="$1"
  local jq_expr="$2"
  local label="$3"

  if jq -e "$jq_expr" >/dev/null 2>&1 <<<"$json"; then
    pass "$label"
  else
    fail "$label"
  fi
}

header "SwiftPay Live Integration Audit"
echo "================================"
echo

require_command docker
require_command curl
require_command jq

if docker compose version >/dev/null 2>&1; then
  pass "Docker Compose plugin is available"
else
  fail "Docker Compose plugin is not available"
  exit 1
fi

if [ -f "$SWIFTPAY_COMPOSE" ]; then
  pass "Found SwiftPay compose file"
else
  fail "Missing SwiftPay compose file"
  exit 1
fi

if docker network inspect observability-net >/dev/null 2>&1; then
  pass "Shared observability network exists"
else
  fail "Shared observability network does not exist"
  exit 1
fi

echo
header "Live Surface Checks"

if gateway_health=$(http_get_json "$SWIFTPAY_GATEWAY_HEALTH_URL"); then
  pass "SwiftPay gateway health endpoint responds"
  assert_json "$gateway_health" '.status == "healthy"' "SwiftPay gateway reports healthy"
else
  fail "SwiftPay gateway health endpoint is unreachable"
  exit 1
fi

if frontend_headers=$(http_head "$SWIFTPAY_FRONTEND_URL"); then
  pass "SwiftPay frontend responds on localhost:8081"
  assert_json "$(printf '%s' "$frontend_headers" | jq -Rs '{headers: .}')" '.headers | contains("200 OK")' "SwiftPay frontend returns HTTP 200"
else
  fail "SwiftPay frontend is unreachable on localhost:8081"
  exit 1
fi

if control_plane_health=$(http_get_json "$CONTROL_PLANE_HEALTH_URL"); then
  pass "Control plane app health endpoint responds"
  assert_json "$control_plane_health" '.apps | length >= 1' "Control plane returns monitored apps"
  assert_json "$control_plane_health" '[.apps[] | select(.appId == "swiftpay")][0].status == "healthy"' "Control plane sees SwiftPay as healthy"
else
  fail "Control plane app health endpoint is unreachable"
  exit 1
fi

if swiftpay_business=$(http_get_json "$SWIFTPAY_BUSINESS_URL"); then
  pass "Control plane SwiftPay business endpoint responds"
  assert_json "$swiftpay_business" '.app == "swiftpay"' "SwiftPay business endpoint identifies the app"
  assert_json "$swiftpay_business" '.metrics.pendingTransactions | type == "number"' "Business metric pendingTransactions is numeric"
  assert_json "$swiftpay_business" '.metrics.pendingAmount | type == "number"' "Business metric pendingAmount is numeric"
  assert_json "$swiftpay_business" '.metrics.queueDepth | type == "number"' "Business metric queueDepth is numeric"
  assert_json "$swiftpay_business" '.metrics.transactionFailureRate | type == "number"' "Business metric transactionFailureRate is numeric"
  assert_json "$swiftpay_business" '.metrics.walletFailureRate | type == "number"' "Business metric walletFailureRate is numeric"
  assert_json "$swiftpay_business" '.metrics.walletCircuitBreakerState | type == "number"' "Business metric walletCircuitBreakerState is numeric"
  info "Healthy happy-path transfers can still leave these business metrics at 0 because they represent pending, failure, queue, and circuit-breaker state."
else
  fail "Control plane SwiftPay business endpoint is unreachable"
  exit 1
fi

echo
header "Prometheus Target Checks"

if up_query=$(prom_query 'up{job=~"swiftpay-.+"}'); then
  pass "Prometheus returns SwiftPay target health"
  assert_json "$up_query" '.data.result | length == 5' "Prometheus sees all five SwiftPay metric jobs"
  assert_json "$up_query" 'all(.data.result[]; .value[1] == "1")' "All SwiftPay metric jobs are up"
else
  fail "Prometheus SwiftPay target query failed"
  exit 1
fi

echo
header "Synthetic Transfer Flow"

TS="$(date +%s)"
EMAIL1="live.audit.${TS}.a@example.com"
EMAIL2="live.audit.${TS}.b@example.com"
PASSWORD='Password123!'
NAME1='Live Audit A'
NAME2='Live Audit B'
TRANSFER_AMOUNT='25.50'

register_body_1=$(jq -cn --arg email "$EMAIL1" --arg password "$PASSWORD" --arg name "$NAME1" '{email: $email, password: $password, name: $name}')
register_body_2=$(jq -cn --arg email "$EMAIL2" --arg password "$PASSWORD" --arg name "$NAME2" '{email: $email, password: $password, name: $name}')

if register_response_1=$(http_post_json "http://localhost:3007/api/auth/register" "$register_body_1"); then
  pass "Registered first audit user"
else
  fail "Failed to register first audit user"
  exit 1
fi

if register_response_2=$(http_post_json "http://localhost:3007/api/auth/register" "$register_body_2"); then
  pass "Registered second audit user"
else
  fail "Failed to register second audit user"
  exit 1
fi

USER1="$(jq -r '.user.id // .userId // empty' <<<"$register_response_1")"
USER2="$(jq -r '.user.id // .userId // empty' <<<"$register_response_2")"
TOKEN1="$(jq -r '.accessToken // empty' <<<"$register_response_1")"

if [ -n "$USER1" ] && [ -n "$USER2" ] && [ -n "$TOKEN1" ]; then
  pass "Audit registration returned user IDs and access token"
else
  fail "Audit registration response was missing a user ID or access token"
  exit 1
fi

if wallets_response=$(curl -fsS "http://localhost:3007/api/wallets" -H "Authorization: Bearer $TOKEN1"); then
  pass "Audit user can list wallets through the gateway"
  if jq -e --arg user1 "$USER1" --arg user2 "$USER2" '([.[] | select(.user_id == $user1)] | length) == 1 and ([.[] | select(.user_id == $user2)] | length) == 1' >/dev/null 2>&1 <<<"$wallets_response"; then
    pass "Wallet list includes both audit users"
  else
    fail "Wallet list includes both audit users"
  fi
else
  fail "Audit user could not list wallets through the gateway"
  exit 1
fi

transfer_body=$(jq -cn --arg from "$USER1" --arg to "$USER2" --arg amount "$TRANSFER_AMOUNT" '{fromUserId: $from, toUserId: $to, amount: ($amount | tonumber)}')

if transfer_response=$(curl -fsS -X POST "http://localhost:3007/api/transactions" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: live-audit-$TS" \
  -d "$transfer_body"); then
  pass "Synthetic transfer request was accepted"
  assert_json "$transfer_response" '.status == "PENDING"' "Synthetic transfer enters the async queue as PENDING"
else
  fail "Synthetic transfer request failed"
  exit 1
fi

TXN_ID="$(jq -r '.id // empty' <<<"$transfer_response")"
if [ -n "$TXN_ID" ]; then
  pass "Synthetic transfer returned a transaction ID"
else
  fail "Synthetic transfer did not return a transaction ID"
  exit 1
fi

transaction_list=''
transaction_status=''
for attempt in {1..10}; do
  if transaction_list=$(curl -fsS "http://localhost:3007/api/transactions?userId=$USER1" -H "Authorization: Bearer $TOKEN1"); then
    transaction_status="$(jq -r --arg txn_id "$TXN_ID" '[.[] | select(.id == $txn_id)][0].status // empty' <<<"$transaction_list")"
    if [ "$transaction_status" = "COMPLETED" ]; then
      break
    fi
  fi
  sleep 1
done

if [ "$transaction_status" = "COMPLETED" ]; then
  pass "Synthetic transfer completed asynchronously"
else
  fail "Synthetic transfer did not reach COMPLETED within the retry window"
  exit 1
fi

if sender_wallet=$(curl -fsS "http://localhost:3007/api/wallets/$USER1" -H "Authorization: Bearer $TOKEN1"); then
  pass "Audit user can read the updated sender wallet"
else
  fail "Audit user could not read the updated sender wallet"
  exit 1
fi

sender_balance="$(jq -r '.balance // empty' <<<"$sender_wallet")"
if awk -v balance="$sender_balance" 'BEGIN { exit !(balance > 974.49 && balance < 974.51) }'; then
  pass "Sender wallet balance reflects the completed transfer"
else
  fail "Sender wallet balance did not reflect the completed transfer"
fi

echo
header "Metrics Reaction Checks"

if completed_transfer_query=$(prom_query 'transactions_total{job="swiftpay-transaction-service",service="transaction-service",status="completed",type="transfer"}'); then
  pass "Prometheus returns completed transfer counters"
  assert_json "$completed_transfer_query" '.data.result | length >= 1' "Prometheus sees at least one completed transfer series"
  assert_json "$completed_transfer_query" '([.data.result[] | (.value[1] | tonumber)] | max) >= 1' "Completed transfer counter is at least 1"
else
  fail "Prometheus completed transfer query failed"
  exit 1
fi

if queue_depth_query=$(prom_query 'swiftpay:transaction_queue_depth'); then
  pass "Prometheus returns the SwiftPay queue-depth recording rule"
  assert_json "$queue_depth_query" '.data.result | length >= 1' "Queue-depth recording rule is present"
else
  fail "Prometheus queue-depth recording rule query failed"
  exit 1
fi

echo
header "Audit Summary"
echo "==============="
info "Checks passed: $PASSED_CHECKS/$TOTAL_CHECKS"

if [ "$FAILED_CHECKS" -gt 0 ]; then
  fail "Failures: $FAILED_CHECKS"
  exit 1
fi

pass "SwiftPay live integration audit passed"
