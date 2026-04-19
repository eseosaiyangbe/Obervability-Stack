# Observability Stack Implementation Runbook

This document records what we have built so far, the commands we used, the problems we hit, and how we fixed them. Keep updating this file as the project grows so the implementation journey stays easy to explain and repeat.

## Goal

Build one central observability stack from `Obervability-Stack` and use it to monitor:

- `OpenSIS`
- `FoodPulse`
- `MemFlip`
- `SwiftPay`

The strategy is to make the observability platform healthy first, then onboard one app at a time. `OpenSIS` will be the first managed app.

## Current Architecture

The central stack currently runs:

- Prometheus for metrics and scraping.
- Grafana for dashboards.
- Loki for log storage.
- Promtail for Docker log collection.
- Alertmanager for alert routing.
- Node Exporter for host metrics.
- Blackbox Exporter for HTTP uptime checks.
- Custom DevOps Monitor UI for a project dashboard.

Current access URLs:

```text
Prometheus:          http://localhost:9090
Grafana:             http://localhost:3000
Loki:                http://localhost:3100
Alertmanager:        http://localhost:9093
Blackbox Exporter:   http://localhost:9115
Node Exporter:       http://localhost:9100
DevOps Monitor UI:   http://localhost:4000
```

## Files Changed So Far

Observability stack:

```text
Obervability-Stack/docker-compose.yml
Obervability-Stack/prometheus/prometheus.yml
Obervability-Stack/prometheus/alert_rules.yml
Obervability-Stack/loki/config.yml
Obervability-Stack/loki/promtail-config.yml
Obervability-Stack/blackbox/blackbox.yml
Obervability-Stack/ui-next/lib/service-config.ts
Obervability-Stack/ui-next/lib/health-api.ts
Obervability-Stack/ui-next/lib/prometheus-api.ts
Obervability-Stack/ui-next/lib/loki-api.ts
Obervability-Stack/ui-next/lib/monitored-apps.ts
Obervability-Stack/ui-next/lib/app-observability.ts
Obervability-Stack/ui-next/lib/hooks/use-health-monitoring.ts
Obervability-Stack/ui-next/lib/hooks/use-prometheus-metrics.ts
Obervability-Stack/ui-next/lib/hooks/use-loki-logs.ts
Obervability-Stack/ui-next/lib/hooks/use-alertmanager-alerts.ts
Obervability-Stack/ui-next/lib/hooks/use-monitored-apps.ts
Obervability-Stack/ui-next/lib/hooks/use-app-health.ts
Obervability-Stack/ui-next/app/services/page.tsx
Obervability-Stack/ui-next/app/api/apps/route.ts
Obervability-Stack/ui-next/app/api/apps/health/route.ts
Obervability-Stack/ui-next/app/api/apps/[appId]/overview/route.ts
Obervability-Stack/ui-next/app/api/services/health/route.ts
Obervability-Stack/ui-next/app/api/metrics/current/route.ts
Obervability-Stack/ui-next/app/api/metrics/range/route.ts
Obervability-Stack/ui-next/app/api/logs/query/route.ts
Obervability-Stack/ui-next/app/api/logs/metadata/route.ts
Obervability-Stack/ui-next/app/api/alerts/route.ts
Obervability-Stack/LEARNING-IMPLEMENTATION-PLAN.md
Obervability-Stack/IMPLEMENTATION-RUNBOOK.md
Obervability-Stack/UI-OWNERSHIP-ROADMAP.md
```

Application compose files:

```text
FoodPulse/docker-compose.yml
MemFlip/docker-compose.yml
OpenSIS/docker-compose.yaml
SwiftPay/docker-compose.yml
```

Local ignored files created:

```text
Obervability-Stack/.env
MemFlip/.env
```

These `.env` files are intentionally local and should not be committed.

## Step 1: Workspace Discovery

We first listed the top-level folders:

```bash
find . -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort
```

Result:

```text
DevOps-Troubleshooting-Toolkit
FoodPulse
MemFlip
Obervability-Stack
OpenSIS
SwiftPay
```

Note: `payflow-wallet` had been renamed to `SwiftPay`.

## Step 2: Identify Existing Runtime Files

We checked each project for Compose, Dockerfile, package, and README files:

```bash
find FoodPulse MemFlip OpenSIS SwiftPay -maxdepth 2 -type f \
  \( -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' -o -name 'Dockerfile' \
  -o -name 'package.json' -o -name 'README*' \) \
  -printf '%p\n' | sort
```

Finding:

- All four apps have Docker-based local paths.
- Some apps already include their own monitoring resources.
- We chose one central observability stack to avoid duplicate Prometheus/Grafana instances and host port conflicts.

## Step 3: Create A Shared Docker Network

We created one external network that the observability stack and monitored apps can share:

```bash
docker network create observability-net
```

If the network already exists, this command can fail harmlessly. To check:

```bash
docker network ls --format '{{.Name}}' | rg '^observability-net$'
```

Why this matters:

- Prometheus and Blackbox Exporter can reach app containers by stable Docker DNS names.
- We avoid relying on host ports that may conflict across projects.

## Step 4: Add Blackbox Exporter

We added Blackbox Exporter to `Obervability-Stack/docker-compose.yml`:

```yaml
blackbox-exporter:
  image: prom/blackbox-exporter:v0.25.0
  container_name: blackbox-exporter
  ports:
    - "9115:9115"
  volumes:
    - ./blackbox/blackbox.yml:/etc/blackbox_exporter/config.yml:ro
  command:
    - "--config.file=/etc/blackbox_exporter/config.yml"
```

We created `Obervability-Stack/blackbox/blackbox.yml`:

```yaml
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      method: GET
      preferred_ip_protocol: ip4
      valid_status_codes: []
```

We then added Blackbox scrape targets in `prometheus/prometheus.yml`.

Important Prometheus queries:

```promql
up
```

`up` tells us Prometheus can scrape a target.

```promql
probe_success
```

`probe_success` tells us whether the HTTP endpoint being probed is actually healthy.

## Step 5: Add App Network Aliases

Each app-facing container was attached to `observability-net` with a stable alias.

