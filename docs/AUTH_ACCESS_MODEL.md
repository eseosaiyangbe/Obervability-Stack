# Auth Access Model

## Purpose

This document explains the current control-plane authentication model.

It exists to answer a practical Phase 3 question:

- are we still using pure demo auth
- or do we have a clearer operator-grade access path

## Current Model

The active auth path now uses **database-backed credentials by default**.

That means:

- the control plane prefers real user records from Prisma
- local development can still use demo credentials when demo login is enabled
- production should run with demo login disabled unless there is a very specific reason not to

## Modes

### `AUTH_MODE=database`

This is the default and recommended mode.

Behavior:

- credentials login checks the Prisma-backed user table
- registration can create local users
- if the database is unavailable and demo login is enabled, the app can still fall back to demo access

Use this for:

- local development that wants a realistic auth path
- any environment moving toward serious operator behavior

### `AUTH_MODE=demo`

This is an explicit demo-only mode.

Behavior:

- credentials login uses the built-in demo users only
- registration is disabled

Use this for:

- screenshots
- demos
- temporary preview environments

## Demo Login Fallback

The separate `ENABLE_DEMO_LOGIN` flag controls whether demo credentials are accepted.

Recommended behavior:

- local development: enabled is acceptable
- production: disable it

Demo users:

- `demo@example.com` / `demo123`
- `editor@example.com` / `editor123`
- `viewer@example.com` / `viewer123`

## Registration Behavior

Registration is only meaningful when database-backed auth is active.

In database mode:

- new users can be created in Prisma-backed storage

In demo mode:

- registration returns a clear message that demo mode does not support account creation

## OAuth Providers

Google and GitHub providers are only enabled when their credentials are present.

That keeps the auth surface aligned with the actual environment instead of advertising providers that are not configured.

## Environment Contract

The key auth-related variables are:

```bash
DATABASE_URL=postgresql://observability_app:replace-me@localhost:5434/observability_dev?schema=public
NEXTAUTH_URL=http://localhost:4000
NEXTAUTH_SECRET=replace-me
AUTH_MODE=database
ENABLE_DEMO_LOGIN=true
NEXT_PUBLIC_AUTH_MODE=database
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
```

The `NEXT_PUBLIC_*` values are only there so the sign-in UI can reflect the runtime mode.

## Phase 3 Decision

The current platform decision is:

- keep demo access available locally when helpful
- stop treating demo-only auth as the primary architecture
- treat database-backed auth as the real control-plane path going forward
