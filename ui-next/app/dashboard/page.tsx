"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Cpu,
  HardDrive,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  Wifi,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { VersionBadge } from "@/components/version-badge"
import { useAlertmanagerAlerts } from "@/lib/hooks/use-alertmanager-alerts"
import { useAllCurrentMetrics } from "@/lib/hooks/use-prometheus-metrics"
import { useAppHealth } from "@/lib/hooks/use-app-health"
import { useMultiTenantDashboardConfig } from "@/lib/hooks/use-multi-tenant-config"
import type { AppHealth } from "@/lib/app-observability"
import { monitoredApps } from "@/lib/monitored-apps"

type HealthStatus = AppHealth["status"]
type StatTone = "blue" | "green" | "yellow" | "orange" | "red" | "slate"

const appMetadata = new Map(monitoredApps.map((app) => [app.id, app]))

const healthBadgeStyles: Record<HealthStatus, string> = {
  healthy: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400",
  degraded: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400",
  down: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
  unknown: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
}

const statToneStyles: Record<StatTone, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300",
  green: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300",
  orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-900/20 dark:text-orange-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300",
  slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
}

function normalizeDashboardTitle(title?: string | null) {
  if (!title) return "DevOps Easy Learning Control Plane"
  const trimmed = title.trim()
  if (trimmed === "DevOps Monitor" || trimmed === "Monitoring in a Box") {
    return "DevOps Easy Learning Control Plane"
  }
  return trimmed
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--"
  return `${value.toFixed(1)}%`
}

function formatLatency(seconds?: number | null) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "N/A"
  return `${Math.round(seconds * 1000)}ms`
}

function formatNetwork(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--"
  return `${value.toFixed(1)} MB/s`
}

function categoryLabel(category?: string) {
  switch (category) {
    case "student-information-system":
      return "Legacy Platform"
    case "wallet-platform":
      return "Microservices"
    case "resilience-lab":
      return "HA Lab"
    case "demo-app":
      return "Demo App"
    default:
      return "Managed App"
  }
}

