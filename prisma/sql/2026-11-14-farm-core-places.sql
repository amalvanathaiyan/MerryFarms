-- Phase 2, part 1 (2026-11-14): Farm Core places (land, plots, sheds, ponds, wells) and assets, and what spending was for.
-- Additive only: safe for the running app. Run in the Supabase SQL editor, then: npm run db:rls (locks the new tables).

ALTER TABLE "expenses" ADD COLUMN "placeId" TEXT, ADD COLUMN "assetId" TEXT;
CREATE INDEX "expenses_placeId_idx" ON "expenses"("placeId");
CREATE INDEX "expenses_assetId_idx" ON "expenses"("assetId");

CREATE TABLE "farm_places" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "area" DOUBLE PRECISION,
    "areaUnit" TEXT NOT NULL DEFAULT 'acre',
    "surveyNo" TEXT,
    "soil" TEXT,
    "depthFt" DOUBLE PRECISION,
    "notes" TEXT,
    "retiredAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_places_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "farm_assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placeId" TEXT,
    "boughtOn" TEXT,
    "costPaise" INTEGER,
    "serviceEveryDays" INTEGER,
    "lastServiceOn" TEXT,
    "notes" TEXT,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "farm_places_tenantId_idx" ON "farm_places"("tenantId");

CREATE INDEX "farm_assets_tenantId_idx" ON "farm_assets"("tenantId");

