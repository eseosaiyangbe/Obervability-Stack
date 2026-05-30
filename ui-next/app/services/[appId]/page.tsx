"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Gauge,
  Loader2,
  RefreshCw,
  TerminalSquare,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AlertmanagerAlert } from "@/lib/alertmanager-api"
import type { AppOverview } from "@/lib/app-observability"
import type { LokiLogEntry } from "@/lib/loki-api"

type OperatorGuide = {
  story: string
  firstChecks: string[]
  drill: string
  runbook: string
  runbookUrl: string
}

const repositoryUrl = "https://github.com/eseosaiyangbe/Obervability-Stack/blob/main"
const incidentDrillUrl = `${repositoryUrl}/docs/INCIDENT_DRILLS.md`

const operatorGuides: Record<string, OperatorGuide> = {
  opensis: {
    story: "Student information platform operated with Vault-backed secret delivery, database reachability controls, and production-style Kubernetes observability.",
    firstChecks: [
      "./scripts/devops-monitor.sh opensis-live",
      "cd ../opensis && docker compose ps vault vault-agent-app vault-agent-db opensis-ui opensis-db",
      "curl -fsS http://localhost:8200/v1/sys/health | jq .",
    ],
    drill: "OpenSIS Vault unavailable",
    runbook: "docs/OPENSIS_OPERATOR_RUNBOOK.md",
    runbookUrl: `${repositoryUrl}/docs/OPENSIS_OPERATOR_RUNBOOK.md`,
  },
  swiftpay: {
    story: "Payment platform composed of independently deployable services for gateway availability, wallet integrity, asynchronous transaction processing, and operational business telemetry on Kubernetes.",
    firstChecks: [
      "./scripts/devops-monitor.sh swiftpay-live",
      "cd ../swiftpay && ./scripts/k8s-dev-verify.sh",
      "curl -fsS http://localhost:4000/api/apps/swiftpay/business | jq .",
      "kubectl get pods,svc,ingress -n swiftpay-dev",
    ],
    drill: "SwiftPay transaction worker down",
    runbook: "docs/SWIFTPAY_OPERATOR_RUNBOOK.md",
    runbookUrl: `${repositoryUrl}/docs/SWIFTPAY_OPERATOR_RUNBOOK.md`,
  },
  foodpulse: {
    story: "Consumer-facing application operated with a resilience-focused Kubernetes model built around CloudNativePG, Sentinel-backed Redis, and controlled failover behavior.",
    firstChecks: [
      "./scripts/devops-monitor.sh foodpulse-live",
      "cd ../foodpulse && ./scripts/k8s-dev-verify.sh",
      "cd ../foodpulse && ./scripts/cluster-status.sh",
      "kubectl get pods,svc,ingress -n foodpulse-dev",
    ],
    drill: "FoodPulse Redis failover",
    runbook: "docs/FOODPULSE_OPERATOR_RUNBOOK.md",
    runbookUrl: `${repositoryUrl}/docs/FOODPULSE_OPERATOR_RUNBOOK.md`,
  },
  memflip: {
    story: "Internet-facing web application used as a compact reference workload for frontend and backend delivery, ingress validation, and repeatable Kubernetes deployment patterns.",
    firstChecks: [
      "./scripts/devops-monitor.sh memflip-live",
      "cd ../memflip && ./scripts/k8s-dev-verify.sh",
      "curl -fsS http://localhost:8080/api/health | jq .",
      "kubectl get pods,svc,ingress -n memflip-dev",
    ],
    drill: "MemFlip backend down",
    runbook: "docs/MEMFLIP_OPERATOR_RUNBOOK.md",
    runbookUrl: `${repositoryUrl}/docs/MEMFLIP_OPERATOR_RUNBOOK.md`,
  },
}

const categoryLabels: Record<string, string> = {
  "student-information-system": "Legacy Platform",
  "wallet-platform": "Microservices",
  "resilience-lab": "HA Lab",
  "demo-app": "Reference Workload",
}

