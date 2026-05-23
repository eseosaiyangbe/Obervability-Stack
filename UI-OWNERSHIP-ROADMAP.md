# DevOps Monitor UI Ownership Roadmap

This roadmap turns the custom DevOps Monitor UI review into a practical build plan we can follow.

The goal is to make the cloned UI become our own observability control plane for:

- `OpenSIS`
- `SwiftPay`
- `MemFlip`
- `FoodPulse`

We will start by making the UI reliable, then make `OpenSIS` the first fully managed app, then gradually onboard the other applications.

## Current UI Status

The UI is a Next.js application:

```text
Obervability-Stack/ui-next
```

It already includes:

- Authentication with NextAuth.
- A Prisma schema for users, teams, dashboards, and configuration.
- Service health checks.
- Prometheus metric helpers.
- Loki log helpers.
- Alertmanager alert helpers.
- Notification support for Slack, Teams, Discord, email, and webhooks.
- Dashboard templates.
- Plugin architecture.
- Admin and profile pages.
- Version monitoring.

Important lesson:

The UI has many features, but not every feature is production-real yet. Some are working, some are partially wired, and some are polished demo screens. Our job is to keep the useful parts, make the important parts real, and document the journey.

## Ownership Principles

We will use these rules while taking ownership of the UI:

- Prefer working observability features over decorative features.
- Keep Prometheus, Loki, and Alertmanager access server-side when possible.
- Do not make browser code depend on Docker internal names such as `http://prometheus:9090`.
- Make `OpenSIS` the first complete managed-app example.
- Document every command, problem, and fix in `IMPLEMENTATION-RUNBOOK.md`.
- Keep the visible UI focused on health, metrics, logs, alerts, dashboards, and links.
- Hide or delay features that distract from the current learning path.

## Feature Classification

### Working Or Mostly Working Now

These features are useful today:

- Services health page.
- Service Open buttons and quick links.
- DevOps Monitor UI shell.
- Demo authentication.
- Theme support.
- Basic notification backend.

### Partially Wired And Worth Finishing

These features have useful code but need server-side API routes, better persistence, or real data:

- Metrics page.
- Logs page.
- Alerts page.
- Version monitor.
- Notification settings.
- Dashboard templates.

### Mostly Demo Or Future Work

These features look polished but are not critical yet:

- Admin user management.
- Profile editing.
- Plugin marketplace.
- Template marketplace.
- Generic dashboard mock data.

We will not delete these immediately. We will decide whether to hide, simplify, or complete them after the core monitoring workflow is reliable.

## Phase 0: Baseline And Documentation

Status: mostly complete.

Purpose:

Understand what exists, get the UI running, and record the early fixes.

Completed so far:

- Identified the UI as a Next.js app.
- Fixed Docker Buildx so the UI can build.
- Started the UI with the Compose `ui` profile.
- Fixed UI healthcheck from `wget` to `curl`.
- Fixed service status checks by adding a server-side health API route.
- Fixed Open buttons by separating Docker internal URLs from browser URLs.
- Documented the major setup steps in `IMPLEMENTATION-RUNBOOK.md`.

Validation:

```bash
cd Obervability-Stack
docker compose --profile ui ps
```

```bash
curl -fsS http://localhost:4000/api/services/health | python3 -m json.tool
```

Success criteria:

- `devops-monitor-ui` is healthy.
- Platform services show `up`.
- Browser URLs use `localhost`.

## Phase 1: Stabilize The UI Data Path

Status: complete for the first pass.

Purpose:

Make Metrics, Logs, and Alerts reliable by routing requests through the Next.js server.

Why this matters:

The browser cannot resolve Docker service names like:

```text
http://prometheus:9090
http://loki:3100
http://alertmanager:9093
```

Those names work inside Docker, not from the host browser. We already solved this for the Services page with:

```text
ui-next/app/api/services/health/route.ts
```

Now we apply the same pattern to Metrics, Logs, and Alerts.

Kubernetes and Cloudflared direction:

When we move from Docker Compose to Kubernetes, this pattern stays the same:

```text
Browser -> Cloudflared/Ingress -> DevOps Monitor UI -> internal Kubernetes services
```

Prometheus, Loki, and Alertmanager should remain internal services. The public or tunneled entrypoint should be the UI unless there is a specific operational reason to expose another backend.

### Phase 1.1: Metrics API Proxy

Goal:

Move Prometheus queries behind Next.js API routes.

