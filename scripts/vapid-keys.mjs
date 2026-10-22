// Prints a key pair for phone notifications (web push). Run once per deployment:
//   node scripts/vapid-keys.mjs
// and put the three lines in .env.local (or the host's environment settings).
import webpush from "web-push"

const { publicKey, privateKey } = webpush.generateVAPIDKeys()
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log("VAPID_SUBJECT=mailto:you@example.com   # your contact email")
