#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="platform-observability-dev"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $1" >&2
    exit 1
  fi
}

require_command kubectl
require_command curl

echo "[observability-k8s] Namespace snapshot"
kubectl get pods,svc,ingress -n "${NAMESPACE}"

echo "[observability-k8s] External Secret readiness"
kubectl get externalsecret,secretstore -n "${NAMESPACE}"

echo "[observability-k8s] Render validation"
kubectl kustomize "${ROOT_DIR}/k8s/overlays/dev" >/dev/null
kubectl apply --dry-run=client -k "${ROOT_DIR}/k8s/overlays/dev" >/dev/null

echo "[observability-k8s] Verification completed"
