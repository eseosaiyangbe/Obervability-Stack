# Observability Implementation Plan

Detailed build notes, commands, troubleshooting, and fixes are tracked in:

- [IMPLEMENTATION-RUNBOOK.md](IMPLEMENTATION-RUNBOOK.md)
- [UI-OWNERSHIP-ROADMAP.md](UI-OWNERSHIP-ROADMAP.md)

This workspace will use `Obervability-Stack` as the central monitoring control tower for:

- `FoodPulse`
- `MemFlip`
- `OpenSIS`
- `SwiftPay`

The cloned apps already contain some monitoring files, but we will avoid running separate Prometheus and Grafana stacks per app. One central stack is easier to reason about, avoids port conflicts, and teaches the pattern used in real teams.

## Phase 1: Central Stack Foundation

What we monitor first:

- Host metrics with Node Exporter.
- Container logs with Promtail and Loki.
- HTTP uptime with Blackbox Exporter.
- Container metrics with cAdvisor after host inotify limits are tuned.

The shared Docker network is:

```bash
observability-net
```

Create it once before starting the apps:

```bash
docker network create observability-net
```

Then start the central stack:

```bash
cd Obervability-Stack
docker compose up -d
```

Access points:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Loki: `http://localhost:3100`
- Alertmanager: `http://localhost:9093`
- Blackbox Exporter: `http://localhost:9115`

The custom DevOps Monitor UI is optional and currently depends on the local Docker `buildx` plugin:

```bash
docker compose --profile ui up -d devops-monitor-ui
```

cAdvisor is also optional on this workstation because the host inotify limits are low while k3s/containerd has many mounts:

```bash
sudo sysctl -w fs.inotify.max_user_instances=1024 fs.inotify.max_user_watches=1048576
docker compose --profile container-metrics up -d cadvisor
```

## Phase 2: Bring Apps Under Observation

Start each app from its own folder after the shared network exists. The app-facing containers have been attached to `observability-net` with stable aliases, so Prometheus can probe them without depending on host ports.

Blackbox probe targets now include:

- `http://foodpulse-ui/`
- `http://memflip-frontend/`
- `http://memflip-backend:3001/health`
- `http://opensis-ui/`
- `http://swiftpay-frontend/`
- `http://swiftpay-api-gateway:3000/health`
- `http://swiftpay-auth-service:3004/health`
- `http://swiftpay-wallet-service:3001/health`
- `http://swiftpay-transaction-service:3002/health`
- `http://swiftpay-notification-service:3003/health`

In Prometheus, use this query to see uptime:

```promql
probe_success
```

Use this to see probe latency:

```promql
probe_duration_seconds
```

## Phase 3: Dashboards

We will build dashboards in layers:

- Platform dashboard: CPU, memory, disk, Docker container health.
- App uptime dashboard: Blackbox probe status per app and component.
- Logs dashboard: Loki queries by container and app.
- App-specific dashboards: API latency, request rate, errors, database health, Redis health, RabbitMQ health.

The custom DevOps Monitor UI has its own ownership roadmap:

```text
UI-OWNERSHIP-ROADMAP.md
```

The first UI priority is to stabilize Metrics, Logs, and Alerts with server-side API routes, using the same pattern we already used for the Services health page.

## Phase 4: Deeper Metrics

After uptime and container visibility are working, add app-native metrics:

- Node.js services: expose `/metrics` with `prom-client`.
- PostgreSQL: add postgres-exporter.
- Redis: add redis-exporter.
- RabbitMQ: enable or scrape RabbitMQ Prometheus metrics.
- MariaDB: add mysqld-exporter for OpenSIS.
- HAProxy: scrape HAProxy metrics for FoodPulse.

## Phase 5: Alerts

Start with practical alerts:

- App endpoint down for more than 2 minutes.
- Container restarting repeatedly.
- Host disk nearly full.
- High memory pressure.
- Database exporter down.
- API error rate above threshold.

We will route alerts through Alertmanager after the signal is clean, because noisy alerting trains people to ignore alerts.
