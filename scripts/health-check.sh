#!/usr/bin/env bash

set -euo pipefail

export PATH="${HOME}/.local/bin:${HOME}/.docker/cli-plugins:${PATH}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

COMPOSE=(docker compose -f "$PROJECT_ROOT/docker-compose.yml")

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

print_header() {
    echo -e "${PURPLE}$1${NC}"
}

print_section() {
    echo -e "${CYAN}$1${NC}"
}

print_status() {
    echo -e "${GREEN}OK${NC}  $1"
}

print_warning() {
    echo -e "${YELLOW}WARN${NC} $1"
}

print_error() {
    echo -e "${RED}FAIL${NC} $1"
}

print_info() {
    echo -e "${BLUE}INFO${NC} $1"
}

record_pass() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    print_status "$1"
}

record_fail() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    print_error "$1"
}

record_warning() {
    WARNINGS=$((WARNINGS + 1))
    print_warning "$1"
}

require_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        record_fail "Required command not found: $command_name"
        return 1
    fi

    record_pass "Required command available: $command_name"
}

json_field() {
    local payload="$1"
    local jq_filter="$2"

    if command -v jq >/dev/null 2>&1; then
        jq -r "$jq_filter" <<<"$payload"
        return
    fi

    JSON_PAYLOAD="$payload" python3 - "$jq_filter" <<'PY'
import json
import os
import sys

payload = json.loads(os.environ["JSON_PAYLOAD"])
query = sys.argv[1]

if query == ".overallStatus":
    print(payload.get("overallStatus", ""))
elif query == ".apps | length":
    print(len(payload.get("apps", [])))
elif query == ".summary.totalApps":
    print(payload.get("summary", {}).get("totalApps", ""))
elif query == ".status":
    print(payload.get("status", ""))
else:
    raise SystemExit(1)
PY
}

check_docker_access() {
    print_section "Runtime Checks"

    if docker info >/dev/null 2>&1; then
        record_pass "Docker daemon is reachable"
    else
        record_fail "Docker daemon is not reachable"
        return 1
    fi

    if "${COMPOSE[@]}" config >/dev/null 2>&1; then
        record_pass "Docker Compose configuration is valid"
    else
        record_fail "Docker Compose configuration is invalid"
        return 1
    fi

    if docker network inspect observability-net >/dev/null 2>&1; then
        record_pass "Shared network exists: observability-net"
    else
        record_fail "Shared network missing: observability-net"
    fi
}

check_compose_services() {
    print_section "Compose Services"

    local services=()
    local service
    while IFS= read -r service; do
        [ -n "$service" ] && services+=("$service")
    done < <("${COMPOSE[@]}" config --services)

    if [ "${#services[@]}" -eq 0 ]; then
        record_fail "No services found in compose configuration"
        return 1
    fi

    print_info "Default service set: ${services[*]}"

    for service in "${services[@]}"; do
        local container_id
        container_id="$("${COMPOSE[@]}" ps -q "$service")"

        if [ -z "$container_id" ]; then
            record_fail "Service not running: $service"
            continue
        fi

        local inspect_output
        inspect_output="$(docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")"
        local state="${inspect_output%%|*}"
        local health="${inspect_output##*|}"

        if [ "$state" != "running" ]; then
            record_fail "Service state is $state: $service"
            continue
        fi

        case "$health" in
            healthy|none)
                record_pass "Service running: $service"
                ;;
            starting)
                record_warning "Service still starting: $service"
                ;;
            *)
                record_fail "Service health is $health: $service"
                ;;
        esac
    done

    if docker ps --format '{{.Names}}' | grep -qx 'cadvisor'; then
        record_warning "Optional profile service running: cadvisor"
    else
        print_info "Optional profile service not enabled: cadvisor"
    fi
}

check_http_endpoint() {
    local name="$1"
    local url="$2"
    local expected_pattern="$3"
    local body_check="${4:-}"

    local response_file
    response_file="$(mktemp)"
    local status_code
    status_code="$(curl -sS -L --max-time 10 -o "$response_file" -w '%{http_code}' "$url" || true)"

    if [[ ! "$status_code" =~ $expected_pattern ]]; then
        rm -f "$response_file"
        record_fail "$name returned HTTP $status_code from $url"
        return 1
    fi

    if [ -n "$body_check" ] && ! grep -Eq "$body_check" "$response_file"; then
        rm -f "$response_file"
        record_fail "$name responded but body check failed for pattern: $body_check"
        return 1
    fi

    rm -f "$response_file"
    record_pass "$name responded successfully"
}

check_public_endpoints() {
    print_section "Public Endpoints"

    check_http_endpoint "Prometheus health" "http://localhost:9090/-/healthy" '^200$'
    check_http_endpoint "Grafana health" "http://localhost:3000/api/health" '^200$' '"database"[[:space:]]*:[[:space:]]*"ok"'
    check_http_endpoint "Loki health" "http://localhost:3100/ready" '^200$'
    check_http_endpoint "Alertmanager health" "http://localhost:9093/-/healthy" '^200$'
    check_http_endpoint "Blackbox Exporter health" "http://localhost:9115/-/healthy" '^200$'
    check_http_endpoint "Node Exporter metrics" "http://localhost:9100/metrics" '^200$' 'node_'
    check_http_endpoint "DevOps Monitor UI" "http://localhost:4000/" '^(200|302)$'

    if docker ps --format '{{.Names}}' | grep -qx 'cadvisor'; then
        check_http_endpoint "cAdvisor health" "http://localhost:8080/healthz" '^200$'
    else
        print_info "Skipping cAdvisor endpoint because the optional profile is not running"
    fi
}

