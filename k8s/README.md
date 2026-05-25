# Obervability-Stack Kubernetes Path

This directory is the owned Kubernetes path for the shared control plane.

It exists to move `Obervability-Stack` from Docker Compose into the same `k3s`-first migration model already proven for:

- `MemFlip`
- `SwiftPay`
- `FoodPulse`

The intent is not to translate Compose line by line.
The intent is to preserve the control-plane contract in a Kubernetes-native shape.

## Environment Model

- `overlays/dev`
  - local `k3s` validation path
  - Vault-backed secret delivery through External Secrets Operator
  - in-cluster PostgreSQL through CloudNativePG
  - local image for `devops-monitor-ui`
  - public control-plane host: `portfolio.eseosadevbox.com`
- `overlays/prod`
  - production contract
  - stricter hostnames and sizing
  - Vault remains the secret source of truth
  - ArgoCD is the intended reconciler
  - public control-plane host: `portfolio-prod.eseosadevbox.com`

## Scope

The control-plane Kubernetes scope includes:

- PostgreSQL for the UI
- Prometheus
- Alertmanager
- Grafana
- Loki
- Promtail
- node-exporter
- cAdvisor
- blackbox-exporter
- `devops-monitor-ui`

## Current Status

This directory is now the live owned control-plane path for the `k3s` `dev` slice.

What is already true:

- manifests are organized as `base` plus `dev` and `prod` overlays
- Vault-backed secret delivery is modeled for both environments
- ArgoCD application manifests exist for `dev` and `prod`
- the `dev` slice has been deployed live on local `k3s`
- PostgreSQL, Prometheus, Alertmanager, Grafana, Loki, Promtail, node-exporter, cAdvisor, blackbox-exporter, and `devops-monitor-ui` were verified in-cluster
- Prometheus now sees the cross-workload app metrics targets for `MemFlip`, `SwiftPay`, and `FoodPulse` as `up`
- Vault UI is exposed through Traefik at `http://vault.devops.local` so cluster secret operations can be tested from the same browser path as the app slices

What is still intentionally staged:

- `prod` remains a stricter contract, not a live local rollout claim
- `OpenSIS` continuity remains a later bridge concern because it still runs outside the cluster today

## Ingress Guardrail

`dev` and `prod` must not advertise the same public control-plane hostname.

Required rule:

- `platform-observability-dev` owns `portfolio.eseosadevbox.com`
- `platform-observability-prod` owns `portfolio-prod.eseosadevbox.com`

Why this is non-negotiable:

- if both namespaces publish `portfolio.eseosadevbox.com`, Traefik can route the same browser request to different control-plane backends
- that creates misleading auth results, stale UI behavior, and hard-to-reproduce incident symptoms
- the auth issue where `viewer@example.com` and `admin@example.com` looked broken while `demo@example.com` still succeeded was traced to exactly this host collision

## Operator Commands

From the `Obervability-Stack` repo root:

```bash
./scripts/k8s-start.sh
./scripts/k8s-stop.sh
./scripts/k8s-reset.sh --help
./scripts/k8s-dev-verify.sh
./scripts/k8s-backup-run.sh
./scripts/k8s-backup-inspect.sh
./scripts/k8s-backup-delete.sh --help
./scripts/k8s-restore-run.sh
./scripts/k8s-restore-verify.sh
```

What they mean:

- `k8s-start.sh`
  - deploys the control plane when `platform-observability-dev` does not exist yet
  - resumes preserved workloads when the namespace already exists
- `k8s-stop.sh`
  - safely pauses the control plane
  - scales deployments and StatefulSets down
  - hibernates the `observability-postgres` CloudNativePG cluster
  - unschedules the DaemonSets without deleting the namespace or PVCs
- `k8s-reset.sh`
  - destructive reset
  - deletes `platform-observability-dev` and all data in that namespace
- `k8s-backup-run.sh`
  - creates a one-off control-plane backup from the scheduled backup contract
- `k8s-backup-inspect.sh`
  - lists retained control-plane backup artifacts from the backup PVC
- `k8s-backup-delete.sh`
  - deletes all backups or prunes older backup artifacts while keeping the newest set
- `k8s-restore-run.sh`
  - restores PostgreSQL-backed control-plane data and Alertmanager persistent state
- `k8s-restore-verify.sh`
  - verifies restore readiness and restored state

Use `start` and `stop` for normal operations. Use `reset` only when you intentionally want a full rebuild of the observability control plane.

## Backup And Restore

The owned Kubernetes control plane now has an explicit backup and restore path.

Coverage:

- PostgreSQL-backed UI, notification, and Grafana metadata
- Alertmanager persistent state

Schedule standard:

- the control-plane backup CronJob runs daily at `03:00 UTC`
- the CronJob timezone is explicitly pinned to `Etc/UTC`

Primary reference:

- [K8S_BACKUP_RESTORE.md](/Users/raymond/Documents/DevOps-Easy-Learning/observability-stack/docs/K8S_BACKUP_RESTORE.md)

Fast operator checks:

```bash
kubectl get application observability-dev -n argocd -o wide
kubectl get cronjob,pvc,sa -n platform-observability-dev | rg 'observability-control-plane-backup|observability-backup-storage|observability-db-backup|NAME'
./scripts/k8s-backup-run.sh
./scripts/k8s-backup-inspect.sh
./scripts/k8s-backup-delete.sh --keep-latest
./scripts/k8s-restore-run.sh observability-postgres-YYYYMMDDTHHMMSSZ.dump alertmanager-YYYYMMDDTHHMMSSZ.tgz
./scripts/k8s-restore-verify.sh
```

For the full controlled restore-drill sequence, including temporary ArgoCD sync suspension and re-enable, use:

- [K8S_BACKUP_RESTORE.md](/Users/raymond/Documents/DevOps-Easy-Learning/observability-stack/docs/K8S_BACKUP_RESTORE.md)

## Browser Access

Once Traefik is healthy and your local `/etc/hosts` maps the ingress address, the main browser entrypoints are:

```bash
./scripts/setup-devops-local-hosts.sh
```

- `http://controlplane.devops.local`
- `http://grafana.devops.local`
- `http://vault.devops.local`
- `http://opensis.devops.local`

## Related Documents

- [CONTROL-PLANE-K8S-PLAN.md](/Users/raymond/Documents/DevOps-Easy-Learning/CONTROL-PLANE-K8S-PLAN.md)
- [KUBERNETES-MIGRATION-PLAN.md](/Users/raymond/Documents/DevOps-Easy-Learning/KUBERNETES-MIGRATION-PLAN.md)
- [README.md](/Users/raymond/Documents/DevOps-Easy-Learning/README.md)
