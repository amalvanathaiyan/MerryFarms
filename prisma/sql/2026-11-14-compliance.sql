-- Phase 1b, part 2 (2026-11-14): the restricted items list, screening of farms' products, and the Compliance inbox.
-- Additive only: safe for the running app. Run in the Supabase SQL editor, then: npm run db:rls (locks the new tables).

ALTER TABLE "products" ADD COLUMN "complianceHold" TEXT;

CREATE TABLE "restricted_items" (
    "id" TEXT NOT NULL,
    "labelTa" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "wordsTa" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wordsEn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "action" TEXT NOT NULL,
    "reasonTa" TEXT NOT NULL,
    "reasonEn" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restricted_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance_cases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "matched" TEXT NOT NULL,
    "itemId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "wasActive" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compliance_cases_status_createdAt_idx" ON "compliance_cases"("status", "createdAt");

CREATE INDEX "compliance_cases_tenantId_status_idx" ON "compliance_cases"("tenantId", "status");

CREATE INDEX "compliance_cases_subjectId_idx" ON "compliance_cases"("subjectId");

