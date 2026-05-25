# Kubernetes Backup And Restore

This document defines the owned backup and restore contract for the Kubernetes control plane in `observability-stack`.

## Scope

The Kubernetes backup and restore contract currently covers:

- PostgreSQL-backed control-plane application data
  - UI data
  - notification history
  - notification settings
  - Grafana metadata stored in PostgreSQL
- Alertmanager persistent state
  - silences
  - notification log state stored on the Alertmanager PVC

The contract does not treat every state surface the same way:

- Promtail positions are node-local continuity data, not shared restore state
- Prometheus and Loki remain separate retention concerns and are not part of this first restore contract

## Storage Model

Backups are stored on:

- PVC: `observability-backup-storage`

Scheduled control-plane backups are produced by:

- CronJob: `observability-control-plane-backup`

Default scheduled behavior:

- daily backup run at `0 3 * * *` in `Etc/UTC`
- keep the most recent `7` backup sets

Timezone policy:

- the control-plane backup CronJob is pinned to `Etc/UTC`
- backup filenames are written in UTC
- operator-facing local time conversions should be treated as secondary documentation only

Each backup set includes:

- `observability-postgres-<timestamp>.dump`
- `alertmanager-<timestamp>.tgz`

## Operator Commands

Run from the `observability-stack` repo root.

Create a one-off backup:

```bash
./scripts/k8s-backup-run.sh
```

Inspect stored backups:

```bash
./scripts/k8s-backup-inspect.sh
```

Delete all stored backups:

```bash
./scripts/k8s-backup-delete.sh --all
```

Delete older backups but keep the newest PostgreSQL dump and newest Alertmanager archive:

```bash
./scripts/k8s-backup-delete.sh --keep-latest
```

Restore the latest backup set:

```bash
./scripts/k8s-restore-run.sh
```

Restore a specific backup set:

```bash
./scripts/k8s-restore-run.sh observability-postgres-YYYYMMDDTHHMMSSZ.dump alertmanager-YYYYMMDDTHHMMSSZ.tgz
```

Verify restore state:

```bash
./scripts/k8s-restore-verify.sh
```

## End-To-End Restore Drill

This is the recommended end-to-end operator sequence for a controlled restore drill on the GitOps-managed `dev` control plane.

Run from the `observability-stack` repo root unless the command explicitly starts with `kubectl`.

### 1. Confirm The Target App Is Stable

```bash
kubectl get application internal-developer-platform-dev-root observability-dev -n argocd -o wide
kubectl get pods -n platform-observability-dev
```

Expected baseline:

- `internal-developer-platform-dev-root` is `Synced Healthy`
- `observability-dev` is `Synced Healthy`
- main control-plane workloads are `Running`

### 2. Confirm The Backup Set Exists

```bash
./scripts/k8s-backup-inspect.sh
```

Example validated backup set from the live drill:

- `observability-postgres-20260523T210236Z.dump`
- `alertmanager-20260523T210236Z.tgz`

### 3. Suspend Automated Sync Temporarily

This step is required for a real restore drill on the GitOps-managed control plane.

Why:

- patching `selfHeal=false` on the child application alone is not sufficient
- the root ArgoCD application can reapply the child `Application` and restore automation during the drill
- for a clean restore window, suspend automated sync on both the root app and the child app

```bash
kubectl patch application internal-developer-platform-dev-root -n argocd --type json -p='[{"op":"remove","path":"/spec/syncPolicy/automated"}]'
kubectl patch application observability-dev -n argocd --type json -p='[{"op":"remove","path":"/spec/syncPolicy/automated"}]'
kubectl get application internal-developer-platform-dev-root observability-dev -n argocd -o yaml | rg -n "syncPolicy|automated|selfHeal|prune" -A3 -B2
```

### 4. Run The Restore

Restore the named backup set:

```bash
./scripts/k8s-restore-run.sh observability-postgres-20260523T210236Z.dump alertmanager-20260523T210236Z.tgz
```

What this should do:

- scale down `grafana`
- scale down `devops-monitor-ui`
- scale down `alertmanager`
- restore PostgreSQL data from the selected dump
- restore Alertmanager state from the selected archive
- scale the workloads back up

