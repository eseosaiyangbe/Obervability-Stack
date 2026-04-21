import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { AdminAuditAction, UserRole, UserStatus } from "@prisma/client"
import { recordAdminAudit } from "@/lib/admin-audit"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma-server"

const roleValues = new Set(Object.values(UserRole))

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

function sanitizeRole(role: unknown) {
  return typeof role === "string" && roleValues.has(role as UserRole)
    ? role as UserRole
    : UserRole.VIEWER
}

export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response

  try {
    const [users, totalUsers, activeUsers, disabledUsers, totalDashboards, totalConfigs] = await prisma.$transaction([
      prisma.user.findMany({
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
        orderBy: [
          { role: "asc" },
          { createdAt: "asc" },
        ],
      }),
      prisma.user.count(),
      prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      prisma.user.count({ where: { status: UserStatus.DISABLED } }),
      prisma.dashboard.count(),
      prisma.configuration.count(),
    ])

    return NextResponse.json({
      users,
      summary: {
        totalUsers,
        activeUsers,
        disabledUsers,
        admins: users.filter((user) => user.role === UserRole.ADMIN).length,
        editors: users.filter((user) => user.role === UserRole.EDITOR).length,
        viewers: users.filter((user) => user.role === UserRole.VIEWER).length,
        totalDashboards,
        totalConfigs,
      },
    })
  } catch (error) {
    console.error("Admin users list error:", error)
    return NextResponse.json({ message: "Failed to load users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireAdmin()
  if (response) return response

  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : ""
    const password = typeof body.password === "string" ? body.password : ""
    const role = sanitizeRole(body.role)

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email, and password are required" }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ message: "A valid email address is required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters long" }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ message: "A user with this email already exists" }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        status: UserStatus.ACTIVE,
      },
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
      },
    })

    await recordAdminAudit({
      action: AdminAuditAction.USER_CREATED,
      actor: {
        id: (session?.user as any).id,
        email: session?.user?.email ?? null,
      },
      targetUser: {
        id: user.id,
        email: user.email,
      },
      message: `Created user ${user.email} with ${user.role} role`,
      metadata: {
        role: user.role,
        status: user.status,
      },
    })

    return NextResponse.json({ message: "User created", user }, { status: 201 })
  } catch (error) {
    console.error("Admin user create error:", error)
    return NextResponse.json({ message: "Failed to create user" }, { status: 500 })
  }
}
