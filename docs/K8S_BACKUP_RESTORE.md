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
