"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  GitBranch,
  Layers,
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AppHealth } from "@/lib/app-observability"
import { useAppHealth } from "@/lib/hooks/use-app-health"
import { useMonitoredApps } from "@/lib/hooks/use-monitored-apps"
import type { MonitoredApp } from "@/lib/monitored-apps"

const categoryLabels: Record<string, string> = {
  "student-information-system": "Legacy Platform",
  "wallet-platform": "Microservices",
  "resilience-lab": "HA Lab",
  "demo-app": "Reference Workload",
}

const categoryStyles: Record<string, string> = {
  "student-information-system": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  "wallet-platform": "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300",
  "resilience-lab": "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300",
  "demo-app": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
}

const appProfiles: Record<string, {
  demoRole: string
  operatorValue: string
  k8sFocus: string
  liveAudit: string
  risk: string
}> = {
  opensis: {
    demoRole: "Legacy modernization story",
    operatorValue: "Shows how an older PHP platform can be wrapped with health checks, Vault dependency awareness, and controlled access.",
    k8sFocus: "Namespace isolation, secret injection, database readiness, and service-level probes.",
    liveAudit: "./scripts/devops-monitor.sh opensis-live",
    risk: "Legacy app behavior can be fragile, so platform checks must be explicit and repeatable.",
  },
  swiftpay: {
    demoRole: "Flagship microservices story",
    operatorValue: "Shows gateway health, wallet services, transaction flow, async dependencies, business telemetry, and the second real k3s migration slice.",
    k8sFocus: "Service discovery, per-service health probes, queue dependency checks, migration jobs, and horizontal scaling boundaries.",
    liveAudit: "./scripts/devops-monitor.sh swiftpay-live",
    risk: "Multiple services can fail independently, so operators need fast dependency mapping and clear infrastructure contracts.",
  },
  foodpulse: {
    demoRole: "Resilience and failover story",
    operatorValue: "Shows both the Compose-era HAProxy lab and the owned k3s path with CloudNativePG plus Sentinel-aware Redis failover.",
    k8sFocus: "Stateful dependencies, operator-managed Postgres, Sentinel-aware Redis discovery, readiness gates, and topology-aware recovery.",
    liveAudit: "./scripts/devops-monitor.sh foodpulse-live",
    risk: "Resilience stories become misleading if Compose teaching paths and Kubernetes platform paths are mixed together without explicit operator guidance.",
  },
  memflip: {
    demoRole: "Onboarding plus first k3s slice",
    operatorValue: "Shows the minimum frontend/backend integration pattern and proves the first real workload migration into the local k3s cluster.",
    k8sFocus: "Repeatable deploy and verify workflow, ingress on Traefik, explicit network policy, and a reusable small-service contract.",
    liveAudit: "./scripts/devops-monitor.sh memflip-live",
    risk: "Simple apps are easy to under-document, which makes migration templates drift unless deploy and verification steps stay explicit.",
  },
}

function statusStyles(status: AppHealth["status"] = "unknown") {
  switch (status) {
    case "healthy":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
    case "degraded":
      return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300"
    case "down":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
    default:
      return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
}

function formatLatency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "Waiting"
  return `${Math.round(value * 1000)}ms`
}

function ownershipLabel(app: MonitoredApp) {
  return app.ownership === "owned" ? "Owned workload" : "Integrated public repo"
}

