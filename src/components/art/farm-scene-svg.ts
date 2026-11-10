/**
 * The farm's own live pictures, drawn as SVG text: the farm gate with country hens, the farm shop stall, and a hen
 * with her eggs. Each is drawn in the light of the time of day (dawn, day, evening, night). Original art for
 * FarmForYou farms. Hens are always coloured country hens: in Tamil Nadu a white bird reads as a broiler.
 *
 * Movement is plain CSS (classes fs-*, keyframes in globals.css), so it stops for anyone who turns animation off.
 * Transform origins are in each element's own coordinates. Pure: no React, so it is tested directly.
 */
import type { ScenePhase } from "@/domain/scenes"

export type DrawnScene = "gate" | "stall" | "hen"

export interface SceneWords {
  /** The farm's name for the gate sign. */
  name: string
  shop: string
  eggs: string
  chicken: string
  fresh: string
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const tamil = (s: string) => /[஀-௿]/.test(s)
const FONT = `font-family="var(--font-display), 'Noto Sans Tamil', sans-serif"`

/** Text that always fits its board: a smaller size first, then squeezed to the width if still too long. */
function fitText(text: string, x: number, y: number, maxW: number, size: number, attrs: string, inner = esc(text)) {
  const per = tamil(text) ? 0.6 : 0.54
  const fs = Math.max(size * 0.7, Math.min(size, maxW / (per * Math.max(1, text.length))))
  const est = per * fs * text.length
  const squeeze = est > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : ""
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${fs.toFixed(1)}" ${FONT} ${attrs}${squeeze}>${inner}</text>`
}

// ── Light ─────────────────────────────────────────────────────────────────────

interface Light {
  sky: [string, string, string]
  sun: { x: number; y: number; r: number; core: string; glow: string } | null
  moon: boolean
  cloud: string
  /** Laid over the land so it sits in the same light as the sky; null in daylight. */
  tint: { color: string; opacity: number } | null
  lamps: boolean
  stars: boolean
  awake: boolean
  birds: boolean
}

const LIGHT: Record<ScenePhase, Light> = {
  dawn: {
    sky: ["#9DC4E4", "#F6CDBB", "#FFE4B5"],
    sun: { x: 136, y: 196, r: 30, core: "#FFB547", glow: "#FFC56B" },
    moon: false, cloud: "#FFE9E1", tint: { color: "#FF9F68", opacity: 0.1 }, lamps: false, stars: false, awake: true, birds: true,
  },
  day: {
    sky: ["#8CCBF0", "#D7EEF8", "#FFF4D6"],
    sun: { x: 548, y: 70, r: 32, core: "#FFC928", glow: "#FFD54A" },
    moon: false, cloud: "#FFFFFF", tint: null, lamps: false, stars: false, awake: true, birds: true,
  },
  evening: {
    sky: ["#6F6AA6", "#EE8E6C", "#FFD38C"],
    sun: { x: 520, y: 196, r: 36, core: "#FF8A3D", glow: "#FFB070" },
    moon: false, cloud: "#F8BFAA", tint: { color: "#7A3E6B", opacity: 0.18 }, lamps: true, stars: false, awake: true, birds: false,
  },
  night: {
    sky: ["#0C1838", "#1E3160", "#3B4E7E"],
    sun: null,
    moon: true, cloud: "#4A5A86", tint: { color: "#0A1536", opacity: 0.5 }, lamps: true, stars: true, awake: false, birds: false,
  },
}

// ── Pieces ────────────────────────────────────────────────────────────────────

/** Country hen colourings: body, wing, tail, neck hackles, speckles. */
const HENS = {
  red: ["#A8471F", "#6E2A12", "#1F3A2B", "#F0A42A", "#FFD27A"],
  black: ["#2B2622", "#16130F", "#123B33", "#E9A93A", "#C9B48A"],
  speckled: ["#8A5A3A", "#5A3622", "#25402F", "#D9822B", "#F3E3C2"],
} as const
type HenTone = keyof typeof HENS

/** A country hen, feet at 0,0, facing right. Awake she pecks now and then; asleep she breathes, eyes shut. */
function hen(x: number, y: number, s: number, flip: boolean, delay: number, toneName: HenTone, awake: boolean) {
  const t = HENS[toneName]
  const eye = awake
    ? `<circle cx="27" cy="-49" r="2" fill="#1A1A1A"/><circle cx="27.6" cy="-49.6" r=".6" fill="#fff"/>`
    : `<path d="M25 -49 q2 1.6 4 0" stroke="#1A1A1A" stroke-width="1.3" fill="none" stroke-linecap="round"/>`
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <ellipse cx="0" cy="1" rx="22" ry="4" fill="#000" opacity=".12"/>
    <g class="${awake ? "" : "fs-breathe"}" style="animation-delay:-${delay}s">
    <path d="M-20 -32 C-34 -58 -46 -54 -44 -42 C-40 -34 -30 -28 -18 -24 Z" fill="${t[2]}"/>
    <path d="M-18 -30 C-28 -50 -38 -48 -37 -40 C-34 -34 -26 -30 -16 -27 Z" fill="#2F7A5A"/>
    <path d="M-22 -36 C-30 -46 -36 -46 -38 -42" stroke="#5FBF8F" stroke-width="1.6" fill="none" opacity=".8"/>
    <line x1="-5" y1="-12" x2="-7" y2="0" stroke="#E0A21B" stroke-width="3" stroke-linecap="round"/>
    <line x1="6" y1="-12" x2="7" y2="0" stroke="#E0A21B" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="0" cy="-28" rx="26" ry="18" fill="${t[0]}"/>
    <g fill="${t[4]}" opacity=".85"><circle cx="-14" cy="-24" r="1.6"/><circle cx="-8" cy="-18" r="1.4"/><circle cx="-2" cy="-22" r="1.6"/><circle cx="6" cy="-17" r="1.4"/><circle cx="-18" cy="-32" r="1.4"/><circle cx="12" cy="-21" r="1.3"/></g>
    <path d="M-14 -30 C-4 -42 14 -38 15 -27 C5 -18 -8 -20 -14 -30 Z" fill="${t[1]}"/>
    <path d="M-10 -29 C-2 -34 8 -32 11 -28 M-8 -25 C0 -29 8 -27 10 -24" stroke="${t[3]}" stroke-width="1.5" fill="none" opacity=".8"/>
    <g class="${awake ? "fs-head" : ""}" style="animation-delay:${delay}s"${awake ? "" : ` transform="rotate(12 16 -38)"`}>
      <path d="M8 -30 C10 -46 20 -56 27 -55 C33 -54 35 -46 31 -37 C24 -30 14 -28 8 -30 Z" fill="${t[3]}"/>
      <path d="M11 -33 L15 -40 M15 -32 L19 -40 M19 -32 L23 -41" stroke="${t[0]}" stroke-width="1.6" opacity=".55"/>
      <path d="M17 -40 C18 -50 23 -55 27 -55 C32 -54 34 -47 31 -41 Z" fill="${t[0]}"/>
      <path d="M18 -56 q2 -7 5 -1 q3 -7 5 0 q3 -5 4 2 z" fill="#D7362B"/>
      <ellipse cx="31" cy="-40" rx="2.6" ry="4.2" fill="#D7362B"/>
      <path d="M31 -49 L40 -46 L31 -43 Z" fill="#E8A317"/>
      ${eye}
    </g>
    </g>
  </g>`
}

/** A chick; awake it hops, asleep it sits still with its eyes shut. */
function chick(x: number, y: number, delay: number, awake: boolean) {
  const eye = awake ? `<circle cx="7.4" cy="-15" r="1" fill="#1A1A1A"/>` : `<path d="M6.4 -15 q1 .8 2 0" stroke="#1A1A1A" stroke-width="1" fill="none"/>`
  return `<g transform="translate(${x} ${y})"><g class="${awake ? "fs-hop" : ""}" style="animation-delay:${delay}s">
    <ellipse cx="0" cy="-7" rx="8" ry="6.5" fill="#F7D046"/>
    <circle cx="6" cy="-14" r="4.6" fill="#F7D046"/>
    <path d="M10 -15 L14 -13.5 L10 -12 Z" fill="#E8851B"/>
    ${eye}
    <line x1="-2" y1="-1" x2="-2" y2="1" stroke="#E0A21B" stroke-width="1.6"/><line x1="2" y1="-1" x2="2" y2="1" stroke="#E0A21B" stroke-width="1.6"/>
  </g></g>`
}

const eggs = (x: number, y: number) => `<g transform="translate(${x} ${y})">
  <ellipse cx="-7" cy="-7" rx="6" ry="7.5" fill="#E9D3B0"/><ellipse cx="5" cy="-8" rx="6" ry="7.5" fill="#F3E6CF"/><ellipse cx="-1" cy="-5" rx="6" ry="7.5" fill="#DDBF94"/>
</g>`

const palm = (x: number, y: number, s: number, delay: number) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M0 0 C4 -30 2 -60 10 -92" stroke="#8B6B4A" stroke-width="5" fill="none" stroke-linecap="round"/>
  <g transform="translate(10 -92)"><g class="fs-sway" style="animation-delay:-${delay}s">
    <path d="M0 0 C-14 -10 -30 -6 -40 6 M0 0 C14 -12 30 -8 40 4 M0 0 C-2 -14 2 -26 0 -32" stroke="#3E8B4E" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M0 0 C-8 -18 -22 -24 -32 -20 M0 0 C8 -18 22 -24 32 -20" stroke="#4E9C5C" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="-3" cy="4" r="3.5" fill="#7A5A2E"/><circle cx="3" cy="5" r="3.5" fill="#6B4C24"/>
  </g></g>
</g>`

const cloud = (x: number, y: number, s: number, dur: number, fill: string) => `<g transform="translate(${x} ${y}) scale(${s})">
  <g class="fs-cloud" style="animation-duration:${dur}s"><path d="M0 0 h70 a14 14 0 0 0 -10 -24 a20 20 0 0 0 -36 -6 a16 16 0 0 0 -24 30 z" fill="${fill}" opacity=".95"/></g>
</g>`

const fence = (x: number, y: number, n: number) => `<g transform="translate(${x} ${y})" stroke="#8A5A35" stroke-width="4" stroke-linecap="round">
  <line x1="0" y1="-12" x2="${n * 16}" y2="-12"/><line x1="0" y1="-24" x2="${n * 16}" y2="-24"/>
  ${Array.from({ length: n + 1 }, (_, i) => `<line x1="${i * 16}" y1="0" x2="${i * 16}" y2="-32"/>`).join("")}
</g>`

/** A small kolam of dots and loops on the path in front of the gate. */
const kolam = () => {
  const dots: string[] = []
  for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) dots.push(`<circle cx="${320 + c * 9}" cy="${306 + r * 5}" r="1.4"/>`)
  return `<g fill="#fff" opacity=".95"><ellipse cx="320" cy="306" rx="34" ry="13" fill="none" stroke="#fff" stroke-width="1.6"/>
    <path d="M290 306 q15 -13 30 0 q15 13 30 0 M290 306 q15 13 30 0 q15 -13 30 0" stroke="#fff" stroke-width="1.4" fill="none"/>${dots.join("")}</g>`
}

/** A hanging oil lamp with its warm pool of light. */
const lamp = (id: string, x: number, y: number, r = 44) => `
  <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id}-lamp)" class="fs-flicker"/>
  <path d="M${x - 5} ${y - 7} h10 l2 12 h-14 z" fill="#3A2A1C"/><rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="2" fill="#FFD36B"/>`

// ── Sky and land ──────────────────────────────────────────────────────────────

const STARS = [[40, 30], [96, 62], [150, 22], [204, 48], [262, 18], [300, 66], [352, 34], [404, 58], [446, 20], [470, 90], [590, 30], [612, 96], [70, 110], [178, 96], [380, 100], [620, 140], [24, 150], [236, 120]]

function sky(id: string, L: Light, h = 340) {
  const [top, mid, low] = L.sky
  let out = `<defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".62" stop-color="${mid}"/><stop offset="1" stop-color="${low}"/></linearGradient>
    <radialGradient id="${id}-glow"><stop offset=".5" stop-color="${L.sun?.glow ?? "#FFF3C4"}"/><stop offset=".72" stop-color="${L.sun?.glow ?? "#FFF3C4"}" stop-opacity=".35"/><stop offset="1" stop-color="${L.sun?.glow ?? "#FFF3C4"}" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}-lamp"><stop offset="0" stop-color="#FFD36B" stop-opacity=".75"/><stop offset=".4" stop-color="#FFB547" stop-opacity=".3"/><stop offset="1" stop-color="#FFB547" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="640" height="${h}" fill="url(#${id}-sky)"/>`
  if (L.stars) out += `<g fill="#FFF7D6">${STARS.map(([x, y], i) => `<circle class="fs-twinkle" style="animation-delay:-${(i * 0.37) % 3}s" cx="${x}" cy="${y}" r="${i % 3 === 0 ? 1.6 : 1.1}"/>`).join("")}</g>`
  if (L.moon) {
    out += `<g transform="translate(520 70)"><circle r="46" fill="url(#${id}-glow)" opacity=".55"/>
      <path d="M8 -24 A25 25 0 1 0 8 24 A19 19 0 1 1 8 -24 Z" fill="#FFF3C4"/></g>`
  }
  if (L.sun) {
    const s = L.sun
    out += `<g transform="translate(${s.x} ${s.y})"><circle class="fs-glow" r="${s.r * 1.8}" fill="url(#${id}-glow)"/><circle r="${s.r}" fill="${s.core}"/></g>`
  }
  if (L.birds) {
    out += `<g class="fs-birds" fill="none" stroke="#3E4A55" stroke-width="1.8" stroke-linecap="round">
      <path class="fs-flap" d="M0 0 q5 -5 10 0 q5 -5 10 0"/><g transform="translate(24 10) scale(.8)"><path class="fs-flap" style="animation-delay:-.3s" d="M0 0 q5 -5 10 0 q5 -5 10 0"/></g></g>`
  }
  out += cloud(-40, 64, 1, 70, L.cloud) + cloud(-300, 40, 0.8, 95, L.cloud) + cloud(-560, 92, 0.9, 82, L.cloud)
  return out
}

const hills = () => `
  <path d="M0 212 C120 176 230 184 330 204 C430 224 520 180 640 194 V340 H0 Z" fill="#7DB65A"/>
  ${palm(70, 206, 0.9, 0)}${palm(118, 200, 0.75, 1.5)}${palm(590, 198, 0.85, 0.8)}
  <path d="M0 240 C150 214 300 232 400 244 C500 256 570 232 640 236 V340 H0 Z" fill="#5E9E45"/>
  <path d="M0 262 C180 248 320 258 440 266 C530 272 600 262 640 262 V340 H0 Z" fill="#4C8A3A"/>
  <g fill="#3E7A2E">${Array.from({ length: 16 }, (_, i) => `<path d="M${20 + i * 40} 330 l3 -9 l3 9 l3 -7 l2 7 z"/>`).join("")}</g>`

const tint = (L: Light, x = 0, y = 0, w = 640, h = 340) => (L.tint ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${L.tint.color}" opacity="${L.tint.opacity}"/>` : "")

/** Fireflies over the grass at night. */
const fireflies = () =>
  `<g fill="#F8F2A0">${[[96, 270], [214, 252], [430, 262], [560, 248], [600, 284]].map(([x, y], i) => `<circle class="fs-firefly" style="animation-delay:-${i * 0.9}s" cx="${x}" cy="${y}" r="2.2"/>`).join("")}</g>`

// ── Scenes ────────────────────────────────────────────────────────────────────

function signText(name: string) {
  const words = name.trim().split(/\s+/)
  const inner = words.length > 1 ? `${esc(words[0])} <tspan fill="#2F7A3A">${esc(words.slice(1).join(" "))}</tspan>` : esc(name)
  return fitText(name, 320, 140, 156, 23, `font-weight="800" fill="#B23A2B"`, inner)
}

function gate(id: string, L: Light, w: SceneWords) {
  const awake = L.awake
  return `${sky(id, L)}${hills()}
  <path d="M300 340 L312 228 H328 L340 340 Z" fill="#E3C79A"/>
  <g transform="translate(320 226)">
    <rect x="-30" y="-30" width="60" height="30" fill="#F7EEDC"/>
    <path d="M-40 -28 L0 -52 L40 -28 Z" fill="#B5452B"/><path d="M-32 -32 L32 -32" stroke="#8E3420" stroke-width="2"/>
    <rect x="-7" y="-20" width="14" height="20" fill="#6B4A2E"/>
    <rect x="-24" y="-22" width="10" height="9" fill="#9FC3D8"/><rect x="14" y="-22" width="10" height="9" fill="#9FC3D8"/>
  </g>
  ${fence(70, 300, 9)}${fence(426, 300, 9)}
  <rect x="236" y="130" width="12" height="176" rx="3" fill="#7A4B2A"/><rect x="392" y="130" width="12" height="176" rx="3" fill="#7A4B2A"/>
  <path d="M248 152 q6 8 0 14 M392 152 q-6 8 0 14" stroke="#3E8B4E" stroke-width="3" fill="none"/>
  <circle cx="248" cy="168" r="3" fill="#F5B700"/><circle cx="392" cy="168" r="3" fill="#F5B700"/>
  ${kolam()}
  ${hen(132, 318, 1.15, false, 0, "red", awake)}
  ${eggs(186, 322)}
  ${awake ? chick(206, 324, 0.4, true) + chick(228, 328, 1.1, true) : chick(170, 324, 0, false) + chick(100, 322, 0, false)}
  ${hen(526, 320, 1.05, true, 2.2, "black", awake)}
  ${chick(462, 326, 0.8, awake)}
  ${tint(L)}
  ${L.lamps ? `<rect x="296" y="204" width="10" height="9" fill="#FFD36B"/><rect x="334" y="204" width="10" height="9" fill="#FFD36B"/>${lamp(id, 242, 182, 40)}${lamp(id, 398, 182, 40)}` : ""}
  <circle cx="242" cy="128" r="9" fill="#D7362B"/><circle cx="242" cy="128" r="4" fill="#FFC928"/>
  <circle cx="398" cy="128" r="9" fill="#D7362B"/><circle cx="398" cy="128" r="4" fill="#FFC928"/>
  <rect x="232" y="112" width="176" height="40" rx="9" fill="#FFF8E7" stroke="#7A4B2A" stroke-width="4"/>
  ${signText(w.name)}
  ${L.stars ? fireflies() : ""}`
}

function stall(id: string, L: Light, w: SceneWords) {
  const awake = L.awake
  const egg = (x: number, i: number) => `<ellipse cx="${x}" cy="202" rx="5.5" ry="7" fill="${i % 2 ? "#F3E6CF" : "#E2C49A"}"/>`
  return `${sky(id, L)}${hills()}
  ${fence(16, 296, 6)}${fence(520, 296, 7)}
  <rect x="186" y="130" width="10" height="150" fill="#7A4B2A"/><rect x="444" y="130" width="10" height="150" fill="#7A4B2A"/>
  <g>${Array.from({ length: 9 }, (_, i) => `<path d="M${176 + i * 32} 112 h32 v26 a16 14 0 0 1 -32 0 z" fill="${i % 2 ? "#FFF8E7" : "#D7362B"}"/>`).join("")}</g>
  <rect x="172" y="104" width="296" height="12" rx="4" fill="#A3281F"/>
  <rect x="176" y="222" width="288" height="78" rx="6" fill="#A86B3C"/>
  <g stroke="#8A5530" stroke-width="2"><line x1="176" y1="240" x2="464" y2="240"/><line x1="176" y1="258" x2="464" y2="258"/><line x1="176" y1="276" x2="464" y2="276"/></g>
  <rect x="186" y="202" width="66" height="20" rx="3" fill="#D9B68A"/>${[0, 1, 2, 3, 4].map((i) => egg(196 + i * 12, i)).join("")}
  <rect x="388" y="202" width="66" height="20" rx="3" fill="#D9B68A"/>${[0, 1, 2, 3, 4].map((i) => egg(398 + i * 12, i + 1)).join("")}
  <path d="M286 222 h68 l-6 -26 h-56 z" fill="#C98A3E"/><path d="M292 198 q28 -40 56 0" stroke="#A86B2C" stroke-width="5" fill="none"/>
  ${[0, 1, 2, 3].map((i) => `<ellipse cx="${300 + i * 13}" cy="196" rx="6" ry="7.5" fill="${i % 2 ? "#F3E6CF" : "#DDBF94"}"/>`).join("")}
  ${hen(96, 322, 1.05, false, 0.6, "speckled", awake)}
  ${chick(150, 326, 0, awake)}${chick(168, 330, 0.9, awake)}
  ${tint(L)}
  ${L.lamps ? lamp(id, 320, 152, 70) : ""}
  <rect x="252" y="246" width="136" height="30" rx="6" fill="#20352A"/>
  ${fitText(w.shop, 320, 267, 122, 16, `font-weight="700" fill="#FFF8E7"`)}
  <g transform="translate(494 236)">
    <rect x="0" y="0" width="92" height="70" rx="5" fill="#20352A" stroke="#7A4B2A" stroke-width="4"/>
    <line x1="16" y1="70" x2="8" y2="96" stroke="#7A4B2A" stroke-width="4"/><line x1="76" y1="70" x2="84" y2="96" stroke="#7A4B2A" stroke-width="4"/>
    ${fitText(w.eggs, 46, 22, 80, 12, `font-weight="600" fill="#FFF8E7"`)}
    ${fitText(w.chicken, 46, 40, 80, 12, `font-weight="600" fill="#F5C542"`)}
    ${fitText(w.fresh, 46, 58, 80, 11, `fill="#CFE3D3"`)}
  </g>
  ${L.stars ? fireflies() : ""}`
}

/** The small picture: a hen with her eggs and chicks on a straw nest, no sky (sits on the page's own tile). */
function henScene(id: string, L: Light) {
  const awake = L.awake
  return `<defs><radialGradient id="${id}-glow"><stop offset=".5" stop-color="#FFF3C4"/><stop offset="1" stop-color="#FFF3C4" stop-opacity="0"/></radialGradient></defs>
  ${awake ? "" : `<g transform="translate(470 172)"><circle r="20" fill="url(#${id}-glow)" opacity=".6"/><path d="M4 -11 A11 11 0 1 0 4 11 A8 8 0 1 1 4 -11 Z" fill="#F5D77A"/></g>
    <g fill="#E9C46A">${[[200, 166], [236, 182], [420, 160], [440, 196]].map(([x, y], i) => `<circle class="fs-twinkle" style="animation-delay:-${i * 0.8}s" cx="${x}" cy="${y}" r="1.6"/>`).join("")}</g>`}
  <ellipse cx="320" cy="300" rx="190" ry="26" fill="#5E9E45" opacity=".35"/>
  <path d="M200 300 C240 272 400 272 440 300 Z" fill="#E6C98F"/>
  <path d="M206 300 C250 280 390 280 434 300" stroke="#C9A66A" stroke-width="3" fill="none"/>
  ${hen(318, 292, 2.1, false, 0, "red", awake)}
  ${eggs(420, 300)}${eggs(446, 304)}
  ${chick(232, 304, 0.3, awake)}${chick(256, 308, 1, awake)}`
}

const VIEWBOX: Record<DrawnScene, string> = { gate: "0 0 640 340", stall: "0 0 640 340", hen: "150 140 360 190" }

/** The whole <svg> for a scene in a light. Decorative: the words on it are said elsewhere on the page. */
export function farmSceneSvg(kind: DrawnScene, phase: ScenePhase, words: SceneWords): string {
  const id = `fs-${kind}-${phase}` // same scene in the same light draws the same, so a repeated id is harmless
  const L = LIGHT[phase]
  const body = kind === "gate" ? gate(id, L, words) : kind === "stall" ? stall(id, L, words) : henScene(id, L)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[kind]}" class="farm-scene" aria-hidden="true" focusable="false">${body}</svg>`
}

/** Width over height, so the box is sized before the drawing is in. */
export const SCENE_RATIO: Record<DrawnScene, string> = { gate: "640 / 340", stall: "640 / 340", hen: "360 / 190" }
