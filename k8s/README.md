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
- `overlays/prod`
  - production contract
  - stricter hostnames and sizing
  - Vault remains the secret source of truth
  - ArgoCD is the intended reconciler

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

This directory is the first owned control-plane scaffold.

What is already true:

- manifests are organized as `base` plus `dev` and `prod` overlays
- Vault-backed secret delivery is modeled for both environments
- ArgoCD application manifests exist for `dev` and `prod`
- operator scripts exist for local validation

What is still intentionally staged:

- this first pass prioritizes render-valid, reviewable manifests
- live cluster rollout and parity verification should happen as the next control-plane implementation step
- `OpenSIS` continuity remains a later bridge concern because it still runs outside the cluster today

## Operator Commands

From the `Obervability-Stack` repo root:

```bash
./scripts/k8s-dev-deploy.sh --skip-apply
./scripts/k8s-dev-verify.sh
./scripts/k8s-dev-destroy.sh
```

Use `--skip-apply` while reviewing manifest generation only.

## Related Documents

- [CONTROL-PLANE-K8S-PLAN.md](/Users/raymond/Documents/DevOps-Easy-Learning/CONTROL-PLANE-K8S-PLAN.md)
- [KUBERNETES-MIGRATION-PLAN.md](/Users/raymond/Documents/DevOps-Easy-Learning/KUBERNETES-MIGRATION-PLAN.md)
- [README.md](/Users/raymond/Documents/DevOps-Easy-Learning/README.md)
