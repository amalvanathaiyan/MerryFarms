# Backups

The Supabase free plan keeps **no backups**, so FarmForYou makes its own.

## 1. Nightly backup (whole platform)

`.github/workflows/backup.yml` runs every night at 03:00 IST on GitHub (free). It copies the whole database with `pg_dump`, **encrypts** it with your passphrase, and keeps it for **30 days** under the repository's **Actions → Nightly backup → (a run) → Artifacts**.

**Turn it on (once):** GitHub → your repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `BACKUP_DATABASE_URL` | Supabase → Project Settings → Database → **Session pooler** connection string (with your DB password) |
| `BACKUP_PASSPHRASE` | A long passphrase. **Write it down somewhere safe**: without it a backup can't be opened. |

Then **Actions → Nightly backup → Run workflow** once to check it works.

### Restore

1. Download the artifact (a `.zip` with `farmforyou-YYYY-MM-DD.dump.gpg` inside) and unzip it.
2. Decrypt:
   ```bash
   gpg --decrypt farmforyou-2026-11-01.dump.gpg > farmforyou.dump
   ```
3. Restore into a database (a fresh Supabase project, or the same one after a mistake):
   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists --dbname "<connection string>" farmforyou.dump
   npm run db:rls   # re-apply the API lock-down
   ```
   Restoring with `--clean` **replaces** what is there. To look at an old copy without touching the live data, restore into a new, empty project first.

Staff logins live in Supabase Auth (not in this dump); they stay as they are. On a brand-new project, re-create the owner with `npm run staff:add` and add staff again from the app.

## 2. "Download all my data" (one farm)

In the farm app, the owner opens **Reports → Download all my data**. It saves one JSON file with the farm's products, customers and addresses, orders, invoices and credit notes, payments, dues ledger, returns, plans and messages. Keys, passwords and personal links are left out.

It is a record you keep (and proof of what you sold and were paid), not something the app reads back.
