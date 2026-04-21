import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { AdminAuditAction, UserRole } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma-server"

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

export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response

  try {
    const [events, totalEvents, blockedActions, userChanges, passwordChanges] = await prisma.$transaction([
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.adminAuditLog.count(),
      prisma.adminAuditLog.count({ where: { action: AdminAuditAction.ACTION_BLOCKED } }),
      prisma.adminAuditLog.count({
        where: {
          action: {
            in: [
              AdminAuditAction.USER_CREATED,
              AdminAuditAction.USER_UPDATED,
              AdminAuditAction.USER_DISABLED,
              AdminAuditAction.USER_REACTIVATED,
              AdminAuditAction.ROLE_CHANGED,
              AdminAuditAction.STATUS_CHANGED,
            ],
          },
        },
      }),
      prisma.adminAuditLog.count({ where: { action: AdminAuditAction.PASSWORD_CHANGED } }),
    ])

    return NextResponse.json({
      events,
      summary: {
        totalEvents,
        blockedActions,
        userChanges,
        passwordChanges,
      },
    })
  } catch (error) {
    console.error("Admin audit list error:", error)
    return NextResponse.json({ message: "Failed to load audit logs" }, { status: 500 })
  }
}
