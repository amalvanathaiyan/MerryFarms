# Farm For You: platform plan (rev. 2, 2026-11-12)

**Goal:** one app for every kind of farming in South India, Tamil Nadu first. Each farm is a tenant, built on the
Hotelier-4U pattern. Farm For You provides every module, each one taken separately by request or subscription.
Everything is **configurable (opt in or out)** and **automated end to end**, for farms and for the platform. Merry
Farms is tenant #1.

Rev. 2 adds the user's decisions (§7), the configuration framework (§4) and the automation engine and bots (§5).

---

## 1. Where we are today (audit)

| Area | What exists | What's missing or wrong |
|---|---|---|
| Tenancy | `Tenant` row, tenantId on every table, `tenantDb` scoping, RLS as a second lock, support mode | One host serves only `DEFAULT_TENANT_SLUG`; there's no multi-farm routing yet |
| What a farm gets | 22 feature switches gated by **plan tiers** | No **modules**, no request or subscription per module, no billing |
| Selling | Catalogue, egg store, stock, slots and area, orders through web, WhatsApp, phone and walk-in, call confirmation, credit, invoices, returns, payments, recurring plans, messages, push | Units are mostly "packs". No category catalogue per farm type, no price per quantity, no price lists, no counter sale or market sale, no complaints. **No buying** |
| Customers | `Customer` per farm, keyed by phone; access-token cookie or personal link; OTP code ready but **no provider live** | Sign-in isn't settled. No record of how a customer came, no customer type, no consent log, no platform-level identity |
| Farm records | Expenses (13 kinds), `ProductionEntry`, farm profit | Kinds mix modules. Common costs (motor repair, electricity) have no proper home. No land, plots, assets, workers, inputs store or tasks |
| Poultry | Batches, daily entry, feed store, losses, vaccines, weights, costs | The feed store is poultry-only. Not on shared cost centres |
| Livestock, fishery, crops | None | Everything |
| Automation | Two daily cron jobs (`/api/cron/plans`, `/api/cron/morning`) | No event, rule or job engine. Vercel Hobby allows only daily cron jobs. No bots |
| Configuration | Feature switches (on/off) and a few settings per farm | No common settings framework (defaults → farm → user), no admin control of which options farms may change, no history |
| FFY admin | Farm list, new farm, farm page, support mode and log | Hotelier had more: subscriptions and payments, a tech monitor, onboarding, an audit log |
| Brand | FFY mark and Merry Egg live, name colours, tagline, openings, fitted icons | The app's **colour theme is still the old palette** (#1E6B45). "FarmForYou" and "Farm For You" are both used in text |
| Limits | Free tiers, nightly encrypted backups | **Photos are stored in the database** (500 MB free). Vercel Hobby doesn't allow commercial use (plan: move once there are 4 farms, §7) |

---

## 2. Design principles

1. **Module ≠ feature.** A module is what a farm takes; features are switches inside it. Modules never overlap. Shared
   things live in **Farm Core**.
2. **Common vs module-specific is explicit.** Every money, stock or work record carries a **cost centre**:
   - *Farm (common)*: farm maintenance, such as electricity, the well motor or fencing;
   - *Module*: e.g. Livestock, general;
   - *Unit*: a batch, pond, animal or plot.
   Common costs stay farm-wide, never split (§7).
3. **Farm For You is the face; each farm owns its customers.** Customers find farms through Farm For You, but the
   relationship (orders, credit, messages) belongs to the farm.
4. **Offline is first-class.** Phone, walk-in and market sales and customers are recorded like online ones.
5. **Tamil Nadu's diversity is data, not code.** Categories, crops, breeds, species, seasons, units and markets come
   from catalogues the platform maintains.
6. **Everything configurable.** Every feature and setting has a default and an on/off. The platform decides which
   options a farm may change (§4).
7. **Everything automatable.** Things that happen raise events. Rules and schedules act on them without people (§5).
8. **Build for every farm. Exact brand themes.** FFY chrome is in FFY colours; each farm's app is in its own colours.
9. **Near-zero running cost** until there's revenue. Paid services are opt-in add-ons.

