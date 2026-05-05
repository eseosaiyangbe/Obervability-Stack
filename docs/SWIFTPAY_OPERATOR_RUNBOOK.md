# SwiftPay Operator Runbook

## Purpose

SwiftPay is the flagship microservices workload in this platform lab.

Use this runbook when you need to operate, diagnose, or explain SwiftPay from the shared control plane instead of jumping directly into service internals.

SwiftPay teaches:

- microservice health
- gateway-to-service routing
- async transaction processing
- RabbitMQ queue behavior
- wallet protection and circuit-breaker behavior
- business metrics tied to real user actions

## What SwiftPay Does

SwiftPay is a payment-style application made of separate services:

| Service | Role | Local Surface |
|---|---|---|
| `frontend` | Browser UI served by Nginx | `http://localhost:8081` |
| `api-gateway` | Public API entrypoint and request router | `http://localhost:3007/health` |
| `auth-service` | User registration, login, tokens | `http://localhost:3004/health` |
| `wallet-service` | Wallet balances and transfers | `http://localhost:3001/health` |
| `transaction-service` | Transaction creation and async completion | `http://localhost:3008/health` |
| `notification-service` | Notification processing | `http://localhost:3003/health` |
| `postgres` | Persistent users, wallets, transactions | `localhost:5432` |
| `redis` | Cache/session support | `localhost:6379` |
| `rabbitmq` | Async transaction and notification messaging | `localhost:5672`, UI `http://localhost:15672` |

## Start SwiftPay

Start from the workspace root:

```bash
cd SwiftPay
docker compose up -d
```

Then return to the observability stack:

```bash
cd ../observability-stack
./scripts/devops-monitor.sh operator
```

## Confirm SwiftPay Is Healthy

Start with the standard platform workflow:

```bash
cd ../observability-stack
./scripts/devops-monitor.sh operator
```

Then run the SwiftPay live audit:

```bash
./scripts/devops-monitor.sh swiftpay-live
```

The live audit proves more than uptime. It checks:

- gateway health
- frontend reachability
- control-plane inventory health
- SwiftPay business metrics API
- Prometheus SwiftPay scrape targets
- synthetic user registration
- synthetic wallet lookup
- synthetic transfer creation
- async transfer completion
- completed-transfer metric reaction

## Minimum Manual Health Checks

Use these when you need a quick human-readable check:

```bash
curl -fsS http://localhost:3007/health | jq .
curl -fsSI http://localhost:8081
curl -fsS http://localhost:4000/api/apps/swiftpay/overview | jq .
curl -fsS http://localhost:4000/api/apps/swiftpay/business | jq .
```

Expected result:

- gateway reports `healthy`
- frontend returns HTTP `200`
- control plane reports SwiftPay as `healthy`
- business endpoint returns numeric metrics

## Metrics To Watch

SwiftPay's important platform metrics are exposed through recording rules:

| Metric | What It Means | Healthy Interpretation |
|---|---|---|
| `swiftpay:completed_transfers_total` | Positive proof that money movement completed | Should increase after a successful transfer |
| `swiftpay:pending_transactions` | Transactions waiting for completion | Should not grow continuously |
| `swiftpay:pending_amount` | Total money value stuck in pending state | Should not grow continuously |
| `swiftpay:transaction_queue_depth` | RabbitMQ transaction queue pressure | Should stay low after workers catch up |
| `swiftpay:transaction_failure_rate_5m` | Recent transaction failures | Should normally be near zero |
| `swiftpay:wallet_failed_transfer_rate_5m` | Wallet transfer failure pressure | Should normally be near zero |
| `swiftpay:wallet_circuit_breaker_state` | Wallet protection state | `0` means closed, `1` means open/protecting downstream |

Query Prometheus directly:

```bash
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=swiftpay:completed_transfers_total' | jq .
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=swiftpay:transaction_queue_depth' | jq .
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=swiftpay:wallet_circuit_breaker_state' | jq .
```

## Logs To Check

Start broad:

```bash
cd SwiftPay
docker compose logs --tail=80 api-gateway
docker compose logs --tail=80 transaction-service
docker compose logs --tail=80 wallet-service
docker compose logs --tail=80 rabbitmq
```

Follow the money flow in this order:

1. `api-gateway`: request accepted and routed
2. `transaction-service`: transaction created and queued
3. `rabbitmq`: message accepted and consumed
4. `wallet-service`: balance movement completed or rejected
5. `transaction-service`: final status updated
6. `notification-service`: notification event handled

## Common Failure Scenarios

### Frontend Is Down

Symptom:

- `http://localhost:8081` does not load
- dashboard browser target fails

First checks:

```bash
cd SwiftPay
docker compose ps frontend api-gateway
docker compose logs --tail=80 frontend
curl -fsS http://localhost:3007/health | jq .
```

Likely causes:

- frontend container is not running
- Nginx cannot reach `api-gateway`
- gateway is down and frontend API calls fail

Kubernetes mapping:

```bash
kubectl get pods -n swiftpay -l app=frontend
kubectl logs deployment/frontend -n swiftpay --tail=80
kubectl get ingress -n swiftpay
```

