import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import { prisma } from "./prisma-server"
import bcrypt from "bcryptjs"
import { UserRole, UserStatus } from "@prisma/client"
import { checkAuthConfig } from "./auth-config-check"
import { getAuthMode, isDemoLoginEnabled, isOAuthProviderEnabled } from "./auth-runtime"

if (typeof window === "undefined") {
  checkAuthConfig()
}

const DEMO_USERS = [
  {
    id: "demo-admin",
    email: "demo@example.com",
    password: "demo123",
    name: "Demo Admin",
    role: UserRole.ADMIN,
  },
  {
    id: "demo-editor",
    email: "editor@example.com",
    password: "editor123",
    name: "Demo Editor",
    role: UserRole.EDITOR,
  },
  {
    id: "demo-viewer",
    email: "viewer@example.com",
    password: "viewer123",
    name: "Demo Viewer",
    role: UserRole.VIEWER,
  },
]

// Check if database is available
let dbAvailable = false

const checkDatabaseAvailability = async () => {
  try {
    await prisma.$connect()
    dbAvailable = true
  } catch (error) {
    console.warn("Database not available, using JWT-only mode:", error)
    dbAvailable = false
  }
}

// Initialize database check
checkDatabaseAvailability()

function authenticateDemoUser(email: string, password: string) {
  const user = DEMO_USERS.find((candidate) => candidate.email === email && candidate.password === password)

  if (!user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: null,
    role: user.role,
  }
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      const authMode = getAuthMode()
      const demoLoginEnabled = isDemoLoginEnabled()

      if (authMode === "demo") {
        return demoLoginEnabled
          ? authenticateDemoUser(credentials.email, credentials.password)
          : null
      }

      if (!dbAvailable) {
        await checkDatabaseAvailability()
      }

      if (!dbAvailable) {
        if (demoLoginEnabled) {
          return authenticateDemoUser(credentials.email, credentials.password)
        }

        console.warn("Database-backed auth requested but database is unavailable and demo login is disabled.")
        return null
      }

      try {
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password || user.status === UserStatus.DISABLED) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          return null
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      } catch (error) {
        console.error("Database error during authentication:", error)

        if (demoLoginEnabled) {
          return authenticateDemoUser(credentials.email, credentials.password)
        }

        return null
      }
    }
  }),
]

if (isOAuthProviderEnabled("google")) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  )
}

if (isOAuthProviderEnabled("github")) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    })
  )
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "devops-monitoring-demo-secret-key-2024",
  debug: process.env.NODE_ENV === "development",
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user && token.sub) {
        (session.user as any).id = token.sub as string
        (session.user as any).role = token.role as UserRole
      }
      return session
    },
    async signIn({ user, account }) {
      // Check database availability dynamically
      if (!dbAvailable) {
        await checkDatabaseAvailability()
      }

      if (!dbAvailable) {
        // Allow OAuth sign-ins even without database
        return true
      }

      if ((account?.provider === "google" || account?.provider === "github") && user.email) {
        try {
          // Check if user exists, if not create them
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! }
          })

          if (existingUser?.status === UserStatus.DISABLED) {
            return false
          }

          if (!existingUser) {
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name,
                image: user.image,
                role: UserRole.VIEWER, // Default role for OAuth users
                lastLoginAt: new Date(),
              }
            })
          } else {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { lastLoginAt: new Date() },
            })
          }
        } catch (error) {
          console.error("Database error during OAuth sign-in:", error)
          // Still allow sign-in even if database operations fail
        }
      }
      return true
    }
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
}

export async function createDemoUser() {
  if (!dbAvailable) {
    console.warn("Database not available, demo user creation skipped")
    return null
  }

  try {
    const hashedPassword = await bcrypt.hash("viewer123", 12)

    const demoUser = await prisma.user.upsert({
      where: { email: "viewer@example.com" },
      update: {},
      create: {
        email: "viewer@example.com",
        name: "Demo Viewer",
        password: hashedPassword,
        role: UserRole.VIEWER,
      }
    })

    return demoUser
  } catch (error) {
    console.error("Error creating demo user:", error)
    return null
  }
}