### 5. Verify The Restored State

```bash
./scripts/k8s-restore-verify.sh
```

Expected verification signals:

- `_prisma_migrations` exists
- `notification_events` exists
- `notification_settings` exists
- Grafana metadata is queryable
- Alertmanager PVC contains restored data files

### 6. Re-Enable GitOps Automation

```bash
kubectl patch application internal-developer-platform-dev-root -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
kubectl patch application observability-dev -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true},"syncOptions":["CreateNamespace=true"]}}}'
kubectl annotate application observability-dev -n argocd argocd.argoproj.io/refresh=hard --overwrite
kubectl get application internal-developer-platform-dev-root observability-dev -n argocd -o wide
```

Expected end state:

- `internal-developer-platform-dev-root` returns to `Synced Healthy`
- `observability-dev` returns to `Synced Healthy`

### 7. Final Runtime Check

```bash
kubectl get pods -n platform-observability-dev
kubectl get events -n platform-observability-dev --sort-by=.lastTimestamp | tail -n 30
```

The drill is complete only when:

- restore verification passed
- GitOps automation is restored
- ArgoCD shows the control-plane app as `Synced Healthy`
- the main control-plane workloads are back in `Running`

For a controlled restore drill on the GitOps-managed dev control plane, suspend automated sync temporarily before scaling workloads down:

```bash
kubectl patch application internal-developer-platform-dev-root -n argocd --type json -p='[{"op":"remove","path":"/spec/syncPolicy/automated"}]'
kubectl patch application observability-dev -n argocd --type json -p='[{"op":"remove","path":"/spec/syncPolicy/automated"}]'
./scripts/k8s-restore-run.sh observability-postgres-YYYYMMDDTHHMMSSZ.dump alertmanager-YYYYMMDDTHHMMSSZ.tgz
./scripts/k8s-restore-verify.sh
kubectl patch application internal-developer-platform-dev-root -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
kubectl patch application observability-dev -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true},"syncOptions":["CreateNamespace=true"]}}}'
kubectl annotate application observability-dev -n argocd argocd.argoproj.io/refresh=hard --overwrite
```

## Useful Live Commands

Check ArgoCD state for the control-plane app:

```bash
kubectl get application observability-dev -n argocd -o wide
```

Check backup resources directly:

```bash
kubectl get cronjob,pvc,sa -n platform-observability-dev | rg 'observability-control-plane-backup|observability-backup-storage|observability-db-backup|NAME'
```

Check the backup CronJob runtime image:

```bash
kubectl get cronjob observability-control-plane-backup -n platform-observability-dev -o jsonpath='{.spec.jobTemplate.spec.template.spec.containers[0].image}{"\n"}'
```

Run a one-off backup and stream the job logs:

```bash
./scripts/k8s-backup-run.sh
```

Inspect retained backup artifacts:

```bash
./scripts/k8s-backup-inspect.sh
```

Delete backup artifacts:

```bash
./scripts/k8s-backup-delete.sh --all
./scripts/k8s-backup-delete.sh --keep-latest
```

Check recent control-plane events:

```bash
kubectl get events -n platform-observability-dev --sort-by=.lastTimestamp | tail -n 30
```

## Restore Behavior

The restore path is intentionally sequenced.

Before restore:

- scale `grafana` to `0`
- scale `devops-monitor-ui` to `0`
- scale `alertmanager` to `0`

During restore:

- restore PostgreSQL data from the selected `.dump`
- restore Alertmanager state from the selected `.tgz`

After restore:

- scale `grafana` back to its prior replica count
- scale `devops-monitor-ui` back to its prior replica count
- scale `alertmanager` back to its prior replica count
- wait for these workloads to become ready again

This sequencing is deliberate.
Restore should not compete with active writers if we want an honest operator story.

## Verification Standard

A restore is not complete because the restore pod succeeded.

A restore is complete only when:

- PostgreSQL content is queryable again
- Prisma migration metadata exists
- notification tables exist
- Grafana dashboard metadata exists
- Alertmanager data files exist on the restored PVC
- `grafana`, `devops-monitor-ui`, and `alertmanager` are ready again