### Gateway Is Down

Symptom:

- `curl -fsS http://localhost:3007/health` fails
- all browser API calls fail
- dashboard marks SwiftPay degraded or down

First checks:

```bash
cd SwiftPay
docker compose ps api-gateway auth-service wallet-service transaction-service notification-service
docker compose logs --tail=120 api-gateway
docker compose logs --tail=80 postgres redis
```

Likely causes:

- gateway container failed
- dependency connection failed
- bad service URL
- database or Redis dependency unhealthy

Kubernetes mapping:

```bash
kubectl get pods -n swiftpay
kubectl logs deployment/api-gateway -n swiftpay --tail=120
kubectl describe deployment/api-gateway -n swiftpay
```

### Transactions Stay Pending

Symptom:

- synthetic transfer enters `PENDING` but does not complete
- `swiftpay:pending_transactions` grows
- `swiftpay:transaction_queue_depth` grows

First checks:

```bash
cd SwiftPay
docker compose ps transaction-service rabbitmq wallet-service
docker compose logs --tail=120 transaction-service
docker compose logs --tail=80 rabbitmq
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=swiftpay:transaction_queue_depth' | jq .
```

Likely causes:

- RabbitMQ is unavailable
- transaction worker cannot consume messages
- wallet service is unhealthy
- database update failed after queue consumption

Kubernetes mapping:

```bash
kubectl get pods -n swiftpay | grep -E 'transaction|rabbitmq|wallet'
kubectl logs deployment/transaction-service -n swiftpay --tail=120
kubectl logs deployment/wallet-service -n swiftpay --tail=120
kubectl get events -n swiftpay --sort-by='.lastTimestamp'
```

### Wallet Circuit Breaker Opens

Symptom:

- `swiftpay:wallet_circuit_breaker_state` returns `1`
- transfers fail or stop completing
- wallet failure rate rises

First checks:

```bash
cd SwiftPay
docker compose ps wallet-service transaction-service postgres
docker compose logs --tail=120 wallet-service
docker compose logs --tail=120 transaction-service
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=swiftpay:wallet_circuit_breaker_state' | jq .
```

Interpretation:

- an open circuit is not only a failure
- it is also a protection signal
- the system is trying to stop repeated wallet calls while the downstream path is unhealthy

Kubernetes mapping:

```bash
kubectl logs deployment/wallet-service -n swiftpay --tail=120
kubectl rollout status deployment/wallet-service -n swiftpay
kubectl describe deployment/wallet-service -n swiftpay
```

### Completed Transfers Stop Moving

Symptom:

- users can open the app
- health checks may still pass
- `swiftpay:completed_transfers_total` stays flat after test traffic

First checks:

```bash
cd ../observability-stack
./scripts/devops-monitor.sh swiftpay-live
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=swiftpay:completed_transfers_total' | jq .
```

Likely causes:

- synthetic flow failed before completion
- transaction worker is not processing
- wallet service rejected transfers
- Prometheus scrape or recording rule is broken

Kubernetes mapping:

```bash
kubectl logs deployment/transaction-service -n swiftpay --tail=120
kubectl logs deployment/wallet-service -n swiftpay --tail=120
kubectl get servicemonitor -A
```

## Recovery Commands

Local Docker Compose:

```bash
cd SwiftPay
docker compose restart api-gateway
docker compose restart transaction-service
docker compose restart wallet-service
docker compose restart rabbitmq
docker compose ps
```

Kubernetes:

```bash
kubectl rollout restart deployment/api-gateway -n swiftpay
kubectl rollout restart deployment/transaction-service -n swiftpay
kubectl rollout restart deployment/wallet-service -n swiftpay
kubectl rollout status deployment/api-gateway -n swiftpay
```

Use restart as a recovery step only after you have captured enough logs to explain the failure.

## Kubernetes Readiness Notes

SwiftPay already has Kubernetes manifests under `SwiftPay/k8s`.

When we move this project to Kubernetes, this operator model should map like this:

| Local Concept | Kubernetes Equivalent |
|---|---|
| `docker compose ps` | `kubectl get pods -n swiftpay` |
| `docker compose logs service` | `kubectl logs deployment/service -n swiftpay` |
| `localhost:3007/health` | ingress, service, or port-forwarded gateway health |
| Compose healthcheck | readiness and liveness probes |
| Compose network aliases | Kubernetes service DNS |
| Prometheus static target | service discovery or ServiceMonitor |
| RabbitMQ local UI | port-forwarded RabbitMQ management service |

The important rule is that the operator questions stay the same:

1. Is the app reachable?
2. Is the app healthy?
3. Are dependencies healthy?
4. Are metrics arriving?
5. Are logs arriving?
6. Are alerts firing correctly?

Only the command surface changes.

## Related SwiftPay Docs

Use these when you need deeper app-specific detail:

- `SwiftPay/docs/RUNBOOK.md`
- `SwiftPay/docs/observability-runbook.md`
- `SwiftPay/docs/send-money-runbook.md`
- `SwiftPay/docs/troubleshooting-pending-transactions.md`
- `SwiftPay/docs/transaction-processing-failure-diagnosis.md`
