-- Phase 2, part 4 (2026-11-15): Farm Core's jobs (once or repeating), shown on Today with machine service and the
-- store running low. Additive only: safe for the running app. Run in the Supabase SQL editor, then: npm run db:rls
-- (locks the new table). Safe to run twice.

CREATE TABLE IF NOT EXISTS "farm_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "dueOn" TEXT NOT NULL,
    "repeatEvery" INTEGER,
    "repeatUnit" TEXT,
    "placeId" TEXT,
    "assetId" TEXT,
    "forStaffId" TEXT,
    "doneOn" TEXT,
    "lastDoneOn" TEXT,
    "lastDoneBy" TEXT,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "farm_tasks_tenantId_dueOn_idx" ON "farm_tasks"("tenantId", "dueOn");
