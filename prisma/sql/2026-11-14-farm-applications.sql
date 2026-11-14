-- Phase 1b, part 1 (2026-11-14): farms that register themselves from the home page, and their review.
-- Additive only: safe for the running app. Run in the Supabase SQL editor, then: npm run db:rls (locks the new table).

CREATE TABLE "farm_applications" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nameTa" TEXT NOT NULL,
    "nameEn" TEXT,
    "modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "district" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "fssai" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "planId" TEXT,
    "message" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ta',
    "agreementVersion" TEXT NOT NULL,
    "agreedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "reply" TEXT,
    "reviewedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "tenantId" TEXT,
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "farm_applications_number_key" ON "farm_applications"("number");

CREATE INDEX "farm_applications_status_createdAt_idx" ON "farm_applications"("status", "createdAt");

CREATE INDEX "farm_applications_phone_idx" ON "farm_applications"("phone");

CREATE INDEX "farm_applications_sourceHash_createdAt_idx" ON "farm_applications"("sourceHash", "createdAt");

