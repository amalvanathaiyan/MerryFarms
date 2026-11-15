# Architecture

How Farm For You is built, end to end. Product scope and phases are in `docs/platform-plan.md`; tables in
[database.md](database.md); decisions in [decisions.md](decisions.md); where work stands in [status.md](status.md).

## 1. The three apps on one codebase

One Next.js app serves three installable PWAs, told apart by address (`src/domain/app-hosts.ts`, tested):

| App | Who | Paths | Address now (Vercel aliases) | With the domain |
|---|---|---|---|---|
| **Shop** | customers | `/`, `/my`, `/i/[token]` | `merry-farms.vercel.app` | `<farm>.farmforyou.in` |
| **Farm app** | farm admin (owner) and staff | `/farm/**` | `farmforyou-farm.vercel.app` | `<farm>-farm.farmforyou.in` |
| **Portal** | public home page, farm directory, farm sign-up, super admin | `/welcome`, `/farms`, `/farms/[slug]`, `/join`, `/legal/*`, `/admin/**` | `farmforyou.vercel.app` | `farmforyou.in` |

- Each app has its own address because Android treats a second app on the same address as "already installed".
- `SHOP_HOST`, `FARM_APP_HOST` and `PORTAL_HOST` set the addresses. Setting `NEXT_PUBLIC_ROOT_DOMAIN` switches to
  subdomains, so moving to the domain is a settings change.
- Any other address (local, preview deployments) serves every app on one host.
- `/api`, `/auth`, `/img`, `/legal`, `/offline`, `/app-manifest` and `/forgot-password` work on every address
  (`EVERYWHERE` in app-hosts.ts).
- Each app has its own manifest (`/app-manifest?app=shop|farm|admin`), icon and opening animation.

**Request flow (`src/proxy.ts`):**
1. The proxy reads the host and works out the app and the farm: a subdomain, a `/f/<farm>` link (remembered in the
   `ffy_farm` cookie), or `DEFAULT_TENANT_SLUG`.
2. It passes the farm on as `x-tenant-slug`, and `x-tenant-fallback` when a `/f/` farm no longer exists.
3. It sends a path that belongs to another app to that app's address.
4. It sets `x-opening-app` so the right opening plays.
5. It refreshes the Supabase session and sends signed-out visitors to `/farm` or `/admin` to `/login`. Demo mode
   uses a demo cookie instead.

## 2. Layers

```
src/app/            pages (server components) and route handlers; src/app/actions/*.ts = server actions ("use server")
src/components/     UI: ui/ (button, input, card…), shop/, farm/, platform/, art/, chat/, push/, settings/
src/server/         server-only work: loads and saves through Prisma, sends messages, runs jobs ("server-only")
src/domain/         pure rules with no I/O: prices, stock, dates (IST), features, settings, alerts, fish, otp…
src/lib/            glue: prisma client, tenant + tenantDb, auth, customer session, features, URLs, utils
prisma/             schema.prisma; sql/ = hand-run migrations, rls.sql, schema.generated.sql
messages/           ta.json and en.json (next-intl), Tamil first
scripts/            demo, dev-db, apply-sql, add-staff/add-admin, photo move, vapid keys, brand art generators
```

- **Rules live in `src/domain`** and are unit-tested (`*.test.ts`). `src/server` calls them and touches the
  database. Its integration tests (`*.integration.test.ts`) run on a real Postgres: PGlite behind
  `PGLiteSocketServer`, one port per file (54329–54385), loaded from `schema.generated.sql`. Each file mocks
  `server-only`.
- **Server actions** check input with zod, check the role (`requireStaff([...])`), call `src/server`, and return
  `{ ok: true } | { ok: false, error: "<key>" }`. The `error` keys are translated under `errors` in messages.
  `OrderError(code)` (in `src/server/orders.ts`) carries those keys from deeper code.
- **Money** is integer paise (`*Paise`). Dates the farm thinks in are `YYYY-MM-DD` strings in IST
  (`src/domain/ist.ts`); moments are `DateTime`.

