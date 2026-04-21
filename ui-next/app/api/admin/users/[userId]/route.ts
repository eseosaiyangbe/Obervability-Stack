import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { AdminAuditAction, UserRole, UserStatus } from "@prisma/client"
import { recordAdminAudit } from "@/lib/admin-audit"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma-server"

const roleValues = new Set(Object.values(UserRole))
const statusValues = new Set(Object.values(UserStatus))

async function requireAdmin() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ message: "Authentication required" }, { status: 401 }),
    }
  }

  if ((session.user as any).role !== UserRole.ADMIN) {
    return {
      session: null,
      response: NextResponse.json({ message: "Admin privileges required" }, { status: 403 }),
    }
  }

  return { session, response: null }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function wouldRemoveLastActiveAdmin(userId: string, nextRole: UserRole, nextStatus: UserStatus) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  })

  if (!target || target.role !== UserRole.ADMIN || target.status !== UserStatus.ACTIVE) {
    return false
  }

  if (nextRole === UserRole.ADMIN && nextStatus === UserStatus.ACTIVE) {
    return false
  }

  const otherActiveAdmins = await prisma.user.count({
    where: {
      id: { not: userId },
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  })

  return otherActiveAdmins === 0
}

function auditActor(session: any) {
  return {
    id: session?.user?.id,
    email: session?.user?.email ?? null,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { session, response } = await requireAdmin()
  if (response) return response

  try {
    const { userId } = await params
    const body = await request.json()
    const existingUser = await prisma.user.findUnique({ where: { id: userId } })

    if (!existingUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    const nextRole = typeof body.role === "string" && roleValues.has(body.role as UserRole)
      ? body.role as UserRole
      : existingUser.role
    const nextStatus = typeof body.status === "string" && statusValues.has(body.status as UserStatus)
      ? body.status as UserStatus
      : existingUser.status
    const isSelf = (session!.user as any).id === userId

    if (isSelf && (nextRole !== existingUser.role || nextStatus !== existingUser.status)) {
      await recordAdminAudit({
        action: AdminAuditAction.ACTION_BLOCKED,
        actor: auditActor(session!),
        targetUser: {
          id: existingUser.id,
          email: existingUser.email,
        },
        message: `Blocked self role or status change for ${existingUser.email}`,
        metadata: {
          reason: "self_role_or_status_change",
          requestedRole: nextRole,
          requestedStatus: nextStatus,
          currentRole: existingUser.role,
          currentStatus: existingUser.status,
        },
      })
      return NextResponse.json(
        { message: "You cannot change your own role or account status" },
        { status: 400 }
      )
    }

    if (await wouldRemoveLastActiveAdmin(userId, nextRole, nextStatus)) {
      await recordAdminAudit({
        action: AdminAuditAction.ACTION_BLOCKED,
        actor: auditActor(session!),
        targetUser: {
          id: existingUser.id,
          email: existingUser.email,
        },
        message: `Blocked change that would remove the last active admin ${existingUser.email}`,
        metadata: {
          reason: "last_active_admin",
          requestedRole: nextRole,
          requestedStatus: nextStatus,
          currentRole: existingUser.role,
          currentStatus: existingUser.status,
        },
      })
      return NextResponse.json(
        { message: "At least one active admin must remain" },
        { status: 400 }
      )
    }

    const data: {
      name?: string
      email?: string
      role?: UserRole
      status?: UserStatus
      disabledAt?: Date | null
      password?: string
    } = {}
    let passwordChanged = false

    if (typeof body.name === "string") {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ message: "Name cannot be empty" }, { status: 400 })
      }
      data.name = name
    }

    if (typeof body.email === "string") {
      const email = normalizeEmail(body.email)
      if (!isValidEmail(email)) {
        return NextResponse.json({ message: "A valid email address is required" }, { status: 400 })
      }

      const duplicate = await prisma.user.findFirst({
        where: {
          email,
          id: { not: userId },
        },
      })

      if (duplicate) {
        return NextResponse.json({ message: "A user with this email already exists" }, { status: 409 })
      }

      data.email = email
    }

    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 8) {
        return NextResponse.json({ message: "Password must be at least 8 characters long" }, { status: 400 })
      }
      data.password = await bcrypt.hash(body.password, 12)
      passwordChanged = true
    }

    data.role = nextRole
    data.status = nextStatus
    data.disabledAt = nextStatus === UserStatus.DISABLED ? existingUser.disabledAt || new Date() : null

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        status: true,
        lastLoginAt: true,
        disabledAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            dashboards: true,
            configurations: true,
            teams: true,
          },
        },
      },
    })

    const auditEvents: Array<{
      action: AdminAuditAction
      message: string
      metadata?: Record<string, string | null>
    }> = []

    if (existingUser.role !== user.role) {
      auditEvents.push({
        action: AdminAuditAction.ROLE_CHANGED,
        message: `Changed ${user.email} role from ${existingUser.role} to ${user.role}`,
        metadata: {
          previousRole: existingUser.role,
          nextRole: user.role,
        },
      })
    }

    if (existingUser.status !== user.status) {
      auditEvents.push({
        action: user.status === UserStatus.ACTIVE ? AdminAuditAction.USER_REACTIVATED : AdminAuditAction.STATUS_CHANGED,
        message: `Changed ${user.email} status from ${existingUser.status} to ${user.status}`,
        metadata: {
          previousStatus: existingUser.status,
          nextStatus: user.status,
        },
      })
    }

    if (passwordChanged) {
      auditEvents.push({
        action: AdminAuditAction.PASSWORD_CHANGED,
        message: `Updated password for ${user.email}`,
      })
    }

    if (existingUser.name !== user.name || existingUser.email !== user.email) {
      auditEvents.push({
        action: AdminAuditAction.USER_UPDATED,
        message: `Updated profile details for ${user.email}`,
        metadata: {
          previousEmail: existingUser.email,
          nextEmail: user.email,
          previousName: existingUser.name,
          nextName: user.name,
        },
      })
    }

    await Promise.all(auditEvents.map((event) => recordAdminAudit({
      action: event.action,
      actor: auditActor(session!),
      targetUser: {
        id: user.id,
        email: user.email,
      },
      message: event.message,
      metadata: event.metadata,
    })))

    return NextResponse.json({ message: "User updated", user })
  } catch (error) {
    console.error("Admin user update error:", error)
    return NextResponse.json({ message: "Failed to update user" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { session, response } = await requireAdmin()
  if (response) return response

  try {
    const { userId } = await params
    const existingUser = await prisma.user.findUnique({ where: { id: userId } })

    if (!existingUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    if ((session!.user as any).id === userId) {
      await recordAdminAudit({
        action: AdminAuditAction.ACTION_BLOCKED,
        actor: auditActor(session!),
        targetUser: {
          id: existingUser.id,
          email: existingUser.email,
        },
        message: `Blocked self-disable attempt for ${existingUser.email}`,
        metadata: {
          reason: "self_disable",
        },
      })
      return NextResponse.json({ message: "You cannot disable your own account" }, { status: 400 })
    }

    if (await wouldRemoveLastActiveAdmin(userId, existingUser.role, UserStatus.DISABLED)) {
      await recordAdminAudit({
        action: AdminAuditAction.ACTION_BLOCKED,
        actor: auditActor(session!),
        targetUser: {
          id: existingUser.id,
          email: existingUser.email,
        },
        message: `Blocked disable that would remove the last active admin ${existingUser.email}`,
        metadata: {
          reason: "last_active_admin",
          requestedStatus: UserStatus.DISABLED,
          currentRole: existingUser.role,
          currentStatus: existingUser.status,
        },
      })
      return NextResponse.json(
        { message: "At least one active admin must remain" },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.DISABLED,
        disabledAt: existingUser.disabledAt || new Date(),
      },
    })

    await recordAdminAudit({
      action: AdminAuditAction.USER_DISABLED,
      actor: auditActor(session!),
      targetUser: {
        id: existingUser.id,
        email: existingUser.email,
      },
      message: `Disabled user ${existingUser.email}`,
      metadata: {
        previousStatus: existingUser.status,
        nextStatus: UserStatus.DISABLED,
      },
    })

    return NextResponse.json({ message: "User disabled" })
  } catch (error) {
    console.error("Admin user disable error:", error)
    return NextResponse.json({ message: "Failed to disable user" }, { status: 500 })
  }
}
