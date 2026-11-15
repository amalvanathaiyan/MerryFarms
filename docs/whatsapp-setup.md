# Farm For You's WhatsApp number (free customer sign-in)

Customers prove their phone number by **sending** us a short code on WhatsApp. Messages people send to a business
cost nothing, and WhatsApp itself vouches for the sender's number, so this sign-in is free. It needs one WhatsApp
Cloud API number for Farm For You, set up once by the platform owner. Every farm uses the same number.

Meta changes its screens from time to time. If a step looks different, follow Meta's own guide:
https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started

## What you need first

- **A phone number that isn't on WhatsApp now.** A new prepaid SIM is simplest. It only needs to receive one SMS or
  call to verify. A number already used in the ordinary WhatsApp or WhatsApp Business app must be removed from that
  app first (or set up with Meta's "coexistence" option, which is more fiddly).
- A Facebook account for yourself (it is never shown to customers).
- The privacy page address: https://farmforyou.vercel.app/legal/privacy (Meta asks for one).

## Steps

1. **Developer account.** Go to developers.facebook.com, sign in, and register as a developer.
2. **Business portfolio.** At business.facebook.com, create a business portfolio named "Farm For You".
3. **App.** At developers.facebook.com → *My Apps* → *Create app*. Choose the **WhatsApp** use case (type
   *Business*), name it "Farm For You", and link it to the Farm For You portfolio.
4. **Phone number.** In the app: *WhatsApp* → *API Setup* (or *Getting Started*) → *Add phone number*.
   - Display name: **Farm For You** (Meta checks this name; it must match the business).
   - Category: *Shopping and retail* (or the nearest one).
   - Verify the number with the SMS or call code.
5. **Permanent key.** At business.facebook.com → *Settings* → *Users* → *System users* → *Add*: name it "ffy-server",
   role *Admin*. Then *Assign assets* → the Farm For You app → *Full control*. Then *Generate token* for that app,
   with the permissions `whatsapp_business_messaging` and `whatsapp_business_management`, expiry *Never*. Copy the
   token once (Meta shows it only once).
6. **App secret.** In the app: *App settings* → *Basic* → *App secret* → *Show*. Copy it.
7. **Send me (privately, never in chat history that gets shared), or put straight into Vercel's settings:**

   | Setting | Where it comes from |
   |---|---|
   | `WHATSAPP_NUMBER` | The number, with country code, digits only (e.g. 919876543210) |
   | `WHATSAPP_PHONE_NUMBER_ID` | *WhatsApp* → *API Setup*: "Phone number ID" (not the number itself) |
   | `WHATSAPP_ACCESS_TOKEN` | Step 5 |
   | `WHATSAPP_APP_SECRET` | Step 6 |
   | `WHATSAPP_VERIFY_TOKEN` | Any long random word you make up; also typed in step 8 |

8. **Webhook (after the sign-in is built and deployed).** In the app: *WhatsApp* → *Configuration* → *Webhook* →
   *Edit*:
   - Callback URL: `https://farmforyou.vercel.app/api/whatsapp/webhook`
   - Verify token: the same `WHATSAPP_VERIFY_TOKEN`.
   - *Verify and save*, then under *Webhook fields* subscribe to **messages**.
9. **Go live.** In the app, switch *App mode* from *Development* to *Live*. Until then, only numbers you add as
   testers can reach it.
10. **Business verification (later, when Meta asks).** Meta may ask for business papers to raise limits or show a
    green tick. Sign-in keeps working without it.

## How customers will use it

1. On the shop's sign-in screen they type their phone number and tap **Send code on WhatsApp**.
2. WhatsApp opens with a message ready, e.g. `Farm For You code 482913`, addressed to the Farm For You number.
3. They tap send and return to the shop, which signs them in by itself within a few seconds.
4. They stay signed in on that phone until they sign out, or for 90 days.

People without WhatsApp can use an email code, or (up to 10 a day, free) an SMS code.

## Costs

- Messages customers send us: free.
- Our short "You're signed in" reply within 24 hours of their message: free (within Meta's monthly allowance for
  replies).
- We never send the code ourselves, so there's no per-code charge. Sending codes from our side (about ₹0.115 + GST
  each) stays a switch in admin, off.
