#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="platform-observability-dev"
AUTO_APPROVE=0
WAIT_FOR_DELETE=0

usage() {
  cat <<'EOF'
Usage: ./scripts/k8s-reset.sh [options]

Destructively reset the observability-stack dev namespace. This removes the
namespace, Prometheus/Loki PVCs, PostgreSQL PVCs, and all in-cluster control-plane state.

Options:
  --yes        Skip the interactive confirmation prompt
  --wait       Wait for namespace deletion before returning
  -h, --help   Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      AUTO_APPROVE=1
      shift
      ;;
    --wait)
      WAIT_FOR_DELETE=1
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

if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
  echo "[observability-k8s] Namespace ${NAMESPACE} does not exist; nothing to reset"
  exit 0
fi

echo "[observability-k8s] WARNING: This will permanently delete:"
echo "  - namespace ${NAMESPACE}"
echo "  - Prometheus, Loki, and PostgreSQL PVC-backed state"
echo "  - all in-cluster observability control-plane data"

if [[ "${AUTO_APPROVE}" -eq 0 ]]; then
  printf 'Type RESET to continue: '
  read -r confirmation
  if [[ "${confirmation}" != "RESET" ]]; then
    echo "[observability-k8s] Reset cancelled"
    exit 1
  fi
fi

echo "[observability-k8s] Deleting namespace ${NAMESPACE}"
if [[ "${WAIT_FOR_DELETE}" -eq 1 ]]; then
  kubectl delete namespace "${NAMESPACE}" --wait=true
else
  kubectl delete namespace "${NAMESPACE}" --wait=false
fi
