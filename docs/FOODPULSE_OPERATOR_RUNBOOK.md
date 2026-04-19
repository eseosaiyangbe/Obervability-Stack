# FoodPulse Operator Runbook

## Purpose

FoodPulse is the resilience and failover workload in this platform lab.

Use this runbook when you need to operate, diagnose, or explain FoodPulse from the shared control plane.

FoodPulse teaches:

- browser-first application reachability
- API reachability through a UI proxy
- Postgres primary/replica topology
- Redis replication and Sentinel failover
- HAProxy routing for Postgres and Redis
- manual failover drills
- the difference between a healthy app surface and a healthy HA topology

## What FoodPulse Does

FoodPulse is a modernized application surface wrapped around an HA learning lab.

| Component | Role | Local Surface |
|---|---|---|
| `foodpulse-ui` | React UI and Nginx proxy | `http://localhost:8090` |
| `foodpulse-api` | Node/Express API | `http://localhost:3102` |
| `foodpulse-db` | Postgres primary candidate | internal Docker network |
| `foodpulse-db-replica1` | Postgres replica candidate | internal Docker network |
| `foodpulse-db-replica2` | Postgres replica candidate | internal Docker network |
| `foodpulse-db-replica3` | Postgres replica candidate | internal Docker network |
| `foodpulse-pg-haproxy` | Postgres RW/RO routing | `localhost:5442`, `localhost:5443` |
| `foodpulse-redis-master` | Redis master candidate | internal Docker network |
| `foodpulse-redis-replica1` | Redis replica candidate | internal Docker network |
| `foodpulse-redis-replica2` | Redis replica candidate | internal Docker network |
| `foodpulse-redis-sentinel01` | Redis Sentinel | `localhost:26380` |
| `foodpulse-redis-sentinel02` | Redis Sentinel | internal Docker network |
| `foodpulse-redis-sentinel03` | Redis Sentinel | internal Docker network |
| `foodpulse-redis-haproxy` | Redis master routing | `localhost:6380` |

The key operator idea is that the app can look fine while the HA topology is degraded, or the HA topology can be degraded while the UI still serves cached/basic traffic. Always check both.

## Start FoodPulse

Start from the workspace root:

```bash
cd FoodPulse
cp .env.example .env
./scripts/start.sh
```

Then return to the observability stack:

```bash
cd ../Obervability-Stack
./scripts/devops-monitor.sh operator
```

If you are upgrading from an older local FoodPulse stack, run this once before the first modern startup:

```bash
cd FoodPulse
docker compose down -v
cp .env.example .env
./scripts/start.sh
```

Only use the volume reset when you intentionally want a clean local lab state.

## Confirm FoodPulse Is Healthy

Start with the standard platform workflow:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh operator
```

Then run the FoodPulse live audit:

```bash
./scripts/devops-monitor.sh foodpulse-live
```

The live audit proves:

- Docker Compose is available
- the FoodPulse compose file exists
- `observability-net` exists
- FoodPulse responds on `localhost:8090`
- the stats endpoint responds through the UI proxy
- the control plane sees FoodPulse as healthy
- Prometheus blackbox target health is present and up
- `FoodPulse/scripts/cluster-status.sh` reports a healthy lab

## Minimum Manual Health Checks

Use these when you need quick human-readable checks:

```bash
curl -fsSI http://localhost:8090
curl -fsS http://localhost:8090/api/getstats | jq .
curl -fsS http://localhost:4000/api/apps/foodpulse/overview | jq .

cd FoodPulse
./scripts/cluster-status.sh
```

Expected result:

- UI returns HTTP `200`
- stats endpoint returns app telemetry such as `hostname` and `pageviews`
- control plane reports FoodPulse as `healthy`
- cluster status reports `Cluster status: OK`

## Metrics And Probes To Watch

FoodPulse is currently monitored centrally through blackbox probes and app-health inventory. The app also exposes local health and metrics surfaces through the UI proxy.

| Signal | What It Means | Healthy Interpretation |
|---|---|---|
| `probe_success{job="blackbox-http",app="foodpulse"}` | central HTTP probe result | should be `1` |
| `http://localhost:8090` | browser-facing UI | should return HTTP `200` |
| `http://localhost:8090/api/getstats` | API through UI proxy | should return telemetry JSON |
| `cluster-status.sh` | HA lab health | should exit `0` and report OK |
| Postgres RW pool | write route through HAProxy | should point to a primary |
| Postgres RO pool | read route through HAProxy | should point to a replica |
| Redis HAProxy view | active Redis master route | should point to the current master |

