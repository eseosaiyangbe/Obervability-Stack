"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  HardDrive,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  Wifi,
  Zap,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { VersionBadge } from "@/components/version-badge"
import { useAlertmanagerAlerts } from "@/lib/hooks/use-alertmanager-alerts"
import { useAllCurrentMetrics } from "@/lib/hooks/use-prometheus-metrics"
import { useAppHealth } from "@/lib/hooks/use-app-health"
import { useMultiTenantDashboardConfig } from "@/lib/hooks/use-multi-tenant-config"
import { useSwiftPayBusinessMetrics } from "@/lib/hooks/use-swiftpay-business-metrics"
import type { AlertmanagerAlert } from "@/lib/alertmanager-api"
import type { AppHealth, AppOverview } from "@/lib/app-observability"

type HealthStatus = AppHealth["status"]
type StatTone = "blue" | "green" | "yellow" | "purple" | "orange" | "red"

const statToneStyles: Record<StatTone, {
  panel: string
  icon: string
  value: string
  label: string
  progress: string
}> = {
  blue: {
    panel: "from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800",
    icon: "bg-blue-500",
    value: "text-blue-600 dark:text-blue-400",
    label: "text-blue-700 dark:text-blue-300",
    progress: "from-blue-500 to-indigo-600",
  },
  green: {
    panel: "from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800",
    icon: "bg-green-500",
    value: "text-green-600 dark:text-green-400",
    label: "text-green-700 dark:text-green-300",
    progress: "from-green-500 to-emerald-600",
  },
  yellow: {
    panel: "from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800",
    icon: "bg-yellow-500",
    value: "text-yellow-600 dark:text-yellow-400",
    label: "text-yellow-700 dark:text-yellow-300",
    progress: "from-yellow-500 to-amber-600",
  },
  purple: {
    panel: "from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800",
    icon: "bg-purple-500",
    value: "text-purple-600 dark:text-purple-400",
    label: "text-purple-700 dark:text-purple-300",
    progress: "from-purple-500 to-pink-600",
  },
  orange: {
    panel: "from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800",
    icon: "bg-orange-500",
    value: "text-orange-600 dark:text-orange-400",
    label: "text-orange-700 dark:text-orange-300",
    progress: "from-orange-500 to-red-600",
  },
  red: {
    panel: "from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800",
    icon: "bg-red-500",
    value: "text-red-600 dark:text-red-400",
    label: "text-red-700 dark:text-red-300",
    progress: "from-red-500 to-rose-600",
  },
}

const healthBadgeStyles: Record<HealthStatus, string> = {
  healthy: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400",
  degraded: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400",
  down: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
  unknown: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
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

function formatDollars(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "$0.00"
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value)
}

