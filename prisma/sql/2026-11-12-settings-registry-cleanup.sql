-- Phase 1, step 3 (2026-11-12), part 2 of 2: removes the two tables the settings registry replaced.
-- Run in the Supabase SQL editor only AFTER the new code is live on merry-farms.vercel.app (the old code reads
-- tenant_settings when an order is placed). Part 1 already copied any farm's own call rules into setting_values.
-- automation_settings was never written to (checked on 2026-11-12: empty).

-- DropForeignKey
ALTER TABLE "tenant_settings" DROP CONSTRAINT "tenant_settings_tenantId_fkey";

-- DropTable
DROP TABLE "automation_settings";

-- DropTable
DROP TABLE "tenant_settings";
