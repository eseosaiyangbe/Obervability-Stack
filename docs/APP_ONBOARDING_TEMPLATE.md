# App Onboarding Template

## Purpose

This is the Phase 4 onboarding template for any workload that should join the shared control plane.

Use it when:

- onboarding a new repo into `DevOps-Easy-Learning`
- normalizing an existing repo that still feels one-off
- preparing a local-first app for the future Kubernetes move

The goal is simple:

- the app should be easy to start
- the operator contract should be obvious
- the control plane should not need repo-specific guesswork

## Minimum Onboarding Contract

Every onboarded app should provide the following.

### 1. Startup Contract

The repo must have one documented local start path.

Preferred:

```bash
docker compose up -d
```

Acceptable:

- a wrapper script such as `./scripts/start.sh`
- a repo-specific compose helper such as `./scripts/compose-start.sh`

The start path should:

- work from the repo root
- document required `.env` setup
- join `observability-net`
- avoid global container-name collisions

### 2. Browser Contract

If the app has a user-facing surface, document:

- the main local browser URL
- the user-facing health path if the preferred check runs through a frontend proxy

### 3. Health Contract

Every onboarded app must expose at least one HTTP health surface that an operator can check without entering a container.

Preferred:

- frontend-proxied health for user-facing apps
- direct service health for service-only apps

### 4. Observability Alias Contract

The app must join `observability-net` with stable aliases that match the monitored app inventory.

Examples:

- `swiftpay-frontend`
- `opensis-ui`
- `foodpulse-ui`
- `memflip-frontend`

Treat Docker aliases as the local equivalent of future Kubernetes Services.

### 5. Inventory Contract

The app must have a valid entry in:

- [monitored-apps.ts](/Users/raymond/Documents/DevOps-Easy-Learning/Obervability-Stack/ui-next/lib/monitored-apps.ts)

At minimum, that entry must define:

- app ID and name
- category and ownership
- network aliases
- primary health endpoint
- browser URL where applicable
- `localStart` and `healthCheck` runbooks

### 6. Metrics Contract

At least one of the following must be true:

- the app exposes a real `/metrics` endpoint
- the control plane can still probe the app meaningfully through blackbox uptime checks

For richer onboarding, prefer both.

### 7. Logs Contract

The app must emit logs in a way that the control plane can find through:

- Compose project labels
- known container names
- known service names

That contract should map cleanly into the `logQuery` in the monitored app inventory.

### 8. Runbook Contract

Each app should document:

- how to start it
- how to verify health
- how to recognize the most likely failure mode

This can begin as two short commands in the inventory and grow into a deeper repo runbook later.

## Kubernetes Readiness Lens

When making onboarding changes, prefer choices that survive the Kubernetes move:

- use env-driven config instead of hardcoded host assumptions
- expose probe-ready HTTP endpoints
- keep one app entrypoint and one health story
- avoid baking local-only container names into user-facing docs
- treat aliases today as Service names tomorrow

## Onboarding Checklist

Use this checklist before calling an app onboarded.

- repo has a root `README` with a clear local start path
- repo has `.env.example` if runtime env is required
- app joins `observability-net`
- monitored app inventory entry exists and validates
- operator health check works from the host
- control-plane audit exists
- live audit exists for non-trivial workloads
- browser URL is documented if there is a UI
- Kubernetes migration note is captured in repo or workspace docs

## Recommended Validation Flow

Run these after wiring a new app:

```bash
./Obervability-Stack/scripts/devops-monitor.sh inventory
./Obervability-Stack/scripts/devops-monitor.sh <app-id>
./Obervability-Stack/scripts/devops-monitor.sh <app-id>-live
```

## Current Reference Patterns

Use the existing workloads as examples:

- `MemFlip`: easiest reference onboarding target
- `SwiftPay`: richest microservice integration
- `OpenSIS`: legacy app with strong platform wrapper
- `FoodPulse`: resilience and failover lab

## Definition Of Good

An app is well onboarded when:

- the repo contract is readable without guessing
- the control plane can find it reliably
- operators know the first command to run when something looks wrong
- moving the app toward Kubernetes feels like refinement, not redesign
