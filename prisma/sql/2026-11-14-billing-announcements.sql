-- Phase 1, admin v2 part 2 (2026-11-14): Farm For You's invoices and payments to farms, and announcements.
-- Additive only: safe for the running app. Run in the Supabase SQL editor, then: npm run db:rls (locks the new tables).

-- CreateTable
CREATE TABLE "platform_invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodStart" TEXT,
    "periodEnd" TEXT,
    "lines" JSONB NOT NULL,
    "subtotalPaise" INTEGER NOT NULL,
    "gstRatePct" INTEGER NOT NULL DEFAULT 0,
    "gstKind" TEXT NOT NULL DEFAULT 'none',
    "gstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'due',
    "issuedOn" TEXT NOT NULL,
    "dueOn" TEXT NOT NULL,
    "seller" JSONB NOT NULL,
    "buyer" JSONB NOT NULL,
    "notes" TEXT,
    "voidReason" TEXT,
    "createdBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidOn" TEXT NOT NULL,
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "titleTa" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyTa" TEXT,
    "bodyEn" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'info',
    "audience" TEXT NOT NULL DEFAULT 'owners',
    "onlyFarms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startsOn" TEXT NOT NULL,
    "endsOn" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_invoices_number_key" ON "platform_invoices"("number");
CREATE INDEX "platform_invoices_tenantId_issuedOn_idx" ON "platform_invoices"("tenantId", "issuedOn");
CREATE INDEX "platform_invoices_status_dueOn_idx" ON "platform_invoices"("status", "dueOn");
CREATE INDEX "platform_payments_invoiceId_idx" ON "platform_payments"("invoiceId");
CREATE INDEX "platform_payments_tenantId_paidOn_idx" ON "platform_payments"("tenantId", "paidOn");
CREATE INDEX "announcements_startsOn_idx" ON "announcements"("startsOn");

ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "platform_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
