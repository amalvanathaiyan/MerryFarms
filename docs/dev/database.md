# Database

Postgres on Supabase (free plan, Mumbai), reached only through Prisma on the server. Source of truth:
`prisma/schema.prisma` (each model has a `///` comment saying what it holds). **69 tables.**

**Checked against live on 2026-11-15 (read-only):**
- All 68 tables that should be live are there, with RLS on.
- `whatsapp_sign_ins` waits for its migration.
- Live has no extra tables.

## How schema changes go live

1. Edit `prisma/schema.prisma`. Every table gets `tenantId` (if it belongs to a farm), `createdAt @default(now())`
   and `updatedAt @default(now()) @updatedAt`. Add farm models to `TENANT_MODELS` in `src/lib/tenant-db.ts`.
2. Run `npx prisma generate`, then regenerate `prisma/sql/schema.generated.sql`
   (`npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`). Tests build their
   database from it.
3. Write `prisma/sql/<date>-<name>.sql`: additive (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
   guarded constraints), safe to run twice, with any data moves. Add a test that runs it twice.
4. **The user** runs it in the Supabase SQL editor, then `npm run db:rls`. Do this before deploying code that
   reads it. A drop goes in a separate `-cleanup.sql`, run only after the new code is live.
5. Verify with a read-only query.

Before 2026-11-12 the live schema was applied with `prisma db push` (which Prisma refuses from a Claude session
without consent; see decisions.md). Since then, every change has gone through a SQL file.

## Migration files (all applied live unless marked)

| File | What it did |
|---|---|
| `2026-11-12-plans-modules.sql` | `tenants.entitlements`; tables `platform_plans`, `farm_subscriptions`, `module_settings`, `farm_requests` |
| `2026-11-12-automation.sql` | `platform_events`, `jobs`, `automation_notices` (+ `automation_settings`, dropped later) |
| `2026-11-12-settings-registry.sql` | `setting_values`, `setting_controls`, `audit_log`; copied farms' own call rules into the registry |
| `2026-11-12-settings-registry-cleanup.sql` | **Dropped** `tenant_settings` and `automation_settings` (run after the code was live) |
| `2026-11-14-billing-announcements.sql` | `platform_invoices`, `platform_payments`, `announcements` |
| `2026-11-14-farm-applications.sql` | `farm_applications` |
| `2026-11-14-compliance.sql` | `products.complianceHold`; `restricted_items`, `compliance_cases` |
| `2026-11-14-farm-core-places.sql` | `expenses.placeId`, `expenses.assetId`; `farm_places`, `farm_assets` |
| `2026-11-14-workers.sql` | `workers`, `worker_days`, `worker_payments` |
| `2026-11-14-farm-store.sql` | `expenses.inputId`, `expenses.quantity`; `farm_inputs`, `input_uses`. Moved each farm's poultry feed into one "hen feed" store item (`batchFeed`) and linked its feed purchases |
| `2026-11-15-farm-tasks.sql` | `farm_tasks` |
| `2026-11-15-customers.sql` | `customers`: `personId`, `phoneVerifiedAt`, `source`, `kind`, `smsOptIn`, `addedByStaffId`; tables `platform_people`, `customer_consents`. Filled in how old customers came, and moved earlier offer consents into the log |
| `2026-11-15-fishery.sql` | `fish_cycles`, `fish_stockings`, `fish_days`, `fish_samples`, `fish_harvests` |
| `2026-11-15-whatsapp-sign-in.sql` | `whatsapp_sign_ins`. **NOT live yet**: run it as the first step of the Meta setup (`docs/todo.md`). The code never touches the table until the WhatsApp settings are set |
| `2026-11-15-email-sign-in.sql` | `customers.email`, `customers.emailVerifiedAt` (unique per farm); `otp_codes.email`. Applied live 2026-11-15 |
| `2026-11-15-farm-story.sql` | `tenants.storyTa`, `tenants.storyEn`. **NOT live yet**: run before the directory goes to main |
| `rls.sql` | Not a migration: run after every new table (`npm run db:rls`) |

**Columns added by `db push` before the SQL files** (2026-11-08 to 2026-11-12):
- Phase 0 brand: `tenants.taglineTa`, `taglineEn`, `nameColours`, `openingMark`, `themePrimary`, `themeAccent`.
- Phase 0 photos: `product_images.storagePath` and `tenant_logos.storagePath`, with their `data` made nullable.
- Egg store: `tenants.eggStore`, `products.eggsPerUnit`.
- Timestamps: `createdAt`/`updatedAt` on every table (2026-11-08).