function statusLabel(status: HealthStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function DashboardStat({
  title,
  value,
  detail,
  tone,
  icon,
}: {
  title: string
  value: string
  detail: string
  tone: StatTone
  icon: React.ReactNode
}) {
  return (
    <Card className={`border shadow-sm ${statToneStyles[tone]}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-75">{title}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs opacity-80">{detail}</p>
          </div>
          <div className="rounded-xl bg-white/70 p-2 text-current shadow-sm dark:bg-gray-950/40">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ManagedAppLabel({ app, index }: { app: AppHealth; index: number }) {
  const metadata = appMetadata.get(app.appId)
  const primaryEndpoint = app.primaryEndpoint || app.endpoints[0]
  const upEndpoints = app.endpoints.filter((endpoint) => endpoint.status === "up").length

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      whileHover={{ y: -3, scale: 1.01 }}
    >
      <Link href={`/services/${app.appId}`} className="block h-full">
        <Card className="group h-full overflow-hidden border border-gray-200 bg-white shadow-sm transition-all hover:border-blue-300 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700">
          <CardHeader className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge variant="outline" className="mb-3 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
                  {categoryLabel(metadata?.category)}
                </Badge>
                <CardTitle className="text-xl text-gray-950 dark:text-white">{app.name}</CardTitle>
                <CardDescription className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                  {metadata?.description || "Managed workload with app-specific operator guidance."}
                </CardDescription>
              </div>
              <Badge variant="outline" className={`${healthBadgeStyles[app.status]} shrink-0`}>
                {statusLabel(app.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/70">
                <p className="text-xs text-gray-500 dark:text-gray-400">Endpoints</p>
                <p className="mt-1 font-semibold text-gray-950 dark:text-white">
                  {upEndpoints}/{app.endpoints.length} up
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/70">
                <p className="text-xs text-gray-500 dark:text-gray-400">Latency</p>
                <p className="mt-1 font-semibold text-gray-950 dark:text-white">
                  {formatLatency(primaryEndpoint?.latencySeconds)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors group-hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300 dark:group-hover:bg-blue-900/30">
              <span>Open operator page</span>
              <Shield className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

export default function DashboardPage() {
  const { dashboardConfig } = useMultiTenantDashboardConfig()
  const { health, summary, loading: appHealthLoading, error: appHealthError, refresh: refreshApps } = useAppHealth()
  const { stats, loading: alertsLoading, error: alertsError, refresh: refreshAlerts } = useAlertmanagerAlerts()
  const metrics = useAllCurrentMetrics()

  const dashboardTitle = normalizeDashboardTitle(dashboardConfig?.title)
  const networkTotal = (metrics.data?.network?.inbound || 0) + (metrics.data?.network?.outbound || 0)
  const monitoredEndpointCount = health.reduce((total, app) => total + app.endpoints.length, 0)
  const isLoading = appHealthLoading || alertsLoading || metrics.isLoading

  const refreshAll = () => {
    refreshApps()
    refreshAlerts()
    metrics.refetch()
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34%),linear-gradient(135deg,#f8fafc,#ffffff_45%,#eef2ff)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.22),_transparent_32%),linear-gradient(135deg,#020617,#0f172a_48%,#111827)]">
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Card className="overflow-hidden border border-gray-200 bg-white/90 shadow-xl backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
            <CardHeader className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-5 text-white sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white/15 p-3 shadow-inner">
                    <LayoutDashboard className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold sm:text-4xl">{dashboardTitle}</CardTitle>
                    <CardDescription className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                      Simple control-room view. Pick a managed app below when you need probe latency, uptime,
                      alerts, recent logs, and operator guidance.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <VersionBadge variant="compact" />
                  <Badge className="border-white/20 bg-white/15 text-white">
                    <Activity className="mr-1 h-3 w-3" />
                    Live Data
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <DashboardStat
                  title="Healthy Apps"
                  value={`${summary?.healthyApps ?? 0}/${summary?.totalApps ?? health.length}`}
                  detail={`${monitoredEndpointCount} monitored endpoints`}
                  tone="green"
                  icon={<CheckCircle className="h-5 w-5" />}
                />
                <DashboardStat
                  title="Firing Alerts"
                  value={`${stats.firing}`}
                  detail={stats.firing > 0 ? "Needs operator review" : "No active fires"}
                  tone={stats.firing > 0 ? "red" : "slate"}
                  icon={<Bell className="h-5 w-5" />}
                />
                <DashboardStat
                  title="CPU"
                  value={formatPercent(metrics.data?.cpu)}
                  detail="Host pressure signal"
                  tone="blue"
                  icon={<Cpu className="h-5 w-5" />}
                />
                <DashboardStat
                  title="Disk Usage"
                  value={formatPercent(metrics.data?.disk)}
                  detail="Root filesystem utilization"
                  tone={
                    metrics.data?.disk && metrics.data.disk >= 90
                      ? "red"
                      : metrics.data?.disk && metrics.data.disk >= 80
                        ? "yellow"
                        : "green"
                  }
                  icon={<HardDrive className="h-5 w-5" />}
                />
                <DashboardStat
                  title="Network"
                  value={formatNetwork(networkTotal)}
                  detail="Current traffic sample"
                  tone="orange"
                  icon={<Wifi className="h-5 w-5" />}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-950/70 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            className="w-fit gap-1.5 bg-white/90 dark:bg-gray-950/70"
            onClick={refreshAll}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <p className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium leading-6 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 sm:justify-end sm:text-right">
            <Shield className="h-4 w-4 shrink-0" />
            The dashboard stays light; the deep operator workflow lives inside each app page.
          </p>
        </div>

        {(appHealthError || alertsError || metrics.error) && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{appHealthError || alertsError || "Metrics API failed"}</span>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <Card className="border border-gray-200 bg-white/90 shadow-lg backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl text-gray-950 dark:text-white">
                    <Server className="h-5 w-5 text-blue-600" />
                    Managed Apps
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Click a label to open that app's probe latency, uptime, alerts, recent logs, and operator guide.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="w-fit border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  <Clock className="mr-1 h-3 w-3" />
                  Updated every 30s
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              {appHealthLoading && health.length === 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-64 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {health.map((app, index) => (
                    <ManagedAppLabel key={app.appId} app={app} index={index} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
