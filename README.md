# FarmForYou

A Tamil-first, multi-tenant platform for small farms that sell direct to customers over WhatsApp and a web shop. Each farm is a tenant with its own shop, staff, customers and data. Merry Farms (country eggs and naatu kozhi) is the first farm.

- Product & tech plan: https://claude.ai/code/artifact/f8a2eb07-5b60-4226-bfb6-7fc7bef59c26
- Clickable prototype: `prototype/index.html`

## What's built (phase 1, first slice)

| Area | What works |
| --- | --- |
| Customer shop (`/`) | Tamil by default with an English switch; products by category with photos (a drawn egg, hen or basket until the farm adds one); live stock; delivery slots with cut-off and limits; checkout without login; "send to the farm on WhatsApp" after ordering |
| Farm app (`/farm`) | Staff sign-in; **Today** (to-confirm count, open orders, sales, packing list, delivery runs, low stock); **Orders** (call button, read-out script, call outcomes, next step, cancel, one-tap WhatsApp Lite message in the customer's language); **Products** (add/edit/delete, categories, price, stock, GST, show/hide, photo taken or picked on the phone and shrunk to ~50 KB before upload, kept in the database so no file storage is needed); **Slots** (add/edit/delete, days, cut-off, max orders) |
| Prices & offers | **Offer price** per product with an optional last day: the shop shows the offer price, the usual price struck through, "% off" and "Offer till …"; it ends by itself, or with **End offer**. **Change prices** for a whole category (raise or lower by % or ₹, rounded to the rupee, previewed before applying; offers that are no longer cheaper end). Staff can **agree a lower price** on a line of a phone, WhatsApp or walk-in order, or when editing one (never above the usual price; GST stays per line). Categories can be renamed, reordered and deleted when empty; products reordered within a category. Plans and the WhatsApp price list use today's prices. |
| Farm-side orders | **New order** for phone, WhatsApp (typed in by staff — Lite mode) and walk-in sales; customer search or new customer, saved addresses; staff may book after the online cut-off or into a full slot, with a warning; walk-ins are handed over, paid and invoiced in one step with no delivery fee. **Edit** items, slot, address, payment or note until the order is packed: agreed prices are kept, stock moves by the difference, every edit is logged. **Changed** on a call opens the edit form and saving confirms the order. |
| Delivery area | Own feature switch. Owner sets the farm location ("I'm at the farm now" or paste a Google Maps link), a delivery radius in km and extra PIN codes served. Checkout asks for the PIN code and offers "Share my location"; the phone asks the server "do you deliver to me?" (the farm's exact location never leaves the server). Web orders from outside are refused with a call-the-farm message; when it can't be decided the order goes through flagged for the confirmation call; staff orders are only flagged. Order cards show the PIN, distance and a 📍 directions link for the delivery person. |
| Reports | Owner only, own feature switch. Today / this week / this month / custom dates: net sales after returns, orders and average, cash and UPI collected, on account, returns; daily sales chart with table view; totals by product and by how orders came in; confirmation calls with the accidental-order rate against the 2% target; dues list. **Excel downloads** (CSV, UTF-8 with BOM so Tamil opens correctly, formula-safe): sales register with taxable value, CGST, SGST and credit notes as negatives; payments and refunds; product totals; dues. |
| Weekly / daily plans | Off by default (feature switch, Growth plan and above). Repeat orders per customer: items, days of the week, slot, plan discount, payment, start date. Pause until a date or until resumed, skip a single day (that day's order is cancelled and stock returned), resume, cancel. Plan orders for today and tomorrow are created when staff open **Today** and by `POST /api/cron/plans` (set `CRON_SECRET`); never twice for the same day; no confirmation call; booked even into a full slot; held back with the reason when stock runs out. |
| WhatsApp (Lite) | **WhatsApp page**: share the shop link or today's price list (built from the catalogue, sold-out items marked) to customers, groups or Status in one tap, or copy it; printable **shop QR code** for trays, bags and bills. **Message wording**: every message the farm sends (order updates, missed call, dues, invoice, shop link, price list) is a template the owner edits in Tamil and English, with placeholder buttons, a live preview and reset to default; misspelt placeholders are caught on save. |
| Returns & credit notes | **Return / refund** on delivered orders: items and quantities (never more than delivered), reason, settle by crediting the account or refunding cash/UPI, optional restock, delivery charge refunded only when the whole order comes back; credit note in its own series (MF-CN/2026-27/0001) against the original invoice; statement shows returns and refunds. Switchable like every feature. |
| Customers & billing | Customer list with search and dues filter; customer page with statement (running balance), payments, dues reminder on WhatsApp, trusted flag, credit limit, offers opt-in with consent date; **Mark delivered** asks cash / UPI / on account and issues the invoice in the same step; bilingual invoice (bill of supply or tax invoice with CGST/SGST) numbered per financial year, frozen at issue; customer invoice link `/i/<token>` with a UPI pay button; farm settings (UPI ID, GSTIN, FSSAI, delivery charges) |
| Customer connect (no logins) | A customer is remembered on their phone by a private key in a cookie, so name, phone and address are pre-filled next time; **My orders** (`/my`) shows open and past orders with progress, bills and dues, and a reorder button. Brand-new numbers connect when they order or scan the shop QR code; a number the farm already knows is never connected by typing it in: the farm sends that customer their **personal link** (`/my/<key>`) on WhatsApp, and can reset it. "Not you?" forgets the phone. |
| Sign in with a code | Own feature switch. A phone the app doesn't know asks for the mobile number first (from WhatsApp, the QR code or the link); a 6-digit code is sent to any valid number, so nothing reveals who is a customer. Known numbers are signed in; new numbers then register (name, optional address). Asked once per phone, after that the phone remembers them. Codes last 5 minutes, 5 tries, at most 4 an hour and 8 a day per number, stored only as a keyed hash. "Just see products and prices" stays one tap away; checkout needs a verified number and orders always go in under it. Codes go out by WhatsApp (Cloud API authentication template, ~₹0.12) or SMS via MSG91 (DLT needed, ~₹0.15–0.25), set by `OTP_PROVIDER`; the demo shows the code on screen; a live site without a provider keeps personal-link sign-in. |
| Messages in the app | Customers write to the farm from My orders; staff reply from **Messages** in the farm app. Stored in our database, not WhatsApp. Unread badges, "Seen" ticks, customers waiting 2+ hours marked; if a reply goes unseen, a one-tap WhatsApp nudge with the customer's link, or a call. |
| WhatsApp alert to the farm | Own feature switch. Each new web order is sent automatically to the farm's WhatsApp number (order code, customer, total and whether a call is needed, items), from FarmForYou's WhatsApp Business number via Meta's Cloud API (`WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, approved utility template `new_order_alert`). About ₹0.12 per alert. Does nothing until that account is set up; staff are still alerted free by phone notifications and badges. The same account sends sign-in codes. Customers no longer forward their order on WhatsApp: it is saved and on the farm's screens the moment it is placed. |
| Phone notifications | Standard web push (free, no WhatsApp): staff get new web orders and customer messages; customers get farm replies and order confirmed / on the way / delivered / cancelled, in their language. "Get updates on this phone" button on Today, My orders and after ordering, with Home Screen steps for iPhone. Phones that stop accepting notifications are forgotten automatically. Needs the hosted HTTPS app and VAPID keys (`node scripts/vapid-keys.mjs`); without keys the app works as before. |
| Customers change or cancel | From My orders, until the slot's cut-off: **Cancel** (with a reason; stock returns; staff notified) or **Change** (the shop opens with the order's items; placing replaces the old order in one transaction, reusing its stock and slot place). After the cut-off: "Call the farm to change". |
| Closed days | On the Slots page: close a whole day or one delivery time with a reason (e.g. Pongal). Those slots disappear for customers and staff, the shop says "No deliveries on …", plan orders skip the day, and orders already booked that day are counted for the farm to move. |
| Staff and logins | Owner only (Settings → Staff and logins): add staff with email, mobile and roles (owner, order desk, packing, delivery); the app creates the login and shows a temporary password once (e.g. Farm-4827-kmtq). Edit roles, make a new password, remove or restore access (history kept). A farm always keeps an owner, and owners can't remove their own access. In the demo, new staff appear as demo sign-in buttons. |
| Feature switches | Each farm switches features on or off in Settings (web shop ordering, confirmation calls, stock tracking, credit accounts, invoices, WhatsApp buttons, UPI links; subscriptions, broadcasts, automated WhatsApp and reports shown as coming soon). A feature works only if the plan allows it and the farm turned it on; the server enforces it, not just the screens. See `src/domain/features.ts`. |
| Rules | Confirmation-call rules per farm, order lifecycle, IST dates and cut-offs, delivery charges, GST inside prices, invoice numbering per financial year, Indian mobile numbers |
| Multi-tenancy | `tenantId` on every farm table, enforced by `src/lib/tenant-db.ts`; Supabase API roles locked out by `prisma/sql/rls.sql`; farm resolved from the subdomain or `DEFAULT_TENANT_SLUG` |
| Installable app | Web app manifest, icons and offline page; service worker built with `npm run build`, including the notification handlers in `src/worker/` |

Not yet: PDF files, automated WhatsApp (Cloud API), platform admin.

## Stack

Next.js 16, React 19, TypeScript, Tailwind 4 + shadcn/ui, next-intl (`ta`, `en`), Prisma 7 on Supabase Postgres (free tier at launch), Supabase Auth for staff, Vitest + PGlite for tests.

## Try it in one command

```bash
npm install
npm run demo
```

This starts a fresh local database, adds Merry Farms with demo staff, customers and orders, and starts the app.

- Customer shop: http://localhost:3000
- Farm app: http://localhost:3000/login → pick a **demo sign-in** (Owner, Order desk or Delivery)

Demo sign-in works only in development with `DEMO_LOGIN=1` (set by `npm run demo`); a production build ignores it. The demo data is wiped each time you run it.

## Run it locally (no Supabase needed)

```bash
npm install
npm run dev:db                        # local Postgres in .pglite/, schema applied on first run
# in a second terminal:
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable"
npm run db:seed -- --demo             # Merry Farms + 3 sample orders
DEFAULT_TENANT_SLUG=merryfarms NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x npm run dev
```

Open http://localhost:3000 for the shop. The farm app needs a real Supabase project for sign-in (below).

## Set up on Supabase (free tier)

1. Create a Supabase project (region: Mumbai). Copy `.env.local.template` to `.env.local` and fill it in.
2. In Supabase → Authentication → Providers, keep Email on and turn off "Confirm email" (staff are created by the owner).
3. Create the tables and lock the public API:
   ```bash
   npm run db:push
   npm run db:rls
   npm run db:seed            # add -- --demo for sample orders
   ```
4. Create the owner's login:
   ```bash
   npm run staff:add -- --email you@example.com --password 'a-long-password' --name "Your name" --roles owner
   ```
5. For phone notifications, run `node scripts/vapid-keys.mjs` once and add the three lines to `.env.local` (and to the host's environment settings). Keep `VAPID_PRIVATE_KEY` secret; changing the keys means everyone has to turn notifications on again.
6. `npm run dev`, then sign in at http://localhost:3000/login.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (webpack, so the offline service worker is generated) |
| `npm test` | Unit, translation, database and order-flow tests |
| `npm run typecheck`, `npm run lint` | Checks |
| `npm run db:sql > prisma/sql/schema.generated.sql` | Regenerate the SQL the tests use, after any schema change |

## Notes

- **Folder name:** `npm run build` fails in a folder whose path contains an apostrophe (`Amal's Space`), because of a webpack/Workbox bug. Hosting and CI are unaffected. To build locally, move or copy the project to a path without `'`.
- **Prices in the seed are placeholders.** Set real prices in the farm app under Products.
- Every new screen needs its text in both `messages/ta.json` and `messages/en.json`; a test fails if a key is missing.