Files to inspect or update:

```text
ui-next/app/metrics/page.tsx
ui-next/lib/prometheus-api.ts
ui-next/lib/hooks/use-prometheus-metrics.ts
ui-next/app/api/metrics/current/route.ts
ui-next/app/api/metrics/range/route.ts
```

Implemented:

- Created `/api/metrics/current`.
- Created `/api/metrics/range`.
- Let those routes call `prometheusAPI` from the server.
- Updated React hooks to call the UI API routes instead of Prometheus directly.
- Fixed the system load Prometheus query.

Validation:

```bash
curl -fsS http://localhost:4000/api/metrics/current | python3 -m json.tool
```

Success criteria:

- Metrics page loads without browser-side connection errors.
- CPU, memory, disk, network, and load values come from Prometheus.

### Phase 1.2: Logs API Proxy

Goal:

Move Loki queries behind Next.js API routes.

Files to inspect or update:

```text
ui-next/app/logs/page.tsx
ui-next/lib/loki-api.ts
ui-next/lib/hooks/use-loki-logs.ts
ui-next/app/api/logs/query/route.ts
ui-next/app/api/logs/metadata/route.ts
```

Implemented:

- Created `/api/logs/query`.
- Created `/api/logs/metadata`.
- Let those routes call Loki from inside Docker.
- Updated the Logs hook to call the UI API instead of Loki directly.
- Updated Loki label handling for current Docker labels: `container`, `compose_service`, and `compose_project`.
- Fixed Loki single-node Docker Compose config so labels and queries return instead of hanging.

Validation:

```bash
curl -fsS "http://localhost:4000/api/logs/query?timeRange=1h" | python3 -m json.tool
```

Success criteria:

- Logs page shows Docker logs collected by Promtail.
- Logs can be filtered by container or app.

### Phase 1.3: Alerts API Proxy

Goal:

Move Alertmanager queries behind Next.js API routes.

Files to inspect or update:

```text
ui-next/app/alerts/page.tsx
ui-next/lib/alertmanager-api.ts
ui-next/lib/hooks/use-alertmanager-alerts.ts
ui-next/app/api/alerts/route.ts
ui-next/app/api/alerts/silences/route.ts
```

Implemented:

- Created `/api/alerts`.
- Created `/api/alerts/silences`.
- Used Alertmanager API server-side.
- Updated the Alerts hook to call the UI API instead of Alertmanager directly.
- Renamed the sidebar item from `Alerts` to `Active Alerts`.
- Wired the alert card `Silence` button to create real Alertmanager silences.
- Wired the alert card `Comment` button into the same Alertmanager silence flow because Alertmanager stores comments on silences, not directly on alert objects.
- Added a silence action modal with duration, owner, and comment fields.
- Tuned noisy cloned alert rules in `prometheus/alert_rules.yml`.
- Updated `NetworkInterfaceDown` to ignore local and virtual interfaces such as `lo`, Docker bridges, veth pairs, Flannel, CNI, and tunnel devices.
- Updated `HighLoadAverage` to compare load against available CPU cores instead of using a fixed `node_load1 > 2` threshold.

Validation:

```bash
curl -fsS http://localhost:4000/api/alerts | python3 -m json.tool
```

```bash
curl -fsS http://localhost:4000/api/alerts/silences | python3 -m json.tool
```

```bash
docker compose exec -T prometheus promtool check rules /etc/prometheus/alert_rules.yml
```

```bash
curl -X POST http://localhost:9090/-/reload
```

Success criteria:

- Alerts page loads active alerts without browser-side connection errors.
- Alerts refresh automatically.
- A user can create a narrow Alertmanager silence from an alert card.
- Silence comments are stored in Alertmanager as part of the silence record.
- Local Docker/Kubernetes-style virtual interfaces do not create critical network alerts.
- Host load alerts fire only when load is high relative to CPU capacity.

## Phase 2: Define Our Monitored App Model

Status: complete for the first pass.

Purpose:

Create one source of truth for the applications we monitor.

The model should define:

- App name.
- Environment.
- Frontend URL.
- Backend/API health URL.
- Docker service aliases.
- Prometheus labels.
- Loki labels.
- Owner/team.
- Dashboard links.
- Runbook links.

Initial app inventory:

```text
OpenSIS
SwiftPay
MemFlip
FoodPulse
```

Implemented files:

```text
ui-next/lib/monitored-apps.ts
ui-next/app/api/apps/route.ts
ui-next/lib/hooks/use-monitored-apps.ts
```

