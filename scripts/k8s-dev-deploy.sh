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
UI_IMAGE="devops-monitor-ui:dev"
DB_INIT_IMAGE="devops-monitor-db-init:dev"

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

import_image_to_k3s() {
  local image_ref="$1"

  if ! docker image inspect "${image_ref}" >/dev/null 2>&1; then
    echo "ERROR: Required local image not found: ${image_ref}" >&2
    exit 1
  fi

  if command -v colima >/dev/null 2>&1; then
    echo "[observability-k8s] Importing ${image_ref} into Colima k3s containerd"
    docker save "${image_ref}" | colima ssh -- sh -lc 'ctr -n k8s.io images import -' >/dev/null
    return 0
  fi

  if command -v k3s >/dev/null 2>&1; then
    echo "[observability-k8s] Importing ${image_ref} into local k3s containerd"
    docker save "${image_ref}" | sudo k3s ctr images import - >/dev/null
    return 0
  fi

  echo "ERROR: Unable to determine how to import ${image_ref} into the k3s runtime." >&2
  exit 1
}

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
  docker build -t "${UI_IMAGE}" ui-next
  echo "[observability-k8s] Building local database init image"
  docker build --target builder -t "${DB_INIT_IMAGE}" ui-next
fi

import_image_to_k3s "${UI_IMAGE}"
import_image_to_k3s "${DB_INIT_IMAGE}"

if [[ "${SKIP_APPLY}" -eq 1 ]]; then
  echo "[observability-k8s] Skipping apply by request"
  exit 0
fi

echo "[observability-k8s] Applying dev overlay"
kubectl delete job devops-monitor-db-init -n platform-observability-dev --ignore-not-found --wait=true >/dev/null 2>&1 || true
kubectl apply -k k8s/overlays/dev

echo "[observability-k8s] Restarting UI deployment to pick up the refreshed local image"
kubectl rollout restart deployment/devops-monitor-ui -n platform-observability-dev >/dev/null

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
