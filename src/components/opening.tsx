import type { InstallApp } from "@/domain/install-apps"

/**
 * The opening overlay for one app. It is always in the page but hidden; the <head> script (src/lib/opening.ts) shows
 * it, runs it and takes it away, by setting attributes on <html>, so it is timed the same on every launch and the
 * page itself is never re-drawn. With an `intro` (FarmForYou's part, before a farm's own), the intro shows first,
 * then data-opening-stage="2" swaps to the farm's part, whose animations start as it appears.
 */
export function Opening({ app, background, intro, children }: { app: InstallApp; background: string; intro?: { background: string; content: React.ReactNode }; children: React.ReactNode }) {
  if (!intro) {
    return (
      <div id={`opening-${app}`} className="opening" data-app={app} style={{ background }} aria-hidden>
        {children}
      </div>
    )
  }
  return (
    <div id={`opening-${app}`} className="opening" data-app={app} style={{ background: intro.background }} aria-hidden>
      <div className="op-part op-part-intro" style={{ background: intro.background }}>
        {intro.content}
      </div>
      <div className="op-part op-part-farm" style={{ background }}>
        {children}
      </div>
    </div>
  )
}
