/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, run with node */
// Builds the brand drawings the app uses, from the locked marks in this folder:
//   src/components/art/brand-marks.generated.ts   SVG markup for the marks and the opening animations
//   public/icons/{shop,farm,admin}-*.png, icon-*.png, apple-touch-icon.png   the install icons
//   src/app/icon.svg                                the browser tab icon
// Each mark is fitted by measuring its real pixels, so it fills its icon (84% of a square icon; inside Android's
// round crop, which keeps the middle 80%, the farthest pixel sits at 40% of the size from the centre).
// Run after changing a mark:  node scripts/art/brand/build.cjs
const fs = require("node:fs")
const path = require("node:path")
const sharp = require("sharp")
const ffy = require("./ffy-mark.cjs")
const merry = require("./merry-egg.cjs")

const root = path.resolve(__dirname, "..", "..", "..")
const N = 1024
const GREEN = "#1E8A4C"
const CREAM = "#FFF6D6"

/** Bigger eyes and thicker lines, for 48 px and below. */
const bold = (s) => s.replace(/stroke-width="1\.5"/g, 'stroke-width="2.4"').replace(/stroke-width="1\.7"/g, 'stroke-width="2.6"').replace(/r="1\.15"/g, 'r="1.7"').replace(/r="1\.4"/g, 'r="1.9"')
const noClasses = (s) => s.replace(/ class="[^"]*"/g, "")

const ffyGreen = noClasses(ffy.mark(ffy.onGreen, true))
const ffyGreenBold = bold(noClasses(ffy.mark(ffy.onGreen, false)))
const ffyLight = noClasses(ffy.mark(ffy.onCream, true))
const ffyLightBold = bold(noClasses(ffy.mark(ffy.onCream, false)))
// Under ~16 px: three solid leaves on the heart
const tinyLeaf = (len, w, b) => `M0 0C${w * 0.66} ${-len * 0.22} ${w * 0.6 + b * 0.5} ${-len * 0.7} ${b} ${-len}C${-w * 0.55 + b * 0.5} ${-len * 0.7} ${-w * 0.66} ${-len * 0.22} 0 0Z`
const ffyTiny =
  [[-38, 30, 12, -4], [38, 30, 12, 4], [0, 38, 13, 2]].map(([r, l, w, b]) => `<g transform="translate(32 40.5) rotate(${r})"><path d="${tinyLeaf(l, w, b)}" fill="${GREEN}"/></g>`).join("") +
  `<path d="${ffy.HEART}" fill="#F5B301"/>`

