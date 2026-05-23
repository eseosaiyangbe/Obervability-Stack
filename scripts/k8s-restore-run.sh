#!/usr/bin/env sh
set -eu

NAMESPACE="${NAMESPACE:-platform-observability-dev}"
POD_NAME="${POD_NAME:-observability-control-plane-restore}"
BACKUP_PVC="${BACKUP_PVC:-observability-backup-storage}"
ALERTMANAGER_PVC="${ALERTMANAGER_PVC:-data-alertmanager-0}"
IMAGE="${IMAGE:-postgres:18-alpine}"
POSTGRES_SECRET="${POSTGRES_SECRET:-observability-postgres-app}"
PGHOST_VALUE="${PGHOST_VALUE:-observability-postgres-rw}"
PGPORT_VALUE="${PGPORT_VALUE:-5432}"
GRAFANA_DEPLOYMENT="${GRAFANA_DEPLOYMENT:-grafana}"
UI_DEPLOYMENT="${UI_DEPLOYMENT:-devops-monitor-ui}"
ALERTMANAGER_STATEFULSET="${ALERTMANAGER_STATEFULSET:-alertmanager}"
POSTGRES_BACKUP_FILE="${1:-}"
ALERTMANAGER_BACKUP_FILE="${2:-}"

if ! kubectl get pvc -n "${NAMESPACE}" "${BACKUP_PVC}" >/dev/null 2>&1; then
  echo "ERROR: PVC ${BACKUP_PVC} not found in namespace ${NAMESPACE}" >&2
  exit 1
fi

if ! kubectl get pvc -n "${NAMESPACE}" "${ALERTMANAGER_PVC}" >/dev/null 2>&1; then
  echo "ERROR: PVC ${ALERTMANAGER_PVC} not found in namespace ${NAMESPACE}" >&2
  exit 1
fi

grafana_replicas="$(kubectl get deployment -n "${NAMESPACE}" "${GRAFANA_DEPLOYMENT}" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 0)"
ui_replicas="$(kubectl get deployment -n "${NAMESPACE}" "${UI_DEPLOYMENT}" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 0)"
alertmanager_replicas="$(kubectl get statefulset -n "${NAMESPACE}" "${ALERTMANAGER_STATEFULSET}" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 0)"

wait_for_zero_pods() {
  namespace="$1"
  selector="$2"
  for _ in $(seq 1 180); do
    count="$(kubectl get pods -n "${namespace}" -l "${selector}" --no-headers 2>/dev/null | wc -l | tr -d ' ')"
    if [ "${count}" = "0" ]; then
      return 0
    fi
    sleep 1
  done
  echo "ERROR: Timed out waiting for pods with selector ${selector} to terminate" >&2
  return 1
}

restore_workloads() {
  kubectl scale deployment -n "${NAMESPACE}" "${GRAFANA_DEPLOYMENT}" --replicas="${grafana_replicas}" >/dev/null 2>&1 || true
  kubectl scale deployment -n "${NAMESPACE}" "${UI_DEPLOYMENT}" --replicas="${ui_replicas}" >/dev/null 2>&1 || true
  kubectl scale statefulset -n "${NAMESPACE}" "${ALERTMANAGER_STATEFULSET}" --replicas="${alertmanager_replicas}" >/dev/null 2>&1 || true

  if [ "${grafana_replicas}" -gt 0 ] 2>/dev/null; then
    kubectl rollout status deployment/"${GRAFANA_DEPLOYMENT}" -n "${NAMESPACE}" --timeout=300s >/dev/null 2>&1 || true
  fi
  if [ "${ui_replicas}" -gt 0 ] 2>/dev/null; then
    kubectl rollout status deployment/"${UI_DEPLOYMENT}" -n "${NAMESPACE}" --timeout=300s >/dev/null 2>&1 || true
  fi
  if [ "${alertmanager_replicas}" -gt 0 ] 2>/dev/null; then
    kubectl rollout status statefulset/"${ALERTMANAGER_STATEFULSET}" -n "${NAMESPACE}" --timeout=300s >/dev/null 2>&1 || true
  fi
}

trap 'restore_workloads; kubectl delete pod -n "${NAMESPACE}" "${POD_NAME}" --ignore-not-found >/dev/null 2>&1 || true' EXIT

kubectl scale deployment -n "${NAMESPACE}" "${GRAFANA_DEPLOYMENT}" --replicas=0 >/dev/null
kubectl scale deployment -n "${NAMESPACE}" "${UI_DEPLOYMENT}" --replicas=0 >/dev/null
kubectl scale statefulset -n "${NAMESPACE}" "${ALERTMANAGER_STATEFULSET}" --replicas=0 >/dev/null

