"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock,
  KeyRound,
  Loader2,
  Shield,
  UserCog,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AdminAuditAction =
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DISABLED"
  | "USER_REACTIVATED"
  | "ROLE_CHANGED"
  | "STATUS_CHANGED"
  | "PASSWORD_CHANGED"
  | "ACTION_BLOCKED"

interface AdminAuditEvent {
  id: string
  action: AdminAuditAction
  actorEmail: string | null
  targetUserEmail: string | null
  message: string
  createdAt: string
}

interface AdminAuditSummary {
  totalEvents: number
  blockedActions: number
  userChanges: number
  passwordChanges: number
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString()
}

function actionClass(action: AdminAuditAction) {
  if (action === "ACTION_BLOCKED") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
  }
  if (action === "PASSWORD_CHANGED") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
  }
  if (action === "USER_DISABLED") {
    return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
}

function actionLabel(action: AdminAuditAction) {
  return action.toLowerCase().replace(/_/g, " ")
}

export default function AdminAuditPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<AdminAuditEvent[]>([])
  const [summary, setSummary] = useState<AdminAuditSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = (session?.user as any)?.role === "ADMIN"

  useEffect(() => {
    if (sessionStatus === "authenticated" && !isAdmin) {
      router.push("/dashboard")
    }
  }, [isAdmin, router, sessionStatus])

  useEffect(() => {
    async function loadAuditLogs() {
      if (sessionStatus !== "authenticated" || !isAdmin) return

      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/admin/audit", { cache: "no-store" })
        const body = await response.json()

        if (!response.ok) {
          throw new Error(body.message || "Failed to load audit logs")
        }

        setEvents(body.events || [])
        setSummary(body.summary || null)
      } catch (auditError) {
        setError(auditError instanceof Error ? auditError.message : "Failed to load audit logs")
      } finally {
        setLoading(false)
      }
    }

    loadAuditLogs()
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
                    <Activity className="mr-1 h-3 w-3" />
                    Admin audit trail
                  </Badge>
                  <CardTitle className="text-3xl font-bold tracking-tight sm:text-5xl">Audit Logs</CardTitle>
                  <CardDescription className="mt-4 max-w-2xl text-base leading-7 text-red-50">
                    Immutable records for privileged user-management changes, password updates, and blocked guardrail attempts.
                  </CardDescription>
                </div>
                <Button asChild className="gap-2 rounded-xl bg-gray-950 text-white hover:bg-gray-800">
                  <Link href="/admin">
                    <ArrowLeft className="h-4 w-4" />
                    Back to admin
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
              <Clock className="mb-3 h-5 w-5 text-red-600" />
              <p className="text-sm text-gray-500">Total events</p>
              <p className="mt-1 text-3xl font-black text-gray-950 dark:text-white">
                {loading ? "..." : summary?.totalEvents ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-red-100 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
            <CardContent className="p-5">
              <AlertTriangle className="mb-3 h-5 w-5 text-red-700 dark:text-red-300" />
              <p className="text-sm text-red-700 dark:text-red-300">Blocked actions</p>
              <p className="mt-1 text-3xl font-black text-red-700 dark:text-red-300">
                {loading ? "..." : summary?.blockedActions ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardContent className="p-5">
              <UserCog className="mb-3 h-5 w-5 text-blue-700 dark:text-blue-300" />
              <p className="text-sm text-blue-700 dark:text-blue-300">User changes</p>
              <p className="mt-1 text-3xl font-black text-blue-700 dark:text-blue-300">
                {loading ? "..." : summary?.userChanges ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-100 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
            <CardContent className="p-5">
              <KeyRound className="mb-3 h-5 w-5 text-amber-700 dark:text-amber-300" />
              <p className="text-sm text-amber-700 dark:text-amber-300">Password updates</p>
              <p className="mt-1 text-3xl font-black text-amber-700 dark:text-amber-300">
                {loading ? "..." : summary?.passwordChanges ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle>Recent privileged activity</CardTitle>
            <CardDescription>Showing the latest 100 admin audit events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading audit trail
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
                No audit events have been recorded yet.
              </div>
            ) : (
              events.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={actionClass(event.action)} variant="outline">
                          {actionLabel(event.action)}
                        </Badge>
                        <span className="text-xs text-gray-500">{formatDate(event.createdAt)}</span>
                      </div>
                      <p className="mt-3 font-semibold text-gray-950 dark:text-white">{event.message}</p>
                      <p className="mt-2 text-sm text-gray-500">
                        Actor: {event.actorEmail || "Unknown"} | Target: {event.targetUserEmail || "None"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