Use:

```bash
./scripts/k8s-restore-verify.sh
```

## Live Validation Completed

This backup and restore slice was validated live on `2026-05-23`.

What was proven:

- ArgoCD reconciled the new backup contract into `observability-dev`
- the backup PVC `observability-backup-storage` was created and bound
- the service account `observability-db-backup` was created
- the CronJob `observability-control-plane-backup` was created
- a manual backup job completed successfully
- backup artifacts were written to the PVC
- a controlled restore drill completed successfully against the GitOps-managed `dev` control plane
- restored PostgreSQL state was queryable again
- restored Alertmanager PVC state was present again
- ArgoCD automation was restored after the drill and the app returned to `Synced Healthy`

Validated artifact examples:

- `observability-postgres-20260523T082940Z.dump`
- `alertmanager-20260523T082940Z.tgz`

Useful proof commands:

```bash
kubectl get application observability-dev -n argocd -o wide
kubectl get cronjob,pvc,sa -n platform-observability-dev | rg 'observability-control-plane-backup|observability-backup-storage|observability-db-backup|NAME'
./scripts/k8s-backup-run.sh
./scripts/k8s-backup-inspect.sh
./scripts/k8s-restore-run.sh observability-postgres-20260523T210236Z.dump alertmanager-20260523T210236Z.tgz
./scripts/k8s-restore-verify.sh
```

## Failure We Hit And Fixed

The first backup run failed for a real operational reason:

- the backup container used `postgres:16-alpine`
- the live CloudNativePG server was PostgreSQL `18.3`
- `pg_dump` aborted on server version mismatch

Observed error:

```text
pg_dump: error: aborting because of server version mismatch
pg_dump: detail: server version: 18.3 ...; pg_dump version: 16.13
```

Fix applied:

- backup and restore tooling was aligned to `postgres:18-alpine`

Additional hardening applied:

- backup artifacts are now written to temporary files first and moved into place only on success
- restore selection ignores zero-byte backup artifacts

This matters because a failed backup run should never leave partial files that look restoreable.

## Pre-Restore Sanity Checks

Before you run a restore, do these checks:

1. confirm the app is currently `Synced` and `Healthy`

```bash
kubectl get application observability-dev -n argocd -o wide
```

2. confirm the backup files you plan to use exist and are non-zero

```bash
./scripts/k8s-backup-inspect.sh
```

3. confirm the control-plane workloads are currently stable enough to scale down safely

```bash
kubectl get pods -n platform-observability-dev
```

4. if you are targeting a named backup set, record the exact filenames first

```bash
./scripts/k8s-restore-run.sh observability-postgres-YYYYMMDDTHHMMSSZ.dump alertmanager-YYYYMMDDTHHMMSSZ.tgz
```

5. for a restore drill on a GitOps-managed child application, suspend automated sync on both the root app and the child app first or ArgoCD will immediately scale the control-plane workloads back up during the restore window

```bash
kubectl patch application internal-developer-platform-dev-root -n argocd --type json -p='[{"op":"remove","path":"/spec/syncPolicy/automated"}]'
kubectl patch application observability-dev -n argocd --type json -p='[{"op":"remove","path":"/spec/syncPolicy/automated"}]'
```

6. after the drill, restore automated sync and force a hard refresh on the child app

```bash
kubectl patch application internal-developer-platform-dev-root -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
kubectl patch application observability-dev -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true},"syncOptions":["CreateNamespace=true"]}}}'
kubectl annotate application observability-dev -n argocd argocd.argoproj.io/refresh=hard --overwrite
kubectl get application observability-dev -n argocd -o wide
```

## Relationship To Phase 8

This is the first concrete implementation of the Phase 8 backup and restore standard for the owned platform.

The intended sequence remains:

1. `OpenSIS` reference pattern already exists
2. `observability-stack` control-plane contract
3. `SwiftPay`
4. `FoodPulse`
5. `MemFlip`

## Image Rebuild Note

No custom image rebuild is required for this backup and restore slice.

This implementation uses:

- Kubernetes manifests
- repo-local operator scripts
- stock `postgres:18-alpine` and `busybox:1.36` runtime images
