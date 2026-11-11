// Writes the bullock cart as plain image files, for places that show a picture file rather than the live drawing
// (sign-in pages, the offline page). Run after changing the cart in src/components/art/farm-scene-svg.ts:
//   npx tsx scripts/art/cart-files.ts
import { writeFileSync } from "node:fs"
import path from "node:path"
import { cartSceneSvg } from "../../src/components/art/farm-scene-svg"

const art = path.join(__dirname, "..", "..", "public", "art")
writeFileSync(path.join(art, "cart-scene.svg"), cartSceneSvg("day"))
writeFileSync(path.join(art, "cart.svg"), cartSceneSvg("day", true))
console.log("Wrote public/art/cart-scene.svg and cart.svg")
