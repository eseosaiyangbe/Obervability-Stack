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

MEMFLIP_COMPOSE="$WORKSPACE_ROOT/MemFlip/docker-compose.yml"
CONTROL_PLANE_HEALTH_URL="http://localhost:4000/api/apps/health"
MEMFLIP_FRONTEND_HEALTH_URL="http://localhost:8080/api/health"
MEMFLIP_BACKEND_HEALTH_URL="http://localhost:3101/health"
MEMFLIP_FRONTEND_URL="http://localhost:8080"
MEMFLIP_BACKEND_METRICS_URL="http://localhost:3101/metrics"

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
  curl -fsS -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d "$body"
}

http_head() {
  local url="$1"
  curl -fsSI "$url"
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

header "MemFlip Live Integration Audit"
echo "=============================="
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

if [ -f "$MEMFLIP_COMPOSE" ]; then
  pass "Found MemFlip compose file"
else
  fail "Missing MemFlip compose file"
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

if frontend_health=$(http_get_json "$MEMFLIP_FRONTEND_HEALTH_URL"); then
  pass "MemFlip frontend health endpoint responds"
  assert_json "$frontend_health" '.status == "healthy"' "MemFlip frontend proxy path reports healthy"
else
  fail "MemFlip frontend health endpoint is unreachable"
  exit 1
fi

if backend_health=$(http_get_json "$MEMFLIP_BACKEND_HEALTH_URL"); then
  pass "MemFlip backend health endpoint responds"
  assert_json "$backend_health" '.status == "healthy"' "MemFlip backend reports healthy"
else
  fail "MemFlip backend health endpoint is unreachable"
  exit 1
fi

if frontend_headers=$(http_head "$MEMFLIP_FRONTEND_URL"); then
  pass "MemFlip frontend responds on localhost:8080"
  assert_json "$(printf '%s' "$frontend_headers" | jq -Rs '{headers: .}')" '.headers | contains("200 OK")' "MemFlip frontend returns HTTP 200"
else
  fail "MemFlip frontend is unreachable on localhost:8080"
  exit 1
fi

if control_plane_health=$(http_get_json "$CONTROL_PLANE_HEALTH_URL"); then
  pass "Control plane app health endpoint responds"
  assert_json "$control_plane_health" '[.apps[] | select(.appId == "memflip")][0].status == "healthy"' "Control plane sees MemFlip as healthy"
else
  fail "Control plane app health endpoint is unreachable"
  exit 1
fi

echo
header "Synthetic Game Flow"

TS="$(date +%s)"
USERNAME="memflipaudit${TS}"

create_body=$(jq -cn --arg username "$USERNAME" '{username: $username}')
if create_response=$(http_post_json "http://localhost:8080/api/scores/user" "$create_body"); then
  pass "Created MemFlip audit user through the frontend proxy"
  assert_json "$create_response" '.success == true' "Audit user creation returned success"
else
  fail "Failed to create MemFlip audit user"
  exit 1
fi

start_body=$(jq -cn --arg username "$USERNAME" '{username: $username, difficulty: "easy"}')
if start_response=$(http_post_json "http://localhost:8080/api/game/start" "$start_body"); then
  pass "Started a MemFlip game through the frontend proxy"
  assert_json "$start_response" '.success == true' "MemFlip game start returned success"
else
  fail "Failed to start a MemFlip game"
  exit 1
fi

GAME_ID="$(jq -r '.game.gameId // empty' <<<"$start_response")"
if [ -n "$GAME_ID" ]; then
  pass "MemFlip game start returned a game ID"
else
  fail "MemFlip game start did not return a game ID"
  exit 1
fi

PAIR_JSON="$(jq -c '.game.cards | sort_by(.emoji) | group_by(.emoji) | map(select(length > 1))[0]' <<<"$start_response")"
CARD1_ID="$(jq -r '.[0].id // empty' <<<"$PAIR_JSON")"
CARD2_ID="$(jq -r '.[1].id // empty' <<<"$PAIR_JSON")"

if [ -n "$CARD1_ID" ] && [ -n "$CARD2_ID" ]; then
  pass "Found a valid matching card pair from the game payload"
else
  fail "Could not derive a valid matching card pair from the game payload"
  exit 1
fi

match_body=$(jq -cn \
  --arg game_id "$GAME_ID" \
  --arg card1 "$CARD1_ID" \
  --arg card2 "$CARD2_ID" \
  '{gameId: $game_id, card1Id: $card1, card2Id: $card2, matchTime: 1000}')

if match_response=$(http_post_json "http://localhost:8080/api/game/match" "$match_body"); then
  pass "Submitted a valid MemFlip card match"
  assert_json "$match_response" '.success == true' "MemFlip match request returned success"
  assert_json "$match_response" '.isMatch == true' "MemFlip match request recorded a successful pair"
else
  fail "Failed to submit a MemFlip card match"
  exit 1
fi

complete_body=$(jq -cn --arg game_id "$GAME_ID" '{gameId: $game_id, timeElapsed: 60000, finalScore: 0}')
if complete_response=$(http_post_json "http://localhost:8080/api/game/complete" "$complete_body"); then
  pass "Completed the synthetic MemFlip game"
  assert_json "$complete_response" '.success == true' "MemFlip complete request returned success"
else
  fail "Failed to complete the synthetic MemFlip game"
  exit 1
fi

if leaderboard_response=$(http_get_json "http://localhost:8080/api/leaderboard"); then
  pass "MemFlip leaderboard endpoint responds"
  assert_json "$leaderboard_response" '.success == true' "MemFlip leaderboard returned success"
  assert_json "$leaderboard_response" '.leaderboard | length >= 1' "MemFlip leaderboard includes at least one player"
else
  fail "MemFlip leaderboard endpoint is unreachable"
  exit 1
fi

if stats_response=$(http_get_json "http://localhost:8080/api/scores/$USERNAME"); then
  pass "MemFlip user stats endpoint responds"
else
  fail "MemFlip user stats endpoint is unreachable"
  exit 1
fi

echo
header "Backend Metrics Checks"

backend_metrics="$(curl -fsS "$MEMFLIP_BACKEND_METRICS_URL")"

if grep -Fq 'app_health_status{service="backend",component="api"} 1' <<<"$backend_metrics"; then
  pass "MemFlip backend metrics report API health"
else
  fail "MemFlip backend metrics report API health"
fi

if grep -Fq 'http_requests_total{method="POST",route="/start",status_code="201",endpoint_type="other"}' <<<"$backend_metrics"; then
  pass "MemFlip backend metrics captured the game start route"
else
  fail "MemFlip backend metrics captured the game start route"
fi

if grep -Fq 'http_requests_total{method="POST",route="/match",status_code="200",endpoint_type="other"}' <<<"$backend_metrics"; then
  pass "MemFlip backend metrics captured the match route"
else
  fail "MemFlip backend metrics captured the match route"
fi

if grep -Fq 'http_requests_total{method="POST",route="/complete",status_code="200",endpoint_type="other"}' <<<"$backend_metrics"; then
  pass "MemFlip backend metrics captured the complete route"
else
  fail "MemFlip backend metrics captured the complete route"
fi

if grep -Fq 'game_scores_total{difficulty="easy",score_range="beginner"}' <<<"$backend_metrics"; then
  pass "MemFlip backend metrics recorded the completed game score with bounded labels"
else
  fail "MemFlip backend metrics recorded the completed game score with bounded labels"
fi

echo
header "Audit Summary"
echo "==============="
info "Checks passed: $PASSED_CHECKS/$TOTAL_CHECKS"

if [ "$FAILED_CHECKS" -gt 0 ]; then
  fail "Failures: $FAILED_CHECKS"
  exit 1
fi

pass "MemFlip live integration audit passed"
