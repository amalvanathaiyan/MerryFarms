# Farm For You: notes for Claude (the sole developer)

Claude Code reads this file at the start of every session. Together with `docs/dev/` it holds everything needed to
resume work without the chat history. **Keep these docs current:** when the user decides something, or a phase,
branch or live step changes, update `docs/dev/decisions.md`, `status.md`, `database.md` (new tables or migrations) or `architecture.md`
(new layers, services, settings) in the same commit.

## Start of a session

1. Read `docs/dev/status.md` (where things stand, what's next) and `docs/todo.md` (steps waiting on a person).
2. Run `git status` and `git log --oneline -5` on the current branch, and check them against status.md.
3. Look things up in `docs/dev/`: `architecture.md` (how it's built, every layer), `database.md` (every table, every
   migration, what's live), `decisions.md` (everything the user decided, design rules, lessons). The product plan and
   phases are in `docs/platform-plan.md`.

## What this is

**Farm For You (FFY)** is a Tamil-first, multi-tenant platform for South Indian farms: a shop for customers, a farm
app for the owner and staff, and a portal with the super admin. **Merry Farms** (country eggs, naatu kozhi; the
user's own farm) is tenant #1. It's modelled on the user's earlier app Hotelier-4U (`../repo-hotelier4u`).
Stack: Next.js 16, Prisma 7, Supabase Postgres (free plan), PWA, Vercel (Hobby), next-intl (`messages/ta.json` and
`en.json`), Vitest with PGlite for integration tests.

Words the user uses: **super admin** = the FFY platform admin (`/admin`); **farm admin** = the farm owner (`/farm`).

## Rules that always apply

- **Git:** `main` (live) ← `develop` ← `feature/*`. Commit on a feature branch, then merge `--no-ff` into `develop`.
  Merging into `main` and pushing happen **only when the user says so, each time**. Pushing `main` redeploys the
  live site.
- **Live database:** `.env.local` points at the LIVE Supabase. Never write to it from tests or experiments; use
  `npm run demo` (throwaway PGlite). Read-only checks are fine. Schema changes go in an additive
  `prisma/sql/<date>-<name>.sql` (safe to run twice); **the user runs it** in the Supabase SQL editor, then
  `npm run db:rls`. Run the SQL before deploying code that reads new tables. After a schema edit, regenerate
  `prisma/sql/schema.generated.sql` with `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`.
- **Every farm, never just Merry Farms:** nothing farm-specific is hard-coded; data is scoped with `tenantDb`; new
  tables carry `tenantId` and are added to `TENANT_MODELS` in `src/lib/tenant-db.ts`; farm-type features are per-farm
  switches or plan modules.
- **Timestamps on every table:** `createdAt @default(now())` and `updatedAt @default(now()) @updatedAt`; rewrites
  keep the original `createdAt`.
- **Design for first-time phone users:** a word beside every icon, full words ("English", not "EN"), plain Tamil,
  one clear next step per screen, big targets, visible feedback, and a way to call the farm from anywhere.
  **No clutter:** nothing offered twice, lead with what the page is for (admin pages too). Instructions are plain text,
  never boxes that look tappable. Check at 320 px and in Tamil (long words overflow; wrap, never truncate).
- **Text:** every string goes in both `messages/ta.json` and `messages/en.json` (a test fails otherwise).
- **Logins:** the super admin and farm logins are never the same login. Farm logins are created by the platform and
  handed over. Customers sign in with their phone number and a one-time code (free channels first).
- **Brand:** FFY mark and Merry Egg are LOCKED (see decisions.md). Never use Tamil Nadu election symbols (two leaves,
  rising sun, hand, lotus) or a lone spoked wheel. Hens are never white.
- **Checks before a commit:** `npm run typecheck`, `npx eslint src`, `npx vitest run`. If typecheck shows garbage in
  `.next/types`, delete `.next/types` (stale cache). `npm run build` fails locally because of the apostrophe in
  the folder path "Amal's Space"; Vercel builds fine.
- **Tailwind:** `cn()` drops unregistered custom `text-*` sizes (register them in `src/lib/utils.ts`); some arbitrary
  classes never generate. Measure on screen; don't trust the class list.
- **Commits** end with the `Co-Authored-By` line the session gives. Commit messages describe the change in plain
  words for the user.

## Where things are

| Area | Code |
|---|---|
| Tenancy, scoping | `src/lib/tenant.ts`, `src/lib/tenant-db.ts`, `src/proxy.ts`, `src/domain/app-hosts.ts` |
| Features, modules, plans | `src/domain/features.ts`, `modules.ts`, `entitlements.ts`, `src/server/subscriptions.ts` |
| Settings registry, audit | `src/domain/settings.ts`, `src/server/settings.ts`, `src/server/audit.ts` |
| Automation engine | `src/domain/automations.ts`, `src/server/automation.ts`, `/api/cron/tick`, `.github/workflows/tick.yml` |
| Orders, shop | `src/server/orders.ts`, `src/app/actions/shop.ts`, `src/components/shop/` |
| Customers, sign-in | `src/server/customers.ts`, `people.ts`, `otp.ts`, `whatsapp-sign-in.ts`, `src/app/actions/sign-in.ts` |
| Farm Core | `src/server/farm-core.ts` (places, machines), `workers.ts`, `inputs.ts` (store), `tasks.ts`; pages in `src/app/farm/` |
| Poultry, fishery | `src/domain/batches.ts`, `src/server/batches.ts`, `poultry-entry.ts`, `vaccinations.ts`, `weights.ts`; `src/domain/fish.ts`, `src/server/fish.ts` |
| Admin | `src/app/admin/`, `src/server/admin-overview.ts`, `platform-billing.ts`, `compliance.ts` |
| Brand art | `scripts/art/brand/`, `src/components/art/`, `src/components/openings.tsx`, `src/lib/opening.ts` |
| Pure rules (tested) | `src/domain/*.ts` with `*.test.ts`; server flows with `src/server/*.integration.test.ts` |