**Farm directory** (`/farms`, `src/server/directory.ts`, rules in `src/domain/directory.ts`): listed farms are not
suspended, have `webShop` on and the `listedOnFfy` setting on (default on). The search takes a PIN code (farms that
serve by distance are judged from the PIN's centre, one Nominatim lookup per search, with `PIN_SLACK_KM` of "ask"),
or the phone's spot, plus product words. Farms that deliver come first (nearest first), then "call to check"; farms
that don't are left out. `/farms/[slug]` is a farm's page: story, what it sells (the shop's products; photos via
`/img/p/[id]?farm=<slug>`), where it delivers, YouTube videos, shop / call / WhatsApp. Path checks use
`isFarmPath()` so `/farms` is never taken for the farm app's `/farm`.

## 3. Multi-tenancy and security

- **Every farm table has `tenantId`.** `tenantDb(tenantId)` (`src/lib/tenant-db.ts`) wraps Prisma so every query
  on a model in `TENANT_MODELS` is pinned to one farm: where-clauses are scoped, and creates must carry the same
  tenantId. Plain `prisma` is used only for platform tables and deliberate cross-farm work (cron jobs, the WhatsApp
  webhook, admin).
- **RLS second lock:** `prisma/sql/rls.sql` (run with `npm run db:rls`) turns RLS on for every public table with no
  policies, and revokes all from `anon` and `authenticated`. The Supabase Data API is off. The app connects as the
  owner through Prisma, so RLS doesn't affect it.
- **Secrets never reach pages:** `getTenant()` omits `whatsappAccessToken`.
- **Support mode:** the super admin can open any farm's app with full rights. It's started from Admin → Farms → farm
  with a typed reason, carried in the signed `ffy_support` cookie (`SUPPORT_SECRET`), and expires. Each visit is a
  `support_visits` row; tenantDb writes are recorded in `support_changes`, and the farm sees them on Account. A
  dark bar shows the whole time. Logins and passwords can't be changed in support mode (`requireNotSupport`).

## 4. Who signs in, and how

| Who | How | Code |
|---|---|---|
| Super admin | Supabase Auth email + password, or a username (`login_usernames`); a `platform_admins` row | `requirePlatformAdmin()` in `src/lib/auth.ts`, `/admin/**` |
| Farm admin and staff | Supabase Auth email + password, or a username; one `staff_members` row per farm, with roles | `requireStaff(roles?)`, `requireStaffAdmin()` |
| Customer | Phone number proven with a one-time code, then the `mf_c` cookie (the customer's `accessToken`) for 90 days | `src/lib/customer-session.ts`, `src/app/actions/sign-in.ts` |

- **Logins:** a super admin login is never a farm login. Farm logins are made in admin and handed over. Owners
  change their own password, and admin resets a forgotten one (`/auth/update-password`, `/forgot-password`).
- **Staff roles** (`StaffRole`): `owner`; `manager` (the owner's rights except the Staff list; the old schema
  comment saying "sees no totals" is out of date); `order_desk`; `packing`; `delivery`. Pages and actions list the
  roles they allow.
- **Customer codes**, free first:
  1. *WhatsApp, the customer sends the code*: `src/server/whatsapp-sign-in.ts`, `/api/whatsapp/webhook`.
  2. A code we send: `OTP_PROVIDER=whatsapp` (paid template) or `msg91` (SMS). The local demo shows the code on
     screen. `src/server/otp.ts`.
  3. A code to their **email** (Brevo, `src/server/email.ts`; `requestEmailCode`/`verifyEmailCode` in otp.ts, rows in
     `otp_codes` with `email` set). It proves the email, not the phone (`emailSignInCase` in `src/domain/otp.ts`):
     - it signs in the farm's customer with that phone **and** that proven email
     - a number new to the farm may register by email, with the phone **unchecked** (no PlatformPerson link; its web
       orders always need a call, and a call that confirms one checks the phone)
     - a number the farm already knows without that email is refused (WhatsApp or a call instead)

     Customers with a proven phone add or remove an email for signing in on `/my`.

  A proven phone becomes or joins a `platform_people` row (one person across all farms, `src/server/people.ts`).
  With no sign-in way set up, the shop falls back to personal links (`/i/[token]`, `/my/[token]`) and the
  connect form.
- **Demo:** `npm run demo` runs a throwaway PGlite database with demo sign-in (`DEMO_LOGIN=1`, `src/lib/demo-auth.ts`).

## 5. What a farm may use: modules, features, plans, settings

- **Modules** (`src/domain/modules.ts`): `core` (always on), `selling`, `poultry` and `fishery` are built;
  `buying`, `livestock` and `crops` are "coming soon".
- **Features** (`src/domain/features.ts`): switches inside a module, e.g.
  - selling: `webShop`, `callConfirmation`, `stockTracking`, `creditAccounts`, `invoices`, `returns`,
    `deliveryArea`, `customerAccounts`, `messages`, `otpLogin`, `subscriptions`, `whatsappLite`/`Cloud`, `farmVideos`…
  - core: `farmRecords`, `pushNotifications`, `whatsappAlerts`, `reports`
  - `poultryCare` (poultry) and `fishCare` (fishery)

  Each has `defaultOn`, `minPlan` and `requires`.
- **Plans** are made in admin from modules, with limits (`products`, `staff`, `ordersPerMonth`, `videoSpaceMb`),
  prices and versions. A farm's plan + add-ons + admin overrides are worked out into `tenants.entitlements`
  (`src/domain/entitlements.ts`, `src/server/subscriptions.ts`). `featuresOf(tenant)` (`src/lib/features.ts`) gives
  the switches pages use, and `require-feature.ts` guards pages.
- **Settings registry** (`src/domain/settings.ts`, `src/server/settings.ts`): every option is layered
  default → platform → farm → user (`setting_values`). Admin can lock or hide a setting, or offer it to chosen farms
  first (`setting_controls`). Changes go to `audit_log`. Farms see them under Settings → Choices; admin under
  Admin → Settings.

## 6. Background work and automation

| Job | When | What |
|---|---|---|
| `/api/cron/plans` | Vercel cron 12:30 UTC (18:00 IST) | Recurring plan orders for today and tomorrow, prune old sign-in codes and WhatsApp sign-ins, evening "not entered today" reminders |
| `/api/cron/morning` | Vercel cron 01:30 UTC (07:00 IST) | Vaccines due, yesterday's warnings, farm jobs due, machine services, store running low, pond water and size checks |
| `/api/cron/tick` | GitHub Actions every ~10 min (`.github/workflows/tick.yml`, secrets `TICK_URL`, `CRON_SECRET`) | The automation engine: due `jobs`, recipes (waiting orders turn yellow then red, low stock, trial ending), each alert sent once (`automation_notices`) |
| Nightly backup | GitHub Actions 03:00 IST (`.github/workflows/backup.yml`) | Encrypted `pg_dump`, kept 30 days as an artifact (`docs/backups.md`) |

- Every cron route needs `Authorization: Bearer <CRON_SECRET>` and is safe to run twice.
- Events are written with `emitEvent()` (`src/server/events.ts`) into `platform_events` (the activity log that
  rules react to).
- The farm app's Today page also does due work when opened.

## 7. Messaging and notifications

- **Web push** (`web-push`, VAPID keys): `src/server/notify.ts` sends to staff by role and to customers.
  Subscriptions are in `push_subscriptions`.
- **In-app messages** between a customer and the farm: `messages` table, `src/server/messages.ts`, `/farm/messages`,
  `/my/messages`.
- **WhatsApp:**
  - **Lite** (free): `wa.me` links and share text, with the farm's own wording in `message_templates`.
  - **Cloud API** (Farm For You's one number, `src/server/whatsapp-cloud.ts`): new-order alerts to farms (template),
    paid sign-in codes (template), free replies, and the sign-in webhook.

## 8. Files and media

- **Supabase Storage** (bucket `farm-media`, 50 MB per file on the free plan): product photos, farm logos and farm
  videos (`src/server/photos.ts`, `media-store.ts`, `videos.ts`).
- **Shrinking:** phones shrink photos before upload (`src/lib/shrink-photo.ts`). Videos are prepared in the
  browser (`mediabunny`, `src/lib/video-prep.ts`).
- **Serving:** `/img/p/[id]`, `/img/logo` and `/img/app-icon` (`sharp` makes icon PNGs).
- **History:** older rows kept photo bytes in the database; `storagePath` replaced that
  (`scripts/move-photos-to-storage.mts`).

## 9. Maps and places

- **Delivery area** by PIN code or a distance from the farm (`src/domain/delivery-area.ts`).
- **Place lookup** with OpenStreetMap Nominatim (`NOMINATIM_URL`, at most 1 request a second, `GEO_CONTACT_EMAIL`
  in the User-Agent) in `src/server/geo.ts`.
- **Map:** Leaflet in checkout (`NEXT_PUBLIC_MAP_TILES_URL`).

## 10. Look and feel

- **Brand colours:** `src/domain/brand-theme.ts` sets each farm's `themePrimary`/`themeAccent`. The `.ffy-chrome`
  class gives admin and sign-in Farm For You's colours, and section colours are tokens (`--sec-*`) in
  `src/app/globals.css`.
- **Display:** an "Easy on the eyes" setting (`src/components/display-settings.tsx`).
- **Art:** brand marks are generated by `scripts/art/brand/*.cjs` into `src/components/art/brand-marks.generated.ts`
  and `public/icons/*`. Farm scenes (`farm-scene-svg.ts`, `scenes.ts`) rotate daily and follow IST time of day.
- **Openings:** played by `src/components/openings.tsx`, driven by `OPENING_SCRIPT` (`src/lib/opening.ts`), with
  optional sounds (`opening-sounds.ts`).
- **Language:** Tamil first through next-intl. The language toggle uses full words; `src/domain/tamil-typing.ts`
  helps with typing.
- **PWA:** `@ducanh2912/next-pwa`, an offline page, and an install card (`src/components/install-app.tsx`) with
  per-browser steps.

## 11. Farm app sections (`/farm`)

`src/lib/farm-sections.ts` builds the bottom menu from the farm's features: Today, Orders, Customers, Poultry,
Fish, Money, More.

| Section | Pages | What it covers |
|---|---|---|
| **Today** (`/farm`) | | The day's jobs, announcements, alerts and the farm picture |
| **Orders** | `/farm/orders` (new, counter, edit, return), `/farm/invoices/[id]`, `/farm/slots`, `/farm/plans` | Orders, counter sales (no name: one stand-in customer per farm, phone `counter`, `src/server/counter.ts`; left out of customer lists, search and counts), invoices, delivery slots, recurring plans |
| **Customers** | `/farm/customers` (+ `[id]`), `/farm/messages` | Customers and messages |
| **Catalogue** | `/farm/catalogue` | Products and categories; sizes of one product (same category and names, `src/domain/sizes.ts`) shown together with "Add a size" |
| **Poultry** | `/farm/poultry/*` | entry, today, batches, feed, vaccines (+ plan), growth, costs, profit |
| **Fish** | `/farm/fish`, `/farm/fish/entry`, `/farm/fish/[id]` | Ponds |
| **My farm** | `/farm/land` (+ assets, store, tasks, workers) | Farm Core |
| **Money** | `/farm/money` (+ made, spending, profit), `/farm/records`, `/farm/reports` (+ export) | Money, records, reports |
| **Settings** | `/farm/settings` (choices, delivery, look, plan, videos, switches→choices, automations→choices) | The farm's settings |
| **Other** | `/farm/staff`, `/farm/account`, `/farm/whatsapp`, `/farm/export/all` | Staff, account, WhatsApp, full export |

## 12. Admin (`/admin`)

| Area | Pages | What it covers |
|---|---|---|
| **Dashboard** | `/admin` | Leads with what needs the super admin |
| **Farms** | `/admin/farms` (+ new, `[id]`, applications) | Farms and sign-up reviews |
| **Plans** | `/admin/plans`, `/admin/modules`, `/admin/requests` | Plans, modules, farms' requests |
| **Billing** | `/admin/billing` | FFY's invoices and payments; the GST switch is off |
| **Compliance** | `/admin/compliance` (+ items) | Restricted items list and Compliance inbox |
| **Other** | `/admin/announcements`, `/admin/settings`, `/admin/automation`, `/admin/audit`, `/admin/tech`, `/admin/account` | `tech` is the tech monitor: version, services, sign-in way, database and storage use against free limits, the tick |

## 13. Settings (environment)

See `.env.local.template`, which has the same names with comments. Vercel holds the live values.

| Setting | For |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase Auth and Storage |
| `DATABASE_URL` (pooler), `DIRECT_URL` (direct) | Prisma; the scripts use `DIRECT_URL` |
| `DEFAULT_TENANT_SLUG`, `SHOP_HOST`, `FARM_APP_HOST`, `PORTAL_HOST`, `NEXT_PUBLIC_ROOT_DOMAIN` | Which farm and app an address is |
| `CRON_SECRET` | Cron and tick routes |
| `SUPPORT_SECRET` | Signs the support-mode cookie |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push (`node scripts/vapid-keys.mjs`) |
| `OTP_SECRET`, `OTP_PROVIDER`, `WHATSAPP_OTP_TEMPLATE`, `MSG91_*` | Customer sign-in codes |
| `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | Email sign-in codes (Brevo) |
| `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ALERT_TEMPLATE` | Cloud API sending |
| `WHATSAPP_NUMBER`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Free sign-in webhook |
| `GEO_CONTACT_EMAIL`, `NOMINATIM_URL`, `NEXT_PUBLIC_MAP_TILES_URL` | Maps and place lookup |
| `DEMO_LOGIN` | Demo sign-in (demo only) |

## 14. Hosting and running

- **Live:** Vercel Hobby, region `bom1`, builds GitHub `main`. Supabase free plan, Mumbai.
- **Local:**
  - `npm run demo` for a full walkthrough on throwaway data.
  - `npm run dev` runs against `.env.local`, which points at the **live** database.
  - `npm run dev:db` runs a local PGlite database.
- **Commands:** `typecheck`, `lint`, `test` (Vitest), `db:sql` (schema → SQL), `db:rls`, `db:seed`,
  `staff:add`, `admin:add`.
- **Known issue:** `npm run build` fails locally because of the apostrophe in the "Amal's Space" path.
