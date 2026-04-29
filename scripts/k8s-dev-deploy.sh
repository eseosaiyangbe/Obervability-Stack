#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/k8s-dev-deploy.sh [options]

Validate and optionally apply the Obervability-Stack k3s dev overlay.

Options:
  --skip-runtime           Skip local k3s runtime bootstrap
  --skip-secrets-platform  Skip shared Vault and External Secrets bootstrap
  --skip-build             Reuse existing local devops-monitor-ui image
  --skip-apply             Validate only; do not apply manifests
  -h, --help               Show this help message
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="$(cd "${ROOT_DIR}/.." && pwd)"
SKIP_RUNTIME=0
SKIP_SECRETS_PLATFORM=0
SKIP_BUILD=0
SKIP_APPLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-runtime)
      SKIP_RUNTIME=1
      shift
      ;;
    --skip-secrets-platform)
      SKIP_SECRETS_PLATFORM=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --skip-apply)
      SKIP_APPLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

cd "${ROOT_DIR}"

if [[ "${SKIP_RUNTIME}" -eq 0 ]]; then
  "${WORKSPACE_ROOT}/scripts/ensure-k3s-runtime.sh" >/dev/null
fi

if [[ "${SKIP_SECRETS_PLATFORM}" -eq 0 ]]; then
  "${WORKSPACE_ROOT}/scripts/bootstrap-k3s-vault-secrets.sh" >/dev/null
fi

echo "[observability-k8s] Validating kustomize overlays"
kubectl kustomize k8s/overlays/dev >/dev/null
kubectl apply --dry-run=client -k k8s/overlays/dev >/dev/null

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
  echo "[observability-k8s] Building local UI image"
  docker build -t devops-monitor-ui:dev ui-next
fi

if [[ "${SKIP_APPLY}" -eq 1 ]]; then
  echo "[observability-k8s] Skipping apply by request"
  exit 0
fi

echo "[observability-k8s] Applying dev overlay"
kubectl apply -k k8s/overlays/dev

echo "[observability-k8s] Waiting for PostgreSQL cluster"
kubectl wait --for=condition=Ready cluster/observability-postgres -n platform-observability-dev --timeout=420s

echo "[observability-k8s] Waiting for External Secrets readiness"
kubectl wait --for=condition=Ready externalsecret/observability-postgres-app-external -n platform-observability-dev --timeout=180s
kubectl wait --for=condition=Ready externalsecret/observability-ui-secrets-external -n platform-observability-dev --timeout=180s
kubectl wait --for=condition=Ready externalsecret/observability-grafana-admin-external -n platform-observability-dev --timeout=180s

echo "[observability-k8s] Running database init job"
kubectl wait --for=condition=complete job/devops-monitor-db-init -n platform-observability-dev --timeout=300s

echo "[observability-k8s] Waiting for primary workloads"
kubectl rollout status statefulset/prometheus -n platform-observability-dev --timeout=300s
kubectl rollout status statefulset/loki -n platform-observability-dev --timeout=300s
kubectl rollout status deployment/alertmanager -n platform-observability-dev --timeout=300s
kubectl rollout status deployment/grafana -n platform-observability-dev --timeout=300s
kubectl rollout status deployment/blackbox-exporter -n platform-observability-dev --timeout=300s
kubectl rollout status deployment/devops-monitor-ui -n platform-observability-dev --timeout=300s

echo "[observability-k8s] Running verification"
"${ROOT_DIR}/scripts/k8s-dev-verify.sh"
