# MemFlip Operator Runbook

## Purpose

MemFlip is the reference onboarding workload in this platform lab.

Use this runbook when you need the simplest example of how an app should be started, checked, observed, and diagnosed from the shared control plane.

MemFlip teaches:

- browser-first app validation
- frontend proxy health
- backend API health
- simple Postgres and Redis dependencies
- synthetic user/game flow validation
- app metrics from a small Node.js service
- Kubernetes readiness without microservice complexity

## What MemFlip Does

MemFlip is a memory-card game with a small web frontend and a backend API.

| Component | Role | Local Surface |
|---|---|---|
| `frontend` | Browser UI and Nginx API proxy | `http://localhost:8080` |
| `backend` | Node.js API, game logic, metrics | `http://localhost:3101/health`, `http://localhost:3101/metrics` |
| `postgres` | Persistent users, games, scores | internal Docker network only |
| `redis` | cache/session support | internal Docker network only |

The frontend proxy is important. Operators should usually test the app through `http://localhost:8080/api/...` first because that matches how a browser user reaches the backend.

## Start MemFlip

Start from the workspace root:

```bash
cd MemFlip
cp .env.example .env
docker compose up -d
```

Then return to the observability stack:

```bash
cd ../Obervability-Stack
./scripts/devops-monitor.sh operator
```

## Confirm MemFlip Is Healthy

Start with the standard platform workflow:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh operator
```

Then run the MemFlip live audit:

```bash
./scripts/devops-monitor.sh memflip-live
```

The live audit proves:

- frontend proxy health
- backend health
- frontend browser reachability
- control-plane inventory health
- synthetic user creation
- synthetic game start
- valid matching-card action
- synthetic game completion
- leaderboard response
- user stats response
- backend metrics reaction

## Minimum Manual Health Checks

Use these when you want a quick check without running the full live audit:

```bash
curl -fsS http://localhost:8080/api/health | jq .
curl -fsS http://localhost:3101/health | jq .
curl -fsSI http://localhost:8080
curl -fsS http://localhost:3101/metrics | head
curl -fsS http://localhost:4000/api/apps/memflip/overview | jq .
```

Expected result:

- proxied frontend health reports `healthy`
- backend health reports `healthy`
- frontend returns HTTP `200`
- backend metrics endpoint returns Prometheus text metrics
- control plane reports MemFlip as `healthy`

## Metrics To Watch

MemFlip's backend exposes application metrics directly from `http://localhost:3101/metrics`.

| Metric/Signal | What It Means | Healthy Interpretation |
|---|---|---|
| `app_health_status{service="backend",component="api"} 1` | Backend API health metric | Should be `1` |
| `http_requests_total` | Requests seen by backend routes | Should increase during user/game activity |
| `game_scores_total` | Completed game score events | Should appear after a completed game |
| frontend blackbox probe | Browser/proxy path is reachable | Should be up in Prometheus/control plane |
| backend blackbox probe | Backend health endpoint is reachable | Should be up in Prometheus/control plane |

Quick metrics check:

```bash
curl -fsS http://localhost:3101/metrics | rg 'app_health_status|http_requests_total|game_scores_total'
```

## Logs To Check

Start broad:

```bash
cd MemFlip
docker compose logs --tail=80 frontend
docker compose logs --tail=80 backend
docker compose logs --tail=80 postgres
docker compose logs --tail=80 redis
```

Follow the user flow in this order:

1. `frontend`: browser request and proxy behavior
2. `backend`: API route handling and game logic
3. `postgres`: persistence errors for users, games, or scores
4. `redis`: cache/session connectivity

## Common Failure Scenarios

### Frontend Does Not Load

Symptom:

- `http://localhost:8080` does not load
- dashboard browser target fails
- frontend blackbox probe is down

First checks:

```bash
cd MemFlip
docker compose ps frontend backend
docker compose logs --tail=100 frontend
curl -fsS http://localhost:3101/health | jq .
```

Likely causes:

- frontend container is not running
- frontend is waiting for backend startup
- Nginx proxy configuration cannot reach `backend:3001`
- port `8080` is already in use

Kubernetes mapping:

```bash
kubectl get pods -n humor-game -l app=frontend
kubectl logs deployment/frontend -n humor-game --tail=100
kubectl get ingress -n humor-game
```

### Frontend Loads But API Calls Fail

Symptom:

- browser loads static UI
- game start, leaderboard, or stats calls fail
- `http://localhost:8080/api/health` fails
- direct backend `http://localhost:3101/health` may still pass

First checks:

```bash
cd MemFlip
curl -fsS http://localhost:8080/api/health | jq .
curl -fsS http://localhost:3101/health | jq .
docker compose logs --tail=120 frontend
docker compose logs --tail=120 backend
```

