"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAppHealth } from "@/lib/hooks/use-app-health"
import { useMonitoredApps } from "@/lib/hooks/use-monitored-apps"
import { usePlatformServices } from "@/lib/hooks/use-platform-services"
import type { AppHealth } from "@/lib/app-observability"
import type { MonitoredApp } from "@/lib/monitored-apps"
import type { PlatformServiceSnapshot } from "@/lib/platform-services"

const categoryLabels: Record<string, string> = {
  "student-information-system": "Legacy Platform",
  "wallet-platform": "Microservices",
  "resilience-lab": "HA Lab",
  "demo-app": "Demo App",
}

const categoryStyles: Record<string, string> = {
  "student-information-system": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300",
  "wallet-platform": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300",
  "resilience-lab": "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300",
  "demo-app": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300",
}

function statusStyles(status: AppHealth["status"] = "unknown") {
  switch (status) {
    case "healthy":
      return {
        badge: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400",
        dot: "bg-green-500",
        icon: <CheckCircle className="h-4 w-4" />,
      }
    case "degraded":
      return {
        badge: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400",
        dot: "bg-yellow-500",
        icon: <AlertTriangle className="h-4 w-4" />,
      }
    case "down":
      return {
        badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
        dot: "bg-red-500",
        icon: <AlertTriangle className="h-4 w-4" />,
      }
    default:
      return {
        badge: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
        dot: "bg-gray-400",
        icon: <Clock className="h-4 w-4" />,
      }
  }
}

function ManagedAppLabel({ app, health }: { app: MonitoredApp; health?: AppHealth }) {
  const healthStatus = health?.status || "unknown"
  const styles = statusStyles(healthStatus)
  const primaryEndpoint = health?.primaryEndpoint
  const upEndpoints = health?.endpoints.filter((endpoint) => endpoint.status === "up").length
  const totalEndpoints = health?.endpoints.length || app.observability.endpoints.length
  const latencyMs = primaryEndpoint?.latencySeconds != null
    ? `${Math.round(primaryEndpoint.latencySeconds * 1000)}ms`
    : "Waiting"

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18 }}>
      <Link href={`/services/${app.id}`} className="block h-full group" aria-label={`Open ${app.name} operator page`}>
        <Card className="h-full border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-emerald-300 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:hover:border-emerald-700">
          <CardHeader className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={categoryStyles[app.category] || categoryStyles["demo-app"]}
                  >
                    {categoryLabels[app.category] || app.category}
                  </Badge>
                  <Badge variant="outline" className={styles.badge}>
                    <span className={`mr-1.5 h-2 w-2 rounded-full ${styles.dot}`} />
                    {healthStatus}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                  {app.name}
                </CardTitle>
                <CardDescription className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  {app.description}
                </CardDescription>
              </div>
              <div className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 transition-colors group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 p-5 pt-0 text-sm">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-500">Endpoints</p>
              <p className="mt-1 font-semibold text-gray-950 dark:text-white">
                {upEndpoints ?? 0}/{totalEndpoints} up
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-500">Latency</p>
              <p className="mt-1 font-semibold text-gray-950 dark:text-white">{latencyMs}</p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

function platformStatusStyles(status: PlatformServiceSnapshot["status"]) {
  return status === "up"
    ? {
      badge: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400",
      dot: "bg-green-500",
      label: "Up",
    }
    : {
      badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
      dot: "bg-red-500",
      label: "Down",
    }
}

