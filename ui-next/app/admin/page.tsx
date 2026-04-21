"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Crown,
  Edit,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Shield,
  UserCog,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type UserRole = "ADMIN" | "EDITOR" | "VIEWER"
type UserStatus = "ACTIVE" | "DISABLED"

interface AdminUser {
  id: string
  email: string
  name: string | null
  image: string | null
  role: UserRole
  status: UserStatus
  lastLoginAt: string | null
  disabledAt: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    dashboards: number
    configurations: number
    teams: number
  }
}

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

interface UserFormState {
  name: string
  email: string
  password: string
  role: UserRole
  status: UserStatus
}

const emptyForm: UserFormState = {
  name: "",
  email: "",
  password: "",
  role: "VIEWER",
  status: "ACTIVE",
}

function roleIcon(role: UserRole) {
  if (role === "ADMIN") return <Crown className="h-4 w-4" />
  if (role === "EDITOR") return <Edit className="h-4 w-4" />
  return <Eye className="h-4 w-4" />
}

function roleClass(role: UserRole) {
  if (role === "ADMIN") return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
  if (role === "EDITOR") return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
}

function statusClass(status: UserStatus) {
  return status === "ACTIVE"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
}

function formatDate(value: string | null) {
  if (!value) return "Never"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString()
}

function initials(user: AdminUser) {
  return (user.name || user.email || "U").charAt(0).toUpperCase()
}

