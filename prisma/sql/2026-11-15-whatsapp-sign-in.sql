-- Phase 3, part 2 (2026-11-15): free customer sign-in. The customer sends a code to Farm For You's WhatsApp number;
-- a message from the typed number with the right code proves it. Additive only: safe for the running app. Run in the
-- Supabase SQL editor, then: npm run db:rls (locks the new table). Safe to run twice.

CREATE TABLE IF NOT EXISTS "whatsapp_sign_ins" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'ta',
    "codeHash" TEXT NOT NULL,
    "browserHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "provenAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_sign_ins_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "whatsapp_sign_ins_phone_createdAt_idx" ON "whatsapp_sign_ins"("phone", "createdAt");
CREATE INDEX IF NOT EXISTS "whatsapp_sign_ins_tenantId_phone_createdAt_idx" ON "whatsapp_sign_ins"("tenantId", "phone", "createdAt");