Likely causes:

- Nginx frontend proxy path is broken
- backend started but is not reachable from the frontend network
- API base URL mismatch
- backend dependency errors are causing route failures

Kubernetes mapping:

```bash
kubectl get svc -n humor-game
kubectl logs deployment/frontend -n humor-game --tail=120
kubectl logs deployment/backend -n humor-game --tail=120
kubectl describe ingress -n humor-game
```

### Backend Is Unhealthy

Symptom:

- `http://localhost:3101/health` fails
- `http://localhost:8080/api/health` fails
- live audit cannot create user or start game

First checks:

```bash
cd MemFlip
docker compose ps backend postgres redis
docker compose logs --tail=120 backend
docker compose logs --tail=80 postgres
docker compose logs --tail=80 redis
```

Likely causes:

- Postgres is not healthy
- Redis is not healthy
- environment variables are missing or wrong
- backend failed during startup

Kubernetes mapping:

```bash
kubectl get pods -n humor-game
kubectl logs deployment/backend -n humor-game --tail=120
kubectl describe deployment/backend -n humor-game
kubectl get events -n humor-game --sort-by='.lastTimestamp'
```

### Game Flow Fails

Symptom:

- health checks pass
- user creation, game start, match, complete, leaderboard, or stats calls fail
- `./scripts/devops-monitor.sh memflip-live` fails in the synthetic game section

First checks:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh memflip-live

cd ../MemFlip
docker compose logs --tail=150 backend
docker compose logs --tail=80 postgres
```

Likely causes:

- backend route regression
- database schema or seed issue
- Postgres write failure
- frontend proxy only partially working

Kubernetes mapping:

```bash
kubectl logs deployment/backend -n humor-game --tail=150
kubectl exec -n humor-game deployment/backend -- printenv | grep -E 'DB_|REDIS_|NODE_ENV|PORT'
kubectl get events -n humor-game --sort-by='.lastTimestamp'
```

### Metrics Are Missing

Symptom:

- app works in the browser
- dashboard cannot show backend metrics
- live audit fails in backend metrics checks
- Prometheus blackbox targets are missing or down

First checks:

```bash
curl -fsS http://localhost:3101/metrics | head
curl -fsS http://localhost:3101/metrics | rg 'app_health_status|http_requests_total|game_scores_total'
cd Obervability-Stack
./scripts/devops-monitor.sh memflip
```

Likely causes:

- backend metrics route changed
- route labels changed and the live audit needs updating
- Prometheus scrape target is missing
- app is not attached to `observability-net`

Kubernetes mapping:

```bash
kubectl get pods -n humor-game --show-labels
kubectl get servicemonitor -A
kubectl port-forward -n humor-game deployment/backend 3101:3001
```

## Recovery Commands

Local Docker Compose:

```bash
cd MemFlip
docker compose restart frontend
docker compose restart backend
docker compose restart postgres
docker compose restart redis
docker compose ps
```

If dependencies are corrupted in a local learning environment, stop and review logs before removing volumes. Data loss is acceptable only when the operator intentionally wants a clean lab reset.

Kubernetes:

```bash
kubectl rollout restart deployment/frontend -n humor-game
kubectl rollout restart deployment/backend -n humor-game
kubectl rollout status deployment/frontend -n humor-game
kubectl rollout status deployment/backend -n humor-game
```

## Kubernetes Readiness Notes

MemFlip has Kubernetes and GitOps manifests under `MemFlip/k8s` and `MemFlip/gitops-safe`.

When we move this workspace to Kubernetes, this operator model should map like this:

| Local Concept | Kubernetes Equivalent |
|---|---|
| `docker compose ps` | `kubectl get pods -n humor-game` |
| `docker compose logs backend` | `kubectl logs deployment/backend -n humor-game` |
| `http://localhost:8080` | ingress or port-forwarded frontend service |
| `http://localhost:8080/api/health` | ingress/proxy health path |
| `http://localhost:3101/health` | port-forwarded backend service health |
| Compose network aliases | Kubernetes service DNS |
| Compose health checks | readiness and liveness probes |
| Prometheus static target | service discovery or ServiceMonitor |

The important rule is that the operator questions stay the same:

1. Is the app reachable?
2. Is the app healthy?
3. Are dependencies healthy?
4. Are metrics arriving?
5. Are logs arriving?
6. Are alerts firing correctly?

Only the command surface changes.

## Related MemFlip Docs

Use these when you need deeper app-specific detail:

- `MemFlip/README.md`
- `MemFlip/docs/local/README.md`
- `MemFlip/docs/local/02-compose.md`
- `MemFlip/docs/local/08-troubleshooting.md`
- `MemFlip/docs/troubleshooting.md`
- `MemFlip/docs/monitoring-troubleshooting.md`
