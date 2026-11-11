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

// ── The bullock cart, in the same flat, bold style ───────────────────────────

/** Points along a cubic curve, for shapes that taper (horns, tail). */
function cubicPts(p0: number[], p1: number[], p2: number[], p3: number[], n = 20): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]
  })
}

/** A filled shape along points, `w0` wide at the start narrowing to `w1`, from t0 to t1 of the way along. */
function taper(pts: [number, number][], w0: number, w1: number, t0 = 0, t1 = 1, fill = "#000") {
  const n = pts.length - 1
  const left: string[] = [], right: string[] = []
  for (let i = Math.round(t0 * n); i <= Math.round(t1 * n); i++) {
    const [x, y] = pts[i]
    const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(n, i + 1)]
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1
    const w = (w0 + (w1 - w0) * (i / n)) / 2
    left.push(`${(x - (dy / len) * w).toFixed(1)} ${(y + (dx / len) * w).toFixed(1)}`)
    right.unshift(`${(x + (dy / len) * w).toFixed(1)} ${(y - (dx / len) * w).toFixed(1)}`)
  }
  return `<path d="M${left.join("L")}L${right.join("L")}Z" fill="${fill}"/>`
}

/** A horn painted for Pongal: cream at the base, a gold band, then red to the tip. */
function horn(p0: number[], p1: number[], p2: number[], p3: number[], w: number, dim: boolean) {
  const pts = cubicPts(p0, p1, p2, p3)
  // The far horn sits a little in shadow.
  const [base, band, tip] = dim ? ["#CFC4A8", "#D9A31A", "#B52E25"] : ["#EADFC4", "#F5B700", "#D7362B"]
  return taper(pts, w, 1.2, 0, 1, base) + taper(pts, w, 1.2, 0.42, 0.62, band) + taper(pts, w, 1.2, 0.62, 1, tip) +
    (dim ? "" : taper(pts, w * 0.35, 0.4, 0.05, 0.4, "#FFFFFF80"))
}

/**
 * A Kangayam bull, hooves at 0,0, facing left. Grey-white with the breed's darker grey hump and shoulders, a long
 * face with a dark muzzle and dark-rimmed eyes, a deep dewlap, and tall horns painted for Pongal. Bells on a red
 * neck cord, a nose rope. `far` is the bull on the other side of the yoke, in its shadow.
 * The legs step, the head nods and the tail swings as it walks.
 */
