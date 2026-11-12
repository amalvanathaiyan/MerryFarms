-- Phase 1, step 1 (2026-11-12): plans made in admin, farm subscriptions, module settings, farm requests.
-- Additive only: safe for the running app. Run in the Supabase SQL editor, then: npm run db:rls (locks the new tables).

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "entitlements" JSONB;

-- CreateTable
CREATE TABLE "platform_plans" (
    "id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "nameTa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionTa" TEXT,
    "descriptionEn" TEXT,
    "monthlyPaise" INTEGER NOT NULL DEFAULT 0,
    "yearlyPaise" INTEGER,
    "trialDays" INTEGER NOT NULL DEFAULT 30,
    "modules" TEXT[],
    "features" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'trial',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "addOns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moduleOverrides" JSONB NOT NULL DEFAULT '{}',
    "priceOverridePaise" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_settings" (
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "addOnMonthlyPaise" INTEGER,
    "addOnYearlyPaise" INTEGER,
    "addOnTrialDays" INTEGER NOT NULL DEFAULT 14,
    "requestable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_settings_pkey" PRIMARY KEY ("moduleKey")
);

-- CreateTable
CREATE TABLE "farm_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "moduleKey" TEXT,
    "planId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "reply" TEXT,
    "byStaffId" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_plans_family_version_key" ON "platform_plans"("family", "version");

-- CreateIndex
CREATE UNIQUE INDEX "farm_subscriptions_tenantId_key" ON "farm_subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "farm_subscriptions_planId_idx" ON "farm_subscriptions"("planId");

-- CreateIndex
CREATE INDEX "farm_requests_tenantId_status_idx" ON "farm_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "farm_requests_status_createdAt_idx" ON "farm_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "farm_subscriptions" ADD CONSTRAINT "farm_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_subscriptions" ADD CONSTRAINT "farm_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_requests" ADD CONSTRAINT "farm_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

