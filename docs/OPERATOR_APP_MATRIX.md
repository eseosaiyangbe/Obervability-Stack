# Operator App Matrix

## Purpose

This is the operator-facing Phase 4 matrix for the managed workloads in this workspace.

It answers:

- what each app is for
- how to start it
- what health surface matters most
- what control-plane audit to run
- what makes the app operationally interesting

## Matrix

| App | Platform Story | Primary Local Start | Main Browser URL | Primary Health Check | Control-Plane Audit | Live Audit | Operational Focus |
|---|---|---|---|---|---|---|---|
| `SwiftPay` | Flagship microservices integration | `cd SwiftPay && docker compose up -d` | `http://localhost:8081` | `curl -fsS http://localhost:3007/health` | `./scripts/devops-monitor.sh swiftpay` | `./scripts/devops-monitor.sh swiftpay-live` | service health, business metrics, async money flow |
| `OpenSIS` | Legacy app wrapped in stronger platform practices | `cd OpenSIS && ./scripts/compose-start.sh --build-local` on Apple Silicon, otherwise `./scripts/compose-start.sh` | `http://localhost:8088` | `curl -I http://localhost:8088` | `./scripts/devops-monitor.sh opensis` | `./scripts/devops-monitor.sh opensis-live` | edge reachability, Vault, DB-backed app availability |
| `FoodPulse` | Resilience and failover lab | `cd FoodPulse && cp .env.example .env && ./scripts/start.sh` | `http://localhost:8090` | `curl -I http://localhost:8090` | `./scripts/devops-monitor.sh foodpulse` | `./scripts/devops-monitor.sh foodpulse-live` | Redis failover, Postgres failover, HAProxy behavior |
| `MemFlip` | Reference onboarding app | `cd MemFlip && cp .env.example .env && docker compose up -d` | `http://localhost:8080` | `curl -fsS http://localhost:8080/api/health` | `./scripts/devops-monitor.sh memflip` | `./scripts/devops-monitor.sh memflip-live` | simplest browser-first onboarding story |

## Recommended Operator Flow

When validating an app in the platform:

1. Start the app from its repo-sanctioned entrypoint.
2. Run the app’s host-side health check.
3. Run the contract audit through `devops-monitor.sh`.
4. Run the live audit if the workload supports a meaningful synthetic flow.
5. Confirm the app appears healthy in the control plane UI.

## How To Use This Matrix

Use `MemFlip` when:

- you want the smallest example of onboarding
- you are teaching the platform model

Use `SwiftPay` when:

- you want the richest application story
- you need service-level and business-level validation

Use `OpenSIS` when:

- you want to demonstrate platforming around a legacy system
- you need to reason about secrets, wrappers, and app reachability

Use `FoodPulse` when:

- you want to demonstrate resilience and failover drills
- you need an app where dependency state matters as much as UI reachability

## Next Phase Bridge

This matrix is the handoff into Phase 5.

It gives us a shared way to talk about:

- standard health workflows
- incident drills
- workload-specific failure modes
- which app best demonstrates which operator skill