Examples:

```text
OpenSIS UI:        opensis-ui
FoodPulse UI:      foodpulse-ui
MemFlip frontend:  memflip-frontend
MemFlip backend:   memflip-backend
SwiftPay frontend: swiftpay-frontend
SwiftPay gateway:  swiftpay-api-gateway
```

This lets Blackbox use targets like:

```text
http://opensis-ui/
http://memflip-backend:3001/health
http://swiftpay-api-gateway:3000/health
```

## Step 6: Validate Compose Syntax

We validated Compose rendering:

```bash
cd Obervability-Stack
docker compose config >/tmp/obs-compose.yml
```

```bash
cd FoodPulse
docker compose config >/tmp/foodpulse-compose.yml
```

```bash
cd MemFlip
docker compose config >/tmp/memflip-compose.yml
```

```bash
cd OpenSIS
docker compose -f docker-compose.yaml config >/tmp/opensis-compose.yml
```

```bash
cd SwiftPay
docker compose config >/tmp/swiftpay-compose.yml
```

Problem:

`MemFlip` failed because `docker-compose.override.yml` expected a `.env` file.

Error:

```text
env file .../MemFlip/.env not found
```

Fix:

```bash
cd MemFlip
cp env/env.example .env
docker compose config >/tmp/memflip-compose.yml
```

The `.env` file is ignored by git.

## Step 7: Validate Prometheus Config

We checked Prometheus config with `promtool`:

```bash
cd Obervability-Stack
docker run --rm \
  --entrypoint promtool \
  -v "$PWD/prometheus:/etc/prometheus:ro" \
  prom/prometheus:v2.45.0 \
  check config /etc/prometheus/prometheus.yml
```

Result:

```text
SUCCESS: /etc/prometheus/prometheus.yml is valid prometheus config file syntax
SUCCESS: 29 rules found
SUCCESS: 27 rules found
```

## Step 8: Start The Core Stack

Initial command:

```bash
cd Obervability-Stack
docker compose up -d
```

Problem:

The stack tried to build `devops-monitor-ui`, but Docker Compose failed because Buildx was missing from the expected plugin path.

Error:

```text
failed to fetch metadata: fork/exec /home/theinventor/.docker/cli-plugins/docker-buildx: no such file or directory
```

Temporary workaround:

Start only the core services without the UI build:

```bash
docker compose up -d \
  prometheus grafana loki promtail alertmanager node-exporter blackbox-exporter
```

Later, after Buildx was fixed, we started the UI with:

```bash
docker compose --profile ui up -d devops-monitor-ui
```

## Step 9: Fix Docker Buildx

We checked Docker and Buildx:

```bash
docker version
docker compose version
docker buildx version
```

Finding:

`docker buildx version` worked, but the user-level plugin path had a broken symlink:

```text
~/.docker/cli-plugins/docker-buildx -> /usr/lib/docker/cli-plugins/docker-buildx
```

The target file did not exist.

Fix:

We copied the Buildx binary from Docker's official Buildx image:

```bash
mkdir -p "$HOME/.docker/cli-plugins"
rm -f "$HOME/.docker/cli-plugins/docker-buildx"

cid=$(docker create --entrypoint /buildx docker/buildx-bin:latest version)
docker cp "$cid:/buildx" "$HOME/.docker/cli-plugins/docker-buildx"
docker rm "$cid" >/dev/null
chmod +x "$HOME/.docker/cli-plugins/docker-buildx"

docker buildx version
```

Expected result:

```text
github.com/docker/buildx ...
```

Then the custom UI image could build.

## Step 10: Build And Start The Custom UI

Command:

```bash
cd Obervability-Stack
docker compose --profile ui up -d devops-monitor-ui
```

The build completed successfully and produced:

```text
obervability-stack-devops-monitor-ui:latest
```

UI URL:

```text
http://localhost:4000
```

Problem:

The UI build warned about missing/default NextAuth values:

```text
NEXTAUTH_SECRET is not set or is using the default value
NEXTAUTH_URL is not set
```

Fix:

We created a local `Obervability-Stack/.env` with project settings:

```env
SITE_NAME=DevOps Monitoring Dashboard
SITE_URL=http://localhost:4000
SITE_DESCRIPTION=Central observability hub for OpenSIS and lab applications

GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin

NEXTAUTH_SECRET=<local generated secret>
NEXTAUTH_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

We then recreated the UI:

```bash
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

## Step 11: Fix The UI Healthcheck

Problem:

The UI container was serving traffic, but Docker showed:

```text
health: starting
```

Cause:

The Compose healthcheck used `wget`, but the UI image installs `curl`.

Fix in `docker-compose.yml`:

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -fsS http://localhost:3000/ >/dev/null || exit 1"]
```

Recreate:

```bash
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

Result:

```text
devops-monitor-ui   Up ... (healthy)
```

## Step 12: Fix The UI Showing Services Down

Problem:

The custom UI showed services as down even though Docker showed them healthy.

Root cause:

The UI health checks were running from the browser and trying to call Docker-internal service names:

```text
http://prometheus:9090
http://grafana:3000
http://loki:3100
http://alertmanager:9093
```

Those hostnames work inside Docker, but not in the browser.

Fix:

We created a server-side Next.js API route:

```text
ui-next/app/api/services/health/route.ts
```

The browser now calls:

```text
http://localhost:4000/api/services/health
```

The UI container then checks services over Docker DNS.

We also updated:

```text
ui-next/lib/hooks/use-health-monitoring.ts
ui-next/lib/service-config.ts
```

Server-side service URLs added to `.env`:

```env
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
LOKI_URL=http://loki:3100
ALERTMANAGER_URL=http://alertmanager:9093
NODE_EXPORTER_URL=http://node-exporter:9100
NODE_EXPORTER_ENABLED=true
CADVISOR_ENABLED=false
```

We rebuilt and recreated the UI:

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

Verification:

```bash
curl -fsS http://localhost:4000/api/services/health | python3 -m json.tool
```

Expected result:

```text
Prometheus: up
Grafana: up
Loki: up
Alertmanager: up
Node Exporter: up
overallStatus: healthy
```

