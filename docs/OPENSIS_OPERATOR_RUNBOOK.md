# OpenSIS Operator Runbook

## Purpose

OpenSIS is the legacy-platform workload in this platform lab.

Use this runbook when you need to operate, diagnose, or explain OpenSIS from the shared control plane without getting lost in the full legacy application tree.

OpenSIS teaches:

- legacy application platforming
- browser-first availability checks
- Vault-backed secret delivery
- MariaDB dependency health
- startup sequencing
- blackbox monitoring
- Kubernetes and GitOps readiness around a stateful legacy app

## What OpenSIS Does

OpenSIS is a PHP/MariaDB student information system packaged with a more serious platform wrapper.

| Component | Role | Local Surface |
|---|---|---|
| `opensis-ui` | openSIS web application | `http://localhost:8088` |
| `opensis-db` | MariaDB database | internal Docker network only |
| `vault` | local Vault server | `http://localhost:8200` |
| `vault-bootstrap` | initializes/unseals local Vault and AppRole material | one-shot Compose job |
| `vault-seed` | writes app/database secrets to Vault | one-shot Compose job |
| `vault-agent-app` | renders app secrets for `opensis-ui` | internal sidecar-style support service |
| `vault-agent-db` | renders DB secrets for `opensis-db` | internal sidecar-style support service |
| `traefik` | optional local edge proxy | profile `edge` |
| `cloudflared` | optional tunnel edge path | profile `edge` |

The key operator idea is simple: OpenSIS can look like “just a web page,” but its health depends on Vault, rendered secrets, MariaDB, and the UI container all agreeing.

## Start OpenSIS

Start from the workspace root.

On most machines:

```bash
cd OpenSIS
./scripts/compose-start.sh
```

On Apple Silicon or when you need to build the UI locally:

```bash
cd OpenSIS
./scripts/compose-start.sh --build-local
```

Then return to the observability stack:

```bash
cd ../Obervability-Stack
./scripts/devops-monitor.sh operator
```

Optional edge services:

```bash
cd OpenSIS
./scripts/compose-start.sh --edge
```

Use the edge profile only when you are intentionally testing Traefik or Cloudflare Tunnel behavior.

## Confirm OpenSIS Is Healthy

Start with the standard platform workflow:

```bash
cd Obervability-Stack
./scripts/devops-monitor.sh operator
```

Then run the OpenSIS live audit:

```bash
./scripts/devops-monitor.sh opensis-live
```

The live audit proves:

- Docker Compose is available
- the OpenSIS compose file exists
- `observability-net` exists
- OpenSIS responds on `localhost:8088`
- OpenSIS returns HTML with application branding
- Vault health responds on `localhost:8200`
- Vault is initialized
- Vault is unsealed
- the control plane sees OpenSIS as healthy
- Prometheus blackbox target health is present and up

## Minimum Manual Health Checks

Use these when you need quick human-readable checks:

```bash
curl -fsSI http://localhost:8088
curl -fsSL http://localhost:8088 | rg -i 'opensis'
curl -fsS http://localhost:8200/v1/sys/health | jq .
curl -fsS http://localhost:4000/api/apps/opensis/overview | jq .
```

Expected result:

- OpenSIS returns HTTP `200` or redirect behavior that reaches HTML
- the HTML contains OpenSIS branding
- Vault reports `initialized: true`
- Vault reports `sealed: false`
- control plane reports OpenSIS as `healthy`

## Metrics And Probes To Watch

OpenSIS is primarily monitored through blackbox probes in the shared control plane.

| Signal | What It Means | Healthy Interpretation |
|---|---|---|
| `probe_success{job="blackbox-http",app="opensis"}` | OpenSIS HTTP probe result | Should be `1` |
| OpenSIS browser URL | User-facing app reachability | `http://localhost:8088` should load |
| Vault health | Secret-control plane readiness | initialized and unsealed |
| MariaDB healthcheck | database readiness | `opensis-db` should be healthy |
| dashboard app health | shared control-plane view | OpenSIS should be `healthy` |

Query Prometheus directly:

