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
FOODPULSE_PROMETHEUS_URL="http://localhost:9095/-/healthy"
FOODPULSE_GRAFANA_URL="http://localhost:3010/api/health"
FOODPULSE_ALERTMANAGER_URL="http://localhost:9096/-/healthy"
FOODPULSE_HAPROXY_STATS_URL="http://localhost:8410/stats"

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

if stats_headers=$(http_head "$FOODPULSE_STATS_URL"); then
  pass "FoodPulse stats endpoint responds through the UI proxy"
  assert_json "$(printf '%s' "$stats_headers" | jq -Rs '{headers: .}')" '.headers | contains("200 OK")' "FoodPulse stats endpoint returns HTTP 200"
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
header "Internal Lab Surface Checks"

if foodpulse_prometheus_headers=$(http_head "$FOODPULSE_PROMETHEUS_URL"); then
  pass "FoodPulse Prometheus health endpoint responds"
  assert_json "$(printf '%s' "$foodpulse_prometheus_headers" | jq -Rs '{headers: .}')" '.headers | contains("200 OK")' "FoodPulse Prometheus returns HTTP 200"
else
  fail "FoodPulse Prometheus health endpoint is unreachable"
  exit 1
fi

if foodpulse_grafana=$(http_get_json "$FOODPULSE_GRAFANA_URL"); then
  pass "FoodPulse Grafana health endpoint responds"
  assert_json "$foodpulse_grafana" '.database == "ok"' "FoodPulse Grafana reports a healthy database"
else
  fail "FoodPulse Grafana health endpoint is unreachable"
  exit 1
fi

if foodpulse_alertmanager_headers=$(http_head "$FOODPULSE_ALERTMANAGER_URL"); then
  pass "FoodPulse Alertmanager health endpoint responds"
  assert_json "$(printf '%s' "$foodpulse_alertmanager_headers" | jq -Rs '{headers: .}')" '.headers | contains("200 OK")' "FoodPulse Alertmanager returns HTTP 200"
else
  fail "FoodPulse Alertmanager health endpoint is unreachable"
  exit 1
fi

if haproxy_headers=$(http_head "$FOODPULSE_HAPROXY_STATS_URL"); then
  pass "FoodPulse HAProxy stats endpoint responds"
  assert_json "$(printf '%s' "$haproxy_headers" | jq -Rs '{headers: .}')" '.headers | contains("200 OK")' "FoodPulse HAProxy stats endpoint returns HTTP 200"
else
  fail "FoodPulse HAProxy stats endpoint is unreachable"
  exit 1
fi

echo
header "Prometheus Target Checks"

if foodpulse_probe=$(prom_query 'probe_success{job="blackbox-http",app="foodpulse"}'); then
  pass "Prometheus returns FoodPulse blackbox target health"
  assert_json "$foodpulse_probe" '.data.result | length >= 1' "Prometheus sees at least one FoodPulse blackbox target"
  assert_json "$foodpulse_probe" 'all(.data.result[]; .value[1] == "1")' "All FoodPulse blackbox targets are up"
else
  fail "Prometheus FoodPulse target query failed"
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