Query Prometheus directly:

```bash
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=probe_success{job="blackbox-http",app="foodpulse"}' | jq .
```

## Logs To Check

Start broad:

```bash
cd FoodPulse
docker compose logs --tail=80 foodpulse-ui
docker compose logs --tail=80 foodpulse-api
docker compose logs --tail=80 foodpulse-db foodpulse-db-replica1 foodpulse-db-replica2 foodpulse-db-replica3
docker compose logs --tail=80 foodpulse-pg-haproxy
docker compose logs --tail=80 foodpulse-redis-master foodpulse-redis-replica1 foodpulse-redis-replica2
docker compose logs --tail=80 foodpulse-redis-sentinel01 foodpulse-redis-sentinel02 foodpulse-redis-sentinel03
docker compose logs --tail=80 foodpulse-redis-haproxy
```

Follow the app path in this order:

1. `foodpulse-ui`: browser and proxy behavior
2. `foodpulse-api`: API request handling
3. `foodpulse-pg-haproxy`: Postgres routing
4. `foodpulse-db` and replicas: database role/readiness
5. `foodpulse-redis-haproxy`: Redis routing
6. Redis master/replicas/Sentinels: current Redis master election state

## Common Failure Scenarios

### UI Does Not Load

Symptom:

- `http://localhost:8090` does not load
- dashboard marks FoodPulse degraded or down
- blackbox probe fails

First checks:

```bash
cd FoodPulse
docker compose ps foodpulse-ui foodpulse-api
docker compose logs --tail=120 foodpulse-ui
docker compose logs --tail=120 foodpulse-api
curl -fsS http://localhost:8090/api/getstats | jq .
```

Likely causes:

- UI container is not running
- API container is not running
- UI proxy cannot reach API
- port `8090` is already in use
- local image build failed

Kubernetes mapping:

```bash
kubectl get pods -n foodpulse
kubectl logs deployment/foodpulse-ui -n foodpulse --tail=120
kubectl logs deployment/foodpulse-api -n foodpulse --tail=120
kubectl get ingress -n foodpulse
```

### Stats API Fails Through UI Proxy

Symptom:

- UI loads
- `http://localhost:8090/api/getstats` fails
- FoodPulse live audit fails in the stats endpoint section

First checks:

```bash
cd FoodPulse
curl -fsS http://localhost:8090/api/getstats | jq .
curl -fsS http://localhost:3102/api/getstats | jq .
docker compose logs --tail=120 foodpulse-ui
docker compose logs --tail=120 foodpulse-api
```

Likely causes:

- Nginx proxy path is broken
- API is unhealthy
- API cannot reach Postgres through `pg-haproxy`
- API cannot reach Redis through `redis-haproxy`
- CORS/origin configuration is wrong

Kubernetes mapping:

```bash
kubectl get svc -n foodpulse
kubectl logs deployment/foodpulse-ui -n foodpulse --tail=120
kubectl logs deployment/foodpulse-api -n foodpulse --tail=120
kubectl describe ingress -n foodpulse
```

### Cluster Status Is Degraded

Symptom:

- app may or may not still load
- `./scripts/cluster-status.sh` exits non-zero
- live audit fails in the operator workflow section

First checks:

```bash
cd FoodPulse
./scripts/cluster-status.sh
docker compose ps
docker compose logs --tail=80 foodpulse-pg-haproxy foodpulse-redis-haproxy
```

Likely causes:

- Postgres primary or replica is down
- HAProxy cannot route to expected backend
- Redis master or replica is down
- Sentinel has not converged
- API dependencies are not reachable through HAProxy

Kubernetes mapping:

```bash
kubectl get pods -n foodpulse
kubectl get endpoints -n foodpulse
kubectl get events -n foodpulse --sort-by='.lastTimestamp'
```

### Redis Failover Event

Symptom:

- Redis master container stops or changes
- Sentinel elects a new master
- HAProxy should route to the new master

Safe lab drill:

```bash
cd FoodPulse
./scripts/redis-failover-drill.sh
./scripts/cluster-status.sh
```

Operator notes:

- this is an interactive drill
- it intentionally stops the current Redis master
- Sentinel should promote a replica
- the old master should rejoin as a replica when restarted
- confirm HAProxy routes to the current master after the drill

Kubernetes mapping:

```bash
kubectl get pods -n foodpulse | rg 'redis|sentinel'
kubectl logs statefulset/redis -n foodpulse --tail=120
kubectl logs deployment/redis-sentinel -n foodpulse --tail=120
```

