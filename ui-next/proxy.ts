import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const publicRoutePatterns = [
  /^\/$/,
  /^\/auth(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/dashboard$/,
  /^\/demo$/,
  /^\/services$/,
  /^\/services\/compare$/,
  /^\/services\/[^/]+$/,
  /^\/alerts$/,
  /^\/notifications$/,
]

function isPublicRoute(pathname: string) {
  return publicRoutePatterns.some((pattern) => pattern.test(pathname))
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const pathname = req.nextUrl.pathname
    const isAuthPage = pathname.startsWith("/auth")

    if (isPublicRoute(pathname) && !isAuthPage) {
      return null
    }

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
      return null
    }

    if (!isAuth) {
      let from = req.nextUrl.pathname
      if (req.nextUrl.search) {
        from += req.nextUrl.search
      }

      return NextResponse.redirect(
        new URL(`/auth/signin?from=${encodeURIComponent(from)}`, req.url)
      )
    }

    // Role-based access control
    const userRole = token?.role

    // Admin-only routes
    if (pathname.startsWith("/admin") && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // Settings access (Admin and Editor only)
    if (pathname.startsWith("/settings") && !["ADMIN", "EDITOR"].includes(userRole as string)) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    return null
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (isPublicRoute(req.nextUrl.pathname)) {
          return true
        }

        // Require authentication for all other routes
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - root path (/) - handled by page.tsx
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public|$).*)",
  ],
}
