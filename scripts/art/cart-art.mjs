// FarmForYou brand art, drawn in code so it can be regenerated: the Tamil bullock cart (vil vandi) carrying produce
// from every kind of farm, the farmer driving it, the farmland behind, and the cart-wheel mark for small sizes.
// svg(cls, { scene }) — cls "colour" or "line"; scene adds the farmland background. mark(size, bg, fg, hub).
// Run: node scripts/art/cart-art.mjs  → public/art/*.svg and src/app/icon.svg. PNG app icons: scripts/art/icons.mjs.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

const INK = "#1F2A22"
const SKIN = "#8B5A3C", WOOD = "#8E5C2E", WOOD_DARK = "#7A4E26", ROPE = "#6B4A2B"
const C = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
const E = (x, y, rx, ry) => `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`
const p = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`
// Soft shadow tone: no outline, hidden in the line version.
const shade = (d, o = 0.1) => `<path class="shade" d="${d}" fill="${INK}" opacity="${o}"/>`

// ── Kangayam bull (side view, facing left). Near legs are open paths so their outline doesn't cut the body. ──
const FRONT_LEG = "M118 236L120 280Q117 290 120 300L121 313L117 320L132 320L131 313L132 300Q135 290 132 280L134 236"
// Near front leg in stride: straight, angled forward to reach the next step, with a knee bulge and a slanted hoof.
const FRONT_LEG_STEP = "M118 236L110 280Q106 289 107 297L103 312L97 320L113 320L116 312L120 297Q124 289 125 280L134 236"
const HIND_LEG = "M224 226Q230 250 232 270L231 313L227 320L242 320L241 313L242 278Q249 270 247 258Q246 236 251 212"
const BODY = "M82 160Q96 158 106 166Q110 144 124 141Q139 141 145 156Q170 162 196 160Q220 155 233 158Q249 160 255 172Q259 196 251 214Q244 226 230 228Q212 231 200 232Q170 240 142 238Q126 247 114 246Q102 242 98 226Q92 210 84 198Z"
const bull = (hide, t, stepping) => `
<g transform="${t}">
  <path fill="${hide}" d="${FRONT_LEG}Z" transform="translate(20 -2)"/>
  <path fill="${hide}" d="${HIND_LEG}Z" transform="translate(-16 -2)"/>
  <path d="M137 318L152 318L151 311L141 311Z" fill="#3A3630" stroke-width="1.4"/>
  <path d="M211 318L226 318L225 311L215 311Z" fill="#3A3630" stroke-width="1.4"/>
  <path d="M254 172Q266 206 261 242" fill="none" stroke-width="2.6" stroke-linecap="round"/>
  ${p(E(261, 247, 3, 6), "#6E6A60", 'transform="rotate(-12 261 247)"')}
  <path fill="${hide}" d="${BODY}"/>
  ${shade("M142 238Q170 240 200 232Q212 231 230 228Q244 226 251 214Q252 226 240 234Q214 240 200 240Q170 246 142 242Z", 0.12)}
  ${shade("M98 226Q102 242 114 246Q126 247 142 238Q128 236 118 232Q106 228 100 214Z", 0.08)}
  <path fill="${hide}" d="${stepping ? FRONT_LEG_STEP : FRONT_LEG}"/>
  <path fill="${hide}" d="${HIND_LEG}"/>
  <path d="${stepping ? "M97 320L113 320L115.4 313L102.6 313Z" : "M117 320L132 320L131 313L121 313Z"}" fill="#3A3630" stroke-width="1.6"/>
  <path d="M227 320L242 320L241 313L231 313Z" fill="#3A3630" stroke-width="1.6"/>
  ${shade("M106 166Q110 144 124 141Q117 150 115 166Q112 176 106 180Z", 0.08)}
  ${stepping ? shade("M126 238L134 238L125 280Q121 292 117 310L111 310Q117 292 119 278Z", 0.08) : shade("M120 238L134 238L132 280Q131 296 132 312L121 312Q124 290 120 270Z", 0.07)}
  <path d="M150 166Q160 190 150 214M224 168Q238 194 228 222M104 228Q109 238 115 244M112 212Q118 224 121 234M120 146Q128 150 132 160" fill="none" stroke-width="1.4" opacity="0.45"/>
  <path fill="${hide}" d="M84 198Q88 176 82 160Q74 153 66 160Q60 176 52 200Q48 212 56 216Q64 219 70 211Q78 206 84 198Z"/>
  <path d="M53.5 199Q49 210 56 215.6Q63 218.6 69.5 211.4Q63 209 59 201Z" fill="#4A4640" stroke="none"/>
  ${shade("M66 160Q74 153 82 160Q88 176 84 198Q80 186 78 172Q74 162 66 160Z", 0.07)}
  <path fill="${hide}" d="M84 167Q98 163 104 171Q95 178 86 174Z"/>
  <path fill="#D8CBB0" d="M72 160Q65 138 73 115Q77 110 82 114Q75 137 81 160Z"/>
  <path fill="#D8CBB0" d="M82 158Q86 136 96 119Q100 115 103 120Q93 139 88 160Z"/>
  <path fill="#B4432F" d="M73 115Q77 110 82 114L80 125Q74 126 73 115Z"/>
  <path fill="#B4432F" d="M96 119Q100 115 103 120L99 129Q94 128 96 119Z"/>
  <path d="M84 198Q94 208 106 204M56 214q6 0 10-4" fill="none" stroke-width="2"/>
  <path fill="#E3B13C" d="${C(96, 215, 4)}"/>
  ${p(E(68, 178, 2, 2.6), INK)}
  ${p(E(55, 207, 1.6, 1.2), INK)}
