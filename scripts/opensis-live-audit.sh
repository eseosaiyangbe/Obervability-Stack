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

OPENSIS_COMPOSE="$WORKSPACE_ROOT/OpenSIS/docker-compose.yaml"
CONTROL_PLANE_HEALTH_URL="http://localhost:4000/api/apps/health"
PROMETHEUS_QUERY_URL="http://localhost:9090/api/v1/query"
OPENSIS_URL="http://localhost:8088"
VAULT_HEALTH_URL="http://localhost:8200/v1/sys/health"

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

http_get_body() {
  local url="$1"
  curl -fsSL "$url"
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

header "OpenSIS Live Integration Audit"
echo "============================="
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

if [ -f "$OPENSIS_COMPOSE" ]; then
  pass "Found OpenSIS compose file"
else
  fail "Missing OpenSIS compose file"
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

if app_headers=$(http_head "$OPENSIS_URL"); then
  pass "OpenSIS responds on localhost:8088"
  assert_json "$(printf '%s' "$app_headers" | jq -Rs '{headers: .}')" '.headers | contains("HTTP/1.1 302") or contains("HTTP/1.1 200")' "OpenSIS returns an HTTP success or redirect response"
else
  fail "OpenSIS is unreachable on localhost:8088"
  exit 1
fi

if app_body=$(http_get_body "$OPENSIS_URL"); then
  pass "OpenSIS root page responds with HTML"
  if grep -Eiq 'openSIS|opensis' <<<"$app_body"; then
    pass "OpenSIS root page contains application branding"
  else
    fail "OpenSIS root page contains application branding"
  fi
else
  fail "OpenSIS root page is unreachable"
  exit 1
fi

if vault_health=$(http_get_json "$VAULT_HEALTH_URL"); then
  pass "OpenSIS Vault health endpoint responds"
  assert_json "$vault_health" '.initialized == true' "Vault reports initialized"
  assert_json "$vault_health" '.sealed == false' "Vault reports unsealed"
else
  fail "OpenSIS Vault health endpoint is unreachable"
  exit 1
fi

if control_plane_health=$(http_get_json "$CONTROL_PLANE_HEALTH_URL"); then
  pass "Control plane app health endpoint responds"
  assert_json "$control_plane_health" '[.apps[] | select(.appId == "opensis")][0].status == "healthy"' "Control plane sees OpenSIS as healthy"
else
  fail "Control plane app health endpoint is unreachable"
  exit 1
fi

echo
header "Prometheus Target Checks"

if opensis_probe=$(prom_query 'probe_success{job="blackbox-http",app="opensis"}'); then
  pass "Prometheus returns OpenSIS blackbox target health"
  assert_json "$opensis_probe" '.data.result | length >= 1' "Prometheus sees at least one OpenSIS blackbox target"
  assert_json "$opensis_probe" 'all(.data.result[]; .value[1] == "1")' "All OpenSIS blackbox targets are up"
else
  fail "Prometheus OpenSIS target query failed"
  exit 1
fi

if opensis_mariadb_target=$(prom_query 'up{job="opensis-mariadb"}'); then
  pass "Prometheus returns OpenSIS MariaDB exporter scrape health"
  assert_json "$opensis_mariadb_target" '.data.result | length == 1' "Prometheus sees the OpenSIS MariaDB exporter target"
  assert_json "$opensis_mariadb_target" '.data.result[0].value[1] == "1"' "OpenSIS MariaDB exporter target is up"
else
  fail "Prometheus OpenSIS MariaDB exporter query failed"
  exit 1
fi

if opensis_mariadb_up=$(prom_query 'opensis:mariadb_up'); then
  pass "Prometheus returns OpenSIS MariaDB database health"
  assert_json "$opensis_mariadb_up" '.data.result | length >= 1' "OpenSIS MariaDB health recording rule has data"
  assert_json "$opensis_mariadb_up" '.data.result[0].value[1] == "1"' "OpenSIS MariaDB reports up"
else
  fail "Prometheus OpenSIS MariaDB health query failed"
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

pass "OpenSIS live integration audit passed"
