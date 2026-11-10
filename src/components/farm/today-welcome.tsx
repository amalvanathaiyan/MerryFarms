import Link from "next/link"
import { Store } from "lucide-react"
import { FarmScene, type SceneProps } from "@/components/art/farm-scene"

/**
 * The top of Today: the farm's live picture (the same one customers see that day, in the light of the hour), a hello
 * for the time of day, the date, and a way to look at the shop as customers do.
 * The shop opens right here, in the farm app; a bar across its top (ViewerBar) brings staff straight back.
 */
export function TodayWelcome({ scene, greeting, date, shopLabel }: { scene: SceneProps; greeting: string; date: string; shopLabel: string }) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-card">
      {/* The shop link sits on the picture's top-left (the sun or moon is top-right), on a solid tag so it reads on any sky. */}
      <div className="relative">
        <FarmScene scene={scene} priority />
        <Link
          href="/?browse"
          className="absolute top-2.5 left-2.5 inline-flex min-h-11 max-w-[calc(100%-1.25rem)] items-center gap-2 rounded-full border bg-card px-3.5 text-base font-bold text-primary shadow-md hover:bg-accent"
        >
          <Store className="size-5 shrink-0" aria-hidden /> <span className="truncate">{shopLabel}</span>
        </Link>
      </div>
      <div className="p-3">
        <h1 className="font-display text-2xl leading-tight font-bold break-words">{greeting}</h1>
        <p className="text-sm text-muted-foreground">{date}</p>
      </div>
    </section>
  )
}