function bull(x: number, y: number, s: number, far: boolean, delay: number) {
  const P = far
    ? { body: "#D9D3C8", shade: "#C3BBAE", deep: "#A99F90", grey: "#B9B1A3", lines: "#B0A797" }
    : { body: "#F3F0E9", shade: "#DCD5C8", deep: "#C4BCAE", grey: "#CFC7B8", lines: "#C9C1B3" }
  const hoof = (hx: number) => `<path d="M${hx - 6} -6 h12 l1 6 h-14 z" fill="#3A3029"/><path d="M${hx} -6 v6" stroke="#1F1A16" stroke-width="1"/>`
  // Fore leg: forearm, knee, slim cannon, fetlock, hoof. Hind leg: thigh, the hock bending back, cannon, hoof.
  const fore = (lx: number, d: number, col: string, lean = 0) => `<g class="fs-step" style="animation-delay:-${d}s"><g transform="rotate(${lean} ${lx} -72)">
    <path d="M${lx - 9} -72 C${lx - 10} -50 ${lx - 7} -36 ${lx - 6} -30 C${lx - 6} -22 ${lx - 5} -14 ${lx - 6} -6 h12 C${lx + 5} -14 ${lx + 5} -22 ${lx + 6} -30 C${lx + 8} -38 ${lx + 9} -54 ${lx + 8} -72 Z" fill="${col}"/>
    <ellipse cx="${lx}" cy="-30" rx="6.5" ry="4" fill="${col}"/>${hoof(lx)}</g></g>`
  const hind = (lx: number, d: number, col: string, lean = 0) => `<g class="fs-step" style="animation-delay:-${d}s"><g transform="rotate(${lean} ${lx} -70)">
    <path d="M${lx - 12} -70 C${lx - 8} -50 ${lx - 4} -38 ${lx - 4} -32 C${lx - 4} -24 ${lx - 6} -14 ${lx - 6} -6 h12 C${lx + 6} -14 ${lx + 6} -22 ${lx + 9} -30 C${lx + 14} -40 ${lx + 14} -56 ${lx + 10} -72 Z" fill="${col}"/>
    <path d="M${lx + 9} -30 C${lx + 11} -27 ${lx + 9} -24 ${lx + 6} -24" stroke="${P.lines}" stroke-width="1.4" fill="none"/>${hoof(lx)}</g></g>`
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="10" cy="1" rx="90" ry="6.5" fill="#000" opacity=".13"/>
    ${fore(-14, delay + 0.65, P.shade, 7)}${hind(84, delay + 0.15, P.shade, -6)}
    <g transform="translate(0 -10)"><g class="fs-tail" style="animation-delay:-${delay}s">
      <path d="M102 -88 C110 -70 108 -46 104 -22" stroke="${P.shade}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <path d="M104 -26 C110 -18 108 -8 102 -4 C98 -10 98 -20 104 -26 Z" fill="#2E2621"/>
    </g>
    <path d="M-38 -72 C-44 -86 -38 -98 -24 -102 C-20 -114 -8 -124 6 -122 C16 -120 22 -112 24 -104 C44 -102 66 -100 84 -98 C96 -97 104 -90 104 -80 C104 -70 100 -62 94 -56 C90 -52 84 -50 78 -50 C60 -46 30 -46 10 -48 C-6 -50 -22 -52 -30 -58 C-36 -62 -38 -66 -38 -72 Z" fill="${P.body}"/>
    <path d="M-24 -102 C-20 -114 -8 -124 6 -122 C16 -120 22 -112 24 -104 C20 -92 12 -82 0 -78 C-14 -76 -26 -82 -30 -92 Z" fill="${P.grey}"/>
    <path d="M-38 -72 C-40 -84 -36 -94 -28 -98 C-24 -86 -18 -74 -10 -64 C-18 -58 -28 -58 -32 -60 C-36 -63 -38 -67 -38 -72 Z" fill="${P.grey}" opacity=".75"/>
    <path d="M10 -48 C30 -46 60 -46 78 -50 C84 -50 90 -52 94 -56 C80 -58 56 -56 30 -56 C18 -56 12 -54 10 -48 Z" fill="${P.shade}"/>
    <path d="M94 -56 C100 -62 104 -70 104 -80 C98 -74 92 -66 86 -60 Z" fill="${P.shade}"/>
    <path d="M-8 -96 C2 -86 2 -70 -6 -58 M70 -96 C82 -86 84 -70 78 -56 M22 -62 C32 -67 46 -67 56 -62" stroke="${P.lines}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M30 -48 C32 -44 36 -42 40 -42 C38 -46 36 -48 30 -48 Z" fill="${P.shade}"/></g>
    ${fore(-26, delay, P.body, -8)}${hind(72, delay + 0.5, P.body, 7)}
    <g transform="translate(0 -10)"><path d="M-40 -74 C-50 -68 -52 -56 -44 -48 C-40 -46 -34 -50 -30 -58 C-34 -62 -38 -68 -40 -74 Z" fill="${P.shade}"/>
    <path d="M-44 -66 C-46 -60 -45 -54 -42 -50 M-40 -68 C-41 -62 -40 -56 -37 -52" stroke="${P.lines}" stroke-width="1.2" fill="none"/>
    <g class="fs-nod" style="animation-delay:-${delay}s">
      ${horn([-58, -102], [-66, -114], [-64, -128], [-54, -140], 6.5, true)}
      <path d="M-28 -100 C-40 -108 -52 -108 -60 -102 C-70 -96 -78 -84 -84 -70 C-88 -62 -88 -56 -84 -52 C-80 -48 -72 -48 -68 -52 C-60 -60 -50 -70 -40 -74 C-36 -80 -32 -90 -28 -100 Z" fill="${P.body}"/>
      <path d="M-40 -74 C-36 -80 -32 -90 -28 -100 C-34 -96 -40 -92 -46 -88 C-48 -82 -46 -78 -40 -74 Z" fill="${P.grey}" opacity=".8"/>
      <path d="M-84 -70 C-88 -62 -88 -56 -84 -52 C-80 -48 -72 -48 -68 -52 C-70 -58 -74 -64 -78 -70 C-80 -71 -82 -71 -84 -70 Z" fill="#4A4038"/>
      <path d="M-84 -60 q2 -2 4 0" stroke="#1F1A16" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M-80 -60 C-74 -64 -66 -62 -60 -56" stroke="#B5452B" stroke-width="1.8" fill="none"/>
      <ellipse cx="-63" cy="-88" rx="5.5" ry="3.8" fill="${P.deep}"/>
      <ellipse cx="-63.5" cy="-88" rx="3" ry="2.3" fill="#211A15"/><circle cx="-64.4" cy="-88.8" r=".8" fill="#fff"/>
      <path d="M-70 -80 C-68 -76 -66 -72 -66 -66" stroke="${P.lines}" stroke-width="1.3" fill="none"/>
      ${horn([-50, -104], [-56, -118], [-50, -132], [-38, -142], 7.5, false)}
      <path d="M-46 -98 C-40 -102 -32 -100 -26 -94 C-30 -90 -38 -90 -46 -98 Z" fill="${P.shade}"/>
      <path d="M-43 -97 C-38 -99 -33 -97 -30 -94 C-34 -93 -39 -94 -43 -97 Z" fill="#D9A79A"/>
      <path d="M-56 -104 C-54 -108 -50 -108 -48 -104" stroke="#D7362B" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </g>
    <path d="M-42 -80 C-44 -70 -40 -60 -32 -56" stroke="#C8321E" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <circle cx="-41" cy="-66" r="3.4" fill="#E0A21B"/><circle cx="-36" cy="-59" r="3.4" fill="#E0A21B"/><circle cx="-41" cy="-66" r="1.1" fill="#8A6510"/><circle cx="-36" cy="-59" r="1.1" fill="#8A6510"/></g>
  </g>`
}

/** The cart wheel: an iron tyre on a wooden rim, ten spokes and a big hub. Turns as the cart rolls. */
const cartWheel = (cx: number, cy: number, r: number) => {
  const spokes = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5
    return `<line x1="${(Math.cos(a) * 8).toFixed(1)}" y1="${(Math.sin(a) * 8).toFixed(1)}" x2="${(Math.cos(a) * (r - 7)).toFixed(1)}" y2="${(Math.sin(a) * (r - 7)).toFixed(1)}"/>`
  }).join("")
  return `<g transform="translate(${cx} ${cy})"><g class="fs-wheel">
    <circle r="${r}" fill="none" stroke="#3A2A1C" stroke-width="4"/>
    <circle r="${r - 4.5}" fill="none" stroke="#8A5A35" stroke-width="7"/>
    <path d="M${r * 0.62} ${r * 0.62} A${r - 4.5} ${r - 4.5} 0 0 1 ${-r * 0.62} ${r * 0.62}" stroke="#6E4428" stroke-width="7" fill="none"/>
    <g stroke="#7A4B2A" stroke-width="4.5" stroke-linecap="round">${spokes}</g>
    <circle r="11" fill="#6B4A2E"/><circle r="5" fill="#3A2A1C"/>
    <path d="M${-r * 0.7} ${-r * 0.7} A${r} ${r} 0 0 1 ${r * 0.2} ${-r * 0.98}" stroke="#6E6258" stroke-width="2" fill="none"/>
    ${[0, 72, 144, 216, 288].map((d) => `<circle cx="${(Math.cos((d * Math.PI) / 180) * 8).toFixed(1)}" cy="${(Math.sin((d * Math.PI) / 180) * 8).toFixed(1)}" r="1.2" fill="#C9A66A"/>`).join("")}
  </g></g>`
}

/** The farmer up front: mundasu, moustache, white shirt and veshti, a gold towel on his shoulder; reins in one hand, the stick raised in the other. */
const driverFigure = () => `<g>
  <g class="fs-whip">
    <path d="M6 -34 C14 -40 18 -46 18 -54" stroke="#8E5328" stroke-width="5.5" fill="none" stroke-linecap="round"/>
    <circle cx="18" cy="-55" r="3.4" fill="#8E5328"/>
    <path d="M19 -56 L-34 -112" stroke="#6B4A2E" stroke-width="2.6" stroke-linecap="round"/>
  </g>
  <path d="M10 -6 L-14 -8 C-22 -8 -26 -2 -25 6 L-24 24 L-14 24 L-14 6 L8 6 Z" fill="#FFFDF6"/>
  <path d="M-4 -6 C-6 0 -10 4 -14 6 M-20 4 L-20 22" stroke="#E2DCCC" stroke-width="1.4" fill="none"/>
  <path d="M-14 22 h-10 l-6 4 h16 z" fill="#8E5328"/>
  <path d="M-12 -40 C-16 -26 -14 -12 -8 -4 L10 -4 C14 -14 14 -30 8 -40 C2 -44 -6 -44 -12 -40 Z" fill="#FFFDF6"/>
  <path d="M-2 -18 C0 -12 2 -8 2 -4 M-9 -30 C-10 -22 -9 -14 -6 -8" stroke="#E2DCCC" stroke-width="1.3" fill="none"/>
  <path d="M2 -42 C8 -42 12 -38 12 -30 L8 -10 L2 -12 L6 -30 C6 -34 4 -38 0 -40 Z" fill="#F5B700"/>
  <path d="M8 -10 L2 -12 M4 -36 L10 -34" stroke="#C8321E" stroke-width="1.8"/>
  <path d="M-8 -36 C-14 -28 -18 -22 -22 -18" stroke="#8E5328" stroke-width="5.5" fill="none" stroke-linecap="round"/>
  <circle cx="-23" cy="-17" r="3.4" fill="#8E5328"/>
  <path d="M-4 -46 h8 v7 h-8z" fill="#7E4722"/>
  <ellipse cx="0" cy="-54" rx="9.5" ry="10.5" fill="#9A5A2C"/>
  <path d="M-9 -55 C-12.5 -53 -12.5 -49 -9 -48 Z" fill="#9A5A2C"/>
  <ellipse cx="7.5" cy="-53" rx="2.4" ry="3.4" fill="#8E5328"/>
  <circle cx="-5" cy="-56" r="1.4" fill="#1F140E"/>
  <path d="M-8.5 -59.5 q3 -2 6 0" stroke="#1F140E" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  <path d="M-12 -48.5 C-9 -52 -4 -51 -1 -48.5 C-4 -46.5 -9 -45.5 -12 -48.5 Z" fill="#1F140E"/>
  <path d="M-8 -45 q2 1.2 4 0" stroke="#5A2E14" stroke-width="1" fill="none"/>
  <path d="M-10.5 -58 C-12.5 -68 -2 -72 6 -70 C12 -68 12.5 -62 10.5 -58 C4 -61 -4 -61 -10.5 -58 Z" fill="#FFFDF6"/>
  <path d="M-10 -61.5 C-2 -65.5 6 -65.5 11 -61.5 M-8 -65.5 C-1 -68.5 5 -68.5 9 -66" stroke="#E2DCCC" stroke-width="1.2" fill="none"/>
  <path d="M9.5 -64 q6.5 -2 7.5 3 q-1 6 -5 9 q0 -6 -2.5 -8z" fill="#FFFDF6"/>
</g>`

/** The load: a bit of every kind of farm. Sacks, a basket of eggs, greens and tomatoes, bananas, a milk can, coconuts. */
const load = () => `
  <path d="M372 -6 C366 -30 372 -46 388 -48 C404 -46 408 -28 404 -6 Z" fill="#D9C08F"/><path d="M380 -44 q8 -6 16 0" stroke="#A88A55" stroke-width="2" fill="none"/><path d="M384 -47 l4 -6 l4 6" stroke="#8A6B3A" stroke-width="2" fill="none"/><path d="M378 -30 q10 4 20 0" stroke="#C4A672" stroke-width="1.4" fill="none"/>
  <path d="M410 -6 C406 -24 410 -36 422 -38 C434 -36 438 -24 434 -6 Z" fill="#C9AE7A"/>
  <g transform="translate(456 -6)"><path d="M-20 0 L-24 -26 H24 L20 0 Z" fill="#C98A3E"/><path d="M-22 -14 H22 M-21 -6 H21" stroke="#A86B2C" stroke-width="2"/><path d="M-16 0 L-18 -26 M-6 0 L-6 -26 M6 0 L6 -26 M16 0 L18 -26" stroke="#B57A33" stroke-width="1.4"/>
    ${[-14, -4, 6, 16].map((ex, i) => `<ellipse cx="${ex}" cy="-29" rx="5.5" ry="7" fill="${i % 2 ? "#F3E6CF" : "#DDBF94"}"/>`).join("")}</g>
  <g transform="translate(340 -6)"><rect x="-22" y="-22" width="44" height="22" rx="2" fill="#A86B3C"/><path d="M-22 -11 H22" stroke="#8A5530" stroke-width="2"/>
    <path d="M-14 -22 C-18 -40 -8 -46 -6 -30 M-4 -22 C-4 -44 8 -46 4 -26 M8 -22 C12 -38 22 -36 14 -22" stroke="#3E8B4E" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="-12" cy="-24" r="5" fill="#D7362B"/><circle cx="12" cy="-25" r="5" fill="#E04A2E"/><ellipse cx="2" cy="-24" rx="4" ry="6" fill="#6B3A7A"/></g>
  <g transform="translate(494 -6)"><path d="M-9 -34 h18 v6 l6 6 v22 h-30 v-22 l6 -6 z" fill="#C9CED3"/><rect x="-10" y="-38" width="20" height="5" rx="2" fill="#AEB6BD"/><path d="M-15 -20 h30" stroke="#9AA3AB" stroke-width="2"/><path d="M-11 -18 v14" stroke="#E6EAED" stroke-width="3" stroke-linecap="round"/></g>
  <g transform="translate(526 -10) scale(1.25)"><g class="fs-sway" style="animation-delay:-.6s"><g transform="translate(-9 0) rotate(-24)"><path d="M-3 0 C-6 -8 -6 -18 -2 -26 C-1 -28 1 -28 1 -26 C-2 -18 -1 -9 3 -1 Z" fill="#E9B514"/><path d="M-2 -26 C-1 -28 1 -28 1 -26 L0 -24 Z" fill="#6E8B2E"/></g><g transform="translate(-3 -1) rotate(-10)"><path d="M-3 0 C-6 -8 -6 -18 -2 -26 C-1 -28 1 -28 1 -26 C-2 -18 -1 -9 3 -1 Z" fill="#F5C518"/><path d="M-2 -26 C-1 -28 1 -28 1 -26 L0 -24 Z" fill="#6E8B2E"/></g><g transform="translate(3 -1) rotate(4)"><path d="M-3 0 C-6 -8 -6 -18 -2 -26 C-1 -28 1 -28 1 -26 C-2 -18 -1 -9 3 -1 Z" fill="#F5C518"/><path d="M-2 -26 C-1 -28 1 -28 1 -26 L0 -24 Z" fill="#6E8B2E"/></g><g transform="translate(9 0) rotate(18)"><path d="M-3 0 C-6 -8 -6 -18 -2 -26 C-1 -28 1 -28 1 -26 C-2 -18 -1 -9 3 -1 Z" fill="#E9B514"/><path d="M-2 -26 C-1 -28 1 -28 1 -26 L0 -24 Z" fill="#6E8B2E"/></g><g transform="translate(-6 4) rotate(-16)"><path d="M-3 0 C-6 -8 -6 -18 -2 -26 C-1 -28 1 -28 1 -26 C-2 -18 -1 -9 3 -1 Z" fill="#F7CF3A"/><path d="M-2 -26 C-1 -28 1 -28 1 -26 L0 -24 Z" fill="#6E8B2E"/></g><g transform="translate(0 4) rotate(-2)"><path d="M-3 0 C-6 -8 -6 -18 -2 -26 C-1 -28 1 -28 1 -26 C-2 -18 -1 -9 3 -1 Z" fill="#F7CF3A"/><path d="M-2 -26 C-1 -28 1 -28 1 -26 L0 -24 Z" fill="#6E8B2E"/></g><g transform="translate(6 4) rotate(12)"><path d="M-3 0 C-6 -8 -6 -18 -2 -26 C-1 -28 1 -28 1 -26 C-2 -18 -1 -9 3 -1 Z" fill="#F7CF3A"/><path d="M-2 -26 C-1 -28 1 -28 1 -26 L0 -24 Z" fill="#6E8B2E"/></g><path d="M-10 6 C-4 9 4 9 10 6" stroke="#7A5A2E" stroke-width="3.2" fill="none" stroke-linecap="round"/></g></g>
  <g fill="#5E9E45"><circle cx="398" cy="-56" r="8"/><circle cx="412" cy="-54" r="8"/><circle cx="405" cy="-64" r="8"/></g><g fill="#9CCB78"><circle cx="395" cy="-59" r="2.2"/><circle cx="409" cy="-57" r="2.2"/><circle cx="402" cy="-67" r="2.2"/></g><path d="M405 -72 l-2 -8 M405 -72 l6 -6" stroke="#3E7A2E" stroke-width="2.4" stroke-linecap="round"/>`

function cartScene(id: string, L: Light, plain: boolean) {
  const road = `<path d="M0 ${plain ? 304 : 288} C200 ${plain ? 300 : 282} 440 ${plain ? 300 : 284} 640 ${plain ? 304 : 290} V340 H0 Z" fill="#E3C79A"/>
    <path d="M0 ${plain ? 318 : 312} C220 314 420 314 640 318" stroke="#CDAE7C" stroke-width="3" fill="none" stroke-dasharray="14 10"/>`
  const cart = `
    <ellipse cx="440" cy="306" rx="122" ry="7" fill="#000" opacity=".12"/>
    ${bull(182, 298, 0.95, true, 0.5)}
    <path d="M140 196 L334 234" stroke="#6B4A2E" stroke-width="7" stroke-linecap="round"/>
    <g opacity=".55">${cartWheel(468, 250, 46)}</g>
    <g transform="translate(0 244)">
      <path d="M318 -4 h232 l-6 12 h-220 z" fill="#6B4024"/>
      <path d="M318 -52 V-14 M362 -54 V-14 M406 -56 V-14 M450 -56 V-14 M494 -54 V-14 M538 -52 V-14" stroke="#7A4B2A" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M316 -50 C400 -56 470 -56 552 -50" stroke="#8A5A35" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g transform="translate(-48 -12) scale(1.15)">${load()}</g>
      <rect x="312" y="-20" width="246" height="18" rx="3" fill="#A86B3C"/>
      <path d="M352 -20 v18 M394 -20 v18 M436 -20 v18 M478 -20 v18 M520 -20 v18" stroke="#8A5530" stroke-width="1.6"/>
      <path d="M318 -13 q12 -3 24 0 t24 0 M400 -9 q12 -3 24 0 t24 0 M486 -13 q12 -3 24 0 t24 0" stroke="#C08250" stroke-width="1.2" fill="none"/>
      <circle cx="320" cy="-11" r="1.6" fill="#4A2E18"/><circle cx="550" cy="-11" r="1.6" fill="#4A2E18"/>
    </g>
    <path d="M306 238 L300 264 M326 240 L322 264" stroke="#8A6B3A" stroke-width="1.8"/>
    <rect x="292" y="262" width="38" height="5" rx="2" fill="#7A4B2A"/>
    <g transform="translate(336 232) scale(1.22)">${driverFigure()}</g>
    <rect x="434" y="242" width="24" height="12" rx="2" fill="#4A2E18"/>
    ${cartWheel(446, 258, 48)}
    ${bull(150, 306, 1, false, 0)}
    <path d="M114 198 L160 191" stroke="#7A4B2A" stroke-width="8" stroke-linecap="round"/><path d="M114 198 L160 191" stroke="#9A6A40" stroke-width="2.4" stroke-linecap="round" transform="translate(0 -2)"/><path d="M122 191 v15 M152 186 v15" stroke="#5A3A20" stroke-width="3" stroke-linecap="round"/>
    <path d="M72 236 C130 226 250 222 308 212" stroke="#B5452B" stroke-width="1.6" fill="none"/>
    <g class="fs-dust" fill="#E9D6B0" opacity=".8"><circle cx="512" cy="300" r="7"/><circle cx="528" cy="296" r="5"/><circle cx="540" cy="301" r="4"/></g>`
  if (plain) return `${road}${cart}`
  return `${sky(id, L)}${hills()}${road}${cart}${tint(L)}${L.stars ? fireflies() : ""}`
}

const VIEWBOX: Record<DrawnScene, string> = { gate: "0 0 640 340", stall: "0 0 640 340", hen: "150 140 360 190" }

/** The whole <svg> for a scene in a light. Decorative: the words on it are said elsewhere on the page. */
export function farmSceneSvg(kind: DrawnScene, phase: ScenePhase, words: SceneWords): string {
  const id = `fs-${kind}-${phase}` // same scene in the same light draws the same, so a repeated id is harmless
  const L = LIGHT[phase]
  const body = kind === "gate" ? gate(id, L, words) : kind === "stall" ? stall(id, L, words) : henScene(id, L)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[kind]}" class="farm-scene" aria-hidden="true" focusable="false">${body}</svg>`
}

/** The cart alone: the bulls' noses to the bananas, the stick's tip to the road. */
const CART_PLAIN_VIEWBOX = "48 70 548 250"

/** FarmForYou's bullock cart in the farm pictures' style: on the road with the farmland behind, or alone (`plain`). */
export function cartSceneSvg(phase: ScenePhase, plain = false): string {
  const id = `fs-cart-${phase}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${plain ? CART_PLAIN_VIEWBOX : "0 0 640 340"}" class="farm-scene" aria-hidden="true" focusable="false">${cartScene(id, LIGHT[phase], plain)}</svg>`
}

/** Width over height, so the box is sized before the drawing is in. */
export const SCENE_RATIO: Record<DrawnScene, string> = { gate: "640 / 340", stall: "640 / 340", hen: "360 / 190" }
export const CART_RATIO = { scene: "640 / 340", plain: "548 / 250" } as const