## Step 13: Fix UI Open Buttons

Problem:

The Services page showed all services as up, and the Refresh button worked, but clicking `Open` failed in the browser.

Root cause:

After moving health checks server-side, the service health API correctly returned Docker-internal URLs:

```text
http://prometheus:9090
http://grafana:3000
http://loki:3100
http://alertmanager:9093
```

Those URLs are correct from inside the `devops-monitor-ui` container, but your browser cannot resolve Docker service names.

Fix:

We split service URLs into two meanings:

- `url`: internal Docker URL used by the UI backend for health checks.
- `publicUrl`: browser-facing localhost URL used by the `Open` button.

Browser URLs:

```env
NEXT_PUBLIC_PROMETHEUS_BROWSER_URL=http://localhost:9090
NEXT_PUBLIC_GRAFANA_BROWSER_URL=http://localhost:3000
NEXT_PUBLIC_LOKI_BROWSER_URL=http://localhost:3100
NEXT_PUBLIC_ALERTMANAGER_BROWSER_URL=http://localhost:9093
NEXT_PUBLIC_NODE_EXPORTER_BROWSER_URL=http://localhost:9100
```

Files changed:

```text
ui-next/lib/health-api.ts
ui-next/app/services/page.tsx
docker-compose.yml
.env
```

Rebuild and recreate the UI:

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

Verification:

```bash
curl -fsS http://localhost:4000/api/services/health | python3 -m json.tool
```

Each service should now include both:

```json
"url": "http://prometheus:9090",
"publicUrl": "http://localhost:9090"
```

Final verification after rebuilding:

```bash
docker compose --profile ui up -d --force-recreate devops-monitor-ui
docker compose --profile ui ps devops-monitor-ui
curl -fsS http://localhost:4000/api/services/health | python3 -m json.tool
```

Expected Docker state:

```text
devops-monitor-ui   Up ... (healthy)
```

Expected API shape:

```json
{
  "name": "Prometheus",
  "url": "http://prometheus:9090",
  "publicUrl": "http://localhost:9090",
  "status": "up"
}
```

Browser behavior:

- `Refresh` checks health through the UI backend.
- `Open` opens the browser-safe `publicUrl`.
- If the old URL still appears, hard refresh the browser with `Ctrl + Shift + R`.

## Step 14: Promtail Log Collection

Problem:

Promtail originally attempted broad host log collection and failed with:

```text
too many open files
```

Fix:

We changed Promtail to use Docker service discovery through the Docker socket and collect container JSON logs:

```yaml
scrape_configs:
  - job_name: docker-containers
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 10s
```

Volumes:

```yaml
volumes:
  - ./loki/promtail-config.yml:/etc/promtail/config.yml:ro
  - /var/run/docker.sock:/var/run/docker.sock:ro
  - /var/lib/docker/containers:/var/lib/docker/containers:ro
```

We also disabled Promtail's Docker Compose healthcheck because the image did not include a suitable shell HTTP client for that check:

```yaml
healthcheck:
  disable: true
```

Prometheus still scrapes Promtail:

```promql
up{job="promtail"}
```

## Step 15: cAdvisor Issue And Decision

Problem:

cAdvisor repeatedly failed with:

```text
Registration of the raw container factory failed: inotify_init: too many open files
Failed to start manager: inotify_init: too many open files
```

Cause:

This host has low inotify settings and many k3s/containerd mounts:

```bash
sysctl fs.inotify.max_user_instances fs.inotify.max_user_watches
```

Observed:

```text
fs.inotify.max_user_instances = 128
fs.inotify.max_user_watches = 65536
```

Attempted fix:

```bash
sudo sysctl -w fs.inotify.max_user_instances=1024 fs.inotify.max_user_watches=1048576
```

This requires sudo password, so we did not force it.

Decision:

Make cAdvisor optional:

```yaml
profiles: ["container-metrics"]
```

Start later with:

```bash
sudo sysctl -w fs.inotify.max_user_instances=1024 fs.inotify.max_user_watches=1048576
docker compose --profile container-metrics up -d cadvisor
```

For now, this does not block us because we already have:

- host metrics through Node Exporter
- uptime through Blackbox Exporter
- logs through Promtail and Loki
- platform health through the custom UI

## Current Startup Commands

From the observability stack folder:

```bash
cd /home/theinventor/Desktop/devops/devopseasylearning/Obervability-Stack
docker compose --profile ui up -d
```

Check service status:

```bash
docker compose --profile ui ps
```

Check platform health:

```bash
curl -fsS http://localhost:9090/-/healthy
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:3100/ready
curl -fsS http://localhost:9093/-/healthy
curl -fsS http://localhost:9115/-/healthy
curl -fsS http://localhost:4000/
curl -fsS http://localhost:4000/api/services/health | python3 -m json.tool
```

## Current Expected State

`docker compose --profile ui ps` should show:

```text
alertmanager        Up ... healthy
blackbox-exporter   Up ... healthy
devops-monitor-ui   Up ... healthy
grafana             Up ... healthy
loki                Up ... healthy
node-exporter       Up ... healthy
prometheus          Up ... healthy
promtail            Up
```

Promtail may not show a Docker health status because its Compose healthcheck is disabled. This is expected.

## Important Prometheus Queries

Platform scrape health:

```promql
up
```

Promtail scrape health:

```promql
up{job="promtail"}
```

Node Exporter scrape health:

```promql
up{job="node-exporter"}
```

Blackbox probe health:

```promql
probe_success
```

Blackbox probe latency:

```promql
probe_duration_seconds
```

OpenSIS probe once OpenSIS is running:

```promql
probe_success{app="opensis"}
```

## Step 16: Document The UI Ownership Roadmap

After reviewing the custom DevOps Monitor UI, we created a dedicated roadmap:

```text
Obervability-Stack/UI-OWNERSHIP-ROADMAP.md
```

Why we created this roadmap:

- The runbook records what we already did.
- The roadmap explains what we will do next.
- The UI has many features, so we need a clear way to separate real features, partially wired features, and demo features.

The roadmap classifies the UI features into three groups:

- Working or mostly working now.
- Partially wired and worth finishing.
- Mostly demo or future work.

The key decision:

We will turn the UI into our observability control plane gradually. The next engineering priority is to add server-side API routes for Metrics, Logs, and Alerts, just like we already did for Services health.

Recommended next UI tasks:

```text
1. Add server-side Metrics API routes.
2. Update Metrics hooks to call the UI API instead of Prometheus directly.
3. Add server-side Logs API routes.
4. Update Logs hooks to call the UI API instead of Loki directly.
5. Add server-side Alerts API route.
6. Update Alerts hooks to call the UI API instead of Alertmanager directly.
7. Add OpenSIS to a central monitored app list.
8. Build the first OpenSIS health card.
```

This roadmap should be updated whenever we finish a UI phase.

## Step 17: Stabilize UI Data Path For Metrics, Logs, And Alerts

Goal:

Make the browser talk only to the custom DevOps Monitor UI, while the UI server talks to internal observability services.

This is the same pattern we will use later in Kubernetes:

```text
Browser -> UI Ingress/Cloudflared -> UI service -> Prometheus/Loki/Alertmanager services
```

Why:

- Docker internal names such as `http://prometheus:9090` work from containers, not from the browser.
- Kubernetes service DNS will have the same concept later.
- Cloudflared should expose the UI, not every internal observability backend.

Changes made:

- Added server-side Metrics API routes:

```text
ui-next/app/api/metrics/current/route.ts
ui-next/app/api/metrics/range/route.ts
```

- Added server-side Logs API routes:

```text
ui-next/app/api/logs/query/route.ts
ui-next/app/api/logs/metadata/route.ts
```

- Added server-side Alerts API route:

```text
ui-next/app/api/alerts/route.ts
```

- Updated client hooks so browser code calls `/api/...` on the UI:

```text
ui-next/lib/hooks/use-prometheus-metrics.ts
ui-next/lib/hooks/use-loki-logs.ts
ui-next/lib/hooks/use-alertmanager-alerts.ts
```

- Marked observability API routes as dynamic:

```ts
export const dynamic = 'force-dynamic';
```

This prevents Next.js from treating live observability data like static build-time content.

- Fixed an existing Prometheus query bug in `ui-next/lib/prometheus-api.ts`.

Old invalid query:

```promql
node_load1, node_load5, node_load15
```

New valid query:

```promql
{__name__=~"node_load1|node_load5|node_load15"}
```

- Updated Loki label handling in `ui-next/lib/loki-api.ts` to match our Promtail Docker labels:

```text
container
compose_service
compose_project
```

Problem encountered:

Metrics and Alerts worked through the new UI API routes, but Loki label and query endpoints hung even though `/ready` was healthy.

Symptoms:

```bash
curl -m 10 -sS -i http://localhost:3100/loki/api/v1/labels
```

This timed out.

Fix:

Simplified `loki/config.yml` by removing the query frontend/scheduler settings that were not needed for our single-binary Docker Compose Loki service.

Then restarted Loki and Promtail:

```bash
docker compose up -d --force-recreate loki promtail
```

Validation commands:

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

```bash
curl -fsS http://localhost:4000/api/metrics/current | python3 -m json.tool
```

```bash
start=$(date -d '5 minutes ago' +%s)
end=$(date +%s)
curl -fsS "http://localhost:4000/api/metrics/range?metric=cpu&start=$start&end=$end" | python3 -m json.tool
```

```bash
curl -fsS http://localhost:4000/api/logs/metadata | python3 -m json.tool
```

```bash
curl -fsS "http://localhost:4000/api/logs/query?timeRange=1h&limit=3" | python3 -m json.tool
```

```bash
curl -fsS http://localhost:4000/api/alerts | python3 -m json.tool
```

Observed result:

- `/api/metrics/current` returned CPU, memory, disk, network, and load.
- `/api/metrics/range` returned CPU time-series data.
- `/api/logs/metadata` returned container/service labels.
- `/api/logs/query` returned recent Loki log entries.
- `/api/alerts` returned active Alertmanager alerts and available severities.
- The Dockerized Next.js production build passed TypeScript.

Note:

The build still prints existing NextAuth production warnings when `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are not available at build time. Runtime values are present in the UI container through `Obervability-Stack/.env`, so this is not blocking the local stack.

## Step 18: Create The Monitored App Model

Goal:

Create one central source of truth for every app the observability platform will manage.

Why:

- We do not want app names, health URLs, log labels, and Kubernetes namespaces scattered across multiple UI pages.
- The same app model can drive Services, Dashboard, Logs, Alerts, and future Kubernetes manifests.
- This prepares us for the Docker Compose to Kubernetes path.

Created:

```text
ui-next/lib/monitored-apps.ts
ui-next/app/api/apps/route.ts
ui-next/lib/hooks/use-monitored-apps.ts
```

Updated:

```text
ui-next/app/services/page.tsx
```

The model currently tracks:

- app id and display name
- ownership: owned or cloned public repo
- local Docker aliases
- Docker Compose log labels
- Blackbox/Prometheus labels
- uptime and latency PromQL queries
- Loki log query
- future Kubernetes namespace and recommended labels
- runbook commands

Current app inventory:

```text
OpenSIS
SwiftPay
MemFlip
FoodPulse
```

Current endpoint count:

```text
10
```

Kubernetes-ready fields:

Each app now has a recommended namespace and labels such as:

```text
app.kubernetes.io/name
app.kubernetes.io/part-of
observability.dev/app
```

This gives us a consistent label plan before we start writing manifests.

Validation commands:

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

```bash
curl -fsS http://localhost:4000/api/apps | python3 -m json.tool
```

Summary check:

```bash
curl -fsS http://localhost:4000/api/apps | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data["summary"]); print([a["id"] for a in data["apps"]])'
```

Observed result:

```text
{'totalApps': 4, 'activeApps': 4, 'ownedApps': 1, 'endpoints': 10}
['opensis', 'swiftpay', 'memflip', 'foodpulse']
```

UI result:

The Services page now has a Managed Applications section. It shows app metadata from `/api/apps`. Live app health will come in Phase 3, starting with OpenSIS.

## Step 19: Make OpenSIS The First Managed App

Goal:

Connect the monitored app model to real observability data for OpenSIS.

Why:

OpenSIS is our first owned app in this lab, so it should become the reference pattern for how an app is managed in the UI.

Changes made:

- Added server-side app observability logic:

```text
ui-next/lib/app-observability.ts
```

- Added app health API:

```text
ui-next/app/api/apps/health/route.ts
```

- Added app overview API:

```text
ui-next/app/api/apps/[appId]/overview/route.ts
```

- Added client hook for live app health:

```text
ui-next/lib/hooks/use-app-health.ts
```

- Updated the Services page so the Managed Applications cards show live health, endpoint counts, and probe latency.

OpenSIS now has:

- live Blackbox health from Prometheus
- live probe latency from Prometheus
- recent Loki logs through its app log query
- active alerts from Alertmanager
- one-hour uptime series
- one-hour latency series

OpenSIS Prometheus queries:

```promql
probe_success{job="blackbox-http",app="opensis"}
```

```promql
probe_duration_seconds{job="blackbox-http",app="opensis"}
```

OpenSIS Loki query:

```logql
{compose_project=~".*opensis.*"}
```

OpenSIS alerts added:

```text
OpenSISDown
OpenSISHighProbeLatency
```

Alert rules:

```promql
probe_success{job="blackbox-http",app="opensis"} == 0
```

```promql
probe_duration_seconds{job="blackbox-http",app="opensis"} > 2
```

Validation commands:

```bash
docker run --rm \
  --entrypoint promtool \
  -v "$PWD/prometheus:/etc/prometheus:ro" \
  prom/prometheus:v2.45.0 \
  check config /etc/prometheus/prometheus.yml
