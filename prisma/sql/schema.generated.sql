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
CREATE TYPE "LedgerType" AS ENUM ('charge', 'payment', 'adjustment', 'credit_note', 'refund');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('customer', 'farm');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('damaged', 'short_delivered', 'returned', 'quality', 'other');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('account', 'cash', 'upi');

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
    "farmLat" DOUBLE PRECISION,
    "farmLng" DOUBLE PRECISION,
    "deliveryRadiusKm" DOUBLE PRECISION,
    "servedPincodes" TEXT[],
    "deliveryFeePaise" INTEGER NOT NULL DEFAULT 3000,
    "freeAbovePaise" INTEGER NOT NULL DEFAULT 50000,
    "logoUrl" TEXT,
    "shopArt" TEXT[] DEFAULT ARRAY[]::TEXT[],
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
    "staffCode" TEXT,
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
    "email" TEXT,
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
    "kind" TEXT,
    "deletedAt" TIMESTAMP(3),

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
    "offerPricePaise" INTEGER,
    "offerEndsOn" TEXT,
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
    "accessToken" TEXT,
    "tokenIssuedAt" TIMESTAMP(3),
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
    "locationSource" TEXT,
    "placeName" TEXT,
    "receiverName" TEXT,
    "receiverPhone" TEXT,
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
    "subscriptionId" TEXT,
    "areaCheck" TEXT,
    "distanceKm" DOUBLE PRECISION,
    "pinCheck" TEXT,
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
    "refInvoiceId" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "tenantId" TEXT NOT NULL,
    "series" TEXT NOT NULL DEFAULT 'INV',
    "fy" TEXT NOT NULL,
    "nextSeq" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("tenantId","series","fy")
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

-- CreateTable
CREATE TABLE "order_returns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "note" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "deliveryFeePaise" INTEGER NOT NULL DEFAULT 0,
    "refundMethod" "RefundMethod" NOT NULL,
    "restocked" BOOLEAN NOT NULL DEFAULT false,
    "creditNoteId" TEXT,
    "byStaffId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "bodyTa" TEXT,
    "bodyEn" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "addressId" TEXT,
    "slotId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "daysOfWeek" INTEGER[],
    "paymentMethod" "PaymentMethod" NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "startDate" TEXT NOT NULL,
    "pausedUntil" TEXT,
    "skipDates" TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "body" TEXT NOT NULL,
    "orderId" TEXT,
    "byStaffId" TEXT,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "staffId" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSentAt" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "productId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "tenant_logos" (
    "tenantId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_logos_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closed_days" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slotId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closed_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "eggsCollected" INTEGER,
    "eggsBroken" INTEGER,
    "birds" INTEGER,
    "birdsLost" INTEGER,
    "feedKg" DOUBLE PRECISION,
    "note" TEXT,
    "byStaffId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "note" TEXT,
    "byStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "made" DOUBLE PRECISION NOT NULL,
    "wasted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "byStaffId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_entries_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "staff_members_tenantId_staffCode_key" ON "staff_members"("tenantId", "staffCode");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_authUserId_key" ON "platform_admins"("authUserId");

-- CreateIndex
CREATE INDEX "categories_tenantId_idx" ON "categories"("tenantId");

-- CreateIndex
CREATE INDEX "products_tenantId_categoryId_idx" ON "products"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "delivery_slots_tenantId_idx" ON "delivery_slots"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_accessToken_key" ON "customers"("accessToken");

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
CREATE UNIQUE INDEX "orders_subscriptionId_slotDate_key" ON "orders"("subscriptionId", "slotDate");

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

-- CreateIndex
CREATE INDEX "order_returns_tenantId_orderId_idx" ON "order_returns"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_tenantId_key_key" ON "message_templates"("tenantId", "key");

-- CreateIndex
CREATE INDEX "subscriptions_tenantId_status_idx" ON "subscriptions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "messages_tenantId_customerId_createdAt_idx" ON "messages"("tenantId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_tenantId_sender_seenAt_idx" ON "messages"("tenantId", "sender", "seenAt");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenantId_customerId_idx" ON "push_subscriptions"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenantId_staffId_idx" ON "push_subscriptions"("tenantId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_tenantId_endpoint_key" ON "push_subscriptions"("tenantId", "endpoint");

-- CreateIndex
CREATE INDEX "product_images_tenantId_idx" ON "product_images"("tenantId");

-- CreateIndex
CREATE INDEX "otp_codes_tenantId_phone_createdAt_idx" ON "otp_codes"("tenantId", "phone", "createdAt");

-- CreateIndex
CREATE INDEX "closed_days_tenantId_date_idx" ON "closed_days"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_records_tenantId_date_key" ON "daily_records"("tenantId", "date");

-- CreateIndex
CREATE INDEX "expenses_tenantId_date_idx" ON "expenses"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "production_entries_tenantId_date_productId_key" ON "production_entries"("tenantId", "date", "productId");

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
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_refInvoiceId_fkey" FOREIGN KEY ("refInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "delivery_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