function AppComparisonCard({
  app,
  health,
  index,
}: {
  app: MonitoredApp
  health?: AppHealth
  index: number
}) {
  const profile = appProfiles[app.id]
  const status = health?.status || "unknown"
  const primaryEndpoint = health?.primaryEndpoint
  const upEndpoints = health?.endpoints.filter((endpoint) => endpoint.status === "up").length ?? 0
  const totalEndpoints = health?.endpoints.length || app.observability.endpoints.length
  const browserUrl = primaryEndpoint?.browserUrl || app.observability.endpoints.find((endpoint) => endpoint.browserUrl)?.browserUrl

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className="h-full overflow-hidden border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-br from-white to-slate-50 p-5 dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={categoryStyles[app.category] || categoryStyles["demo-app"]}>
              {categoryLabels[app.category] || app.category}
            </Badge>
            <Badge variant="outline" className={statusStyles(status)}>
              {status}
            </Badge>
          </div>
          <div>
            <CardTitle className="mt-4 text-2xl font-black tracking-tight text-gray-950 dark:text-white">
              {app.name}
            </CardTitle>
            <CardDescription className="mt-2 min-h-[3rem] leading-6">
              {profile?.demoRole || app.description}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Endpoints</p>
              <p className="mt-1 text-lg font-black text-gray-950 dark:text-white">{upEndpoints}/{totalEndpoints}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Latency</p>
              <p className="mt-1 text-lg font-black text-gray-950 dark:text-white">{formatLatency(primaryEndpoint?.latencySeconds)}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-gray-600 dark:text-gray-400">{ownershipLabel(app)}</span>
            </div>
            <div className="flex items-start gap-3">
              <Network className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span className="text-gray-600 dark:text-gray-400">
                Namespace: <strong className="text-gray-950 dark:text-white">{app.kubernetes.namespace}</strong>
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Layers className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-gray-600 dark:text-gray-400">{profile?.operatorValue || app.description}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Kubernetes direction</p>
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">{profile?.k8sFocus}</p>
          </div>

          <div className="rounded-2xl bg-gray-950 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Live audit command</p>
            <code className="block break-words text-xs leading-5 text-gray-100">{profile?.liveAudit || app.runbooks.healthCheck}</code>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            <strong>Operator risk:</strong> {profile?.risk}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="gap-2 bg-white dark:bg-gray-950">
              <Link href={`/services/${app.id}`}>
                Operator Page
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {browserUrl && (
              <Button asChild className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                <Link href={browserUrl} target="_blank" rel="noreferrer">
                  Live App
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function ServiceComparisonPage() {
  const {
    apps,
    summary: appSummary,
    loading: appsLoading,
    error: appsError,
    refresh: refreshApps,
  } = useMonitoredApps()
  const {
    health,
    summary: healthSummary,
    loading: healthLoading,
    error: healthError,
    refresh: refreshHealth,
  } = useAppHealth()

  const loading = appsLoading || healthLoading
  const error = appsError || healthError

  const handleRefresh = () => {
    refreshApps()
    refreshHealth()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 px-3 py-5 dark:from-gray-950 dark:via-gray-950 dark:to-emerald-950/20 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/services" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <ArrowLeft className="h-4 w-4" />
            Managed apps
          </Link>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="h-11 gap-2 rounded-xl bg-white dark:bg-gray-900">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 p-6 text-white dark:border-gray-800 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <Badge className="mb-4 border-white/30 bg-white/15 text-white">
                  <GitBranch className="mr-1 h-3 w-3" />
                  Mixed-architecture story
                </Badge>
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Compare Managed Apps</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50">
                  A single operator view that explains why each workload exists, what it teaches,
                  what is live right now, and how the Compose model maps toward Kubernetes.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[32rem]">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-emerald-50">Apps</p>
                  <p className="mt-1 text-2xl font-black">{appSummary?.totalApps ?? apps.length}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-emerald-50">Healthy</p>
                  <p className="mt-1 text-2xl font-black">{healthSummary?.healthyApps ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-emerald-50">Endpoints</p>
                  <p className="mt-1 text-2xl font-black">{appSummary?.endpoints ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-emerald-50">Owned</p>
                  <p className="mt-1 text-2xl font-black">{appSummary?.ownedApps ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Card className="border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-5">
              <Activity className="mb-3 h-5 w-5 text-emerald-600" />
              <p className="text-sm text-gray-500">Health model</p>
              <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                Blackbox probes and app-specific APIs give the comparison page live status instead of static labels.
              </p>
            </CardContent>
          </Card>
          <Card className="border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-5">
              <Layers className="mb-3 h-5 w-5 text-blue-600" />
              <p className="text-sm text-gray-500">Architecture model</p>
              <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                Each workload has a clear role: microservices, legacy platform, HA lab, or onboarding app.
              </p>
            </CardContent>
          </Card>
          <Card className="border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-5">
              <Network className="mb-3 h-5 w-5 text-teal-600" />
              <p className="text-sm text-gray-500">Kubernetes model</p>
              <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                Namespaces, labels, probes, and dependency boundaries are visible before migration.
              </p>
            </CardContent>
          </Card>
          <Card className="border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-5">
              <BookOpen className="mb-3 h-5 w-5 text-amber-600" />
              <p className="text-sm text-gray-500">Demo model</p>
              <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                The page gives presenters a fast way to explain why the workspace has four different apps.
              </p>
            </CardContent>
          </Card>
        </section>

        {loading && apps.length === 0 ? (
          <div className="flex items-center justify-center rounded-3xl border border-gray-200 bg-white py-16 dark:border-gray-800 dark:bg-gray-900">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {apps.map((app, index) => (
              <AppComparisonCard
                key={app.id}
                app={app}
                health={health.find((item) => item.appId === app.id)}
                index={index}
              />
            ))}
          </section>
        )}

        <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              Presenter Path
            </CardTitle>
            <CardDescription>Use this order when explaining the workspace to someone new.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {["Start with SwiftPay for microservices", "Open OpenSIS for legacy modernization", "Use FoodPulse for resilience", "Close with MemFlip for onboarding"].map((step, index) => (
              <div key={step} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-emerald-600">Step {index + 1}</p>
                <p className="text-sm font-semibold leading-6 text-gray-950 dark:text-white">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