**Removed tables:**
- `daily_records`: the single-flock record, replaced by batches on 2026-11-08 (`4492ac9`).
- `tenant_settings` and `automation_settings`: replaced by the settings registry on 2026-11-12 (`52ffdca`).

## Every table

"Since" = the commit that added the table. Every table has `createdAt` and `updatedAt`. Farm tables have
`tenantId` and are scoped by `tenantDb`.

### Platform (not one farm's)
| Table | Model | Holds | Since |
|---|---|---|---|
| `tenants` | Tenant | A farm: slug, names (ta/en), phone, plan, status, brand (tagline, name colours, opening, theme), story (ta/en, for its directory page), eggStore, entitlements, settings | 2026-10-21 `72471b5` |
| `platform_admins` | PlatformAdmin | Super admins (Supabase user ids) | 2026-10-21 |
| `login_usernames` | LoginUsername | Username sign-in for super admins and farm admins, unique, lowercase | 2026-11-08 `ffc7bef` |
| `platform_people` | PlatformPerson | One person per proven phone across FFY (name, language) | 2026-11-15 `23be0dd` |
| `platform_plans` | PlatformPlan | Plans built in admin: modules, limits, prices, trial, versions | 2026-11-12 `f107716` |
| `farm_subscriptions` | FarmSubscription | A farm's plan + add-ons | 2026-11-12 |
| `module_settings` | ModuleSetting | Each module on/off for all farms, and its add-on price | 2026-11-12 |
| `farm_requests` | FarmRequest | A farm asking for an add-on or a plan change | 2026-11-12 |
| `platform_events` | PlatformEvent | Activity log (order.placed, …) that rules react to | 2026-11-12 `04231f0` |
| `jobs` | Job | Queued/scheduled work with retries; every tick recorded | 2026-11-12 |
| `automation_notices` | AutomationNotice | Alerts already sent (sent once) | 2026-11-12 |
| `setting_values` | SettingValue | Saved settings by scope (platform / farm / staff / customer) | 2026-11-12 `52ffdca` |
| `setting_controls` | SettingControl | Admin lock / hide / first-farms per setting | 2026-11-12 |
| `audit_log` | AuditEntry | Who changed what, from what to what | 2026-11-12 |
| `platform_invoices` | PlatformInvoice | FFY's invoices to farms (frozen lines; GST off) | 2026-11-14 `51c7afa` |
| `platform_payments` | PlatformPayment | Farms' payments to FFY | 2026-11-14 |
| `announcements` | Announcement | Notes from FFY on farms' Today page | 2026-11-14 |
| `farm_applications` | FarmApplication | Farms registering from the home page, under review | 2026-11-14 `a7a7f73` |
| `restricted_items` | RestrictedItem | Restricted items list (words, action) | 2026-11-14 `7fafa5f` |
| `compliance_cases` | ComplianceCase | A farm's listing that matched, and the decision | 2026-11-14 |
| `support_visits` | SupportVisit | Super admin's support-mode visits to a farm (reason, expiry) | 2026-11-11 `38662d6` |
| `support_changes` | SupportChange | Each write made during a visit | 2026-11-11 |
| `whatsapp_sign_ins` | WhatsAppSignIn | Free sign-in requests: phone, code hash, browser hash, proven/used (has tenantId) | 2026-11-15 `ba61325`, **not live** |

