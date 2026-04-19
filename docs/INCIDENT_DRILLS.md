# Incident Drill Catalog

## Purpose

This is the Phase 5 incident drill catalog for the shared platform.

The goal is to teach operators how to break, detect, diagnose, and recover each workload safely.

This catalog does not replace the app operator runbooks. It sits above them and tells you which controlled failure to practice next.

## Safety Model

Use these safety levels before running a drill.

| Level | Meaning | Rule |
|---|---|---|
| `Read-only` | No workload is intentionally changed | Safe to run during normal validation |
| `Restart` | One service is restarted or temporarily stopped | Capture logs first and recover immediately |
| `Data-risk` | Stateful topology or volumes may be affected | Only run in a disposable local lab |
| `Manual` | Drill is interactive or requires operator judgment | Do not automate blindly |

## Pre-Drill Baseline

Always prove the platform is healthy before you break anything.

Run from `Obervability-Stack`:

```bash
./scripts/devops-monitor.sh operator
./scripts/devops-monitor.sh swiftpay-live
./scripts/devops-monitor.sh memflip-live
./scripts/devops-monitor.sh opensis-live
./scripts/devops-monitor.sh foodpulse-live
```

If the baseline is already failing, stop and fix the existing problem first. A drill is useful only when you start from a known-good state.

## Drill Index

| Drill | Workload | Safety | Primary Detection |
|---|---|---|---|
| SwiftPay transaction worker down | SwiftPay | Restart | `swiftpay-live` synthetic transfer does not complete |
| SwiftPay wallet service down | SwiftPay | Restart | wallet circuit or transfer failure signal |
| SwiftPay RabbitMQ unavailable | SwiftPay | Restart | pending/queue pressure and transaction failures |
| MemFlip backend down | MemFlip | Restart | frontend proxy health and synthetic game flow fail |
| MemFlip metrics missing | MemFlip | Read-only / Restart | backend metrics checks fail |
| OpenSIS Vault unavailable | OpenSIS | Restart | Vault health and UI startup path fail |
| OpenSIS MariaDB unhealthy | OpenSIS | Restart / Data-risk | UI down or DB-backed errors |
| OpenSIS blackbox mismatch | OpenSIS | Read-only | browser works but probe fails |
| FoodPulse Redis failover | FoodPulse | Manual | `cluster-status.sh` Redis view changes |
| FoodPulse Postgres promotion | FoodPulse | Manual / Data-risk | `cluster-status.sh` Postgres view changes |
| FoodPulse app healthy but topology degraded | FoodPulse | Restart | UI can work while HA checks fail |
| Control plane probe/config drift | Platform | Read-only / Restart | app healthy locally but control plane disagrees |

## Executed Drill Log

| Date | Drill | Result | Notes |
|---|---|---|---|
| 2026-04-19 | MemFlip backend down | Passed | Direct live audit caught the failure; control-plane health lagged briefly before and after recovery because blackbox probe data refreshes on its own interval |
| 2026-04-19 | SwiftPay transaction worker down | Passed | Stopping `transaction-service` made the gateway return HTTP 500 on transfer creation; after restart, direct service health recovered before control-plane and Prometheus state refreshed |
| 2026-04-19 | OpenSIS Vault unavailable | Passed | OpenSIS UI stayed reachable while `opensis-live` caught Vault HTTP failures; recovery required starting Vault and rerunning `vault-bootstrap` because Vault restarted sealed |
| 2026-04-19 | FoodPulse Redis failover | Passed | Sentinel promoted a replica after the Redis master stopped; a follow-up cluster check confirmed one master with the old master rejoined as a replica, and `foodpulse-live` returned to `16/16` |
| 2026-04-19 | Control plane probe drift | Passed | Stopping `blackbox-exporter` made Prometheus blackbox targets report `0` while direct app probes stayed healthy; restarting blackbox restored all targets to `1` and operator checks to `26/26` |

## Standard Drill Format

Every drill should follow this order:

1. Confirm baseline health.
2. Capture pre-drill evidence.
3. Trigger one failure.
4. Observe the dashboard and app-specific live audit.
5. Run the app operator runbook first-response commands.
6. Recover the service.
7. Confirm post-drill health.
8. Record what happened in `JOURNEY-RUNBOOK.md`.

## SwiftPay Drills

### Drill 1: Transaction Worker Down

Safety: `Restart`

What this tests:

- async transaction processing
- queue pressure
- whether the live audit catches incomplete money movement