</g>`

// Far bull sits up and back (smaller, higher hooves) so both heads and both pairs of horns read clearly.
const FAR = { dx: 44, dy: -16, s: 0.95 }
const farPt = (x, y) => [FAR.dx + x * FAR.s, FAR.dy + y * FAR.s]

// Yoke: seen from the side, only its end shows — a wooden block on the near neck, just in front of the hump, with pegs either side of the neck.
const yoke = () => `
  <path d="M90 152Q90 148 94 148H112Q116 148 116 152V162Q116 166 112 166H94Q90 166 90 162Z" fill="${WOOD}"/>
  <path d="M94 157H112" fill="none" stroke-width="1.2" opacity="0.5"/>
  <path d="M93 144V182M113 144V178" fill="none" stroke="${ROPE}" stroke-width="3" stroke-linecap="round"/>`

// ── Wheel: iron rim, wooden felloe, 12 spokes, hub, shadow on the lower side. ──
const wx = 425, wy = 260, R = 60
let spokes = ""
for (let i = 0; i < 12; i++) {
  const a = (i * Math.PI) / 6 + 0.12
  spokes += `M${(wx + 13 * Math.cos(a)).toFixed(1)} ${(wy + 13 * Math.sin(a)).toFixed(1)}L${(wx + 50 * Math.cos(a)).toFixed(1)} ${(wy + 50 * Math.sin(a)).toFixed(1)}`
}
const wheel = `
  <path d="${C(wx, wy, R)}${C(wx, wy, 50)}" fill="${WOOD_DARK}" fill-rule="evenodd"/>
  <path d="${C(wx, wy, R)}" fill="none" stroke-width="4.5" stroke="#3E3A36"/>
  <path d="${spokes}" fill="none" stroke="${WOOD_DARK}" stroke-width="6" stroke-linecap="round"/>
  <path d="${spokes}" fill="none" stroke-width="1.2" opacity="0.6"/>
  ${shade(`M${wx + 50} ${wy}A50 50 0 0 1 ${wx - 50} ${wy}A60 60 0 0 0 ${wx + 60} ${wy}Z`, 0.22)}
  <path d="M${wx + 15} ${wy - 52}A55 55 0 0 1 ${wx + 54} ${wy - 12}" fill="none" stroke="#B9844C" stroke-width="3" stroke-linecap="round"/>
  <path d="${C(wx, wy, 14)}" fill="${WOOD}"/>
  <path d="${C(wx, wy, 5)}" fill="#3E3A36"/>`

// ── Cart: pole, bed (longer, to fit the bigger load), posts and rail. ──
const pole = `
  <path d="M104 166L302 214" fill="none" stroke="${WOOD_DARK}" stroke-width="7" stroke-linecap="round"/>
  <path d="M104 166L302 214" fill="none" stroke-width="1.2" opacity="0.5"/>`
const bed = `
  <path d="M288 200H600V215H288Z" fill="${WOOD}"/>
  <path d="M296 204H340M360 206H420M450 203H520M540 205H590" fill="none" stroke="#A8743F" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M288 200H600V215H288Z" fill="${WOOD}"/>
  ${shade("M288 209H600V215H288Z", 0.18)}
  <path d="M300 215L330 228H540L580 215" fill="none" stroke-width="2"/>`
const rails = `
  ${[300, 362, 498, 594].map((x) => `<path d="M${x} 200V148" stroke="${WOOD_DARK}" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M${x} 200V148" stroke-width="1" opacity="0.5" fill="none"/>`).join("")}
  <path d="M296 172H598" stroke="${WOOD_DARK}" stroke-width="5" stroke-linecap="round" fill="none"/>`

// Banana bunch tied to the back post: a fan of ripe bananas with dark tips under a green crown.
const BANANAS = `
  <path d="M594 152Q602 148 606 156" fill="none" stroke="${ROPE}" stroke-width="2.2"/>
  ${[-34, -20, -6, 8].map((a) => `<g transform="rotate(${a} 607 160)"><path d="M607 160Q604 184 621 196Q628 198 627 193Q614 182 615 160Z" fill="#F0CB3C"/><path d="M621 196Q628 198 627 193L623 192Z" fill="#4A3B22"/></g>`).join("")}
  ${shade("M607 160Q605 178 612 188Q608 174 611 160Z", 0.15)}
  <path d="${E(610, 158, 7, 4.5)}" fill="#6F8F3A"/>`

// Tender coconut bunch (இளநீர்க் குலை): a compact cluster with the stalk hidden inside; only a short cut stub
// pokes out behind. Each nut turns away from the centre with its cap (calyx) towards it. Back row darker for depth.
const HUB = [446, 177]
const nut = (cx, cy, fill) => {
  const a = Math.atan2(cy - HUB[1], cx - HUB[0])
  return `<g transform="translate(${cx} ${cy}) rotate(${((a * 180) / Math.PI).toFixed(1)})"><path d="${E(0, 0, 10.5, 9)}" fill="${fill}"/>` +
    shade("M2 -8.5Q10.5 -6 10.5 0Q10.5 6 2 8.5Q7 2 2 -8.5Z", 0.14) +
    `<path d="${C(-9.5, 0, 2.6)}" fill="#4B6B2C" stroke-width="1.2"/></g>`
}
const TENDER =
  `<path d="M446 172L472 146L478 151L452 178Z" fill="#C9A84C" stroke-width="1.8"/>` +
  `<path d="${E(475, 148.5, 3.2, 4.4)}" fill="#E9D7A0" stroke-width="1.4" transform="rotate(45 475 148.5)"/>` +
  [[430, 164], [449, 160], [466, 167]].map(([x, y]) => nut(x, y, "#5E9338")).join("") +
  [[421, 183], [439, 191], [458, 191], [473, 181], [447, 178]].map(([x, y]) => nut(x, y, "#74AA48")).join("")
// Husked coconut: brown, a tuft of fibre on top, three eyes.
const HUSKED = (x, y) => `<path d="${E(x, y, 8, 7)}" fill="#8A5A32"/><path d="M${x - 3} ${y - 6}l1-5 2 4 1-5 2 6" fill="none" stroke="#5E3B1E" stroke-width="1.4"/>` +
  [[-2.6, -2.6], [0.4, -3.4], [-1.4, -0.4]].map(([dx, dy]) => p(C(x + dx, y + dy, 0.75), "#3E2A16", 'stroke-width="0.6"')).join("")

// ── The load: vegetables, keerai, grain sacks, eggs, milk, honey, coconuts, a hen basket, a pickle jar, bananas. ──
const load = `
  <path d="M410 200Q404 162 418 150L470 147Q484 160 478 200Z" fill="#CFA867"/>
  ${shade("M462 150L470 147Q484 160 478 200H462Q468 176 462 150Z", 0.12)}
  <path d="M418 150q-5-9 4-11M470 147q5-9-4-11M424 176h44M426 188h40" fill="none" stroke-width="1.3" opacity="0.6"/>
  <path d="M424 150Q421 126 432 120L470 117Q481 126 476 150Z" fill="#DDBB7E"/>
  ${shade("M462 119L470 117Q481 126 476 150H462Q467 134 462 119Z", 0.12)}
  <path d="M432 120q-4-8 4-10M470 117q4-8-4-10M432 136h38" fill="none" stroke-width="1.3" opacity="0.6"/>
  <path d="M432 117h40l-3 4h-34Z" fill="#E9D3A7"/>
  ${[440, 450, 460].map((x) => p(E(x, 111, 4.2, 5.2), "#FBF0DA")).join("")}
  ${TENDER}
  <path d="M486 200V160Q486 152 494 152H510Q518 152 518 160V200Z" fill="#C9CFD2"/>
  ${shade("M510 152Q518 152 518 160V200H510Z", 0.14)}
  <path d="M492 152V144H512V152M486 170H518M486 186H518" fill="#C9CFD2" stroke-width="1.6"/>
  <path d="M490 144V132Q490 126 496 126H508Q514 126 514 132V144Z" fill="#E0A030"/>
  <path d="M489 126h26v-5h-26Z" fill="#F4F1E8"/>
  <path d="M495 134h14v6h-14Z" fill="#FFF1C7" stroke-width="1.2"/>
  
  <path d="M520 186Q518 150 538 148Q558 150 558 186Z" fill="#C08A4A"/>
  <path d="M526 160H552M522 172H556M531 150L529 186M539 148V186M547 150L549 186" fill="none" stroke-width="1" opacity="0.55"/>
  <path d="M532 150Q534 138 541 138Q548 139 547 148Z" fill="#F7F4EC"/>
  <path d="M537 138l1-4 2 3 2-4 1 5" fill="#B4432F" stroke-width="1.2"/>
  <path d="M532 143l-4 1 4 2" fill="#E3B13C" stroke-width="1.2"/>
  ${p(C(536, 142, 0.9), INK)}
  ${HUSKED(529, 192)}${HUSKED(547, 192)}
  <path d="M566 200Q560 182 566 172Q570 166 578 166Q586 166 590 172Q596 182 590 200Z" fill="#8A4B2A"/>
  <path d="M570 166V160H586V166M562 182H594" fill="none" stroke-width="1.6"/>
  <path d="M568 160Q578 154 588 160" fill="#F4F1E8"/>
  ${shade("M584 168Q596 182 590 200H582Q588 184 584 168Z", 0.14)}
  <path d="M344 200L351 166H405L411 200Z" fill="#C08A4A"/>
  ${shade("M396 166H405L411 200H399Z", 0.12)}
  <path d="M347 182H408M345 192H410M360 166L357 200M378 166V200M396 166L399 200" fill="none" stroke-width="1.1" opacity="0.55"/>
  <path d="M354 166Q344 140 350 120Q358 134 360 166ZM360 166Q358 136 368 122Q372 142 366 166ZM348 166Q338 150 340 136Q350 148 356 166Z" fill="#3F7F3A"/>
  <path d="M347 156Q356 160 366 156" fill="none" stroke="#C08A4A" stroke-width="3"/>
  <path d="M372 166Q366 146 372 134Q380 148 380 166ZM382 166Q388 146 400 140Q396 156 388 166Z" fill="#4E8F45"/>
  ${p(C(392, 162, 7), "#D2452E")}${p(C(370, 163, 6), "#D2452E")}
  <path d="M378 164Q376 150 386 150Q394 152 392 162Q388 170 378 164Z" fill="#6B3A7A"/>
  <path d="M384 151l3-6" fill="none" stroke-width="1.6"/>
  ${BANANAS}`

// Farmer face in profile (facing left): forehead, nose, lips, chin; thick curled moustache; eye, brow, ear,
// grey stubble; white mundasu wrapped with folds, a thin red border, knot and tail at the back.
const FACE = `
    <path d="M334 133Q339 128 339 120Q339 110 329 108Q319 108 317 114L316 118Q315 120 312.6 123.2Q311.6 124.6 312.4 125.4Q313.4 126 314.4 126L314.6 127.6Q313.8 128.6 314.6 129.6Q315.2 131.6 317.4 133Q322 136 328 135Q332 135 334 133Z" fill="${SKIN}" stroke-width="1.6"/>
    ${shade("M318 131.6Q324 135 330 133.4Q333 132 334 130Q328 132.6 320 130Z", 0.28)}
    <path d="M329.4 120.6q3.2-2.4 4.4 0.8q0.4 4-3 4.2Z" fill="${SKIN}" stroke-width="1.2"/>
    <path d="M330.6 122.2q1.4 0.2 1.6 1.6" fill="none" stroke-width="0.9" opacity="0.6"/>
    <path d="M316.8 119.6q1.8-1.5 3.7 0q-1.9 1.3-3.7 0Z" fill="#FFFFFF" stroke-width="0.8"/>
    ${p(C(318.2, 119.6, 0.75), INK, 'stroke="none"')}
    <path d="M316.2 117.4q2.2-1.2 4.6-0.2" fill="none" stroke-width="1.3"/>
    <path d="M316.6 123.2q1.6 2 1.2 3.6" fill="none" stroke-width="0.9" opacity="0.5"/>
    <path d="M312.8 126.4Q316 124.8 319.2 126.4Q321.4 128.2 320.8 130Q318.4 127.8 315.6 128.1Q313.4 128.2 312.8 126.4Z" fill="#2A211B" stroke-width="1"/>
    <path d="M314.8 130q1.2 0.6 2.4 0.2" fill="none" stroke-width="1"/>
    <path d="M315.6 116.6Q314 108 320 104Q329 99 337 104Q342 108 340.2 117Q334 114 327 114.6Q320 115 315.6 116.6Z" fill="#FFFFFF" stroke-width="1.6"/>
    <path d="M317.4 111.6Q327 108.6 338.6 111.8M319.4 107.4Q328 104.4 335.6 106.8" fill="none" stroke="#9AA39C" stroke-width="1"/>
    <path d="M316.4 115.2Q327 112.4 339.8 115.6" fill="none" stroke="#B4432F" stroke-width="1.2"/>
    <path d="${C(340.6, 111.6, 2.8)}" fill="#FFFFFF" stroke-width="1.3"/>
    <path d="M342 113q7 3 7 11" fill="none" stroke="${INK}" stroke-width="5.2" stroke-linecap="round"/>
    <path d="M342 113q7 3 7 11" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`

// ── Farmer: leans into the drive. Upper body rotates about the hip; hands grip the ropes and the stick. ──
const HIP = [325, 195], LEAN = -7
const rot = ([x, y]) => {
  const a = (LEAN * Math.PI) / 180, dx = x - HIP[0], dy = y - HIP[1]
  return [HIP[0] + dx * Math.cos(a) - dy * Math.sin(a), HIP[1] + dx * Math.sin(a) + dy * Math.cos(a)].map((v) => +v.toFixed(1))
}
const farmer = () => {
  const [hx, hy] = rot([287, 167])
  const [nx, ny] = farPt(55, 207)
  const arm = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path class="skin" d="${d}" fill="none" stroke="${SKIN}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
  return `
  <path d="M${hx} ${hy}Q170 172 54 206" fill="none" stroke="${ROPE}" stroke-width="1.8"/>
  <path d="M${hx} ${hy + 1}Q${(hx + nx) / 2} ${hy + 14} ${nx} ${ny}" fill="none" stroke="${ROPE}" stroke-width="1.6"/>
  <path d="M292 204L302 204L300 234L292 234Z" fill="${SKIN}"/>
  <path d="M288 234h14l-1 5h-15Z" fill="${SKIN}"/>
  <path d="M312 184Q338 184 340 200L306 207Q294 207 293 199Q295 186 312 184Z" fill="#F4F1E8"/>
  ${shade("M306 200L340 200L306 207Q296 207 293 199Z", 0.1)}
  <g transform="rotate(${LEAN} ${HIP[0]} ${HIP[1]})">
    <path d="M311 140Q326 133 341 142L343 192Q326 197 309 190Z" fill="#F4F1E8"/>
    ${shade("M334 140Q341 142 341 142L343 192Q336 194 332 194Q336 168 334 140Z", 0.1)}
    <path d="M314 140L341 172L337 179L309 148Z" fill="#B4432F"/>
    <path d="M321 130h10v11h-10Z" fill="${SKIN}"/>
    ${arm("M318 147L304 170L289 167")}
    <path d="M350 110L290 48" fill="none" stroke="${ROPE}" stroke-width="3" stroke-linecap="round"/>
    ${arm("M337 146L349 124L345 104")}
    <path d="${E(287, 167, 4.6, 4)}" fill="${SKIN}"/>
    <path d="M284 165h6M284 169h6" fill="none" stroke-width="1" opacity="0.6"/>
    <path d="${E(345, 103, 4.4, 4.8)}" fill="${SKIN}"/>
    ${FACE}
  </g>`
}

// ── Road, dust kicked up behind the wheel, motion lines. ──
const ground = `
  <path d="M8 320H632" fill="none" stroke-width="2"/>
  <path d="M30 328H90M150 330H240M330 328H410M480 330H600" fill="none" stroke-width="1.4" opacity="0.5" stroke-dasharray="3 7"/>
  <path class="dust" d="${C(494, 314, 6)}${C(506, 308, 8)}${C(522, 312, 6)}${C(536, 306, 5)}${C(548, 311, 4)}" fill="#E7DCC6" stroke-width="1.2" opacity="0.85"/>
  <path d="M560 300h28M570 290h22M566 310h30" fill="none" stroke-width="1.6" opacity="0.4" stroke-linecap="round"/>
  <path d="M618 320q2-10 6-14M624 320q0-8-2-14M20 320q2-8 6-12M26 320q0-8-3-12" fill="none" stroke="#4E8F45" stroke-width="2"/>`

// ── Village scene behind (banner version): morning sun, coconut palms, paddy fields, the road. ──
const palm = (x, y, s) => `<g class="palm" transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="#C4D9BB" stroke-width="2.2" stroke-linecap="round">
  <path d="M0 0Q-6 -50 4 -100"/><path d="M4 -100Q-20 -112 -40 -96M4 -100Q30 -116 50 -98M4 -100Q-4 -126 -26 -134M4 -100Q16 -126 38 -130M4 -100Q-16 -96 -30 -74M4 -100Q24 -96 36 -74"/></g>`
// Farmland beside the road (Tamil delta look), back to front, pale enough that the cart stays the hero:
// sky birds, two rows of hills, a mixed tree line (round canopies + palm clusters), plots at different stages
// (ripe gold, green, flooded) with bunds slanting toward a vanishing point, a sugarcane block, ploughed furrows,
// a banana grove, young paddy rippling in the wind, egrets, an irrigation channel, then the road.
// Fills use class "bg" (no outline); thin field lines use class "farm"; both are hidden in the line version.
const VP = [320, 190]
const toward = (x, y, t) => [+(x + (VP[0] - x) * t).toFixed(1), +(y + (VP[1] - y) * t).toFixed(1)]
const range = (a, b, step) => { const o = []; for (let v = a; v <= b; v += step) o.push(v); return o }
const tree = (x, y, r) => `<path class="bg" d="M${x - 1.2} ${y}V${y - r}H${x + 1.2}V${y}Z" fill="#B9CBAE"/><path class="bg" d="${C(x, y - r - r * 0.5, r)}${C(x - r * 0.75, y - r - r * 0.2, r * 0.75)}${C(x + r * 0.8, y - r - r * 0.15, r * 0.7)}" fill="#CBDCC0"/>`
const egret = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><path class="bg" d="M-6 -6Q-6 -11 1 -10Q6 -9 5 -5Q2 -2 -3 -3Z" fill="#FFFFFF"/><path class="farm" d="M-6 -6Q-6 -11 1 -10Q6 -9 5 -5Q2 -2 -3 -3Z" fill="none" stroke="#C9C3B2" stroke-width="0.6"/><path class="farm" d="M3 -9Q7 -13 5 -17Q4 -20 7 -20M-1 -3v5M2 -3v5" fill="none" stroke="#8F8A7A" stroke-width="0.8" stroke-linecap="round"/><path class="farm" d="M7 -20l4 1" fill="none" stroke="#E0A030" stroke-width="1.2"/></g>`
const bananaClump = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><path class="bg" d="M-2 0V-16H2V0Z" fill="#A9C38F"/><path class="bg" d="M0 -16Q-14 -20 -22 -10Q-12 -12 0 -14ZM0 -16Q14 -22 22 -12Q12 -13 0 -14ZM0 -17Q-6 -30 -16 -32Q-8 -24 -1 -16ZM0 -17Q8 -30 16 -31Q8 -23 1 -16ZM0 -17Q0 -28 3 -34Q3 -24 1 -16Z" fill="#B6D29A"/></g>`
const scene = `
  <path class="bg" d="M0 0H640V340H0Z" fill="url(#ffy-sky)"/>
  <path class="bg" d="${C(540, 70, 90)}" fill="url(#ffy-glow)"/>
  <path class="bg" d="${C(540, 70, 42)}" fill="#F8D77A" opacity="0.35"/>
  <path class="bg" d="${C(540, 70, 30)}" fill="#F8D77A"/>
  <path class="farm" d="M452 58q4-3 8 0q4-3 8 0M474 44q3-2 6 0q3-2 6 0M436 76q3-2 6 0q3-2 6 0" fill="none" stroke="#B6A584" stroke-width="1.1" stroke-linecap="round"/>
  <path class="bg" d="M0 176Q70 150 140 166Q200 146 270 162Q340 140 420 160Q480 148 540 164Q600 150 640 160V200H0Z" fill="#E8EDE4"/>
  <path class="bg" d="M0 186Q90 170 180 182Q260 168 340 180Q430 168 520 182Q590 172 640 180V200H0Z" fill="#DFE7D7"/>
  ${tree(70, 194, 7)}${tree(118, 194, 9)}${tree(286, 192, 8)}${tree(400, 193, 7)}${tree(470, 194, 9)}${tree(612, 193, 8)}
  ${[[14, 196, 0.42], [36, 196, 0.52], [92, 196, 0.4], [250, 195, 0.46], [306, 195, 0.38], [430, 195, 0.44], [520, 196, 0.5], [584, 195, 0.42], [632, 196, 0.48]].map(([x, y, k]) => palm(x, y, k)).join("")}
  <path class="bg" d="M0 194H640V298H0Z" fill="#DCE8CA"/>
  <path class="bg" d="M0 194H120L112 210H0Z" fill="#E6E1AE"/>
  <path class="bg" d="M120 194H250L246 210H112Z" fill="#D3E3BA"/>
  <path class="bg" d="M250 194H380L384 210H246Z" fill="#DCEAE8"/>
  <path class="farm" d="M262 199H372M258 204H378" fill="none" stroke="#F3F8F6" stroke-width="1.4"/>
  <path class="bg" d="M380 194H510L522 210H384Z" fill="#E6E1AE"/>
  <path class="bg" d="M510 194H640V210H522Z" fill="#D3E3BA"/>
  <path class="farm" d="${range(4, 116, 6).map((x) => `M${x} 209q1-4 0-7`).join("")}${range(386, 516, 6).map((x) => `M${x} 209q1-4 0-7`).join("")}" fill="none" stroke="#D6CF8E" stroke-width="1"/>
  <path class="bg" d="M0 210H172L160 240H0Z" fill="#B9D49E"/>
  <path class="farm" d="${range(2, 160, 5).map((x, i) => `M${x} 240L${x + 2} ${213 + (i % 3) * 2}M${x + 2} ${215 + (i % 3) * 2}l-4-5M${x + 2} ${217 + (i % 3) * 2}l4-5`).join("")}" fill="none" stroke="#9EBF83" stroke-width="1.1" stroke-linecap="round"/>
  <path class="bg" d="M172 210H420L440 240H160Z" fill="#E8D8B9"/>
  <path class="farm" d="${range(166, 440, 16).map((x) => { const [tx, ty] = toward(x, 240, 0.6); return `M${x} 240L${tx} ${ty}` }).join("")}" fill="none" stroke="#D5C29E" stroke-width="1.2"/>
  <path class="bg" d="M420 210H640V240H440Z" fill="#D2E4BC"/>
  ${[[452, 238, 0.7], [478, 236, 0.85], [506, 238, 0.75], [534, 236, 0.9], [560, 238, 0.7], [588, 236, 0.85], [618, 238, 0.8]].map(([x, y, k]) => bananaClump(x, y, k)).join("")}
  <path class="bg" d="M0 240H640V290H0Z" fill="url(#ffy-near)"/>
  <path class="farm" d="${range(-200, 840, 26).map((x) => { const [tx, ty] = toward(x, 290, 0.5); return `M${x} 290L${tx} ${ty}` }).join("")}" fill="none" stroke="#B3D094" stroke-width="1"/>
  <path class="farm" d="M0 252Q40 248 80 252T160 252T240 252T320 252T400 252T480 252T560 252T640 252M0 268Q40 263 80 268T160 268T240 268T320 268T400 268T480 268T560 268T640 268M0 282Q40 277 80 282T160 282T240 282T320 282T400 282T480 282T560 282T640 282" fill="none" stroke="#D5E8C0" stroke-width="1.4"/>
  <path class="farm" d="M0 210H640M0 240H640M172 210L160 240M420 210L440 240M120 194L112 210M250 194L246 210M380 194L384 210M510 194L522 210" fill="none" stroke="#C3D6A8" stroke-width="1.6"/>
  ${egret(24, 278, 1)}${egret(300, 268, 0.85)}${egret(526, 282, 1.05)}${egret(616, 262, 0.8)}
  <path class="bg" d="M0 290H640V298H0Z" fill="#CFE2E4"/>
  <path class="farm" d="M10 294h16M60 293h10M140 295h18M230 293h12M330 294h16M420 295h12M500 293h18M590 294h14" fill="none" stroke="#F4FAFA" stroke-width="1.2" stroke-linecap="round"/>
  <path class="farm" d="M0 290H640M0 298H640" fill="none" stroke="#BCD2B0" stroke-width="1.2"/>
  <path class="bg" d="M10 212Q12 190 28 186Q44 190 46 212Z" fill="#E4CF8E"/>
  <path class="farm" d="M10 212Q12 190 28 186Q44 190 46 212M28 186V180M16 200Q28 196 40 200M13 206Q28 202 43 206" fill="none" stroke="#CDB676" stroke-width="1.2"/>
  <path class="bg" d="M0 298H640V340H0Z" fill="url(#ffy-road)"/>
  <path class="farm" d="M0 327Q320 324 640 327M0 335Q320 332 640 335" fill="none" stroke="#DCCDAE" stroke-width="2.4"/>
  <path class="bg" d="${E(70, 331, 2.4, 1.4)}${E(186, 318, 1.8, 1.1)}${E(262, 337, 2.2, 1.3)}${E(560, 337, 2, 1.2)}${E(612, 316, 1.6, 1)}" fill="#CBB993"/>
  <path class="farm" d="${range(4, 636, 9).map((x) => `M${x} 299q1-5 3-7M${x + 3} 299q0-4-1-6`).join("")}" fill="none" stroke="#B9CF9E" stroke-width="1.2"/>`


const svg = (cls, opts = {}) => `<svg class="${cls}" viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Farmer driving a bullock cart loaded with farm produce">
<style>
  .${cls} path{stroke-linejoin:round}
  .${cls} path:not([stroke]){stroke:${INK}}
  .${cls} path:not([stroke-width]){stroke-width:2}
  .${cls} path.shade,.${cls} path.bg{stroke:none}
  .${cls} .palm path{stroke:#BFD3B4;stroke-width:2}
  ${cls === "line" ? `.line path{fill:none!important}.line path[stroke]:not([stroke="#FFFFFF"]){stroke:${INK}!important}.line path[stroke-width]{stroke-width:2!important}.line .skin{stroke:none!important}.line .shade,.line .bg,.line .farm,.line .palm,.line .dust{display:none}` : ""}
</style>
<defs>
  <linearGradient id="ffy-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7E9C8"/><stop offset="0.6" stop-color="#FCF7EA"/></linearGradient>
  <radialGradient id="ffy-glow"><stop offset="0" stop-color="#FBE3A0" stop-opacity="0.75"/><stop offset="1" stop-color="#FBE3A0" stop-opacity="0"/></radialGradient>
  <linearGradient id="ffy-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D2E5B8"/><stop offset="1" stop-color="#BCD99C"/></linearGradient>
  <linearGradient id="ffy-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEE3CC"/><stop offset="1" stop-color="#E6D6B6"/></linearGradient>
</defs>
${opts.scene ? scene : ""}
${shade(E(330, 321, 300, 7), 0.06)}
${shade(E(230, 304, 70, 3.5), 0.1)}
${shade(E(178, 321, 82, 4.5), 0.16)}
${shade(E(430, 321, 70, 5), 0.2)}
${bull("#E4DED1", `translate(${FAR.dx} ${FAR.dy}) scale(${FAR.s})`, false)}
${pole}
${bull("#F7F4EC", "", true)}
${yoke()}
${bed}${load}${rails}${farmer()}${wheel}${ground}
</svg>`

// Brand mark for small sizes: the cart wheel, with a sprout at the hub.
const mark = (size, bg, fg, hub) => {
  let sp = ""
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6
    sp += `M${(32 + 9 * Math.cos(a)).toFixed(1)} ${(32 + 9 * Math.sin(a)).toFixed(1)}L${(32 + 20 * Math.cos(a)).toFixed(1)} ${(32 + 20 * Math.sin(a)).toFixed(1)}`
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="FarmForYou wheel mark"><rect width="64" height="64" rx="16" fill="${bg}"/><path d="${C(32, 32, 24)}${C(32, 32, 20)}" fill="${fg}" fill-rule="evenodd"/><path d="${sp}" stroke="${fg}" stroke-width="2.6" stroke-linecap="round"/><path d="${C(32, 32, 7)}" fill="${hub}"/><path d="M32 33V27M32 29q-4-1-5-5q4 0 5 5M32 28q3-1 4-5q-4 0-4 5" fill="none" stroke="${bg}" stroke-width="1.6" stroke-linecap="round"/></svg>`
}
export { svg, mark }

// Run directly (not imported): write the art files.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const art = path.join(root, "public", "art")
  fs.mkdirSync(art, { recursive: true })
  fs.writeFileSync(path.join(art, "cart-scene.svg"), svg("colour", { scene: true }))
  fs.writeFileSync(path.join(art, "cart.svg"), svg("colour"))
  fs.writeFileSync(path.join(art, "cart-line.svg"), svg("line"))
  fs.writeFileSync(path.join(art, "wheel.svg"), mark(512, "#1E6B45", "#FFF1C7", "#F5B700").replace("<svg ", "<svg xmlns=\"http://www.w3.org/2000/svg\" "))
  fs.writeFileSync(path.join(root, "src", "app", "icon.svg"), mark(64, "#1E6B45", "#FFF1C7", "#F5B700").replace("<svg ", "<svg xmlns=\"http://www.w3.org/2000/svg\" "))
  console.log("Wrote public/art/{cart-scene,cart,cart-line,wheel}.svg and src/app/icon.svg")
}