wait_for_zero_pods "${NAMESPACE}" "app.kubernetes.io/name=grafana"
wait_for_zero_pods "${NAMESPACE}" "app.kubernetes.io/name=devops-monitor-ui"
wait_for_zero_pods "${NAMESPACE}" "app.kubernetes.io/name=alertmanager"

kubectl delete pod -n "${NAMESPACE}" "${POD_NAME}" --ignore-not-found >/dev/null 2>&1 || true

cat <<EOF | kubectl apply -f - >/dev/null
apiVersion: v1
kind: Pod
metadata:
  name: ${POD_NAME}
  namespace: ${NAMESPACE}
spec:
  serviceAccountName: observability-db-backup
  restartPolicy: Never
  containers:
    - name: restore
      image: ${IMAGE}
      imagePullPolicy: IfNotPresent
      env:
        - name: PGHOST
          value: ${PGHOST_VALUE}
        - name: PGPORT
          value: "${PGPORT_VALUE}"
        - name: PGUSER
          valueFrom:
            secretKeyRef:
              name: ${POSTGRES_SECRET}
              key: username
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: ${POSTGRES_SECRET}
              key: password
        - name: PGDATABASE
          valueFrom:
            secretKeyRef:
              name: ${POSTGRES_SECRET}
              key: database
        - name: POSTGRES_BACKUP_FILE
          value: "${POSTGRES_BACKUP_FILE}"
        - name: ALERTMANAGER_BACKUP_FILE
          value: "${ALERTMANAGER_BACKUP_FILE}"
      command:
        - /bin/sh
        - -ec
        - |
          postgres_backup="\${POSTGRES_BACKUP_FILE}"
          alertmanager_backup="\${ALERTMANAGER_BACKUP_FILE}"

          if [ -z "\${postgres_backup}" ]; then
            postgres_backup="\$(find /backup -maxdepth 1 -type f -name 'observability-postgres-*.dump' -size +0c 2>/dev/null | sort | tail -n 1)"
          elif [ "\${postgres_backup#/}" = "\${postgres_backup}" ]; then
            postgres_backup="/backup/\${postgres_backup}"
          fi

          if [ -z "\${alertmanager_backup}" ]; then
            alertmanager_backup="\$(find /backup -maxdepth 1 -type f -name 'alertmanager-*.tgz' -size +0c 2>/dev/null | sort | tail -n 1)"
          elif [ "\${alertmanager_backup#/}" = "\${alertmanager_backup}" ]; then
            alertmanager_backup="/backup/\${alertmanager_backup}"
          fi

          if [ -z "\${postgres_backup}" ] || [ ! -f "\${postgres_backup}" ]; then
            echo "ERROR: PostgreSQL backup file not found: \${postgres_backup:-<none>}" >&2
            exit 1
          fi

          if [ -z "\${alertmanager_backup}" ] || [ ! -f "\${alertmanager_backup}" ]; then
            echo "ERROR: Alertmanager backup file not found: \${alertmanager_backup:-<none>}" >&2
            exit 1
          fi

          echo "Waiting for PostgreSQL at \${PGHOST}:\${PGPORT}"
          for _ in \$(seq 1 60); do
            if pg_isready -h "\${PGHOST}" -p "\${PGPORT}" -U "\${PGUSER}" -d "\${PGDATABASE}" >/dev/null 2>&1; then
              break
            fi
            sleep 2
          done

          pg_restore \
            --host="\${PGHOST}" \
            --port="\${PGPORT}" \
            --username="\${PGUSER}" \
            --dbname="\${PGDATABASE}" \
            --clean \
            --if-exists \
            --no-owner \
            --no-privileges \
            --exit-on-error \
            "\${postgres_backup}"

          rm -rf /alertmanager/* /alertmanager/.[!.]* /alertmanager/..?* 2>/dev/null || true
          tar -xzf "\${alertmanager_backup}" -C /alertmanager

          echo "Restore completed from \${postgres_backup} and \${alertmanager_backup}"
      volumeMounts:
        - name: backup-storage
          mountPath: /backup
        - name: alertmanager-data
          mountPath: /alertmanager
  volumes:
    - name: backup-storage
      persistentVolumeClaim:
        claimName: ${BACKUP_PVC}
    - name: alertmanager-data
      persistentVolumeClaim:
        claimName: ${ALERTMANAGER_PVC}
EOF

for _ in $(seq 1 600); do
  phase="$(kubectl get pod -n "${NAMESPACE}" "${POD_NAME}" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
  if [ "${phase}" = "Succeeded" ] || [ "${phase}" = "Failed" ]; then
    break
  fi
  sleep 1
done

kubectl logs -n "${NAMESPACE}" "${POD_NAME}"
phase="$(kubectl get pod -n "${NAMESPACE}" "${POD_NAME}" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
if [ "${phase}" != "Succeeded" ]; then
  echo "ERROR: restore pod ended in phase ${phase:-Unknown}" >&2
  exit 1
fi
