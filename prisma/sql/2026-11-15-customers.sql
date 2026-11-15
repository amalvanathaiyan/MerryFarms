-- Phase 3, part 1 (2026-11-15): one person per proven phone across Farm For You, how each customer came, their type,
-- customers added by staff, and the consent log. Additive only: safe for the running app. Run in the Supabase SQL
-- editor, then: npm run db:rls (locks the new tables). Safe to run twice.

CREATE TABLE IF NOT EXISTS "platform_people" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'ta',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_people_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_people_phone_key" ON "platform_people"("phone");

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "personId" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'home';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "smsOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "addedByStaffId" TEXT;
CREATE INDEX IF NOT EXISTS "customers_personId_idx" ON "customers"("personId");

CREATE TABLE IF NOT EXISTS "customer_consents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "given" BOOLEAN NOT NULL,
    "how" TEXT NOT NULL,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "customer_consents_tenantId_customerId_createdAt_idx" ON "customer_consents"("tenantId", "customerId", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_consents_customerId_fkey') THEN
    ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- How existing customers came: the channel of their first order (customers with no orders stay unknown).
UPDATE "customers" c SET "source" = CASE o."channel"::text WHEN 'web' THEN 'online' ELSE o."channel"::text END
FROM (
  SELECT DISTINCT ON ("customerId") "customerId", "channel" FROM "orders" ORDER BY "customerId", "createdAt"
) o
WHERE o."customerId" = c."id" AND c."source" IS NULL;

-- Offers already agreed to on WhatsApp go into the log once, dated when they agreed.
INSERT INTO "customer_consents" ("id", "tenantId", "customerId", "channel", "given", "how", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."tenantId", c."id", 'whatsapp', true, 'earlier', COALESCE(c."optInAt", c."createdAt"), CURRENT_TIMESTAMP
FROM "customers" c
WHERE c."marketingOptIn" AND NOT EXISTS (SELECT 1 FROM "customer_consents" k WHERE k."customerId" = c."id");
