# To do (waiting on a person, not on code)

Things that are built or planned but need someone to do a step outside the code. Newest first. Remove a line once
it's done.

## Set up Farm For You's WhatsApp number (Meta), postponed on 2026-11-15

The free customer sign-in (the customer sends us the code on WhatsApp) is **built but switched off** until this is
done. Until then the shop keeps its current sign-in, so nothing is broken.

- [ ] Run `prisma/sql/2026-11-15-whatsapp-sign-in.sql` in the Supabase SQL editor, then `npm run db:rls`.
      (The code leaves this table alone until the settings below are set: run this first.)
- [ ] Get a phone number that isn't on WhatsApp (a new prepaid SIM is simplest).
- [ ] Meta setup, steps 1–7 of [whatsapp-setup.md](whatsapp-setup.md): developer account, business portfolio,
      app, phone number, permanent key, app secret.
- [ ] Put the settings into Vercel: `WHATSAPP_NUMBER`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_TOKEN`,
      `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `OTP_SECRET`. Then redeploy.
- [ ] Register the webhook (step 8), then switch the app to *Live* (step 9).
- [ ] Check: Admin → Tech shows "WhatsApp, customer sends the code (free)"; sign in once on the shop from a phone.

## Other open items

- [ ] Vercel settings still empty: `GEO_CONTACT_EMAIL`, `VAPID_SUBJECT`.
- [ ] The restricted items list needs checking by someone who knows the law before it's switched on.
- [ ] Vercel's Hobby plan doesn't allow commercial use: move hosting (and buy farmforyou.in) once there are 4 farms.
