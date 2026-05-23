#!/usr/bin/env sh
set -eu

NAMESPACE="${NAMESPACE:-platform-observability-dev}"
POD_NAME="${POD_NAME:-observability-restore-verify}"
ALERTMANAGER_PVC="${ALERTMANAGER_PVC:-data-alertmanager-0}"
IMAGE="${IMAGE:-postgres:18-alpine}"
POSTGRES_SECRET="${POSTGRES_SECRET:-observability-postgres-app}"
PGHOST_VALUE="${PGHOST_VALUE:-observability-postgres-rw}"
PGPORT_VALUE="${PGPORT_VALUE:-5432}"

kubectl rollout status deployment/grafana -n "${NAMESPACE}" --timeout=300s >/dev/null
kubectl rollout status deployment/devops-monitor-ui -n "${NAMESPACE}" --timeout=300s >/dev/null
kubectl rollout status statefulset/alertmanager -n "${NAMESPACE}" --timeout=300s >/dev/null

if ! kubectl get pvc -n "${NAMESPACE}" "${ALERTMANAGER_PVC}" >/dev/null 2>&1; then
  echo "ERROR: PVC ${ALERTMANAGER_PVC} not found in namespace ${NAMESPACE}" >&2
  exit 1
fi

kubectl delete pod -n "${NAMESPACE}" "${POD_NAME}" --ignore-not-found >/dev/null 2>&1 || true
trap 'kubectl delete pod -n "${NAMESPACE}" "${POD_NAME}" --ignore-not-found >/dev/null 2>&1 || true' EXIT

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
    - name: verify
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
      command:
        - /bin/sh
        - -ec
        - |
          echo "Verifying PostgreSQL restore state"
          psql -h "\${PGHOST}" -p "\${PGPORT}" -U "\${PGUSER}" -d "\${PGDATABASE}" <<'SQL'
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename IN ('_prisma_migrations', 'notification_events', 'notification_settings', 'dashboard')
          ORDER BY tablename;

          SELECT COUNT(*) AS prisma_migration_rows FROM "_prisma_migrations";
          SELECT COUNT(*) AS notification_event_rows FROM notification_events;
          SELECT COUNT(*) AS notification_settings_rows FROM notification_settings;
          SELECT COUNT(*) AS grafana_dashboard_rows FROM dashboard;
SQL

          echo "Verifying Alertmanager data files"
          if ! find /alertmanager -mindepth 1 -print -quit >/dev/null 2>&1; then
            echo "ERROR: Alertmanager PVC is empty after restore verification" >&2
            exit 1
          fi
          find /alertmanager -maxdepth 2 -type f | sort
      volumeMounts:
        - name: alertmanager-data
          mountPath: /alertmanager
  volumes:
    - name: alertmanager-data
      persistentVolumeClaim:
        claimName: ${ALERTMANAGER_PVC}
EOF

for _ in $(seq 1 180); do
  phase="$(kubectl get pod -n "${NAMESPACE}" "${POD_NAME}" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
  if [ "${phase}" = "Succeeded" ] || [ "${phase}" = "Failed" ]; then
    break
  fi
  sleep 1
done

kubectl logs -n "${NAMESPACE}" "${POD_NAME}"
phase="$(kubectl get pod -n "${NAMESPACE}" "${POD_NAME}" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
if [ "${phase}" != "Succeeded" ]; then
  echo "ERROR: restore verification pod ended in phase ${phase:-Unknown}" >&2
  exit 1
fi
