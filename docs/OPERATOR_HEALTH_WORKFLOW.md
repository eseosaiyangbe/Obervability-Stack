# Operator Health Workflow

## Purpose

This is the Phase 5 standard health workflow for the shared platform.

Use it when:

- something looks wrong in the control plane
- an app seems unreachable or degraded
- you want the shortest safe path from symptom to first response

The goal is to keep operators from skipping straight to guesses.

## Canonical Questions

Start with these six questions, in order:

1. Is the app reachable?
2. Is the app healthy?
3. Are dependencies healthy?
4. Are metrics arriving?
5. Are logs arriving?
6. Are alerts firing correctly?

This is the standard workflow the workspace should teach.

## Operator Entry Point

Run the operator-first command:

```bash
./scripts/devops-monitor.sh operator
```

That command does three things:

- runs the control-plane smoke check
- validates the monitored app inventory
- prints a current workspace app-health snapshot

## Standard Flow

### 1. Control Plane Health

```bash
./scripts/devops-monitor.sh health
```

This tells you whether the control plane itself is trustworthy before you use it to judge the apps.

### 2. Inventory Integrity

```bash
./scripts/devops-monitor.sh inventory
```

This confirms the app metadata contract is still valid.

### 3. App Health Snapshot

```bash
curl -fsS http://localhost:4000/api/apps/health | jq .
```

Use this to see:

- overall workspace app summary
- app status
- primary endpoint health
- browser targets

### 4. App-Specific Deep Check

Use the app-specific live audit next.

```bash
./scripts/devops-monitor.sh swiftpay-live
./scripts/devops-monitor.sh opensis-live
./scripts/devops-monitor.sh foodpulse-live
./scripts/devops-monitor.sh memflip-live
```

### 5. Dashboard Guidance

After the live audit, use the dashboard operator panels for:

- `SwiftPay` microservices and money-flow guidance
- `OpenSIS` legacy-platform guidance
- `FoodPulse` failover guidance
- `MemFlip` onboarding guidance

Those panels help answer what to check first, not just whether the app is up.

### 6. App Operator Runbook

Use the app-specific operator runbook after the first dashboard and live-audit pass.

Current platform runbooks:

- `SwiftPay`: `SWIFTPAY_OPERATOR_RUNBOOK.md`
- `MemFlip`: `MEMFLIP_OPERATOR_RUNBOOK.md`
- `OpenSIS`: `OPENSIS_OPERATOR_RUNBOOK.md`
- `FoodPulse`: `FOODPULSE_OPERATOR_RUNBOOK.md`

## Which App Tells Which Story

- `SwiftPay`: microservice health, queue depth, money flow, circuit breaker state
- `OpenSIS`: browser reachability, Vault, database-backed app behavior
- `FoodPulse`: cluster status, Redis failover, Postgres promotion, HAProxy behavior
- `MemFlip`: clean browser-first onboarding path and synthetic user flow

## Minimum Safe First Response

When an app looks broken:

1. run `./scripts/devops-monitor.sh operator`
2. confirm the app is actually the thing that is broken
3. run the app-specific live audit
4. use the app-specific operator panel in the dashboard
5. only then move into deeper repo-specific troubleshooting

## Why This Matters

This keeps the platform honest.

If operators always start with:

- control-plane trust
- metadata trust
- app snapshot
- app-specific live proof

then later incident runbooks can build on a stable first-response pattern instead of a different guessing style for every repo.
