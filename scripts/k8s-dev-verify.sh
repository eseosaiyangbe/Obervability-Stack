#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="platform-observability-dev"
TRAEFIK_ADDR=""
PROMETHEUS_FORWARD_PID=""
PROMETHEUS_FORWARD_PORT="19093"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $1" >&2
    exit 1
  fi
}

require_command kubectl
require_command curl
require_command jq

cleanup() {
  if [[ -n "${PROMETHEUS_FORWARD_PID}" ]]; then
    kill "${PROMETHEUS_FORWARD_PID}" >/dev/null 2>&1 || true
    wait "${PROMETHEUS_FORWARD_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

TRAEFIK_ADDR="$(kubectl get ingress -n "${NAMESPACE}" devops-monitor-ui -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
if [[ -z "${TRAEFIK_ADDR}" ]]; then
  TRAEFIK_ADDR="$(kubectl get ingress -n "${NAMESPACE}" devops-monitor-ui -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
fi

if [[ -z "${TRAEFIK_ADDR}" ]]; then
  echo "ERROR: Could not determine control-plane ingress address." >&2
  exit 1
fi

echo "[observability-k8s] Namespace snapshot"
kubectl get pods,svc,ingress -n "${NAMESPACE}"

echo "[observability-k8s] External Secret readiness"
kubectl get externalsecret,secretstore -n "${NAMESPACE}"

echo "[observability-k8s] Waiting for core readiness"
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=alertmanager -n "${NAMESPACE}" --timeout=180s >/dev/null
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=blackbox-exporter -n "${NAMESPACE}" --timeout=180s >/dev/null
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=cadvisor -n "${NAMESPACE}" --timeout=180s >/dev/null
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=devops-monitor-ui -n "${NAMESPACE}" --timeout=180s >/dev/null
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=grafana -n "${NAMESPACE}" --timeout=180s >/dev/null
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=node-exporter -n "${NAMESPACE}" --timeout=180s >/dev/null
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=promtail -n "${NAMESPACE}" --timeout=180s >/dev/null
kubectl wait --for=condition=Ready pod/prometheus-0 -n "${NAMESPACE}" --timeout=180s >/dev/null
kubectl wait --for=condition=Ready pod/loki-0 -n "${NAMESPACE}" --timeout=180s >/dev/null
kubectl wait --for=condition=Ready pod/observability-postgres-1 -n "${NAMESPACE}" --timeout=180s >/dev/null
if kubectl get job/devops-monitor-db-init -n "${NAMESPACE}" >/dev/null 2>&1; then
  kubectl wait --for=condition=complete job/devops-monitor-db-init -n "${NAMESPACE}" --timeout=180s >/dev/null
else
  echo "[observability-k8s] Database init job already aged out after successful completion"
fi

echo "[observability-k8s] Render validation"
kubectl kustomize "${ROOT_DIR}/k8s/overlays/dev" >/dev/null
kubectl apply --dry-run=client -k "${ROOT_DIR}/k8s/overlays/dev" >/dev/null

echo "[observability-k8s] Verifying ingress endpoints"
curl -fsS -H "Host: controlplane.devops.local" "http://${TRAEFIK_ADDR}/" >/dev/null
curl -fsS -I -H "Host: grafana.devops.local" "http://${TRAEFIK_ADDR}/" >/dev/null

echo "[observability-k8s] Verifying Prometheus target health"
kubectl port-forward -n "${NAMESPACE}" svc/prometheus "${PROMETHEUS_FORWARD_PORT}:9090" >/tmp/observability-k8s-prometheus-port-forward.log 2>&1 &
PROMETHEUS_FORWARD_PID="$!"
for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:${PROMETHEUS_FORWARD_PORT}/-/healthy" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

target_report="$(curl -fsS "http://127.0.0.1:${PROMETHEUS_FORWARD_PORT}/api/v1/targets" \
  | jq -r '.data.activeTargets[] | select(.labels.job=="alertmanager" or .labels.job=="blackbox-exporter" or .labels.job=="cadvisor" or .labels.job=="foodpulse-api" or .labels.job=="grafana" or .labels.job=="loki" or .labels.job=="memflip-backend" or .labels.job=="node-exporter" or .labels.job=="prometheus" or .labels.job=="promtail" or .labels.job=="swiftpay-api-gateway" or .labels.job=="swiftpay-auth-service" or .labels.job=="swiftpay-notification-service" or .labels.job=="swiftpay-transaction-service" or .labels.job=="swiftpay-wallet-service") | [.labels.job, .health, (.lastError // "")] | @tsv')"
echo "${target_report}"

if echo "${target_report}" | awk -F '\t' '$2 != "up" { exit 1 }'; then
  :
else
  echo "ERROR: One or more critical Prometheus targets are not healthy." >&2
  exit 1
fi

echo "[observability-k8s] Verification completed"
