import { Opening, type SoundLabels } from "@/components/opening"
import { FarmName, OnFarmForYou } from "@/components/art/brand-mark"
import { FFY_ANIMATED, MERRY_EGG_ANIMATED, MERRY_EGG_DEFS } from "@/components/art/brand-marks.generated"
import { openingMarkOf, showPlatformLine } from "@/domain/brand"

/** FarmForYou's mark and name: the turmeric heart pops up, the leaves unfurl, the heart smiles. */
function PlatformMark({ app }: { app: string }) {
  return (
    <>
      <svg viewBox="0 0 64 64" className="size-44" aria-hidden dangerouslySetInnerHTML={{ __html: ownIds(FFY_ANIMATED, `ffy-${app}`) }} />
      <p className="op-rise op-d1 font-display text-5xl leading-none font-extrabold text-white" lang="en">
        Farm <span style={{ color: "#FFC93C" }}>For</span> You
      </p>
      <p className="op-rise op-d2 text-lg font-medium" style={{ color: "#FFF1C2" }} lang="en">
        Fresh from local farms
      </p>
    </>
  )
}

const FFY_GREEN = "#1E8A4C"

/** FarmForYou's own opening: the admin app, and a farm's apps when there is no farm to show. */
export function PlatformOpening({ app = "admin", sound }: { app?: "admin" | "shop" | "farm"; sound: SoundLabels }) {
  return (
    <Opening app={app} background={FFY_GREEN} sound={sound}>
      <PlatformMark app={app} />
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
 * A farm's opening, for its shop and its farm app: FarmForYou's part first, then the farm's own. With an opening mark
 * from the platform (the Merry Egg), that mark plays; otherwise the farm's own logo pops in. The farm's name and
 * tagline lead; FarmForYou's small line comes last.
 */
export function FarmOpening({ app, farm, sound }: { app: "shop" | "farm"; farm: Farm; sound: SoundLabels }) {
  const mark = openingMarkOf(farm.openingMark)
  const platformLine = showPlatformLine(farm.tagline)
  // Animation steps: a mark takes longer to draw, so the words wait for it (globals.css, Opening animations)
  const step = (n: 1 | 2 | 3 | 4) => (mark ? `op-d${n}` : `op-l${n}`)
  return (
    <Opening app={app} background="#FBF6EC" sound={sound} intro={{ background: FFY_GREEN, content: <PlatformMark app={app} /> }}>
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
