import { AdminAuditAction, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma-server"

type AuditPrincipal = {
  id?: string | null
  email?: string | null
}

type RecordAdminAuditInput = {
  action: AdminAuditAction
  actor?: AuditPrincipal | null
  targetUser?: AuditPrincipal | null
  message: string
  metadata?: Prisma.InputJsonValue
}

export async function recordAdminAudit({
  action,
  actor,
  targetUser,
  message,
  metadata,
}: RecordAdminAuditInput) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        action,
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        targetUserId: targetUser?.id ?? null,
        targetUserEmail: targetUser?.email ?? null,
        message,
        ...(metadata === undefined ? {} : { metadata }),
      },
    })
  } catch (error) {
    console.error("Admin audit log write failed:", error)
  }
}