Baseline:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh swiftpay-live
```

Trigger:

```bash
cd ../SwiftPay
docker compose stop transaction-service
```

Expected detection:

- `./scripts/devops-monitor.sh swiftpay-live` should fail during synthetic transfer completion
- SwiftPay dashboard money-flow guidance should point toward queue/worker checks
- transaction-service logs should stop showing processing activity

First checks:

```bash
cd ../Obervability-Stack
./scripts/devops-monitor.sh swiftpay-live
curl -fsS http://localhost:4000/api/apps/swiftpay/business | jq .

cd ../SwiftPay
docker compose logs --tail=120 transaction-service
docker compose logs --tail=80 rabbitmq
```

Recovery:

```bash
cd SwiftPay
docker compose start transaction-service

cd ../Obervability-Stack
./scripts/devops-monitor.sh swiftpay-live
```

Kubernetes equivalent:

```bash
kubectl scale deployment/transaction-service --replicas=0 -n swiftpay
kubectl scale deployment/transaction-service --replicas=1 -n swiftpay
kubectl rollout status deployment/transaction-service -n swiftpay
```

### Drill 2: Wallet Service Down

Safety: `Restart`

What this tests:

- downstream wallet dependency behavior
- transaction failure behavior
- circuit-breaker interpretation

Baseline:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh swiftpay-live
```

Trigger:

```bash
cd ../SwiftPay
docker compose stop wallet-service
```

Expected detection:

- synthetic transfer should fail or stop completing
- wallet failure rate or circuit-breaker state may change
- transaction-service logs should show wallet dependency errors

First checks:

```bash
cd ../SwiftPay
docker compose logs --tail=120 wallet-service
docker compose logs --tail=120 transaction-service

cd ../Obervability-Stack
curl -fsS http://localhost:4000/api/apps/swiftpay/business | jq .
```

Recovery:

```bash
cd SwiftPay
docker compose start wallet-service

cd ../Obervability-Stack
./scripts/devops-monitor.sh swiftpay-live
```

Kubernetes equivalent:

```bash
kubectl scale deployment/wallet-service --replicas=0 -n swiftpay
kubectl scale deployment/wallet-service --replicas=1 -n swiftpay
kubectl rollout status deployment/wallet-service -n swiftpay
```

### Drill 3: RabbitMQ Unavailable

Safety: `Restart`

What this tests:

- async messaging dependency
- pending transactions
- queue and worker diagnosis

Baseline:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh swiftpay-live
```

Trigger:

```bash
cd ../SwiftPay
docker compose stop rabbitmq
```

Expected detection:

- transaction creation or completion path should fail
- transaction-service logs should show RabbitMQ connection failures
- SwiftPay operator runbook should lead to RabbitMQ and transaction-service checks

First checks:

```bash
cd SwiftPay
docker compose ps rabbitmq transaction-service
docker compose logs --tail=120 rabbitmq
docker compose logs --tail=120 transaction-service
```

Recovery:

```bash
cd SwiftPay
docker compose start rabbitmq
docker compose restart transaction-service

cd ../Obervability-Stack
./scripts/devops-monitor.sh swiftpay-live
```

Kubernetes equivalent:

```bash
kubectl scale statefulset/rabbitmq --replicas=0 -n swiftpay
kubectl scale statefulset/rabbitmq --replicas=1 -n swiftpay
kubectl rollout status statefulset/rabbitmq -n swiftpay
```

## MemFlip Drills

### Drill 4: Backend Down

Safety: `Restart`

What this tests:

- frontend proxy behavior
- backend API reachability
- synthetic user/game flow detection

Baseline:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh memflip-live
```

Trigger:

```bash
cd ../MemFlip
docker compose stop backend
```

Expected detection:

- `http://localhost:3101/health` should fail
- `http://localhost:8080/api/health` should fail or degrade
- synthetic game flow should fail before completion

First checks:

```bash
cd ../MemFlip
docker compose ps frontend backend postgres redis
docker compose logs --tail=120 backend
docker compose logs --tail=80 frontend
```

Recovery:

```bash
cd MemFlip
docker compose start backend

cd ../Obervability-Stack
./scripts/devops-monitor.sh memflip-live
```

Kubernetes equivalent:

```bash
kubectl scale deployment/backend --replicas=0 -n humor-game
kubectl scale deployment/backend --replicas=1 -n humor-game
kubectl rollout status deployment/backend -n humor-game
```

### Drill 5: Metrics Missing

Safety: `Read-only / Restart`

What this tests:

- backend `/metrics` availability
- route-label assumptions in the live audit
- whether app health and metrics health are treated separately

Baseline:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh memflip-live
```

Read-only trigger:

```bash
curl -fsS http://localhost:3101/metrics | rg 'app_health_status|http_requests_total|game_scores_total'
```

Optional failure trigger:

```bash
cd MemFlip
docker compose stop backend
```

Expected detection:

- metrics endpoint is unavailable when backend is down
- live audit fails in backend metrics checks
- operator should distinguish browser reachability from metrics availability

Recovery:

```bash
cd MemFlip
docker compose start backend