The model includes:

- Docker Compose aliases.
- Promtail/Loki labels.
- Blackbox/Prometheus labels.
- Uptime and latency PromQL.
- Runbook hints.
- Kubernetes namespace and recommended labels.
- Endpoint definitions for frontends, APIs, and services.

API:

```text
GET /api/apps
```

Current summary:

```text
4 apps
10 endpoints
1 owned app
```

Success criteria:

- The UI has one central list of monitored apps.
- Services, Dashboard, Logs, and Alerts can reuse the same app metadata.
- The Services page now displays the first Managed Applications inventory section.

## Phase 3: Make OpenSIS The First Fully Managed App

Status: complete for the first pass.

Purpose:

Use `OpenSIS` as our complete example before adding more apps.

OpenSIS should have:

- Health status.
- Uptime chart.
- Probe latency chart.
- Logs view.
- Alert rules.
- Dashboard summary card.
- Troubleshooting notes.

Implemented first pass:

- OpenSIS health now comes from Prometheus Blackbox data.
- OpenSIS probe latency now comes from Prometheus.
- OpenSIS recent logs come from Loki using the app log query.
- OpenSIS alerts come from Alertmanager.
- OpenSIS has dedicated alert rules for down and high probe latency.
- The Services page Managed Applications section now shows live app health.
- `/api/apps/opensis/overview` returns the full OpenSIS observability snapshot.

Validated with OpenSIS running:

- OpenSIS is reachable on `http://localhost:8088`.
- Prometheus returns `probe_success{job="blackbox-http",app="opensis"} = 1`.
- `/api/apps/health` reports OpenSIS as `healthy`.
- `/api/apps/opensis/overview` returns OpenSIS health, latency, logs, uptime series, and latency series.
- `OpenSISDown` resolves after the healthy probe is scraped.
- Loki returns OpenSIS logs through the app log path.

### Phase 3.1: OpenSIS Health

Prometheus query:

```promql
probe_success{job="blackbox-http",app="opensis"}
```

Latency query:

```promql
probe_duration_seconds{job="blackbox-http",app="opensis"}
```

Success criteria:

- UI shows whether OpenSIS is reachable.
- UI shows when it was last checked.
- UI shows a browser link to OpenSIS.

### Phase 3.2: OpenSIS Logs

Goal:

Make it easy to view only OpenSIS logs.

Example Loki direction:

```logql
{compose_project=~".*opensis.*"}
```

Success criteria:

- Logs page has a quick filter for OpenSIS.
- OpenSIS logs appear without manually writing LogQL.

### Phase 3.3: OpenSIS Alerts

Start with simple alert rules:

- OpenSIS UI down for more than 2 minutes.
- OpenSIS probe latency too high.
- OpenSIS container unavailable.

Example rule idea:

```promql
probe_success{job="blackbox-http",app="opensis"} == 0
```

Success criteria:

- Alert fires when OpenSIS is down.
- Alert resolves after OpenSIS comes back.
- Alert appears in Alertmanager and the UI.

## Phase 4: Build The Real Dashboard

Status: complete first pass.

Purpose:

Replace mock dashboard data with real observability data.

Current issue:

The Dashboard page had a lot of static/mock data. It looked good, but it did not represent our real environment.

Implemented first pass:

- Host resource usage from Prometheus.
- Managed app health from `/api/apps/health`.
- OpenSIS health summary from `/api/apps/opensis/overview`.
- OpenSIS uptime chart from Prometheus range data.
- OpenSIS latency chart from Prometheus range data.
- Active alert count and alert list from Alertmanager.
- Recent OpenSIS logs from Loki.
- Browser-safe OpenSIS link on the app health row.

Refined card pass:

- Summary cards now have stronger visual hierarchy and color accents.
- Resource cards now include usage bars where the value is a percentage.
- App health rows now use status rails and endpoint chips.
- Alert cards now make critical state easier to recognize.
- Chart cards now have clearer headers and chart surfaces.
- Log rows now scan better without changing the Loki data path.

Original UI alignment pass:

- Dashboard now follows the same visual system used by Templates, Metrics, and Services.
- It uses the same gradient page background pattern.
- It uses the same large gradient hero card pattern.
- It uses animated hero stat tiles like Metrics and Services.
- Managed app cards now follow the Services managed app card style.
- Resource cards now follow the Metrics card style.
- Alert, chart, and log cards use soft gradient headers and `shadow-lg` treatment.

