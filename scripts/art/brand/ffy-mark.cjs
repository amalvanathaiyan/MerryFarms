// FarmForYou mark (LOCKED 2026-11-12): five turmeric leaves on a smiling turmeric-yellow heart. Drawn in a 64×64 box.
const f = (n) => +n.toFixed(2)
// A turmeric leaf from its stalk at (0,0) to its tip at (b,-len): two halves either side of a curved midrib.
function leaf(len, w, b, light, dark, vein, withVeins) {
  const s = len * 0.1                                  // short stalk
  const mid = `Q${f(b*.18)} ${f(-len*.55)} ${f(b)} ${f(-len)}`
  const back = `Q${f(b*.18)} ${f(-len*.55)} 0 ${f(-s)}`
  const right = `M0 ${f(-s)}C${f(w*.8)} ${f(-len*.24)} ${f(w*.5+b*.55)} ${f(-len*.74)} ${f(b)} ${f(-len)}${back}Z`
  const left = `M0 ${f(-s)}C${f(-w*.8)} ${f(-len*.24)} ${f(-w*.5+b*.55)} ${f(-len*.74)} ${f(b)} ${f(-len)}${back}Z`
  let v = ""
  if (withVeins) for (let i = 0; i < 5; i++) {
    const t = .24 + i * .13, mx = b*.18*2*t*(1-t) + b*t*t, my = -s + (-len + s)*(2*t*(1-t)*.55/.9 + t*t) * 1
    const half = w * .42 * Math.sin(Math.PI * Math.min(.95, t)), up = len * .075
    v += `M${f(mx)} ${f(my)}Q${f(mx+half*.5)} ${f(my-up*.4)} ${f(mx+half)} ${f(my-up)}M${f(mx)} ${f(my)}Q${f(mx-half*.5)} ${f(my-up*.4)} ${f(mx-half)} ${f(my-up)}`
  }
  return `<path d="M0 0L0 ${f(-s)}" stroke="${dark}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="${left}" fill="${light}"/><path d="${right}" fill="${dark}"/>` +
    `<path d="M0 ${f(-s)}${mid}" stroke="${vein}" stroke-width=".8" stroke-linecap="round" fill="none" opacity=".7"/>` +
    (v ? `<path d="${v}" stroke="${vein}" stroke-width=".45" stroke-linecap="round" fill="none" opacity=".45"/>` : "")
}
const HEART = "M32 58C23.5 52.2 19 47.2 19 42.2C19 38.5 21.8 35.8 25.2 35.8C28.2 35.8 30.6 37.6 32 40C33.4 37.6 35.8 35.8 38.8 35.8C42.2 35.8 45 38.5 45 42.2C45 47.2 40.5 52.2 32 58Z"
const face = (c, blush) => `<circle cx="28.2" cy="43.6" r="1.15" fill="${c}"/><circle cx="35.8" cy="43.6" r="1.15" fill="${c}"/><path d="M28.3 47Q32 50.6 35.7 47" stroke="${c}" stroke-width="1.5" stroke-linecap="round" fill="none"/><circle cx="25.6" cy="47" r="1.5" fill="${blush}" opacity=".5"/><circle cx="38.4" cy="47" r="1.5" fill="${blush}" opacity=".5"/>`
// [rotation, length, width, tip sweep, shade]
const LEAVES = [[-50, 27, 9.6, -6, 2], [50, 27, 9.6, 6, 2], [-23, 34, 10.6, -4.5, 1], [23, 34, 10.6, 4.5, 1], [-2, 39, 11.2, 2.5, 0]]
function mark(pal, veins = true) {
  return LEAVES.map(([r, len, w, b, k], i) => `<g class="ffy-leaf ffy-l${i+1}"><g transform="translate(32 40.5) rotate(${r})">${leaf(len, w, b, pal.light[k], pal.dark[k], pal.vein, veins)}</g></g>`).join("") +
    `<g class="ffy-heart"><path d="${HEART}" fill="${pal.heart}"/><g class="ffy-face">${face("#5A3A06", "#F07A2C")}</g></g>`
}
const onGreen = { light: ["#E2F7C8", "#C6EDA2", "#A8E07F"], dark: ["#C3EAA0", "#A5DC7E", "#88CC62"], vein: "#1E7A44", heart: "#F5B301" }
const onCream = { light: ["#2E9B5E", "#3CA968", "#52B87A"], dark: ["#1E8A4C", "#2A9655", "#3DA766"], vein: "#E9F7DD", heart: "#F5B301" }

module.exports = { mark, onGreen, onCream, HEART }
