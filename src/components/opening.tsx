import { Volume2, VolumeX } from "lucide-react"
import type { InstallApp } from "@/domain/install-apps"

export type SoundLabels = { on: string; off: string }

/**
 * The sound button, top right: shows whether sound is on and turns it off or on (the <head> script handles the tap).
 * Words beside the icon, so it reads without knowing the symbol.
 */
function SoundButton({ labels }: { labels: SoundLabels }) {
  return (
    <button type="button" data-op-sound className="op-sound">
      <span className="op-sound-on">
        <Volume2 className="size-5" aria-hidden /> {labels.on}
      </span>
      <span className="op-sound-off">
        <VolumeX className="size-5" aria-hidden /> {labels.off}
      </span>
    </button>
  )
}

/**
 * The opening overlay for one app. It is always in the page but hidden; the <head> script (src/lib/opening.ts) shows
 * it, runs it and takes it away, by setting attributes on <html>, so it is timed the same on every launch and the
 * page itself is never re-drawn. With an `intro` (FarmForYou's part, before a farm's own), the intro shows first,
 * then data-opening-stage="2" swaps to the farm's part, whose animations start as it appears.
 */
export function Opening({ app, background, intro, sound, children }: { app: InstallApp; background: string; intro?: { background: string; content: React.ReactNode }; sound: SoundLabels; children: React.ReactNode }) {
  if (!intro) {
    return (
      <div id={`opening-${app}`} className="opening" data-app={app} style={{ background }}>
        <SoundButton labels={sound} />
        <div className="contents" aria-hidden>
          {children}
        </div>
      </div>
    )
  }
  return (
    <div id={`opening-${app}`} className="opening" data-app={app} style={{ background: intro.background }}>
      <SoundButton labels={sound} />
      <div className="op-part op-part-intro" style={{ background: intro.background }} aria-hidden>
        {intro.content}
      </div>
      <div className="op-part op-part-farm" style={{ background }} aria-hidden>
        {children}
      </div>
    </div>
  )
}
