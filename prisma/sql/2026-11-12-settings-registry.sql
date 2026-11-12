-- Phase 1, step 3 (2026-11-12), part 1 of 2: the settings registry and the audit log.
-- Additive only: safe for the running app. Run in the Supabase SQL editor BEFORE the new code goes live.
-- It also copies any farm's confirmation-call rules that differ from the usual into the registry, so nothing is lost.
-- Part 2 (2026-11-12-settings-registry-cleanup.sql) removes the two old tables once the new code is live.

-- CreateTable
CREATE TABLE "setting_values" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "tenantId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setting_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting_controls" (
    "key" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "onlyFarms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setting_controls_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorKind" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "viaSupport" BOOLEAN NOT NULL DEFAULT false,
    "action" TEXT NOT NULL,
    "subject" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "setting_values_tenantId_idx" ON "setting_values"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "setting_values_scopeKey_key_key" ON "setting_values"("scopeKey", "key");

-- CreateIndex
CREATE INDEX "audit_log_tenantId_createdAt_idx" ON "audit_log"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_action_createdAt_idx" ON "audit_log"("action", "createdAt");

-- Lock the new tables from Supabase's public API, like every other table (same as npm run db:rls)
ALTER TABLE "setting_values" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "setting_controls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;

-- Copy each farm's confirmation-call rules that differ from the usual (unused callRetryMinutes is dropped)
INSERT INTO "setting_values" ("id", "scopeKey", "tenantId", "key", "value", "updatedAt")
SELECT gen_random_uuid()::text, 'farm:' || s."tenantId", s."tenantId", v.key, v.value, CURRENT_TIMESTAMP
FROM "tenant_settings" s
CROSS JOIN LATERAL (VALUES
    ('callWhatsAppOrders',    to_jsonb(s."callWhatsAppOrders"),          s."callWhatsAppOrders" <> true),
    ('callWebOrdersFromNew',  to_jsonb(s."callWebOrdersFromNew"),        s."callWebOrdersFromNew" <> true),
    ('newCustomerOrderCount', to_jsonb(s."newCustomerOrderCount"),       s."newCustomerOrderCount" <> 3),
    ('callAboveRupees',       to_jsonb(round(s."callAboveTotalPaise" / 100.0)::int), s."callAboveTotalPaise" <> 150000),
    ('callAboveUsualTimes',   to_jsonb(s."callAboveUsualMultiple"),      s."callAboveUsualMultiple" <> 3),
    ('skipCallForTrusted',    to_jsonb(s."skipCallForTrusted"),          s."skipCallForTrusted" <> true),
    ('skipCallForPrepaid',    to_jsonb(s."skipCallForPrepaid"),          s."skipCallForPrepaid" <> true),
    ('maxCallAttempts',       to_jsonb(s."maxCallAttempts"),             s."maxCallAttempts" <> 3)
) AS v(key, value, differs)
WHERE v.differs
ON CONFLICT ("scopeKey", "key") DO NOTHING;