### Postgres Primary Failure Or Promotion Drill

Symptom:

- Postgres primary is down
- RW pool through HAProxy fails
- API writes fail
- `cluster-status.sh` reports degraded Postgres state

Safe lab drill:

```bash
cd FoodPulse
./scripts/pg-failover-drill.sh
./scripts/cluster-status.sh
```

Operator notes:

- this is a manual educational drill
- it is not a production HA controller
- promotion is done with `pg_promote()`
- after promotion, the original replication topology is no longer clean
- the old primary does not automatically become a replica
- expect cleanup/reseed work after the drill

Kubernetes mapping:

```bash
kubectl get pods -n foodpulse | rg 'postgres|pg|haproxy'
kubectl logs statefulset/foodpulse-db -n foodpulse --tail=120
kubectl logs deployment/foodpulse-pg-haproxy -n foodpulse --tail=120
```

### Blackbox Probe Fails But App Looks Fine

Symptom:

- browser can load FoodPulse
- Prometheus/control-plane probe reports down
- alert fires even though users can reach the app

First checks:

```bash
curl -fsSI http://localhost:8090
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=probe_success{job="blackbox-http",app="foodpulse"}' | jq .
cd Obervability-Stack
./scripts/devops-monitor.sh foodpulse
```

Likely causes:

- blackbox target changed
- service alias changed
- FoodPulse UI is not attached to `observability-net`
- central Prometheus has stale config
- probe path differs from browser path

Kubernetes mapping:

```bash
kubectl get networkpolicy -n foodpulse
kubectl logs -n foodpulse deploy/blackbox-exporter --tail=100
kubectl get servicemonitor -A
```

## Recovery Commands

Local Docker Compose:

```bash
cd FoodPulse
docker compose restart foodpulse-ui
docker compose restart foodpulse-api
docker compose restart foodpulse-pg-haproxy foodpulse-redis-haproxy
docker compose ps
./scripts/cluster-status.sh
```

Use the repo helper for a normal restart:

```bash
cd FoodPulse
./scripts/stop.sh
./scripts/start.sh
./scripts/cluster-status.sh
```

Use a volume reset only when you intentionally want a clean lab state:

```bash
cd FoodPulse
docker compose down -v
cp .env.example .env
./scripts/start.sh
```

Kubernetes:

```bash
kubectl rollout restart deployment/foodpulse-ui -n foodpulse
kubectl rollout restart deployment/foodpulse-api -n foodpulse
kubectl rollout status deployment/foodpulse-ui -n foodpulse
kubectl rollout status deployment/foodpulse-api -n foodpulse
```

For stateful dependency recovery in Kubernetes, prefer a documented controller or GitOps-managed repair path over manual pod deletion.

## Kubernetes Readiness Notes

FoodPulse does not yet have the same Kubernetes manifest depth as SwiftPay, OpenSIS, or MemFlip. The current value is that its local runtime already separates the application surface from the HA lab dependencies.

When we move this workspace to Kubernetes, this operator model should map like this:

| Local Concept | Kubernetes Equivalent |
|---|---|
| `docker compose ps` | `kubectl get pods -n foodpulse` |
| `docker compose logs foodpulse-api` | `kubectl logs deployment/foodpulse-api -n foodpulse` |
| `http://localhost:8090` | ingress or port-forwarded UI service |
| `http://localhost:8090/api/getstats` | ingress/proxy API path |
| Postgres primary/replicas | StatefulSet plus PVCs |
| Postgres HAProxy RW/RO pools | service routing or an HA Postgres operator |
| Redis master/replicas/Sentinel | Redis operator, StatefulSet, or managed Redis equivalent |
| `cluster-status.sh` | Kubernetes health script or smoke test Job |
| manual failover drills | controlled chaos/resilience exercises |

The important rule is that the operator questions stay the same:

1. Is the app reachable?
2. Is the app healthy?
3. Are dependencies healthy?
4. Are metrics arriving?
5. Are logs arriving?
6. Are alerts firing correctly?

Only the command surface changes.

## Related FoodPulse Docs

Use these when you need deeper app-specific detail:

- `FoodPulse/README.md`
- `FoodPulse/scripts/cluster-status.sh`
- `FoodPulse/scripts/redis-failover-drill.sh`
- `FoodPulse/scripts/pg-failover-drill.sh`
- `FoodPulse/scripts/start.sh`
- `FoodPulse/scripts/stop.sh`
