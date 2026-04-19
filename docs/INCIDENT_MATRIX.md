# Incident Matrix

## Purpose

This is the first Phase 5 incident matrix for the workspace.

It maps common symptoms to the most likely first checks and the app or platform area that should own the next step.

## Matrix

| Symptom | First Check | Likely Domain | Next Command |
|---|---|---|---|
| App unreachable | Browser-facing health path | app reachability / proxy / UI | `./scripts/devops-monitor.sh operator` |
| Probe failing but app appears healthy | Compare browser path vs control-plane health | blackbox target / app surface mismatch | `curl -fsS http://localhost:4000/api/apps/health | jq .` |
| Metrics missing | Check app live audit and metrics surface | app instrumentation / scrape path | app-specific `*-live` audit |
| Logs missing | Check live audit, then dashboard logs panel | log query / label alignment | dashboard + repo logs |
| DB auth mismatch | Compare app behavior with secret-delivery assumptions | secrets / DB drift | `OpenSIS` operator panel and repo runbook |
| Queue backlog | Check `SwiftPay` money-flow panel | async processing / service pressure | `./scripts/devops-monitor.sh swiftpay-live` |
| Circuit breaker open | Check `SwiftPay` business state | service protection / downstream pressure | `./scripts/devops-monitor.sh swiftpay-live` |
| Failover drift | Check FoodPulse lab baseline | HA lab dependencies | `./scripts/devops-monitor.sh foodpulse-live` then `./scripts/cluster-status.sh` |

## App-Specific First Owners

### `SwiftPay`

Owns:

- queue backlog
- circuit breaker state
- transaction flow integrity
- wallet and gateway path issues

First command:

```bash
./scripts/devops-monitor.sh swiftpay-live
```

### `OpenSIS`

Owns:

- browser reachability for the legacy app
- Vault-delivered secret flow
- database-backed application failures

First command:

```bash
./scripts/devops-monitor.sh opensis-live
```

### `FoodPulse`

Owns:

- Redis failover behavior
- Postgres promotion drills
- HAProxy state interpretation
- app reachability vs dependency drift

First command:

```bash
./scripts/devops-monitor.sh foodpulse-live
```

### `MemFlip`

Owns:

- clean onboarding validation
- proxy-path health
- synthetic user flow
- backend metrics confirmation

First command:

```bash
./scripts/devops-monitor.sh memflip-live
```

## Phase 5 Intent

This matrix is deliberately small to start.

Its job is to give us:

- a shared incident vocabulary
- a repeatable first command for each workload story
- a stable bridge from app onboarding into operator drills and recovery work