cd ../Obervability-Stack
./scripts/devops-monitor.sh memflip-live
```

Kubernetes equivalent:

```bash
kubectl port-forward -n humor-game deployment/backend 3101:3001
curl -fsS http://localhost:3101/metrics | head
```

## OpenSIS Drills

### Drill 6: Vault Unavailable

Safety: `Restart`

What this tests:

- secret-control-plane dependency
- Vault health detection
- app startup dependency on rendered secrets

Baseline:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh opensis-live
```

Trigger:

```bash
cd ../OpenSIS
docker compose stop vault
```

Expected detection:

- Vault health endpoint should fail
- `opensis-live` should fail in Vault checks
- Vault agent logs may show secret read/render failures

First checks:

```bash
cd ../OpenSIS
docker compose ps vault vault-agent-app vault-agent-db opensis-ui opensis-db
docker compose logs --tail=120 vault
docker compose logs --tail=120 vault-agent-app vault-agent-db
```

Recovery:

```bash
cd OpenSIS
docker compose start vault
docker compose restart vault-agent-app vault-agent-db

cd ../Obervability-Stack
./scripts/devops-monitor.sh opensis-live
```

Kubernetes equivalent:

```bash
kubectl get pods -n vault
kubectl logs -n vault vault-0 --tail=120
kubectl exec -n vault vault-0 -- sh -lc 'vault status'
```

### Drill 7: MariaDB Unhealthy

Safety: `Restart / Data-risk`

What this tests:

- database dependency behavior
- UI health dependence on MariaDB
- secret and DB state alignment

Baseline:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh opensis-live
```

Trigger:

```bash
cd ../OpenSIS
docker compose stop opensis-db
```

Expected detection:

- UI may fail or degrade
- blackbox probe may fail if the app cannot serve the browser path
- OpenSIS runbook should lead to DB and Vault Agent checks

First checks:

```bash
cd ../OpenSIS
docker compose ps opensis-db opensis-ui vault-agent-db
docker compose logs --tail=120 opensis-db
docker compose logs --tail=120 opensis-ui
docker compose logs --tail=120 vault-agent-db
```

Recovery:

```bash
cd OpenSIS
docker compose start opensis-db
docker compose restart opensis-ui

