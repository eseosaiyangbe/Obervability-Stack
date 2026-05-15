#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="platform-observability-dev"
POSTGRES_CLUSTER="observability-postgres"
DEPLOYMENTS=(
  alertmanager
  blackbox-exporter
  devops-monitor-ui
  grafana
)
STATEFULSETS=(
  loki
  prometheus
)
DAEMONSETS=(
  cadvisor
  node-exporter
  promtail
)
PAUSE_NODE_SELECTOR_KEY="idp.dev/observability-paused"
PAUSE_NODE_SELECTOR_VALUE="true"
ORIGINAL_NODE_SELECTOR_ANNOTATION="idp.dev/original-node-selector"

usage() {
  cat <<'EOF'
Usage: ./scripts/k8s-stop.sh [options]

Stop the observability-stack dev overlay from the current Kubernetes context.
This preserves the namespace and persistent data so the control plane can be
resumed cleanly with ./scripts/k8s-start.sh.

Options:
  --wait       Wait for scale-down and PostgreSQL hibernation completion
  -h, --help   Show this help message
EOF
}

WAIT_FOR_DELETE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
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

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $1" >&2
    exit 1
  fi
}

pause_daemonset_scheduling() {
  require_command jq

  for ds in "${DAEMONSETS[@]}"; do
    original_selector="$(kubectl get daemonset/"${ds}" -n "${NAMESPACE}" -o json | jq -c '.spec.template.spec.nodeSelector // {}')"
    kubectl annotate daemonset/"${ds}" -n "${NAMESPACE}" \
      "${ORIGINAL_NODE_SELECTOR_ANNOTATION}=${original_selector}" \
      --overwrite >/dev/null
    kubectl patch daemonset/"${ds}" -n "${NAMESPACE}" --type=merge \
      -p "{\"spec\":{\"template\":{\"spec\":{\"nodeSelector\":{\"${PAUSE_NODE_SELECTOR_KEY}\":\"${PAUSE_NODE_SELECTOR_VALUE}\"}}}}}" >/dev/null
  done
}

if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
  echo "[observability-k8s] Namespace ${NAMESPACE} does not exist; nothing to stop"
  exit 0
fi

echo "[observability-k8s] Scaling primary deployments down"
for deploy in "${DEPLOYMENTS[@]}"; do
  kubectl scale deployment/"${deploy}" -n "${NAMESPACE}" --replicas=0 >/dev/null 2>&1 || true
done

echo "[observability-k8s] Scaling stateful workloads down"
for sts in "${STATEFULSETS[@]}"; do
  kubectl scale statefulset/"${sts}" -n "${NAMESPACE}" --replicas=0 >/dev/null 2>&1 || true
done

echo "[observability-k8s] Pausing daemonset scheduling"
pause_daemonset_scheduling

echo "[observability-k8s] Hibernating CloudNativePG cluster"
kubectl annotate cluster.postgresql.cnpg.io/"${POSTGRES_CLUSTER}" \
  -n "${NAMESPACE}" \
  cnpg.io/hibernation=on \
  --overwrite

if [[ "${WAIT_FOR_DELETE}" -eq 1 ]]; then
  echo "[observability-k8s] Waiting for controller scale-down"
  deadline=$((SECONDS + 900))
  while true; do
    deployments_ok=1
    for deploy in "${DEPLOYMENTS[@]}"; do
      replicas="$(kubectl get deployment/"${deploy}" -n "${NAMESPACE}" -o jsonpath='{.status.replicas}' 2>/dev/null || true)"
      if [[ -n "${replicas}" && "${replicas}" != "0" ]]; then
        deployments_ok=0
        break
      fi
    done

    stateful_ok=1
    for sts in "${STATEFULSETS[@]}"; do
      replicas="$(kubectl get statefulset/"${sts}" -n "${NAMESPACE}" -o jsonpath='{.status.replicas}' 2>/dev/null || true)"
      ready_replicas="$(kubectl get statefulset/"${sts}" -n "${NAMESPACE}" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
      if [[ -n "${replicas}" && "${replicas}" != "0" ]]; then
        stateful_ok=0
        break
      fi
      if [[ -n "${ready_replicas}" && "${ready_replicas}" != "0" ]]; then
        stateful_ok=0
        break
      fi
    done

    daemonsets_ok=1
    for ds in "${DAEMONSETS[@]}"; do
      desired="$(kubectl get daemonset/"${ds}" -n "${NAMESPACE}" -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null || true)"
      current="$(kubectl get daemonset/"${ds}" -n "${NAMESPACE}" -o jsonpath='{.status.currentNumberScheduled}' 2>/dev/null || true)"
      ready="$(kubectl get daemonset/"${ds}" -n "${NAMESPACE}" -o jsonpath='{.status.numberReady}' 2>/dev/null || true)"
      if [[ -n "${desired}" && "${desired}" != "0" ]]; then
        daemonsets_ok=0
        break
      fi
      if [[ -n "${current}" && "${current}" != "0" ]]; then
        daemonsets_ok=0
        break
      fi
      if [[ -n "${ready}" && "${ready}" != "0" ]]; then
        daemonsets_ok=0
        break
      fi
    done

    hibernated="$(kubectl get cluster.postgresql.cnpg.io/"${POSTGRES_CLUSTER}" -n "${NAMESPACE}" -o jsonpath='{.status.conditions[?(@.type=="cnpg.io/hibernation")].status}' 2>/dev/null || true)"

    if [[ "${deployments_ok}" -eq 1 && "${stateful_ok}" -eq 1 && "${daemonsets_ok}" -eq 1 && "${hibernated}" == "True" ]]; then
      break
    fi

    if (( SECONDS >= deadline )); then
      echo "[observability-k8s] ERROR: Timed out waiting for observability control-plane scale-down" >&2
      kubectl get deploy,statefulset,daemonset,cluster.postgresql.cnpg.io,pods -n "${NAMESPACE}" >&2 || true
      exit 1
    fi
    sleep 5
  done
fi
