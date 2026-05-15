#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="platform-observability-dev"
POSTGRES_CLUSTER="observability-postgres"
BUILD_IMAGES=0
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
Usage: ./scripts/k8s-start.sh [options] [-- <extra deploy args>]

Start the observability-stack dev overlay in the current Kubernetes context.

By default, this reuses existing local images. Use --build when you
intentionally want a fresh local image build.

Options:
  --build      Rebuild images before deploy
  -h, --help   Show this help message
EOF
}

extra_args=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      BUILD_IMAGES=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      extra_args+=("$@")
      break
      ;;
    *)
      extra_args+=("$1")
      shift
      ;;
  esac
done

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $1" >&2
    exit 1
  fi
}

restore_daemonset_node_selectors() {
  require_command jq

  for ds in "${DAEMONSETS[@]}"; do
    original_selector="$(kubectl get daemonset/"${ds}" -n "${NAMESPACE}" -o json \
      | jq -c --arg annotation "${ORIGINAL_NODE_SELECTOR_ANNOTATION}" '((.metadata.annotations[$annotation] // "{}") | fromjson)')"
    if [[ "${original_selector}" == "{}" ]]; then
      kubectl patch daemonset/"${ds}" -n "${NAMESPACE}" --type=json \
        -p='[{"op":"remove","path":"/spec/template/spec/nodeSelector"}]' >/dev/null 2>&1 || true
    else
      kubectl patch daemonset/"${ds}" -n "${NAMESPACE}" --type=merge \
        -p "{\"spec\":{\"template\":{\"spec\":{\"nodeSelector\":${original_selector}}}}}" >/dev/null
    fi
    kubectl annotate daemonset/"${ds}" -n "${NAMESPACE}" "${ORIGINAL_NODE_SELECTOR_ANNOTATION}-" >/dev/null 2>&1 || true
  done
}

wait_for_postgres_rehydration() {
  deadline=$((SECONDS + 600))
  while true; do
    desired_instances="$(kubectl get cluster.postgresql.cnpg.io/"${POSTGRES_CLUSTER}" -n "${NAMESPACE}" -o jsonpath='{.spec.instances}')"
    ready_instances="$(kubectl get cluster.postgresql.cnpg.io/"${POSTGRES_CLUSTER}" -n "${NAMESPACE}" -o jsonpath='{.status.readyInstances}')"
    hibernation_status="$(kubectl get cluster.postgresql.cnpg.io/"${POSTGRES_CLUSTER}" -n "${NAMESPACE}" -o jsonpath='{.status.conditions[?(@.type=="cnpg.io/hibernation")].status}')"
    if [[ -n "${ready_instances}" ]] && [[ "${ready_instances}" == "${desired_instances}" ]] && [[ "${hibernation_status}" != "True" ]]; then
      break
    fi
    if (( SECONDS >= deadline )); then
      echo "[observability-k8s] ERROR: Timed out waiting for PostgreSQL rehydration" >&2
      kubectl get cluster.postgresql.cnpg.io/"${POSTGRES_CLUSTER}" -n "${NAMESPACE}" -o wide >&2 || true
      exit 1
    fi
    sleep 5
  done
}

resume_existing_namespace() {
  echo "[observability-k8s] Existing ${NAMESPACE} namespace detected; resuming preserved workloads"

  echo "[observability-k8s] Rehydrating CloudNativePG cluster"
  kubectl annotate cluster.postgresql.cnpg.io/"${POSTGRES_CLUSTER}" \
    -n "${NAMESPACE}" \
    cnpg.io/hibernation- \
    --overwrite >/dev/null 2>&1 || true
  kubectl annotate cluster.postgresql.cnpg.io/"${POSTGRES_CLUSTER}" \
    -n "${NAMESPACE}" \
    cnpg.io/hibernation=off \
    --overwrite

  echo "[observability-k8s] Scaling stateful workloads back up"
  for sts in "${STATEFULSETS[@]}"; do
    kubectl scale statefulset/"${sts}" -n "${NAMESPACE}" --replicas=1
  done

  echo "[observability-k8s] Restoring daemonset scheduling"
  restore_daemonset_node_selectors

  echo "[observability-k8s] Waiting for PostgreSQL rehydration"
  wait_for_postgres_rehydration

  echo "[observability-k8s] Waiting for stateful workload readiness"
  for sts in "${STATEFULSETS[@]}"; do
    kubectl rollout status statefulset/"${sts}" -n "${NAMESPACE}" --timeout=300s
  done

  echo "[observability-k8s] Waiting for daemonset rollouts"
  for ds in "${DAEMONSETS[@]}"; do
    kubectl rollout status daemonset/"${ds}" -n "${NAMESPACE}" --timeout=300s
  done

  echo "[observability-k8s] Scaling primary deployments back up"
  for deploy in "${DEPLOYMENTS[@]}"; do
    kubectl scale deployment/"${deploy}" -n "${NAMESPACE}" --replicas=1
  done

  echo "[observability-k8s] Waiting for deployment rollouts"
  for deploy in "${DEPLOYMENTS[@]}"; do
    kubectl rollout status deployment/"${deploy}" -n "${NAMESPACE}" --timeout=300s
  done
}

cmd=("${ROOT_DIR}/scripts/k8s-dev-deploy.sh")
if [[ "${BUILD_IMAGES}" -eq 0 ]]; then
  cmd+=(--skip-build)
fi
if [[ "${#extra_args[@]}" -gt 0 ]]; then
  cmd+=("${extra_args[@]}")
fi

if [[ "${BUILD_IMAGES}" -eq 0 ]] \
  && kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 \
  && kubectl get cluster.postgresql.cnpg.io/"${POSTGRES_CLUSTER}" -n "${NAMESPACE}" >/dev/null 2>&1; then
  resume_existing_namespace
  exit 0
fi

exec "${cmd[@]}"
