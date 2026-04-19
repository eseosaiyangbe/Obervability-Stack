# Workspace App Inventory Audit

## Purpose

This document is the Phase 3 control-plane checkpoint for monitored app inventory.

It verifies that the app metadata in:

- [`ui-next/lib/monitored-apps.ts`](/Users/raymond/Documents/DevOps-Easy-Learning/Obervability-Stack/ui-next/lib/monitored-apps.ts)
- [`prometheus/prometheus.yml`](/Users/raymond/Documents/DevOps-Easy-Learning/Obervability-Stack/prometheus/prometheus.yml)

still matches the actual workspace contracts after Phase 2 normalization.

## Current Conclusion

The app inventory is valid, but it needed a small metadata reconciliation pass.

The most important changes were:

- `MemFlip` should be treated as a frontend-proxied app in the control plane, not as a backend-first app
- `MemFlip` frontend probing should use `/api/health` to match the normalized operator path
- `MemFlip` and `FoodPulse` should expose browser URLs in the inventory
- `OpenSIS` should point to its wrapper startup helper, not the raw compose command

## App Review

### `OpenSIS`

Status:

- inventory presence is correct
- Docker alias is correct: `opensis-ui`
- browser URL is correct: `http://localhost:8088`

Adjustment made:

- `localStart` now points to `./scripts/compose-start.sh`

Why:

- that is the repo’s documented wrapper path
- it keeps the control plane aligned with the repo’s own startup contract

### `SwiftPay`

Status:

- inventory presence is correct
- service aliases are correct
- browser and gateway URLs match the normalized Phase 2 contract

Adjustment made:

- none required in this slice

### `MemFlip`

Status before reconciliation:

- aliases were correct
- backend health target was correct
- frontend entry existed, but the control plane still treated the backend as primary
- frontend browser URL was missing
- frontend blackbox target was only `/`, not the normalized proxied health path

Adjustments made:

- added `browserUrl: http://localhost:8080` to the frontend endpoint
- changed the frontend Docker probe target to `http://memflip-frontend/api/health`
- changed the primary health endpoint from backend to frontend
- added a `healthCheck` runbook command that matches the normalized operator path
- updated Prometheus blackbox config to probe `http://memflip-frontend/api/health`

Why:

- Phase 2 explicitly normalized MemFlip around the frontend proxy path
- the control plane should probe and present the same contract operators are told to use

### `FoodPulse`

Status:

- inventory presence is correct
- Docker alias is correct: `foodpulse-ui`
- root URL is the user-facing contract

Adjustment made:

- added `browserUrl: http://localhost`
- added a `healthCheck` runbook command

Why:

- it gives the dashboard a real browser target
- it makes the inventory more complete as an operator reference

## Inventory Hardening Notes

The inventory model is now a stronger control-plane contract because it:

- points browser links at real local entrypoints
- points MemFlip probing at the frontend-proxied health contract
- points startup guidance at repo-sanctioned wrapper scripts where available

Operator command:

```bash
./scripts/devops-monitor.sh inventory
```

That validator now checks the monitored app model for:

- duplicate app IDs, priorities, endpoint IDs, and network aliases
- valid primary health endpoint references
- presence of `localStart` and `healthCheck` runbooks for active apps
- matching docker targets and network aliases
- real repo references for wrapper-script startup commands

## What Still Belongs To Phase 3

- decide whether demo auth remains acceptable for now
- continue reconciling deeper control-plane docs
- verify whether any inventory metadata should become environment-driven instead of hardcoded