function formatRate(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0/min"
  return `${(value * 60).toFixed(2)}/min`
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

function formatLogTime(timestamp: string) {
  const milliseconds = Math.floor(Number(timestamp) / 1_000_000)
  return Number.isFinite(milliseconds) ? formatTime(milliseconds) : "N/A"
}

function getAlertTitle(alert: AlertmanagerAlert) {
  return alert.annotations?.summary || alert.labels?.alertname || "Active alert"
}

function getAlertService(alert: AlertmanagerAlert) {
  return alert.labels?.app || alert.labels?.service || alert.labels?.job || "observability"
}

function getAlertSeverity(alert: AlertmanagerAlert) {
  return alert.labels?.severity || "info"
}

function getOpenSISOperatorSummary(overview: AppOverview | null) {
  const primary = overview?.health.primaryEndpoint
  const openSISAlerts = overview?.alerts.length || 0

  if (!overview || !primary) {
    return {
      tone: "yellow" as StatTone,
      title: "Waiting for OpenSIS operator data",
      message: "The control plane has not built an OpenSIS overview yet. Start with the browser check and the local wrapper command.",
      nextAction: "Run the documented local start path, then verify the browser URL and Vault health.",
    }
  }

  if (primary.status !== "up") {
    return {
      tone: "red" as StatTone,
      title: "User-facing reachability is the first problem to solve",
      message: "OpenSIS is currently down at the primary browser path. Start with UI reachability, then inspect Vault and database logs if the UI container is up but responses still fail.",
      nextAction: "Check localhost:8088, then inspect opensis-ui, opensis-db, and vault logs together.",
    }
  }

  if (openSISAlerts > 0) {
    return {
      tone: "orange" as StatTone,
      title: "OpenSIS is reachable, but operator attention is still needed",
      message: "The browser path is up, but OpenSIS-specific alerts are firing. This usually means the platform has drift or dependency pressure even though the site still responds.",
      nextAction: "Review the alert stream first, then compare recent logs against Vault and database state.",
    }
  }

  return {
    tone: "green" as StatTone,
    title: "OpenSIS is currently healthy from the operator point of view",
    message: "The primary browser path is up and there are no OpenSIS-specific active alerts. The next checks are dependency confidence and drift prevention, not emergency recovery.",
    nextAction: "Use the runbook commands below for routine checks, especially Vault health and compose logs after restarts.",
  }
}

function getFoodPulseOperatorSummary(overview: AppOverview | null) {
  const primary = overview?.health.primaryEndpoint
  const foodPulseAlerts = overview?.alerts.length || 0

  if (!overview || !primary) {
    return {
      tone: "yellow" as StatTone,
      title: "Waiting for FoodPulse lab data",
      message: "The control plane has not built a FoodPulse overview yet. Start with the browser path, then confirm the cluster-status helper reports a healthy lab.",
      nextAction: "Check localhost:8090, then run ./scripts/cluster-status.sh inside FoodPulse.",
    }
  }

  if (primary.status !== "up") {
    return {
      tone: "red" as StatTone,
      title: "FoodPulse reachability is degraded",
      message: "The main browser path is down. Treat this as an app or edge issue first, then verify the underlying Redis and Postgres lab layers if the UI is up but requests still fail.",
      nextAction: "Check localhost:8090, then inspect foodpulse-ui, foodpulse-api, and both HAProxy layers.",
    }
  }

  if (foodPulseAlerts > 0) {
    return {
      tone: "orange" as StatTone,
      title: "FoodPulse is reachable, but the lab still needs attention",
      message: "The browser path is up, but FoodPulse-specific alerts are firing. In this lab, that usually means dependency pressure or failover drift rather than a complete app outage.",
      nextAction: "Run cluster-status first, then decide whether the Redis or Postgres drill path best matches the symptom.",
    }
  }

  return {
    tone: "green" as StatTone,
    title: "FoodPulse is healthy and the failover lab looks stable",
    message: "The main browser path is up and there are no FoodPulse-specific active alerts. This is the right time for controlled drill work, not reactive recovery.",
    nextAction: "Use cluster-status as the baseline, then run Redis or Postgres drills intentionally when you want to exercise the lab.",
  }
}

function HeroStatCard({
  icon,
  value,
  label,
  tone,
  delay,
}: {
  icon: React.ReactNode
  value: string
  label: string
  tone: StatTone
  delay: number
}) {
  const styles = statToneStyles[tone]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      className={`text-center p-3 sm:p-4 bg-gradient-to-br ${styles.panel} rounded-xl border`}
    >
      <div className={`w-8 h-8 sm:w-10 sm:h-10 ${styles.icon} rounded-lg flex items-center justify-center mx-auto mb-2`}>
        {icon}
      </div>
      <div className={`text-lg sm:text-xl font-bold ${styles.value}`}>{value}</div>
      <div className={`text-xs sm:text-sm ${styles.label}`}>{label}</div>
    </motion.div>
  )
}