cd ../Obervability-Stack
./scripts/devops-monitor.sh opensis-live
```

Kubernetes equivalent:

```bash
kubectl scale statefulset/opensis-db --replicas=0 -n opensis-dev
kubectl scale statefulset/opensis-db --replicas=1 -n opensis-dev
kubectl rollout status statefulset/opensis-db -n opensis-dev
```

### Drill 8: Blackbox Mismatch

Safety: `Read-only`

What this tests:

- difference between browser reality and central probe reality
- service alias and probe-path correctness
- control-plane trust

Baseline:

```bash
curl -fsSI http://localhost:8088
cd Obervability-Stack
./scripts/devops-monitor.sh opensis-live
```

Trigger:

```bash
curl -fsSI http://localhost:8088
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=probe_success{job="blackbox-http",app="opensis"}' | jq .
```

Expected detection:

- if browser works but probe fails, the incident belongs to probe path, network policy, alias, or Prometheus config
- do not restart the app before checking the probe path

Recovery:

- no direct recovery unless a real config drift is found
- fix the blackbox target, service alias, or network policy
- reload/restart Prometheus only after the config correction

Kubernetes equivalent:

```bash
kubectl get networkpolicy -n opensis
kubectl logs -n opensis deploy/blackbox-exporter --tail=100
kubectl exec -n opensis deploy/prometheus -- sh -lc 'wget -qO- "http://127.0.0.1:9090/api/v1/targets"'
```

## FoodPulse Drills

### Drill 9: Redis Failover

Safety: `Manual`

What this tests:

- Sentinel election
- Redis HAProxy route behavior
- app behavior during cache/session dependency movement

Baseline:

```bash
cd FoodPulse
./scripts/cluster-status.sh
```

Trigger:

```bash
cd FoodPulse
./scripts/redis-failover-drill.sh
```

Expected detection:

- the drill shows current Redis roles
- current master is stopped
- Sentinel should promote a replica
- HAProxy should route to the new master
- old master should rejoin after restart

Recovery:

```bash
cd FoodPulse
./scripts/cluster-status.sh
```

If the lab remains degraded, inspect Redis and Sentinel logs:

```bash
docker compose logs --tail=120 foodpulse-redis-master foodpulse-redis-replica1 foodpulse-redis-replica2
docker compose logs --tail=120 foodpulse-redis-sentinel01 foodpulse-redis-sentinel02 foodpulse-redis-sentinel03
docker compose logs --tail=80 foodpulse-redis-haproxy
```

Kubernetes equivalent:

```bash
kubectl get pods -n foodpulse | rg 'redis|sentinel'
kubectl logs statefulset/redis -n foodpulse --tail=120
kubectl logs deployment/redis-sentinel -n foodpulse --tail=120
```

### Drill 10: Postgres Promotion

Safety: `Manual / Data-risk`

What this tests:

- Postgres primary failure handling
- HAProxy RW/RO visibility
- why manual promotion is not a production controller

Baseline:

```bash
cd FoodPulse
./scripts/cluster-status.sh
```

Trigger:

```bash
cd FoodPulse
./scripts/pg-failover-drill.sh
```

Expected detection:

- primary is stopped
- HAProxy RW pool behavior changes
- a replica is manually promoted with `pg_promote()`
- old primary does not automatically become a clean replica
- topology needs operator cleanup afterward

Recovery:

```bash
cd FoodPulse
./scripts/cluster-status.sh
```

If this is a disposable local lab and the topology is intentionally broken, reset cleanly:

```bash
docker compose down -v
cp .env.example .env
./scripts/start.sh
./scripts/cluster-status.sh
```

Kubernetes equivalent:

```bash
kubectl get pods -n foodpulse | rg 'postgres|pg|haproxy'
kubectl logs statefulset/foodpulse-db -n foodpulse --tail=120
kubectl logs deployment/foodpulse-pg-haproxy -n foodpulse --tail=120
```

### Drill 11: App Healthy But Topology Degraded

Safety: `Restart`

What this tests:

- difference between user-facing health and dependency topology health
- why FoodPulse needs `cluster-status.sh`

Baseline:

```bash
cd FoodPulse
./scripts/cluster-status.sh
curl -fsSI http://localhost:8090
```

Trigger:

```bash
cd FoodPulse
docker compose stop foodpulse-db-replica3
```

Expected detection:

- UI may still return HTTP `200`
- `cluster-status.sh` should report degraded Postgres state
- `foodpulse-live` should fail if cluster-status exits non-zero

First checks:

```bash
curl -fsSI http://localhost:8090
./scripts/cluster-status.sh
docker compose logs --tail=80 foodpulse-db-replica3 foodpulse-pg-haproxy
```

Recovery:

```bash
docker compose start foodpulse-db-replica3
./scripts/cluster-status.sh
```

Kubernetes equivalent:

```bash
kubectl scale statefulset/foodpulse-db-replica --replicas=2 -n foodpulse
kubectl scale statefulset/foodpulse-db-replica --replicas=3 -n foodpulse
kubectl get pods -n foodpulse
```

## Platform Drill

### Drill 12: Probe Or Inventory Drift

Safety: `Read-only / Restart`

What this tests:

- whether operators trust the control plane correctly
- difference between app reality and control-plane metadata
- how to diagnose before editing app code

Baseline:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh operator
```

Trigger:

```bash
curl -fsS http://localhost:4000/api/apps/health | jq .
./scripts/devops-monitor.sh inventory
```

Expected detection:

- if local app checks pass but control plane disagrees, inspect inventory and Prometheus targets first
- if inventory passes but probes fail, inspect blackbox target reachability

First checks:

```bash
./scripts/devops-monitor.sh inventory
curl -fsS http://localhost:9090/api/v1/targets | jq .
curl -fsS http://localhost:4000/api/apps/health | jq .
```

Recovery:

- fix the inventory, alias, or Prometheus target
- reload/restart the affected control-plane component
- rerun `./scripts/devops-monitor.sh operator`

Kubernetes equivalent:

```bash
kubectl get svc -A
kubectl get endpoints -A
kubectl get networkpolicy -A
kubectl get servicemonitor -A
```

## Post-Drill Report Template

Use this template in `JOURNEY-RUNBOOK.md` after running a real drill.

```markdown
## Incident Drill: <name>

### Goal

What behavior did we want to prove?

### Baseline

What commands passed before the drill?

### Trigger

What did we intentionally break?

### Detection

What failed first: dashboard, audit, direct curl, logs, metrics, or helper script?

### Diagnosis

What evidence explained the failure?

### Recovery

What commands restored service?

### Verification

What passed after recovery?

### Lessons

What should we improve before Kubernetes?
```

## Phase 5 Completion Note

This catalog gives the platform a documented drill plan.

Phase 5 should not be marked fully complete until selected drills are actually executed, observed, recovered, and recorded.
