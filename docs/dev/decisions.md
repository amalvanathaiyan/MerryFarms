# Decisions and lessons

Everything the user has decided, and what was learned along the way, so work can resume without the chat history.
Dates are when it was decided. Newest decisions win. **Update this file whenever the user decides something.**

## Product and platform

- **Name:** the platform is **Farm For You** (written "Farm For You" in text, "FarmForYou" in code; decided
  2026-10-22, replacing "Farm4U"). Short form FFY.
- **What it is** (2026-11-12): a one-stop app for all farming in South India, Tamil Nadu first. Every kind of farm
  is a tenant. It's modelled on the user's Hotelier-4U (`../repo-hotelier4u`): Next.js + Supabase + Prisma,
  tenantId + RLS, a subdomain per tenant, a super admin panel. Plan: `docs/platform-plan.md`.
- **Merry Farms** (country eggs, naatu kozhi) is the user's own farm and **tenant #1**. Its tagline is "Farm For
  You", because the owner runs the platform.
- **Build for every farm** (2026-11-10): "Any task we do, keep the tenant model in mind." Nothing is hard-coded for
  Merry Farms. Read "Merry Farms" in a request as "a farm such as Merry Farms". Design each feature for three
  viewers: customer, farm admin, super admin.
- **Modules, not overlaps** (2026-11-12): Farm Core is always on; Selling, Buying, Poultry, Livestock, Fishery and
  Crops are separate modules. Common costs (a well motor repair, electricity) belong to Farm Core, never to a module
  and never split.
- **One Livestock module** covers cows, buffalo, goats, sheep and all cattle, with the same activities.
- **Plans are made by the platform admin** from modules: limits, prices, trial, versions, add-ons. How FFY prices
  modules is still open (it can start at ₹0).
- **Everything configurable** (opt in or out), through the settings registry (platform → farm → user).
  **Automation end to end:** an events, rules, jobs and tick engine. Bots (a customer WhatsApp bot, a farm
  assistant, an admin ops bot) come later as opt-in add-ons.
- **FFY is the face of all farms:** a directory by area and product, with farm profile pages. Each farm owns its
  customers; there's no shared cart.
- **Farm directory** (Phase 3, built 2026-11-15): farmforyou.in/farms finds farms by PIN code or the phone's spot,
  and by product. Every farm is listed unless it turns off "Show my farm on Farm For You" (Settings → Choices); its
  page shows its story (Settings → Look), products, delivery area, videos, and shop / call / WhatsApp. It shows only
  what the farm's shop already shows publicly; the farm's exact location is never shown.
- **Catalogue** (2026-11-15): the platform admin defines product kinds (how measured, pack sizes, details). Farm
  owners can add their own categories, details and pack sizes. A full category catalogue per module; products
  priced per quantity.
- **Home page and farm sign-up** like Hotelier's. Self-registered farms are reviewed by the FFY team (applied →
  review → more details → approved / rejected) before their shop goes public. Admin can also add farms directly.
- **Anything illegal listed by a farm alerts the platform admin:** a restricted items list (block, hold, needs a
  licence), automatic screening, and a Compliance inbox. **The list must be checked by someone who knows the law
  before it's switched on.**
- **GST** is built in but off: FFY isn't registered.
- **Order age colours** (2026-11-12): a new order is green; yellow after 2 hours without action; red after 4. Both
  hour marks are farm settings, and staff are alerted when an order turns red. Built.
- **Supreme admin:** the admin tracks everything, including the tech stack (tech monitor), audit log, billing and
  announcements.
- **Paid add-ons** (WhatsApp Cloud sending, an AI assistant): when to use them is still open.

## Cost, hosting, domain

- **₹0 launch** (2026-10-20): Supabase free plan, a PWA, free hosting. A Play Store wrapper (TWA or Capacitor) only
  when farms ask. Prefer open source and near-zero running cost; the target farms are very small.
