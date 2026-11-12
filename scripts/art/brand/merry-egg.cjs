// The Merry Egg (LOCKED 2026-11-12), an opening mark a farm can be given. Drawn in a 64×64 box.
const RED = "#A8262B", RED_DK = "#7E1A1E", RED_LT = "#C8383E", GREEN = "#1F6B3A", G2 = "#2F8A4E", G3 = "#4CA866", FACE = "#4A2A10"
const f = (n) => +n.toFixed(2)
// Leaf like the FFY leaves: slim stalk, two-tone halves either side of a curved midrib. Base (0,0), tip (b,-len)
function leaf(len, w, b, light, dark, detail) {
  const s = len * .1, back = `Q${f(b*.15)} ${f(-len*.55)} 0 ${f(-s)}`
  const half = (sg) => `M0 ${f(-s)}C${f(sg*w*.82)} ${f(-len*.24)} ${f(sg*w*.52+b*.5)} ${f(-len*.74)} ${f(b)} ${f(-len)}${back}Z`
  return `<path d="M0 0L0 ${f(-s)}" stroke="${dark}" stroke-width="1.3" stroke-linecap="round"/><path d="${half(-1)}" fill="${light}"/><path d="${half(1)}" fill="${dark}"/>` +
    (detail ? `<path d="M0 ${f(-s)}Q${f(b*.15)} ${f(-len*.55)} ${f(b)} ${f(-len)}" stroke="#FFFFFF" stroke-opacity=".55" stroke-width=".55" fill="none" stroke-linecap="round"/>` : "")
}
const at = (x, y, r, inner) => `<g transform="translate(${x} ${y}) rotate(${r})">${inner}</g>`
const EGG = "M32 12.8C21.6 12.8 14.6 28.2 14.6 39.8C14.6 50.8 22.3 58 32 58C41.7 58 49.4 50.8 49.4 39.8C49.4 28.2 42.4 12.8 32 12.8Z"
// A hen's comb: five rounded points rising to the back, tilted a little to one side
const COMB = "M21.8 19.6C20.6 16.4 21.2 12.6 23.2 10.8C24.6 9.6 26.4 10.4 26.8 12.2C27 9 28.4 6.4 30.4 6.2C32 6 32.8 7.8 32.8 9.6C33.6 6.6 35.6 4.6 37.6 5C39.4 5.4 39.6 7.6 39 9.4C40.6 8.2 42.8 8.4 43.4 10.2C44.2 12.6 43.8 15.8 42.6 18.8C39.6 15.4 36 13.6 32.2 13.6C27.8 13.6 24.2 16 21.8 19.6Z"
const defs = `<defs>
<radialGradient id="eggG" cx=".38" cy=".34" r=".78"><stop offset="0" stop-color="#F8DDB4"/><stop offset=".62" stop-color="#EDC48E"/><stop offset="1" stop-color="#D9A86E"/></radialGradient>
<linearGradient id="combG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${RED_LT}"/><stop offset="1" stop-color="${RED}"/></linearGradient>
</defs>`
const faces = {
  dots: `<circle cx="27.4" cy="36.6" r="1.4" fill="${FACE}"/><circle cx="36.6" cy="36.6" r="1.4" fill="${FACE}"/>`,
  happy: `<path d="M25.2 37.4Q27.4 34.6 29.6 37.4M34.4 37.4Q36.6 34.6 38.8 37.4" stroke="${FACE}" stroke-width="1.5" stroke-linecap="round" fill="none"/>`,
  wink: `<circle cx="27.4" cy="36.6" r="1.4" fill="${FACE}"/><path d="M34.4 37.2Q36.6 34.6 38.8 37.2" stroke="${FACE}" stroke-width="1.5" stroke-linecap="round" fill="none"/>`,
}
function egg(face = "happy", detail = true, shadow = true) {
  return (shadow ? `<ellipse cx="32" cy="60.2" rx="15" ry="2.2" fill="#000" opacity=".12"/>` : "") +
    // comb, tilted jauntily, with a darker base where it meets the shell
    `<g transform="rotate(-6 32 14)"><path d="${COMB}" fill="url(#combG)"/>${detail ? `<path d="M23.4 17.4C26 15 29 13.9 32.2 13.9C35.6 13.9 38.8 15.2 41.6 17.4" stroke="${RED_DK}" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".55"/>` : ""}</g>` +
    `<path d="${EGG}" fill="url(#eggG)"/>` +
    (detail ? `<path d="M22.6 24.8C20.6 28.4 19.4 32.4 19.2 36.2" stroke="#FFF8EC" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".9"/><circle cx="23.4" cy="40.6" r=".9" fill="#FFF8EC" opacity=".9"/>` : "") +
    faces[face] +
    `<path d="M27.6 41.2Q32 46.2 36.4 41.2" stroke="${FACE}" stroke-width="1.7" stroke-linecap="round" fill="none"/>` +
    `<ellipse cx="24.2" cy="41.6" rx="2.3" ry="1.6" fill="#EE6A4A" opacity=".42"/><ellipse cx="39.8" cy="41.6" rx="2.3" ry="1.6" fill="#EE6A4A" opacity=".42"/>` +
    // three leaves cradling the egg (never two)
    at(32, 59.4, -52, leaf(16.5, 7.8, -3.5, G3, G2, detail)) + at(32, 59.4, 52, leaf(16.5, 7.8, 3.5, G3, G2, detail)) + at(32, 59.4, -4, leaf(12.5, 7, 1, G2, GREEN, detail))
}
module.exports = { egg, defs }

/** The egg split into its parts, for the opening animation: each part is wrapped in its own group so CSS can move it
 *  (an animated element must not also carry its own transform attribute). */
module.exports.parts = function parts() {
  const s = egg("happy", true, true)
  const take = (re) => { const m = s.match(re); if (!m) throw new Error("missing " + re); return m[0] }
  const shadow = take(/<ellipse cx="32" cy="60\.2"[^>]*\/>/)
  const comb = take(/<g transform="rotate\(-6 32 14\)">[\s\S]*?<\/g>/)
  const body = take(/<path d="M32 12\.8[^>]*\/>/) + take(/<path d="M22\.6 24\.8[^>]*\/>/) + take(/<circle cx="23\.4" cy="40\.6"[^>]*\/>/)
  const happy = take(/<path d="M25\.2 37\.4[^>]*\/>/)
  const open = `<circle cx="27.4" cy="36.6" r="1.4" fill="${FACE}"/><circle cx="36.6" cy="36.6" r="1.4" fill="${FACE}"/>`
  const mouth = take(/<path d="M27\.6 41\.2[^>]*\/>/)
  const cheeks = (s.match(/<ellipse cx="(24\.2|39\.8)"[^>]*\/>/g) || []).join("")
  const leaves = s.match(/<g transform="translate\(32 59\.4\)[\s\S]*?<\/g>/g)
  return { shadow, comb, body, happy, open, mouth, cheeks, leaves }
}
