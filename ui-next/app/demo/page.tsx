"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Clipboard,
  ClipboardCheck,
  Compass,
  ExternalLink,
  Gauge,
  GitBranch,
  Layers,
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppHealth } from "@/lib/hooks/use-app-health"
import { useMonitoredApps } from "@/lib/hooks/use-monitored-apps"

const repositoryUrl = "https://github.com/eseosaiyangbe/Obervability-Stack/blob/main"

const checklist = [
  {
    title: "Clean working tree",
    command: "git status --short",
    expected: "No output before a formal demo or commit handoff.",
  },
  {
    title: "Operator first check",
    command: "./scripts/devops-monitor.sh operator",
    expected: "Checks passed, inventory validation passed, and all managed apps healthy.",
  },
  {
    title: "If baseline fails",
    command: "./scripts/devops-monitor.sh health && ./scripts/devops-monitor.sh inventory",
    expected: "Use the health and inventory outputs before starting the walkthrough.",
  },
]

const demoSteps = [
  {
    title: "Start With The Platform",
    label: "Control plane",
    href: "/dashboard",
    command: "http://localhost:4000",
    talkingPoint: "This is a control plane for a mixed-architecture workspace, not a dashboard pasted onto one app.",
    icon: Compass,
  },
  {
    title: "Compare The Workloads",
    label: "Architecture story",
    href: "/services/compare",
    command: "Open /services/compare",
    talkingPoint: "Explain why the workspace includes microservices, a legacy platform, a resilience lab, and a small onboarding app.",
    icon: Layers,
  },
  {
    title: "Show SwiftPay",
    label: "Microservices",
    href: "/services/swiftpay",
    command: "./scripts/devops-monitor.sh swiftpay-live",
    talkingPoint: "Use SwiftPay to explain money movement, service health, async workers, business telemetry, and the second real k3s migration slice.",
    icon: Network,
  },
  {
    title: "Show OpenSIS",
    label: "Legacy modernization",
    href: "/services/opensis",
    command: "./scripts/devops-monitor.sh opensis-live",
    talkingPoint: "Use OpenSIS to explain wrapping a legacy PHP app with Vault, database checks, and Kubernetes thinking.",
    icon: ShieldCheck,
  },
  {
    title: "Show FoodPulse",
    label: "Resilience lab",
    href: "/services/foodpulse",
    command: "./scripts/devops-monitor.sh foodpulse-live",
    talkingPoint: "Use FoodPulse to explain the Compose HAProxy lab, the k3s CloudNativePG plus Redis Sentinel path, and how resilience changes across environments.",
    icon: Activity,
  },
  {
    title: "Show MemFlip",
    label: "Onboarding pattern",
    href: "/services/memflip",
    command: "./scripts/devops-monitor.sh memflip-live",
    talkingPoint: "Use MemFlip to show the smallest repeatable integration pattern and the first real k3s migration slice in the workspace.",
    icon: Gauge,
  },
  {
    title: "Open Incident Drills",
    label: "Operational proof",
    href: `${repositoryUrl}/docs/INCIDENT_DRILLS.md`,
    external: true,
    command: "Open docs/INCIDENT_DRILLS.md",
    talkingPoint: "These incidents were executed and documented, not invented after the fact.",
    icon: AlertTriangle,
  },
  {
    title: "Close With Kubernetes",
    label: "Future direction",
    href: `${repositoryUrl}/WORKSPACE-ARCHITECTURE.md`,
    external: true,
    command: "Open WORKSPACE-ARCHITECTURE.md",
    talkingPoint: "Compose is the proving ground. Kubernetes is the destination.",
    icon: GitBranch,
  },
]

const workloadRoles = [
  {
    name: "SwiftPay",
    role: "Microservices",
    summary: "Money movement, async workers, service health, business telemetry, and the second reusable k3s migration path.",
  },
  {
    name: "OpenSIS",
    role: "Legacy platform",
    summary: "Legacy PHP platform wrapped with Vault, database checks, and platform operations.",
  },
  {
    name: "FoodPulse",
    role: "Resilience lab",
    summary: "Compose HAProxy drills plus a real k3s path with CloudNativePG, Redis Sentinel, topology awareness, and failover behavior.",
  },
  {
    name: "MemFlip",
    role: "Onboarding app",
    summary: "Small frontend/backend app that shows the minimum control-plane pattern and the first reusable k3s migration path.",
  },
]

function statusClass(status: string) {
  if (status === "healthy") return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
  if (status === "degraded") return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300"
  if (status === "down") return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
  return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
}

function CommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="rounded-2xl bg-gray-950 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Command</span>
        <button
          type="button"
          onClick={copyCommand}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
        >
          {copied ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="block break-words text-xs leading-5 text-gray-100">{command}</code>
    </div>
  )
}