- **Vercel Hobby** (2026-11-08): the live site is at merry-farms.vercel.app, built from `main`. Hobby doesn't allow
  commercial use, so move to Pro or another host before real paid orders.
- **The domain** (farmforyou.in) and commercial hosting wait until there are **4 farms**. Until then, extra farms
  use `/f/<farm>` addresses, with the default farm at `/`.
- **One address per app** (2026-11-13): shop, farm app and portal+admin each have their own address, so a phone
  can install them side by side. Now: `merry-farms.vercel.app`, `farmforyou-farm.vercel.app`,
  `farmforyou.vercel.app`. With the domain: `<farm>.farmforyou.in`, `<farm>-farm.farmforyou.in`, `farmforyou.in`
  (admin stays on the portal, as the user chose). Farm slugs can't end in `-farm`. Before the domain, support visits
  stay on the portal address (vercel.app addresses can't share a sign-in).
- **Backups:** the free plan keeps none. A nightly encrypted `pg_dump` runs on GitHub Actions (`docs/backups.md`).

## Logins and customers

- **Super admin ≠ farm admin** (2026-11-01): never the same login or email. A shared login once let a farm-level
  "New password" lock the user out of `/admin`. The app refuses to link the two. Use the user's words:
  **super admin** (`/admin`) and **farm admin** (the owner, `/farm`).
- **Farm logins are handed over** (2026-11-01): the platform admin creates the login and gives it to the owner. The
  owner changes the password, and admin resets it if forgotten. No OTP for staff.
- **Manager** has the owner's rights except the Staff list (2026-11-09).
- **Support mode** (2026-11-10/11): the super admin can enter any farm's app and **fix anything** (full edit, not
  view-only). It needs a typed reason, a dark support bar, an expiry, and every visit and change logged and visible
  to the farm. Writes are recorded as "FarmForYou support". Farm logins and passwords are never changed inside
  support mode.
- **Customer sign-in** (2026-11-15): the phone number is the identity. A one-time code at sign-in (or an email code),
  then signed in on that phone until sign-out or 90 days. No passwords. **Free channels first:**
  1. WhatsApp, the customer sends the code to FFY's number (inbound messages are free). **Built.**
  2. An email code, sent through **Brevo** (user, 2026-11-15; free 300 a day; Supabase's own email allows only a
     few an hour). **Built.** The user chose the safe way: an email code signs in a customer whose email was linked
     after proving the phone, or registers a number new to the farm with the phone "not checked" (web orders always
     need a call; a confirming call checks it). A number the farm already knows can't be opened by email alone.
  3. SMS through Firebase, its 10 free a day. To build.
  4. Paid: we send the code on WhatsApp (~₹0.115 + GST) or MSG91 SMS. Off.

  The farm's confirmation call still marks a phone as checked for offline customers.
- **Customers** (Phase 3): one PlatformPerson per proven phone. Each farm keeps its own Customer record, and farms
  never see each other's. Staff-added (offline) customers join up when the person later signs in. Record how each
  customer came and their kind. A consent log for offers (DPDP).
