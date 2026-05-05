"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePlatformServices } from "@/lib/hooks/use-platform-services"
import type { PlatformServiceSnapshot } from "@/lib/platform-services"

const repositoryUrl = "https://github.com/eseosaiyangbe/internal-developer-platform"

function statusClass(service: PlatformServiceSnapshot) {
  if (service.status === "down") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
  }

  if (service.updateAvailable) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
}

function serviceStatusLabel(service: PlatformServiceSnapshot) {
  if (service.status === "down") return "Down"
  if (service.updateAvailable) return "Update available"
  if (service.latestVersionStatus === "rate_limited") return "Rate limited"
  if (service.latestVersionStatus === "unavailable") return "Check unavailable"
  return "Current"
}

function latestVersionLabel(service: PlatformServiceSnapshot) {
  if (service.latestVersion !== "Unknown") return service.latestVersion
  if (service.latestVersionStatus === "rate_limited") return "Rate limited"
  if (service.latestVersionStatus === "unavailable") return "Check unavailable"
  return "Not checked"
}

function formatChecked(value: string | null) {
  if (!value) return "Not checked yet"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not checked yet" : date.toLocaleString()
}

function VersionServiceCard({ service, index }: { service: PlatformServiceSnapshot; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-gray-950 dark:text-white">{service.name}</h3>
            <Badge variant="outline" className={statusClass(service)}>
              {serviceStatusLabel(service)}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">{service.description}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">Current</p>
          <p className="mt-1 font-mono text-sm font-bold text-gray-950 dark:text-white">{service.currentVersion}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">Latest</p>
          <p className="mt-1 font-mono text-sm font-bold text-gray-950 dark:text-white">{latestVersionLabel(service)}</p>
          {service.latestVersionError && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{service.latestVersionError}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-500">
        <span>{service.group}</span>
        <span>{service.responseTimeMs == null ? "No probe time" : `${service.responseTimeMs}ms probe`}</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a href={service.publicUrl} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl bg-white dark:bg-gray-950">
            Open service
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
        <a href={service.releaseUrl} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl bg-white dark:bg-gray-950">
            Releases
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
      </div>
    </motion.article>
  )
}

export default function VersionPage() {
  const { services, summary, lastUpdated, loading, error, refresh } = usePlatformServices()
  const monitoringServices = services.filter((service) => service.group === "Monitoring")
  const loggingServices = services.filter((service) => service.group === "Logging")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-3 py-5 dark:from-gray-950 dark:via-gray-950 dark:to-blue-950/30 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <a href={repositoryUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-2 rounded-xl bg-white dark:bg-gray-900">
                GitHub repo
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2 rounded-xl bg-white dark:bg-gray-900">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader className="border-b border-blue-100 bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-500 p-6 text-white dark:border-gray-800 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <Badge className="mb-4 border-white/30 bg-white/15 text-white">
                  <PackageCheck className="mr-1 h-3 w-3" />
                  Live platform inventory
                </Badge>
                <CardTitle className="text-3xl font-bold tracking-tight sm:text-5xl">Platform Versions</CardTitle>
                <CardDescription className="mt-4 max-w-2xl text-base leading-7 text-blue-50">
                  Real version, health, and update checks for the monitoring and logging services that support the managed apps.
                </CardDescription>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/15 p-4 text-sm text-blue-50 backdrop-blur">
                <p className="font-semibold text-white">Last checked</p>
                <p className="mt-1">{formatChecked(lastUpdated)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Services</p>
              <p className="mt-1 text-3xl font-black text-gray-950 dark:text-white">{summary?.total ?? services.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Healthy</p>
              <p className="mt-1 text-3xl font-black text-emerald-700 dark:text-emerald-300">{summary?.up ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Down</p>
              <p className="mt-1 text-3xl font-black text-red-700 dark:text-red-300">{summary?.down ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Updates</p>
              <p className="mt-1 text-3xl font-black text-amber-700 dark:text-amber-300">{summary?.updatesAvailable ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="flex items-center gap-3 p-5 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              {error}
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">Monitoring</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {monitoringServices.map((service, index) => (
              <VersionServiceCard key={service.id} service={service} index={index} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-600" />
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">Logging</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {loggingServices.map((service, index) => (
              <VersionServiceCard key={service.id} service={service} index={index} />
            ))}
          </div>
        </section>

        {!loading && services.length === 0 && !error && (
          <Card className="border-dashed border-gray-300 bg-white dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center text-gray-500">
              <CheckCircle className="h-8 w-8" />
              No platform service data returned yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
