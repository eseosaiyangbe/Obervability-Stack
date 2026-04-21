"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Activity,
  ArrowRight,
  Database,
  Loader2,
  Settings,
  Shield,
  UserCog,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AdminUsersSummary {
  totalUsers: number
  activeUsers: number
  disabledUsers: number
  admins: number
  editors: number
  viewers: number
  totalDashboards: number
  totalConfigs: number
}

const adminCards = [
  {
    title: "User Management",
    description: "Create operators, update roles, disable access, and manage account state.",
    href: "/admin/users",
    icon: Users,
    accent: "from-red-600 to-orange-500",
    status: "Live",
  },
  {
    title: "Roles And Access",
    description: "Review ADMIN, EDITOR, and VIEWER posture before deeper RBAC hardening.",
    href: "/admin/users",
    icon: Shield,
    accent: "from-blue-600 to-cyan-500",
    status: "Uses users",
  },
  {
    title: "Audit Logs",
    description: "Track admin actions such as role changes, disables, and password resets.",
    href: "/admin/audit",
    icon: Activity,
    accent: "from-amber-600 to-yellow-500",
    status: "Live",
  },
  {
    title: "System Settings",
    description: "Centralize platform auth mode, registration posture, and operator defaults.",
    href: "/settings",
    icon: Settings,
    accent: "from-slate-700 to-slate-500",
    status: "Settings",
  },
]

export default function AdminOverviewPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [summary, setSummary] = useState<AdminUsersSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = (session?.user as any)?.role === "ADMIN"

  useEffect(() => {
    if (sessionStatus === "authenticated" && !isAdmin) {
      router.push("/dashboard")
    }
  }, [isAdmin, router, sessionStatus])

  useEffect(() => {
    async function loadSummary() {
      if (sessionStatus !== "authenticated" || !isAdmin) return

      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/admin/users", { cache: "no-store" })
        const body = await response.json()

        if (!response.ok) {
          throw new Error(body.message || "Failed to load admin summary")
        }

        setSummary(body.summary || null)
      } catch (summaryError) {
        setError(summaryError instanceof Error ? summaryError.message : "Failed to load admin summary")
      } finally {
        setLoading(false)
      }
    }

    loadSummary()
  }, [isAdmin, sessionStatus])

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-8 text-center text-red-700 dark:text-red-300">
            <Shield className="mx-auto mb-4 h-12 w-12" />
            <h2 className="text-xl font-bold">Access denied</h2>
            <p className="mt-2 text-sm">You need admin privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 dark:from-gray-950 dark:via-gray-950 dark:to-red-950/20">
      <div className="mx-auto max-w-7xl space-y-6 px-3 py-5 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <CardHeader className="border-b border-red-100 bg-gradient-to-r from-red-700 via-orange-600 to-amber-500 p-6 text-white dark:border-gray-800 sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <Badge className="mb-4 border-white/30 bg-white/15 text-white">
                    <Shield className="mr-1 h-3 w-3" />
                    Admin overview
                  </Badge>
                  <CardTitle className="text-3xl font-bold tracking-tight sm:text-5xl">Admin Panel</CardTitle>
                  <CardDescription className="mt-4 max-w-2xl text-base leading-7 text-red-50">
                    A light control center for access management, operator settings, and the admin capabilities we are building into the platform.
                  </CardDescription>
                </div>
                <Button asChild className="gap-2 rounded-xl bg-gray-950 text-white hover:bg-gray-800">
                  <Link href="/admin/users">
                    Open user management
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="p-4 text-red-700 dark:text-red-300">{error}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-5">
              <Users className="mb-3 h-5 w-5 text-red-600" />
              <p className="text-sm text-gray-500">Total users</p>
              <p className="mt-1 text-3xl font-black text-gray-950 dark:text-white">
                {loading ? "..." : summary?.totalUsers ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">
            <CardContent className="p-5">
              <UserCog className="mb-3 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Active users</p>
              <p className="mt-1 text-3xl font-black text-emerald-700 dark:text-emerald-300">
                {loading ? "..." : summary?.activeUsers ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardContent className="p-5">
              <Shield className="mb-3 h-5 w-5 text-blue-700 dark:text-blue-300" />
              <p className="text-sm text-blue-700 dark:text-blue-300">Admins</p>
              <p className="mt-1 text-3xl font-black text-blue-700 dark:text-blue-300">
                {loading ? "..." : summary?.admins ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-5">
              <Database className="mb-3 h-5 w-5 text-slate-700 dark:text-slate-300" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Configs / dashboards</p>
              <p className="mt-1 text-3xl font-black text-slate-800 dark:text-slate-200">
                {loading ? "..." : `${summary?.totalConfigs ?? 0}/${summary?.totalDashboards ?? 0}`}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {adminCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card className="h-full border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white`}>
                        <card.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{card.title}</CardTitle>
                        <CardDescription className="mt-2 leading-6">{card.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline">{card.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="gap-2 bg-white dark:bg-gray-950">
                    <Link href={card.href}>
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