async function fetchOverview(appId: string) {
  const response = await fetch(`/api/apps/${appId}/overview`, { cache: "no-store" })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Request failed with ${response.status}`)
  }

  return response.json() as Promise<AppOverview>
}

function formatLatency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "Waiting"
  return `${Math.round(value * 1000)}ms`
}

function formatUptime(series: Array<{ time: number; value: number }>) {
  if (!series.length) return "Waiting"
  const upSamples = series.filter((point) => point.value === 1).length
  return `${Math.round((upSamples / series.length) * 100)}%`
}

function formatTime(value: string | null | undefined) {
  if (!value) return "Not checked yet"
  return new Date(value).toLocaleString()
}

function formatLogTime(value: string) {
  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) return value
  return new Date(asNumber / 1_000_000).toLocaleTimeString()
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "healthy":
    case "up":
      return "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400"
    case "degraded":
      return "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400"
    case "down":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
    default:
      return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300"
  }
}

function MetricCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string
  value: string
  helper: string
  icon: React.ReactNode
}) {
  return (
    <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <CardContent className="flex items-start gap-4 p-5">
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-950 dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertRow({ alert }: { alert: AlertmanagerAlert }) {
  const alertName = alert.labels.alertname || alert.labels.alert || "Unnamed alert"
  const severity = alert.labels.severity || "info"
  const summary = alert.annotations.summary || alert.annotations.description || "No summary provided"

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={statusBadgeClass(alert.status.state === "active" ? "down" : "unknown")}>
          {alert.status.state}
        </Badge>
        <Badge variant="secondary">{severity}</Badge>
      </div>
      <p className="mt-3 font-semibold text-gray-950 dark:text-white">{alertName}</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{summary}</p>
    </div>
  )
}

function LogRow({ log }: { log: LokiLogEntry }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-950 p-4 font-mono text-xs text-gray-100 dark:border-gray-800">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-gray-400">
        <span>{formatLogTime(log.timestamp)}</span>
        {log.labels.compose_service && <span>{log.labels.compose_service}</span>}
        {log.labels.container_name && <span>{log.labels.container_name}</span>}
      </div>
      <pre className="whitespace-pre-wrap break-words leading-5">{log.line}</pre>
    </div>
  )
}

export default function ManagedAppDetailPage() {
  const params = useParams<{ appId: string }>()
  const appId = params.appId
  const [overview, setOverview] = useState<AppOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      setOverview(await fetchOverview(appId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load app overview")
    } finally {
      setLoading(false)
    }
  }, [appId])

  useEffect(() => {
    refresh()
    const interval = window.setInterval(refresh, 30000)
    return () => window.clearInterval(interval)
  }, [refresh])

  const guide = operatorGuides[appId]

  const endpointSummary = useMemo(() => {
    const endpoints = overview?.health.endpoints || []
    return {
      up: endpoints.filter((endpoint) => endpoint.status === "up").length,
      total: endpoints.length,
    }
  }, [overview])

  if (loading && !overview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (error || !overview) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-gray-950">
        <div className="mx-auto max-w-4xl">
          <Link href="/services" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <ArrowLeft className="h-4 w-4" />
            Back to managed apps
          </Link>
          <Card className="mt-6 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
            <CardContent className="flex items-start gap-3 p-6 text-red-700 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              {error || "App overview unavailable"}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { app, health, alerts, recentLogs, uptimeSeries } = overview
  const primaryEndpoint = health.primaryEndpoint
  const browserUrl = primaryEndpoint?.browserUrl

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 px-3 py-5 dark:from-gray-950 dark:via-gray-950 dark:to-emerald-950/20 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/services" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <ArrowLeft className="h-4 w-4" />
            Managed apps
          </Link>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2 rounded-xl bg-white dark:bg-gray-900">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <Card className="overflow-hidden border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white dark:border-gray-800 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge className="border-white/30 bg-white/15 text-white">
                    {categoryLabels[app.category] || app.category}
                  </Badge>
                  <Badge className="border-white/30 bg-white/15 text-white">{health.status}</Badge>
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight sm:text-5xl">{app.name}</CardTitle>
                <CardDescription className="mt-4 max-w-2xl text-base leading-7 text-emerald-50">
                  {guide?.story || app.description}
                </CardDescription>
              </div>

              {browserUrl && (
                <a
                  href={browserUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
                >
                  Open live app
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </CardHeader>
        </Card>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Probe latency"
            value={formatLatency(primaryEndpoint?.latencySeconds)}
            helper={`Primary target: ${primaryEndpoint?.name || "Unknown"}`}
            icon={<Gauge className="h-5 w-5" />}
          />
          <MetricCard
            title="Uptime"
            value={formatUptime(uptimeSeries)}
            helper="Last hour from blackbox probes"
            icon={<Activity className="h-5 w-5" />}
          />
          <MetricCard
            title="Alerts"
            value={`${alerts.length}`}
            helper={alerts.length === 1 ? "Matching alert" : "Matching alerts"}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <MetricCard
            title="Endpoints"
            value={`${endpointSummary.up}/${endpointSummary.total}`}
            helper={`Last checked ${formatTime(primaryEndpoint?.lastChecked)}`}
            icon={<CheckCircle className="h-5 w-5" />}
          />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" />
                Probe Targets
              </CardTitle>
              <CardDescription>Live endpoint state from the app inventory and Prometheus probes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {health.endpoints.map((endpoint) => (
                <div key={endpoint.id} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-950 dark:text-white">{endpoint.name}</p>
                      <p className="mt-1 break-all font-mono text-xs text-gray-500">{endpoint.dockerTarget}</p>
                    </div>
                    <Badge variant="outline" className={statusBadgeClass(endpoint.status)}>
                      {endpoint.status}
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <span>Latency: <strong>{formatLatency(endpoint.latencySeconds)}</strong></span>
                    <span>Kind: <strong>{endpoint.kind}</strong></span>
                    <span>Checked: <strong>{formatTime(endpoint.lastChecked)}</strong></span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                Operator Guide
              </CardTitle>
              <CardDescription>First checks and runbook direction for this app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-gray-950 dark:text-white">Recommended drill</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{guide?.drill || "Use the incident drill catalog."}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-950 dark:text-white">Runbook</p>
                <p className="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">{guide?.runbook || "Obervability-Stack/docs/INCIDENT_DRILLS.md"}</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <a
                  href={guide?.runbookUrl || incidentDrillUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Open operator runbook
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={incidentDrillUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
                >
                  View incident drills
                  <BookOpen className="h-4 w-4" />
                </a>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-950 dark:text-white">First commands</p>
                <div className="space-y-2">
                  {(guide?.firstChecks || [app.runbooks.healthCheck || "./scripts/devops-monitor.sh operator"]).map((command) => (
                    <code key={command} className="block rounded-xl bg-gray-950 p-3 text-xs text-gray-100">
                      {command}
                    </code>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-emerald-600" />
                Alerts
              </CardTitle>
              <CardDescription>Alerts that match this managed app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.length > 0 ? alerts.map((alert) => (
                <AlertRow key={alert.fingerprint || alert.id} alert={alert} />
              )) : (
                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-800">
                  No matching alerts right now.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                Recent Logs
              </CardTitle>
              <CardDescription>Latest log lines from the app-specific Loki query.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentLogs.length > 0 ? recentLogs.slice(0, 6).map((log) => (
                <LogRow key={`${log.timestamp}-${log.line.slice(0, 32)}`} log={log} />
              )) : (
                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-800">
                  No recent logs returned for this app.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TerminalSquare className="h-5 w-5 text-emerald-600" />
              Local Run Contract
            </CardTitle>
            <CardDescription>Useful commands from the app inventory.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-gray-950 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Start</p>
              <code className="text-sm text-gray-100">{app.runbooks.localStart || "Not documented"}</code>
            </div>
            <div className="rounded-2xl bg-gray-950 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Kubernetes deploy</p>
              <code className="text-sm text-gray-100">{app.runbooks.kubernetesDeploy || "Not documented"}</code>
            </div>
            <div className="rounded-2xl bg-gray-950 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Health check</p>
              <code className="text-sm text-gray-100">{app.runbooks.healthCheck || "Not documented"}</code>
            </div>
            <div className="rounded-2xl bg-gray-950 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Kubernetes verify</p>
              <code className="text-sm text-gray-100">{app.runbooks.kubernetesVerify || "Not documented"}</code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
