-- Phase 2, part 2 (2026-11-14): Farm Core workers, their days (attendance) and payments (wages and advances).
-- Additive only: safe for the running app. Run in the Supabase SQL editor, then: npm run db:rls (locks the new tables).

CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "payType" TEXT NOT NULL DEFAULT 'daily',
    "ratePaise" INTEGER NOT NULL,
    "joinedOn" TEXT,
    "leftOn" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "worker_days" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "placeId" TEXT,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "worker_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "note" TEXT,
    "expenseId" TEXT,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workers_tenantId_idx" ON "workers"("tenantId");

CREATE INDEX "worker_days_tenantId_date_idx" ON "worker_days"("tenantId", "date");

CREATE UNIQUE INDEX "worker_days_workerId_date_key" ON "worker_days"("workerId", "date");

CREATE INDEX "worker_payments_tenantId_workerId_idx" ON "worker_payments"("tenantId", "workerId");

