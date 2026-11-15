-- Fishery (2026-11-15): ponds' cycles from stocking to harvest, daily feed/losses/water checks, net samples, harvests.
-- Additive only: safe for the running app. Run in the Supabase SQL editor, then: npm run db:rls (locks the new
-- tables). Safe to run twice.

CREATE TABLE IF NOT EXISTS "fish_cycles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "placeId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "closedDate" TEXT,
    "note" TEXT,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fish_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "fish_stockings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "sizeGrams" DOUBLE PRECISION,
    "costPaise" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "expenseId" TEXT,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fish_stockings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "fish_days" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "feedKg" DOUBLE PRECISION,
    "feedInputId" TEXT,
    "feedUseId" TEXT,
    "dead" INTEGER NOT NULL DEFAULT 0,
    "ph" DOUBLE PRECISION,
    "oxygen" DOUBLE PRECISION,
    "tempC" DOUBLE PRECISION,
    "ammonia" DOUBLE PRECISION,
    "note" TEXT,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fish_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "fish_samples" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "species" TEXT,
    "count" INTEGER NOT NULL,
    "totalGrams" DOUBLE PRECISION NOT NULL,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fish_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fish_cycles_tenantId_closedDate_idx" ON "fish_cycles"("tenantId", "closedDate");
CREATE INDEX IF NOT EXISTS "fish_cycles_tenantId_placeId_idx" ON "fish_cycles"("tenantId", "placeId");
CREATE UNIQUE INDEX IF NOT EXISTS "fish_cycles_tenantId_number_key" ON "fish_cycles"("tenantId", "number");
CREATE INDEX IF NOT EXISTS "fish_stockings_tenantId_cycleId_idx" ON "fish_stockings"("tenantId", "cycleId");
CREATE INDEX IF NOT EXISTS "fish_days_tenantId_date_idx" ON "fish_days"("tenantId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "fish_days_cycleId_date_key" ON "fish_days"("cycleId", "date");
CREATE INDEX IF NOT EXISTS "fish_samples_tenantId_cycleId_date_idx" ON "fish_samples"("tenantId", "cycleId", "date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fish_stockings_cycleId_fkey') THEN
    ALTER TABLE "fish_stockings" ADD CONSTRAINT "fish_stockings_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "fish_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fish_days_cycleId_fkey') THEN
    ALTER TABLE "fish_days" ADD CONSTRAINT "fish_days_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "fish_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fish_samples_cycleId_fkey') THEN
    ALTER TABLE "fish_samples" ADD CONSTRAINT "fish_samples_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "fish_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Harvests (sold or kept)
CREATE TABLE IF NOT EXISTS "fish_harvests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "species" TEXT,
    "kg" DOUBLE PRECISION NOT NULL,
    "count" INTEGER,
    "soldPaise" INTEGER NOT NULL DEFAULT 0,
    "buyer" TEXT,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fish_harvests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fish_harvests_tenantId_cycleId_date_idx" ON "fish_harvests"("tenantId", "cycleId", "date");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fish_harvests_cycleId_fkey') THEN
    ALTER TABLE "fish_harvests" ADD CONSTRAINT "fish_harvests_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "fish_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