async function measure(inner, defs = "") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}" viewBox="0 0 64 64">${defs}${inner}</svg>`
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let x0 = N, y0 = N, x1 = 0, y1 = 0
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (data[(y * N + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  let r = 0
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (data[(y * N + x) * 4 + 3] > 24) r = Math.max(r, Math.hypot(x - cx, y - cy))
  const u = 64 / N
  return { cx: cx * u, cy: cy * u, w: (x1 - x0) * u, h: (y1 - y0) * u, r: r * u }
}
/** fill: share of the box the mark may take; circle: how far (share of the box) its farthest pixel may reach. */
function fitted(inner, m, { fill, circle }) {
  const s = circle ? (circle * 64) / m.r : Math.min((fill * 64) / m.w, (fill * 64) / m.h)
  return `<g transform="translate(${(32 - m.cx * s).toFixed(3)} ${(32 - m.cy * s).toFixed(3)}) scale(${s.toFixed(4)})">${inner}</g>`
}
const svgFile = (inner, { bg, size = 512, rx = 0, defs = "", label }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"${label ? ` role="img" aria-label="${label}"` : ""}>${defs}${bg ? `<rect width="64" height="64" rx="${rx}" fill="${bg}"/>` : ""}${inner}</svg>`
const png = (svg, size, file) => sharp(Buffer.from(svg), { density: Math.max(72, (72 * 512) / size) }).resize(size, size).png().toFile(file)

async function main() {
  const m = {
    green: await measure(ffyGreen), greenBold: await measure(ffyGreenBold), light: await measure(ffyLight), lightBold: await measure(ffyLightBold), tiny: await measure(ffyTiny),
    egg: await measure(merry.egg("happy", true, true), merry.defs),
  }

  // The install icons for farms without a logo of their own, and for FarmForYou admin
  const icons = path.join(root, "public", "icons")
  const sets = { shop: { bg: CREAM, full: ffyLight, mFull: m.light, small: ffyLightBold }, farm: { bg: GREEN, full: ffyGreen, mFull: m.green, small: ffyGreenBold }, admin: { bg: "#17703D", full: ffyGreen, mFull: m.green, small: ffyGreenBold } }
  for (const [app, k] of Object.entries(sets)) {
    const square = fitted(k.full, k.mFull, { fill: 0.84 })
    await png(svgFile(square, { bg: k.bg }), 192, path.join(icons, `${app}-192.png`))
    await png(svgFile(square, { bg: k.bg }), 512, path.join(icons, `${app}-512.png`))
    await png(svgFile(square, { bg: k.bg }), 180, path.join(icons, `${app}-apple.png`))
    await png(svgFile(fitted(k.full, k.mFull, { circle: 0.4 }), { bg: k.bg }), 512, path.join(icons, `${app}-maskable-512.png`))
  }
  for (const f of ["192", "512", "maskable-512"]) fs.copyFileSync(path.join(icons, `shop-${f}.png`), path.join(icons, `icon-${f}.png`))
  fs.copyFileSync(path.join(icons, "shop-apple.png"), path.join(icons, "apple-touch-icon.png"))

  // Browser tab: the bold mark on green, filling the tile
  fs.writeFileSync(path.join(root, "src", "app", "icon.svg"), svgFile(fitted(ffyGreenBold, m.greenBold, { fill: 0.9 }), { bg: GREEN, size: 64, rx: 15, label: "FarmForYou" }) + "\n")

  // Markup for the app (64×64 boxes). Static drawings only: no user input ever reaches these strings.
  const anim = ffy.mark(ffy.onGreen, true) // keeps its ffy-leaf / ffy-heart / ffy-face classes for the opening
  const e = merry.parts()
  const eggAnim =
    `<g class="me-shadow">${e.shadow}</g><g class="me-wiggle"><g class="me-drop"><g class="me-comb">${e.comb}</g>${e.body}` +
    `<g class="me-open">${e.open}</g><g class="me-happy">${e.happy}</g>${e.mouth}${e.cheeks}</g>` +
    e.leaves.map((l, i) => `<g class="me-leaf me-l${i + 1}">${l}</g>`).join("") + `</g>`
  const out = {
    /** FarmForYou mark on its green tile: light leaves. Fills the tile. */
    FFY_ON_GREEN: fitted(ffyGreen, m.green, { fill: 0.84 }),
    /** The same for 48 px and below: no veins, bolder face. */
    FFY_ON_GREEN_SMALL: fitted(ffyGreenBold, m.greenBold, { fill: 0.88 }),
    /** FarmForYou mark alone, for light grounds: deep green leaves. */
    FFY_ON_LIGHT: fitted(ffyLight, m.light, { fill: 0.96 }),
    /** Under ~16 px, beside words ("on Farm For You"): three solid leaves on the heart. */
    FFY_TINY: fitted(ffyTiny, m.tiny, { fill: 0.98 }),
    /** The opening animation's drawing; animated by src/components/opening.tsx. */
    FFY_ANIMATED: fitted(anim, m.green, { fill: 0.9 }),
    /** Gradients the Merry Egg uses; include once per <svg>. */
    MERRY_EGG_DEFS: merry.defs.replace(/\n/g, ""),
    MERRY_EGG: fitted(merry.egg("happy", true, true), m.egg, { fill: 0.96 }),
    MERRY_EGG_ANIMATED: fitted(eggAnim, m.egg, { fill: 0.9 }),
  }
  const ts =
    "// Generated by scripts/art/brand/build.cjs from the locked brand marks. Do not edit by hand.\n" +
    "// Each value is the inside of an <svg viewBox=\"0 0 64 64\">.\n\n" +
    Object.entries(out).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)}\n`).join("")
  fs.writeFileSync(path.join(root, "src", "components", "art", "brand-marks.generated.ts"), ts)
  console.log("brand marks, icons and the tab icon written")
}
main().catch((e) => { console.error(e); process.exit(1) })
