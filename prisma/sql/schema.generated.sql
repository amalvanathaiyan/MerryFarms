-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('trial', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'starter', 'growth', 'pro');

-- CreateEnum
CREATE TYPE "WhatsAppMode" AS ENUM ('lite', 'cloud');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ta', 'en');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('owner', 'order_desk', 'packing', 'delivery');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('to_confirm', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('whatsapp', 'web', 'phone', 'walk_in');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('upi_on_delivery', 'cash_on_delivery', 'upi_prepaid', 'credit');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('confirmed', 'changed', 'cancelled', 'no_answer', 'wrong_number');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('tax_invoice', 'bill_of_supply', 'credit_note');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('charge', 'payment', 'adjustment');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('received', 'pending', 'failed', 'refunded');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameTa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'trial',
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "trialEndsAt" TIMESTAMP(3),
    "defaultLanguage" "Language" NOT NULL DEFAULT 'ta',
    "phone" TEXT NOT NULL,
    "upiId" TEXT,
    "gstin" TEXT,
    "fssaiNo" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "whatsappMode" "WhatsAppMode" NOT NULL DEFAULT 'lite',
    "whatsappNumber" TEXT,
    "whatsappPhoneNumberId" TEXT,
    "whatsappAccessToken" TEXT,
    "whatsappWabaId" TEXT,
    "features" JSONB NOT NULL DEFAULT '{}',
    "deliveryFeePaise" INTEGER NOT NULL DEFAULT 3000,
    "freeAbovePaise" INTEGER NOT NULL DEFAULT 50000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callWhatsAppOrders" BOOLEAN NOT NULL DEFAULT true,
    "callWebOrdersFromNew" BOOLEAN NOT NULL DEFAULT true,
    "newCustomerOrderCount" INTEGER NOT NULL DEFAULT 3,
    "callAboveTotalPaise" INTEGER NOT NULL DEFAULT 150000,
    "callAboveUsualMultiple" INTEGER NOT NULL DEFAULT 3,
    "skipCallForTrusted" BOOLEAN NOT NULL DEFAULT true,
    "skipCallForPrepaid" BOOLEAN NOT NULL DEFAULT true,
    "callRetryMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxCallAttempts" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "roles" "StaffRole"[],
    "language" "Language" NOT NULL DEFAULT 'ta',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nameTa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "showOnWhatsApp" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "nameTa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "packTa" TEXT NOT NULL,
    "packEn" TEXT NOT NULL,
    "noteTa" TEXT,
    "noteEn" TEXT,
    "pricePaise" INTEGER NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "stockUnit" TEXT NOT NULL DEFAULT 'packs',
    "hsn" TEXT,
    "gstRate" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "onWeb" BOOLEAN NOT NULL DEFAULT true,
    "onWhatsApp" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_slots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nameTa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "cutoffHours" INTEGER NOT NULL DEFAULT 12,
    "maxOrders" INTEGER NOT NULL DEFAULT 20,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "delivery_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'ta',
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "creditLimitPaise" INTEGER NOT NULL DEFAULT 0,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "optInAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "landmark" TEXT,
    "pincode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "customerId" TEXT NOT NULL,
    "addressId" TEXT,
    "channel" "OrderChannel" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'to_confirm',
    "slotId" TEXT,
    "slotDate" TEXT NOT NULL,
    "slotLabel" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "subtotalPaise" INTEGER NOT NULL,
    "deliveryFeePaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "needsCall" BOOLEAN NOT NULL DEFAULT true,
    "cancelReason" TEXT,
    "note" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "gstRate" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "byStaffId" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmation_calls" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "calledById" TEXT,
    "note" TEXT,
    "durationSec" INTEGER,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmation_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "number" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,
    "publicToken" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "tenantId" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "nextSeq" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("tenantId","fy")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'received',
    "collectedById" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenantId_key" ON "tenant_settings"("tenantId");

-- CreateIndex
CREATE INDEX "staff_members_authUserId_idx" ON "staff_members"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_tenantId_authUserId_key" ON "staff_members"("tenantId", "authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_authUserId_key" ON "platform_admins"("authUserId");

-- CreateIndex
CREATE INDEX "categories_tenantId_idx" ON "categories"("tenantId");

-- CreateIndex
CREATE INDEX "products_tenantId_categoryId_idx" ON "products"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "delivery_slots_tenantId_idx" ON "delivery_slots"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenantId_phone_key" ON "customers"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "addresses_tenantId_customerId_idx" ON "addresses"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "orders_tenantId_status_idx" ON "orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "orders_tenantId_slotDate_slotId_idx" ON "orders"("tenantId", "slotDate", "slotId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenantId_number_key" ON "orders"("tenantId", "number");

-- CreateIndex
CREATE INDEX "order_items_tenantId_orderId_idx" ON "order_items"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "order_events_tenantId_orderId_idx" ON "order_events"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "confirmation_calls_tenantId_orderId_idx" ON "confirmation_calls"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_publicToken_key" ON "invoices"("publicToken");

-- CreateIndex
CREATE INDEX "invoices_tenantId_customerId_idx" ON "invoices"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "invoices_tenantId_fy_seq_idx" ON "invoices"("tenantId", "fy", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenantId_number_key" ON "invoices"("tenantId", "number");

-- CreateIndex
CREATE INDEX "ledger_entries_tenantId_customerId_idx" ON "ledger_entries"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "payments_tenantId_customerId_idx" ON "payments"("tenantId", "customerId");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_slots" ADD CONSTRAINT "delivery_slots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "delivery_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmation_calls" ADD CONSTRAINT "confirmation_calls_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

