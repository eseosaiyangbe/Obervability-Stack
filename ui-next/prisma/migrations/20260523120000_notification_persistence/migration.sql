-- Move control-plane notification state into PostgreSQL.

CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'default',
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_settings_scope_key" ON "notification_settings"("scope");

CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "app" TEXT,
    "service" TEXT,
    "component" TEXT,
    "instance" TEXT,
    "runbookUrl" TEXT,
    "fingerprint" TEXT,
    "labels" JSONB NOT NULL,
    "annotations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_events_receivedAt_idx" ON "notification_events"("receivedAt");
CREATE INDEX "notification_events_status_idx" ON "notification_events"("status");
CREATE INDEX "notification_events_severity_idx" ON "notification_events"("severity");