```

```bash
curl -fsS -X POST http://localhost:9090/-/reload
```

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

```bash
curl -fsS http://localhost:4000/api/apps/health | python3 -m json.tool
```

```bash
curl -fsS http://localhost:4000/api/apps/opensis/overview | python3 -m json.tool
```

Observed result:

OpenSIS is currently known to Prometheus, but it is down because the OpenSIS containers are not running:

```text
"appId": "opensis"
"status": "down"
"probeSuccess": 0
```

The OpenSIS overview also returned an active `OpenSISDown` alert from Alertmanager. This is expected until OpenSIS is started.

What should happen after OpenSIS starts:

- `/api/apps/opensis/overview` should change OpenSIS health from `down` to `healthy`.
- `probe_success{job="blackbox-http",app="opensis"}` should become `1`.
- The `OpenSISDown` alert should resolve after Prometheus and Alertmanager process the healthy probe.
- Loki should start returning OpenSIS logs once its containers write logs.

## Step 20: Start And Verify OpenSIS

Goal:

Start OpenSIS and prove that the full observability path works:

```text
OpenSIS container -> Blackbox Exporter -> Prometheus -> UI API -> custom UI
OpenSIS container logs -> Promtail -> Loki -> UI API -> custom UI
Prometheus alert rule -> Alertmanager -> UI API -> custom UI
```

Why:

Phase 3 is not really complete until the first managed app changes from `down` to `healthy` using real monitoring data.

Pre-check command:

```bash
cd /home/theinventor/Desktop/devops/devopseasylearning/OpenSIS
./scripts/precheck.sh
```

Observed result:

```text
Running pre-checks...
INFO: vault_data volume exists (good)
Pre-check complete. Ready to run docker compose up.
```

Start command:

```bash
docker compose up -d
```

Docker Compose result:

OpenSIS started successfully. The important containers were:

```text
vault             Up healthy
opensis-db        Up healthy
opensis-ui        Up healthy, 127.0.0.1:8088->80/tcp
```

Local browser check:

```bash
docker compose ps
curl -I http://localhost:8088
```

Observed result:

```text
HTTP/1.1 302 Found
Location: install/index.php
```

This is a good result. It means the OpenSIS UI is reachable from the host and is redirecting to its installer path.

Prometheus probe check:

```bash
curl -fsS 'http://localhost:9090/api/v1/query?query=probe_success%7Bjob%3D%22blackbox-http%22%2Capp%3D%22opensis%22%7D' | python3 -m json.tool
```

Expected query:

```promql
probe_success{job="blackbox-http",app="opensis"}
```

Observed result:

```text
instance="http://opensis-ui/"
app="opensis"
component="frontend"
value="1"
```

Custom UI health check:

```bash
curl -fsS http://localhost:4000/api/apps/health | python3 -m json.tool
```

Observed summary:

```text
totalApps: 4
healthyApps: 1
degradedApps: 0
downApps: 3
unknownApps: 0
```

Observed app state:

```text
OpenSIS: healthy
SwiftPay: down
MemFlip: down
FoodPulse: down
```

This is expected because OpenSIS is the only monitored app currently running.

OpenSIS overview check:

```bash
curl -fsS http://localhost:4000/api/apps/opensis/overview | python3 -m json.tool
```

Observed result:

```text
health.status: healthy
primaryEndpoint.status: up
primaryEndpoint.probeSuccess: 1
primaryEndpoint.latencySeconds: about 0.09
alerts: []
recentLogs: present
```

Alert verification:

```bash
curl -fsS 'http://localhost:9090/api/v1/query?query=ALERTS%7Balertname%3D%22OpenSISDown%22%7D' | python3 -m json.tool
```

Observed result:

```text
result: []
```

This means the `OpenSISDown` alert resolved after Prometheus saw the healthy probe.

Loki log verification:

```bash
curl -fsS 'http://localhost:4000/api/logs/query?namespace=opensis&timeRange=1h&limit=5' | python3 -m json.tool
```

Observed result:

OpenSIS logs are present. The response included Apache access logs from `opensis-ui` and Vault logs from the `opensis` Compose project.

Example log labels:

```text
compose_project="opensis"
compose_service="opensis-ui"
container="opensis-ui"
```

Useful LogQL checks:

```logql
{container="opensis-ui"}
```

or broader:

```logql
{compose_project=~".*opensis.*"}
```

Problem encountered:

Two quick verification commands used the wrong JSON field names while printing a summary.

Why it happened:

The app health API returns `appId` and `latencySeconds`, not `id` and `latencyMs`.

Fix:

Read the full API response with:

```bash
curl -fsS http://localhost:4000/api/apps/health | python3 -m json.tool
curl -fsS http://localhost:4000/api/apps/opensis/overview | python3 -m json.tool
```

Then use the actual response field names in future checks.

Final result:

OpenSIS is now the first fully managed app in the custom DevOps Monitor UI.

## Step 21: Build The Real Dashboard

Goal:

Replace the dashboard's demo-style widgets with real data from our observability APIs.

Why:

The dashboard should answer two questions immediately:

```text
Is the observability platform healthy?
Are the monitored apps healthy?
```

Changes made:

- Replaced the old dashboard mock data with real API-backed sections.
- Added live host metrics from Prometheus:

```text
/api/metrics/current
```

- Added managed app health from the app model:

```text
/api/apps/health
```

- Added OpenSIS overview data:

```text
/api/apps/opensis/overview
```

- Added active alert data from Alertmanager:

```text
/api/alerts
```

The dashboard now shows:

- CPU, memory, disk, and network usage from Prometheus.
- Managed app summary.
- Monitored endpoint count.
- Active alert count.
- OpenSIS primary probe latency.
- App health rows for OpenSIS, SwiftPay, MemFlip, and FoodPulse.
- Active Alertmanager alerts.
- OpenSIS one-hour uptime chart.
- OpenSIS one-hour latency chart.
- Recent OpenSIS logs from Loki.

Kubernetes-minded design note:

The dashboard is grouped around app, endpoint, component, and future namespace ownership instead of only Docker container names. That keeps the UI model useful when we move from Docker Compose to Kubernetes.

Build command:

```bash
cd /home/theinventor/Desktop/devops/devopseasylearning/Obervability-Stack
docker compose --profile ui build devops-monitor-ui
```

Observed result:

```text
Compiled successfully
Running TypeScript ...
Route /dashboard generated successfully
Image obervability-stack-devops-monitor-ui Built
```

Known warning:

The build still prints NextAuth warnings:

```text
NEXTAUTH_SECRET is not set or is using the default value
NEXTAUTH_URL is not set
```

This is a build-time warning. Runtime values are already present in the container for local development. We will harden this before production.

Recreate command:

```bash
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