```bash
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=probe_success{job="blackbox-http",app="opensis"}' | jq .
```

## Logs To Check

Start broad:

```bash
cd OpenSIS
docker compose logs --tail=80 opensis-ui
docker compose logs --tail=80 opensis-db
docker compose logs --tail=80 vault
docker compose logs --tail=80 vault-agent-app vault-agent-db
```

Follow the legacy platform flow in this order:

1. `vault`: Vault server is reachable and unsealed
2. `vault-bootstrap`: local Vault init/AppRole setup completed
3. `vault-seed`: database and app secrets were written
4. `vault-agent-db`: DB secrets rendered for MariaDB
5. `opensis-db`: MariaDB is healthy using rendered credentials
6. `vault-agent-app`: app secrets rendered for the UI
7. `opensis-ui`: web app starts and serves the browser path

## Common Failure Scenarios

### OpenSIS UI Does Not Load

Symptom:

- `http://localhost:8088` does not load
- dashboard marks OpenSIS degraded or down
- blackbox probe returns failure

First checks:

```bash
cd OpenSIS
docker compose ps opensis-ui opensis-db vault vault-agent-app
docker compose logs --tail=120 opensis-ui
docker compose logs --tail=80 opensis-db
curl -fsS http://localhost:8200/v1/sys/health | jq .
```

Likely causes:

- UI container is not running
- MariaDB is unhealthy
- Vault or Vault Agent did not render app secrets
- local port `8088` is in use
- local image pull/build failed

Kubernetes mapping:

```bash
kubectl get pods -n opensis-dev
kubectl logs deployment/opensis-ui -n opensis-dev --tail=120
kubectl describe deployment/opensis-ui -n opensis-dev
kubectl get events -n opensis-dev --sort-by='.lastTimestamp'
```

### Vault Is Unreachable Or Sealed

Symptom:

- `curl http://localhost:8200/v1/sys/health` fails
- Vault health reports `sealed: true`
- Vault agents cannot render secrets
- DB or UI startup stalls

First checks:

```bash
cd OpenSIS
docker compose ps vault vault-bootstrap vault-seed vault-agent-app vault-agent-db
docker compose logs --tail=120 vault
docker compose logs --tail=120 vault-bootstrap
docker compose logs --tail=120 vault-agent-app vault-agent-db
```

Likely causes:

- Vault volume initialization failed
- Vault bootstrap did not complete
- Vault is sealed after restart
- AppRole material is missing or inaccessible
- Vault agent cannot read its config or template volume

Kubernetes mapping:

```bash
kubectl get pods -n vault
kubectl logs -n vault vault-0 --tail=120
kubectl logs -n vault deploy/vault-agent-injector --tail=120
kubectl exec -n vault vault-0 -- sh -lc 'vault status'
```

### MariaDB Is Unhealthy

Symptom:

- `opensis-db` is unhealthy or restarting
- `opensis-ui` does not become healthy
- app returns database errors
- dashboard sees OpenSIS down even though the UI container exists

First checks:

```bash
cd OpenSIS
docker compose ps opensis-db vault-agent-db
docker compose logs --tail=120 opensis-db
docker compose logs --tail=120 vault-agent-db
```

Likely causes:

- DB secrets were not rendered
- MariaDB credentials drifted
- DB volume contains older credentials than Vault expects
- strict mode config or entrypoint failed
- DB data volume is corrupted in a local lab reset scenario

Kubernetes mapping:

```bash
kubectl get pods -n opensis-dev | rg 'opensis-db|opensis-ui'
kubectl logs statefulset/opensis-db -n opensis-dev --tail=120
kubectl describe statefulset/opensis-db -n opensis-dev
```

### Secret Drift Breaks App Or Backup Behavior

Symptom:

- UI starts but returns errors
- backup jobs fail with database auth errors
- Vault secret and MariaDB user state no longer agree

First checks:

```bash
cd OpenSIS
docker compose logs --tail=120 opensis-db
docker compose logs --tail=120 vault-seed vault-agent-db
```

Kubernetes checks:

```bash
kubectl exec -n opensis opensis-db-0 -- sh -lc 'cat /run/secrets/db.env'
kubectl exec -it -n vault vault-0 -- sh -lc 'vault kv get kv/production/opensis-db'
kubectl get jobs -n opensis --sort-by=.metadata.creationTimestamp
```

Interpretation:

- if Vault and rendered secrets match but MariaDB rejects auth, the drift is inside MariaDB
- that is a database repair issue, not only a secret reread issue
- capture the evidence before restarting or resetting anything

### Blackbox Probe Fails But Browser Works

Symptom:

- browser can load OpenSIS
- Prometheus/control-plane probe reports down
- alert fires even though users can reach the app

First checks:

```bash
curl -fsSI http://localhost:8088
curl -fsS --get http://localhost:9090/api/v1/query --data-urlencode 'query=probe_success{job="blackbox-http",app="opensis"}' | jq .
cd Obervability-Stack
./scripts/devops-monitor.sh opensis
```

Likely causes:

- blackbox target changed
- service alias changed
- OpenSIS is not attached to `observability-net`
- probe path differs from browser path
- in Kubernetes, network policy blocks probe egress

Kubernetes mapping:

```bash
kubectl get networkpolicy -n opensis
kubectl logs -n opensis deploy/blackbox-exporter --tail=100
kubectl exec -n opensis deploy/prometheus -- sh -lc 'wget -qO- "http://127.0.0.1:9090/api/v1/targets"'
```

## Recovery Commands

Local Docker Compose:

```bash
cd OpenSIS
docker compose restart opensis-ui
docker compose restart opensis-db
docker compose restart vault-agent-app vault-agent-db
docker compose ps
```

If the stack sequencing itself is broken, use the repo helper:

```bash
cd OpenSIS
./scripts/compose-stop.sh
./scripts/compose-start.sh
```

Use `--build-local` if the published UI image is unavailable or the machine needs a local build:

```bash
./scripts/compose-start.sh --build-local
```

Kubernetes:

```bash
kubectl rollout restart deployment/opensis-ui -n opensis-dev
kubectl rollout status deployment/opensis-ui -n opensis-dev
kubectl get pods -n opensis-dev
```

For production-style OpenSIS, prefer GitOps/Argo reconciliation over manual live edits.

## Kubernetes Readiness Notes

OpenSIS has Kubernetes, Kustomize, Vault, observability, and GitOps assets under `OpenSIS/k8s`.

When we move this workspace to Kubernetes, this operator model should map like this:

| Local Concept | Kubernetes Equivalent |
|---|---|
| `docker compose ps` | `kubectl get pods -n opensis-dev` or `kubectl get pods -n opensis` |
| `docker compose logs opensis-ui` | `kubectl logs deployment/opensis-ui -n opensis-dev` |
| `docker compose logs opensis-db` | `kubectl logs statefulset/opensis-db -n opensis-dev` |
| `http://localhost:8088` | ingress or port-forwarded OpenSIS service |
| local Vault container | Vault namespace/service and Vault Agent Injector |
| Compose Vault agents | Vault Agent injection/init behavior |
| Compose MariaDB volume | StatefulSet PVC |
| blackbox static target | Kubernetes blackbox exporter target or ServiceMonitor-style discovery |
| compose startup helper | Argo CD sync plus smoke checks |

The important rule is that the operator questions stay the same:

1. Is the app reachable?
2. Is the app healthy?
3. Are dependencies healthy?
4. Are metrics arriving?
5. Are logs arriving?
6. Are alerts firing correctly?

Only the command surface changes.

## Related OpenSIS Docs

Use these when you need deeper app-specific detail:

- `OpenSIS/README.md`
- `OpenSIS/docs/02-local-compose-guide.md`
- `OpenSIS/docs/04-operations-runbook.md`
- `OpenSIS/docs/05-troubleshooting-guide.md`
- `OpenSIS/docs/06-architecture-reference.md`
- `OpenSIS/TROUBLESHOOTING.md`
- `OpenSIS/SECURITY_NOTES.md`
