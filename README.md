# Merry Farms (on the Farm4U platform)

A Tamil-first, multi-tenant platform for small farms that sell direct to customers over WhatsApp and a web shop. Merry Farms (country eggs and naatu kozhi) is the first farm. "Farm4U" is a placeholder platform name.

- Product & tech plan: https://claude.ai/code/artifact/f8a2eb07-5b60-4226-bfb6-7fc7bef59c26
- Clickable prototype: `prototype/index.html`

## What's built (phase 1, first slice)

| Area | What works |
| --- | --- |
| Customer shop (`/`) | Tamil by default with an English switch; products by category; live stock; delivery slots with cut-off and limits; checkout without login; "send to the farm on WhatsApp" after ordering |
| Farm app (`/farm`) | Staff sign-in; **Today** (to-confirm count, open orders, sales, packing list, delivery runs, low stock); **Orders** (call button, read-out script, call outcomes, next step, cancel, one-tap WhatsApp Lite message in the customer's language); **Products** (add/edit/delete, categories, price, stock, GST, show/hide); **Slots** (add/edit/delete, days, cut-off, max orders) |
| Farm-side orders | **New order** for phone, WhatsApp (typed in by staff — Lite mode) and walk-in sales; customer search or new customer, saved addresses; staff may book after the online cut-off or into a full slot, with a warning; walk-ins are handed over, paid and invoiced in one step with no delivery fee. **Edit** items, slot, address, payment or note until the order is packed: agreed prices are kept, stock moves by the difference, every edit is logged. **Changed** on a call opens the edit form and saving confirms the order. |
| Returns & credit notes | **Return / refund** on delivered orders: items and quantities (never more than delivered), reason, settle by crediting the account or refunding cash/UPI, optional restock, delivery charge refunded only when the whole order comes back; credit note in its own series (MF-CN/2026-27/0001) against the original invoice; statement shows returns and refunds. Switchable like every feature. |
| Customers & billing | Customer list with search and dues filter; customer page with statement (running balance), payments, dues reminder on WhatsApp, trusted flag, credit limit, offers opt-in with consent date; **Mark delivered** asks cash / UPI / on account and issues the invoice in the same step; bilingual invoice (bill of supply or tax invoice with CGST/SGST) numbered per financial year, frozen at issue; customer invoice link `/i/<token>` with a UPI pay button; farm settings (UPI ID, GSTIN, FSSAI, delivery charges) |
| Feature switches | Each farm switches features on or off in Settings (web shop ordering, confirmation calls, stock tracking, credit accounts, invoices, WhatsApp buttons, UPI links; subscriptions, broadcasts, automated WhatsApp and reports shown as coming soon). A feature works only if the plan allows it and the farm turned it on; the server enforces it, not just the screens. See `src/domain/features.ts`. |
| Rules | Confirmation-call rules per farm, order lifecycle, IST dates and cut-offs, delivery charges, GST inside prices, invoice numbering per financial year, Indian mobile numbers |
| Multi-tenancy | `tenantId` on every farm table, enforced by `src/lib/tenant-db.ts`; Supabase API roles locked out by `prisma/sql/rls.sql`; farm resolved from the subdomain or `DEFAULT_TENANT_SLUG` |
| Installable app | Web app manifest, icons and offline page; service worker built with `npm run build` |

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
5. `npm run dev`, then sign in at http://localhost:3000/login.

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