Observed result:

```text
devops-monitor-ui Up healthy
```

Validation commands:

```bash
curl -I http://localhost:4000/dashboard
```

Observed result:

```text
HTTP/1.1 307 Temporary Redirect
location: /auth/signin?from=%2Fdashboard
```

This is expected when not signed in. The dashboard route is protected by auth.

API validation:

```bash
curl -fsS http://localhost:4000/api/apps/health | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["summary"]); print([(a["appId"], a["status"]) for a in d["apps"]])'
```

Observed result:

```text
{'totalApps': 4, 'healthyApps': 1, 'degradedApps': 0, 'downApps': 3, 'unknownApps': 0}
[('opensis', 'healthy'), ('swiftpay', 'down'), ('memflip', 'down'), ('foodpulse', 'down')]
```

OpenSIS dashboard data validation:

```bash
curl -fsS http://localhost:4000/api/apps/opensis/overview | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["health"]["status"], d["health"]["primaryEndpoint"]["status"], d["health"]["primaryEndpoint"]["probeSuccess"], len(d["recentLogs"]), len(d["alerts"]))'
```

Observed result:

```text
healthy up 1 10 0
```

Final result:

Phase 4 has a complete first pass. The main dashboard now uses real observability data instead of the older static demo data.

## Step 22: Refine Dashboard Cards

Goal:

Keep the real data dashboard, but make the cards easier to scan and closer to a polished DevOps control center.

Why:

The first Phase 4 dashboard was technically correct, but the cards felt too flat compared with the earlier UI. We want the dashboard to feel useful and intentional without going back to mock data.

Changes made:

- Added reusable card tone styles for blue, green, amber, red, cyan, and slate states.
- Added accent bars to summary, app, alert, chart, and log cards.
- Added progress bars for CPU, memory, and disk cards.
- Added footer context to the top metric cards.
- Added status rails to app health rows.
- Added endpoint chips to app health rows.
- Improved alert card contrast for critical alerts.
- Wrapped chart areas in clearer chart surfaces.
- Improved log row hover and spacing.

Validation commands:

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

Observed result:

```text
Compiled successfully
Running TypeScript ...
devops-monitor-ui Up healthy
```

Data validation:

```bash
curl -fsS http://localhost:4000/api/apps/opensis/overview | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["health"]["status"], d["health"]["primaryEndpoint"]["status"], len(d["recentLogs"]), len(d["alerts"]))'
```

Observed result:

```text
healthy up 10 0
```

## Step 23: Align Dashboard With Original UI Design

Goal:

Make the dashboard look like the existing product UI again while keeping the real observability data from Phase 4.

Reference pages:

```text
ui-next/app/templates/page.tsx
ui-next/app/metrics/page.tsx
ui-next/app/services/page.tsx
```

Design patterns reused:

- Gradient page background.
- Large gradient hero card.
- `motion.div` entrance animations.
- Hero stat tiles with soft gradient backgrounds.
- `shadow-lg` cards with `hover:shadow-xl`.
- Section headers with soft gradient backgrounds.
- Rounded icon blocks with gradient fills.
- Service-style managed app cards.
- Metrics-style resource cards with progress bars.
- Alert and log cards that match the rest of the UI language.

What stayed the same:

- Dashboard still uses real data from Prometheus, Loki, Alertmanager, and the app health APIs.
- No mock data was reintroduced.
- OpenSIS remains the first fully managed app on the dashboard.

Validation commands:

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

Observed result:

```text
Compiled successfully
Running TypeScript ...
devops-monitor-ui Up healthy
```

API validation:

```bash
curl -fsS http://localhost:4000/api/apps/opensis/overview | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["health"]["status"], d["health"]["primaryEndpoint"]["status"], len(d["recentLogs"]), len(d["alerts"]))'
```