check_control_plane_apis() {
    print_section "Control Plane APIs"

    local services_payload
    services_payload="$(curl -fsS --max-time 15 http://localhost:4000/api/services/health)"
    local overall_status
    overall_status="$(json_field "$services_payload" ".overallStatus")"
    if [[ "$overall_status" =~ ^(healthy|degraded|unhealthy)$ ]]; then
        record_pass "UI service health API responded with overallStatus=$overall_status"
    else
        record_fail "UI service health API returned an unexpected overallStatus"
    fi

    local apps_payload
    apps_payload="$(curl -fsS --max-time 20 http://localhost:4000/api/apps/health)"
    local total_apps
    total_apps="$(json_field "$apps_payload" ".summary.totalApps")"
    if [[ "$total_apps" =~ ^[0-9]+$ ]] && [ "$total_apps" -gt 0 ]; then
        record_pass "Workspace app health API returned $total_apps monitored apps"
    else
        record_fail "Workspace app health API did not return monitored apps"
    fi

    local inventory_payload
    inventory_payload="$(curl -fsS --max-time 20 http://localhost:4000/api/apps)"
    local inventory_count
    inventory_count="$(json_field "$inventory_payload" ".apps | length")"
    if [[ "$inventory_count" =~ ^[0-9]+$ ]] && [ "$inventory_count" -gt 0 ]; then
        record_pass "Workspace app inventory API returned $inventory_count app definitions"
    else
        record_fail "Workspace app inventory API did not return app definitions"
    fi
}

check_prometheus_query() {
    print_section "Prometheus Query Path"

    local payload
    payload="$(curl -fsS --max-time 15 'http://localhost:9090/api/v1/query?query=up')"
    local status
    status="$(json_field "$payload" ".status")"

    if [ "$status" = "success" ]; then
        record_pass "Prometheus API query path is healthy"
    else
        record_fail "Prometheus API query path did not return success"
    fi
}

check_system_resources() {
    print_section "System Resources"

    local disk_usage
    disk_usage="$(df -P / | awk 'NR==2 {gsub("%", "", $5); print $5}')"
    local disk_available
    disk_available="$(df -Ph / | awk 'NR==2 {print $4}')"

    if [ "$disk_usage" -lt 85 ]; then
        record_pass "Disk usage healthy at ${disk_usage}% with ${disk_available} free"
    else
        record_warning "Disk usage elevated at ${disk_usage}% with ${disk_available} free"
    fi

    case "$(uname -s)" in
        Darwin)
            local page_size
            local free_pages
            local speculative_pages
            local free_bytes
            local free_gib

            page_size="$(sysctl -n hw.pagesize)"
            free_pages="$(vm_stat | awk '/Pages free/ {gsub("\\.", "", $3); print $3}')"
            speculative_pages="$(vm_stat | awk '/Pages speculative/ {gsub("\\.", "", $3); print $3}')"
            free_bytes=$(( (free_pages + speculative_pages) * page_size ))
            free_gib="$(awk -v bytes="$free_bytes" 'BEGIN {printf "%.2f", bytes / 1024 / 1024 / 1024}')"
            record_pass "Memory check completed on macOS with about ${free_gib} GiB readily reclaimable"
            ;;
        Linux)
            if command -v free >/dev/null 2>&1; then
                local available_mem
                available_mem="$(free -h | awk 'NR==2 {print $7}')"
                record_pass "Memory check completed on Linux with ${available_mem} available"
            else
                record_warning "Skipping memory check because 'free' is not available"
            fi
            ;;
        *)
            record_warning "Skipping memory check on unsupported OS: $(uname -s)"
            ;;
    esac
}

main() {
    echo
    print_header "DevOps Monitor Control Plane Smoke Check"
    echo "========================================="
    echo

    require_command docker || true
    require_command curl || true

    check_docker_access || true
    echo
    check_compose_services || true
    echo
    check_public_endpoints || true
    echo
    check_control_plane_apis || true
    echo
    check_prometheus_query || true
    echo
    check_system_resources || true
    echo

    print_header "Smoke Check Summary"
    echo "==================="
    print_info "Checks passed: $PASSED_CHECKS/$TOTAL_CHECKS"

    if [ "$WARNINGS" -gt 0 ]; then
        print_warning "Warnings: $WARNINGS"
    fi

    if [ "$FAILED_CHECKS" -gt 0 ]; then
        print_error "Failures: $FAILED_CHECKS"
        echo
        print_info "Next steps:"
        echo "  - Inspect service state: docker compose -f $PROJECT_ROOT/docker-compose.yml ps"
        echo "  - Inspect logs: docker compose -f $PROJECT_ROOT/docker-compose.yml logs [service]"
        echo "  - Re-run this smoke check after fixes"
        exit 1
    fi

    print_status "Control plane smoke check passed"
    echo
    print_info "Primary URLs:"
    echo "  - UI:            http://localhost:4000"
    echo "  - Grafana:       http://localhost:3000"
    echo "  - Prometheus:    http://localhost:9090"
    echo "  - Loki:          http://localhost:3100"
    echo "  - Alertmanager:  http://localhost:9093"
}

main "$@"