Still to improve later:

- Add platform service cards for Prometheus, Grafana, Loki, and Alertmanager.
- Add direct dashboard links to Grafana, Prometheus, Loki, and Alertmanager.
- Add app detail pages for OpenSIS and future apps.
- Add chart empty states for apps that are not running.

Success criteria:

- Dashboard is useful immediately after opening the UI.
- It answers: "Is the platform healthy, and are my apps healthy?"
- Dashboard data comes from our server-side APIs, not local mock arrays.

## Phase 5: Notification Integration

Status: complete first pass.

Purpose:

Send useful alerts outside the UI.

Existing notification support:

- Slack.
- Microsoft Teams.
- Discord.
- Email.
- Generic webhooks.

Files:

```text
ui-next/lib/notification-service.ts
ui-next/app/api/notifications/route.ts
ui-next/app/api/notifications/send/route.ts
ui-next/app/api/notifications/webhook/route.ts
```

Recommended path:

- Start with one channel only.
- Use the local DevOps Monitor notification inbox first.
- Connect Alertmanager webhook to the UI notification endpoint.
- Confirm one alert can travel from Alertmanager to the notification inbox.
- Add Slack or email after the local path is proven.

Implemented first pass:

- Alertmanager now sends webhooks to `devops-monitor-ui`.
- The UI webhook API stores incoming Alertmanager payloads in a local notification inbox.
- Notification history is persisted in PostgreSQL through the control-plane application schema.
- `GET /api/notifications/webhook` lists stored notification events.
- `POST /api/notifications/webhook` receives Alertmanager webhook payloads.
- A controlled Alertmanager test alert reached the UI inbox.
- The test alert was resolved and removed from active Alertmanager alerts.
- Real existing Alertmanager alerts also started arriving in the inbox.

Notification UI and Slack setup pass:

- Added a dedicated Notifications page.
- Added `Notification Inbox` to the sidebar.
- The Notifications page follows the same design system as Dashboard, Alerts, Metrics, Services, and Templates.
- The notification inbox can be filtered by status, severity, app, service, and search text.
- Slack is now configured through environment variables.
- Slack stays disabled until `SLACK_WEBHOOK_URL` is a real incoming webhook URL.
- Slack tests now fail clearly when Slack is not configured.
- A real Slack webhook was added locally and `/api/notifications/test/slack` returned `ok`.
- Added notification deletion support to the local inbox API.
- Added individual notification delete buttons in the Notification Inbox UI.
- Added a guarded `Clear Inbox` action for deleting all local notification events.
- Updated inbox summary counts so they reflect the full persisted store, not only the current limited list.

Success criteria:

- A real alert reaches the chosen notification channel.
- The notification includes app name, severity, summary, and runbook link.
- Firing and resolved notifications can both be received.
- Operators can delete local inbox notifications without deleting Alertmanager alerts.

## Phase 6: Onboard SwiftPay

Status: complete first pass.

Current Blackbox targets:

```text
http://swiftpay-frontend/
http://swiftpay-api-gateway:3000/health
http://swiftpay-auth-service:3004/health
http://swiftpay-wallet-service:3001/health
http://swiftpay-transaction-service:3002/health
http://swiftpay-notification-service:3003/health
```

SwiftPay dashboard should show:

- Frontend health.
- API Gateway health.
- Auth service health.
- Wallet service health.
- Transaction service health.
- Notification service health.
- Logs by service.
- Alerts by service.

Implemented first pass:

- Started SwiftPay with Docker Compose and connected it to `observability-net`.
- Adjusted local SwiftPay host ports to avoid conflicts with the observability stack:
  - Frontend: `http://localhost:8081`
  - API Gateway health: `http://localhost:3007/health`
  - Transaction Service health: `http://localhost:3008/health`
- Kept Prometheus Blackbox targets on internal Docker aliases so the pattern remains Kubernetes-friendly.
- Updated SwiftPay Docker healthchecks to use `127.0.0.1` instead of `localhost` inside containers. This avoids IPv6 `::1` resolution issues with BusyBox `wget` and makes Docker health agree with the app health endpoints.
- Updated the UI app model so SwiftPay browser links point to the correct local ports.
- Added SwiftPay-specific Prometheus alert rules:
  - `SwiftPayComponentDown`
  - `SwiftPayHighProbeLatency`
- Added `ui-next/.dockerignore` so local `node_modules` and `.next` are not sent into Docker builds.

