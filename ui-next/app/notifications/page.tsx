"use client"

import React, { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Slack,
  Trash2,
  Webhook,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useNotificationInbox } from "@/lib/hooks/use-notification-inbox"
import type { NotificationInboxEvent } from "@/lib/notification-inbox"

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))
}

function getStatusBadge(status: string) {
  if (status === "resolved") {
    return <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">Resolved</Badge>
  }

  return <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white">Firing</Badge>
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white">Critical</Badge>
    case "warning":
      return <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white">Warning</Badge>
    case "info":
      return <Badge className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white">Info</Badge>
    default:
      return <Badge className="bg-gradient-to-r from-gray-500 to-slate-600 text-white">{severity}</Badge>
  }
}

function NotificationCard({
  event,
  onDelete,
  mutating,
}: {
  event: NotificationInboxEvent;
  onDelete: (event: NotificationInboxEvent) => void;
  mutating: boolean;
}) {
  const isFiring = event.status === "firing"

  return (
    <motion.div whileHover={{ y: -2, scale: 1.01 }} transition={{ duration: 0.2 }}>
      <Card className={`overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 ${
        isFiring ? "border-l-4 border-l-red-500" : "border-l-4 border-l-green-500"
      }`}>
        <CardHeader className="p-4 sm:p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2 rounded-xl ${isFiring ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
                {isFiring ? (
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                )}
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg break-words text-gray-900 dark:text-white">
                  {event.title}
                </CardTitle>
                <CardDescription className="mt-1 text-xs sm:text-sm break-words text-gray-600 dark:text-gray-400">
                  {event.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge(event.status)}
              {getSeverityBadge(event.severity)}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">App</p>
              <p className="font-medium text-gray-900 dark:text-white">{event.app || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Service</p>
              <p className="font-medium text-gray-900 dark:text-white">{event.service || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Component</p>
              <p className="font-medium text-gray-900 dark:text-white">{event.component || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Received</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatTimestamp(event.receivedAt)}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(event.labels).slice(0, 8).map(([key, value]) => (
              <Badge key={key} variant="secondary" className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                {key}={value}
              </Badge>
            ))}
          </div>
        </CardContent>

        <CardFooter className="p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Webhook className="h-4 w-4" />
            Alertmanager webhook inbox
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {event.runbookUrl && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 bg-white dark:bg-gray-900">
                <a href={event.runbookUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Runbook
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(event)}
              disabled={mutating}
              className="gap-1.5 bg-white dark:bg-gray-900 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

export default function NotificationsPage() {
  const {
    notifications,
    summary,
    appOptions,
    serviceOptions,
    severityOptions,
    loading,
    mutating,
    error,
    refresh,
    deleteNotification,
    clearNotifications,
  } = useNotificationInbox(100)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [appFilter, setAppFilter] = useState("all")
  const [serviceFilter, setServiceFilter] = useState("all")

  const filteredNotifications = useMemo(() => {
    return notifications.filter((event) => {
      const haystack = [
        event.title,
        event.description,
        event.app,
        event.service,
        event.component,
        event.instance,
        event.severity,
        event.status,
      ].join(" ").toLowerCase()

      if (searchQuery && !haystack.includes(searchQuery.toLowerCase())) return false
      if (statusFilter !== "all" && event.status !== statusFilter) return false
      if (severityFilter !== "all" && event.severity !== severityFilter) return false
      if (appFilter !== "all" && event.app !== appFilter) return false
      if (serviceFilter !== "all" && event.service !== serviceFilter) return false

      return true
    })
  }, [appFilter, notifications, searchQuery, serviceFilter, severityFilter, statusFilter])

  const handleDeleteNotification = async (event: NotificationInboxEvent) => {
    const confirmed = window.confirm(`Delete notification "${event.title}" from the local inbox?`)

    if (!confirmed) {
      return
    }

    await deleteNotification(event.id)
  }

  const handleClearInbox = async () => {
    const confirmed = window.confirm("Delete all notifications from the local inbox? This does not delete alerts from Alertmanager.")

    if (!confirmed) {
      return
    }

    await clearNotifications()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-cyan-900/20">
      <div className="px-2 sm:px-4 py-3 sm:py-6 max-w-7xl mx-auto space-y-3 sm:space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="border border-gray-200 dark:border-gray-700 shadow-xl bg-white dark:bg-gray-900 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-700 dark:via-blue-700 dark:to-indigo-700 text-white p-4 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-2 sm:space-y-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <MessageSquare className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl sm:text-3xl lg:text-4xl font-bold">
                        Notifications
                      </CardTitle>
                      <CardDescription className="mt-1 sm:mt-2 text-cyan-100 text-sm sm:text-base">
                        Alertmanager delivery inbox and Slack-ready notification path
                      </CardDescription>
                    </div>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <Badge className="bg-white/20 text-white border-white/30 px-3 py-1.5 font-semibold text-sm">
                    <Slack className="h-3 w-3 mr-1" />
                    Slack Ready
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.1 }} className="text-center p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">{summary.total}</div>
                  <div className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">Inbox Events</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.2 }} className="text-center p-3 sm:p-4 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl border border-red-200 dark:border-red-800">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400">{summary.firing}</div>
                  <div className="text-xs sm:text-sm text-red-700 dark:text-red-300">Firing</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.3 }} className="text-center p-3 sm:p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">{summary.resolved}</div>
                  <div className="text-xs sm:text-sm text-green-700 dark:text-green-300">Resolved</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.4 }} className="text-center p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Slack className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400">Env</div>
                  <div className="text-xs sm:text-sm text-purple-700 dark:text-purple-300">Slack Config</div>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search notifications..." className="pl-9 bg-white dark:bg-gray-900" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white dark:bg-gray-900"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="firing">Firing</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="bg-white dark:bg-gray-900"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                {severityOptions.map((severity) => <SelectItem key={severity} value={severity}>{severity}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={appFilter} onValueChange={setAppFilter}>
              <SelectTrigger className="bg-white dark:bg-gray-900"><SelectValue placeholder="App" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Apps</SelectItem>
                {appOptions.map((app) => <SelectItem key={app} value={app}>{app}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="bg-white dark:bg-gray-900"><SelectValue placeholder="Service" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {serviceOptions.map((service) => <SelectItem key={service} value={service}>{service}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2 bg-white dark:bg-gray-900">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleClearInbox}
            disabled={mutating || notifications.length === 0}
            className="gap-2 bg-white dark:bg-gray-900 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {mutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clear Inbox
          </Button>
        </motion.div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900">
            <CardHeader className="p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-cyan-50 dark:from-gray-800 dark:to-cyan-900/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-xl sm:text-2xl text-gray-900 dark:text-white flex items-center gap-2">
                    <Filter className="h-5 w-5 text-cyan-600" />
                    Notification Inbox
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    {filteredNotifications.length} events match the current filters
                  </CardDescription>
                </div>
                <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400">
                  <Activity className="h-3 w-3 mr-1" />
                  Auto-refresh 30s
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-7 w-7 animate-spin text-cyan-600" />
                </div>
              ) : filteredNotifications.length > 0 ? (
                <div className="space-y-4">
                  {filteredNotifications.map((event, index) => (
                    <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.03 }}>
                      <NotificationCard event={event} onDelete={handleDeleteNotification} mutating={mutating} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Bell className="mx-auto mb-3 h-8 w-8" />
                  No notifications match the current filters.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