Observed result:

```text
healthy up 10 0
```

## Step 24: Notification Integration First Pass

Goal:

Build the first end-to-end notification path.

Why:

Alerts should not only sit in Prometheus and Alertmanager. We need a notification path we can prove locally before adding Slack, email, or other external channels.

First channel choice:

Use a local DevOps Monitor notification inbox.

This gives us a safe first path:

```text
Prometheus alert -> Alertmanager -> DevOps Monitor webhook API -> local notification inbox
```

Changes made:

- Added a local notification inbox helper:

```text
ui-next/lib/notification-inbox.ts
```

- Updated the Alertmanager webhook API so it can list stored notifications:

```text
GET /api/notifications/webhook
POST /api/notifications/webhook
```

- Updated the notification service so every Alertmanager webhook payload is saved to the local inbox before optional Slack/email/webhook fan-out.
- Updated Alertmanager receiver config:

```yaml
receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://devops-monitor-ui:3000/api/notifications/webhook'
        send_resolved: true
```

- Added a writable UI data volume:

```yaml
devops_monitor_ui_data:/app/data
```

- Added runtime storage path:

```text
NOTIFICATION_STORE_PATH=/app/data/notification-events.json
```

Validation commands:

```bash
docker compose config >/tmp/observability-compose-check.yml
```

```bash
docker run --rm \
  --entrypoint amtool \
  -v "$PWD/alertmanager:/etc/alertmanager:ro" \
  prom/alertmanager:v0.25.0 \
  check-config /etc/alertmanager/config.yml
```

Observed result:

```text
compose-ok
Checking '/etc/alertmanager/config.yml' SUCCESS
```

Build and recreate:

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui alertmanager
```

Observed result:

```text
devops-monitor-ui Up healthy
alertmanager Up healthy
```

Check Alertmanager loaded the new receiver:

```bash
curl -fsS http://localhost:9093/api/v2/status | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["config"]["original"])'
```

Expected receiver URL:

```text
http://devops-monitor-ui:3000/api/notifications/webhook
```

Direct webhook test:

```bash
curl -fsS -X POST http://localhost:4000/api/notifications/webhook \
  -H 'Content-Type: application/json' \
  --data '{"receiver":"web.hook","status":"firing","alerts":[{"status":"firing","labels":{"alertname":"Phase5NotificationTest","severity":"info","app":"opensis","service":"opensis-ui","component":"frontend","instance":"http://opensis-ui/"},"annotations":{"summary":"Phase 5 notification path test","description":"Safe test payload sent directly to the DevOps Monitor webhook inbox.","runbook_url":"http://localhost:4000/dashboard"},"startsAt":"2026-04-15T13:17:00Z","endsAt":"0001-01-01T00:00:00Z","fingerprint":"phase5-test-opensis"}]}'
```

Observed result:

```text
local-inbox stored: 1
```

List notifications:

```bash
curl -fsS http://localhost:4000/api/notifications/webhook?limit=5 | python3 -m json.tool
```

Observed result:

```text
title: Phase 5 notification path test
status: firing
app: opensis
service: opensis-ui
```

Alertmanager route test:

```bash
curl -fsS -X POST http://localhost:9093/api/v2/alerts \
  -H 'Content-Type: application/json' \
  --data '[{"labels":{"alertname":"Phase5AlertmanagerRouteTest","severity":"info","app":"opensis","service":"opensis-ui","component":"frontend","instance":"phase5-route-test"},"annotations":{"summary":"Phase 5 Alertmanager route test","description":"Safe test alert sent to Alertmanager to verify delivery into the DevOps Monitor notification inbox.","runbook_url":"http://localhost:4000/dashboard"},"startsAt":"2026-04-15T17:18:00Z","endsAt":"2026-04-15T17:28:00Z"}]'
```

After Alertmanager's `group_wait`, the inbox showed:

```text
Phase 5 Alertmanager route test
status: firing
app: opensis
service: opensis-ui
```

Resolve test alert:

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -X POST http://localhost:9093/api/v2/alerts \
  -H 'Content-Type: application/json' \
  --data "[{\"labels\":{\"alertname\":\"Phase5AlertmanagerRouteTest\",\"severity\":\"info\",\"app\":\"opensis\",\"service\":\"opensis-ui\",\"component\":\"frontend\",\"instance\":\"phase5-route-test\"},\"annotations\":{\"summary\":\"Phase 5 Alertmanager route test\",\"description\":\"Safe test alert resolved after notification path verification.\",\"runbook_url\":\"http://localhost:4000/dashboard\"},\"startsAt\":\"2026-04-15T17:18:00Z\",\"endsAt\":\"$NOW\"}]"
```

Cleanup verification:

```bash
curl -fsS 'http://localhost:9093/api/v2/alerts' | python3 -c 'import json,sys; alerts=json.load(sys.stdin); print([(a["labels"].get("alertname"), a["status"]["state"]) for a in alerts if a["labels"].get("alertname")=="Phase5AlertmanagerRouteTest"])'
```

Observed result:

```text
[]
```

Important observation:

After this integration, real existing Alertmanager alerts also started appearing in the notification inbox. Example:

```text
NetworkInterfaceDown
severity: critical
service: system
component: network
```

This confirms Alertmanager is now actively delivering real notifications into the custom UI path.

## Step 25: Notification Inbox UI And Slack Setup

Goal:

Show the local notification inbox in the UI and prepare Slack as the first external delivery channel.

Why:

The backend notification path works, but we need a user-facing place to inspect delivered notifications. Slack also gives us the first realistic external channel once a real incoming webhook URL is added.

Changes made:

- Added a notification inbox hook:

```text
ui-next/lib/hooks/use-notification-inbox.ts
```

- Added a Notifications page:

```text
ui-next/app/notifications/page.tsx
```

- Added Notifications to the sidebar navigation.
- Kept the same design language used by Dashboard, Alerts, Metrics, Services, and Templates.
- Added notification filters for:

```text
status
severity
app
service
search text
```

- Added Slack environment variables to Docker Compose:

