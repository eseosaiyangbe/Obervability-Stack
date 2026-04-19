export type AuthMode = "database" | "demo"

export function getAuthMode(): AuthMode {
  return process.env.AUTH_MODE === "demo" ? "demo" : "database"
}

export function isDemoLoginEnabled(): boolean {
  if (process.env.ENABLE_DEMO_LOGIN === "true") {
    return true
  }

  if (process.env.ENABLE_DEMO_LOGIN === "false") {
    return false
  }

  return process.env.NODE_ENV !== "production"
}

export function isOAuthProviderEnabled(provider: "google" | "github"): boolean {
  if (provider === "google") {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  }

  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
}
