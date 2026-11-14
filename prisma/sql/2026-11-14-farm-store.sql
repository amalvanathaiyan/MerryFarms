-- Phase 2, part 3 (2026-11-14): Farm Core's store (feed, seed, fertiliser, medicine, packing), replacing the
-- poultry feed store. Run in the Supabase SQL editor, then: npm run db:rls (locks the new tables).
--
-- Additive, and the running app keeps working before and after it. It also moves each farm's feed into the store:
-- every farm with feed bought by the kg, or feed given to batches, gets one "hen feed" item (in the farm's own
-- language), and its feed purchases are linked to it. Nothing is changed or removed, so the feed left and each
-- batch's feed cost stay exactly what they were. Safe to run twice.

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "inputId" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "quantity" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "farm_inputs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "lowAt" DOUBLE PRECISION,
    "batchFeed" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_inputs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "input_uses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'used',
    "quantity" DOUBLE PRECISION NOT NULL,
    "placeId" TEXT,
    "note" TEXT,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "input_uses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "expenses_inputId_idx" ON "expenses"("inputId");
CREATE INDEX IF NOT EXISTS "farm_inputs_tenantId_idx" ON "farm_inputs"("tenantId");
CREATE INDEX IF NOT EXISTS "input_uses_tenantId_inputId_idx" ON "input_uses"("tenantId", "inputId");
-- One hen-feed item per farm
CREATE UNIQUE INDEX IF NOT EXISTS "farm_inputs_one_batch_feed" ON "farm_inputs"("tenantId") WHERE "batchFeed";

-- The feed store moves in: one hen-feed item for each farm that has feed…
INSERT INTO "farm_inputs" ("id", "tenantId", "name", "kind", "unit", "batchFeed", "updatedAt")
SELECT gen_random_uuid()::text, t."id", CASE WHEN t."defaultLanguage"::text = 'en' THEN 'Hen feed' ELSE 'கோழித் தீவனம்' END, 'feed', 'kg', true, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (SELECT 1 FROM "farm_inputs" i WHERE i."tenantId" = t."id" AND i."batchFeed")
  AND (
    EXISTS (SELECT 1 FROM "expenses" e WHERE e."tenantId" = t."id" AND e."kind" = 'feed' AND e."quantityKg" > 0)
    OR EXISTS (SELECT 1 FROM "batch_days" d WHERE d."tenantId" = t."id" AND d."feedKg" > 0)
  );

-- …and the feed it bought by the kg is that item's purchases.
UPDATE "expenses" e
SET "inputId" = i."id", "quantity" = e."quantityKg"
FROM "farm_inputs" i
WHERE i."tenantId" = e."tenantId" AND i."batchFeed"
  AND e."kind" = 'feed' AND e."quantityKg" > 0 AND e."inputId" IS NULL;
