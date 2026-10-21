# Merry Farms (on the Farm4U platform)

A Tamil-first, multi-tenant platform for small farms that sell direct to customers over WhatsApp and a web shop. Merry Farms (country eggs and naatu kozhi) is the first farm. "Farm4U" is a placeholder platform name.

- Product & tech plan: https://claude.ai/code/artifact/f8a2eb07-5b60-4226-bfb6-7fc7bef59c26
- Clickable prototype: `prototype/index.html`

## What's built (phase 1, first slice)

| Area | What works |
| --- | --- |
| Customer shop (`/`) | Tamil by default with an English switch; products by category; live stock; delivery slots with cut-off and limits; checkout without login; "send to the farm on WhatsApp" after ordering |
| Farm app (`/farm`) | Staff sign-in; **Today** (to-confirm count, open orders, sales, packing list, delivery runs, low stock); **Orders** (call button, read-out script, call outcomes, next step, cancel, one-tap WhatsApp Lite message in the customer's language); **Products** (add/edit/delete, categories, price, stock, GST, show/hide); **Slots** (add/edit/delete, days, cut-off, max orders) |
| Customers & billing | Customer list with search and dues filter; customer page with statement (running balance), payments, dues reminder on WhatsApp, trusted flag, credit limit, offers opt-in with consent date; **Mark delivered** asks cash / UPI / on account and issues the invoice in the same step; bilingual invoice (bill of supply or tax invoice with CGST/SGST) numbered per financial year, frozen at issue; customer invoice link `/i/<token>` with a UPI pay button; farm settings (UPI ID, GSTIN, FSSAI, delivery charges) |
| Rules | Confirmation-call rules per farm, order lifecycle, IST dates and cut-offs, delivery charges, GST inside prices, invoice numbering per financial year, Indian mobile numbers |
| Multi-tenancy | `tenantId` on every farm table, enforced by `src/lib/tenant-db.ts`; Supabase API roles locked out by `prisma/sql/rls.sql`; farm resolved from the subdomain or `DEFAULT_TENANT_SLUG` |
| Installable app | Web app manifest, icons and offline page; service worker built with `npm run build` |

Not yet: credit notes for returns, PDF files, automated WhatsApp (Cloud API), platform admin, editing items on an existing order, walk-in/phone orders from the farm app.

## Stack

Next.js 16, React 19, TypeScript, Tailwind 4 + shadcn/ui, next-intl (`ta`, `en`), Prisma 7 on Supabase Postgres (free tier at launch), Supabase Auth for staff, Vitest + PGlite for tests.

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