### Farm: staff, catalogue, selling
| Table | Model | Holds | Since |
|---|---|---|---|
| `staff_members` | StaffMember | A login's place in one farm, with roles | 2026-10-21 |
| `categories` | Category | Product categories | 2026-10-21 |
| `products` | Product | Products: price, unit, stock, eggsPerUnit, art, complianceHold | 2026-10-21 |
| `product_images` | ProductImage | Product photos (now `storagePath` in Storage; old rows had bytes) | 2026-10-22 `1e96089` |
| `tenant_logos` | TenantLogo | Farm logo (Storage) | 2026-10-30 `463d417` |
| `farm_videos` | FarmVideo | Farm videos (Storage or YouTube) for the shop | 2026-11-10 `24bc22f` |
| `delivery_slots` | DeliverySlot | Delivery time slots | 2026-10-21 |
| `closed_days` | ClosedDay | Days or slots with no deliveries | 2026-10-22 `a574dc2` |
| `customers` | Customer | A farm's customer: phone, name, language, credit limit, accessToken, personId, phoneVerifiedAt (proven by a code or checked by the farm's call), email + emailVerifiedAt (for email sign-in), source, kind, offers opt-ins | 2026-10-21 |
| `customer_consents` | CustomerConsent | Offers consent log (DPDP): channel, given, how, by whom | 2026-11-15 `23be0dd` |
| `addresses` | Address | Customers' delivery addresses | 2026-10-21 |
| `orders` | Order | Orders: channel, status, slot, totals, source | 2026-10-21 |
| `order_items` | OrderItem | Order lines | 2026-10-21 |
| `order_events` | OrderEvent | Every status change (full audit trail) | 2026-10-21 |
| `confirmation_calls` | ConfirmationCall | The farm's confirmation calls | 2026-10-21 |
| `invoices` | Invoice | Issued invoices, frozen snapshot | 2026-10-21 |
| `invoice_counters` | InvoiceCounter | Invoice number per financial year | 2026-10-21 |
| `ledger_entries` | LedgerEntry | Khata (credit): charges +, payments − | 2026-10-21 |
| `payments` | Payment | Payments received | 2026-10-21 |
| `order_returns` | OrderReturn | Returns and short deliveries | 2026-10-21 `25ee6a6` |
| `message_templates` | MessageTemplate | The farm's own WhatsApp wording | 2026-10-21 `ad9605e` |
| `subscriptions` | Subscription | Customers' recurring plans (weekly/daily orders) | 2026-10-21 `38b0128` |
| `messages` | Message | In-app messages customer ↔ farm | 2026-10-22 `7bc995c` |
| `push_subscriptions` | PushSubscription | Phones that accepted notifications (customer or staff) | 2026-10-22 `b3e4bf1` |
| `otp_codes` | OtpCode | Sign-in codes we sent (hash only); `email` set for a code sent by email | 2026-10-22 `315b116` |

### Farm: money and records
| Table | Model | Holds | Since |
|---|---|---|---|
| `expenses` | Expense | Spending: kind, amount, batchId / placeId / assetId / inputId + quantity | 2026-10-22 `ced9bc3` |
| `production_entries` | ProductionEntry | Made/collected per product per day, spoiled | 2026-10-22 `d6f3be5` |

### Farm Core
| Table | Model | Holds | Since |
|---|---|---|---|
| `farm_places` | FarmPlace | Land, plots, sheds, ponds, wells, stores | 2026-11-14 `9465aa4` |
| `farm_assets` | FarmAsset | Motors, pumps, tractors, vehicles… with service dates | 2026-11-14 |
| `workers` | Worker | Workers (no login): pay type, rate | 2026-11-14 `07b2ffa` |
| `worker_days` | WorkerDay | Attendance: present / half / absent, where | 2026-11-14 |
| `worker_payments` | WorkerPayment | Wages and advances (→ labour expense) | 2026-11-14 |
| `farm_inputs` | FarmInput | Store items: feed, seed, fertiliser, medicine, packing (`batchFeed` = the poultry feed item) | 2026-11-14 `99ea002` |
| `input_uses` | InputUse | Taken out of the store (used, on a place) or a stock count | 2026-11-14 |
| `farm_tasks` | FarmTask | Jobs, once or repeating; due ones on Today | 2026-11-15 `57f3e0e` |

### Poultry (feature `poultryCare`)
| Table | Model | Holds | Since |
|---|---|---|---|
| `batches` | Batch | A batch of birds: purpose, source, hatch date, start count | 2026-11-08 `4492ac9` |
| `batch_days` | BatchDay | One day of a batch: feed, eggs, sold/given | 2026-11-08 |
| `batch_losses` | BatchLoss | Birds lost per day by cause | 2026-11-08 |
| `vaccine_schedule` | VaccineScheduleItem | The farm's vaccine plan by age | 2026-11-08 |
| `batch_vaccinations` | BatchVaccination | Doses planned/given per batch (cost → medicine expense) | 2026-11-08 |
| `batch_weights` | BatchWeight | Weighings for growth | 2026-11-10 `b7a5b67` |

### Fishery (feature `fishCare`)
| Table | Model | Holds | Since |
|---|---|---|---|
| `fish_cycles` | FishCycle | One crop of fish in one pond, start to close | 2026-11-15 `9282f56` |
| `fish_stockings` | FishStocking | Fingerlings put in (cost → "seeds" expense) | 2026-11-15 |
| `fish_days` | FishDay | Day's feed (a store use), dead, pH/oxygen/temperature/ammonia | 2026-11-15 |
| `fish_samples` | FishSample | Net samples for average size | 2026-11-15 |
| `fish_harvests` | FishHarvest | Fish taken out: kg, count, sold for, buyer | 2026-11-15 `1d507e0` |
