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

- daily backup run at `0 3 * * *`
- keep the most recent `7` backup sets

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

Validated artifact examples:

- `observability-postgres-20260523T082940Z.dump`
- `alertmanager-20260523T082940Z.tgz`

Useful proof commands:

```bash
kubectl get application observability-dev -n argocd -o wide
kubectl get cronjob,pvc,sa -n platform-observability-dev | rg 'observability-control-plane-backup|observability-backup-storage|observability-db-backup|NAME'
./scripts/k8s-backup-run.sh
./scripts/k8s-backup-inspect.sh
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
