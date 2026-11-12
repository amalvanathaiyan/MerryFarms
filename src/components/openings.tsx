import { Opening } from "@/components/opening"
import { FarmName, OnFarmForYou } from "@/components/art/brand-mark"
import { FFY_ANIMATED, MERRY_EGG_ANIMATED, MERRY_EGG_DEFS } from "@/components/art/brand-marks.generated"
import { openingMarkOf, showPlatformLine } from "@/domain/brand"
import { OPENING_MS } from "@/lib/opening"

/** FarmForYou's own opening (the admin app): the turmeric heart pops up, the leaves unfurl, the heart smiles. */
export function PlatformOpening() {
  return (
    <Opening app="admin" ms={OPENING_MS.platform} background="#1E8A4C">
      <svg viewBox="0 0 64 64" className="size-44" aria-hidden dangerouslySetInnerHTML={{ __html: FFY_ANIMATED }} />
      <p className="op-rise op-d1 font-display text-5xl leading-none font-extrabold text-white" lang="en">
        Farm <span style={{ color: "#FFC93C" }}>For</span> You
      </p>
      <p className="op-rise op-d2 text-lg font-medium" style={{ color: "#FFF1C2" }} lang="en">
        Fresh from local farms
      </p>
    </Opening>
  )
}

/**
 * Gradient ids made unique per app: the farm app's pages also hold the shop's (hidden) opening, and a url(#id) would
 * otherwise find the hidden copy and draw nothing.
 */
const ownIds = (svg: string, app: string) => svg.replace(/id="([\w-]+)"/g, `id="$1-${app}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1-${app})`)

type Farm = { name: string; otherName: string | null; colours: string[]; tagline: string | null; logoUrl: string | null; initials: string; openingMark: string | null }

/**
 * A farm's opening, for its shop and its farm app. With an opening mark from the platform (the Merry Egg), that mark
 * plays; otherwise the farm's own logo pops in. The farm's name and tagline lead; FarmForYou's small line comes last.
 */
export function FarmOpening({ app, farm }: { app: "shop" | "farm"; farm: Farm }) {
  const mark = openingMarkOf(farm.openingMark)
  const platformLine = showPlatformLine(farm.tagline)
  // Animation steps: a mark takes longer to draw, so the words wait for it (globals.css, Opening animations)
  const step = (n: 1 | 2 | 3 | 4) => (mark ? `op-d${n}` : `op-l${n}`)
  return (
    <Opening app={app} ms={mark ? OPENING_MS.mark : OPENING_MS.logo} background="#FBF6EC">
      {mark === "merry-egg" ? (
        <svg viewBox="0 0 64 64" className="size-52" aria-hidden dangerouslySetInnerHTML={{ __html: ownIds(MERRY_EGG_DEFS + MERRY_EGG_ANIMATED, app) }} />
      ) : farm.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the farm's logo, served by our own route
        <img src={farm.logoUrl} alt="" className="op-pop size-40 rounded-3xl border bg-card object-contain shadow-lg" />
      ) : (
        <span className="op-pop grid size-40 place-items-center rounded-3xl bg-primary font-display text-6xl font-extrabold text-primary-foreground shadow-lg">{farm.initials}</span>
      )}
      <FarmName name={farm.name} colours={farm.colours} className={`op-rise ${step(1)} op-wide px-4 text-center font-display text-5xl leading-tight font-extrabold`} />
      {farm.otherName && <FarmName name={farm.otherName} colours={farm.colours} className={`op-rise ${step(2)} text-center font-display text-xl font-bold`} />}
      {farm.tagline &&
        (platformLine ? (
          <p className={`op-rise ${step(3)} op-wide px-4 text-center text-lg text-foreground/80`}>{farm.tagline}</p>
        ) : (
          <p className={`op-rise ${step(3)} op-platform-tag flex items-center gap-2.5 text-sm font-semibold text-primary uppercase`}>
            <span className="op-rule" />
            {farm.tagline}
            <span className="op-rule" />
          </p>
        ))}
      {platformLine && <OnFarmForYou className={`op-fade ${step(4)} mt-2`} />}
    </Opening>
  )
}
