#!/usr/bin/env bash

set -euo pipefail

if [ -f "$HOME/.zprofile" ]; then
  # shellcheck source=/dev/null
  source "$HOME/.zprofile" >/dev/null 2>&1 || true
fi

export PATH="$HOME/.local/bin:$HOME/.docker/cli-plugins:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="$(dirname "$PROJECT_ROOT")"

FOODPULSE_COMPOSE="$WORKSPACE_ROOT/FoodPulse/docker-compose.yml"
FOODPULSE_CLUSTER_STATUS="$WORKSPACE_ROOT/FoodPulse/scripts/cluster-status.sh"
CONTROL_PLANE_HEALTH_URL="http://localhost:4000/api/apps/health"
PROMETHEUS_QUERY_URL="http://localhost:9090/api/v1/query"
FOODPULSE_URL="http://localhost:8090"
FOODPULSE_STATS_URL="http://localhost:8090/api/getstats"

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

header "FoodPulse Live Integration Audit"
echo "==============================="
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

if [ -f "$FOODPULSE_COMPOSE" ]; then
  pass "Found FoodPulse compose file"
else
  fail "Missing FoodPulse compose file"
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

if app_headers=$(http_head "$FOODPULSE_URL"); then
  pass "FoodPulse responds on localhost:8090"
  assert_json "$(printf '%s' "$app_headers" | jq -Rs '{headers: .}')" '.headers | contains("200 OK")' "FoodPulse frontend returns HTTP 200"
else
  fail "FoodPulse frontend is unreachable on localhost:8090"
  exit 1
fi

if foodpulse_stats=$(http_get_json "$FOODPULSE_STATS_URL"); then
  pass "FoodPulse stats endpoint responds through the UI proxy"
  assert_json "$foodpulse_stats" '.hostname != null and .pageviews != null' "FoodPulse stats endpoint returns app telemetry"
else
  fail "FoodPulse stats endpoint is unreachable"
  exit 1
fi

if control_plane_health=$(http_get_json "$CONTROL_PLANE_HEALTH_URL"); then
  pass "Control plane app health endpoint responds"
  assert_json "$control_plane_health" '[.apps[] | select(.appId == "foodpulse")][0].status == "healthy"' "Control plane sees FoodPulse as healthy"
else
  fail "Control plane app health endpoint is unreachable"
  exit 1
fi

echo
header "Central Observability Checks"

if foodpulse_probe=$(prom_query 'probe_success{job="blackbox-http",app="foodpulse"}'); then
  pass "Prometheus returns FoodPulse blackbox target health"
  assert_json "$foodpulse_probe" '.data.result | length >= 1' "Prometheus sees at least one FoodPulse blackbox target"
  assert_json "$foodpulse_probe" 'all(.data.result[]; .value[1] == "1")' "All FoodPulse blackbox targets are up"
else
  fail "Prometheus FoodPulse target query failed"
  exit 1
fi

if foodpulse_api_up=$(prom_query 'up{job="foodpulse-api"}'); then
  pass "Prometheus returns FoodPulse API scrape health"
  assert_json "$foodpulse_api_up" '.data.result | length == 1' "Prometheus sees the FoodPulse API metrics target"
  assert_json "$foodpulse_api_up" '.data.result[0].value[1] == "1"' "FoodPulse API metrics target is up"
else
  fail "Prometheus FoodPulse API scrape query failed"
  exit 1
fi

if foodpulse_http_metrics=$(prom_query 'foodpulse_http_requests_total{job="foodpulse-api",route!="/metrics"}'); then
  pass "Prometheus returns FoodPulse HTTP request metrics"
  assert_json "$foodpulse_http_metrics" '.data.result | length >= 1' "FoodPulse HTTP request metrics are present"
else
  fail "Prometheus FoodPulse HTTP request metric query failed"
  exit 1
fi

if foodpulse_latency=$(prom_query 'foodpulse:http_p95_latency_seconds'); then
  pass "Prometheus returns FoodPulse p95 latency recording rule"
  assert_json "$foodpulse_latency" '.data.result | length >= 1' "FoodPulse p95 latency recording rule has data"
else
  fail "Prometheus FoodPulse p95 latency query failed"
  exit 1
fi

echo
header "Operator Workflow Check"

if "$FOODPULSE_CLUSTER_STATUS" >/tmp/foodpulse-cluster-status.log 2>&1; then
  pass "FoodPulse cluster-status helper reports a healthy lab"
else
  fail "FoodPulse cluster-status helper reports a healthy lab"
  sed -n '1,120p' /tmp/foodpulse-cluster-status.log
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

pass "FoodPulse live integration audit passed"
