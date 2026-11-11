// Renders the PNG app icons from the cart-wheel mark with a headless Chromium browser (Edge or Chrome).
// Run after scripts/art/cart-art.mjs:  node scripts/art/icons.mjs
// Set BROWSER to the browser's path if it isn't found. The PNGs are committed, so this only runs when the mark changes.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { mark } from "./cart-art.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

const candidates = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean)
const browser = candidates.find((p) => existsSync(p))
if (!browser) throw new Error("No Chromium browser found; set BROWSER to its path.")

const LEAF = "#1E6B45", CREAM = "#FFF1C7", YOLK = "#F5B700", INK = "#16301F", FIELD = "#FBF3DC"
// Maskable icons are cropped to a circle or squircle by the phone: full-bleed background, mark inside the safe zone.
const maskable = (size, bg, fg, hub) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/><g transform="translate(9.6 9.6) scale(0.7)">${mark(64, bg, fg, hub).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</g></svg>`

/**
 * One icon set per installable app, told apart by colour (see src/app/app-manifest/route.ts):
 *   shop  (customers)          cream, green wheel
 *   farm  (farm admin, staff)  leaf green, cream wheel
 *   admin (super admin)        dark ink, gold wheel
 * The older icon-*.png files stay for push notifications.
 */
const APPS = { shop: [FIELD, LEAF, YOLK], farm: [LEAF, CREAM, YOLK], admin: [INK, YOLK, CREAM] }
const icons = [
  ["icon-192.png", 192, mark(192, LEAF, CREAM, YOLK)],
  ["icon-512.png", 512, mark(512, LEAF, CREAM, YOLK)],
  ["icon-maskable-512.png", 512, maskable(512, LEAF, CREAM, YOLK)],
  ["apple-touch-icon.png", 180, maskable(180, LEAF, CREAM, YOLK)],
  ...Object.entries(APPS).flatMap(([app, [bg, fg, hub]]) => [
    [`${app}-192.png`, 192, mark(192, bg, fg, hub)],
    [`${app}-512.png`, 512, mark(512, bg, fg, hub)],
    [`${app}-maskable-512.png`, 512, maskable(512, bg, fg, hub)],
    [`${app}-apple.png`, 180, maskable(180, bg, fg, hub)],
  ]),
]

const work = mkdtempSync(path.join(tmpdir(), "ffy-icons-"))
const outDir = path.join(root, "public", "icons")
mkdirSync(outDir, { recursive: true })
for (const [name, size, svg] of icons) {
  const page = path.join(work, `${name}.html`)
  writeFileSync(page, `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`)
  execFileSync(browser, [
    "--headless", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
    `--window-size=${size},${size}`, `--screenshot=${path.join(outDir, name)}`, pathToFileURL(page).href,
  ], { stdio: "ignore" })
  console.log("Wrote public/icons/" + name)
}
