-- Phase 3, part 3 (2026-11-15): customers can sign in with a code sent to their email (sent through Brevo).
-- Additive only: safe for the running app. Run in the Supabase SQL editor, then: npm run db:rls. Safe to run twice.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenantId_email_key" ON "customers"("tenantId", "email");

ALTER TABLE "otp_codes" ADD COLUMN IF NOT EXISTS "email" TEXT;
