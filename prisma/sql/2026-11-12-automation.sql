-- Phase 1, step 2 (2026-11-12): the automation engine (events, jobs, recipe settings, sent alerts).
-- Additive only: safe for the running app. Run in the Supabase SQL editor, then: npm run db:rls (locks the new tables).

-- CreateTable
CREATE TABLE "platform_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tenantId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "recipe" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_notices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipe" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_events_tenantId_createdAt_idx" ON "platform_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "platform_events_type_createdAt_idx" ON "platform_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "jobs_status_runAt_idx" ON "jobs"("status", "runAt");

-- CreateIndex
CREATE INDEX "jobs_type_createdAt_idx" ON "jobs"("type", "createdAt");

-- CreateIndex
CREATE INDEX "automation_settings_recipe_tenantId_idx" ON "automation_settings"("recipe", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "automation_notices_tenantId_recipe_subjectKey_key" ON "automation_notices"("tenantId", "recipe", "subjectKey");

