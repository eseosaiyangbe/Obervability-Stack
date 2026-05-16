"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Activity, ArrowRight, BookOpen, GitBranch, Layers, ShieldCheck, TerminalSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const repositoryUrl = "https://github.com/eseosaiyangbe/internal-developer-platform/blob/main"

function authRedirect(path: string) {
  return `/auth/signin?from=${encodeURIComponent(path)}`
}

const workloadCards = [
  {
    name: "SwiftPay",
    role: "Payments Platform",
    summary: "Distributed payment services with gateway, wallet, transaction, notification, and operational telemetry under one governed runtime.",
  },
  {
    name: "OpenSIS",
    role: "Student Information System",
    summary: "A legacy education platform brought under controlled operations with secrets management, health visibility, and repeatable recovery paths.",
  },
  {
    name: "FoodPulse",
    role: "Resilience Platform",
    summary: "A stateful application portfolio used to exercise Redis, PostgreSQL, and high-availability recovery patterns in a realistic operating model.",
  },
  {
    name: "MemFlip",
    role: "Portfolio Workload",
    summary: "A smaller owned service that proves the repeatable integration pattern for onboarding and operating application workloads through the same platform.",
  },
]

const quickLinks = [
  {
    title: "View Managed Apps",
    description: "Review the service portfolio for OpenSIS, SwiftPay, FoodPulse, and MemFlip from one operator entrypoint.",
    href: authRedirect("/services"),
    icon: Layers,
  },
  {
    title: "Read The Journey",
    description: "Follow the full engineering and incident trail behind the platform.",
    href: `${repositoryUrl}/JOURNEY-RUNBOOK.md`,
    icon: BookOpen,
    external: true,
  },
  {
    title: "Platform Architecture",
    description: "Review the architecture and operating direction behind the platform portfolio.",
    href: `${repositoryUrl}/WORKSPACE-ARCHITECTURE.md`,
    icon: GitBranch,
    external: true,
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34%),linear-gradient(135deg,#f8fafc,#ffffff_45%,#eef2ff)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.22),_transparent_32%),linear-gradient(135deg,#020617,#0f172a_48%,#111827)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden rounded-3xl border border-gray-200 bg-white/90 shadow-xl backdrop-blur dark:border-gray-800 dark:bg-gray-950/80"
        >
          <div className="border-b border-blue-100 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-6 text-white dark:border-gray-800 sm:p-10">
            <div className="flex flex-col gap-6">
              <div className="max-w-3xl">
                <Badge className="mb-4 border-white/20 bg-white/10 text-white">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Internal Developer Platform
                </Badge>
                <h1 className="text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  One control plane for an owned application portfolio
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg">
                  This platform brings payments, education, resilience, and portfolio workloads into one
                  professional operator experience with shared observability, incident evidence, recovery
                  controls, and service-level governance.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">
                  Platform Mission
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950 dark:text-white">
                  Start with the control plane, then move directly into the workload that matters
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-400 sm:text-base">
                  The landing experience should explain the portfolio clearly, show that the platform is
                  operated intentionally, and let a reviewer move from high-level visibility to workload,
                  runbook, and operational evidence without needing side explanations.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="gap-2 rounded-2xl bg-blue-600 px-6 text-white hover:bg-blue-700">
                  <Link href={authRedirect("/dashboard")}>
                    Open Control Plane
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="gap-2 rounded-2xl bg-white dark:bg-gray-950">
                  <Link href={authRedirect("/services")}>
                    Service Portfolio
                    <Layers className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="gap-2 rounded-2xl bg-white dark:bg-gray-950">
                  <Link href="/auth/signin">
                    Sign In
                    <TerminalSquare className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {quickLinks.map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.08 * index }}
                  >
                    <Card className="h-full border-gray-200 bg-gray-50/80 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-blue-800">
                      <CardHeader className="pb-3">
                        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-lg text-gray-950 dark:text-white">{item.title}</CardTitle>
                        <CardDescription className="text-sm leading-6 text-gray-600 dark:text-gray-400">
                          {item.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button asChild variant="ghost" className="h-auto px-0 text-blue-700 hover:bg-transparent hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">
                          {item.external ? (
                            <a href={item.href} target="_blank" rel="noreferrer">
                              Open reference
                            </a>
                          ) : (
                            <Link href={item.href}>Open now</Link>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
                      Portfolio
                    </p>
                    <p className="mt-2 text-lg font-bold text-gray-950 dark:text-white">5 owned services</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      One platform team, one operating model, one shared control surface.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
                      Operations
                    </p>
                    <p className="mt-2 text-lg font-bold text-gray-950 dark:text-white">Metrics, logs, alerts</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Unified observability with runbooks, recovery evidence, and service ownership context.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
                      Runtime
                    </p>
                    <p className="mt-2 text-lg font-bold text-gray-950 dark:text-white">Compose and k3s</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Local developer workflows aligned with state-preserving Kubernetes lifecycle controls.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-gray-950 dark:text-white">
                  <Activity className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  Workload Storyboard
                </CardTitle>
                <CardDescription>
                  The platform exists to make each workload operable through one shared engineering and operator model.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {workloadCards.map((workload) => (
                  <div
                    key={workload.name}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold text-gray-950 dark:text-white">{workload.name}</p>
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
                        {workload.role}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                      {workload.summary}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
