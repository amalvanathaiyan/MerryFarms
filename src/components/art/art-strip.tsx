import { cn } from "@/lib/utils"

/** A row of the farm's chosen drawings standing on a dashed ground line, like a little farm scene. Decorative. */
export function ArtStrip({ drawings, caption, className }: { drawings: { id: string; vb: string; d: string }[]; caption?: string; className?: string }) {
  if (drawings.length === 0) return null
  return (
    <figure className={cn("flex flex-col items-center gap-2", className)} aria-hidden={!caption}>
      <div className="flex w-full flex-wrap items-end justify-center gap-x-4 gap-y-2 border-b-2 border-dashed border-primary/30 px-2 pb-1 text-primary">
        {drawings.map((d) => {
          const [, , w, h] = d.vb.split(" ").map(Number)
          const height = 40
          return (
            <svg key={d.id} viewBox={d.vb} width={Math.round((w / h) * height)} height={height} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70" aria-hidden>
              <path d={d.d} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
          )
        })}
      </div>
      {caption && <figcaption className="font-display text-sm font-semibold text-primary">{caption}</figcaption>}
    </figure>
  )
}