- **Counter sale** (Phase 3, 2026-11-15): a quick sale at the farm gate or a market stall with no name. It's an
  order delivered and paid at once (cash or UPI; with the farm's UPI ID a QR with the amount is shown), on one
  stand-in customer per farm (phone value `counter`, never a real number). Credit or known buyers use New order
  (walk-in). Chosen over making an order's customer optional, which would have touched invoices, payments and the
  credit book.
- **Orders** come mainly through WhatsApp and the web shop. Every order can be confirmed by a phone call (the farm
  decides who must be called). The farm controls its WhatsApp wording.

## Poultry (feature `poultryCare`, paid)

Agreed 2026-11-08:
- **Batches:** where the birds came from (bought, with cost, or hatched here), arrival age → hatch date, start count.
  Birds alive is always computed, never typed.
- **Daily entry:** deaths by cause, culled, sold, feed kg, eggs collected/broken. Any past day can be viewed.
- **Feed as stock:** now part of the Farm Core store (`batchFeed` item).
- **Vaccines:** the farm's own plan by age (no built-in medical schedule; the vet decides), copied onto each new
  batch. Due and late doses show on Today.
- **Per-batch profit was dropped** as impractical (eggs share one store, and birds sell through orders), so Poultry
  shows **Costs** (cost per bird and egg, losses in ₹). Real profit is under Money → Profit.
- **Eggs:** one shared egg store per farm (`tenants.eggStore`, `products.eggsPerUnit`). Every stock change goes
  through `src/server/stock.ts`.
- **Entry** (2026-11-12): one Entry tab (first for staff; Batches first for the owner) with Daily, Weighing and
  Vaccines sections and one Save. Growth is its own tab.
- **Still open from the user's list:** birds sold through orders reducing the batch (Phase 5).

## Fishery (feature `fishCare`)

Built 2026-11-15:
- **Cycles:** a pond (a FarmPlace of kind pond) has cycles from first stocking to closing.
- **Stocking:** fingerlings bought become "seeds" spending on the pond.
- **Day entry:** feed taken from the store as a use on the pond, fish found dead, and water checks (pH, oxygen,
  temperature, ammonia), with safe ranges for warm-water fish and what to do.
- **Size and harvest:** net samples give the average size. Harvests are sold or kept (kept = 0 rupees, for the
  shop or home), and "that was all" closes the cycle.
- **Money:** each cycle's money = fish sold − (spending on the pond + store items used there at average price +
  workers' days there).
- **Reminders:** water out of range in the last 2 days, and a size check every 30 days.
- **Banned species** (African catfish, Thai magur) are never offered.

## Design rules (from the user)

- **Easy for first-time phone users** (2026-10-27): a word beside every icon, full words ("English", not "EN"),
  plain Tamil without jargon (explain PIN, UPI), one clear next step per screen, big targets, visible feedback on
  every tap, and a way to call the farm from anywhere. Check at 320 px.
- **No clutter** (2026-11-14): no page or form offers the same action or fact twice, lead with what the page is for,
  and avoid two taps where one would do. This applies to admin too.
- **Instructions are plain numbered text, never boxes that look like buttons.** On iPhone people tapped the drawn
  steps (2026-11-09).
- **Tamil text** must stay inside its boxes: buttons wrap (`whitespace-normal`, `min-h-*`); never truncate names
  or labels Tamil fills; use a shorter word when one long Tamil word can't fit (வாங்குவோர் instead of
  வாடிக்கையாளர்கள் on a small tile). Check every farm page in Tamil at 390, 360 and 320 px, and with larger text.
- **Every DB row has `createdAt` and `updatedAt`** (2026-11-08): "any entry to db needs timestamp to track exactly
  when something happened". Rewrites keep the original `createdAt`. A full change history exists for orders
  (`order_events`), settings (`audit_log`) and support (`support_changes`).
- **Saving gives feedback:** every entry in the farm app is confirmed with a cheer line.

## Brand and art

- **LOCKED 2026-11-12, the Farm For You mark:** five long turmeric leaves (two-tone, curved midribs, fanned ±50°/±23°)
  growing from a **smiling turmeric-yellow heart** (dot eyes, smile, orange cheeks).
  - Colours: leaf green #1E8A4C, turmeric yellow #F5B301 (fill only, never small text), cream #FFF6D6.
  - Under ~16 px: three solid leaves + the heart.
  - Opening: soil line, heart pops, leaves unfurl, face fades in, one heartbeat, sway.
- **LOCKED 2026-11-12, Merry Farms:**
  - The symbol is the **Merry Egg**: a happy country-tan egg, eyes closed in a smile, rosy cheeks, a jaunty
    four-point red comb, cradled by **three** two-tone leaves.
  - The name: "**Merry**" is always red #A8262B and "**Farms**" always green #1F6B3A. The monogram is MF.
  - The opening: drop and bounce, leaves unfurl, comb pops, blink, wiggle, then the wordmark.