```text
SLACK_WEBHOOK_URL
SLACK_CHANNEL
SLACK_USERNAME
SLACK_ICON_EMOJI
```

- Added Slack placeholders to `.env`:

```text
SLACK_WEBHOOK_URL=
SLACK_CHANNEL="#alerts"
SLACK_USERNAME="DevOps Monitor"
SLACK_ICON_EMOJI=":bell:"
```

- Updated `NotificationService` so Slack is enabled only when `SLACK_WEBHOOK_URL` is a real HTTPS webhook URL.
- Updated the Slack test endpoint to fail clearly when Slack is not configured.

Build and recreate:

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

Observed result:

```text
Compiled successfully
Running TypeScript ...
devops-monitor-ui Up healthy
```

Route check:

```bash
curl -I http://localhost:4000/notifications
```

Observed result:

```text
HTTP/1.1 307 Temporary Redirect
location: /auth/signin?from=%2Fnotifications
```

This is expected because the UI route is protected.

Inbox API check:

```bash
curl -fsS http://localhost:4000/api/notifications/webhook?limit=3 | python3 -m json.tool
```

Observed result:

The inbox returned delivered Alertmanager notifications, including real `NetworkInterfaceDown` events from node-exporter.

Slack configuration check:

```bash
curl -fsS http://localhost:4000/api/notifications | python3 -c 'import json,sys; d=json.load(sys.stdin); slack=d.get("channels",{}).get("slack",{}); print({"slack_enabled": slack.get("enabled"), "channel": slack.get("default_channel"), "username": slack.get("username"), "webhook_set": bool(slack.get("webhook_url"))})'
```

Observed result before adding a real webhook:

```text
{'slack_enabled': False, 'channel': '#alerts', 'username': 'DevOps Monitor', 'webhook_set': False}
```

Slack test before adding a real webhook:

```bash
curl -X POST http://localhost:4000/api/notifications/test/slack
```

Observed result:

```text
HTTP 400
No enabled notification channel matched "slack"
```

This is correct. Slack should not appear enabled until a real webhook URL is provided.

How to enable Slack:

1. Create a Slack incoming webhook.
2. Paste it into `.env`:

```text
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/REAL/WEBHOOK/VALUE"
SLACK_CHANNEL="#alerts"
SLACK_USERNAME="DevOps Monitor"
SLACK_ICON_EMOJI=":bell:"
```

3. Recreate the UI container:

```bash
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

4. Test Slack:

```bash
curl -fsS -X POST http://localhost:4000/api/notifications/test/slack | python3 -m json.tool
```

Expected result after adding a real webhook:

```text
success: true
channel: slack
```

Slack activation result:

After adding a real Slack incoming webhook URL to `.env`, the UI container was recreated:

```bash
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

Runtime Slack check:

```bash
curl -fsS http://localhost:4000/api/notifications | python3 -c 'import json,sys; d=json.load(sys.stdin); slack=d.get("channels",{}).get("slack",{}); url=slack.get("webhook_url") or ""; print({"slack_enabled": slack.get("enabled"), "channel": slack.get("default_channel"), "username": slack.get("username"), "webhook_set": bool(url), "webhook_prefix_ok": url.startswith("https://hooks.slack.com/services/"), "webhook_length": len(url)})'
```

Observed result:

```text
{'slack_enabled': True, 'channel': '#alerts', 'username': 'DevOps Monitor', 'webhook_set': True, 'webhook_prefix_ok': True, 'webhook_length': 81}
```

Slack test command:

```bash
curl -sS -o /tmp/slack-test-response.json -w '%{http_code}' \
  -X POST http://localhost:4000/api/notifications/test/slack
python3 -m json.tool /tmp/slack-test-response.json
rm -f /tmp/slack-test-response.json
```

Observed result:

```text
HTTP 200
channel: slack
success: true
result: ok
```

Important safety note:

Do not commit a real Slack webhook URL. Keep it in `.env` locally or move it to a secret manager later when we migrate to Kubernetes.

## Next Step: Send A Controlled Alert To Slack

Once a real `SLACK_WEBHOOK_URL` is added, the next step is to trigger one controlled OpenSIS alert and confirm it reaches Slack, the local notification inbox, and Alertmanager.

## Troubleshooting Cheat Sheet

If UI says services are down:

```bash
curl -fsS http://localhost:4000/api/services/health | python3 -m json.tool
docker exec devops-monitor-ui node -e "fetch('http://prometheus:9090/-/healthy').then(r=>console.log(r.status)).catch(e=>console.error(e.message))"
```

If the UI says services are up but the `Open` button fails:

```bash
curl -fsS http://localhost:4000/api/services/health | python3 -m json.tool
```

Check that each service has a browser-safe `publicUrl`:

```json
"url": "http://prometheus:9090",
"publicUrl": "http://localhost:9090"
```

If `publicUrl` is missing, rebuild and recreate the UI:

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

Then hard refresh the browser:

```text
Ctrl + Shift + R
```

If Prometheus config may be broken:

```bash
docker run --rm \
  --entrypoint promtool \
  -v "$PWD/prometheus:/etc/prometheus:ro" \
  prom/prometheus:v2.45.0 \
  check config /etc/prometheus/prometheus.yml
```

If Compose config may be broken:

```bash
docker compose config >/tmp/compose-check.yml
```

If UI changes are made:

```bash
docker compose --profile ui build devops-monitor-ui
docker compose --profile ui up -d --force-recreate devops-monitor-ui
```

If Prometheus config changes:

```bash
curl -X POST http://localhost:9090/-/reload
```

If Docker cannot resolve the shared app aliases:

```bash
docker network inspect observability-net
```

If Blackbox target scrape is `up=1` but endpoint is not healthy:

```promql
probe_success
```

Remember: `up` for Blackbox means Prometheus can scrape Blackbox. `probe_success` tells us whether the probed app endpoint is healthy.

## Documentation Rule Going Forward

For every new change, add:

1. What we changed.
2. Why we changed it.
3. Commands used.
4. Problem encountered.
5. Fix applied.
6. How we verified it.

This keeps the project useful as a learning path and portfolio-grade DevOps implementation.