function formatResponseTime(value: number | null) {
  if (value == null) return "No response"
  return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`
}

function latestVersionLabel(service: PlatformServiceSnapshot) {
  if (service.latestVersion !== "Unknown") return `v${service.latestVersion}`
  if (service.latestVersionStatus === "rate_limited") return "Rate limited"
  if (service.latestVersionStatus === "unavailable") return "Check unavailable"
  return "Not checked"
}

function versionCheckLabel(service: PlatformServiceSnapshot) {
  if (service.updateAvailable) return "Update available"
  if (service.latestVersionStatus === "rate_limited") return "Rate limited"
  if (service.latestVersionStatus === "unavailable") return "Check unavailable"
  return "Version checked"
}

function PlatformServiceLabel({ service, index }: { service: PlatformServiceSnapshot; index: number }) {
  const styles = platformStatusStyles(service.status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      whileHover={{ y: -3 }}
    >
      <Card className="h-full border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-sky-300 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:hover:border-sky-700">
        <CardHeader className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={service.group === "Monitoring"
                    ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-900/20 dark:text-sky-300"
                    : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-300"}
                >
                  {service.group}
                </Badge>
                <Badge variant="outline" className={styles.badge}>
                  <span className={`mr-1.5 h-2 w-2 rounded-full ${styles.dot}`} />
                  {styles.label}
                </Badge>
              </div>
              <CardTitle className="text-lg font-bold tracking-tight text-gray-950 dark:text-white">
                {service.name}
              </CardTitle>
              <CardDescription className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                {service.description}
              </CardDescription>
            </div>
            <div className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              {service.status === "up" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-500">Current</p>
              <p className="mt-1 font-semibold text-gray-950 dark:text-white">v{service.currentVersion}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-500">Latest</p>
              <p className="mt-1 font-semibold text-gray-950 dark:text-white">
                {latestVersionLabel(service)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/40">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatResponseTime(service.responseTimeMs)}
            </span>
            <Badge
              variant="outline"
              className={service.updateAvailable
                ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-900/20 dark:text-orange-300"
                : service.latestVersionStatus === "checked"
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300"
                  : "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300"}
            >
              {versionCheckLabel(service)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 bg-white dark:bg-gray-900">
              <Link href={service.publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </Link>
            </Button>
            <Button asChild variant={service.updateAvailable ? "default" : "outline"} size="sm" className="gap-1.5">
              <Link href={service.releaseUrl} target="_blank" rel="noreferrer">
                <RefreshCw className="h-3.5 w-3.5" />
                Check Update
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function ServicesPage() {
  const {
    apps,
    summary: appSummary,
    loading: appsLoading,
    error: appsError,
    refresh: refreshApps,
  } = useMonitoredApps()
  const {
    health: appHealth,
    summary: appHealthSummary,
    loading: appHealthLoading,
    error: appHealthError,
    refresh: refreshAppHealth,
  } = useAppHealth()
  const {
    services: platformServices,
    summary: platformSummary,
    loading: platformLoading,
    error: platformError,
    refresh: refreshPlatformServices,
  } = usePlatformServices()

  const loading = appsLoading || appHealthLoading || platformLoading
  const healthyCount = appHealthSummary?.healthyApps ?? 0
  const totalApps = appHealthSummary?.totalApps ?? appSummary?.totalApps ?? apps.length

  const handleRefresh = () => {
    refreshApps()
    refreshAppHealth()
    refreshPlatformServices()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 px-3 py-5 dark:from-gray-950 dark:via-gray-950 dark:to-emerald-950/20 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 sm:p-8"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                <Server className="h-3.5 w-3.5" />
                Managed Apps
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
                Choose an app to operate.
              </h1>
              <p className="mt-3 text-base leading-7 text-gray-600 dark:text-gray-400">
                This page is now the simple control-plane launch board. Click an app label to open its
                operator page with probe latency, uptime, alerts, recent logs, and guidance.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950/40">
                <div className="flex items-center gap-2 font-semibold text-gray-950 dark:text-white">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  {healthyCount}/{totalApps} healthy
                </div>
                <p className="mt-1 text-xs text-gray-500">Live app snapshot</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className="h-11 gap-2 rounded-xl bg-white dark:bg-gray-900"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
              <Button asChild size="sm" className="h-11 gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
                <Link href="/services/compare">
                  <BarChart3 className="h-4 w-4" />
                  Compare Apps
                </Link>
              </Button>
            </div>
          </div>
        </motion.header>

        {(appsError || appHealthError || platformError) && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            {appsError || appHealthError || platformError}
          </div>
        )}

        {loading && apps.length === 0 ? (
          <div className="flex items-center justify-center rounded-3xl border border-gray-200 bg-white py-16 dark:border-gray-800 dark:bg-gray-900">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {apps.map((app, index) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
              >
                <ManagedAppLabel
                  app={app}
                  health={appHealth.find((item) => item.appId === app.id)}
                />
              </motion.div>
            ))}
          </section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 sm:p-6"
        >
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300">
                <Activity className="h-3.5 w-3.5" />
                Monitoring and Logging
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white">
                Platform services
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                Live status, service links, current versions, and release checks for the observability layer
                that supports every managed app.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950/40">
                <div className="flex items-center gap-2 font-semibold text-gray-950 dark:text-white">
                  <CheckCircle className="h-4 w-4 text-sky-500" />
                  {platformSummary?.up ?? 0}/{platformSummary?.total ?? platformServices.length} up
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {platformSummary?.updatesAvailable ?? 0} updates available
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPlatformServices}
                disabled={platformLoading}
                className="h-11 gap-2 rounded-xl bg-white dark:bg-gray-900"
              >
                {platformLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Check Updates
              </Button>
            </div>
          </div>

          {platformLoading && platformServices.length === 0 ? (
            <div className="flex items-center justify-center rounded-3xl border border-gray-200 bg-white py-14 dark:border-gray-800 dark:bg-gray-950/40">
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {platformServices.map((service, index) => (
                <PlatformServiceLabel key={service.id} service={service} index={index} />
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  )
}