Validated:

```bash
cd SwiftPay
docker compose ps
```

```bash
curl -fsS http://localhost:3007/health
curl -fsS http://localhost:3004/health
curl -fsS http://localhost:3001/health
curl -fsS http://localhost:3008/health
curl -fsS http://localhost:3003/health
curl -I http://localhost:8081
```

```bash
curl -fsS 'http://localhost:9090/api/v1/query?query=probe_success{job="blackbox-http",app="swiftpay"}' | python3 -m json.tool
```

```bash
curl -fsS http://localhost:4000/api/apps/health | python3 -m json.tool
curl -fsS http://localhost:4000/api/apps/swiftpay/overview | python3 -m json.tool
```

Success criteria:

- SwiftPay appears as a managed app.
- Each SwiftPay component has visible health status.
- All six SwiftPay Blackbox probes return `probe_success = 1`.
- `/api/apps/health` reports SwiftPay as `healthy`.

## Phase 7: Onboard MemFlip

Status: planned.

Current Blackbox targets:

```text
http://memflip-frontend/
http://memflip-backend:3001/health
```

MemFlip dashboard should show:

- Frontend health.
- Backend health.
- Logs by frontend/backend container.
- Basic uptime alert.

Success criteria:

- MemFlip health is visible from the UI.
- MemFlip logs can be filtered from the Logs page.

## Phase 8: Onboard FoodPulse

Status: planned.

Current Blackbox target:

```text
http://foodpulse-ui/
```

FoodPulse dashboard should show:

- UI health.
- Probe latency.
- Logs.
- Uptime alert.

Success criteria:

- FoodPulse appears in the same app list as OpenSIS, SwiftPay, and MemFlip.

## Phase 9: Decide What To Keep, Hide, Or Build Later

Status: planned.

Purpose:

Reduce noise once the core monitoring workflow is working.

Keep now:

- Dashboard.
- Services.
- Metrics.
- Logs.
- Alerts.
- Settings.

Possibly hide for now:

- Plugins.
- Templates.
- Admin.
- Profile.
- Version monitor.

Build later:

- Real user management.
- Real dashboard editor.
- Real plugin persistence.
- GitHub Actions plugin.
- Jenkins plugin.
- Cloud metrics plugins.

Success criteria:

- The UI feels like our tool, not a generic demo.
- Every visible feature has a purpose in our learning path.

## Phase 10: Production Hardening

Status: future.

Purpose:

Prepare the stack for a more realistic environment.

Future tasks:

- Use real secrets instead of demo credentials.
- Persist UI database and config files with Docker volumes.
- Protect Grafana, Prometheus, Loki, and Alertmanager endpoints.
- Remove visible demo credentials.
- Add backups for Grafana dashboards and UI config.
- Add CI checks for the UI.
- Add basic tests for server-side API routes.
- Add documentation for disaster recovery.

Success criteria:

- The stack can be stopped, rebuilt, and started without losing important config.
- The UI no longer depends on demo-only behavior.

## Recommended Immediate Next Steps

We should do this next:

1. Add a real `SLACK_WEBHOOK_URL` to `.env`.
2. Recreate `devops-monitor-ui`.
3. Test `/api/notifications/test/slack`.
4. Send one controlled OpenSIS alert through Alertmanager.
5. Confirm the alert reaches Slack and the local notification inbox.

## Roadmap Tracking Table

| Phase | Name | Status | Main Outcome |
| --- | --- | --- | --- |
| 0 | Baseline and documentation | Mostly complete | UI runs and service health works |
| 1 | Stabilize UI data path | Complete first pass | Metrics, logs, and alerts use server-side APIs |
| 2 | Monitored app model | Complete first pass | One source of truth for apps |
| 3 | OpenSIS managed app | Complete and validated | OpenSIS health, logs, metrics, and alerts |
| 4 | Real dashboard | Complete first pass | Dashboard uses real data |
| 5 | Notifications | Complete first pass plus Slack-ready | Alerts reach the local UI webhook inbox; Slack is env-ready |
| 6 | SwiftPay onboarding | Complete first pass | SwiftPay services monitored |
| 7 | MemFlip onboarding | Planned | MemFlip services monitored |
| 8 | FoodPulse onboarding | Planned | FoodPulse monitored |
| 9 | UI cleanup | Planned | Hide or finish demo features |
| 10 | Production hardening | Future | Persistence, auth, tests, security |
