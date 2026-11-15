# Status (update at the end of every piece of work)

**Last updated:** 2026-11-15

## Branches

| Branch | State |
|---|---|
| `main` | **Live**: everything through Phase 3 part 3 (free WhatsApp sign-in, off until the Meta setup; email codes, off until Brevo is set up), Fishery, developer docs. |
| `develop` | Same as main. |
| `feature/*` | All merged; kept locally as history. |

**Live database:** every table matches the schema except `whatsapp_sign_ins`, which isn't created yet (checked
2026-11-15). That's safe: nothing touches it until `WHATSAPP_NUMBER` and `WHATSAPP_APP_SECRET` are set, and its SQL
is the first step of the Meta setup in `docs/todo.md`. RLS is on for every table.

## Done (plan phases, see `docs/platform-plan.md` §6)

| Phase | Done |
|---|---|
| Before the plan | Shop, orders (web, WhatsApp, phone, walk-in), call confirmation, credit (khata), invoices, returns, recurring plans, messages, push, delivery area and slots, closed days, product photos, farm records and profit, reports, staff and roles, username login, PWA installs, openings, farm scenes, videos, support mode, backups |
| Poultry care | Batches, daily entry, losses, feed, vaccines, weights and growth, costs, egg store, reminders |
| 0. Foundations | Brand colours and naming, photos in Storage, `/f/<farm>` addresses |
| 1. Platform engine | Modules and admin-made plans; automation engine and tick; settings registry and audit log; admin v2 (dashboard, audit, tech monitor, billing, GST switch, announcements, requests) |
| 1b. Home page and compliance | Home page, Register your farm, application review; restricted items, screening, Compliance inbox; legal pages |
| 2. Farm Core | Places and machines, workers and wages, farm store, jobs and reminders |
| 3. Customers (part) | Part 1: PlatformPerson, customer source and kind, staff-added customers, consent log. Part 2: free WhatsApp sign-in (off until the Meta setup), 90-day sign-in. Part 3: email codes through Brevo (off until set up) |
| 7. Fishery | Ponds, cycles, stocking, day entry, water checks, samples, harvests, cycle money, reminders |

## Next

1. **Finish Phase 3:**
   - Firebase SMS (10 a day)
   - counter sale
   - the farm directory on the home page, with farm profile pages
2. **Phase 4, Selling v2 + Buying:**
   - category catalogue per module, set in admin; farms add their own
   - price per quantity, price lists
   - market and wholesale channels, support tickets, farm GST option
   - suppliers, purchases, money owed
3. **Phase 5:** poultry on the core (birds sold through orders come off the batch).
4. **Phase 6:** Livestock.
5. **Phase 8:** Crops.
6. **Phase 9:** bots and growth (Telugu, Kannada and Malayalam).

## Waiting on a person

See `docs/todo.md`: the Meta WhatsApp setup (postponed), empty Vercel settings, the legal check of the restricted
items, and hosting once there are 4 farms.
