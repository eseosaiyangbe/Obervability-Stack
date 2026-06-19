# Alert Runbook Index

## Purpose

This document is the shared runbook landing page for Prometheus and Alertmanager alerts in the observability stack.

Use it when an alert fires and the alert does not already point to a more specific app operator runbook.

## First Response Standard

Start with the shared operator workflow:

- [OPERATOR_HEALTH_WORKFLOW.md](./OPERATOR_HEALTH_WORKFLOW.md)

Then move to the most relevant deeper guide for the alert class:

- Platform and service-health checks:
  - [SERVICE_HEALTH_GUIDE.md](./SERVICE_HEALTH_GUIDE.md)
- Incident drill patterns and controlled-failure references:
  - [INCIDENT_DRILLS.md](./INCIDENT_DRILLS.md)
- App ownership and operator entrypoints:
  - [OPERATOR_APP_MATRIX.md](./OPERATOR_APP_MATRIX.md)

## Alert Routing Guidance

Use these mappings when triaging alerts from Alertmanager:

- Host, node, container, and Prometheus alerts:
  - Start with [OPERATOR_HEALTH_WORKFLOW.md](./OPERATOR_HEALTH_WORKFLOW.md)
- Generic application availability, HTTP error-rate, and latency alerts:
  - Start with [SERVICE_HEALTH_GUIDE.md](./SERVICE_HEALTH_GUIDE.md)
- `SwiftPay` workload alerts:
  - Use [SWIFTPAY_OPERATOR_RUNBOOK.md](./SWIFTPAY_OPERATOR_RUNBOOK.md)
- `OpenSIS` workload alerts:
  - Use [OPENSIS_OPERATOR_RUNBOOK.md](./OPENSIS_OPERATOR_RUNBOOK.md)
- `FoodPulse` workload alerts:
  - Use [FOODPULSE_OPERATOR_RUNBOOK.md](./FOODPULSE_OPERATOR_RUNBOOK.md)
- `MemFlip` workload alerts:
  - Use [MEMFLIP_OPERATOR_RUNBOOK.md](./MEMFLIP_OPERATOR_RUNBOOK.md)

## Operator Intent

Alerts should never send operators to placeholder documentation.

If a new alert is added and does not have a workload-specific runbook yet, point it here first and then tighten it later to the most specific repo-backed document available.