---

## 3. Target architecture

### 3.1 Modules

| Module | Holds | Unit tracked |
|---|---|---|
| **Farm Core** (always on) | Farm profile, land and plots, water sources, **farm maintenance** (assets, repairs, electricity, fencing: common costs), inputs store, workers and wages, expenses and income with cost centres, tasks and reminders, documents, reports, staff and roles | Farm, asset, plot |
| **Selling** | Category catalogue, products with price per quantity, stock, channels, orders, delivery and pickup, payments, credit, invoices (GST optional), returns, recurring plans, customer support | Product, order |
| **Buying** | Suppliers, purchases and bills, payables, receiving into the inputs store | Supplier, purchase |
| **Poultry** | Layers, broilers, country hens, ducks, quail, turkey: batches, daily entry, feed use, vaccines, weights, losses, costs | Batch |
| **Livestock** (the user's decision: one module for cows, buffalo, goats, sheep and all cattle) | Animals and herds of any species; one shared set of activities: feeding, vaccines and health, breeding, birth (calving, kidding, lambing), weights, milk recording (for milking animals), sales. Species and breeds come from the catalogue (Kangayam, Umblachery, Murrah, Kanni, Kodi, Tellicherry, Mecheri…) | Animal, herd |
| **Fishery** | Ponds and tanks, species (rohu, catla, tilapia, murrel, shrimp…), stocking, feed, water quality, mortality, harvest | Pond cycle |
| **Crops** | Every crop grown in South India (catalogue): seasons (Tamil months and *pattam*: Kuruvai, Samba, Thaladi…), plot crop cycles, operations (land prep, sowing, irrigation, fertiliser, pest), harvest and yield | Plot crop cycle |
| Later | Beekeeping, mushroom, nursery, value-added processing (oil, ghee, pickles, millet foods), sericulture | |

### 3.2 Farm Core: the shared spine

- **Land and places:** blocks and plots (acres or cents, survey number, soil), sheds, ponds, wells and borewells.
- **Farm maintenance (common costs):** assets (motors, pumps, tractors, sheds) with service and repair logs, plus
  utilities (electricity, water) and upkeep (fencing, roads). All under *Farm (common)*. Reports show them as farm
  overheads; they're never split into modules.
- **Inputs store:** one store for feed, seed, fertiliser, medicine, fish feed and packing. Purchases add to it;
  every use names a cost centre. This replaces the poultry-only feed store.
- **People:** workers (no login needed), attendance, wages and advances, with a cost centre per day.
- **Money:** one ledger of expenses and income, each with a cost centre.
- **Tasks and reminders:** due work from every module on Today. Created by people or by automation (§5).

### 3.3 Selling, for any product

- **Category catalogue per module** (the user's decision). The platform maintains every common category. A farm
  ticks the ones it sells, and can rename or add its own. Starter list:
  - **Poultry:** eggs (country, layer, duck, quail), live birds, dressed chicken, chicks, manure.
  - **Livestock:** milk (cow, buffalo, goat), curd, butter, ghee, paneer, *khoa*, live animals (calves, kids,
    lambs), meat (goat, sheep), manure and compost, cow-dung products, *panchagavya*.
  - **Fishery:** live fish, fresh fish by species, dried fish, fingerlings, shrimp.
  - **Crops:**
    - rice and paddy (varieties, *seeraga samba*, *mappillai samba*), millets (ragi, kambu, thinai, samai,
      varagu), pulses;
    - vegetables, greens (*keerai*: arai, siru, mulai, agathi…), fruits (banana varieties, mango, guava, jackfruit);
    - coconut and tender coconut, sugarcane and jaggery, turmeric, spices, flowers (jasmine, *kanakambaram*),
      plantation (arecanut, coffee, tea, pepper);
    - seeds and seedlings, fodder.
  - **Value-added:** cold-pressed oils (gingelly, groundnut, coconut), pickles, *podi*, flours and *maavu*, honey,
    snacks.
  - **Services:** farm visits, ploughing or tractor hire, consultation.
- **Products** sit under a category, with **price per quantity** (variants): e.g. 1 kg ₹X, 500 g ₹Y, tray of 30 ₹Z,
  1 litre, ½ litre, a bunch (*kattu*), a *padi*. Each has its own price, MRP, stock unit, perishable shelf life, and
  stock source (made by a module, bought in, or untracked).
- **Price lists (opt-in):** retail, wholesale and trader, hotel and restaurant, customer-specific.
- **Channels:** online shop, WhatsApp, phone, walk-in, market stall and shandy (quick counter sale; a name isn't
  needed), wholesale, institutional.
- **Support:** complaints and tickets per order (damaged, short, late) with resolution and refund.
- **GST (configurable, off by default):** the farm turns it on, with GSTIN, HSN per product and tax per category
  (most raw produce is exempt). Invoices switch format automatically.

### 3.4 Farm For You as the face; customers per farm

- **farmforyou.in (the platform face):** customers search by area (PIN code or location) and by product, and see
  only farms that deliver there. Each farm has a profile page (story, photos, videos, products, delivery area).
  Choosing a farm opens that farm's shop.
- **The relationship stays with the farm:** orders, credit, messages and plans are per farm. There's no shared
  cart across farms. Farms serve customers who reach them directly too (their own link and WhatsApp).
- **One identity:** a PlatformPerson (phone, name, language), linked to each farm's own Customer record (credit,
  notes, type, price list). Farms never see each other's customers.
- **How they came:** online, WhatsApp, phone, walk-in, market, referral, or through Farm For You. Staff create
  offline customers; their records join up automatically when they later sign in online (matched by phone).
- **Consent log:** WhatsApp and SMS opt-in, with date and channel.
- **Sign-in (configurable per platform, opt-in per farm):**
  1. Call-verified (free, default): the farm's confirmation call verifies the phone and keeps that device signed
     in.
  2. WhatsApp OTP, once the Cloud API is set up.
  3. SMS OTP (MSG91).
  4. Personal link (fallback).

### 3.5 Subscription plans, modules and platform billing (everything set by the platform admin)

Modules are the building blocks. **Plans are made of modules, and nothing about a plan is fixed in code.**

- **Module** (defined in code, since it has screens): key, Tamil and English name, icon, features inside it, the
  Core pieces it needs. Admin can switch a whole module off platform-wide.
- **Plan** (made in admin; the user's decision):
  - Name (Tamil and English), monthly and yearly price, trial days.
  - **Which modules it includes**, and **limits**: products, staff logins, orders a month, storage, SMS and
    WhatsApp messages, farms per account.
  - Which features inside those modules are on, or forced on or off.
  - Whether it shows on the public price list, or is private (made for one farm).
- **Add-ons:** a module or a bundle a farm can add to any plan for its own price (e.g. Fishery on top of
  "Poultry farm").
- **Plan versions:** editing a plan creates a new version. Existing farms stay on theirs (grandfathered) until admin
  moves them. Every change is in the audit log.
- **Farm subscription:** one plan + its add-ons; status trial, active, past due, paused or ended. What a farm can use
  is *plan modules + add-ons + admin overrides*, minus anything the farm switched off.
- **Flow:** the farm compares plans and add-ons on its **Plan & modules** page → *Choose*, *Upgrade* or *Request
  add-on* → admin approves (or automatic for public plans) → trial or active → screens appear. Automation (§5) sends
  trial-ending notices, invoices and reminders, and pauses on non-payment (data kept, read-only), with a grace period
  set in admin.
- **Billing:** `PlatformInvoice` and `PlatformPayment`. Manual UPI or bank first, Razorpay (with recurring payments)
  later. Prorated upgrades, coupons and discounts. **GST on FFY's invoices is built in but switched off** until Farm
  For You registers (§7).

### 3.8 Home page, farm sign-up and review

- **Home page (farmforyou.in, like Hotelier's but in FFY brand), Tamil first:**
  - The opening animation, then what Farm For You is; the modules (poultry, livestock, fishery, crops, selling,
    buying) with pictures.
  - **For customers:** "find farms near you" (§3.4). **For farms:** plans and prices, read live from admin, and
    *Register your farm*.
  - Stories from farms (Merry Farms first), FAQ, contact and WhatsApp, a help video.
  - Legal pages: terms, privacy (India's DPDP Act), refunds, the **farm seller agreement** and the
    **prohibited items policy**.
- **Two ways a farm joins:**
  1. **Admin registers it** (as today), already approved.
  2. **The farm registers itself:**
     - Owner's mobile (verified) and email.
     - Farm name (Tamil and English), what it farms (modules of interest), location pin and address.
     - Photos of the farm.
     - Business details: FSSAI registration or licence for food items; GSTIN if any; PAN optional.
     - Acceptance of the seller agreement and prohibited items policy.
- **Review by the Farm For You team:**
  - Statuses: *applied → under review → more details needed → approved / rejected / on hold*.
  - **Review checklist** in admin: phone, location, documents, a call or video call, an optional farm visit.
    Notes and the reviewer are recorded.
  - Automation reminds the farm about missing details and alerts admin about waiting applications.
  - While under review the farm can set up its catalogue and settings, but **its shop isn't public**, and it doesn't
    appear on the home page or directory until approved.
  - On approval: the chosen plan's trial starts, and a welcome message and setup checklist are sent.
  - On rejection: the reason is recorded, and the farm is told politely.
- **Identity documents:** we don't store Aadhaar numbers. Only what the review needs is kept, documents sit in
  private storage, and they're deleted on rejection after a set period (privacy law).

### 3.9 Items against the law: screening and alerts

- **Restricted items list** (platform catalogue, edited by admin). Each entry has words in Tamil and English,
  categories or species, and an action:
  - **Block:** can't be listed.
  - **Hold for review:** hidden until admin approves.
  - **Needs a licence:** allowed once the farm's licence is on file (e.g. FSSAI for packed foods).
- **What the list covers.** Examples to seed, to be **checked by a legal expert before use**:
  - wild animals, birds and their products (protected under the Wildlife Protection Act), e.g. peafowl, turtles,
    wild boar meat, parakeets and munias;
  - banned fish species (e.g. African catfish, Thai magur);
  - banned pesticides and unapproved animal drugs;
  - alcohol (toddy and arrack);
  - narcotic plants;
  - livestock items restricted under Tamil Nadu's animal laws.
- **Screening runs automatically** whenever a product, category, photo caption or farm profile is added or changed,
  in every farm (text and category match). AI screening of names and photos can be added later (opt-in).
- **On a hit:**
  1. The item is blocked or hidden, as its action says.
  2. **The platform admin is notified at once** (in-app, plus push or WhatsApp per admin settings), and the case
     opens in a **Compliance inbox** with the farm, item, rule matched and screenshot.
  3. The farm sees a polite note on why.
- **Admin actions:** approve, keep hidden, remove, warn the farm, suspend the farm. Every decision is in the audit log.
- **Customers can report** a listing ("report this product"), which goes to the same inbox.
- **Repeat offences** (configurable count) flag the farm for review automatically.

### 3.6 FFY admin panel ("supreme")

- **Dashboard:** farms, modules active, revenue and dues, trials ending, orders and sales across farms, new
  customers, automation alerts.
- **Farms:** profile, modules, billing, staff and logins, support mode and log, usage, brand, health, settings
  overrides.
- **Requests inbox:** module requests, help requests, farm sign-up leads.
- **Catalogues:** categories, crops, breeds, species, units, seasons, drawings, opening marks, message templates.
- **Module catalogue and pricing; settings registry** (§4); **automation rules and job runs** (§5).
- **Billing:** invoices, payments, dues, receipts, GST switch.
- **Tech monitor** (Hotelier's, extended):
  - Credentials checklist for every service.
  - Database and storage use against free limits; row counts per table.
  - Deployed version and host.
  - Job queue health and the last success of every job.
  - Backup status, error counts, and the provider in use for each service (OTP, WhatsApp, push, AI).
- **Audit log** of every admin, support and automation action. **Announcements** to farms. **Platform admins and
  roles.**

### 3.7 Brand system

- **Tokens:** FFY chrome always uses FFY tokens (#1E8A4C, #F5B301, #FFF6D6). A farm's apps use its own tokens,
  contrast-checked, with light, dark and soft variants. Merry Farms: green #1F6B3A for actions, red #A8262B for
  accents.
- **Naming rule:** "Farm For You" in visible text; "FarmForYou" only as a handle or domain.
- **Checks:** every screen is reviewed in both brands, in Tamil, at 320, 360 and 390 px, with larger text on.

---

## 4. Configuration framework (everything opt-in or out)

- **Settings registry** in code. Each setting has: key, type, default, Tamil and English label and help, the module
  it belongs to, and **who may change it** (platform only, farm owner, staff, customer).
- **Layers:** platform default → module default → farm override → user override. The nearest set value wins.
- **Admin controls:**
  - which settings farms see;
  - lock a setting platform-wide;
  - roll out a new feature to chosen farms first (feature flags).
- **History:** every change is recorded (who, when, old and new value) in the audit log.
- **Farm screen:** one Settings page grouped by module, generated from the registry, so a new setting needs no new
  screen.
- The existing feature switches move into the registry as each module's on/off features.

---

## 5. Automation engine and bots

**Engine (platform-wide, per farm):**

- **Events:** everything that happens is recorded as a typed event, for example `order.placed`,
  `order.delivered`, `payment.overdue`, `stock.low`, `batch.mortality_spike`, `animal.vaccine_due`,
  `pond.water_alert`, `crop.harvest_due`, `module.trial_ending` and `invoice.unpaid`.
- **Rules:** *when* an event or schedule fires, *if* conditions hold, *then* take actions:
  - notify (push, in-app, WhatsApp, SMS, email);
  - create a task;
  - change a status;
  - generate an invoice;
  - send a template message;
  - call a webhook.
- **Who sets rules:** the platform ships default rules for every module, as recipes. Each farm turns them on or off
  and adjusts thresholds. Admin edits platform rules.
- **Jobs:** a jobs table with retries, run by one frequent "tick", which gets around Vercel's daily-only cron. Free
  choices for the tick: Supabase `pg_cron` calling `/api/cron/tick` every few minutes, or GitHub Actions. Job
  history shows in the tech monitor.
- **Ready to grow:** the same jobs table can move to pg-boss or a worker process when there are many farms.

**Bots (opt-in add-ons):**

1. **Customer WhatsApp bot:** browse products, order, track, repeat last order, raise a complaint, in Tamil. Needs
   the WhatsApp Cloud API; Meta charges some message types.
2. **Farm assistant:** Tamil text or voice into records, e.g. "இன்று 3 கோழி இறந்தது, 12 கிலோ தீவனம்" becomes the
   daily entry. Also daily summaries ("what needs doing today?") and answers from the farm's own data. Uses an AI
   model (paid per use, so off by default).
3. **Admin ops bot:**
   - morning digest of the platform;
   - anomaly alerts (no orders from a busy farm, job failures, storage near its limit);
   - automatic onboarding steps;
   - trial, invoice and pause flows.

**Default automations to ship** (each one switchable):

- **Orders:** order reminders and call lists; delivery route for the day; unpaid credit reminders; repeat-order
  nudges.
- **Stock:** low-stock alerts; expiry of perishables.
- **Livestock and poultry:** vaccine and deworming due; breeding and calving due; weight checks.
- **Fishery and crops:** pond water checks; crop operation calendar by season.
- **Money:** monthly profit summary.
- **Platform:** trial-ending notices; FFY invoices and reminders; module pausing on non-payment.

---

## 6. Phased build

Every phase: settle details → build on a feature branch → demo checks (both brands, Tamil, small phones) → merge to
develop → you apply the schema on Supabase → main.

| Phase | Scope |
|---|---|
| **0. Foundations** | Brand tokens (FFY and per farm; Merry red and green) applied across the app; naming rule; photos moved to Storage; multi-farm routing kept ready |
| **1. Platform engine** | Settings registry (§4); module system; **plans made in admin** (modules, limits, prices, versions, add-ons) and farm subscriptions (§3.5); event log, jobs table, tick, rules (§5); admin v2: dashboard, requests, plan and module management, billing records, GST switch, tech monitor, audit log, announcements |
| **1b. Home page, sign-up, review, compliance** | farmforyou.in home page in FFY brand with live plans; farm self-registration; review workflow and checklist (§3.8); legal pages incl. seller agreement and prohibited items policy; restricted items list, automatic screening, Compliance inbox and admin alerts (§3.9) |
| **2. Farm Core** | Land and plots, farm maintenance (assets, utilities, repairs), inputs store, workers and wages, cost centres, tasks; first default automations |
| **3. Customers and the FFY face** | PlatformPerson, customer source and type, offline customers and joining up, consent log, call-verified sign-in, counter sale; farmforyou.in farm directory by area and product, with farm profile pages |
| **4. Selling v2 + Buying** | Category catalogue per module, price per quantity, price lists, channels incl. market and wholesale, support tickets, farm GST option; suppliers, purchases, payables |
| **5. Poultry on the core** | Inputs store, cost centres, tasks and automations; birds sold through orders reduce the batch |
| **6. Livestock** | All species: animals and herds, feed, health and vaccines, breeding and births, weights, milk recording, sales |
| **7. Fishery** | Ponds, cycles, stocking, feed, water quality, harvest |
| **8. Crops** | Crop catalogue, seasons and pattam, plot cycles, operations, harvest and yield |
| **9. Bots and growth** | Customer WhatsApp bot, farm assistant, admin ops bot; Telugu, Kannada and Malayalam; later modules |
| **When there are 4 farms** | Domain farmforyou.in, subdomains per farm, admin.farmforyou.in, commercial hosting |

---

## 7. Decisions (user, 2026-11-12)

1. **Marketplace:** Farm For You is the face of all farms. Customers choose any farm that serves their area; each
   farm handles its own customer base and serves customers who reach it.
2. **Livestock:** one module for cows, buffalo, goats, sheep and all cattle, with the same activities (maintenance,
   feed, vaccines…).
3. **Selling:** a full category catalogue for every module; products under categories, priced per quantity.
4. **Shared costs** (electricity etc.) are part of farm maintenance in Farm Core, kept farm-wide.
5. **Hosting and domain:** wait until there are 3 more farms.
6. **GST:** FFY isn't registered now; build GST in, switched off.
7. **Everything highly configurable** (opt in or out). **End-to-end automation** for farms and the platform, with
   room to scale and upgrade.

8. **How FFY charges farms:** subscription plans, **each plan's contents configurable by the platform admin**,
   built from clearly separate modules (§3.5).
9. **A home page like Hotelier's**, from which farms can register themselves. Admin can also register farms.
   Self-registered farms are **reviewed by the Farm For You team** for authenticity and to understand the business
   before going live (§3.8).
10. **Anything added in any farm that's against the law notifies the platform admin** (§3.9).

11. **Order age colours (user, 2026-11-12, in the pipeline):** a new order shows green; not acted on after 2 hours, yellow;
    after 4 hours, red. Both hour marks are farm settings (each farm's working times), so unnoticed orders get attended.
    Built with the settings registry (§4) and the automation engine (§5), which can also alert staff when an order
    turns red. Phase 1, steps 2–3.

**Still open:**

- Whether to use paid add-ons (WhatsApp Cloud API, AI assistant) and when.
- The restricted items list needs checking by someone who knows the law before it's switched on.
- Until the domain is bought, more than one farm on the current address needs **path-based farm addresses**
  (e.g. `/f/<farm>`), with Merry Farms staying at `/`. This lets farms 2–4 join before subdomains.