function UserFields({
  form,
  setForm,
  includeStatus,
}: {
  form: UserFormState
  setForm: (next: UserFormState) => void
  includeStatus: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="admin-user-name">Name</Label>
        <Input
          id="admin-user-name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Operator name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-user-email">Email</Label>
        <Input
          id="admin-user-email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="operator@example.com"
          type="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-user-role">Role</Label>
        <Select value={form.role} onValueChange={(role: UserRole) => setForm({ ...form, role })}>
          <SelectTrigger id="admin-user-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="EDITOR">Editor</SelectItem>
            <SelectItem value="VIEWER">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {includeStatus && (
        <div className="space-y-2">
          <Label htmlFor="admin-user-status">Status</Label>
          <Select value={form.status} onValueChange={(status: UserStatus) => setForm({ ...form, status })}>
            <SelectTrigger id="admin-user-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="DISABLED">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="admin-user-password">
          Password {includeStatus ? <span className="text-gray-500">(leave blank to keep current)</span> : null}
        </Label>
        <Input
          id="admin-user-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder="Minimum 8 characters"
          type="password"
        />
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [summary, setSummary] = useState<AdminUsersSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<UserFormState>(emptyForm)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<UserFormState>(emptyForm)

  const isAdmin = (session?.user as any)?.role === "ADMIN"

  useEffect(() => {
    if (sessionStatus === "authenticated" && !isAdmin) {
      router.push("/dashboard")
    }
  }, [isAdmin, router, sessionStatus])

  async function loadUsers() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" })
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.message || "Failed to load users")
      }

      setUsers(body.users || [])
      setSummary(body.summary || null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sessionStatus === "authenticated" && isAdmin) {
      loadUsers()
    }
  }, [isAdmin, sessionStatus])

  function beginEdit(user: AdminUser) {
    setEditingUserId(user.id)
    setEditForm({
      name: user.name || "",
      email: user.email,
      password: "",
      role: user.role,
      status: user.status,
    })
    setMessage(null)
    setError(null)
  }

  async function createUser() {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      })
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.message || "Failed to create user")
      }

      setCreateForm(emptyForm)
      setShowCreateForm(false)
      setMessage("User created successfully")
      await loadUsers()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create user")
    } finally {
      setSaving(false)
    }
  }

  async function updateUser(userId: string) {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const payload = {
        ...editForm,
        password: editForm.password || undefined,
      }
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.message || "Failed to update user")
      }

      setEditingUserId(null)
      setMessage("User updated successfully")
      await loadUsers()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update user")
    } finally {
      setSaving(false)
    }
  }

  async function disableUser(user: AdminUser) {
    if (!window.confirm(`Disable ${user.name || user.email}? They will no longer be able to sign in.`)) {
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.message || "Failed to disable user")
      }

      setMessage("User disabled successfully")
      await loadUsers()
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Failed to disable user")
    } finally {
      setSaving(false)
    }
  }

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
                    Admin control
                  </Badge>
                  <CardTitle className="text-3xl font-bold tracking-tight sm:text-5xl">User Management</CardTitle>
                  <CardDescription className="mt-4 max-w-2xl text-base leading-7 text-red-50">
                    Manage operator access, roles, account state, and the identities that can run the control plane.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={loadUsers} disabled={loading || saving} className="gap-2 rounded-xl bg-white/95 text-gray-950">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                  </Button>
                  <Button onClick={() => setShowCreateForm((value) => !value)} className="gap-2 rounded-xl bg-gray-950 text-white hover:bg-gray-800">
                    <Plus className="h-4 w-4" />
                    Add user
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-5">
              <Users className="mb-3 h-5 w-5 text-red-600" />
              <p className="text-sm text-gray-500">Total users</p>
              <p className="mt-1 text-3xl font-black text-gray-950 dark:text-white">{summary?.totalUsers ?? users.length}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">
            <CardContent className="p-5">
              <CheckCircle className="mb-3 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Active</p>
              <p className="mt-1 text-3xl font-black text-emerald-700 dark:text-emerald-300">{summary?.activeUsers ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-5">
              <AlertTriangle className="mb-3 h-5 w-5 text-slate-700 dark:text-slate-300" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Disabled</p>
              <p className="mt-1 text-3xl font-black text-slate-800 dark:text-slate-200">{summary?.disabledUsers ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardContent className="p-5">
              <Activity className="mb-3 h-5 w-5 text-blue-700 dark:text-blue-300" />
              <p className="text-sm text-blue-700 dark:text-blue-300">Configs / dashboards</p>
              <p className="mt-1 text-3xl font-black text-blue-700 dark:text-blue-300">
                {summary?.totalConfigs ?? 0}/{summary?.totalDashboards ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {(message || error) && (
          <Card className={error ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"}>
            <CardContent className={error ? "p-4 text-red-700 dark:text-red-300" : "p-4 text-emerald-700 dark:text-emerald-300"}>
              {error || message}
            </CardContent>
          </Card>
        )}

        {showCreateForm && (
          <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-red-600" />
                Create operator
              </CardTitle>
              <CardDescription>Add a database-backed user with the minimum role they need.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UserFields form={createForm} setForm={setCreateForm} includeStatus={false} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={createUser} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Create user
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle>Operators</CardTitle>
            <CardDescription>Live users from the control-plane database. Password hashes are never returned to the browser.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading users
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-800">
                No users found.
              </div>
            ) : (
              <div className="space-y-4">
                {users.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
                  >
                    {editingUserId === user.id ? (
                      <div className="space-y-4">
                        <UserFields form={editForm} setForm={setEditForm} includeStatus />
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => updateUser(user.id)} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save changes
                          </Button>
                          <Button variant="outline" onClick={() => setEditingUserId(null)} disabled={saving}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 font-bold text-white">
                            {initials(user)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-gray-950 dark:text-white">{user.name || "Unnamed user"}</h3>
                              <Badge variant="outline" className={roleClass(user.role)}>
                                {roleIcon(user.role)}
                                <span className="ml-1">{user.role}</span>
                              </Badge>
                              <Badge variant="outline" className={statusClass(user.status)}>
                                {user.status}
                              </Badge>
                            </div>
                            <p className="mt-1 break-all text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                              Last login: {formatDate(user.lastLoginAt)} | Created: {formatDate(user.createdAt)}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                              Dashboards: {user._count?.dashboards ?? 0} | Configs: {user._count?.configurations ?? 0} | Teams: {user._count?.teams ?? 0}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => beginEdit(user)} disabled={saving}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          {user.status === "ACTIVE" ? (
                            <Button variant="outline" size="sm" onClick={() => disableUser(user)} disabled={saving} className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30">
                              Disable
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => {
                              setEditingUserId(user.id)
                              setEditForm({
                                name: user.name || "",
                                email: user.email,
                                password: "",
                                role: user.role,
                                status: "ACTIVE",
                              })
                            }} disabled={saving}>
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