- **Openings:**
  - **Timing:** each app plays its opening when launched and holds about 1.5 s, so the brand registers each time.
    A tap skips only the hold.
  - **Other farms:** their own logo, name and tagline, then a tiny FFY mark + "on Farm For You" in small grey,
    never louder than the farm.
  - **Sounds:** optional, on unless turned off.
- **Icons must be big and clear:** fit a mark to 84% of a square; for maskable icons the farthest pixel sits at 40%
  of the size from the centre; 48 px and below use a bold version. Preview the way phones crop it. Masters and fit
  scripts are in `MerryFarm_Cache/media/Logo/` (outside the repo).
- **Never use** Tamil Nadu election symbols (two leaves = AIADMK, rising sun = DMK, hand = Congress, lotus = BJP),
  or a lone spoked wheel (reads as the chakra).
- **Hens are never white:** in Tamil Nadu a white bird reads as a broiler. Country hens are red-gold, black with a
  golden neck, or speckled.
- **Art:** original only (never stock or traced). Render every variant and look at it before showing the user. Don't
  hand-code SVG copies of the user's rendered artwork; work with their images. Don't propose new logo ideas unasked.
- **History (rejected, don't reuse):**
  - the bullock-cart wheel mark (people didn't read it as a wheel)
  - the kolam brand
  - mascots (farmer, amma, hen, bull)
  - a curry-leaf heart (looked like a beetroot)
  - MF with a comb on the M
  - many symbol rounds (koodu vandi, Pongal pot, farm loop…)
- **Live farm scenes:** gate, stall, hen and bullock cart, drawn in the user's style and rotating daily, with the
  sky following IST time of day. The farm app's Today opens with the live picture.
- **Reserved for later** (when asked): festival scenes (Pongal, rain), and a "Watch our farm" promo video (compress
  the 3.4 MB clip to about 1 MB first).

## Working with the user

- **Git** (2026-10-22): feature branches merge `--no-ff` into `develop` only. Merging into `main` and pushing happen
  only when the user asks, each time. (The auto-mode classifier also blocks pushing `main` until the user says so in
  the chat.)
- **Live database:**
  - The user runs schema SQL in the Supabase editor, then `npm run db:rls`.
  - Prisma refuses `db push --accept-data-loss` from a Claude session, and the error is easy to miss: the user twice
    thought a push had applied when it hadn't. Always verify with a read-only check. To run it here, the user must
    consent explicitly (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<their answer>"`).
  - `.env.local` points at the LIVE database: never test writes against it.
  - The Supabase Data API is off; "Confirm email" is on.
- **Deploy order when code needs new tables:** SQL first, then push `main`. When the schema drops something old code
  reads: push `main`, wait for Vercel Ready, then run the cleanup SQL.
- **Steps waiting on a person** go in `docs/todo.md`. Remind the user of them when going live or when a feature
  depends on one.
- **Postponed by the user** (2026-11-15): the Meta WhatsApp number setup (see todo.md).
- **iPhone installs:** iPhone has no install button. WhatsApp's in-app browser can't add to the home screen, and
  looks like Safari. Installed iPhone apps have their own cookies, so the user signs in again inside the icon. Test
  with a real `CriOS` user agent. Android browsers other than Chrome are sent to Chrome (Samsung Internet installs
  were blocked by Play Protect).
- **Tailwind:** `cn()` drops unregistered custom text sizes (register them in `src/lib/utils.ts`). Some arbitrary
  classes never generate (`text-[10.5px]`, `max-[359px]:sr-only`, `[overflow-wrap:anywhere]`). Use theme tokens
  and built-in utilities (`wrap-anywhere`). Check computed styles in the running app.
- **Animated SVG:** an animated element must not also carry its own `transform` attribute. Two openings on one page
  share gradient ids, so suffix the ids per app.