function ResourceCard({
  title,
  value,
  tone,
  icon,
  progress,
}: {
  title: string
  value: string
  tone: StatTone
  icon: React.ReactNode
  progress?: number | null
}) {
  const styles = statToneStyles[tone]
  const safeProgress = progress === null || progress === undefined || Number.isNaN(progress)
    ? 0
    : Math.max(0, Math.min(100, progress))

  return (
    <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.2 }}>
      <Card className="h-full border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300">
        <CardHeader className={`bg-gradient-to-r ${tone === "blue" ? "from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20" : tone === "green" ? "from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20" : tone === "yellow" ? "from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20" : "from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20"} pb-2 p-4 sm:p-6`}>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <div className={`p-2 ${styles.icon} rounded-xl`}>
              {icon}
            </div>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{value}</div>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <Activity className="h-3 w-3 mr-1" />
              Live
            </Badge>
          </div>
          {progress !== undefined && (
            <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 sm:h-2.5">
              <div
                className={`bg-gradient-to-r ${styles.progress} h-2 sm:h-2.5 rounded-full transition-all duration-300`}
                style={{ width: `${safeProgress}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function BusinessSignalCard({
  title,
  value,
  description,
  tone,
  icon,
}: {
  title: string
  value: string
  description: string
  tone: StatTone
  icon: React.ReactNode
}) {
  const styles = statToneStyles[tone]

  return (
    <motion.div whileHover={{ y: -3, scale: 1.01 }} transition={{ duration: 0.2 }}>
      <Card className={`h-full border shadow-lg bg-gradient-to-br ${styles.panel}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-xs sm:text-sm font-medium ${styles.label}`}>{title}</p>
              <p className={`mt-2 text-2xl sm:text-3xl font-bold ${styles.value}`}>{value}</p>
            </div>
            <div className={`w-9 h-9 ${styles.icon} rounded-lg flex items-center justify-center flex-shrink-0`}>
              {icon}
            </div>
          </div>
          <p className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-5">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ManagedAppCard({ app }: { app: AppHealth }) {
  const primaryEndpoint = app.primaryEndpoint || app.endpoints[0]
  const upEndpoints = app.endpoints.filter((endpoint) => endpoint.status === "up").length
  const browserUrl = primaryEndpoint?.browserUrl

  const openPrimaryTarget = () => {
    if (!browserUrl) return
    window.open(browserUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <motion.div whileHover={{ y: -2, scale: 1.01 }} transition={{ duration: 0.2 }}>
      <Card
        className={`h-full border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900 overflow-hidden ${browserUrl ? "cursor-pointer hover:border-green-300 hover:shadow-xl dark:hover:border-green-700" : ""}`}
        onClick={browserUrl ? openPrimaryTarget : undefined}
        onKeyDown={browserUrl ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openPrimaryTarget()
          }
        } : undefined}
        role={browserUrl ? "link" : undefined}
        tabIndex={browserUrl ? 0 : undefined}
      >
        <CardHeader className="p-4 sm:p-5 bg-gradient-to-r from-gray-50 to-emerald-50 dark:from-gray-800 dark:to-emerald-900/20">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg text-gray-900 dark:text-white">{app.name}</CardTitle>
              <CardDescription className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {upEndpoints}/{app.endpoints.length} endpoints up
              </CardDescription>
            </div>
            <Badge variant="outline" className={healthBadgeStyles[app.status]}>
              {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Primary</p>
              <p className="font-semibold capitalize text-gray-900 dark:text-white">{primaryEndpoint?.status || "unknown"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Latency</p>
              <p className="font-semibold text-gray-900 dark:text-white">{formatLatency(primaryEndpoint?.latencySeconds)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Primary Target</p>
            <p className="text-xs sm:text-sm font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded-lg break-all text-gray-900 dark:text-white">
              {primaryEndpoint?.dockerTarget || "Not configured"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {app.endpoints.slice(0, 3).map((endpoint) => (
              <Badge key={endpoint.id} variant="secondary" className="text-xs">
                {endpoint.kind}
              </Badge>
            ))}
          </div>

          {primaryEndpoint?.browserUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 w-full h-9 hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-900/20"
              onClick={(event) => event.stopPropagation()}
            >
              <Link href={primaryEndpoint.browserUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function AlertCard({ alert }: { alert: AlertmanagerAlert }) {
  const severity = getAlertSeverity(alert)

  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={severity === "critical" ? "bg-gradient-to-r from-red-500 to-rose-600 text-white border-0" : "bg-gradient-to-r from-yellow-500 to-amber-600 text-white border-0"}>
                {severity}
              </Badge>
              <span className="text-xs text-gray-500 dark:text-gray-400">{getAlertService(alert)}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{getAlertTitle(alert)}</p>
          </div>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
        </div>
      </div>
    </motion.div>
  )
}

export default function DashboardPage() {
  const { dashboardConfig } = useMultiTenantDashboardConfig()
  const { health, summary, loading: appHealthLoading, error: appHealthError, refresh: refreshApps } = useAppHealth()
  const { alerts, stats, loading: alertsLoading, error: alertsError, refresh: refreshAlerts } = useAlertmanagerAlerts()
  const metrics = useAllCurrentMetrics()
  const {
    metrics: swiftpayMetrics,
    updatedAt: swiftpayUpdatedAt,
    loading: swiftpayBusinessLoading,
    error: swiftpayBusinessError,
    refresh: refreshSwiftPayBusiness,
  } = useSwiftPayBusinessMetrics()
  const [opensisOverview, setOpensisOverview] = useState<AppOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [foodpulseOverview, setFoodpulseOverview] = useState<AppOverview | null>(null)
  const [foodpulseOverviewLoading, setFoodpulseOverviewLoading] = useState(false)
  const [foodpulseOverviewError, setFoodpulseOverviewError] = useState<string | null>(null)

  const fetchOpenSISOverview = useCallback(async () => {
    setOverviewLoading(true)
    setOverviewError(null)

    try {
      const response = await fetch("/api/apps/opensis/overview")

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Request failed with ${response.status}`)
      }

      setOpensisOverview(await response.json())
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : "Failed to fetch OpenSIS overview")
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  const fetchFoodPulseOverview = useCallback(async () => {
    setFoodpulseOverviewLoading(true)
    setFoodpulseOverviewError(null)

    try {
      const response = await fetch("/api/apps/foodpulse/overview")

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Request failed with ${response.status}`)
      }

      setFoodpulseOverview(await response.json())
    } catch (error) {
      setFoodpulseOverviewError(error instanceof Error ? error.message : "Failed to fetch FoodPulse overview")
    } finally {
      setFoodpulseOverviewLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOpenSISOverview()
    fetchFoodPulseOverview()
    const interval = window.setInterval(() => {
      fetchOpenSISOverview()
      fetchFoodPulseOverview()
    }, 30000)
    return () => window.clearInterval(interval)
  }, [fetchFoodPulseOverview, fetchOpenSISOverview])

  const refreshAll = useCallback(() => {
    refreshApps()
    refreshAlerts()
    metrics.refetch()
    refreshSwiftPayBusiness()
    fetchOpenSISOverview()
    fetchFoodPulseOverview()
  }, [fetchFoodPulseOverview, fetchOpenSISOverview, metrics, refreshAlerts, refreshApps, refreshSwiftPayBusiness])

  const uptimeChart = useMemo(() => {
    return (opensisOverview?.uptimeSeries || []).map((point) => ({
      time: formatTime(point.time),
      uptime: point.value * 100,
    }))
  }, [opensisOverview])

  const latencyChart = useMemo(() => {
    return (opensisOverview?.latencySeries || []).map((point) => ({
      time: formatTime(point.time),
      latency: point.value * 1000,
    }))
  }, [opensisOverview])

  const networkTotal = (metrics.data?.network?.inbound || 0) + (metrics.data?.network?.outbound || 0)
  const monitoredEndpointCount = health.reduce((total, app) => total + app.endpoints.length, 0)
  const opensisHealth = opensisOverview?.health.primaryEndpoint
  const opensisSummary = getOpenSISOperatorSummary(opensisOverview)
  const foodpulseHealth = foodpulseOverview?.health.primaryEndpoint
  const foodpulseSummary = getFoodPulseOperatorSummary(foodpulseOverview)
  const dashboardTitle = dashboardConfig?.title || "DevOps Monitor"
  const isLoading = appHealthLoading || alertsLoading || overviewLoading || foodpulseOverviewLoading || metrics.isLoading || swiftpayBusinessLoading
  const walletBreakerLabel = swiftpayMetrics.walletCircuitBreakerState >= 1
    ? "Open"
    : swiftpayMetrics.walletCircuitBreakerState > 0
      ? "Half-open"
      : "Closed"

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/20">
      <div className="px-2 sm:px-4 py-3 sm:py-6 max-w-7xl mx-auto space-y-3 sm:space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border border-gray-200 dark:border-gray-700 shadow-xl bg-white dark:bg-gray-900 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-700 dark:via-indigo-700 dark:to-purple-700 text-white p-4 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-2 sm:space-y-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <LayoutDashboard className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl sm:text-3xl lg:text-4xl font-bold">
                        {dashboardTitle}
                      </CardTitle>
                      <CardDescription className="mt-1 sm:mt-2 text-blue-100 text-sm sm:text-base">
                        Real-time workload health, metrics, logs, alerts, and operator guidance
                      </CardDescription>
                    </div>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <VersionBadge variant="compact" />
                  <Badge className="bg-white/20 text-white border-white/30 px-3 py-1.5 font-semibold text-sm">
                    <Activity className="h-3 w-3 mr-1" />
                    Live Data
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <HeroStatCard
                  icon={<Cpu className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                  value={formatPercent(metrics.data?.cpu)}
                  label="CPU Usage"
                  tone="blue"
                  delay={0.1}
                />
                <HeroStatCard
                  icon={<Database className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                  value={formatPercent(metrics.data?.memory)}
                  label="Memory"
                  tone="green"
                  delay={0.2}
                />
                <HeroStatCard
                  icon={<Server className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                  value={`${summary?.healthyApps ?? 0}/${summary?.totalApps ?? health.length}`}
                  label="Healthy Apps"
                  tone="purple"
                  delay={0.3}
                />
                <HeroStatCard
                  icon={<Bell className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                  value={`${stats.firing}`}
                  label="Firing Alerts"
                  tone={stats.firing > 0 ? "red" : "orange"}
                  delay={0.4}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 sm:h-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={refreshAll}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:inline">Refresh All</span>
              <span className="sm:hidden">Refresh</span>
            </Button>
          </div>

          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <Activity className="h-3 w-3 mr-1" />
            Live Monitoring
          </Badge>
        </motion.div>

        {(appHealthError || alertsError || overviewError || foodpulseOverviewError || metrics.error || swiftpayBusinessError) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">
                {appHealthError || alertsError || overviewError || foodpulseOverviewError || swiftpayBusinessError || "Metrics API failed"}
              </p>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          {metrics.isLoading ? (
            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)
          ) : (
            <>
              <ResourceCard title="CPU" value={formatPercent(metrics.data?.cpu)} tone="blue" icon={<Cpu className="h-4 w-4 sm:h-5 sm:w-5 text-white" />} progress={metrics.data?.cpu} />
              <ResourceCard title="Memory" value={formatPercent(metrics.data?.memory)} tone="green" icon={<Database className="h-4 w-4 sm:h-5 sm:w-5 text-white" />} progress={metrics.data?.memory} />
              <ResourceCard title="Disk" value={formatPercent(metrics.data?.disk)} tone="yellow" icon={<HardDrive className="h-4 w-4 sm:h-5 sm:w-5 text-white" />} progress={metrics.data?.disk} />
              <ResourceCard title="Network" value={formatNetwork(networkTotal)} tone="purple" icon={<Wifi className="h-4 w-4 sm:h-5 sm:w-5 text-white" />} />
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900">
            <CardHeader className="p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-xl sm:text-2xl text-gray-900 dark:text-white">SwiftPay Money Flow</CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Business signals from transaction-service and wallet-service metrics
                  </CardDescription>
                </div>
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {swiftpayUpdatedAt ? `Updated ${formatTime(new Date(swiftpayUpdatedAt).getTime())}` : "Waiting for scrape"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <BusinessSignalCard
                  title="Pending Transactions"
                  value={swiftpayMetrics.pendingTransactions.toFixed(0)}
                  description="Should normally be zero. Non-zero means accepted transfers are waiting for the worker."
                  tone={swiftpayMetrics.pendingTransactions > 0 ? "orange" : "green"}
                  icon={<Clock className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                />
                <BusinessSignalCard
                  title="Pending Amount"
                  value={formatDollars(swiftpayMetrics.pendingAmount)}
                  description="Dollars currently stuck before wallet movement completes."
                  tone={swiftpayMetrics.pendingAmount > 0 ? "red" : "green"}
                  icon={<Database className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                />
                <BusinessSignalCard
                  title="Queue Depth"
                  value={swiftpayMetrics.queueDepth.toFixed(0)}
                  description="RabbitMQ transaction backlog. Growth points to worker or Wallet Service pressure."
                  tone={swiftpayMetrics.queueDepth > 0 ? "yellow" : "green"}
                  icon={<Zap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                />
                <BusinessSignalCard
                  title="Completed Transfers"
                  value={swiftpayMetrics.completedTransfersTotal.toFixed(0)}
                  description="Successful transfer count since Transaction Service last started. This is the easiest healthy activity signal."
                  tone={swiftpayMetrics.completedTransfersTotal > 0 ? "blue" : "green"}
                  icon={<CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                />
                <BusinessSignalCard
                  title="Wallet Circuit"
                  value={walletBreakerLabel}
                  description="Closed is healthy. Open means Transaction Service is protecting Wallet Service."
                  tone={swiftpayMetrics.walletCircuitBreakerState >= 1 ? "red" : "green"}
                  icon={<Shield className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                />
                <BusinessSignalCard
                  title="Transaction Failures"
                  value={formatRate(swiftpayMetrics.transactionFailureRate)}
                  description="Backend failed transaction rate over the last five minutes."
                  tone={swiftpayMetrics.transactionFailureRate > 0 ? "orange" : "green"}
                  icon={<AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                />
                <BusinessSignalCard
                  title="Wallet Failures"
                  value={formatRate(swiftpayMetrics.walletFailureRate)}
                  description="Wallet transfer failures, including insufficient funds and service errors."
                  tone={swiftpayMetrics.walletFailureRate > 0 ? "orange" : "green"}
                  icon={<Gauge className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900">
            <CardHeader className="p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-green-50 dark:from-gray-800 dark:to-green-900/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-xl sm:text-2xl text-gray-900 dark:text-white">Managed Applications</CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    App inventory prepared for Docker Compose now and Kubernetes later
                  </CardDescription>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  {summary ? `${summary.healthyApps} healthy / ${summary.downApps} down` : `${health.length} apps / ${monitoredEndpointCount} endpoints`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {appHealthLoading && health.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                  {health.map((app, index) => (
                    <motion.div
                      key={app.appId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <ManagedAppCard app={app} />
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                    <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  OpenSIS Probe Latency
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  One-hour probe duration in milliseconds
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {overviewLoading && latencyChart.length === 0 ? (
                  <Skeleton className="h-[320px] rounded-xl" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={latencyChart}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="latency" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  OpenSIS Uptime
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  One-hour Blackbox probe success
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center dark:border-green-800 dark:bg-green-900/20">
                    <CheckCircle className="mx-auto mb-1 h-5 w-5 text-green-500" />
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{opensisHealth?.status === "up" ? "Up" : "Down"}</p>
                    <p className="text-xs text-green-700 dark:text-green-300">Primary</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-900/20">
                    <Clock className="mx-auto mb-1 h-5 w-5 text-blue-500" />
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatLatency(opensisHealth?.latencySeconds)}</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Latency</p>
                  </div>
                </div>
                {overviewLoading && uptimeChart.length === 0 ? (
                  <Skeleton className="h-[220px] rounded-xl" />
                ) : (
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={uptimeChart}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="uptime" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 h-full">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  Active Alerts
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Live Alertmanager state</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {alertsLoading && alerts.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                  </div>
                ) : alerts.length > 0 ? (
                  <div className="space-y-3">
                    {alerts.slice(0, 5).map((alert) => (
                      <AlertCard key={alert.fingerprint || alert.id} alert={alert} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      No active alerts. OpenSISDown is resolved.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="lg:col-span-2"
          >
            <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  Recent OpenSIS Logs
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Loki query: {opensisOverview?.app.observability.logQuery || "{compose_project=~\".*opensis.*\"}"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {overviewLoading && !opensisOverview ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : opensisOverview?.recentLogs.length ? (
                  <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
                    {opensisOverview.recentLogs.slice(0, 8).map((log, index) => (
                      <motion.div
                        key={`${log.timestamp}-${log.line}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.03 }}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="h-3 w-3" />
                          <span>{formatLogTime(log.timestamp)}</span>
                          <Badge variant="outline">{log.labels.compose_service || log.labels.container || "opensis"}</Badge>
                        </div>
                        <p className="break-words font-mono text-xs text-gray-900 dark:text-white">{log.line}</p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400">
                    No OpenSIS logs returned for the last hour.
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-900/20 dark:to-sky-900/20 p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-sky-600 rounded-xl">
                      <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    OpenSIS Operator Guide
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Dependency-aware first checks for UI reachability, Vault secret delivery, and MariaDB-backed app state
                  </CardDescription>
                </div>
                {opensisHealth?.browserUrl && (
                  <Button asChild variant="outline" size="sm" className="gap-1.5 bg-white/80 dark:bg-gray-900/60">
                    <Link href={opensisHealth.browserUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open OpenSIS
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className={`rounded-xl border p-4 bg-gradient-to-r ${statToneStyles[opensisSummary.tone].panel}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1.5">
                    <p className={`text-sm font-semibold ${statToneStyles[opensisSummary.tone].label}`}>{opensisSummary.title}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{opensisSummary.message}</p>
                  </div>
                  <Badge className={`${healthBadgeStyles[opensisOverview?.health.status || "unknown"]} w-fit`}>
                    {opensisOverview?.health.status ? opensisOverview.health.status.charAt(0).toUpperCase() + opensisOverview.health.status.slice(1) : "Unknown"}
                  </Badge>
                </div>
                <p className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Next action: {opensisSummary.nextAction}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Wifi className="h-4 w-4" />
                    <p className="text-sm font-semibold">Browser Path</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    Start here when users report an outage. If this fails, treat it as a reachability or UI startup issue first.
                  </p>
                  <code className="mt-3 block rounded-lg bg-white/70 p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                    curl -I http://localhost:8088
                  </code>
                </div>

                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-900/20">
                  <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                    <Shield className="h-4 w-4" />
                    <p className="text-sm font-semibold">Vault Secrets</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    If the site is up but behavior is broken, validate Vault health and rendered secret delivery before changing app code.
                  </p>
                  <code className="mt-3 block rounded-lg bg-white/70 p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                    curl -k https://localhost:8200/v1/sys/health
                  </code>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <Database className="h-4 w-4" />
                    <p className="text-sm font-semibold">MariaDB State</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    If Vault data looks correct but auth still fails, suspect live database drift before you blame the app wrapper.
                  </p>
                  <code className="mt-3 block rounded-lg bg-white/70 p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                    docker compose logs --tail=50 opensis-db
                  </code>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Server className="h-4 w-4" />
                    <p className="text-sm font-semibold">Platform Wrapper</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    Apple Silicon operators should prefer the local build path. That avoids the published image mismatch we already documented.
                  </p>
                  <code className="mt-3 block rounded-lg bg-white/70 p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                    ./scripts/compose-start.sh --build-local
                  </code>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/70">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">First-response commands</p>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Start</p>
                      <code className="mt-1 block rounded-lg bg-white p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                        ./scripts/compose-start.sh --build-local
                      </code>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Primary health</p>
                      <code className="mt-1 block rounded-lg bg-white p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                        {opensisOverview?.app.runbooks.healthCheck || "curl -I http://localhost:8088"}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Shared logs</p>
                      <code className="mt-1 block rounded-lg bg-white p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                        docker compose logs --tail=50 opensis-ui opensis-db vault
                      </code>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/70">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">How to interpret failures</p>
                  </div>
                  <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <p>
                      If the browser path is down, treat the problem as edge or UI startup first.
                    </p>
                    <p>
                      If the browser path is up but requests fail, compare Vault health, rendered secret flow, and recent logs before changing the app.
                    </p>
                    <p>
                      If Vault values and rendered files agree but authentication still fails, suspect MariaDB drift rather than Vault drift.
                    </p>
                    <p>
                      If alerts are firing while the site still responds, the platform may be degraded even though the public page looks healthy.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.85 }}
        >
          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                      <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    FoodPulse Failover Guide
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    App reachability plus the Redis, Postgres, and HAProxy checks that make the resilience lab meaningful
                  </CardDescription>
                </div>
                {foodpulseHealth?.browserUrl && (
                  <Button asChild variant="outline" size="sm" className="gap-1.5 bg-white/80 dark:bg-gray-900/60">
                    <Link href={foodpulseHealth.browserUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open FoodPulse
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className={`rounded-xl border p-4 bg-gradient-to-r ${statToneStyles[foodpulseSummary.tone].panel}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1.5">
                    <p className={`text-sm font-semibold ${statToneStyles[foodpulseSummary.tone].label}`}>{foodpulseSummary.title}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{foodpulseSummary.message}</p>
                  </div>
                  <Badge className={`${healthBadgeStyles[foodpulseOverview?.health.status || "unknown"]} w-fit`}>
                    {foodpulseOverview?.health.status ? foodpulseOverview.health.status.charAt(0).toUpperCase() + foodpulseOverview.health.status.slice(1) : "Unknown"}
                  </Badge>
                </div>
                <p className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Next action: {foodpulseSummary.nextAction}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <Wifi className="h-4 w-4" />
                    <p className="text-sm font-semibold">Browser Path</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    Start with the user-facing path. If this is broken, do not jump into failover drills until the app surface itself is understood.
                  </p>
                  <code className="mt-3 block rounded-lg bg-white/70 p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                    curl -I http://localhost:8090
                  </code>
                </div>

                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-900/20">
                  <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
                    <Server className="h-4 w-4" />
                    <p className="text-sm font-semibold">Cluster Status</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    This is the baseline operator command. Use it before and after drills so you know whether the lab is actually healthy.
                  </p>
                  <code className="mt-3 block rounded-lg bg-white/70 p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                    ./scripts/cluster-status.sh
                  </code>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Zap className="h-4 w-4" />
                    <p className="text-sm font-semibold">Redis Drill</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    Use this when you want to observe Sentinel-driven failover and verify HAProxy points at the new master.
                  </p>
                  <code className="mt-3 block rounded-lg bg-white/70 p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                    ./scripts/redis-failover-drill.sh
                  </code>
                </div>

                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-900/20">
                  <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                    <Database className="h-4 w-4" />
                    <p className="text-sm font-semibold">Postgres Drill</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    This is a manual promotion lab. It is useful for learning, but it intentionally leaves the topology dirty afterward.
                  </p>
                  <code className="mt-3 block rounded-lg bg-white/70 p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                    ./scripts/pg-failover-drill.sh
                  </code>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/70">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">First-response commands</p>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Start</p>
                      <code className="mt-1 block rounded-lg bg-white p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                        {foodpulseOverview?.app.runbooks.localStart || "cd FoodPulse && cp .env.example .env && ./scripts/start.sh"}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Baseline health</p>
                      <code className="mt-1 block rounded-lg bg-white p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                        {foodpulseOverview?.app.runbooks.healthCheck || "curl -I http://localhost:8090"}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Lab baseline</p>
                      <code className="mt-1 block rounded-lg bg-white p-2 text-xs text-gray-900 dark:bg-gray-950/60 dark:text-gray-100">
                        ./scripts/cluster-status.sh
                      </code>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/70">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">How to interpret failures</p>
                  </div>
                  <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <p>
                      If the browser path is down, treat it as an app or proxy issue first, not as an automatic failover problem.
                    </p>
                    <p>
                      If the browser path is healthy but cluster-status is degraded, the lab dependencies need attention even if the UI still looks fine.
                    </p>
                    <p>
                      Redis failover drills are the cleaner resilience exercise because Sentinel and HAProxy should converge on a new master automatically.
                    </p>
                    <p>
                      Postgres promotion drills are educational but intentionally disruptive; use them when you want to study failure handling, not when you need a clean steady state afterward.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