export default function DemoCenterPage() {
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
  const totalApps = healthSummary?.totalApps ?? appSummary?.totalApps ?? apps.length
  const healthyApps = healthSummary?.healthyApps ?? health.filter((app) => app.status === "healthy").length
  const demoReady = totalApps > 0 && healthyApps === totalApps && !error

  const appHealthById = useMemo(() => {
    return new Map(health.map((item) => [item.appId, item]))
  }, [health])

  const handleRefresh = () => {
    refreshApps()
    refreshHealth()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 px-3 py-5 dark:from-gray-950 dark:via-gray-950 dark:to-cyan-950/20 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="border-b border-cyan-100 bg-gradient-to-r from-slate-950 via-cyan-900 to-emerald-800 p-6 text-white dark:border-gray-800 sm:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <Badge className="mb-4 border-white/30 bg-white/15 text-white">
                  <Compass className="mr-1 h-3 w-3" />
                  Phase 6 demo path
                </Badge>
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Demo Center</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-cyan-50">
                  A guided presenter path for showing the control plane, app comparison, live audits,
                  incident evidence, and Kubernetes direction without jumping between repos manually.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 xl:min-w-[34rem]">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-cyan-50">Demo state</p>
                  <p className="mt-1 text-lg font-black">{demoReady ? "Ready" : "Check"}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-cyan-50">Apps</p>
                  <p className="mt-1 text-lg font-black">{healthyApps}/{totalApps || 0}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-cyan-50">Endpoints</p>
                  <p className="mt-1 text-lg font-black">{appSummary?.endpoints ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-cyan-50">Flow</p>
                  <p className="mt-1 text-lg font-black">{demoSteps.length} steps</p>
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

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className={demoReady
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20"
            : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"}
          >
            <CardContent className="flex items-start gap-4 p-5">
              {demoReady ? (
                <CheckCircle className="mt-1 h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              ) : (
                <AlertTriangle className="mt-1 h-6 w-6 text-amber-700 dark:text-amber-300" />
              )}
              <div>
                <p className="font-bold text-gray-950 dark:text-white">
                  {demoReady ? "Environment looks safe to demo" : "Review baseline before presenting"}
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                  Live health currently reports {healthyApps}/{totalApps || 0} managed apps healthy.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-bold text-gray-950 dark:text-white">Refresh live demo signals</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Pulls the latest app inventory and health snapshot used by this page.
                </p>
              </div>
              <Button onClick={handleRefresh} disabled={loading} className="gap-2 rounded-xl bg-cyan-700 text-white hover:bg-cyan-800">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TerminalSquare className="h-5 w-5 text-cyan-700" />
                Pre-Demo Checklist
              </CardTitle>
              <CardDescription>Run these checks before presenting the workspace.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {checklist.map((item) => (
                <div key={item.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                  <p className="font-bold text-gray-950 dark:text-white">{item.title}</p>
                  <p className="mt-2 min-h-[3rem] text-sm leading-6 text-gray-600 dark:text-gray-400">{item.expected}</p>
                  <div className="mt-4">
                    <CommandBlock command={item.command} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyan-700" />
                Live App Snapshot
              </CardTitle>
              <CardDescription>Current app health from the control-plane API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {apps.map((app) => {
                const snapshot = appHealthById.get(app.id)
                const status = snapshot?.status || "unknown"
                return (
                  <div key={app.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
                    <div>
                      <p className="font-semibold text-gray-950 dark:text-white">{app.name}</p>
                      <p className="text-xs text-gray-500">{app.category}</p>
                    </div>
                    <Badge variant="outline" className={statusClass(status)}>
                      {status}
                    </Badge>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          {workloadRoles.map((workload) => (
            <Card key={workload.name} className="border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <CardContent className="p-5">
                <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300">
                  {workload.role}
                </Badge>
                <p className="mt-4 text-xl font-black text-gray-950 dark:text-white">{workload.name}</p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">{workload.summary}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {demoSteps.map((step, index) => {
            const StepIcon = step.icon
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
              >
                <Card className="h-full border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-700 to-emerald-600 text-white">
                          <StepIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <Badge variant="outline" className="mb-3 border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                            Step {index + 1} | {step.label}
                          </Badge>
                          <CardTitle>{step.title}</CardTitle>
                          <CardDescription className="mt-2 leading-6">{step.talkingPoint}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CommandBlock command={step.command} />
                    <Button asChild variant="outline" className="gap-2 bg-white dark:bg-gray-950">
                      <Link href={step.href} target={step.external ? "_blank" : undefined} rel={step.external ? "noreferrer" : undefined}>
                        Open
                        {step.external ? <ExternalLink className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </section>

        <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-cyan-700" />
              Reference Documents
            </CardTitle>
            <CardDescription>Keep the UI demo tied to the documented engineering journey.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {[
              ["Demo Walkthrough", `${repositoryUrl}/DEMO-WALKTHROUGH.md`],
              ["Journey Runbook", `${repositoryUrl}/JOURNEY-RUNBOOK.md`],
              ["Incident Drills", `${repositoryUrl}/docs/INCIDENT_DRILLS.md`],
              ["Architecture", `${repositoryUrl}/WORKSPACE-ARCHITECTURE.md`],
            ].map(([label, href]) => (
              <Button key={label} asChild variant="outline" className="justify-between gap-2 bg-white dark:bg-gray-950">
                <Link href={href} target="_blank" rel="noreferrer">
                  {label}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
