-- Phase 4, part 2 (2026-11-15): product kinds set by Farm For You admin (how each is measured, pack sizes, the
-- details asked for each product, defaults); farms' categories link to a kind and can add their own sizes and
-- details; products keep their answers. Additive only: safe for the running app. Run in the Supabase SQL editor,
-- then: npm run db:rls (locks the new table). Safe to run twice.

CREATE TABLE IF NOT EXISTS "product_kinds" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "nameTa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "art" TEXT NOT NULL,
    "measure" TEXT NOT NULL,
    "packs" JSONB NOT NULL DEFAULT '[]',
    "details" JSONB NOT NULL DEFAULT '[]',
    "weighedOnDelivery" BOOLEAN NOT NULL DEFAULT false,
    "shelfLifeDays" INTEGER,
    "hsn" TEXT,
    "gstRate" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_kinds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_kinds_key_key" ON "product_kinds"("key");

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "productKindId" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "packs" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "details" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "details" JSONB NOT NULL DEFAULT '{}';
